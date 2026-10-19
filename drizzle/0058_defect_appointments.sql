CREATE TABLE defect_appointments (
 id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
 created_at integer NOT NULL,
 updated_at integer NOT NULL,
 vehicle_defect_id integer REFERENCES vehicle_defects(id) ON DELETE CASCADE,
 inventory_defect_id integer REFERENCES inventory_defects(id) ON DELETE CASCADE,
 company_id integer REFERENCES vehicle_service_companies(id) ON DELETE SET NULL,
 company_name text NOT NULL DEFAULT '',
 title text NOT NULL,
 description text NOT NULL DEFAULT '',
 location text NOT NULL DEFAULT '',
 start_at integer NOT NULL,
 end_at integer,
 created_by_id integer REFERENCES users(id) ON DELETE SET NULL,
 CHECK ((vehicle_defect_id IS NOT NULL AND inventory_defect_id IS NULL) OR (vehicle_defect_id IS NULL AND inventory_defect_id IS NOT NULL)),
 CHECK (end_at IS NULL OR end_at > start_at)
);
CREATE INDEX defect_appointments_vehicle_defect_idx ON defect_appointments(vehicle_defect_id, start_at);
CREATE INDEX defect_appointments_inventory_defect_idx ON defect_appointments(inventory_defect_id, start_at);
CREATE INDEX defect_appointments_start_idx ON defect_appointments(start_at);
