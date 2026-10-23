import { readFile, writeFile, mkdir, copyFile, lstat, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateNote } from '../note-format.js';
import { notes } from '../content.mjs';

export async function importNote(inputPath, { root = fileURLToPath(new URL('../', import.meta.url)), replace = false, checkOnly = false } = {}) {
  const raw = await readFile(path.resolve(inputPath), 'utf8');
  if (Buffer.byteLength(raw, 'utf8') > 128000) throw new Error('文章包不能超过 128 KB');
  let input;
  try { input = JSON.parse(raw.replace(/^\uFEFF/, '')); } catch { throw new Error('文章包不是有效的 UTF-8 JSON 文件'); }
  const note = validateNote(input);
  if (notes.some(existing => existing.slug === note.slug)) throw new Error('与内置文章的地址重复，请修改文章地址，或在 content.mjs 中编辑原文');
  const directory = path.resolve(root, 'content', 'notes');
  const filename = path.resolve(directory, `${note.slug}.json`);
  if (path.dirname(filename) !== directory) throw new Error('文章地址超出内容目录');
  await mkdir(directory, { recursive: true });
  if (await realpath(directory) !== directory) throw new Error('内容目录不能重定向到其他目录');
  let existing;
  try { existing = await lstat(filename); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (existing?.isSymbolicLink()) throw new Error('文章目标不能是符号链接');
  if (existing && !replace) throw new Error('该文章已经存在；如需更新，请显式添加 --replace，旧版本会备份');
  if (checkOnly) return { filename, note, checked: true };
  if (existing) {
    const backup = path.resolve(root, 'output', 'note-backups');
    await mkdir(backup, { recursive: true });
    await copyFile(filename, path.join(backup, `${note.slug}-${Date.now()}.json`));
  }
  await writeFile(filename, JSON.stringify(note, null, 2) + '\n', { encoding: 'utf8', flag: replace ? 'w' : 'wx' });
  return { filename, note };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const input = args.find(arg => !arg.startsWith('--'));
  if (!input || args.some(arg => arg.startsWith('--') && !['--replace', '--check'].includes(arg))) {
    console.error('用法：npm run note:import -- <文章.json> [--replace] [--check]');
    process.exitCode = 1;
  } else {
    try {
      const result = await importNote(input, { replace: args.includes('--replace'), checkOnly: args.includes('--check') });
      console.log(result.checked ? `校验通过：${result.note.title}` : `已导入：${result.filename}\n请运行 npm run check 检查预览，确认后再运行 npm run deploy 发布。`);
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
