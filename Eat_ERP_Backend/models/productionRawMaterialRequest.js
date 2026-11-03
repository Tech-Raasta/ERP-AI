import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';
// import { calculateItemAmount } from '../lib/common.js';

import RawMaterial from './rawMaterial.js';
import Stock from './stock.js';
import ProductionRawMaterial from './productionRawMaterial.js';
import { round } from '../lib/common.js';
// import RawMaterialInItem from './rawMaterialInItem.js';
// import Production from './production.js';

const ProductionRawMaterialRequest = sequelize.define('production_raw_material_request', {
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
  raw_material_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  requested_kg: {
    type: DataTypes.DOUBLE,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  required_kg: {
    type: DataTypes.DOUBLE,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  approved_kg: {
    type: DataTypes.DOUBLE,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  use_production_stock: {
    type: DataTypes.TINYINT
  },
  production_stock_kg: {
    type: DataTypes.DOUBLE
  },
  store_requested_kg: {
    type: DataTypes.DOUBLE
  },
  store_kg: {
    type: DataTypes.DOUBLE
  },
  fifo_not_followed: {
    type: DataTypes.TINYINT
  },
  available_kg:  {
    type: DataTypes.DOUBLE
  }
}, 
{ 
  timestamps: false,
  freezeTableName: true
});

// ProductionRawMaterialRequest.belongsTo(Production, { foreignKey: "production_id", as: "Production" });
ProductionRawMaterialRequest.belongsTo(RawMaterial, { foreignKey: "raw_material_id", as: "rawMaterial" });
// ProductionRawMaterialRequest.hasMany(RawMaterialInItem, { foreignKey: "po_item_id", as: "rawMaterialInItems" });
ProductionRawMaterialRequest.hasMany(ProductionRawMaterial, { foreignKey: "raw_material_request_id", as: "productionRawMaterials", onDelete: 'CASCADE' });

ProductionRawMaterialRequest.prototype.setRequestData = function(productionRawMaterialRequest) {
  // try {
    // this.production_id = productionRawMaterialRequest.production_id;
    this.raw_material_id = productionRawMaterialRequest.raw_material_id;
    this.requested_kg = productionRawMaterialRequest.requested_kg;
    this.required_kg = productionRawMaterialRequest.required_kg;
    this.approved_kg = productionRawMaterialRequest.approved_kg;
    this.use_production_stock = productionRawMaterialRequest.use_production_stock;
    this.production_stock_kg = productionRawMaterialRequest.production_stock_kg;
    this.store_requested_kg = productionRawMaterialRequest.store_requested_kg;
    this.store_kg = productionRawMaterialRequest.store_kg;
    this.fifo_not_followed = productionRawMaterialRequest.fifo_not_followed;
    this.available_kg = productionRawMaterialRequest.available_kg;
  // } catch (error) {
  //   return error;
  // }
}

ProductionRawMaterialRequest.prototype.getRawMaterialStock = async function(depot_id, requested_kg) {
  // try {
    const stocks = await Stock.getStock(depot_id, this.raw_material_id, 'Production Assemble', this.production_id);
    // let balance_qty = recipeDetail.qty_per_batch;
    let balance_qty = requested_kg;
    const depotStock = [];
    
    for (const stock of stocks) {
      let stock_qty = 0;
      if (stock.stock_qty < balance_qty) {
        stock_qty = stock.stock_qty;
        balance_qty = round(balance_qty - stock_qty, 4);
      } else {
        stock_qty = balance_qty;
        balance_qty = 0;
      }

      depotStock.push({
        // raw_material_id: recipeDetail.rm_id,
        raw_material_id: this.raw_material_id, 
        // batch_qty: recipeDetail.qty_per_batch, 
        batch_qty: stock_qty, 
        qty: stock_qty, 
        barcode: stock.barcode,
        expiry_date: stock.expiry_date
      });

      if (balance_qty <= 0) {
        break;
      }
    }
    
    return depotStock;
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

ProductionRawMaterialRequest.prototype.getStoreRawMaterials = function(body) {
  // try {
    const storeRawMaterials = [];
    let store_kg = 0;
    if (body.storeRawMaterials) {
      for (const postedStoreRawMaterial of body.storeRawMaterials) {
        const raw_material_id = (postedStoreRawMaterial.raw_material_id) ? +postedStoreRawMaterial.raw_material_id : null;
        const batch_qty = (postedStoreRawMaterial.batch_qty) ? +postedStoreRawMaterial.batch_qty : 0;
        const qty = (postedStoreRawMaterial.qty) ? +postedStoreRawMaterial.qty : 0;
        const barcode = (postedStoreRawMaterial.barcode) ? postedStoreRawMaterial.barcode : '';
        const expiry_date = (postedStoreRawMaterial.expiry_date) ? postedStoreRawMaterial.expiry_date : null;
        const fifo_not_followed = (postedStoreRawMaterial.fifo_not_followed) ? postedStoreRawMaterial.fifo_not_followed : 0;
  
        const storeRawMaterial = {
          production_id: this.production_id,
          raw_material_id: raw_material_id,
          batch_qty: batch_qty,
          qty: qty,
          barcode: barcode,
          expiry_date: expiry_date,
          fifo_not_followed: fifo_not_followed
        };

        storeRawMaterials.push(storeRawMaterial);
        store_kg = round(store_kg + qty, 4);
      }
    }

    this.store_kg = store_kg;
    
    return storeRawMaterials;
  // } catch (error) {
  //   return error;
  // }
}

// ProductionRawMaterialRequest.prototype.setItemAmount = async function() {
//   // try {
//     const rawMaterial = await RawMaterial.findByPk(this.raw_material_id);
//     if(rawMaterial) {
//       this.hsn_code = rawMaterial.hsn_code;
//       this.tax_per = rawMaterial.tax_per;
//     }

//     const item = calculateItemAmount(this.qty, this.rate, this.tax_per, this.tax_type);

//     this.amount = item.amount;
//     this.cgst_amt = item.cgst_amt;
//     this.sgst_amt = item.sgst_amt;
//     this.igst_amt = item.igst_amt;
//     this.tax_amt = item.tax_amt;
//     this.total_amt = item.total_amt;
//     // this.old_po_rate = productionRawMaterialRequest.old_po_rate;
//   // } catch (error) {
//   //   return error;
//   // }
// }

ProductionRawMaterialRequest.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    let count = 0;
    count = await RawMaterial.count({ where: { id: this.raw_material_id }});
    if (count === 0) {
      return { errors : { raw_material_id: { message: `Raw Material does not exist` } } };
    }
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}

export default ProductionRawMaterialRequest;