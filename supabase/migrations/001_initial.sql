-- =====================================================
-- Forge Fitness App -- Database Schema
-- Supabase Migration: 001_initial
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── User Profiles ────────────────────────────────────────────────────────────
CREATE TABLE user_profiles (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  TEXT,
  age                   INTEGER,
  fitness_level         TEXT CHECK (fitness_level IN ('beginner','intermediate','advanced')),
  primary_goal          TEXT CHECK (primary_goal IN ('lose_weight','build_muscle','endurance','general_fitness')),
  secondary_goals       TEXT[]    DEFAULT '{}',
  equipment             TEXT[]    DEFAULT '{}',
  available_days        INTEGER,
  session_length_min    INTEGER,
  injuries              TEXT[]    DEFAULT '{}',
  limitations           TEXT[]    DEFAULT '{}',
  dietary_restrictions  TEXT[]    DEFAULT '{}',
  preferred_workout_style TEXT[]  DEFAULT '{}',
  disliked_exercises    TEXT[]    DEFAULT '{}',
  favorite_foods        TEXT[]    DEFAULT '{}',
  motivation_style      TEXT CHECK (motivation_style IN ('tough_love','gentle','data_driven','hype')),
  struggles             TEXT[]    DEFAULT '{}',
  wins                  TEXT[]    DEFAULT '{}',
  personal_details      TEXT[]    DEFAULT '{}',
  coach_notes           TEXT[]    DEFAULT '{}',
  last_session_summary  TEXT,
  session_count         INTEGER   DEFAULT 0,
  relationship_stage    TEXT      DEFAULT 'new' CHECK (relationship_stage IN ('new','building','established','deep')),
  daily_calorie_goal    INTEGER,
  daily_protein_goal    INTEGER,
  daily_carb_goal       INTEGER,
  daily_fat_goal        INTEGER,
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ─── Coach Sessions (conversation history) ────────────────────────────────────
CREATE TABLE coach_sessions (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  messages    JSONB NOT NULL DEFAULT '[]',
  summary     TEXT,
  started_at  TIMESTAMPTZ DEFAULT NOW(),
  ended_at    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Meal Entries ─────────────────────────────────────────────────────────────
CREATE TABLE meal_entries (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_item   JSONB NOT NULL,
  meal_type   TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  servings    DECIMAL(6,2) NOT NULL DEFAULT 1,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at   TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX meal_entries_user_date ON meal_entries(user_id, date);

-- ─── Workout Sessions ─────────────────────────────────────────────────────────
CREATE TABLE workout_sessions (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  type              TEXT NOT NULL CHECK (type IN ('strength','cardio','hiit','flexibility','sport')),
  exercises         JSONB NOT NULL DEFAULT '[]',
  started_at        TIMESTAMPTZ NOT NULL,
  completed_at      TIMESTAMPTZ,
  duration_minutes  INTEGER,
  calories_burned   INTEGER,
  heart_rate_avg    INTEGER,
  notes             TEXT,
  source            TEXT DEFAULT 'forge' CHECK (source IN ('forge','manual','health_kit')),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX workout_sessions_user_date ON workout_sessions(user_id, started_at);

-- ─── Workout Plans ────────────────────────────────────────────────────────────
CREATE TABLE workout_plans (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  days_per_week   INTEGER NOT NULL,
  duration_weeks  INTEGER NOT NULL,
  sessions        JSONB NOT NULL DEFAULT '[]',
  is_active       BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Health Snapshots (daily cache from Apple Health) ─────────────────────────
CREATE TABLE health_snapshots (
  id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date                  DATE NOT NULL,
  steps                 INTEGER DEFAULT 0,
  active_calories       INTEGER DEFAULT 0,
  resting_calories      INTEGER DEFAULT 0,
  heart_rate_avg        INTEGER,
  heart_rate_resting    INTEGER,
  heart_rate_variability DECIMAL(6,2),
  sleep_hours           DECIMAL(4,2),
  sleep_quality         DECIMAL(4,2),
  weight_lbs            DECIMAL(6,2),
  body_fat_pct          DECIMAL(5,2),
  vo2_max               DECIMAL(5,2),
  workout_minutes       INTEGER DEFAULT 0,
  stand_hours           INTEGER DEFAULT 0,
  exercise_minutes      INTEGER DEFAULT 0,
  distance_km           DECIMAL(8,3) DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE user_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_entries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_snapshots ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Own data only" ON user_profiles    USING (auth.uid() = user_id);
CREATE POLICY "Own data only" ON coach_sessions   USING (auth.uid() = user_id);
CREATE POLICY "Own data only" ON meal_entries      USING (auth.uid() = user_id);
CREATE POLICY "Own data only" ON workout_sessions USING (auth.uid() = user_id);
CREATE POLICY "Own data only" ON workout_plans    USING (auth.uid() = user_id);
CREATE POLICY "Own data only" ON health_snapshots USING (auth.uid() = user_id);

-- Insert policies
CREATE POLICY "Insert own" ON user_profiles    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Insert own" ON coach_sessions   FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Insert own" ON meal_entries      FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Insert own" ON workout_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Insert own" ON workout_plans    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Insert own" ON health_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─── Updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
