import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';

import Distributor from './distributor.js';

const DistributorConsignee = sequelize.define('distributor_consignee', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  distributor_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  con_name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  con_address: DataTypes.STRING,
  con_city: DataTypes.STRING,
  con_pincode: DataTypes.STRING,
  con_state: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  con_country: DataTypes.STRING,
  con_state_code: DataTypes.STRING,
  con_gst_number: DataTypes.STRING
}, 
{ 
  timestamps: false,
  freezeTableName: true
});

// DistributorConsignee.belongsTo(Distributor);

DistributorConsignee.prototype.getRequestData = async function(distributorConsignee) {
  try {
    this.distributor_id = distributorConsignee.distributor_id;
    this.con_name = distributorConsignee.con_name;
    this.con_address = distributorConsignee.con_address;
    this.con_city = distributorConsignee.con_city;
    this.con_pincode = distributorConsignee.con_pincode;
    this.con_state = distributorConsignee.con_state;
    this.con_country = distributorConsignee.con_country;
    this.con_state_code = distributorConsignee.con_state_code;
    this.con_gst_number = distributorConsignee.con_gst_number;
  } catch (error) {
    return error;
  }
}

DistributorConsignee.prototype.validateData = async function() {
  try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    // let count = await DistributorConsignee.count({ where: { distributor_type: this.distributor_type, id: { [Op.ne]: this.id } }});
    // if (count > 0) {
    //   return { errors : { distributor_type: { message: `(${this.distributor_type}) already exist.` } } };
    // }

    return null;
  } catch (error) {
    return error;
  }
}

export default DistributorConsignee;