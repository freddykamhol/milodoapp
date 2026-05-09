CREATE TABLE IF NOT EXISTS `personal_questionnaires` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `kind` text NOT NULL DEFAULT 'HONORAR',
  `status` text NOT NULL DEFAULT 'SUBMITTED',
  `first_name` text NOT NULL DEFAULT '',
  `last_name` text NOT NULL DEFAULT '',
  `geb` integer,
  `tax_number` text NOT NULL DEFAULT '',
  `street` text NOT NULL DEFAULT '',
  `house_number` text NOT NULL DEFAULT '',
  `plz` text NOT NULL DEFAULT '',
  `city` text NOT NULL DEFAULT '',
  `city_extra` text NOT NULL DEFAULT '',
  `phone` text NOT NULL DEFAULT '',
  `phone_share` integer NOT NULL DEFAULT 0,
  `email` text NOT NULL DEFAULT '',
  `bank_account_holder` text NOT NULL DEFAULT '',
  `bank_account_holder_differs` integer NOT NULL DEFAULT 0,
  `bank_name` text NOT NULL DEFAULT '',
  `iban` text NOT NULL DEFAULT '',
  `blz` text NOT NULL DEFAULT '',
  `einsatzfelder_json` text NOT NULL DEFAULT '[]',
  `qual_med` text,
  `qual_eh_ausbilder` integer NOT NULL DEFAULT 0,
  `sizes_json` text NOT NULL DEFAULT '{}',
  `has_neutral_psa` integer NOT NULL DEFAULT 0,
  `driver_licences_json` text NOT NULL DEFAULT '[]',
  `has_pss` integer NOT NULL DEFAULT 0,
  `own_car` integer NOT NULL DEFAULT 0,
  `contact_prefs_json` text NOT NULL DEFAULT '[]',
  `raw_json` text NOT NULL DEFAULT '{}',
  `admin_notes` text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS `personal_questionnaires_kind_idx` ON `personal_questionnaires` (`kind`);
CREATE INDEX IF NOT EXISTS `personal_questionnaires_status_idx` ON `personal_questionnaires` (`status`);
CREATE INDEX IF NOT EXISTS `personal_questionnaires_created_at_idx` ON `personal_questionnaires` (`created_at`);
CREATE INDEX IF NOT EXISTS `personal_questionnaires_email_idx` ON `personal_questionnaires` (`email`);

CREATE TABLE IF NOT EXISTS `personal_questionnaire_files` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `questionnaire_id` integer NOT NULL,
  `kind` text NOT NULL,
  `file_name` text NOT NULL,
  `original_name` text NOT NULL DEFAULT '',
  `mime_type` text,
  `storage_key` text NOT NULL,
  `size_bytes` integer,
  FOREIGN KEY (`questionnaire_id`) REFERENCES `personal_questionnaires`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS `personal_questionnaire_files_storage_key_unique` ON `personal_questionnaire_files` (`storage_key`);
CREATE INDEX IF NOT EXISTS `personal_questionnaire_files_questionnaire_id_idx` ON `personal_questionnaire_files` (`questionnaire_id`);
CREATE INDEX IF NOT EXISTS `personal_questionnaire_files_kind_idx` ON `personal_questionnaire_files` (`kind`);

