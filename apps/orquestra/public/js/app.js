import { renderMarkdown, escapeHtml } from './markdown.js';
import { load, save, pref, setPref } from './store.js';
import { readAttachment, fileIcon } from './files.js';
import { CURATED_EXPERTS, COMMUNITY_EXPERTS, PROMPT_LIBRARY, STARTER_SUGGESTIONS } from './seed.js';
import { uid, importChatGPT, exportBackup, readBackup, groupByDate, searchConversations } from './importers.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
  config: { demo: true, models: [], defaultModel: 'claude-opus-5-5' },
  conversations: [],
  experts: [], // só os pessoais; curados e da comunidade vêm do seed
  prompts: [],
  contexts: [],
  ratings: {},
  currentId: null,
  draftModel: null,
  draftExpertId: null,
  options: { web: false, think: false, image: false },
  pending: [],
  controller: null,
  search: '',
};

// ---------- utilidades ----------

function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), 3200);
}

function download(name, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function formatUses(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')} mil usos` : `${n} usos`;
}

let saveTimer = null;
function persist(now = false) {
  clearTimeout(saveTimer);
  const run = () =>
    save('conversations', state.conversations).catch(() => toast('Não consegui salvar. O armazenamento do navegador pode estar cheio.'));
  if (now) run();
  else saveTimer = setTimeout(run, 400);
}

const allExperts = () => [...state.experts, ...CURATED_EXPERTS, ...COMMUNITY_EXPERTS];
const findExpert = (id) => allExperts().find((e) => e.id === id) || null;
const modelInfo = (id) => state.config.models.find((m) => m.id === id) || state.config.models[0];
const current = () => state.conversations.find((c) => c.id === state.currentId) || null;
const activeModel = () => (current() ? current().model : state.draftModel) || state.config.defaultModel;
const activeExpert = () => findExpert(current() ? current().expertId : state.draftExpertId);

// ---------- barra lateral ----------

function renderHistory() {
  const box = $('#history');
  const list = searchConversations(state.conversations, state.search);
  if (!list.length) {
    box.innerHTML = `<p class="empty-history">${state.search ? 'Nada encontrado.' : 'Suas conversas aparecem aqui.'}</p>`;
    return;
  }
  box.innerHTML = groupByDate(list)
    .map(
      ([label, convs]) =>
        `<h2>${label}</h2>` +
        convs
          .map(
            (c) => `<div class="conv${c.id === state.currentId ? ' active' : ''}" role="listitem" data-id="${c.id}">
          <button class="conv-open" title="${escapeHtml(c.title)}">${escapeHtml(c.title)}</button>
          <span class="conv-actions">
            <button data-act="pin" aria-label="${c.pinned ? 'Desafixar' : 'Fixar'}" title="${c.pinned ? 'Desafixar' : 'Fixar'}">${c.pinned ? '📌' : '📍'}</button>
            <button data-act="rename" aria-label="Renomear" title="Renomear">✎</button>
            <button data-act="delete" aria-label="Excluir" title="Excluir">🗑</button>
          </span></div>`,
          )
          .join(''),
    )
    .join('');
}

$('#history').addEventListener('click', (e) => {
  const row = e.target.closest('.conv');
  if (!row) return;
  const conv = state.conversations.find((c) => c.id === row.dataset.id);
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'pin') {
    conv.pinned = !conv.pinned;
  } else if (act === 'rename') {
    const t = prompt('Novo nome da conversa', conv.title);
    if (t && t.trim()) conv.title = t.trim().slice(0, 80);
  } else if (act === 'delete') {
    if (!confirm(`Excluir "${conv.title}"?`)) return;
    state.conversations = state.conversations.filter((c) => c.id !== conv.id);
    if (state.currentId === conv.id) openConversation(null);
  } else {
    openConversation(conv.id);
    closeSidebar();
    return;
  }
  persist(true);
  renderHistory();
});

$('#search').addEventListener('input', (e) => {
  state.search = e.target.value;
  renderHistory();
});

function openSidebar() {
  $('#sidebar').classList.add('open');
  $('#scrim').hidden = false;
}
function closeSidebar() {
  $('#sidebar').classList.remove('open');
  $('#scrim').hidden = true;
}
$('#open-sidebar').addEventListener('click', openSidebar);
$('#close-sidebar').addEventListener('click', closeSidebar);
$('#scrim').addEventListener('click', closeSidebar);

$('#new-chat').addEventListener('click', () => {
  openConversation(null);
  closeSidebar();
  $('#prompt').focus();
});

$('#theme-btn').addEventListener('click', () => {
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const now = document.documentElement.dataset.theme || (dark ? 'dark' : 'light');
  const next = now === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  setPref('theme', next);
});

// ---------- seletor de modelo ----------

function renderModelPicker() {
  const id = activeModel();
  $('#model-label').textContent = modelInfo(id)?.label || id;
  $('#model-list').innerHTML = state.config.models
    .map(
      (m) => `<li role="option" tabindex="0" data-id="${m.id}" aria-selected="${m.id === id}">
        <span><strong>${escapeHtml(m.label)}</strong> <span class="tier">${escapeHtml(m.tier)}</span></span>
        <small>${escapeHtml(m.tagline)}</small></li>`,
    )
    .join('');
  const web = $('#toggle-web');
  const supportsWeb = modelInfo(id)?.webSearch;
  web.disabled = !supportsWeb;
  web.title = supportsWeb ? 'Pesquisar na web antes de responder' : 'Este modelo não pesquisa na web';
  if (!supportsWeb) setToggle('web', false);
}

