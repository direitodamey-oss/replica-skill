// Importa o histórico exportado do ChatGPT (conversations.json) e
// o backup do próprio Orquestra. Funções puras, testadas em test/.

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function partsToText(content) {
  if (!content) return '';
  if (Array.isArray(content.parts)) {
    return content.parts.filter((p) => typeof p === 'string').join('\n').trim();
  }
  if (typeof content.text === 'string') return content.text.trim();
  return '';
}

// O export do ChatGPT guarda cada conversa como uma árvore (`mapping`).
// O ramo que a pessoa viu por último é o caminho de `current_node` até a raiz.
export function importChatGPT(data) {
  if (!Array.isArray(data)) throw new Error('Arquivo não parece um conversations.json do ChatGPT.');
  const conversations = [];
  for (const conv of data) {
    if (!conv || typeof conv.mapping !== 'object' || !conv.mapping) continue;
    const chain = [];
    let nodeId = conv.current_node;
    const seen = new Set();
    while (nodeId && conv.mapping[nodeId] && !seen.has(nodeId)) {
      seen.add(nodeId);
      chain.push(conv.mapping[nodeId]);
      nodeId = conv.mapping[nodeId].parent;
    }
    chain.reverse();
    const messages = [];
    for (const node of chain) {
      const msg = node.message;
      if (!msg || !msg.author) continue;
      const role = msg.author.role;
      if (role !== 'user' && role !== 'assistant') continue;
      const text = partsToText(msg.content);
      if (!text) continue;
      const prev = messages[messages.length - 1];
      if (prev && prev.role === role) prev.text += '\n\n' + text;
      else messages.push({ id: uid(), role, text });
    }
    if (!messages.length) continue;
    const created = conv.create_time ? Math.round(conv.create_time * 1000) : Date.now();
    const updated = conv.update_time ? Math.round(conv.update_time * 1000) : created;
    conversations.push({
      id: uid(),
      title: (conv.title || 'Conversa importada').slice(0, 80),
      model: null,
      expertId: null,
      messages,
      pinned: false,
      imported: 'chatgpt',
      createdAt: created,
      updatedAt: updated,
    });
  }
  return conversations;
}

export function exportBackup(state) {
  return JSON.stringify({ app: 'orquestra', version: 1, exportedAt: new Date().toISOString(), ...state }, null, 2);
}

export function readBackup(data) {
  if (!data || data.app !== 'orquestra') throw new Error('Este arquivo não é um backup do Orquestra.');
  const pick = (k) => (Array.isArray(data[k]) ? data[k] : []);
  return { conversations: pick('conversations'), experts: pick('experts'), prompts: pick('prompts'), contexts: pick('contexts') };
}

// Agrupa conversas por data, como na barra lateral.
export function groupByDate(conversations, now = Date.now()) {
  const day = 24 * 60 * 60 * 1000;
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const t0 = startToday.getTime();
  const groups = { Fixadas: [], Hoje: [], Ontem: [], 'Últimos 7 dias': [], 'Últimos 30 dias': [], 'Mais antigas': [] };
  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  for (const c of sorted) {
    if (c.pinned) groups.Fixadas.push(c);
    else if (c.updatedAt >= t0) groups.Hoje.push(c);
    else if (c.updatedAt >= t0 - day) groups.Ontem.push(c);
    else if (c.updatedAt >= t0 - 7 * day) groups['Últimos 7 dias'].push(c);
    else if (c.updatedAt >= t0 - 30 * day) groups['Últimos 30 dias'].push(c);
    else groups['Mais antigas'].push(c);
  }
  return Object.entries(groups).filter(([, list]) => list.length);
}

export function searchConversations(conversations, query) {
  const q = query.trim().toLowerCase();
  if (!q) return conversations;
  return conversations.filter(
    (c) => c.title.toLowerCase().includes(q) || c.messages.some((m) => (m.text || '').toLowerCase().includes(q)),
  );
}
