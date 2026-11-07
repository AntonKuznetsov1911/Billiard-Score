import { it, expect } from "vitest";
import { historyDay } from "./designPreferences.js";
it("groups yesterday correctly across the year boundary and handles invalid dates", () => {
  const now = new Date(2027,0,1,12);
  expect(historyDay(new Date(2027,0,1,9),now)).toBe("Сегодня");
  expect(historyDay(new Date(2026,11,31,23),now)).toBe("Вчера");
  expect(historyDay("invalid",now)).toBe("Без даты");
});
