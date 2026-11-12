import React, { useEffect, useState, useMemo, useRef } from 'react';
import BilliardsTracker from './BilliardsTracker.jsx';
import { getSession, onAuthChange, getMyClub } from './clubSync.js';
import { workspaceId, workspaceStorage, preserveLegacyClub, restoreLegacyClub } from './workspaceStorage.js';
import { blockedClubs, clubSafetyStorage } from './clubSafety.js';

export default function AccountWorkspace() {
  const [session, setSession] = useState(undefined);
  const [club, setClub] = useState(null);
  const [selectedClub, setSelectedClub] = useState(null);
  const [error, setError] = useState('');
  const [offlineProfile, setOfflineProfile] = useState(false);
  const fallbackRef = useRef(false);
  const explicitSignOut = useRef(false);
  const screenRef = useRef(false);
  const previousUser = useRef(undefined);
  useEffect(() => {
    let alive = true;
    try { preserveLegacyClub(window.localStorage); } catch { setError('Не удалось сохранить данные прежней версии. Освободите место и перезапустите приложение.'); return; }
    let authEvents = 0;
    const offlineCopy = () => {
      if (!alive || explicitSignOut.current || navigator.onLine || previousUser.current !== undefined) return;
      try {
        const identity = JSON.parse(window.localStorage.getItem('billiards-last-account') || 'null');
        if (identity && typeof identity.id === 'string' && typeof identity.email === 'string') {
          fallbackRef.current = true; setOfflineProfile(true);
          previousUser.current = identity.id; setSession({ user: identity });
        } else setSession(null);
      } catch { setSession(null); }
    };
    const apply = next => {
      if (!alive) return;
      if (!next && fallbackRef.current && !explicitSignOut.current && !navigator.onLine) return;
      if (!next && !explicitSignOut.current && !navigator.onLine && previousUser.current === undefined) { offlineCopy(); return; }
      const id = next?.user?.id ?? null;
      if (previousUser.current !== undefined && previousUser.current !== id) screenRef.current = true;
      previousUser.current = id;
      fallbackRef.current = false; setOfflineProfile(false);
      try {
        if (next) {
          explicitSignOut.current = false;
          window.localStorage.setItem('billiards-last-account', JSON.stringify({ id, email: next.user.email || '' }));
        } else window.localStorage.removeItem('billiards-last-account');
      } catch { /* Account data is persisted separately and errors are reported there. */ }
      setSession(next);
    };
    const off = onAuthChange(next => { authEvents++; apply(next); });
    getSession().then(next => { if (!authEvents) apply(next); }).catch(() => { if (alive && !authEvents) { if (!navigator.onLine) offlineCopy(); else setError('Не удалось открыть аккаунт. Перезапустите приложение.'); } });
    const fallbackTimer = setTimeout(offlineCopy, 2000);
    const reconnect = () => getSession().then(apply).catch(() => {});
    window.addEventListener('online', reconnect);
    return () => { alive = false; off(); clearTimeout(fallbackTimer); window.removeEventListener('online', reconnect); };
  }, []);
  const userId = session?.user?.id;
  useEffect(() => {
    let alive = true;
    setClub(null); setSelectedClub(null);
    if (!userId) return () => { alive = false; };
    const preferences = workspaceStorage(window.localStorage, workspaceId(userId));
    try {
      const cached = JSON.parse(preferences.getItem('billiards-known-club') || 'null');
      if (cached && typeof cached.id === 'string' && typeof cached.name === 'string') {
        setClub({ owner: userId, value: cached });
        if (preferences.getItem('billiards-active-club') === cached.id && !blockedClubs(clubSafetyStorage, userId).some(item => item.id === cached.id)) {
          setSelectedClub({ owner: userId, club: cached });
        }
      }
    } catch { /* Cloud membership will recover an unavailable local preference. */ }
    const load = () => getMyClub().then(value => {
      if (!alive || !value) return;
      restoreLegacyClub(window.localStorage, userId, value.id);
      setClub({ owner: userId, value });
      preferences.setItem('billiards-known-club', JSON.stringify(value));
    }).catch(() => {});
    load();
    window.addEventListener('online', load);
    window.addEventListener('focus', load);
    return () => { alive = false; window.removeEventListener('online', load); window.removeEventListener('focus', load); };
  }, [userId]);
  const activeClub = selectedClub && selectedClub.owner === userId ? selectedClub.club : null;
  const id = workspaceId(userId, activeClub?.id);
  const storage = useMemo(() => workspaceStorage(window.localStorage, id), [id]);
  if (error) return <main className="privacy-welcome"><p role="alert">{error}</p></main>;
  if (session === undefined) return <main className="privacy-welcome"><p role="status">Открываем приложение…</p></main>;
  const workspace = {
    id, storage, session, club: activeClub, initialAccount: screenRef.current, offlineProfile,
    beforeSignOut: () => { explicitSignOut.current = true; },
    availableClub: club && club.owner === userId ? club.value : null,
    selectClub: value => {
      if (value && blockedClubs(clubSafetyStorage, userId).some(item => item.id === value.id)) {
        window.alert('Этот клуб заблокирован на устройстве. Сначала снимите блокировку.'); return;
      }
      try {
        const preferences = workspaceStorage(window.localStorage, workspaceId(userId));
        if (value) {
          preferences.setItem('billiards-known-club', JSON.stringify(value));
          preferences.setItem('billiards-active-club', value.id);
        } else {
          preferences.removeItem('billiards-known-club'); preferences.removeItem('billiards-active-club');
        }
      } catch { window.alert('Не удалось сохранить выбор. Проверьте свободное место.'); return; }
      screenRef.current = true; setClub(value ? { owner: userId, value } : null); setSelectedClub(value ? { owner: userId, club: value } : null);
    },
    selectPersonal: () => {
      try { workspaceStorage(window.localStorage, workspaceId(userId)).removeItem('billiards-active-club'); }
      catch { window.alert('Не удалось сохранить выбор. Проверьте свободное место.'); return; }
      screenRef.current = true; setSelectedClub(null);
    },
  };
  return <BilliardsTracker key={id} workspace={workspace} />;
}
