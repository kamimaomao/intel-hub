# 游戏研究所pro 情报平台

一个游戏行业情报平台，包含左侧导航、本地情报列表、文章详情、标签筛选、搜索、视图切换、摘要字号控制，以及后台添加公众号/视频号来源和同步功能。

当前实现包含一个 Node/Express 后端：

- `GET /api/items` 从本地情报库读取文章列表。
- `GET /api/item/:id` 从本地情报库读取文章详情。
- `POST /api/items` 手动导入一条或多条文章。
- `/api/sources` 管理公众号源和视频号源。
- `POST /api/sources/:id/sync` 按来源 provider 同步文章。

运行时已经不再代理外部情报站。当前内置可同步 provider 是 `feed`、`json` 和 `xianjian`；`xianjian` 从公开 sitemap 与详情页导入摘要，默认每次同步最新 500 条，可用 `XIANJIAN_IMPORT_LIMIT` 调整；`manual` 用于手动导入；`wechat` 和 `newrank` 是预留 provider，需要配置可用账号、Cookie 或 API Key 后再接入。

## 本地运行

```bash
npm install
npm run dev
```

开发模式会同时启动：

- 前端：`http://localhost:5173`
- 后端 API：`http://localhost:8787`

## 生产构建

```bash
npm run build
npm start
```

生产服务会用 Express 提供 `/api/*`，并托管 `dist/` 前端文件。

## 帽子云部署

真实文章功能必须运行 Node 后端。不要只创建“静态网站”，否则无法写入来源、导入文章或执行同步。

- 安装命令：`npm install`
- 构建命令：`npm run build`
- 启动命令：`npm start`
- Node.js：20.18.1 或更高版本
- 端口：使用平台注入的 `PORT`
- 可选环境变量：`DATA_DIR`、`XIANJIAN_IMPORT_LIMIT`

生产数据默认写入 `DATA_DIR/intel-hub.json`。如果平台文件系统会随部署重置，需要挂载持久卷，或下一步改接数据库。

如果平台只能部署静态产物，需要另外部署一个 Node 服务，并设置 `VITE_API_BASE=https://你的后端域名` 后重新构建。
