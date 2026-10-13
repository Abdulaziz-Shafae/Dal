// Synthetic browser integration only. API requests and tiles never reach production.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.DAL_QA_MODULES || '.', 'playwright'));
const base = 'http://127.0.0.1:5203', out = 'review/final-features';
await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: '5203' }, stdio: 'ignore' });
let browser;
const report = { synthetic: true, checks: [], viewports: [], errors: [], realPhones: 'Not Tested' };
try {
  for (let n = 0; n < 60; n++) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : 'chromium', headless: true });
  const context = await browser.newContext({ geolocation: { latitude: 24.7136, longitude: 46.6753, accuracy: 8 }, permissions: ['geolocation'], viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    localStorage.setItem('dal-language', 'ar'); window.permissionPrompts = 0;
    if (window.DeviceOrientationEvent) window.DeviceOrientationEvent.requestPermission = async () => { window.permissionPrompts++; return 'granted'; };
    setInterval(() => { const event = new Event('deviceorientationabsolute'); Object.defineProperties(event, { absolute: { value: true }, alpha: { value: 90 } }); window.dispatchEvent(event); }, 500);
  });
  const page = await context.newPage(); page.on('pageerror', e => report.errors.push(e.message));
  let logged = false, unread = 0, shared = true, routingFails = false, old = false;
  let own = { latitude: 24.7136, longitude: 46.6753 }, otherLatitude = 24.7142;
  const routeRequests = [], groupMessages = [];
  const group = { id: 1, name: 'مجموعة اختبار', joinCode: 'RY482', status: 'ACTIVE', myRole: 'OWNER' };
  const members = [{ id: 1, userId: 1, name: 'مسؤول اختبار', role: 'OWNER' }, { id: 2, userId: 2, name: 'عضو اختبار', role: 'MEMBER' }, { id: 3, userId: 3, name: 'ثالث اختبار', role: 'MEMBER' }];
  let meeting = { id: 1, name: 'نقطة اختبار', latitude: 24.714, longitude: 46.676, updatedAt: new Date().toISOString() };
  const point = id => ({ userId: id, name: members[id - 1].name, latitude: id === 1 ? own.latitude : id === 2 ? otherLatitude : 24.7138, longitude: own.longitude, accuracy: 8, recordedAt: new Date(Date.now() - (old && id === 2 ? 240000 : 0)).toISOString(), sharingEnabled: id === 1 || shared });
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()), p = url.pathname.replace('/api/v1', ''), method = route.request().method(); let body = {};
    if (p === '/user/profile') { if (!logged) return route.fulfill({ status: 401, json: { message: 'Please log in first' } }); body = { id: 1, name: members[0].name }; }
    else if (p === '/user/logout') { logged = false; }
    else if (p === '/user/login') { logged = true; body = { id: 1, name: members[0].name }; }
    else if (p === '/security/csrf') body = { token: 'test', headerName: 'X-CSRF-TOKEN' };
    else if (p === '/group/my') body = [group];
    else if (p === '/group/1') body = group;
    else if (p.includes('/group-member/')) body = members;
    else if (p === '/sharing') body = { sharingEnabled: true, sharingMode: 'WHILE_USING', updateIntervalSeconds: 15 };
    else if (p.includes('/sharing/group/')) body = { sharingEnabled: true };
    else if (p.includes('/join-request/')) body = [];
    else if (p === '/location/group/1') body = members.map(m => point(m.userId));
    else if (p === '/location/my' || p === '/location/update') body = point(1);
    else if (p === '/meeting-point/group/1') { if (method === 'PUT') meeting = { ...route.request().postDataJSON(), id: 1, updatedAt: new Date().toISOString() }; body = meeting; }
    else if (p === '/notification/unread-count') body = { count: unread };
    else if (p === '/notification/my') body = { content: [{ id: 1, senderName: 'عضو اختبار', content: 'You have a new message', createdAt: new Date().toISOString(), readAt: null }], last: true };
    else if (p === '/notification/1/read') { unread--; }
    else if (p.endsWith('/walking')) {
      const input = route.request().postDataJSON(); routeRequests.push(input); assert.equal(route.request().headers()['x-csrf-token'], 'test');
      if (routingFails) return route.fulfill({ status: 503, json: { message: 'تعذر حساب الطريق' } });
      const target = input.meetingPoint ? meeting : point(input.memberId);
      body = { status: shared || input.meetingPoint ? 'READY' : 'LOCATION_UNAVAILABLE', coordinates: [[own.latitude, own.longitude], [(own.latitude + target.latitude) / 2, own.longitude + .0002], [target.latitude, target.longitude]], distanceMeters: 160, durationSeconds: 130, lastKnownLocation: old };
    } else if (p.endsWith('/reunion-assistance')) body = { source: 'RULES', locationStatus: !shared ? 'UNAVAILABLE' : old ? 'STALE' : 'RECENT', recommendation: 'تواصل مع العضو عند قدم الموقع.', reason: 'خدمة AI غير متاحة؛ نصيحة حسابية.', action: 'CONTACT_MEMBER', lowAccuracy: false, warning: 'بيانات اختبار فقط' };
    else if (p.endsWith('/meeting-suggestions')) { const candidates = route.request().postDataJSON().candidates; body = { source: 'RULES', ranking: candidates.map((c, i) => ({ ...c, index: i, maximumDistanceMeters: 100 + i * 100 })), reason: 'تقييم حسابي للمرشحين فقط.', warning: 'المسافات مباشرة', includedMembers: 3, excludedMembers: 0 }; }
    else if (p === '/group-message/group/1') {
      if (method === 'POST') { const input = route.request().postDataJSON(); if (!groupMessages.some(m => m.clientMessageId === input.clientMessageId)) groupMessages.push({ ...input, id: groupMessages.length + 1, senderId: 1, senderName: members[0].name, createdAt: new Date().toISOString() }); body = groupMessages.at(-1); }
      else body = { content: groupMessages.toReversed(), last: true };
    } else if (p.includes('/unread-count')) body = { count: 0 };
    else if (p.includes('/message/group/')) body = { content: [{ id: 1, senderId: 2, senderName: members[1].name, receiverId: 1, content: 'رسالة خاصة محفوظة', createdAt: new Date().toISOString(), readAt: new Date().toISOString() }], last: true };
    return route.fulfill({ status: 200, json: body });
  });
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6tOAAAAAASUVORK5CYII=', 'base64') }));
  async function menuTo(name) { await page.getByRole('button', { name: 'القائمة', exact: true }).first().click(); await page.locator('.menu-panel').getByRole('button', { name, exact: true }).click(); }
  async function snap(name) { await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(50); await page.screenshot({ path: `${out}/${name}.jpg`, fullPage: true, quality: 75 }); }
  await page.goto(base);
  for (const width of [360, 390, 430, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); await snap(`landing-after-${width}`); try { await copyFile(`review/design/after/${width}-landing-ar.jpg`, `${out}/landing-before-${width}.jpg`); } catch {} assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); }
  await page.setViewportSize({ width: 390, height: 844 }); await menuTo('تسجيل الدخول'); await page.getByLabel('الإيميل').fill('test@example.invalid'); await page.getByLabel('الباسوورد', { exact: true }).fill('ValidPass1!'); await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).last().click(); await page.getByRole('heading', { name: 'مجموعاتك', exact: true }).waitFor(); report.checks.push('Login defaults to groups');
  await page.reload(); await page.getByRole('heading', { name: 'مجموعاتك', exact: true }).waitFor(); report.checks.push('Restored session defaults to groups');
  for (const count of [0, 1, 3, 100]) { unread = count; await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await page.waitForTimeout(150); assert.equal((await page.locator('.notification-badge').count() ? await page.locator('.notification-badge').textContent() : ''), count ? count > 99 ? '99+' : String(count) : ''); }
  report.checks.push('Badges 0,1,3,99+'); unread = 3;
  await page.getByRole('button', { name: 'الإشعارات', exact: true }).click(); await page.locator('.notification-item').click(); await page.waitForTimeout(150); assert.equal(await page.locator('.notification-badge').textContent(), '2'); report.checks.push('Explicit notification read decrements count');
  await menuTo('المجموعات'); await page.locator('.group-card').first().click(); await page.getByRole('button', { name: 'الخريطة', exact: true }).first().click(); await page.getByText('متصل بالخدمة', { exact: false }).waitFor();
  assert.equal(routeRequests.length, 0); await page.getByRole('button', { name: 'تفعيل الملاحة', exact: true }).click(); await page.waitForTimeout(600);
  await page.locator('.leaflet-overlay-pane path[stroke="#1b9151"][fill-opacity="1"]').nth(0).dispatchEvent('click'); await page.getByText('160 م عبر الطريق', { exact: false }).waitFor(); assert.equal(routeRequests.at(-1).memberId, 2); assert.ok(await page.locator('.leaflet-overlay-pane path[stroke="#2bba95"]').count()); report.checks.push('Member marker computes walking polyline and actual summary');
  await page.getByRole('button', { name: 'ابدأ التوجيه', exact: true }).click(); await page.getByText('التوجيه نشط', { exact: false }).waitFor(); await snap('walking-member'); await page.getByRole('button', { name: 'إيقاف التوجيه', exact: true }).click(); assert.equal(await page.locator('.leaflet-overlay-pane path[stroke="#2bba95"]').count(), 0); await page.getByRole('button', { name: 'ابدأ التوجيه', exact: true }).click(); await page.getByText('160 م عبر الطريق', { exact: false }).waitFor(); report.checks.push('Stop removes route and start resumes');
  await page.locator('.dal-navigation .segmented').getByRole('button', { name: 'البوصلة', exact: true }).click(); await page.locator('.dal-direction-arrow').waitFor(); await page.locator('.dal-navigation .segmented').getByRole('button', { name: 'الخريطة', exact: true }).click(); assert.equal(await page.evaluate(() => window.permissionPrompts), 1); report.checks.push('Compass and map reuse activation without new prompt');
  await page.locator('.leaflet-overlay-pane path[stroke="#1b9151"][fill-opacity="1"]').nth(1).dispatchEvent('click'); await page.waitForFunction(() => document.querySelector('.walking-card h2')?.textContent.includes('ثالث')); await page.getByText('160 م عبر الطريق', { exact: false }).waitFor(); assert.equal(routeRequests.at(-1).memberId, 3); report.checks.push('Destination change clears old route and computes new member');
  await page.locator('.leaflet-overlay-pane path[stroke="#004432"][stroke-width="4"][fill-opacity="1"]').dispatchEvent('click'); await page.waitForFunction(() => document.querySelector('.walking-card h2')?.textContent.includes('نقطة اختبار')); await page.getByText('160 م عبر الطريق', { exact: false }).waitFor(); assert.equal(routeRequests.at(-1).meetingPoint, true); report.checks.push('Meeting marker computes route');
  const beforeMove = routeRequests.length; own = { ...own, latitude: own.latitude + .0005 }; await context.setGeolocation({ ...own, accuracy: 8 }); await page.waitForTimeout(12000); assert.ok(routeRequests.length > beforeMove); report.checks.push('Significant user movement recalculates with throttling');
  routingFails = true; await page.locator('.leaflet-overlay-pane path[stroke="#1b9151"][fill-opacity="1"]').nth(0).dispatchEvent('click'); await page.waitForFunction(() => document.querySelector('.walking-card h2')?.textContent.includes('عضو اختبار')); await page.getByText('اتجاه مباشر، وليس طريق مشي.', { exact: false }).waitFor(); assert.equal(await page.getByText('160 م عبر الطريق', { exact: false }).count(), 0); report.checks.push('Routing outage shows labelled direct fallback without invented distance/time');
  routingFails = false; old = true; await page.evaluate(() => window.dispatchEvent(new Event('online'))); await page.getByText('المسار يقود إلى آخر موقع معروف فقط', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'ساعدني أوصل', exact: true }).click(); await page.getByText('نصيحة حسابية · خدمة AI غير متاحة', { exact: true }).waitFor(); report.checks.push('Old member warning and honest AI fallback');
  shared = false; await page.evaluate(() => window.dispatchEvent(new Event('online'))); await page.waitForTimeout(300); assert.equal(await page.locator('.walking-card').count(), 0); assert.equal(await page.locator('.leaflet-overlay-pane path[stroke="#2bba95"]').count(), 0); report.checks.push('Sharing revocation removes target route');
  shared = true; old = false; await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.locator('.dal-navigation .segmented').getByRole('button', { name: 'نقطة اللقاء', exact: true }).click(); await page.locator('.dal-map-canvas').click({ position: { x: 160, y: 240 } }); await page.locator('.nav-assistant').getByLabel('اسم المرشح').fill('مرشح اختبار'); await page.getByRole('button', { name: 'إضافة النقطة المختارة كمرشح', exact: true }).click(); await page.getByRole('button', { name: 'اقترح نقطة لقاء بالذكاء الاصطناعي', exact: true }).click(); await page.getByText('تقييم حسابي غير مولّد بواسطة AI', { exact: true }).waitFor(); assert.equal(meeting.name, 'نقطة اختبار'); await snap('meeting-suggestion'); await page.getByRole('button', { name: 'اعتماد وحفظ مرشح اختبار', exact: true }).click(); await page.getByText('تم حفظ نقطة اللقاء', { exact: true }).waitFor(); assert.equal(meeting.name, 'مرشح اختبار'); report.checks.push('Explicit candidate comparison and manager approval only');
  await menuTo('المحادثات'); await page.getByLabel('رسالتك للمجموعة').fill('رسالة جماعية اختبار'); await page.locator('.chat-input').getByRole('button', { name: 'إرسال', exact: true }).click(); await page.locator('.message').getByText('رسالة جماعية اختبار', { exact: true }).waitFor(); assert.equal(groupMessages.length, 1); assert.ok(await page.locator('.message').getByText('مسؤول اختبار', { exact: true }).count()); for (const width of [360,390,430,768,1440]) { await page.setViewportSize({ width, height: 900 }); await page.evaluate(() => window.scrollTo(0,0)); const fit = await page.evaluate(() => { const input = document.querySelector('.chat-input').getBoundingClientRect(), nav = document.querySelector('.bottom-nav').getBoundingClientRect(); return input.bottom <= nav.top + 1; }); assert.ok(fit, 'Group chat input overlaps navigation at width ' + width); } await page.setViewportSize({width:390,height:844}); await snap('group-chat'); report.checks.push('Group chat composer remains above navigation at five widths');
  await page.getByRole('button', { name: 'المحادثات الخاصة', exact: true }).click(); await page.getByText('رسالة خاصة محفوظة', { exact: true }).waitFor(); report.checks.push('Group send includes sender name; private conversation remains');
  for (const width of [360, 390, 430, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); await menuTo('الخريطة والبوصلة'); await page.waitForTimeout(200); const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth); assert.equal(overflow, false); report.viewports.push({ width, overflow }); await snap(`map-${width}`); }
  await menuTo('الرئيسية'); await page.getByRole('heading', { name: 'مجموعاتك', exact: true }).waitFor(); report.checks.push('Signed-in home returns to groups');
  await menuTo('حسابي'); await page.getByRole('button', { name: 'تسجيل الخروج', exact: true }).click(); await page.locator('.landing-hero').waitFor(); report.checks.push('Logout returns to guest landing');
  logged = true; await page.goto(base + '/?join=RY482'); await page.getByRole('heading', { name: 'انضم لمجموعتك', exact: true }).waitFor(); await page.goto(base + '/reset-password?token=test'); await page.getByRole('heading', { name: 'الباسوورد الجديد', exact: true }).waitFor(); report.checks.push('Invite and password reset links retain their destination');
  assert.deepEqual(report.errors, []);
} finally { await writeFile(`${out}/browser-results.json`, JSON.stringify(report, null, 2)); await browser?.close(); server.kill(); }
console.log(JSON.stringify(report, null, 2));
