const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// 数据文件存储
const DATA_DIR = process.env.VERCEL ? '/tmp/data' : path.join(__dirname, 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function readLeads() {
  ensureDataDir();
  try { return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8')); }
  catch { return []; }
}
function writeLeads(leads) {
  ensureDataDir();
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf-8');
}

app.use(express.json());
app.use(express.static(__dirname));

/* ===================== API：提交测评结果 ===================== */
app.post('/api/submit', (req, res) => {
  const { type, name, wechat, phone, answers, result } = req.body;
  if (!phone && !wechat) {
    return res.status(400).json({ error: '请填写手机号或微信号' });
  }
  const lead = {
    id: Date.now().toString(36) + crypto.randomBytes(4).toString('hex'),
    type: type || 'buyer',
    name: (name || '').trim(),
    phone: (phone || '').trim(),
    wechat: (wechat || '').trim(),
    answers: answers || {},
    result: result || {},
   total: result ? result.total : 0,
   level: result ? result.level : '',
   status: 'new',
    events: [{ type:'created', value:'提交测评', at: new Date().toISOString() }],
   createdAt: new Date().toISOString()
  };
  const leads = readLeads();
  leads.unshift(lead);
  writeLeads(leads);
  res.json({ success: true, id: lead.id });
});

/* ===================== API：线索列表（管理后台） ===================== */
app.get('/api/leads', (req, res) => {
  const { token, type, status, kw } = req.query;
  if (token !== 'lingui_admin_2026') {
    return res.status(401).json({ error: '口令错误' });
  }
  let leads = readLeads();
  if (type) leads = leads.filter(l => l.type === type);
  if (status) leads = leads.filter(l => l.status === status);
  if (kw) {
    const q = kw.toLowerCase();
    leads = leads.filter(l =>
      (l.name || '').toLowerCase().includes(q) ||
      (l.wechat || '').toLowerCase().includes(q) ||
      (l.level || '').toLowerCase().includes(q)
    );
  }
  res.json({ leads });
});

/* ===================== API：线索详情 ===================== */
app.get('/api/leads/:id', (req, res) => {
  const { token } = req.query;
  if (token !== 'lingui_admin_2026') {
    return res.status(401).json({ error: '口令错误' });
  }
  const leads = readLeads();
  const lead = leads.find(l => l.id === req.params.id);
  if (!lead) return res.status(404).json({ error: '未找到' });
  res.json(lead);
});

/* ===================== API：更新线索状态 ===================== */
app.patch('/api/leads/:id', (req, res) => {
  const { token } = req.query;
  if (token !== 'lingui_admin_2026') {
    return res.status(401).json({ error: '口令错误' });
  }
  const leads = readLeads();
  const idx = leads.findIndex(l => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '未找到' });
  const { status, notes, assignee } = req.body;
  const oldStatus = leads[idx].status;
  if (status) leads[idx].status = status;
  if (notes !== undefined) leads[idx].notes = notes;
  if (assignee !== undefined) leads[idx].assignee = assignee;
  const now = new Date().toISOString();
  if (!leads[idx].events) leads[idx].events = [];
  if (status && status !== oldStatus) leads[idx].events.push({ type:'status', value:status, at:now });
  if (notes !== undefined && notes) leads[idx].events.push({ type:'note', value:notes, at:now });
  if (assignee !== undefined) leads[idx].events.push({ type:'assign', value:assignee||'未分配', at:now });
  writeLeads(leads);
  res.json(leads[idx]);
});

/* ===================== API：导出 CSV ===================== */
app.get('/api/leads/export/csv', (req, res) => {
  const { token } = req.query;
  if (token !== 'lingui_admin_2026') {
    return res.status(401).json({ error: '口令错误' });
  }
  const leads = readLeads();
  const header = '时间,类型,姓名,微信号,综合分,等级,状态\n';
  const rows = leads.map(l =>
    `${l.createdAt},${l.type === 'buyer' ? '买房客户' : '自媒体学员'},${l.name || ''},${l.wechat || ''},${l.total || ''},${l.level || ''},${l.status || 'new'}`
  ).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=lingui_leads.csv');
  res.send('\ufeff' + header + rows);
});

/* ===================== 启动 ===================== */
app.listen(PORT, () => {
  console.log(`\n🐢 灵龟获客 H5 链路 v2.0`);
  console.log(`──────────────────────`);
  console.log(`  Buyer:  http://localhost:${PORT}/buyer/`);
  console.log(`  Student: http://localhost:${PORT}/student/`);
  console.log(`  Admin:  http://localhost:${PORT}/admin/`);
  console.log(`──────────────────────`);
});

/* ===================== 员工管理 API ===================== */
const EMPLOYEES_FILE = path.join(DATA_DIR, 'employees.json');
function readEmployees() {
  ensureDataDir();
  try { return JSON.parse(fs.readFileSync(EMPLOYEES_FILE, 'utf-8')); }
  catch { return []; }
}
function writeEmployees(emps) {
  ensureDataDir();
  fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify(emps, null, 2), 'utf-8');
}

