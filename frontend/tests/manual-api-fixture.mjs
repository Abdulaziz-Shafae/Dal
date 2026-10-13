// Local UI review only. Never used by the production build or Railway server.
// Run: node tests/manual-api-fixture.mjs; API_PROXY_TARGET=http://127.0.0.1:8081 npm run dev
import http from 'node:http';
import { readFile } from 'node:fs/promises';
const controlPath = process.env.DAL_QA_CONTROL;
const user = { id: 1, name: 'اختبار واجهة دال', email: 'dal-ui-qa@example.com' };
let groups = [{ id: 1, name: 'مجموعة اختبار واجهة دال والعائلة', joinCode: 'QA12C', status: 'ACTIVE', joinMode: 'APPROVAL', myRole: 'OWNER', memberCount: 3 }];
let members = [{ id: 1, userId: 1, name: user.name, role: 'OWNER' }, { id: 2, userId: 2, name: 'عبدالعزيز اسم طويل لاختبار الالتفاف', role: 'MEMBER' }, { id: 3, userId: 3, name: 'غيداء', role: 'ADMIN' }];
let sharing = { sharingMode: 'WHILE_USING', isPaused: false, sharingEnabled: true, updateIntervalSeconds: 15 };
let meeting = { name: 'جناح السعودية', latitude: 24.7136, longitude: 46.6753 };
let requests = [{ id: 8, userName: 'عضو جديد لاختبار طلب الانضمام', status: 'PENDING' }];
let messages = [{ id: 1, senderId: 2, receiverId: 1, content: 'أنا عند نقطة الالتقاء. QA@example.com', createdAt: '2026-10-12T12:30:00Z' }];
let notifications = [{ id: 1, senderName: 'غيداء', content: 'أنا عند نقطة الالتقاء؛ انتظرني.', createdAt: '2026-10-12T12:30:00Z', readAt: null }];
http.createServer(async (req, res) => {
  const config = controlPath ? JSON.parse(await readFile(controlPath, 'utf8')) : {};
  const path = new URL(req.url, 'http://localhost').pathname.replace('/api/v1', '');
  const method = req.method;
  const send = (value, status = 200) => {
    console.log(`${method} ${path} ${status} csrf=${Boolean(req.headers['x-csrf-token'])}`);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(value));
  };
  if (config.delay) await new Promise(resolve => setTimeout(resolve, config.delay));
  if (config.fail === path) return send({ message: 'تعذر تحميل البيانات، حاول مجددًا.' }, 503);
  if (path === '/security/csrf') return send({ token: 'local-ui-fixture', headerName: 'X-CSRF-TOKEN' });
  if (method !== 'GET' && req.headers['x-csrf-token'] !== 'local-ui-fixture') return send({ message: 'CSRF token required' }, 403);
  let raw = ''; for await (const chunk of req) raw += chunk;
  const data = raw ? JSON.parse(raw) : {};
  if (path === '/user/profile') return config.guest ? send({ message: 'Login required' }, 401) : send(method === 'PUT' ? Object.assign(user, data) : user);
  if (path === '/user/login' || path === '/user/register') return send(user);
  if (path === '/user/logout') return send({ message: 'Signed out' });
  if (path.startsWith('/password-reset/')) return send({ message: 'طلب اختبار محلي فقط؛ لم يُرسل بريد إلكتروني.' });
  if (path === '/group/my') return send(config.empty ? [] : groups);
  if (path === '/group/create') { const group = { ...groups[0], id: groups.length + 1, ...data, myRole: 'OWNER', memberCount: 1 }; groups.push(group); return send(group, 201); }
  if (path === '/group/join') return data.joinCode === 'ERROR' ? send({ message: 'كود المجموعة غير صحيح' }, 400) : send({ groupId: 1, status: 'JOINED' });
  if (/^\/group\/\d+$/.test(path)) { const group = groups.find(g => g.id === Number(path.split('/')[2])) || groups[0]; return send(method === 'PUT' ? Object.assign(group, data) : group); }
  if (/^\/group\/\d+\//.test(path)) { const group = groups.find(g => g.id === Number(path.split('/')[2])); if (path.endsWith('/pause')) group.status = 'PAUSED'; if (path.endsWith('/resume')) group.status = 'ACTIVE'; if (path.endsWith('/join-code')) group.joinCode = 'NEW12'; return send(group); }
  if (path.startsWith('/group-member/group/')) return send(config.emptyMembers ? [members[0]] : members);
  if (/^\/group-member\/\d+\/role$/.test(path)) { members.find(m => m.id === Number(path.split('/')[2])).role = data.role; return send({}); }
  if (path.startsWith('/group-member/')) return send({});
  if (path === '/join-request/my') return send([]);
  if (path.startsWith('/join-request/group/')) return send(requests);
  if (path.startsWith('/join-request/')) { requests = []; return send({}); }
  if (path.startsWith('/sharing')) { if (path.endsWith('/pause')) Object.assign(sharing, { isPaused: true, sharingEnabled: false }); if (path.endsWith('/resume')) Object.assign(sharing, { isPaused: false, sharingEnabled: true }); if (method === 'PUT' && path === '/sharing') Object.assign(sharing, data); return send(sharing); }
  if (path.startsWith('/meeting-point/')) { if (method === 'PUT') meeting = data; if (method === 'DELETE') meeting = null; return meeting ? send(meeting) : send({ message: 'This group has no meeting point yet' }, 400); }
  if (path.includes('/with/')) return send({ content: config.empty ? [] : [...messages].reverse(), last: true });
  if (path.includes('/to/')) { messages.push({ ...data, id: messages.length + 1, senderId: 1, receiverId: Number(path.split('/').at(-1)), createdAt: new Date().toISOString() }); return send(messages.at(-1), 201); }
  if (path.startsWith('/message/')) return send({});
  if (path === '/notification/my') return send({ content: config.empty ? [] : notifications });
  if (path.endsWith('/read')) { notifications[0].readAt = new Date().toISOString(); return send({}); }
  if (path.startsWith('/notification/') || path.startsWith('/reunion/')) return send({});
  if (path === '/location/my/history') return send({});
  return send({ message: `Fixture has no route: ${method} ${path}` }, 404);
}).listen(8081, '127.0.0.1', () => console.log('LOCAL TEST DATA ONLY: http://127.0.0.1:8081'));
