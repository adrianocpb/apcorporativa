-- AlterTable
ALTER TABLE "StoredFile" ADD COLUMN "durationSeconds" REAL;

-- CreateTable
CREATE TABLE "Track" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverFileId" TEXT,
    "categoryId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
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

-- CreateTable
CREATE TABLE "TrackModule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrackModule_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrackItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "moduleId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "completionRule" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackItem_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "TrackModule" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrackItem_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrackAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "userId" TEXT,
    "groupId" TEXT,
    "assignedById" TEXT,
    "dueDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackAssignment_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrackAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrackAssignment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrackAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "lastItemId" TEXT,
    "lastActivityAt" DATETIME,
    "removedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Enrollment_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContentProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "contentVersionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "positionSeconds" REAL NOT NULL DEFAULT 0,
    "durationSeconds" REAL,
    "watchedRanges" JSONB,
    "watchedSeconds" REAL NOT NULL DEFAULT 0,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHeartbeatAt" DATETIME,
    "lastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "ContentProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContentProgress_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContentProgress_contentVersionId_fkey" FOREIGN KEY ("contentVersionId") REFERENCES "ContentVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompletionRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "contentVersionId" TEXT NOT NULL,
    "trackId" TEXT,
    "method" TEXT NOT NULL,
    "evidence" JSONB,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompletionRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompletionRecord_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompletionRecord_contentVersionId_fkey" FOREIGN KEY ("contentVersionId") REFERENCES "ContentVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompletionRecord_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Track_status_idx" ON "Track"("status");

-- CreateIndex
CREATE INDEX "TrackModule_trackId_position_idx" ON "TrackModule"("trackId", "position");

-- CreateIndex
CREATE INDEX "TrackItem_moduleId_position_idx" ON "TrackItem"("moduleId", "position");

-- CreateIndex
CREATE INDEX "TrackItem_contentId_idx" ON "TrackItem"("contentId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackAssignment_trackId_userId_key" ON "TrackAssignment"("trackId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackAssignment_trackId_groupId_key" ON "TrackAssignment"("trackId", "groupId");

-- CreateIndex
CREATE INDEX "Enrollment_userId_idx" ON "Enrollment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_trackId_userId_key" ON "Enrollment"("trackId", "userId");

-- CreateIndex
CREATE INDEX "ContentProgress_userId_contentId_idx" ON "ContentProgress"("userId", "contentId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentProgress_userId_contentVersionId_key" ON "ContentProgress"("userId", "contentVersionId");

-- CreateIndex
CREATE INDEX "CompletionRecord_userId_contentId_idx" ON "CompletionRecord"("userId", "contentId");

-- CreateIndex
CREATE UNIQUE INDEX "CompletionRecord_userId_contentVersionId_key" ON "CompletionRecord"("userId", "contentVersionId");
