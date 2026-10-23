// 纯状态模块：浏览器和测试共用，同一来源的页面共享本地数据。
export const palettes = [
  { id: 'coast', name: '海边的慢时光', colors: ['#263B68', '#739BB5', '#C7DBDE', '#F0C9A3', '#DB7B62'] },
  { id: 'garden', name: '雨后的花园', colors: ['#34584B', '#7CA58E', '#D4E2CF', '#F1DFBF', '#B98C83'] },
  { id: 'sunday', name: '蓝色星期天', colors: ['#273B82', '#647BE8', '#B5C1F3', '#E6EAFB', '#E8B6C3'] },
  { id: 'sunset', name: '落日经过山谷', colors: ['#59465E', '#997A92', '#D1A8A1', '#F1CCA8', '#FAEDD6'] },
  { id: 'forest', name: '纸上的森林', colors: ['#30433D', '#768677', '#B5BCA4', '#E5DEC9', '#BEA98A'] },
  { id: 'summer', name: '有点像夏天', colors: ['#225C71', '#59A7AC', '#B9DDD0', '#FAE6AE', '#ED9B73'] },
];

export const keys = { timer: 'unfinished-focus-v1', history: 'unfinished-focus-history-v1', palette: 'unfinished-palette-v1' };
export const formatTime = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
const cleanTask = text => typeof text === 'string' ? text.slice(0, 80) : '';
const validDuration = seconds => Number.isInteger(seconds) && seconds >= 60 && seconds <= 10800;
const defaultTimer = () => ({ version: 1, runId: null, duration: 1500, remaining: 1500, endAt: null, running: false, completed: false, kind: 'focus', task: '', startedAt: null });

export function createLabStore({ storage, now = Date.now, makeId = () => globalThis.crypto.randomUUID() } = {}) {
  const volatile = new Map();
  let persistent = Boolean(storage);
  function read(key, fallback) {
    let raw;
    try {
      raw = volatile.has(key) ? volatile.get(key) : storage?.getItem(key);
    } catch { persistent = false; return fallback; }
    try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
  }
  function write(key, value) {
    const text = JSON.stringify(value);
    try {
      if (!storage) throw new Error('没有本地存储');
      storage.setItem(key, text);
      volatile.delete(key);
    } catch { persistent = false; volatile.set(key, text); }
  }
  function getHistory() {
    const history = read(keys.history, []);
    if (!Array.isArray(history)) return [];
    const seen = new Set();
    return history.filter(record => {
      if (!record || typeof record.id !== 'string' || seen.has(record.id) || !validDuration(record.duration) || !Number.isFinite(record.completedAt) || record.completedAt <= 0) return false;
      seen.add(record.id);
      return true;
    }).slice(0, 100).map(record => ({ id: record.id, duration: record.duration, task: cleanTask(record.task), completedAt: record.completedAt }));
  }
  function getTimer() {
    let timer = read(keys.timer, null);
    if (!timer || timer.version !== 1 || !validDuration(timer.duration) || !Number.isInteger(timer.remaining) || timer.remaining < 0 || timer.remaining > timer.duration || typeof timer.running !== 'boolean' || !['focus', 'break'].includes(timer.kind)) return defaultTimer();
    timer = { ...defaultTimer(), ...timer, task: cleanTask(timer.task) };
    if (timer.running && (!Number.isFinite(timer.endAt) || typeof timer.runId !== 'string' || !timer.runId)) return defaultTimer();
    if (timer.running) {
      timer.remaining = Math.min(timer.duration, Math.max(0, Math.ceil((timer.endAt - now()) / 1000)));
      if (timer.remaining === 0) {
        if (timer.kind === 'focus') {
          const history = getHistory();
          if (!history.some(record => record.id === timer.runId)) {
            history.unshift({ id: timer.runId, duration: timer.duration, task: timer.task, completedAt: timer.endAt });
            write(keys.history, history.slice(0, 100));
          }
        }
        timer.running = false;
        timer.completed = true;
        write(keys.timer, timer);
      }
    }
    return timer;
  }
  function setDuration(seconds, kind = 'focus') {
    if (!validDuration(seconds) || !['focus', 'break'].includes(kind)) throw new Error('时长需要为 1 至 180 分钟');
    const timer = { ...defaultTimer(), duration: seconds, remaining: seconds, kind, task: getTimer().task };
    write(keys.timer, timer);
    return timer;
  }
  function setTask(task) {
    const timer = { ...getTimer(), task: cleanTask(task) };
    write(keys.timer, timer);
    return timer;
  }
  function toggleTimer() {
    let timer = getTimer();
    if (timer.running) timer = { ...timer, running: false, endAt: null };
    else {
      if (timer.completed || timer.remaining === 0) timer = { ...timer, remaining: timer.duration, completed: false, runId: null };
      timer = { ...timer, running: true, runId: timer.runId || makeId(), startedAt: timer.startedAt ?? now(), endAt: now() + timer.remaining * 1000 };
    }
    write(keys.timer, timer);
    return timer;
  }
  function resetTimer() {
    const timer = getTimer();
    return setDuration(timer.duration, timer.kind);
  }
  function getPalette() {
    const saved = read(keys.palette, {});
    const current = palettes.some(palette => palette.id === saved?.current) ? saved.current : palettes[0].id;
    const favorites = Array.isArray(saved?.favorites) ? [...new Set(saved.favorites)].filter(id => palettes.some(palette => palette.id === id)) : [];
    return { current, favorites };
  }
  function selectPalette(id) {
    if (!palettes.some(palette => palette.id === id)) return;
    write(keys.palette, { ...getPalette(), current: id });
  }
  function toggleFavorite() {
    const saved = getPalette();
    saved.favorites = saved.favorites.includes(saved.current) ? saved.favorites.filter(id => id !== saved.current) : [...saved.favorites, saved.current];
    write(keys.palette, saved);
  }
  return { getTimer, setDuration, setTask, toggleTimer, resetTimer, getHistory, getPalette, selectPalette, toggleFavorite, get persistent() { return persistent; } };
}
