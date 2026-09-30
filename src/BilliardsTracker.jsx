import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense, lazy } from "react";
import { saveToCloud, loadFromCloud, cloudSyncAvailable, clearCloud } from "./cloudSync.js";
import { isCloudConfigured } from "./supabaseClient.js";
import {
  sendMagicLink,
  verifyEmailOtp,
  signInWithGoogle,
  onAuthChange,
  getSession,
  signOut as clubSignOut,
  deleteMyAccount,
  createClub,
  joinClub,
  leaveClub,
  getMyClub,
  fetchClubState,
  pushClubState,
  subscribeClubState,
  getClubMembers,
  listClubHistory,
  restoreClubHistory,
  setMyClubName,
  getMyClubName,
} from "./clubSync.js";
import { COLORS, GAME_TYPES, RUSSIAN_MODES, AVATAR_COLORS } from "./constants.js";
import {
  uid,
  loadInitial,
  normalizeData,
  mergeData,
  stampChanges,
  addGameEvent,
  undoGameEvent,
  canUndoGame,
  isGameStale,
  lastGameActivity,
  formatDuration,
  computeStats,
  buildRatingTrend,
  computeRecords,
  computeAchievements,
  buildBracketRounds,
  bracketRoundLabel,
  buildKolhozSettlement,
  filterMatches,
  computeElo,
  computeHeadToHeadMatrix,
  computePlayerProfile,
  computeActivity,
  buildMatchTempo,
  buildPeriodSummary,
  moveMatchToTrash,
  restoreMatchFromTrash,
} from "./gameLogic.js";
import { buildCsv } from "./csv.js";
import { getTG, haptic } from "./telegram.js";
import { makeStyles } from "./styles.js";
import {
  Die,
  PyramidMini,
  GameIcon,
  NavCue,
  NavTrophy,
  NavClock,
  NavGear,
  EmptyState,
  PlayerBall,
  IconTrophy,
  IconTarget,
  IconDice,
} from "./ui/icons.jsx";
import { ScoreWheel } from "./ui/ScoreWheel.jsx";
import { KolhozTable } from "./ui/KolhozTable.jsx";
import { Confetti, DisciplineGate, TableArt } from "./ui/Scenery.jsx";
import { SyncBadge } from "./ui/SyncBadge.jsx";
import { listSafetyCopies, saveSafetyCopy, maybeAutoSafetyCopy } from "./safety.js";
import { TrashCard, SafetyCopies, ClubHistoryModal } from "./HistoryUI.jsx";
import Onboarding from "./Onboarding.jsx";
import {
  StatsFilters,
  PlayerProfileModal,
  HeadToHeadMatrix,
  ActivityCard,
  SummaryCard,
  PERIOD_LABELS,
} from "./StatsExtras.jsx";

const RatingChartPanel = lazy(() => import("./RatingChart.jsx").then((m) => ({ default: m.RatingChartPanel })));

const STORAGE_KEY = "billiards-club-data";
const ONBOARDING_KEY = "billiards-onboarding-v1";
// Id of the club this device's data was last synced with (see club load).
const CLUB_SYNCED_KEY = "billiards-club-synced";

