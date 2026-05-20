-- =====================================================
-- Forge Fitness App -- Migration 002
-- coach_messages: persistent chat history
-- =====================================================

CREATE TABLE IF NOT EXISTS coach_messages (
  id          TEXT         NOT NULL,
  user_id     UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT         NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT         NOT NULL,
  timestamp   TIMESTAMPTZ  NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS coach_messages_user_timestamp
  ON coach_messages (user_id, timestamp DESC);

ALTER TABLE coach_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own messages"
  ON coach_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages"
  ON coach_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own messages"
  ON coach_messages FOR DELETE
  USING (auth.uid() = user_id);
