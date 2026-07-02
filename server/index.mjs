import express from "express";
import { readFileSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const originalSources = JSON.parse(readFileSync(path.join(rootDir, "src", "data", "originalSources.json"), "utf8"));
const dataDir = process.env.DATA_DIR || path.join(rootDir, "data");
const dataFile = path.join(dataDir, "intel-hub.json");
const port = Number(process.env.PORT || 8787);

const seedData = {
  sources: originalSources,
  items: [
    {
      id: "6065",
      title: "开源游戏引擎开始收紧 AI 代码贡献",
      summary: "维护者更关注代码可审计性、长期稳定性和协作成本，AI 生成代码从效率工具变成治理议题。",
      source: "GameLook",
      kind: "公众号",
      tag: "AI与游戏",
      tags: ["研发", "AI工具", "平台政策"],
      date: "2026-07-01 23:58",
      signals: ["开源治理", "AI 低质代码", "工具链边界"],
      originalUrl: "#",
    },
    {
      id: "6001",
      title: "智能 NPC 原型更适合先落在支线与陪伴系统",
      summary: "当前大模型延迟、成本与可控性仍限制主线叙事，轻量陪伴、日常反馈和玩家日志是更稳的产品落点。",
      source: "游戏AI观察",
      kind: "公众号",
      tag: "AI与游戏",
      tags: ["AI工具", "研发", "叙事设计"],
      date: "2026-06-30 10:20",
      signals: ["低风险场景", "陪伴系统", "可控叙事"],
      originalUrl: "#",
    },
    {
      id: "6002",
      title: "AI 生成资产进入中小团队生产管线",
      summary: "图像、配音、关卡草案生成开始接入预研流程，重点不是替代美术，而是缩短概念验证周期。",
      source: "游戏AI观察",
      kind: "公众号",
      tag: "AI与游戏",
      tags: ["AI工具", "生产管线"],
      date: "2026-06-29 09:15",
      signals: ["预研提速", "资产草案", "团队协作"],
      originalUrl: "#",
    },
    {
      id: "6003",
      title: "微信小游戏榜单换血率升高，休闲赛道竞争加剧",
      summary: "榜单头部产品迭代节奏变快，红包裂变、宠物继承和塔防混搭继续成为常见组合。",
      source: "GameLook",
      kind: "公众号",
      tag: "小游戏",
      tags: ["小游戏", "榜单数据", "爆款拆解"],
      date: "2026-06-28 18:40",
      signals: ["榜单换血", "休闲猛增", "混合玩法"],
      originalUrl: "#",
    },
  ],
};

async function ensureDataFile() {
  await mkdir(dataDir, { recursive: true });
  try {
    await stat(dataFile);
    const current = JSON.parse(await readFile(dataFile, "utf8"));
    const placeholderNames = new Set(["游戏AI观察", "独游产品实验室"]);
    const currentSources = Array.isArray(current.sources)
      ? current.sources.filter((source) => !placeholderNames.has(source.name))
      : [];
    const existingNames = new Set(currentSources.map((source) => source.name));
    const missingSources = originalSources.filter((source) => !existingNames.has(source.name));
    if (missingSources.length > 0 || currentSources.length !== current.sources?.length) {
      current.sources = [...missingSources, ...currentSources];
      await writeFile(dataFile, JSON.stringify(current, null, 2), "utf8");
    }
  } catch {
    await writeFile(dataFile, JSON.stringify(seedData, null, 2), "utf8");
  }
}

async function readData() {
  await ensureDataFile();
  const raw = await readFile(dataFile, "utf8");
  return JSON.parse(raw);
}

async function writeData(data) {
  await writeFile(dataFile, JSON.stringify(data, null, 2), "utf8");
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim()).filter(Boolean);
  }
  return String(value || "")
    .split(/[，,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function slug(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^\p{Script=Han}\w-]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

const app = express();
app.use(express.json({ limit: "256kb" }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.post("/api/login", (request, response) => {
  const { username, password } = request.body || {};
  response.json({ ok: Boolean(String(username || "").trim() && String(password || "").trim()) });
});

app.get("/api/items", async (request, response, next) => {
  try {
    const data = await readData();
    const query = String(request.query.q || "").trim().toLowerCase();
    const tag = String(request.query.tag || "全部");
    const items = data.items.filter((item) => {
      const matchesTag = tag === "全部" || item.tag === tag || item.tags.includes(tag);
      const searchable = `${item.title} ${item.summary} ${item.source} ${item.tag} ${item.tags.join(" ")}`.toLowerCase();
      return matchesTag && (!query || searchable.includes(query));
    });
    response.json({ items, total: data.items.length });
  } catch (error) {
    next(error);
  }
});

app.get("/api/sources", async (_request, response, next) => {
  try {
    const data = await readData();
    response.json({ sources: data.sources });
  } catch (error) {
    next(error);
  }
});

app.post("/api/sources", async (request, response, next) => {
  try {
    const name = String(request.body?.name || "").trim();
    const wechatId = String(request.body?.wechatId || "").trim();
    if (!name || !wechatId) {
      response.status(400).json({ error: "公众号名称和微信号必填" });
      return;
    }

    const data = await readData();
    const source = {
      id: `${slug(wechatId || name)}-${Date.now()}`,
      name,
      wechatId,
      description: String(request.body?.description || "").trim(),
      tags: normalizeTags(request.body?.tags),
      status: request.body?.status === "停用" ? "停用" : "启用",
      createdAt: new Date().toISOString().slice(0, 10),
    };

    data.sources.unshift(source);
    await writeData(data);
    response.status(201).json({ source });
  } catch (error) {
    next(error);
  }
});

app.use(express.static(path.join(rootDir, "dist")));
app.get("*", (_request, response) => {
  response.sendFile(path.join(rootDir, "dist", "index.html"));
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: "服务端错误" });
});

app.listen(port, () => {
  console.log(`Intel Hub server listening on http://localhost:${port}`);
});
