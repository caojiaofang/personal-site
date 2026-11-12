#!/usr/bin/env bash
# 仅为已经安装 Docker、迁入证书的新服务器创建本站专用容器。
set -euo pipefail
upload=${1:?请提供初始化文件目录}
[[ "$upload" =~ ^/tmp/personal-site-bootstrap-[A-Za-z0-9TZ.-]+$ ]] || exit 1
test -d "$upload"
test ! -L "$upload"
test -s /opt/nginx/cert/www.zf-yun.cn/fullchain.pem
test -s /opt/nginx/cert/www.zf-yun.cn/privkey.pem
if docker container inspect nginx-web >/dev/null 2>&1; then
    echo 'nginx-web 容器已存在，停止初始化，后续请使用发布命令更新。' >&2
    exit 1
fi
if [ -n "$(ss -H -lnt '( sport = :80 or sport = :443 )')" ]; then
    echo '80 或 443 端口已占用，停止初始化。' >&2
    exit 1
fi
for target in /opt/nginx/conf/nginx.conf /opt/nginx/conf.d/personal-site.conf /opt/personal-site/compose.yaml /opt/personal-site/.env; do
    if [ -e "$target" ] || [ -L "$target" ]; then
        echo "目标文件已存在，停止初始化：$target" >&2
        exit 1
    fi
done
image=$(docker image inspect nginx:stable-alpine --format '{{.Id}}')
[[ "$image" =~ ^sha256:[a-f0-9]{64}$ ]] || exit 1
install -d -m 755 /opt/nginx/conf /opt/nginx/conf.d /opt/nginx/html/personal-site /opt/personal-site
install -m 644 "$upload/nginx.conf" /opt/nginx/conf/nginx.conf
install -m 644 "$upload/personal-site.conf" /opt/nginx/conf.d/personal-site.conf
install -m 644 "$upload/compose.yaml" /opt/personal-site/compose.yaml
printf 'NGINX_IMAGE=%s\n' "$image" > /opt/personal-site/.env
chmod 600 /opt/personal-site/.env
cd /opt/personal-site
docker compose config --quiet
docker compose run --rm --no-deps web nginx -t
docker compose up -d
docker exec nginx-web nginx -t
docker inspect --format '{{.Name}} {{.Config.Image}} {{.State.Status}}' nginx-web
printf '容器初始化完成，请立即发布网站文件。\n'
