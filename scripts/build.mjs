import { readFile, writeFile, mkdir, rm, lstat, realpath, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { site, projects, notes as baseNotes } from '../content.mjs';
import { toolPages } from './tool-pages.mjs';
import { renderBlocks } from '../markdown.js';
import { validateNote } from '../note-format.js';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const output = path.resolve(root, 'dist');
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const safeSlug = value => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const readingTime = blocks => Math.max(1, Math.ceil(blocks.map(block => block.text || block.items?.join('') || '').join('').length / 350));
const dateLabel = date => date.replaceAll('-', '.');
const version = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version;
const asset = name => `/${name}?v=${version}`;
const pageFiles = new Map();
const notesDirectory = path.join(root, 'content', 'notes');
let noteFiles = [];
try { noteFiles = (await readdir(notesDirectory)).filter(name => name.endsWith('.json')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const importedNotes = [];
for (const name of noteFiles) {
  const filename = path.join(notesDirectory, name);
  const info = await lstat(filename);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 128000) throw new Error('导入文章必须是 128 KB 以内的普通 JSON 文件');
  const note = validateNote(JSON.parse((await readFile(filename, 'utf8')).replace(/^\uFEFF/, '')));
  if (name !== `${note.slug}.json`) throw new Error('文章文件名与文章地址不一致');
  importedNotes.push(note);
}
const notes = [...baseNotes, ...importedNotes].map(validateNote).sort((a, b) => b.date.localeCompare(a.date));

function validate() {
  if (new URL(site.url).protocol !== 'https:') throw new Error('正式站点地址必须使用 HTTPS');
  for (const collection of [notes, projects]) {
    const unique = new Set();
    for (const item of collection) {
      const id = item.slug || item.id;
      if (!safeSlug(id) || unique.has(id)) throw new Error('内容标识重复或包含不允许的字符');
      unique.add(id);
      if (item.body) {
        const headings = new Set();
        for (const block of item.body) {
          if (!['heading', 'paragraph', 'quote', 'list', 'code', 'rule'].includes(block.type)) throw new Error('不支持的正文块类型');
          if (block.type === 'heading') {
            if (!safeSlug(block.id) || headings.has(block.id)) throw new Error('文章标题锚点重复或无效');
            headings.add(block.id);
          }
          if (block.type === 'list' && !Array.isArray(block.items)) throw new Error('列表内容必须是数组');
        }
      }
      const date = item.date || item.updated;
      if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)))) throw new Error('内容日期无效');
      if (item.url && new URL(item.url).protocol !== 'https:') throw new Error('外部作品地址必须使用 HTTPS');
      if (item.slug && !Array.isArray(item.body)) throw new Error('独立页面必须提供正文');
      if (item.tool && !['palette', 'focus', 'writing', 'qr'].includes(item.tool)) throw new Error('不支持的实验室工具');
    }
  }
}

function bodyHtml(blocks) {
  return renderBlocks(blocks);
}

const themeButton = `<button class="theme-toggle" data-theme-toggle type="button" aria-label="切换主题，当前跟随系统"><span data-theme-icon aria-hidden="true">◐</span><span data-theme-name>跟随系统</span></button>`;
function header() {
  return `<header class="site-header"><a class="brand" href="/" aria-label="${escape(site.name)}，返回首页"><span class="brand-mark" aria-hidden="true">w.</span><span>${escape(site.name)}<span class="brand-sub">一个正在生长的个人空间</span></span></a><nav aria-label="主导航"><a href="/#projects">作品与实验</a><a href="/#notes">随手记</a><a href="/#about">关于这里</a></nav><div class="header-actions">${themeButton}</div></header>`;
}
function footer() {
  return `<footer class="site-footer"><a class="footer-brand" href="/">${escape(site.name)} <span>一个持续生长的个人空间</span></a><div class="footer-links"><a href="/feed.xml">订阅 RSS</a><span>© 2026 ${escape(site.name)}</span></div><a class="back-top" href="#">回到顶部 ↑</a></footer>`;
}
function head({ title, description, url, type = 'website' }) {
  return `<meta name="description" content="${escape(description)}"><link rel="canonical" href="${escape(url)}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(url)}"><meta property="og:type" content="${type}"><meta property="og:locale" content="zh_CN"><meta property="og:site_name" content="${escape(site.name)}"><link rel="alternate" type="application/rss+xml" title="${escape(site.name)} · 随手记" href="/feed.xml">`;
}