// Club state written by any member is untrusted — sanitize before merging.
const mergeWithRemote = (local, remoteRaw) => mergeData(local, normalizeData(remoteRaw));

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
`;

export default function BilliardsTracker() {
  const [data, setData] = useState(loadInitial());
  const [loaded, setLoaded] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [selected, setSelected] = useState([]);
  const [tab, setTab] = useState("play");
  const [error, setError] = useState("");
  const [tieCandidates, setTieCandidates] = useState(null);
  const [diceRolls, setDiceRolls] = useState(null);
  const [diceRolling, setDiceRolling] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [dateFilter, setDateFilter] = useState("");
  const [historyNameFilter, setHistoryNameFilter] = useState("");
  const [celebrate, setCelebrate] = useState(false);
  const [isOffline, setIsOffline] = useState(typeof navigator !== "undefined" && !navigator.onLine);
  // Club sync state for the header badge: "pending" (changes not yet on the
  // server), "synced", or "error" (will retry).
  const [clubSync, setClubSync] = useState("synced");
  // Id of a forgotten game whose "still playing?" reminder was dismissed.
  const [staleDismissedId, setStaleDismissedId] = useState(null);
  const [minuteTick, setMinuteTick] = useState(() => Date.now());
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tableLit, setTableLit] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [openRuleKey, setOpenRuleKey] = useState(null);
  const [ballValue, setBallValue] = useState(5);
  const [handicaps, setHandicaps] = useState({});
  const [h2h, setH2h] = useState({ a: "", b: "" });
  const [statsFilter, setStatsFilter] = useState({ period: "all", gameType: "all", mode: "all" });
  const [ratingSortElo, setRatingSortElo] = useState(false);
  const [profilePid, setProfilePid] = useState(null);
  const [safetyCopies, setSafetyCopies] = useState(() => {
    try {
      return listSafetyCopies(window.localStorage);
    } catch (e) {
      return [];
    }
  });
  const [clubHistory, setClubHistory] = useState(undefined); // undefined = closed, null = loading, [] = loaded
  const [clubMembers, setClubMembers] = useState([]);
  const [clubHistoryBusy, setClubHistoryBusy] = useState(false);
  const [clubHistoryError, setClubHistoryError] = useState("");
  const [victory, setVictory] = useState(null);
  const [seriesPick, setSeriesPick] = useState(1);
  const [scorePulse, setScorePulse] = useState({ pid: null, ts: 0 });
  const [scoreWheelPid, setScoreWheelPid] = useState(null);
  const lastTapRef = useRef({ key: "", ts: 0 });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [gameMode, setGameMode] = useState(false);
  const [editMatchId, setEditMatchId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [authSession, setAuthSession] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authStatus, setAuthStatus] = useState("idle"); // idle | sending | sent | verifying | error
  const [authError, setAuthError] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [club, setClub] = useState(null);
  const [clubBusy, setClubBusy] = useState(false);
  const [clubError, setClubError] = useState("");
  const [clubCodeInput, setClubCodeInput] = useState("");
  const [clubNameInput, setClubNameInput] = useState("");
  const NAME_KEY = "billiards-display-name";
  const [myName, setMyName] = useState(() => {
    try {
      return window.localStorage.getItem(NAME_KEY) || "";
    } catch (e) {
      return "";
    }
  });
  const [clubNameSaved, setClubNameSaved] = useState(null); // name stored on the server for the current club
  const [nameMsg, setNameMsg] = useState("");

  useEffect(() => {
    if (!data.activeGame) return;
    const t = setInterval(() => setMinuteTick(Date.now()), 60000);
    return () => clearInterval(t);
  }, [data.activeGame]);

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    const tg = getTG();
    if (!tg) return;
    try {
      tg.ready();
      tg.expand();
      if (tg.setHeaderColor) tg.setHeaderColor("#0A2B20");
      if (tg.setBackgroundColor) tg.setBackgroundColor("#0A2B20");
    } catch (e) {
      // not critical
    }
  }, []);

  useEffect(() => {
    (async () => {
      let local = null;
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res && res.value) local = normalizeData(JSON.parse(res.value));
      } catch (e) {
        // no local data yet
      }

      let cloud = null;
      try {
        const cloudRes = await loadFromCloud();
        if (cloudRes && cloudRes.data) cloud = normalizeData({ ...cloudRes.data, updatedAt: cloudRes.updatedAt });
      } catch (e) {
        // cloud unavailable or empty
      }

      // Both copies are this user's own data — merge them so nothing done on
      // either side is lost.
      const cloudIsNewer = cloud && (!local || (cloud.updatedAt || 0) > (local.updatedAt || 0));
      const chosen = cloud && local ? mergeData(local, cloud) : cloud || local;

      if (chosen) {
        setData(chosen);
        if (cloudIsNewer) {
          try {
            await window.storage.set(STORAGE_KEY, JSON.stringify(chosen), false);
          } catch (e) {
            // best effort
          }
        }
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        const res = await window.storage.get(ONBOARDING_KEY, false);
        if (res && res.value === "1") return; // already seen on this device
      } catch (e) {
        // no flag yet — first time here, fall through and show it
      }
      setShowOnboarding(true);
    })();
  }, [loaded]);

  useEffect(() => {
    if (loaded && data.activeGame) {
      // Returning to a match already in progress — light and menu appear
      // together, no delayed reveal (that's only for the first discipline
      // pick on a fresh gate screen).
      setTableLit(true);
      setMenuVisible(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const handleGatePick = (type) => {
    setGameType(type);
    setTimeout(() => setMenuVisible(true), 1000);
  };

  useEffect(() => {
    if (!loaded) return;
    try {
      maybeAutoSafetyCopy(window.localStorage, data);
      setSafetyCopies(listSafetyCopies(window.localStorage));
    } catch (e) {
      // storage unavailable — not critical
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    window.storage.set(ONBOARDING_KEY, "1", false).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isCloudConfigured()) return;
    // Ссылка входа могла истечь, быть уже использованной (например, почтовый
    // сервис заранее "открывает" ссылки для проверки на фишинг) или домен не
    // совпал с настройками Supabase — в этих случаях Supabase не выдаёт сессию,
    // а возвращает ошибку прямо в hash адреса, которую иначе никто не покажет.
    const hash = window.location.hash;
    if (hash && hash.includes("error=")) {
      const params = new URLSearchParams(hash.slice(1));
      const desc = params.get("error_description") || params.get("error") || "Ссылка для входа недействительна";
      setAuthStatus("error");
      setAuthError(decodeURIComponent(desc.replace(/\+/g, " ")));
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    let active = true;
    (async () => {
      const session = await getSession();
      if (active) setAuthSession(session);
    })();
    const unsubscribe = onAuthChange((session) => {
      setAuthSession(session);
      if (!session) setClub(null);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authSession) return;
    let active = true;
    (async () => {
      try {
        const myClub = await getMyClub();
        if (active && myClub) setClub(myClub);
      } catch (e) {
        // not critical — user just isn't in a club yet
      }
    })();
    return () => {
      active = false;
    };
  }, [authSession]);

  useEffect(() => {
    if (!club) return;
    let active = true;
    (async () => {
      try {
        const remote = await fetchClubState(club.id);
        if (active && remote && remote.data) {
          const remoteData = normalizeData({ ...remote.data, updatedAt: remote.data.updatedAt || remote.updatedAt });
          // This device already synced with this club before — keep anything done
          // offline since then. Joining fresh, the club's data replaces personal data.
          let synced = null;
          try {
            synced = window.localStorage.getItem(CLUB_SYNCED_KEY);
          } catch (e) {
            // storage unavailable
          }
          setData((prev) => (synced === club.id ? mergeData(prev, remoteData) : remoteData));
          setClubSync("synced");
          try {
            window.localStorage.setItem(CLUB_SYNCED_KEY, club.id);
          } catch (e) {
            // storage unavailable
          }
        }
      } catch (e) {
        setClubError("Не удалось загрузить данные клуба");
      }
    })();
    const unsubscribe = subscribeClubState(club.id, (remoteData) => {
      // Merge rather than replace: another member's taps/matches are added to
      // ours, and an old echo of our own earlier push changes nothing (so the
      // score can't roll back and forth).
      if (remoteData) setData((prev) => mergeWithRemote(prev, remoteData));
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [club]);

  useEffect(() => {
    const tg = getTG();
    if (!tg) return;
    try {
      if (data.activeGame) {
        tg.enableClosingConfirmation && tg.enableClosingConfirmation();
      } else {
        tg.disableClosingConfirmation && tg.disableClosingConfirmation();
      }
    } catch (e) {
      // not critical
    }
  }, [data.activeGame]);

  useEffect(() => {
    const tg = getTG();
    if (!tg || !tg.BackButton) return;
    const handler = () => setSelectedMatchId(null);
    try {
      if (selectedMatchId) {
        tg.BackButton.show();
        tg.BackButton.onClick(handler);
      } else {
        tg.BackButton.hide();
      }
    } catch (e) {
      // not critical
    }
    return () => {
      try {
        tg.BackButton.offClick(handler);
      } catch (e) {
        // not critical
      }
    };
  }, [selectedMatchId]);

  // Writes are coalesced: rapid taps (big mode) would otherwise serialize the
  // whole state, hit storage and fire cloud/club network calls on every tap.
  // The latest state is flushed shortly after the last change, and right away
  // when the page is hidden or closed.
  const pendingPersistRef = useRef(null);
  const persistTimerRef = useRef(null);

  // Latest state, for retrying a failed club push with current data.
  const dataRef = useRef(data);
  dataRef.current = data;
  const clubInFlightRef = useRef(0);
  const clubRetryRef = useRef(null);

  const pushToClub = useCallback(
    (next) => {
      if (!club) return;
      if (clubRetryRef.current) {
        clearTimeout(clubRetryRef.current);
        clubRetryRef.current = null;
      }
      clubInFlightRef.current += 1;
      setClubSync("pending");
      pushClubState(club.id, next, mergeWithRemote)
        .then((merged) => {
          setData((prev) => mergeData(prev, merged));
          clubInFlightRef.current -= 1;
          if (clubInFlightRef.current === 0 && !pendingPersistRef.current) {
            setClubSync("synced");
            setClubError("");
          }
        })
        .catch(() => {
          clubInFlightRef.current -= 1;
          setClubSync("error");
          setClubError("Не удалось синхронизировать с клубом — повторим автоматически");
          // Retry with whatever the state is by then; nothing is lost meanwhile,
          // it's all kept on the device.
          if (!clubRetryRef.current) {
            clubRetryRef.current = setTimeout(() => {
              clubRetryRef.current = null;
              pushToClub(dataRef.current);
            }, 8000);
          }
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [club]
  );

  useEffect(() => {
    if (!club) return;
    const retry = () => {
      if (clubSync !== "synced") pushToClub(dataRef.current);
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [club, clubSync, pushToClub]);

  useEffect(
    () => () => {
      if (clubRetryRef.current) clearTimeout(clubRetryRef.current);
    },
    []
  );

  const flushPersist = useCallback(async () => {
    const next = pendingPersistRef.current;
    if (!next) return;
    pendingPersistRef.current = null;
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    try {
      await window.storage.set(STORAGE_KEY, JSON.stringify(next), false);
    } catch (e) {
      console.error("Storage error", e);
    }
    // Best-effort mirror to Telegram CloudStorage; silently no-ops outside Telegram.
    saveToCloud(next).catch(() => {});
    // Best-effort mirror to the shared club, if any; the realtime subscription applies
    // remote changes via a separate setData call that never goes through persist(), so
    // there's no echo loop to guard against here.
    if (club) pushToClub(next);
  }, [club, pushToClub]);

  const persist = useCallback(
    (next) => {
      pendingPersistRef.current = next;
      // (deferred: persist runs inside a setData updater)
      if (club) Promise.resolve().then(() => setClubSync("pending"));
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      persistTimerRef.current = setTimeout(flushPersist, 300);
    },
    [flushPersist, club]
  );

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flushPersist();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushPersist);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushPersist);
      flushPersist();
    };
  }, [flushPersist]);

  // Display name attached to changes (who recorded/edited/deleted a match).
  const authorRef = useRef("");
  authorRef.current = myName.trim().slice(0, 40);

  const updateData = useCallback(
    (updater) => {
      setData((prev) => {
        const next0 = typeof updater === "function" ? updater(prev) : updater;
        if (next0 === prev) return prev;
        const now = Date.now();
        const next = { ...stampChanges(prev, next0, now, authorRef.current), updatedAt: now };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const addPlayer = () => {
    const name = nameInput.trim();
    if (!name) return;
    if (data.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      setError("Такой игрок уже есть");
      return;
    }
    setError("");
    updateData((prev) => ({
      ...prev,
      players: [...prev.players, { id: uid(), name, color: AVATAR_COLORS[prev.players.length % AVATAR_COLORS.length] }],
    }));
    setNameInput("");
  };

  const takeSafetyCopy = (reason) => {
    try {
      saveSafetyCopy(window.localStorage, data, reason);
      setSafetyCopies(listSafetyCopies(window.localStorage));
    } catch (e) {
      // storage unavailable — not critical
    }
  };

  const restoreSafetyCopy = (copy) => {
    if (!window.confirm(`Вернуть копию от ${new Date(copy.ts).toLocaleString("ru-RU")}? Текущие данные будут заменены (их копия сохранится).`)) return;
    takeSafetyCopy("before-restore");
    updateData(() => normalizeData(copy.data));
    haptic("success");
  };

  const restoreTrashed = (id) => {
    haptic("light");
    updateData((prev) => restoreMatchFromTrash(prev, id));
  };

  const removePlayer = (id) => {
    const p = data.players.find((x) => x.id === id);
    if (!window.confirm(`Удалить игрока ${p ? p.name : ""}? Его партии останутся в истории, но пропадут из статистики.`)) return;
    updateData((prev) => ({
      ...prev,
      players: prev.players.filter((p) => p.id !== id),
    }));
    setSelected((s) => s.filter((x) => x !== id));
  };

  const toggleSelect = (id) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    setDiceRolls(null);
    setHandicaps({});
    haptic("light");
  };

  const selectAllPlayers = () => {
    setSelected(data.players.map((p) => p.id));
    setDiceRolls(null);
    haptic("light");
  };

  const rollDiceFor = (ids) => {
    if (!ids || ids.length < 2) return;
    haptic("medium");
    setDiceRolling(true);
    let count = 0;
    const totalTicks = 9;
    const timer = setInterval(() => {
      const next = {};
      ids.forEach((id) => {
        next[id] = 1 + Math.floor(Math.random() * 6);
      });
      setDiceRolls(next);
      count += 1;
      if (count >= totalTicks) {
        clearInterval(timer);
        setDiceRolling(false);
      }
    }, 90);
  };

  const breakerInfo = useMemo(() => {
    if (!diceRolls) return { breakerId: null, tie: false, leaders: [] };
    const ids = selected.filter((id) => diceRolls[id] !== undefined);
    if (ids.length < 2) return { breakerId: null, tie: false, leaders: [] };
    const max = Math.max(...ids.map((id) => diceRolls[id]));
    const leaders = ids.filter((id) => diceRolls[id] === max);
    return leaders.length === 1
      ? { breakerId: leaders[0], tie: false, leaders }
      : { breakerId: null, tie: true, leaders };
  }, [diceRolls, selected]);

  const buildTargets = (mode, ids) => {
    const gm = mode ? RUSSIAN_MODES[mode] : null;
    if (!gm) return null;
    const t = {};
    ids.forEach((id) => {
      t[id] = handicaps[id] || gm.target;
    });
    return t;
  };

  const startGame = () => {
    if (selected.length < 1) return;
    haptic("medium");
    setTableLit(true);
    const scores = {};
    selected.forEach((id) => (scores[id] = 0));
    const breakerId = breakerInfo.breakerId || null;
    updateData((prev) => {
      const mode = (prev.gameType || "russian") === "russian" ? prev.russianMode || "free" : null;
      let activeSeries = prev.activeSeries;
      if (!activeSeries && seriesPick > 1 && selected.length >= 2) {
        activeSeries = {
          id: uid(),
          targetWins: seriesPick,
          bestOf: seriesPick * 2 - 1,
          participants: [...selected],
          wins: {},
        };
      }
      return {
        ...prev,
        activeSeries,
        activeGame: {
          id: uid(),
          participants: [...selected],
          scores,
          baseScores: scores,
          events: [],
          undone: [],
          breakerId,
          gameType: prev.gameType || "russian",
          mode,
          targets: buildTargets(mode, selected),
          startedAt: new Date().toISOString(),
        },
      };
    });
    setDiceRolls(null);
    setHandicaps({});
  };

  const startRematch = (participants) => {
    haptic("medium");
    setTableLit(true);
    const scores = {};
    participants.forEach((id) => (scores[id] = 0));
    updateData((prev) => {
      const mode = (prev.gameType || "russian") === "russian" ? prev.russianMode || "free" : null;
      const gm = mode ? RUSSIAN_MODES[mode] : null;
      const targets = gm ? Object.fromEntries(participants.map((id) => [id, gm.target])) : null;
      return {
        ...prev,
        activeGame: {
          id: uid(),
          participants: [...participants],
          scores,
          breakerId: null,
          gameType: prev.gameType || "russian",
          mode,
          targets,
          baseScores: scores,
          events: [],
          undone: [],
          startedAt: new Date().toISOString(),
        },
      };
    });
    setVictory(null);
    setTab("play");
  };

  const cancelSeries = () => {
    if (!window.confirm("Завершить матч досрочно?")) return;
    haptic("warning");
    updateData((prev) => ({ ...prev, activeSeries: null }));
    setSeriesPick(1);
  };

  const startTournament = () => {
    if (selected.length !== 4 && selected.length !== 8) return;
    haptic("medium");
    updateData((prev) => ({
      ...prev,
      activeBracket: {
        id: uid(),
        participants: [...selected],
        rounds: buildBracketRounds(selected),
        champion: null,
      },
    }));
    setSelected([]);
    setDiceRolls(null);
  };

  const startBracketMatch = (roundIdx, matchIdx) => {
    const bracket = data.activeBracket;
    if (!bracket) return;
    const m = bracket.rounds[roundIdx] && bracket.rounds[roundIdx][matchIdx];
    if (!m || !m.a || !m.b || m.winnerId) return;
    haptic("medium");
    setTableLit(true);
    updateData((prev) => {
      const mode = (prev.gameType || "russian") === "russian" ? prev.russianMode || "free" : null;
      return {
        ...prev,
        activeGame: {
          id: uid(),
          participants: [m.a, m.b],
          scores: { [m.a]: 0, [m.b]: 0 },
          baseScores: { [m.a]: 0, [m.b]: 0 },
          events: [],
          undone: [],
          breakerId: null,
          gameType: prev.gameType || "russian",
          mode,
          targets: buildTargets(mode, [m.a, m.b]),
          startedAt: new Date().toISOString(),
          bracketRound: roundIdx,
          bracketMatch: matchIdx,
        },
      };
    });
  };

  const cancelBracket = () => {
    if (!window.confirm("Завершить турнир досрочно?")) return;
    haptic("warning");
    updateData((prev) => ({ ...prev, activeBracket: null }));
  };

  const addPoint = (playerId, delta, { fast = false } = {}) => {
    // Guards against the same tap firing twice on mobile (touch + synthetic
    // click both landing) without blocking genuinely separate fast taps —
    // real double-fires land within the same event loop turn, well under 70ms.
    // The big-mode zones react to pointerdown (one event per tap, no click
    // to duplicate it), so they skip the guard entirely via `fast`.
    if (!fast) {
      const tapKey = `${playerId}:${delta}`;
      const now = Date.now();
      if (lastTapRef.current.key === tapKey && now - lastTapRef.current.ts < 70) return;
      lastTapRef.current = { key: tapKey, ts: now };
    }
    haptic("light");
    if (!fast) setScorePulse({ pid: playerId, ts: Date.now() });
    // Each tap is recorded as its own event, so taps made on another club
    // member's device at the same time are merged in rather than overwritten.
    updateData((prev) => {
      if (!prev.activeGame) return prev;
      return { ...prev, activeGame: addGameEvent(prev.activeGame, { id: uid(), pid: playerId, d: delta, ts: Date.now(), by: authorRef.current }) };
    });
  };

  const setScore = (playerId, value) => {
    const n = Math.max(0, Math.min(999, Math.floor(Number(value) || 0)));
    updateData((prev) => {
      if (!prev.activeGame) return prev;
      const before = prev.activeGame.scores[playerId] || 0;
      if (before === n) return prev;
      return { ...prev, activeGame: addGameEvent(prev.activeGame, { id: uid(), pid: playerId, v: n, ts: Date.now(), by: authorRef.current }) };
    });
  };

  const undoLast = () => {
    haptic("light");
    updateData((prev) => {
      if (!canUndoGame(prev.activeGame)) return prev;
      return { ...prev, activeGame: undoGameEvent(prev.activeGame) };
    });
  };

  const cancelGame = () => {
    if (!window.confirm("Отменить текущую партию без сохранения?")) return;
    haptic("warning");
    updateData((prev) => ({ ...prev, activeGame: null }));
    setTieCandidates(null);
    setSelected([]);
    setDiceRolls(null);
  };

  const finalizeGame = (winnerId) => {
    const g = data.activeGame;
    if (!g) return;
    const durationMs = g.startedAt ? Date.now() - new Date(g.startedAt).getTime() : 0;
    const solo = g.participants.length === 1;

    // Best-of-N series update
    let nextSeries = data.activeSeries;
    let seriesInfo = null;
    const s = data.activeSeries;
    const sameSet =
      s &&
      !solo &&
      s.participants.length === g.participants.length &&
      s.participants.every((id) => g.participants.includes(id));
    if (sameSet) {
      const wins = { ...s.wins, [winnerId]: (s.wins[winnerId] || 0) + 1 };
      const champion = wins[winnerId] >= s.targetWins ? winnerId : null;
      seriesInfo = { wins, targetWins: s.targetWins, bestOf: s.bestOf, participants: s.participants, champion };
      nextSeries = champion ? null : { ...s, wins };
    }

    const settlement = g.mode === "kolhoz" && !solo ? buildKolhozSettlement(g.participants, g.scores) : null;

    // Tournament bracket advance
    let bracketUpdate = null;
    let bracketInfo = null;
    if (g.bracketRound != null && g.bracketMatch != null && data.activeBracket) {
      const bracket = data.activeBracket;
      const rounds = bracket.rounds.map((r) => r.map((mm) => ({ ...mm })));
      rounds[g.bracketRound][g.bracketMatch].winnerId = winnerId;
      let champion = bracket.champion;
      const isFinal = g.bracketRound + 1 >= rounds.length;
      if (!isFinal) {
        const nextIdx = Math.floor(g.bracketMatch / 2);
        const slot = g.bracketMatch % 2 === 0 ? "a" : "b";
        rounds[g.bracketRound + 1][nextIdx][slot] = winnerId;
      } else {
        champion = winnerId;
      }
      bracketUpdate = { ...bracket, rounds, champion };
      bracketInfo = { isFinal, champion: isFinal ? winnerId : null };
    }

    const match = {
      id: uid(),
      date: new Date().toISOString(),
      participants: g.participants,
      scores: g.scores,
      winnerId,
      breakerId: g.breakerId || null,
      breakerPotted: null,
      durationMs,
      gameType: g.gameType || "russian",
      mode: g.mode || null,
      solo,
      seriesId: sameSet ? s.id : null,
      settlement,
      bracketId: bracketUpdate ? bracketUpdate.id : null,
    };

    // Detect newly-unlocked achievements/records by comparing the state
    // right before vs. right after this match is folded in.
    const prevMatches = data.matches;
    const nextMatches = [...prevMatches, match];
    const prevAchievements = computeAchievements(computeStats(data.players, prevMatches), prevMatches);
    const nextAchievements = computeAchievements(computeStats(data.players, nextMatches), nextMatches);
    const newAchievements = [];
    g.participants.forEach((pid) => {
      const before = (prevAchievements[pid] || []).map((b) => b[1]);
      (nextAchievements[pid] || []).forEach(([icon, label]) => {
        if (!before.includes(label)) newAchievements.push({ playerId: pid, icon, label });
      });
    });
    const prevRecords = computeRecords(prevMatches);
    const nextRecords = computeRecords(nextMatches);
    const newRecords = [];
    if (prevRecords.fastest && nextRecords.fastest && nextRecords.fastest.id === match.id) {
      newRecords.push({ type: "fastest", icon: "⚡", label: `Самая быстрая победа — ${formatDuration(match.durationMs)}` });
    }
    if (prevRecords.longest && nextRecords.longest && nextRecords.longest.id === match.id) {
      newRecords.push({ type: "longest", icon: "🕰️", label: `Самая долгая партия — ${formatDuration(match.durationMs)}` });
    }
    if (prevRecords.blow && nextRecords.blow && nextRecords.blow.id === match.id && nextRecords.blowMargin > 0) {
      newRecords.push({ type: "blow", icon: "💥", label: "Самый крупный разгром за всё время" });
    }

    updateData((prev) => ({
      ...prev,
      matches: [...prev.matches, match],
      activeGame: null,
      activeSeries: nextSeries,
      activeBracket: bracketUpdate || prev.activeBracket,
    }));
    setTieCandidates(null);
    setSelected([]);
    setDiceRolls(null);
    if (seriesInfo && seriesInfo.champion) setSeriesPick(1);
    setVictory({
      matchId: match.id,
      winnerId,
      participants: g.participants,
      scores: g.scores,
      durationMs,
      solo,
      mode: g.mode || null,
      gameType: g.gameType || "russian",
      series: seriesInfo,
      settlement,
      bracket: bracketInfo,
      breakerId: g.breakerId || null,
      breakerPotted: null,
      newAchievements,
      newRecords,
    });
    haptic("success");
    setCelebrate(true);
    setTimeout(() => setCelebrate(false), 1700);
  };

  const closeVictory = () => {
    setTab(victory && victory.bracket ? "play" : "rating");
    setVictory(null);
  };

  const setBreakerPotted = (potted) => {
    if (!victory || !victory.matchId) return;
    // Computed directly from current state rather than read back from the
    // updateData call below — React doesn't run that updater synchronously.
    const updatedMatches = data.matches.map((m) => (m.id === victory.matchId ? { ...m, breakerPotted: potted } : m));
    updateData((prev) => ({
      ...prev,
      matches: prev.matches.map((m) => (m.id === victory.matchId ? { ...m, breakerPotted: potted } : m)),
    }));

    // Whether the break was potted wasn't known yet when finalizeGame ran
    // its achievement/record diff, so check again now that it's answered.
    const newBreakAchievements = [];
    const newBreakRecords = [];
    if (potted === true && victory.breakerId) {
      const prevAch = computeAchievements(computeStats(data.players, data.matches), data.matches);
      const nextAch = computeAchievements(computeStats(data.players, updatedMatches), updatedMatches);
      const before = (prevAch[victory.breakerId] || []).map((b) => b[1]);
      (nextAch[victory.breakerId] || []).forEach(([icon, label]) => {
        if (!before.includes(label)) newBreakAchievements.push({ playerId: victory.breakerId, icon, label });
      });
      const prevRec = computeRecords(data.matches);
      const nextRec = computeRecords(updatedMatches);
      // Unlike fastest/longest/blow (trivially "the record" the first time
      // they exist at all), bestBreaker only appears once someone clears
      // the 3-break threshold — clearing it for the first time is itself
      // the achievement, so don't require a prior record to compare against.
      if (
        nextRec.bestBreaker &&
        nextRec.bestBreaker.playerId === victory.breakerId &&
        (!prevRec.bestBreaker || prevRec.bestBreaker.playerId !== victory.breakerId || prevRec.bestBreaker.pct < nextRec.bestBreaker.pct)
      ) {
        newBreakRecords.push({ type: "bestBreaker", icon: "🎯", label: `Лучший процент разбоя — ${nextRec.bestBreaker.pct}%` });
      }
    }

    setVictory((v) => {
      if (!v) return v;
      const existingAchLabels = (v.newAchievements || []).map((a) => `${a.playerId}:${a.label}`);
      const existingRecordTypes = (v.newRecords || []).map((r) => r.type);
      return {
        ...v,
        breakerPotted: potted,
        newAchievements: [
          ...(v.newAchievements || []),
          ...newBreakAchievements.filter((a) => !existingAchLabels.includes(`${a.playerId}:${a.label}`)),
        ],
        newRecords: [...(v.newRecords || []), ...newBreakRecords.filter((r) => !existingRecordTypes.includes(r.type))],
      };
    });
  };

  const setBreaker = (pid) => {
    if (!victory || !victory.matchId) return;
    updateData((prev) => ({
      ...prev,
      matches: prev.matches.map((m) => (m.id === victory.matchId ? { ...m, breakerId: pid } : m)),
    }));
    setVictory((v) => (v ? { ...v, breakerId: pid } : v));
  };

  const shareVictory = async () => {
    if (!victory) return;
    const names = victory.participants.map((pid) => `${nameById(pid)} ${victory.scores[pid] || 0}`).join(" : ");
    const gm = victory.mode ? RUSSIAN_MODES[victory.mode] : null;
    const lines = [
      "🎱 Твой бильярд",
      victory.solo
        ? `Тренировка: ${nameById(victory.participants[0])} — ${victory.scores[victory.participants[0]] || 0} шаров`
        : `🏆 Победа: ${nameById(victory.winnerId)}`,
      !victory.solo ? `Счёт: ${names}` : "",
      gm ? `Режим: ${gm.name} (${gm.alias})` : GAME_TYPES[victory.gameType].label,
      victory.durationMs ? `Время: ${formatDuration(victory.durationMs)}` : "",
      victory.breakerId
        ? `Разбивал: ${nameById(victory.breakerId)}${
            victory.breakerPotted === true ? " (забил с разбоя)" : victory.breakerPotted === false ? " (не забил с разбоя)" : ""
          }`
        : "",
      victory.series
        ? `Матч (Best of ${victory.series.bestOf}): ${victory.series.participants
            .map((pid) => `${nameById(pid)} ${victory.series.wins[pid] || 0}`)
            .join(" : ")}${victory.series.champion ? " — победа в матче!" : ""}`
        : "",
    ].filter(Boolean);
    const text = lines.join("\n");
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
    } catch (e) {
      // fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(text);
      window.alert("Результат скопирован — вставьте в чат!");
    } catch (e) {
      window.alert(text);
    }
  };

  const attemptFinish = () => {
    const g = data.activeGame;
    if (!g) return;
    const max = Math.max(...g.participants.map((id) => g.scores[id] || 0));
    const leaders = g.participants.filter((id) => (g.scores[id] || 0) === max);
    if (leaders.length === 1) {
      finalizeGame(leaders[0]);
    } else {
      setTieCandidates(leaders);
    }
  };

  const deleteMatch = (id) => {
    if (!window.confirm("Удалить партию из истории? Она попадёт в корзину — вернуть её можно внизу вкладки «История».")) return;
    haptic("light");
    updateData((prev) => moveMatchToTrash(prev, id));
    setSelectedMatchId((cur) => (cur === id ? null : cur));
  };

  const startEditMatch = (m) => {
    haptic("light");
    const scores = {};
    m.participants.forEach((pid) => {
      scores[pid] = (m.scores && m.scores[pid]) || 0;
    });
    setEditDraft({ scores });
    setEditMatchId(m.id);
  };

  const cancelEditMatch = () => {
    setEditMatchId(null);
    setEditDraft(null);
  };

  const saveEditMatch = () => {
    if (!editMatchId || !editDraft) return;
    haptic("medium");
    updateData((prev) => {
      const idx = prev.matches.findIndex((m) => m.id === editMatchId);
      if (idx === -1) return prev;
      const old = prev.matches[idx];
      const newScores = editDraft.scores;
      let winnerId = old.winnerId;
      if (!old.solo) {
        const max = Math.max(...old.participants.map((pid) => newScores[pid] || 0));
        const leaders = old.participants.filter((pid) => (newScores[pid] || 0) === max);
        winnerId = leaders.includes(old.winnerId) ? old.winnerId : leaders[0];
      }
      const settlement = old.mode === "kolhoz" && !old.solo ? buildKolhozSettlement(old.participants, newScores) : old.settlement;
      const matches = [...prev.matches];
      matches[idx] = { ...old, scores: newScores, winnerId, settlement };

      let activeSeries = prev.activeSeries;
      if (old.seriesId && activeSeries && activeSeries.id === old.seriesId && winnerId !== old.winnerId) {
        const wins = { ...activeSeries.wins };
        wins[old.winnerId] = Math.max(0, (wins[old.winnerId] || 0) - 1);
        wins[winnerId] = (wins[winnerId] || 0) + 1;
        activeSeries = { ...activeSeries, wins };
      }

      return { ...prev, matches, activeSeries };
    });
    setEditMatchId(null);
    setEditDraft(null);
  };

  const handleSendMagicLink = async () => {
    const email = authEmail.trim();
    if (!email) return;
    setAuthStatus("sending");
    setAuthError("");
    try {
      await sendMagicLink(email);
      setAuthStatus("sent");
    } catch (e) {
      setAuthStatus("error");
      setAuthError(e.message || "Не удалось отправить код");
    }
  };

  const handleVerifyCode = async () => {
    const code = authCode.trim();
    const email = authEmail.trim();
    if (!code || !email) return;
    setAuthStatus("verifying");
    setAuthError("");
    try {
      await verifyEmailOtp(email, code);
      setAuthCode("");
      setAuthStatus("idle");
    } catch (e) {
      setAuthStatus("error");
      setAuthError(e.message || "Неверный или устаревший код");
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthStatus("sending");
    setAuthError("");
    try {
      await signInWithGoogle();
    } catch (e) {
      setAuthStatus("error");
      setAuthError(e.message || "Не удалось войти через Google");
    }
  };

  const handleSignOut = async () => {
    await clubSignOut();
    setAuthSession(null);
    setClub(null);
    setAuthStatus("idle");
    setAuthEmail("");
  };

  // Wipe everything this app keeps on the device (and in Telegram's cloud),
  // then start fresh. Club data on the server is untouched — it belongs to
  // the club; this device just signs out of it.
  const [wipeBusy, setWipeBusy] = useState(false);
  const wipeLocalAndReload = async () => {
    pendingPersistRef.current = null;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    if (clubRetryRef.current) clearTimeout(clubRetryRef.current);
    try {
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith("billiards-"))
        .forEach((k) => window.localStorage.removeItem(k));
    } catch (e) {
      // storage unavailable
    }
    await clearCloud().catch(() => {});
    window.location.reload();
  };

  const deleteDeviceData = async () => {
    const typed = window.prompt(
      "Удалить все данные приложения с этого устройства (игроки, партии, корзина, резервные копии" +
        (authSession ? ", вход в аккаунт" : "") +
        ")? Общие данные клуба на сервере останутся.\n\nЧтобы подтвердить, напишите: удалить"
    );
    if (!typed || typed.trim().toLowerCase() !== "удалить") return;
    setWipeBusy(true);
    if (authSession) await clubSignOut().catch(() => {});
    await wipeLocalAndReload();
  };

  const deleteAccount = async () => {
    const typed = window.prompt(
      "Удалить аккаунт навсегда?\n\n• вы выйдете из всех клубов;\n• клубы, где вы единственный участник, удалятся вместе с данными;\n• общие данные клубов с другими участниками останутся у них;\n• данные на этом устройстве тоже удалятся.\n\nЧтобы подтвердить, напишите: удалить"
    );
    if (!typed || typed.trim().toLowerCase() !== "удалить") return;
    setWipeBusy(true);
    try {
      await deleteMyAccount();
      await wipeLocalAndReload();
    } catch (e) {
      setWipeBusy(false);
      window.alert(e.message || "Не удалось удалить аккаунт");
    }
  };

  const rememberMyName = () => {
    const n = myName.trim().slice(0, 40);
    try {
      window.localStorage.setItem(NAME_KEY, n);
    } catch (e) {
      // not critical
    }
    return n || (authSession && authSession.user && authSession.user.email ? authSession.user.email.split("@")[0] : "");
  };

  const saveMyClubName = async () => {
    if (!club) return;
    const n = rememberMyName();
    setNameMsg("");
    try {
      await setMyClubName(club.id, n);
      setClubNameSaved(n);
      setNameMsg("Сохранено");
    } catch (e) {
      setNameMsg(e.message || "Не удалось сохранить имя");
    }
  };

  useEffect(() => {
    if (!club) {
      setClubNameSaved(null);
      return;
    }
    let alive = true;
    getMyClubName(club.id)
      .then((n) => {
        if (!alive) return;
        setClubNameSaved(n);
        if (n && !myName) setMyName(n);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [club]);

  const handleCreateClub = async () => {
    setClubBusy(true);
    setClubError("");
    try {
      const newClub = await createClub(clubNameInput.trim(), rememberMyName());
      setClub(newClub);
      setClubNameInput("");
    } catch (e) {
      setClubError(e.message || "Не удалось создать клуб");
    } finally {
      setClubBusy(false);
    }
  };

  const handleJoinClub = async () => {
    if (!clubCodeInput.trim()) return;
    setClubBusy(true);
    setClubError("");
    try {
      const joined = await joinClub(clubCodeInput.trim(), rememberMyName());
      setClub(joined);
      setClubCodeInput("");
    } catch (e) {
      setClubError(e.message || "Не удалось присоединиться к клубу");
    } finally {
      setClubBusy(false);
    }
  };

  const openClubHistory = async () => {
    if (!club) return;
    setClubHistory(null);
    setClubHistoryError("");
    try {
      const [items, members] = await Promise.all([listClubHistory(club.id), getClubMembers(club.id).catch(() => [])]);
      setClubHistory(items);
      setClubMembers(members);
    } catch (e) {
      setClubHistoryError(e.message || "Не удалось загрузить историю");
      setClubHistory([]);
    }
  };

  const restoreClubSnapshot = async (h) => {
    if (!window.confirm(`Вернуть состояние клуба от ${new Date(h.saved_at).toLocaleString("ru-RU")} (${h.matches_count} парт.)? Текущее состояние тоже сохранится в истории.`)) return;
    setClubHistoryBusy(true);
    setClubHistoryError("");
    try {
      await restoreClubHistory(h.id);
      const fresh = await fetchClubState(club.id);
      // Applied as a fresh local change: every restored record counts as just
      // edited, so older deletions on other members' devices can't win the merge.
      if (fresh && fresh.data) updateData(normalizeData(fresh.data));
      setClubHistory(await listClubHistory(club.id));
      haptic("success");
    } catch (e) {
      setClubHistoryError(e.message || "Не удалось восстановить");
    } finally {
      setClubHistoryBusy(false);
    }
  };

  const handleLeaveClub = async () => {
    if (!club) return;
    if (!window.confirm("Покинуть клуб? Локальные данные на этом устройстве останутся, но общий доступ прекратится.")) return;
    setClubBusy(true);
    try {
      await leaveClub(club.id);
      setClub(null);
    } catch (e) {
      setClubError(e.message || "Не удалось покинуть клуб");
    } finally {
      setClubBusy(false);
    }
  };

  const clearAll = () => {
    if (
      !window.confirm(
        club
          ? "Удалить всех игроков и всю историю партий? Данные очистятся и у всех участников клуба (прежнее состояние сохранится в истории изменений клуба)."
          : "Удалить всех игроков и всю историю партий? Копия сохранится на этом устройстве, вернуть её можно в разделе «Резервная копия»."
      )
    )
      return;
    takeSafetyCopy("clear-all");
    haptic("warning");
    updateData((prev) => ({
      players: [],
      matches: [],
      trash: [...(prev.trash || []), ...prev.matches.map((m) => ({ ...m, deletedAt: Date.now() }))].slice(-300),
      activeGame: null,
      activeSeries: null,
      activeBracket: null,
      theme: prev.theme,
      gameType: prev.gameType,
      russianMode: prev.russianMode,
    }));
    setSelected([]);
    setTieCandidates(null);
    setDiceRolls(null);
  };

  const toggleTheme = () => {
    haptic("light");
    updateData((prev) => ({ ...prev, theme: prev.theme === "dark" ? "light" : "dark" }));
  };

  const setGameType = (type) => {
    haptic("light");
    setTableLit(true);
    updateData((prev) => ({ ...prev, gameType: type }));
  };

  const setRussianMode = (mode) => {
    haptic("light");
    updateData((prev) => ({ ...prev, russianMode: mode }));
  };

  const stats = useMemo(() => computeStats(data.players, data.matches), [data.players, data.matches]);

  const nameById = useCallback(
    (id) => data.players.find((p) => p.id === id)?.name || "?",
    [data.players]
  );

  const sortedHistory = useMemo(
    () => [...data.matches].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [data.matches]
  );

  const filteredHistory = useMemo(() => {
    let list = sortedHistory;
    if (dateFilter) {
      list = list.filter((m) => new Date(m.date).toISOString().slice(0, 10) === dateFilter);
    }
    const q = historyNameFilter.trim().toLowerCase();
    if (q) {
      list = list.filter((m) => m.participants.some((pid) => (nameById(pid) || "").toLowerCase().includes(q)));
    }
    return list;
  }, [sortedHistory, dateFilter, historyNameFilter, nameById]);

  // Everything on the Рейтинг tab except achievements follows the filters.
  const fMatches = useMemo(() => filterMatches(data.matches, statsFilter), [data.matches, statsFilter]);
  const fStats = useMemo(() => computeStats(data.players, fMatches), [data.players, fMatches]);
  const elo = useMemo(() => computeElo(data.players, fMatches), [data.players, fMatches]);
  const ranked = useMemo(
    () => (ratingSortElo ? [...fStats].sort((a, b) => elo[b.id].rating - elo[a.id].rating) : fStats),
    [fStats, elo, ratingSortElo]
  );
  const h2hMatrix = useMemo(() => computeHeadToHeadMatrix(data.players, fMatches), [data.players, fMatches]);
  const activity = useMemo(() => computeActivity(fMatches), [fMatches]);
  const tempoData = useMemo(() => buildMatchTempo(fMatches), [fMatches]);
  const summary = useMemo(() => buildPeriodSummary(data.players, fMatches), [data.players, fMatches]);
  const profile = useMemo(
    () => (profilePid ? computePlayerProfile(profilePid, data.players, fMatches) : null),
    [profilePid, data.players, fMatches]
  );

  const chartData = useMemo(
    () => fStats.map((s) => ({ name: s.name, Победы: s.wins, Поражения: s.losses, "% побед": s.winPct })),
    [fStats]
  );

  const trendData = useMemo(() => buildRatingTrend(data.players, fMatches), [data.players, fMatches]);

  const streakLeaders = useMemo(
    () => [...fStats].filter((s) => s.bestStreak > 0).sort((a, b) => b.bestStreak - a.bestStreak).slice(0, 5),
    [fStats]
  );

  const playerColor = useCallback(
    (id) => {
      const idx = data.players.findIndex((p) => p.id === id);
      if (idx < 0) return AVATAR_COLORS[0];
      return data.players[idx].color || AVATAR_COLORS[idx % AVATAR_COLORS.length];
    },
    [data.players]
  );

  const records = useMemo(() => computeRecords(fMatches), [fMatches]);

  const achievements = useMemo(() => computeAchievements(stats, data.matches), [stats, data.matches]);

  const h2hStats = useMemo(() => {
    const { a, b } = h2h;
    if (!a || !b || a === b) return null;
    const ms = fMatches.filter((m) => !m.solo && m.participants.length === 2 && m.participants.includes(a) && m.participants.includes(b));
    let wa = 0;
    let wb = 0;
    let ba = 0;
    let bb = 0;
    ms.forEach((m) => {
      if (m.winnerId === a) wa += 1;
      else if (m.winnerId === b) wb += 1;
      ba += (m.scores && m.scores[a]) || 0;
      bb += (m.scores && m.scores[b]) || 0;
    });
    return { games: ms.length, wa, wb, ba, bb };
  }, [h2h, fMatches]);

  const selectedMatch = useMemo(
    () => data.matches.find((m) => m.id === selectedMatchId) || null,
    [data.matches, selectedMatchId]
  );

  const exportCsv = () => {
    const rows = sortedHistory.map((m) => ({
      Дата: new Date(m.date).toLocaleDateString("ru-RU"),
      Время: new Date(m.date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      Игроки: m.participants.map(nameById).join(", "),
      Счёт: m.participants.map((pid) => `${nameById(pid)}: ${(m.scores && m.scores[pid]) || 0}`).join(" | "),
      Победитель: nameById(m.winnerId),
      Начинал: m.breakerId ? nameById(m.breakerId) : "",
      "Забил с разбоя": m.breakerId ? (m.breakerPotted === true ? "Да" : m.breakerPotted === false ? "Нет" : "") : "",
      "Длительность, мин": m.durationMs ? Math.round(m.durationMs / 60000) : "",
    }));
    const statRows = stats.map((s) => ({
      Игрок: s.name,
      Игр: s.games,
      Побед: s.wins,
      Поражений: s.losses,
      "% побед": s.winPct,
      "Текущая серия": s.currentStreak,
      "Лучшая серия": s.bestStreak,
      "Шаров всего": s.totalBalls,
      "Шаров за игру": Math.round(s.avgBalls * 10) / 10,
      Разбоев: s.breaksCount,
      "% разбоя": s.breaksCount ? s.breakPct : "",
    }));
    const csv = buildCsv([
      { title: "Статистика", rows: statRows },
      { title: "История партий", rows },
    ]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `billiards-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `billiards-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importBackup = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!window.confirm("Заменить текущие данные резервной копией?")) return;
        takeSafetyCopy("import-backup");
        const next = normalizeData(parsed);
        updateData(next);
      } catch (err) {
        window.alert("Не удалось прочитать файл резервной копии");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const gameRunning = !!data.activeGame;

  // Keep the screen on while a match is in progress (the OS releases the lock
  // whenever the app goes to the background, so it is re-requested on return).
  useEffect(() => {
    if (!gameRunning || typeof navigator === "undefined" || !navigator.wakeLock) return;
    let lock = null;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== "visible" || (lock && !lock.released)) return;
      try {
        const l = await navigator.wakeLock.request("screen");
        if (cancelled) l.release().catch(() => {});
        else lock = l;
      } catch (e) {
        // denied (battery saver, unsupported context) — nothing else to do
      }
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      if (lock) lock.release().catch(() => {});
    };
  }, [gameRunning]);

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.felt, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{FONTS}</style>
        <span style={{ color: COLORS.cream, fontFamily: "Inter, sans-serif" }}>Загрузка стола…</span>
      </div>
    );
  }

  const activeGame = data.activeGame;
  const dark = data.theme === "dark";
  const styles = makeStyles(dark);
  const isKolhoz = (data.gameType || "russian") === "russian" && (data.russianMode || "free") === "kolhoz";
  const immersive = !!(activeGame && gameMode);

  // Show the "what are we playing?" gate until a discipline is actively
  // picked this session — skip it outright if a match is already underway
  // (returning to an in-progress game shouldn't ask again).
  const showDisciplineGate = !tableLit && !activeGame;

  return (
    <div>
      <style>{FONTS}</style>
      <style>{`
        * { box-sizing: border-box; }
        button { font-family: inherit; cursor: pointer; }
        button:focus-visible, input:focus-visible { outline: 2px solid ${COLORS.brass}; outline-offset: 2px; }
        input { font-family: inherit; }
        ::selection { background: ${COLORS.brass}; color: ${COLORS.ink}; }
        button:disabled { opacity: 0.4; cursor: not-allowed; }
        button:active { transform: scale(0.96); }
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        html, body { overscroll-behavior-y: none; }
        @keyframes syncPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @keyframes diceShake {
          0% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(-18deg) scale(1.12); }
          50% { transform: rotate(14deg) scale(0.94); }
          75% { transform: rotate(-10deg) scale(1.06); }
          100% { transform: rotate(0deg) scale(1); }
        }
        /* Timeline (6s, linear — keyframe spacing defines velocity):
           46-54% slow backswing, 56-58% fast strike, 58% cue contacts red,
           58-70% red rolls & decelerates, 70% stun-shot contact (red stops,
           white departs instantly), 70-84% white decelerates to the pocket,
           84-89% gravity drop into the hole. */
        @keyframes cueStrike {
          0%, 46% { transform: translateX(0); }
          54% { transform: translateX(-26px); }
          56% { transform: translateX(-26px); }
          58% { transform: translateX(3px); }
          60% { transform: translateX(-10px); }
          66%, 100% { transform: translateX(0); }
        }
        @keyframes redRoll {
          0% { transform: translate(0px, 0px); opacity: 0; }
          4% { opacity: 1; }
          58% { transform: translate(0px, 0px); opacity: 1; }
          61% { transform: translate(51px, -27px); }
          64% { transform: translate(93px, -49px); }
          67% { transform: translate(125px, -66px); }
          70% { transform: translate(147px, -78px); }
          94% { transform: translate(147px, -78px); opacity: 1; }
          99%, 100% { transform: translate(147px, -78px); opacity: 0; }
        }
        @keyframes whiteRoll {
          0% { transform: translate(0px, 0px) scale(1); opacity: 0; }
          4% { opacity: 1; }
          70% { transform: translate(0px, 0px) scale(1); opacity: 1; }
          73% { transform: translate(47px, -22px) scale(1); }
          77% { transform: translate(84px, -39px) scale(1); }
          81% { transform: translate(111px, -52px) scale(1); }
          84% { transform: translate(123px, -58px) scale(1); opacity: 1; }
          87% { transform: translate(123px, -55px) scale(0.45); opacity: 1; }
          89%, 100% { transform: translate(123px, -55px) scale(0.05); opacity: 0; }
        }
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(112vh) rotate(340deg); opacity: 0; }
        }
        @keyframes iconPop {
          0% { transform: translateY(2px) rotate(-14deg) scale(0.85); }
          55% { transform: translateY(-2px) rotate(6deg) scale(1.12); }
          100% { transform: translateY(0) rotate(0deg) scale(1); }
        }
        @keyframes scorePop {
          0% { transform: scale(1); }
          45% { transform: scale(1.22); }
          100% { transform: scale(1); }
        }
        @keyframes tableKenBurns {
          0% { transform: scale(1); }
          100% { transform: scale(1.07); }
        }
        @keyframes fadeIn {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .tab-fade { animation: fadeIn 0.22s ease; }
        .menu-reveal { animation: fadeIn 0.9s ease; }
        .wheel-scroll::-webkit-scrollbar { display: none; }
        .wheel-scroll { scrollbar-width: none; }
        .fs-overlay { position: fixed; inset: 0; z-index: 40; }
        @media (orientation: portrait) {
          .fs-overlay {
            top: 50%;
            left: 50%;
            right: auto;
            bottom: auto;
            width: 100vh;
            height: 100vw;
            transform: translate(-50%, -50%) rotate(90deg);
          }
        }
        @media print {
          .no-print { display: none !important; }
        }
      `}</style>

      <div style={styles.outerBg}>
        <TableArt gameType={data.gameType} lit={tableLit} dark={dark} />
        <div
          style={{
            ...styles.outerOverlay,
            background: activeGame
              ? dark ? "rgba(2,6,4,0.4)" : "rgba(4,10,7,0.34)"
              : dark ? "rgba(2,6,4,0.12)" : "transparent",
          }}
        />
      </div>

      <div style={styles.page}>
        {isOffline && (
          <div style={styles.offlineBanner} className="no-print">
            📡 Нет соединения — партии сохраняются на устройстве и синхронизируются, когда сеть вернётся
          </div>
        )}
        {showDisciplineGate ? (
          <DisciplineGate onPick={handleGatePick} />
        ) : !menuVisible ? null : (
          <div className="menu-reveal">
        {!immersive && (
          <header style={{ ...styles.header, position: "relative" }} className="no-print">
            {club && (
              <div style={{ position: "absolute", right: "12px", top: "calc(6px + env(safe-area-inset-top))" }}>
                <SyncBadge status={isOffline ? "offline" : clubSync} compact />
              </div>
            )}
            <div style={styles.gameTypeSwitch} role="tablist" aria-label="Дисциплина">
              <button
                type="button"
                role="tab"
                aria-selected={(data.gameType || "russian") !== "pool"}
                style={{
                  ...styles.gameTypeSwitchBtn,
                  ...((data.gameType || "russian") !== "pool" ? styles.gameTypeSwitchBtnActive : {}),
                }}
                onClick={() => setGameType("russian")}
              >
                <GameIcon type="russian" size={13} /> Русский
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={(data.gameType || "russian") === "pool"}
                style={{
                  ...styles.gameTypeSwitchBtn,
                  ...((data.gameType || "russian") === "pool" ? styles.gameTypeSwitchBtnActive : {}),
                }}
                onClick={() => setGameType("pool")}
              >
                <GameIcon type="pool" size={13} /> Pool
              </button>
            </div>
          </header>
        )}

        <main style={styles.main} key={tab} className="tab-fade">
          {tab === "play" && (
            <section>
              {!activeGame && (
                <div style={styles.card}>
                  <h2 style={styles.h2}>Игроки</h2>
                  <div style={styles.addRow}>
                    <input
                      style={styles.input}
                      placeholder="Имя игрока"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addPlayer()}
                    />
                    <button style={styles.brassBtn} onClick={addPlayer}>
                      Добавить
                    </button>
                  </div>
                  {error && <div style={styles.errorText}>{error}</div>}
                  {data.players.length === 0 ? (
                    <p style={styles.emptyText}>Пока никого нет. Добавьте хотя бы двоих — игроков может быть сколько угодно.</p>
                  ) : (
                    <div style={styles.chipRow}>
                      {data.players.map((p) => (
                        <span key={p.id} style={styles.playerChip}>
                          <PlayerBall color={playerColor(p.id)} size={12} /> {p.name}
                          <button onClick={() => removePlayer(p.id)} style={styles.chipRemove} aria-label={`Удалить ${p.name}`}>
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!activeGame && !data.activeBracket && (
                <div style={styles.card}>
                  <h2 style={styles.h2}>Начать партию</h2>
                  {(data.gameType || "russian") === "russian" && (
                    <div style={{ marginBottom: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                        <p style={styles.hint}>Дисциплина</p>
                        <button
                          style={styles.ghostBtn}
                          onClick={() => {
                            setOpenRuleKey(data.russianMode || "free");
                            setRulesOpen(true);
                          }}
                        >
                          📖 Правила
                        </button>
                      </div>
                      <div style={styles.chipRow}>
                        {Object.entries(RUSSIAN_MODES).map(([key, m]) => (
                          <button
                            key={key}
                            onClick={() => setRussianMode(key)}
                            style={{
                              ...styles.selectChip,
                              ...((data.russianMode || "free") === key ? styles.selectChipActive : {}),
                            }}
                          >
                            {m.alias}
                          </button>
                        ))}
                      </div>
                      <p style={styles.hint}>
                        {RUSSIAN_MODES[data.russianMode || "free"].target
                          ? `${RUSSIAN_MODES[data.russianMode || "free"].name} · до ${
                              RUSSIAN_MODES[data.russianMode || "free"].target
                            } ${RUSSIAN_MODES[data.russianMode || "free"].unit}`
                          : `${RUSSIAN_MODES[data.russianMode || "free"].name} · играют все против всех, круговой расчёт очков в конце`}
                      </p>
                      {isKolhoz && selected.length === 1 && (
                        <p style={{ ...styles.hint, color: COLORS.danger }}>Нужно минимум 2 игрока</p>
                      )}
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                    <p style={styles.pickLabel}>Отметьте, кто играет</p>
                    {data.players.length >= 2 && (
                      <button style={styles.diceBtn} onClick={selectAllPlayers}>
                        Выбрать всех
                      </button>
                    )}
                  </div>
                  <div style={styles.chipRow}>
                    {data.players.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => toggleSelect(p.id)}
                        style={{
                          ...styles.selectChip,
                          ...(selected.includes(p.id) ? styles.selectChipActive : {}),
                        }}
                      >
                        <PlayerBall color={playerColor(p.id)} size={12} /> {p.name}
                      </button>
                    ))}
                  </div>

                  {!isKolhoz && (selected.length === 4 || selected.length === 8) && (
                    <button style={{ ...styles.diceBtn, marginTop: "10px", width: "100%" }} onClick={startTournament}>
                      <IconTrophy /> Турнир на выбывание ({selected.length} участника{selected.length === 4 ? "" : "ов"})
                    </button>
                  )}

                  {selected.length >= 2 && (
                    <div style={styles.diceSection}>
                      <p style={styles.pickLabel}>Кто разбивает первым?</p>
                      <button style={styles.diceBtn} onClick={() => rollDiceFor(selected)} disabled={diceRolling}>
                        <IconDice color="currentColor" /> Кинуть кубики
                      </button>

                      {diceRolls && (
                        <div style={styles.diceRow}>
                          {selected.map((id) => (
                            <div key={id} style={styles.diceCard}>
                              <div
                                style={{
                                  animation: diceRolling ? "diceShake 0.25s infinite" : "none",
                                }}
                              >
                                <Die value={diceRolls[id] || 1} size={44} />
                              </div>
                              <span style={styles.diceName}>{nameById(id)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {!diceRolling && breakerInfo.tie && (
                        <div style={styles.tieNote}>
                          <p style={styles.hint}>
                            Ничья: {breakerInfo.leaders.map((id) => nameById(id)).join(", ")} — нужен переброс
                          </p>
                          <button style={styles.diceBtn} onClick={() => rollDiceFor(breakerInfo.leaders)}>
                            Переброс
                          </button>
                        </div>
                      )}

                      {!diceRolling && breakerInfo.breakerId && (
                        <div style={styles.breakerBanner}>
                          <IconTarget /> Первым разбивает: <strong>{nameById(breakerInfo.breakerId)}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {data.activeSeries && (
                    <div style={{ ...styles.breakerBanner, textAlign: "left" }}>
                      🏟️ Матч до {data.activeSeries.targetWins} побед (Best of {data.activeSeries.bestOf})
                      <div style={{ marginTop: "4px", fontWeight: 700 }}>
                        {data.activeSeries.participants
                          .map((pid) => `${nameById(pid)} ${data.activeSeries.wins[pid] || 0}`)
                          .join(" : ")}
                      </div>
                      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                        <button style={{ ...styles.brassBtn, flex: 1 }} onClick={() => startRematch(data.activeSeries.participants)}>
                          Продолжить матч
                        </button>
                        <button style={{ ...styles.diceBtn, flex: 1 }} onClick={cancelSeries}>
                          Завершить матч
                        </button>
                      </div>
                    </div>
                  )}

                  {!isKolhoz && selected.length >= 2 && (
                    <button
                      style={{ ...styles.ghostBtn, marginTop: "10px" }}
                      onClick={() => setAdvancedOpen((o) => !o)}
                    >
                      {advancedOpen ? "▲ Скрыть доп. настройки" : "▾ Формат и фора"}
                    </button>
                  )}

                  {!isKolhoz && advancedOpen && !data.activeSeries && selected.length >= 2 && (
                    <div style={styles.diceSection}>
                      <p style={styles.hint}>Формат</p>
                      <div style={styles.chipRow}>
                        {[
                          [1, "Одна партия"],
                          [2, "Best of 3"],
                          [3, "Best of 5"],
                          [4, "Best of 7"],
                        ].map(([val, label]) => (
                          <button
                            key={val}
                            onClick={() => {
                              haptic("light");
                              setSeriesPick(val);
                            }}
                            style={{
                              ...styles.selectChip,
                              ...(seriesPick === val ? styles.selectChipActive : {}),
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {!isKolhoz &&
                    advancedOpen &&
                    (data.gameType || "russian") === "russian" &&
                    selected.length >= 2 &&
                    RUSSIAN_MODES[data.russianMode || "free"] && (
                      <div style={styles.diceSection}>
                        <p style={styles.hint}>
                          Фора: личная цель каждого (по умолчанию {RUSSIAN_MODES[data.russianMode || "free"].target})
                        </p>
                        {selected.map((pid) => {
                          const base = RUSSIAN_MODES[data.russianMode || "free"].target;
                          const cur = handicaps[pid] || base;
                          return (
                            <div key={pid} style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
                              <span style={{ flex: 1, fontSize: "13px" }}>
                                <PlayerBall color={playerColor(pid)} /> {nameById(pid)}
                              </span>
                              <button
                                style={styles.scoreBtnMinus}
                                disabled={cur <= 1}
                                onClick={() => setHandicaps((h) => ({ ...h, [pid]: Math.max(1, cur - 1) }))}
                              >
                                −
                              </button>
                              <span style={{ ...styles.mono, minWidth: "24px", textAlign: "center", fontWeight: 700 }}>{cur}</span>
                              <button
                                style={styles.scoreBtnMinus}
                                disabled={cur >= base}
                                onClick={() => setHandicaps((h) => ({ ...h, [pid]: Math.min(base, cur + 1) }))}
                              >
                                +
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                  <button
                    style={{ ...styles.brassBtn, marginTop: "16px", width: "100%" }}
                    disabled={selected.length < 1 || (isKolhoz && selected.length < 2)}
                    onClick={startGame}
                  >
                    {selected.length === 1 ? "Начать тренировку (соло)" : "Начать партию"}
                  </button>
                  {selected.length === 1 && (
                    <p style={styles.hint}>Режим тренировки: играете один, шары идут в вашу статистику</p>
                  )}
                </div>
              )}

              {!activeGame && data.activeBracket && (
                <div style={styles.card}>
                  <h2 style={styles.h2}>
                    <IconTrophy size={16} /> Турнир на выбывание
                  </h2>
                  {data.activeBracket.champion && (
                    <div style={{ ...styles.breakerBanner, borderColor: "#3E9B5C" }}>
                      <IconTrophy /> Чемпион турнира: <strong>{nameById(data.activeBracket.champion)}</strong>
                    </div>
                  )}
                  {data.activeBracket.rounds.map((round, ri) => (
                    <div key={ri} style={{ marginTop: "14px" }}>
                      <p style={styles.hint}>{bracketRoundLabel(ri, data.activeBracket.rounds.length)}</p>
                      {round.map((m, mi) => (
                        <div
                          key={mi}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "8px",
                            padding: "10px 12px",
                            borderRadius: "10px",
                            background: "rgba(255,255,255,0.05)",
                            marginBottom: "6px",
                          }}
                        >
                          <span style={{ fontSize: "13px" }}>
                            <span style={{ fontWeight: m.winnerId && m.winnerId === m.a ? 700 : 400 }}>
                              {m.a ? nameById(m.a) : "?"}
                              {m.winnerId && m.winnerId === m.a ? <IconTrophy size={12} /> : ""}
                            </span>
                            {" vs "}
                            <span style={{ fontWeight: m.winnerId && m.winnerId === m.b ? 700 : 400 }}>
                              {m.b ? nameById(m.b) : "?"}
                              {m.winnerId && m.winnerId === m.b ? <IconTrophy size={12} /> : ""}
                            </span>
                          </span>
                          {m.a && m.b && !m.winnerId && (
                            <button style={styles.diceBtn} onClick={() => startBracketMatch(ri, mi)}>
                              Играть
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                  <button style={{ ...styles.cancelBtn, marginTop: "12px", width: "100%" }} onClick={cancelBracket}>
                    Завершить турнир
                  </button>
                </div>
              )}

              {activeGame && !tieCandidates && (() => {
                const gm = activeGame.mode ? RUSSIAN_MODES[activeGame.mode] : null;
                const isPoints = gm && gm.unit === "очков";
                const targetOf = (pid) => (activeGame.targets && activeGame.targets[pid]) || (gm ? gm.target : 0);
                const reachedId =
                  gm && gm.target
                    ? activeGame.participants.find((pid) => (activeGame.scores[pid] || 0) >= targetOf(pid))
                    : null;

                if (gameMode) {
                  return (
                    <div style={styles.fsOverlay} className="fs-overlay no-print">
                      <div style={styles.fsTopBar}>
                        <button style={styles.fsTopBtn} onClick={() => setGameMode(false)}>
                          ▣ Обычный вид
                        </button>
                        {club && <SyncBadge status={isOffline ? "offline" : clubSync} dotOnly />}
                        <button
                          style={{ ...styles.fsTopBtn, opacity: canUndoGame(activeGame) ? 1 : 0.4 }}
                          disabled={!canUndoGame(activeGame)}
                          onClick={undoLast}
                        >
                          ↶ Отменить
                        </button>
                        <button style={{ ...styles.fsTopBtn, borderColor: COLORS.felt, color: COLORS.felt }} onClick={attemptFinish}>
                          Завершить
                        </button>
                      </div>
                      {isPoints && (
                        <div style={styles.fsBallPicker}>
                          {Array.from({ length: 15 }, (_, i) => i + 1).map((v) => (
                            <button
                              key={v}
                              onClick={() => {
                                haptic("light");
                                setBallValue(v);
                              }}
                              style={{
                                ...styles.fsBallChip,
                                ...(ballValue === v ? styles.fsBallChipActive : {}),
                              }}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      )}
                      {reachedId && (
                        <div style={styles.fsReachedBanner}>
                          <IconTrophy /> <strong>{nameById(reachedId)}</strong> достиг цели ({targetOf(reachedId)} {gm.unit})!
                          <button style={{ ...styles.brassBtn, marginTop: "8px", width: "100%" }} onClick={() => finalizeGame(reachedId)}>
                            Засчитать победу
                          </button>
                        </div>
                      )}
                      <div style={styles.fsZones}>
                        {activeGame.participants.map((pid) => (
                          <div
                            key={pid}
                            style={{
                              ...styles.fsZone,
                              background: `radial-gradient(120% 90% at 50% 0%, ${playerColor(pid)}b3 0%, ${playerColor(pid)}3d 38%, rgba(10,26,20,0.98) 82%)`,
                            }}
                            onPointerDown={(e) => {
                              addPoint(pid, isPoints ? ballValue : 1, { fast: true });
                            }}
                            onClick={(e) => {
                              // keyboard activation only (detail 0); real taps are handled on pointerdown
                              if (e.detail === 0) addPoint(pid, isPoints ? ballValue : 1, { fast: true });
                            }}
                          >
                            <button
                              style={styles.fsZoneEdit}
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                setScoreWheelPid(pid);
                              }}
                              aria-label={`Изменить счёт: ${nameById(pid)}`}
                            >
                              ✎
                            </button>
                            <div style={styles.fsZoneCenter}>
                              <div style={styles.fsZoneName}>
                                <PlayerBall color={playerColor(pid)} size={20} /> {nameById(pid)}
                                {gm && targetOf(pid) ? (
                                  <span style={{ opacity: 0.6, fontSize: "12px", fontWeight: 500 }}> · до {targetOf(pid)}</span>
                                ) : null}
                              </div>
                              <span data-score-pulse style={styles.fsZoneScoreWrap}>
                                <div style={styles.fsZoneScore} aria-label={`Счёт: ${nameById(pid)}`}>
                                  {activeGame.scores[pid] || 0}
                                </div>
                              </span>
                            </div>
                            <button
                              style={{ ...styles.fsZoneMinusBar, opacity: (activeGame.scores[pid] || 0) <= 0 ? 0.4 : 1 }}
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                if ((activeGame.scores[pid] || 0) > 0) addPoint(pid, -1, { fast: true });
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (e.detail === 0) addPoint(pid, -1, { fast: true });
                              }}
                              disabled={(activeGame.scores[pid] || 0) <= 0}
                              aria-label={`Убрать шар (ошибка/штраф): ${nameById(pid)}`}
                            >
                              − Убрать шар
                            </button>
                          </div>
                        ))}
                      </div>
                      <p style={styles.fsHint}>
                        Тапните по своей половине экрана, чтобы добавить {isPoints ? `${ballValue} очк.` : "шар"}
                      </p>
                    </div>
                  );
                }

                return (
                <div style={styles.cardFrosted}>
                  <div style={styles.liveHeader}>
                    <span style={styles.liveDot} />
                    <h2 style={{ ...styles.h2, margin: 0, flex: 1 }}>Партия идёт</h2>
                    <button
                      style={{ ...styles.diceBtn, padding: "6px 10px", fontSize: "11px" }}
                      onClick={() => setGameMode(true)}
                      className="no-print"
                    >
                      ⛶ Крупный режим
                    </button>
                  </div>
                  {isGameStale(activeGame, minuteTick) && staleDismissedId !== activeGame.id && (
                    <div style={{ ...styles.breakerBanner, textAlign: "left" }} className="no-print">
                      ⏰ Партия открыта уже {formatDuration(minuteTick - new Date(activeGame.startedAt).getTime())}
                      {(activeGame.events || []).length
                        ? `, счёт последний раз менялся ${formatDuration(minuteTick - lastGameActivity(activeGame))} назад`
                        : ", а счёт с тех пор не менялся"}
                      . Её не забыли завершить?
                      <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                        <button style={styles.diceBtn} onClick={() => setStaleDismissedId(activeGame.id)}>
                          Продолжаем
                        </button>
                        <button style={styles.diceBtn} onClick={attemptFinish}>
                          Завершить
                        </button>
                        <button style={styles.diceBtn} onClick={cancelGame}>
                          Отменить
                        </button>
                      </div>
                    </div>
                  )}
                  {gm && (
                    <p style={styles.hint}>
                      {gm.name} ({gm.alias})
                      {gm.target ? ` · до ${gm.target} ${gm.unit}` : " · круговой расчёт, завершите вручную, когда закончите"}
                    </p>
                  )}
                  {activeGame.breakerId && (
                    <div style={styles.breakerBanner}>
                      <IconTarget /> Первым разбивал: <strong>{nameById(activeGame.breakerId)}</strong>
                    </div>
                  )}
                  {reachedId && (
                    <div style={{ ...styles.breakerBanner, borderColor: "#3E9B5C" }}>
                      <IconTrophy /> <strong>{nameById(reachedId)}</strong> достиг цели ({targetOf(reachedId)} {gm.unit})!{" "}
                      <button
                        style={{ ...styles.brassBtn, marginTop: "8px", width: "100%" }}
                        onClick={() => finalizeGame(reachedId)}
                      >
                        Засчитать победу
                      </button>
                    </div>
                  )}
                  <p style={styles.hint}>
                    {isPoints ? "Отмечайте набранные очки каждого игрока" : "Отмечайте забитые шары каждого игрока"}
                  </p>
                  {isPoints && (
                    <div style={{ marginTop: "10px" }}>
                      <p style={styles.hint}>Номинал забитого шара (очки = номер шара)</p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px", marginTop: "8px" }}>
                        {Array.from({ length: 15 }, (_, i) => i + 1).map((v) => (
                          <button
                            key={v}
                            onClick={() => {
                              haptic("light");
                              setBallValue(v);
                            }}
                            style={{
                              ...styles.selectChip,
                              borderRadius: "10px",
                              padding: "11px 0",
                              textAlign: "center",
                              fontSize: "14px",
                              fontWeight: 700,
                              ...(ballValue === v ? styles.selectChipActive : {}),
                            }}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={styles.scoreboard}>
                    {activeGame.participants.map((pid) => (
                      <div key={pid} style={{ ...styles.scoreCard, borderLeft: `4px solid ${playerColor(pid)}` }}>
                        <div style={styles.scoreName}>
                          <PlayerBall color={playerColor(pid)} size={14} /> {nameById(pid)}
                          {gm && targetOf(pid) ? (
                            <span style={{ opacity: 0.6, fontSize: "11px", fontWeight: 500 }}> · до {targetOf(pid)}</span>
                          ) : null}
                        </div>
                        <span
                          key={scorePulse.pid === pid ? scorePulse.ts : "s"}
                          style={{
                            display: "inline-block",
                            animation: scorePulse.pid === pid ? "scorePop 0.32s ease" : "none",
                          }}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setScoreWheelPid(pid);
                            }}
                            style={styles.scoreInput}
                            aria-label={`Счёт: ${nameById(pid)}`}
                          >
                            {activeGame.scores[pid] || 0}
                          </button>
                        </span>
                        <div style={styles.scoreBtns}>
                          <button
                            style={styles.scoreBtnMinus}
                            onClick={(e) => {
                              e.stopPropagation();
                              addPoint(pid, -1);
                            }}
                            disabled={(activeGame.scores[pid] || 0) <= 0}
                            aria-label={`Убрать у ${nameById(pid)}`}
                          >
                            −
                          </button>
                          <button
                            style={styles.scoreBtnPlus}
                            onClick={(e) => {
                              e.stopPropagation();
                              addPoint(pid, isPoints ? ballValue : 1);
                            }}
                            aria-label={`Добавить: ${nameById(pid)}`}
                          >
                            {isPoints ? `+ ${ballValue}` : "+ шар"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    style={{ ...styles.diceBtn, marginTop: "12px", width: "100%" }}
                    disabled={!canUndoGame(activeGame)}
                    onClick={undoLast}
                  >
                    ↶ Отменить последнее действие
                  </button>
                  <div style={styles.gameActions}>
                    <button style={styles.finishBtn} onClick={attemptFinish}>
                      Завершить партию
                    </button>
                    <button style={styles.cancelBtn} onClick={cancelGame}>
                      Отменить партию
                    </button>
                  </div>
                </div>
                );
              })()}

              {activeGame && tieCandidates && (
                <div style={styles.cardFrosted}>
                  <h2 style={styles.h2}>Ничья по шарам</h2>
                  <p style={styles.hint}>Счёт равный — выберите победителя партии вручную</p>
                  <div style={styles.chipRow}>
                    {tieCandidates.map((id) => (
                      <button key={id} style={styles.winBtn} onClick={() => finalizeGame(id)}>
                        🎱 {nameById(id)} ({activeGame.scores[id] || 0})
                      </button>
                    ))}
                  </div>
                  <button style={{ ...styles.cancelBtn, marginTop: "12px" }} onClick={() => setTieCandidates(null)}>
                    Назад к партии
                  </button>
                </div>
              )}
            </section>
          )}

          {tab === "rating" && (
            <section>
              <StatsFilters filters={statsFilter} onChange={setStatsFilter} styles={styles} />

              <div style={styles.card}>
                <h2 style={styles.h2}>Статистика</h2>
                <Suspense fallback={<div style={{ ...styles.hint, textAlign: "center", padding: "40px 0" }}>Загрузка графика…</div>}>
                  <RatingChartPanel
                    trendData={trendData}
                    chartData={chartData}
                    tempoData={tempoData}
                    stats={fStats}
                    players={data.players}
                    dark={dark}
                    hintColor={styles.hint.color}
                    playerColor={playerColor}
                  />
                </Suspense>
              </div>

              <div style={styles.card}>
                <h2 style={styles.h2}>Рейтинг игроков</h2>
                {fStats.length === 0 ? (
                  <EmptyState text="Пока нет данных — сыграйте первую партию" />
                ) : (
                  <>
                    <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
                      {[[false, "По победам"], [true, "По Эло"]].map(([v, label]) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setRatingSortElo(v)}
                          style={{ ...styles.selectChip, padding: "5px 12px", fontSize: "12px", ...(ratingSortElo === v ? styles.selectChipActive : {}) }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <ol style={styles.rankList}>
                      {ranked.map((s, i) => (
                        <li
                          key={s.id}
                          style={{ ...styles.rankItem, cursor: "pointer" }}
                          onClick={() => setProfilePid(s.id)}
                          role="button"
                          aria-label={`Профиль: ${s.name}`}
                        >
                          <span style={styles.rankMedal}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}</span>
                          <span style={styles.rankName}>
                            <PlayerBall color={playerColor(s.id)} /> {s.name}
                          </span>
                          <span style={styles.rankScore}>
                            {s.wins} поб. · {s.winPct}% · Эло {elo[s.id].rating}
                          </span>
                        </li>
                      ))}
                    </ol>
                    <p style={styles.hint}>Нажмите на игрока — откроется его карточка. Эло: старт 1000, учитывает силу соперника.</p>
                  </>
                )}
              </div>

              <div style={styles.card}>
                <h2 style={styles.h2}>Лучшие серии побед</h2>
                {streakLeaders.length === 0 ? (
                  <EmptyState text="Серий побед пока не было" />
                ) : (
                  <ol style={styles.rankList}>
                    {streakLeaders.map((s, i) => (
                      <li key={s.id} style={styles.rankItem}>
                        <span style={styles.rankMedal}>{i + 1}.</span>
                        <span style={styles.rankName}>
                          <PlayerBall color={playerColor(s.id)} /> {s.name}
                        </span>
                        <span style={styles.rankScore}>{s.bestStreak} побед подряд</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div style={styles.card}>
                <h2 style={styles.h2}>Рекорды</h2>
                {!records.fastest && !records.longest && !records.blow && !records.bestBreaker ? (
                  <p style={styles.emptyText}>Сыграйте пару партий вдвоём — рекорды появятся здесь.</p>
                ) : (
                  <div>
                    {records.fastest && (
                      <p style={{ ...styles.hint, margin: "6px 0" }}>
                        ⚡ Самая быстрая победа: <strong>{nameById(records.fastest.winnerId)}</strong> —{" "}
                        {formatDuration(records.fastest.durationMs)}
                      </p>
                    )}
                    {records.longest && (
                      <p style={{ ...styles.hint, margin: "6px 0" }}>
                        🕰️ Самая долгая партия: {formatDuration(records.longest.durationMs)} (
                        {records.longest.participants.map(nameById).join(" и ")})
                      </p>
                    )}
                    {records.blow && records.blowMargin > 0 && (
                      <p style={{ ...styles.hint, margin: "6px 0" }}>
                        💥 Самый крупный разгром: <strong>{nameById(records.blow.winnerId)}</strong> —{" "}
                        {records.blow.participants
                          .map((pid) => (records.blow.scores && records.blow.scores[pid]) || 0)
                          .sort((a, b) => b - a)
                          .join(":")}
                      </p>
                    )}
                    {records.bestBreaker && (
                      <p style={{ ...styles.hint, margin: "6px 0" }}>
                        🎯 Лучший процент разбоя: <strong>{nameById(records.bestBreaker.playerId)}</strong> —{" "}
                        {records.bestBreaker.pct}% ({records.bestBreaker.potted}/{records.bestBreaker.total})
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div style={styles.card}>
                <h2 style={styles.h2}>Достижения</h2>
                {stats.filter((s) => (achievements[s.id] || []).length > 0).length === 0 ? (
                  <EmptyState text="Играйте — значки будут копиться автоматически" />
                ) : (
                  stats
                    .filter((s) => (achievements[s.id] || []).length > 0)
                    .map((s) => (
                      <div key={s.id} style={{ marginBottom: "10px" }}>
                        <p style={{ margin: "0 0 5px", fontWeight: 700, fontSize: "13.5px" }}>
                          <PlayerBall color={playerColor(s.id)} /> {s.name}
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {achievements[s.id].map(([icon, label]) => (
                            <span key={label} style={{ ...styles.playerChip, padding: "4px 10px", fontSize: "12px" }}>
                              {icon} {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                )}
              </div>

              <div style={styles.card}>
                <h2 style={styles.h2}>Личные встречи</h2>
                {data.players.length < 2 ? (
                  <p style={styles.emptyText}>Нужно минимум два игрока.</p>
                ) : (
                  <div>
                    <HeadToHeadMatrix players={data.players} matrix={h2hMatrix} playerColor={playerColor} styles={styles} />
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <select
                        value={h2h.a}
                        onChange={(e) => setH2h((v) => ({ ...v, a: e.target.value }))}
                        style={{ ...styles.input, flex: 1 }}
                      >
                        <option value="">Игрок 1</option>
                        {data.players.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <span style={{ fontWeight: 700 }}>vs</span>
                      <select
                        value={h2h.b}
                        onChange={(e) => setH2h((v) => ({ ...v, b: e.target.value }))}
                        style={{ ...styles.input, flex: 1 }}
                      >
                        <option value="">Игрок 2</option>
                        {data.players.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {h2hStats && (
                      <div style={{ marginTop: "12px", textAlign: "center" }}>
                        {h2hStats.games === 0 ? (
                          <p style={styles.emptyText}>Эти игроки ещё не встречались.</p>
                        ) : (
                          <div>
                            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "30px", fontWeight: 700 }}>
                              {h2hStats.wa} : {h2hStats.wb}
                            </div>
                            <p style={{ ...styles.hint, marginTop: "4px" }}>
                              <PlayerBall color={playerColor(h2h.a)} /> {nameById(h2h.a)} против{" "}
                              <PlayerBall color={playerColor(h2h.b)} /> {nameById(h2h.b)}
                            </p>
                            <p style={styles.hint}>
                              Встреч: {h2hStats.games} · Шары: {h2hStats.ba} — {h2hStats.bb}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={styles.card}>
                <h2 style={styles.h2}>Активность</h2>
                <ActivityCard activity={activity} styles={styles} />
              </div>

              <div style={styles.card}>
                <h2 style={styles.h2}>Итоги {PERIOD_LABELS[statsFilter.period]}</h2>
                <SummaryCard summary={summary} periodLabel={PERIOD_LABELS[statsFilter.period]} styles={styles} />
              </div>

              <div style={styles.card}>
                <h2 style={styles.h2}>Статистика по игрокам</h2>
                {fStats.length === 0 ? (
                  <p style={styles.emptyText}>Сыгранных партий пока нет.</p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Игрок</th>
                          <th style={styles.th}>Игр</th>
                          <th style={styles.th}>Побед</th>
                          <th style={styles.th}>Пораж.</th>
                          <th style={styles.th}>%</th>
                          <th style={styles.th}>Серия</th>
                          <th style={styles.th}>Лучш. серия</th>
                          <th style={styles.th}>Шаров</th>
                          <th style={styles.th}>Ср/игру</th>
                          <th style={styles.th}>Разбоев</th>
                          <th style={styles.th}>% разбоя</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fStats.map((s, i) => (
                          <tr key={s.id} style={i === 0 && s.wins > 0 ? styles.leaderRow : undefined}>
                            <td style={styles.td}>{s.name}</td>
                            <td style={{ ...styles.td, ...styles.mono }}>{s.games}</td>
                            <td style={{ ...styles.td, ...styles.mono }}>{s.wins}</td>
                            <td style={{ ...styles.td, ...styles.mono }}>{s.losses}</td>
                            <td style={{ ...styles.td, ...styles.mono }}>{s.winPct}%</td>
                            <td style={{ ...styles.td, ...styles.mono }}>{s.currentStreak}</td>
                            <td style={{ ...styles.td, ...styles.mono }}>{s.bestStreak}</td>
                            <td style={{ ...styles.td, ...styles.mono }}>{s.totalBalls}</td>
                            <td style={{ ...styles.td, ...styles.mono }}>{s.avgBalls.toFixed(1)}</td>
                            <td style={{ ...styles.td, ...styles.mono }}>{s.breaksCount}</td>
                            <td style={{ ...styles.td, ...styles.mono }}>{s.breaksCount ? `${s.breakPct}%` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {tab === "history" && (
            <>
            <section style={styles.card}>
              <h2 style={styles.h2}>История партий</h2>
              <div style={styles.searchRow} className="no-print">
                <input
                  type="text"
                  placeholder="Поиск по игроку"
                  value={historyNameFilter}
                  onChange={(e) => setHistoryNameFilter(e.target.value)}
                  style={styles.input}
                />
                <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} style={styles.input} />
                {(dateFilter || historyNameFilter) && (
                  <button
                    style={styles.diceBtn}
                    onClick={() => {
                      setDateFilter("");
                      setHistoryNameFilter("");
                    }}
                  >
                    Сбросить
                  </button>
                )}
              </div>
              {filteredHistory.length === 0 ? (
                <EmptyState text="Партий не найдено" />
              ) : (
                <ul style={styles.historyList}>
                  {filteredHistory.map((m) => (
                    <li key={m.id} style={styles.historyItem} onClick={() => setSelectedMatchId(m.id)}>
                      <div>
                        <div style={styles.historyPlayers}>
                          {m.participants.map((pid, i) => (
                            <span key={pid}>
                              <span style={pid === m.winnerId ? styles.winnerName : undefined}>
                                {nameById(pid)} {m.scores ? `(${m.scores[pid] || 0})` : ""}
                                {pid === m.breakerId ? <IconTarget size={11} /> : ""}
                              </span>
                              {i < m.participants.length - 1 ? " · " : ""}
                            </span>
                          ))}
                        </div>
                        <div style={styles.historyDate}>
                          <GameIcon type={m.gameType || "russian"} size={12} />{" "}
                          {new Date(m.date).toLocaleString("ru-RU", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {m.durationMs ? ` · ${formatDuration(m.durationMs)}` : ""}
                          {m.mode && RUSSIAN_MODES[m.mode] ? ` · ${RUSSIAN_MODES[m.mode].alias}` : ""}
                          {m.solo ? " · тренировка" : ""}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMatch(m.id);
                        }}
                        style={styles.deleteBtn}
                        aria-label="Удалить партию"
                        className="no-print"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {(data.trash || []).length > 0 && (
              <TrashCard trash={data.trash} nameById={nameById} onRestore={restoreTrashed} styles={styles} />
            )}
            </>
          )}

          {tab === "settings" && (
            <section>
              <div style={styles.card}>
                <h2 style={styles.h2}>Тип игры</h2>
                <p style={styles.hint}>Выбор влияет на оформление стола и отмечается в каждой партии</p>
                <div style={styles.chipRow}>
                  {Object.entries(GAME_TYPES).map(([key, info]) => (
                    <button
                      key={key}
                      onClick={() => setGameType(key)}
                      style={{
                        ...styles.selectChip,
                        ...((data.gameType || "russian") === key ? styles.selectChipActive : {}),
                      }}
                    >
                      <GameIcon type={key} size={14} /> {info.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.card}>
                <h2 style={styles.h2}>Оформление</h2>
                <div style={styles.settingRow}>
                  <span>🌙 Тёмная тема</span>
                  <button
                    onClick={toggleTheme}
                    role="switch"
                    aria-checked={dark}
                    aria-label="Тёмная тема"
                    style={{ ...styles.switchTrack, ...(dark ? styles.switchTrackOn : {}) }}
                  >
                    <span style={{ ...styles.switchThumb, ...(dark ? styles.switchThumbOn : {}) }} />
                  </button>
                </div>
                <button style={{ ...styles.ghostBtn, marginTop: "10px", padding: 0 }} onClick={() => setShowOnboarding(true)}>
                  ℹ️ Показать обучение ещё раз
                </button>
              </div>

              <div style={styles.card}>
                <h2 style={styles.h2}>Экспорт</h2>
                <p style={styles.hint}>Скачайте историю и статистику таблицей (CSV — открывается в Excel и Google Таблицах), или откройте печать, чтобы сохранить как PDF.</p>
                <div style={styles.settingBtnRow}>
                  <button style={styles.brassBtn} onClick={exportCsv}>
                    📊 Таблица (CSV)
                  </button>
                  <button style={styles.diceBtn} onClick={() => window.print()}>
                    🖨️ PDF (печать)
                  </button>
                </div>
              </div>

              {isCloudConfigured() && (
                <div style={styles.card}>
                  <h2 style={styles.h2}>Общий доступ (клуб)</h2>
                  {!authSession && (
                    <>
                      <p style={styles.hint}>
                        Войдите по email, чтобы создать клуб или присоединиться к нему — тогда партии будут видны всем
                        участникам клуба в реальном времени.
                      </p>
                      <div style={styles.addRow}>
                        <input
                          style={styles.input}
                          type="email"
                          placeholder="Ваш email"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSendMagicLink()}
                          disabled={authStatus === "sent" || authStatus === "verifying"}
                        />
                        <button
                          style={styles.brassBtn}
                          onClick={handleSendMagicLink}
                          disabled={authStatus === "sending" || authStatus === "sent" || authStatus === "verifying"}
                        >
                          {authStatus === "sent" ? "Код отправлен" : "Прислать код"}
                        </button>
                      </div>
                      {(authStatus === "sent" || authStatus === "verifying") && (
                        <>
                          <p style={{ ...styles.hint, color: "#3E9B5C" }}>
                            Проверьте почту — пришёл 6-значный код. Введите его ниже.
                          </p>
                          <div style={styles.addRow}>
                            <input
                              style={styles.input}
                              type="text"
                              inputMode="numeric"
                              placeholder="Код из письма"
                              value={authCode}
                              onChange={(e) => setAuthCode(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleVerifyCode()}
                            />
                            <button style={styles.brassBtn} onClick={handleVerifyCode} disabled={authStatus === "verifying"}>
                              Подтвердить
                            </button>
                          </div>
                        </>
                      )}
                      {authStatus === "error" && <p style={{ ...styles.hint, color: COLORS.danger }}>{authError}</p>}
                      <p style={{ ...styles.hint, margin: "12px 0 6px" }}>или</p>
                      <button style={{ ...styles.diceBtn, width: "100%" }} onClick={handleGoogleSignIn} disabled={authStatus === "sending"}>
                        Войти через Google
                      </button>
                    </>
                  )}
                  {authSession && !club && (
                    <>
                      <p style={styles.hint}>Вы вошли как {authSession.user.email}.</p>
                      {clubError && <p style={{ ...styles.hint, color: COLORS.danger }}>{clubError}</p>}
                      <div style={{ marginTop: "10px" }}>
                        <p style={styles.hint}>Ваше имя в клубе (видно в истории изменений)</p>
                        <input
                          style={{ ...styles.input, width: "100%" }}
                          placeholder="Например, Антон"
                          maxLength={40}
                          value={myName}
                          onChange={(e) => setMyName(e.target.value)}
                        />
                      </div>
                      <div style={{ marginTop: "10px" }}>
                        <p style={styles.hint}>Создать новый клуб</p>
                        <div style={styles.addRow}>
                          <input
                            style={styles.input}
                            placeholder="Название клуба (необязательно)"
                            value={clubNameInput}
                            onChange={(e) => setClubNameInput(e.target.value)}
                          />
                          <button style={styles.brassBtn} onClick={handleCreateClub} disabled={clubBusy}>
                            Создать
                          </button>
                        </div>
                      </div>
                      <div style={{ marginTop: "12px" }}>
                        <p style={styles.hint}>Или присоединиться по коду</p>
                        <div style={styles.addRow}>
                          <input
                            style={styles.input}
                            placeholder="Код клуба"
                            value={clubCodeInput}
                            onChange={(e) => setClubCodeInput(e.target.value.toUpperCase())}
                          />
                          <button style={styles.diceBtn} onClick={handleJoinClub} disabled={clubBusy}>
                            Войти
                          </button>
                        </div>
                      </div>
                      <button style={{ ...styles.ghostBtn, marginTop: "10px" }} onClick={handleSignOut}>
                        Выйти из аккаунта
                      </button>
                    </>
                  )}
                  {authSession && club && (
                    <>
                      <div style={{ ...styles.breakerBanner, textAlign: "left" }}>
                        Клуб: <strong>{club.name}</strong>
                        <div style={{ marginTop: "6px" }}>
                          Код приглашения: <span style={styles.mono}>{club.code}</span>
                        </div>
                        <div style={{ ...styles.addRow, marginTop: "8px" }}>
                          <input
                            style={styles.input}
                            placeholder="Ваше имя в клубе"
                            maxLength={40}
                            value={myName}
                            onChange={(e) => {
                              setMyName(e.target.value);
                              setNameMsg("");
                            }}
                          />
                          <button
                            style={styles.diceBtn}
                            onClick={saveMyClubName}
                            disabled={!myName.trim() || myName.trim() === (clubNameSaved || "")}
                          >
                            Сохранить
                          </button>
                        </div>
                        {nameMsg && <p style={{ ...styles.hint, margin: "4px 0 0" }}>{nameMsg}</p>}
                        {clubNameSaved === "" && !nameMsg && (
                          <p style={{ ...styles.hint, margin: "4px 0 0" }}>Укажите имя — иначе в истории изменений вы будете «участником …»</p>
                        )}
                        <p style={{ ...styles.hint, margin: "6px 0 0" }}>
                          Поделитесь кодом с остальными игроками — им нужно один раз войти по email и ввести этот код.
                        </p>
                      </div>
                      {clubError && <p style={{ ...styles.hint, color: COLORS.danger }}>{clubError}</p>}
                      <div style={styles.settingBtnRow}>
                        <button style={styles.brassBtn} onClick={openClubHistory}>
                          История изменений
                        </button>
                        <button style={styles.diceBtn} onClick={handleLeaveClub} disabled={clubBusy}>
                          Покинуть клуб
                        </button>
                        <button style={styles.ghostBtn} onClick={handleSignOut}>
                          Выйти из аккаунта
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div style={styles.card}>
                <h2 style={styles.h2}>Резервная копия</h2>
                <p style={styles.hint}>Все партии сохраняются автоматически. Дополнительно можно скачать полную копию данных или восстановить её из файла.</p>
                <p style={styles.hint}>
                  {cloudSyncAvailable()
                    ? "☁️ Синхронизация с Telegram Cloud включена — данные не потеряются при смене устройства."
                    : "☁️ Синхронизация с Telegram Cloud недоступна вне Telegram — данные хранятся только на этом устройстве."}
                </p>
                <div style={styles.settingBtnRow}>
                  <button style={styles.brassBtn} onClick={exportBackup}>
                    Скачать копию
                  </button>
                  <label style={{ ...styles.diceBtn, display: "inline-flex", alignItems: "center" }}>
                    Восстановить
                    <input type="file" accept="application/json" onChange={importBackup} style={{ display: "none" }} />
                  </label>
                </div>
                <SafetyCopies copies={safetyCopies} onRestore={restoreSafetyCopy} styles={styles} />
              </div>

              <div style={styles.card}>
                <h2 style={{ ...styles.h2, color: COLORS.danger }}>Опасная зона</h2>
                <button style={styles.resetBtn} onClick={clearAll}>
                  Очистить все данные
                </button>
                <p style={{ ...styles.hint, marginTop: "14px" }}>
                  Удалить приложение с этого устройства полностью: игроков, партии, корзину, резервные копии и вход в аккаунт. Общие
                  данные клуба на сервере не затрагиваются.
                </p>
                <button style={{ ...styles.resetBtn, marginTop: "8px" }} onClick={deleteDeviceData} disabled={wipeBusy}>
                  Удалить мои данные с устройства
                </button>
                {authSession && (
                  <>
                    <p style={{ ...styles.hint, marginTop: "14px" }}>
                      Удалить аккаунт на сервере: выход из всех клубов, удаление клубов, где вы единственный участник.
                    </p>
                    <button style={{ ...styles.resetBtn, marginTop: "8px" }} onClick={deleteAccount} disabled={wipeBusy}>
                      Удалить аккаунт
                    </button>
                  </>
                )}
              </div>
            </section>
          )}
        </main>

        {!immersive && (
          <nav style={styles.bottomNav} className="no-print">
            {[
              ["play", "Игра", <NavCue size={20} />],
              ["rating", "Рейтинг", <NavTrophy size={20} />],
              ["history", "История", <NavClock size={20} />],
              ["settings", "Ещё", <NavGear size={20} />],
            ].map(([key, label, icon]) => (
              <button
                key={key}
                onClick={() => {
                  haptic("light");
                  setTab(key);
                }}
                style={{
                  ...styles.bottomNavBtn,
                  ...(tab === key ? styles.bottomNavBtnActive : {}),
                }}
              >
                <span
                  style={{
                    ...styles.navIcon,
                    animation: tab === key ? "iconPop 0.35s ease" : "none",
                  }}
                >
                  {icon}
                </span>
                {label}
              </button>
            ))}
          </nav>
        )}
          </div>
        )}
      </div>

      <Confetti active={celebrate} />

      {selectedMatch && (
        <div
          style={styles.modalOverlay}
          onClick={() => {
            setSelectedMatchId(null);
            cancelEditMatch();
          }}
          className="no-print"
        >
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.h2}>
              Партия ·{" "}
              {new Date(selectedMatch.date).toLocaleString("ru-RU", {
                day: "2-digit",
                month: "2-digit",
                year: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </h2>
            {editMatchId === selectedMatch.id ? (
              <>
                <div style={styles.modalScores}>
                  {selectedMatch.participants.map((pid) => (
                    <div key={pid} style={styles.modalRow}>
                      <span>
                        <PlayerBall color={playerColor(pid)} size={12} /> {nameById(pid)}
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={editDraft.scores[pid] ?? 0}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            scores: { ...d.scores, [pid]: Math.max(0, Math.floor(Number(e.target.value) || 0)) },
                          }))
                        }
                        onFocus={(e) => e.target.select()}
                        style={{ ...styles.scoreInput, width: "76px" }}
                      />
                    </div>
                  ))}
                </div>
                {!selectedMatch.solo && <p style={styles.modalHint}>Победитель определится автоматически по наибольшему счёту.</p>}
                <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                  <button style={{ ...styles.brassBtn, flex: 1 }} onClick={saveEditMatch}>
                    Сохранить
                  </button>
                  <button style={{ ...styles.cancelBtn, flex: 1 }} onClick={cancelEditMatch}>
                    Отмена
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={styles.modalScores}>
                  {selectedMatch.participants.map((pid) => (
                    <div key={pid} style={styles.modalRow}>
                      <span>
                        {nameById(pid)}
                        {pid === selectedMatch.breakerId ? <IconTarget size={12} /> : ""}
                        {pid === selectedMatch.winnerId ? <IconTrophy size={12} /> : ""}
                      </span>
                      <span style={styles.mono}>{(selectedMatch.scores && selectedMatch.scores[pid]) || 0}</span>
                    </div>
                  ))}
                </div>
                <p style={styles.modalHint}>Начинал: {selectedMatch.breakerId ? nameById(selectedMatch.breakerId) : "не указано"}</p>
                {selectedMatch.breakerId && (
                  <p style={styles.modalHint}>
                    Забил при разборе:{" "}
                    {selectedMatch.breakerPotted === true ? "Да" : selectedMatch.breakerPotted === false ? "Нет" : "не указано"}
                  </p>
                )}
                <p style={styles.modalHint}>
                  {selectedMatch.solo ? "Тип: тренировка (соло)" : `Победитель: ${nameById(selectedMatch.winnerId)}`}
                </p>
                <p style={styles.modalHint}>
                  Дисциплина: <GameIcon type={selectedMatch.gameType || "russian"} size={13} />{" "}
                  {GAME_TYPES[selectedMatch.gameType || "russian"].label}
                  {selectedMatch.mode && RUSSIAN_MODES[selectedMatch.mode]
                    ? ` · ${RUSSIAN_MODES[selectedMatch.mode].name} (${RUSSIAN_MODES[selectedMatch.mode].alias})`
                    : ""}
                </p>
                <p style={styles.modalHint}>Продолжительность: {formatDuration(selectedMatch.durationMs)}</p>
                {(selectedMatch.createdBy || selectedMatch.modifiedBy) && (
                  <p style={styles.modalHint}>
                    {selectedMatch.createdBy ? `Записал(а): ${selectedMatch.createdBy}` : ""}
                    {selectedMatch.modifiedBy && selectedMatch.modifiedAt && selectedMatch.modifiedBy !== selectedMatch.createdBy
                      ? `${selectedMatch.createdBy ? " · " : ""}последнее изменение: ${selectedMatch.modifiedBy}, ${new Date(selectedMatch.modifiedAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
                      : ""}
                  </p>
                )}
                {selectedMatch.settlement && (
                  <>
                    <p style={styles.modalHint}>Круговой расчёт (разница очков между парами):</p>
                    <KolhozTable
                      participants={selectedMatch.participants}
                      settlement={selectedMatch.settlement}
                      nameById={nameById}
                      playerColor={playerColor}
                    />
                  </>
                )}
                <div style={{ display: "flex", gap: "8px", marginTop: "16px" }} className="no-print">
                  <button style={{ ...styles.diceBtnSolid, flex: 1 }} onClick={() => startEditMatch(selectedMatch)}>
                    ✏️ Исправить счёт
                  </button>
                  <button style={{ ...styles.cancelBtn, flex: 1 }} onClick={() => setSelectedMatchId(null)}>
                    Закрыть
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {victory && (
        <div
          className="no-print"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 55,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            textAlign: "center",
            color: "#F3EBDA",
            background: `linear-gradient(180deg, ${
              victory.solo ? COLORS.brass : playerColor(victory.winnerId)
            } 0%, rgba(10,43,32,1) 68%)`,
            animation: "fadeIn 0.3s ease",
          }}
        >
          <div style={{ maxWidth: "380px", width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ lineHeight: 1, filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.35))" }}>
              {victory.solo ? (
                <IconTarget size={60} color="#F8F1DE" />
              ) : (
                <IconTrophy size={60} color="#F8F1DE" />
              )}
            </div>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: "26px", margin: "10px 0 4px", color: "#F8F1DE", textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
              {victory.solo
                ? "Тренировка завершена!"
                : victory.series && victory.series.champion
                ? `${nameById(victory.winnerId)} выиграл матч!`
                : `Победа: ${nameById(victory.winnerId)}!`}
            </h2>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: "46px", fontWeight: 700, margin: "10px 0", textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
              {victory.participants.map((pid) => victory.scores[pid] || 0).join(" : ")}
            </div>
            <p style={{ ...styles.hint, color: "#E7DCC0" }}>
              {victory.participants.map((pid, i) => (
                <span key={pid}>
                  <PlayerBall color={playerColor(pid)} size={12} /> {nameById(pid)}
                  {i < victory.participants.length - 1 ? "  ·  " : ""}
                </span>
              ))}
            </p>
            {victory.durationMs > 0 && <p style={{ ...styles.hint, color: "#E7DCC0" }}>⏱ {formatDuration(victory.durationMs)}</p>}
            {victory.mode && RUSSIAN_MODES[victory.mode] && (
              <p style={{ ...styles.hint, color: "#E7DCC0" }}>
                {RUSSIAN_MODES[victory.mode].name} ({RUSSIAN_MODES[victory.mode].alias})
              </p>
            )}
            {((victory.newRecords && victory.newRecords.length > 0) || (victory.newAchievements && victory.newAchievements.length > 0)) && (
              <div style={styles.achievementBanner} className="tab-fade">
                {victory.newRecords.map((r) => (
                  <div key={r.type} style={styles.achievementRow}>
                    <span style={{ fontSize: "18px" }}>{r.icon}</span>
                    <span>
                      <strong>Новый рекорд!</strong> {r.label}
                    </span>
                  </div>
                ))}
                {victory.newAchievements.map((a, i) => (
                  <div key={i} style={styles.achievementRow}>
                    <span style={{ fontSize: "18px" }}>{a.icon}</span>
                    <span>
                      <strong>Новое достижение!</strong> {nameById(a.playerId)} — {a.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {victory.series && (
              <div style={{ ...styles.breakerBanner, marginTop: "10px" }}>
                🏟️ Матч (Best of {victory.series.bestOf}):{" "}
                <strong>
                  {victory.series.participants
                    .map((pid) => `${nameById(pid)} ${victory.series.wins[pid] || 0}`)
                    .join(" : ")}
                </strong>
                {victory.series.champion && <div style={{ marginTop: "4px" }}>Матч завершён — чемпион определён!</div>}
              </div>
            )}
            {victory.settlement && (
              <div style={{ ...styles.breakerBanner, marginTop: "10px", textAlign: "left" }}>
                🧮 Круговой расчёт (разница очков между парами)
                <KolhozTable
                  participants={victory.participants}
                  settlement={victory.settlement}
                  nameById={nameById}
                  playerColor={playerColor}
                />
              </div>
            )}
            {victory.bracket && (
              <div style={{ ...styles.breakerBanner, marginTop: "10px", borderColor: victory.bracket.isFinal ? "#3E9B5C" : undefined }}>
                <IconTrophy />{" "}
                {victory.bracket.isFinal
                  ? `${nameById(victory.bracket.champion)} — чемпион турнира!`
                  : `${nameById(victory.winnerId)} проходит в следующий раунд турнира`}
              </div>
            )}
            {!victory.solo && (
              <div style={{ ...styles.breakerBanner, marginTop: "10px" }}>
                {victory.breakerId ? (
                  <>
                    <IconTarget /> Разбивал: <strong>{nameById(victory.breakerId)}</strong>
                    <div style={{ marginTop: "8px" }}>Забил шар при разборе?</div>
                    <div style={{ display: "flex", gap: "8px", marginTop: "6px", justifyContent: "center" }}>
                      <button
                        style={{ ...styles.diceBtn, ...(victory.breakerPotted === true ? { background: COLORS.brass, color: "#2C1D08", borderColor: COLORS.brass } : {}) }}
                        onClick={() => setBreakerPotted(true)}
                      >
                        Да
                      </button>
                      <button
                        style={{ ...styles.diceBtn, ...(victory.breakerPotted === false ? { background: COLORS.brass, color: "#2C1D08", borderColor: COLORS.brass } : {}) }}
                        onClick={() => setBreakerPotted(false)}
                      >
                        Нет
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <IconTarget /> Кто разбивал?
                    <div style={{ display: "flex", gap: "8px", marginTop: "8px", justifyContent: "center", flexWrap: "wrap" }}>
                      {victory.participants.map((pid) => (
                        <button key={pid} style={styles.diceBtn} onClick={() => setBreaker(pid)}>
                          {nameById(pid)}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "16px" }}>
              {!victory.bracket && (!victory.series || !victory.series.champion) && !victory.solo && (
                <button style={{ ...styles.brassBtn, width: "100%" }} onClick={() => startRematch(victory.participants)}>
                  🔄 Реванш{victory.series ? " (следующая партия матча)" : ""}
                </button>
              )}
              {victory.solo && (
                <button style={{ ...styles.brassBtn, width: "100%" }} onClick={() => startRematch(victory.participants)}>
                  🔄 Ещё одна тренировка
                </button>
              )}
              <button style={{ ...styles.diceBtn, width: "100%" }} onClick={shareVictory}>
                📤 Поделиться результатом
              </button>
              <button style={{ ...styles.finishBtn, width: "100%" }} onClick={closeVictory}>
                {victory.bracket ? "К турнирной сетке" : "К рейтингу"}
              </button>
            </div>
          </div>
        </div>
      )}

      {clubHistory !== undefined && club && (
        <ClubHistoryModal
          items={clubHistory}
          members={clubMembers}
          myId={authSession && authSession.user ? authSession.user.id : null}
          isCreator={!!(authSession && authSession.user && club.created_by === authSession.user.id)}
          busy={clubHistoryBusy}
          error={clubHistoryError}
          onRestore={restoreClubSnapshot}
          onClose={() => setClubHistory(undefined)}
          styles={styles}
        />
      )}

      {profile && (
        <PlayerProfileModal
          profile={profile}
          name={nameById(profilePid)}
          color={playerColor(profilePid)}
          elo={elo[profilePid]}
          nameById={nameById}
          onClose={() => setProfilePid(null)}
          styles={styles}
        />
      )}

      {rulesOpen && (
        <div style={styles.modalOverlay} onClick={() => setRulesOpen(false)} className="no-print">
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.h2}>Дисциплины русского бильярда</h2>
            {Object.entries(RUSSIAN_MODES).map(([key, m]) => {
              const isOpen = openRuleKey === key;
              return (
                <div key={key} style={{ marginBottom: "8px", borderBottom: `1px solid ${styles.tableBorder || "rgba(128,128,128,0.2)"}` }}>
                  <button
                    onClick={() => setOpenRuleKey(isOpen ? null : key)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      width: "100%",
                      background: "none",
                      border: "none",
                      padding: "8px 0",
                      cursor: "pointer",
                      color: "inherit",
                      font: "inherit",
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: "14px", textAlign: "left" }}>
                      {m.name} ({m.alias}){(data.russianMode || "free") === key ? " · выбрана" : ""}
                    </span>
                    <span style={{ opacity: 0.6, fontSize: "12px" }}>{isOpen ? "▲" : "▾"}</span>
                  </button>
                  {isOpen && (
                    <div style={{ paddingBottom: "10px" }}>
                      {m.rules.map((r, i) => (
                        <p key={i} style={{ ...styles.modalHint, margin: "2px 0" }}>
                          • {r}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <button style={{ ...styles.cancelBtn, marginTop: "8px" }} onClick={() => setRulesOpen(false)}>
              Закрыть
            </button>
          </div>
        </div>
      )}

      {scoreWheelPid && activeGame && (
        <ScoreWheel
          label={`Счёт: ${nameById(scoreWheelPid)}`}
          value={activeGame.scores[scoreWheelPid] || 0}
          onChange={(v) => setScore(scoreWheelPid, v)}
          onClose={() => setScoreWheelPid(null)}
        />
      )}

      {showOnboarding && <Onboarding onFinish={dismissOnboarding} />}
    </div>
  );
}
