import { DataTypes } from "sequelize";
import sequelize from "../lib/database.js";

import Country from "./country.js";

const State = sequelize.define('state_master', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  state_name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notNull: true
    }
  },
  state_code: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notNull: true
    }
  },
  country_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  status: DataTypes.INTEGER,
  created_by: DataTypes.INTEGER
}, 
{
  timestamps: false,
  // createdAt: 'created_on',
  // updatedAt: 'modified_on',
  freezeTableName: true
});

State.belongsTo(Country, {foreignKey: 'country_id', as: 'country'});

State.prototype.getRequestData = function(req) {
  this.state_name = req.body.state_name;
  this.state_code = req.body.state_code;
  this.country_id = req.body.country_id;
}

State.prototype.validateData = async function() {
  try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    let count = await State.count({ where: { state_name: this.state_name, id: { [Op.ne]: this.id } }});
    if (count > 0) {
      return { errors : { state_name: { message: `Two states cannot share the same state_name (${this.state_name})` } } };
    }

    if (this.state_code) {
      count = await State.count({ where: { state_code: this.state_code, id: { [Op.ne]: this.id } }});
      if (count > 0) {
        return { errors : { state_name: { message: `Two states cannot share the same state_code (${this.state_code})` } } };
      }
    }
    
    if (this.country_id) {
      count = await Country.count({ where: { id: this.country_id }});
      if (count === 0) {
        return { errors : { country: { message: `Country does not exist` } } }
      }
    }

    return null;
  } catch (error) {
    return error;
  }
}

export default State;