import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
import PaymentUploadItem from './paymentUploadItem.js';
import PaymentUploadExpense from './paymentUploadExpense.js';

const PaymentUploadDetail = sequelize.define('payment_upload_details', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  file_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  date_of_deposit: DataTypes.DATEONLY,
  bank_id: DataTypes.INTEGER,
  payment_mode: DataTypes.STRING,
  total_amount: DataTypes.DOUBLE,
  status: DataTypes.STRING,
  remarks: DataTypes.STRING,
  neft_no: DataTypes.STRING,
  upload_type: DataTypes.STRING,
  created_by: DataTypes.INTEGER,
  modified_by: DataTypes.INTEGER,
  approved_by: DataTypes.INTEGER,
  approved_on: DataTypes.DATE,
  rejected_by: DataTypes.INTEGER,
  rejected_on: DataTypes.DATE,
  distributor_out_id: DataTypes.INTEGER,
  ref_id: DataTypes.INTEGER,
  modified_approved_date: DataTypes.DATE

},
{
  timestamps: true,
  freezeTableName: true,
  createdAt: 'created_on',
  updatedAt: 'modified_on'
});

PaymentUploadDetail.hasMany(PaymentUploadItem, { foreignKey: 'payment_id', as: 'items', onDelete: 'CASCADE' });
PaymentUploadDetail.hasMany(PaymentUploadExpense, { foreignKey: 'payment_id', as: 'expenses', onDelete: 'CASCADE' });
// PaymentUploadItem.belongsTo(PaymentUploadDetail, { foreignKey: 'payment_id', as: 'payment' });
// PaymentUploadExpense.belongsTo(PaymentUploadDetail, { foreignKey: 'payment_id', as: 'payment' });

export default PaymentUploadDetail;
