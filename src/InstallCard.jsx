import React, { useEffect, useState } from "react";
import { canPromptInstall, promptInstall, onInstallChange, isInstalled, deviceKind } from "./install.js";
import { isNativeApp } from "./native.js";
import { COLORS } from "./constants.js";

const STEPS = {
  ios: ["Откройте этот сайт в Safari.", "Нажмите «Поделиться» (квадрат со стрелкой вверх) внизу экрана.", "Выберите «На экран „Домой“» → «Добавить»."],
  android: ["Нажмите ⋮ (меню) в правом верхнем углу Chrome.", "Выберите «Установить приложение» или «Добавить на главный экран».", "Подтвердите — иконка «Бильярд» появится на телефоне."],
  desktop: ["Откройте этот сайт на телефоне — проще всего отправить ссылку себе в мессенджер.", "На компьютере в Chrome или Edge можно нажать значок установки в правой части адресной строки."],
};

// "📲 Установить на телефон" in the «Ещё» tab: one-tap install where the
// browser allows it, short instructions everywhere else, and a share link.
export function InstallCard({ styles }) {
  const [canPrompt, setCanPrompt] = useState(canPromptInstall());
  const [installed, setInstalled] = useState(isInstalled());
  const [msg, setMsg] = useState("");
  const kind = deviceKind();

  useEffect(
    () =>
      onInstallChange(() => {
        setCanPrompt(canPromptInstall());
        setInstalled(isInstalled());
      }),
    []
  );

  if (isNativeApp() || installed) return null;

  const link = window.location.origin + window.location.pathname;

  const install = async () => {
    const ok = await promptInstall();
    setMsg(ok ? "Готово! Иконка «Бильярд» появится на главном экране." : "");
  };

  const share = async () => {
    const text = "🎱 Твой бильярд — учёт партий и статистики. Откройте на телефоне и установите:";
    try {
      if (navigator.share) {
        await navigator.share({ title: "Твой бильярд", text, url: link });
        return;
      }
    } catch (e) {
      return; // closed the share sheet
    }
    try {
      await navigator.clipboard.writeText(`${text} ${link}`);
      setMsg("Ссылка скопирована — отправьте её в мессенджер.");
    } catch (e) {
      setMsg(link);
    }
  };

  return (
    <div style={styles.card}>
      <h2 style={styles.h2}>📲 Установить на телефон</h2>
      <p style={styles.hint}>
        Приложение встанет на главный экран отдельной иконкой, будет открываться на весь экран, работать без интернета и
        обновляться само.
      </p>
      {canPrompt ? (
        <button style={{ ...styles.brassBtn, width: "100%", marginTop: "6px" }} onClick={install}>
          📲 Установить
        </button>
      ) : (
        <ol style={{ ...styles.hint, margin: "6px 0 0", paddingLeft: "20px" }}>
          {STEPS[kind].map((s) => (
            <li key={s} style={{ margin: "4px 0" }}>
              {s}
            </li>
          ))}
        </ol>
      )}
      <button style={{ ...styles.diceBtn, width: "100%", marginTop: "10px" }} onClick={share}>
        📤 Поделиться ссылкой с друзьями
      </button>
      {msg && <p style={{ ...styles.hint, color: COLORS.brass, wordBreak: "break-all" }}>{msg}</p>}
    </div>
  );
}
