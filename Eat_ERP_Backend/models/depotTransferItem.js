import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
import { calculateItemAmount } from '../lib/common.js';

// import PurchaseOrder from './depotTransfer.js';
import RawMaterial from './rawMaterial.js';
import Box from './box.js';
import ComboBox from './comboBox.js';
// import RawMaterialInItem from './rawMaterialInItem.js';

const DepotTransferItem = sequelize.define('depot_transfer_items', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  depot_transfer_id: {
    type: DataTypes.INTEGER,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  type: {
    type: DataTypes.STRING,
    validate: {
      isIn: [['Box', 'Raw Material']],
    }
  },
  item_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  combo_box_id:{
    type: DataTypes.INTEGER,
  },
  item_name: DataTypes.STRING,
  qty: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  batch_no: {
    type: DataTypes.STRING
  },
  expiry_date: {
    type: DataTypes.DATEONLY
  },
  barcode: {
    type: DataTypes.STRING
  }
}, 
{ 
  timestamps: false,
  freezeTableName: true
});

// DepotTransferItem.belongsTo(DepotTransfer, { foreignKey: "depot_transfer_id", as: "DepotTransfer" });
DepotTransferItem.belongsTo(RawMaterial, { foreignKey: "item_id", as: "raw_material" });
// DepotTransferItem.hasMany(RawMaterialInItem, { foreignKey: "po_item_id", as: "rawMaterialInItems" });

DepotTransferItem.prototype.setProductionRawMaterial = function(productionRawMaterial) {
  // try {
    // this.depot_transfer_id = productionRawMaterial.depot_transfer_id;
    this.type = 'Raw Material';
    this.item_id = productionRawMaterial.raw_material_id;
    this.qty = productionRawMaterial.qty;
    this.barcode = productionRawMaterial.barcode.trim();
    this.expiry_date = productionRawMaterial.expiry_date;
  // } catch (error) {
  //   return error;
  // }
}

DepotTransferItem.prototype.setProductionReturn = function(productionReturn) {
  // try {
    // this.depot_transfer_id = productionReturn.depot_transfer_id;
    this.type = 'Raw Material';
    this.item_id = productionReturn.raw_material_id;
    this.qty = productionReturn.qty;
    this.barcode = productionReturn.barcode;
    this.expiry_date = productionReturn.expiry_date;
  // } catch (error) {
  //   return error;
  // }
}

DepotTransferItem.prototype.setPackagingItem = function(packagingItem) {
  // try {
    // this.depot_transfer_id = packagingItem.depot_transfer_id;
    this.type = 'Raw Material';
    this.item_id = packagingItem.raw_material_id;
    this.qty = packagingItem.qty;
    this.barcode = packagingItem.barcode;
    this.expiry_date = packagingItem.expiry_date;
  // } catch (error) {
  //   return error;
  // }
}

DepotTransferItem.prototype.setPackagingReturn = function(packagingReturn) {
  // try {
    // this.depot_transfer_id = packagingReturn.depot_transfer_id;
    this.type = 'Raw Material';
    this.item_id = packagingReturn.raw_material_id;
    this.qty = packagingReturn.qty;
    this.barcode = packagingReturn.barcode;
    this.expiry_date = packagingReturn.expiry_date;
  // } catch (error) {
  //   return error;
  // }
}

DepotTransferItem.prototype.setStoreTransfer = function(productionTransfer) {
  // try {
    // this.depot_transfer_id = productionTransfer.depot_transfer_id;
    this.type = 'Box';
    this.item_id = productionTransfer.box_id;
    this.qty = productionTransfer.qty;
    // this.barcode = productionTransfer.barcode;
    // this.expiry_date = productionTransfer.expiry_date;
  // } catch (error) {
  //   return error;
  // }
}

DepotTransferItem.prototype.getRequestData = function(depotTransferItem) {
  // try {
    // this.depot_transfer_id = depotTransferItem.depot_transfer_id;
    this.type = depotTransferItem.type;
    this.item_id = depotTransferItem.item_id;
    this.qty = depotTransferItem.qty;
    this.expiry_date = depotTransferItem.expiry_date;
    this.barcode = depotTransferItem.barcode;
  // } catch (error) {
  //   return error;
  // }
}

DepotTransferItem.prototype.setItemDetails = async function() {
  // try {
    if (this.type === 'Raw Material') {
      const rawMaterial = await RawMaterial.findByPk(this.item_id);
      if(rawMaterial) {
        this.item_name = rawMaterial.rm_name;
      }
    } else if (this.type === 'Box') {
      const box = await Box.findByPk(this.item_id);
      if(box) {
        this.item_name = box.box_name;
      }
    }
  // } catch (error) {
  //   return error;
  // }
}

DepotTransferItem.prototype.setItemAmount = async function() {
  // try {
    if (this.type === 'Raw Material') {
      const rawMaterial = await RawMaterial.findByPk(this.item_id);
      if(rawMaterial) {
        this.item_name = rawMaterial.rm_name;
      }
    } else if (this.type === 'Box') {
      const box = await Box.findByPk(this.item_id);
      if(box) {
        this.item_name = box.box_name;
      }
    }

    const item = calculateItemAmount(this.qty, this.rate, this.tax_per, this.tax_type);

    this.amount = item.amount;
    this.cgst_amt = item.cgst_amt;
    this.sgst_amt = item.sgst_amt;
    this.igst_amt = item.igst_amt;
    this.tax_amt = item.tax_amt;
    this.total_amt = item.total_amt;
    // this.old_po_rate = depotTransferItem.old_po_rate;
  // } catch (error) {
  //   return error;
  // }
}

DepotTransferItem.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    let count = 0;

    if (this.type === 'Raw Material') {
      count = await RawMaterial.count({ where: { id: this.item_id }});
      if (count === 0) {
        return { errors : { item_id: { message: `Raw Material does not exist` } } };
      }
    } else if (this.type === 'Box') {
      count = await Box.count({ where: { id: this.item_id }});
      if (count === 0) {
        return { errors : { item_id: { message: `Box does not exist` } } };
      }
    } else if (this.type === 'Combo Box') {
      count = await ComboBox.count({ where: { id: this.item_id }});
      if (count === 0) {
        return { errors : { item_id: { message: `Combo Box does not exist` } } };
      }
    }
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}

export default DepotTransferItem;