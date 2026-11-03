import { DataTypes } from "sequelize";
import sequelize from "../lib/database.js";

const Country = sequelize.define('country_master', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  country_name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notNull: true
    }
  },
  country_code: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
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

Country.prototype.getRequestData = function(req) {
  this.country_name = req.body.country_name;
  this.country_code = req.body.country_code;
}

Country.prototype.validateData = async function() {
  try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    let count = await Country.count({ where: { country_name: this.country_name, id: { [Op.ne]: this.id } }});
    if (count > 0) {
      return { errors : { country_name: { message: `Two countries cannot share the same country_name (${this.country_name})` } } };
    }

    if (this.country_code) {
      count = await Country.count({ where: { country_code: this.country_code, id: { [Op.ne]: this.id } }});
      if (count > 0) {
        return { errors : { country_name: { message: `Two countries cannot share the same country_code (${this.country_code})` } } };
      }
    }
    
    return null;
  } catch (error) {
    return error;
  }
}

export default Country;