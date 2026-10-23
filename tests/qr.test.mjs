import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { createQr, qrSvg, qrPixels } from '../qr-code.js';

function decode(qr, size = 512) {
  const pixels = qrPixels(qr, size);
  const result = jsQR(pixels, size, size, { inversionAttempts: 'dontInvert' });
  assert(result, '生成的二维码应能被独立解码器识别');
  return result;
}

test('文字、中文、emoji、换行、空格和链接可编码并完整解码', () => {
  for (const text of ['https://www.zf-yun.cn/?a=1&b=%E4%BD%A0#hello', '所有事，不都是先开始吗？🌱\n第二行：hello + 123', '  保留两边空格  ', '123456789012345678901234567890', '<script>alert("你好")</script>']) {
    const qr = createQr(text);
    const result = decode(qr);
    assert.equal(result.data, text);
    assert.deepEqual(result.binaryData, [...new TextEncoder().encode(text)]);
  }
});

test('四种纠错和三种图片尺寸都可解码，边缘保留白色', () => {
  for (const level of ['L', 'M', 'Q', 'H']) {
    const qr = createQr('未完 · 本地生成 https://www.zf-yun.cn/', level);
    for (const size of [512, 1024, 2048]) {
      assert.equal(decode(qr, size).data, '未完 · 本地生成 https://www.zf-yun.cn/');
      const pixels = qrPixels(qr, size);
      const offset = Math.floor((size - qr.size * Math.floor(size / (qr.size + 8))) / 2);
      assert(pixels.subarray(0, offset * size * 4).every(value => value === 255));
      assert.equal(pixels.length, size * size * 4);
    }
  }
});

test('空内容、字节上限和高纠错容量错误给出可操作提示', () => {
  assert.throws(() => createQr(' \n '), /先输入/);
  assert.throws(() => createQr('中'.repeat(667)), /2,000 字节/);
  assert.throws(() => createQr('a'.repeat(2001)), /2,000 字节/);
  assert.throws(() => createQr('hello', 'X'), /纠错级别/);
  assert.throws(() => createQr('a'.repeat(2000), 'H'), /缩短内容或选择更低/);
  const text = 'a'.repeat(2000);
  assert.equal(decode(createQr(text, 'M'), 1024).data, text);
});

test('SVG 与像素输出使用同一模块，包含留白并且不拼入输入内容', () => {
  const qr = createQr('<img src=x onerror=alert(1)>');
  const svg = qrSvg(qr, 1024);
  assert.match(svg, /width="1024" height="1024"/);
  assert(svg.includes(`viewBox="0 0 ${qr.size + 8} ${qr.size + 8}"`));
  assert.match(svg, /fill="#fff"/);
  assert(!svg.includes('<img') && !svg.includes('onerror') && !svg.includes('<script'));
  const cells = [...svg.matchAll(/M(\d+),(\d+)h1v1h-1z/g)].map(match => [Number(match[1]) - 4, Number(match[2]) - 4]);
  assert.equal(cells.length, qr.modules.flat().filter(Boolean).length);
  assert(cells.every(([x, y]) => qr.modules[y][x]));
  assert.throws(() => qrSvg(qr, 10), /像素/);
  assert.throws(() => qrPixels(qr, 10), /像素/);
});
