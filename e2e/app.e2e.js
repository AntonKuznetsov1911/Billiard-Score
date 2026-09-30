import { test, expect } from "@playwright/test";

const KEY = "billiards-club-data";

// Seeds storage before the app loads (skips onboarding).
async function seed(page, data) {
  await page.addInitScript(
    ([key, d]) => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("billiards-onboarding-v1", "1");
      if (d) localStorage.setItem(key, JSON.stringify(d));
    },
    [KEY, data]
  );
}

const players = [
  { id: "p1", name: "Антон", color: "#E4032E" },
  { id: "p2", name: "Игорь", color: "#0057B8" },
];
const base = (extra = {}) => ({ players, matches: [], trash: [], theme: "light", gameType: "russian", russianMode: "free", updatedAt: 1, ...extra });
const stored = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
const scores = (page) => page.locator('[aria-label^="Счёт:"]').allTextContents();

async function openGame(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Русский бильярд" }).click();
}

test("first run: onboarding, add players, play, undo, finish, persists", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Пропустить" }).click();
  await page.getByRole("button", { name: "Русский бильярд" }).click();
  for (const n of ["Антон", "Игорь"]) {
    await page.getByPlaceholder("Имя игрока").fill(n);
    await page.getByPlaceholder("Имя игрока").press("Enter");
  }
  await page.getByRole("button", { name: "Выбрать всех" }).click();
  await page.getByRole("button", { name: "Начать партию" }).click();
  await expect(page.getByText("Партия идёт")).toBeVisible();

  await page.getByRole("button", { name: "Добавить: Антон" }).click();
  // the app merges a duplicate of the same tap within 70ms (touch + click), so
  // separate taps need a human-like gap
  await page.waitForTimeout(120);
  await page.getByRole("button", { name: "Добавить: Антон" }).click();
  await page.getByRole("button", { name: "Добавить: Игорь" }).click();
  const undo = page.getByRole("button", { name: /Отменить последнее действие/ });
  await undo.click();
  await expect.poll(async () => (await stored(page))?.activeGame?.undone?.length).toBe(1);
  const game = (await stored(page)).activeGame;
  expect(Object.values(game.scores).sort()).toEqual([0, 2]);

  await page.reload();
  await expect(page.getByText("Партия идёт")).toBeVisible();

  await page.getByRole("button", { name: "Завершить партию" }).click();
  await expect(page.getByRole("button", { name: /К рейтингу/ })).toBeVisible();
  await page.getByRole("button", { name: /К рейтингу/ }).click();
  await expect.poll(async () => (await stored(page)).matches.length).toBe(1);
  const m = (await stored(page)).matches[0];
  expect(Object.values(m.scores).sort()).toEqual([0, 2]);
});

test("big mode: fast taps all count", async ({ page }) => {
  await seed(page, base());
  await openGame(page);
  await page.getByRole("button", { name: "Выбрать всех" }).click();
  await page.getByRole("button", { name: "Начать партию" }).click();
  await page.getByRole("button", { name: /Крупный режим/ }).click();
  const score = page.locator('[aria-label^="Счёт:"]').first();
  const box = await score.boundingBox();
  for (let i = 0; i < 8; i++) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2 + 60);
  await expect.poll(() => scores(page)).toEqual(["8", "0"]);
  await page.getByRole("button", { name: "↶ Отменить" }).click();
  await expect.poll(() => scores(page)).toEqual(["7", "0"]);
});

test("a game saved by an older version still opens with its score", async ({ page }) => {
  await seed(
    page,
    base({
      activeGame: { id: "g1", participants: ["p1", "p2"], scores: { p1: 5, p2: 3 }, actionLog: [], gameType: "russian", mode: "free", startedAt: new Date().toISOString() },
    })
  );
  await page.goto("/");
  await expect(page.getByText("Партия идёт")).toBeVisible();
  await expect(page.getByRole("button", { name: "Добавить: Антон" })).toBeVisible();
  await expect.poll(() => scores(page)).toEqual(["5", "3"]);
  await expect(page.getByRole("button", { name: /Отменить последнее действие/ })).toBeDisabled();
});

test("deleting a match asks first, goes to trash and can be restored", async ({ page }) => {
  const match = { id: "m1", date: "2024-05-01T10:00:00Z", participants: ["p1", "p2"], scores: { p1: 8, p2: 3 }, winnerId: "p1", gameType: "russian" };
  await seed(page, base({ matches: [match] }));
  await openGame(page);
  await page.locator("nav").getByRole("button", { name: "История" }).click();
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Удалить партию" }).click();
  expect((await stored(page)).matches).toHaveLength(1);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Удалить партию" }).click();
  await expect.poll(async () => (await stored(page)).trash.length).toBe(1);
  await page.getByRole("button", { name: "Вернуть" }).first().click();
  await expect.poll(async () => (await stored(page)).matches.length).toBe(1);
});

test("theme switch and CSV export", async ({ page }) => {
  const match = { id: "m1", date: "2024-05-01T10:00:00Z", participants: ["p1", "p2"], scores: { p1: 8, p2: 3 }, winnerId: "p1", gameType: "russian" };
  await seed(page, base({ matches: [match] }));
  await openGame(page);
  await page.locator("nav").getByRole("button", { name: "Ещё" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Таблица \(CSV\)/ }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  const text = await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString("utf8"));
  expect(text).toContain("Антон");
  expect(text).toContain("История партий");

  const toggle = page.getByRole("switch", { name: "Тёмная тема" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect.poll(async () => (await stored(page)).theme).toBe("dark");
});

test("wipe device data needs the confirmation word", async ({ page }) => {
  await seed(page, base());
  await openGame(page);
  await page.locator("nav").getByRole("button", { name: "Ещё" }).click();
  page.once("dialog", (d) => d.accept("нет"));
  await page.getByRole("button", { name: "Удалить мои данные с устройства" }).click();
  expect((await stored(page)).players).toHaveLength(2);
  page.once("dialog", (d) => d.accept("удалить"));
  await page.getByRole("button", { name: "Удалить мои данные с устройства" }).click();
  await expect(page.getByText("Во что будете играть?")).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("billiards-")))).toEqual([]);
});