function toggleModelList(open) {
  const list = $('#model-list');
  list.hidden = !open;
  $('#model-btn').setAttribute('aria-expanded', String(open));
  if (open) (list.querySelector('[aria-selected="true"]') || list.firstElementChild)?.focus();
}

$('#model-btn').addEventListener('click', () => toggleModelList($('#model-list').hidden));
$('#model-list').addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (li) chooseModel(li.dataset.id);
});
$('#model-list').addEventListener('keydown', (e) => {
  const items = $$('#model-list li');
  const i = items.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') items[(i + 1) % items.length].focus();
  else if (e.key === 'ArrowUp') items[(i - 1 + items.length) % items.length].focus();
  else if (e.key === 'Enter' || e.key === ' ') chooseModel(document.activeElement.dataset.id);
  else if (e.key === 'Escape') {
    toggleModelList(false);
    $('#model-btn').focus();
    return;
  } else return;
  e.preventDefault();
});

function chooseModel(id) {
  const conv = current();
  if (conv) {
    conv.model = id;
    persist();
  } else state.draftModel = id;
  setPref('model', id);
  toggleModelList(false);
  renderModelPicker();
  $('#prompt').focus();
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.picker')) toggleModelList(false);
  if (!e.target.closest('.plus-wrap')) togglePlus(false);
  if (!e.target.closest('#slash-menu') && e.target !== $('#prompt')) hideSlash();
});

// ---------- especialista ativo ----------

function renderExpertChip() {
  const ex = activeExpert();
  const chip = $('#expert-chip');
  chip.hidden = !ex;
  if (!ex) return;
  chip.innerHTML = `<span>${escapeHtml(ex.emoji)} ${escapeHtml(ex.name)}</span>` +
    (current() ? '' : '<button aria-label="Remover especialista" title="Remover especialista">✕</button>');
}
$('#expert-chip').addEventListener('click', (e) => {
  if (e.target.closest('button')) {
    state.draftExpertId = null;
    renderAll();
  }
});

function startWithExpert(id) {
  const ex = findExpert(id);
  openConversation(null);
  state.draftExpertId = id;
  if (ex && ex.model) state.draftModel = ex.model;
  $('#dlg-experts').close();
  renderAll();
  $('#prompt').focus();
}

// ---------- mensagens ----------

function openConversation(id) {
  if (state.controller) stopStreaming();
  state.currentId = id;
  state.draftExpertId = null;
  state.draftModel = pref('model', null);
  setToggle('image', false);
  renderAll();
}

function renderAll() {
  renderHistory();
  renderModelPicker();
  renderExpertChip();
  renderMessages();
  renderAttachments();
  renderContextCount();
}

function renderWelcome() {
  const ex = activeExpert();
  if (ex) {
    const starters = (ex.starters || []).filter(Boolean);
    return `<div class="welcome">
      <div class="expert-emoji" aria-hidden="true">${escapeHtml(ex.emoji)}</div>
      <h1>${escapeHtml(ex.name)}</h1>
      <p class="muted">${escapeHtml(ex.description || '')}</p>
      <div class="suggestions">${starters
        .map((s) => `<button class="suggestion" data-prompt="${escapeHtml(s)}">${escapeHtml(s)}</button>`)
        .join('')}</div></div>`;
  }
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  return `<div class="welcome">
    <img src="/icon.svg" alt="" width="56" height="56">
    <h1>${hello}! Como posso ajudar?</h1>
    <p class="muted">Escolha um modelo acima, chame um especialista ou comece por uma ideia:</p>
    <div class="suggestions">${STARTER_SUGGESTIONS.map(
      (s) => `<button class="suggestion" data-prompt="${escapeHtml(s.prompt)}">${s.icon} ${escapeHtml(s.text)}</button>`,
    ).join('')}</div></div>`;
}

function messageHtml(m, i, conv) {
  if (m.role === 'user') {
    const files = (m.attachments || [])
      .map((a) => `<span class="file-chip">${fileIcon(a)} <span>${escapeHtml(a.name)}</span></span>`)
      .join('');
    return `<div class="msg user" data-i="${i}">
      ${files ? `<div class="file-chips">${files}</div>` : ''}
      ${m.text ? `<div class="bubble">${escapeHtml(m.text)}</div>` : ''}
      <div class="msg-actions">
        <button data-act="copy">Copiar</button>
        ${m.kind === 'image' ? '' : '<button data-act="edit">Editar</button>'}
      </div></div>`;
  }
  const ex = findExpert(conv.expertId);
  const who = ex ? `${escapeHtml(ex.emoji)} ${escapeHtml(ex.name)}` : escapeHtml(modelInfo(m.model || conv.model)?.label || 'Assistente');
  return `<div class="msg assistant" data-i="${i}">
    <div class="who">${who}</div>
    <div class="body">${assistantBody(m)}</div>
    ${m.streaming ? '' : `<div class="msg-actions">
      ${m.text ? '<button data-act="copy">Copiar</button>' : ''}
      ${i === conv.messages.length - 1 ? '<button data-act="retry">Gerar de novo</button>' : ''}
      ${m.image ? '<button data-act="save-image">Baixar imagem</button>' : ''}
    </div>`}</div>`;
}

