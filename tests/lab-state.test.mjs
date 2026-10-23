import test from 'node:test';
import assert from 'node:assert/strict';
import { createLabStore, keys } from '../lab-state.js';

function setup() {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  let time = Date.parse('2026-10-22T10:00:00+08:00');
  let id = 0;
  const load = () => createLabStore({ storage, now: () => time, makeId: () => `round-${++id}` });
  return { data, load, advance: seconds => { time += seconds * 1000; } };
}
test('刷新后恢复剩余时间；暂停期间不减少，继续后按剩余时间完成', () => {
  const env = setup();
  const first = env.load();
  first.setDuration(60);
  first.setTask('完成一件小事');
  first.toggleTimer();
  env.advance(12);
  const reloaded = env.load();
  assert.equal(reloaded.getTimer().remaining, 48);
  reloaded.toggleTimer();
  env.advance(300);
  assert.equal(reloaded.getTimer().remaining, 48);
  reloaded.toggleTimer();
  env.advance(48);
  assert.equal(reloaded.getTimer().completed, true);
  assert.equal(reloaded.getHistory()[0].task, '完成一件小事');
});
test('关闭网页后补记完成时间，重复读取与另一个页面不会重复记账', () => {
  const env = setup();
  const first = env.load();
  first.setDuration(60);
  const start = first.toggleTimer();
  env.advance(3600);
  const second = env.load();
  second.getTimer();
  first.getTimer();
  second.getTimer();
  assert.equal(second.getHistory().length, 1);
  assert.equal(second.getHistory()[0].completedAt, start.endAt);
});
test('休息和未完成的重置不计入专注；新的一轮单独记录', () => {
  const env = setup();
  const store = env.load();
  store.setDuration(60, 'break'); store.toggleTimer(); env.advance(60); store.getTimer();
  assert.equal(store.getHistory().length, 0);
  store.setDuration(60); store.toggleTimer(); env.advance(10); store.resetTimer(); env.advance(60); store.getTimer();
  assert.equal(store.getHistory().length, 0);
  store.toggleTimer(); env.advance(60); store.getTimer();
  store.toggleTimer(); env.advance(60); store.getTimer();
  assert.equal(store.getHistory().length, 2);
});
test('配色选择、收藏和取消收藏可跨页面恢复', () => {
  const env = setup();
  const first = env.load();
  first.selectPalette('garden'); first.toggleFavorite();
  const second = env.load();
  assert.deepEqual(second.getPalette(), { current: 'garden', favorites: ['garden'] });
  second.toggleFavorite();
  assert.deepEqual(first.getPalette().favorites, []);
});
test('本地存储不可写时，本页仍然可以计时和收藏', () => {
  let time = Date.now();
  const store = createLabStore({ storage: { getItem: () => null, setItem: () => { throw new Error('禁止存储'); } }, now: () => time, makeId: () => 'volatile-round' });
  store.setDuration(60); store.toggleTimer(); time += 60000; store.getTimer();
  assert.equal(store.getHistory().length, 1);
  store.toggleFavorite();
  assert.equal(store.getPalette().favorites.length, 1);
  assert.equal(store.persistent, false);
});
test('损坏数据安全回退，拒绝无效时长，专注历史最多保留 100 轮', () => {
  const env = setup();
  env.data.set(keys.timer, '{坏数据');
  env.data.set(keys.history, '{}');
  const store = env.load();
  assert.equal(store.getTimer().remaining, 1500);
  assert.deepEqual(store.getHistory(), []);
  assert.throws(() => store.setDuration(0));
  store.setDuration(60);
  for (let index = 0; index < 103; index++) { store.toggleTimer(); env.advance(60); store.getTimer(); }
  assert.equal(store.getHistory().length, 100);
});
