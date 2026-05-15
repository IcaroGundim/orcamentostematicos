-- CreateTable
CREATE TABLE "ImportPreview" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportPreview_pkey" PRIMARY KEY ("id")
);
