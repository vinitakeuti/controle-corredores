import { spawn } from "node:child_process";

function requiredProductionSecret(name) {
  const value = process.env[name]?.trim();
  if (!value || value.length < 32) {
    console.error(`[startup] ${name} must contain at least 32 characters.`);
    process.exitCode = 1;
    return false;
  }
  return true;
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error("[startup] DATABASE_URL is required.");
  process.exit(1);
}

if (process.env.NODE_ENV === "production") {
  const secretsAreValid = [
    requiredProductionSecret("SESSION_SECRET"),
    requiredProductionSecret("INTEGRATION_ENCRYPTION_KEY"),
  ].every(Boolean);
  if (!secretsAreValid) process.exit(1);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), env: process.env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) reject(new Error(`${command} terminated by ${signal}`));
      else resolve(code ?? 1);
    });
  });
}

const migrationExitCode = await run("./node_modules/.bin/prisma", ["migrate", "deploy"]);
if (migrationExitCode !== 0) {
  console.error(`[startup] Prisma migrations failed with exit code ${migrationExitCode}.`);
  process.exit(migrationExitCode);
}

const server = spawn(process.execPath, ["server.js"], {
  cwd: process.cwd(),
  env: { ...process.env, HOSTNAME: "0.0.0.0" },
  stdio: "inherit",
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => server.kill(signal));
}

server.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
