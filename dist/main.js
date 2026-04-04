// This file is generated from src/main.js. Do not edit directly.
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Readable } = require("node:stream");
const { spawnSync } = require("node:child_process");

const OWNER = "gripmock";
const REPO = "grpctestify-rust";
const GITHUB_TOKEN_EXPR_RE = /^\$\{\{\s*github\.token\s*\}\}$/i;

function input(name, fallback = "") {
  const key = `INPUT_${name.replace(/ /g, "_").toUpperCase()}`;
  const value = process.env[key];
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return value;
}

function boolInput(name, fallback) {
  const value = input(name, "").trim().toLowerCase();
  if (value === "") {
    return fallback;
  }
  return ["1", "true", "yes", "y", "on"].includes(value);
}

function listInput(name) {
  return input(name, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function ensureSupportedCommand(command) {
  const normalized = String(command || "").trim();
  if (["run", "check", "fmt"].includes(normalized)) {
    return normalized;
  }
  throw new Error(`Unsupported command: ${command}. Allowed values: run, check, fmt`);
}

function log(message) {
  console.log(`[grpctestify-action] ${message}`);
}

function warn(message) {
  console.log(`::warning::${escapeCommand(message)}`);
}

function error(message) {
  console.log(`::error::${escapeCommand(message)}`);
}

function escapeCommand(value) {
  return String(value)
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A");
}

function appendFileLine(file, line) {
  if (!file) {
    return;
  }
  fs.appendFileSync(file, `${line}\n`, { encoding: "utf8" });
}

function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) {
    return;
  }
  appendFileLine(outputFile, `${name}=${String(value)}`);
}

function addPath(dir) {
  const pathFile = process.env.GITHUB_PATH;
  if (!pathFile) {
    return;
  }
  appendFileLine(pathFile, dir);
}

function mapPlatform() {
  const p = process.platform;
  if (p === "linux") {
    return "linux";
  }
  if (p === "darwin") {
    return "macos";
  }
  if (p === "win32") {
    return "windows";
  }
  throw new Error(`Unsupported platform: ${p}`);
}

function mapArch() {
  const a = process.arch;
  if (a === "x64") {
    return "amd64";
  }
  if (a === "arm64") {
    return "arm64";
  }
  throw new Error(`Unsupported architecture: ${a}`);
}

async function fetchJson(url, token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "grpctestify-action",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status} for ${url}: ${body.slice(0, 400)}`);
  }
  return res.json();
}

async function resolveLatestTagViaRedirect() {
  const latestUrl = `https://github.com/${OWNER}/${REPO}/releases/latest`;
  const res = await fetch(latestUrl, {
    method: "GET",
    redirect: "manual",
    headers: { "User-Agent": "grpctestify-action" },
  });

  const location = res.headers.get("location") || "";
  const match = location.match(/\/releases\/tag\/(v[^/?#]+)/i);
  if (!match) {
    return "";
  }

  return match[1].trim();
}

async function downloadFile(url, destination, token) {
  const headers = { "User-Agent": "grpctestify-action" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, { headers, redirect: "follow" });
  if (!res.ok || !res.body) {
    const body = await res.text();
    throw new Error(`Failed downloading ${url}: HTTP ${res.status} ${body.slice(0, 300)}`);
  }

  await fs.promises.mkdir(path.dirname(destination), { recursive: true });

  await new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(destination);
    const body = Readable.fromWeb(res.body);
    body.on("error", reject);
    stream.on("error", reject);
    stream.on("finish", resolve);
    body.pipe(stream);
  });
}

function sanitizeVersion(version) {
  const v = String(version || "").trim();
  if (!v || !/^[0-9A-Za-z._-]+$/.test(v)) {
    throw new Error(`Invalid version string: "${v}"`);
  }
  return v;
}

async function resolveVersion(versionInput, token) {
  const normalized = String(versionInput || "latest").trim();
  if (normalized === "" || normalized.toLowerCase() === "latest") {
    const redirectTag = await resolveLatestTagViaRedirect();
    if (redirectTag) {
      return redirectTag.replace(/^v/, "");
    }

    if (!token) {
      throw new Error(
        "Could not resolve latest version via redirect and no github-token provided. Pass a pinned version (recommended) or set github-token: ${{ github.token }}",
      );
    }

    warn("Could not resolve latest version via redirect, falling back to authenticated GitHub API");
    const release = await fetchJson(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, token);
    const tag = String(release.tag_name || "").trim();
    if (!tag) {
      throw new Error("Could not resolve latest release tag");
    }
    return sanitizeVersion(tag.replace(/^v/, ""));
  }
  return sanitizeVersion(normalized.replace(/^v/, ""));
}

function extractArchive(archivePath, destination) {
  fs.mkdirSync(destination, { recursive: true });

  if (process.platform === "win32") {
    const result = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Expand-Archive -Path '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destination.replace(/'/g, "''")}' -Force`,
      ],
      { stdio: "inherit" },
    );
    if (result.status !== 0) {
      throw new Error("Failed to extract archive with PowerShell");
    }
    return;
  }

  const result = spawnSync("tar", ["-xzf", archivePath, "-C", destination], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error("Failed to extract archive with tar");
  }
}

