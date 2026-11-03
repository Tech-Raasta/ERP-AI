-- Brings a LOCAL copy of the ERP database up to the live structure (compared with the Adminer dump of 2026-11-02).
-- For the local database only: live already has all of this. It adds and widens, it never drops a table or column.
-- Run it once, after a backup; every statement is safe to read before running.

-- ---------- Tables live has and local does not ----------
CREATE TABLE IF NOT EXISTS `amazonOrderFulfillmentCenter` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `amazonReportId` int(11) NOT NULL,
  `orderId` varchar(255) DEFAULT NULL,
  `orderItemId` varchar(255) DEFAULT NULL,
  `orderItemName` varchar(1000) DEFAULT NULL,
  `fulfillmentCenterId` varchar(255) DEFAULT NULL,
  `createdAt` datetime DEFAULT NULL,
  `updatedAt` datetime DEFAULT NULL,
  `fcDetailsId` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `distributor_in_sale_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `distributor_in_id` int(11) DEFAULT NULL,
  `type` varchar(100) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `item_id` int(11) DEFAULT NULL,
  `qty` double DEFAULT NULL,
  `sell_rate` double DEFAULT NULL,
  `grams` double DEFAULT NULL,
  `rate` double DEFAULT NULL,
  `amount` double DEFAULT NULL,
  `cost_rate` double DEFAULT NULL,
  `cost_amount` double DEFAULT NULL,
  `cgst_amt` double DEFAULT NULL,
  `sgst_amt` double DEFAULT NULL,
  `igst_amt` double DEFAULT NULL,
  `tax_amt` double DEFAULT NULL,
  `total_amt` double DEFAULT NULL,
  `batch_no` int(11) DEFAULT NULL,
  `margin_per` double DEFAULT NULL,
  `tax_percentage` double DEFAULT NULL,
  `promo_margin` double DEFAULT NULL,
  `batch_qty` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `discount` double DEFAULT 0,
  `discount_amt` double NOT NULL DEFAULT 0,
  `tax_type` varchar(255) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  `combo_box_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Columns live has and local does not (same position as on live) ----------
ALTER TABLE `distributor_in`
  ADD COLUMN `tax_type` varchar(20) DEFAULT NULL AFTER `sales_return_amount`;
ALTER TABLE `distributor_in_items`
  ADD COLUMN `batch_qty` varchar(255) DEFAULT NULL AFTER `promo_margin`,
  ADD COLUMN `discount` double DEFAULT 0 AFTER `batch_qty`,
  ADD COLUMN `discount_amt` double NOT NULL DEFAULT 0 AFTER `discount`,
  ADD COLUMN `tax_type` varchar(255) DEFAULT NULL AFTER `discount_amt`,
  ADD COLUMN `combo_box_id` int(11) DEFAULT NULL AFTER `tax_type`;
ALTER TABLE `sales_upload_details`
  ADD COLUMN `tax_type` varchar(20) DEFAULT NULL AFTER `unique_ref_no`;
ALTER TABLE `sales_upload_items`
  ADD COLUMN `discount` double DEFAULT NULL AFTER `combo_box_id`,
  ADD COLUMN `discount_amt` double DEFAULT NULL AFTER `discount`,
  ADD COLUMN `tax_type` varchar(20) DEFAULT NULL AFTER `discount_amt`;
