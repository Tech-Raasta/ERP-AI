import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';
import { validateEmail } from '../lib/common.js';

import City from './city.js';
import Pincode from './pincode.js';
import State from './state.js';
import Country from './country.js';
import VendorType from './vendorType.js';
import VendorBank from './vendorBank.js';
import VendorContact from './vendorContact.js';

const Vendor = sequelize.define('vendor_master', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  vendor_name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: false,
    validate: {
      notNull: true
    }
  },
  vendor_code: DataTypes.STRING,
  address: DataTypes.STRING,
  city: DataTypes.STRING,
  pincode: DataTypes.STRING,
  state: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  country: DataTypes.STRING,
  email_id: {
    type: DataTypes.STRING,
    isEmailOrEmpty(val, next) {
      if (!val || val === "") {
        return next()
      } else if (validateEmail(val)) {
        return next()
      } else {
        return next('email is invalid')
      }
    }
  },
  mobile: {
    type: DataTypes.STRING,
    // validate: {
    //   isNumeric: true,
    //   len: [10, 10]
    // }
  },
  contact_person: DataTypes.STRING,
  tin_number: DataTypes.STRING,
  cst_number: DataTypes.STRING,
  vendor_type: DataTypes.STRING,
  bank_acc_name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [2, 100],
      notNull: true,
      not: {
        args: ["[^a-zA-Z0-9 .&-]",'i'],
        msg: "Letters, Numbers, dot and spaces only please."
      }
    }
  },
  bank_acc_no: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [2, 25],
      notNull: true,
      not: {
        args: [",+",'i'],
        msg: "Comma not allowed."
      }
    }
  },
  // confirm_bank_acc_no: {
  //   type: DataTypes.VIRTUAL,
  //   autoDataSet: false,
  //   set : function ( value ) {
  //     // this.setDataValue( 'passwordHash', md5Buffer( value ) );
  //     console.log(value);
  //     this.setDataValue( 'confirm_bank_acc_no', value );
  //     return value;
  //   },
  //   allowNull: false,
  //   validate: {
  //     len: [2, 25],
  //     notNull: true,
  //     customValidator(value) {
  //       console.log(value);
  //       console.log(this.bank_acc_no);
  //       if (value !== this.bank_acc_no) {
  //         throw new Error("Please enter same value again.");
  //       }
  //     }
  //   }
  // },
  bank_name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [2, 100],
      notNull: true,
      not: {
        args: [",+",'i'],
        msg: "Comma not allowed."
      }
    }
  },
  bank_branch_name: {
    type: DataTypes.STRING,
    validate: {
      len: [0, 40],
      not: {
        args: [",+",'i'],
        msg: "Comma not allowed."
      }
    }
  },
  ifsc_code: {
    type: DataTypes.STRING,
    validate: {
      len: [0, 11],
      customValidator(value) {
        if ((value === null || value === "") && this.bank_name.trim().toUpperCase() !== "HDFC BANK") {
          throw new Error("IFSC Code can't be null unless bank is HDFC BANK");
        }
      }
    }
  },
  bank_email: {
    type: DataTypes.STRING,
    validate: {
      len: [0, 100],
      isEmailOrEmpty(val, next) {
        if (!val || val === "") {
          return next()
        } else if (validateEmail(val)) {
          return next()
        } else {
          return next('email is invalid')
        }
      }
    }
  },
  bank_document: DataTypes.STRING,
  bank_document_name: DataTypes.STRING,
  gst_document: DataTypes.STRING,
  gst_document_name: DataTypes.STRING,
  pan_document: DataTypes.STRING,
  pan_document_name: DataTypes.STRING,
  msme_document: DataTypes.STRING,
  msme_document_name: DataTypes.STRING,
  status: DataTypes.STRING,
  remarks: DataTypes.STRING,
  created_by: DataTypes.INTEGER,
  modified_by: DataTypes.INTEGER,
  approved_by: DataTypes.INTEGER,
  approved_on: DataTypes.DATE,
  rejected_by: DataTypes.INTEGER,
  rejected_on: DataTypes.DATE,
  gst_number: DataTypes.STRING,
  payment_due_days: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  type_id: DataTypes.INTEGER,
  ref_id: DataTypes.INTEGER
}, 
{ 
  timestamps: true,
  createdAt: 'created_on',
  updatedAt: 'modified_on',
  freezeTableName: true
});

