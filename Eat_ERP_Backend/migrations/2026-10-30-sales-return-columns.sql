-- Sales Return (Distributor_in) tables the old PHP code and the new Node code write to.
-- The development database this was checked against (eatangcp_eat_erp on localhost) is older than the PHP code:
-- it has no distributor_in_sale_items table and lacks tax_type / combo_box_id on the item tables.
-- Run ONLY on a database missing them (check with SHOW COLUMNS first); production already has them if the PHP
-- Sales Return screen works there. Not run automatically.

CREATE TABLE IF NOT EXISTS distributor_in_sale_items LIKE distributor_in_items;

-- MySQL has no "ADD COLUMN IF NOT EXISTS" before 8.0.29; run each line only where the column is missing.
ALTER TABLE distributor_in_sale_items ADD COLUMN tax_type varchar(20) NULL;
ALTER TABLE distributor_in_sale_items ADD COLUMN combo_box_id int NULL;
ALTER TABLE distributor_in_items ADD COLUMN tax_type varchar(20) NULL;
ALTER TABLE distributor_in_items ADD COLUMN combo_box_id int NULL;
ALTER TABLE distributor_out_exchange_items ADD COLUMN tax_type varchar(20) NULL;
ALTER TABLE distributor_out_exchange_items ADD COLUMN combo_box_id int NULL;
