// Fala com a Messages API pelo SDK oficial e traduz os eventos do stream
// para o protocolo simples que o navegador entende:
//   {type:'text', text} {type:'thinking', text} {type:'source', url, title}
//   {type:'notice', text} {type:'done', stopReason, model}

import Anthropic from '@anthropic-ai/sdk';
import { TITLE_MODEL } from './models.js';
import { extractSvg, fallbackTitle } from './prompt.js';

let client = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

const MAX_CONTINUATIONS = 3;

export async function streamChat(params, emit, signal) {
  const { betas, ...rest } = params;
  let request = { ...rest, messages: [...rest.messages] };
  for (let round = 0; round <= MAX_CONTINUATIONS; round++) {
    const stream = getClient().beta.messages.stream(
      betas ? { ...request, betas } : request,
      { signal },
    );
    for await (const event of stream) handleEvent(event, emit);
    const final = await stream.finalMessage();
    if (final.stop_reason === 'pause_turn') {
      // Uma ferramenta de servidor pausou o turno: devolve o conteúdo e continua.
      request = { ...request, messages: [...request.messages, { role: 'assistant', content: final.content }] };
      continue;
    }
    if (final.stop_reason === 'refusal') {
      emit({ type: 'notice', text: 'O modelo recusou este pedido. Tente reformular ou trocar de modelo.' });
    }
    if (final.stop_reason === 'max_tokens') {
      emit({ type: 'notice', text: 'A resposta atingiu o limite de tamanho e foi cortada.' });
    }
    emit({ type: 'done', stopReason: final.stop_reason, model: final.model });
    return;
  }
  emit({ type: 'done', stopReason: 'pause_turn', model: params.model });
}

export function handleEvent(event, emit) {
  if (event.type === 'content_block_start') {
    const block = event.content_block;
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const r of block.content) {
        if (r.type === 'web_search_result') emit({ type: 'source', url: r.url, title: r.title || r.url });
      }
    } else if (block.type === 'server_tool_use' && block.name === 'web_search') {
      emit({ type: 'status', text: 'Pesquisando na web…' });
    } else if (block.type === 'fallback') {
      emit({ type: 'notice', text: `Respondido por ${block.to && block.to.model} após recusa de ${block.from && block.from.model}.` });
    }
  } else if (event.type === 'content_block_delta') {
    if (event.delta.type === 'text_delta') emit({ type: 'text', text: event.delta.text });
    else if (event.delta.type === 'thinking_delta' && event.delta.thinking) {
      emit({ type: 'thinking', text: event.delta.thinking });
    }
  }
}

export async function generateTitle(text) {
  const res = await getClient().messages.create({
    model: TITLE_MODEL,
    max_tokens: 256,
    output_config: { effort: 'low' },
    system: 'Dê um título curto (até 6 palavras, sem aspas, sem ponto final) em português para uma conversa que começa com a mensagem do usuário.',
    messages: [{ role: 'user', content: String(text).slice(0, 4000) }],
  });
  if (res.stop_reason === 'refusal') return fallbackTitle(text);
  const out = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  return out.replace(/^["“']|["”'.]$/g, '').slice(0, 60) || fallbackTitle(text);
}

export async function generateSvg(params, signal) {
  const stream = getClient().messages.stream(params, { signal });
  const final = await stream.finalMessage();
  if (final.stop_reason === 'refusal') throw new Error('O modelo recusou este pedido de imagem.');
  const text = final.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const svg = extractSvg(text);
  if (!svg) throw new Error('Não consegui gerar a ilustração. Tente descrever de outro jeito.');
  return svg;
}
