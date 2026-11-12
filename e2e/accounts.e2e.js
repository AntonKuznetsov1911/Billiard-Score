import { test, expect } from '@playwright/test';

const a='00000000-0000-4000-8000-000000000001', b='00000000-0000-4000-8000-000000000002';
const club={id:'10000000-0000-4000-8000-000000000001',name:'Общий тест',code:'TESTCODE',created_by:a};
const state=name=>({players:[{id:name,name,color:'#E4032E'}],matches:[],trash:[],activeGames:[],updatedAt:1,gameType:'russian',russianMode:'free'});

test('practice: personal progress reaches a second device and stays out of guest data',async({page,context,browser})=>{
  const api=backend();await setup(context,api);await page.goto('/');await login(page,'a@example.com');
  await page.locator('nav').getByRole('button',{name:'Игра',exact:true}).click();
  await page.getByRole('button',{name:/Тренировка с упражнениями/}).click();
  await page.getByRole('button',{name:/01 Прямой удар/}).click();
  await page.getByRole('button',{name:'Начать 10 попыток'}).click();
  await page.getByRole('button',{name:'Получилось',exact:true}).click();
  await expect.poll(()=>api.personal.get(a)?.data.practiceSessions?.[0]?.events.length).toBe(1);
  const other=await browser.newContext();await setup(other,api);const phone=await other.newPage();await phone.goto('/');await login(phone,'a@example.com');
  await phone.locator('nav').getByRole('button',{name:'Игра',exact:true}).click();
  await phone.getByRole('button',{name:/Тренировка с упражнениями/}).click();
  await phone.getByRole('button',{name:/01 Прямой удар/}).click();
  await expect(phone.getByText('Попытки: 1 / 10',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('billiards-club-data')).practiceSessions||[])).toEqual([]);
  expect(api.personal.get(a).data.matches).toEqual([]);await other.close();
});
const user=id=>({id,aud:'authenticated',role:'authenticated',email:id===a?'a@example.com':'b@example.com',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()});
function token(id){return 'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.test';}
function backend(){
  const personal=new Map([[a,{data:state('Личный А'),revision:1}],[b,{data:state('Личный Б'),revision:1}]]);
  let clubData=state('Клубный игрок'), offline=false, leaks=0, logoutFail=false;
  async function route(r){
    const req=r.request(),url=new URL(req.url());let result=null;
    if(offline && url.pathname!=='/auth/v1/logout')return r.abort();
    const header=req.headers().authorization || '';
    let id=null;try{id=JSON.parse(Buffer.from(header.replace('Bearer ','').split('.')[1],'base64url').toString()).sub;}catch{}
    if(url.pathname==='/auth/v1/token'){
      id=req.postDataJSON().email==='a@example.com'?a:b;
      result={access_token:token(id),refresh_token:'test-refresh',expires_in:3600,token_type:'bearer',user:user(id)};
    }else if(url.pathname==='/auth/v1/user') result=user(id);
    else if(url.pathname==='/auth/v1/logout') return logoutFail ? r.fulfill({status:422,contentType:'application/json',body:JSON.stringify({message:'Test logout failure'})}) : r.fulfill({status:204});
    else if(url.pathname==='/rest/v1/personal_state') {
      if(offline)return r.abort();
      const wanted=url.searchParams.get('user_id')?.replace('eq.','');
      if(wanted!==id){leaks++;return r.fulfill({status:403,body:'{}'});}
      result=personal.get(id)||null;
    }else if(url.pathname==='/rest/v1/rpc/save_personal_state'){
      if(offline)return r.abort();
      const p=req.postDataJSON();if(p.p_user_id!==id){leaks++;return r.fulfill({status:403,body:'{}'});}
      const row=personal.get(id);result=(row?.revision||0)===p.p_expected_revision;
      if(result)personal.set(id,{data:p.p_data,revision:(row?.revision||0)+1});
    }else if(url.pathname==='/rest/v1/rpc/delete_my_account'){personal.delete(id);result=null;}
    else if(url.pathname==='/rest/v1/club_members')result=id===a?{club_id:club.id,clubs:club}:null;
    else if(url.pathname==='/rest/v1/club_state'){
      if(req.method()==='PATCH'){clubData=req.postDataJSON().data;result=[{club_id:club.id}];}
      else result={data:clubData,updated_at:'2026-11-01T00:00:00Z'};
    }
    return r.fulfill({contentType:'application/json',body:JSON.stringify(result)});
  }
  return {personal,route,setOffline:v=>{offline=v;},setLogoutFail:v=>{logoutFail=v;},leaks:()=>leaks,clubPlayers:()=>clubData.players.map(p=>p.name)};
}
async function setup(context, api, guest='Гость'){
  await context.route('https://*.supabase.co/**',api.route);
  await context.addInitScript(guest=>{
    localStorage.setItem('billiards-privacy-acknowledged','2026-11-12');
    if(!sessionStorage.getItem('accounts-seeded')){
      sessionStorage.setItem('accounts-seeded','1');
      localStorage.setItem('billiards-club-data',JSON.stringify({players:[{id:'guest',name:guest,color:'#E4032E'}],matches:[],trash:[],activeGames:[],updatedAt:1}));
    }
  },guest);
}
async function openAccount(page){
  const gate=page.getByRole('button',{name:'Русский бильярд',exact:true});
  await expect(gate.or(page.locator('nav')).first()).toBeVisible();
  if(await gate.isVisible())await gate.click();
  await page.locator('nav').getByRole('button',{name:'Ещё',exact:true}).click();
  await page.getByRole('button',{name:/^Аккаунт/}).click();
}
async function login(page,email){
  await openAccount(page);
  await page.getByPlaceholder('Ваш email').fill(email);
  await page.getByText('Вход по паролю',{exact:true}).click();
  await page.getByLabel('Пароль аккаунта').fill('test-password');
  await page.getByRole('button',{name:'Войти по паролю',exact:true}).click();
  await expect(page.getByTestId('workspace-label')).toContainText(email);
  await expect(page.getByText('Личные данные сохранены в облаке',{exact:true})).toBeVisible();
}
async function names(page){
  return page.evaluate(()=>{
    const tokenKey=Object.keys(localStorage).find(k=>/^sb-.*-auth-token$/.test(k));
    const session=tokenKey?JSON.parse(localStorage.getItem(tokenKey)):null;
    const key=session?'billiards-profile/user/'+session.user.id+'/personal/billiards-club-data':'billiards-club-data';
    return JSON.parse(localStorage.getItem(key))?.players.map(p=>p.name);
  });
}

