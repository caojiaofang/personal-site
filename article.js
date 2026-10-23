const progress = document.querySelector('#reading-progress');
const headings = [...document.querySelectorAll('.article-body h2, .article-body h3')];
const tocLinks = [...document.querySelectorAll('.article-toc a')];
let scheduled = false;

function updateReadingPosition() {
  scheduled = false;
  const body = document.querySelector('.article-body');
  if (!body) return;
  const top = body.getBoundingClientRect().top + window.scrollY;
  const distance = Math.max(1, body.offsetHeight - window.innerHeight * 0.5);
  const value = Math.min(100, Math.max(0, ((window.scrollY - top + 140) / distance) * 100));
  progress.style.width = `${value}%`;
  let current = headings[0]?.id;
  headings.forEach(heading => { if (heading.getBoundingClientRect().top <= 180) current = heading.id; });
  tocLinks.forEach(link => {
    if (link.getAttribute('href') === `#${current}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}

function scheduleReadingUpdate() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(updateReadingPosition);
}
window.addEventListener('scroll', scheduleReadingUpdate, { passive: true });
window.addEventListener('resize', scheduleReadingUpdate);
updateReadingPosition();

const copyButton = document.querySelector('[data-copy-link]');
const feedback = document.querySelector('#share-feedback');
let feedbackTimer;
copyButton?.addEventListener('click', async () => {
  const url = new URL(window.location.href);
  url.hash = '';
  try {
    if (window.isSecureContext && navigator.clipboard) await navigator.clipboard.writeText(url.href);
    else {
      const field = document.createElement('textarea');
      field.value = url.href;
      field.style.cssText = 'position:fixed;opacity:0';
      document.body.append(field);
      field.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } finally { field.remove(); copyButton.focus(); }
      if (!copied) throw new Error('复制不可用');
    }
    feedback.textContent = '链接已复制，可以分享给朋友了。';
  } catch {
    feedback.textContent = `请从地址栏复制链接：${url.href}`;
  }
  clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => { feedback.textContent = ''; }, 5000);
});
