-- CreateEnum
CREATE TYPE "GovernmentEntityType" AS ENUM ('SECRETARIA', 'AUTARQUIA', 'FUNDACAO', 'EMPRESA_PUBLICA', 'FUNDO', 'OUTRO');

-- CreateTable
CREATE TABLE "GovernmentOrganization" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "GovernmentEntityType" NOT NULL DEFAULT 'SECRETARIA',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernmentOrganization_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "GovernmentUnit" (
    "organizationCode" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernmentUnit_pkey" PRIMARY KEY ("organizationCode","code")
);

-- CreateIndex
CREATE INDEX "GovernmentUnit_organizationCode_idx" ON "GovernmentUnit"("organizationCode");

-- AddForeignKey
ALTER TABLE "GovernmentUnit" ADD CONSTRAINT "GovernmentUnit_organizationCode_fkey" FOREIGN KEY ("organizationCode") REFERENCES "GovernmentOrganization"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bootstrap órgãos a partir dos pares distintos em BudgetAction
INSERT INTO "GovernmentOrganization" ("code", "name", "type", "active", "createdAt", "updatedAt")
SELECT DISTINCT ON ("organizationCode")
    "organizationCode",
    "organizationName",
    'SECRETARIA'::"GovernmentEntityType",
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "BudgetAction"
ORDER BY "organizationCode", "id" DESC
ON CONFLICT ("code") DO NOTHING;

-- Bootstrap unidades (preserva UnitExecutor existente — sem alteração nessa tabela)
INSERT INTO "GovernmentUnit" ("organizationCode", "code", "name", "active", "createdAt", "updatedAt")
SELECT DISTINCT ON ("organizationCode", "unitCode")
    "organizationCode",
    "unitCode",
    "unitName",
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "BudgetAction"
ORDER BY "organizationCode", "unitCode", "id" DESC
ON CONFLICT ("organizationCode", "code") DO NOTHING;