test('accounts: guest, A, B and a second device stay isolated; importing is explicit',async({page,context,browser})=>{
  const api=backend();await setup(context,api);await page.goto('/');
  await login(page,'a@example.com');await expect.poll(()=>names(page)).toEqual(['Личный А']);
  if(process.env.ACCOUNTS_SCREENSHOT) { await page.waitForTimeout(1100); await page.screenshot({path:process.env.ACCOUNTS_SCREENSHOT,fullPage:true}); }
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Добавить данные без аккаунта',exact:true}).click();
  await expect.poll(()=>api.personal.get(a).data.players.map(p=>p.name).sort()).toEqual(['Гость','Личный А'].sort());
  await page.getByRole('button',{name:'Выйти из аккаунта',exact:true}).click();
  await expect(page.getByTestId('workspace-label')).toContainText('без аккаунта');
  await expect.poll(()=>names(page)).toEqual(['Гость']);
  await login(page,'b@example.com');await expect.poll(()=>names(page)).toEqual(['Личный Б']);
  const other=await browser.newContext();await setup(other,api,'Другой гость');const phone=await other.newPage();await phone.goto('/');await login(phone,'a@example.com');
  await expect.poll(async()=>(await names(phone)).sort()).toEqual(['Гость','Личный А'].sort());
  await other.close();expect(api.leaks()).toBe(0);
});

