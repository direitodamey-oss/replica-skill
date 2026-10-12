// Modo demonstração: sem ANTHROPIC_API_KEY o app continua navegável,
// com respostas de exemplo transmitidas aos pedaços como as reais.

import { findModel } from './models.js';
import { fallbackTitle } from './prompt.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function demoReply(params) {
  const last = params.messages[params.messages.length - 1];
  const blocks = Array.isArray(last.content) ? last.content : [{ type: 'text', text: last.content }];
  const question = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  const files = blocks.filter((b) => b.type !== 'text' || b.text.startsWith('Arquivo anexado:')).length;
  const model = findModel(params.model);
  const lines = [
    '### Modo demonstração',
    '',
    `Esta é uma resposta de exemplo do **${model ? model.label : params.model}**. ` +
      'Para respostas reais, defina a variável `ANTHROPIC_API_KEY` e reinicie o servidor.',
    '',
    `Você perguntou: _${question.slice(0, 200) || '(só anexos)'}_`,
    '',
  ];
  if (files) lines.push(`- Arquivos recebidos: **${files}**`);
  if (params.tools) lines.push('- Pesquisa na web: **ligada**');
  if (params.thinking) lines.push('- Raciocínio avançado: **ligado**');
  if (params.system.includes('# Especialista:')) lines.push('- Especialista ativo: **sim**');
  lines.push('', '| recurso | situação |', '| --- | --- |', '| streaming | funcionando |', '| Markdown | funcionando |');
  return lines.join('\n');
}

export async function streamDemo(params, emit, signal) {
  if (params.thinking) {
    emit({ type: 'thinking', text: 'Organizando a resposta em tópicos curtos…' });
    await sleep(300);
  }
  if (params.tools) {
    emit({ type: 'status', text: 'Pesquisando na web…' });
    await sleep(300);
    emit({ type: 'source', url: 'https://example.com/', title: 'Fonte de exemplo' });
  }
  const text = demoReply(params);
  for (const chunk of text.match(/[\s\S]{1,12}/g) || []) {
    if (signal && signal.aborted) return;
    emit({ type: 'text', text: chunk });
    await sleep(15);
  }
  emit({ type: 'done', stopReason: 'end_turn', model: params.model });
}

export function demoTitle(text) {
  return fallbackTitle(text);
}

export function demoSvg(params) {
  const [, , w, h] = /viewBox="(\d+) (\d+) (\d+) (\d+)"/.exec(params.system).slice(1).map(Number);
  const label = params.messages[0].content.slice(0, 40).replace(/[<>&"]/g, '');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f766e"/><stop offset="1" stop-color="#f59e0b"/></linearGradient></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#g)"/>` +
    `<circle cx="${w / 2}" cy="${h / 2 - 40}" r="${Math.min(w, h) / 6}" fill="#fff" opacity=".85"/>` +
    `<text x="${w / 2}" y="${h - 80}" font-family="sans-serif" font-size="36" text-anchor="middle" fill="#fff">${label}</text>` +
    `</svg>`
  );
}