function assistantBody(m) {
  let html = '';
  if (m.thinking) {
    html += `<details class="thinking"${m.streaming && !m.text ? ' open' : ''}><summary>🧠 Raciocínio</summary><div>${escapeHtml(m.thinking)}</div></details>`;
  }
  if (m.image) {
    html += `<figure class="generated-image"><img alt="${escapeHtml(m.imagePrompt || 'Ilustração gerada')}" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(m.image)}"></figure>`;
  }
  if (m.text) html += `<div class="content">${renderMarkdown(m.text)}</div>`;
  if (m.streaming && !m.text && !m.image) html += `<p class="status">${escapeHtml(m.status || 'Pensando…')}</p>`;
  for (const n of m.notices || []) html += `<p class="notice">${escapeHtml(n)}</p>`;
  if (m.error) html += `<div class="error-box" role="alert">${escapeHtml(m.error)}</div>`;
  if (m.sources && m.sources.length) {
    const seen = new Set();
    html += '<div class="sources">' + m.sources
      .filter((s) => !seen.has(s.url) && seen.add(s.url) && /^https?:\/\//.test(s.url))
      .map((s) => `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(s.url)}">🔗 ${escapeHtml(s.title)}</a>`)
      .join('') + '</div>';
  }
  return html;
}

function addCopyButtons(root) {
  for (const pre of $$('pre', root)) {
    if (pre.querySelector('.copy-code')) continue;
    const b = document.createElement('button');
    b.className = 'copy-code';
    b.type = 'button';
    b.textContent = 'Copiar';
    b.addEventListener('click', () => {
      navigator.clipboard.writeText(pre.querySelector('code').textContent).then(() => (b.textContent = 'Copiado'));
    });
    pre.append(b);
  }
}

function renderMessages() {
  const box = $('#messages');
  const conv = current();
  if (!conv || !conv.messages.length) {
    box.innerHTML = renderWelcome();
    return;
  }
  box.innerHTML = conv.messages.map((m, i) => messageHtml(m, i, conv)).join('');
  addCopyButtons(box);
  box.scrollTop = box.scrollHeight;
}

let frame = 0;
function updateLastMessage() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const conv = current();
    if (!conv) return;
    const i = conv.messages.length - 1;
    const el = $(`#messages .msg[data-i="${i}"] .body`);
    if (!el) return renderMessages();
    const box = $('#messages');
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    el.innerHTML = assistantBody(conv.messages[i]);
    if (atBottom) box.scrollTop = box.scrollHeight;
  });
}

$('#messages').addEventListener('click', (e) => {
  const sug = e.target.closest('.suggestion');
  if (sug) {
    setPrompt(sug.dataset.prompt);
    return;
  }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  const conv = current();
  const i = Number(e.target.closest('.msg').dataset.i);
  const m = conv.messages[i];
  if (act === 'copy') {
    navigator.clipboard.writeText(m.text || '').then(() => toast('Copiado'));
  } else if (act === 'edit') {
    if (state.controller) return;
    conv.messages = conv.messages.slice(0, i);
    state.pending = [...(m.attachments || [])];
    setPrompt(m.text || '');
    renderMessages();
    renderAttachments();
    persist();
  } else if (act === 'retry') {
    if (state.controller) return;
    const userMsg = conv.messages[i - 1];
    conv.messages = conv.messages.slice(0, i);
    if (userMsg && userMsg.kind === 'image') runImage(conv, userMsg.text);
    else runChat(conv);
  } else if (act === 'save-image') {
    download('orquestra-ilustracao.svg', m.image, 'image/svg+xml');
  }
});

// ---------- envio ----------

function setPrompt(text) {
  const ta = $('#prompt');
  ta.value = text;
  autoGrow();
  ta.focus();
  const field = text.indexOf('[');
  if (field >= 0) ta.setSelectionRange(field, text.indexOf(']', field) + 1 || field);
  else ta.setSelectionRange(text.length, text.length);
}

function autoGrow() {
  const ta = $('#prompt');
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, window.innerHeight * 0.4) + 'px';
  updateSend();
}

function updateSend() {
  const btn = $('#send-btn');
  const streaming = !!state.controller;
  btn.classList.toggle('stop', streaming);
  btn.textContent = streaming ? '■' : '↑';
  btn.setAttribute('aria-label', streaming ? 'Parar resposta' : 'Enviar');
  btn.disabled = !streaming && !$('#prompt').value.trim() && !state.pending.length;
}

function ensureConversation() {
  let conv = current();
  if (!conv) {
    conv = {
      id: uid(),
      title: 'Nova conversa',
      model: activeModel(),
      expertId: state.draftExpertId,
      messages: [],
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    state.conversations.unshift(conv);
    state.currentId = conv.id;
  }
  return conv;
}

$('#composer').addEventListener('submit', (e) => {
  e.preventDefault();
  if (state.controller) return stopStreaming();
  const text = $('#prompt').value.trim();
  if (!text && !state.pending.length) return;
  hideSlash();
  const conv = ensureConversation();
  const isImage = state.options.image;
  if (isImage && !text) return toast('Descreva a imagem que você quer.');
  conv.messages.push({
    id: uid(),
    role: 'user',
    text,
    attachments: isImage ? [] : state.pending,
    kind: isImage ? 'image' : undefined,
  });
  if (!isImage) state.pending = [];
  $('#prompt').value = '';
  autoGrow();
  renderAll();
  if (isImage) {
    setToggle('image', false); // o modo imagem vale para um pedido
    runImage(conv, text);
  } else runChat(conv);
});

$('#prompt').addEventListener('keydown', (e) => {
  if (slashKeydown(e)) return;
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    if (!state.controller) $('#composer').requestSubmit();
  }
});
$('#prompt').addEventListener('input', () => {
  autoGrow();
  updateSlash();
});
$('#prompt').addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files || [])];
  if (files.length) {
    e.preventDefault();
    addFiles(files);
  }
});

