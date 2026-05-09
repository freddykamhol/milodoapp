PRAGMA foreign_keys=off;

-- customers
CREATE TABLE `customers` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `name` text NOT NULL
);
CREATE UNIQUE INDEX `customers_name_unique` ON `customers` (`name`);

INSERT INTO `customers` (`name`, `created_at`, `updated_at`)
VALUES ('BF Dortmund', (cast((julianday('now') - 2440587.5)*86400000 as integer)), (cast((julianday('now') - 2440587.5)*86400000 as integer)))
ON CONFLICT(`name`) DO NOTHING;

-- appointment_requirements
CREATE TABLE `appointment_requirements` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `appointment_id` integer NOT NULL REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade,
  `kind` text NOT NULL,
  `value` text NOT NULL,
  `min_count` integer NOT NULL
);
CREATE UNIQUE INDEX `appointment_requirements_unique` ON `appointment_requirements` (`appointment_id`,`kind`,`value`);
CREATE INDEX `appointment_requirements_appointment_id_idx` ON `appointment_requirements` (`appointment_id`);
CREATE INDEX `appointment_requirements_kind_value_idx` ON `appointment_requirements` (`kind`,`value`);

-- appointments rework
ALTER TABLE `appointments` RENAME TO `appointments_old`;

CREATE TABLE `appointments` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `start_at` integer NOT NULL,
  `end_at` integer,
  `title` text NOT NULL,
  `einsatzort` text NOT NULL,
  `customer_id` integer NOT NULL REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict,
  `bereich` text NOT NULL,
  `dienstart` text,
  `target_user_id` integer REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
  `staffing_status` text NOT NULL DEFAULT 'UNBESETZT',
  `state` text NOT NULL DEFAULT 'OPEN'
);

INSERT INTO `appointments` (
  `id`,
  `created_at`,
  `updated_at`,
  `start_at`,
  `end_at`,
  `title`,
  `einsatzort`,
  `customer_id`,
  `bereich`,
  `dienstart`,
  `target_user_id`,
  `staffing_status`,
  `state`
)
SELECT
  `id`,
  `created_at`,
  `updated_at`,
  `start_at`,
  `end_at`,
  `title`,
  `einsatzort`,
  (SELECT `id` FROM `customers` WHERE `name` = 'BF Dortmund' LIMIT 1),
  CASE
    WHEN `title` LIKE '%KTW%' OR `title` LIKE '%RTW%' OR `title` LIKE '%NEF%' OR `title` LIKE '%ITW%' THEN 'RD'
    ELSE 'SONSTIGES'
  END,
  CASE
    WHEN `title` LIKE '%KTW%' THEN 'KTW'
    WHEN `title` LIKE '%RTW%' THEN 'RTW'
    WHEN `title` LIKE '%NEF%' THEN 'NEF'
    WHEN `title` LIKE '%ITW%' THEN 'ITW'
    ELSE NULL
  END,
  `target_user_id`,
  'UNBESETZT',
  `status`
FROM `appointments_old`;

-- migrate old required_qual_* to appointment_requirements (min_count = 1)
INSERT INTO `appointment_requirements` (`appointment_id`,`kind`,`value`,`min_count`,`created_at`,`updated_at`)
SELECT `id`, 'QUAL_RD', `required_qual_rd`, 1, `created_at`, `updated_at`
FROM `appointments_old`
WHERE `required_qual_rd` IS NOT NULL;

INSERT INTO `appointment_requirements` (`appointment_id`,`kind`,`value`,`min_count`,`created_at`,`updated_at`)
SELECT `id`, 'QUAL_AUSB', `required_qual_ausb`, 1, `created_at`, `updated_at`
FROM `appointments_old`
WHERE `required_qual_ausb` IS NOT NULL;

DROP TABLE `appointments_old`;

CREATE INDEX `appointments_start_at_idx` ON `appointments` (`start_at`);
CREATE INDEX `appointments_state_idx` ON `appointments` (`state`);
CREATE INDEX `appointments_staffing_status_idx` ON `appointments` (`staffing_status`);
CREATE INDEX `appointments_target_user_id_idx` ON `appointments` (`target_user_id`);
CREATE INDEX `appointments_customer_id_idx` ON `appointments` (`customer_id`);
CREATE INDEX `appointments_bereich_idx` ON `appointments` (`bereich`);
CREATE INDEX `appointments_dienstart_idx` ON `appointments` (`dienstart`);

PRAGMA foreign_keys=on;
