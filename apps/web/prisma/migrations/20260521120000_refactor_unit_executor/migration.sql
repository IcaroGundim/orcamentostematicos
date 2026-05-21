-- Reformulação: dropa ExecutingEntity e simplifica UnitExecutor para
-- referenciar diretamente (executorOrgCode, executorUnitCode?). Remove
-- User.executorCode (escopo do usuário volta a usar organizationCode + unitCode).

-- 1) Adicionar novas colunas em UnitExecutor (nullable temporariamente para popular)
ALTER TABLE "UnitExecutor" ADD COLUMN "executorOrgCode" TEXT;
ALTER TABLE "UnitExecutor" ADD COLUMN "executorUnitCode" TEXT;

-- 2) Popular: default = a própria secretaria pai executa (executorUnitCode IS NULL).
UPDATE "UnitExecutor" SET "executorOrgCode" = "organizationCode" WHERE "executorOrgCode" IS NULL;

-- 3) Tornar executorOrgCode NOT NULL.
ALTER TABLE "UnitExecutor" ALTER COLUMN "executorOrgCode" SET NOT NULL;

-- 4) Drop FK e coluna executorCode em UnitExecutor.
ALTER TABLE "UnitExecutor" DROP CONSTRAINT IF EXISTS "UnitExecutor_executorCode_fkey";
DROP INDEX IF EXISTS "UnitExecutor_executorCode_idx";
ALTER TABLE "UnitExecutor" DROP COLUMN "executorCode";

-- 5) Criar novo índice.
CREATE INDEX "UnitExecutor_executorOrgCode_executorUnitCode_idx"
  ON "UnitExecutor"("executorOrgCode", "executorUnitCode");

-- 6) Drop FK, índice e coluna executorCode em User.
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_executorCode_fkey";
DROP INDEX IF EXISTS "User_executorCode_idx";
ALTER TABLE "User" DROP COLUMN "executorCode";

-- 7) Drop ExecutingEntity e enum ExecutorType.
DROP TABLE IF EXISTS "ExecutingEntity";
DROP TYPE IF EXISTS "ExecutorType";
