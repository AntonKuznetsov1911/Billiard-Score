import React from "react";
import { PlayerBall } from "./icons.jsx";

const kolhozCellStyle = {
  border: "1px solid rgba(139,90,52,0.35)",
  padding: "6px 9px",
  textAlign: "center",
  whiteSpace: "nowrap",
  fontSize: "12px",
};

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
