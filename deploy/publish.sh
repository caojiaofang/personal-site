#!/usr/bin/env bash
# 只发布经过路径、文件类型和完整性检查的构建产物。
set -euo pipefail
upload=${1:?请提供上传目录}
archive=${2:?请提供发布包文件名}
[[ "$upload" =~ ^/tmp/personal-site-[A-Za-z0-9TZ.-]+$ ]] || { echo '上传目录不在允许范围内' >&2; exit 1; }
[[ "$archive" =~ ^site-[A-Za-z0-9TZ.-]+\.tar\.gz$ ]] || exit 1
[ -d "$upload" ] && [ ! -L "$upload" ] || exit 1
target=/opt/nginx/html/personal-site
conf=/opt/nginx/conf.d/personal-site.conf
stamp=$(date -u +%Y%m%dT%H%M%SZ)-$$
backup=/opt/personal-site/backups/$stamp
mkdir -p "$backup" "$upload/site"
python3 - "$upload/$archive" "$upload/site" <<'PY'
import os, pathlib, sys, tarfile
archive, destination = sys.argv[1:]
with tarfile.open(archive, 'r:gz') as source:
    members = source.getmembers()
    total = 0
    for member in members:
        name = pathlib.PurePosixPath(member.name)
        if name.is_absolute() or '..' in name.parts or any(part.startswith('.') for part in name.parts):
            raise SystemExit('发布包包含无效路径')
        if not (member.isfile() or member.isdir()):
            raise SystemExit('发布包不允许链接或特殊文件')
        if member.isfile() and name.suffix not in ('.html', '.css', '.js', '.svg', '.xml', '.txt', '.sha256'):
            raise SystemExit('发布包包含不允许公开的文件类型')
        total += member.size
    if total > 20 * 1024 * 1024:
        raise SystemExit('发布包超出静态网站大小限制')
    for member in members:
        target = os.path.join(destination, *pathlib.PurePosixPath(member.name).parts)
        if member.isdir():
            os.makedirs(target, mode=0o755, exist_ok=True)
        else:
            os.makedirs(os.path.dirname(target), mode=0o755, exist_ok=True)
            with source.extractfile(member) as content, open(target, 'xb') as output:
                output.write(content.read())
            os.chmod(target, 0o644)
PY
(cd "$upload/site" && sha256sum -c files.sha256)
mv "$upload/site/files.sha256" "$backup/public-files.sha256"
test -s "$upload/site/index.html"
test -s "$upload/site/404.html"
test -s "$upload/personal-site.conf"
docker exec nginx-web nginx -t
tar -czf "$backup/nginx-config-before.tar.gz" -C /opt/nginx conf conf.d
find /opt/nginx/conf.d -maxdepth 1 -type f ! -name personal-site.conf -exec sha256sum {} + > "$backup/other-configs.sha256"
[ ! -L "$target" ] || { echo '目标目录是符号链接，停止部署' >&2; exit 1; }
if [ -e "$target" ]; then cp -a "$target" "$backup/site"; touch "$backup/had-site"; fi
if [ -e "$conf" ]; then cp -a "$conf" "$backup/site.conf"; touch "$backup/had-conf"; fi

rollback() {
    trap - ERR
    if [ -e "$target" ]; then mv "$target" "$backup/failed-site"; fi
    if [ -f "$backup/had-site" ]; then cp -a "$backup/site" "$target"; fi
    if [ -f "$backup/had-conf" ]; then
        cp -a "$backup/site.conf" "$conf"
    elif [ -e "$conf" ]; then
        mv "$conf" "$backup/failed-site.conf"
    fi
    docker exec nginx-web nginx -t && docker exec nginx-web nginx -s reload
    echo "部署失败，已回滚；备份：$backup" >&2
}
trap rollback ERR
if [ -e "$target" ]; then mv "$target" "$backup/replaced-site"; fi
mv "$upload/site" "$target"
install -m 644 "$upload/personal-site.conf" "$conf"
docker exec nginx-web nginx -t
docker exec nginx-web nginx -s reload
# 允许 Nginx worker 完成平滑切换，检查精确页面内容而不只检查状态码。
verified=0
for attempt in 1 2 3 4 5; do
    if curl -fsS --max-time 5 --resolve 'www.zf-yun.cn:443:127.0.0.1' https://www.zf-yun.cn/ -o "$backup/deployed-index.html" && cmp -s "$target/index.html" "$backup/deployed-index.html"; then verified=1; break; fi
    sleep 1
done
test "$verified" = 1
sha256sum -c "$backup/other-configs.sha256"
while IFS= read -r page; do
    [ "$page" != '404.html' ] || continue
    case "$page" in */index.html) page=${page%index.html} ;; esac
    curl -fsS --max-time 10 --resolve 'www.zf-yun.cn:443:127.0.0.1' "https://www.zf-yun.cn/$page" -o /dev/null
done < <(awk '{ print $2 }' "$backup/public-files.sha256")
test "$(curl -sS -o /dev/null --max-time 10 --resolve 'www.zf-yun.cn:443:127.0.0.1' -w '%{http_code}' https://www.zf-yun.cn/page-that-does-not-exist/)" = 404
trap - ERR
printf '部署成功\nURL: https://www.zf-yun.cn/\n备份: %s\n' "$backup"
sha256sum "$target/index.html" "$target/style.css" "$target/app.js"
