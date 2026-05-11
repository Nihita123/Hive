const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function hasGeneratedClient(cwd) {
  return fs.existsSync(path.join(cwd, "node_modules", "@prisma", "client", "index.d.ts"));
}

function runGenerate(cwd) {
  return spawnSync("npx", ["prisma", "generate"], {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

const cwd = process.cwd();

// Retry a few times for transient DLL locks.
for (let i = 0; i < 3; i += 1) {
  const result = runGenerate(cwd);
  if (result.status === 0) process.exit(0);

  // If Prisma engine is locked on Windows, but client already exists, don't block dev/start.
  if (process.platform === "win32" && hasGeneratedClient(cwd)) {
    console.warn(
      "\n[warn] Prisma generate failed (likely DLL lock), but Prisma Client already exists. Continuing.\n",
    );
    process.exit(0);
  }

  sleep(750);
}

process.exit(1);

