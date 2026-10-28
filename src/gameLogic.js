import { AVATAR_COLORS, RUSSIAN_MODES } from "./constants.js";

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function loadInitial() {
  return {
    players: [],
    matches: [],
    trash: [],
    activeGames: [],
    activeSeries: null,
    activeBracket: null,
    theme: "light",
    gameType: "russian",
    russianMode: "free",
    deletedPlayers: [],
    endedGames: [],
    metaAt: 0,
    updatedAt: 0,
  };
}

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const cleanStr = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
const cleanNum = (v, max = 100000) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0);
const cleanStamp = (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);
const cleanScores = (v) => {
  const out = {};
  if (isObj(v)) Object.keys(v).slice(0, 20).forEach((k) => (out[k] = cleanNum(v[k], 999)));
  return out;
};
const cleanSigned = (v, max = 100000) => (typeof v === "number" && Number.isFinite(v) ? Math.max(-max, Math.min(max, Math.round(v))) : 0);
const cleanPidList = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x).map((x) => x.slice(0, 64)).slice(0, 20) : []);
const cleanId = (v) => (typeof v === "string" && v ? v.slice(0, 64) : null);
const cleanInt = (v, min, max) => (typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null);
const cleanGameType = (v) => (v === "pool" ? "pool" : "russian");
const cleanMode = (v) => (typeof v === "string" && Object.prototype.hasOwnProperty.call(RUSSIAN_MODES, v) ? v : null);

// Series and bracket are shared through the club too — anything malformed is
// dropped instead of crashing every member's screen.
function sanitizeSeries(s) {
  if (!isObj(s)) return null;
  const participants = cleanPidList(s.participants);
  const targetWins = cleanInt(s.targetWins, 1, 10);
  if (participants.length < 2 || !targetWins) return null;
  return { ...s, id: cleanId(s.id) || "s", targetWins, bestOf: targetWins * 2 - 1, participants, wins: cleanScores(s.wins) };
}

function sanitizeBracket(b) {
  if (!isObj(b) || !Array.isArray(b.rounds) || !b.rounds.length || b.rounds.length > 4) return null;
  const rounds = b.rounds.map((r) =>
    (Array.isArray(r) ? r : []).slice(0, 8).map((m) => (isObj(m) ? { a: cleanId(m.a), b: cleanId(m.b), winnerId: cleanId(m.winnerId) } : { a: null, b: null, winnerId: null }))
  );
  if (rounds.some((r) => !r.length)) return null;
  return { ...b, id: cleanId(b.id) || "b", participants: cleanPidList(b.participants), rounds, champion: cleanId(b.champion) };
}

// Kolhoz pair matrix (settlement[a][b] = how much b owes a). It is rendered
// as-is, so anything that isn't a plain number is dropped.
function cleanSettlement(v) {
  if (!isObj(v)) return null;
  const out = {};
  Object.keys(v)
    .slice(0, 20)
    .forEach((a) => {
      if (!isObj(v[a])) return;
      out[a] = {};
      Object.keys(v[a])
        .slice(0, 20)
        .forEach((b) => (out[a][b] = cleanSigned(v[a][b])));
    });
  return out;
}

function cleanKolhozRounds(v) {
  return (Array.isArray(v) ? v : [])
    .filter((r) => isObj(r))
    .slice(0, 200)
    .map((r) => ({ order: cleanPidList(r.order), scores: cleanScores(r.scores) }))
    .filter((r) => r.order.length >= 2);
}

// Data can come from a shared club (written by any member), a backup file or
// storage, so it is treated as untrusted: structurally broken records are
// dropped and known fields are clamped rather than trusted, so one malformed
// entry can't crash every member's app.
export function sanitizePlayers(list) {
  return (Array.isArray(list) ? list : [])
    .filter((p) => isObj(p) && typeof p.id === "string" && p.id && typeof p.name === "string")
    .slice(0, 200)
    .map((p, i) => ({
      ...p,
      id: p.id.slice(0, 64),
      name: p.name.slice(0, 40),
      color: typeof p.color === "string" && COLOR_RE.test(p.color) ? p.color : AVATAR_COLORS[i % AVATAR_COLORS.length],
    }));
}

export function sanitizeMatches(list) {
  return (Array.isArray(list) ? list : [])
    .filter(
      (m) =>
        isObj(m) &&
        Array.isArray(m.participants) &&
        m.participants.length > 0 &&
        m.participants.every((x) => typeof x === "string") &&
        !Number.isNaN(new Date(m.date).getTime())
    )
    .slice(0, 20000)
    .map((m) => ({
      ...m,
      id: typeof m.id === "string" ? m.id.slice(0, 64) : uid(),
      participants: m.participants.slice(0, 20),
      winnerId: typeof m.winnerId === "string" ? m.winnerId : null,
      scores: cleanScores(m.scores),
      durationMs: cleanNum(m.durationMs, 7 * 86400000),
      solo: !!m.solo,
      breakerId: typeof m.breakerId === "string" ? m.breakerId : null,
      gameType: cleanGameType(m.gameType),
      mode: cleanMode(m.mode),
      breakerPotted: m.breakerPotted === true || m.breakerPotted === false ? m.breakerPotted : null,
      modifiedAt: cleanStamp(m.modifiedAt),
      createdBy: cleanStr(m.createdBy, 40),
      modifiedBy: cleanStr(m.modifiedBy, 40),
      settlement: cleanSettlement(m.settlement),
      stake: cleanStake(m.stake),
      ...(m.kolhozUnit === "balls" || m.kolhozUnit === "points" ? { kolhozUnit: m.kolhozUnit } : {}),
      ...(m.kolhozRounds ? { kolhozRounds: cleanKolhozRounds(m.kolhozRounds) } : {}),
      ...(isObj(m.kolhozNet) ? { kolhozNet: Object.fromEntries(Object.keys(m.kolhozNet).slice(0, 20).map((k) => [k, cleanSigned(m.kolhozNet[k])])) } : {}),
    }));
}

