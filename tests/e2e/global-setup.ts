import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import "dotenv/config";

export default function globalSetup() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("Falta DATABASE_URL_TEST en .env");
  if (url === process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL_TEST no puede ser la misma base que DATABASE_URL");
  }
  const env = { ...process.env, DATABASE_URL: url };
  execSync("npx prisma migrate deploy", { env, stdio: "inherit" });
  execSync("npx tsx prisma/seed.ts", { env, stdio: "inherit" });
  rmSync("storage/mails-e2e", { recursive: true, force: true });
}
