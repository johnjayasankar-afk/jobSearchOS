/**
 * Facts about the demo workspace that the app needs *before* loading it.
 *
 * Kept apart from `demo.ts` on purpose: onboarding is on the critical path and
 * the demo module is a thousand lines of fixture data that must stay behind its
 * dynamic import. A test asserts this number still matches the real list.
 */
export const DEMO_OPPORTUNITY_COUNT = 16
