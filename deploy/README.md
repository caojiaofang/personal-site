# z236 Docker 发布说明

## 当前入口

- 公开访问：https://www.zf-yun.cn/
- 默认目标：SSH 别名 `z236`，公网 IPv4 `60.205.105.236`
- Compose：`/opt/personal-site/compose.yaml`
- 容器：`nginx-web`，映射 TCP 80/443，配置和静态文件只读挂载
- Nginx 主配置：`/opt/nginx/conf/nginx.conf`
- 文件目录：`/opt/nginx/html/personal-site`
- Nginx 配置：`/opt/nginx/conf.d/personal-site.conf`
- 容器内文件目录：`/etc/nginx/html/personal-site`
- 备份目录：`/opt/personal-site/backups/<发布时间>`

`www.zf-yun.cn` 和新服务器 IP 的 HTTP 请求均跳转到正式域名的 HTTPS 地址。证书目录为 `/opt/nginx/cert/www.zf-yun.cn/`，包含 `fullchain.pem` 和权限为 600 的 `privkey.pem`，目录权限 700。证书通过加密 SSH 通道从 z11 迁入，未落盘到本地项目，也不进入发布包。

2026-11-12 迁移时保留 z11 的原网站与容器。将 DNS 中 `www` 的 A 记录改为 `60.205.105.236` 后，正式流量才会切换；域名、文章地址和微信验证文件路径保持不变。若配置了 AAAA 记录，也需要确保它指向可提供本站服务的 IPv6，避免访问旧节点。不要将整个域名的其他解析记录一起修改。

阿里云安全组需要允许公网入方向 TCP 80 和 TCP 443。此次由用户在控制台开放后，公网复测通过；容器端口映射与服务器内部访问正常不能代替公网验证。迁移完成时阿里 DNS 已返回新 A 记录，未返回 AAAA 记录。

当前证书有效期至 2027-01-19 15:59:59（北京时间），需要到期前更新，尚未配置自动续期。`install-certificate.mjs` 用于首次安装：从不回显的标准输入接收证书 JSON，在内存中校验域名、证书链和私钥，再通过 SSH 标准输入传到服务器；遇到已有证书目录会停止，避免误覆盖。

## 再次发布

在项目根目录运行：

```powershell
npm run deploy
```

要求本地已有 Node.js 18+、tar、SSH 别名 z236，并能免交互连接；服务器上已运行本站容器且已配置对应证书。脚本自动执行检查和构建，只打包 `dist/`，通过 tar.gz 上传静态页面与资源。服务器检查包内路径、文件类型和大小，拒绝链接及特殊文件，校验 SHA-256 后替换站点目录。校验清单移入备份目录，不对外提供。SSH 私钥由 SSH 读取，不复制到项目或服务器。

默认使用 `deploy/docker/personal-site.conf`，适配新容器的 HTTP/2 配置。如需明确发布到保留的旧服务器，可执行 `npm run deploy -- z11`；它使用原有 `deploy/personal-site.conf`，不会变更 z236。发布命令不会修改 DNS。

发布前备份 Nginx 配置和旧网站，发布后检查首页、独立页面、RSS、站点地图、404 状态及其他域名配置的校验和；失败时自动回滚。Nginx 使用平滑 reload，不重启现有容器。上传临时目录和本地 `.deploy/` 发布包不自动删除，方便排查。

服务器自带 curl 较旧，发布探测固定使用 HTTPS + HTTP/1.1，并保留证书链、域名和响应内容校验；站点本身仍开启 HTTP/2。迁移后另用现代 HTTP/2 客户端验证首页、四个工具及二维码编码模块。

第四版增加 `/tools/writing/` 和对应静态模块，无需新增服务器服务。草稿保存在访客浏览器，不随部署上传。要发布新文章，先使用 `npm run note:import -- <文章包.json> --check` 校验，再去掉 `--check` 导入到 `content/notes/`，本地预览后执行上述发布命令。发布包只包含生成后的文章页面，不包含 JSON 原稿、测试草稿或备份。

第五版增加 `/tools/qr/`、二维码脚本及本地编码库。首次检出后先运行 `npm ci` 安装测试用的开发依赖，再执行发布命令。服务器仍仅提供静态文件，不安装 Node.js 或依赖；二维码输入不会上传，也不随构建发布。

## 首次初始化与容器维护

z236 是 Alibaba Cloud Linux 3，使用阿里云软件源安装 Docker CE 与 Compose，Docker 服务设置为开机启动。官方安装参考：[Alibaba Cloud Linux 安装 Docker](https://www.alibabacloud.com/help/zh/ecs/user-guide/install-and-use-docker)。

`deploy/docker/` 保存 Compose、Nginx 主配置和新服务器的站点配置。首次初始化前需要安装 Docker、迁入证书，并准备已校验的官方 `nginx:stable-alpine` 镜像。此次在 z11 从 Docker Hub 拉取后，以 SSH 流式传到 z236 的 `docker load`，没有使用未知镜像代理或关闭 TLS 校验。

将 `deploy/docker/` 的三个文件和 `deploy/bootstrap-docker.sh` 上传到同一个 `/tmp/personal-site-bootstrap-<唯一标识>/` 目录，再在服务器执行 `bash <上传目录>/bootstrap-docker.sh <上传目录>`。脚本拒绝覆盖已有容器或配置，检查端口、证书和镜像后初始化容器；随后立即执行本地的 `npm run deploy` 发布内容。首次初始化后的空目录暂时没有网页，不能代替正式发布。

服务器 `/opt/personal-site/.env` 只保存 `NGINX_IMAGE=sha256:...`，固定经过检查的本地镜像 ID，避免日常启动隐式更新镜像。容器限制内存为 128MB，开启失败后重启与 Docker 启动恢复，Nginx 配置及证书只读挂载，写入仅限临时目录；日志按 10MB × 3 轮转。健康检查使用 `nginx -t`，完整页面和 HTTPS 仍由发布脚本另外检查。

维护命令（在 z236 执行）：

```bash
cd /opt/personal-site
docker compose ps
docker compose logs --tail=100 web
docker compose up -d
docker exec nginx-web nginx -t
```

更新 Nginx 镜像时，先验证新镜像和配置，再更新服务器 `.env` 中的镜像 ID，并执行 `docker compose up -d`。保留旧镜像 ID 便于回退，不自动清理旧镜像或备份。

域名切换前可从本机运行 `curl.exe --noproxy "*" --resolve www.zf-yun.cn:443:60.205.105.236 https://www.zf-yun.cn/`，在保留域名 SNI 和证书校验的前提下直接验证新服务器。

## 微信验证文件

网站根目录还包含微信恢复访问申请使用的 `f28bbce1a74e761225dfa2c15690a66b.txt`。源文件保存在项目根目录，构建时按原内容复制到 `dist/`，后续发布会继续保留。申请完成前不要移除或修改。

## 手动回滚

从发布输出中复制准确的备份路径，并在服务器上执行以下逻辑。先将当前 `personal-site` 目录移到该备份下的一个未使用目录，保留可恢复副本。

- 备份有 `had-site`：将备份的 `site` 目录复制回 `/opt/nginx/html/personal-site`；没有则不恢复网站目录。
- 备份有 `had-conf`：将备份的 `site.conf` 复制回 `/opt/nginx/conf.d/personal-site.conf`；没有则将当前这一个配置文件移入备份目录。
- 执行 `docker exec nginx-web nginx -t`，通过后执行 `docker exec nginx-web nginx -s reload`。

无需修改其他域名配置或重启整个 Nginx 容器。
