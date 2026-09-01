/**
 * Login gateway for the self-hosted Evidence dashboard.
 *
 * Serves a styled login page, validates credentials against
 * EVIDENCE_BASIC_USER / EVIDENCE_BASIC_PASSWORD, issues an HMAC-signed
 * session cookie, and proxies all authenticated traffic to `evidence serve`
 * running on 127.0.0.1:3001 with EVIDENCE_AUTH_DISABLED=true.
 *
 * This implements the "authenticating reverse proxy" pattern from
 * https://docs.evidence.dev/self-host/authentication — the proxy is the
 * authentication boundary; Evidence runs with built-in auth disabled.
 */
const http = require('node:http');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 3000);
const UPSTREAM = '127.0.0.1';
const UPSTREAM_PORT = Number(process.env.UPSTREAM_PORT || 3001);
const USER = process.env.EVIDENCE_BASIC_USER || 'admin';
const PASSWORD = process.env.EVIDENCE_BASIC_PASSWORD || '';
const SECRET = process.env.LOGIN_SECRET || crypto.createHash('sha256').update(`fallback:${USER}:${PASSWORD}`).digest('hex');
const COOKIE = 'evd_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

const timingSafeEqual = (a, b) => {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
};

const sign = (payload) => crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');

const makeToken = () => {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `${USER}.${exp}`;
  return `${payload}.${sign(payload)}`;
};

const verifyToken = (token) => {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [user, exp, sig] = parts;
  const payload = `${user}.${exp}`;
  const expected = sign(payload);
  if (!timingSafeEqual(sig, expected)) return false;
  if (Number(exp) < Date.now()) return false;
  return timingSafeEqual(user, USER);
};

const parseCookies = (req) => Object.fromEntries(
  (req.headers.cookie || '').split(';').map((c) => {
    const i = c.indexOf('=');
    return i < 0 ? [] : [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1).trim())];
  }).filter((p) => p.length === 2)
);

const LOGIN_PAGE = (error = '') => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in — Sales Dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #09090b; color: #fafafa; padding: 24px;
  }
  .card {
    width: 100%; max-width: 360px; background: #101012;
    border: 1px solid #27272a; border-radius: 12px;
    padding: 36px 32px;
  }
  h1 { font-size: 18px; font-weight: 600; text-align: center; color: #fafafa; letter-spacing: -.01em; }
  p.sub { font-size: 13px; color: #a1a1aa; text-align: center; margin: 6px 0 26px; }
  label { display: block; font-size: 12px; font-weight: 500; color: #a1a1aa; margin: 14px 0 6px; }
  input {
    width: 100%; padding: 11px 13px; font-size: 14px; color: #fafafa;
    background: #09090b; border: 1px solid #27272a;
    border-radius: 8px; outline: none; transition: border-color .15s;
  }
  input:focus { border-color: #fafafa; }
  button {
    width: 100%; margin-top: 24px; padding: 11px; font-size: 14px; font-weight: 600;
    color: #09090b; background: #fafafa;
    border: none; border-radius: 8px; cursor: pointer; transition: background .15s;
  }
  button:hover { background: #e4e4e7; }
  .error {
    display: ${error ? 'block' : 'none'}; margin-top: 16px; padding: 10px 12px;
    font-size: 13px; color: #f87171; background: rgba(239, 68, 68, .08);
    border: 1px solid rgba(239, 68, 68, .25); border-radius: 8px; text-align: center;
  }
  .footer { margin-top: 22px; font-size: 11px; color: #52525b; text-align: center; }
</style>
</head>
<body>
  <form class="card" method="POST" action="/login">
    <h1>Sales Dashboard</h1>
    <p class="sub">Sign in to view live reports</p>
    <label for="username">Username</label>
    <input id="username" name="username" type="text" autocomplete="username" required autofocus>
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required>
    <button type="submit">Sign in</button>
    <div class="error">Invalid username or password</div>
    <div class="footer">Protected workspace · ${new Date().getFullYear()}</div>
  </form>
</body>
</html>`;

const STARTING_PAGE = `<!doctype html><html><head><meta http-equiv="refresh" content="3"><style>
body{font-family:system-ui;background:#09090b;color:#a1a1aa;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
</style></head><body>Dashboard is starting…</body></html>`;

let upstreamUp = false;
const proxy = (req, res) => {
  const fwd = http.request(
    { host: UPSTREAM, port: UPSTREAM_PORT, path: req.url, method: req.method, headers: { ...req.headers, host: `${UPSTREAM}:${UPSTREAM_PORT}` } },
    (up) => {
      upstreamUp = true;
      res.writeHead(up.statusCode, up.headers);
      up.pipe(res);
    }
  );
  fwd.on('error', () => {
    upstreamUp = false;
    res.writeHead(503, { 'content-type': 'text/html', 'retry-after': '3' });
    res.end(STARTING_PAGE);
  });
  req.pipe(fwd);
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');

  if (url.pathname === '/login' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(LOGIN_PAGE());
  }

  if (url.pathname === '/login' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e4) req.destroy(); });
    req.on('end', () => {
      const params = new URLSearchParams(body);
      const ok = timingSafeEqual(params.get('username') || '', USER) && timingSafeEqual(params.get('password') || '', PASSWORD);
      if (!ok) {
        res.writeHead(401, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(LOGIN_PAGE('invalid'));
      }
      res.writeHead(302, {
        'set-cookie': `${COOKIE}=${encodeURIComponent(makeToken())}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`,
        location: '/'
      });
      res.end();
    });
    return;
  }

  if (url.pathname === '/logout') {
    res.writeHead(302, { 'set-cookie': `${COOKIE}=; Path=/; HttpOnly; Max-Age=0`, location: '/login' });
    return res.end();
  }

  const cookies = parseCookies(req);

  // The {% html %} sandbox iframe runs on an opaque origin and cannot send
  // cookies, so its runtime asset must be served without auth. It is static
  // framework JavaScript and carries no data.
  if (url.pathname.startsWith('/sandbox/')) {
    return proxy(req, res);
  }

  if (!verifyToken(cookies[COOKIE])) {
    res.writeHead(302, { location: '/login' });
    return res.end();
  }

  proxy(req, res);
});

server.listen(PORT, '0.0.0.0', () => console.log(`login gateway listening on :${PORT} → upstream :${UPSTREAM_PORT}`));
