import { describe, it, expect } from "vitest";
import { buildCsv, toCsvTable } from "./csv.js";

describe("csv export", () => {
  it("writes headers and rows with semicolons", () => {
    expect(toCsvTable([{ Игрок: "Антон", Побед: 3 }])).toBe("Игрок;Побед\r\nАнтон;3");
  });
  it("quotes separators, quotes and newlines", () => {
    expect(toCsvTable([{ a: 'x;y "z"\nw' }])).toBe('a\r\n"x;y ""z""\nw"');
  });
  it("neutralises formula injection but keeps negative numbers", () => {
    expect(toCsvTable([{ a: "=HYPERLINK(1)", b: "-5", c: "@x", d: "+1+1" }])).toBe("a;b;c;d\r\n'=HYPERLINK(1);-5;'@x;'+1+1");
  });
  it("joins titled sections with a BOM and skips empty ones", () => {
    const out = buildCsv([
      { title: "История", rows: [{ a: 1 }] },
      { title: "Пусто", rows: [] },
      { title: "Статистика", rows: [{ b: 2 }] },
    ]);
    expect(out).toBe("﻿История\r\na\r\n1\r\n\r\nСтатистика\r\nb\r\n2\r\n");
  });
});
