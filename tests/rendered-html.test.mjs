import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("has an assignment-ready GitHub Pages entry point", async () => {
  const [html, script, css, readme] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("public/script.js", root), "utf8"),
    readFile(new URL("public/style.css", root), "utf8"),
    readFile(new URL("README.md", root), "utf8"),
  ]);

  assert.match(html, /<title>Syllabus Roadmap<\/title>/);
  assert.match(html, /public\/style\.css/);
  assert.match(html, /public\/script\.js/);
  assert.match(html, /aria-live="polite"/);
  assert.match(script, /github\.io/);
  assert.match(script, /syllabus-roadmap\.aileenlotuaco2\.chatgpt\.site\/api\/extract/);
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(readme, /## What it does/);
  assert.match(readme, /## Live app/);
  assert.match(readme, /## How to use it/);
  assert.match(readme, /## Known limitations/);
});

test("allows only the GitHub Pages frontend to call the cross-origin API", async () => {
  const workerUrl = new URL("../worker/static-site.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const preflight = await worker.fetch(
    new Request("https://syllabus-roadmap.example/api/extract", {
      method: "OPTIONS",
      headers: { origin: "https://aileenlotuaco01.github.io" },
    }),
    {},
  );
  assert.equal(preflight.status, 204);
  assert.equal(
    preflight.headers.get("access-control-allow-origin"),
    "https://aileenlotuaco01.github.io",
  );

  const rejected = await worker.fetch(
    new Request("https://syllabus-roadmap.example/api/extract", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://untrusted.example",
      },
      body: JSON.stringify({ text: "Week 1: Introduction to the course", semesterStart: "2026-09-01" }),
    }),
    { OPENAI_API_KEY: "not-used" },
  );
  assert.equal(rejected.status, 403);
});
