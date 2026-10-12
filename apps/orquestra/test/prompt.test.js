import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRequest, buildImageRequest, extractSvg, fallbackTitle, BadRequest } from '../lib/prompt.js';
import { handleEvent } from '../lib/claude.js';

const user = (text, attachments = []) => ({ role: 'user', text, attachments });

test('pedido simples usa o modelo padrão, esforço baixo e fallbacks', () => {
  const p = buildRequest({ messages: [user('oi')] });
  assert.equal(p.model, 'claude-opus-5-5');
  assert.equal(p.output_config.effort, 'low');
  assert.equal(p.thinking, undefined);
  assert.deepEqual(p.betas, ['server-side-fallback-2026-07-01']);
  assert.equal(p.fallbacks, 'default');
  assert.deepEqual(p.messages, [{ role: 'user', content: [{ type: 'text', text: 'oi' }] }]);
});

test('raciocínio liga thinking adaptive com resumo e esforço alto', () => {
  const p = buildRequest({ messages: [user('x')], options: { deepThinking: true } });
  assert.deepEqual(p.thinking, { type: 'adaptive', display: 'summarized' });
  assert.equal(p.output_config.effort, 'high');
});

test('pesquisa web só entra em modelos que aceitam', () => {
  const on = buildRequest({ model: 'claude-sonnet-5-5', messages: [user('x')], options: { webSearch: true } });
  assert.equal(on.tools[0].type, 'web_search_20260209');
  const off = buildRequest({ model: 'claude-haiku-5-5', messages: [user('x')], options: { webSearch: true } });
  assert.equal(off.tools, undefined);
  assert.equal(off.fallbacks, undefined, 'Haiku não tem fallback server-side');
});

test('anexos viram blocos de imagem, documento e texto', () => {
  const p = buildRequest({
    messages: [user('leia', [
      { name: 'a.png', mime: 'image/png', data: 'AAA' },
      { name: 'b.pdf', mime: 'application/pdf', data: 'BBB' },
      { name: 'c.txt', mime: 'text/plain', text: 'olá' },
    ])],
  });
  const types = p.messages[0].content.map((b) => b.type);
  assert.deepEqual(types, ['image', 'document', 'text', 'text']);
  assert.match(p.messages[0].content[2].text, /c\.txt/);
});

test('especialista entra no system; PDF dele vai na primeira mensagem', () => {
  const p = buildRequest({
    messages: [user('a'), { role: 'assistant', text: 'b' }, user('c')],
    system: {
      expert: { name: 'Jurídico', instructions: 'Seja preciso.', files: [{ name: 'lei.pdf', mime: 'application/pdf', data: 'X' }, { name: 'n.md', text: 'nota' }] },
      contexts: [{ title: 'Empresa', body: 'Clínica em Curitiba' }],
    },
  });
  assert.match(p.system, /Especialista: Jurídico/);
  assert.match(p.system, /nota/);
  assert.match(p.system, /Clínica em Curitiba/);
  assert.equal(p.messages[0].content[0].type, 'document');
  assert.equal(p.messages[2].content.length, 1);
});

test('mensagens do usuário seguidas são unidas e assistente vazio some', () => {
  const p = buildRequest({ messages: [user('a'), { role: 'assistant', text: '' }, user('b')] });
  assert.equal(p.messages.length, 1);
  assert.equal(p.messages[0].content.length, 2);
});

test('entradas inválidas viram BadRequest', () => {
  assert.throws(() => buildRequest({ messages: [] }), BadRequest);
  assert.throws(() => buildRequest({ model: 'gpt-qualquer', messages: [user('x')] }), BadRequest);
  assert.throws(() => buildRequest({ messages: [{ role: 'assistant', text: 'x' }] }), BadRequest);
  assert.throws(() => buildRequest({ messages: [user('', [{ name: 'x.exe', mime: 'application/x' }])] }), BadRequest);
  assert.throws(() => buildRequest({ messages: [{ role: 'system', text: 'x' }, user('y')] }), BadRequest);
});

test('pedido de imagem respeita o formato e extrai o SVG', () => {
  const p = buildImageRequest({ prompt: 'um farol', ratio: '16:9' });
  assert.match(p.system, /viewBox="0 0 1280 720"/);
  assert.throws(() => buildImageRequest({ prompt: ' ' }), BadRequest);
  assert.equal(extractSvg('aqui: <svg a="1"><g/></svg> fim'), '<svg a="1"><g/></svg>');
  assert.equal(extractSvg('nada'), null);
});

test('título reserva tem no máximo 6 palavras', () => {
  assert.equal(fallbackTitle('um dois três quatro cinco seis sete'), 'um dois três quatro cinco seis');
  assert.equal(fallbackTitle(''), 'Nova conversa');
});

test('eventos do stream viram o protocolo do navegador', () => {
  const out = [];
  const emit = (e) => out.push(e);
  handleEvent({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'Olá' } }, emit);
  handleEvent({ type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'hmm' } }, emit);
  handleEvent({ type: 'content_block_start', content_block: { type: 'server_tool_use', name: 'web_search' } }, emit);
  handleEvent({ type: 'content_block_start', content_block: { type: 'web_search_tool_result', content: [{ type: 'web_search_result', url: 'https://a.com', title: 'A' }] } }, emit);
  handleEvent({ type: 'content_block_start', content_block: { type: 'web_search_tool_result', content: { type: 'web_search_tool_result_error', error_code: 'max_uses_exceeded' } } }, emit);
  assert.deepEqual(out.map((e) => e.type), ['text', 'thinking', 'status', 'source']);
});
