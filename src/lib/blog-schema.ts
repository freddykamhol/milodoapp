import { sql } from "drizzle-orm";

import { db } from "@/lib/db";

export async function ensureBlogSchema() {
  // Similar to personal questionnaires: keep runtime working even if migrations weren't applied.
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      status text NOT NULL DEFAULT 'DRAFT',
      title text NOT NULL DEFAULT '',
      category text NOT NULL DEFAULT 'allgemein',
      slug text NOT NULL DEFAULT '',
      excerpt text NOT NULL DEFAULT '',
      content_md text NOT NULL DEFAULT '',
      title_image_key text NOT NULL DEFAULT '',
      published_at integer
    );
  `);

  await db.run(sql`CREATE INDEX IF NOT EXISTS blog_posts_status_idx ON blog_posts (status);`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS blog_posts_category_idx ON blog_posts (category);`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS blog_posts_published_at_idx ON blog_posts (published_at);`);
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_category_slug_unique ON blog_posts (category, slug);`);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS blog_assets (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      post_id integer NOT NULL,
      kind text NOT NULL,
      file_name text NOT NULL,
      mime_type text,
      storage_key text NOT NULL,
      size_bytes integer,
      width integer,
      height integer,
      FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE cascade
    );
  `);
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS blog_assets_storage_key_unique ON blog_assets (storage_key);`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS blog_assets_post_id_idx ON blog_assets (post_id);`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS blog_assets_kind_idx ON blog_assets (kind);`);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS blog_media (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      file_name text NOT NULL,
      mime_type text,
      storage_key text NOT NULL,
      size_bytes integer,
      width integer,
      height integer
    );
  `);
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS blog_media_storage_key_unique ON blog_media (storage_key);`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS blog_media_created_at_idx ON blog_media (created_at);`);

  // Add blocks column for newer editors
  try {
    await db.run(sql`ALTER TABLE blog_posts ADD COLUMN content_blocks_json text NOT NULL DEFAULT '[]';`);
  } catch {
    // ignore (already exists)
  }
}
