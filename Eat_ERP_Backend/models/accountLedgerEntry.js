import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';
import AccountLedgerMaster from './accountLedgerMaster.js';

const AccountLedgerEntry = sequelize.define('account_ledger_entries', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  ref_id: {
    type: DataTypes.INTEGER,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  sub_ref_id: {
    type: DataTypes.INTEGER,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  ref_type: DataTypes.STRING,
  entry_type: DataTypes.STRING,
  invoice_no: DataTypes.STRING,
  vendor_id: {
    type: DataTypes.INTEGER,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  acc_id: DataTypes.INTEGER,
  ledger_name: DataTypes.STRING,
  ledger_code: DataTypes.STRING,
  type: DataTypes.STRING,
  amount: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  status: DataTypes.STRING,
  created_by: DataTypes.INTEGER,
  created_on: DataTypes.DATE,
  modified_by: DataTypes.INTEGER,
  modified_on: DataTypes.DATE,
  approver_comments: DataTypes.STRING,
  approved_by: DataTypes.INTEGER,
  approved_on: DataTypes.DATE,
  is_active: DataTypes.TINYINT,
  is_paid: DataTypes.TINYINT,
  payment_ref: DataTypes.INTEGER,
  voucher_id: DataTypes.STRING,
  ledger_type: DataTypes.STRING,
  narration: DataTypes.STRING,
  ref_date: DataTypes.DATEONLY
}, 
{ 
  timestamps: false,
  freezeTableName: true
});

// AccountLedgerEntry.belongsTo(Product, {foreignKey: 'item_id', as: 'product'});

// (async () => {
//   await AccountLedgerEntry.sync({ alter: true });
//   console.log('The table for the Sale Item model was just (re)created!');
//   // Code here
// })();

AccountLedgerEntry.prototype.setMainEntryData = async function(accLedgerEntry) {
  const accLedgerMaster = await AccountLedgerMaster.findOne({ 
    where: { status: 'Approved', ref_id: accLedgerEntry.distributor_id, ref_type: 'Distributor' } 
  });

  // this.ref_id = accLedgerEntry.id;
  // this.ref_type = 'Distributor_Sales';
  this.entry_type = 'Total Amount';
  // this.invoice_no = accLedgerEntry.invoice_no;
  this.vendor_id = accLedgerEntry.distributor_id;
  this.acc_id = accLedgerMaster && accLedgerMaster.id ? accLedgerMaster.id : 0;
  this.ledger_name = accLedgerMaster && accLedgerMaster.ledger_name ? accLedgerMaster.ledger_name : 0;
  this.type = 'Debit';
  // this.amount = accLedgerEntry.invoice_amount;
  this.status = accLedgerEntry.status;
  this.is_active = 1;
  this.ledger_type = 'Main Entry';
  this.narration = accLedgerEntry.remarks;
  // this.ref_date = accLedgerEntry.invoice_date ? accLedgerEntry.invoice_date : accLedgerEntry.date_of_processing;
  this.created_by = accLedgerEntry.created_by;
  this.created_on = accLedgerEntry.created_on;
  this.modified_by = accLedgerEntry.modified_by;
  this.modified_on = accLedgerEntry.modified_on;
}

AccountLedgerEntry.prototype.SetTaxableData = function(accLedgerEntry) {
  // this.ref_id = accLedgerEntry.id;
  // this.ref_type = 'Distributor_Sales';
  this.entry_type = 'Taxable Amount';
  // this.invoice_no = accLedgerEntry.invoice_no;
  this.vendor_id = accLedgerEntry.distributor_id;
  this.acc_id = 1;
  this.ledger_name = 'Sales';
  this.type = 'Credit';
  this.amount = accLedgerEntry.amount;
  this.status = accLedgerEntry.status;
  this.is_active = 1;
  this.ledger_type = 'Sub Entry';
  this.narration = accLedgerEntry.remarks;
  // this.ref_date = accLedgerEntry.invoice_date ? accLedgerEntry.invoice_date : accLedgerEntry.date_of_processing;
  this.created_by = accLedgerEntry.created_by;
  this.created_on = accLedgerEntry.created_on;
  this.modified_by = accLedgerEntry.modified_by;
  this.modified_on = accLedgerEntry.modified_on;
}

AccountLedgerEntry.prototype.SetTaxData = function(accLedgerEntry) {
  // this.ref_id = accLedgerEntry.id;
  // this.ref_type = 'Distributor_Sales';
  this.entry_type = 'Tax';
  // this.invoice_no = accLedgerEntry.invoice_no;
  this.vendor_id = accLedgerEntry.distributor_id;
  this.acc_id = 2;
  this.ledger_name = 'GST';
  this.type = 'Credit';
  this.amount = accLedgerEntry.tax_amount;
  this.status = accLedgerEntry.status;
  this.is_active = 1;
  this.ledger_type = 'Sub Entry';
  this.narration = accLedgerEntry.remarks;
  // this.ref_date = accLedgerEntry.invoice_date ? accLedgerEntry.invoice_date : accLedgerEntry.date_of_processing;
  this.created_by = accLedgerEntry.created_by;
  this.created_on = accLedgerEntry.created_on;
  this.modified_by = accLedgerEntry.modified_by;
  this.modified_on = accLedgerEntry.modified_on;
}

AccountLedgerEntry.prototype.SetShippingData = function(accLedgerEntry) {
  if (accLedgerEntry.shipping_charges) {
    // this.ref_id = accLedgerEntry.id;
    // this.ref_type = 'Distributor_Sales';
    this.entry_type = 'Shipping Charges';
    // this.invoice_no = accLedgerEntry.invoice_no;
    this.vendor_id = accLedgerEntry.distributor_id;
    this.acc_id = 3;
    this.ledger_name = 'Shipping Charges';
    this.type = 'Credit';
    this.amount = accLedgerEntry.shipping_charges;
    this.status = accLedgerEntry.status;
    this.is_active = 1;
    this.ledger_type = 'Sub Entry';
    this.narration = accLedgerEntry.remarks;
    // this.ref_date = accLedgerEntry.invoice_date ? accLedgerEntry.invoice_date : accLedgerEntry.date_of_processing;
    this.created_by = accLedgerEntry.created_by;
    this.created_on = accLedgerEntry.created_on;
    this.modified_by = accLedgerEntry.modified_by;
    this.modified_on = accLedgerEntry.modified_on;
  }
}

// AccountLedgerEntry.prototype.setSaleReturnData = async function(saleReturn) {
//   const accLedgerMaster = await AccountLedgerMaster.findOne({ 
//     where: { status: 'Approved', ref_id: saleReturn.distributor_id, ref_type: 'Distributor' } 
//   });

//   this.ref_id = saleReturn.id;
//   this.ref_type = 'Distributor_Sales_Return';
//   this.entry_type = 'Total Amount';
//   this.invoice_no = saleReturn.sales_return_no;
//   this.vendor_id = saleReturn.distributor_id;
//   this.acc_id = accLedgerMaster && accLedgerMaster.id ? accLedgerMaster.id : 0;
//   this.ledger_name = accLedgerMaster && accLedgerMaster.ledger_name ? accLedgerMaster.ledger_name : 0;
//   this.type = 'Debit';
//   this.amount = saleReturn.sales_return_amount;
//   this.status = saleReturn.status;
//   this.is_active = 1;
//   this.ledger_type = 'Main Entry';
//   this.narration = saleReturn.remarks;
//   this.ref_date = saleReturn.sales_return_date ? saleReturn.sales_return_date : saleReturn.date_of_processing;
//   this.created_by = saleReturn.created_by;
//   this.created_on = saleReturn.created_on;
//   this.modified_by = saleReturn.modified_by;
//   this.modified_on = saleReturn.modified_on;
// }

export default AccountLedgerEntry;