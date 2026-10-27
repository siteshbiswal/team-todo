// Builds nothing: run `npm run build` first. Starts `vite preview`, runs every spec, prints a summary, exits non-zero on failure.
const { spawn } = require('node:child_process')
const path = require('node:path')
const h = require('./harness.cjs')

const specs = process.argv.slice(2).length ? process.argv.slice(2) : ['functional', 'robustness', 'a11y', 'responsive', 'excel']

async function waitFor(url, tries = 40) {
  for (let i = 0; i < tries; i++) { try { if ((await fetch(url)).ok) return } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 250)) }
  throw new Error('preview server did not start')
}

;(async () => {
  const alreadyUp = await fetch(h.BASE).then(r => r.ok, () => false) // reuse a running preview server
  const server = alreadyUp ? null : spawn('npx', ['vite', 'preview', '--port', String(h.PORT), '--strictPort'], { stdio: 'ignore', detached: true })
  try {
    await waitFor(h.BASE)
    const browser = await h.chromium.launch()
    for (const s of specs) {
      try { await require(path.join(__dirname, `${s}.cjs`))(browser) }
      catch (e) { h.ok(false, `${s} crashed: ${e.message.split('\n')[0]}`) }
    }
    await browser.close()
  } finally { if (server) try { process.kill(-server.pid) } catch { /* already exited */ } }
  console.log(`\n${h.results.pass} passed, ${h.results.fail} failed`)
  h.results.failures.forEach(f => console.log('  ✗', f))
  process.exit(h.results.fail ? 1 : 0)
})()
