import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
import Depot from './depot.js';
import User from './user.js';
import DepotTransferUploadItem from './depotTransferUploadItem.js';

const DepotTransferUpload = sequelize.define('depot_transfer_upload', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  file_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  date_of_processing: DataTypes.DATEONLY,
  depot_in_id: DataTypes.INTEGER,
  depot_out_id: DataTypes.INTEGER,
  status: DataTypes.STRING,
  created_by: DataTypes.INTEGER,
  created_at: DataTypes.DATE,
  modified_by: DataTypes.INTEGER,
  modified_at: DataTypes.DATE,
  approved_by: DataTypes.INTEGER,
  approved_at: DataTypes.DATE,
  rejected_by: DataTypes.INTEGER,
  rejected_at: DataTypes.DATE,
},
{
  timestamps: true,
  freezeTableName: true,
  createdAt:"created_at",
  updatedAt:"modified_at",
});

DepotTransferUploadItem.belongsTo(DepotTransferUpload, {foreignKey: "depot_transfer_upload_id", as: "depotTransferUpload"})
DepotTransferUpload.hasMany(DepotTransferUploadItem, { foreignKey: "depot_transfer_upload_id", as: "depotTransferUploadItem", onDelete: 'CASCADE' });
DepotTransferUpload.belongsTo(Depot, { foreignKey: "depot_in_id", as: "depot_in" });
DepotTransferUpload.belongsTo(Depot, { foreignKey: "depot_out_id", as: "depot_out" });
DepotTransferUpload.belongsTo(User, { foreignKey: "created_by", as: "created_by_user" });
DepotTransferUpload.belongsTo(User, { foreignKey: "modified_by", as: "modified_by_user" });
DepotTransferUpload.belongsTo(User, { foreignKey: "approved_by", as: "approved_by_user" });
DepotTransferUpload.belongsTo(User, { foreignKey: "rejected_by", as: "rejected_by_user" });

export default DepotTransferUpload;
