import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';

import BatchMaster from './batchMaster.js';

// Documents attached to a batch (old PHP batch_master_doc).
// doc_img: file path, receivable_doc: file name.
// Old PHP files are stored as 'uploads/batch_master_doc/...' on the PHP server;
// files uploaded here are stored as 'batch_master/...' under assets/uploads.
const BatchMasterDoc = sequelize.define('batch_master_doc', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  batch_master_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  title: DataTypes.STRING,
  doc_img: DataTypes.STRING,
  receivable_doc: DataTypes.STRING
},
{
  timestamps: false,
  freezeTableName: true
});

BatchMaster.hasMany(BatchMasterDoc, { foreignKey: 'batch_master_id', as: 'docs' });

export default BatchMasterDoc;
