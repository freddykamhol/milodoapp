CREATE TABLE IF NOT EXISTS `fee_rates` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `kind` text NOT NULL,
  `value` text NOT NULL,
  `hourly_rate_cents` integer
);

CREATE UNIQUE INDEX IF NOT EXISTS `fee_rates_kind_value_unique` ON `fee_rates` (`kind`,`value`);
CREATE INDEX IF NOT EXISTS `fee_rates_kind_idx` ON `fee_rates` (`kind`);

