const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { appears, openApp, ok, section, BASE } = require('./harness.cjs')

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-xlsx-'))
const WORKBOOK = process.env.WORKBOOK // optional: path to the real workbook for the import test

module.exports = async browser => {
  const { readSheet } = await import('read-excel-file/node')
  const ymd = d => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`

  section('Excel: export keeps dates and numbers exact in any time zone')
  for (const tz of ['Asia/Kolkata', 'America/Los_Angeles', 'Pacific/Auckland', 'UTC']) {
    const a = await openApp(browser, { timezoneId: tz, hash: '#/outstanding' })
    await a.page.waitForSelector('table')
    const dl = a.page.waitForEvent('download'); await a.page.getByRole('button', { name: 'Export' }).click()
    const file = path.join(TMP, `out-${tz.replace('/', '_')}.xlsx`); await (await dl).saveAs(file)
    const rows = await readSheet(file)
    const head = rows[0], body = rows.find(r => r[head.indexOf('Client')] === 'GP Kendrapada')
    const get = label => body[head.indexOf(label)]
    const date = get('Invoice Date')
    ok(head.includes('Client') && head.includes('Balance') && rows.length === 3, `${tz}: headers and ${rows.length - 1} data rows exported`)
    ok(date instanceof Date && ymd(date) === '2026-09-01', `${tz}: invoice date 2026-09-01 survives export (got ${date instanceof Date ? ymd(date) : date})`)
    ok(get('Invoice Amt') === 500000 && typeof get('Invoice Amt') === 'number', `${tz}: amounts are real numbers`)
    await a.context.close()
  }

  section('Excel: import (admin) from an exported file')
  const a = await openApp(browser, { timezoneId: 'Asia/Kolkata', hash: '#/outstanding' }); await a.page.waitForSelector('table')
  const dl = a.page.waitForEvent('download'); await a.page.getByRole('button', { name: 'Export' }).click()
  const file = path.join(TMP, 'roundtrip.xlsx'); await (await dl).saveAs(file)
  await a.page.locator('input[type=file]').setInputFiles(file); await a.page.waitForTimeout(800)
  const posts = a.writes.filter(w => w.method === 'POST' && w.table === 'outstanding').map(w => JSON.parse(w.body))
  ok(posts.length === 2, `round trip imports both rows (${posts.length})`)
  ok(posts.some(p => p.client === 'GP Kendrapada' && p.invoice_date === '2026-09-01' && p.invoice_amt === 500000), 'imported values match (client, date, amount)')
  ok(posts.every(p => !('balance' in p) && !('days_overdue' in p)), 'calculated columns are never written back')
  ok(await appears(a.page.getByRole('status').filter({ hasText: /Imported 2/ })), 'import result is reported')
  await a.context.close()

  section('Excel: import rejects bad input gracefully')
  const bad = path.join(TMP, 'not-excel.xlsx'); fs.writeFileSync(bad, 'this is not a spreadsheet')
  const b = await openApp(browser, { hash: '#/outstanding' }); await b.page.waitForSelector('table')
  await b.page.locator('input[type=file]').setInputFiles(bad)
  ok(await appears(b.page.getByRole('alert').filter({ hasText: /Import failed/ })), 'a corrupt file shows "Import failed", no crash')
  ok(b.writes.filter(w => w.method === 'POST').length === 0, 'nothing is written from a corrupt file')
  await b.context.close()

  if (WORKBOOK && fs.existsSync(WORKBOOK)) {
    section('Excel: the real workbook imports without junk rows')
    for (const hash of ['#/outstanding', '#/tenders', '#/pos', '#/logistics', '#/service', '#/sourcing']) {
      const c = await openApp(browser, { hash }); await c.page.locator('h1').waitFor()
      await c.page.locator('input[type=file]').setInputFiles(WORKBOOK); await c.page.waitForTimeout(900)
      ok(c.writes.filter(w => w.method === 'POST').length === 0, `${hash}: placeholder rows skipped (workbook only holds the EXAMPLE row)`)
      await c.context.close()
    }
  }
}
