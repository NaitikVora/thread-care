CREATE TABLE diary_sessions (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  status text NOT NULL CHECK (status IN ('active','paused','ended','interrupted')),
  source text NOT NULL DEFAULT 'browser-camera',
  policy jsonb NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  heartbeat_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
CREATE UNIQUE INDEX one_active_diary_session ON diary_sessions ((status)) WHERE status='active';
CREATE TABLE trusted_people (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  relationship text NOT NULL,
  description text NOT NULL DEFAULT '',
  author text NOT NULL,
  blob_key text,
  mime text,
  revision integer NOT NULL DEFAULT 1,
  consent_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE diary_events (
  id uuid PRIMARY KEY,
  session_id uuid REFERENCES diary_sessions(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('camera','note','conversation','person')),
  status text NOT NULL CHECK (status IN ('analyzing','ready','failed')),
  review text NOT NULL DEFAULT 'unreviewed' CHECK (review IN ('unreviewed','confirmed','corrected')),
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'moment',
  tags jsonb NOT NULL DEFAULT '[]',
  details jsonb NOT NULL DEFAULT '{}',
  blob_key text,
  mime text,
  fingerprint text NOT NULL,
  error text,
  revision integer NOT NULL DEFAULT 1,
  captured_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  search_document tsvector GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || summary || ' ' || tags::text)) STORED
);
CREATE INDEX diary_search_idx ON diary_events USING gin(search_document);
CREATE INDEX diary_time_idx ON diary_events(captured_at DESC);
CREATE INDEX diary_session_idx ON diary_events(session_id, captured_at DESC);
CREATE TABLE diary_corrections (
  id uuid NOT NULL REFERENCES diary_events(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  previous jsonb NOT NULL,
  author text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(id,revision)
);
CREATE TABLE diary_digests (
  id uuid PRIMARY KEY,
  day text NOT NULL,
  timezone text NOT NULL,
  source_fingerprint text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE integration_secrets (
  provider text PRIMARY KEY,
  sealed text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE voice_sessions (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES diary_sessions(id) ON DELETE CASCADE,
  conversation_id text,
  status text NOT NULL DEFAULT 'issued',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
