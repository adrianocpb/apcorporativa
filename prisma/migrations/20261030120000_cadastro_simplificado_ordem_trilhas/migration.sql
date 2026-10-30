-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Track" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverFileId" TEXT,
    "categoryId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "sequential" BOOLEAN NOT NULL DEFAULT true,
    "isOnboarding" BOOLEAN NOT NULL DEFAULT false,
    "videoThresholdPct" INTEGER NOT NULL DEFAULT 90,
    "minReadSeconds" INTEGER NOT NULL DEFAULT 30,
    "createdById" TEXT,
    "publishedAt" DATETIME,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Track_coverFileId_fkey" FOREIGN KEY ("coverFileId") REFERENCES "StoredFile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Track_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Track_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Track" ("archivedAt", "categoryId", "coverFileId", "createdAt", "createdById", "description", "id", "isOnboarding", "minReadSeconds", "publishedAt", "sequential", "status", "title", "updatedAt", "videoThresholdPct") SELECT "archivedAt", "categoryId", "coverFileId", "createdAt", "createdById", "description", "id", "isOnboarding", "minReadSeconds", "publishedAt", "sequential", "status", "title", "updatedAt", "videoThresholdPct" FROM "Track";
DROP TABLE "Track";
ALTER TABLE "new_Track" RENAME TO "Track";
CREATE INDEX "Track_status_idx" ON "Track"("status");
CREATE INDEX "Track_displayOrder_idx" ON "Track"("displayOrder");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "department" TEXT,
    "hireDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "passwordHash" TEXT,
    "roleId" TEXT NOT NULL,
    "lastLoginAt" DATETIME,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "User_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "createdById", "department", "email", "hireDate", "id", "lastLoginAt", "name", "passwordHash", "roleId", "status", "updatedAt") SELECT "createdAt", "createdById", "department", "email", "hireDate", "id", "lastLoginAt", "name", "passwordHash", "roleId", "status", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_status_idx" ON "User"("status");
CREATE INDEX "User_department_idx" ON "User"("department");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


-- Ordem inicial das trilhas: onboarding primeiro, depois por data de criação.
UPDATE "Track" SET "displayOrder" = (
    SELECT COUNT(*) FROM "Track" t2
    WHERE (t2."isOnboarding" > "Track"."isOnboarding")
       OR (t2."isOnboarding" = "Track"."isOnboarding" AND t2."createdAt" < "Track"."createdAt")
);
