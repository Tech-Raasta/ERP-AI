// const { Schema, model, models } = require("mongoose");
const Sequelize = require("sequelize");
const sequelize = require('../lib/database');

const Section = sequelize.define('section_master', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  section: Sequelize.STRING,
  base_url: Sequelize.STRING,
  type: Sequelize.STRING,
  r_view: Sequelize.BOOLEAN,
  r_insert: Sequelize.DATE,
  r_edit: Sequelize.DATE,
  r_delete: Sequelize.STRING,
  r_approvals: Sequelize.STRING,
  r_export: Sequelize.STRING,
  status: Sequelize.STRING,
  remarks: Sequelize.STRING,
  // created_by: Sequelize.INTEGER,
  // created_on: Sequelize.DATE,
  // modified_by: Sequelize.INTEGER,
  // modified_on: Sequelize.DATE,
  // approved_by: Sequelize.INTEGER,
  // approved_on: Sequelize.DATE,
  // rejected_by: Sequelize.INTEGER,
  // rejected_on: Sequelize.DATE
}, 
{
  // timestamps: false,
  freezeTableName: true
});

module.exports = Section;

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