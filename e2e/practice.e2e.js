import {test,expect} from "@playwright/test";

for(const [type,label] of [["russian","Русский бильярд"],["pool","Pool"]]){
  test(`training entry is hidden for ${type} while ordinary game setup remains available`,async({page})=>{
    await page.route("**/rest/v1/**",route=>route.abort());
    await page.addInitScript(()=>{localStorage.setItem("billiards-privacy-acknowledged","2026-11-12");localStorage.setItem("billiards-onboarding-v1","1");});
    await page.goto("/");
    await page.getByRole("button",{name:label,exact:true}).click();
    await expect(page.getByRole("heading",{name:/Игроки/})).toBeVisible();
    await expect(page.getByRole("button",{name:/Тренировка с упражнениями/})).toHaveCount(0);
  });
}
