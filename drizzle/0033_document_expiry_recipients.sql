CREATE TABLE `document_expiry_recipients` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer NOT NULL,
  `category` text NOT NULL,
  `recipient_type` text NOT NULL,
  `role` text,
  `user_id` integer,
  `email` text,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `document_expiry_recipients_category_idx` ON `document_expiry_recipients` (`category`);
CREATE UNIQUE INDEX `document_expiry_recipients_unique` ON `document_expiry_recipients` (`category`, `recipient_type`, `role`, `user_id`, `email`);