ALTER TABLE `sales_upload_sale_items`
  ADD COLUMN `discount` double DEFAULT NULL AFTER `combo_box_id`,
  ADD COLUMN `discount_amt` double DEFAULT NULL AFTER `discount`,
  ADD COLUMN `tax_type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL AFTER `discount_amt`;

-- ---------- Columns whose type, NULL or default differ: the live definition ----------
-- Most are widenings (longer text, decimals instead of whole numbers), so no data is lost. Note
-- purchase_order.*_amount were whole numbers locally: amounts with paise were being cut.
ALTER TABLE `amazon_sp_api_reports`
  MODIFY COLUMN `remarks` varchar(2000) DEFAULT NULL;
ALTER TABLE `city_master`
  MODIFY COLUMN `state_id` text DEFAULT NULL;
ALTER TABLE `depot_master`
  MODIFY COLUMN `warehouse_id` varchar(255) DEFAULT NULL,
  MODIFY COLUMN `easyecom_location_key` varchar(255) DEFAULT NULL;
ALTER TABLE `depot_transfer_items`
  MODIFY COLUMN `batch_no` varchar(255) DEFAULT NULL;
ALTER TABLE `distributor_master`
  MODIFY COLUMN `marketplace_id` varchar(255) DEFAULT NULL;
ALTER TABLE `exhibition_visitor`
  MODIFY COLUMN `phone_no` bigint(20) DEFAULT NULL,
  MODIFY COLUMN `company` text DEFAULT NULL,
  MODIFY COLUMN `state` text DEFAULT NULL,
  MODIFY COLUMN `email` text DEFAULT NULL,
  MODIFY COLUMN `business` text NOT NULL DEFAULT ('Visitor');
ALTER TABLE `payment_voucher_detail`
  MODIFY COLUMN `depot_state` varchar(50) DEFAULT NULL,
  MODIFY COLUMN `invoice_no` varchar(1000) DEFAULT NULL,
  MODIFY COLUMN `doc_document` varchar(5000) DEFAULT NULL,
  MODIFY COLUMN `document_name` varchar(5000) DEFAULT NULL;
ALTER TABLE `purchase_order`
  MODIFY COLUMN `sgst_amount` double NOT NULL,
  MODIFY COLUMN `igst_amount` double NOT NULL,
  MODIFY COLUMN `tax_amount` double NOT NULL,
  MODIFY COLUMN `total_amount` double NOT NULL,
  MODIFY COLUMN `round_off_amount` double NOT NULL,
  MODIFY COLUMN `po_amount` double NOT NULL;
ALTER TABLE `raw_material_in`
  MODIFY COLUMN `doc_document` varchar(5000) DEFAULT NULL,
  MODIFY COLUMN `document_name` varchar(5000) DEFAULT NULL,
  MODIFY COLUMN `invoice_no` varchar(255) DEFAULT NULL,
  MODIFY COLUMN `rm_in_item_names` varchar(5000) DEFAULT NULL;
ALTER TABLE `requisition`
  MODIFY COLUMN `product_names` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL,
  MODIFY COLUMN `item_names` text CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL;
ALTER TABLE `shopify_sync_orders`
  MODIFY COLUMN `address` varchar(1000) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci DEFAULT NULL;
ALTER TABLE `shopify_sync_order_items`
  MODIFY COLUMN `item_name` mediumtext DEFAULT NULL;
ALTER TABLE `user_master`
  MODIFY COLUMN `start_day` smallint(6) DEFAULT 1;
ALTER TABLE `vendor_master`
  MODIFY COLUMN `bank_acc_name` varchar(100) DEFAULT NULL,
  MODIFY COLUMN `bank_acc_no` varchar(100) DEFAULT NULL,
  MODIFY COLUMN `bank_email` varchar(100) DEFAULT NULL;
ALTER TABLE `vendor_payment_details`
  MODIFY COLUMN `invoice_nos` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL;

-- ---------- Storage engine: InnoDB on live (transactions and row locks) ----------
ALTER TABLE `depot_transfer_combos` ENGINE=InnoDB;
ALTER TABLE `depot_transfer_upload` ENGINE=InnoDB;
ALTER TABLE `depot_transfer_upload_files` ENGINE=InnoDB;
ALTER TABLE `depot_transfer_upload_items` ENGINE=InnoDB;
ALTER TABLE `distributor_out_sale_items` ENGINE=InnoDB;
ALTER TABLE `sales_upload_sale_items` ENGINE=InnoDB;

-- ---------- Foreign key live has ----------
-- Fails while local rows point at missing parents; this lists them first:
-- SELECT A.* FROM `distributor_sale_items` A LEFT JOIN `distributor_sale` B ON (A.`distributor_sale_id` = B.`id`) WHERE A.`distributor_sale_id` IS NOT NULL AND B.`id` IS NULL;
ALTER TABLE `distributor_sale_items` ADD CONSTRAINT `distributor_sale_items_ibfk_1` FOREIGN KEY (`distributor_sale_id`) REFERENCES `distributor_sale` (`id`);

-- Local only, left as they are (not on live): easy_ecom_inventory, missed_call_data, shipping_information_upload_details, shipping_information_upload_files, weight_resolution_upload_details, weight_resolution_upload_files
-- and columns ingredients_variations.box_breadth, ingredients_variations.box_height, ingredients_variations.box_length, ingredients_variations.product_weight, ingredients_variations.shipping_charges, ingredients_variations.total_weight, ingredients_variations.volumetric_weight, user_role_options.base_url, user_role_options.type
