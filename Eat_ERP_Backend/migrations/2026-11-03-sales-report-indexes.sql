-- Sales Report and E-Invoice JSON: the columns they look rows up by that have no index yet.
ALTER TABLE distributor_out_sale_items ADD INDEX idx_sale_items_distributor_out (distributor_out_id);
ALTER TABLE distributor_out ADD INDEX idx_distributor_out_order_no (order_no);
ALTER TABLE distributor_transfer ADD INDEX idx_distributor_transfer_date (date_of_transfer);
ALTER TABLE sr_mapping ADD INDEX idx_sr_mapping_area (area_id, type_id, zone_id);
