/**
 * OISM.institute — 24/7 Local Laptop Origin & Cloudflare Tunnel Supervisor
 * Mirrors the battle-tested supervisor pattern from `love`:
 * Launches `server.js` on port 3848 + `cloudflared` tunnel (`config.yml`).
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const PORT = process.env.PORT || 3848;
const LOG_FILE = path.join(__dirname, "supervisor.log");

function log(msg) {
  const line = `[${new Date().toISOString()}] [OISM-Supervisor] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + "\n", "utf8");
  } catch (e) {}
}

let serverProcess = null;
let tunnelProcess = null;
let isShuttingDown = false;

function startServer() {
  if (isShuttingDown) return;
  log(`Starting OISM Sovereign Origin Server (server.js) on port ${PORT}...`);

  serverProcess = spawn(process.execPath, ["server.js"], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"]
  });

  serverProcess.stdout.on("data", (d) => log(`[Server] ${d.toString().trim()}`));
  serverProcess.stderr.on("data", (d) => log(`[Server ERR] ${d.toString().trim()}`));

  serverProcess.on("exit", (code) => {
    log(`Server exited (code=${code}). Restarting in 2s...`);
    serverProcess = null;
    if (!isShuttingDown) setTimeout(startServer, 2000);
  });
}

function findCloudflared() {
  const localBin = path.join(__dirname, "cloudflared.exe");
  if (fs.existsSync(localBin)) return localBin;
  const loveBin = path.join(__dirname, "..", "love", "cloudflared.exe");
  if (fs.existsSync(loveBin)) return loveBin;
  return null;
}

function startTunnel() {
  if (isShuttingDown) return;
  const bin = findCloudflared();
  if (!bin) {
    log("cloudflared.exe not found; running local origin server only.");
    return;
  }

  const configPath = path.join(__dirname, "config.yml");
  const args = fs.existsSync(configPath)
    ? ["tunnel", "--config", configPath, "run", "--protocol", "http2"]
    : ["tunnel", "--url", `http://127.0.0.1:${PORT}`, "--protocol", "http2"];

  log(`Starting Cloudflare Tunnel via ${bin}...`);
  tunnelProcess = spawn(bin, args, {
    cwd: __dirname,
    stdio: ["ignore", "pipe", "pipe"]
  });

  tunnelProcess.stdout.on("data", (d) => log(`[Tunnel] ${d.toString().trim()}`));
  tunnelProcess.stderr.on("data", (d) => log(`[Tunnel] ${d.toString().trim()}`));

  tunnelProcess.on("exit", (code) => {
    log(`Tunnel exited (code=${code}). Restarting in 5s...`);
    tunnelProcess = null;
    if (!isShuttingDown) setTimeout(startTunnel, 5000);
  });
}

function shutdown() {
  isShuttingDown = true;
  if (serverProcess) serverProcess.kill("SIGTERM");
  if (tunnelProcess) tunnelProcess.kill("SIGTERM");
  setTimeout(() => process.exit(0), 800);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startServer();
startTunnel();
