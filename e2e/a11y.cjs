const path = require('node:path')
const { appears, openApp, ok, section, BASE, devices } = require('./harness.cjs')
const AXE = require.resolve('axe-core', { paths: [path.join(__dirname, '..')] })

async function audit(page) {
  await page.addScriptTag({ path: AXE })
  return page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } })
    return r.violations.map(v => ({ id: v.id, impact: v.impact, count: v.nodes.length, help: v.help, sample: v.nodes[0].target.join(' ').slice(0, 90) }))
  })
}
const report = (label, v) => {
  const bad = v.filter(x => x.impact === 'serious' || x.impact === 'critical')
  ok(bad.length === 0, `${label}: no serious/critical a11y violations${bad.length ? ' → ' + bad.map(b => `${b.id}×${b.count} (${b.sample})`).join('; ') : ''}`)
  v.filter(x => !bad.includes(x)).forEach(x => console.log(`    note [${x.impact}] ${x.id} ×${x.count}: ${x.help}`))
}

module.exports = async browser => {
  for (const scheme of ['light', 'dark']) {
    section(`Accessibility (axe, WCAG 2.1 AA) — ${scheme}`)
    let a = await openApp(browser, { signedIn: false, colorScheme: scheme })
    report(`${scheme} login`, await audit(a.page)); await a.context.close()

    for (const [name, hash] of [['today', ''], ['board', '#/board'], ['summary', '#/summary'], ['outstanding table', '#/outstanding'], ['tenders table', '#/tenders'], ['admin tasks', '#/admin']]) {
      a = await openApp(browser, { colorScheme: scheme, hash, data: { task_templates: [{ id: 1, team: 'Accounts', title: 'Sample', freq_type: 'daily', freq_rule: {}, active: true, sl: 1 }] } })
      await a.page.waitForTimeout(500)
      report(`${scheme} ${name}`, await audit(a.page)); await a.context.close()
    }
    a = await openApp(browser, { colorScheme: scheme, hash: '#/outstanding' })
    await a.page.getByLabel('Open details').first().click(); await a.page.waitForTimeout(250)
    report(`${scheme} detail drawer`, await audit(a.page)); await a.context.close()

    a = await openApp(browser, { colorScheme: scheme, profile: 'pending' })
    report(`${scheme} waiting-for-approval`, await audit(a.page)); await a.context.close()

    a = await openApp(browser, { ...devices['iPhone 13'], colorScheme: scheme, hash: '#/outstanding' })
    report(`${scheme} phone cards`, await audit(a.page)); await a.context.close()
  }

  section('Accessibility: keyboard & focus')
  let a = await openApp(browser, { hash: '#/outstanding' })
  const trigger = a.page.getByLabel('Open details').first()
  await trigger.focus(); await a.page.keyboard.press('Enter'); await a.page.waitForTimeout(250)
  ok(await a.page.getByRole('dialog').isVisible(), 'Enter on the open button opens the drawer')
  ok(await a.page.evaluate(() => !!document.activeElement?.closest('[role=dialog]')), 'focus moves into the drawer when it opens')
  for (let i = 0; i < 40; i++) await a.page.keyboard.press('Tab')
  ok(await a.page.evaluate(() => !!document.activeElement?.closest('[role=dialog]')), 'Tab stays inside the drawer (focus trap)')
  await a.page.keyboard.press('Escape'); await a.page.waitForTimeout(150)
  ok(await a.page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Open details'), 'focus returns to the button that opened the drawer')
  await a.context.close()

  a = await openApp(browser)
  await a.page.keyboard.press('Tab')
  ok(await a.page.evaluate(() => !!document.activeElement && document.activeElement !== document.body), 'Tab reaches the first control')
  ok(await a.page.evaluate(() => document.documentElement.lang === 'en'), 'page language is declared')
  ok(await a.page.locator('main').count() === 1 && await a.page.locator('header nav[aria-label]').count() === 1, 'landmarks: header, labelled nav, main')
  ok(await a.page.evaluate(() => { const m = document.querySelector('meta[name=viewport]')?.content ?? ''; return !/user-scalable=no|maximum-scale=1\b/.test(m) }), 'zoom is not disabled')
  await a.context.close()
}
