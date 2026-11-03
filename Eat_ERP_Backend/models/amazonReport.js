import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';

const AmazonReport = sequelize.define('amazon_sp_api_reports', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  report_type: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  from_date: {
    type: DataTypes.STRING,
  },
  to_date: {
    type: DataTypes.STRING,
  },
  report_id: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  processing_status: {
    type: DataTypes.STRING,
  },
  report_document_id: {
    type: DataTypes.STRING
  },
  
  url: DataTypes.STRING(1000),
  status: DataTypes.STRING,
  remarks: DataTypes.STRING,
  created_by: DataTypes.INTEGER,
  created_on: DataTypes.DATE,
  modified_by: DataTypes.INTEGER,
  modified_on: DataTypes.DATE,
}, 
{ timestamps: false,
  createdAt: 'created_on',
  updatedAt: 'modified_on',
  freezeTableName: true 
});

export default AmazonReport;
