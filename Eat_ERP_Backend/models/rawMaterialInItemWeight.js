import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
import { round } from '../lib/common.js';
// import RawMaterialIn from './rawMaterialIn.js';

// import RawMaterial from './rawMaterial.js';
// import PurchaseOrderItem from './purchaseOrderItem.js';

const RawMaterialInItemWeight = sequelize.define('raw_material_in_item_weights', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  raw_material_in_id: {
    type: DataTypes.INTEGER,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  vendor_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  raw_material_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  gross_weight: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  net_weight: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  difference: DataTypes.DOUBLE,
  expiry_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  barcode: DataTypes.STRING
}, 
{ 
  timestamps: false,
  freezeTableName: true
});

// RawMaterialInItemWeight.belongsTo(RawMaterialIn, { foreignKey: "raw_material_in_id", as: "RawMaterialIn" });
// RawMaterialInItemWeight.belongsTo(RawMaterial, { foreignKey: "item_id", as: "RawMaterial" });

RawMaterialInItemWeight.prototype.getRequestData = function(rawMaterialInItemWeight) {
  // try {
    this.raw_material_in_id = rawMaterialInItemWeight.raw_material_in_id;
    // this.vendor_id = rawMaterialInItemWeight.vendor_id;
    this.raw_material_id = rawMaterialInItemWeight.raw_material_id;
    this.gross_weight = rawMaterialInItemWeight.gross_weight;
    this.net_weight = rawMaterialInItemWeight.net_weight;
    this.difference = round(rawMaterialInItemWeight.gross_weight - rawMaterialInItemWeight.net_weight, 2);
    this.expiry_date = rawMaterialInItemWeight.expiry_date;
    // this.barcode = rawMaterialInItemWeight.barcode;
  // } catch (error) {
  //   return error;
  // }
}

RawMaterialInItemWeight.prototype.setRawMaterialInItemWeightDetails = function() {
  // try {
    const expiry_date = new Date(this.expiry_date);
    const year = expiry_date.getFullYear().toString().substring(2);
    const month = (expiry_date.getMonth() + 1).toString().padStart(2,"0");
    const date = expiry_date.getDate().toString().padStart(2,"0");

    this.difference = round(this.gross_weight - this.net_weight, 2);
    this.barcode = this.raw_material_in_id.toString().padStart(4,"0") + 
      this.vendor_id.toString().padStart(4,"0") + 
      this.raw_material_id.toString().padStart(4,"0") + 
      year + month + date;
  // } catch (error) {
  //   return error;
  // }
}

RawMaterialInItemWeight.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    // let count = 0;
    // count = await PurchaseOrderItem.count({ where: { id: this.po_item_id }});
    // if (count === 0) {
    //   return { errors : { po_item_id: { message: `Purchase Order Item does not exist` } } };
    // }
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}

export default RawMaterialInItemWeight;