function chatPayload(conv) {
  const ex = findExpert(conv.expertId);
  const messages = conv.messages
    .filter((m) => !m.kind && !m.image && !(m.role === 'assistant' && (m.error || !m.text)))
    .map((m) => ({ role: m.role, text: m.text, attachments: m.attachments || [] }));
  return {
    model: conv.model,
    messages,
    options: { webSearch: state.options.web, deepThinking: state.options.think },
    system: {
      expert: ex ? { name: ex.name, instructions: ex.instructions, files: ex.files || [] } : null,
      contexts: state.contexts.filter((c) => c.active).map(({ title, body }) => ({ title, body })),
    },
  };
}

async function runChat(conv) {
  const payload = chatPayload(conv);
  const reply = { id: uid(), role: 'assistant', text: '', thinking: '', sources: [], notices: [], model: conv.model, streaming: true };
  conv.messages.push(reply);
  conv.updatedAt = Date.now();
  renderMessages();
  const controller = new AbortController();
  state.controller = controller;
  updateSend();
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Erro ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let cut;
      while ((cut = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, cut);
        buf = buf.slice(cut + 2);
        if (chunk.startsWith('data: ')) applyEvent(reply, JSON.parse(chunk.slice(6)));
      }
      updateLastMessage();
    }
  } catch (err) {
    if (err.name !== 'AbortError') reply.error = err.message || 'Falha de conexão.';
  } finally {
    reply.streaming = false;
    delete reply.status;
    if (!reply.text && !reply.error && controller.signal.aborted) reply.notices.push('Resposta interrompida.');
    if (state.controller === controller) state.controller = null;
    conv.updatedAt = Date.now();
    persist(true);
    if (state.currentId === conv.id) renderMessages();
    updateSend();
    maybeTitle(conv);
  }
}

function applyEvent(reply, ev) {
  if (ev.type === 'text') reply.text += ev.text;
  else if (ev.type === 'thinking') reply.thinking += ev.text;
  else if (ev.type === 'source') reply.sources.push({ url: ev.url, title: ev.title });
  else if (ev.type === 'status') reply.status = ev.text;
  else if (ev.type === 'notice') reply.notices.push(ev.text);
  else if (ev.type === 'error') reply.error = ev.text;
  else if (ev.type === 'done') reply.model = ev.model || reply.model;
}

async function runImage(conv, prompt) {
  const reply = { id: uid(), role: 'assistant', text: '', streaming: true, status: 'Desenhando…', imagePrompt: prompt, notices: [] };
  conv.messages.push(reply);
  renderMessages();
  const controller = new AbortController();
  state.controller = controller;
  updateSend();
  try {
    const res = await fetch('/api/image', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, ratio: $('#ratio').value, model: conv.model }),
      signal: controller.signal,
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || `Erro ${res.status}`);
    reply.image = body.svg;
  } catch (err) {
    if (err.name !== 'AbortError') reply.error = err.message;
    else reply.notices.push('Geração interrompida.');
  } finally {
    reply.streaming = false;
    if (state.controller === controller) state.controller = null;
    conv.updatedAt = Date.now();
    persist(true);
    if (state.currentId === conv.id) renderMessages();
    updateSend();
    maybeTitle(conv);
  }
}

function stopStreaming() {
  if (state.controller) state.controller.abort();
}

async function maybeTitle(conv) {
  if (conv.title !== 'Nova conversa' || conv.titling) return;
  const first = conv.messages.find((m) => m.role === 'user');
  if (!first) return;
  conv.titling = true;
  try {
    const res = await fetch('/api/title', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: first.text || (first.attachments || []).map((a) => a.name).join(', ') }),
    });
    const body = await res.json();
    if (res.ok && body.title) conv.title = body.title;
  } catch {
    /* fica "Nova conversa" */
  }
  delete conv.titling;
  persist(true);
  renderHistory();
}

$('#export-chat').addEventListener('click', () => {
  const conv = current();
  if (!conv || !conv.messages.length) return toast('Nada para baixar ainda.');
  const md = [`# ${conv.title}`, ''];
  for (const m of conv.messages) {
    md.push(m.role === 'user' ? '## Você' : `## ${modelInfo(m.model || conv.model)?.label || 'Assistente'}`, '');
    if (m.attachments && m.attachments.length) md.push(`_Anexos: ${m.attachments.map((a) => a.name).join(', ')}_`, '');
    md.push(m.text || (m.image ? '_(ilustração gerada)_' : ''), '');
  }
  download(`${conv.title.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'conversa'}.md`, md.join('\n'), 'text/markdown');
});

// ---------- opções do composer ----------

function setToggle(name, on) {
  state.options[name] = on;
  const id = { web: '#toggle-web', think: '#toggle-think', image: '#toggle-image' }[name];
  $(id).setAttribute('aria-pressed', String(on));
  if (name === 'image') {
    $('#ratio').hidden = !on;
    $('#prompt').placeholder = on ? 'Descreva a ilustração que você quer criar' : 'Pergunte algo ou digite / para comandos';
  }
  setPref('options', { web: state.options.web, think: state.options.think });
}
$('#toggle-web').addEventListener('click', () => setToggle('web', !state.options.web));
$('#toggle-think').addEventListener('click', () => setToggle('think', !state.options.think));
$('#toggle-image').addEventListener('click', () => setToggle('image', !state.options.image));

