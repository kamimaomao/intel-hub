# 游戏研究所pro 情报平台

一个游戏行业情报平台，包含登录页、左侧导航、真实情报列表、文章详情、标签筛选、搜索、视图切换、摘要字号控制，以及后台添加公众号功能。

当前实现包含一个 Node/Express 后端：

- `/api/login` 登录原站并维护服务端 Cookie。
- `/api/items` 从原站实时读取真实文章列表。
- `/api/item/:id` 从原站读取真实文章详情和微信原文链接。
- `/api/sources` 管理本地公众号源。

## 本地运行

```bash
npm install
npm run dev
```

登录页默认本站账号是 `111 / 111`。服务端会使用环境变量里的原站账号读取真实文章：

```bash
APP_USERNAME=111
APP_PASSWORD=111
XIANJIAN_USERNAME=你的账号
XIANJIAN_PASSWORD=你的密码
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

真实文章功能必须运行 Node 后端。不要只创建“静态网站”，否则无法登录原站、无法读取真实文章。

- 安装命令：`npm install`
- 构建命令：`npm run build`
- 启动命令：`npm start`
- Node.js：20.18.1 或更高版本
- 端口：使用平台注入的 `PORT`
- 可选环境变量：`APP_USERNAME`、`APP_PASSWORD`、`XIANJIAN_USERNAME`、`XIANJIAN_PASSWORD`

如果平台只能部署静态产物，需要另外部署一个 Node 服务，并设置 `VITE_API_BASE=https://你的后端域名` 后重新构建。
