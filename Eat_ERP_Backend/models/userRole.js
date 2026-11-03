import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';

import UserRoleOptions from './userRoleOptions.js';
// const UserRoleOptions = require('./userRoleOptions');

const UserRole = sequelize.define('user_role_master', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  role_name: DataTypes.STRING,
  description: DataTypes.STRING,
  status: DataTypes.STRING,
  created_by: DataTypes.INTEGER,
  created_on: DataTypes.DATE,
  modified_by: DataTypes.INTEGER,
  modified_on: DataTypes.DATE
}, 
{
  timestamps: false,
  freezeTableName: true
});

UserRole.hasMany(UserRoleOptions, { foreignKey: 'role_id', as: 'sections' });

// module.exports = UserRole;
export default UserRole;

// const userRoleSchema = Schema({
//   roleName: {
//     type: String,
//     required: true,
//     trim: true,
//     unique: true
//   },
//   sections: {
//     type: [sectionSchema],
//     required: true,
//     // unique: false
//   },
//   remarks: {
//     type: String,
//     // required: true
//   },
//   status: {
//     type: String,
//     required: true
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

// userRoleSchema.methods.getRequestData = async function(req) {
//   try {
//     this.roleName = req.body.roleName;
//     this.remarks = req.body.remarks;

//     const sections = [];

//     for (const postedSection of req.body.sections) {
//       const section = await models
//                               .Section
//                               .findById(postedSection._id)
//                               .select('_id sectionName baseUrl type view insert update delete approve download');

//       if (section) {
//         section.view = postedSection.view;
//         section.insert = postedSection.insert;
//         section.update = postedSection.update;
//         section.delete = postedSection.delete;
//         section.approve = postedSection.approve;
//         section.download = postedSection.download;

//         sections.push(section);
//       }
//     }

//     this.sections = sections;
    
//   } catch (error) {
//     return error;
//   }
// }

// userRoleSchema.methods.validateData = async function() {
//   try {
//     const error = await this.validate().then(() => null, error => error);
//     if (error) {
//       return error;
//     }

//     let count = await models.UserRole.countDocuments({ roleName: this.roleName, _id: { $ne: this._id } });
//     if (count > 0) {
//       return { errors : { roleName: { message: `Two userRoles cannot share the same roleName (${this.roleName})` } } }
//     }

//     if (!this.sections) {
//       return { errors : { sections: { message: `Sections does not exist` } } }
//     }

//     return null;
//   } catch (error) {
//     return error;
//   }
// }

// module.exports = model("UserRole", userRoleSchema);
