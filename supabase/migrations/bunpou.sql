-- Migration: tabel bunpou_patterns
-- Run di Supabase Dashboard → SQL Editor → Run
-- Aman buat di-run berkali-kali (IF NOT EXISTS guards).

CREATE TABLE IF NOT EXISTS bunpou_patterns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern      TEXT NOT NULL,
  meaning      TEXT NOT NULL,
  connects_to  TEXT,
  notes        TEXT,
  example_jp   TEXT,
  example_id   TEXT,
  level        TEXT,
  favorite     BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Unique pattern per user — supaya import idempotent (gak duplicate)
CREATE UNIQUE INDEX IF NOT EXISTS bunpou_patterns_user_pattern_uniq
  ON bunpou_patterns (user_id, pattern);

-- Index buat filter by level
CREATE INDEX IF NOT EXISTS bunpou_patterns_user_level_idx
  ON bunpou_patterns (user_id, level);

-- RLS — users hanya bisa akses pattern mereka sendiri
ALTER TABLE bunpou_patterns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own bunpou" ON bunpou_patterns;
CREATE POLICY "Users can read own bunpou"
  ON bunpou_patterns FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own bunpou" ON bunpou_patterns;
CREATE POLICY "Users can insert own bunpou"
  ON bunpou_patterns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own bunpou" ON bunpou_patterns;
CREATE POLICY "Users can update own bunpou"
  ON bunpou_patterns FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own bunpou" ON bunpou_patterns;
CREATE POLICY "Users can delete own bunpou"
  ON bunpou_patterns FOR DELETE
  USING (auth.uid() = user_id);
