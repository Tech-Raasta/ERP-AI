import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';

const BankMaster = sequelize.define('bank_master', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  b_name: DataTypes.STRING,
  b_branch: DataTypes.STRING,
  status: DataTypes.STRING
}, {
  timestamps: false,
  freezeTableName: true
});

export default BankMaster;
