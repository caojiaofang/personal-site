import { createLabStore, palettes, formatTime, keys } from './lab-state.js';

let storage;
try { storage = window.localStorage; } catch { /* 存储不可用时使用本页内存。 */ }
const store = createLabStore({ storage });
const originalTitle = document.title;
const root = document.querySelector('[data-lab-tool]');
const tool = root?.dataset.labTool;
const toast = document.createElement('div');
toast.className = 'toast';
toast.setAttribute('role', 'status');
toast.setAttribute('aria-live', 'polite');
document.body.append(toast);
let toastTimeout;
function notify(message) {
  clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.classList.add('visible');
  toastTimeout = setTimeout(() => toast.classList.remove('visible'), 3000);
}

async function copy(text) {
  try {
    if (window.isSecureContext && navigator.clipboard) await navigator.clipboard.writeText(text);
    else {
      const field = document.createElement('textarea');
      field.value = text;
      field.style.cssText = 'position:fixed;opacity:0';
      document.body.append(field);
      field.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } finally { field.remove(); }
      if (!copied) throw new Error('复制不可用');
    }
    notify('已复制到剪贴板。');
  } catch { notify('浏览器未允许复制，请手动选中内容复制。'); }
}
function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  notify('导出文件已准备好。');
}
function updateStorageNote() {
  const note = document.querySelector('[data-storage-note]');
  if (note) note.textContent = store.persistent ? '保存在当前浏览器，不会上传服务器。' : '当前浏览器无法保存；数据仅保留到本页关闭。';
}

function paletteView() {
  const saved = store.getPalette();
  const palette = palettes.find(item => item.id === saved.current);
  document.querySelector('#current-palette-name').textContent = palette.name;
  document.querySelector('#palette-position').textContent = `${palettes.indexOf(palette) + 1} / ${palettes.length}`;
  document.querySelector('#lab-swatches').replaceChildren(...palette.colors.map((color, index) => {
    const button = document.createElement('button');
    button.className = 'lab-swatch';
    button.style.setProperty('--swatch', color);
    button.setAttribute('aria-label', `复制色值 ${color}`);
    const hex = document.createElement('span');
    hex.textContent = color;
    const label = document.createElement('small');
    label.textContent = `颜色 ${index + 1}`;
    button.append(label, hex);
    button.addEventListener('click', () => copy(color));
    return button;
  }));
  const favorite = document.querySelector('#favorite-palette');
  const isFavorite = saved.favorites.includes(palette.id);
  favorite.setAttribute('aria-pressed', String(isFavorite));
  favorite.textContent = isFavorite ? '♥ 已收藏' : '♡ 收藏这组';
  document.querySelector('#favorite-count').textContent = String(saved.favorites.length);
  document.querySelector('#favorites-empty').hidden = saved.favorites.length !== 0;
  document.querySelector('#favorite-palettes').replaceChildren(...saved.favorites.map(id => {
    const item = palettes.find(palette => palette.id === id);
    const button = document.createElement('button');
    button.className = 'saved-palette';
    button.setAttribute('aria-label', `查看收藏：${item.name}`);
    button.setAttribute('aria-pressed', String(id === palette.id));
    const colors = document.createElement('span');
    colors.className = 'saved-colors';
    item.colors.forEach(color => { const swatch = document.createElement('i'); swatch.style.backgroundColor = color; colors.append(swatch); });
    const label = document.createElement('span');
    label.textContent = item.name;
    button.append(colors, label);
    button.addEventListener('click', () => { store.selectPalette(id); paletteView(); });
    return button;
  }));
  updateStorageNote();
}

if (tool === 'palette') {
  paletteView();
  document.querySelector('#next-palette').addEventListener('click', () => {
    const index = palettes.findIndex(item => item.id === store.getPalette().current);
    store.selectPalette(palettes[(index + 1) % palettes.length].id);
    paletteView();
  });
  document.querySelector('#favorite-palette').addEventListener('click', () => {
    store.toggleFavorite();
    paletteView();
    notify(store.getPalette().favorites.includes(store.getPalette().current) ? '已收藏，可以随时回来找到它。' : '已取消收藏。');
  });
  const current = () => palettes.find(item => item.id === store.getPalette().current);
  const css = () => `/* 未完 · ${current().name} */\n:root {\n${current().colors.map((color, index) => `  --palette-${index + 1}: ${color};`).join('\n')}\n}\n`;
  document.querySelector('#copy-css').addEventListener('click', () => copy(css()));
  document.querySelector('#export-css').addEventListener('click', () => download(`unfinished-${current().id}.css`, css(), 'text/css;charset=utf-8'));
  document.querySelector('#export-svg').addEventListener('click', () => {
    const palette = current();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600" role="img" aria-label="${palette.name}"><title>${palette.name}</title>${palette.colors.map((color, index) => `<rect x="${index * 200}" width="200" height="600" fill="${color}"/><rect x="${index * 200 + 24}" y="530" width="152" height="40" rx="8" fill="#ffffff"/><text x="${index * 200 + 100}" y="556" fill="#26314d" font-size="18" font-family="sans-serif" text-anchor="middle">${color}</text>`).join('')}</svg>`;
    download(`unfinished-${palette.id}.svg`, svg, 'image/svg+xml;charset=utf-8');
  });
}

