import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { parseMarkdown, renderBlocks } from '../markdown.js';
import { validateNote } from '../note-format.js';
import { createWritingStore, DraftConflict } from '../writing-state.js';
import { importNote } from '../scripts/import-note.mjs';

function setup() {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  let id = 0;
  const load = () => createWritingStore({ storage, now: () => Date.parse('2026-10-23T10:00:00+08:00'), makeId: () => `abc000${++id}` });
  return { load };
}
const note = () => ({ slug: 'writing-test', title: '一篇测试记录', date: '2026-10-23', category: '测试', description: '用于验证导入和渲染，不发布。', body: parseMarkdown('# 标题\n\n一段 **加粗** 的文字。\n\n- 一个要点\n\n```js\nconsole.log("你好");\n```') });

test('Markdown 生成标题、引用、列表、代码；原始 HTML 不执行，图片不加载', () => {
  const html = renderBlocks(parseMarkdown('# 标题\n\n> 引用\n\n1. 有序\n2. 列表\n\n```html\n<img src=x onerror=alert(1)>\n```\n\n<script>alert(1)</script>\n\n![远程图](https://example.com/private.png)'));
  assert.match(html, /<h2 id="section-1">标题<\/h2>/);
  assert.match(html, /<blockquote>/); assert.match(html, /<ol>/);
  assert(!html.includes('<script>')); assert(!html.includes('<img'));
  assert.match(html, /&lt;img/); assert.match(html, /\[图片：远程图\]/);
});
test('行内代码与链接转义，禁止 javascript 和 data 链接', () => {
  const html = renderBlocks(parseMarkdown('**重点** 与 *强调* 以及 `<script>`\n\n[坏链接](javascript:alert(1)) [另一个](data:text/html,x) [正常](https://example.com/?a=1&b=2)'));
  assert.match(html, /<strong>重点<\/strong>/); assert.match(html, /<em>强调<\/em>/);
  assert.match(html, /<code>&lt;script&gt;<\/code>/);
  assert(!html.includes('href="javascript:')); assert(!html.includes('href="data:'));
  assert.match(html, /href="https:\/\/example.com\/\?a=1&amp;b=2"/);
});
test('草稿刷新恢复，归档和恢复均保留正文', () => {
  const env = setup(); const first = env.load();
  let draft = first.create();
  draft = first.save(draft.id, { title: '真实的标题', markdown: '# 接着写\n\n这是正文。' }, draft.revision);
  const next = env.load();
  assert.equal(next.read().drafts[0].markdown, '# 接着写\n\n这是正文。');
  draft = next.save(draft.id, { archived: true }, draft.revision);
  assert.equal(first.read().drafts[0].archived, true);
  next.save(draft.id, { archived: false }, draft.revision);
  assert.equal(first.read().drafts[0].title, '真实的标题');
});
test('多个页面编辑同一草稿时，过期版本不能覆盖新内容', () => {
  const env = setup(); const first = env.load(); const second = env.load();
  const draft = first.create(); const old = second.read().drafts[0];
  first.save(draft.id, { markdown: '已保存的新内容' }, draft.revision);
  assert.throws(() => second.save(old.id, { markdown: '过期内容' }, old.revision), DraftConflict);
  assert.equal(first.read().drafts[0].markdown, '已保存的新内容');
});
test('存储不可用时仍可在本页编辑，文章包校验拒绝坏日期和路径', () => {
  const store = createWritingStore({ makeId: () => 'abc0001' });
  let draft = store.create(); draft = store.save(draft.id, { markdown: '本页仍可写作' }, draft.revision);
  assert.equal(store.read().drafts[0].markdown, '本页仍可写作'); assert.equal(store.persistent, false);
  assert.throws(() => validateNote({ ...note(), date: '2026-02-30' }), /日期/);
  assert.throws(() => validateNote({ ...note(), slug: '../escape' }), /地址/);
  assert.deepEqual(validateNote({ format: 'unfinished-note', version: 1, note: note() }).body, note().body);
});
test('文章 JSON 导入不执行代码；重复导入拒绝覆盖，显式更新会备份', async () => {
  const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)), 'output', 'writing-import-tests', randomUUID());
  await mkdir(root, { recursive: true });
  const input = path.join(root, 'input.json');
  await writeFile(input, JSON.stringify({ format: 'unfinished-note', version: 1, note: note() }), 'utf8');
  const first = await importNote(input, { root });
  assert.equal(JSON.parse(await readFile(first.filename, 'utf8')).title, '一篇测试记录');
  await assert.rejects(() => importNote(input, { root }), /已经存在/);
  await writeFile(input, JSON.stringify({ ...note(), title: '明确更新' }), 'utf8');
  await importNote(input, { root, replace: true });
  assert.equal(JSON.parse(await readFile(first.filename, 'utf8')).title, '明确更新');
});
