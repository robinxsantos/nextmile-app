import "dotenv/config";
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error("❌ Missing MONGODB_URI in .env");
  process.exit(1);
}

const backupDir = resolve(process.cwd(), "../backups");
mkdirSync(backupDir, { recursive: true });

const now = new Date();

const pad = (value) => String(value).padStart(2, "0");

const timestamp =
  [now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate())].join("-") +
  "-" +
  pad(now.getHours()) +
  pad(now.getMinutes());

const outputFile = resolve(backupDir, `nextmile-${timestamp}.gz`);

console.log("⏳ Backing up NEXTMILE database...");

const result = spawnSync(
  "mongodump",
  [`--uri=${mongoUri}`, `--archive=${outputFile}`, "--gzip"],
  {
    stdio: "inherit",
  },
);

if (result.error) {
  console.error("❌ Failed to start mongodump:");
  console.error(result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  console.error("❌ Database backup failed");
  process.exit(result.status ?? 1);
}

console.log("");
console.log("✅ Database backup complete!");
console.log(`📦 ${outputFile}`);
