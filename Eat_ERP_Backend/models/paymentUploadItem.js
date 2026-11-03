import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';

const PaymentUploadItem = sequelize.define('payment_upload_items', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  payment_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  distributor_id: DataTypes.INTEGER,
  ref_no: DataTypes.STRING,
  invoice_no: DataTypes.STRING,
  bank_name: DataTypes.STRING,
  bank_city: DataTypes.STRING,
  payment_amount: DataTypes.DOUBLE,
  settlement_id: DataTypes.STRING,
  settlement_start_date: DataTypes.DATEONLY,
  settlement_end_date: DataTypes.DATEONLY,
  credit_debit: DataTypes.STRING,
  tax: DataTypes.STRING,
  narration: DataTypes.STRING,
  commission: DataTypes.DOUBLE,
  gst: DataTypes.DOUBLE,
  unique_ref_no: DataTypes.STRING,
  credit_debit_note: DataTypes.DOUBLE
},
{
  timestamps: false,
  freezeTableName: true
});

export default PaymentUploadItem;
