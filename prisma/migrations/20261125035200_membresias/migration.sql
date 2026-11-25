-- Roles por edificio (decisión 86): el rol de gestión pasa a una membresía por edificio.

CREATE TABLE "membresia" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "edificioId" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "membresia_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "membresia_edificioId_rol_idx" ON "membresia"("edificioId", "rol");
CREATE UNIQUE INDEX "membresia_userId_edificioId_key" ON "membresia"("userId", "edificioId");
ALTER TABLE "membresia" ADD CONSTRAINT "membresia_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "membresia" ADD CONSTRAINT "membresia_edificioId_fkey" FOREIGN KEY ("edificioId") REFERENCES "edificio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Administración, Comisión y Portería actuales quedan en el edificio principal.
INSERT INTO "membresia" ("id", "userId", "edificioId", "rol")
SELECT 'mem-' || "id", "id", 'edificio-principal', "rol"
FROM "user"
WHERE "rol" <> 'UNIDAD';

ALTER TABLE "user" DROP COLUMN "rol",
ADD COLUMN "duenoSistema" BOOLEAN NOT NULL DEFAULT false;
