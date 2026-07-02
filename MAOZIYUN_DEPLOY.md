# 帽子云部署配置

## 重要结论

这版已经改成自有数据层，不能只按“静态网站”部署。静态网站不会运行 `server/index.mjs`，因此无法写入来源、导入文章或执行同步任务。

## Node 服务部署配置

- 应用类型：Node / Web Service / 服务端应用
- 仓库分支：`main`
- 安装命令：`npm install`
- 构建命令：`npm run build`
- 启动命令：`npm start`
- Node.js：20.18.1 或更高版本
- 端口：使用平台自动注入的 `PORT`，本项目会自动读取

可选环境变量：

- `DATA_DIR`：公众号源数据目录，默认 `data/`
- `XIANJIAN_IMPORT_LIMIT`：公开索引每次同步条数，默认 `20`

生产数据默认写入 `DATA_DIR/intel-hub.json`。如果帽子云文件系统会随部署重置，需要挂载持久卷，或改接数据库。

当前可直接同步的数据源：

- `manual`：手动通过后台/接口导入文章
- `feed`：RSS / Atom
- `json`：返回文章列表的 JSON API
- `xianjian`：从公开 sitemap 与详情页导入摘要，默认每次最新 20 条

`wechat` 和 `newrank` 已作为 provider 预留，但需要可用账号、Cookie 或 API Key 后再接入。

## 如果帽子云只能创建静态网站

保留真实数据需要两段式部署：

1. 在支持 Node 的平台部署本项目后端，启动命令仍然是 `npm start`。
2. 帽子云部署前端静态产物，并设置环境变量 `VITE_API_BASE=https://你的后端域名`。

## 部署步骤

1. 把当前项目推送到 GitHub 仓库。
2. 在帽子云中新建 Node 服务端应用。
3. 授权并选择 GitHub 仓库 `kamimaomao/intel-hub` 与 `main` 分支。
4. 填入上面的安装、构建、启动命令。
5. 如需持久保存数据，配置 `DATA_DIR` 指向持久卷目录。
6. 创建应用，等待构建完成后访问帽子云分配的域名。

## 当前限制

当前后端不再代理外部情报站。公众号和视频号的真实采集质量取决于你接入的 provider；公开索引只能导入摘要和原文链接，微信和新榜类数据源通常需要登录态或商业 API 权限。
