// Transforma o que o navegador envia em uma requisição da Messages API.
// Funções puras: nada aqui fala com a rede, então tudo é testável.

import { DEFAULT_MODEL, findModel } from './models.js';

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const BASE_SYSTEM = [
  'Você é o assistente do Orquestra, um espaço de trabalho com IA para profissionais brasileiros.',
  'Responda em português do Brasil, a menos que a pessoa escreva em outro idioma.',
  'Use Markdown quando ajudar a leitura: títulos curtos, listas e tabelas. Seja direto.',
].join('\n');

export class BadRequest extends Error {}

// Um anexo vira um bloco de conteúdo do Claude.
export function attachmentToBlock(att) {
  if (!att || typeof att.name !== 'string') throw new BadRequest('anexo inválido');
  if (IMAGE_TYPES.has(att.mime) && att.data) {
    return { type: 'image', source: { type: 'base64', media_type: att.mime, data: att.data } };
  }
  if (att.mime === 'application/pdf' && att.data) {
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: att.data },
      title: att.name,
    };
  }
  if (typeof att.text === 'string') {
    return { type: 'text', text: `Arquivo anexado: ${att.name}\n\`\`\`\n${att.text}\n\`\`\`` };
  }
  throw new BadRequest(`tipo de arquivo não suportado: ${att.name}`);
}

function userContent(msg, extraBlocks = []) {
  const blocks = [...extraBlocks, ...(msg.attachments || []).map(attachmentToBlock)];
  const text = typeof msg.text === 'string' ? msg.text : '';
  if (text.trim()) blocks.push({ type: 'text', text });
  if (!blocks.length) throw new BadRequest('mensagem vazia');
  return blocks;
}

export function buildSystem({ expert, contexts } = {}) {
  const parts = [BASE_SYSTEM];
  if (expert && expert.instructions) {
    parts.push(`\n# Especialista: ${expert.name || 'sem nome'}\n${expert.instructions}`);
    const textFiles = (expert.files || []).filter((f) => typeof f.text === 'string');
    for (const f of textFiles) {
      parts.push(`\n## Base de conhecimento: ${f.name}\n${f.text}`);
    }
  }
  for (const c of contexts || []) {
    if (c && c.body) parts.push(`\n# Contexto: ${c.title || 'sem título'}\n${c.body}`);
  }
  return parts.join('\n');
}

// Arquivos binários do especialista (PDF, imagem) entram na primeira mensagem
// do usuário, porque a Messages API só aceita documentos no conteúdo das mensagens.
function expertBinaryBlocks(expert) {
  if (!expert) return [];
  return (expert.files || []).filter((f) => typeof f.text !== 'string').map(attachmentToBlock);
}

export function buildMessages(messages, expert) {
  if (!Array.isArray(messages) || !messages.length) throw new BadRequest('sem mensagens');
  if (messages[messages.length - 1].role !== 'user') throw new BadRequest('a última mensagem precisa ser do usuário');
  const out = [];
  messages.forEach((m, i) => {
    if (m.role === 'user') {
      out.push({ role: 'user', content: userContent(m, i === 0 ? expertBinaryBlocks(expert) : []) });
    } else if (m.role === 'assistant') {
      if (typeof m.text === 'string' && m.text.trim()) out.push({ role: 'assistant', content: m.text });
    } else {
      throw new BadRequest('papel inválido');
    }
  });
  return mergeConsecutive(out);
}

// Uma resposta interrompida pode deixar duas mensagens do usuário seguidas.
function mergeConsecutive(msgs) {
  const out = [];
  for (const m of msgs) {
    const prev = out[out.length - 1];
    if (prev && prev.role === m.role) {
      const toBlocks = (c) => (typeof c === 'string' ? [{ type: 'text', text: c }] : c);
      prev.content = [...toBlocks(prev.content), ...toBlocks(m.content)];
    } else {
      out.push(m);
    }
  }
  if (out[0] && out[0].role !== 'user') out.shift();
  return out;
}

export function buildRequest(body) {
  if (!body || typeof body !== 'object') throw new BadRequest('corpo inválido');
  const model = findModel(body.model || DEFAULT_MODEL);
  if (!model) throw new BadRequest('modelo desconhecido');
  const opts = body.options || {};
  const params = {
    model: model.id,
    max_tokens: 64000,
    system: buildSystem(body.system),
    messages: buildMessages(body.messages, body.system && body.system.expert),
    output_config: { effort: opts.deepThinking ? 'high' : 'low' },
  };
  if (opts.deepThinking) params.thinking = { type: 'adaptive', display: 'summarized' };
  if (opts.webSearch && model.webSearch) {
    params.tools = [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }];
  }
  if (model.fallbacks) {
    params.betas = ['server-side-fallback-2026-07-01'];
    params.fallbacks = 'default';
  }
  return params;
}

export function buildImageRequest(body) {
  const prompt = body && typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) throw new BadRequest('descreva a imagem');
  const ratio = ['1:1', '16:9', '9:16', '4:3'].includes(body.ratio) ? body.ratio : '1:1';
  const [w, h] = { '1:1': [1024, 1024], '16:9': [1280, 720], '9:16': [720, 1280], '4:3': [1024, 768] }[ratio];
  const model = findModel(body.model) ? body.model : DEFAULT_MODEL;
  return {
    model,
    max_tokens: 32000,
    output_config: { effort: 'medium' },
    system:
      'Você cria ilustrações vetoriais. Responda somente com um único elemento <svg> válido, ' +
      `com xmlns="http://www.w3.org/2000/svg" e viewBox="0 0 ${w} ${h}". ` +
      'Sem scripts, sem imagens externas, sem fontes externas, sem texto fora do SVG.',
    messages: [{ role: 'user', content: prompt }],
  };
}

export function extractSvg(text) {
  const m = /<svg[\s\S]*<\/svg>/i.exec(text || '');
  return m ? m[0] : null;
}

export function fallbackTitle(text) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').slice(0, 6).join(' ');
  return words.length > 48 ? words.slice(0, 47) + '…' : words || 'Nova conversa';
}
