import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';
// const bcrypt = require("bcryptjs");
import jwt from 'jsonwebtoken';
// import config from 'config';
import dotenv from 'dotenv';

import UserRole from './userRole.js';
import UserRoleOptions from './userRoleOptions.js';

dotenv.config();

// Admin and Super Admin can always manage users and roles; other roles need the 'User' / 'User_Roles' sections
export const USER_ADMIN_ROLES = [1, 14];

const User = sequelize.define('user_master', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  first_name: DataTypes.STRING,
  middle_name: DataTypes.STRING,
  last_name: DataTypes.STRING,
  company: DataTypes.STRING,
  dob: DataTypes.DATE,
  anniversary_date: DataTypes.DATE,
  gender: DataTypes.STRING,
  designation: DataTypes.STRING,
  guardian: DataTypes.STRING,
  relation: DataTypes.STRING,
  address: DataTypes.STRING,
  landmark: DataTypes.STRING,
  city: DataTypes.STRING,
  pincode: DataTypes.STRING,
  state: DataTypes.STRING,
  country: DataTypes.STRING,
  email_id: DataTypes.STRING,
  email_id2: DataTypes.STRING,
  password: DataTypes.STRING,
  role_id: DataTypes.INTEGER,
  mobile: DataTypes.STRING,
  mobile2: DataTypes.STRING,
  pan_card: DataTypes.STRING,
  status: DataTypes.STRING,
  remarks: DataTypes.STRING,
  created_by: DataTypes.INTEGER,
  created_on: DataTypes.DATE,
  modified_by: DataTypes.INTEGER,
  modified_on: DataTypes.DATE,
  approved_by: DataTypes.INTEGER,
  approved_on: DataTypes.DATE,
  rejected_by: DataTypes.INTEGER,
  rejected_on: DataTypes.DATE,
  sales_rep_id: DataTypes.INTEGER,
  group_id: DataTypes.INTEGER,
  emp_code: DataTypes.STRING,
  show_favourites: DataTypes.TINYINT,
  favourites: DataTypes.JSONB,
  in_time: DataTypes.STRING,
  start_day: DataTypes.TINYINT,
  depot_ids: DataTypes.STRING(500),
  expiry_date:DataTypes.DATE
},
{
  timestamps: false,
  freezeTableName: true
});

User.belongsTo(UserRole, { foreignKey: "role_id", as: "role" });
// User.belongsToMany(UserRoleOptions, { through: 'user_role_master', foreignKey: "role_id", as: "roleOptions" });

// A 15-minute access token (lib/authTokens.js); the session itself lives in the refresh cookie
User.prototype.generateAuthToken = function(sid) {
  return jwt.sign(
    { email: this.email_id, userName: this.first_name, userId: this.id, userRoleId: this.role_id, typ: 'access', ...(sid ? { sid } : {}) },
    process.env.JWTKEY,
    { expiresIn: '15m' }
  );
}

