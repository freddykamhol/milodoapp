CREATE TABLE `contact_inquiry_recipients` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer NOT NULL DEFAULT (cast((julianday('now') - 2440587.5) * 86400000 as integer)),
  `mode` text NOT NULL,
  `recipient_type` text NOT NULL,
  `role` text,
  `user_id` integer REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  `email` text
);
CREATE INDEX `contact_inquiry_recipients_mode_idx` ON `contact_inquiry_recipients` (`mode`);
CREATE UNIQUE INDEX `contact_inquiry_recipients_unique` ON `contact_inquiry_recipients` (`mode`, `recipient_type`, `role`, `user_id`, `email`);
INSERT INTO `contact_inquiry_recipients` (`mode`, `recipient_type`, `email`) VALUES
  ('eh', 'EMAIL', 'anfrage@milodo-medical.de'),
  ('notfall', 'EMAIL', 'anfrage@milodo-medical.de'),
  ('sanitaet', 'EMAIL', 'anfrage@milodo-medical.de'),
  ('boerse', 'EMAIL', 'anfrage@milodo-medical.de'),
  ('kontakt', 'EMAIL', 'anfrage@milodo-medical.de');
