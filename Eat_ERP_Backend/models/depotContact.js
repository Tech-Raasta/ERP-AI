import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';

import Depot from './depot.js';

const DepotContact = sequelize.define('depot_contacts', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  depot_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  contact_person: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  email_id: {
    type: DataTypes.STRING,
    validate: {
      isEmail: true
    }
  },
  mobile: {
    type: DataTypes.STRING,
    validate: {
      isNumeric: true,
      len: [10, 10]
    }
  }
}, 
{ 
  timestamps: false,
  freezeTableName: true
});

// DepotContact.belongsTo(Depot);

DepotContact.prototype.getRequestData = async function(depotContact) {
  try {
    this.depot_id = depotContact.depot_id;
    this.contact_person = depotContact.contact_person;
    this.email_id = depotContact.email_id;
    this.mobile = depotContact.mobile;
  } catch (error) {
    return error;
  }
}

DepotContact.prototype.validateData = async function() {
  try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    // let count = await DepotContact.count({ where: { depot_type: this.depot_type, id: { [Op.ne]: this.id } }});
    // if (count > 0) {
    //   return { errors : { depot_type: { message: `(${this.depot_type}) already exist.` } } };
    // }

    return null;
  } catch (error) {
    return error;
  }
}

export default DepotContact;