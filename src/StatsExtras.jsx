import React, { useState } from "react";
import { COLORS, GAME_TYPES, RUSSIAN_MODES } from "./constants.js";
import { formatDuration } from "./gameLogic.js";

const PERIODS = [
  ["all", "Всё время"],
  ["month", "30 дней"],
  ["week", "7 дней"],
];
const GAME_FILTERS = [
  ["all", "Все"],
  ["russian", "Русский"],
  ["pool", "Пул"],
];

export const PERIOD_LABELS = { all: "за всё время", month: "за 30 дней", week: "за 7 дней" };

function Pills({ options, value, onPick, styles }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onPick(key)}
          style={{
            ...styles.selectChip,
            padding: "6px 12px",
            fontSize: "12px",
            ...(value === key ? styles.selectChipActive : {}),
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function StatsFilters({ filters, onChange, styles }) {
  const modeOptions = [["all", "Все режимы"], ...Object.entries(RUSSIAN_MODES).map(([k, m]) => [k, m.name])];
  return (
    <div style={styles.card}>
      <h2 style={styles.h2}>Фильтры</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <Pills options={PERIODS} value={filters.period} onPick={(period) => onChange({ ...filters, period })} styles={styles} />
        <Pills
          options={GAME_FILTERS}
          value={filters.gameType}
          onPick={(gameType) => onChange({ ...filters, gameType, mode: gameType === "pool" ? "all" : filters.mode })}
          styles={styles}
        />
        {filters.gameType !== "pool" && (
          <Pills options={modeOptions} value={filters.mode} onPick={(mode) => onChange({ ...filters, mode })} styles={styles} />
        )}
      </div>
      <p style={styles.hint}>Применяются ко всем разделам ниже, кроме достижений (они за всё время).</p>
    </div>
  );
}

function FormDots({ form }) {
  if (!form.length) return <span style={{ opacity: 0.7 }}>—</span>;
  return (
    <span style={{ display: "inline-flex", gap: "4px" }}>
      {form.map((r, i) => (
        <span
          key={i}
          style={{
            width: "22px",
            height: "22px",
            borderRadius: "6px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "11px",
            fontWeight: 800,
            color: "#fff",
            background: r === "W" ? "#2F9E63" : "#B5473A",
          }}
        >
          {r === "W" ? "В" : "П"}
        </span>
      ))}
    </span>
  );
}

export function PlayerProfileModal({ profile, name, color, elo, nameById, onClose, styles }) {
  const row = (label, value) => (
    <div style={styles.modalRow}>
      <span>{label}</span>
      <span style={styles.mono}>{value}</span>
    </div>
  );
  const pct = (b) => (b.games ? `${b.wins}/${b.games} · ${Math.round((b.wins / b.games) * 100)}%` : "—");
  const rel = (r) => (r ? `${nameById(r.id)} (${r.wins}:${r.losses})` : "—");
  return (
    <div style={styles.modalOverlay} onClick={onClose} className="no-print">
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.h2}>
          <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: "50%", background: color, marginRight: 8 }} />
          {name}
        </h2>
        <div style={{ margin: "4px 0 10px" }}>
          <div style={{ fontSize: "12.5px", marginBottom: "6px" }}>Форма (последние 5)</div>
          <FormDots form={profile.form} />
        </div>
        <div style={styles.modalScores}>
          {row("Рейтинг Эло", elo ? elo.rating : "—")}
          {row("Партий / побед", `${profile.games} / ${profile.wins}`)}
          {row("Ср. счёт (свой : соперника)", `${profile.avgOwn.toFixed(1)} : ${profile.avgOpp.toFixed(1)}`)}
          {row("Любимая дисциплина", profile.favoriteGameType ? GAME_TYPES[profile.favoriteGameType].label : "—")}
          {row("Время за столом", profile.totalDurationMs ? formatDuration(profile.totalDurationMs) : "—")}
          {row("Любимый соперник", rel(profile.victim))}
          {row("Кошмар", rel(profile.nemesis))}
          {row("Побед, когда разбивал сам", pct(profile.breaking.asBreaker))}
          {row("Побед, когда разбивал соперник", pct(profile.breaking.other))}
        </div>
        <button style={{ ...styles.cancelBtn, width: "100%", marginTop: "10px" }} onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
}

