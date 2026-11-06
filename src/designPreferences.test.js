import { it, expect } from "vitest";
import { readPresets, savePreset, removePreset, historyDay } from "./designPreferences.js";
function storage() { const values = new Map(); return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }; }
it("keeps eight most recent presets, replaces a duplicate and deletes only the chosen preset", () => {
  const s = storage();
  for (let i=0;i<10;i++) savePreset(s, { id: String(i), name: `Состав ${i}`, participants: ["p1","p2"] });
  expect(readPresets(s)).toHaveLength(8);
  savePreset(s, { id:"9", name:"Обновлённый состав", participants:["p1"] });
  expect(readPresets(s)[0].name).toBe("Обновлённый состав");
  expect(removePreset(s,"9")).toHaveLength(7);
  expect(readPresets(s).some(x=>x.id==="8")).toBe(true);
});
it("tolerates missing or malformed preferences, but surfaces a failed save", () => {
  expect(readPresets({ getItem: () => '{bad json' })).toEqual([]);
  expect(readPresets({ getItem: () => '{}' })).toEqual([]);
  expect(readPresets({ getItem() { throw Error(); } })).toEqual([]);
  expect(() => savePreset({ getItem:()=>null, setItem() { throw Error("full"); } }, {id:"1",name:"x",participants:[]})).toThrow("full");
});
it("groups yesterday correctly across the year boundary and handles invalid dates", () => {
  const now = new Date(2027,0,1,12);
  expect(historyDay(new Date(2027,0,1,9),now)).toBe("Сегодня");
  expect(historyDay(new Date(2026,11,31,23),now)).toBe("Вчера");
  expect(historyDay("invalid",now)).toBe("Без даты");
});
