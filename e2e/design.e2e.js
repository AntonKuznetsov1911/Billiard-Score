import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const players = [{ id:"p1",name:"Антон",color:"#E4032E" },{ id:"p2",name:"Игорь",color:"#0057B8" },{id:"p3",name:"Алексей",color:"#C08A3E"}];
const base = extra => ({ players, matches:[],trash:[],activeGames:[],theme:"dark",gameType:"russian",russianMode:"free",updatedAt:1,...extra });
async function seed(page, data=base()) {
  await page.addInitScript(data => {
    if (sessionStorage.getItem("modern-seeded")) return;
    sessionStorage.setItem("modern-seeded","1");
    localStorage.setItem("billiards-onboarding-v1","1");
    localStorage.setItem("billiards-last-discipline",data.gameType || "russian");
    localStorage.setItem("billiards-club-data",JSON.stringify(data));
    Object.defineProperty(navigator,"canShare",{ configurable:true,value:()=>false });
  },data);
}
const stored = page => page.evaluate(()=>JSON.parse(localStorage.getItem("billiards-club-data")));
async function open(page) { await page.goto("/"); await expect(page.getByPlaceholder("Имя игрока")).toBeVisible(); }
async function setupPair(page) {
  await page.getByRole("button",{name:"Антон",exact:true}).click();
  await page.getByRole("button",{name:"Игорь",exact:true}).click();
}
async function more(page, name) {
  await page.locator("nav").getByRole("button",{name:"Ещё",exact:true}).click();
  await page.getByRole("button",{name:new RegExp(name)}).click();
}

test("modern pair: quick setup, big score, undo, finish and an actual PNG result", async ({page}) => {
  await seed(page); await open(page); await setupPair(page);
  await page.getByRole("button",{name:"Начать партию",exact:true}).click();
  await expect(page.locator(".fs-overlay")).toBeVisible();
  await page.locator('[aria-label="Счёт: Антон"]').click();
  await page.locator('[aria-label="Счёт: Антон"]').click();
  await expect(page.locator('[aria-label="Счёт: Антон"]')).toHaveText("2");
  await page.getByRole("button",{name:"↶ Отменить",exact:true}).click();
  await expect(page.locator('[aria-label="Счёт: Антон"]')).toHaveText("1");
  await page.getByRole("button",{name:"Завершить",exact:true}).click();
  await expect.poll(async()=>(await stored(page)).matches.length).toBe(1);
  await page.getByRole("button",{name:"Карточка результата",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"Карточка результата"})).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button",{name:"Сохранить или отправить"}).click();
  const bytes = await readFile(await (await download).path());
  expect([...bytes.subarray(0,8)]).toEqual([137,80,78,71,13,10,26,10]);
  expect(bytes.length).toBeGreaterThan(1000);
});

test("a saved setup survives reload and restores the discipline, players and match options", async ({page}) => {
  await seed(page); await open(page); await setupPair(page);
  await page.getByRole("button",{name:"Сохранить настройки партии"}).click();
  await page.getByLabel("Название шаблона").fill("Вечерняя американка");
  await page.getByRole("button",{name:"Сохранить шаблон",exact:true}).click();
  await page.reload();
  await page.getByText("Недавний состав и шаблоны",{exact:true}).click();
  await page.getByRole("button",{name:/^Вечерняя американка/}).click();
  await expect(page.getByRole("button",{name:"Антон",exact:true})).toHaveAttribute("aria-pressed","true");
  await expect(page.getByRole("button",{name:"Игорь",exact:true})).toHaveAttribute("aria-pressed","true");
  await expect(page.getByRole("button",{name:"Начать партию",exact:true})).toBeEnabled();
});

