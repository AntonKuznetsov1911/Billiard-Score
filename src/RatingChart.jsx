import React from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList, ResponsiveContainer } from "recharts";

function ChartTooltip({ active, payload, label, dark }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      style={{
        background: dark ? "rgba(24,26,21,0.96)" : "rgba(255,253,248,0.97)",
        border: `1px solid ${dark ? "rgba(255,255,255,0.14)" : "#E3D8BC"}`,
        borderRadius: "10px",
        padding: "8px 12px",
        fontSize: "12px",
        fontFamily: "'Inter', sans-serif",
        color: dark ? "#F1EAD8" : "#1B1712",
        boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: "4px" }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {p.value}
          {String(p.dataKey).includes("%") ? "%" : ""}
        </div>
      ))}
    </div>
  );
}

export default function RatingChart({ chartData, dark, hintColor }) {
  return (
    <div style={{ width: "100%", height: 250 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 14, right: 6, left: -22, bottom: 0 }} barGap={4}>
          <CartesianGrid vertical={false} stroke={dark ? "#ffffff14" : "#00000012"} />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: hintColor, fontWeight: 600 }} />
          <YAxis yAxisId="left" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: hintColor }} />
          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} hide />
          <Tooltip content={<ChartTooltip dark={dark} />} cursor={{ fill: dark ? "#ffffff0a" : "#00000008" }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px", fontWeight: 600, color: hintColor }} />
          <Bar yAxisId="left" dataKey="Победы" fill="#2E8A63" radius={[5, 5, 0, 0]} maxBarSize={26}>
            <LabelList dataKey="Победы" position="top" style={{ fontSize: 10, fontWeight: 700, fill: hintColor }} />
          </Bar>
          <Bar yAxisId="left" dataKey="Поражения" fill="#B5473A" fillOpacity={0.72} radius={[5, 5, 0, 0]} maxBarSize={26} />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="% побед"
            stroke="#C08A3E"
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: "#C08A3E", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
