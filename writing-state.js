export const writingKey = 'unfinished-writing-v1';
export class DraftConflict extends Error { constructor() { super('这篇草稿已在另一个页面更新，请先导出本页内容，再载入已保存版本。'); } }
const fields = { title: 120, slug: 80, date: 10, category: 30, description: 240, markdown: 20000 };
export function localDate(timestamp = Date.now()) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function createWritingStore({ storage, now = Date.now, makeId = () => globalThis.crypto.randomUUID() } = {}) {
  let memory;
  let persistent = Boolean(storage);
  function read() {
    let value;
    try { value = memory ?? storage?.getItem(writingKey); } catch { persistent = false; }
    try {
      const saved = JSON.parse(value || 'null');
      if (saved?.version === 1 && Array.isArray(saved.drafts)) {
        const ids = new Set();
        const drafts = saved.drafts.filter(draft => {
          if (!draft || typeof draft.id !== 'string' || !draft.id.length || draft.id.length > 100 || ids.has(draft.id) || !Number.isSafeInteger(draft.revision) || draft.revision < 1 || !Number.isFinite(draft.updatedAt) || !Number.isFinite(new Date(draft.updatedAt).getTime()) || !Object.entries(fields).every(([field, max]) => typeof draft[field] === 'string' && draft[field].length <= max)) return false;
          ids.add(draft.id);
          return true;
        }).slice(0, 100).map(draft => ({ ...draft, archived: Boolean(draft.archived) }));
        return { version: 1, currentId: saved.currentId, drafts };
      }
    } catch { /* 损坏的草稿不阻止打开写作台。 */ }
    return { version: 1, currentId: null, drafts: [] };
  }
  function write(state) {
    const value = JSON.stringify(state);
    try {
      if (!storage) throw new Error('本地存储不可用');
      storage.setItem(writingKey, value);
      memory = undefined;
    } catch { persistent = false; memory = value; }
  }
  function create() {
    const state = read();
    if (state.drafts.length >= 100) throw new Error('当前已保留 100 篇草稿，请先导出需要的内容，再复用已有草稿。');
    const id = makeId();
    const draft = { id, revision: 1, title: '', slug: `note-${localDate(now()).replaceAll('-', '')}-${id.slice(0, 6)}`, date: localDate(now()), category: '随手记', description: '', markdown: '', archived: false, updatedAt: now() };
    state.drafts.unshift(draft);
    state.currentId = id;
    write(state);
    return { ...draft };
  }
  function save(id, patch, revision) {
    const state = read();
    const index = state.drafts.findIndex(draft => draft.id === id);
    if (index < 0 || state.drafts[index].revision !== revision) throw new DraftConflict();
    const changes = {};
    for (const [field, max] of Object.entries(fields)) if (typeof patch[field] === 'string') changes[field] = patch[field].slice(0, max);
    if (typeof patch.archived === 'boolean') changes.archived = patch.archived;
    const draft = { ...state.drafts[index], ...changes, revision: revision + 1, updatedAt: now() };
    state.drafts[index] = draft;
    state.currentId = id;
    write(state);
    return { ...draft };
  }
  function select(id) {
    const state = read();
    if (!state.drafts.some(draft => draft.id === id)) return null;
    state.currentId = id;
    write(state);
    return { ...state.drafts.find(draft => draft.id === id) };
  }
  return { read, create, save, select, get persistent() { return persistent; } };
}