const TRASH_LIMIT = 300;

// Deleted matches wait here (and can be restored) instead of vanishing.
export function sanitizeTrash(list) {
  return sanitizeMatches(list)
    .map((m) => ({
      ...m,
      deletedAt: typeof m.deletedAt === "number" && Number.isFinite(m.deletedAt) ? m.deletedAt : 0,
      deletedBy: cleanStr(m.deletedBy, 40),
    }))
    .slice(-TRASH_LIMIT);
}

// Move a match to the trash. If it belonged to the running best-of series,
// its win is taken back from the series (and given back on restore).
export function moveMatchToTrash(data, matchId, now = Date.now()) {
  const removed = data.matches.find((m) => m.id === matchId);
  if (!removed) return data;
  let activeSeries = data.activeSeries;
  if (removed.seriesId && activeSeries && activeSeries.id === removed.seriesId) {
    const wins = { ...activeSeries.wins };
    wins[removed.winnerId] = Math.max(0, (wins[removed.winnerId] || 0) - 1);
    activeSeries = { ...activeSeries, wins };
  }
  return {
    ...data,
    matches: data.matches.filter((m) => m.id !== matchId),
    trash: [...(data.trash || []), { ...removed, deletedAt: now }].slice(-TRASH_LIMIT),
    activeSeries,
  };
}

export function restoreMatchFromTrash(data, matchId) {
  const item = (data.trash || []).find((m) => m.id === matchId);
  if (!item) return data;
  const { deletedAt, deletedBy, ...match } = item;
  let activeSeries = data.activeSeries;
  if (match.seriesId && activeSeries && activeSeries.id === match.seriesId && match.winnerId) {
    activeSeries = { ...activeSeries, wins: { ...activeSeries.wins, [match.winnerId]: (activeSeries.wins[match.winnerId] || 0) + 1 } };
  }
  return {
    ...data,
    matches: [...data.matches, match],
    trash: data.trash.filter((m) => m.id !== matchId),
    activeSeries,
  };
}

const EVENT_LIMIT = 3000;
const ENDED_LIMIT = 100;
const TOMBSTONE_LIMIT = 1000;
const cleanIds = (v, limit) =>
  (Array.isArray(v) ? v : []).filter((x) => typeof x === "string" && x).map((x) => x.slice(0, 64)).slice(-limit);

// A running game keeps its score as a log of events (+1, −1, "set to N")
// on top of `baseScores`, instead of only the final numbers. Two devices
// scoring the same game at once then just add events to the same log, and
// merging their copies can't lose anyone's taps. `scores` is always the
// derived total, kept so the rest of the app can read it directly.
function sanitizeEvent(e) {
  if (!isObj(e) || typeof e.id !== "string" || !e.id || typeof e.pid !== "string") return null;
  const ts = typeof e.ts === "number" && Number.isFinite(e.ts) ? e.ts : 0;
  const base = { id: e.id.slice(0, 64), pid: e.pid.slice(0, 64), ts };
  if (typeof e.by === "string" && e.by) base.by = e.by.slice(0, 40);
  // Kolhoz: which round (circle of positions) the tap belongs to.
  if (typeof e.r === "number" && Number.isInteger(e.r) && e.r > 0 && e.r < 1000) base.r = e.r;
  if (typeof e.v === "number" && Number.isFinite(e.v)) return { ...base, v: Math.max(0, Math.min(999, Math.floor(e.v))) };
  if (typeof e.d === "number" && Number.isFinite(e.d)) return { ...base, d: Math.max(-999, Math.min(999, Math.round(e.d))) };
  return null;
}

// Player removals are remembered as {id, at} so a removal on one device
// isn't undone by another device's stale copy — while re-adding/restoring the
// player later (modifiedAt > at) still wins.
function cleanTombstones(v) {
  return (Array.isArray(v) ? v : [])
    .filter((t) => isObj(t) && typeof t.id === "string" && t.id)
    .map((t) => ({ id: t.id.slice(0, 64), at: cleanStamp(t.at) }))
    .slice(-TOMBSTONE_LIMIT);
}

function mergeTombstones(x, y) {
  const at = new Map();
  [...(x || []), ...(y || [])].forEach((t) => at.set(t.id, Math.max(at.get(t.id) || 0, t.at)));
  return [...at.entries()]
    .map(([id, t]) => ({ id, at: t }))
    .sort((p, q) => p.at - q.at || (p.id < q.id ? -1 : 1))
    .slice(-TOMBSTONE_LIMIT);
}

const eventOrder = (x, y) => x.ts - y.ts || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0);

// Kolhoz games are played in rounds; only taps of the current round count
// towards the live score (finished rounds are frozen in `kolhoz.rounds`).
export function currentRound(g) {
  return g && g.kolhoz ? g.kolhoz.rounds.length : 0;
}
const inCurrentRound = (g, e) => (e.r || 0) === currentRound(g);

export function computeGameScores(g) {
  const scores = {};
  const fresh = currentRound(g) > 0;
  g.participants.forEach((pid) => (scores[pid] = (!fresh && g.baseScores && g.baseScores[pid]) || 0));
  const undone = new Set(g.undone || []);
  [...(g.events || [])].sort(eventOrder).forEach((e) => {
    if (undone.has(e.id) || !(e.pid in scores) || !inCurrentRound(g, e)) return;
    scores[e.pid] = "v" in e ? e.v : Math.max(0, Math.min(999, scores[e.pid] + e.d));
  });
  return scores;
}

