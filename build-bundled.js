const esbuild = require("esbuild");
const fs      = require("fs");
const path    = require("path");
const { minify } = require("terser");

const providersDir = path.join(__dirname, "providers");
const providerDirs = fs
  .readdirSync(providersDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith(".") && d.name !== "extractors")
  .map((d) => d.name);

const MODULES = ["catalog", "posts", "meta", "episodes", "stream", "settings"];
const errors  = [];

async function buildProvider(name) {
  const providerPath = path.join(providersDir, name);
  const distPath     = path.join(__dirname, "dist", name);
  fs.mkdirSync(distPath, { recursive: true });

  for (const moduleName of MODULES) {
    const entry = path.join(providerPath, `${moduleName}.ts`);
    if (!fs.existsSync(entry)) continue;
    try {
      const out = await esbuild.build({
        entryPoints: [entry],
        bundle: true,
        platform: "neutral",
        format: "cjs",
        target: "es2015",
        write: false,
        external: ["axios", "cheerio", "node:*"],
        minify: false,
        keepNames: true,
        treeShaking: true,
      });
      let code = out.outputFiles[0].text;
      code = code.replace(/require\(['"]node:[^'"]+['"]\)/g, "({})");
      const min = await minify(code, { compress: true, mangle: false });
      if (min.code) code = min.code;
      fs.writeFileSync(path.join(distPath, `${moduleName}.js`), code, "utf8");
      console.log(`✅ ${name}/${moduleName}.js`);
    } catch (err) {
      errors.push(`❌ ${name}/${moduleName}: ${err.message}`);
    }
  }
}

(async () => {
  console.log(`Building ${providerDirs.length} provider(s)…`);
  for (const name of providerDirs) await buildProvider(name);
  if (errors.length) { console.error("\nBuild failed:\n" + errors.join("\n")); process.exit(1); }
  console.log("\nBuild complete → dist/");
})();
