import React from "react";
import { PlayerBall } from "./icons.jsx";

const kolhozCellStyle = {
  border: "1px solid rgba(139,90,52,0.35)",
  padding: "6px 9px",
  textAlign: "center",
  whiteSpace: "nowrap",
  fontSize: "12px",
};

// Order [Антон, Сергей, Ваня] reads "Антон → Ваня → Сергей → Антон":
// each player pots against the previous one, so the chain runs backwards.
export function KolhozChain({ order, nameById, playerColor, size = 13, light = false }) {
  if (!order || order.length < 2) return null;
  const arrow = { opacity: 0.55, margin: "0 5px", fontWeight: 700 };
  const chain = [order[0], ...order.slice(1).reverse()];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", rowGap: "4px", fontSize: `${size}px`, color: light ? "#F3EBDA" : undefined }}>
      {[...chain, chain[0]].map((pid, i) => (
        <React.Fragment key={`${pid}-${i}`}>
          {i > 0 && <span style={arrow}>→</span>}
          <span style={{ whiteSpace: "nowrap", fontWeight: 600, opacity: i === order.length ? 0.6 : 1 }}>
            <PlayerBall color={playerColor(pid)} size={size - 2} /> {nameById(pid)}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

export function KolhozTable({ participants, settlement, nameById, playerColor }) {
  if (!settlement) return null;
  return (
    <div style={{ overflowX: "auto", marginTop: "10px" }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={kolhozCellStyle} />
            {participants.map((pid) => (
              <th key={pid} style={kolhozCellStyle}>
                <PlayerBall color={playerColor(pid)} size={10} /> {nameById(pid)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {participants.map((a) => (
            <tr key={a}>
              <th style={kolhozCellStyle}>
                <PlayerBall color={playerColor(a)} size={10} /> {nameById(a)}
              </th>
              {participants.map((b) => {
                if (a === b) return <td key={b} style={kolhozCellStyle}>—</td>;
                const v = (settlement[a] && settlement[a][b]) || 0;
                return (
                  <td
                    key={b}
                    style={{
                      ...kolhozCellStyle,
                      fontWeight: 700,
                      color: v > 0 ? "#3E9B5C" : v < 0 ? "#B5473A" : undefined,
                    }}
                  >
                    {v > 0 ? `+${v}` : v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
