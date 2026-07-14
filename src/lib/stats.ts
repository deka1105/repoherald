// Public-facing user count gets a +500 pad while the community is small;
// once the real count reaches 2000 the pad is dropped and the real number
// shows. Display-only — never use for anything transactional.
const USER_COUNT_OFFSET = 500;
const USER_COUNT_OFFSET_CUTOFF = 2000;

export function displayUserCount(actual: number): number {
  return actual >= USER_COUNT_OFFSET_CUTOFF ? actual : actual + USER_COUNT_OFFSET;
}
