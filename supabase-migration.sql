-- DruckerAI — Supabase migration
-- Run this in: https://supabase.com/dashboard/project/kudqiyxxbwbmwkuwvbzu/sql/new

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ContextItem
CREATE TABLE IF NOT EXISTS "ContextItem" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  value TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Collaborator
CREATE TABLE IF NOT EXISTS "Collaborator" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT,
  "relationshipType" TEXT NOT NULL,
  "importanceLevel" INTEGER NOT NULL DEFAULT 3,
  "preferredCadence" TEXT,
  notes TEXT,
  "lastContactDate" TIMESTAMPTZ,
  "nextFollowUpDate" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Task
CREATE TABLE IF NOT EXISTS "Task" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  "aiPriority" INTEGER,
  "manualPriority" INTEGER,
  "priorityLabel" TEXT,
  "priorityReason" TEXT,
  "dueDate" TIMESTAMPTZ,
  "linkedProjectId" TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completedAt" TIMESTAMPTZ
);

-- MeetingNote
CREATE TABLE IF NOT EXISTS "MeetingNote" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT,
  "rawContent" TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  "granolaId" TEXT,
  "meetingDate" TIMESTAMPTZ,
  "googleEventId" TEXT,
  "calendarEventTitle" TEXT,
  "calendarEventStartTime" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE "MeetingNote"
  ADD COLUMN IF NOT EXISTS "googleEventId" TEXT,
  ADD COLUMN IF NOT EXISTS "calendarEventTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "calendarEventStartTime" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "MeetingNote_googleEventId_idx"
  ON "MeetingNote" ("googleEventId");

-- NoteExtraction
CREATE TABLE IF NOT EXISTS "NoteExtraction" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "noteId" TEXT NOT NULL REFERENCES "MeetingNote"(id) ON DELETE CASCADE,
  "decisionsJson" TEXT NOT NULL DEFAULT '[]',
  "openQuestionsJson" TEXT NOT NULL DEFAULT '[]',
  "actionItemsJson" TEXT NOT NULL DEFAULT '[]',
  "followUpsJson" TEXT NOT NULL DEFAULT '[]',
  "insightsJson" TEXT NOT NULL DEFAULT '[]',
  "calendarUpdatesJson" TEXT NOT NULL DEFAULT '[]',
  "contextUpdatesJson" TEXT NOT NULL DEFAULT '[]',
  "taskSuggestionsJson" TEXT NOT NULL DEFAULT '[]',
  "approvedAt" TIMESTAMPTZ,
  "appliedAt" TIMESTAMPTZ,
  "extractedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CalendarEventCache
CREATE TABLE IF NOT EXISTS "CalendarEventCache" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "googleEventId" TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  "startTime" TIMESTAMPTZ NOT NULL,
  "endTime" TIMESTAMPTZ NOT NULL,
  "attendeesJson" TEXT NOT NULL DEFAULT '[]',
  "organizerEmail" TEXT,
  "scoreImportance" REAL,
  "scoreUrgency" REAL,
  "scoreContribution" REAL,
  "scoreRelationship" REAL,
  "scoreAlignment" REAL,
  "overallScore" REAL,
  "scoringRationale" TEXT,
  "primaryConcern" TEXT,
  "flagsJson" TEXT NOT NULL DEFAULT '[]',
  "proposedActionsJson" TEXT NOT NULL DEFAULT '[]',
  "taskSuggestionsJson" TEXT NOT NULL DEFAULT '[]',
  "userAction" TEXT,
  "cachedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "expiresAt" TIMESTAMPTZ NOT NULL
);

ALTER TABLE "CalendarEventCache"
  ADD COLUMN IF NOT EXISTS "taskSuggestionsJson" TEXT NOT NULL DEFAULT '[]';

-- CalendarEventNote
CREATE TABLE IF NOT EXISTS "CalendarEventNote" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "googleEventId" TEXT NOT NULL UNIQUE,
  "prepNotes" TEXT,
  "logisticsNotes" TEXT,
  "outcomeNotes" TEXT,
  "followUps" TEXT,
  usefulness TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- DailyBriefCache
CREATE TABLE IF NOT EXISTS "DailyBriefCache" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  date TEXT NOT NULL UNIQUE,
  "briefJson" TEXT NOT NULL,
  "generatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "expiresAt" TIMESTAMPTZ NOT NULL
);

