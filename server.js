// Personal file server. Run: npm install && PASSWORD=yourpassword npm start
const express = require('express');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.PASSWORD;
if (!PASSWORD) { console.error('Set a password first: PASSWORD=yourpassword npm start'); process.exit(1); }
const ROOT = path.resolve(process.env.STORAGE_DIR || path.join(__dirname, 'storage'));
fs.mkdirSync(ROOT, { recursive: true });

const sessions = new Set();
const app = express();
app.use(express.json());
app.use(cookieParser());

// Resolve a user-supplied path inside ROOT only (blocks ../ escapes)
function safe(p = '') {
  const full = path.resolve(ROOT, '.' + path.sep + p);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) throw new Error('Invalid path');
  return full;
}
const auth = (req, res, next) =>
  sessions.has(req.cookies.sid) ? next() : res.status(401).json({ error: 'Not signed in' });

// Basic brute-force limit on login
const attempts = {};
app.post('/api/login', (req, res) => {
  const ip = req.ip, now = Date.now();
  const a = (attempts[ip] = (attempts[ip] || []).filter(t => now - t < 600000));
  if (a.length >= 8) return res.status(429).json({ error: 'Too many attempts. Try again in 10 minutes.' });
  const given = Buffer.from(String(req.body.password || ''));
  const real = Buffer.from(PASSWORD);
  if (given.length !== real.length || !crypto.timingSafeEqual(given, real)) {
    a.push(now);
    return res.status(401).json({ error: 'Wrong password' });
  }
  const sid = crypto.randomBytes(32).toString('hex');
  sessions.add(sid);
  res.cookie('sid', sid, { httpOnly: true, sameSite: 'strict', maxAge: 7 * 864e5 });
  res.json({ ok: true });
});
app.post('/api/logout', (req, res) => { sessions.delete(req.cookies.sid); res.clearCookie('sid'); res.json({ ok: true }); });
app.get('/api/me', auth, (req, res) => res.json({ ok: true }));

app.get('/api/list', auth, (req, res) => {
  try {
    const dir = safe(req.query.path);
    const items = fs.readdirSync(dir, { withFileTypes: true }).map(d => {
      const st = fs.statSync(path.join(dir, d.name));
      return { name: d.name, dir: d.isDirectory(), size: st.size, modified: st.mtimeMs };
    });
    items.sort((x, y) => y.dir - x.dir || x.name.localeCompare(y.name));
    const total = items.reduce((s, i) => s + (i.dir ? 0 : i.size), 0);
    res.json({ items, total });
  } catch (e) { res.status(400).json({ error: 'Cannot open this folder' }); }
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, f, cb) => { try { const d = safe(req.query.path); fs.mkdirSync(d, { recursive: true }); cb(null, d); } catch (e) { cb(e); } },
    filename: (req, f, cb) => cb(null, path.basename(Buffer.from(f.originalname, 'latin1').toString('utf8')))
  })
});
app.post('/api/upload', auth, upload.array('files'), (req, res) => res.json({ ok: true, count: req.files.length }));

app.get('/api/download', auth, (req, res) => {
  try {
    const f = safe(req.query.path);
    if (!fs.statSync(f).isFile()) throw new Error();
    res.download(f);
  } catch { res.status(404).json({ error: 'File not found' }); }
});

app.post('/api/mkdir', auth, (req, res) => {
  try { fs.mkdirSync(safe(path.join(req.body.path || '', req.body.name)), { recursive: true }); res.json({ ok: true }); }
  catch { res.status(400).json({ error: 'Cannot create folder' }); }
});
app.post('/api/rename', auth, (req, res) => {
  try {
    const from = safe(req.body.path);
    fs.renameSync(from, path.join(path.dirname(from), path.basename(req.body.name)));
    res.json({ ok: true });
  } catch { res.status(400).json({ error: 'Cannot rename' }); }
});
app.post('/api/delete', auth, (req, res) => {
  try {
    const t = safe(req.body.path);
    if (t === ROOT) throw new Error();
    fs.rmSync(t, { recursive: true, force: true });
    res.json({ ok: true });
  } catch { res.status(400).json({ error: 'Cannot delete' }); }
});

app.use(express.static(path.join(__dirname, 'public')));
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://localhost:${PORT}\nFiles are stored in ${ROOT}`));
