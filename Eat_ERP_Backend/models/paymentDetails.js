import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
import PaymentDetailsItem from './paymentDetailsItem.js';
import PaymentDetailsExpense from './paymentDetailsExpense.js';

const PaymentDetails = sequelize.define('payment_details', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  date_of_deposit: DataTypes.DATEONLY,
  bank_id: DataTypes.INTEGER,
  payment_mode: DataTypes.STRING,
  total_amount: DataTypes.DOUBLE,
  status: DataTypes.STRING,
  remarks: DataTypes.STRING,
  created_by: DataTypes.INTEGER,
  modified_by: DataTypes.INTEGER,
  approved_by: DataTypes.INTEGER,
  approved_on: DataTypes.DATE,
  rejected_by: DataTypes.INTEGER,
  rejected_on: DataTypes.DATE,
  file_id: DataTypes.INTEGER,
  neft_no: DataTypes.STRING,
  upload_type: DataTypes.STRING,
  created_on: DataTypes.DATE,
  modified_on: DataTypes.DATE
},
{
  timestamps: true,
  freezeTableName: true,
  createdAt: 'created_on',
  updatedAt: 'modified_on'
});

PaymentDetails.hasMany(PaymentDetailsItem, { foreignKey: 'payment_id', as: 'items', onDelete: 'CASCADE' });
PaymentDetails.hasMany(PaymentDetailsExpense, { foreignKey: 'payment_id', as: 'expenses', onDelete: 'CASCADE' });

export default PaymentDetails;
