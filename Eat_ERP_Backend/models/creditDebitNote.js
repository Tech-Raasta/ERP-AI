import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';

const CreditDebitNote = sequelize.define('credit_debit_note', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  date_of_transaction: DataTypes.DATE,
  payment_id: DataTypes.INTEGER,
  distributor_id: DataTypes.INTEGER,
  transaction: DataTypes.STRING,
  invoice_no: DataTypes.STRING,
  distributor_type: DataTypes.STRING,
  amount: DataTypes.DOUBLE,
  amount_without_tax: DataTypes.DOUBLE,
  tax: DataTypes.DOUBLE,
  cgst: DataTypes.DOUBLE,
  sgst: DataTypes.DOUBLE,
  igst: DataTypes.DOUBLE,
  status: DataTypes.STRING,
  remarks: DataTypes.STRING,
  created_by: DataTypes.INTEGER,
  created_on: DataTypes.DATE,
  modified_by: DataTypes.INTEGER,
  modified_on: DataTypes.DATE,
  approved_by: DataTypes.INTEGER,
  approved_on: DataTypes.DATE,
  ref_no: DataTypes.STRING,
  ref_date: DataTypes.DATE,
  exp_category_id: DataTypes.INTEGER
}, {
  timestamps: false,
  freezeTableName: true
});

export default CreditDebitNote;
