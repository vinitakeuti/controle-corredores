import { cp, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";

await mkdir(".next/standalone/.next", { recursive: true });
await cp(".next/static", ".next/standalone/.next/static", { recursive: true, force: true });
await cp("public", ".next/standalone/public", { recursive: true, force: true });

const server = spawn(process.execPath, ["server.js"], {
  cwd: ".next/standalone",
  env: process.env,
  stdio: "inherit",
});

server.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
