import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';

const AccountLedgerMaster = sequelize.define('account_ledger_master', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  ledger_name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  fk_group_id: {
    type: DataTypes.INTEGER,
  },
  opening_balance: {
    type: DataTypes.DOUBLE,
    defaultValue: 0
  },
  trans_type: {
    type: DataTypes.STRING,
    defaultValue: 'Credit'
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  ledger_type: DataTypes.STRING,
  status: DataTypes.STRING,
  // remarks: DataTypes.STRING,
  created_by: DataTypes.INTEGER,
  created_date: DataTypes.DATE,
  updated_by: DataTypes.INTEGER,
  updated_date: DataTypes.DATE,
  ref_id: DataTypes.INTEGER,
  ref_type: DataTypes.STRING
}, 
{ 
  // timestamps: false,
  createdAt: 'created_date',
  updatedAt: 'updated_date',
  freezeTableName: true 
});

AccountLedgerMaster.prototype.validateData = async function() {
  try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    // let count = await Product.countDocuments({ orderFulfillmentCenterName: this.orderFulfillmentCenterName, _id: { $ne: this._id } });
    // if (count > 0) {
    //   return { errors : { orderFulfillmentCenterName: { message: `Two orderFulfillmentCenters cannot share the same orderFulfillmentCenterName (${this.orderFulfillmentCenterName})` } } }
    // }

    // if (this.asin) {
    //   count = await Product.countDocuments({ asin: this.asin, _id: { $ne: this._id } });
    //   if (count > 0) {
    //     return { errors : { orderFulfillmentCenterName: { message: `Two orderFulfillmentCenters cannot share the same asin (${this.asin})` } } }
    //   }
    // }
    
    // if (this.skuCode) {
    //   count = await Product.countDocuments({ skuCode: this.skuCode, _id: { $ne: this._id } });
    //   if (count > 0) {
    //     return { errors : { orderFulfillmentCenterName: { message: `Two orderFulfillmentCenters cannot share the same skuCode (${this.skuCode})` } } }
    //   }
    // }

    // if (this.category) {
    //   count = await Category.countDocuments({ _id: this.category });
    //   if (count === 0) {
    //     return { errors : { category: { message: `Category does not exist` } } }
    //   }
    // }

    return null;
  } catch (error) {
    return error;
  }
}

export default AccountLedgerMaster;