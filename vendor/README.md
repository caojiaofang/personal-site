# 第三方二维码编码库

`qrcodegen.js` 来自 Project Nayuki 的 QR Code generator library，使用 MIT License。完整版权与许可声明保留在源码顶部，并随公开 JS 一起分发。

- 官方介绍：https://www.nayuki.io/page/qr-code-generator-library
- 下载来源：https://www.nayuki.io/res/qr-code-generator-library/qrcodegen.js
- 获取日期：2026-10-23
- 上游文件 SHA-256：`2511bc17f40a3c41d4a0578995db956b38997334d3d20113a5d4dc5c49c69480`
- 本地仅追加 ES module 导出 `export { qrcodegen };`，算法保持原样。保留上游英文注释。

编码库随本站静态资源托管，不从外部 CDN 加载，也不向第三方发送输入内容。二维码解码器 `jsqr` 是锁定版本的开发依赖，仅用于测试生成图片是否能解码，不进入公开产物。
