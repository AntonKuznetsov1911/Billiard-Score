import React, { useState } from "react";
import privacyDocument from "../public/privacy.html?raw";
import "./privacyWelcome.css";

export const PRIVACY_KEY = "billiards-privacy-acknowledged";
export const PRIVACY_VERSION = "2026-11-12";
// Trusted, bundled policy only; never insert user or server content here.
const policyText = privacyDocument.match(/<main>([\s\S]*?)<\/main>/)[1]
  .replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');

export default function PrivacyWelcome({ children }) {
  const [accepted, setAccepted] = useState(() => {
    try { return localStorage.getItem(PRIVACY_KEY) === PRIVACY_VERSION; }
    catch { return false; }
  });
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");

  function continueToApp() {
    if (!checked) return;
    try {
      localStorage.setItem(PRIVACY_KEY, PRIVACY_VERSION);
      setAccepted(true);
    } catch {
      setError("Не удалось сохранить подтверждение. Разрешите хранение данных приложения и попробуйте снова.");
    }
  }

  if (accepted) return children;
  return (
    <main className="privacy-welcome">
      <section className="privacy-welcome-card" aria-labelledby="privacy-heading">
        <p className="privacy-welcome-brand">ТВОЙ БИЛЬЯРД</p>
        <h1 id="privacy-heading">Конфиденциальность</h1>
        <p>Перед началом ознакомьтесь с тем, какие данные хранит приложение и как их удалить.</p>
        <div className="privacy-welcome-document" role="region" aria-label="Политика конфиденциальности" tabIndex={0} dangerouslySetInnerHTML={{ __html: policyText }} />
        <label className="privacy-welcome-check">
          <input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} />
          <span>Я ознакомился с политикой конфиденциальности</span>
        </label>
        <button type="button" disabled={!checked} onClick={continueToApp}>Продолжить</button>
        {error && <p role="alert">{error}</p>}
        <small>Политику всегда можно открыть в разделе «Ещё».</small>
      </section>
    </main>
  );
}
