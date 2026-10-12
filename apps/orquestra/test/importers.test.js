import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importChatGPT, groupByDate, searchConversations, readBackup, exportBackup } from '../public/js/importers.js';

const sample = [{
  title: 'Receita de bolo',
  create_time: 1700000000,
  update_time: 1700000100,
  current_node: 'c2',
  mapping: {
    root: { message: null, parent: null },
    sys: { message: { author: { role: 'system' }, content: { parts: ['x'] } }, parent: 'root' },
    u1: { message: { author: { role: 'user' }, content: { parts: ['Como faço bolo?'] } }, parent: 'sys' },
    a1: { message: { author: { role: 'assistant' }, content: { parts: ['Versão antiga'] } }, parent: 'u1' },
    a2: { message: { author: { role: 'assistant' }, content: { parts: ['Misture tudo.'] } }, parent: 'u1' },
    t1: { message: { author: { role: 'tool' }, content: { parts: ['busca'] } }, parent: 'a2' },
    c2: { message: { author: { role: 'assistant' }, content: { parts: ['E asse.'] } }, parent: 't1' },
  },
}, { title: 'vazia', mapping: {} }, null];

test('importa só o ramo atual, sem system e tool, unindo respostas seguidas', () => {
  const [conv, ...rest] = importChatGPT(sample);
  assert.equal(rest.length, 0);
  assert.equal(conv.title, 'Receita de bolo');
  assert.equal(conv.createdAt, 1700000000000);
  assert.deepEqual(conv.messages.map((m) => [m.role, m.text]), [
    ['user', 'Como faço bolo?'],
    ['assistant', 'Misture tudo.\n\nE asse.'],
  ]);
});

test('arquivo que não é lista é recusado', () => {
  assert.throws(() => importChatGPT({}), /conversations\.json/);
});

test('agrupa por data com fixadas primeiro', () => {
  const now = new Date('2026-10-12T15:00:00').getTime();
  const day = 864e5;
  const groups = groupByDate([
    { id: 'a', updatedAt: now - 1000 },
    { id: 'b', updatedAt: now - day },
    { id: 'c', updatedAt: now - 3 * day },
    { id: 'd', updatedAt: now - 90 * day, pinned: true },
  ], now);
  assert.deepEqual(groups.map(([k, v]) => [k, v.map((c) => c.id)]), [
    ['Fixadas', ['d']], ['Hoje', ['a']], ['Ontem', ['b']], ['Últimos 7 dias', ['c']],
  ]);
});

test('busca no título e no texto', () => {
  const list = [{ title: 'Planilha', messages: [] }, { title: 'X', messages: [{ text: 'contrato de aluguel' }] }];
  assert.equal(searchConversations(list, 'ALUGUEL').length, 1);
  assert.equal(searchConversations(list, '').length, 2);
});

test('backup vai e volta', () => {
  const b = readBackup(JSON.parse(exportBackup({ conversations: [{ id: 1 }], experts: [], prompts: [], contexts: [] })));
  assert.equal(b.conversations.length, 1);
  assert.throws(() => readBackup({ app: 'outro' }));
});
