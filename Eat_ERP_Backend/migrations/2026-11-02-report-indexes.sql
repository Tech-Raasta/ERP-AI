-- Reports: account_ledger_entries has over 17 lakh rows and no index but its primary key, so every Trial Balance and
-- Ledger Report reads the whole table.
ALTER TABLE account_ledger_entries ADD INDEX idx_ledger_entries_account_date (acc_id, ref_date);
ALTER TABLE account_ledger_entries ADD INDEX idx_ledger_entries_voucher (voucher_id);
ALTER TABLE account_ledger_entries ADD INDEX idx_ledger_entries_ref (ref_type, ref_date);