test("modern history is grouped and destructive actions stay in a menu with a trash recovery", async ({page}) => {
  const match={id:"m1",date:new Date().toISOString(),participants:["p1","p2"],scores:{p1:8,p2:3},winnerId:"p1",gameType:"russian",breakerId:"p1",breakerPotted:true};
  await seed(page,base({matches:[match]})); await open(page);
  await page.locator("nav").getByRole("button",{name:"История",exact:true}).click();
  await expect(page.locator(".history-day")).toHaveText("Сегодня");
  await expect(page.locator(".history-score")).toHaveText("8 : 3");
  await expect(page.locator(".break-mark")).toHaveAttribute("data-break","yes");
  await expect(page.getByRole("button",{name:"Удалить партию",exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Действия с партией"}).click();
  page.once("dialog",dialog=>dialog.accept());
  await page.getByRole("button",{name:"Удалить партию",exact:true}).click();
  await expect.poll(async()=>(await stored(page)).trash.length).toBe(1);
  await page.getByRole("button",{name:"Вернуть",exact:true}).click();
  await expect.poll(async()=>(await stored(page)).matches.length).toBe(1);
});

test("settings have focused pages, haptic preferences, and a valid JSON export", async ({page}) => {
  await seed(page); await open(page); await more(page,"Вибрация");
  await expect(page.locator(".modern-app")).toHaveAttribute("data-theme","dark");
  await page.getByRole("button",{name:"Включена",exact:true}).click();
  await expect(page.getByRole("button",{name:"Выключена",exact:true})).toHaveAttribute("aria-pressed","false");
  await more(page,"Копии и экспорт");
  await expect(page.getByText("Общий доступ (клуб)",{exact:true})).toHaveCount(0);
  const download=page.waitForEvent("download");
  await page.getByRole("button",{name:"Скачать копию",exact:true}).click();
  const data=JSON.parse(await readFile(await(await download).path(),"utf8"));
  expect(data.players).toHaveLength(3); expect(data).not.toHaveProperty("access_token");
});

test("statistical summaries and detailed views remain available without a long dashboard", async ({page}) => {
  const match={id:"m1",date:new Date().toISOString(),participants:["p1","p2"],scores:{p1:8,p2:3},winnerId:"p1",gameType:"russian"};
  await seed(page,base({matches:[match]})); await open(page);
  await page.locator("nav").getByRole("button",{name:"Статистика",exact:true}).click();
  await expect(page.getByRole("button",{name:"Игроки",exact:true})).toHaveAttribute("aria-pressed","true");
  await page.getByRole("button",{name:"Игроки",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Рейтинг игроков",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Графики",exact:true}).click();
  await expect(page.getByRole("button",{name:"Рейтинг",exact:true})).toHaveAttribute("aria-pressed","true");
  await page.getByRole("button",{name:"Динамика",exact:true}).click();
  await expect(page.getByText("Процент побед",{exact:false})).toBeVisible();
  await page.getByRole("button",{name:"Рекорды",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Достижения",exact:true})).toBeVisible();
});

test("kolhoz stays functional in the new setup and an ordinary score view", async ({page}) => {
  await seed(page); await open(page);
  await page.getByRole("button",{name:"Колхоз",exact:true}).click();
  for(const name of ["Антон","Игорь","Алексей"]) await page.getByRole("button",{name,exact:true}).click();
  await page.getByRole("button",{name:"Начать партию",exact:true}).click();
  await page.getByRole("button",{name:"Добавить: Антон",exact:true}).click();
  await expect.poll(async()=>(await stored(page)).activeGames[0]?.scores.p1).toBe(1);
  await expect(page.getByRole("button",{name:/Смена позиций/})).toBeVisible();
});

test("club login and policy controls are still reachable from the club page", async ({page}) => {
  await seed(page);
  await page.route("https://*.supabase.co/auth/v1/token?grant_type=password",route=>route.fulfill({status:400,contentType:"application/json",body:JSON.stringify({error:"invalid_grant",error_description:"Invalid login credentials"})}));
  await open(page); await more(page,"^Клуб");
  await page.getByText("Вход по паролю",{exact:true}).click();
  await page.getByPlaceholder("Ваш email").fill("review-test@example.com");
  await page.getByLabel("Пароль аккаунта").fill("test-password-only");
  await page.getByRole("button",{name:"Войти по паролю",exact:true}).click();
  await expect(page.getByText("Не удалось войти. Проверьте email и пароль.")).toBeVisible();
});

test("modern first launch leads to player setup and remembers the chosen discipline", async ({page}) => {
  await page.goto("/");
  await page.getByRole("button",{name:"Пропустить",exact:true}).click();
  await page.getByRole("button",{name:"Русский бильярд",exact:true}).click();
  for(const name of ["Антон","Игорь"]) {
    await page.getByPlaceholder("Имя игрока").fill(name);
    await page.getByPlaceholder("Имя игрока").press("Enter");
  }
  await page.getByRole("button",{name:"Выбрать всех",exact:true}).click();
  await page.getByRole("button",{name:"Начать партию",exact:true}).click();
  await expect(page.locator(".fs-overlay")).toBeVisible();
  await expect.poll(async()=>(await stored(page))?.activeGames?.length).toBe(1);
  await page.reload();
  await expect(page.locator(".fs-overlay")).toBeVisible();
});

test("mobile layouts: both disciplines, fixed palettes and focused pages fit the screen", async({page})=>{
  const match={id:"m1",date:new Date().toISOString(),participants:["p1","p2"],scores:{p1:8,p2:3},winnerId:"p1",gameType:"russian"};
  await seed(page,base({matches:[{...match,breakerId:"p1",breakerPotted:true},{...match,id:"m2",breakerId:"p2",breakerPotted:false},{...match,id:"m3",breakerId:"p1",breakerPotted:null}]})); await open(page);
  for(const [i,label] of ["Игра","История","Статистика","Ещё"].entries()) await expect(page.locator("nav button").nth(i)).toHaveAccessibleName(label);
  const shot=async name=>{
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    if(process.env.DESIGN_SCREENSHOT_DIR) await page.screenshot({path:`${process.env.DESIGN_SCREENSHOT_DIR}/${name}.png`,fullPage:true,animations:"disabled"});
  };
  await expect(page.locator(".modern-app")).toHaveAttribute("data-theme","light"); await shot("01-home-russian");
  await page.getByRole("tab",{name:/Pool/}).click(); await shot("02-home-pool");
  await page.getByRole("tab",{name:"Русский",exact:true}).click();
  await setupPair(page); await shot("03-setup");
  await page.getByRole("button",{name:"Начать партию",exact:true}).click(); await shot("04-score");
  await expect(page.locator(".fs-zones")).toHaveCSS("flex-direction","column");
  await page.setViewportSize({width:850,height:393});
  await expect(page.locator(".fs-zones")).toHaveCSS("flex-direction","row");
  await shot("04-score-landscape");
  await page.setViewportSize({width:393,height:851});
  await page.getByRole("button",{name:"▣ Обычный",exact:true}).click();
  await page.locator("nav").getByRole("button",{name:"История",exact:true}).click(); await expect(page.locator(".break-mark[data-break=yes]")).toHaveText(/Забил с разбоя/);
  await expect(page.locator(".break-mark[data-break=no]")).toHaveText(/Не забил с разбоя/);
  await expect(page.locator(".break-mark[data-break=unknown]")).toHaveText(/Разбой не отмечен/);
  await shot("05-history");
  await more(page,"Вибрация");
  await expect(page.locator(".modern-app")).toHaveAttribute("data-theme","dark"); await shot("06-haptics-dark");
  await page.locator("nav").getByRole("button",{name:"Ещё",exact:true}).click(); await shot("07-settings-dark");
  await page.locator("nav").getByRole("button",{name:"Статистика",exact:true}).click(); await shot("08-statistics-dark");
});