function togglePlus(open) {
  $('#plus-menu').hidden = !open;
  $('#plus-btn').setAttribute('aria-expanded', String(open));
}
$('#plus-btn').addEventListener('click', () => togglePlus($('#plus-menu').hidden));
$('#plus-menu').addEventListener('click', (e) => {
  if (e.target.closest('[data-action="attach"]')) $('#file-input').click();
  togglePlus(false);
});

// ---------- anexos ----------

async function addFiles(files, target = state.pending, rerender = renderAttachments) {
  for (const f of files) {
    try {
      target.push(await readAttachment(f));
    } catch (err) {
      toast(err.message);
    }
  }
  rerender();
}

function chipsHtml(list) {
  return list
    .map(
      (a, i) => `<span class="file-chip">${fileIcon(a)} <span title="${escapeHtml(a.name)}">${escapeHtml(a.name)}</span>
      <button type="button" data-rm="${i}" aria-label="Remover ${escapeHtml(a.name)}">✕</button></span>`,
    )
    .join('');
}

function renderAttachments() {
  $('#attachments').innerHTML = chipsHtml(state.pending);
  updateSend();
}
$('#attachments').addEventListener('click', (e) => {
  const rm = e.target.closest('[data-rm]');
  if (rm) {
    state.pending.splice(Number(rm.dataset.rm), 1);
    renderAttachments();
  }
});
$('#file-input').addEventListener('change', (e) => {
  addFiles([...e.target.files]);
  e.target.value = '';
});
const composer = $('#composer');
composer.addEventListener('dragover', (e) => e.preventDefault());
composer.addEventListener('drop', (e) => {
  e.preventDefault();
  addFiles([...e.dataTransfer.files]);
});

// ---------- ditado por voz ----------

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizer = null;
if (!Recognition) $('#mic-btn').hidden = true;
$('#mic-btn').addEventListener('click', () => {
  if (recognizer) {
    recognizer.stop();
    return;
  }
  recognizer = new Recognition();
  recognizer.lang = 'pt-BR';
  recognizer.interimResults = false;
  recognizer.continuous = true;
  const base = $('#prompt').value;
  let said = '';
  recognizer.onresult = (ev) => {
    for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) said += ev.results[i][0].transcript;
    $('#prompt').value = (base ? base + ' ' : '') + said.trim();
    autoGrow();
  };
  recognizer.onerror = (ev) => toast(ev.error === 'not-allowed' ? 'Permita o uso do microfone.' : 'Não consegui ouvir.');
  recognizer.onend = () => {
    recognizer = null;
    $('#mic-btn').setAttribute('aria-pressed', 'false');
  };
  recognizer.start();
  $('#mic-btn').setAttribute('aria-pressed', 'true');
});

// ---------- menu de barra (/) ----------

let slashItems = [];
let slashIndex = 0;

function slashOptions(q) {
  const term = q.toLowerCase();
  const match = (s) => s.toLowerCase().includes(term);
  const cmds = [
    { group: 'Comandos', label: '🎨 Imagem', hint: 'criar uma ilustração', run: () => setToggle('image', true) },
    { group: 'Comandos', label: '🌐 Web', hint: 'ligar ou desligar a pesquisa', run: () => !$('#toggle-web').disabled && setToggle('web', !state.options.web) },
    { group: 'Comandos', label: '🧠 Raciocínio', hint: 'pensar mais antes de responder', run: () => setToggle('think', !state.options.think) },
    { group: 'Comandos', label: '📎 Anexar', hint: 'arquivos e imagens', run: () => $('#file-input').click() },
  ].filter((c) => match(c.label));
  const prompts = [...state.prompts, ...PROMPT_LIBRARY]
    .filter((p) => match(p.title) || match(p.category))
    .slice(0, 6)
    .map((p) => ({ group: 'Prompts', label: '📚 ' + p.title, hint: p.category, run: () => setPrompt(p.body) }));
  const experts = allExperts()
    .filter((x) => match(x.name))
    .slice(0, 5)
    .map((x) => ({ group: 'Especialistas', label: `${x.emoji} ${x.name}`, hint: '', run: () => startWithExpert(x.id) }));
  return [...cmds, ...prompts, ...experts];
}

function updateSlash() {
  const v = $('#prompt').value;
  const m = /^\/(\S*)$/.exec(v);
  if (!m) return hideSlash();
  slashItems = slashOptions(m[1]);
  slashIndex = 0;
  if (!slashItems.length) return hideSlash();
  renderSlash();
}

function renderSlash() {
  const menu = $('#slash-menu');
  let last = '';
  menu.innerHTML = slashItems
    .map((it, i) => {
      const head = it.group !== last ? `<h3>${it.group}</h3>` : '';
      last = it.group;
      return `${head}<button type="button" class="opt${i === slashIndex ? ' hl' : ''}" role="option" aria-selected="${i === slashIndex}" data-i="${i}">${escapeHtml(it.label)}<small>${escapeHtml(it.hint)}</small></button>`;
    })
    .join('');
  menu.hidden = false;
  menu.querySelector('.hl')?.scrollIntoView({ block: 'nearest' });
}