function projectCards(original) {
  return projects.map(project => {
    const cover = project.cover || (['site', 'palette', 'focus', 'writing', 'qr'].includes(project.id) ? project.id : 'site');
    if (!['site', 'palette', 'focus', 'writing', 'qr'].includes(cover)) throw new Error('不支持的作品封面');
    const visualMatch = original.match(new RegExp(`<button class="project-card [^"]+" data-open="${cover}"[\\s\\S]*?(<div class="project-visual[\\s\\S]*?)\\n            <div class="project-info">`));
    const visual = cover === 'qr' ? '<div class="project-visual qr-visual"><div class="qr-cover"><div class="qr-cover-code"><i></i><i></i><i></i><b>↗</b></div><span>扫一扫，把内容带走。</span></div><span class="qr-cover-note">一段内容<br>一个入口</span></div>' : cover === 'writing' ? '<div class="project-visual writing-visual"><div class="writing-cover"><span>一点想法</span><strong>Aa<span>✎</span></strong><i></i><i></i><i></i><small>从一句话开始。</small></div></div>' : visualMatch?.[1];
    if (!visual) throw new Error(`缺少作品封面：${project.id}`);
    const isLink = Boolean(project.slug || project.url || project.tool);
    if (!isLink && !['palette', 'focus'].includes(project.id)) throw new Error('作品需要独立页面或外部地址');
    const open = isLink
      ? `<a class="project-card ${cover}-project" href="${escape(project.tool ? `/tools/${project.tool}/` : project.slug ? `/projects/${project.slug}/` : project.url)}" data-project-category="${escape(project.category)}" aria-label="${project.tool ? ({ focus: '打开专注时钟', palette: '打开配色工作台', writing: '打开写作台', qr: '打开二维码生成器' }[project.tool]) : `了解作品：${escape(project.title)}`}">`
      : `<button class="project-card ${cover}-project" data-open="${project.id}" data-project-category="${escape(project.category)}" aria-label="${project.id === 'focus' ? '打开专注时钟' : '打开配色工作台'}">`;
    return `${open}${visual}<div class="project-info"><div class="project-meta"><span>${escape(project.category)}</span><span class="${project.slug ? 'live-label' : ''}">${escape(project.status)}</span></div><h3>${escape(project.title)} <span aria-hidden="true">↗</span></h3><p>${escape(project.description)}</p><div class="project-bottom"><span>${project.tags.map(escape).join(' / ')}</span><span>${escape(project.action)}</span></div></div>${isLink ? '</a>' : '</button>'}`;
  }).join('\n');
}

function noteRows() {
  return [...notes].sort((a, b) => b.date.localeCompare(a.date)).map(note => `<a class="note-row" href="/notes/${note.slug}/" data-note-search="${escape([note.title, note.description, note.category].join(' '))}"><div class="note-date"><time datetime="${note.date}">${note.date.slice(5).replace('-', ' / ')}</time><small>${note.date.slice(0, 4)}</small></div><div class="note-summary"><span class="note-category">${escape(note.category)}</span><h3>${escape(note.title)}</h3><p>${escape(note.description)}</p><span class="note-reading-time">约 ${readingTime(note.body)} 分钟</span></div><span class="read-note">读一读 <span aria-hidden="true">↗</span></span></a>`).join('\n');
}

