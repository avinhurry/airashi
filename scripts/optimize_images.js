#!/usr/bin/env node
"use strict";

const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");

const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const options = {
  root: "assets/images",
  maxWidth: 1600,
  jpegQuality: 82,
  pngQuality: 82,
  webpQuality: 82,
  ignore: [],
  files: [],
  fileList: null,
  dryRun: false,
  verbose: false,
};

function parseNumber(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
  return parsed;
}

function parseArgs(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") {
      options.root = argv[++i];
      continue;
    }
    if (arg === "--max-width") {
      options.maxWidth = parseNumber(argv[++i], "max width");
      continue;
    }
    if (arg === "--jpeg-quality") {
      options.jpegQuality = parseNumber(argv[++i], "jpeg quality");
      continue;
    }
    if (arg === "--png-quality") {
      options.pngQuality = parseNumber(argv[++i], "png quality");
      continue;
    }
    if (arg === "--webp-quality") {
      options.webpQuality = parseNumber(argv[++i], "webp quality");
      continue;
    }
    if (arg === "--ignore") {
      options.ignore.push(argv[++i]);
      continue;
    }
    if (arg === "--file") {
      options.files.push(argv[++i]);
      continue;
    }
    if (arg === "--file-list") {
      options.fileList = argv[++i];
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--verbose") {
      options.verbose = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
}

function log(message) {
  if (options.verbose) {
    process.stdout.write(`${message}\n`);
  }
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function isIgnored(target, ignorePaths) {
  return ignorePaths.some((ignored) => target === ignored || target.startsWith(`${ignored}${path.sep}`));
}

function isSupportedImage(filePath) {
  return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function isUnderRoot(filePath, root) {
  return filePath === root || filePath.startsWith(`${root}${path.sep}`);
}

async function loadFileList(fileListPath) {
  const buffer = await fs.readFile(fileListPath);
  const text = buffer.toString("utf8");
  if (buffer.includes(0)) {
    return text.split("\0").filter(Boolean);
  }
  return text.split(/\r?\n/).filter(Boolean);
}

async function resolveProvidedFiles(root) {
  const hasProvidedList = options.fileList || options.files.length > 0;
  if (!hasProvidedList) {
    return null;
  }

  const provided = new Set();
  if (options.fileList) {
    const listPath = path.resolve(options.fileList);
    if (!(await pathExists(listPath))) {
      throw new Error(`File list not found: ${listPath}`);
    }
    const entries = await loadFileList(listPath);
    for (const entry of entries) {
      provided.add(entry);
    }
  }

  for (const entry of options.files) {
    if (entry) {
      provided.add(entry);
    }
  }

  const files = [];
  for (const entry of provided) {
    const resolved = path.resolve(entry);
    if (!isUnderRoot(resolved, root)) {
      continue;
    }
    if (!isSupportedImage(resolved)) {
      continue;
    }
    if (!(await pathExists(resolved))) {
      continue;
    }
    files.push(resolved);
  }
  return files;
}

async function walk(dir, ignorePaths, files) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (isIgnored(fullPath, ignorePaths)) {
      continue;
    }
    if (entry.isDirectory()) {
      await walk(fullPath, ignorePaths, files);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (SUPPORTED_EXTENSIONS.has(ext)) {
      files.push(fullPath);
    }
  }
}

async function optimizeFile(filePath, ignorePaths) {
  if (isIgnored(filePath, ignorePaths)) {
    return { status: "ignored" };
  }

  const ext = path.extname(filePath).toLowerCase();
  const input = sharp(filePath, { failOnError: false }).rotate();
  const metadata = await input.metadata();
  const shouldResize = options.maxWidth && metadata.width && metadata.width > options.maxWidth;
  let pipeline = input;
  if (shouldResize) {
    pipeline = pipeline.resize({ width: options.maxWidth, withoutEnlargement: true });
  }

  if (ext === ".jpg" || ext === ".jpeg") {
    pipeline = pipeline.jpeg({
      quality: options.jpegQuality,
      progressive: true,
      mozjpeg: true,
    });
  } else if (ext === ".png") {
    pipeline = pipeline.png({
      quality: options.pngQuality,
      compressionLevel: 9,
      adaptiveFiltering: true,
      palette: true,
    });
  } else if (ext === ".webp") {
    pipeline = pipeline.webp({
      quality: options.webpQuality,
    });
  }

  const outputBuffer = await pipeline.toBuffer();
  const originalSize = (await fs.stat(filePath)).size;
  const shouldWrite = shouldResize || outputBuffer.length < originalSize;
  if (!shouldWrite) {
    return { status: "skipped" };
  }

  if (!options.dryRun) {
    await fs.writeFile(filePath, outputBuffer);
  }
  return { status: "optimized", originalSize, newSize: outputBuffer.length };
}

async function main() {
  parseArgs(process.argv.slice(2));
  const root = path.resolve(options.root);
  const ignorePaths = options.ignore.map((entry) => path.resolve(entry));

  if (!(await pathExists(root))) {
    process.stdout.write(`Images root not found: ${root}\n`);
    return;
  }

  const providedFiles = await resolveProvidedFiles(root);
  const files = [];
  if (providedFiles === null) {
    await walk(root, ignorePaths, files);
  } else {
    files.push(...providedFiles);
  }
  if (files.length === 0) {
    process.stdout.write("No images found to optimize.\n");
    return;
  }

  let optimized = 0;
  let skipped = 0;
  let ignored = 0;

  for (const filePath of files) {
    try {
      const result = await optimizeFile(filePath, ignorePaths);
      if (result.status === "optimized") {
        optimized += 1;
        log(`Optimized ${filePath}`);
      } else if (result.status === "ignored") {
        ignored += 1;
      } else {
        skipped += 1;
        log(`Skipped ${filePath}`);
      }
    } catch (error) {
      process.stdout.write(`Failed to optimize ${filePath}: ${error.message}\n`);
    }
  }

  process.stdout.write(`Optimized ${optimized} file(s); skipped ${skipped}; ignored ${ignored}.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
