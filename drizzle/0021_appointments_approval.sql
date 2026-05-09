ALTER TABLE appointments ADD COLUMN approved integer NOT NULL DEFAULT 1;
ALTER TABLE appointments ADD COLUMN approved_at integer;

