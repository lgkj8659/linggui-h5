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
/* ===================== AI 配置管理 ===================== */
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
function readConfig() {
  ensureDataDir();
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')); }
  catch { return {}; }
}
function writeConfig(cfg) {
  ensureDataDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
}
app.post('/api/config', (req, res) => {
  const { token } = req.query;
  if (token !== 'lingui_admin_2026') return res.status(401).json({ error: '\u53e3\u4ee4\u9519\u8bef' });
  const { deepseekKey } = req.body;
  const cfg = readConfig();
  if (deepseekKey !== undefined) cfg.deepseekKey = deepseekKey;
  writeConfig(cfg);
  res.json({ success: true, hasKey: !!cfg.deepseekKey });
});
app.get('/api/config', (req, res) => {
  const { token } = req.query;
  if (token !== 'lingui_admin_2026') return res.status(401).json({ error: '\u53e3\u4ee4\u9519\u8bef' });
  const cfg = readConfig();
  res.json({ hasKey: !!cfg.deepseekKey });
});
/* ===================== AI \u5206\u6790\u5efa\u8bae\uff08DeepSeek\uff09 ===================== */
app.get('/api/leads/:id/ai-suggest', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(401).json({ error: '\u672a\u767b\u5f55' });
  const leads = readLeads();
  const lead = leads.find(l => l.id === req.params.id);
  if (!lead) return res.status(404).json({ error: '\u672a\u627e\u5230' });
  const cfg = readConfig();
  const apiKey = cfg.deepseekKey || process.env.DEEPSEEK_API_KEY || '';
  // \u65e0 API Key \u2192 \u89c4\u5219\u5f15\u64ce\u515c\u5e95
  if (!apiKey) {
    const reqs = lead.requirements || {};
    const hist = lead.requirementHistory || [];
    const last = hist.length > 0 ? hist[hist.length-1] : null;
    const sug = [];
    if (last && last.before && last.after) {
      const b = last.before, a = last.after;
      if (a.budget && b.budget && a.budget !== b.budget) {
        const diff = parseInt(a.budget) - parseInt(b.budget);
        if (diff > 0) sug.push('\u{1F4B0} \u9884\u7b97\u63d0\u5347' + diff + '\u4e07\u2192\u8d2d\u4e70\u529b\u589e\u5f3a\uff0c\u53ef\u63a8\u8350\u66f4\u9ad8\u54c1\u8d28\u623f\u6e90');
        else sug.push('\u{1F4B0} \u9884\u7b97\u51cf\u5c11' + Math.abs(diff) + '\u4e07\u2192\u5173\u6ce8\u8d44\u91d1\u72b6\u51b5\uff0c\u8c03\u6574\u63a8\u8350\u7b56\u7565');
      }
      if (a.area && b.area && a.area !== b.area) sug.push('\u{1F3E0} \u9762\u79ef\u9700\u6c42\u4ece' + b.area + '\u53d8\u4e3a' + a.area + '\u2192\u91cd\u65b0\u5339\u914d\u5bf9\u5e94\u6237\u578b');
      if (a.location && b.location && a.location !== b.location) sug.push('\u{1F4CD} \u5173\u6ce8\u533a\u57df\u4ece"' + b.location + '"\u53d8\u4e3a"' + a.location + '"\u2192\u91cd\u65b0\u63a8\u8350\u677f\u5757\u623f\u6e90');
    }
    if (sug.length === 0) sug.push('\u{1F4DD} \u6682\u65e0\u9700\u6c42\u53d8\u66f4\u4fe1\u606f\uff0c\u5efa\u8bae\u5148\u4e86\u89e3\u5ba2\u6237\u57fa\u7840\u9700\u6c42');
    return res.json({ suggestions: sug, source: 'rules' });
  }
  // \u8c03 DeepSeek API
  try {
    const reqs = lead.requirements || {};
    const hist = lead.requirementHistory || [];
    let ch = '';
    if (hist.length > 0) {
      ch = '\n\u9700\u6c42\u53d8\u66f4\u5386\u53f2\uff1a\n';
      hist.forEach(function(h) {
        ch += '- ';
        if (h.before && h.after) {
          if (h.before.budget !== h.after.budget) ch += '\u9884\u7b97\uff1a' + h.before.budget + '\u2192' + h.after.budget + ' ';
          if (h.before.area !== h.after.area) ch += '\u9762\u79ef\uff1a' + h.before.area + '\u2192' + h.after.area + ' ';
          if (h.before.location !== h.after.location) ch += '\u4f4d\u7f6e\uff1a' + h.before.location + '\u2192' + h.after.location + ' ';
          ch += '(' + h.by + ')\n';
        }
      });
    }
    const ts = lead.type === 'buyer' ? '\u4e70\u623f\u5ba2\u6237' : '\u81ea\u5a92\u4f53\u5b66\u5458';
    const sc = (lead.result && lead.result.total) || lead.total || '';
    const prompt = '\u4f60\u662f\u4e00\u4e2a\u4e13\u4e1a\u7684\u623f\u4ea7\u987e\u95eeAI\u52a9\u624b\u3002\u8bf7\u6839\u636e\u4ee5\u4e0b\u5ba2\u6237\u4fe1\u606f\u7ed9\u51fa3\u6761\u5177\u4f53\u7684\u8ddf\u8fdb\u5efa\u8bae\uff1a\n\n\u5ba2\u6237\u7c7b\u578b\uff1a' + ts + '\n\u7efc\u5408\u8bc4\u5206\uff1a' + sc + '\n\u5f53\u524d\u9700\u6c42\uff1a' + (reqs.budget ? '\u9884\u7b97' + reqs.budget : '\u672a\u586b') + ' ' + (reqs.area ? '\u9762\u79ef' + reqs.area : '\u672a\u586b') + ' ' + (reqs.location ? '\u4f4d\u7f6e' + reqs.location : '\u672a\u586b') + '\n' + ch + '\n\u8981\u6c42\uff1a\u6bcf\u6761\u5efa\u8bae\u8981\u5177\u4f53\u3001\u53ef\u64cd\u4f5c\uff0c\u5305\u542b\u5b9e\u9645\u8bdd\u672f\u6216\u63a8\u8350\u65b9\u5411\u3002\u4e0d\u8981\u7b80\u5355\u3001\u4e0d\u8981\u91cd\u590d\u3002';
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'system', content: '\u4f60\u662f\u4e00\u4e2a\u4e13\u4e1a\u7684\u623f\u4ea7\u987e\u95eeAI\u52a9\u624b\u3002\u56de\u590d\u8981\u7b80\u6d01\u3001\u5177\u4f53\u3001\u53ef\u64cd\u4f5c\u3002\u7528\u4e2d\u6587\u56de\u590d\u3002' }, { role: 'user', content: prompt }], max_tokens: 600 })
    });
    const data = await resp.json();
    if (data.error) return res.json({ suggestions: ['AI\u8bf7\u6c42\u5931\u8d25'], source: 'error' });
    const c = data.choices[0].message.content;
    const sugs = c.split(/\d+[.\u3001]/).filter(function(s) { return s.trim(); }).map(function(s) { return s.trim(); }).slice(0, 5);
    res.json({ suggestions: sugs, source: 'deepseek' });
  } catch (e) {
    res.json({ suggestions: ['AI\u670d\u52a1\u6682\u65f6\u4e0d\u53ef\u7528'], source: 'error' });
  }
});

