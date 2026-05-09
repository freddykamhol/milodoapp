CREATE TABLE IF NOT EXISTS `blog_posts` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `status` text NOT NULL DEFAULT 'DRAFT',
  `title` text NOT NULL DEFAULT '',
  `category` text NOT NULL DEFAULT 'allgemein',
  `slug` text NOT NULL DEFAULT '',
  `excerpt` text NOT NULL DEFAULT '',
  `content_md` text NOT NULL DEFAULT '',
  `title_image_key` text NOT NULL DEFAULT '',
  `published_at` integer
);

CREATE INDEX IF NOT EXISTS `blog_posts_status_idx` ON `blog_posts` (`status`);
CREATE INDEX IF NOT EXISTS `blog_posts_category_idx` ON `blog_posts` (`category`);
CREATE INDEX IF NOT EXISTS `blog_posts_published_at_idx` ON `blog_posts` (`published_at`);
CREATE UNIQUE INDEX IF NOT EXISTS `blog_posts_category_slug_unique` ON `blog_posts` (`category`,`slug`);

CREATE TABLE IF NOT EXISTS `blog_assets` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `post_id` integer NOT NULL,
  `kind` text NOT NULL,
  `file_name` text NOT NULL,
  `mime_type` text,
  `storage_key` text NOT NULL,
  `size_bytes` integer,
  `width` integer,
  `height` integer,
  FOREIGN KEY (`post_id`) REFERENCES `blog_posts`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS `blog_assets_storage_key_unique` ON `blog_assets` (`storage_key`);
CREATE INDEX IF NOT EXISTS `blog_assets_post_id_idx` ON `blog_assets` (`post_id`);
CREATE INDEX IF NOT EXISTS `blog_assets_kind_idx` ON `blog_assets` (`kind`);