function articlePage(item, type) {
  const isNote = type === 'notes';
  const route = `/${type}/${item.slug}/`;
  const title = `${item.title} · ${site.name}`;
  const date = item.date || item.updated;
  const headings = item.body.filter(block => block.type === 'heading');
  const orderedNotes = [...notes].sort((a, b) => b.date.localeCompare(a.date));
  const index = orderedNotes.findIndex(note => note.slug === item.slug);
  const related = isNote ? [orderedNotes[index - 1], orderedNotes[index + 1]].filter(Boolean) : [];
  const structured = JSON.stringify({ '@context': 'https://schema.org', '@type': isNote ? 'BlogPosting' : 'WebPage', headline: item.title, description: item.description, datePublished: date, dateModified: date, inLanguage: 'zh-CN', url: site.url + route }).replaceAll('<', '\\u003c');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f5f7fc"><title>${escape(title)}</title>${head({ title, description: item.description, url: site.url + route, type: isNote ? 'article' : 'website' })}<link rel="icon" href="/favicon.svg" type="image/svg+xml"><script src="${asset('theme.js')}"></script><link rel="stylesheet" href="${asset('style.css')}"><link rel="stylesheet" href="${asset('next.css')}"><script src="${asset('article.js')}" defer></script><script type="application/ld+json">${structured}</script></head><body class="reading-page"><div class="reading-progress-track" aria-hidden="true"><span id="reading-progress"></span></div><a class="skip-link" href="#main">跳到正文</a><div class="site-shell">${header()}<main id="main"><div class="article-breadcrumb"><a href="/">首页</a><span aria-hidden="true">/</span><a href="/#${isNote ? 'notes' : 'projects'}">${isNote ? '随手记' : '作品与实验'}</a></div><article><header class="article-header"><p class="article-category">${escape(item.category)}</p><h1>${escape(item.title)}</h1><p class="article-description">${escape(item.description)}</p><div class="article-meta"><time datetime="${date}">${dateLabel(date)}</time><span>约 ${readingTime(item.body)} 分钟</span><span>${isNote ? '随手记' : '项目介绍'}</span></div></header><div class="article-layout"><div class="article-main"><div class="article-body">${bodyHtml(item.body)}</div><div class="article-share"><span>如果这篇记录刚好对你有用</span><button class="share-button" type="button" data-copy-link>复制${isNote ? '文章' : '项目'}链接 <span aria-hidden="true">↗</span></button><p id="share-feedback" role="status" aria-live="polite"></p></div>${related.length ? `<nav class="related-notes" aria-label="继续阅读"><p>接着读一篇</p>${related.map(note => `<a href="/notes/${note.slug}/"><span>${escape(note.title)}</span><span aria-hidden="true">↗</span></a>`).join('')}</nav>` : '<a class="article-home" href="/#projects">返回作品与实验</a>'}</div><aside class="article-toc" aria-label="本文目录"><p>这一篇里</p><nav>${headings.map(heading => `<a href="#${heading.id}">${escape(heading.text)}</a>`).join('')}</nav><a class="toc-back" href="/#notes">看看其他随手记</a></aside></div></article></main>${footer()}</div></body></html>`;
}

validate();
const source = await readFile(path.join(root, 'index.html'), 'utf8');
let home = source
  .replace('<span class="count">3</span>', `<span class="count">${projects.length}</span>`)
  .replace('<title>未完 · 先开始，再慢慢来</title>', `<title>${escape(site.name)} · 先开始，再慢慢来</title>`)
  .replace('<script src="./app.js" defer></script>', `<script src="${asset('app.js')}" defer></script>`)
  .replace('<link rel="stylesheet" href="./style.css">', `<script src="${asset('theme.js')}"></script><link rel="stylesheet" href="${asset('style.css')}"><link rel="stylesheet" href="${asset('next.css')}">`)
  .replace('<meta name="description" content="未完，一个持续生长的个人空间。放一些做出来的东西，记一些探索途中的想法。">', head({ title: `未完 · 先开始，再慢慢来`, description: site.description, url: site.url + '/' }))
  .replace(/    <header class="site-header">[\s\S]*?<\/header>/, header())
  .replace(/    <footer class="site-footer">[\s\S]*?<\/footer>/, footer())
  .replace(/<div class="project-grid">[\s\S]*?\n        <\/div>\n      <\/section>/, `<div class="project-filters" role="group" aria-label="筛选作品"><button type="button" data-project-filter="all" aria-pressed="true">全部作品 <span>${projects.length}</span></button>${[...new Set(projects.map(project => project.category))].map(category => `<button type="button" data-project-filter="${escape(category)}" aria-pressed="false">${escape(category)}</button>`).join('')}<span class="filter-feedback" id="project-feedback" role="status" aria-live="polite"></span></div><div class="project-grid">${projectCards(source)}</div>\n      </section>`)
  .replace(/<button class="note-row"[\s\S]*?<\/button>/, `<div class="notes-toolbar"><label class="note-search"><span aria-hidden="true">⌕</span><input id="note-search" type="search" aria-label="搜索随手记" placeholder="找一篇记录…" autocomplete="off"></label><a class="rss-link" href="/feed.xml">订阅 RSS <span aria-hidden="true">↗</span></a></div><div class="note-list">${noteRows()}</div><div class="notes-empty" hidden><p>暂时没有找到这篇记录。</p><button type="button" id="clear-note-search">清空搜索，看看全部</button></div><p class="search-feedback" id="search-feedback" role="status" aria-live="polite"></p>`);
