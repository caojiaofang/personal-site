(() => {
  const modes = ['system', 'light', 'dark'];
  const names = { system: '跟随系统', light: '浅色', dark: '深色' };
  const icons = { system: '◐', light: '☀', dark: '☾' };
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let mode = 'system';
  try {
    const saved = localStorage.getItem('unfinished-theme');
    if (modes.includes(saved)) mode = saved;
  } catch { /* 浏览器限制本地存储时，仍允许在当前页面切换。 */ }

  function apply() {
    const dark = mode === 'dark' || (mode === 'system' && media.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#171d2b' : '#f5f7fc');
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.setAttribute('aria-label', `切换主题，当前${names[mode]}`);
      button.title = `当前${names[mode]}，点击切换为${names[modes[(modes.indexOf(mode) + 1) % modes.length]]}`;
      button.querySelector('[data-theme-icon]').textContent = icons[mode];
      button.querySelector('[data-theme-name]').textContent = names[mode];
    });
  }

  // 在样式表加载前设置主题，避免刷新深色页面时闪白。
  apply();
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.querySelectorAll('[data-theme-toggle]').forEach(button => button.addEventListener('click', () => {
      mode = modes[(modes.indexOf(mode) + 1) % modes.length];
      try { localStorage.setItem('unfinished-theme', mode); } catch { /* 保留当前页面的主题选择。 */ }
      apply();
    }));
  });
  media.addEventListener('change', apply);
  window.addEventListener('storage', event => {
    if (event.key !== 'unfinished-theme') return;
    mode = modes.includes(event.newValue) ? event.newValue : 'system';
    apply();
  });
})();