function withScores(g) {
  return { ...g, scores: computeGameScores(g) };
}

export function addGameEvent(g, event) {
  const e = sanitizeEvent(g && currentRound(g) ? { ...event, r: currentRound(g) } : event);
  if (!g || !e) return g;
  return withScores({ ...g, events: [...(g.events || []), e].slice(-EVENT_LIMIT) });
}

function lastUndoableEvent(g) {
  if (!g) return null;
  const undone = new Set(g.undone || []);
  const live = (g.events || []).filter((e) => !undone.has(e.id) && inCurrentRound(g, e)).sort(eventOrder);
  return live.length ? live[live.length - 1] : null;
}

// When anything last happened in a running game (start or last score change).
export function lastGameActivity(g) {
  if (!g) return 0;
  const started = g.startedAt ? new Date(g.startedAt).getTime() || 0 : 0;
  return (g.events || []).reduce((m, e) => Math.max(m, e.ts || 0), started);
}

// A game nobody has touched for a while was most likely forgotten.
export const STALE_GAME_MS = 2 * 3600000;
export function isGameStale(g, now = Date.now(), idleMs = STALE_GAME_MS) {
  const last = lastGameActivity(g);
  return !!last && now - last >= idleMs;
}

export function canUndoGame(g) {
  return !!lastUndoableEvent(g);
}

export function undoGameEvent(g) {
  const last = lastUndoableEvent(g);
  if (!last) return g;
  return withScores({ ...g, undone: [...(g.undone || []), last.id].slice(-EVENT_LIMIT) });
}

function sanitizeActiveGame(g) {
  if (!isObj(g) || !Array.isArray(g.participants) || !g.participants.length || !g.participants.every((x) => typeof x === "string")) {
    return null;
  }
  const { actionLog, kolhoz, ...rest } = g;
  const legacy = !Array.isArray(g.events);
  const participants = g.participants.slice(0, 20).map((x) => x.slice(0, 64));
  const out = {
    ...rest,
    id: typeof g.id === "string" && g.id ? g.id.slice(0, 64) : `g-${typeof g.startedAt === "string" ? g.startedAt : "0"}`,
    participants,
    // Games saved before the event log existed start from their stored score.
    baseScores: cleanScores(legacy ? g.scores : g.baseScores),
    events: legacy ? [] : g.events.map(sanitizeEvent).filter(Boolean).slice(-EVENT_LIMIT),
    undone: cleanIds(g.undone, EVENT_LIMIT),
    stake: cleanStake(g.stake),
    gameType: cleanGameType(g.gameType),
    mode: cleanMode(g.mode),
    targets: isObj(g.targets) ? cleanScores(g.targets) : null,
    breakerId: cleanId(g.breakerId),
    startedAt: typeof g.startedAt === "string" && !Number.isNaN(new Date(g.startedAt).getTime()) ? g.startedAt.slice(0, 40) : new Date(0).toISOString(),
    startedBy: cleanStr(g.startedBy, 40),
    bracketRound: cleanInt(g.bracketRound, 0, 3),
    bracketMatch: cleanInt(g.bracketMatch, 0, 7),
  };
  if (g.kolhozUnit === "balls" || g.kolhozUnit === "points") out.kolhozUnit = g.kolhozUnit;
  if (isObj(kolhoz)) {
    const order = cleanPidList(kolhoz.order).filter((pid) => participants.includes(pid));
    out.kolhoz = {
      order: order.length === participants.length ? order : participants,
      rounds: cleanKolhozRounds(kolhoz.rounds),
    };
  }
  return withScores(out);
}

const GAMES_LIMIT = 30;

// Several games can run at once (different tables or even different places
// within one club). Older versions stored a single `activeGame` — it is
// picked up here so a club member on an old version isn't lost.
function sanitizeActiveGames(list, legacy, ended) {
  const out = new Map();
  [...(Array.isArray(list) ? list : []), legacy].forEach((raw) => {
    const g = sanitizeActiveGame(raw);
    if (!g || ended.has(g.id)) return;
    out.set(g.id, out.has(g.id) ? mergeActiveGames(out.get(g.id), g) : g);
  });
  return [...out.values()].slice(0, GAMES_LIMIT);
}

export function normalizeData(input) {
  const parsed = isObj(input) ? input : {};
  const endedGames = cleanIds(parsed.endedGames, ENDED_LIMIT);
  return {
    players: sanitizePlayers(parsed.players),
    matches: sanitizeMatches(parsed.matches),
    trash: sanitizeTrash(parsed.trash),
    activeGames: sanitizeActiveGames(parsed.activeGames, parsed.activeGame, new Set(endedGames)),
    activeSeries: sanitizeSeries(parsed.activeSeries),
    activeBracket: sanitizeBracket(parsed.activeBracket),
    theme: parsed.theme === "dark" ? "dark" : "light",
    gameType: parsed.gameType === "pool" ? "pool" : "russian",
    russianMode: cleanMode(parsed.russianMode) || "free",
    deletedPlayers: cleanTombstones(parsed.deletedPlayers),
    endedGames,
    metaAt: cleanStamp(parsed.metaAt),
    updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
  };
}

const META_KEYS = ["activeSeries", "activeBracket", "theme", "gameType", "russianMode"];