function hideSlash() {
  $('#slash-menu').hidden = true;
  slashItems = [];
}

function runSlash(i) {
  const item = slashItems[i];
  hideSlash();
  $('#prompt').value = '';
  autoGrow();
  item.run();
  if (document.activeElement === document.body) $('#prompt').focus();
}

function slashKeydown(e) {
  if ($('#slash-menu').hidden) return false;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    slashIndex = (slashIndex + (e.key === 'ArrowDown' ? 1 : -1) + slashItems.length) % slashItems.length;
    renderSlash();
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    runSlash(slashIndex);
  } else if (e.key === 'Escape') {
    hideSlash();
  } else return false;
  e.preventDefault();
  return true;
}
$('#slash-menu').addEventListener('click', (e) => {
  const opt = e.target.closest('.opt');
  if (opt) runSlash(Number(opt.dataset.i));
});

// ---------- diálogos ----------

const dialogs = { experts: '#dlg-experts', prompts: '#dlg-prompts', contexts: '#dlg-contexts', data: '#dlg-data' };
document.addEventListener('click', (e) => {
  const opener = e.target.closest('[data-open]');
  if (opener) {
    const name = opener.dataset.open;
    if (name === 'experts') renderExperts();
    if (name === 'prompts') renderPrompts();
    if (name === 'contexts') renderContexts();
    $(dialogs[name]).showModal();
    closeSidebar();
  }
  const closer = e.target.closest('[data-close]');
  if (closer) closer.closest('dialog').close();
});
for (const d of $$('dialog')) {
  d.addEventListener('click', (e) => {
    if (e.target === d) d.close(); // clique fora do conteúdo
  });
}

// Especialistas
let expertTab = 'community';
function renderExperts() {
  const q = $('#expert-search').value.trim().toLowerCase();
  const source = { community: COMMUNITY_EXPERTS.concat(CURATED_EXPERTS), personal: state.experts, curated: CURATED_EXPERTS }[expertTab];
  let list = source.filter((x) => !q || x.name.toLowerCase().includes(q) || (x.description || '').toLowerCase().includes(q));
  if (expertTab === 'community') list = [...list].sort((a, b) => score(b) - score(a));
  $$('#dlg-experts [role="tab"]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === expertTab)));
  const grid = $('#expert-grid');
  if (!list.length) {
    grid.innerHTML = `<p class="empty">${expertTab === 'personal' ? 'Você ainda não criou nenhum especialista. Clique em “Criar”.' : 'Nenhum especialista encontrado.'}</p>`;
    return;
  }
  grid.innerHTML = list
    .map((x) => {
      const mine = state.ratings[x.id];
      const stars = [1, 2, 3, 4, 5]
        .map((n) => `<button class="stars" data-rate="${n}" aria-label="Dar ${n} estrela${n > 1 ? 's' : ''}">${mine && n <= mine ? '★' : '☆'}</button>`)
        .join('');
      return `<article class="card" data-id="${x.id}">
        <div class="card-head"><span class="emoji" aria-hidden="true">${escapeHtml(x.emoji)}</span><h3>${escapeHtml(x.name)}</h3></div>
        <p>${escapeHtml(x.description || '')}</p>
        <div class="meta">
          ${x.rating ? `<span>★ ${rating(x).toFixed(1).replace('.', ',')}</span>` : ''}
          ${x.uses ? `<span>${formatUses(x.uses)}</span>` : ''}
          <span>${escapeHtml(modelInfo(x.model)?.label || '')}</span>
          ${x.author ? `<span>por ${escapeHtml(x.author)}</span>` : x.source === 'curated' ? '<span>Curadoria Orquestra</span>' : ''}
        </div>
        ${x.source === 'personal' ? '' : `<div aria-label="Sua avaliação">${stars}</div>`}
        <div class="card-actions">
          <button class="btn primary" data-act="use">Conversar</button>
          ${x.source === 'personal' ? '<button class="btn" data-act="edit">Editar</button>' : '<button class="btn" data-act="copy">Duplicar</button>'}
        </div></article>`;
    })
    .join('');
}
const rating = (x) => (state.ratings[x.id] ? (x.rating * 20 + state.ratings[x.id]) / 21 : x.rating || 0);
const score = (x) => rating(x) * Math.log10((x.uses || 0) + 10);

$('#dlg-experts .tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('[data-tab]');
  if (tab) {
    expertTab = tab.dataset.tab;
    renderExperts();
  }
});
$('#expert-search').addEventListener('input', renderExperts);
$('#expert-grid').addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  const x = findExpert(card.dataset.id);
  const rate = e.target.closest('[data-rate]');
  if (rate) {
    state.ratings[x.id] = Number(rate.dataset.rate);
    save('ratings', state.ratings);
    renderExperts();
    return;
  }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'use') startWithExpert(x.id);
  if (act === 'edit') openExpertEditor(x);
  if (act === 'copy') openExpertEditor({ ...x, id: null, name: `${x.name} (cópia)`, source: 'personal', files: [] });
});

