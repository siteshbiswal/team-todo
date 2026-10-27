const { appears, openApp, ok, section, devices, BASE, today, overflowX, task } = require('./harness.cjs')

const rowOf = (page, po) => page.locator('tbody tr').filter({ has: page.locator(`input[value="${po}"]`) }).first()

module.exports = async browser => {
  section('Robustness: API failures')
  let a = await openApp(browser, { fail: (req, t) => t === 'outstanding_v' && req.method() === 'GET' ? { status: 500 } : null, hash: '#/outstanding' })
  ok(await appears(a.page.getByRole('alert')), 'load failure shows an error toast')
  ok(a.errors.length === 0, 'load failure does not crash the page')
  ok(await a.page.getByRole('link', { name: 'Today', exact: true }).isVisible(), 'navigation still usable after a failed load')
  await a.context.close()

  a = await openApp(browser, { fail: (req, t) => t === 'outstanding' && req.method() === 'PATCH' ? { status: 500 } : null, hash: '#/outstanding' })
  await a.page.waitForSelector('table')
  const row = rowOf(a.page, 'PO-1')
  const client = row.getByLabel('Client')
  await client.fill('SHOULD NOT STICK'); await client.blur()
  ok(await appears(a.page.getByRole('alert')), 'failed save shows an error')
  await a.page.waitForTimeout(200)
  ok((await row.getByLabel('Client').inputValue()) === 'GP Kendrapada', 'failed save rolls the cell back to the old value')
  await a.context.close()

  for (const [code, status, expected, label] of [['23505', 409, /already exists/i, 'duplicate key'], ['23514', 400, /negative/i, 'check constraint']]) {
    a = await openApp(browser, { fail: (req, t) => t === 'outstanding' && req.method() === 'PATCH' ? { status, code, body: { code, message: 'x' } } : null, hash: '#/outstanding' })
    await a.page.waitForSelector('table')
    const f = rowOf(a.page, 'PO-1').getByLabel('Invoice Amt')
    await f.fill('-5'); await f.blur()
    ok(await appears(a.page.getByRole('alert').filter({ hasText: expected })), `${label} gives a friendly message`)
    await a.context.close()
  }

  a = await openApp(browser, { fail: (req, t) => t === 'record_payment' ? { status: 400, body: { message: 'row not found or not allowed' } } : null, hash: '#/outstanding' })
  await a.page.getByLabel('Open details').first().click()
  await a.page.getByPlaceholder('Amount received').fill('100'); await a.page.getByRole('button', { name: 'Add', exact: true }).click()
  ok(await appears(a.page.getByRole('alert').filter({ hasText: 'not allowed' })), 'payment RPC error is shown')
  await a.context.close()

  let down = false
  a = await openApp(browser, { fail: req => (down && req.method() !== 'GET' ? { abort: true } : null), hash: '#/outstanding' }); await a.page.waitForSelector('table')
  down = true
  const c2 = rowOf(a.page, 'PO-1').getByLabel('Client')
  await c2.fill('offline edit'); await c2.blur()
  ok(await appears(a.page.getByRole('alert')), 'network drop on save shows an error, not a silent loss')
  await a.page.waitForTimeout(200)
  ok((await rowOf(a.page, 'PO-1').getByLabel('Client').inputValue()) === 'GP Kendrapada', 'network drop rolls the cell back')
  ok(a.errors.every(e => !/PAGEERROR/.test(e)), 'network drop does not throw uncaught errors')
  await a.context.close()

  a = await openApp(browser, { fail: (req, t) => t === 'task_instances' ? { status: 401, body: { message: 'JWT expired', code: 'PGRST301' } } : null })
  ok(await appears(a.page.getByRole('alert').filter({ hasText: /JWT expired/ })), 'expired session surfaces a clear message')
  await a.context.close()

  section('Robustness: hostile & odd data (XSS, long text, special chars)')
  const evil = '<img src=x onerror="window.__xss=1">'
  const evil2 = '"><script>window.__xss=2</script>'
  const hostile = {
    outstanding_v: [{ id: 1, po_no: evil2, client: evil, balance: 5, days_overdue: 1, aging: '0-30', invoice_amt: 5, received: 0, remarks: evil, next_followup: today }],
    tenders: [{ id: 1, bid_no: evil, client: evil2, status: 'Quoted', next_followup: today }],
    task_instances: [task(1, { remarks: evil, task_templates: { team: evil, title: evil2, freq_text: evil, res1: evil, res2: null, final_res: null } })],
    profiles: [{ id: 'u1', name: evil, role: 'admin', team: null, active: true, email: evil2 }],
  }
  for (const [label, opts, path] of [['desktop', {}, ''], ['phone', devices['iPhone 13'], '']]) {
    a = await openApp(browser, { data: hostile, ...opts })
    await a.page.waitForTimeout(300)
    ok(await a.page.locator('main').innerText().then(t => t.includes('<img src=x')), `${label}: markup in task data is shown as text`)
    for (const h of ['#/outstanding', '#/tenders', '#/board', '#/admin', '#/summary']) { await a.page.goto(BASE + h); await a.page.waitForTimeout(250) }
    await a.page.goto(BASE + '#/outstanding'); await a.page.waitForTimeout(250)
    await (label === 'phone' ? a.page.locator('ul.md\\:hidden li button').first() : a.page.getByLabel('Open details').first()).click()
    await a.page.waitForTimeout(250)
    ok(!(await a.page.evaluate(() => window.__xss)), `${label}: no injected script ran in any screen or the drawer`)
    ok(a.errors.length === 0, `${label}: hostile data causes no errors`)
    await a.context.close()
  }

  a = await openApp(browser, { ...devices['iPhone 13'], data: { outstanding_v: [{ id: 1, po_no: 'X'.repeat(300), client: 'Y'.repeat(2000), balance: 1, days_overdue: 1, invoice_amt: 1, received: 0 }] }, hash: '#/outstanding' })
  ok(!(await overflowX(a.page)), 'phone: 2000-char unbroken text does not break the layout')
  await a.page.locator('ul.md\\:hidden li button').first().click(); await a.page.waitForTimeout(200)
  ok(!(await overflowX(a.page)), 'phone: long text in the drawer does not break the layout')
  await a.context.close()

  a = await openApp(browser, { hash: '#/outstanding' }); await a.page.waitForSelector('table')
  for (const q of ['(', '[', '.*', '\\', "'; drop table outstanding;--", '%', '_', '<b>', '🙂', ' ']) {
    await a.page.getByLabel('Search').fill(q)
  }
  ok(a.errors.length === 0, 'special characters in search never throw (regex/SQL/emoji)')
  await a.page.getByLabel('Search').fill('.*')
  ok(await a.page.locator('tbody tr').count() === 0 || (await a.page.locator('tbody tr').count()) === 0, '".*" is matched literally, not as a regex')
  await a.page.getByLabel('Search').fill("'; drop table"); await a.page.waitForTimeout(150)
  ok(a.requests.every(r => !/drop/i.test(r)), 'search text is never sent to the server')
  await a.context.close()

  section('Robustness: double taps on money actions')
  a = await openApp(browser, { hash: '#/outstanding' })
  await a.page.getByLabel('Open details').first().click()
  await a.page.getByPlaceholder('Amount received').fill('100')
  await a.page.getByRole('button', { name: 'Add', exact: true }).dblclick(); await a.page.waitForTimeout(400)
  ok(a.writes.filter(w => w.table === 'record_payment').length === 1, `double-tapping "Add payment" records once (recorded ${a.writes.filter(w => w.table === 'record_payment').length}x)`)
  await a.context.close()
  a = await openApp(browser, { hash: '#/outstanding' })
  await a.page.getByRole('button', { name: /＋ Add/ }).click()
  await a.page.locator('form input').nth(0).fill('Dup Client'); await a.page.locator('form input').nth(1).fill('10')
  await a.page.getByRole('button', { name: /Create/ }).dblclick(); await a.page.waitForTimeout(400)
  ok(a.writes.filter(w => w.method === 'POST' && w.table === 'outstanding').length === 1, `double-tapping "Create" adds one row (added ${a.writes.filter(w => w.method === 'POST' && w.table === 'outstanding').length}x)`)
  await a.context.close()

  section('Robustness: performance with 5,000 rows')
  const big = Array.from({ length: 5000 }, (_, i) => ({ id: i + 1, po_no: `PO-${i}`, client: `Client ${i % 97}`, dept: 'MC', firm: 'LTN', invoice_amt: 1000 + i, received: i % 50, balance: 1000 + i - (i % 50), days_overdue: i % 200, aging: '0-30', next_followup: i % 3 ? today : null }))
  a = await openApp(browser, { data: { outstanding_v: big } })
  let t0 = Date.now(); await a.page.goto(BASE + '#/outstanding'); await a.page.waitForSelector('tbody tr'); const tLoad = Date.now() - t0
  ok(tLoad < 3000, `first table render with 5,000 rows: ${tLoad} ms (< 3000)`)
  t0 = Date.now(); await a.page.getByRole('columnheader', { name: /Client/ }).click(); await a.page.waitForFunction(() => document.querySelector('tbody tr input')); const tSort = Date.now() - t0
  ok(tSort < 1500, `sort 5,000 rows: ${tSort} ms (< 1500)`)
  t0 = Date.now(); await a.page.getByLabel('Search').fill('Client 42'); await a.page.waitForFunction(() => document.querySelectorAll('tbody tr').length < 60); const tFilter = Date.now() - t0
  ok(tFilter < 1500, `filter 5,000 rows: ${tFilter} ms (< 1500)`)
  ok((await a.page.locator('tbody tr').count()) <= 50, 'only one page of rows is in the DOM (≤ 50)')
  await a.context.close()
}