// Called on every local change (prev → next) to record *what* changed, so
// that merging with another device's copy later knows which version of each
// record is newer: edited/added players and matches get `modifiedAt`,
// removed players leave a tombstone, a finished or cancelled game is marked
// ended, and series/bracket/settings changes bump `metaAt`.
// `by` (the member's display name, if set) is recorded on matches as
// createdBy/modifiedBy and on deleted matches as deletedBy, so a club can
// see who recorded, edited or removed what.
export function stampChanges(prev, next, now = Date.now(), by = "") {
  if (!prev || !next || prev === next) return next;
  let out = next;
  const author = typeof by === "string" ? by.slice(0, 40) : "";
  const stampList = (key, withAuthor) => {
    if (next[key] === prev[key]) return;
    const before = new Map((prev[key] || []).map((x) => [x.id, x]));
    out = {
      ...out,
      [key]: (next[key] || []).map((x) => {
        const old = before.get(x.id);
        if (old === x) return x;
        const stamped = { ...x, modifiedAt: now };
        if (withAuthor && author) {
          stamped.modifiedBy = author;
          if (!old && !x.createdBy) stamped.createdBy = author;
        }
        return stamped;
      }),
    };
  };
  stampList("players", false);
  stampList("matches", true);
  if (author && next.trash !== prev.trash) {
    const before = new Set((prev.trash || []).map((m) => m.id));
    out = { ...out, trash: (out.trash || []).map((m) => (before.has(m.id) || m.deletedBy ? m : { ...m, deletedBy: author })) };
  }
  if (next.players !== prev.players) {
    const kept = new Set((next.players || []).map((p) => p.id));
    const removed = (prev.players || []).filter((p) => !kept.has(p.id)).map((p) => p.id);
    if (removed.length) out = { ...out, deletedPlayers: mergeTombstones(prev.deletedPlayers, removed.map((id) => ({ id, at: now }))) };
  }
  if (next.activeGames !== prev.activeGames) {
    const still = new Set((next.activeGames || []).map((g) => g.id));
    const gone = (prev.activeGames || []).map((g) => g.id).filter((id) => !still.has(id));
    if (gone.length) {
      out = { ...out, endedGames: [...(out.endedGames || prev.endedGames || []).filter((id) => !gone.includes(id)), ...gone].slice(-ENDED_LIMIT) };
    }
  }
  if (META_KEYS.some((k) => next[k] !== prev[k])) out = { ...out, metaAt: now };
  return out;
}

const unionIds = (x, y, limit) => {
  const seen = new Set();
  return [...(x || []), ...(y || [])].filter((id) => (seen.has(id) ? false : (seen.add(id), true))).slice(-limit);
};

function mergeActiveGames(x, y) {
  const events = new Map();
  [...(x.events || []), ...(y.events || [])].forEach((e) => events.set(e.id, e));
  const merged = {
    ...y,
    baseScores: { ...(x.baseScores || {}), ...(y.baseScores || {}) },
    events: [...events.values()].sort(eventOrder).slice(-EVENT_LIMIT),
    undone: unionIds(x.undone, y.undone, EVENT_LIMIT),
  };
  // Rounds are only ever appended, so the copy that has played further is newer.
  if (x.kolhoz || y.kolhoz) {
    const kx = x.kolhoz || { rounds: [] };
    const ky = y.kolhoz || { rounds: [] };
    merged.kolhoz = kx.rounds.length > ky.rounds.length ? kx : ky;
  }
  return withScores(merged);
}

function mergeGameLists(newer, older, ended) {
  const out = new Map();
  [...(older || []), ...(newer || [])].forEach((g) => {
    if (!g || ended.has(g.id)) return;
    out.set(g.id, out.has(g.id) ? mergeActiveGames(out.get(g.id), g) : g);
  });
  return [...out.values()]
    .sort((p, q) => String(p.startedAt || "").localeCompare(String(q.startedAt || "")) || (p.id < q.id ? -1 : 1))
    .slice(-GAMES_LIMIT);
}

// Combine two copies of the app state (this device's and another member's)
// without losing either side's work. Order of arguments doesn't matter and
// merging the same copy twice changes nothing, so echoes and retries are safe.
// (When both copies carry the same `updatedAt`, `a` counts as newer.)
export function mergeData(a, b) {
  if (!a) return b;
  if (!b) return a;
  // "newer" only breaks ties; otherwise every record is decided on its own.
  const bNewer = (b.updatedAt || 0) > (a.updatedAt || 0);
  const older = bNewer ? a : b;
  const newer = bNewer ? b : a;

  const deletedPlayers = mergeTombstones(older.deletedPlayers, newer.deletedPlayers);
  const removedAt = new Map(deletedPlayers.map((t) => [t.id, t.at]));
  const players = new Map();
  [...(newer.players || []), ...(older.players || [])].forEach((p) => {
    if (removedAt.has(p.id) && cleanStamp(p.modifiedAt) <= removedAt.get(p.id)) return;
    const cur = players.get(p.id);
    if (!cur || cleanStamp(p.modifiedAt) > cleanStamp(cur.modifiedAt)) players.set(p.id, p);
  });

  // A match is either in the list or in the trash; whichever change happened
  // last (edit/restore → modifiedAt, delete → deletedAt) wins.
  const records = new Map();
  const consider = (rec, inTrash) => {
    const stamp = cleanStamp(inTrash ? rec.deletedAt : rec.modifiedAt);
    const cur = records.get(rec.id);
    if (!cur || stamp > cur.stamp) records.set(rec.id, { rec, inTrash, stamp });
  };
  [newer, older].forEach((side) => {
    (side.matches || []).forEach((m) => consider(m, false));
    (side.trash || []).forEach((m) => consider(m, true));
  });
  const all = [...records.values()];
  const byDate = (x, y) => new Date(x.date).getTime() - new Date(y.date).getTime();
  const matches = all.filter((r) => !r.inTrash).map((r) => r.rec).sort(byDate);
  const trash = all
    .filter((r) => r.inTrash)
    .map((r) => r.rec)
    .sort((x, y) => (x.deletedAt || 0) - (y.deletedAt || 0))
    .slice(-TRASH_LIMIT);

  const endedGames = unionIds(older.endedGames, newer.endedGames, ENDED_LIMIT);
  const activeGames = mergeGameLists(newer.activeGames, older.activeGames, new Set(endedGames));

  const metaSource = cleanStamp(older.metaAt) > cleanStamp(newer.metaAt) ? older : newer;
  const meta = {};
  META_KEYS.forEach((k) => (meta[k] = metaSource[k]));

  return {
    ...newer,
    ...meta,
    players: [...players.values()],
    matches,
    trash,
    activeGames,
    deletedPlayers,
    endedGames,
    metaAt: Math.max(cleanStamp(older.metaAt), cleanStamp(newer.metaAt)),
    updatedAt: Math.max(older.updatedAt || 0, newer.updatedAt || 0),
  };
}

