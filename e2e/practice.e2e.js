import {test,expect} from "@playwright/test";
for(const type of ["russian","pool"]){
test(`guided practice ${type}: save, undo, reload, finish without a match`,async({page})=>{
  await page.route("**/rest/v1/**",route=>route.abort());
  await page.addInitScript(()=>{localStorage.setItem("billiards-privacy-acknowledged","2026-11-12");localStorage.setItem("billiards-onboarding-v1","1");});
  await page.goto("/");
  await page.getByRole("button",{name:type==="pool" ? "Pool" : "Русский бильярд",exact:true}).click();
  await page.getByRole("button",{name:/Тренировка с упражнениями/}).click();
  await page.getByRole("button",{name:/01 Прямой удар/}).click();
  await expect(page.getByRole("img",{name:/Расстановка/})).toBeVisible();
  await page.getByRole("button",{name:"Начать выполнение"}).click();
  await page.getByText("Или отмечать каждый удар",{exact:true}).click();
  await page.getByRole("button",{name:"Получилось",exact:true}).click();
  await page.getByRole("button",{name:"Не получилось",exact:true}).click();
  await page.getByRole("button",{name:"Отменить последнюю попытку"}).click();
  await expect(page.getByText("Попытки: 1 / 10",{exact:true})).toBeVisible();
  await page.reload();
  await page.getByRole("button",{name:type==="pool" ? "Pool" : "Русский бильярд",exact:true}).click();
  await page.getByRole("button",{name:/Тренировка с упражнениями/}).click();
  await page.getByRole("button",{name:/01 Прямой удар/}).click();
  await expect(page.getByText("Попытки: 1 / 10",{exact:true})).toBeVisible();
  await page.getByText("Или отмечать каждый удар",{exact:true}).click();
  for(let i=1;i<10;i++)await page.getByRole("button",{name:"Получилось",exact:true}).click();
  await expect(page.getByText("Упражнение завершено",{exact:true})).toBeVisible();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("billiards-club-data")));
  expect(saved.matches).toHaveLength(0);expect(saved.practiceSessions).toHaveLength(1);
  await page.setViewportSize({width:320,height:800});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`../../outputs/practice-${type}.png`,fullPage:true});
});}
