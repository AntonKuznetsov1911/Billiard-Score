import React, { useEffect, useState } from "react";
import { getClubMembers } from "./clubSync.js";
import { sendFeedback } from "./feedback.js";
import { COLORS } from "./constants.js";

export function ClubTerms({ styles, accepted, onAccept }) {
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  return <div style={{ margin: "12px 0" }}>
    <p style={styles.hint}>В клубе делитесь только данными, которые согласны показать участникам. Оскорбления, угрозы, травля, незаконные материалы и чужие персональные данные без разрешения запрещены.</p>
    <p><a href="club-rules.html" target="_blank" rel="noopener noreferrer" style={{ color: COLORS.brass }}>Правила клубов и рассмотрение жалоб</a></p>
    {accepted ? <p style={styles.hint}>Правила клубов приняты.</p> : <>
      <p style={styles.hint}>До принятия правил отправка и синхронизация клубных данных приостановлены. Счёт на устройстве доступен.</p>
      <label style={styles.hint}><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} /> Я прочитал и принимаю правила клубов</label>
      <button style={{ ...styles.brassBtn, marginTop: "10px" }} disabled={!checked} onClick={() => {
        try { onAccept(); setError(""); } catch { setError("Не удалось сохранить согласие. Проверьте доступ к хранилищу устройства."); }
      }}>Принять правила клубов</button>
    </>}
    {error && <p role="alert" style={styles.hint}>{error}</p>}
  </div>;
}

export function ClubSafetyCard({ club, styles, onBlock }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [subject, setSubject] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    if (open) getClubMembers(club.id).then(data => { if (active) setMembers(data); }).catch(() => {});
    return () => { active = false; };
  }, [open, club.id]);
  async function report() {
    if (reason.trim().length < 3) { setStatus("Опишите, что произошло"); return; }
    setBusy(true); setStatus("");
    try {
      await sendFeedback({ kind: "other", message: `[ЖАЛОБА НА КЛУБ]\nКлуб: ${club.id}\nУчастник: ${subject || "содержимое клуба"}\n${reason.trim()}`, contact: "" });
      setStatus("Жалоба отправлена разработчику. Она не публикуется в клубе. При необходимости скройте клуб кнопкой ниже.");
      setReason("");
    } catch { setStatus("Не удалось отправить жалобу. Текст сохранён в форме. Попробуйте позже или напишите на x9054074040@gmail.com."); }
    finally { setBusy(false); }
  }
  return <div style={{ marginTop: "14px" }}>
    <button style={styles.ghostBtn} onClick={() => setOpen(!open)}>Пожаловаться на содержимое или участника</button>
    {open && <div>
      <p style={styles.hint}>Выберите участника или содержимое клуба. Не включайте пароли и коды входа. Жалобу получит разработчик через защищённую форму и Telegram.</p>
      <select aria-label="На кого жалоба" style={styles.input} value={subject} onChange={e => setSubject(e.target.value)}>
        <option value="">Содержимое клуба</option>
        {members.map((m, i) => <option key={m.user_id} value={m.user_id}>{m.display_name || `Участник ${i + 1}`}</option>)}
      </select>
      <textarea aria-label="Причина жалобы" style={{ ...styles.input, width: "100%", minHeight: 90, marginTop: 8 }} maxLength={1600} value={reason} onChange={e => setReason(e.target.value)} />
      <button style={styles.brassBtn} disabled={busy} onClick={report}>{busy ? "Отправляем…" : "Отправить жалобу"}</button>
      {status && <p role="status" style={styles.hint}>{status}</p>}
    </div>}
    <button style={{ ...styles.ghostBtn, color: COLORS.danger }} onClick={onBlock}>Заблокировать клуб и скрыть его данные</button>
    <p style={styles.hint}>Блокировка выходит из клуба и скрывает весь его общий контент на этом устройстве, включая данные нежелательного участника. Данные других участников на сервере не удаляются.</p>
  </div>;
}
