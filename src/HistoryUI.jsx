import React from "react";

const REASONS = {
  shrink: "удалены данные",
  periodic: "обычное изменение",
  before_restore: "перед восстановлением",
};

const fmt = (ts) =>
  new Date(ts).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function TrashCard({ trash, nameById, onRestore, styles }) {
  const items = [...trash].sort((a, b) => b.deletedAt - a.deletedAt);
  return (
    <div style={styles.card}>
      <h2 style={styles.h2}>Корзина ({items.length})</h2>
      {items.length === 0 ? (
        <p style={styles.emptyText}>Удалённые партии попадают сюда, и их можно вернуть.</p>
      ) : (
        <ul style={styles.historyList}>
          {items.map((m) => (
            <li key={m.id} style={{ ...styles.historyItem, cursor: "default" }}>
              <div>
                <div style={styles.historyPlayers}>
                  {m.participants.map((pid) => `${nameById(pid)} ${(m.scores && m.scores[pid]) || 0}`).join(" : ")}
                </div>
                <div style={styles.historyDate}>
                  партия {fmt(m.date)}
                  {m.deletedAt ? ` · удалена ${fmt(m.deletedAt)}` : ""}
                </div>
              </div>
              <button style={styles.diceBtn} onClick={() => onRestore(m.id)}>
                Вернуть
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SafetyCopies({ copies, onRestore, styles }) {
  const reasonText = { auto: "автоматическая", "clear-all": "перед очисткой", "import-backup": "перед загрузкой копии", "before-restore": "перед восстановлением" };
  return (
    <div style={{ marginTop: "12px" }}>
      <p style={styles.hint}>Копии на этом устройстве (до 5, делаются автоматически и перед опасными действиями):</p>
      {copies.length === 0 ? (
        <p style={styles.emptyText}>Пока нет копий.</p>
      ) : (
        <ul style={styles.historyList}>
          {copies.map((c) => (
            <li key={c.ts} style={{ ...styles.historyItem, cursor: "default" }}>
              <div>
                <div style={styles.historyPlayers}>
                  {fmt(c.ts)} · {c.matches} парт., {c.players} игр.
                </div>
                <div style={styles.historyDate}>{reasonText[c.reason] || c.reason}</div>
              </div>
              <button style={styles.diceBtn} onClick={() => onRestore(c)}>
                Вернуть
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ClubHistoryModal({ items, members, myId, isCreator, busy, error, onRestore, onClose, styles }) {
  const who = (uid) => {
    if (!uid) return "неизвестно";
    const m = members.find((x) => x.user_id === uid);
    const name = m && m.display_name ? m.display_name : `участник …${uid.slice(-4)}`;
    return uid === myId ? `${name} (вы)` : name;
  };
  return (
    <div style={styles.modalOverlay} onClick={onClose} className="no-print">
      <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.h2}>История изменений клуба</h2>
        <p style={styles.modalHint}>
          Каждый раз, когда данные клуба заменяются, прежнее состояние сохраняется здесь. Удалить или подменить записи нельзя.
          {isCreator ? " Вы создатель — можете вернуть любое состояние." : " Возвращать состояние может создатель клуба."}
        </p>
        {error && <p style={{ ...styles.modalHint, color: "#B5473A" }}>{error}</p>}
        {items === null ? (
          <p style={styles.modalHint}>Загрузка…</p>
        ) : items.length === 0 ? (
          <p style={styles.modalHint}>Изменений пока не было.</p>
        ) : (
          <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
            {items.map((h) => (
              <div key={h.id} style={{ ...styles.modalRow, alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "13px" }}>
                  <strong>{fmt(h.saved_at)}</strong> — {h.matches_count} парт., {h.players_count} игр.
                  <br />
                  <span style={{ opacity: 0.75, fontSize: "12px" }}>
                    заменил: {who(h.replaced_by)} · {REASONS[h.reason] || h.reason}
                  </span>
                </span>
                {isCreator && (
                  <button style={{ ...styles.diceBtn, padding: "6px 10px", fontSize: "12px" }} disabled={busy} onClick={() => onRestore(h)}>
                    Вернуть
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <button style={{ ...styles.cancelBtn, width: "100%", marginTop: "10px" }} onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
}
