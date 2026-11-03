import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';
import User from './user.js';

const BatchMaster = sequelize.define('batch_master', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  date_of_processing: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  batch_no: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  created_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  updated_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  updated_by: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  remarks: {
    type: DataTypes.STRING(1000),
    allowNull: true
  },
  production_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
},
{
  timestamps: false,
  freezeTableName: true
});

BatchMaster.belongsTo(User, { foreignKey: "created_by", as: "created_by_user" });
BatchMaster.belongsTo(User, { foreignKey: "updated_by", as: "updated_by_user" });

// Same fields as old PHP Batch_master_model::save_data
BatchMaster.prototype.getRequestData = function(req) {
  const body = req.body;
  const text = (value) => (value !== undefined && value !== null) ? value.toString().trim() : '';

  this.batch_no = text(body.batch_no);
  this.date_of_processing = text(body.date_of_processing) || null;
  // Production is a hidden field on the old PHP form: keep the current value unless it is sent
  if (body.production_id !== undefined) {
    this.production_id = body.production_id ? +body.production_id : null;
  }
  if (body.status) {
    this.status = body.status;
  }
  this.remarks = text(body.remarks);
}

BatchMaster.prototype.validateData = async function() {
  if (!this.batch_no) {
    return { errors : { batch_no: { message: `Batch No is required` } } };
  }
  if (!this.date_of_processing || isNaN(new Date(this.date_of_processing).getTime())) {
    return { errors : { date_of_processing: { message: `Date is required` } } };
  }
  if (!['Approved', 'InActive'].includes(this.status)) {
    return { errors : { status: { message: `Status must be Active or InActive` } } };
  }

  // Old PHP Batch_master::check_batch_id_availablity compares against every batch
  const count = await BatchMaster.count({ where: { batch_no: this.batch_no, id: { [Op.ne]: (this.id ? this.id : 0) } } });
  if (count > 0) {
    return { errors : { batch_no: { message: `Batch No (${this.batch_no}) already exist` } } };
  }

  return null;
}

export default BatchMaster;
