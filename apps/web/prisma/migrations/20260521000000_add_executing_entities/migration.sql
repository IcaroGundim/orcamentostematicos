-- CreateEnum
CREATE TYPE "ExecutorType" AS ENUM ('SECRETARIA_DIRETA', 'AUTARQUIA', 'FUNDACAO', 'EMPRESA_PUBLICA', 'SOCIEDADE_ECONOMIA_MISTA', 'OUTRO');

-- CreateTable
CREATE TABLE "ExecutingEntity" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ExecutorType" NOT NULL DEFAULT 'SECRETARIA_DIRETA',
    "hostOrganizationCode" TEXT,
    "hostUnitCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutingEntity_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "UnitExecutor" (
    "organizationCode" TEXT NOT NULL,
    "unitCode" TEXT NOT NULL,
    "executorCode" TEXT NOT NULL,

    CONSTRAINT "UnitExecutor_pkey" PRIMARY KEY ("organizationCode", "unitCode")
);

-- CreateIndex
CREATE INDEX "UnitExecutor_executorCode_idx" ON "UnitExecutor"("executorCode");

-- AddForeignKey
ALTER TABLE "UnitExecutor" ADD CONSTRAINT "UnitExecutor_executorCode_fkey" FOREIGN KEY ("executorCode") REFERENCES "ExecutingEntity"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: add executorCode to User
ALTER TABLE "User" ADD COLUMN "executorCode" TEXT;

-- CreateIndex
CREATE INDEX "User_executorCode_idx" ON "User"("executorCode");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_executorCode_fkey" FOREIGN KEY ("executorCode") REFERENCES "ExecutingEntity"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Bootstrap de dados ──────────────────────────────────────────────────────
-- 1) Cria um ExecutingEntity (tipo SECRETARIA_DIRETA) para cada organizationCode
--    presente em BudgetAction. O nome usa o organizationName mais recente.
INSERT INTO "ExecutingEntity" ("code", "name", "type", "createdAt")
SELECT DISTINCT ON ("organizationCode")
    "organizationCode",
    "organizationName",
    'SECRETARIA_DIRETA'::"ExecutorType",
    CURRENT_TIMESTAMP
FROM "BudgetAction"
ORDER BY "organizationCode", "id" DESC
ON CONFLICT ("code") DO NOTHING;

-- 2) Cria mapeamento default (cada unidade -> sua própria secretaria pai) para
--    todos os pares (organizationCode, unitCode) presentes em BudgetAction.
INSERT INTO "UnitExecutor" ("organizationCode", "unitCode", "executorCode")
SELECT DISTINCT "organizationCode", "unitCode", "organizationCode"
FROM "BudgetAction"
ON CONFLICT ("organizationCode", "unitCode") DO NOTHING;

-- 3) Migra usuários: User.organizationCode -> User.executorCode (quando existir
--    ExecutingEntity correspondente). SEPLAN_ADMIN permanece com NULL.
UPDATE "User" u
SET "executorCode" = u."organizationCode"
WHERE u."organizationCode" IS NOT NULL
  AND u."executorCode" IS NULL
  AND EXISTS (SELECT 1 FROM "ExecutingEntity" e WHERE e."code" = u."organizationCode");
