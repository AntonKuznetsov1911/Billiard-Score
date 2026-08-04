import React, { useState } from "react";
import {
  ComposedChart,
  LineChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
  Cell,
  ResponsiveContainer,
} from "recharts";

function glassTooltipStyle(dark) {
  return {
    background: dark ? "rgba(24,26,21,0.92)" : "rgba(255,253,248,0.94)",
    backdropFilter: "blur(14px) saturate(160%)",
    WebkitBackdropFilter: "blur(14px) saturate(160%)",
    border: `1px solid ${dark ? "rgba(255,255,255,0.16)" : "#E3D8BC"}`,
    borderRadius: "12px",
    padding: "9px 13px",
    fontSize: "12px",
    fontFamily: "'Inter', sans-serif",
    color: dark ? "#F1EAD8" : "#1B1712",
    boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
  };
}

function ChartTooltip({ active, payload, label, dark }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={glassTooltipStyle(dark)}>
      <div style={{ fontWeight: 700, marginBottom: "4px", letterSpacing: "0.2px" }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {p.value}
          {String(p.dataKey).includes("%") ? "%" : ""}
        </div>
      ))}
    </div>
  );
}

function TrendTooltip({ active, payload, label, dark }) {
  if (!active || !payload || !payload.length) return null;
  const shown = payload.filter((p) => p.value !== null && p.value !== undefined);
  if (!shown.length) return null;
  return (
    <div style={glassTooltipStyle(dark)}>
      <div style={{ fontWeight: 700, marginBottom: "4px", letterSpacing: "0.2px" }}>{label}</div>
      {shown
        .slice()
        .sort((a, b) => b.value - a.value)
        .map((p) => (
          <div key={p.dataKey} style={{ color: p.color, fontWeight: 600 }}>
            {p.name}: {p.value}%
          </div>
        ))}
    </div>
  );
}

