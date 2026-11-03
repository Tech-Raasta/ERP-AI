import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';

// Distributor Type master (old PHP Distributor_type / table distributor_type_master)
const DistributorType = sequelize.define('distributor_type_master', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  distributor_type: DataTypes.STRING,
  status: DataTypes.STRING,
  remarks: DataTypes.STRING,
  created_by: DataTypes.INTEGER,
  created_on: DataTypes.DATE,
  modified_by: DataTypes.INTEGER,
  modified_on: DataTypes.DATE
},
{
  timestamps: true,
  createdAt: 'created_on',
  updatedAt: 'modified_on',
  freezeTableName: true
});

// Same fields as old PHP Distributor_type_model::save_data
DistributorType.prototype.getRequestData = function(req) {
  const text = (value) => (value !== undefined && value !== null) ? value.toString().trim() : '';
  this.distributor_type = text(req.body.distributor_type);
  if (req.body.status) {
    this.status = text(req.body.status);
  }
  this.remarks = text(req.body.remarks);
}

DistributorType.prototype.validateData = async function() {
  if (!this.distributor_type) {
    return { errors : { distributor_type: { message: `Distributor Type is required` } } };
  }
  if (!['Approved', 'InActive'].includes(this.status)) {
    return { errors : { status: { message: `Status must be Active or InActive` } } };
  }

  // Old PHP check_distributor_type_availablity compares against every record
  const count = await DistributorType.count({ where: { distributor_type: this.distributor_type, id: { [Op.ne]: (this.id ? this.id : 0) } } });
  if (count > 0) {
    return { errors : { distributor_type: { message: `Distributor Type (${this.distributor_type}) already exist` } } };
  }

  return null;
}

export default DistributorType;
