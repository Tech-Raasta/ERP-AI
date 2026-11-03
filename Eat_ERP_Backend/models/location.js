import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';

import DistributorType from './distributorType.js';
import Zone from './zone.js';
import Area from './area.js';

// Location master (old PHP Location / table location_master): type -> zone -> area (optional) -> location
const Location = sequelize.define('location_master', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  location: DataTypes.STRING,
  type_id: DataTypes.INTEGER,
  zone_id: DataTypes.INTEGER,
  area_id: DataTypes.INTEGER,
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

Location.belongsTo(DistributorType, { foreignKey: 'type_id', as: 'distributorType' });
Location.belongsTo(Zone, { foreignKey: 'zone_id', as: 'zone' });
Location.belongsTo(Area, { foreignKey: 'area_id', as: 'area' });

// Same fields as old PHP Location_model::save_data
Location.prototype.getRequestData = function(req) {
  const text = (value) => (value !== undefined && value !== null) ? value.toString().trim() : '';
  this.location = text(req.body.location);
  this.type_id = req.body.type_id ? +req.body.type_id : null;
  this.zone_id = req.body.zone_id ? +req.body.zone_id : null;
  this.area_id = req.body.area_id ? +req.body.area_id : null;
  if (req.body.status) {
    this.status = text(req.body.status);
  }
  this.remarks = text(req.body.remarks);
}

Location.prototype.validateData = async function() {
  if (!this.type_id) {
    return { errors : { type_id: { message: `Type is required` } } };
  }
  if (!this.zone_id) {
    return { errors : { zone_id: { message: `Zone is required` } } };
  }
  if (!this.location) {
    return { errors : { location: { message: `Location is required` } } };
  }
  if (!['Approved', 'InActive'].includes(this.status)) {
    return { errors : { status: { message: `Status must be Active or InActive` } } };
  }

  // A newly chosen type / zone / area must be active and fit the chain (old PHP filters zones by type, areas by zone)
  const changed = this.isNewRecord || this.changed('type_id') || this.changed('zone_id') || this.changed('area_id');
  let count = await DistributorType.count({ where: changed ? { id: this.type_id, status: 'Approved' } : { id: this.type_id } });
  if (count === 0) {
    return { errors : { type_id: { message: `Type does not exist` } } };
  }
  if (changed) {
    count = await Zone.count({ where: { id: this.zone_id, type_id: this.type_id, status: 'Approved' } });
    if (count === 0) {
      return { errors : { zone_id: { message: `Zone does not belong to the selected Type` } } };
    }
    // Area is optional (no rule on the old PHP form)
    if (this.area_id) {
      count = await Area.count({ where: { id: this.area_id, zone_id: this.zone_id, status: 'Approved' } });
      if (count === 0) {
        return { errors : { area_id: { message: `Area does not belong to the selected Zone` } } };
      }
    }
  }

  // Old PHP check_location_availablity compares against every record
  count = await Location.count({ where: { location: this.location, id: { [Op.ne]: (this.id ? this.id : 0) } } });
  if (count > 0) {
    return { errors : { location: { message: `Location (${this.location}) already exist` } } };
  }

  return null;
}

export default Location;