let editingFiles = [];
let editingId = null;
function openExpertEditor(x) {
  const form = $('#expert-form');
  form.reset();
  editingId = x && x.id;
  editingFiles = x && x.files ? [...x.files] : [];
  $('#expert-model').innerHTML = state.config.models
    .map((m) => `<option value="${m.id}">${escapeHtml(m.label)}</option>`)
    .join('');
  if (x) {
    form.emoji.value = x.emoji || '🤖';
    form.name.value = x.name || '';
    form.description.value = x.description || '';
    form.instructions.value = x.instructions || '';
    form.model.value = x.model || state.config.defaultModel;
    form.starters.value = (x.starters || []).join('\n');
  } else {
    form.model.value = state.config.defaultModel;
  }
  $('#edit-title').textContent = editingId ? 'Editar especialista' : 'Novo especialista';
  $('#delete-expert').hidden = !editingId;
  renderExpertFiles();
  $('#dlg-expert-edit').showModal();
}
function renderExpertFiles() {
  $('#expert-files').innerHTML = chipsHtml(editingFiles);
}
$('#new-expert').addEventListener('click', () => openExpertEditor(null));
$('#expert-add-file').addEventListener('click', () => $('#expert-file-input').click());
$('#expert-file-input').addEventListener('change', (e) => {
  addFiles([...e.target.files], editingFiles, renderExpertFiles);
  e.target.value = '';
});
$('#expert-files').addEventListener('click', (e) => {
  const rm = e.target.closest('[data-rm]');
  if (rm) {
    editingFiles.splice(Number(rm.dataset.rm), 1);
    renderExpertFiles();
  }
});
$('#expert-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  const data = {
    id: editingId || 'my-' + uid(),
    source: 'personal',
    emoji: f.emoji.value.trim() || '🤖',
    name: f.name.value.trim(),
    description: f.description.value.trim(),
    instructions: f.instructions.value.trim(),
    model: f.model.value,
    starters: f.starters.value.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 6),
    files: editingFiles,
    updatedAt: Date.now(),
  };
  const i = state.experts.findIndex((x) => x.id === data.id);
  if (i >= 0) state.experts[i] = data;
  else state.experts.unshift(data);
  save('experts', state.experts).catch(() => toast('Não consegui salvar: arquivos grandes demais para o navegador?'));
  $('#dlg-expert-edit').close();
  expertTab = 'personal';
  renderExperts();
  renderExpertChip();
  toast('Especialista salvo');
});
$('#delete-expert').addEventListener('click', () => {
  if (!confirm('Excluir este especialista?')) return;
  state.experts = state.experts.filter((x) => x.id !== editingId);
  save('experts', state.experts);
  $('#dlg-expert-edit').close();
  renderExperts();
});

// Biblioteca de prompts
let promptCat = 'Todos';
let editingPromptId = null;
function renderPrompts() {
  const all = [...state.prompts, ...PROMPT_LIBRARY];
  const cats = ['Todos', ...new Set(all.map((p) => p.category))];
  if (!cats.includes(promptCat)) promptCat = 'Todos';
  $('#prompt-cats').innerHTML = cats
    .map((c) => `<button role="tab" data-cat="${escapeHtml(c)}" aria-selected="${c === promptCat}">${escapeHtml(c)}</button>`)
    .join('');
  const q = $('#prompt-search').value.trim().toLowerCase();
  const list = all.filter(
    (p) => (promptCat === 'Todos' || p.category === promptCat) && (!q || p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q)),
  );
  $('#prompt-list').innerHTML = list.length
    ? list
        .map(
          (p) => `<div class="list-item" data-id="${p.id}">
        <div class="grow"><span class="cat">${escapeHtml(p.category)}</span><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.body)}</p></div>
        ${p.mine ? '<button class="btn" data-act="edit">Editar</button>' : ''}
        <button class="btn primary" data-act="use">Usar</button></div>`,
        )
        .join('')
    : '<p class="empty">Nenhum prompt encontrado.</p>';
}
$('#prompt-cats').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]');
  if (b) {
    promptCat = b.dataset.cat;
    renderPrompts();
  }
});
$('#prompt-search').addEventListener('input', renderPrompts);
$('#prompt-list').addEventListener('click', (e) => {
  const row = e.target.closest('.list-item');
  if (!row) return;
  const p = [...state.prompts, ...PROMPT_LIBRARY].find((x) => x.id === row.dataset.id);
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'use') {
    $('#dlg-prompts').close();
    setPrompt(p.body);
  } else if (act === 'edit') openPromptEditor(p);
});
function openPromptEditor(p) {
  const f = $('#prompt-form');
  f.reset();
  editingPromptId = p ? p.id : null;
  if (p) {
    f.title.value = p.title;
    f.category.value = p.category;
    f.body.value = p.body;
  } else if ($('#prompt').value.trim()) {
    f.body.value = $('#prompt').value.trim();
  }
  $('#delete-prompt').hidden = !editingPromptId;
  $('#dlg-prompt-edit').showModal();
}
$('#new-prompt').addEventListener('click', () => openPromptEditor(null));
$('#prompt-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  const data = { id: editingPromptId || 'mp-' + uid(), mine: true, title: f.title.value.trim(), category: f.category.value.trim(), body: f.body.value };
  const i = state.prompts.findIndex((p) => p.id === data.id);
  if (i >= 0) state.prompts[i] = data;
  else state.prompts.unshift(data);
  save('prompts', state.prompts);
  $('#dlg-prompt-edit').close();
  promptCat = data.category;
  renderPrompts();
  toast('Prompt salvo');
});
$('#delete-prompt').addEventListener('click', () => {
  state.prompts = state.prompts.filter((p) => p.id !== editingPromptId);
  save('prompts', state.prompts);
  $('#dlg-prompt-edit').close();
  renderPrompts();
});

