CREATE TABLE course_materials (
 id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
 appointment_id integer NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
 item_id integer REFERENCES inventory_items(id) ON DELETE SET NULL,
 name text NOT NULL,
 inventory_number text NOT NULL,
 quantity integer NOT NULL CHECK(quantity>0)
);
CREATE UNIQUE INDEX course_materials_item_idx ON course_materials(appointment_id,item_id);
