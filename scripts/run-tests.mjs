// Bundles the TypeScript test files with esbuild (already present via Vite) and
// runs them on Node's built-in test runner. No extra test dependencies.
import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const outdir = path.join(root, '.tests-dist')
fs.rmSync(outdir, { recursive: true, force: true })

const entries = fs
  .readdirSync(path.join(root, 'tests'))
  .filter((f) => f.endsWith('.test.ts'))
  .map((f) => path.join(root, 'tests', f))

await build({
  entryPoints: entries,
  outdir,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  external: ['node:*'],
  logLevel: 'error',
})

const built = fs.readdirSync(outdir).filter((f) => f.endsWith('.js')).map((f) => path.join(outdir, f))

try {
  execFileSync(process.execPath, ['--test', ...built], { stdio: 'inherit' })
} catch {
  process.exit(1)
}
