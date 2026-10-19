CREATE TABLE message_jobs (
 id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
 created_at integer NOT NULL,
 created_by_id integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 client_token text NOT NULL,
 subject text NOT NULL,
 body text NOT NULL,
 selection_json text NOT NULL,
 scheduled_at integer NOT NULL,
 status text NOT NULL DEFAULT 'QUEUED',
 UNIQUE(created_by_id, client_token)
);
CREATE INDEX message_jobs_due_idx ON message_jobs(status, scheduled_at);
CREATE TABLE message_deliveries (
 id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
 job_id integer NOT NULL REFERENCES message_jobs(id) ON DELETE CASCADE,
 email text NOT NULL,
 status text NOT NULL DEFAULT 'PENDING',
 claimed_at integer,
 claim_token text,
 sent_at integer,
 error text,
 UNIQUE(job_id, email)
);
CREATE INDEX message_deliveries_job_status_idx ON message_deliveries(job_id, status);
CREATE TABLE message_attachments (
 id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
 job_id integer NOT NULL REFERENCES message_jobs(id) ON DELETE CASCADE,
 name text NOT NULL,
 mime_type text NOT NULL,
 size_bytes integer NOT NULL,
 content blob NOT NULL
);
CREATE INDEX message_attachments_job_idx ON message_attachments(job_id);
