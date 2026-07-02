import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("sidebar does not expose unused utility links", () => {
  const source = `${readFileSync("src/App.tsx", "utf8")}\n${readFileSync("src/data/navConfig.ts", "utf8")}`;
  for (const label of ["我的收藏", "提建议", "更新日志", "加入微信群"]) {
    assert.equal(source.includes(label), false, `${label} should not be rendered from the sidebar config`);
  }
});
