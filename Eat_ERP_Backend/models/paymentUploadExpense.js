import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';

const PaymentUploadExpense = sequelize.define('payment_upload_expenses', {
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
  item_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  invoice_amount: DataTypes.DOUBLE,
  payment_amount: DataTypes.DOUBLE,
  commission: DataTypes.DOUBLE,
  listing_fees: DataTypes.DOUBLE,
  shipping: DataTypes.DOUBLE,
  omc_cost: DataTypes.DOUBLE,
  marketplace_fees: DataTypes.DOUBLE,
  storage_fees: DataTypes.DOUBLE,
  unicommerce_charge: DataTypes.DOUBLE,
  adtech_charges: DataTypes.DOUBLE,
  cred_rewards_adjustment: DataTypes.DOUBLE,
  cred_pay_adjustment: DataTypes.DOUBLE,
  cost_of_advertising: DataTypes.DOUBLE,
  tcs_igst: DataTypes.DOUBLE,
  tcs_sgst: DataTypes.DOUBLE,
  tcs_cgst: DataTypes.DOUBLE,
  tds: DataTypes.DOUBLE,
  other_adjustment: DataTypes.DOUBLE,
  debt_adjustment: DataTypes.DOUBLE,
  tds_claims: DataTypes.DOUBLE,
  lost_damage_inventory: DataTypes.DOUBLE,
  credit_debit_note: DataTypes.DOUBLE,
},
{
  timestamps: false,
  freezeTableName: true
});

export default PaymentUploadExpense;