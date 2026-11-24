const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Database ──────────────────────────────────────────────────────
const DB_FILE = path.join(__dirname, 'database.json');

function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function saveDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Erro ao salvar DB:', err);
  }
}

function getDB() {
  let db = loadDB();
  if (!db) {
    const hash = bcrypt.hashSync('admin123', 10);
    db = {
      orders: [],
      admin: { username: 'admin', password: hash },
      settings: {
        pixKey: '66992730310',
        pixKeyType: 'Celular',
        pixName: 'Bingo da Família',
      },
      nextOrderId: 1,
    };
    saveDB(db);
  }
  return db;
}

// ─── Middleware ─────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve arquivos estáticos da raiz ou da pasta public
app.use(express.static(__dirname));
if (fs.existsSync(path.join(__dirname, 'public'))) {
  app.use(express.static(path.join(__dirname, 'public')));
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'bingo-da-familia-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 4 * 60 * 60 * 1000 },
  })
);

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.status(401).json({ error: 'Não autorizado' });
}

// ─── Public API ────────────────────────────────────────────────────
app.get('/api/pix-config', (req, res) => {
  const db = getDB();
  res.json({
    pixKey: db.settings.pixKey,
    pixKeyType: db.settings.pixKeyType,
    pixName: db.settings.pixName,
  });
});

app.post('/api/orders', (req, res) => {
  const { customerName, whatsapp, quantity } = req.body;

  if (!customerName || typeof customerName !== 'string' || customerName.trim().length < 3) {
    return res.status(400).json({ error: 'Nome completo é obrigatório (mínimo 3 caracteres).' });
  }
  const cleanPhone = String(whatsapp || '').replace(/\D/g, '');
  if (cleanPhone.length < 10 || cleanPhone.length > 11) {
    return res.status(400).json({ error: 'Número de WhatsApp inválido.' });
  }
  const qty = parseInt(quantity, 10);
  if (!qty || qty < 1 || qty > 1000) {
    return res.status(400).json({ error: 'Quantidade inválida.' });
  }

  const db = getDB();
  const order = {
    id: db.nextOrderId++,
    customerName: customerName.trim(),
    whatsapp: cleanPhone,
    quantity: qty,
    totalValue: qty * 2,
    status: 'pendente',
    createdAt: new Date().toISOString(),
  };
  db.orders.push(order);
  saveDB(db);

  res.status(201).json(order);
});

// ─── Admin API ─────────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const db = getDB();

  if (username === db.admin.username && bcrypt.compareSync(password || '', db.admin.password)) {
    req.session.isAdmin = true;
    return res.json({ success: true });
  }
  res.status(401).json({ error: 'Usuário ou senha inválidos.' });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/admin/check', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.isAdmin) });
});

app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const db = getDB();
  res.json([...db.orders].reverse());
});

app.patch('/api/admin/orders/:id/status', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { status } = req.body;

  if (!['pendente', 'pago'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido.' });
  }

  const db = getDB();
  const order = db.orders.find((o) => o.id === id);
  if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });

  order.status = status;
  saveDB(db);
  res.json(order);
});

app.delete('/api/admin/orders/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const db = getDB();
  const index = db.orders.findIndex((o) => o.id === id);
  if (index === -1) return res.status(404).json({ error: 'Pedido não encontrado.' });

  db.orders.splice(index, 1);
  saveDB(db);
  res.json({ success: true });
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const db = getDB();
  const orders = db.orders;

  const totalOrders = orders.length;
  const paidOrders = orders.filter((o) => o.status === 'pago');
  const pendingOrders = orders.filter((o) => o.status === 'pendente');

  res.json({
    totalOrders,
    totalPaid: paidOrders.length,
    totalPending: pendingOrders.length,
    totalRevenue: paidOrders.reduce((sum, o) => sum + o.totalValue, 0),
    totalCards: paidOrders.reduce((sum, o) => sum + o.quantity, 0),
    totalPendingRevenue: pendingOrders.reduce((sum, o) => sum + o.totalValue, 0),
    totalPendingCards: pendingOrders.reduce((sum, o) => sum + o.quantity, 0),
  });
});

app.get('/api/admin/settings', requireAdmin, (req, res) => {
  const db = getDB();
  res.json(db.settings);
});

app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const { pixKey, pixKeyType, pixName } = req.body;
  const db = getDB();

  if (pixKey !== undefined) db.settings.pixKey = String(pixKey).trim();
  if (pixKeyType !== undefined) db.settings.pixKeyType = String(pixKeyType);
  if (pixName !== undefined) db.settings.pixName = String(pixName).trim();

  saveDB(db);
  res.json(db.settings);
});

app.put('/api/admin/password', requireAdmin, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const db = getDB();

  if (!bcrypt.compareSync(currentPassword || '', db.admin.password)) {
    return res.status(400).json({ error: 'Senha atual incorreta.' });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
  }

  db.admin.password = bcrypt.hashSync(newPassword, 10);
  saveDB(db);
  res.json({ success: true });
});

// ─── Pages ─────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  const p = path.join(__dirname, 'index.html');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  const p = path.join(__dirname, 'admin.html');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ─── Start ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Bingo rodando na porta ${PORT}`);
});
