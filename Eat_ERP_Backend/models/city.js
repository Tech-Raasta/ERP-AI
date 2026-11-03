import { DataTypes, Op } from "sequelize";
import sequelize from "../lib/database.js";

import State from './state.js';

// City master (old PHP City_master / table city_master). Status: 1 = active, 3 = deleted.
const City = sequelize.define('city_master', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  city_name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notNull: { msg: 'City Name is required' },
      notEmpty: { msg: 'City Name is required' }
    }
  },
  state_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: { msg: 'State is required' }
    }
  },
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

City.belongsTo(State, { foreignKey: 'state_id', as: 'state' });

City.ACTIVE = 1;
City.DELETED = 3;

// Same fields as old PHP City_master_model::insertUpdateRecord
City.prototype.getRequestData = function(req) {
  this.city_name = req.body.city_name ? req.body.city_name.toString().trim() : null;
  this.state_id = req.body.state_id ? +req.body.state_id : null;
}

City.prototype.validateData = async function() {
  try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    // A newly chosen state must be active (an unchanged one may stay as it is)
    const stateCondition = (this.isNewRecord || this.changed('state_id'))
      ? { id: this.state_id, status: 1 }
      : { id: this.state_id };
    let count = await State.count({ where: stateCondition });
    if (count === 0) {
      return { errors : { state_id: { message: `State does not exist` } } };
    }

    // Old PHP had no duplicate check; a city name may appear only once per state among active cities
    count = await City.count({ where: { city_name: this.city_name, state_id: this.state_id, status: City.ACTIVE, id: { [Op.ne]: (this.id ? this.id : 0) } } });
    if (count > 0) {
      return { errors : { city_name: { message: `City (${this.city_name}) already exist in this State` } } };
    }

    return null;
  } catch (error) {
    return error;
  }
}

export default City;
