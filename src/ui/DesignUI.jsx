import React from "react";

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

export function SettingsIndex({ onOpen, club }) {
  const rows = [["club", "Клуб", club ? club.name : "Совместный счёт и приглашения"], ["appearance", "Вибрация", "Отклик при ведении счёта"], ["data", "Копии и экспорт", "JSON, таблицы, PDF и удаление данных"], ["help", "Помощь и обратная связь", "Обучение, правила и поддержка"], ["about", "О приложении", "Версия и конфиденциальность"]];
  return <div className="settings-index">{rows.map(([key, label, sub]) => <button key={key} onClick={() => onOpen(key)}><span><strong>{label}</strong><small>{sub}</small></span><LineIcon name="arrow" size={18} /></button>)}</div>;
}

