import { test, expect } from '@playwright/test';

test('privacy: first launch, explicit acknowledgement, persistence and unchanged games', async ({ page }) => {
  const requests = [];
  page.on('request', r => { if (r.url().includes('supabase.co')) requests.push(r.url()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Конфиденциальность', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Политика конфиденциальности' })).toContainText('Удаление данных');
  await expect(page.getByRole('button', { name: 'Продолжить', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Русский бильярд', exact: true })).toHaveCount(0);
  expect(requests).toEqual([]);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Конфиденциальность', exact: true })).toBeVisible();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Русский бильярд', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Конфиденциальность', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Русский бильярд', exact: true })).toBeVisible();
});

test('privacy: storage failure is explained without entering the app', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('blocked'); }; });
  await page.goto('/');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Не удалось сохранить');
  await expect(page.getByRole('button', { name: 'Русский бильярд', exact: true })).toHaveCount(0);
});

test('privacy: existing player data survives acknowledgement on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.addInitScript(() => localStorage.setItem('billiards-club-data', JSON.stringify({
    players: [{ id: 'existing', name: 'Игрок', color: '#E4032E' }], matches: [], trash: [], updatedAt: 1,
  })));
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  const region = page.getByRole('region', { name: 'Политика конфиденциальности' });
  await region.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await expect(region.getByRole('link', { name: 'x9054074040@gmail.com' })).toBeVisible();
  await page.screenshot({ path: '../../outputs/Дизайн — 1.2.15-preview/privacy-320.png', fullPage: true });
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('billiards-club-data')).players[0].name)).toBe('Игрок');
});
