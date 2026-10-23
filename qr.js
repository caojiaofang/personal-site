import { createQr, qrSvg, qrPixels, maxQrBytes } from './qr-code.js';

const root = document.querySelector('[data-qr-tool]');
if (root) {
  const input = document.querySelector('#qr-content');
  const level = document.querySelector('#qr-level');
  const size = document.querySelector('#qr-size');
  const preview = document.querySelector('#qr-preview');
  const empty = document.querySelector('#qr-empty');
  const status = document.querySelector('#qr-status');
  const notice = document.querySelector('#qr-notice');
  const count = document.querySelector('#qr-count');
  const details = document.querySelector('#qr-details');
  const png = document.querySelector('#qr-png');
  const svg = document.querySelector('#qr-svg');
  let current = null;
  let pending;
  let composing = false;
  let downloading = false;

  function invalidate() {
    clearTimeout(pending);
    current = null;
    preview.replaceChildren();
    preview.hidden = true;
    empty.hidden = false;
    png.disabled = svg.disabled = true;
    notice.textContent = '';
    details.textContent = '黑白配色 · 四周留白';
    const bytes = new TextEncoder().encode(input.value).length;
    count.textContent = `${bytes.toLocaleString('en-US')} / ${maxQrBytes.toLocaleString('en-US')} 字节`;
    const tooLong = bytes > maxQrBytes;
    input.setAttribute('aria-invalid', String(tooLong));
    status.dataset.state = tooLong ? 'error' : 'empty';
    status.textContent = tooLong ? '内容超出 2,000 字节，请缩短后再生成。' : input.value.trim() ? '正在生成…' : '输入内容后，这里会出现二维码。';
  }

  function render() {
    invalidate();
    if (!input.value.trim()) return;
    try {
      current = createQr(input.value, level.value);
      preview.innerHTML = qrSvg(current, Number(size.value));
      preview.hidden = false;
      empty.hidden = true;
      png.disabled = downloading;
      svg.disabled = false;
      details.textContent = `${size.value} × ${size.value} px · ${current.size} × ${current.size} 模块`;
      status.dataset.state = 'ready';
      status.textContent = '二维码已生成，可以扫描或下载。';
      input.setAttribute('aria-invalid', 'false');
    } catch (error) {
      current = null;
      status.dataset.state = 'error';
      status.textContent = error.message;
      input.setAttribute('aria-invalid', 'true');
    }
  }

  function schedule() {
    invalidate();
    if (!composing) pending = setTimeout(render, 180);
  }
  input.addEventListener('input', schedule);
  input.addEventListener('compositionstart', () => { composing = true; invalidate(); });
  input.addEventListener('compositionend', () => { composing = false; schedule(); });
  level.addEventListener('change', render);
  size.addEventListener('change', render);
  document.querySelector('#qr-example').addEventListener('click', () => {
    input.value = 'https://www.zf-yun.cn/';
    render();
    input.focus();
  });
  document.querySelector('#qr-clear').addEventListener('click', () => {
    input.value = '';
    render();
    input.focus();
  });

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  svg.addEventListener('click', () => {
    if (!current) return;
    download(new Blob([qrSvg(current, Number(size.value))], { type: 'image/svg+xml' }), `unfinished-qr-${size.value}.svg`);
    notice.textContent = 'SVG 下载已开始，可无损放大或用于印刷。';
  });
  png.addEventListener('click', async () => {
    if (!current || downloading) return;
    const code = current;
    const width = Number(size.value);
    downloading = true;
    png.disabled = true;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = width;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('当前浏览器无法生成 PNG，请下载 SVG。');
      context.putImageData(new ImageData(qrPixels(code, width), width, width), 0, 0);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('PNG 生成失败，请重试或下载 SVG。');
      download(blob, `unfinished-qr-${width}.png`);
      notice.textContent = 'PNG 下载已开始，可以保存或分享图片。';
    } catch (error) { notice.textContent = error.message; }
    finally { downloading = false; png.disabled = !current; }
  });
  render();
}
