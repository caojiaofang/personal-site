# 导入的文章

写作台导出的 JSON 文章包通过以下命令导入：

```powershell
npm run note:import -- "C:\Users\11701\Downloads\文章地址.json"
```

导入器校验后会在本目录保存 `<slug>.json`。构建器自动合并这些文章与 `content.mjs` 中的内置记录。这里的源文件不会进入公开目录；只有经过构建的文章页面会发布。

导入并不等于发布。先运行 `npm run dev` 预览，确认后再执行 `npm run deploy`。
