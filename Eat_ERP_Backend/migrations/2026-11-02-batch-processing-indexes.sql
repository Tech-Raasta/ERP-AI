-- Batch Processing (Transaction -> Production): the item tables and stock are searched by entry on every open and
-- approval, and have no index but their primary key.
ALTER TABLE batch_raw_material ADD INDEX idx_batch_raw_material_batch (batch_processing_id);
ALTER TABLE batch_variations ADD INDEX idx_batch_variations_batch (batch_processing_id);
ALTER TABLE batch_processing ADD INDEX idx_batch_processing_ref (ref_id);
ALTER TABLE batch_processing ADD INDEX idx_batch_processing_depot_status (depot_id, status);
ALTER TABLE stock ADD INDEX idx_stock_batch (batch_processing_id, stock_type);
