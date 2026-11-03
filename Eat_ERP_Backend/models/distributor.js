import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';
import State from './state.js';
import Country from './country.js';
import DistributorConsignee from './distributorConsignee.js';
import City from './city.js';
import Pincode from './pincode.js';

const Distributor = sequelize.define('distributor_master', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  distributor_name: {
    type: DataTypes.STRING,
    required: true,
    trim: true,
    unique: true
  },
  address: {
    type: DataTypes.STRING,
    // required: true
  },
  city: {
    type: DataTypes.STRING,
    // required: true
  },
  pincode: {
    type: DataTypes.STRING
  },
  state: {
    type: DataTypes.STRING,
    required: true,
    // unique: false
  },
  country: {
    type: DataTypes.STRING,
    required: true,
    // unique: false
  },
  email_id: {
    type: DataTypes.STRING,
    // required: true,
    // unique: true
  },
  mobile: {
    type: DataTypes.STRING,
    required: true
  },
  tin_number: {
    type: DataTypes.STRING,
    // required: true
  },
  cst_number: DataTypes.STRING,
  contact_person: DataTypes.STRING,
  sales_rep_id: DataTypes.INTEGER,
  sell_out: DataTypes.DOUBLE,
  send_invoice: DataTypes.INTEGER,
  credit_period: DataTypes.INTEGER,
  class: DataTypes.STRING,
  area_id: DataTypes.INTEGER,
  type_id: DataTypes.INTEGER,
  zone_id: DataTypes.INTEGER,
  location_id: DataTypes.INTEGER,
  google_address: DataTypes.STRING,
  doc_document: DataTypes.STRING,
  document_name: DataTypes.STRING,
  gst_number: DataTypes.STRING,
  state_code: DataTypes.STRING,
  latitude: DataTypes.DOUBLE,
  longitude: DataTypes.DOUBLE,
  tally_name: DataTypes.STRING,
  marketplace: DataTypes.STRING,
  marketplace_id: DataTypes.INTEGER,
  master_distributor_id: DataTypes.INTEGER,
  prefix: DataTypes.STRING,
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

Distributor.hasMany(DistributorConsignee, { foreignKey: "distributor_id", as: "consignees", onDelete: 'CASCADE' });

export const getDistributorMasterData = async function(distributor) {
  // try {
    let cityCond = { where: {status: 1} };
    let pincodeCond = { where: {status: 1} };
    let stateCond = { where: {status: 1} };
    let countryCond = { where: {status: 1} };

    if (distributor) {
      if (distributor.city) {
        cityCond = { where: {[Op.or]: [{ status: 1 }, { city_name: distributor.city }]} };
      }
      if (distributor.pincode) {
        pincodeCond = { where: {[Op.or]: [{ status: 1 }, { pincode: distributor.pincode }]} };
      }
      if (distributor.state) {
        stateCond = { where: {[Op.or]: [{ status: 1 }, { state_name: distributor.state }]} };
      }
      if (distributor.country) {
        countryCond = { where: {[Op.or]: [{ status: 1 }, { country_name: distributor.country }]} };
      }
    }

    const cities = await City.findAll({ cityCond, attributes: ['id', 'city_name', 'state_id'] });
    const pincodes = await Pincode.findAll({ pincodeCond, attributes: ['id', 'pincode', 'state_id'] });
    const states = await State.findAll({ stateCond, attributes: ['id', 'state_name', 'country_id'] });
    const countries = await Country.findAll({ countryCond, attributes: ['id', 'country_name'] });
    
    return { cities, pincodes, states, countries };
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

Distributor.prototype.getRequestData = function(req) {
  const body = req.body ? req.body : null;

  this.distributor_name = body.distributor_name ? body.distributor_name.trim() : '';
  this.address = body.address ? body.address.trim() : '';
  this.city = body.city ? body.city.trim() : '';
  this.pincode = body.pincode ? body.pincode.toString().trim() : '';
  this.state = body.state ? body.state.trim() : '';
  this.country = body.country ? body.country.trim() : '';
  this.email_id = body.email_id ? body.email_id.trim() : '';
  this.mobile = body.mobile ? body.mobile.trim() : '';
  this.tin_number = body.tin_number ? body.tin_number.trim() : '';
  this.cst_number = body.cst_number ? body.cst_number.trim() : '';
  this.contact_person = body.contact_person ? body.contact_person.trim() : '';
  this.sales_rep_id = body.sales_rep_id ? body.sales_rep_id : null;
  this.sell_out = body.sell_out ? body.sell_out : null;
  this.send_invoice = body.send_invoice ? body.send_invoice : null;
  this.credit_period = body.credit_period ? body.credit_period : null;
  this.class = body.class ? body.class.trim() : '';
  this.area_id = body.area_id ? body.area_id : null;
  this.type_id = body.type_id ? body.type_id : null;
  this.zone_id = body.zone_id ? body.zone_id : null;
  this.location_id = body.location_id ? body.location_id : null;
  this.google_address = body.google_address ? body.google_address.trim() : '';
  this.doc_document = body.doc_document ? body.doc_document.trim() : '';
  this.document_name = body.document_name ? body.document_name.trim() : '';
  this.gst_number = body.gst_number ? body.gst_number.trim() : '';
  this.state_code = body.state_code ? body.state_code.trim() : '';
  this.latitude = body.latitude ? body.latitude : null;
  this.longitude = body.longitude ? body.longitude : null;
  this.tally_name = body.tally_name ? body.tally_name.trim() : '';
  this.master_distributor_id = body.master_distributor_id ? +body.master_distributor_id : null;
  this.prefix = body.prefix ? body.prefix.trim() : '';
  // this.status = body.status;
  this.remarks = body.remarks ? body.remarks.trim() : '';
}

Distributor.prototype.getDistributorConsignees = function(body) {
  // try {
    const distributorConsignees = [];
    if (body.consignees) {
      for (const postedConsignee of body.consignees) {
        const con_name = (postedConsignee.con_name) ? postedConsignee.con_name.trim() : '';
        const con_address = (postedConsignee.con_address) ? postedConsignee.con_address.trim() : '';
        const con_city = (postedConsignee.con_city) ? postedConsignee.con_city.trim() : '';
        const con_pincode = (postedConsignee.con_pincode) ? postedConsignee.con_pincode.trim() : '';
        const con_state = (postedConsignee.con_state) ? postedConsignee.con_state.trim() : '';
        const con_country = (postedConsignee.con_country) ? postedConsignee.con_country.trim() : '';
        const con_state_code = (postedConsignee.con_state_code) ? postedConsignee.con_state_code.trim() : '';
        const con_gst_number = (postedConsignee.con_gst_number) ? postedConsignee.con_gst_number.trim() : '';
  
        const consignee = {
          distributor_id: this.id,
          con_name: con_name,
          con_address: con_address,
          con_city: con_city,
          con_pincode: con_pincode,
          con_state: con_state,
          con_country: con_country,
          con_state_code: con_state_code,
          con_gst_number: con_gst_number
        };

        distributorConsignees.push(consignee);
      }
    }
    
    return distributorConsignees;
  // } catch (error) {
  //   return error;
  // }
}

Distributor.prototype.approve = function(req) {
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

Distributor.prototype.reject = function(req) {
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

Distributor.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    let count = await Distributor.count({ where: { 
      distributor_name: this.distributor_name, 
      id: { [Op.notIn]: [(this.id ? this.id : 0), (this.ref_id ? this.ref_id : 0)] } 
    }});
    if (count > 0) {
      return { errors : { distributor_name: { message: `Distributor Name (${this.distributor_name}) already exist` } } }
    }

    // count = await Distributor.count({ where: { 
    //   distributor_code: this.distributor_code, 
    //   id: { [Op.notIn]: [(this.id ? this.id : 0), (this.ref_id ? this.ref_id : 0)] } 
    // }});
    // if (count > 0) {
    //   return { errors : { distributor_code: { message: `Distributor Code (${this.distributor_code}) already exist` } } }
    // }
    
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

export default Distributor;