const validSlug = value => typeof value === 'string' && value.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const validText = (value, max, empty = false) => typeof value === 'string' && value.length <= max && (empty || Boolean(value.trim()));
export function validateNote(input) {
  if (input && typeof input === 'object' && ('format' in input || 'version' in input) && (input.format !== 'unfinished-note' || input.version !== 1)) throw new Error('文章包格式或版本不受支持，请从写作台重新导出');
  const note = input?.format === 'unfinished-note' && input.version === 1 ? input.note : input;
  if (!note || !validText(note.title, 120)) throw new Error('文章标题需要为 1 至 120 个字符');
  if (!validSlug(note.slug)) throw new Error('文章地址只支持小写英文、数字和连字符，最多 80 个字符');
  const date = new Date(`${note.date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(note.date || '') || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== note.date) throw new Error('请填写有效的文章日期');
  if (!validText(note.category, 30)) throw new Error('文章分类需要为 1 至 30 个字符');
  if (!validText(note.description, 240)) throw new Error('文章摘要需要为 1 至 240 个字符');
  if (!Array.isArray(note.body) || !note.body.length || note.body.length > 200) throw new Error('文章需要包含正文，最多支持 200 个内容块');
  const ids = new Set();
  const body = note.body.map(block => {
    if (!block || !['paragraph', 'heading', 'quote', 'list', 'code', 'rule'].includes(block.type)) throw new Error('文章包含不支持的内容块');
    if (block.type === 'rule') return { type: 'rule' };
    if (block.type === 'list') {
      if (!Array.isArray(block.items) || !block.items.length || block.items.length > 100 || !block.items.every(item => validText(item, 2000))) throw new Error('列表内容格式无效');
      return { type: 'list', ordered: Boolean(block.ordered), items: [...block.items] };
    }
    if (!validText(block.text, 20000, block.type === 'code')) throw new Error('正文内容为空或超出长度限制');
    if (block.type === 'heading') {
      if (!validSlug(block.id) || ids.has(block.id)) throw new Error('文章目录标识无效或重复');
      ids.add(block.id);
      return { type: 'heading', id: block.id, level: block.level === 3 ? 3 : 2, text: block.text };
    }
    if (block.type === 'code') {
      if (block.language && !/^[a-z0-9+-]{1,30}$/i.test(block.language)) throw new Error('代码语言标记格式无效');
      return { type: 'code', language: block.language || '', text: block.text };
    }
    return { type: block.type, text: block.text };
  });
  return { slug: note.slug, title: note.title.trim(), date: note.date, category: note.category.trim(), description: note.description.trim(), body };
}