// Primary "form over time" chart — cumulative win rate after every
// head-to-head match, one line per player, in chronological order.
export function WinRateTrendChart({ trendData, players, dark, hintColor, playerColor }) {
  const gridColor = dark ? "#ffffff12" : "#00000010";
  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={trendData} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
          <defs>
            {players.map((p) => (
              <linearGradient key={p.id} id={`trendLine-${p.id}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={playerColor(p.id)} stopOpacity={0.55} />
                <stop offset="100%" stopColor={playerColor(p.id)} stopOpacity={1} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke={gridColor} />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10.5, fill: hintColor, fontWeight: 600 }} />
          <YAxis
            domain={[0, 100]}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: hintColor }}
            tickFormatter={(v) => `${v}%`}
            width={34}
          />
          <Tooltip content={<TrendTooltip dark={dark} />} cursor={{ stroke: hintColor, strokeDasharray: "3 4", strokeOpacity: 0.4 }} />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: "11px", fontWeight: 600, color: hintColor }} />
          {players.map((p) => (
            <Line
              key={p.id}
              type="monotone"
              dataKey={p.name}
              name={p.name}
              stroke={`url(#trendLine-${p.id})`}
              strokeWidth={2.75}
              dot={{ r: 3, fill: playerColor(p.id), strokeWidth: 0 }}
              activeDot={{ r: 5.5 }}
              connectNulls
              isAnimationActive
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Sorted horizontal ranking — quick "who's ahead right now" read at a glance.
export function WinRateBarChart({ stats, dark, hintColor, playerColor }) {
  const data = stats.slice().sort((a, b) => b.winPct - a.winPct);
  const height = Math.max(120, data.length * 40);
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 34, left: 4, bottom: 4 }} barCategoryGap={14}>
          <CartesianGrid horizontal={false} stroke={dark ? "#ffffff12" : "#00000010"} />
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis
            type="category"
            dataKey="name"
            axisLine={false}
            tickLine={false}
            width={84}
            tick={{ fontSize: 12, fill: hintColor, fontWeight: 700 }}
          />
          <Tooltip content={<ChartTooltip dark={dark} />} cursor={{ fill: dark ? "#ffffff0a" : "#00000008" }} />
          <Bar dataKey="winPct" name="% побед" radius={[0, 8, 8, 0]} maxBarSize={22} isAnimationActive>
            {data.map((d) => (
              <Cell key={d.id} fill={playerColor(d.id)} />
            ))}
            <LabelList
              dataKey="winPct"
              position="right"
              formatter={(v) => `${v}%`}
              style={{ fontSize: 11, fontWeight: 700, fill: hintColor }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Secondary compact summary — wins/losses per player plus a win-% line,
// kept from the original design as a supporting snapshot next to the trend.
export function MatchSummaryChart({ chartData, dark, hintColor }) {
  return (
    <div style={{ width: "100%", height: 230 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 14, right: 6, left: -22, bottom: 0 }} barGap={4}>
          <defs>
            <linearGradient id="winsBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3FA579" />
              <stop offset="100%" stopColor="#1F6B49" />
            </linearGradient>
            <linearGradient id="lossesBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D0685A" />
              <stop offset="100%" stopColor="#8F372B" />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={dark ? "#ffffff14" : "#00000012"} />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: hintColor, fontWeight: 600 }} />
          <YAxis yAxisId="left" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: hintColor }} />
          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} hide />
          <Tooltip content={<ChartTooltip dark={dark} />} cursor={{ fill: dark ? "#ffffff0a" : "#00000008" }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px", fontWeight: 600, color: hintColor }} />
          <Bar yAxisId="left" dataKey="Победы" fill="url(#winsBarGrad)" radius={[6, 6, 0, 0]} maxBarSize={26}>
            <LabelList dataKey="Победы" position="top" style={{ fontSize: 10, fontWeight: 700, fill: hintColor }} />
          </Bar>
          <Bar yAxisId="left" dataKey="Поражения" fill="url(#lossesBarGrad)" radius={[6, 6, 0, 0]} maxBarSize={26} />
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

const VIEWS = [
  { key: "trend", label: "Динамика", hint: "Процент побед нарастающим итогом после каждой партии" },
  { key: "bar", label: "Рейтинг", hint: "Текущий % побед по каждому игроку" },
  { key: "summary", label: "Матчи", hint: "Победы, поражения и % побед по партиям" },
];

function segmentStyles(dark) {
  return {
    switch: {
      display: "inline-flex",
      padding: "3px",
      borderRadius: "999px",
      background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
      border: `1px solid ${dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)"}`,
    },
    btn: {
      padding: "7px 14px",
      borderRadius: "999px",
      border: "none",
      background: "transparent",
      color: dark ? "rgba(241,233,210,0.6)" : "rgba(30,26,18,0.55)",
      fontSize: "12px",
      fontWeight: 700,
      letterSpacing: "0.2px",
      cursor: "pointer",
      transition: "background 0.25s ease, color 0.2s ease",
    },
    btnActive: {
      background: "linear-gradient(135deg, #D9A354 0%, #A9701F 100%)",
      color: "#241705",
    },
  };
}

// Single unified rating panel — a segmented switch picks which of the three
// chart views to show, so the Рейтинг tab has one chart window instead of
// three separate cards.
export function RatingChartPanel({ trendData, chartData, stats, players, dark, hintColor, playerColor }) {
  const [view, setView] = useState("trend");
  const st = segmentStyles(dark);
  const active = VIEWS.find((v) => v.key === view);
  const empty = view === "trend" ? trendData.length === 0 : stats.length === 0;

  return (
    <div>
      <div style={st.switch}>
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setView(v.key)}
            style={{ ...st.btn, ...(view === v.key ? st.btnActive : {}) }}
          >
            {v.label}
          </button>
        ))}
      </div>
      <p style={{ fontSize: "12px", fontWeight: 600, color: hintColor, margin: "10px 2px 4px" }}>{active.hint}</p>
      {empty ? (
        <div style={{ textAlign: "center", padding: "40px 0", fontSize: "13px", fontStyle: "italic", color: hintColor }}>
          Сыгранных партий пока нет
        </div>
      ) : (
        <div key={view} className="tab-fade">
          {view === "trend" && (
            <WinRateTrendChart trendData={trendData} players={players} dark={dark} hintColor={hintColor} playerColor={playerColor} />
          )}
          {view === "bar" && <WinRateBarChart stats={stats} dark={dark} hintColor={hintColor} playerColor={playerColor} />}
          {view === "summary" && <MatchSummaryChart chartData={chartData} dark={dark} hintColor={hintColor} />}
        </div>
      )}
    </div>
  );
}
