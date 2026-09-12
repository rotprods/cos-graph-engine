import { randomBytes } from 'node:crypto';

export interface OperatorPage {
  html: string;
  nonce: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char] || char);
}

function nonce(): string {
  return randomBytes(18).toString('base64');
}

const STYLE = `
*{box-sizing:border-box}body{margin:0;background:#0d1117;color:#c9d1d9;font-family:system-ui,-apple-system,sans-serif;padding:24px}
main{max-width:920px;margin:auto}.card{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:18px;margin:14px 0}
h1{color:#58a6ff;font-size:22px}h2{font-size:15px;color:#e6edf3}p{line-height:1.5;color:#b1bac4}.row{display:flex;gap:8px;flex-wrap:wrap}
input,textarea{width:100%;background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:7px;padding:10px;font:inherit}
textarea{min-height:90px;resize:vertical}button{background:#238636;color:#fff;border:0;border-radius:7px;padding:9px 14px;font-weight:600;cursor:pointer}
button.secondary{background:#1f6feb}button.danger{background:#8b1a1a}button:disabled{opacity:.5;cursor:not-allowed}
pre{white-space:pre-wrap;word-break:break-word;background:#0d1117;border:1px solid #30363d;border-radius:7px;padding:12px;min-height:54px}
.status{font-size:12px;color:#8b949e}.status.ok{color:#3fb950}.status.warn{color:#d29922}.status.bad{color:#f85149}
small{color:#8b949e}a{color:#58a6ff}
`;

function commonScript(extra: string): string {
  return `
'use strict';
let credential = '';
const authInput = document.getElementById('operator-token');
const authState = document.getElementById('auth-state');
function setAuthState(message, kind) { authState.textContent = message; authState.className = 'status ' + (kind || ''); }
function connectCredential() {
  const value = String(authInput.value || '').trim();
  authInput.value = '';
  if (!value) { setAuthState('Paste a bearer credential first.', 'warn'); return; }
  if (/[\\r\\n]/.test(value)) { setAuthState('Credential contains an invalid line break.', 'bad'); return; }
  credential = value;
  setAuthState('Credential loaded in memory only. Reloading the page clears it.', 'ok');
}
function clearCredential() { credential = ''; authInput.value = ''; setAuthState('No credential loaded.', 'warn'); }
async function readPayload(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { error: 'Non-JSON response' }; }
}
async function cosFetch(path, options, requiresAuth) {
  const requestOptions = options || {};
  const headers = new Headers(requestOptions.headers || {});
  headers.set('Accept', 'application/json');
  if (requiresAuth !== false) {
    if (!credential) throw new Error('Authentication required. Load an operator credential in memory.');
    headers.set('Authorization', 'Bearer ' + credential);
  }
  const response = await fetch(path, Object.assign({}, requestOptions, { headers }));
  const payload = await readPayload(response);
  if (response.status === 401) {
    credential = '';
    setAuthState('Credential rejected or expired; it has been cleared from page memory.', 'bad');
    throw new Error('Authentication required or expired.');
  }
  if (response.status === 403) throw new Error('Forbidden: credential lacks permission for this operation.');
  if (!response.ok) throw new Error((payload && payload.error) ? String(payload.error) : ('HTTP ' + response.status));
  return payload;
}
function render(id, value) {
  const target = document.getElementById(id);
  target.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}
document.getElementById('connect-token').addEventListener('click', connectCredential);
document.getElementById('clear-token').addEventListener('click', clearCredential);
window.addEventListener('beforeunload', function () { credential = ''; });
${extra}
`;
}

function shell(title: string, nonceValue: string, content: string, script: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${STYLE}</style></head><body><main><h1>${escapeHtml(title)}</h1><p>Protected actions require a bearer credential. The browser keeps it only in JavaScript memory: no query string, cookie, localStorage or sessionStorage.</p><section class="card"><h2>Operator authentication</h2><input id="operator-token" type="password" autocomplete="off" spellcheck="false" placeholder="Paste bearer token"><div class="row" style="margin-top:8px"><button id="connect-token">Load credential</button><button id="clear-token" class="danger">Clear credential</button></div><p id="auth-state" class="status warn">No credential loaded.</p></section>${content}<p><small>Fresh local admin bootstrap: use the deployment CLI <code>bootstrap-admin</code> with a strong local <code>COS_JWT_SECRET</code>. This page intentionally has no anonymous bootstrap flow.</small></p></main><script nonce="${nonceValue}">${script}</script></body></html>`;
}

export function createOperatorDashboardPage(): OperatorPage {
  const nonceValue = nonce();
  const content = `<section class="card"><h2>Public health</h2><button id="load-health" class="secondary">Refresh health</button><pre id="health-output">Not loaded.</pre></section><section class="card"><h2>Protected system stats</h2><button id="load-stats">Load stats</button><pre id="stats-output">Authenticate first.</pre></section><section class="card"><h2>Protected process</h2><textarea id="process-input" placeholder="Input for /process"></textarea><button id="run-process">Process</button><pre id="process-output">Authenticate first.</pre></section>`;
  const script = commonScript(`
async function loadHealth() { try { render('health-output', await cosFetch('/health', {}, false)); } catch (error) { render('health-output', 'Error: ' + error.message); } }
async function loadStats() { try { render('stats-output', await cosFetch('/stats', {}, true)); } catch (error) { render('stats-output', 'Error: ' + error.message); } }
async function runProcess() {
  const input = document.getElementById('process-input').value;
  try { render('process-output', await cosFetch('/process', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: input }) }, true)); }
  catch (error) { render('process-output', 'Error: ' + error.message); }
}
document.getElementById('load-health').addEventListener('click', loadHealth);
document.getElementById('load-stats').addEventListener('click', loadStats);
document.getElementById('run-process').addEventListener('click', runProcess);
void loadHealth();`);
  return { html: shell('COS Operator Console', nonceValue, content, script), nonce: nonceValue };
}

export function createOperatorActionPage(title: string, endpoint: '/chat' | '/research', field: 'message' | 'question'): OperatorPage {
  const nonceValue = nonce();
  const safeTitle = escapeHtml(title);
  const content = `<section class="card"><h2>${safeTitle}</h2><textarea id="action-input" placeholder="Enter ${escapeHtml(field)}"></textarea><button id="run-action">Send authenticated request</button><pre id="action-output">Authenticate first.</pre></section>`;
  const script = commonScript(`
const actionEndpoint = ${JSON.stringify(endpoint)};
const actionField = ${JSON.stringify(field)};
async function runAction() {
  const value = document.getElementById('action-input').value;
  const body = {}; body[actionField] = value;
  try { render('action-output', await cosFetch(actionEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, true)); }
  catch (error) { render('action-output', 'Error: ' + error.message); }
}
document.getElementById('run-action').addEventListener('click', runAction);`);
  return { html: shell(title, nonceValue, content, script), nonce: nonceValue };
}
