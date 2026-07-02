# 游戏研究所pro 情报平台

一个游戏行业情报平台原型，包含登录页、左侧导航、情报库、标签筛选、搜索、视图切换、摘要字号控制，以及后台添加公众号功能。

当前实现包含一个 Node/Express 后端，公众号源会通过 `/api/sources` 写入服务端数据文件。

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

帽子云目前适合部署前端静态产物：

- 安装命令：`npm install`
- 构建命令：`npm run build`
- 构建产物目录：`dist`

如果要保留真后端，需要把 `/api/*` 反向代理到一个 Node 服务，或设置环境变量 `VITE_API_BASE=https://你的后端域名` 后重新构建。直接静态部署时，帽子云不会运行 `server/index.mjs`。