-- EmailThreadCache
CREATE TABLE IF NOT EXISTS "EmailThreadCache" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "gmailThreadId" TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  "participantsJson" TEXT NOT NULL DEFAULT '[]',
  "lastMessageAt" TIMESTAMPTZ NOT NULL,
  snippet TEXT,
  summary TEXT,
  "signalsJson" TEXT NOT NULL DEFAULT '{}',
  "labelsJson" TEXT NOT NULL DEFAULT '[]',
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "syncedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- EmailSignal
CREATE TABLE IF NOT EXISTS "EmailSignal" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "threadId" TEXT NOT NULL REFERENCES "EmailThreadCache"(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  rationale TEXT,
  "dueDate" TIMESTAMPTZ,
  "collaboratorId" TEXT,
  confidence REAL,
  state TEXT NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "EmailThreadCache_lastMessageAt_idx"
  ON "EmailThreadCache" ("lastMessageAt" DESC);

CREATE INDEX IF NOT EXISTS "EmailSignal_state_createdAt_idx"
  ON "EmailSignal" (state, "createdAt" DESC);

-- CoachThread
CREATE TABLE IF NOT EXISTS "CoachThread" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CoachMessage
CREATE TABLE IF NOT EXISTS "CoachMessage" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "threadId" TEXT NOT NULL REFERENCES "CoachThread"(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "CoachMessage_threadId_createdAt_idx"
  ON "CoachMessage" ("threadId", "createdAt" ASC);

-- AgentThread
CREATE TABLE IF NOT EXISTS "AgentThread" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AgentMessage
CREATE TABLE IF NOT EXISTS "AgentMessage" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "threadId" TEXT NOT NULL REFERENCES "AgentThread"(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AgentAction
CREATE TABLE IF NOT EXISTS "AgentAction" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "threadId" TEXT NOT NULL REFERENCES "AgentThread"(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  "payloadJson" TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  "riskLevel" TEXT NOT NULL DEFAULT 'low',
  "resultJson" TEXT,
  error TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "approvedAt" TIMESTAMPTZ,
  "executedAt" TIMESTAMPTZ
);

-- Existing local/dev databases may have AgentAction from an earlier migration.
-- CREATE TABLE IF NOT EXISTS will not add columns, so keep this upgrade path explicit.
ALTER TABLE "AgentAction"
  ADD COLUMN IF NOT EXISTS "threadId" TEXT REFERENCES "AgentThread"(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'create_task',
  ADD COLUMN IF NOT EXISTS "payloadJson" TEXT NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "riskLevel" TEXT NOT NULL DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS "resultJson" TEXT,
  ADD COLUMN IF NOT EXISTS error TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "executedAt" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "AgentMessage_threadId_createdAt_idx"
  ON "AgentMessage" ("threadId", "createdAt" ASC);

CREATE INDEX IF NOT EXISTS "AgentAction_threadId_createdAt_idx"
  ON "AgentAction" ("threadId", "createdAt" DESC);

-- DecisionLogEntry
CREATE TABLE IF NOT EXISTS "DecisionLogEntry" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  decision TEXT NOT NULL,
  rationale TEXT,
  "expectedOutcome" TEXT,
  confidence REAL,
  "reviewDate" TIMESTAMPTZ,
  "outcomeJson" TEXT,
  "sourceJson" TEXT NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE "DecisionLogEntry"
  ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Untitled decision',
  ADD COLUMN IF NOT EXISTS decision TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rationale TEXT,
  ADD COLUMN IF NOT EXISTS "expectedOutcome" TEXT,
  ADD COLUMN IF NOT EXISTS confidence REAL,
  ADD COLUMN IF NOT EXISTS "reviewDate" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "outcomeJson" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceJson" TEXT NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now();

-- updatedAt triggers
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER "ContextItem_updatedAt"
  BEFORE UPDATE ON "ContextItem"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER "Collaborator_updatedAt"
  BEFORE UPDATE ON "Collaborator"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER "Task_updatedAt"
  BEFORE UPDATE ON "Task"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER "CalendarEventNote_updatedAt"
  BEFORE UPDATE ON "CalendarEventNote"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER "CoachThread_updatedAt"
  BEFORE UPDATE ON "CoachThread"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER "AgentThread_updatedAt"
  BEFORE UPDATE ON "AgentThread"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER "DecisionLogEntry_updatedAt"
  BEFORE UPDATE ON "DecisionLogEntry"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
