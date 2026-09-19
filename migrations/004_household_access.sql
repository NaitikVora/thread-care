CREATE TABLE household_sessions (
  token_hash text PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('caregiver','patient')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