app.get('/api/employees', (req, res) => {
  const { token } = req.query;
  if (token !== 'lingui_admin_2026') return res.status(401).json({ error: '口令错误' });
  res.json({ employees: readEmployees() });
});

app.post('/api/employees', (req, res) => {
  const { token } = req.query;
  if (token !== 'lingui_admin_2026') return res.status(401).json({ error: '口令错误' });
  const { name, phone, title, username, password } = req.body;
  if (!name) return res.status(400).json({ error: '请填写员工姓名' });
  if (!username) return res.status(400).json({ error: '请填写登录账号' });
  const emps = readEmployees();
  if (emps.find(e => e.username === username)) return res.status(400).json({ error: '账号已存在' });
  const emp = { id: 'emp_' + Date.now().toString(36), name: name.trim(), phone: (phone || '').trim(), title: (title || '').trim(), username: username.trim(), password: crypto.createHash('sha256').update(password||'123456').digest('hex'), createdAt: new Date().toISOString() };
  emps.push(emp);
  writeEmployees(emps);
  res.json({ id: emp.id, name: emp.name, phone: emp.phone, title: emp.title, username: emp.username });
});

app.delete('/api/employees/:id', (req, res) => {
  const { token } = req.query;
  if (token !== 'lingui_admin_2026') return res.status(401).json({ error: '口令错误' });
  let emps = readEmployees();
  emps = emps.filter(e => e.id !== req.params.id);
  writeEmployees(emps);
 res.json({ success: true });
});
/* ===================== 员工登录/权限 ===================== */
app.post('/api/employee/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '请填写账号和密码' });
  const emps = readEmployees();
  const emp = emps.find(e => e.username === username && e.password === crypto.createHash('sha256').update(password).digest('hex'));
  if (!emp) return res.status(401).json({ error: '账号或密码错误' });
  emp.token = crypto.randomBytes(16).toString('hex');
  writeEmployees(emps);
  res.json({ token: emp.token, name: emp.name, title: emp.title, id: emp.id });
});
app.get('/api/employee/leads', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(401).json({ error: '未登录' });
  const emps = readEmployees();
  const emp = emps.find(e => e.token === token);
  if (!emp) return res.status(401).json({ error: '登录已过期' });
  const leads = readLeads().filter(l => l.assignee === emp.name);
  res.json({ leads, employee: { name: emp.name, title: emp.title } });
});
app.post('/api/employee/leads/:id/note', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(401).json({ error: '未登录' });
  const emps = readEmployees();
  const emp = emps.find(e => e.token === token);
  if (!emp) return res.status(401).json({ error: '登录已过期' });
  const { note } = req.body;
  if (!note || !note.trim()) return res.status(400).json({ error: '请填写跟进内容' });
  const leads = readLeads();
  const idx = leads.findIndex(l => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '未找到' });
  if (leads[idx].assignee !== emp.name) return res.status(403).json({ error: '无权操作此客户' });
  const now = new Date().toISOString();
  const entry = '[' + emp.name + ' ' + new Date().toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) + '] ' + note.trim();
  leads[idx].notes = (leads[idx].notes||'') + (leads[idx].notes?'\n':'') + entry;
  if (!leads[idx].events) leads[idx].events = [];
  leads[idx].events.push({ type:'note', value:note.trim() + ' (by ' + emp.name + ')', at:now });
  writeLeads(leads);
  res.json({ success: true });
});
app.post('/api/employee/logout', (req, res) => {
  const { token } = req.body;
  if (!token) return res.json({ success: true });
  const emps = readEmployees();
  const emp = emps.find(e => e.token === token);
 if (emp) { delete emp.token; writeEmployees(emps); }
 res.json({ success: true });
});
/* ===================== 客户需求管理 + AI 辅助 ===================== */
app.patch('/api/leads/:id/requirements', (req, res) => {
  const { token } = req.query;
  const { requirements } = req.body;
  if (!token) return res.status(401).json({ error: '未登录' });
  let updater = '';
  const emps = readEmployees();
  const emp = emps.find(e => e.token === token);
  if (emp) {
    const leads = readLeads();
    const lead = leads.find(l => l.id === req.params.id);
    if (!lead) return res.status(404).json({ error: '未找到' });
    if (lead.assignee !== emp.name) return res.status(403).json({ error: '无权操作此客户' });
    updater = emp.name;
  } else if (token === 'lingui_admin_2026') { updater = '管理员'; }
  else { return res.status(401).json({ error: '无权操作' }); }
  const leads = readLeads();
  const idx = leads.findIndex(l => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '未找到' });
  const old = leads[idx].requirements || {};
  if (!leads[idx].requirementHistory) leads[idx].requirementHistory = [];
  if (JSON.stringify(old) !== JSON.stringify(requirements)) {
    leads[idx].requirementHistory.push({ before: old, after: requirements, at: new Date().toISOString(), by: updater });
    if (!leads[idx].events) leads[idx].events = [];
    const cs = [];
    if (old.budget !== requirements.budget) cs.push('预算:'+(old.budget||'未填')+'→'+(requirements.budget||'未填'));
    if (old.area !== requirements.area) cs.push('面积:'+(old.area||'未填')+'→'+(requirements.area||'未填'));
    if (old.location !== requirements.location) cs.push('位置:'+(old.location||'未填')+'→'+(requirements.location||'未填'));
    if (cs.length > 0) leads[idx].events.push({ type:'requirement', value:'需求变更: '+cs.join(', ')+' (by '+updater+')', at:new Date().toISOString() });
  }
  leads[idx].requirements = requirements;
  writeLeads(leads);
  res.json(leads[idx]);
});
app.get('/api/leads/:id/ai-suggest', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(401).json({ error: '未登录' });
  const leads = readLeads();
  const lead = leads.find(l => l.id === req.params.id);
  if (!lead) return res.status(404).json({ error: '未找到' });
  const reqs = lead.requirements || {};
  const hist = lead.requirementHistory || [];
  const last = hist.length > 0 ? hist[hist.length-1] : null;
  const sug = [];
  if (last && last.before && last.after) {
    const b = last.before, a = last.after;
    if (a.budget && b.budget && a.budget !== b.budget) {
      const diff = parseInt(a.budget)-parseInt(b.budget);
      if (diff > 0) sug.push('💰 预算提升'+diff+'万→购买力增强，可推荐更高品质房源');
      else sug.push('💰 预算减少'+Math.abs(diff)+'万→关注资金状况，调整推荐策略');
    }
    if (a.area && b.area && a.area !== b.area) sug.push('🏠 面积需求从'+b.area+'变为'+a.area+'→重新匹配对应户型');
    if (a.location && b.location && a.location !== b.location) sug.push('📍 关注区域从"'+b.location+'"变为"'+a.location+'"→重新推荐板块房源');
  }
  if (!reqs.budget && !reqs.area && !reqs.location) sug.push('📝 尚未记录客户需求信息，建议先了解预算、面积、位置等基础需求');
  if (sug.length === 0 && last) sug.push('✅ 需求暂无新变更，保持现有跟进节奏即可');
  if (sug.length === 0) sug.push('📝 暂无需求信息，建议先了解客户需求再使用AI分析');
  res.json({ suggestions: sug });
});
