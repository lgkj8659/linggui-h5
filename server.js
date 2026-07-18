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
  const { status, notes } = req.body;
  if (status) leads[idx].status = status;
  if (notes !== undefined) leads[idx].notes = notes;
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
