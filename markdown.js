// 支持常用写作语法，不执行原始 HTML，也不自动加载远程图片。
export const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function safeLink(value) {
  if (/[\s\\\u0000-\u001f]/.test(value)) return false;
  if (/^#[a-z0-9_-]+$/i.test(value)) return true;
  try { return ['https:', 'http:', 'mailto:'].includes(new URL(value).protocol); } catch { return false; }
}

export function inlineHtml(text, depth = 0) {
  text = String(text);
  if (depth > 3) return escapeHtml(text);
  const pattern = /`([^`\n]+)`|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|(!?)\[([^\]\n]+)\]\(([^)\s]+)\)/g;
  let result = '';
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    result += escapeHtml(text.slice(cursor, match.index));
    if (match[1] !== undefined) result += `<code>${escapeHtml(match[1])}</code>`;
    else if (match[2] !== undefined) result += `<strong>${inlineHtml(match[2], depth + 1)}</strong>`;
    else if (match[3] !== undefined) result += `<em>${inlineHtml(match[3], depth + 1)}</em>`;
    else if (match[4] === '!') result += escapeHtml(`[图片：${match[5]}]`);
    else if (safeLink(match[6])) result += `<a href="${escapeHtml(match[6])}"${match[6].startsWith('#') ? '' : ' target="_blank" rel="noopener noreferrer"'}>${inlineHtml(match[5], depth + 1)}</a>`;
    else result += escapeHtml(match[0]);
    cursor = match.index + match[0].length;
  }
  return result + escapeHtml(text.slice(cursor));
}

export function parseMarkdown(source) {
  const lines = String(source).replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let index = 0;
  let heading = 0;
  const startsBlock = line => /^\s*(?:#{1,3}\s|```|>\s?|[-*+]\s|\d+\.\s|---\s*$)/.test(line);
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index++; continue; }
    const fence = line.match(/^\s*```([a-z0-9+-]*)\s*$/i);
    if (fence) {
      const code = [];
      index++;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) code.push(lines[index++]);
      if (index < lines.length) index++;
      blocks.push({ type: 'code', language: fence[1].slice(0, 30), text: code.join('\n') });
      continue;
    }
    const title = line.match(/^\s*(#{1,3})\s+(.+?)\s*#*$/);
    if (title) { blocks.push({ type: 'heading', id: `section-${++heading}`, level: title[1].length === 1 ? 2 : 3, text: title[2] }); index++; continue; }
    if (/^\s*---\s*$/.test(line)) { blocks.push({ type: 'rule' }); index++; continue; }
    if (/^\s*>/.test(line)) {
      const quote = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) quote.push(lines[index++].replace(/^\s*>\s?/, ''));
      blocks.push({ type: 'quote', text: quote.join('\n') });
      continue;
    }
    const list = line.match(/^\s*(?:([-*+])|(\d+)\.)\s+(.+)$/);
    if (list) {
      const ordered = Boolean(list[2]);
      const items = [];
      const pattern = ordered ? /^\s*\d+\.\s+(.+)$/ : /^\s*[-*+]\s+(.+)$/;
      while (index < lines.length) {
        const item = lines[index].match(pattern);
        if (!item) break;
        items.push(item[1]); index++;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }
    const paragraph = [line];
    index++;
    while (index < lines.length && lines[index].trim() && !startsBlock(lines[index])) paragraph.push(lines[index++]);
    blocks.push({ type: 'paragraph', text: paragraph.join('\n') });
  }
  return blocks;
}

export function renderBlocks(blocks) {
  return blocks.map(block => {
    if (block.type === 'heading') { const tag = block.level === 3 ? 'h3' : 'h2'; return `<${tag} id="${escapeHtml(block.id)}">${inlineHtml(block.text)}</${tag}>`; }
    if (block.type === 'quote') return `<blockquote><p>${inlineHtml(block.text)}</p></blockquote>`;
    if (block.type === 'list') { const tag = block.ordered ? 'ol' : 'ul'; return `<${tag}>${block.items.map(item => `<li>${inlineHtml(item)}</li>`).join('')}</${tag}>`; }
    if (block.type === 'code') return `<pre><code${block.language ? ` class="language-${escapeHtml(block.language)}"` : ''}>${escapeHtml(block.text)}</code></pre>`;
    if (block.type === 'rule') return '<hr>';
    return `<p>${inlineHtml(block.text)}</p>`;
  }).join('\n');
}
