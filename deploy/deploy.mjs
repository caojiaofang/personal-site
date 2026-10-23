import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

const deployRoot = fileURLToPath(new URL('./', import.meta.url));
const projectRoot = path.dirname(deployRoot.slice(0, -1));
const server = process.argv[2] || 'z11';
if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(server)) throw new Error('SSH 别名格式无效');
const release = new Date().toISOString().replace(/[-:.]/g, '') + '-' + randomUUID().slice(0, 8);
const remoteDirectory = `/tmp/personal-site-${release}`;

// 使用参数数组启动系统 SSH，避免将本地路径或参数拼接成 shell 命令。
function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} 执行失败，退出码：${result.status}`);
}

run(process.execPath, [path.join(projectRoot, 'scripts/check.mjs')]);
const packageDirectory = path.join(projectRoot, '.deploy');
mkdirSync(packageDirectory, { recursive: true });
const archive = path.join(packageDirectory, `site-${release}.tar.gz`);
run('tar', ['-czf', archive, '-C', path.join(projectRoot, 'dist'), '.']);
run('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', server, `mkdir -m 700 '${remoteDirectory}'`]);
const files = [archive, path.join(deployRoot, 'personal-site.conf'), path.join(deployRoot, 'publish.sh')];
run('scp', ['-o', 'BatchMode=yes', ...files, `${server}:${remoteDirectory}/`]);
run('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', server, `bash '${remoteDirectory}/publish.sh' '${remoteDirectory}' 'site-${release}.tar.gz'`]);
