import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';

const AccountGroupMaster = sequelize.define('account_group_master', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  group_name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  fk_id: {
    type: DataTypes.INTEGER,
  },
  status: DataTypes.STRING,
  // remarks: DataTypes.STRING,
  created_by: DataTypes.INTEGER,
  created_date: DataTypes.DATE,
  updated_by: DataTypes.INTEGER,
  updated_date: DataTypes.DATE,
  flag: DataTypes.INTEGER
}, 
{ 
  // timestamps: false,
  createdAt: 'created_date',
  updatedAt: 'updated_date',
  freezeTableName: true 
});

AccountGroupMaster.prototype.validateData = async function() {
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

export default AccountGroupMaster;