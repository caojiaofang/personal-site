import { spawnSync } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceFiles = ['app.js', 'theme.js', 'article.js', 'lab.js', 'lab-state.js', 'writing.js', 'writing-state.js', 'markdown.js', 'note-format.js', 'qr.js', 'qr-code.js', 'vendor/qrcodegen.js', 'content.mjs', 'scripts/build.mjs', 'scripts/tool-pages.mjs', 'scripts/writing-page.mjs', 'scripts/qr-page.mjs', 'scripts/import-note.mjs', 'scripts/serve.mjs', 'deploy/deploy.mjs', 'deploy/install-certificate.mjs'];
for (const file of sourceFiles) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${file} 语法检查失败：${result.stderr}`);
}
const stateTests = spawnSync(process.execPath, ['--test', path.join(root, 'tests/lab-state.test.mjs'), path.join(root, 'tests/writing.test.mjs'), path.join(root, 'tests/qr.test.mjs')], { encoding: 'utf8' });
assert.equal(stateTests.status, 0, `工具状态测试失败：${stateTests.stdout}\n${stateTests.stderr}`);
console.log('工具、写作与二维码解码测试通过。');
await import('./build.mjs');
const output = path.join(root, 'dist');
async function collect(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await collect(file));
    else result.push(file);
  }
  return result;
}
const files = await collect(output);
let links = 0;
for (const file of files.filter(file => file.endsWith('.html'))) {
  const html = await readFile(file, 'utf8');
  assert.match(html, /<html lang="zh-CN">/, `缺少中文语言声明：${file}`);
  assert.match(html, /<h1(?:\s|>)/, `缺少页面主标题：${file}`);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, `页面存在重复 ID：${file}`);
  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const value = match[1].replaceAll('&amp;', '&');
    const pagePath = '/' + path.relative(output, file).split(path.sep).join('/').replace(/index\.html$/, '');
    const url = new URL(value, 'https://www.zf-yun.cn' + pagePath);
    if (url.origin !== 'https://www.zf-yun.cn') continue;
    let target = path.join(output, decodeURIComponent(url.pathname));
    if (url.pathname.endsWith('/')) target = path.join(target, 'index.html');
    const info = await stat(target).catch(() => null);
    assert(info?.isFile(), `断开的链接：${file} → ${value}`);
    if (url.hash && target.endsWith('.html')) {
      const targetHtml = target === file ? html : await readFile(target, 'utf8');
      assert(targetHtml.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`), `无效锚点：${value}`);
    }
    links++;
  }
}
assert(files.some(file => file.endsWith('feed.xml')), '缺少 RSS');
assert(files.some(file => file.endsWith('sitemap.xml')), '缺少站点地图');
assert(files.every(file => !file.endsWith('.pem') && !file.endsWith('.key')), '构建产物不得包含证书或私钥');
console.log(`检查通过：${files.filter(file => file.endsWith('.html')).length} 个 HTML 页面，${links} 个站内链接与资源引用。`);
