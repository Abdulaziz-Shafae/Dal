// Browser QA uses synthetic coordinates only, isolated from real accounts and Backend.
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.DAL_QA_MODULES ? path.join(process.env.DAL_QA_MODULES, 'playwright') : 'playwright');
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const port = 5199, base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
let browser;
const report = { syntheticData: true, viewports: [], checks: [], errors: [], realPhones: 'Not Tested' };
try {
  for (let n = 0; n < 60; n++) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : 'chromium', headless: true });
  const context = await browser.newContext({ geolocation: { latitude: 24.7136, longitude: 46.6753, accuracy: 8 }, permissions: ['geolocation'], viewport: { width: 390, height: 844 } });
  const page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
  let offline = false, paused = false, expired = false, saves = 0, meeting = { id: 1, groupId: 1, name: 'نقطة اختبار', latitude: 24.714, longitude: 46.676, updatedAt: new Date().toISOString() };
  const group = { id: 1, name: 'مجموعة اختبار الخريطة', myRole: 'OWNER', status: 'ACTIVE', joinCode: 'QA12C', memberCount: 2 };
  const members = [{ id: 1, userId: 1, name: 'المستخدم الاختباري', role: 'OWNER' }, { id: 2, userId: 2, name: 'عضو اختبار', role: 'MEMBER' }];
  const coords = id => ({ userId: id, name: members[id - 1].name, latitude: id === 1 ? 24.7136 : 24.7142, longitude: 46.6753, accuracy: 8, recordedAt: new Date().toISOString(), sharingEnabled: !paused });
  await page.route('**/api/v1/**', async route => {
    if (offline) return route.abort('internetdisconnected');
    if (expired) return route.fulfill({ status: 400, json: { message: 'Your session has expired. Please log in again' } });
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    let body = {};
    if (path === '/user/profile') body = { id: 1, name: members[0].name };
    else if (path === '/security/csrf') body = { token: 'qa', headerName: 'X-CSRF-TOKEN' };
    else if (path === '/group/my') body = [group];
    else if (path === '/group/1') body = group;
    else if (path.startsWith('/group-member/group/')) body = members;
    else if (path === '/sharing') body = { sharingMode: 'WHILE_USING', sharingEnabled: !paused, isPaused: paused, updateIntervalSeconds: 15 };
    else if (path.startsWith('/sharing/group/')) body = { groupId: 1, sharingEnabled: !paused, isPaused: paused };
    else if (path.startsWith('/join-request/')) body = [];
    else if (path === '/location/group/1') body = [coords(1), coords(2)];
    else if (path === '/location/my') body = coords(1);
    else if (path === '/location/update') { saves++; body = coords(1); assert.equal(route.request().headers()['x-csrf-token'], 'qa'); }
    else if (path === '/meeting-point/group/1') { if (route.request().method() === 'PUT') meeting = { ...route.request().postDataJSON(), updatedAt: new Date().toISOString() }; body = meeting; }
    return route.fulfill({ status: 200, json: body });
  });
  // A local blank tile avoids contacting OSM during automated QA and bulk test traffic.
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6tOAAAAAASUVORK5CYII=', 'base64') }));
  await page.goto(base);
  await page.getByRole('button', { name: 'المجموعات', exact: true }).first().click();
  await page.getByRole('button', { name: /مجموعة اختبار الخريطة/ }).click();
  await page.getByRole('button', { name: 'الخريطة', exact: true }).first().click();
  await page.getByText('متصل بالخدمة', { exact: false }).waitFor();
  assert.equal(saves, 0); report.checks.push('No GPS publishing before explicit consent');
  await page.getByRole('button', { name: /تفعيل الملاحة/ }).click();
  await page.waitForFunction(() => document.querySelector('.nav-gps-controls')?.textContent.includes('إيقاف GPS'));
  await page.waitForTimeout(600); assert.ok(saves >= 1); report.checks.push('Geolocation and CSRF upload');
  await mkdir('review/navigation/screenshots', { recursive: true });
  for (const width of [360, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const view of ['الخريطة', 'البوصلة', 'نقطة اللقاء']) {
      await page.locator('.dal-navigation .segmented').getByRole('button', { name: view, exact: true }).click();
      await page.waitForTimeout(100);
      const dimensions = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth }));
      assert.ok(dimensions.documentWidth <= width, `${view} overflows at ${width}`);
      report.viewports.push({ width, view, ...dimensions });
      await page.screenshot({ path: `review/navigation/screenshots/${width}-${view === 'الخريطة' ? 'map' : view === 'البوصلة' ? 'compass' : 'meeting'}.png`, fullPage: true });
    }
  }
  await page.locator('.dal-navigation .segmented').getByRole('button', { name: 'نقطة اللقاء', exact: true }).click();
  await page.locator('.dal-map-canvas').click({ position: { x: 160, y: 220 } });
  await page.locator('.nav-meeting-form').getByLabel('اسم نقطة اللقاء').fill('لقاء اختبار محفوظ');
  await page.locator('.nav-meeting-form').getByRole('button', { name: 'حفظ نقطة اللقاء', exact: true }).click();
  await page.getByText('تم حفظ نقطة اللقاء', { exact: true }).waitFor(); assert.equal(meeting.name, 'لقاء اختبار محفوظ'); report.checks.push('Map click and meeting save');
  await page.locator('.dal-navigation .segmented').getByRole('button', { name: 'البوصلة', exact: true }).click();
  await page.getByRole('button', { name: /إعادة تفعيل حساس/ }).click();
  await page.evaluate(() => { const event = new Event('deviceorientationabsolute'); Object.defineProperties(event, { absolute: { value: true }, alpha: { value: 90 } }); window.dispatchEvent(event); });
  assert.ok(await page.locator('.dal-direction-arrow').count()); report.checks.push('Absolute orientation arrow');
  offline = true; await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.getByText('هذه آخر معلومات وصلت', { exact: false }).waitFor(); report.checks.push('Actual request failure triggers offline cache');
  offline = false; await page.evaluate(() => window.dispatchEvent(new Event('online'))); await page.getByText('متصل بالخدمة', { exact: false }).waitFor(); report.checks.push('Reconnect refresh');
  paused = true; await page.evaluate(() => window.dispatchEvent(new Event('online'))); await page.waitForTimeout(150);
  assert.equal(await page.locator('.dal-direction-arrow').count(), 0); report.checks.push('Sharing revocation removes target and arrow');
  expired = true; await page.evaluate(() => window.dispatchEvent(new Event('online'))); await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).last().waitFor(); report.checks.push('Session expiry returns to authentication');
  assert.deepEqual(report.errors, []);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await mkdir('review/navigation', { recursive: true });
  await writeFile('review/navigation/browser-results.json', JSON.stringify(report, null, 2));
  await browser?.close(); server.kill();
}
