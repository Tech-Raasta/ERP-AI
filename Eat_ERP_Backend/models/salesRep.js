import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';
import { round } from '../lib/common.js';

// Sales Representative master (old PHP Sales_rep / table sales_rep_master)
const SalesRep = sequelize.define('sales_rep_master', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  sales_rep_name: DataTypes.STRING,
  pan_no: DataTypes.STRING,
  email_id: DataTypes.STRING,
  mobile: DataTypes.STRING,
  kyc_done: DataTypes.STRING,
  teritory: DataTypes.STRING,
  target_pm: DataTypes.DOUBLE,
  status: DataTypes.STRING,
  remarks: DataTypes.STRING,
  sr_type: DataTypes.STRING,
  zone: DataTypes.STRING,
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

// Old PHP list tabs: type tabs show Approved reps of that type; Inactive shows status = InActive
export const SR_TYPES = {
  salesrep: 'Sales Representative',
  promoter: 'Promoter',
  merchandiser: 'Merchandizer'
};

// Same fields as old PHP Sales_rep_model::save_data
SalesRep.prototype.getRequestData = function(req) {
  const body = req.body;
  const text = (value) => (value !== undefined && value !== null) ? value.toString().trim() : '';

  this.sales_rep_name = text(body.sales_rep_name);
  this.pan_no = text(body.pan_no);
  this.email_id = text(body.email_id);
  this.mobile = text(body.mobile);
  this.kyc_done = (body.kyc_done === '1' || body.kyc_done === 1) ? '1' : ((body.kyc_done === '0' || body.kyc_done === 0) ? '0' : null);
  this.teritory = text(body.teritory);
  this.target_pm = (body.target_pm !== undefined && body.target_pm !== '' && !isNaN(+body.target_pm)) ? round(+body.target_pm, 2) : 0;
  this.status = text(body.status) || 'Approved';
  this.remarks = text(body.remarks);
  this.sr_type = text(body.sr_type) || null;
  this.zone = text(body.zone);
}

// Same rules as the old PHP form (validations.js #form_sales_rep_details)
SalesRep.prototype.validateData = async function() {
  const required = [
    ['sales_rep_name', 'Sales Representative Name'],
    ['pan_no', 'Pan No'],
    ['zone', 'Zone'],
    ['email_id', 'Email Id'],
    ['mobile', 'Mobile']
  ];
  for (const [field, label] of required) {
    if (!this[field]) {
      return { errors : { [field]: { message: `${label} is required` } } };
    }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email_id)) {
    return { errors : { email_id: { message: `Please enter a valid email id` } } };
  }
  if (!/^\d{10}$/.test(this.mobile)) {
    return { errors : { mobile: { message: `Mobile must be 10 digits` } } };
  }
  if (!['Approved', 'InActive'].includes(this.status)) {
    return { errors : { status: { message: `Status must be Active or InActive` } } };
  }
  if (this.sr_type && !Object.values(SR_TYPES).includes(this.sr_type)) {
    return { errors : { sr_type: { message: `Type is not valid` } } };
  }

  // Old PHP check_sales_rep_availablity compares against every record
  const count = await SalesRep.count({ where: { sales_rep_name: this.sales_rep_name, id: { [Op.ne]: (this.id ? this.id : 0) } } });
  if (count > 0) {
    return { errors : { sales_rep_name: { message: `Sales Representative Name (${this.sales_rep_name}) already exist` } } };
  }

  return null;
}

export default SalesRep;