User.prototype.getUserRoleDetails = async function() {
  const userRoleOptions = await UserRoleOptions.findAll({ where: { role_id: this.role_id, r_view: 1 } });
  const roleDetails = {
    master: 0,
    product: 0,
    category: 0,
    vendor: 0,
    depot: 0,
    box: 0,
    cityMaster: 0,
    batchMaster: 0,
    recipeMaster: 0,
    salesRep: 0,
    distributor: 0,
    distributorType: 0,
    zone: 0,
    area: 0,
    vendorType: 0,
    salesOut: 0,
    salesReturn: 0,
    endOfMonthSales: 0,
    payment: 0,
    creditDebitNote: 0,
    user: 0,
    userRoles: 0,
    userGroup: 0,
    attendance: 1,
    rawMaterial: 0,
    packagingMaterial: 0,
    transaction: 0,
    purchaseOrder: 0,
    goodsReceivedNote: 0,
    invoiceProcessing: 0,
    financeVoucher: 0,
    vendorPayment: 0,
    batchProcessing: 0,
    productionManager: 0,
    productionFloorManager: 0,
    storeManager: 0,
    productionDashboard: 0,
    depotTransfer: 0,
    reports: 0
  };

  for (const userRoleOption of userRoleOptions) {
    if (userRoleOption.section === 'Product') {
      roleDetails.product = 1;
      roleDetails.category = 1;
    } else if (userRoleOption.section === 'Vendors') {
      roleDetails.vendor = 1;
    } else if (userRoleOption.section === 'Depot') {
      roleDetails.depot = 1;
    } else if (userRoleOption.section === 'Box') {
      roleDetails.box = 1;
    } else if (userRoleOption.section === 'Distributor_Out') {
      roleDetails.salesOut = 1;
    } else if (userRoleOption.section === 'Distributor_In') {
      roleDetails.salesReturn = 1;
    } else if (userRoleOption.section === 'Vendor_Type') {
      roleDetails.vendorType = 1;
    } else if (userRoleOption.section === 'Area') {
      roleDetails.area = 1;
    } else if (userRoleOption.section === 'Zone') {
      roleDetails.zone = 1;
    } else if (userRoleOption.section === 'Distributor_Type') {
      roleDetails.distributorType = 1;
    } else if (userRoleOption.section === 'Distributor') {
      roleDetails.distributor = 1;
    } else if (userRoleOption.section === 'Sales_Rep') {
      roleDetails.salesRep = 1;
    } else if (userRoleOption.section === 'Ingredient_Master') {
      roleDetails.recipeMaster = 1;
    } else if (userRoleOption.section === 'Batch_Master') {
      roleDetails.batchMaster = 1;
    } else if (userRoleOption.section === 'City_Master') {
      roleDetails.cityMaster = 1;
    } else if (userRoleOption.section === 'Raw_Material') {
      roleDetails.rawMaterial = 1;
      roleDetails.packagingMaterial = 1;
    } else if (userRoleOption.section === 'Purchase_Order') {
      roleDetails.purchaseOrder = 1;
    } else if (userRoleOption.section === 'Raw_Material_In') {
      roleDetails.goodsReceivedNote = 1;
      roleDetails.invoiceProcessing = 1;
      roleDetails.storeManager = 1;
    } else if (userRoleOption.section === 'Finance_Voucher') {
      roleDetails.financeVoucher = 1;
    } else if (userRoleOption.section === 'Vendor_Payment') {
      roleDetails.vendorPayment = 1;
    } else if (userRoleOption.section === 'Payment') {
      // Transaction -> Bank -> Payment Details (old PHP Payment)
      roleDetails.payment = 1;
    } else if (userRoleOption.section === 'User') {
      // User -> User (old PHP User)
      roleDetails.user = 1;
    } else if (userRoleOption.section === 'User_Roles') {
      // User -> User Roles (old PHP User_roles)
      roleDetails.userRoles = 1;
    } else if (userRoleOption.section === 'Credit_Debit_Note') {
      // Transaction -> Bank -> Credit Debit Note (old PHP Credit_debit_note)
      roleDetails.creditDebitNote = 1;
    } else if (userRoleOption.section === 'Batch_Processing') {
      roleDetails.batchProcessing = 1;
      roleDetails.productionFloorManager = 1;

      if (userRoleOption.r_approvals) {
        roleDetails.productionManager = 1;
      }
    } else if (userRoleOption.section === 'Depot_Transfer') {
      roleDetails.depotTransfer = 1;
    } else if (userRoleOption.section === 'Reports') {
      roleDetails.reports = 1;
    }
  }

  if (roleDetails.product || roleDetails.category || roleDetails.vendor || roleDetails.depot || roleDetails.box || roleDetails.cityMaster || roleDetails.batchMaster || roleDetails.recipeMaster || roleDetails.salesRep || roleDetails.distributor || roleDetails.distributorType || roleDetails.zone || roleDetails.area || roleDetails.vendorType || roleDetails.rawMaterial || roleDetails.packagingMaterial || roleDetails.financeVoucher) {
    roleDetails.master = 1;
  }
  if (USER_ADMIN_ROLES.includes(+this.role_id)) {
    roleDetails.user = 1;
    roleDetails.userRoles = 1;
  }
  // The User menu shows for either of its screens
  if (roleDetails.user || roleDetails.userRoles) {
    roleDetails.userGroup = 1;
  }
  // End of Month Sales (old PHP Freezed) is for the Admin role only
  if (+this.role_id === 1) {
    roleDetails.endOfMonthSales = 1;
  }
  if (roleDetails.purchaseOrder || roleDetails.salesOut || roleDetails.salesReturn || roleDetails.endOfMonthSales || roleDetails.payment || roleDetails.creditDebitNote || roleDetails.goodsReceivedNote || roleDetails.invoiceProcessing || roleDetails.financeVoucher || roleDetails.vendorPayment || roleDetails.batchProcessing || roleDetails.depotTransfer) {
    roleDetails.transaction = 1;
  }
  if (roleDetails.productionManager || roleDetails.productionFloorManager || roleDetails.storeManager) {
    roleDetails.productionDashboard = 1;
  }
  // The Reports menu only for a role that can open at least one report
  if (roleDetails.reports) {
    const { reportAccess } = await import('../lib/reports/access.js');
    const { reports, screens } = await reportAccess(+this.role_id, USER_ADMIN_ROLES.includes(+this.role_id));
    roleDetails.reports = reports.length || screens.length ? 1 : 0;
  }

  return roleDetails;
}

// module.exports = User;
export default User;

// userSchema.methods.getRequestData = async function(req) {
//   try {
//     this.userName = req.body.userName;
//     this.email = req.body.email;
//     this.userRole = req.body.userRole;
//     this.remarks = req.body.remarks;
//     this.status = 'Approved';

//     if (req.body.password) {
//       this.password = await bcrypt.hash(req.body.password, 10);
//     }
//   } catch (error) {
//     return error;
//   }
// }

// userSchema.methods.validateData = async function() {
//   try {
//     const error = await this.validate().then(() => null, error => error);
//     if (error) {
//       return error;
//     }

//     let count = await models.User.countDocuments({ userName: this.userName, _id: { $ne: this._id } });
//     if (count > 0) {
//       return { errors : { userName: { message: `Two users cannot share the same userName (${this.userName})` } } }
//     }

//     if (this.email) {
//       count = await models.User.countDocuments({ email: this.email, _id: { $ne: this._id } });
//       if (count > 0) {
//         return { errors : { userName: { message: `Two users cannot share the same email (${this.email})` } } }
//       }
//     }

//     if (this.userRole) {
//       count = await models.UserRole.countDocuments({ _id: this.userRole });
//       if (count === 0) {
//         return { errors : { userRole: { message: `UserRole does not exist` } } }
//       }
//     }

//     return null;
//   } catch (error) {
//     return error;
//   }
// }

// module.exports = model("User", userSchema);
