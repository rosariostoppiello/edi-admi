import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // Las migraciones usan la conexión directa si existe (en Neon, DATABASE_URL es la del
  // pooler y DIRECT_URL la directa); la app usa siempre DATABASE_URL.
  datasource: {
    url: process.env.DIRECT_URL || env("DATABASE_URL"),
  },
});