export function formatDuration(ms) {
  if (!ms || ms < 0) return "—";
  const totalMin = Math.max(1, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
}

export function computeStats(players, matches) {
  const byPlayer = {};
  players.forEach((p) => (byPlayer[p.id] = []));
  matches.forEach((m) => {
    m.participants.forEach((pid) => {
      if (byPlayer[pid]) byPlayer[pid].push(m);
    });
  });
  return players
    .map((p) => {
      const pMatches = (byPlayer[p.id] || [])
        .slice()
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      let wins = 0;
      let totalBalls = 0;
      let bestStreak = 0;
      let run = 0;
      let soloGames = 0;
      let breaksCount = 0;
      let breaksAnswered = 0;
      let breaksPotted = 0;
      pMatches.forEach((m) => {
        totalBalls += (m.scores && m.scores[p.id]) || 0;
        if (m.breakerId === p.id) {
          breaksCount += 1;
          if (m.breakerPotted === true || m.breakerPotted === false) {
            breaksAnswered += 1;
            if (m.breakerPotted === true) breaksPotted += 1;
          }
        }
        if (m.solo) {
          soloGames += 1;
          return; // practice: no effect on wins/streaks
        }
        const won = m.winnerId === p.id;
        if (won) {
          wins += 1;
          run += 1;
          bestStreak = Math.max(bestStreak, run);
        } else {
          run = 0;
        }
      });
      const games = pMatches.length;
      const vsGames = games - soloGames;
      const losses = vsGames - wins;
      let currentStreak = 0;
      for (let i = pMatches.length - 1; i >= 0; i--) {
        if (pMatches[i].solo) continue;
        if (pMatches[i].winnerId === p.id) currentStreak += 1;
        else break;
      }
      return {
        id: p.id,
        name: p.name,
        games,
        wins,
        losses,
        winPct: vsGames ? Math.round((wins / vsGames) * 100) : 0,
        currentStreak,
        bestStreak,
        totalBalls,
        avgBalls: games ? totalBalls / games : 0,
        breaksCount,
        breaksPotted,
        breakPct: breaksAnswered ? Math.round((breaksPotted / breaksAnswered) * 100) : 0,
      };
    })
    .sort((a, b) => b.wins - a.wins || b.winPct - a.winPct);
}

// Cumulative win-rate after each head-to-head match, in chronological order,
// one series per player — the "form over time" line chart on the Рейтинг
// tab. Solo practice games don't count (they never affect win/loss).
export function buildRatingTrend(players, matches) {
  const sorted = matches
    .filter((m) => !m.solo)
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const running = {};
  players.forEach((p) => {
    running[p.id] = { wins: 0, played: 0 };
  });

  return sorted.map((m, i) => {
    m.participants.forEach((pid) => {
      if (!running[pid]) return;
      running[pid].played += 1;
      if (m.winnerId === pid) running[pid].wins += 1;
    });
    const point = {
      index: i + 1,
      date: new Date(m.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }),
    };
    players.forEach((p) => {
      const r = running[p.id];
      point[p.name] = r.played > 0 ? Math.round((r.wins / r.played) * 100) : null;
    });
    return point;
  });
}

// Global "best ever" records across all head-to-head matches — used both to
// render the Рекорды card and (by the caller) to detect when a just-finished
// match becomes a new record.
export function computeRecords(matches) {
  const vs = matches.filter((m) => !m.solo);
  const withDur = vs.filter((m) => m.durationMs > 0);
  const fastest = withDur.reduce((a, m) => (!a || m.durationMs < a.durationMs ? m : a), null);
  const longest = withDur.reduce((a, m) => (!a || m.durationMs > a.durationMs ? m : a), null);
  let blow = null;
  let blowMargin = -1;
  vs.forEach((m) => {
    const ws = (m.scores && m.scores[m.winnerId]) || 0;
    const opp = Math.max(0, ...m.participants.filter((p) => p !== m.winnerId).map((p) => (m.scores && m.scores[p]) || 0));
    const margin = ws - opp;
    if (margin > blowMargin) {
      blowMargin = margin;
      blow = m;
    }
  });

  // Best break-shot accuracy — highest % of potting on the break, among
  // players with at least 3 answered breaks (avoids one lucky break "winning").
  const breakTotals = {};
  vs.forEach((m) => {
    if (!m.breakerId || (m.breakerPotted !== true && m.breakerPotted !== false)) return;
    const t = breakTotals[m.breakerId] || (breakTotals[m.breakerId] = { total: 0, potted: 0 });
    t.total += 1;
    if (m.breakerPotted === true) t.potted += 1;
  });
  let bestBreaker = null;
  Object.entries(breakTotals).forEach(([playerId, t]) => {
    if (t.total < 3) return;
    const pct = Math.round((t.potted / t.total) * 100);
    if (!bestBreaker || pct > bestBreaker.pct || (pct === bestBreaker.pct && t.total > bestBreaker.total)) {
      bestBreaker = { playerId, potted: t.potted, total: t.total, pct };
    }
  });

  return { fastest, longest, blow, blowMargin, bestBreaker };
}

