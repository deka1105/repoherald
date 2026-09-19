/**
 * Public-facing user count.
 *
 * This used to add a +500 pad while the community was small (dropping it once
 * the real count passed 2000). It was removed on 2026-09-19: with 6 real
 * accounts the site was publicly advertising "506 users", which is a
 * fabricated social-proof number — an unsupported claim in the plain sense,
 * and in the UK/EU a misleading commercial practice.
 *
 * The real figure is small, and saying so costs less than being caught
 * inflating it. If you want the number to look better, the fix is more users.
 */
export function displayUserCount(actual: number): number {
  return actual;
}
