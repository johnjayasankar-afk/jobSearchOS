import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseSharedTitle,
  buildCapturePrefill,
  readCaptureFromLocation,
  buildBookmarklet,
} from '../src/lib/capture'

/* ------------------------------ title parsing ----------------------------- */

test('reads the LinkedIn "Company hiring Role" shape', () => {
  const r = parseSharedTitle('Halcyon Pay hiring Senior Product Manager, Payments | LinkedIn')
  assert.equal(r.company, 'Halcyon Pay')
  assert.equal(r.role, 'Senior Product Manager, Payments')
})

test('reads "Role at Company"', () => {
  const r = parseSharedTitle('Senior Product Manager at Halcyon Pay')
  assert.equal(r.role, 'Senior Product Manager')
  assert.equal(r.company, 'Halcyon Pay')
})

test('reads "Role - Company" by working out which half is the role', () => {
  const r = parseSharedTitle('Staff Software Engineer - Northwind Labs')
  assert.equal(r.role, 'Staff Software Engineer')
  assert.equal(r.company, 'Northwind Labs')
})

test('reads "Company: Role" in the other order', () => {
  const r = parseSharedTitle('Northwind Labs: Data Analyst')
  assert.equal(r.company, 'Northwind Labs')
  assert.equal(r.role, 'Data Analyst')
})

test('strips trailing site furniture', () => {
  const r = parseSharedTitle('Product Designer - Cobalt Health | Greenhouse')
  assert.equal(r.role, 'Product Designer')
  assert.equal(r.company, 'Cobalt Health')
})

test('guesses nothing rather than guessing wrong', () => {
  assert.deepEqual(parseSharedTitle('Home'), {})
  assert.deepEqual(parseSharedTitle(''), {})
  assert.deepEqual(parseSharedTitle('Our mission and values'), {})
})

/* -------------------------------- prefills -------------------------------- */

test('a job board URL supplies the company the title omits', () => {
  const prefill = buildCapturePrefill({
    url: 'https://boards.greenhouse.io/northwindlabs/jobs/12345',
    title: 'Senior Data Engineer',
  })
  assert.equal(prefill?.company, 'Northwindlabs')
  assert.equal(prefill?.role, 'Senior Data Engineer')
  assert.equal(prefill?.jobUrl, 'https://boards.greenhouse.io/northwindlabs/jobs/12345')
})

test('explicit parameters beat anything inferred', () => {
  const prefill = buildCapturePrefill({
    url: 'https://boards.greenhouse.io/northwindlabs/jobs/1',
    title: 'Something else entirely',
    company: 'Cobalt Health',
    role: 'Group Product Manager',
  })
  assert.equal(prefill?.company, 'Cobalt Health')
  assert.equal(prefill?.role, 'Group Product Manager')
})

test('a URL inside shared text is found', () => {
  const prefill = buildCapturePrefill({ text: 'Look at this https://jobs.example.com/pm-role today' })
  assert.equal(prefill?.jobUrl, 'https://jobs.example.com/pm-role')
})

test('nothing usable returns null rather than an empty record', () => {
  assert.equal(buildCapturePrefill({ title: 'Home' }), null)
  assert.equal(buildCapturePrefill({}), null)
})

/* ------------------------------ location read ----------------------------- */

test('reads capture parameters from the hash route', () => {
  const result = readCaptureFromLocation(
    'https://app.example/#/add?url=https%3A%2F%2Fjobs.example%2F1&title=Senior%20Product%20Manager%20at%20Acme&source=Bookmarklet',
  )
  assert.ok(result)
  assert.equal(result.prefill.role, 'Senior Product Manager')
  assert.equal(result.prefill.company, 'Acme')
  assert.equal(result.prefill.source, 'Bookmarklet')
  // The parameters must not survive, or a refresh reopens the dialog.
  assert.ok(!result.cleanedHref.includes('title='))
  assert.ok(!result.cleanedHref.includes('#/add'))
})

test('reads share-target parameters from the query string', () => {
  const result = readCaptureFromLocation('https://app.example/?title=Data%20Analyst%20at%20Acme&url=https%3A%2F%2Fjobs.example%2F2')
  assert.ok(result)
  assert.equal(result.prefill.company, 'Acme')
  assert.equal(result.prefill.jobUrl, 'https://jobs.example/2')
  assert.ok(!result.cleanedHref.includes('title='))
})

test('an ordinary address is left alone', () => {
  assert.equal(readCaptureFromLocation('https://app.example/#/today'), null)
  assert.equal(readCaptureFromLocation('https://app.example/#/opportunities?opportunity=op_1'), null)
})

test('unrelated hash parameters survive the clean-up', () => {
  const result = readCaptureFromLocation('https://app.example/#/opportunities?opportunity=op_1&company=Acme&role=PM')
  assert.ok(result)
  assert.ok(result.cleanedHref.includes('opportunity=op_1'))
  assert.ok(!result.cleanedHref.includes('company=Acme'))
})

/* ------------------------------- bookmarklet ------------------------------ */

test('the bookmarklet is a javascript url pinned to this deployment', () => {
  const code = buildBookmarklet('https://app.example/index.html#/today')
  assert.ok(code.startsWith('javascript:'))
  const decoded = decodeURIComponent(code.replace(/^javascript:/, ''))
  assert.ok(decoded.includes('https://app.example/index.html#/add?url='))
  assert.ok(decoded.includes('document.title'))
  // It must not reach for anything beyond the current tab's own address.
  assert.ok(!/fetch|XMLHttpRequest|document\.body/.test(decoded))
})

test('a properly spelled company in the title beats a run-together board slug', () => {
  const prefill = buildCapturePrefill({
    url: 'https://boards.greenhouse.io/meridiansystems/jobs/88421',
    title: 'Meridian Systems hiring Principal Product Manager, Platform | LinkedIn',
  })
  assert.equal(prefill?.company, 'Meridian Systems')
  assert.equal(prefill?.role, 'Principal Product Manager, Platform')
})

test('a board slug is still used when the title names a different company', () => {
  const prefill = buildCapturePrefill({
    url: 'https://boards.greenhouse.io/northwindlabs/jobs/1',
    title: 'Careers at Some Other Place - Senior Engineer',
  })
  assert.equal(prefill?.company, 'Northwindlabs')
})
