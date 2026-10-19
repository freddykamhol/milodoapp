UPDATE inventory_items
SET unit = 'St' || char(252) || 'ck'
WHERE unit IN (
 'St' || char(195) || char(188) || 'ck',
 'St' || char(195) || char(402) || char(194) || char(188) || 'ck'
);
