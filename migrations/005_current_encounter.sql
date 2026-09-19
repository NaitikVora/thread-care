CREATE TABLE current_encounters (
  id uuid PRIMARY KEY REFERENCES diary_events(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES diary_sessions(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES trusted_people(id) ON DELETE CASCADE,
  observation_id uuid REFERENCES diary_events(id) ON DELETE SET NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  ended_at timestamptz,
  end_reason text
);
CREATE UNIQUE INDEX one_current_encounter ON current_encounters(session_id) WHERE ended_at IS NULL;
