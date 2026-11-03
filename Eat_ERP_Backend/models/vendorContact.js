import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';

import Vendor from './vendor.js';

const VendorContact = sequelize.define('vendor_contacts', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  vendor_id: {
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

// VendorContact.belongsTo(Vendor);

VendorContact.prototype.getRequestData = function(vendorContact) {
  // try {
    this.vendor_id = vendorContact.vendor_id;
    this.contact_person = vendorContact.contact_person;
    this.email_id = vendorContact.email_id;
    this.mobile = vendorContact.mobile;
  // } catch (error) {
  //   return error;
  // }
}

VendorContact.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    return null;
  // } catch (error) {
  //   return error;
  // }
}

export default VendorContact;