import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const requiredFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "auth.js",
  "supabase-config.js",
  "cloud-storage.js",
  "vendor/supabase.min.js",
  "supabase/migrations/202611200001_ekinvya_user_data.sql",
  "manifest.webmanifest",
  "service-worker.js",
  "vercel.json",
  "favicon.svg"
];

for (const file of requiredFiles) {
  await access(resolve(root, file), constants.R_OK);
}

const html = await readFile(resolve(root, "index.html"), "utf8");
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicates.length) throw new Error(`Yinelenen HTML kimlikleri: ${[...new Set(duplicates)].join(", ")}`);

for (const reference of ["./styles.css", "./app.js", "./auth.js", "./supabase-config.js", "./cloud-storage.js", "./vendor/supabase.min.js", "./manifest.webmanifest", "./favicon.svg"]) {
  if (!html.includes(reference)) throw new Error(`index.html içinde dosya bağlantısı eksik: ${reference}`);
}
if (/<style(?:\s|>)/i.test(html) || /<script>([\s\S]*?)<\/script>/i.test(html)) {
  throw new Error("CSS ve uygulama JavaScript'i ayrı dosyalara çıkarılmalı.");
}

const syntax = spawnSync(process.execPath, ["--check", resolve(root, "app.js")], { encoding: "utf8" });
if (syntax.status !== 0) throw new Error(syntax.stderr || "app.js sözdizimi kontrolü başarısız.");
for (const file of ["auth.js", "supabase-config.js", "cloud-storage.js", "service-worker.js", "scripts/serve.mjs", "scripts/check-project.mjs"]) {
  const result = spawnSync(process.execPath, ["--check", resolve(root, file)], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `${file} sözdizimi kontrolü başarısız.`);
}

JSON.parse(await readFile(resolve(root, "vercel.json"), "utf8"));
JSON.parse(await readFile(resolve(root, "manifest.webmanifest"), "utf8"));
JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
for (const id of ["authConfigNotice", "authForm", "authRecoveryForm", "authAccountPanel"]) {
  if (!ids.includes(id)) throw new Error(`Üyelik arayüzü eksik: ${id}`);
}
console.log(`Ekinvya proje kontrolü başarılı (${requiredFiles.length} ana dosya, ${ids.length} HTML kimliği).`);
