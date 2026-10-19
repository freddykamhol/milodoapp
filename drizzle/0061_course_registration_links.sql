CREATE TABLE course_registration_links (
 id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
 appointment_id integer NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
 token_hash text NOT NULL,
 expires_at integer NOT NULL,
 created_at integer NOT NULL,
 revoked_at integer
);
CREATE UNIQUE INDEX course_registration_links_token_idx ON course_registration_links(token_hash);
CREATE INDEX course_registration_links_appointment_idx ON course_registration_links(appointment_id);
