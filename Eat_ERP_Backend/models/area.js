import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';

import DistributorType from './distributorType.js';
import Zone from './zone.js';

// Area master (old PHP Area / table area_master). An area belongs to a distributor type and a zone of that type.
const Area = sequelize.define('area_master', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  area: DataTypes.STRING,
  type_id: DataTypes.INTEGER,
  zone_id: DataTypes.INTEGER,
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

Area.belongsTo(DistributorType, { foreignKey: 'type_id', as: 'distributorType' });
Area.belongsTo(Zone, { foreignKey: 'zone_id', as: 'zone' });

// Same fields as old PHP Area_model::save_data
Area.prototype.getRequestData = function(req) {
  const text = (value) => (value !== undefined && value !== null) ? value.toString().trim() : '';
  this.area = text(req.body.area);
  this.type_id = req.body.type_id ? +req.body.type_id : null;
  this.zone_id = req.body.zone_id ? +req.body.zone_id : null;
  if (req.body.status) {
    this.status = text(req.body.status);
  }
  this.remarks = text(req.body.remarks);
}

Area.prototype.validateData = async function() {
  if (!this.type_id) {
    return { errors : { type_id: { message: `Type is required` } } };
  }
  if (!this.zone_id) {
    return { errors : { zone_id: { message: `Zone is required` } } };
  }
  if (!this.area) {
    return { errors : { area: { message: `Area is required` } } };
  }
  if (!['Approved', 'InActive'].includes(this.status)) {
    return { errors : { status: { message: `Status must be Active or InActive` } } };
  }

  // A newly chosen type / zone must be active; the zone must belong to the type (old PHP filters zones by type)
  const changed = this.isNewRecord || this.changed('type_id') || this.changed('zone_id');
  let count = await DistributorType.count({ where: changed ? { id: this.type_id, status: 'Approved' } : { id: this.type_id } });
  if (count === 0) {
    return { errors : { type_id: { message: `Type does not exist` } } };
  }
  if (changed) {
    count = await Zone.count({ where: { id: this.zone_id, type_id: this.type_id, status: 'Approved' } });
    if (count === 0) {
      return { errors : { zone_id: { message: `Zone does not belong to the selected Type` } } };
    }
  }

  // Old PHP check_area_availablity compares against every record
  count = await Area.count({ where: { area: this.area, id: { [Op.ne]: (this.id ? this.id : 0) } } });
  if (count > 0) {
    return { errors : { area: { message: `Area (${this.area}) already exist` } } };
  }

  return null;
}

export default Area;
