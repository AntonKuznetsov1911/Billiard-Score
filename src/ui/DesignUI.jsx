import React from "react";
import { GAME_TYPES, RUSSIAN_MODES } from "../constants.js";
import russian from "../assets/table-russian.webp";
import pool from "../assets/table-pool.webp";

export function LineIcon({ name, size = 22 }) {
  const paths = {
    play: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3" /></>,
    history: <><path d="M4 7v5h5M4.5 11a8 8 0 1 1 2 6" /><path d="M12 7v5l3 2" /></>,
    rating: <><path d="M4 20V10m8 10V4m8 16v-7M2 20h20" /></>,
    settings: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    arrow: <path d="m9 5 7 7-7 7" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.play}</svg>;
}

export function HomeHub({ data, nameById, onNew, onOpen, onRecent, presets, onPreset, onRemovePreset }) {
  const recent = data.matches?.[0];
  const recentNames = recent?.participants.map(nameById).join(" · ");
  const type = data.gameType || "russian";
  return <>
    <div className="home-hero" style={{ backgroundImage: `linear-gradient(180deg,rgba(5,14,10,.1),rgba(5,14,10,.93)),url(${type === "pool" ? pool : russian})` }}>
      <span className="eyebrow">ТВОЙ БИЛЬЯРД</span>
      <h1>Хорошая партия<br />начинается здесь.</h1>
      <p>{GAME_TYPES[type].label} · {type === "russian" ? RUSSIAN_MODES[data.russianMode || "free"].alias : "Классический пул"}</p>
      <button className="primary-action" onClick={onNew}>Новая партия <span aria-hidden="true">＋</span></button>
    </div>
    {data.activeGames.length > 0 && <div className="hub-section"><div className="section-label">Продолжить · {data.activeGames.length}</div>
      {data.activeGames.map(g => <button className="resume-card" key={g.id} onClick={() => onOpen(g.id)} aria-label={`Открыть партию: ${g.participants.map(nameById).join(", ")}`}>
        <span><span className="live-kicker">● ПАРТИЯ ИДЁТ</span><strong>{g.participants.map(nameById).join(" · ")}</strong></span>
        <b>{g.participants.map(id => g.scores[id] || 0).join(" : ")}</b><LineIcon name="arrow" size={18} />
      </button>)}
    </div>}
    <div className="quick-metrics"><div><strong>{data.players.length}</strong><span>игроков</span></div><div><strong>{data.matches.length}</strong><span>партий</span></div><div><strong>{data.activeGames.length}</strong><span>за столом</span></div></div>
    {recent && <div className="hub-section"><div className="section-label">Недавний состав</div><button className="recent-pair" onClick={() => onRecent(recent)}><span><strong>{recentNames}</strong><small>Тот же состав и дисциплина</small></span><LineIcon name="arrow" /></button></div>}
    {presets.length > 0 && <div className="hub-section"><div className="section-label">Сохранённые партии</div>{presets.map(p => <div className="preset-row" key={p.id}><button onClick={() => onPreset(p)}><strong>{p.name}</strong><small>{p.participants.map(nameById).join(" · ")}</small></button><button aria-label={`Удалить шаблон ${p.name}`} onClick={() => onRemovePreset(p.id)}>×</button></div>)}</div>}
    {!data.players.length && <p className="home-note">Добавьте игроков при создании партии. Счёт и история работают без регистрации и интернета.</p>}
  </>;
}

export function SettingsIndex({ onOpen, club, theme }) {
  const rows = [["club", "Клуб", club ? club.name : "Совместный счёт и приглашения"], ["appearance", "Внешний вид", `${theme === "dark" ? "Тёмная" : "Светлая"} тема · вибрация`], ["data", "Копии и экспорт", "JSON, таблицы, PDF и удаление данных"], ["help", "Помощь и обратная связь", "Обучение, правила и поддержка"], ["about", "О приложении", "Версия, конфиденциальность и дизайн"]];
  return <div className="settings-index">{rows.map(([key, label, sub]) => <button key={key} onClick={() => onOpen(key)}><span><strong>{label}</strong><small>{sub}</small></span><LineIcon name="arrow" size={18} /></button>)}</div>;
}