home = home.replace(/\n  <dialog id="project-dialog"[\s\S]*?<\/dialog>/, '').replace(/\n  <div class="toast" id="toast"[^>]*><\/div>/, '');
pageFiles.set('index.html', home);
for (const note of notes) pageFiles.set(`notes/${note.slug}/index.html`, articlePage(note, 'notes'));
for (const project of projects.filter(project => project.slug)) pageFiles.set(`projects/${project.slug}/index.html`, articlePage(project, 'projects'));
for (const [filename, html] of toolPages({ site, header, footer, head, asset, escape })) pageFiles.set(filename, html);

const pageRoutes = ['/', ...notes.map(note => `/notes/${note.slug}/`), ...projects.filter(project => project.slug).map(project => `/projects/${project.slug}/`), '/tools/palette/', '/tools/focus/', '/tools/writing/', '/tools/qr/'];
pageFiles.set('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pageRoutes.map(route => `<url><loc>${site.url}${route}</loc></url>`).join('')}</urlset>`);
pageFiles.set('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`);
pageFiles.set('feed.xml', `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escape(site.name)} · 随手记</title><link>${site.url}/#notes</link><description>${escape(site.description)}</description><language>zh-cn</language><atom:link href="${site.url}/feed.xml" rel="self" type="application/rss+xml"/>${notes.map(note => `<item><title>${escape(note.title)}</title><link>${site.url}/notes/${note.slug}/</link><guid isPermaLink="true">${site.url}/notes/${note.slug}/</guid><description>${escape(note.description)}</description><pubDate>${new Date(note.date + 'T00:00:00+08:00').toUTCString()}</pubDate></item>`).join('')}</channel></rss>`);
pageFiles.set('404.html', `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>这一页还没长出来 · 未完</title><script src="${asset('theme.js')}"></script><link rel="stylesheet" href="${asset('style.css')}"><link rel="stylesheet" href="${asset('next.css')}"></head><body><main class="not-found"><span class="not-found-mark" aria-hidden="true">w.</span><p>404 / 走到了一小块空白</p><h1>这一页，<br>还没长出来。</h1><p>地址可能写错了，或者这篇记录已经搬家。</p><a class="primary-button" href="/">回到首页 <span aria-hidden="true">↗</span></a></main></body></html>`);
for (const [filename, html] of pageFiles) {
  if (filename.endsWith('.html')) pageFiles.set(filename, html.replace('</head>', `<link rel="stylesheet" href="${asset('lab.css')}"></head>`).replace('</body>', `<script type="module" src="${asset('lab.js')}"></script></body>`));
}
for (const name of ['style.css', 'next.css', 'lab.css', 'writing.css', 'qr.css', 'app.js', 'theme.js', 'article.js', 'lab.js', 'lab-state.js', 'writing.js', 'writing-state.js', 'markdown.js', 'note-format.js', 'qr.js', 'qr-code.js', 'vendor/qrcodegen.js', 'favicon.svg']) pageFiles.set(name, await readFile(path.join(root, name), 'utf8'));

// 微信恢复访问申请的域名验证文件，随发布保留在站点根目录。
const verificationFile = 'f28bbce1a74e761225dfa2c15690a66b.txt';
pageFiles.set(verificationFile, await readFile(path.join(root, verificationFile), 'utf8'));

// 仅清理经过绝对路径校验、且不是符号链接的构建产物目录。
if (path.dirname(output) !== path.resolve(root) || path.basename(output) !== 'dist') throw new Error('构建目录超出项目范围');
let existing;
try { existing = await lstat(output); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (existing) {
  if (existing.isSymbolicLink() || await realpath(output) !== output) throw new Error('构建目录不可是链接或重定向目录');
  await rm(output, { recursive: true });
}
await mkdir(output, { recursive: true });
for (const [name, text] of pageFiles) {
  const destination = path.join(output, name);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, text, 'utf8');
}
const manifest = [...pageFiles].map(([name, text]) => `${createHash('sha256').update(text).digest('hex')}  ${name}`).join('\n') + '\n';
await writeFile(path.join(output, 'files.sha256'), manifest, 'utf8');
console.log(`已生成 ${pageRoutes.length} 个页面、RSS、站点地图及静态资源：${output}`);
