import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';

import UserRole from '../models/userRole.js';
// const Section = require('./section');

const UserRoleOptions = sequelize.define('user_role_options', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  role_id: DataTypes.INTEGER,
//   section_id: DataTypes.INTEGER,
  section: DataTypes.STRING,
  r_view: DataTypes.INTEGER,
  r_insert: DataTypes.INTEGER,
  r_edit: DataTypes.INTEGER,
  r_delete: DataTypes.INTEGER,
  r_approvals: DataTypes.INTEGER,
  r_export: DataTypes.INTEGER,
  // base_url: DataTypes.STRING,
  // type: DataTypes.STRING
}, 
{
  timestamps: false,
  freezeTableName: true
});

// UserRoleOptions.belongsTo(UserRole, { foreignKey: "role_id", as: "role" });
// UserRoleOptions.belongsTo(Section, { foreignKey: "section_id", as: "section" });

// module.exports = UserRoleOptions;
export default UserRoleOptions;

// const sectionSchema = Schema({
//   sectionName: { 
//     type: String, 
//     required: true,
//     trim: true,
//     // unique: true 
//   },
//   baseUrl: { 
//     type: String, 
//     required: true,
//     trim: true,
//     // unique: true 
//   },
//   type: { 
//     type: String, 
//     required: true,
//     trim: true
//   },
//   view: {
//     type: Boolean,
//     default: false
//   },
//   insert: {
//     type: Boolean,
//     default: false
//   },
//   update: {
//     type: Boolean,
//     default: false
//   },
//   delete: {
//     type: Boolean,
//     default: false
//   },
//   approve: {
//     type: Boolean,
//     default: false
//   },
//   download: {
//     type: Boolean,
//     default: false
//   },
//   status: {
//     type: String
//   },
//   createdBy: {
//     type: Schema.Types.ObjectId,
//     ref: 'User'
//   },
//   updatedBy: {
//     type: Schema.Types.ObjectId,
//     ref: 'User'
//   }
// }, { timestamps: true, collation: { locale: 'en_US', strength: 1 } });

// sectionSchema.methods.getRequestData = function(req) {
//   this.sectionName = req.body.sectionName;
//   this.baseUrl = req.body.baseUrl;
//   this.type = req.body.type;
//   // this.view = false;
//   // this.insert = false;
//   // this.update = false;
//   // this.delete = false;
//   // this.approve = false;
//   // this.download = false;
// }

// sectionSchema.methods.validateData = async function() {
//   try {
//     const error = await this.validate().then(() => null, error => error);
//     if (error) {
//       return error;
//     }

//     let count = await models.Section.countDocuments({ sectionName: this.sectionName, _id: { $ne: this._id } });
//     if (count > 0) {
//       return { errors : { sectionName: { message: `Two sections cannot share the same sectionName (${this.sectionName})` } } }
//     }
    
//     if (this.baseUrl) {
//       count = await models.Depot.countDocuments({ baseUrl: this.baseUrl, _id: { $ne: this._id } });
//       if (count > 0) {
//         return { errors : { depotName: { message: `Two sections cannot share the same Base Url (${this.baseUrl})` } } }
//       }
//     }
    
//     return null;
//   } catch (error) {
//     return error;
//   }
// }

// const Section = model("Section", sectionSchema);

// exports.sectionSchema = sectionSchema;
// exports.Section = Section;