// Per-player achievement badges, keyed by player id — used both to render
// the Достижения card and (by the caller) to detect newly-unlocked ones.
export function computeAchievements(stats, matches) {
  const map = {};
  stats.forEach((s) => {
    const list = [];
    if (s.wins >= 1) list.push(["🥇", "Первая победа"]);
    if (s.bestStreak >= 5) list.push(["🔥", "5 побед подряд"]);
    if (s.bestStreak >= 10) list.push(["⚡", "10 побед подряд"]);
    if (s.totalBalls >= 50) list.push(["🎱", "50 шаров"]);
    if (s.totalBalls >= 100) list.push(["💯", "100 шаров"]);
    if (s.totalBalls >= 500) list.push(["🏵️", "500 шаров"]);
    if (s.breaksPotted >= 1) list.push(["🎯", "Точный разбой"]);
    if (s.breaksPotted >= 10) list.push(["💥", "10 удачных разбоев"]);
    map[s.id] = list;
  });
  matches
    .filter((m) => !m.solo)
    .forEach((m) => {
      const ws = (m.scores && m.scores[m.winnerId]) || 0;
      const oppMax = Math.max(
        0,
        ...m.participants.filter((p) => p !== m.winnerId).map((p) => (m.scores && m.scores[p]) || 0)
      );
      if (oppMax === 0 && ws > 0 && map[m.winnerId] && !map[m.winnerId].some((b) => b[1] === "Сухая победа")) {
        map[m.winnerId].push(["🧊", "Сухая победа"]);
      }
      if (m.durationMs >= 3600000) {
        m.participants.forEach((p) => {
          if (map[p] && !map[p].some((b) => b[1] === "Марафон 60+ мин")) map[p].push(["🕰️", "Марафон 60+ мин"]);
        });
      }
      if (m.durationMs > 0 && m.durationMs <= 300000 && map[m.winnerId] && !map[m.winnerId].some((b) => b[1] === "Блиц-победа")) {
        map[m.winnerId].push(["🚀", "Блиц-победа"]);
      }
    });
  return map;
}

export function buildBracketRounds(participants) {
  const rounds = [];
  const firstRound = [];
  for (let i = 0; i < participants.length; i += 2) {
    firstRound.push({ a: participants[i], b: participants[i + 1], winnerId: null });
  }
  rounds.push(firstRound);
  let roundSize = firstRound.length;
  while (roundSize > 1) {
    const nextRound = [];
    for (let i = 0; i < roundSize / 2; i++) nextRound.push({ a: null, b: null, winnerId: null });
    rounds.push(nextRound);
    roundSize = nextRound.length;
  }
  return rounds;
}

export function bracketRoundLabel(ri, total) {
  const fromEnd = total - 1 - ri;
  if (fromEnd === 0) return "Финал";
  if (fromEnd === 1) return "Полуфинал";
  if (fromEnd === 2) return "Четвертьфинал";
  return `Раунд ${ri + 1}`;
}

export function buildKolhozSettlement(participants, scores) {
  const matrix = {};
  participants.forEach((a) => {
    matrix[a] = {};
    participants.forEach((b) => {
      if (a === b) return;
      matrix[a][b] = (scores[a] || 0) - (scores[b] || 0);
    });
  });
  return matrix;
}

// ---------------------------------------------------------------------------
// Kolhoz: players sit in a circle and each one pots "against" the next one
// (order [Ваня, Сергей, Антон] → Ваня забивает Сергею, Сергей — Антону,
// Антон — Ване). After a round the positions are changed and scoring goes on
// in the new order; the pair results add up over all rounds.
// ---------------------------------------------------------------------------

export function kolhozVictim(order, pid) {
  const i = order.indexOf(pid);
  return i < 0 || order.length < 2 ? null : order[(i + 1) % order.length];
}

// The same circle read the other way round — for three players the only
// other order in which everyone gets a new opponent.
export function kolhozSuggestOrder(order) {
  return order.length < 3 ? [...order] : [order[0], ...order.slice(1).reverse()];
}

