import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';
import { validateEmail } from '../lib/common.js';

import City from './city.js';
import Pincode from './pincode.js';
import State from './state.js';
import Country from './country.js';
import DepotContact from './depotContact.js';

const Depot = sequelize.define('depot_master', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  depot_name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notNull: true,
      notEmpty: { msg: "Depot Name is required" }
    }
  },
  depot_code: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notNull: true,
      len: [3,3]
    }
  },
  address: DataTypes.STRING,
  city: DataTypes.STRING,
  pincode: DataTypes.STRING,
  state: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notNull: true,
      notEmpty: { msg: "State is required" }
    }
  },
  country: DataTypes.STRING,
  email_id: {
    type: DataTypes.STRING,
    validate: {
      isEmailOrEmpty(val) {
        if (val && !validateEmail(val)) {
          throw new Error('Email Id is invalid');
        }
      }
    }
  },
  mobile: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notNull: true,
      isNumeric: true,
      len: [10, 10]
    }
  },
  contact_person: DataTypes.STRING,
  state_code: DataTypes.STRING,
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notNull: true,
      isIn: [['Depot', 'Manufacturer', 'Sales']]
    }
  },
  gst_no: DataTypes.STRING,
  fssai_no: DataTypes.STRING,
  bank_acc_no: DataTypes.STRING,
  bank_name: DataTypes.STRING,
  ifsc_code: DataTypes.STRING,
  depot_fc_id: DataTypes.STRING,
  warehouse: DataTypes.STRING,
  warehouse_id: DataTypes.STRING,
  status: {
    type: DataTypes.STRING,
    validate: {
      isIn: [['Approved', 'InActive']]
    }
  },
  remarks: DataTypes.STRING,
  created_by: DataTypes.INTEGER,
  modified_by: DataTypes.INTEGER,
  approved_by: DataTypes.INTEGER,
  approved_on: DataTypes.DATE,
  rejected_by: DataTypes.INTEGER,
  rejected_on: DataTypes.DATE,
  easyecom_location_key: DataTypes.STRING
}, 
{ 
  timestamps: true,
  createdAt: 'created_on',
  updatedAt: 'modified_on',
  freezeTableName: true
});

Depot.hasMany(DepotContact, { foreignKey: "depot_id", as: "contactPersons", onDelete: 'CASCADE' });

// Same lookup lists as getVendorMasterData (no status filter, matching current production behaviour)
export const getDepotMasterData = async function() {
  const cities = await City.findAll({ attributes: ['id', 'city_name', 'state_id'] });
  const pincodes = await Pincode.findAll({ attributes: ['id', 'pincode', 'state_id'] });
  const states = await State.findAll({ attributes: ['id', 'state_name', 'state_code', 'country_id'] });
  const countries = await Country.findAll({ attributes: ['id', 'country_name'] });

  return { cities, pincodes, states, countries };
}

Depot.prototype.getRequestData = function(req) {
  const body = req.body ? req.body : null;

  this.depot_name = body.depot_name ? body.depot_name.trim() : '';
  this.depot_code = body.depot_code ? body.depot_code.trim() : '';
  this.address = body.address ? body.address.trim() : '';
  this.city = body.city ? body.city.trim() : '';
  this.pincode = body.pincode ? body.pincode.toString().trim() : '';
  this.state = body.state ? body.state.trim() : '';
  this.country = body.country ? body.country.trim() : '';
  this.email_id = body.email_id ? body.email_id.trim() : '';
  this.mobile = body.mobile ? body.mobile.toString().trim() : null;
  this.state_code = body.state_code ? body.state_code.trim() : '';
  this.type = body.type ? body.type.trim() : null;
  this.gst_no = body.gst_no ? body.gst_no.trim() : '';
  this.fssai_no = body.fssai_no ? body.fssai_no.trim() : '';
  this.bank_acc_no = body.bank_acc_no ? body.bank_acc_no.trim() : '';
  this.bank_name = body.bank_name ? body.bank_name.trim() : '';
  this.ifsc_code = body.ifsc_code ? body.ifsc_code.trim() : '';
  this.depot_fc_id = body.depot_fc_id ? body.depot_fc_id.trim() : '';
  this.warehouse = body.warehouse ? body.warehouse.trim() : '';
  this.warehouse_id = body.warehouse_id ? body.warehouse_id.toString().trim() : null;
  // Set by the EasyEcom integration, not by the depot form - only overwrite when sent
  if (body.easyecom_location_key !== undefined) {
    this.easyecom_location_key = body.easyecom_location_key ? body.easyecom_location_key.trim() : '';
  }

  if (body.status) {
    this.status = body.status;
  }
  this.remarks = body.remarks ? body.remarks.trim() : '';
}

Depot.prototype.getDepotContacts = function(body) {
  // try {
    const depotContacts = [];
    if (body.contactPersons) {
      for (const postedContactPerson of body.contactPersons) {
        const contact_person = (postedContactPerson.contact_person) ? postedContactPerson.contact_person : null;
        const email_id = (postedContactPerson.email_id) ? postedContactPerson.email_id : null;
        const mobile = (postedContactPerson.mobile) ? postedContactPerson.mobile : null;
  
        const contactPerson = {
          depot_id: this.id,
          contact_person: contact_person,
          email_id: email_id,
          mobile: mobile
        };

        depotContacts.push(contactPerson);
      }
    }
    
    return depotContacts;
  // } catch (error) {
  //   return error;
  // }
}

Depot.prototype.approve = function(req) {
  // try {
    // if (this.isDeleted) {
    if (this.status === "Deleted") {
      this.status = "InActive";
    } else {
      this.status = "Approved";
    }

    if (req && req.body && req.body.remarks) {
      this.remarks = req.body.remarks;
    } else {
      this.remarks = '';
    }
    this.approved_by = req.userData.userId;
    this.approved_on = new Date().toISOString();

    return null;
  // } catch (error) {
  //   return error;
  // }
}

Depot.prototype.reject = function(req) {
  // try {
    this.status = "Rejected";
    if (req && req.body && req.body.remarks) {
      this.remarks = req.body.remarks;
    } else {
      this.remarks = '';
    }
    this.rejected_by = req.userData.userId;
    this.rejected_on = new Date().toISOString();

    return null;
  // } catch (error) {
  //   return error;
  // }
}

Depot.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    let count = await Depot.count({ where: { 
      depot_name: this.depot_name, 
      id: { [Op.ne]: (this.id ? this.id : 0) } 
    }});
    if (count > 0) {
      return { errors : { depot_name: { message: `Depot Name (${this.depot_name}) already exist` } } }
    }

    count = await Depot.count({ where: { 
      depot_code: this.depot_code, 
      id: { [Op.ne]: (this.id ? this.id : 0) } 
    }});
    if (count > 0) {
      return { errors : { depot_code: { message: `Depot Code (${this.depot_code}) already exist` } } }
    }
    
    if (this.city) {
      count = await City.count({ where: { city_name: this.city }});
      if (count === 0) {
        return { errors : { city: { message: `City does not exist` } } };
      }
    }
    if (this.pincode) {
      count = await Pincode.count({ where: { pincode: this.pincode }});
      if (count === 0) {
        return { errors : { pincode: { message: `Pincode does not exist` } } };
      }
    }
    if (this.state) {
      count = await State.count({ where: { state_name: this.state }});
      if (count === 0) {
        return { errors : { state: { message: `State does not exist` } } };
      }
    }
    if (this.country) {
      count = await Country.count({ where: { country_name: this.country }});
      if (count === 0) {
        return { errors : { country: { message: `Country does not exist` } } };
      }
    }
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}

export default Depot;