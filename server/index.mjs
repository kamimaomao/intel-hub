import express from "express";
import { readFileSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchOriginItem, fetchOriginItems, loginOrigin } from "./originClient.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const originalSources = JSON.parse(readFileSync(path.join(rootDir, "src", "data", "originalSources.json"), "utf8"));
const dataDir = process.env.DATA_DIR || path.join(rootDir, "data");
const dataFile = path.join(dataDir, "intel-hub.json");
const port = Number(process.env.PORT || 8787);

const seedData = {
  sources: originalSources,
  items: [],
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

app.post("/api/login", async (request, response, next) => {
  try {
    const { username, password } = request.body || {};
    await loginOrigin(username, password);
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/items", async (request, response, next) => {
  try {
    const query = String(request.query.q || "").trim().toLowerCase();
    const tag = String(request.query.tag || "全部");
    const author = String(request.query.author || "").trim();
    const result = await fetchOriginItems({ tag, q: query, author });
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/item/:id", async (request, response, next) => {
  try {
    const item = await fetchOriginItem(request.params.id);
    response.json({ item });
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
  response.status(error.status || 500).json({ error: error.message || "服务端错误", code: error.code || "SERVER_ERROR" });
});

app.listen(port, () => {
  console.log(`Intel Hub server listening on http://localhost:${port}`);
});