const dock = document.createElement('aside');
dock.className = 'focus-dock';
dock.hidden = true;
dock.setAttribute('aria-label', '当前专注计时');
dock.innerHTML = '<span class="dock-dot" aria-hidden="true"></span><a href="/tools/focus/" class="dock-link"><strong class="dock-time"></strong><span class="dock-task"></span></a><button type="button" class="dock-toggle"></button>';
document.body.append(dock);
dock.querySelector('button').addEventListener('click', () => { store.toggleTimer(); updateFocus(); });
let previousTimer = store.getTimer();
let lastHistory = '';

function historyView() {
  if (tool !== 'focus') return;
  const history = store.getHistory();
  const signature = JSON.stringify([new Date().toDateString(), history]);
  if (signature === lastHistory) return;
  lastHistory = signature;
  const today = new Date().toDateString();
  const records = history.filter(record => new Date(record.completedAt).toDateString() === today);
  document.querySelector('#today-rounds').textContent = String(records.length);
  document.querySelector('#today-minutes').textContent = String(records.reduce((total, record) => total + record.duration / 60, 0));
  document.querySelector('#history-empty').hidden = history.length !== 0;
  document.querySelector('#focus-history').replaceChildren(...history.slice(0, 8).map(record => {
    const row = document.createElement('li');
    const title = document.createElement('strong');
    title.textContent = record.task || '一段专注';
    const meta = document.createElement('span');
    meta.textContent = `${new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(record.completedAt)} · ${record.duration / 60} 分钟`;
    row.append(title, meta);
    return row;
  }));
  document.querySelector('#export-history').disabled = history.length === 0;
}

function updateFocus() {
  const timer = store.getTimer();
  if (previousTimer.running && timer.completed && previousTimer.runId === timer.runId) notify(timer.kind === 'break' ? '休息结束了，准备开始下一件小事吧。' : '完成一段专注，记录已保存。');
  previousTimer = timer;
  const active = !timer.completed && Boolean(timer.runId);
  dock.hidden = tool === 'focus' || !active;
  document.body.classList.toggle('has-focus-dock', !dock.hidden);
  dock.querySelector('.dock-time').textContent = formatTime(timer.remaining);
  dock.querySelector('.dock-task').textContent = timer.task || (timer.kind === 'break' ? '休息一下' : '一小段专注');
  dock.querySelector('button').textContent = timer.running ? '暂停' : '继续';
  dock.querySelector('button').setAttribute('aria-label', timer.running ? '暂停当前计时' : '继续当前计时');
  document.title = timer.running ? `${formatTime(timer.remaining)} · ${timer.kind === 'break' ? '休息中' : '专注中'} · 未完` : originalTitle;
  if (tool !== 'focus') return;
  document.querySelector('#timer-display').textContent = formatTime(timer.remaining);
  document.querySelector('#timer-progress').style.width = `${(1 - timer.remaining / timer.duration) * 100}%`;
  document.querySelector('#toggle-timer').textContent = timer.running ? '暂停一下' : timer.completed ? '再来一轮' : active ? '继续计时' : '开始计时';
  document.querySelector('#timer-state').textContent = timer.completed ? (timer.kind === 'break' ? '休息结束了，准备开始下一件小事吧。' : '这一轮完成了，伸个懒腰吧。') : timer.running ? (timer.kind === 'break' ? '暂时把手头的事放一放。' : '现在，只做这一件事。') : active ? '已暂停，准备好再继续。' : '选一件小事，准备好了就开始。';
  const input = document.querySelector('#focus-task');
  if (document.activeElement !== input) input.value = timer.task;
  document.querySelectorAll('[data-seconds]').forEach(button => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.seconds) === timer.duration && button.dataset.kind === timer.kind));
    button.disabled = timer.running;
  });
  document.querySelector('#custom-minutes').disabled = timer.running;
  document.querySelector('#apply-duration').disabled = timer.running;
  historyView();
  updateStorageNote();
}

if (tool === 'focus') {
  document.querySelector('#custom-minutes').value = String(store.getTimer().duration / 60);
  document.querySelector('#focus-task').addEventListener('input', event => { store.setTask(event.target.value); updateFocus(); });
  document.querySelectorAll('[data-seconds]').forEach(button => button.addEventListener('click', () => {
    store.setDuration(Number(button.dataset.seconds), button.dataset.kind);
    document.querySelector('#custom-minutes').value = String(Number(button.dataset.seconds) / 60);
    updateFocus();
  }));
  document.querySelector('#custom-duration').addEventListener('submit', event => {
    event.preventDefault();
    const minutes = Number(document.querySelector('#custom-minutes').value);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) { notify('请输入 1 至 180 之间的整数分钟数。'); return; }
    store.setDuration(minutes * 60);
    updateFocus();
    notify(`已设为 ${minutes} 分钟专注。`);
  });
  document.querySelector('#toggle-timer').addEventListener('click', () => { store.toggleTimer(); updateFocus(); });
  document.querySelector('#reset-timer').addEventListener('click', () => { store.resetTimer(); updateFocus(); });
  document.querySelector('#export-history').addEventListener('click', () => download('unfinished-focus-history.json', JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), records: store.getHistory() }, null, 2), 'application/json;charset=utf-8'));
}
updateFocus();
setInterval(updateFocus, 1000);
window.addEventListener('pageshow', () => { updateFocus(); if (tool === 'palette') paletteView(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) updateFocus(); });
window.addEventListener('storage', event => {
  if (event.key === keys.timer || event.key === keys.history || event.key === null) updateFocus();
  if ((event.key === keys.palette || event.key === null) && tool === 'palette') paletteView();
});
