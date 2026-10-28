import React from "react";
import { formatRub } from "../gameLogic.js";

// "Сергей → Ване: 2 000 ₽" — who pays whom after a game for money.
export function PaymentsList({ payments, nameById }) {
  if (!payments || !payments.length) return null;
  return (
    <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0 }}>
      {payments.map((p, i) => (
        <li key={i} style={{ display: "flex", justifyContent: "space-between", gap: "10px", padding: "3px 0" }}>
          <span>
            {nameById(p.from)} → {nameById(p.to)}
          </span>
          <strong style={{ fontFamily: "'Space Mono', monospace", whiteSpace: "nowrap" }}>{formatRub(p.amount)}</strong>
        </li>
      ))}
    </ul>
  );
}
