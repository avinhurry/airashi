const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { test } = require("node:test");

const SCRIPT_PATH = path.resolve(__dirname, "../scripts/optimize_images.js");

async function withTempDir(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "optimize-images-"));
  try {
    await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

async function writeFile(filePath, size) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, Buffer.alloc(size, 0x61));
}

async function createSharpStub(baseDir) {
  const moduleDir = path.join(baseDir, "node_modules", "sharp");
  await fs.mkdir(moduleDir, { recursive: true });
  const stub = `const fs = require("fs");
const path = require("path");

function sharp(inputPath) {
  const state = { inputPath, resized: false };
  return {
    rotate() { return this; },
    metadata() {
      const base = path.basename(inputPath);
      const match = base.match(/w(\\d+)/i);
      const width = match ? Number(match[1]) : 800;
      return Promise.resolve({ width });
    },
    resize(opts) {
      state.resized = true;
      state.resizeWidth = opts.width;
      return this;
    },
    jpeg(opts) { state.outputFormat = "jpeg"; state.quality = opts.quality; return this; },
    png(opts) { state.outputFormat = "png"; state.quality = opts.quality; return this; },
    webp(opts) { state.outputFormat = "webp"; state.quality = opts.quality; return this; },
    toBuffer() {
      const originalSize = fs.statSync(inputPath).size;
      let ratio = 1;
      if (state.resized) ratio *= 0.6;
      return Promise.resolve(Buffer.alloc(Math.max(1, Math.floor(originalSize * ratio)), 0));
    }
  };
}

module.exports = sharp;
`;
  await fs.writeFile(path.join(moduleDir, "index.js"), stub);
  return path.join(baseDir, "node_modules");
}

function runScript({ cwd, args, env }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SCRIPT_PATH, ...args], {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("resizes and optimizes large images", async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "assets/images/large_w2000.jpg");
    await writeFile(filePath, 2000);
    const nodePath = await createSharpStub(dir);
    const env = {
      ...process.env,
      NODE_PATH: [nodePath, process.env.NODE_PATH].filter(Boolean).join(path.delimiter),
    };

    const result = await runScript({
      cwd: dir,
      args: ["--root", "assets/images", "--max-width", "1600", "--verbose"],
      env,
    });

    assert.equal(result.code, 0, result.stderr);
    const stat = await fs.stat(filePath);
    assert.ok(stat.size < 2000);
    assert.match(result.stdout, /Optimized .*large_w2000\.jpg/);
  });
});

test("skips images within max width when size does not improve", async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "assets/images/small_w800.jpg");
    await writeFile(filePath, 1000);
    const nodePath = await createSharpStub(dir);
    const env = {
      ...process.env,
      NODE_PATH: [nodePath, process.env.NODE_PATH].filter(Boolean).join(path.delimiter),
    };

    const result = await runScript({
      cwd: dir,
      args: ["--root", "assets/images", "--max-width", "1600", "--verbose"],
      env,
    });

    assert.equal(result.code, 0, result.stderr);
    const stat = await fs.stat(filePath);
    assert.equal(stat.size, 1000);
    assert.match(result.stdout, /Skipped .*small_w800\.jpg/);
  });
});

test("ignores configured paths", async () => {
  await withTempDir(async (dir) => {
    const filePath = path.join(dir, "assets/images/favicon/icon_w2000.png");
    await writeFile(filePath, 1200);
    const nodePath = await createSharpStub(dir);
    const env = {
      ...process.env,
      NODE_PATH: [nodePath, process.env.NODE_PATH].filter(Boolean).join(path.delimiter),
    };

    const result = await runScript({
      cwd: dir,
      args: [
        "--root",
        "assets/images",
        "--max-width",
        "1600",
        "--ignore",
        "assets/images/favicon",
        "--verbose",
      ],
      env,
    });

    assert.equal(result.code, 0, result.stderr);
    const stat = await fs.stat(filePath);
    assert.equal(stat.size, 1200);
    assert.match(result.stdout, /No images found to optimize\./);
  });
});

test("uses explicit file list when provided", async () => {
  await withTempDir(async (dir) => {
    const inList = path.join(dir, "assets/images/in_list_w2000.jpg");
    const notListed = path.join(dir, "assets/images/not_listed_w2000.jpg");
    await writeFile(inList, 2000);
    await writeFile(notListed, 2000);
    const nodePath = await createSharpStub(dir);
    const env = {
      ...process.env,
      NODE_PATH: [nodePath, process.env.NODE_PATH].filter(Boolean).join(path.delimiter),
    };

    const fileListPath = path.join(dir, "changed-images.txt");
    const list = Buffer.from("assets/images/in_list_w2000.jpg\0assets/images/notes.txt\0");
    await fs.writeFile(fileListPath, list);

    const result = await runScript({
      cwd: dir,
      args: [
        "--root",
        "assets/images",
        "--max-width",
        "1600",
        "--file-list",
        fileListPath,
        "--verbose",
      ],
      env,
    });

    assert.equal(result.code, 0, result.stderr);
    const inListStat = await fs.stat(inList);
    const notListedStat = await fs.stat(notListed);
    assert.ok(inListStat.size < 2000);
    assert.equal(notListedStat.size, 2000);
    assert.match(result.stdout, /Optimized .*in_list_w2000\.jpg/);
  });
});
