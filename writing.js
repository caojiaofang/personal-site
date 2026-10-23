import { createWritingStore, writingKey, DraftConflict } from './writing-state.js';
import { parseMarkdown, renderBlocks } from './markdown.js';
import { validateNote } from './note-format.js';

const root = document.querySelector('[data-writing]');
if (root) initializeWriting();

function initializeWriting() {
  let storage;
  try { storage = window.localStorage; } catch { /* 当前页仍可写作与导出。 */ }
  const store = createWritingStore({ storage });
  const names = ['title', 'slug', 'date', 'category', 'description', 'markdown'];
  const inputs = Object.fromEntries(names.map(name => [name, document.querySelector(`#writing-${name}`)]));
  const status = document.querySelector('#writing-status');
  const notice = document.querySelector('#writing-notice');
  let draft;
  let dirty = false;
  let conflict = false;
  let archivedView = false;
  let saveTimer;
  let previewTimer;
  let noticeTimer;

  function tell(text) {
    clearTimeout(noticeTimer);
    notice.textContent = text;
    noticeTimer = setTimeout(() => { notice.textContent = ''; }, 6000);
  }
  function values() { return Object.fromEntries(names.map(name => [name, inputs[name].value])); }
  function storageNote() {
    document.querySelector('#writing-storage').textContent = store.persistent ? '草稿只保存在当前浏览器。导出不会自动发布。' : '浏览器无法保存草稿，当前内容仅保留在本页。请及时下载备份。';
  }
  function savedStatus() {
    status.textContent = store.persistent ? `已保存 ${new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(draft.updatedAt)}` : '仅暂存在本页';
    storageNote();
  }
  function renderPreview() {
    clearTimeout(previewTimer);
    document.querySelector('#writing-preview-title').textContent = inputs.title.value.trim() || '一篇还没起名的记录';
    document.querySelector('#writing-preview-summary').textContent = inputs.description.value;
    const blocks = parseMarkdown(inputs.markdown.value);
    document.querySelector('#writing-preview-body').innerHTML = blocks.length ? renderBlocks(blocks) : '<p class="preview-empty">想法可以先很零散。写下第一句，看看它会长成什么样。</p>';
    const count = inputs.markdown.value.replace(/\s/g, '').length;
    document.querySelector('#writing-word-count').textContent = `${count} 字 · 约 ${Math.max(1, Math.ceil(count / 350))} 分钟`;
  }
  function renderList() {
    const state = store.read();
    const active = state.drafts.filter(item => !item.archived);
    const archived = state.drafts.filter(item => item.archived);
    document.querySelector('#draft-active-count').textContent = String(active.length);
    document.querySelector('#draft-archive-count').textContent = String(archived.length);
    document.querySelectorAll('[data-draft-filter]').forEach(button => button.setAttribute('aria-pressed', String((button.dataset.draftFilter === 'archive') === archivedView)));
    const rows = (archivedView ? archived : active).sort((a, b) => b.updatedAt - a.updatedAt);
    document.querySelector('#draft-list-empty').hidden = rows.length !== 0;
    document.querySelector('#draft-list').replaceChildren(...rows.map((item, index) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-pressed', String(item.id === draft?.id));
      button.setAttribute('aria-label', `打开草稿：${item.title || `未命名草稿 ${index + 1}`}`);
      const title = document.createElement('strong');
      title.textContent = item.title || '未命名草稿';
      const meta = document.createElement('span');
      meta.textContent = `${item.date || '日期待填写'} · ${item.markdown.replace(/\s/g, '').length} 字`;
      button.append(title, meta);
      button.addEventListener('click', () => {
        if (!persist()) return;
        const selected = store.select(item.id);
        if (selected) load(selected);
      });
      li.append(button);
      return li;
    }));
  }
  function showConflict(error) {
    conflict = true;
    document.querySelector('#writing-conflict').hidden = false;
    status.textContent = '尚未保存：存在其他页面的更新';
    tell(error.message);
  }
  function persist() {
    clearTimeout(saveTimer);
    if (!dirty) return true;
    if (conflict) return false;
    try {
      draft = store.save(draft.id, values(), draft.revision);
      dirty = false;
      savedStatus();
      renderList();
      return true;
    } catch (error) {
      if (error instanceof DraftConflict) showConflict(error);
      else tell(error.message);
      return false;
    }
  }
  function load(item) {
    clearTimeout(saveTimer);
    draft = item;
    dirty = false;
    conflict = false;
    archivedView = item.archived;
    names.forEach(name => { inputs[name].value = item[name]; });
    document.querySelector('#writing-conflict').hidden = true;
    document.querySelector('#archive-draft').textContent = draft.archived ? '恢复草稿' : '归档草稿';
    savedStatus(); renderList(); renderPreview();
  }
  function changed() {
    dirty = true;
    if (!conflict) status.textContent = '正在保存…';
    clearTimeout(saveTimer);
    clearTimeout(previewTimer);
    saveTimer = setTimeout(persist, 500);
    previewTimer = setTimeout(renderPreview, 120);
  }
  function download(filename, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  function noteForExport() {
    const form = values();
    const body = parseMarkdown(form.markdown);
    const description = form.description.trim() || (body.find(block => block.type === 'paragraph')?.text || form.title).replace(/[*`#]/g, '').slice(0, 160);
    return validateNote({ ...form, description, body });
  }

  const state = store.read();
  const current = state.drafts.find(item => item.id === state.currentId) || state.drafts[0];
  load(current || store.create());
  names.forEach(name => inputs[name].addEventListener('input', changed));
  document.querySelector('#new-draft').addEventListener('click', () => {
    if (!persist()) return;
    try { load(store.create()); inputs.title.focus(); } catch (error) { tell(error.message); }
  });
  document.querySelector('#save-draft').addEventListener('click', () => { if (persist()) tell(store.persistent ? '草稿已保存。' : '内容仅暂存在本页，请下载备份。'); });
  document.querySelectorAll('[data-draft-filter]').forEach(button => button.addEventListener('click', () => { archivedView = button.dataset.draftFilter === 'archive'; renderList(); }));
  document.querySelector('#archive-draft').addEventListener('click', () => {
    if (!persist()) return;
    try { load(store.save(draft.id, { archived: !draft.archived }, draft.revision)); tell(draft.archived ? '已归档，可随时恢复继续写。' : '已恢复到草稿。'); } catch (error) { showConflict(error); }
  });
  document.querySelector('#reload-draft').addEventListener('click', () => {
    const saved = store.read().drafts.find(item => item.id === draft.id);
    if (saved) { load(saved); tell('已载入保存的版本。'); }
  });
  document.querySelector('#download-markdown').addEventListener('click', () => {
    const form = values();
    if (!form.markdown.trim() && !form.title.trim()) { tell('先写一点内容，再下载 Markdown。'); return; }
    persist();
    const metadata = ['title', 'date', 'slug', 'category', 'description'].map(name => `${name}: ${JSON.stringify(form[name])}`).join('\n');
    const filename = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug) ? form.slug : 'unfinished-draft';
    download(`${filename}.md`, `---\n${metadata}\n---\n\n${form.markdown}\n`, 'text/markdown;charset=utf-8');
    tell('Markdown 已导出，草稿仍保留在写作台。');
  });
  document.querySelector('#download-note').addEventListener('click', () => {
    try {
      const note = noteForExport();
      persist();
      download(`${note.slug}.json`, JSON.stringify({ format: 'unfinished-note', version: 1, note }, null, 2) + '\n', 'application/json;charset=utf-8');
      tell('文章包已导出，尚未发布到网站。');
    } catch (error) { tell(error.message); }
  });
  const insertions = { heading: ['\n## ', '\n', '小标题'], bold: ['**', '**', '重点'], italic: ['*', '*', '强调'], quote: ['\n> ', '\n', '一句想留下的话'], list: ['\n- ', '\n', '一个要点'], code: ['\n```js\n', '\n```\n', '// 在这里放代码'], link: ['[', '](https://example.com)', '链接文字'] };
  function insert(type) {
    const [prefix, suffix, placeholder] = insertions[type];
    const editor = inputs.markdown;
    const selected = editor.value.slice(editor.selectionStart, editor.selectionEnd) || placeholder;
    if (editor.value.length + prefix.length + suffix.length + selected.length > 20000) { tell('正文最多支持 20,000 个字符。'); return; }
    editor.setRangeText(prefix + selected + suffix, editor.selectionStart, editor.selectionEnd, 'end');
    editor.focus(); changed();
  }
  document.querySelectorAll('[data-writing-insert]').forEach(button => button.addEventListener('click', () => insert(button.dataset.writingInsert)));
  document.querySelectorAll('[data-writing-view]').forEach(button => button.addEventListener('click', () => {
    renderPreview(); root.dataset.view = button.dataset.writingView;
    document.querySelectorAll('[data-writing-view]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  }));
  window.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); if (persist()) tell('草稿已保存。'); }
  });
  window.addEventListener('pagehide', persist);
  window.addEventListener('beforeunload', event => { if (!persist()) { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('storage', event => {
    if (event.key !== writingKey && event.key !== null) return;
    const remote = store.read().drafts.find(item => item.id === draft.id);
    if (remote && remote.revision !== draft.revision) {
      if (dirty) showConflict(new DraftConflict());
      else load(remote);
    }
    renderList();
  });
}