export function kolhozSwap(order, i, j) {
  if (i === j || i < 0 || j < 0 || i >= order.length || j >= order.length) return order;
  const next = [...order];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function startKolhozRound(g, newOrder) {
  if (!g || !g.kolhoz) return g;
  const order = newOrder && newOrder.length === g.kolhoz.order.length && newOrder.every((p) => g.participants.includes(p)) ? newOrder : g.kolhoz.order;
  const done = { order: g.kolhoz.order, scores: { ...g.scores } };
  return withScores({ ...g, kolhoz: { order: [...order], rounds: [...g.kolhoz.rounds, done].slice(-200) } });
}

// Only the order of a round that has no points yet can be changed in place.
export function setKolhozOrder(g, newOrder) {
  if (!g || !g.kolhoz || newOrder.length !== g.kolhoz.order.length) return g;
  return { ...g, kolhoz: { ...g.kolhoz, order: [...newOrder] } };
}

// Finished rounds plus the current one (if anything was scored in it).
export function kolhozAllRounds(g) {
  if (!g || !g.kolhoz) return [];
  const live = { order: g.kolhoz.order, scores: { ...g.scores } };
  const hasLive = Object.values(live.scores).some((v) => v > 0);
  return [...g.kolhoz.rounds, ...(hasLive ? [live] : [])];
}

// settlement[a][b] > 0 — b owes a that many points.
export function kolhozSettlement(participants, rounds) {
  const owed = {};
  participants.forEach((a) => {
    owed[a] = {};
    participants.forEach((b) => a !== b && (owed[a][b] = 0));
  });
  rounds.forEach((r) => {
    r.order.forEach((pid) => {
      const victim = kolhozVictim(r.order, pid);
      const pts = (r.scores && r.scores[pid]) || 0;
      if (!victim || !owed[pid] || owed[pid][victim] === undefined) return;
      owed[pid][victim] += pts;
      owed[victim][pid] -= pts;
    });
  });
  return owed;
}

export function kolhozNet(settlement) {
  const net = {};
  Object.keys(settlement || {}).forEach((a) => {
    net[a] = Object.values(settlement[a]).reduce((s, v) => s + v, 0);
  });
  return net;
}

// Points each player potted over all rounds (for ball stats).
export function kolhozGross(participants, rounds) {
  const out = {};
  participants.forEach((pid) => (out[pid] = rounds.reduce((s, r) => s + ((r.scores && r.scores[pid]) || 0), 0)));
  return out;
}

// What decides the winner: the total in normal games, the net result in kolhoz.
export function gameStandings(g) {
  if (!g) return {};
  if (!g.kolhoz) return g.scores || {};
  return kolhozNet(kolhozSettlement(g.participants, kolhozAllRounds(g)));
}

// ---------------------------------------------------------------------------
// Playing for money. Kolhoz: `stake` per point (or per ball, when balls are
// counted one each) between every pair; other games: each loser pays the
// winner `stake` for the game. Amounts are whole rubles.
// ---------------------------------------------------------------------------

export const MAX_STAKE = 1000000;
export const cleanStake = (v) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(MAX_STAKE, n) : 0;
};

// [{ from, to, amount }] — who pays whom, one line per pair.
export function buildPayments(m) {
  const stake = cleanStake(m && m.stake);
  if (!stake || !m || m.solo) return [];
  const out = [];
  if (m.settlement && m.mode === "kolhoz") {
    const ids = m.participants;
    ids.forEach((a, i) =>
      ids.slice(i + 1).forEach((b) => {
        const diff = (m.settlement[a] && m.settlement[a][b]) || 0;
        if (diff > 0) out.push({ from: b, to: a, amount: diff * stake });
        if (diff < 0) out.push({ from: a, to: b, amount: -diff * stake });
      })
    );
    return out;
  }
  if (!m.winnerId) return [];
  m.participants.filter((p) => p !== m.winnerId).forEach((p) => out.push({ from: p, to: m.winnerId, amount: stake }));
  return out;
}

// Net money per player over a set of matches (+ won, − lost).
export function moneyBalance(matches) {
  const bal = {};
  (matches || []).forEach((m) =>
    buildPayments(m).forEach(({ from, to, amount }) => {
      bal[from] = (bal[from] || 0) - amount;
      bal[to] = (bal[to] || 0) + amount;
    })
  );
  return bal;
}

export function formatRub(n) {
  const v = Math.round(n || 0);
  return `${v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("ru-RU")} ₽`;
}

// Players already at another table can't be put into a second game.
export function busyPlayerIds(games, exceptGameId = null) {
  const busy = new Set();
  (games || []).forEach((g) => g.id !== exceptGameId && g.participants.forEach((p) => busy.add(p)));
  return busy;
}

// ---------------------------------------------------------------------------
// Statistics helpers for the Рейтинг tab
// ---------------------------------------------------------------------------

const DAY_MS = 86400000;

// period: "all" | "week" (last 7 days) | "month" (last 30 days)
// gameType: "all" | "russian" | "pool"; mode: "all" | a RUSSIAN_MODES key
export function filterMatches(matches, { period = "all", gameType = "all", mode = "all" } = {}, now = Date.now()) {
  const from = period === "week" ? now - 7 * DAY_MS : period === "month" ? now - 30 * DAY_MS : null;
  return matches.filter((m) => {
    if (from !== null && new Date(m.date).getTime() < from) return false;
    const gt = m.gameType || "russian";
    if (gameType !== "all" && gt !== gameType) return false;
    if (mode !== "all" && (gt !== "russian" || (m.mode || "free") !== mode)) return false;
    return true;
  });
}

// Elo over head-to-head matches in chronological order. In games with more
// than two players the winner is rated against each loser, K split evenly.
export function computeElo(players, matches, { k = 32, start = 1000 } = {}) {
  const rating = {};
  const games = {};
  players.forEach((p) => {
    rating[p.id] = start;
    games[p.id] = 0;
  });
  matches
    .filter((m) => !m.solo && m.winnerId && rating[m.winnerId] !== undefined)
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach((m) => {
      const losers = m.participants.filter((pid) => pid !== m.winnerId && rating[pid] !== undefined);
      if (!losers.length) return;
      const before = { ...rating };
      const kk = k / losers.length;
      losers.forEach((lid) => {
        const expectedWin = 1 / (1 + Math.pow(10, (before[lid] - before[m.winnerId]) / 400));
        rating[m.winnerId] += kk * (1 - expectedWin);
        rating[lid] -= kk * (1 - expectedWin);
      });
      games[m.winnerId] += 1;
      losers.forEach((lid) => (games[lid] += 1));
    });
  const out = {};
  Object.keys(rating).forEach((id) => (out[id] = { rating: Math.round(rating[id]), games: games[id] }));
  return out;
}

// wins/losses of every player against every other one (pairwise; in a
// multi-player game the winner beats each loser, losers don't count vs each other).
export function computeHeadToHeadMatrix(players, matches) {
  const matrix = {};
  players.forEach((a) => {
    matrix[a.id] = {};
    players.forEach((b) => {
      if (a.id !== b.id) matrix[a.id][b.id] = { wins: 0, losses: 0 };
    });
  });
  matches
    .filter((m) => !m.solo && m.winnerId)
    .forEach((m) => {
      m.participants.forEach((pid) => {
        if (pid === m.winnerId || !matrix[m.winnerId] || !matrix[m.winnerId][pid]) return;
        matrix[m.winnerId][pid].wins += 1;
        matrix[pid][m.winnerId].losses += 1;
      });
    });
  return matrix;
}

