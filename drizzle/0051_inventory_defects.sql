CREATE TABLE inventory_defects (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 created_at INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
 updated_at INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
 item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
 title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'ERSTELLT',
 reported_by_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX inventory_defects_item_id_idx ON inventory_defects(item_id);
CREATE INDEX inventory_defects_status_idx ON inventory_defects(status);
