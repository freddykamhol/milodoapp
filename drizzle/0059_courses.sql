ALTER TABLE appointments ADD COLUMN course_type text;
ALTER TABLE appointments ADD COLUMN course_participant_limit integer;
ALTER TABLE appointments ADD COLUMN course_registration_hash text;
ALTER TABLE appointments ADD COLUMN course_registration_expires_at integer;
CREATE UNIQUE INDEX appointments_course_registration_idx ON appointments(course_registration_hash);
CREATE TABLE course_participants (
 id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
 appointment_id integer NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
 first_name text NOT NULL,
 last_name text NOT NULL,
 date_of_birth text NOT NULL,
 identity_key text NOT NULL,
 present integer NOT NULL DEFAULT 0 CHECK(present IN (0,1)),
 source text NOT NULL DEFAULT 'INTERNAL' CHECK(source IN ('INTERNAL','EXTERNAL')),
 created_at integer NOT NULL,
 updated_at integer NOT NULL,
 updated_by_id integer REFERENCES users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX course_participants_identity_idx ON course_participants(appointment_id,identity_key);
CREATE INDEX course_participants_appointment_idx ON course_participants(appointment_id,last_name,first_name);
