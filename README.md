# 未完 · 个人主页与实验室

一个静态个人网站。第五版新增文字与链接的二维码生成器，支持中文、emoji、PNG 和 SVG 下载；保留写作台、配色收藏、专注记录、文章搜索、独立阅读页、RSS 和浅色与深色主题。使用 Node.js 内置模块生成可部署页面，无需服务器端 Node.js 或数据库。站名「未完」暂定，未填写未经提供的姓名、履历或联系方式。

## 本地运行

需要 Node.js 18 或以上版本。首次检出项目时执行 `npm ci` 安装锁定版本的开发依赖；它们用于独立二维码解码与图片验收，不进入公开产物。

```powershell
npm run dev
```

访问 http://127.0.0.1:4173。启动时自动构建，修改源文件后运行 `npm run build` 并刷新预览。使用 `npm run check` 检查 JavaScript 语法、16 项行为测试、生成页面、站内链接与文章锚点；`npm test` 可以单独执行工具状态、Markdown、文章导入与二维码解码测试。

## 修改内容

- `content.mjs`：项目、内置文章、正文、日期与分类；`content/notes/*.json`：从写作台导入的文章。
- `index.html`：首页模板、主视觉与关于介绍；作品与文章列表在构建时由内容数据替换。
- `style.css`：第一版基础视觉；`next.css`：第二版新增样式、主题和阅读布局。
- `lab.css`：第三版独立工具界面与跨页计时条。
- `app.js`：作品筛选与文章搜索；`theme.js`：主题偏好；`article.js`：阅读进度、目录与链接复制。
- `lab-state.js`：计时、完成记录与配色收藏的状态；`lab.js`：工具交互和跨页计时提示。
- `writing.css`、`writing.js`、`writing-state.js`：写作台界面、交互与草稿状态。
- `markdown.js`、`note-format.js`：预览与发布共用的 Markdown 渲染和文章格式校验。
- `scripts/tool-pages.mjs`、`scripts/writing-page.mjs`：三个独立工具页的静态页面模板。
- `scripts/import-note.mjs`：校验并导入文章包。
- `qr.js`、`qr.css`、`scripts/qr-page.mjs`：二维码工具交互、样式和页面。
- `qr-code.js`：编码、SVG 与整数像素输出；`vendor/qrcodegen.js`：保留 MIT License 的本地二维码编码库。
- `scripts/build.mjs`：生成 `dist/`，包括独立页面、RSS、站点地图与 404。
- `favicon.svg`：网站图标。

所有文件使用 UTF-8。页面无外部字体、第三方请求、追踪脚本或后台服务。计时、收藏、完成记录和主题偏好仅保存在各自浏览器中，不上传；不同设备及来源不共享。清除浏览器数据会清除记录。存储被禁用时退回当前页面的内存模式，并提示无法保存。

工具地址为 `/tools/palette/` 和 `/tools/focus/`。计时可在刷新、同站页面切换和关闭后重新打开时按实际时间恢复；到期后只计入一次完成记录。休息和未完成的重置不计入专注。关闭网页时不会发送通知，下次打开时补记；最近 100 轮可导出 JSON。配色支持收藏、复制 CSS 变量、下载 CSS 和 SVG 色卡。内容维护示例见 `MAINTENANCE.md`。

写作台地址为 `/tools/writing/`，支持 Markdown 实时预览、自动保存、归档恢复及多标签页冲突提示。草稿只存于当前浏览器，最多 100 篇、每篇正文 20,000 字符；建议定期导出 Markdown 备份。导出文章包不会自动公开，使用 `npm run note:import -- <文章包.json> --check` 校验，再去掉 `--check` 导入，预览确认后执行 `npm run deploy` 发布。完整流程见 `MAINTENANCE.md`。

二维码工具地址为 `/tools/qr/`。输入文字或完整链接后自动生成，内容按 UTF-8 编码并保留空格和换行，最多 2,000 字节。支持 L/M/Q/H 纠错、512/1024/2048 像素 PNG 和 SVG 下载；生成与下载均在当前浏览器完成，不上传、不保存输入。源码与许可来源见 `vendor/README.md`。

## z11 部署

`npm run deploy` 自动检查并构建，再将 `dist/` 打包上传。公开目录只包含静态页面和资源；开发脚本、内容源文件、说明文档、SSH 密钥和证书不进入发布包。

正式访问地址：https://www.zf-yun.cn/ 。使用服务器现有的 `nginx-web` 容器，通过 `/opt/nginx/html/personal-site` 提供文件；独立域名配置不覆盖其他站点。具体发布和回滚方式见 `deploy/README.md`。
