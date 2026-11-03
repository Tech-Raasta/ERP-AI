import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';

import DistributorType from './distributorType.js';

// Zone master (old PHP Zone / table zone_master). A zone belongs to a distributor type.
const Zone = sequelize.define('zone_master', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  zone: DataTypes.STRING,
  type_id: DataTypes.INTEGER,
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

Zone.belongsTo(DistributorType, { foreignKey: 'type_id', as: 'distributorType' });

// Same fields as old PHP Zone_model::save_data
Zone.prototype.getRequestData = function(req) {
  const text = (value) => (value !== undefined && value !== null) ? value.toString().trim() : '';
  this.zone = text(req.body.zone);
  this.type_id = req.body.type_id ? +req.body.type_id : null;
  if (req.body.status) {
    this.status = text(req.body.status);
  }
  this.remarks = text(req.body.remarks);
}

Zone.prototype.validateData = async function() {
  if (!this.type_id) {
    return { errors : { type_id: { message: `Distributor Type is required` } } };
  }
  if (!this.zone) {
    return { errors : { zone: { message: `Zone is required` } } };
  }
  if (!['Approved', 'InActive'].includes(this.status)) {
    return { errors : { status: { message: `Status must be Active or InActive` } } };
  }

  // A newly chosen distributor type must be active (an unchanged one may stay as it is)
  const typeCondition = (this.isNewRecord || this.changed('type_id'))
    ? { id: this.type_id, status: 'Approved' }
    : { id: this.type_id };
  let count = await DistributorType.count({ where: typeCondition });
  if (count === 0) {
    return { errors : { type_id: { message: `Distributor Type does not exist` } } };
  }

  // Old PHP check_zone_availablity meant "zone name unique within a distributor type"
  // (its query could never match, so the check never worked there)
  count = await Zone.count({ where: { zone: this.zone, type_id: this.type_id, id: { [Op.ne]: (this.id ? this.id : 0) } } });
  if (count > 0) {
    return { errors : { zone: { message: `Zone (${this.zone}) already exist for this Distributor Type` } } };
  }

  return null;
}

export default Zone;
