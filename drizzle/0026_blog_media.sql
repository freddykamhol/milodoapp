CREATE TABLE IF NOT EXISTS `blog_media` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `file_name` text NOT NULL,
  `mime_type` text,
  `storage_key` text NOT NULL,
  `size_bytes` integer,
  `width` integer,
  `height` integer
);

CREATE UNIQUE INDEX IF NOT EXISTS `blog_media_storage_key_unique` ON `blog_media` (`storage_key`);
CREATE INDEX IF NOT EXISTS `blog_media_created_at_idx` ON `blog_media` (`created_at`);

