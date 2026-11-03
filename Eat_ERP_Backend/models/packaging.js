import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';
import moment from 'moment/moment.js';
import { addDays, getDateString, round } from '../lib/common.js';
import uploadBase64 from '../lib/upload-base64.js';
import sendEmail from '../lib/email.js';

import Depot from './depot.js';
import Product from './product.js';
import RawMaterial from './rawMaterial.js';
import User from './user.js';
import Stock from './stock.js';
import Recipe from './recipe.js';
import RecipeDetail from './recipeDetail.js';
// import PackagingAllocation from './packagingAllocation.js';
// import PackagingTransfer from './packagingTransfer.js';
// import PackagingReturn from './packagingReturn.js';
import BatchProcessing from './batchProcessing.js';
import DepotTransfer from './depotTransfer.js';
// import PackagingRetain from './packagingRetain.js';
// import PackagingWaste from './packagingWaste.js';
import PackagingItemRequest from './packagingItemRequest.js';
import PackagingItem from './packagingItem.js';
import PackagingReturn from './packagingReturn.js';

const Packaging = sequelize.define('packaging_details', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  p_id: {
    type: DataTypes.STRING,
  },
  date_of_processing: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  batch_id_as_per_fssai: {
    type: DataTypes.STRING,
  },
  from_date: {
    type: DataTypes.DATEONLY,
  },
  to_date: {
    type: DataTypes.DATEONLY,
  },
  manufacturer_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  depot_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  store_id: {
    type: DataTypes.INTEGER,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  product_id: {
    type: DataTypes.INTEGER,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  requested_kg: {
    type: DataTypes.DOUBLE,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  use_production_stock: DataTypes.TINYINT,
  production_stock_kg: DataTypes.DOUBLE,
  store_requested_kg: DataTypes.DOUBLE,
  store_kg: DataTypes.DOUBLE,
  fifo_not_followed: DataTypes.BOOLEAN,
  total_kg: DataTypes.DOUBLE,
  allocation_pending_kg: DataTypes.DOUBLE,
  output_kg: DataTypes.DOUBLE,
  transferred_kg: DataTypes.DOUBLE,
  retain_kg: DataTypes.DOUBLE,
  return_kg: DataTypes.DOUBLE,
  waste_kg: DataTypes.DOUBLE,
  process_loss: DataTypes.DOUBLE,
  doc_document: DataTypes.STRING,
  document_name: DataTypes.STRING,
  raw_material_request: DataTypes.TINYINT,
  transfer: DataTypes.TINYINT,
  return_raw_material: DataTypes.TINYINT,
  keep_in_production: DataTypes.TINYINT,
  waste_raw_material: DataTypes.TINYINT,
  receive: DataTypes.TINYINT,
  no_of_batch: DataTypes.DOUBLE,
  request_unit: DataTypes.STRING,
  p_type: DataTypes.STRING,
  check_batch_qty: DataTypes.TINYINT,
  transfer_pending: DataTypes.TINYINT,
  production_day: DataTypes.STRING,
  confirm_from_date: {
    type: DataTypes.DATEONLY,
  },
  confirm_to_date: {
    type: DataTypes.DATEONLY,
  },
  p_status: DataTypes.STRING,
  freezed: DataTypes.TINYINT,
  batch_master: DataTypes.TINYINT,
  production_details: DataTypes.TINYINT,
  bar_conversion: DataTypes.TINYINT,
  depot_transfer: DataTypes.TINYINT,
  documents_upload: DataTypes.TINYINT,
  raw_material_recon: DataTypes.TINYINT,
  report_approved: DataTypes.TINYINT,
  batch_rivision: DataTypes.TINYINT,
  report_status: DataTypes.STRING,
  request_remarks: DataTypes.STRING,
  confirmation_remarks: DataTypes.STRING,
  confirm_batch_remarks: DataTypes.STRING,
  confirm_raw_material_remarks: DataTypes.STRING,
  report_remarks: DataTypes.STRING,
  batch_confirm_date: DataTypes.DATEONLY,
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
  ref_id: DataTypes.INTEGER,
  requisition_id: DataTypes.INTEGER,
  allocations: DataTypes.TEXT
}, 
{ 
  timestamps: false,
  // createdAt: 'created_on',
  // updatedAt: 'modified_on',
  freezeTableName: true
});

Packaging.belongsTo(Depot, { foreignKey: "manufacturer_id", as: "manufacturer" });
Packaging.belongsTo(Product, { foreignKey: "product_id", as: "product" });
Packaging.belongsTo(Depot, { foreignKey: "depot_id", as: "depot" });
Packaging.belongsTo(Depot, { foreignKey: "store_id", as: "store" });
// PackagingItem.belongsTo(Packaging, { foreignKey: "batch_processing_id", as: "batch_processing" });
// PackagingOtherCharge.belongsTo(Packaging, { foreignKey: "batch_processing_id", as: "batch_processing" });
// PackagingItem.belongsTo(RawMaterial, { foreignKey: "item_id", as: "raw_material" });
Packaging.hasMany(PackagingItem, { foreignKey: "packaging_id", as: "packagingItems", onDelete: 'CASCADE' });
Packaging.hasMany(PackagingItemRequest, { foreignKey: "packaging_id", as: "packagingItemRequests", onDelete: 'CASCADE' });
// Packaging.hasMany(PackagingAllocation, { foreignKey: "packaging_id", as: "packagingAllocations", onDelete: 'CASCADE' });
// Packaging.hasMany(PackagingTransfer, { foreignKey: "packaging_id", as: "packagingTransfers", onDelete: 'CASCADE' });
// Packaging.hasMany(PackagingRetain, { foreignKey: "packaging_id", as: "packagingRetains", onDelete: 'CASCADE' });
Packaging.hasMany(PackagingReturn, { foreignKey: "packaging_id", as: "packagingReturns", onDelete: 'CASCADE' });
// Packaging.hasMany(PackagingWaste, { foreignKey: "packaging_id", as: "packagingWastes", onDelete: 'CASCADE' });
// Packaging.hasMany(BatchProcessing, { foreignKey: "packaging_id", as: "packagingBatchProcessing", onDelete: 'CASCADE' });
Packaging.hasMany(DepotTransfer, { foreignKey: "packaging_id", as: "packagingDepotTransfer", onDelete: 'CASCADE' });
// Packaging.hasMany(PackagingOtherCharge, { foreignKey: "batch_processing_id", as: "PackagingOtherCharges", onDelete: 'CASCADE' });
// RawMaterial.hasMany(PackagingItem, { foreignKey: "item_id", as: "PackagingItems" });
// Packaging.belongsToMany(RawMaterial, { through : PackagingItem, as: "raw_material", foreignKey: 'batch_processing_id' });
// RawMaterial.belongsToMany(Packaging, { through : PackagingItem, as: "batch_processing", foreignKey: 'item_id' });
Packaging.belongsTo(User, { foreignKey: "created_by", as: "created_by_user" });
Packaging.belongsTo(User, { foreignKey: "modified_by", as: "modified_by_user" });
Packaging.belongsTo(User, { foreignKey: "approved_by", as: "approved_by_user" });

Packaging.getPackagingDepotList = async function(req) {
  // try {
    let depotCond = { where: {status: 'Approved', type: 'Manufacturer', id: {[Op.in]: req.userData.depotIds}} };

    const depots = await Depot.findAll({ ...depotCond, attributes: ['id', 'depot_name', 'depot_code', 'state'] });
    
    return { depots };
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

Packaging.getRawMaterialDepotList = async function(req) {
  // try {
    let depotCond = { where: {status: 'Approved', type: 'Depot', id: {[Op.in]: req.userData.depotIds}} };

    const depots = await Depot.findAll({ ...depotCond, attributes: ['id', 'depot_name', 'depot_code', 'state'] });
    
    return { depots };
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

Packaging.getPackagingMasterData = async function(Packaging, req) {
  // try {
    let depotCond = { where: {status: 'Approved', type: 'Depot', id: {[Op.in]: req.userData.depotIds}} };
    let packagingMaterialCond = { where: {status: 'Approved', material_type: 'Packaging Material' } };
    
    if (Packaging) {
      if (Packaging.depot_id) {
        depotCond = { where: {[Op.or]: [
          { status: 'Approved', type: 'Depot', id: {[Op.in]: req.userData.depotIds} }, 
          { id: Packaging.depot_id }
        ]} };
      }
      if (Packaging.packagingItemRequests && Packaging.packagingItemRequests.length > 0) {
        const packagingMaterialIds = Packaging.packagingItemRequests.map(item => item.raw_Material_id).join(',');
        packagingMaterialCond = { 
          where: {[Op.or]: [
            { status: 'Approved', material_type: 'Packaging Material' }, 
            { id: {[Op.in]: packagingMaterialIds} }
          ]} };
      }
    }

    const depots = await Depot.findAll({ ...depotCond, attributes: ['id', 'depot_name', 'depot_code', 'state'] });
    const packagingMaterials = await RawMaterial.findAll({ ...packagingMaterialCond, attributes: ['id', 'rm_name'] });
    
    return { depots, packagingMaterials };
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

Packaging.getDepotTotalStock = async function(depot_id, raw_material_id) {
  // try {
    const stock = await Stock.getDepotTotalStock(depot_id, raw_material_id);
    return stock;
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

Packaging.prototype.getManufacturerTotalStock = async function(raw_material_id) {
  // try {
    const depotTransferIds = this.packagingDepotTransfer.map(depotTransfer => depotTransfer.id);

    // const stock = await Stock.getDepotTotalStock(depot_id, raw_material_id);
    const stock = await Stock.sum('stock_quantity', { 
      where: { 
        depot_id: this.manufacturer_id, 
        raw_material_id: raw_material_id, 
        depot_transfer_id: { [Op.notIn]: depotTransferIds },
        packaging_id: { [Op.ne]: this.id }
      } 
    });

    return stock;
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

Packaging.getDepotStock = async function(depot_id, product_id, requested_kg) {
  // try {
    const recipe = await Recipe.findOne({ 
        where: { product_id: product_id },
        include: [
              { 
                model: RecipeDetail, 
                as: "recipeDetails"
              }
            ]
    });

    const depotStock = [];

    if (recipe && recipe.recipeDetails && recipe.recipeDetails.length > 0) {
      for (const recipeDetail of recipe.recipeDetails) {
        const stocks = await Stock.getDepotStock(depot_id, recipeDetail.rm_id);
        // let balance_qty = recipeDetail.qty_per_batch;
        let balance_qty = parseFloat(requested_kg);

        for (const stock of stocks) {
          let stock_qty = parseFloat(stock.stock_qty);

          if (stock_qty <= 0) {
            continue;
          }

          if (stock_qty < balance_qty) {
            balance_qty = round(balance_qty - stock_qty, 4);
          } else {
            stock_qty = balance_qty;
            balance_qty = 0;
          }

          depotStock.push({
            raw_material_id: recipeDetail.rm_id, 
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
      }
    }

    return depotStock;
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

Packaging.getDepotRMStock = async function(depot_id, raw_Material_id, requested_kg) {
  // try {
    const depotStock = [];
    const stocks = await Stock.getDepotStock(depot_id, raw_Material_id);
    // let balance_qty = recipeDetail.qty_per_batch;
    let balance_qty = requested_kg;
    for (const stock of stocks) {
      if (stock.stock_qty <= 0) {
        continue;
      }

      let stock_qty = 0;
      if (stock.stock_qty < balance_qty) {
        stock_qty = stock.stock_qty;
        balance_qty = round(balance_qty - stock_qty, 4);
      } else {
        stock_qty = balance_qty;
        balance_qty = 0;
      }

      depotStock.push({
        raw_material_id: raw_Material_id, 
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

Packaging.prototype.getStock = async function(depot_id, requested_kg) {
  // try {
    const recipe = await Recipe.findOne({ 
        where: { product_id: this.product_id },
        include: [
              { 
                model: RecipeDetail, 
                as: "recipeDetails"
              }
            ]
    });

    const depotStock = [];

    if (recipe && recipe.recipeDetails && recipe.recipeDetails.length > 0) {
      for (const recipeDetail of recipe.recipeDetails) {
        const stocks = await Stock.getStock(depot_id, recipeDetail.rm_id, 'Packaging Assemble', this.id);
        // let balance_qty = recipeDetail.qty_per_batch;
        let balance_qty = requested_kg;
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
            raw_material_id: recipeDetail.rm_id, 
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
      }
    }

    return depotStock;
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

Packaging.prototype.checkBarcode = async function(barcode, returnType) {
  // try {
    const data = {
      raw_material_id: 0,
      qty: 0,
      barcode: barcode,
      expiry_date: null
    }

    const depotTransfer = await DepotTransfer.findOne({ 
      where: { packaging_id: this.id }, 
      include: 'depotTransferItems'
    });

    if (!depotTransfer) {
      return data;
    }
    for (const item of depotTransfer.depotTransferItems) {
      // if (returnType.trim().toUpperCase() === 'WASTE' && item.waste === 1) {
      //   continue;
      // } else if (returnType.trim().toUpperCase() === 'RETAIN' && item.retain === 1) {
      //   continue;
      // } else if (returnType.trim().toUpperCase() === 'RETURN' && item.return === 1) {
      //   continue;
      // }

      if (item.barcode === barcode) {
        data.raw_material_id = item.item_id;
        data.expiry_date = item.expiry_date;
        data.qty = round(data.qty + parseFloat(item.qty), 4);
      }
    }

    // const batchProcessing = await BatchProcessing.findOne({ 
    //   where: { packaging_id: this.id }, 
    //   include: 'batchProcessingItems'
    // });

    // if (!batchProcessing) {
    //   return data;
    // }
    // for (const item of batchProcessing.batchProcessingItems) {
    //   if (returnType.trim().toUpperCase() === 'WASTE' && item.waste === 1) {
    //     continue;
    //   } else if (returnType.trim().toUpperCase() === 'RETAIN' && item.retain === 1) {
    //     continue;
    //   } else if (returnType.trim().toUpperCase() === 'RETURN' && item.return === 1) {
    //     continue;
    //   }

    //   if (item.barcode === barcode) {
    //     data.raw_material_id = item.raw_material_id;
    //     data.expiry_date = item.expiry_date;
    //     data.qty = round(data.qty + parseFloat(item.qty), 4);
    //   }
    // }



    return data;
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

Packaging.prototype.getBarcodeStock = async function(depot_id, barcode) {
  // try {
    const stock = await Stock.getBarcodeStock(depot_id, barcode, 'Packaging Assemble', this.id);
    return stock;
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

Packaging.prototype.getRequestData = function(req) {
  // try {
    const body = req.body ? req.body : null;

    this.production_day = body.production_day ? body.production_day : 'Today';
    // this.date_of_processing = body.date_of_processing ? body.date_of_processing : null;
    this.manufacturer_id = body.manufacturer_id ? +body.manufacturer_id : null;
    this.depot_id = body.depot_id ? +body.depot_id : null;
    // this.product_id = body.product_id ? +body.product_id : null;
    // this.requested_kg = body.requested_kg ? +body.requested_kg : 0;
    // this.use_production_stock = body.use_production_stock ? +body.use_production_stock : 0;
    // this.no_of_batch = body.no_of_batch ? +body.no_of_batch : 1;
    // this.request_unit = body.request_unit ? body.request_unit : 'Kg';
    // this.p_type = body.p_type ? body.p_type : 'Essentials';

    if (this.production_day.trim().toUpperCase() === 'TOMORROW') {
      this.date_of_processing = addDays(new Date().toISOString(), 1);
    } else if (this.production_day.trim().toUpperCase() === 'DAYAFTERTOMORROW') {
      this.date_of_processing = addDays(new Date().toISOString(), 2);
    }

    // if (this.p_type.trim().toUpperCase() === 'OTHER') {
    //   this.use_production_stock = 0;
    //   this.check_batch_qty = 1;
    // }

    // this.production_stock_kg = body.production_stock_kg ? +body.production_stock_kg : 0;
    // this.delivery_date = body.delivery_date ? body.delivery_date : null;
    // this.ref_id = body.ref_id ? +body.ref_id : null;
    // this.status = body.status;
    // this.remarks = body.remarks ? body.remarks.trim() : '';
  // } catch (error) {
  //   // console.log(error);
  //   return error;
  // }
}

// Packaging.prototype.getPackagingNo = function(series) {
//   // try {
//     if (this.p_id) {
//       return this.p_id;
//     }
  
//     const p_id = 'P' + series.toString().padStart(5,"0");;
    
//     this.p_id = p_id;

//     return p_id;
//   // } catch (error) {
//   //   return error;
//   // }
// }

// Packaging.prototype.setBatchNo = async function() {
//   const depot = await Depot.findByPk(this.manufacturer_id);

//   const date_of_processing = new Date(this.date_of_processing);
//   const year = date_of_processing.getFullYear().toString();
//   const month = (date_of_processing.getMonth() + 1).toString().padStart(2,"0");
//   const date = date_of_processing.getDate().toString().padStart(2,"0");
  
//   this.batch_id_as_per_fssai = depot.depot_code + date + month + year;

//   return this.batch_id_as_per_fssai;
// }

// Packaging.prototype.setNoOfBatches = async function() {
//   if (this.p_type.trim().toUpperCase() === 'OTHER' && this.request_unit.trim().toUpperCase() === 'KG') {
//     const recipe = await Recipe.findOne({ where: { product_id: this.product_id } });

//     if (recipe) {
//       const total_kgs = recipe.total_kgs ? parseFloat(recipe.total_kgs) : 1;
//       this.no_of_batch = round((this.requested_kg / total_kgs), 2);
//     }
//   }
// }

Packaging.prototype.getItemRequests = async function(req) {
  const itemRequests = [];
  for (const postedItemRequest of req.body.itemRequests) {
    const raw_Material_id = postedItemRequest.raw_material_id ? +postedItemRequest.raw_material_id : null;
    const requested_kg = postedItemRequest.requested_kg ? +postedItemRequest.requested_kg : 0;

    const itemRequest = {
      packaging_id: this.id,
      raw_material_id: raw_Material_id,
      requested_kg: requested_kg,
      required_kg: requested_kg,
      approved_kg: requested_kg,
      use_production_stock: 0,
      production_stock_kg: 0,
      store_requested_kg: requested_kg,
      store_kg: 0,
      fifo_not_followed: 0,
      available_kg: 0
    }

    itemRequests.push(itemRequest);
  }

  return itemRequests;
}

Packaging.prototype.setPackagingRequestDetails = function(itemRequests) {
  this.requested_kg = 0;

  for (const itemRequest of itemRequests) {
    this.requested_kg += itemRequest.requested_kg;
  }

  this.requested_kg = round(this.requested_kg, 4);
  this.store_requested_kg = round(this.requested_kg, 4);
  this.raw_material_request = 1;
}

Packaging.prototype.getpackagingItemRequests = function(req) {
  // try {
    const body = req.body ? req.body : null;

    const packagingItemRequests = [];
    if (body.rawMaterialRequests) {
      for (const postedRawMaterialRequest of body.rawMaterialRequests) {
        const raw_material_id = (postedRawMaterialRequest.raw_material_id) ? +postedRawMaterialRequest.raw_material_id : null;
        const required_kg = (postedRawMaterialRequest.required_kg) ? +postedRawMaterialRequest.required_kg : 0;
        const requested_kg = (postedRawMaterialRequest.requested_kg) ? +postedRawMaterialRequest.requested_kg : 0;
        const approved_kg = (postedRawMaterialRequest.approved_kg) ? +postedRawMaterialRequest.approved_kg : 0;
        
        const packagingItemRequest = {
          packaging_id: this.id,
          raw_material_id: raw_material_id,
          required_kg: required_kg,
          requested_kg: requested_kg,
          approved_kg: approved_kg,
          use_production_stock: 0,
          production_stock_kg: 0,
          store_requested_kg: 0,
          store_kg: 0,
          fifo_not_followed: 0,
          available_kg: 0
        };

        packagingItemRequests.push(packagingItemRequest);
      }
    }

    return packagingItemRequests;
  // } catch (error) {
  //   return error;
  // }
}

Packaging.prototype.getPackagingItems = function(req) {
  // try {
    const body = req.body ? req.body : null;

    const packagingItemRequests = [];
    if (body.rawMaterialRequests) {
      for (const postedRawMaterialRequest of body.rawMaterialRequests) {
        const id = (postedRawMaterialRequest.id) ? +postedRawMaterialRequest.id : null;
        const use_production_stock = (postedRawMaterialRequest.use_production_stock) ? +postedRawMaterialRequest.use_production_stock : 0;
        const production_stock_kg = (postedRawMaterialRequest.production_stock_kg) ? +postedRawMaterialRequest.production_stock_kg : 0;
        
        const packagingItemRequest = {
          packaging_id: this.id,
          id: id,
          use_production_stock: use_production_stock,
          production_stock_kg: production_stock_kg
        };

        packagingItemRequests.push(packagingItemRequest);
      }
    }

    return packagingItemRequests;
  // } catch (error) {
  //   return error;
  // }
}

Packaging.prototype.setPackagingTotalStock = async function() {
  if (this.use_production_stock) {
    let stock = await Packaging.getDepotTotalStock(this.manufacturer_id, this.product_id);
    // const stock_qty = 0;

    // if (stock && stock.stock) {
    //   stock_qty = stock.stock ? stock.stock : 0;
    //   if (this.requested_kg < stock_qty) {
    //     stock_qty = round(stock_qty - this.requested_kg, 4);
    //   }
    // }

    stock = stock ? +stock : 0;
    // this.production_stock_kg = stock;
    if (stock > this.requested_kg) {
      this.production_stock_kg = this.requested_kg;
      this.store_requested_kg = 0;
      this.total_kg = round(this.requested_kg, 4);
    } else {
      this.production_stock_kg = stock;
      this.store_requested_kg = round(this.requested_kg - this.production_stock_kg, 4);
      this.total_kg = this.production_stock_kg;
    }
  } else {
    this.production_stock_kg = 0;
    this.store_requested_kg = round(this.requested_kg, 4);
    this.total_kg = 0;
  }

  if (this.store_requested_kg > 0) {
    this.raw_material_request = 1;
  }
}

Packaging.prototype.setTotalKg = function() {
  this.total_kg = round(this.production_stock_kg + this.store_kg, 2);
}

Packaging.prototype.setProcessLoss = function() {
  if (this.total_kg > 0) {
    this.process_loss = round((((this.total_kg - this.output_kg - this.retain_kg - this.return_kg - this.waste_kg) / this.total_kg) * 100), 0);
  } else {
    this.process_loss = 0;
  }
}

Packaging.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    let count = 0;
    if (this.depot_id) {
      count = await Depot.count({ where: { id: this.depot_id }});
      if (count === 0) {
        return { errors : { depot_id: { message: `Depot not exist` } } };
      }
    }
    if (this.manufacturer_id) {
      count = await Depot.count({ where: { id: this.manufacturer_id }});
      if (count === 0) {
        return { errors : { depot_id: { message: `Manufacturing depot not exist` } } };
      }
    }
    if (this.store_id) {
      count = await Depot.count({ where: { id: this.store_id }});
      if (count === 0) {
        return { errors : { depot_id: { message: `Store Depot not exist` } } };
      }
    }
    // if (this.product_id) {
    //   count = await Product.count({ where: { id: this.product_id }});
    //   if (count === 0) {
    //     return { errors : { product_id: { message: `Product does not exist` } } };
    //   }
    // }
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}

Packaging.prototype.getStoreRawMaterials = function(body) {
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
          packaging_id: this.id,
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

    this.store_kg = round(store_kg, 2);
    
    return storeRawMaterials;
  // } catch (error) {
  //   return error;
  // }
}

Packaging.prototype.transfer_raw_material = function(req) {
  // try {
    if(req.body.doc_document) {
      const response = uploadBase64(req.body.doc_document, req);
        
      if (response && response.filepath) {
        if (this.doc_document) {
          this.doc_document = this.doc_document + " | " + response.filepath;
        } else {
          this.doc_document = response.filepath;
        }
      }
      if (response && response.filename) {
        if (this.document_name) {
          this.document_name = this.document_name + " | " +  response.filename;
        } else {
          this.document_name = response.filename;
        }
      }
    }
    

    // const body = req.body ? req.body : null;
    // const files = req.files ? req.files : null;

    // if (files && files.doc_document && files.doc_document.length > 0) {
    //   if(this.doc_document) {
    //     this.doc_document = this.doc_document.toString() + ' | ' + files.doc_document.map(doc => doc.path).join(' | ');
    //   } else {
    //     this.doc_document = files.doc_document.map(doc => doc.path).join(' | ');
    //   }
    //   if(this.document_name) {
    //     this.document_name = this.document_name.toString() + ' | ' + files.doc_document.map(doc => doc.filename).join(' | ');
    //   } else {
    //     this.document_name = files.doc_document.map(doc => doc.filename).join(' | ');
    //   }
    // }

    this.raw_material_request = 0;
    this.transfer = 1;
    
  // } catch (error) {
  //   // console.log(error);
  //   return error;
  // }
}

Packaging.prototype.getPackagingAllocations = function(req) {
  // try {
    const body = req.body ? req.body : null;

    const packagingAllocations = [];
    let output_kg = 0;
    if (body.packagingAllocations) {
      for (const postedPackagingAllocation of body.packagingAllocations) {
        const box_id = (postedPackagingAllocation.box_id) ? +postedPackagingAllocation.box_id : null;
        const qty = (postedPackagingAllocation.qty) ? +postedPackagingAllocation.qty : 0;
        const grams = (postedPackagingAllocation.grams) ? +postedPackagingAllocation.grams : 0;
        const total_kg = round(((qty * grams) / 1000), 4);
  
        const packagingAllocation = {
          packaging_id: this.id,
          box_id: box_id,
          qty: qty,
          grams: grams,
          total_kg: total_kg
        };

        packagingAllocations.push(packagingAllocation);
        output_kg = round(output_kg + total_kg, 4);
      }
    }

    this.output_kg = round(output_kg, 2);
    
    return packagingAllocations;
  // } catch (error) {
  //   return error;
  // }
}

Packaging.prototype.getTransfers = function(req) {
  // try {
    const body = req.body ? req.body : null;

    this.store_id = (body.store_id) ? +body.store_id : null;

    const packagingTransfers = [];
    let transferred_kg = 0;
    if (body.packagingTransfers) {
      for (const postedPackagingTransfer of body.packagingTransfers) {
        if (postedPackagingTransfer.id) {
          continue;
        }

        const box_id = (postedPackagingTransfer.box_id) ? +postedPackagingTransfer.box_id : null;
        // const depot_id = (postedPackagingTransfer.depot_id) ? +postedPackagingTransfer.depot_id : null;
        const qty = (postedPackagingTransfer.qty) ? +postedPackagingTransfer.qty : 0;
        const grams = (postedPackagingTransfer.grams) ? +postedPackagingTransfer.grams : 0;
        const total_kg = round(((qty * grams) / 1000), 4);

        let doc_document = '';
        let document_name = '';
        if(postedPackagingTransfer.doc_document) {
          const response = uploadBase64(postedPackagingTransfer.doc_document, req);
            
          if (response && response.filepath) {
            doc_document = response.filepath;
          }
          if (response && response.filename) {
            document_name = response.filename;
          }
        }

        const packagingTransfer = {
          packaging_id: this.id,
          box_id: box_id,
          // depot_id: depot_id,
          // depot_id: store_id,
          qty: qty,
          grams: grams,
          total_kg: total_kg,
          doc_document: doc_document,
          document_name: document_name
        };

        transferred_kg = round(transferred_kg + total_kg, 4);

        packagingTransfers.push(packagingTransfer);
      }
    }

    // packagingTransfers.sort(function(a,b) {
    //   return (a.depot_id - b.depot_id);
    // });
    
    return packagingTransfers;
  // } catch (error) {
  //   return error;
  // }
}

Packaging.prototype.getRetainData = function(req) {
  // try {
    const body = req.body ? req.body : null;

    this.keep_in_production = body.keep_in_production ? +body.keep_in_production : 0;
    let barcode = body.barcode ? body.barcode : '';
    this.retain_kg = body.retain_kg ? +body.retain_kg : 0;

    const packagingRetain = {
      packaging_id: this.id,
      raw_material_id: null,
      qty: this.retain_kg,
      barcode: barcode,
      expiry_date: null
    };
    
    return packagingRetain;
  // } catch (error) {
  //   return error;
  // }
}

Packaging.prototype.getWasteData = function(req) {
  // try {
    const body = req.body ? req.body : null;

    this.waste_raw_material = body.waste_raw_material ? +body.waste_raw_material : 0;
    let barcode = body.barcode ? body.barcode : '';
    this.waste_kg = body.waste_kg ? +body.waste_kg : 0;

    const packagingWaste = {
      packaging_id: this.id,
      raw_material_id: null,
      qty: this.waste_kg,
      barcode: barcode,
      expiry_date: null
    };
    
    return packagingWaste;
  // } catch (error) {
  //   return error;
  // }
}

Packaging.prototype.getReturnData = function(req) {
  // try {
    const body = req.body ? req.body : null;

    this.return_raw_material = body.return_raw_material ? +body.return_raw_material : 0;
    this.receive = 1;

    // this.keep_in_production = body.keep_in_production ? +body.keep_in_production : 0;
    // this.return_raw_material = body.return_raw_material ? +body.return_raw_material : 0;
    // this.waste_raw_material = body.waste_raw_material ? +body.waste_raw_material : 0;

    // if (this.return_raw_material) {
    //   this.receive = 1;
    //   // this.return_kg = 0;
    //   // this.keep_in_production = 0;
    // } else {
    //   // this.receive = 0;
    //   let barcode = body.barcode ? body.barcode : '';
    //   this.return_kg = body.return_kg ? +body.return_kg : 0;

    //   packagingReturn = {
    //     packaging_id: this.id,
    //     raw_material_id: null,
    //     qty: this.return_kg,
    //     barcode: barcode,
    //     expiry_date: null
    //   };
    // }

    // return packagingReturn;

    // if (this.keep_in_production) {
    //   if (!this.barcode) {
    //     return { errors : { keep_in_production: { message: `Select barcode of material to keep in packaging` } } };
    //   } else {
    //     const rawMaterialInItemWeight = await RawMaterialInItemWeight.findOne({ where: { barcode: barcode } });
    //     let raw_material_id = 0;
    //     if (!rawMaterialInItemWeight) {
    //       return { errors : { keep_in_production: { message: `Barcode does not exists` } } };
    //     } else {
    //       raw_material_id = rawMaterialInItemWeight.raw_material_id;
    //     }
    //     const recipe = await Recipe.findOne({ 
    //       where: { product_id: this.product_id },
    //       include: [{ model: RecipeDetail, as: "recipeDetails", where: { rm_id: raw_material_id }, required: true }]
    //     });
    //     if (!recipe) {
    //       return { errors : { keep_in_production: { message: `Barcode Raw material does not belong to current packaging` } } };
    //     }
    //   }
    //   if (!this.return_kg) {
    //     return { errors : { keep_in_production: { message: `Insert quantity to keep in packaging` } } };
    //   }

    //   this.setProcessLoss()
    // } else {
    //   this.receive = 1;
    // }

  // } catch (error) {
  //   return error;
  // }
}

Packaging.prototype.getStoreReturns = function(body) {
  // try {
    const StoreReturns = [];
    if (body.storeReturns) {
      for (const postedStoreReturn of body.storeReturns) {
        const raw_material_id = (postedStoreReturn.raw_material_id) ? +postedStoreReturn.raw_material_id : null;
        const qty = (postedStoreReturn.qty) ? +postedStoreReturn.qty : 0;
        const barcode = (postedStoreReturn.barcode) ? postedStoreReturn.barcode : '';
        const expiry_date = (postedStoreReturn.expiry_date) ? postedStoreReturn.expiry_date : null;
  
        const StoreReturn = {
          packaging_id: this.id,
          raw_material_id: raw_material_id,
          qty: qty,
          barcode: barcode,
          expiry_date: expiry_date
        };

        StoreReturns.push(StoreReturn);
      }
    }

    return StoreReturns;
  // } catch (error) {
  //   return error;
  // }
}

Packaging.prototype.setCancelReceive = function() {
  // try {
    
    this.receive = 0;

    return null;
  // } catch (error) {
  //   return error;
  // }
}

Packaging.prototype.setAllocationPending = function(req) {
  // try {
    this.status = "Allocation_Pending";
    if (req && req.body && req.body.allocation_pending_kg) {
      this.allocation_pending_kg = +req.body.allocation_pending_kg;
    } else {
      this.allocation_pending_kg = 0;
    }
    this.modified_by = req.userData.userId;
    this.modified_on = new Date().toISOString();

    return null;
  // } catch (error) {
  //   return error;
  // }
}

Packaging.prototype.setWorkInProgress = function(req) {
  // try {
    this.status = "Work_In_Progress";
    this.modified_by = req.userData.userId;
    this.modified_on = new Date().toISOString();

    return null;
  // } catch (error) {
  //   return error;
  // }
}

Packaging.prototype.submit = function(req) {
  // try {
    this.status = "Pending";
    if (req && req.body && req.body.remarks) {
      this.remarks = req.body.remarks;
    } else {
      this.remarks = '';
    }
    this.modified_by = req.userData.userId;
    this.modified_on = new Date().toISOString();

    return null;
  // } catch (error) {
  //   return error;
  // }
}

Packaging.prototype.setTransferPending = function() {
  // try {
    if (round(parseFloat(this.transferred_kg), 4) < round(parseFloat(this.output_kg), 4)) {
      this.transfer_pending = 1;
    } else {
      this.transfer_pending = 0;
    }

    return null;
  // } catch (error) {
  //   return error;
  // }
}

Packaging.prototype.approve = function(req) {
  // try {
    if (this.status === "Deleted") {
      this.status = "InActive";
    } else {
      this.status = "Approved";
    }

    if (req && req.body && req.body.remarks) {
      this.remarks = req.body.remarks;
    } else {
      this.remarks = '';
    }
    this.approved_by = req.userData.userId;
    this.approved_on = new Date().toISOString();

    return null;
  // } catch (error) {
  //   return error;
  // }
}

Packaging.prototype.reject = function(req) {
  // try {
    this.status = "InProcess";
    if (req && req.body && req.body.remarks) {
      this.remarks = req.body.remarks;
    } else {
      this.remarks = '';
    }
    this.rejected_by = req.userData.userId;
    this.rejected_on = new Date().toISOString();

    return null;
  // } catch (error) {
  //   return error;
  // }
}

function getPackagingTable(packagings) {
  let table = '';
  let th = '';
  let tr = '';

  th = `<thead><tr>
          <th style="width: 10%;">Date</th>
          <th style="width: 6%;">Status</th>
          <th style="width: 15%;">Depot</th>
          <th style="width: 15%;">Product</th>
          <th style="width: 7%;">Requested</th>
          <th style="width: 7%;">Received</th>
          <th style="width: 6%;">Output</th>
          <th style="width: 7%;">Returned</th>
          <th style="width: 7%;">Retained</th>
          <th style="width: 6%;">Wasted</th>
          <th style="width: 7%;">Process Loss</th>
          <th style="width: 7%;">FIFO Followed</th>
        </tr><thead>`;
  for (const packaging of packagings) {
    tr += `<tr>
            <td>${moment(packaging.date_of_processing).format('DD-MM-YYYY')}</td>
            <td>${packaging.status}</td>
            <td>${packaging.manufacturer.depot_name}</td>
            <td>${packaging.product.product_name}</td>
            <td style="text-align: center;">${packaging.requested_kg}</td>
            <td style="text-align: center;">${packaging.total_kg}</td>
            <td style="text-align: center;">${packaging.output_kg}</td>
            <!-- <td style="text-align: center;">${round(packaging.retain_kg + packaging.return_kg + packaging.waste_kg, 4)}</td> -->
            <td style="text-align: center;">${round(packaging.retain_kg, 4)}</td>
            <td style="text-align: center;">${round(packaging.return_kg, 4)}</td>
            <td style="text-align: center;">${round(packaging.waste_kg, 4)}</td>
            <td style="text-align: center;">${packaging.process_loss}%</td>
            <td style="text-align: center;">${((packaging.fifo_not_followed == 1) ? 'No' : 'Yes' )}</td>
          </tr>`;
  }

  table = `<table class="body_table" border="1px" style="border-collapse: collapse;">
            ${th}
            <tbody>${tr}</tbody>
          </table>`;

  return table;
}

export const sendPackagingDetails = async function(subject, packagings) {
  let table = '<p>No Data found.</p>';

  if (packagings.length > 0) {
    table = getPackagingTable(packagings);
  }

  // let from_email = 'cs@eatanytime.in';
  // let from_email_sender = 'EAT MIS';

  // let date = new Date().toLocaleDateString();
  let date = moment().format('DD/MM/YYYY');
  subject = subject + ' ' + date;

  let message = `<html>
              <head>
                  <style>
                      h3{
                          font-size: 15px;
                          font-family: sans-serif;
                          margin-bottom: 15px;
                      }
                      h4{
                          font-size: 13px;
                          font-family: sans-serif;
                          margin-top: 0;
                      }
                      .body_table{
                          cellspacing:0;
                          font-family:sans-serif
                      }
                      .body_table thead tr{
                          background-color:#cfffff;
                      }
                      .body_table thead tr td {
                          width: 40%;
                          font-weight: bold;
                          padding: 10px;
                          text-align: center;
                      }
                      .body_table tbody tr td{
                          padding: 10px;
                      }
                      .body_table tbody tr td:not(:first-child){
                          text-align:center;
                      }
                      .body_table tbody tr td:last-child{
                          font-weight:bold;
                      }
                  </style>
              </head>
              <body>
                  <!-- <h3>Wholesome Habits Private Limited</h3> -->
                  <h4>${subject}</h4>

                  ${table}

                  <br/><br/>
                  Regards,
                  <br/><br/>
                  CS
              </body>
              </html>`;
  

  const mailOptions = {
    from: 'EAT MIS <cs@eatanytime.in>',
    to: 'product@eatanytime.in, product1@eatanytime.in, prachi.sanghvi@eatanytime.in, orders@eatanytime.in, kumar.devwrat@eatanytime.in',
    cc: 'lakshya.ajmera@eatanytime.in, rishit.sanghvi@eatanytime.in, dhaval.maru@otbconsulting.co.in',
    bcc: 'prasad.bhisale@otbconsulting.co.in',
    // to: 'technology@raastaconsulting.com',
    // cc: 'technology@raastaconsulting.com',
    // bcc: 'technology@raastaconsulting.com',
    // cc: 'dhaval.maru@otbconsulting.co.in',
    // bcc: 'rishit.sanghvi@eatanytime.in',
    subject: subject,
    text: message,
    html: message,
    // attachments: [{ path: paymentFile }]
  };

  // result = await sendEmail(mailOptions);

  return sendEmail(mailOptions);
}

Packaging.mailPackagingDetails = async function(req) {
  const curDate = getDateString(new Date());
  const mailType = req.params.mailType ? req.params.mailType : 'All';

  const packagings = await Packaging.findAll({ 
    where: {
      [Op.or]: [
        { [Op.and]: [
          { date_of_processing: {[Op.lte]: curDate} }, 
          { status: { [Op.in]: ['InProcess', 'Work_In_Progress', 'Pending'] } }
        ] },
        { [Op.and]: [{ date_of_processing: curDate }, { status: { [Op.ne]: 'Allocation_Pending' } }] },
        { approved_on: { [Op.gte]: curDate } }
      ]
    },
    include: [
      { 
        model: PackagingItem, 
        as: "packagingItems", 
        include: [{ model: RawMaterial, as: "rawMaterial", attributes: ['id', 'rm_name'] }]
      }, 
      "packagingAllocations", 
      { model: Product, as: "product", attributes: ['id', 'product_name'] },
      { model: Depot, as: "manufacturer", attributes: ['id', 'depot_name', 'address', 'city', 'pincode', 'state', 'country', 'gst_no'] },
      { model: Depot, as: "depot", attributes: ['id', 'depot_name', 'address', 'city', 'pincode', 'state', 'country', 'gst_no'] },
      { model: Depot, as: "store", attributes: ['id', 'depot_name', 'address', 'city', 'pincode', 'state', 'country', 'gst_no'] },
      { model: User, as: "created_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
      { model: User, as: "modified_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
      { model: User, as: "approved_by_user", attributes: ['id', 'first_name', 'last_name'] }
    ], 
    order: [['date_of_processing', 'ASC']]
  });

  const floorLevelOutstanding = [];
  const workInProgress = [];
  const jobSubmittedPendingHead = [];
  const fifoNotFollowed = [];
  const processLoss = [];
  if (packagings) {
    for (const packaging of packagings) {
      const dateOfProcessing = new Date(packaging.date_of_processing);

      if (packaging.status.trim().toUpperCase() === 'INPROCESS') {
        floorLevelOutstanding.push(packaging);
      } else if ((packaging.status.trim().toUpperCase() === 'PENDING') && (dateOfProcessing < new Date(curDate))) {
        jobSubmittedPendingHead.push(packaging);
      } else if (packaging.status.trim().toUpperCase() === 'WORK_IN_PROGRESS') {
        workInProgress.push(packaging);

        packaging.status = 'InProcess';
        await packaging.save();
      }

      if (packaging.fifo_not_followed) {
        fifoNotFollowed.push(packaging);
      }

      if (packaging.status.trim().toUpperCase() === 'PENDING' || packaging.status.trim().toUpperCase() === 'APPROVED') {
        if (packaging.process_loss && packaging.process_loss > 0) {
          processLoss.push(packaging);
        }
      }
    }
  }

  if (mailType.trim().toUpperCase() === 'ALL') {
    // if (floorLevelOutstanding.length > 0) {
      sendPackagingDetails('Floor Level Outstanding Job', floorLevelOutstanding);
    // }
    if (workInProgress.length > 0) {
      sendPackagingDetails('Work In Progress', workInProgress);
    }
    // if (fifoNotFollowed.length > 0) {
      sendPackagingDetails('FIFO Not Followed', fifoNotFollowed);
    // }
    // if (processLoss.length > 0) {
      sendPackagingDetails('Process Loss', processLoss);
    // }
  } else {
    // if (jobSubmittedPendingHead.length > 0) {
      sendPackagingDetails('Job Submitted Pending Head', jobSubmittedPendingHead);
    // }
  }
}

export default Packaging;