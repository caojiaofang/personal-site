import { qrcodegen } from './vendor/qrcodegen.js';

export const maxQrBytes = 2000;
export const qrSizes = [512, 1024, 2048];
const levels = { L: qrcodegen.QrCode.Ecc.LOW, M: qrcodegen.QrCode.Ecc.MEDIUM, Q: qrcodegen.QrCode.Ecc.QUARTILE, H: qrcodegen.QrCode.Ecc.HIGH };

export function createQr(text, level = 'M') {
  if (typeof text !== 'string' || !text.trim()) throw new Error('先输入文字或链接，就能生成二维码。');
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > maxQrBytes) throw new Error(`内容超出 ${maxQrBytes.toLocaleString('en-US')} 字节，请缩短后再生成。`);
  if (!Object.hasOwn(levels, level)) throw new Error('请选择有效的纠错级别。');
  try {
    // UTF-8 ECI 明确中文和 emoji 的编码，内容中的空格与换行按原样保留。
    const segments = [qrcodegen.QrSegment.makeEci(26), ...qrcodegen.QrSegment.makeSegments(text)];
    const code = qrcodegen.QrCode.encodeSegments(segments, levels[level], 1, 40, -1, false);
    return { size: code.size, version: code.version, bytes, level, modules: Array.from({ length: code.size }, (_, y) => Array.from({ length: code.size }, (_, x) => code.getModule(x, y))) };
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    throw new Error('当前纠错级别放不下这些内容，请缩短内容或选择更低的纠错级别。');
  }
}

function checkSize(size) {
  if (!qrSizes.includes(size)) throw new Error('请选择 512、1024 或 2048 像素。');
}

export function qrSvg(qr, size = 1024) {
  checkSize(size);
  const extent = qr.size + 8;
  const path = [];
  for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) if (qr.modules[y][x]) path.push(`M${x + 4},${y + 4}h1v1h-1z`);
  // 输出只包含库生成的数字，输入文字不拼入 SVG；四周始终保留 4 个模块的空白。
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${extent} ${extent}" shape-rendering="crispEdges"><rect width="${extent}" height="${extent}" fill="#fff"/><path d="${path.join('')}" fill="#000"/></svg>`;
}

export function qrPixels(qr, size = 1024) {
  checkSize(size);
  const scale = Math.floor(size / (qr.size + 8));
  const offset = Math.floor((size - qr.size * scale) / 2);
  const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
  // 使用整数像素绘制，避免 Canvas 缩放插值让边缘变灰。
  for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) if (qr.modules[y][x]) {
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const index = ((offset + y * scale + dy) * size + offset + x * scale + dx) * 4;
      pixels[index] = pixels[index + 1] = pixels[index + 2] = 0;
    }
  }
  return pixels;
}