export function computePlayerProfile(playerId, players, matches) {
  const mine = matches
    .filter((m) => m.participants.includes(playerId))
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const vs = mine.filter((m) => !m.solo);
  const wins = vs.filter((m) => m.winnerId === playerId).length;

  const byType = {};
  vs.forEach((m) => {
    const gt = m.gameType || "russian";
    byType[gt] = (byType[gt] || 0) + 1;
  });
  const favoriteGameType = Object.keys(byType).sort((a, b) => byType[b] - byType[a])[0] || null;

  let own = 0;
  let opp = 0;
  vs.forEach((m) => {
    own += (m.scores && m.scores[playerId]) || 0;
    const others = m.participants.filter((p) => p !== playerId).map((p) => (m.scores && m.scores[p]) || 0);
    opp += others.length ? Math.max(...others) : 0;
  });

  const matrix = computeHeadToHeadMatrix(players, matches);
  const row = matrix[playerId] || {};
  let nemesis = null;
  let victim = null;
  Object.keys(row).forEach((oid) => {
    const r = row[oid];
    if (r.wins + r.losses < 2) return;
    if (r.losses > r.wins && (!nemesis || r.losses - r.wins > nemesis.losses - nemesis.wins)) nemesis = { id: oid, ...r };
    if (r.wins > r.losses && (!victim || r.wins - r.losses > victim.wins - victim.losses)) victim = { id: oid, ...r };
  });

  const breaking = { asBreaker: { games: 0, wins: 0 }, other: { games: 0, wins: 0 } };
  vs.forEach((m) => {
    if (!m.breakerId) return;
    const bucket = m.breakerId === playerId ? breaking.asBreaker : breaking.other;
    bucket.games += 1;
    if (m.winnerId === playerId) bucket.wins += 1;
  });

  return {
    games: vs.length,
    wins,
    form: vs.slice(-5).map((m) => (m.winnerId === playerId ? "W" : "L")),
    favoriteGameType,
    avgOwn: vs.length ? own / vs.length : 0,
    avgOpp: vs.length ? opp / vs.length : 0,
    totalDurationMs: mine.reduce((sum, m) => sum + (m.durationMs > 0 ? m.durationMs : 0), 0),
    nemesis,
    victim,
    breaking,
  };
}

// Weekday (Mon=0..Sun=6) and part-of-day distribution, total table time and a
// 10-week calendar (columns = weeks, rows = Mon..Sun) ending with the current week.
export function computeActivity(matches, now = Date.now()) {
  const weekday = [0, 0, 0, 0, 0, 0, 0];
  const dayPart = { morning: 0, day: 0, evening: 0, night: 0 };
  const perDay = {};
  let totalDurationMs = 0;
  const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  matches.forEach((m) => {
    const d = new Date(m.date);
    weekday[(d.getDay() + 6) % 7] += 1;
    const h = d.getHours();
    if (h >= 5 && h < 11) dayPart.morning += 1;
    else if (h >= 11 && h < 17) dayPart.day += 1;
    else if (h >= 17 && h < 23) dayPart.evening += 1;
    else dayPart.night += 1;
    perDay[dayKey(d)] = (perDay[dayKey(d)] || 0) + 1;
    if (m.durationMs > 0) totalDurationMs += m.durationMs;
  });
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weeks = [];
  for (let w = 9; w >= 0; w--) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const cell = new Date(monday);
      cell.setDate(monday.getDate() - w * 7 + d);
      col.push({ date: cell.getTime(), count: cell > today ? null : perDay[dayKey(cell)] || 0 });
    }
    weeks.push(col);
  }
  return { weekday, dayPart, totalDurationMs, weeks, games: matches.length };
}

// Balls scored and minutes per match, in order — the "tempo" chart.
export function buildMatchTempo(matches, limit = 30) {
  return matches
    .filter((m) => m.durationMs > 0)
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-limit)
    .map((m, i) => ({
      index: i + 1,
      date: new Date(m.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }),
      Шары: m.participants.reduce((s, pid) => s + ((m.scores && m.scores[pid]) || 0), 0),
      Минуты: Math.max(1, Math.round(m.durationMs / 60000)),
    }));
}

// Headline numbers for the shareable "итоги" card. null when there is nothing to show.
export function buildPeriodSummary(players, matches) {
  if (!matches.length) return null;
  const stats = computeStats(players, matches).filter((s) => s.games > 0);
  const vs = matches.filter((m) => !m.solo);
  const mvp = stats.filter((s) => s.wins > 0)[0] || null; // computeStats sorts by wins, then win %
  const streak = stats.slice().sort((a, b) => b.bestStreak - a.bestStreak)[0];
  const balls = stats.slice().sort((a, b) => b.totalBalls - a.totalBalls)[0];
  const records = computeRecords(matches);
  return {
    games: matches.length,
    durationMs: matches.reduce((s, m) => s + (m.durationMs > 0 ? m.durationMs : 0), 0),
    mvp: mvp && { name: mvp.name, wins: mvp.wins, winPct: mvp.winPct },
    streak: streak && streak.bestStreak > 1 ? { name: streak.name, value: streak.bestStreak } : null,
    balls: balls && balls.totalBalls > 0 ? { name: balls.name, value: balls.totalBalls } : null,
    blowMargin: records.blow && records.blowMargin > 0 ? records.blowMargin : 0,
    vsGames: vs.length,
  };
}
