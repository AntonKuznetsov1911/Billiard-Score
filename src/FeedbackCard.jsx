import React, { useState } from "react";
import { FEEDBACK_KINDS, sendFeedback, feedbackIssueUrl } from "./feedback.js";
import { isCloudConfigured } from "./supabaseClient.js";
import { COLORS } from "./constants.js";

// "Предложения и ошибки": any user can report a bug or suggest an improvement.
export function FeedbackCard({ styles }) {
  const [kind, setKind] = useState("idea");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | offline | error
  const [error, setError] = useState("");
  const online = isCloudConfigured();

  const submit = async () => {
    setError("");
    if (message.trim().length < 3) {
      setStatus("error");
      setError("Напишите хотя бы пару слов");
      return;
    }
    if (!online) {
      setStatus("offline");
      return;
    }
    setStatus("sending");
    try {
      await sendFeedback({ kind, message, contact });
      setStatus("sent");
      setMessage("");
    } catch (e) {
      if (e.message === "offline") setStatus("offline");
      else {
        setStatus("error");
        setError(e.message);
      }
    }
  };

  return (
    <div style={styles.card}>
      <h2 style={styles.h2}>💬 Предложения и ошибки</h2>
      <p style={styles.hint}>Нашли ошибку или есть идея, как сделать приложение лучше? Напишите — мы читаем всё.</p>
      <div style={styles.chipRow} role="radiogroup" aria-label="Тип сообщения">
        {Object.entries(FEEDBACK_KINDS).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={kind === key}
            onClick={() => setKind(key)}
            style={{ ...styles.selectChip, ...(kind === key ? styles.selectChipActive : {}) }}
          >
            {label}
          </button>
        ))}
      </div>
      <textarea
        style={{ ...styles.input, width: "100%", minHeight: "96px", marginTop: "10px", resize: "vertical", fontFamily: "inherit" }}
        placeholder={kind === "bug" ? "Что случилось и что вы делали перед этим?" : "Что бы вы добавили или изменили?"}
        aria-label="Текст сообщения"
        maxLength={2000}
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
          if (status !== "sending") setStatus("idle");
        }}
      />
      <input
        style={{ ...styles.input, width: "100%", marginTop: "8px" }}
        placeholder="Как с вами связаться (необязательно)"
        aria-label="Контакт"
        maxLength={100}
        value={contact}
        onChange={(e) => setContact(e.target.value)}
      />
      <button style={{ ...styles.brassBtn, width: "100%", marginTop: "10px" }} onClick={submit} disabled={status === "sending"}>
        {status === "sending" ? "Отправляем…" : "Отправить"}
      </button>
      {status === "sent" && <p style={{ ...styles.hint, color: "#3E9B5C" }}>Спасибо! Сообщение отправлено.</p>}
      {status === "error" && <p style={{ ...styles.hint, color: COLORS.danger }}>{error}</p>}
      {status === "offline" && (
        <p style={styles.hint}>
          Не получилось связаться с сервером.{" "}
          <a href={feedbackIssueUrl({ kind, message, contact })} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.brass, fontWeight: 700 }}>
            Отправить через GitHub
          </a>{" "}
          или попробуйте позже.
        </p>
      )}
    </div>
  );
}