// Contextos
function renderContextCount() {
  const n = state.contexts.filter((c) => c.active).length;
  const badge = $('#ctx-count');
  badge.hidden = !n;
  badge.textContent = n;
}
function renderContexts() {
  $('#context-list').innerHTML = state.contexts.length
    ? state.contexts
        .map(
          (c) => `<div class="list-item" data-id="${c.id}">
        <input type="checkbox" ${c.active ? 'checked' : ''} aria-label="Usar ${escapeHtml(c.title)} nas conversas">
        <div class="grow"><h3>${escapeHtml(c.title)}</h3><p>${escapeHtml(c.body)}</p></div>
        <button class="btn" data-act="edit">Editar</button>
        <button class="btn danger" data-act="delete" aria-label="Excluir ${escapeHtml(c.title)}">✕</button></div>`,
        )
        .join('')
    : '<p class="empty">Nenhum contexto ainda.</p>';
  renderContextCount();
}
$('#context-list').addEventListener('change', (e) => {
  const c = state.contexts.find((x) => x.id === e.target.closest('.list-item').dataset.id);
  c.active = e.target.checked;
  save('contexts', state.contexts);
  renderContextCount();
});
$('#context-list').addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  const c = state.contexts.find((x) => x.id === e.target.closest('.list-item').dataset.id);
  if (act === 'delete') {
    state.contexts = state.contexts.filter((x) => x !== c);
    save('contexts', state.contexts);
    renderContexts();
  } else {
    const f = $('#context-form');
    f.id.value = c.id;
    f.title.value = c.title;
    f.body.value = c.body;
    f.title.focus();
  }
});
$('#context-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  const id = f.id.value || 'ctx-' + uid();
  const existing = state.contexts.find((c) => c.id === id);
  if (existing) Object.assign(existing, { title: f.title.value.trim(), body: f.body.value.trim() });
  else state.contexts.unshift({ id, title: f.title.value.trim(), body: f.body.value.trim(), active: true });
  save('contexts', state.contexts);
  f.reset();
  f.id.value = '';
  renderContexts();
});
$('#context-form').addEventListener('reset', (e) => {
  setTimeout(() => (e.target.id.value = ''));
});

// Importar e exportar
let dataMode = null;
$('#import-chatgpt').addEventListener('click', () => {
  dataMode = 'chatgpt';
  $('#data-input').click();
});
$('#import-backup').addEventListener('click', () => {
  dataMode = 'backup';
  $('#data-input').click();
});
$('#data-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (dataMode === 'chatgpt') {
      const convs = importChatGPT(data);
      const known = new Set(state.conversations.map((c) => c.title + c.createdAt));
      const fresh = convs.filter((c) => !known.has(c.title + c.createdAt));
      state.conversations.push(...fresh);
      persist(true);
      toast(`${fresh.length} conversa${fresh.length === 1 ? '' : 's'} importada${fresh.length === 1 ? '' : 's'}`);
    } else {
      const b = readBackup(data);
      const ids = new Set(state.conversations.map((c) => c.id));
      state.conversations.push(...b.conversations.filter((c) => !ids.has(c.id)));
      const merge = (key) => {
        const have = new Set(state[key].map((x) => x.id));
        state[key].push(...b[key].filter((x) => !have.has(x.id)));
        return save(key, state[key]);
      };
      await Promise.all([merge('experts'), merge('prompts'), merge('contexts')]);
      persist(true);
      toast('Backup restaurado');
    }
    $('#dlg-data').close();
    renderAll();
  } catch (err) {
    toast(err.message || 'Arquivo inválido');
  }
});
$('#export-all').addEventListener('click', () => {
  const { conversations, experts, prompts, contexts } = state;
  download(`orquestra-backup-${new Date().toISOString().slice(0, 10)}.json`, exportBackup({ conversations, experts, prompts, contexts }));
});
$('#wipe').addEventListener('click', () => {
  if (!confirm('Apagar todas as conversas deste navegador? Não dá para desfazer.')) return;
  state.conversations = [];
  persist(true);
  $('#dlg-data').close();
  openConversation(null);
});

// ---------- atalhos ----------

document.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.shiftKey && e.key.toLowerCase() === 'o') {
    e.preventDefault();
    $('#new-chat').click();
  } else if (mod && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openSidebar();
    $('#search').focus();
  } else if (e.key === 'Escape' && state.controller && !$('dialog[open]')) {
    stopStreaming();
  }
});

// ---------- início ----------

async function init() {
  try {
    const res = await fetch('/api/config');
    state.config = await res.json();
  } catch {
    toast('Servidor fora do ar.');
  }
  $('#demo-flag').hidden = !state.config.demo;
  const [conversations, experts, prompts, contexts, ratings] = await Promise.all([
    load('conversations', []),
    load('experts', []),
    load('prompts', []),
    load('contexts', []),
    load('ratings', {}),
  ]);
  // Respostas que estavam sendo geradas quando a aba fechou.
  for (const c of conversations) for (const m of c.messages) if (m.streaming) {
    m.streaming = false;
    m.notices = [...(m.notices || []), 'Resposta interrompida.'];
  }
  Object.assign(state, { conversations, experts, prompts, contexts, ratings });
  state.draftModel = pref('model', null);
  if (state.draftModel && !state.config.models.some((m) => m.id === state.draftModel)) state.draftModel = null;
  const opts = pref('options', {});
  setToggle('web', !!opts.web);
  setToggle('think', !!opts.think);
  renderAll();
  $('#prompt').focus();
}

init();
