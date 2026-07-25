// Optional sync of app data via Telegram Mini App CloudStorage, so history
// survives a cleared browser / a new device. No-ops outside Telegram or on
// older clients that don't expose CloudStorage. Values are capped at 4096
// chars by Telegram, so the JSON blob is split across numbered chunk keys.

const CHUNK_SIZE = 3500;
const MAX_CHUNKS = 40; // ~140k chars ceiling; beyond this we skip cloud sync silently
const META_KEY = "bs_meta";
const chunkKey = (i) => `bs_chunk_${i}`;

function getCloud() {
  if (typeof window === "undefined") return null;
  const tg = window.Telegram && window.Telegram.WebApp;
  return tg && tg.CloudStorage ? tg.CloudStorage : null;
}

function csSetItem(cloud, key, value) {
  return new Promise((resolve) => {
    try {
      cloud.setItem(key, value, (err, ok) => resolve(!err && ok !== false));
    } catch (e) {
      resolve(false);
    }
  });
}

function csGetItem(cloud, key) {
  return new Promise((resolve) => {
    try {
      cloud.getItem(key, (err, value) => resolve(err ? null : value || null));
    } catch (e) {
      resolve(null);
    }
  });
}

function csRemoveItems(cloud, keys) {
  return new Promise((resolve) => {
    if (!keys.length) return resolve(true);
    try {
      cloud.removeItems(keys, (err) => resolve(!err));
    } catch (e) {
      resolve(false);
    }
  });
}

export function cloudSyncAvailable() {
  return !!getCloud();
}

export async function saveToCloud(dataObj) {
  const cloud = getCloud();
  if (!cloud) return false;
  try {
    const json = JSON.stringify(dataObj);
    if (json.length > CHUNK_SIZE * MAX_CHUNKS) return false;

    const chunks = [];
    for (let i = 0; i < json.length; i += CHUNK_SIZE) {
      chunks.push(json.slice(i, i + CHUNK_SIZE));
    }

    const prevMetaRaw = await csGetItem(cloud, META_KEY);
    let prevCount = 0;
    if (prevMetaRaw) {
      try {
        prevCount = JSON.parse(prevMetaRaw).n || 0;
      } catch (e) {
        prevCount = 0;
      }
    }

    for (let i = 0; i < chunks.length; i++) {
      await csSetItem(cloud, chunkKey(i), chunks[i]);
    }
    if (prevCount > chunks.length) {
      const stale = [];
      for (let i = chunks.length; i < prevCount; i++) stale.push(chunkKey(i));
      await csRemoveItems(cloud, stale);
    }
    await csSetItem(cloud, META_KEY, JSON.stringify({ n: chunks.length, ts: dataObj.updatedAt || Date.now() }));
    return true;
  } catch (e) {
    return false;
  }
}

export async function loadFromCloud() {
  const cloud = getCloud();
  if (!cloud) return null;
  try {
    const metaRaw = await csGetItem(cloud, META_KEY);
    if (!metaRaw) return null;
    const meta = JSON.parse(metaRaw);
    if (!meta || !meta.n) return null;
    let json = "";
    for (let i = 0; i < meta.n; i++) {
      const part = await csGetItem(cloud, chunkKey(i));
      if (part === null) return null;
      json += part;
    }
    const parsed = JSON.parse(json);
    return { data: parsed, updatedAt: meta.ts || parsed.updatedAt || 0 };
  } catch (e) {
    return null;
  }
}
