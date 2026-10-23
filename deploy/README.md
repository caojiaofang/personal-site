# z11 发布说明

## 当前入口

- 公开访问：https://www.zf-yun.cn/
- 文件目录：`/opt/nginx/html/personal-site`
- Nginx 配置：`/opt/nginx/conf.d/personal-site.conf`
- 容器内文件目录：`/etc/nginx/html/personal-site`
- 备份目录：`/opt/personal-site/backups/<发布时间>`

`www.zf-yun.cn` 和服务器 IP 的 HTTP 请求均跳转到正式域名的 HTTPS 地址；其他域名仍由原配置处理。证书目录为 `/opt/nginx/cert/www.zf-yun.cn/`，包含 `fullchain.pem` 和权限为 600 的 `privkey.pem`。证书和私钥均不保存在项目源码中。

当前证书有效期至 2027-01-19 15:59:59（北京时间），需要到期前更新，尚未配置自动续期。`install-certificate.mjs` 用于首次安装：从不回显的标准输入接收证书 JSON，在内存中校验域名、证书链和私钥，再通过 SSH 标准输入传到服务器；遇到已有证书目录会停止，避免误覆盖。

## 再次发布

在项目根目录运行：

```powershell
npm run deploy
```

要求本地已有 Node.js 18+、tar、SSH 别名 z11，并能免交互连接；服务器上已有域名对应的证书。脚本自动执行检查和构建，只打包 `dist/`，通过 tar.gz 上传静态页面与资源。服务器检查包内路径、文件类型和大小，拒绝链接及特殊文件，校验 SHA-256 后替换站点目录。校验清单移入备份目录，不对外提供。SSH 私钥由 SSH 读取，不复制到项目或服务器。

发布前备份 Nginx 配置和旧网站，发布后检查首页、独立页面、RSS、站点地图、404 状态及其他域名配置的校验和；失败时自动回滚。Nginx 使用平滑 reload，不重启现有容器。上传临时目录和本地 `.deploy/` 发布包不自动删除，方便排查。

第四版增加 `/tools/writing/` 和对应静态模块，无需新增服务器服务。草稿保存在访客浏览器，不随部署上传。要发布新文章，先使用 `npm run note:import -- <文章包.json> --check` 校验，再去掉 `--check` 导入到 `content/notes/`，本地预览后执行上述发布命令。发布包只包含生成后的文章页面，不包含 JSON 原稿、测试草稿或备份。

第五版增加 `/tools/qr/`、二维码脚本及本地编码库。首次检出后先运行 `npm ci` 安装测试用的开发依赖，再执行发布命令。服务器仍仅提供静态文件，不安装 Node.js 或依赖；二维码输入不会上传，也不随构建发布。

## 微信验证文件

网站根目录还包含微信恢复访问申请使用的 `f28bbce1a74e761225dfa2c15690a66b.txt`。源文件保存在项目根目录，构建时按原内容复制到 `dist/`，后续发布会继续保留。申请完成前不要移除或修改。

## 手动回滚

从发布输出中复制准确的备份路径，并在服务器上执行以下逻辑。先将当前 `personal-site` 目录移到该备份下的一个未使用目录，保留可恢复副本。

- 备份有 `had-site`：将备份的 `site` 目录复制回 `/opt/nginx/html/personal-site`；没有则不恢复网站目录。
- 备份有 `had-conf`：将备份的 `site.conf` 复制回 `/opt/nginx/conf.d/personal-site.conf`；没有则将当前这一个配置文件移入备份目录。
- 执行 `docker exec nginx-web nginx -t`，通过后执行 `docker exec nginx-web nginx -s reload`。

无需修改其他域名配置或重启整个 Nginx 容器。
