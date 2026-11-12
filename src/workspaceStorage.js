export const DATA_KEY = "billiards-club-data";
export const PROFILE_PREFIX = "billiards-profile/";

export function workspaceId(userId, clubId) {
  return userId ? `user/${encodeURIComponent(userId)}/${clubId ? `club/${encodeURIComponent(clubId)}` : 'personal'}` : 'guest';
}

// Auth tokens and the privacy acknowledgement remain outside game workspaces.
export function workspaceStorage(storage, id) {
  const prefix = id === 'guest' ? '' : `${PROFILE_PREFIX}${id}/`;
  const physicalKey = key => key === 'billiards-haptics' ? key : prefix + key;
  const keys = () => Object.keys(storage).filter(k => prefix ? k.startsWith(prefix) : k.startsWith('billiards-') && !k.startsWith(PROFILE_PREFIX) && !k.startsWith('billiards-legacy-club:')).map(k => prefix ? k.slice(prefix.length) : k);
  const methods = {
    getItem: key => storage.getItem(physicalKey(key)),
    setItem: (key, value) => storage.setItem(physicalKey(key), String(value)),
    removeItem: key => storage.removeItem(physicalKey(key)),
    clear: () => keys().forEach(key => storage.removeItem(prefix + key)),
    key: i => keys()[i] ?? null,
  };
  return new Proxy({}, {
    get: (_, key) => key === 'length' ? keys().length : methods[key],
    ownKeys: keys,
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
  });
}

export function purgeUserWorkspaces(storage, userId) {
  const prefix = `${PROFILE_PREFIX}user/${encodeURIComponent(userId)}/`;
  Object.keys(storage).filter(key => key.startsWith(prefix)).forEach(key => storage.removeItem(key));
  for (const key of ['billiards-club-terms', 'billiards-blocked-clubs']) {
    try {
      const values = JSON.parse(storage.getItem(key) || '{}');
      delete values[userId];
      if (Object.keys(values).length) storage.setItem(key, JSON.stringify(values));
      else storage.removeItem(key);
    } catch { /* A malformed old preference contains no game state. */ }
  }
}

export function storageAdapter(storage) {
  return {
    async get(key) { const value = storage.getItem(key); if (value === null) throw Error('key not found'); return { value }; },
    async set(key, value) { storage.setItem(key, value); },
  };
}

// Old versions mixed club data with the guest slot. Preserve it separately,
// and only restore it into the same club after membership has been verified.
export function preserveLegacyClub(storage) {
  const clubId = storage.getItem('billiards-club-synced');
  if (!clubId) return;
  const key = `billiards-legacy-club:${clubId}`;
  if (!storage.getItem(key)) {
    const saved = {};
    for (const k of [DATA_KEY, 'billiards-safety-copies', 'billiards-current-game']) saved[k] = storage.getItem(k);
    storage.setItem(key, JSON.stringify(saved));
  }
  for (const k of [DATA_KEY, 'billiards-safety-copies', 'billiards-current-game', 'billiards-club-synced']) storage.removeItem(k);
}

export function restoreLegacyClub(storage, userId, verifiedClubId) {
  const raw = storage.getItem(`billiards-legacy-club:${verifiedClubId}`);
  if (!raw) return;
  const target = workspaceStorage(storage, workspaceId(userId, verifiedClubId));
  if (target.getItem(DATA_KEY)) return;
  const saved = JSON.parse(raw);
  for (const [key, value] of Object.entries(saved)) if (value !== null && [DATA_KEY, 'billiards-safety-copies', 'billiards-current-game'].includes(key)) target.setItem(key, value);
  target.setItem('billiards-club-synced', verifiedClubId);
  storage.removeItem(`billiards-legacy-club:${verifiedClubId}`);
}
