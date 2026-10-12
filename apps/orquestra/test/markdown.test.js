import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, inline } from '../public/js/markdown.js';

test('HTML do modelo nunca vira tag', () => {
  const html = renderMarkdown('<img src=x onerror=alert(1)> **ok**');
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('<strong>ok</strong>'));
});

test('links só com http, https ou mailto', () => {
  assert.match(inline('[a](https://x.com)'), /href="https:\/\/x\.com"/);
  assert.ok(!inline('[a](javascript:alert(1))').includes('href'));
  assert.ok(!inline('[a](https://x.com" onclick="y)').includes('onclick="'));
});

test('blocos de código são escapados e mantêm o conteúdo', () => {
  const html = renderMarkdown('```js\nconst a = "<b>";\n```');
  assert.match(html, /<pre data-lang="js"><code>const a = &quot;&lt;b&gt;&quot;;<\/code><\/pre>/);
});

test('código inline não é formatado por dentro', () => {
  assert.equal(inline('`**x**`'), '<code>**x**</code>');
});

test('títulos, listas, tabelas e citações', () => {
  const html = renderMarkdown('# T\n\n- a\n- b\n\n1. um\n2. dois\n\n| x | y |\n| --- | --- |\n| 1 | 2 |\n\n> nota\n\n- [x] feito');
  assert.match(html, /<h2>T<\/h2>/);
  assert.match(html, /<ul><li>a<\/li><li>b<\/li><\/ul>/);
  assert.match(html, /<ol><li>um<\/li><li>dois<\/li><\/ol>/);
  assert.match(html, /<th>x<\/th>.*<td>2<\/td>/s);
  assert.match(html, /<blockquote><p>nota<\/p><\/blockquote>/);
  assert.match(html, /checked/);
});

test('entradas estranhas não travam o renderizador', () => {
  for (const s of ['| solta |', '``` a b', '>', '1.', '***', '```', '- ', '\n\n\n']) {
    assert.equal(typeof renderMarkdown(s), 'string');
  }
});