test('accounts: club data never replaces personal data, including after reload',async({page,context})=>{
  const api=backend();await setup(context,api);await page.goto('/');await login(page,'a@example.com');
  await page.getByRole('checkbox',{name:'Я прочитал и принимаю правила клубов'}).check();await page.getByRole('button',{name:'Принять правила клубов',exact:true}).click();
  await page.getByRole('button',{name:'Открыть клуб «Общий тест»',exact:true}).click();
  await expect(page.getByTestId('workspace-label')).toContainText('Клуб «Общий тест»');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('billiards-profile/user/00000000-0000-4000-8000-000000000001/club/10000000-0000-4000-8000-000000000001/billiards-club-data'))?.players[0]?.name)).toBe('Клубный игрок');
  await page.getByRole('button',{name:'Мои личные данные',exact:true}).click();await expect.poll(()=>names(page)).toEqual(['Личный А']);
  await page.reload();await openAccount(page);await expect.poll(()=>names(page)).toEqual(['Личный А']);expect(api.leaks()).toBe(0);
});

test('accounts: offline personal edits persist locally and retry, without contaminating another account',async({page,context})=>{
  const api=backend();await setup(context,api);await page.goto('/');await login(page,'a@example.com');api.setOffline(true);
  await page.locator('nav').getByRole('button',{name:'Игра',exact:true}).click();await page.getByPlaceholder('Имя игрока').fill('Офлайн А');await page.getByPlaceholder('Имя игрока').press('Enter');
  await expect.poll(()=>names(page)).toContain('Офлайн А');await openAccount(page);
  await expect(page.getByRole('status')).toContainText('Облако недоступно', { timeout: 20000 });
  api.setOffline(false);await page.getByRole('button',{name:'Синхронизировать сейчас',exact:true}).click();
  await expect.poll(()=>api.personal.get(a).data.players.map(p=>p.name)).toContain('Офлайн А');
  await page.getByRole('button',{name:'Выйти из аккаунта',exact:true}).click();await login(page,'b@example.com');await expect.poll(()=>names(page)).toEqual(['Личный Б']);expect(api.leaks()).toBe(0);
});

test('accounts: deleting an account preserves guest data and another account cache',async({page,context})=>{
  const api=backend();await setup(context,api);await page.goto('/');await login(page,'a@example.com');
  await page.evaluate(()=>localStorage.setItem('billiards-profile/user/00000000-0000-4000-8000-000000000002/personal/billiards-club-data',JSON.stringify({players:[{id:'b',name:'Кэш Б'}],matches:[],trash:[]})));
  await page.locator('nav').getByRole('button',{name:'Ещё',exact:true}).click();await page.getByRole('button',{name:/^Копии и экспорт/}).click();
  await page.getByText('Удаление данных',{exact:true}).click();page.once('dialog',d=>d.accept('удалить'));
  await page.getByRole('button',{name:'Удалить аккаунт',exact:true}).click();
  await expect(page.getByRole('button',{name:'Русский бильярд',exact:true})).toBeVisible();
  await expect.poll(()=>names(page)).toEqual(['Гость']);
  expect(api.personal.has(a)).toBe(false);expect(api.personal.has(b)).toBe(true);
  expect(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('billiards-profile/user/00000000-0000-4000-8000-000000000001/')))).toBe(false);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('billiards-profile/user/00000000-0000-4000-8000-000000000002/personal/billiards-club-data')).players[0].name)).toBe('Кэш Б');
});

test('accounts: an expired sign-in still opens the last account local copy offline',async({page,context})=>{
  const api=backend();await setup(context,api);await page.goto('/');await login(page,'a@example.com');
  await page.evaluate(()=>{
    const key=Object.keys(localStorage).find(k=>/^sb-.*-auth-token$/.test(k));
    const session=JSON.parse(localStorage.getItem(key));session.expires_at=1;session.expires_in=0;
    localStorage.setItem(key,JSON.stringify(session));
  });
  api.setOffline(true);
  await page.addInitScript(()=>Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false}));
  await page.reload();await openAccount(page);
  await expect(page.getByTestId('workspace-label')).toContainText('a@example.com');
  await expect(page.getByRole('status')).toContainText('офлайн-копия');
  await expect.poll(()=>names(page)).toEqual(['Личный А']);
});

