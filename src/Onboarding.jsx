import React, { useState } from "react";
import { COLORS } from "./constants.js";

const STEPS = [
  {
    icon: "🎱",
    title: "Добро пожаловать!",
    text: "Твой бильярд — учёт партий, счёта и статистики для русского бильярда и пула. Короткий гайд на 5 шагов, или сразу «Пропустить».",
  },
  {
    icon: "👥",
    title: "Добавьте игроков",
    text: "На вкладке «Игра» впишите имена — у каждого будет свой цвет и аватар. Игроков может быть сколько угодно.",
  },
  {
    icon: "🎯",
    title: "Начните партию",
    text: "Выберите дисциплину (Русский бильярд или Pool) вверху экрана, отметьте, кто играет, и нажмите «Начать партию».",
  },
  {
    icon: "🔢",
    title: "Ведите счёт",
    text: "Кнопка «+ шар» добавляет одно очко за раз. Нажмите на само число счёта — откроется колесо, чтобы сразу выставить нужное значение.",
  },
  {
    icon: "📊",
    title: "Рейтинг, история, клуб",
    text: "«Рейтинг» — статистика и графики, «История» — все партии с поиском и фильтром по дате. В «Ещё» можно создать клуб — партии будут видны всем участникам в реальном времени.",
  },
];

export default function Onboarding({ onFinish }) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <button style={styles.skip} onClick={onFinish}>
          Пропустить
        </button>
        <div style={styles.icon}>{current.icon}</div>
        <h2 style={styles.title}>{current.title}</h2>
        <p style={styles.text}>{current.text}</p>
        <div style={styles.dots}>
          {STEPS.map((_, i) => (
            <span key={i} style={{ ...styles.dot, ...(i === step ? styles.dotActive : {}) }} />
          ))}
        </div>
        <div style={styles.actions}>
          {step > 0 && (
            <button style={styles.backBtn} onClick={() => setStep((s) => s - 1)}>
              Назад
            </button>
          )}
          <button style={styles.nextBtn} onClick={() => (isLast ? onFinish() : setStep((s) => s + 1))}>
            {isLast ? "Начать!" : "Далее"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.65)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    zIndex: 70,
  },
  card: {
    position: "relative",
    background: "#1C1D18",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "20px",
    padding: "28px 22px 22px",
    maxWidth: "340px",
    width: "100%",
    textAlign: "center",
    boxShadow: "0 12px 34px rgba(0,0,0,0.5)",
  },
  skip: {
    position: "absolute",
    top: "12px",
    right: "12px",
    background: "transparent",
    border: "none",
    color: "rgba(241,233,210,0.55)",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    padding: "4px 6px",
  },
  icon: { fontSize: "44px", lineHeight: 1, marginBottom: "6px" },
  title: {
    fontFamily: "'Fraunces', serif",
    fontSize: "19px",
    fontWeight: 600,
    color: "#F8E7B8",
    margin: "6px 0 10px",
  },
  text: { fontSize: "13.5px", lineHeight: 1.5, color: "rgba(241,233,210,0.85)", margin: 0 },
  dots: { display: "flex", justifyContent: "center", gap: "6px", margin: "20px 0 18px" },
  dot: { width: "7px", height: "7px", borderRadius: "50%", background: "rgba(255,255,255,0.2)" },
  dotActive: { background: COLORS.brass, width: "18px", borderRadius: "4px" },
  actions: { display: "flex", gap: "8px" },
  backBtn: {
    flex: 1,
    padding: "11px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "transparent",
    color: "rgba(241,233,210,0.85)",
    fontWeight: 600,
    fontSize: "13px",
    cursor: "pointer",
  },
  nextBtn: {
    flex: 2,
    padding: "11px",
    borderRadius: "10px",
    border: "none",
    background: COLORS.brass,
    color: "#2C1D08",
    fontWeight: 700,
    fontSize: "13.5px",
    cursor: "pointer",
  },
};