function ensureExecutable(filePath) {
  if (process.platform === "win32") {
    return;
  }
  fs.chmodSync(filePath, 0o755);
}

function resolveToken() {
  const rawInput = input("github-token", "").trim();
  if (rawInput && !GITHUB_TOKEN_EXPR_RE.test(rawInput)) {
    return rawInput;
  }

  const envToken = String(process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "").trim();
  if (envToken) {
    return envToken;
  }

  if (rawInput && GITHUB_TOKEN_EXPR_RE.test(rawInput)) {
    warn("Input github-token looks like an unevaluated expression; pass with: github-token: ${{ github.token }}");
  }

  return "";
}

function resolveAssetFileName(version) {
  const platform = mapPlatform();
  const arch = mapArch();

  const matrix = {
    "linux-amd64": `grpctestify-linux-amd64.tar.gz`,
    "linux-arm64": `grpctestify-linux-arm64.tar.gz`,
    "macos-amd64": `grpctestify-macos-amd64.tar.gz`,
    "macos-arm64": `grpctestify-macos-arm64.tar.gz`,
    "windows-amd64": `grpctestify-windows-amd64.zip`,
    "windows-arm64": `grpctestify-windows-arm64.zip`,
  };

  const key = `${platform}-${arch}`;
  const fileName = matrix[key];
  if (!fileName) {
    throw new Error(`No release asset for platform=${platform}, arch=${arch}, version=${version}`);
  }

  return fileName;
}

async function ensureBinary(version, token) {
  const platform = mapPlatform();
  const arch = mapArch();
  const fileName = resolveAssetFileName(version);

  const runnerTemp = process.env.RUNNER_TEMP || os.tmpdir();
  const installDir = path.join(runnerTemp, "grpctestify-action", version, `${platform}-${arch}`);
  const binName = process.platform === "win32" ? "grpctestify.exe" : "grpctestify";
  const binPath = path.join(installDir, binName);

  if (fs.existsSync(binPath)) {
    ensureExecutable(binPath);
    return binPath;
  }

  await fs.promises.mkdir(installDir, { recursive: true });

  const archivePath = path.join(installDir, fileName);
  const extractDir = path.join(installDir, "extract");
  const downloadURL = `https://github.com/${OWNER}/${REPO}/releases/download/v${version}/${fileName}`;
  log(`Downloading ${downloadURL}`);
  await downloadFile(downloadURL, archivePath, token);

  extractArchive(archivePath, extractDir);

  const extractedBinary = path.join(extractDir, binName);
  if (!fs.existsSync(extractedBinary)) {
    throw new Error(`Extracted binary not found: ${extractedBinary}`);
  }

  fs.copyFileSync(extractedBinary, binPath);
  ensureExecutable(binPath);
  return binPath;
}

function buildArgs({ command, pathInput, paths }) {
  const args = [];

  if (command) {
    args.push(command);
  }

  if (pathInput) {
    args.push(pathInput);
  }

  for (const p of paths) {
    args.push(p);
  }

  if (args.length === 1 && command === "run") {
    args.push(".");
  }

  if (args.length === 1 && (command === "check" || command === "fmt")) {
    throw new Error(`command=${command} requires at least one path via 'path' or 'paths' input`);
  }

  return args;
}

function quoteArg(arg) {
  if (/^[A-Za-z0-9_./:-]+$/.test(arg)) {
    return arg;
  }
  return JSON.stringify(arg);
}

async function run() {
  const versionInput = input("version", "latest");
  const token = resolveToken();

  const command = ensureSupportedCommand(input("command", "run"));
  const pathInput = input("path", "").trim();
  const paths = listInput("paths");
  const installOnly = boolInput("install-only", false);

  const version = await resolveVersion(versionInput, token);
  log(`Using grpctestify version ${version}`);

  const binPath = await ensureBinary(version, token);
  addPath(path.dirname(binPath));

  setOutput("version", version);
  setOutput("binary-path", binPath);

  if (installOnly) {
    setOutput("command-line", "");
    setOutput("exit-code", 0);
    log("install-only=true, skipping command execution");
    return;
  }

  const args = buildArgs({ command, pathInput, paths });
  const commandLine = [binPath, ...args].map(quoteArg).join(" ");
  log(`Running: ${commandLine}`);

  setOutput("command-line", args.map(quoteArg).join(" "));

  const result = spawnSync(binPath, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  const exitCode = Number.isInteger(result.status) ? result.status : 1;
  setOutput("exit-code", exitCode);

  if (exitCode !== 0) {
    throw new Error(`grpctestify exited with code ${exitCode}`);
  }
}

run().catch((err) => {
  const message = err && err.stack ? err.stack : String(err);
  error(message);
  process.exitCode = 1;
});
