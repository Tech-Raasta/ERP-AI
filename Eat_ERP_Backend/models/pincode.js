import { DataTypes, Op } from "sequelize";
import sequelize from "../lib/database.js";

import State from './state.js';

const Pincode = sequelize.define('pincode_master', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  pincode: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    validate: {
      notNull: { msg: 'Pincode is required' },
      isInt: { msg: 'Pincode must contain digits only' }
    }
  },
  state_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: { msg: 'State is required' }
    }
  },
  // Old PHP: 1 = active, 3 = deleted
  status: DataTypes.INTEGER,
  created_by: DataTypes.INTEGER,
  modified_by: DataTypes.INTEGER
},
{
  timestamps: true,
  createdAt: 'created_on',
  updatedAt: 'modified_on',
  freezeTableName: true
});

Pincode.belongsTo(State, {foreignKey: 'state_id', as: 'state'});

Pincode.ACTIVE = 1;
Pincode.DELETED = 3;

Pincode.prototype.getRequestData = function(req) {
  const pincode = req.body.pincode !== undefined && req.body.pincode !== null ? req.body.pincode.toString().trim() : '';
  this.pincode = pincode === '' ? null : (/^\d+$/.test(pincode) ? +pincode : pincode);
  this.state_id = req.body.state_id ? +req.body.state_id : null;
}

Pincode.prototype.validateData = async function() {
  try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    // Old PHP check_pincode_availablity compares against every record, whatever its status
    let count = await Pincode.count({ where: { pincode: this.pincode, id: { [Op.ne]: (this.id ? this.id : 0) } }});
    if (count > 0) {
      return { errors : { pincode: { message: `Pincode (${this.pincode}) already exist` } } };
    }

    // A newly chosen state must be active (an unchanged one may stay as it is)
    const stateCondition = (this.isNewRecord || this.changed('state_id'))
      ? { id: this.state_id, status: 1 }
      : { id: this.state_id };
    count = await State.count({ where: stateCondition });
    if (count === 0) {
      return { errors : { state_id: { message: `State does not exist` } } };
    }

    return null;
  } catch (error) {
    return error;
  }
}

export default Pincode;
