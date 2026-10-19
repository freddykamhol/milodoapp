CREATE TABLE inventory_items (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 created_at INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
 updated_at INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
 inventory_number TEXT UNIQUE,
 name TEXT NOT NULL,
 category TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'ACTIVE',
 quantity INTEGER NOT NULL DEFAULT 0,
 minimum_quantity INTEGER NOT NULL DEFAULT 0,
 unit TEXT NOT NULL DEFAULT 'Stück',
 location TEXT NOT NULL DEFAULT '',
 manufacturer TEXT NOT NULL DEFAULT '',
 model TEXT NOT NULL DEFAULT '',
 serial_number TEXT NOT NULL DEFAULT '',
 lot_number TEXT NOT NULL DEFAULT '',
 expiry_at INTEGER,
 inspection_interval_days INTEGER NOT NULL DEFAULT 0,
 last_inspection_at INTEGER,
 next_inspection_at INTEGER,
 medical_device_class TEXT NOT NULL DEFAULT '',
 udi TEXT NOT NULL DEFAULT '',
 commissioned_at INTEGER,
 oxygen_capacity_liters INTEGER,
 oxygen_pressure_bar INTEGER,
 oxygen_content_percent INTEGER,
 notes TEXT NOT NULL DEFAULT ''
);
CREATE INDEX inventory_items_category_idx ON inventory_items(category);
CREATE INDEX inventory_items_status_idx ON inventory_items(status);
CREATE INDEX inventory_items_expiry_idx ON inventory_items(expiry_at);
CREATE INDEX inventory_items_inspection_idx ON inventory_items(next_inspection_at);
CREATE TABLE inventory_movements (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 created_at INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
 item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
 movement_type TEXT NOT NULL,
 quantity_change INTEGER NOT NULL,
 quantity_after INTEGER NOT NULL,
 reason TEXT NOT NULL,
 reference TEXT NOT NULL DEFAULT '',
 actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX inventory_movements_item_id_idx ON inventory_movements(item_id);
CREATE INDEX inventory_movements_created_at_idx ON inventory_movements(created_at);
CREATE TABLE inventory_inspections (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 created_at INTEGER NOT NULL DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
 item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
 result TEXT NOT NULL,
 performed_at INTEGER NOT NULL,
 next_due_at INTEGER,
 notes TEXT NOT NULL DEFAULT '',
 performed_by_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX inventory_inspections_item_id_idx ON inventory_inspections(item_id);
CREATE INDEX inventory_inspections_performed_at_idx ON inventory_inspections(performed_at);
CREATE TABLE inventory_kit_components (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 kit_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
 component_item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
 quantity INTEGER NOT NULL DEFAULT 1,
 UNIQUE(kit_item_id, component_item_id)
);
CREATE INDEX inventory_kit_components_kit_idx ON inventory_kit_components(kit_item_id);
