import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { DEMO_OPPORTUNITY_COUNT } from '../src/lib/demo-meta'

/**
 * Guards the one architectural rule that keeps being broken.
 *
 * The modules below load on every cold start, so anything they *statically*
 * import lands in the entry chunk. `questions.ts` holds the interview question
 * bank — several kilobytes of content that belongs behind the Story Bank route.
 * Pulling one small helper from a module that carries the bank quietly puts all
 * of it on the critical path, and nothing else in the build fails when it does.
 *
 * This has happened three times: from `agenda.ts`, from `debrief.ts`, and from
 * the workspace provider. Hence a test rather than a comment.
 */

const SRC = path.join(process.cwd(), 'src')

const EXTENSIONS = ['.ts', '.tsx']

function resolve(spec: string, fromFile: string): string | null {
  const base = spec.startsWith('@/')
    ? path.join(SRC, spec.slice(2))
    : spec.startsWith('.')
      ? path.join(path.dirname(fromFile), spec)
      : null
  if (!base) return null
  for (const ext of EXTENSIONS) {
    if (fs.existsSync(base + ext)) return base + ext
  }
  return fs.existsSync(base) && fs.statSync(base).isDirectory() ? null : null
}

/**
 * Static imports only. A dynamic `import()` is the lazy boundary — the whole
 * point — so it must not count as reachable.
 */
function staticImports(file: string): string[] {
  const source = fs.readFileSync(file, 'utf8')
  const withoutDynamic = source.replace(/\bimport\s*\(/g, 'DYNAMIC(')
  return [...withoutDynamic.matchAll(/\bfrom\s+'([^']+)'/g)]
    .map((m) => m[1] as string)
    .map((spec) => resolve(spec, file))
    .filter((x): x is string => Boolean(x))
}

function reachable(entry: string): Set<string> {
  const seen = new Set<string>()
  const walk = (file: string) => {
    for (const dep of staticImports(file)) {
      if (seen.has(dep)) continue
      seen.add(dep)
      walk(dep)
    }
  }
  walk(path.join(SRC, entry))
  return seen
}

const BANK = path.join(SRC, 'lib', 'questions.ts')

/** Everything here is loaded before the first paint. */
const EAGER = ['lib/agenda.ts', 'lib/rehearsal.ts', 'state/workspace.tsx', 'components/layout/AppShell.tsx']

for (const entry of EAGER) {
  test(`${entry} does not drag the question bank into the entry chunk`, () => {
    const deps = reachable(entry)
    assert.ok(
      !deps.has(BANK),
      `${entry} statically reaches src/lib/questions.ts. Read the bank through the useBank hook (lazy consumers only), or put the helper it needs in rehearsal.ts.`,
    )
  })
}

test('the modules that may carry the bank are only reached lazily', () => {
  // Stated so the intent is explicit rather than accidental.
  assert.ok(reachable('lib/debrief.ts').has(BANK))
  assert.ok(reachable('hooks/useBank.ts').has(BANK))
})

test('the guard resolves imports at all, rather than passing vacuously', () => {
  // A resolver that silently returns nothing would make every test above pass.
  const deps = reachable('lib/agenda.ts')
  assert.ok(deps.size > 2, 'expected agenda.ts to reach several modules')
  assert.ok(deps.has(path.join(SRC, 'lib', 'rehearsal.ts')))
})

test('the onboarding count still matches the demo workspace', () => {
  // The number is duplicated so onboarding does not import a thousand lines of
  // fixtures; this is the thing that keeps the duplicate honest.
  const demo = fs.readFileSync(path.join(SRC, 'lib', 'demo.ts'), 'utf8')
  const specs = demo.slice(demo.indexOf('OPPORTUNITIES: OppSpec[]'))
  const listed = (specs.slice(0, specs.indexOf('\ninterface ContactSpec')).match(/^\s{4}company: '/gm) ?? []).length
  assert.equal(
    listed,
    DEMO_OPPORTUNITY_COUNT,
    'src/lib/demo-meta.ts is out of date with the demo opportunity list',
  )
})

test('onboarding does not pull the demo fixtures into the entry chunk', () => {
  const deps = reachable('components/Onboarding.tsx')
  assert.ok(!deps.has(path.join(SRC, 'lib', 'demo.ts')))
})
