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

const PROFILES = {
  admin: { id: 'u1', name: 'Sitesh Biswal', role: 'admin', team: null, active: true, email: 'admin@co.com' },
  sales: { id: 'u1', name: 'Sagarika', role: 'member', team: 'Sales / Pre-Sales', active: true, email: 's@co.com' },
  logistics: { id: 'u1', name: 'Hari', role: 'member', team: 'Logistics Follow-up', active: true, email: 'h@co.com' },
  pending: { id: 'u1', name: 'newbie', role: 'member', team: null, active: false, email: 'new@co.com' },
}

const task = (id, over = {}) => ({
  id, due_date: today, status: 'Pending', remarks: null, done_at: null,
  task_templates: { team: 'Accounts', title: `Task ${id}`, freq_text: 'Daily', res1: 'Sutar', res2: null, final_res: null }, ...over,
})

function fixtures() {
  return {
    profiles: [PROFILES.admin],
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
 * Opens the app signed in as `profile`. Options: data overrides, viewport/device/colorScheme/timezoneId,
 * fail(req) -> { status, body? } to inject API errors, signedIn=false for the login page.
 */
async function openApp(browser, { profile = 'admin', data = {}, signedIn = true, fail, hash = '', ...ctxOpts } = {}) {
  const store = { ...fixtures(), ...data }
  store.profiles = data.profiles ?? [PROFILES[profile]]
  const context = await browser.newContext({ viewport: { width: 1360, height: 860 }, acceptDownloads: true, ...ctxOpts })
  const page = await context.newPage()
  const writes = [], errors = [], requests = []
  page.on('pageerror', e => errors.push(`PAGEERROR ${e.message}`))
  page.on('console', m => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))
  if (signedIn) {
    await page.addInitScript(ref => localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({
      access_token: 'a.b.c', refresh_token: 'r', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'u1', email: 'x@y.z', aud: 'authenticated' },
    })), REF)
  }
  await page.route('**/auth/v1/**', r => r.fulfill({ json: { id: 'u1', email: 'x@y.z', aud: 'authenticated' } }))
  await page.route('**/rest/v1/**', async r => {
    const req = r.request(), u = new URL(req.url()), table = u.pathname.split('/').pop()
    requests.push(`${req.method()} ${table}${u.search}`)
    const injected = fail?.(req, table)
    if (injected?.abort) return r.abort('connectionfailed') // simulates the network dropping
    if (injected) return r.fulfill({ status: injected.status, json: injected.body ?? { message: 'injected failure', code: injected.code ?? 'XX000' } })
    if (req.method() !== 'GET' && req.method() !== 'HEAD') {
      writes.push({ method: req.method(), table, body: req.postData() ?? '' })
      return r.fulfill({ status: req.method() === 'POST' ? 201 : 204, headers: { 'content-type': 'application/json' }, body: req.method() === 'POST' ? '{"id":99}' : '' })
    }
    let rows = store[table] ?? []
    const idEq = u.searchParams.get('id')
    if (idEq?.startsWith('eq.')) rows = rows.filter(x => `eq.${x.id}` === idEq)
    if ((req.headers().accept || '').includes('object+json')) return r.fulfill({ status: rows[0] ? 200 : 406, json: rows[0] ?? null })
    if (req.method() === 'HEAD') return r.fulfill({ status: 200, headers: { 'content-range': `0-0/${rows.length}` }, body: '' })
    r.fulfill({ json: rows, headers: { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` } })
  })
  await page.goto(BASE + hash, { waitUntil: 'networkidle' })
  return { page, context, writes, errors, requests, store }
}

/** true if the locator becomes visible within `ms` (use instead of an instant count() right after navigation) */
const appears = (loc, ms = 4000) => loc.first().waitFor({ state: 'visible', timeout: ms }).then(() => true, () => false)
const overflowX = page => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
module.exports = { appears, chromium, devices, BASE, PORT, REF, today, ok, section, results, PROFILES, fixtures, task, openApp, overflowX }
