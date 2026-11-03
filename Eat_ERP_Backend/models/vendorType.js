import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';

const VendorType = sequelize.define('vendor_type_master', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  vendor_type: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notNull: true
    }
  },
  status: DataTypes.STRING,
  remarks: DataTypes.STRING,
  created_by: DataTypes.INTEGER,
  modified_by: DataTypes.INTEGER,
  approved_by: DataTypes.INTEGER,
  approved_on: DataTypes.DATE,
  rejected_by: DataTypes.INTEGER,
  rejected_on: DataTypes.DATE
}, 
{ 
  timestamps: true,
  createdAt: 'created_on',
  updatedAt: 'modified_on',
  freezeTableName: true
});

// Same fields as old PHP Vendor_type_model::save_data
VendorType.prototype.getRequestData = function(req) {
  const text = (value) => (value !== undefined && value !== null) ? value.toString().trim() : '';
  this.vendor_type = text(req.body.vendor_type);
  if (req.body.status) {
    this.status = text(req.body.status);
  }
  this.remarks = text(req.body.remarks);
}

VendorType.prototype.validateData = async function() {
  if (!this.vendor_type) {
    return { errors : { vendor_type: { message: `Vendor Type is required` } } };
  }
  if (!['Approved', 'InActive'].includes(this.status)) {
    return { errors : { status: { message: `Status must be Active or InActive` } } };
  }

  // Old PHP check_vendor_type_availablity: unique across every record
  const count = await VendorType.count({ where: { vendor_type: this.vendor_type, id: { [Op.ne]: (this.id ? this.id : 0) } } });
  if (count > 0) {
    return { errors : { vendor_type: { message: `Vendor Type (${this.vendor_type}) already exist` } } };
  }

  return null;
}

export default VendorType;