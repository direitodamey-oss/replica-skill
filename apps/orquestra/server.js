// Servidor do Orquestra: arquivos estáticos + quatro rotas de API.
// Sem framework; só o módulo http do Node e o SDK da Anthropic.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODELS, DEFAULT_MODEL } from './lib/models.js';
import { BadRequest, buildImageRequest, buildRequest } from './lib/prompt.js';

const ROOT = fileURLToPath(new URL('./public/', import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const MAX_BODY = 30 * 1024 * 1024; // anexos chegam em base64
const DEMO = !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN;

const backend = DEMO ? await import('./lib/demo.js') : await import('./lib/claude.js');
const streamChat = DEMO ? backend.streamDemo : backend.streamChat;
const makeTitle = DEMO ? backend.demoTitle : backend.generateTitle;
const makeSvg = DEMO ? (p) => backend.demoSvg(p) : backend.generateSvg;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new BadRequest('anexos grandes demais (limite de 30 MB por mensagem)'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new BadRequest('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function errorMessage(err) {
  if (err instanceof BadRequest) return err.message;
  if (err && err.status === 401) return 'Chave da API inválida. Confira ANTHROPIC_API_KEY.';
  if (err && err.status === 429) return 'Muitas requisições agora. Espere alguns segundos e tente de novo.';
  if (err && err.status === 400) return `A API recusou a requisição: ${err.message}`;
  if (err && err.status >= 500) return 'O serviço de IA está instável. Tente de novo em instantes.';
  return (err && err.message) || 'Erro inesperado.';
}

async function handleChat(req, res) {
  const params = buildRequest(await readJson(req));
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });
  const controller = new AbortController();
  res.on('close', () => controller.abort());
  const emit = (e) => res.write(`data: ${JSON.stringify(e)}\n\n`);
  try {
    await streamChat(params, emit, controller.signal);
  } catch (err) {
    if (!controller.signal.aborted) emit({ type: 'error', text: errorMessage(err) });
  }
  res.end();
}

async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://x');
  let path = decodeURIComponent(url.pathname);
  if (path === '/' || !extname(path)) path = '/index.html';
  const file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) return sendJson(res, 403, { error: 'proibido' });
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    sendJson(res, 404, { error: 'não encontrado' });
  }
}

export const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://x');
    if (req.method === 'GET' && pathname === '/api/config') {
      return sendJson(res, 200, { demo: DEMO, models: MODELS, defaultModel: DEFAULT_MODEL });
    }
    if (req.method === 'POST' && pathname === '/api/chat') return await handleChat(req, res);
    if (req.method === 'POST' && pathname === '/api/title') {
      const { text } = await readJson(req);
      return sendJson(res, 200, { title: await makeTitle(text || '') });
    }
    if (req.method === 'POST' && pathname === '/api/image') {
      const params = buildImageRequest(await readJson(req));
      return sendJson(res, 200, { svg: await makeSvg(params) });
    }
    if (req.method === 'GET') return await serveStatic(req, res);
    sendJson(res, 405, { error: 'método não permitido' });
  } catch (err) {
    if (res.headersSent) return res.end();
    sendJson(res, err instanceof BadRequest ? 400 : 502, { error: errorMessage(err) });
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => {
    console.log(`Orquestra em http://localhost:${PORT}${DEMO ? ' (modo demonstração: defina ANTHROPIC_API_KEY)' : ''}`);
  });
}
