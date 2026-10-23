import { spawnSync } from 'node:child_process';
import { createPrivateKey, createPublicKey, X509Certificate } from 'node:crypto';

// 证书只通过不回显的标准输入接收，随后通过 SSH 的标准输入写入服务器。
// 不将私钥写入本地文件、命令行参数或日志。
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');
console.log('Ready for certificate JSON on stdin (input is hidden).');
let raw = '';
const line = await new Promise((resolve, reject) => {
  process.stdin.on('data', chunk => {
    if (chunk.includes('\u0003')) { reject(new Error('已取消')); return; }
    raw += chunk;
    if (raw.length > 64000) { reject(new Error('输入过长')); return; }
    const lineEnd = raw.search(/[\r\n]/);
    if (lineEnd >= 0) resolve(raw.slice(0, lineEnd));
  });
  process.stdin.on('end', () => resolve(raw));
});
if (process.stdin.isTTY) process.stdin.setRawMode(false);
process.stdin.pause();

try {
  let payload;
  try { payload = JSON.parse(line); } catch { throw new Error('证书输入不是有效 JSON'); }
  const normalize = value => String(value).replaceAll('\\', '').trim() + '\n';
  const certificate = normalize(payload.certificate);
  const privateKey = normalize(payload.privateKey);
  const blocks = certificate.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
  if (!blocks || blocks.length < 2) throw new Error('需要完整证书链');
  const chain = blocks.map(block => new X509Certificate(block));
  if (!chain[0].checkHost('www.zf-yun.cn')) throw new Error('证书域名不匹配');
  if (Date.now() < Date.parse(chain[0].validFrom) || Date.now() >= Date.parse(chain[0].validTo)) throw new Error('证书不在有效期内');
  const key = createPrivateKey(privateKey);
  const keyPublic = createPublicKey(key).export({ type: 'spki', format: 'der' });
  if (!keyPublic.equals(chain[0].publicKey.export({ type: 'spki', format: 'der' }))) throw new Error('私钥与证书不匹配');
  for (let index = 0; index < chain.length - 1; index++) {
    if (!chain[index].verify(chain[index + 1].publicKey)) throw new Error('证书链签名校验失败');
  }
  console.log(`已验证域名、私钥匹配及 ${chain.length} 张证书的链路；有效期至 ${chain[0].validTo}`);
  const remotePython = `import json, os, sys, subprocess
payload = json.load(sys.stdin)
directory = '/opt/nginx/cert/www.zf-yun.cn'
if os.path.lexists(directory):
    raise SystemExit('证书目录已存在，停止初次安装以避免覆盖')
os.mkdir(directory, 0o700)
for name, content, mode in [('fullchain.pem', payload['certificate'], 0o644), ('privkey.pem', payload['privateKey'], 0o600)]:
    filename = os.path.join(directory, name)
    descriptor = os.open(filename, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
    with os.fdopen(descriptor, 'w') as target:
        target.write(content)
subprocess.check_call(['openssl', 'x509', '-in', directory + '/fullchain.pem', '-noout', '-subject', '-dates'])
print('服务器证书安装完成，私钥权限 600')
`;
  const encoded = Buffer.from(remotePython).toString('base64');
  const command = `python3 -c "import base64; exec(base64.b64decode('${encoded}'))"`;
  const result = spawnSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'z11', command], {
    input: JSON.stringify({ certificate, privateKey }),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false,
    timeout: 30000
  });
  if (result.error || result.status !== 0) throw new Error('服务器证书写入失败，请检查 SSH 和目标目录权限');
  process.stdout.write(result.stdout);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
