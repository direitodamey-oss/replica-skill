import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;
const { server } = await import('../server.js');
let base;

before(() => new Promise((r) => server.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); })));
after(() => new Promise((r) => server.close(r)));

const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('config informa modo demonstração e modelos', async () => {
  const c = await (await fetch(base + '/api/config')).json();
  assert.equal(c.demo, true);
  assert.equal(c.defaultModel, 'claude-opus-5-5');
  assert.ok(c.models.length >= 4);
});

test('chat transmite eventos e termina com done', async () => {
  const res = await post('/api/chat', { messages: [{ role: 'user', text: 'olá' }], options: { webSearch: true, deepThinking: true } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /event-stream/);
  const events = (await res.text()).split('\n\n').filter(Boolean).map((l) => JSON.parse(l.slice(6)));
  const types = new Set(events.map((e) => e.type));
  for (const t of ['thinking', 'source', 'text', 'done']) assert.ok(types.has(t), t);
  assert.match(events.filter((e) => e.type === 'text').map((e) => e.text).join(''), /olá/);
});

test('pedido ruim responde 400 com mensagem', async () => {
  const res = await post('/api/chat', { messages: [] });
  assert.equal(res.status, 400);
  assert.ok((await res.json()).error);
});

test('imagem e título funcionam no modo demonstração', async () => {
  const img = await (await post('/api/image', { prompt: 'um farol', ratio: '9:16' })).json();
  assert.match(img.svg, /^<svg[\s\S]*viewBox="0 0 720 1280"[\s\S]*<\/svg>$/);
  const t = await (await post('/api/title', { text: 'Como montar um plano de marketing para minha loja' })).json();
  assert.equal(t.title, 'Como montar um plano de marketing');
});

test('arquivos estáticos e proteção contra path traversal', async () => {
  const home = await fetch(base + '/');
  assert.match(await home.text(), /<title>Orquestra<\/title>/);
  const js = await fetch(base + '/js/app.js');
  assert.match(js.headers.get('content-type'), /javascript/);
  const evil = await fetch(base + '/%2e%2e/server.js');
  assert.ok([403, 404].includes(evil.status));
  const evil2 = await fetch(base + '/..%2fpackage.json');
  assert.ok([403, 404].includes(evil2.status));
});
