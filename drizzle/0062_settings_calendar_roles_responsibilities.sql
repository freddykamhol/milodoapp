CREATE TABLE `calendar_category_colors` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `category` text NOT NULL,
  `color` text DEFAULT '#0878F9' NOT NULL,
  `updated_at` integer NOT NULL,
  CONSTRAINT `calendar_category_colors_category_unique` UNIQUE(`category`)
);
CREATE TABLE `role_permissions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `role` text NOT NULL,
  `permission` text NOT NULL,
  `can_view` integer DEFAULT false NOT NULL,
  `can_manage` integer DEFAULT false NOT NULL,
  `updated_at` integer NOT NULL,
  CONSTRAINT `role_permissions_role_permission_unique` UNIQUE(`role`,`permission`)
);
CREATE TABLE `responsibility_assignments` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `type` text NOT NULL,
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `address` text DEFAULT '' NOT NULL,
  `created_at` integer NOT NULL,
  CONSTRAINT `responsibility_assignments_type_user_unique` UNIQUE(`type`,`user_id`)
);
CREATE INDEX `responsibility_assignments_type_idx` ON `responsibility_assignments` (`type`);
