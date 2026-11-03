import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
// import { calculateItemAmount } from '../lib/common.js';

// import PurchaseOrder from './purchaseOrder.js';
// import RawMaterial from './rawMaterial.js';
import Box from './box.js';
import RecipeVariation from './recipeVariation.js';
import { round } from '../lib/common.js';
import Depot from './depot.js';
// import RawMaterialInItem from './rawMaterialInItem.js';
// import Production from './production.js';

const ProductionTransfer = sequelize.define('production_transfer', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  production_id: {
    type: DataTypes.INTEGER,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  box_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  variation_qty: DataTypes.DOUBLE,
  qty: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  grams: DataTypes.DOUBLE,
  total_kg: DataTypes.DOUBLE,
  primary_packaging_id: DataTypes.INTEGER,
  primary_qty: DataTypes.DOUBLE,
  primary_packaging_qty: DataTypes.DOUBLE,
  secondary_packaging_id: DataTypes.INTEGER,
  secondary_qty: DataTypes.DOUBLE,
  secondary_packaging_qty: DataTypes.DOUBLE,
  depot_id: {
    type: DataTypes.INTEGER,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  doc_document: {
    type: DataTypes.STRING
  },
  document_name: {
    type: DataTypes.STRING
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'Pending'
  },
  depot_transfer_id: DataTypes.INTEGER,
  modified_on: DataTypes.DATE,
  approved_on: DataTypes.DATE,
  uploaded_to_easyecom: DataTypes.TINYINT,
  uploaded_by: DataTypes.INTEGER,
  uploaded_on: DataTypes.DATE,
  uploaded_qty: DataTypes.DOUBLE,
}, 
{ 
  timestamps: false,
  freezeTableName: true
});

// ProductionTransfer.belongsTo(Production, { foreignKey: "production_id", as: "Production" });
ProductionTransfer.belongsTo(Box, { foreignKey: "box_id", as: "box" });
// ProductionTransfer.hasMany(RawMaterialInItem, { foreignKey: "po_item_id", as: "rawMaterialInItems" });

ProductionTransfer.prototype.getRequestData = function(productionTransfer) {
  // try {
    // this.production_id = productionTransfer.production_id;
    this.box_id = productionTransfer.box_id;
    this.depot_id = productionTransfer.depot_id;
    this.qty = productionTransfer.qty;
    this.grams = productionTransfer.grams;
    this.total_kg = productionTransfer.total_kg;
    this.doc_document = productionTransfer.doc_document;
    this.document_name = productionTransfer.document_name;
    this.status = productionTransfer.status;
    this.depot_transfer_id = productionTransfer.depot_transfer_id;
    this.modified_on = new Date().toISOString()
  // } catch (error) {
  //   return error;
  // }
}

ProductionTransfer.prototype.setVariationDetails = async function() {
    const recipeVariation = await RecipeVariation.findOne({ where: { box_id: this.box_id } });
    
    if (recipeVariation) {
      this.variation_qty = recipeVariation.variation_qty ? recipeVariation.variation_qty : 0;
      this.primary_packaging_id = recipeVariation.primary_packaging_id ? recipeVariation.primary_packaging_id : null;
      this.primary_qty = recipeVariation.primary_qty ? recipeVariation.primary_qty : 0;
      // this.primary_packaging_qty = recipeVariation.primary_packaging_qty ? recipeVariation.primary_packaging_qty : 0;
      this.secondary_packaging_id = recipeVariation.secondary_packaging_id ? recipeVariation.secondary_packaging_id : null;
      this.secondary_qty = recipeVariation.secondary_qty ? recipeVariation.secondary_qty : 0;
      // this.secondary_packaging_qty = recipeVariation.secondary_packaging_qty ? recipeVariation.secondary_packaging_qty : 0;
    }

    // this.primary_packaging_qty = round(this.qty * this.primary_qty, 4);
    this.primary_packaging_qty = 0;
    // this.secondary_packaging_qty = round(this.qty * this.secondary_qty, 4);
    this.secondary_packaging_qty = 0;

    const box = await Box.findByPk(this.box_id);
    if (box) {
      this.grams = box.grams ? box.grams : 0;
      this.total_kg = ((this.grams * this.qty) / 1000);
    }
}

ProductionTransfer.prototype.approve = function(req) {
  // try {
    if (this.status === "Deleted") {
      this.status = "InActive";
    } else {
      this.status = "Approved";
      this.approved_on = new Date().toISOString();
    }

    // if (req && req.body && req.body.remarks) {
    //   this.remarks = req.body.remarks;
    // } else {
    //   this.remarks = '';
    // }
    // this.approved_by = req.userData.userId;
    // this.approved_on = new Date().toISOString();

    return null;
  // } catch (error) {
  //   return error;
  // }
}

ProductionTransfer.prototype.reject = function(req) {
  // try {
    this.status = "Rejected";
    // if (req && req.body && req.body.remarks) {
    //   this.remarks = req.body.remarks;
    // } else {
    //   this.remarks = '';
    // }
    // this.rejected_by = req.userData.userId;
    // this.rejected_on = new Date().toISOString();

    return null;
  // } catch (error) {
  //   return error;
  // }
}

ProductionTransfer.prototype.syncToEasyEcom = function() {

    this.uploaded_to_easyecom = 1;
    this.uploaded_on = new Date().toISOString();
}

ProductionTransfer.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    let count = 0;
    count = await Box.count({ where: { id: this.box_id }});
    if (count === 0) {
      return { errors : { box_id: { message: `Box does not exist` } } };
    }

    // count = await Depot.count({ where: { id: this.depot_id }});
    // if (count === 0) {
    //   return { errors : { depot_id: { message: `Depot does not exist` } } };
    // }

    // const box = await Box.findByPk(this.box_id);
    // if (!box) {
    //   return { errors : { box_id: { message: `Box does not exist` } } };
    // } else {
    //   this.grams = box.grams;
    //   this.total_grams = this.qty * this.grams;
    // }
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}

export default ProductionTransfer;