test('accounts: deliberate copies work both ways and remain independent',async({page,context})=>{
  const api=backend();await setup(context,api);await page.goto('/');await login(page,'a@example.com');
  await page.getByRole('checkbox',{name:'Я прочитал и принимаю правила клубов'}).check();await page.getByRole('button',{name:'Принять правила клубов',exact:true}).click();
  await page.getByRole('button',{name:'Открыть клуб «Общий тест»',exact:true}).click();
  const toClub=page.getByRole('button',{name:'Скопировать личные данные в клуб',exact:true});await expect(toClub).toBeEnabled();
  page.once('dialog',d=>d.accept());await toClub.click();await expect.poll(()=>api.clubPlayers()).toContain('Личный А');
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Скопировать клуб в личные данные',exact:true}).click();
  await expect.poll(()=>api.personal.get(a).data.players.map(p=>p.name)).toContain('Клубный игрок');
  await page.locator('nav').getByRole('button',{name:'Игра',exact:true}).click();await page.getByPlaceholder('Имя игрока').fill('Только лично');await page.getByPlaceholder('Имя игрока').press('Enter');
  await expect.poll(()=>api.personal.get(a).data.players.map(p=>p.name)).toContain('Только лично');expect(api.clubPlayers()).not.toContain('Только лично');
});

test('accounts: old mixed club data is recovered only into the verified club',async({page,context})=>{
  const api=backend();await setup(context,api);
  await context.addInitScript(()=>{
    if(sessionStorage.getItem('legacy-seeded'))return;sessionStorage.setItem('legacy-seeded','1');
    localStorage.setItem('billiards-club-synced','10000000-0000-4000-8000-000000000001');
    localStorage.setItem('billiards-club-data',JSON.stringify({players:[{id:'legacy',name:'Старый офлайн-игрок'}],matches:[],trash:[],activeGames:[],updatedAt:1}));
  });
  await page.goto('/');await login(page,'a@example.com');await expect.poll(()=>names(page)).toEqual(['Личный А']);
  await page.getByRole('checkbox',{name:'Я прочитал и принимаю правила клубов'}).check();await page.getByRole('button',{name:'Принять правила клубов',exact:true}).click();
  await page.getByRole('button',{name:'Открыть клуб «Общий тест»',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('billiards-profile/user/00000000-0000-4000-8000-000000000001/club/10000000-0000-4000-8000-000000000001/billiards-club-data'))?.players.map(p=>p.name))).toContain('Старый офлайн-игрок');
  expect(api.personal.get(a).data.players.map(p=>p.name)).not.toContain('Старый офлайн-игрок');
});

test('accounts: failed sign-out cannot silently erase device data and log back in',async({page,context})=>{
  const api=backend();await setup(context,api);await page.goto('/');await login(page,'a@example.com');api.setLogoutFail(true);
  await page.locator('nav').getByRole('button',{name:'Ещё',exact:true}).click();await page.getByRole('button',{name:/^Копии и экспорт/}).click();await page.getByText('Удаление данных',{exact:true}).click();
  let alert='';page.on('dialog',async d=>{if(d.type()==='prompt')await d.accept('удалить');else{alert=d.message();await d.dismiss();}});
  await page.getByRole('button',{name:'Удалить мои данные с устройства',exact:true}).click();
  await expect.poll(()=>alert).toContain('Очистка не выполнена');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('billiards-profile/user/00000000-0000-4000-8000-000000000001/personal/billiards-club-data')).players[0].name)).toBe('Личный А');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('billiards-club-data')).players[0].name)).toBe('Гость');
});
