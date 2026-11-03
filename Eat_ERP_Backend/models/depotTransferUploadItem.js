import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
import Box from './box.js';

const DepotTransferUploadItem = sequelize.define('depot_transfer_upload_items', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  depot_transfer_upload_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  type: DataTypes.STRING,
  box_id: DataTypes.INTEGER,
  combo_box_id: DataTypes.INTEGER,
  box_name: DataTypes.STRING,
  qty: DataTypes.DOUBLE,
  batch_no: DataTypes.STRING,
  remarks: DataTypes.STRING,
},
{
  timestamps: false,
  freezeTableName: true
});

DepotTransferUploadItem.belongsTo(Box, { foreignKey: "box_id", as: "box" });

export default DepotTransferUploadItem;
