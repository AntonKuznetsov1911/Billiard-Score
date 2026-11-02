// Local-only mirror of a state accepted from the club. No outgoing sync here.
export function cacheAcceptedState(storage, key, state) {
  storage.setItem(key, JSON.stringify(state));
  return state;
}
