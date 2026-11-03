# TODO - Payment Upload Sequelize refactor

## Completed
- Added Sequelize models:
  - models/paymentDetails.js (payment_details)
  - models/paymentDetailsItem.js (payment_details_items)
  - models/creditDebitNote.js (credit_debit_note)
- Refactored some raw lookups in models/paymentUpload.js:
  - bank_master -> BankMaster.findOne
  - distributor_master -> Distributor.findOne
  - distributor_out invoice lookup for unique_ref/order_no -> Sale.findOne
- Fixed a syntax/brace issue introduced during refactor.

## Remaining (to finish request)
1) Fix/verify all Sequelize association definitions to avoid circular import/initialization errors.
2) Remove remaining `await sequelize.query(...)` from models/paymentUpload.js:
   - uploadFileData():
     - sums rollup for payment_upload_items (On Account adjustment)
     - distributor_out balance aggregation (complex nested SQL)
   - approve():
     - inserts into payment_details/payment_details_items
     - status updates
   - generatePaymentSlip():
     - select from payment_details/payment_details_items + joins
   - generateCreditDebitNote():
     - select/join credit_debit_note + users + distributor
3) Ensure model alias names match controller includes (details/items) and SQL replacements.
4) Run a minimal “load app” runtime check (not Jest) since DB isn’t available in test environment.

