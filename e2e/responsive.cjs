const { openApp, ok, section, overflowX, devices } = require('./harness.cjs')

module.exports = async browser => {
  section('Responsive: no horizontal scroll at common widths')
  const pages = [['today', ''], ['board', '#/board'], ['summary', '#/summary'], ['outstanding', '#/outstanding'], ['pos', '#/pos'], ['sourcing', '#/sourcing'], ['admin', '#/admin']]
  for (const w of [320, 375, 414, 768, 1024, 1440, 1920]) {
    const bad = []
    for (const [name, hash] of pages) {
      const a = await openApp(browser, { viewport: { width: w, height: 800 }, hash })
      await a.page.waitForTimeout(250)
      if (await overflowX(a.page)) bad.push(name)
      await a.context.close()
    }
    ok(bad.length === 0, `${w}px wide: ${bad.length ? 'horizontal overflow on ' + bad.join(', ') : 'all pages fit'}`)
  }

  section('Responsive: touch targets on a phone')
  const a = await openApp(browser, { ...devices['iPhone 13'], hash: '#/outstanding' })
  const small = await a.page.evaluate(() => [...document.querySelectorAll('button, a[href], select, input:not([type=checkbox]):not([type=radio]):not([hidden])')]
    .filter(el => el.offsetParent !== null).map(el => ({ t: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 18), h: Math.round(el.getBoundingClientRect().height) }))
    .filter(x => x.h < 32))
  ok(small.length === 0, `interactive controls are at least 32px tall${small.length ? ' → ' + small.map(s => `${s.t}(${s.h}px)`).join(', ') : ''}`)
  await a.context.close()

  section('Responsive: desktop table vs phone cards')
  let d = await openApp(browser, { viewport: { width: 1280, height: 800 }, hash: '#/outstanding' })
  ok(await d.page.locator('table').isVisible() && !(await d.page.locator('ul.md\\:hidden').isVisible()), '≥768px shows the table, not cards'); await d.context.close()
  d = await openApp(browser, { viewport: { width: 700, height: 800 }, hash: '#/outstanding' })
  ok(!(await d.page.locator('table').isVisible()) && await d.page.locator('ul.md\\:hidden').isVisible(), '<768px shows cards, not the table'); await d.context.close()
}
