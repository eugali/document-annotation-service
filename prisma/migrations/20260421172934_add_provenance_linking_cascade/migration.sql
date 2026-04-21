-- AlterTable
ALTER TABLE "FactType" ADD COLUMN "entityLinkHint" TEXT;

-- CreateTable
CREATE TABLE "EntitySource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "page" INTEGER,
    "cell" TEXT,
    "chunkIndex" INTEGER NOT NULL,
    CONSTRAINT "EntitySource_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FactEntity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "factId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    CONSTRAINT "FactEntity_factId_fkey" FOREIGN KEY ("factId") REFERENCES "Fact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FactEntity_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Entity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Entity_entityTypeId_fkey" FOREIGN KEY ("entityTypeId") REFERENCES "EntityType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Entity" ("createdAt", "entityTypeId", "id", "name") SELECT "createdAt", "entityTypeId", "id", "name" FROM "Entity";
DROP TABLE "Entity";
ALTER TABLE "new_Entity" RENAME TO "Entity";
CREATE INDEX "Entity_entityTypeId_idx" ON "Entity"("entityTypeId");
CREATE UNIQUE INDEX "Entity_entityTypeId_name_key" ON "Entity"("entityTypeId", "name");
CREATE TABLE "new_Fact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "factTypeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sourceSnippet" TEXT NOT NULL DEFAULT '',
    "sourcePage" INTEGER,
    "sourceCell" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Fact_factTypeId_fkey" FOREIGN KEY ("factTypeId") REFERENCES "FactType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Fact" ("createdAt", "factTypeId", "id", "value") SELECT "createdAt", "factTypeId", "id", "value" FROM "Fact";
DROP TABLE "Fact";
ALTER TABLE "new_Fact" RENAME TO "Fact";
CREATE INDEX "Fact_factTypeId_idx" ON "Fact"("factTypeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "EntitySource_entityId_idx" ON "EntitySource"("entityId");

-- CreateIndex
CREATE INDEX "FactEntity_factId_idx" ON "FactEntity"("factId");

-- CreateIndex
CREATE INDEX "FactEntity_entityId_idx" ON "FactEntity"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "FactEntity_factId_entityId_key" ON "FactEntity"("factId", "entityId");