Vendor.belongsTo(VendorType, { foreignKey: "type_id", as: "vendorType" });
Vendor.hasMany(VendorContact, { foreignKey: "vendor_id", as: "contactPersons", onDelete: 'CASCADE' });

export const getVendorMasterData = async function(vendor) {
  // try {
    let cityCond = { where: {status: 1} };
    let pincodeCond = { where: {status: 1} };
    let stateCond = { where: {status: 1} };
    let countryCond = { where: {status: 1} };
    let vendorTypeCond = { where: {status: 'Approved'} };

    if (vendor) {
      if (vendor.city) {
        cityCond = { where: {[Op.or]: [{ status: 1 }, { city_name: vendor.city }]} };
      }
      if (vendor.pincode) {
        pincodeCond = { where: {[Op.or]: [{ status: 1 }, { pincode: vendor.pincode }]} };
      }
      if (vendor.state) {
        stateCond = { where: {[Op.or]: [{ status: 1 }, { state_name: vendor.state }]} };
      }
      if (vendor.country) {
        countryCond = { where: {[Op.or]: [{ status: 1 }, { country_name: vendor.country }]} };
      }
      if (vendor.type_id) {
        vendorTypeCond = { where: {[Op.or]: [{ status: 'Approved' }, { id: vendor.type_id }]} };
      }
    }

    const cities = await City.findAll({ cityCond, attributes: ['id', 'city_name', 'state_id'] });
    const pincodes = await Pincode.findAll({ pincodeCond, attributes: ['id', 'pincode', 'state_id'] });
    const states = await State.findAll({ stateCond, attributes: ['id', 'state_name', 'country_id'] });
    const countries = await Country.findAll({ countryCond, attributes: ['id', 'country_name'] });
    const vendorTypes = await VendorType.findAll({ vendorTypeCond, attributes: ['id', 'vendor_type'] });
    const vendorBanks = await VendorBank.findAll({ attributes: ['id', 'bank_name'] });
    
    return { cities, pincodes, states, countries, vendorTypes, vendorBanks };
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

Vendor.prototype.getRequestData = function(req) {
  // try {

    // console.log(req);

    const body = req.body ? req.body : null;
    const files = req.files ? req.files : null;

    this.vendor_name = body.vendor_name ? body.vendor_name.trim() : '';
    this.vendor_code = body.vendor_code ? body.vendor_code.trim() : '';
    this.address = body.address ? body.address.trim() : '';
    this.city = body.city ? body.city.trim() : '';
    this.pincode = body.pincode ? body.pincode.toString().trim() : '';
    this.state = body.state ? body.state.trim() : '';
    this.country = body.country ? body.country.trim() : '';
    this.email_id = body.email_id ? body.email_id.trim() : '';
    this.mobile = body.mobile ? body.mobile.trim() : '';
    this.contact_person = body.contact_person ? body.contact_person.trim() : '';
    this.tin_number = body.tin_number ? body.tin_number.trim() : '';
    this.cst_number = body.cst_number ? body.cst_number.trim() : '';
    this.vendor_type = body.vendor_type ? body.vendor_type.trim() : '';
    this.bank_acc_name = body.bank_acc_name ? body.bank_acc_name.trim() : '';
    this.bank_acc_no = body.bank_acc_no ? body.bank_acc_no.trim() : '';
    this.bank_name = body.bank_name ? body.bank_name.trim() : '';
    this.bank_branch_name = body.bank_branch_name ? body.bank_branch_name.trim() : '';
    this.ifsc_code = body.ifsc_code ? body.ifsc_code.trim() : '';
    this.bank_email = body.bank_email ? body.bank_email.trim() : '';

    if (files) {
      if (files.bank_document && files.bank_document.length > 0) {
        this.bank_document = (files.bank_document && files.bank_document.length > 0) ? files.bank_document[0].path : this.bank_document;
        this.bank_document_name = (files.bank_document && files.bank_document.length > 0) ? files.bank_document[0].filename : this.bank_document_name;
      }
      if (files.gst_document && files.gst_document.length > 0) {
        this.gst_document = (files.gst_document && files.gst_document.length > 0) ? files.gst_document[0].path : this.gst_document;
        this.gst_document_name = (files.gst_document && files.gst_document.length > 0) ? files.gst_document[0].filename : this.gst_document_name;
      }
      if (files.pan_document && files.pan_document.length > 0) {
        this.pan_document = (files.pan_document && files.pan_document.length > 0) ? files.pan_document[0].path : this.pan_document;
        this.pan_document_name = (files.pan_document && files.pan_document.length > 0) ? files.pan_document[0].filename : this.pan_document_name;
      }
      if (files.msme_document && files.msme_document.length > 0) {
        this.msme_document = (files.msme_document && files.msme_document.length > 0) ? files.msme_document[0].path : this.msme_document;
        this.msme_document_name = (files.msme_document && files.msme_document.length > 0) ? files.msme_document[0].filename : this.msme_document_name;
      }
    }
    
    this.gst_number = body.gst_number ? body.gst_number : '';
    this.payment_due_days = body.payment_due_days ? +body.payment_due_days : 30;
    this.type_id = body.type_id ? +body.type_id : null;
    this.ref_id = body.ref_id ? +body.ref_id : null;
    // this.status = body.status;
    this.remarks = body.remarks ? body.remarks.trim() : '';

    // console.log('Type_Id');
    // console.log(body.type_id);
    
    // const contactPersonName = body.contactPersonName;
    // const contactPersonEmailId = body.contactPersonEmailId;
    // const contactPersonMobileNo = body.contactPersonMobileNo;
    // const contactPersons = [];

    // if (contactPersonName) {
    //   for (let i = 0; i < contactPersonName.length; i++) {
    //     contactPersons.push({
    //       contactPersonName: contactPersonName[i],
    //       contactPersonEmailId: contactPersonEmailId[i],
    //       contactPersonMobileNo: contactPersonMobileNo[i]
    //     });
    //   }
    // }
    
    // this.contactPersons = contactPersons;
  // } catch (error) {
  //   // console.log(error);
  //   return error;
  // }
}

Vendor.prototype.getVendorContacts = function(body) {
  // try {
    const vendorContacts = [];
    if (body.contactPersons) {
      let postedContactPersons = body.contactPersons;
      if (typeof body.contactPersons === 'string') {
        postedContactPersons = JSON.parse(body.contactPersons);
      }
      for (const postedContactPerson of postedContactPersons) {
        const contact_person = (postedContactPerson.contact_person) ? postedContactPerson.contact_person : null;
        const email_id = (postedContactPerson.email_id) ? postedContactPerson.email_id : null;
        const mobile = (postedContactPerson.mobile) ? postedContactPerson.mobile : null;
  
        const contactPerson = {
          vendor_id: this.id,
          contact_person: contact_person,
          email_id: email_id,
          mobile: mobile
        };

        vendorContacts.push(contactPerson);
      }
    }
    
    return vendorContacts;
  // } catch (error) {
  //   return error;
  // }
}

Vendor.prototype.approve = function(req) {
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

Vendor.prototype.reject = function(req) {
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

Vendor.prototype.getVendorCode = function(series) {
  // try {
    if (this.vendor_code) {
      return this.vendor_code;
    }
    this.vendor_code = 'V' + series.toString().padStart(4,"0");
    return this.vendor_code;
  // } catch (error) {
  //   return error;
  // }
}

Vendor.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    let count = await Vendor.count({ where: { 
      vendor_name: this.vendor_name, 
      id: { [Op.notIn]: [(this.id ? parseInt(this.id) : 0), (this.ref_id ? parseInt(this.ref_id) : 0)] },
      // id: { [Op.ne]: (this.ref_id ? parseInt(this.ref_id) : 0) },
    } });
    if (count > 0) {
      return { errors : { vendor_name: { message: `Vendor Name (${this.vendor_name}) already exist` } } }
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
    
    if (this.type_id) {
      count = await VendorType.count({ where: { id: this.type_id }});
      if (count === 0) {
        return { errors : { type_id: { message: `Vendor Type does not exist` } } };
      }
    }
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}

export default Vendor;