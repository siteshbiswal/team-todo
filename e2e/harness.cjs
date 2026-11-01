// Shared helpers for the browser tests. The Supabase REST/Auth endpoints are faked with Playwright
// routing, so the real UI runs against controllable data (and injected failures) without network access.
const { chromium, devices } = require('playwright')

const REF = 'lcftvmtspbzmnuvcjrhz'
const PORT = process.env.E2E_PORT || 4175
const BASE = `http://localhost:${PORT}/team-todo/`
const today = new Date().toLocaleDateString('en-CA')

const results = { pass: 0, fail: 0, failures: [] }
const ok = (cond, msg) => {
  console.log(cond ? '  PASS' : '  FAIL', msg)
  if (cond) results.pass++
  else { results.fail++; results.failures.push(msg) }
}
const section = name => console.log(`\n# ${name}`)

const KEY = 'test-team-key-0123456789abcdef'

const task = (id, over = {}) => ({
  id, due_date: today, status: 'Pending', remarks: null, done_at: null,
  task_templates: { team: 'Accounts', title: `Task ${id}`, freq_text: 'Daily', res1: 'Sutar', res2: null, final_res: null }, ...over,
})

function fixtures() {
  return {
    outstanding_v: [
      { id: 1, po_no: 'PO-1', client: 'GP Kendrapada', dept: 'MC', firm: 'LTN', invoice_amt: 500000, received: 200000, balance: 300000, days_overdue: 55, aging: '31-60', next_followup: today, invoice_date: '2026-09-01' },
      { id: 2, po_no: 'PO-2', client: 'Zilla Parishad', firm: 'MAC', invoice_amt: 100000, received: 0, balance: 100000, days_overdue: 95, aging: '90+', next_followup: null },
    ],
    tenders: [
      { id: 1, bid_no: 'GEM/1', status: 'Quoted', client: 'DTET Odisha', next_followup: today, emd_status: 'Pending', emd_amt: 20000, bid_open_date: today },
      { id: 2, bid_no: 'GEM/2', status: 'Won', client: 'ITI' },
    ],
    po_v: [{ id: 1, po_no: 'PO-1', client: 'GP Kendrapada', status: 'Vendor PO Placed', po_value: 500000, vendor_po_value: 400000, margin: 100000, client_delivery_due: '2020-01-01', vendor_delivery_date: today, po_date: '2026-09-05' }],
    po_tracker: [{ po_no: 'PO-1' }], logistics: [], logistics_v: [],
    service_v: [{ id: 1, status: 'Open', warranty_ends: today, po_no: 'PO-1', complaint: 'Not starting', under_warranty: 'Yes' }],
    sourcing: [{ id: 1, item_spec: 'Laptop', status: 'Enquiry Sent', next_followup: today }],
    task_instances: [
      task(1, { task_templates: { team: 'Sales / Pre-Sales', title: 'P1 - OUTSTANDING PAYMENT: call every party', freq_text: 'Daily', res1: 'Sagarika', res2: null, final_res: 'Vertical Heads' } }),
      task(2, { due_date: '2020-01-01', status: 'In Progress', remarks: 'Waiting', task_templates: { team: 'Accounts', title: 'Purchase bills entry in Tally', freq_text: 'Daily', res1: 'Sutar', res2: 'Smruti', final_res: null } }),
    ],
    audit_log: [], task_templates: [],
  }
}

/**
 * Opens the app the way a team member does after opening the shared link: the device already holds the key.
 * Options: data overrides, key (null = first visit with no link), access (true | false | 'offline' for check_access),
 * name (saved display name), query ('?k=…'), hash, viewport/device/colorScheme/timezoneId,
 * fail(req, table) -> { status, body?, code? } or { abort: true } to inject API errors.
 */
async function openApp(browser, { data = {}, key = KEY, access = true, name, fail, hash = '', query = '', ...ctxOpts } = {}) {
  const store = { ...fixtures(), ...data }
  const context = await browser.newContext({ viewport: { width: 1360, height: 860 }, acceptDownloads: true, ...ctxOpts })
  const page = await context.newPage()
  const writes = [], errors = [], requests = [], sent = [] // sent: request headers, to prove the key goes out with every call
  page.on('pageerror', e => errors.push(`PAGEERROR ${e.message}`))
  page.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))
  // the device already holds a key (as after opening the shared link once); key=null simulates a first visit with no link
  await page.addInitScript(([k, n]) => {
    if (k && !sessionStorage.getItem('__seeded')) localStorage.setItem('teamKey', k)
    if (n && !sessionStorage.getItem('__seeded')) localStorage.setItem('userName', n)
    sessionStorage.setItem('__seeded', '1')
  }, [key, name])
  await page.route('**/rest/v1/**', async r => {
    const req = r.request(), u = new URL(req.url()), table = u.pathname.split('/').pop()
    requests.push(`${req.method()} ${table}${u.search}`); sent.push(req.headers())
    if (table === 'check_access') { sent.push(req.headers()); return r.fulfill({ json: access === 'offline' ? undefined : access === true, status: access === 'offline' ? 500 : 200 }) }
    const injected = fail?.(req, table)
    if (injected?.abort) return r.abort('connectionfailed') // simulates the network dropping
    if (injected) return r.fulfill({ status: injected.status, json: injected.body ?? { message: 'injected failure', code: injected.code ?? 'XX000' } })
    if (req.method() !== 'GET' && req.method() !== 'HEAD') {
      writes.push({ method: req.method(), table, body: req.postData() ?? '' })
      if (table === 'generate_today') return r.fulfill({ json: 3 })
      if (table === 'rotate_team_key') return r.fulfill({ status: 204, body: '' })
      return r.fulfill({ status: req.method() === 'POST' ? 201 : 204, headers: { 'content-type': 'application/json' }, body: req.method() === 'POST' ? '{"id":99}' : '' })
    }
    let rows = store[table] ?? []
    const idEq = u.searchParams.get('id')
    if (idEq?.startsWith('eq.')) rows = rows.filter(x => `eq.${x.id}` === idEq)
    if ((req.headers().accept || '').includes('object+json')) return r.fulfill({ status: rows[0] ? 200 : 406, json: rows[0] ?? null })
    if (req.method() === 'HEAD') return r.fulfill({ status: 200, headers: { 'content-range': `0-0/${rows.length}` }, body: '' })
    r.fulfill({ json: rows, headers: { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` } })
  })
  await page.goto(BASE + query + hash, { waitUntil: 'networkidle' })
  return { page, context, writes, errors, requests, sent, store }
}

/** true if the locator becomes visible within `ms` (use instead of an instant count() right after navigation) */
const appears = (loc, ms = 4000) => loc.first().waitFor({ state: 'visible', timeout: ms }).then(() => true, () => false)
const overflowX = page => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
module.exports = { appears, chromium, devices, BASE, PORT, REF, KEY, today, ok, section, results, fixtures, task, openApp, overflowX }
