-- Payment Details (Transaction -> Bank): the payment lines had no index, so every lookup of a payment's lines,
-- a distributor's payments or an invoice's balance read all of payment_details_items.
-- Safe to run on a live database (adds indexes only). Not run automatically.
ALTER TABLE payment_details_items ADD INDEX idx_payment_id (payment_id);
ALTER TABLE payment_details_items ADD INDEX idx_distributor_invoice (distributor_id, invoice_no);
ALTER TABLE payment_details ADD INDEX idx_status (status);
ALTER TABLE payment_details ADD INDEX idx_ref_id (ref_id);
ALTER TABLE payment_slip_denomination ADD INDEX idx_payment_id (payment_id);
ALTER TABLE credit_debit_note ADD INDEX idx_payment_id (payment_id);
