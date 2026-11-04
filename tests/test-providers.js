const fs   = require("fs");
const path = require("path");

const providersDir = path.join(__dirname, "..", "providers");
const distDir      = path.join(__dirname, "..", "dist");
let failures = 0;

function assert(cond, msg) {
  if (!cond) { console.error("❌ " + msg); failures++; }
  else       { console.log  ("✅ " + msg); }
}

for (const name of fs.readdirSync(providersDir)) {
  const dir = path.join(providersDir, name);
  if (!fs.statSync(dir).isDirectory()) continue;
  if (name === "extractors") continue;
  for (const mod of ["catalog", "posts", "meta", "episodes", "stream", "settings"]) {
    assert(fs.existsSync(path.join(dir, `${mod}.ts`)), `${name}/${mod}.ts exists`);
  }
}

if (fs.existsSync(distDir)) {
  for (const name of fs.readdirSync(distDir)) {
    for (const mod of ["catalog", "posts", "meta", "episodes", "stream", "settings"]) {
      assert(fs.existsSync(path.join(distDir, name, `${mod}.js`)), `dist/${name}/${mod}.js built`);
    }
  }
} else {
  console.log("ℹ️  dist/ not built yet — run `npm run build` first");
}

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log("\n✅ All checks passed.");