export function HeadToHeadMatrix({ players, matrix, playerColor, styles }) {
  if (players.length < 2) return null;
  const cell = { padding: "7px 4px", textAlign: "center", fontSize: "12.5px", borderBottom: "1px solid rgba(128,128,128,0.2)" };
  return (
    <div style={{ overflowX: "auto", marginBottom: "12px" }}>
      <table style={{ ...styles.table, minWidth: "260px" }}>
        <thead>
          <tr>
            <th style={styles.th} />
            {players.map((p) => (
              <th key={p.id} style={{ ...styles.th, textAlign: "center" }}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: playerColor(p.id), marginRight: 4 }} />
                {p.name.slice(0, 6)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((a) => (
            <tr key={a.id}>
              <td style={{ ...styles.td, fontWeight: 700 }}>{a.name.slice(0, 8)}</td>
              {players.map((b) => {
                if (a.id === b.id) return <td key={b.id} style={{ ...cell, opacity: 0.4 }}>—</td>;
                const r = matrix[a.id][b.id];
                const total = r.wins + r.losses;
                const bg = !total
                  ? "transparent"
                  : r.wins > r.losses
                  ? "rgba(47,158,99,0.32)"
                  : r.wins < r.losses
                  ? "rgba(181,71,58,0.32)"
                  : "rgba(192,138,62,0.28)";
                return (
                  <td key={b.id} style={{ ...cell, ...styles.mono, background: bg }}>
                    {total ? `${r.wins}:${r.losses}` : "·"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p style={styles.hint}>Строка против столбца: побед : поражений. Зелёный — строка обыгрывает столбец.</p>
    </div>
  );
}

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const PARTS = [
  ["morning", "Утро"],
  ["day", "День"],
  ["evening", "Вечер"],
  ["night", "Ночь"],
];

function BarRow({ label, value, max }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "3px 0", fontSize: "12px" }}>
      <span style={{ width: "34px" }}>{label}</span>
      <div style={{ flex: 1, height: "9px", borderRadius: "5px", background: "rgba(128,128,128,0.22)", overflow: "hidden" }}>
        <div style={{ width: max ? `${(value / max) * 100}%` : 0, height: "100%", background: COLORS.brass, borderRadius: "5px" }} />
      </div>
      <span style={{ width: "22px", textAlign: "right", fontFamily: "'Space Mono', monospace" }}>{value}</span>
    </div>
  );
}

export function ActivityCard({ activity, styles }) {
  if (!activity.games) return <p style={styles.emptyText}>Пока нет партий за выбранный период.</p>;
  const maxDay = Math.max(1, ...activity.weekday);
  const parts = PARTS.map(([k, l]) => [l, activity.dayPart[k]]);
  const maxPart = Math.max(1, ...parts.map((x) => x[1]));
  const maxCell = Math.max(1, ...activity.weeks.flat().map((c) => c.count || 0));
  return (
    <div>
      <p style={{ margin: "0 0 8px", fontSize: "13px" }}>
        Партий: <strong>{activity.games}</strong> · за столом:{" "}
        <strong>{activity.totalDurationMs ? formatDuration(activity.totalDurationMs) : "—"}</strong>
      </p>
      <div style={{ display: "flex", gap: "3px", marginBottom: "12px", maxWidth: "290px" }} aria-label="Календарь активности, последние 10 недель">
        {activity.weeks.map((col, wi) => (
          <div key={wi} style={{ display: "flex", flexDirection: "column", gap: "3px", flex: 1 }}>
            {col.map((c, di) => (
              <div
                key={di}
                title={new Date(c.date).toLocaleDateString("ru-RU") + (c.count ? `: ${c.count}` : "")}
                style={{
                  aspectRatio: "1 / 1",
                  borderRadius: "3px",
                  background:
                    c.count === null
                      ? "transparent"
                      : c.count === 0
                      ? "rgba(128,128,128,0.2)"
                      : `rgba(192,138,62,${0.35 + 0.65 * (c.count / maxCell)})`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <p style={{ ...styles.hint, margin: "0 0 4px" }}>По дням недели</p>
      {WEEKDAYS.map((d, i) => (
        <BarRow key={d} label={d} value={activity.weekday[i]} max={maxDay} />
      ))}
      <p style={{ ...styles.hint, margin: "10px 0 4px" }}>По времени суток</p>
      {parts.map(([l, v]) => (
        <BarRow key={l} label={l} value={v} max={maxPart} />
      ))}
    </div>
  );
}

// 1080x1350 PNG with the period's headline numbers.
export function renderSummaryImage(summary, periodLabel) {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#16352A");
  bg.addColorStop(1, "#0A1A14");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.textAlign = "center";
  g.fillStyle = "#D9A354";
  g.font = "700 64px Georgia, serif";
  g.fillText("Твой бильярд", W / 2, 150);
  g.fillStyle = "#E3D9BC";
  g.font = "500 40px sans-serif";
  g.fillText(`Итоги ${periodLabel}`, W / 2, 215);

  const rows = [["Партий", String(summary.games)]];
  if (summary.durationMs) rows.push(["За столом", formatDuration(summary.durationMs)]);
  if (summary.mvp) rows.push(["Лучший игрок", `${summary.mvp.name} · ${summary.mvp.wins} поб.`]);
  if (summary.streak) rows.push(["Серия побед", `${summary.streak.name} · ${summary.streak.value}`]);
  if (summary.balls) rows.push(["Больше всех шаров", `${summary.balls.name} · ${summary.balls.value}`]);
  if (summary.blowMargin) rows.push(["Крупнейший разгром", `с разницей ${summary.blowMargin}`]);
  const top = 330;
  const step = Math.min(160, (H - top - 150) / rows.length);
  rows.forEach(([label, value], i) => {
    const y = top + i * step;
    g.fillStyle = "rgba(255,255,255,0.07)";
    g.fillRect(80, y - 70, W - 160, step - 24);
    g.fillStyle = "#E3D9BC";
    g.font = "500 34px sans-serif";
    g.fillText(label, W / 2, y - 18);
    g.fillStyle = "#FDF6E3";
    g.font = "700 52px Georgia, serif";
    g.fillText(value, W / 2, y + 36);
  });
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export function SummaryCard({ summary, periodLabel, styles }) {
  const [busy, setBusy] = useState(false);
  if (!summary) return <p style={styles.emptyText}>Пока нет партий за выбранный период.</p>;
  const share = async () => {
    setBusy(true);
    try {
      const blob = await renderSummaryImage(summary, periodLabel);
      const file = new File([blob], "billiards-summary.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: `🎱 Итоги ${periodLabel}` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "billiards-summary.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
    } catch (e) {
      // user cancelled the share sheet — nothing to do
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <p style={{ margin: "0 0 4px", fontSize: "13px" }}>
        🎱 Партий: <strong>{summary.games}</strong>
        {summary.durationMs ? <> · за столом: <strong>{formatDuration(summary.durationMs)}</strong></> : null}
      </p>
      {summary.mvp && (
        <p style={{ margin: "4px 0", fontSize: "13px" }}>
          🏆 Лучший: <strong>{summary.mvp.name}</strong> — {summary.mvp.wins} поб.
        </p>
      )}
      {summary.streak && (
        <p style={{ margin: "4px 0", fontSize: "13px" }}>
          🔥 Серия: <strong>{summary.streak.name}</strong> — {summary.streak.value} подряд
        </p>
      )}
      {summary.balls && (
        <p style={{ margin: "4px 0", fontSize: "13px" }}>
          🎯 Шаров: <strong>{summary.balls.name}</strong> — {summary.balls.value}
        </p>
      )}
      {summary.blowMargin > 0 && (
        <p style={{ margin: "4px 0", fontSize: "13px" }}>💥 Крупнейший разгром: разница {summary.blowMargin}</p>
      )}
      <button style={{ ...styles.brassBtn, width: "100%", marginTop: "10px" }} onClick={share} disabled={busy}>
        📤 Поделиться картинкой
      </button>
    </div>
  );
}
