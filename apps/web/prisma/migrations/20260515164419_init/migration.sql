-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SEPLAN_ADMIN', 'SECRETARIA_REPRESENTANTE');

-- CreateEnum
CREATE TYPE "ThemeBudget" AS ENUM ('OCAD', 'OSG', 'CLIMATICO');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('RASCUNHO', 'PRONTO_PARA_VALIDACAO', 'ARQUIVADO');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('RASCUNHO', 'ENVIADO', 'DEVOLVIDO', 'APROVADO');

-- CreateEnum
CREATE TYPE "QddPeriodType" AS ENUM ('MES_ISOLADO', 'ACUMULADO_ANUAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "organizationCode" TEXT,
    "unitCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "BudgetImport" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "referenceMonth" INTEGER NOT NULL,
    "periodType" "QddPeriodType" NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rowCount" INTEGER NOT NULL,
    "actionCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'VIGENTE',

    CONSTRAINT "BudgetImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetAction" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "organizationCode" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "unitCode" TEXT NOT NULL,
    "unitName" TEXT NOT NULL,
    "application" TEXT NOT NULL,
    "functionalProgram" TEXT NOT NULL,
    "projectActivity" TEXT NOT NULL,
    "initialBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "supplemented" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "committed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "liquidated" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "available" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "BudgetAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseLine" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "organizationCode" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "unitCode" TEXT NOT NULL,
    "unitName" TEXT NOT NULL,
    "application" TEXT NOT NULL,
    "functionalProgram" TEXT NOT NULL,
    "projectActivity" TEXT NOT NULL,
    "expenseAccount" TEXT NOT NULL,
    "expenseDescription" TEXT NOT NULL,
    "reduced" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "initialBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "supplemented" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "committed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "liquidated" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payableToLiquidate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payable" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "available" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "ExpenseLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThematicAssignment" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "theme" "ThemeBudget" NOT NULL,
    "axis" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "weightingFactor" DOUBLE PRECISION,
    "justification" TEXT,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PRONTO_PARA_VALIDACAO',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThematicAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationCycle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "theme" "ThemeBudget" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "ValidationCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionValidation" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "organizationCode" TEXT NOT NULL,
    "unitCode" TEXT NOT NULL,
    "theme" "ThemeBudget" NOT NULL,
    "status" "ValidationStatus" NOT NULL DEFAULT 'RASCUNHO',
    "executionStatus" TEXT,
    "realizedDescription" TEXT,
    "informedExecutedValue" DOUBLE PRECISION,
    "observations" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewerComment" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deliveries" JSONB NOT NULL DEFAULT '[]',
    "evidences" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "ActionValidation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "BudgetAction_importId_idx" ON "BudgetAction"("importId");

-- CreateIndex
CREATE INDEX "BudgetAction_organizationCode_idx" ON "BudgetAction"("organizationCode");

-- CreateIndex
CREATE INDEX "ExpenseLine_actionId_idx" ON "ExpenseLine"("actionId");

-- CreateIndex
CREATE INDEX "ThematicAssignment_actionId_idx" ON "ThematicAssignment"("actionId");

-- CreateIndex
CREATE INDEX "ActionValidation_cycleId_idx" ON "ActionValidation"("cycleId");

-- CreateIndex
CREATE INDEX "ActionValidation_organizationCode_idx" ON "ActionValidation"("organizationCode");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetAction" ADD CONSTRAINT "BudgetAction_importId_fkey" FOREIGN KEY ("importId") REFERENCES "BudgetImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseLine" ADD CONSTRAINT "ExpenseLine_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "BudgetAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThematicAssignment" ADD CONSTRAINT "ThematicAssignment_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "BudgetAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThematicAssignment" ADD CONSTRAINT "ThematicAssignment_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionValidation" ADD CONSTRAINT "ActionValidation_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ValidationCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionValidation" ADD CONSTRAINT "ActionValidation_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "BudgetAction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionValidation" ADD CONSTRAINT "ActionValidation_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ThematicAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
