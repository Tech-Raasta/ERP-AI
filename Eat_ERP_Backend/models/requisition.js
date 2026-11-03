import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';
import { round } from '../lib/common.js';

import Depot from './depot.js';
import RawMaterial from './rawMaterial.js';
import RequisitionItem from './requisitionItem.js';
import RequisitionProduct from './requisitionProduct.js';
import Product from './product.js';
import Box from './box.js';
import Sale from './sale.js';
import SaleItem from './saleItem.js';
import Stock from '../lib/stock.js';
import Production from './production.js';

const Requisition = sequelize.define('requisition', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  requisition_date: {
    type: DataTypes.DATE,
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
  depot_name: DataTypes.STRING,
  product_names: DataTypes.STRING,
  item_names: DataTypes.STRING,
  raised: DataTypes.TINYINT,
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
}, 
{ 
  timestamps: false,
  // createdAt: 'created_on',
  // updatedAt: 'modified_on',
  freezeTableName: true
});

Requisition.belongsTo(Depot, { foreignKey: "depot_id", as: "depot" });
RequisitionProduct.belongsTo(Requisition, { foreignKey: "requisition_id", as: "requisition" });
RequisitionProduct.belongsTo(Product, { foreignKey: "product_id", as: "product" });
RequisitionItem.belongsTo(Requisition, { foreignKey: "requisition_id", as: "requisition" });
RequisitionItem.belongsTo(RawMaterial, { foreignKey: "item_id", as: "raw_material" });
RequisitionItem.belongsTo(Box, { foreignKey: "item_id", as: "box" });
RequisitionItem.belongsTo(Depot, { foreignKey: "depot_id", as: "depot" });
Requisition.hasMany(RequisitionProduct, { foreignKey: "requisition_id", as: "requisitionProducts", onDelete: 'CASCADE' });
Requisition.hasMany(RequisitionItem, { foreignKey: "requisition_id", as: "requisitionItems", onDelete: 'CASCADE' });
// RawMaterial.hasMany(RequisitionItem, { foreignKey: "item_id", as: "requisitionItems" });
// Requisition.belongsToMany(RawMaterial, { through : RequisitionItem, as: "raw_material", foreignKey: 'requisition_id' });
// RawMaterial.belongsToMany(Requisition, { through : RequisitionItem, as: "requisition", foreignKey: 'item_id' });
// Requisition.belongsTo(User, { foreignKey: "created_by", as: "created_by_user" });
// Requisition.belongsTo(User, { foreignKey: "modified_by", as: "modified_by_user" });
// Requisition.belongsTo(User, { foreignKey: "approved_by", as: "approved_by_user" });

export const getRequisitionMasterData = async function(requisition, req) {
  // try {
    let depotCond = { where: {status: 'Approved', type: {[Op.in]: ['Manufacturer', 'Depot']}, id: {[Op.in]: req.userData.depotIds}} };
    let boxCond = { where: {status: 'Approved'} };
    // let productCond = { where: {status: 'Approved', category_id: 4 } };
    // let nonEssentialProductCond = { where: {status: 'Approved', category_id: { [Op.ne]: 4 } } };

    if (requisition) {
      if (requisition.depot_id) {
        depotCond = { where: {[Op.or]: [{ status: 'Approved', id: {[Op.in]: req.userData.depotIds} }, { id: requisition.depot_id }]} };
      }
      if (requisition.item_id) {
        boxCond = { where: {[Op.or]: [{ status: 'Approved' }, { id: requisition.item_id }]} };
      }
      // if (requisition.requisitionProducts && requisition.requisitionProducts.length > 0) {
      //   const productIds = requisition.requisitionProducts.map(requisitionProduct => requisitionProduct.item_id);
      //   productCond = { where: {
      //     [Op.or]: [
      //       { status: 'Approved' }, 
      //       { id: { [Op.isIn]: productIds } }
      //     ],
      //     category_id: 4
      //   } };
      //   nonEssentialProductCond = { where: {
      //     [Op.or]: [
      //       { status: 'Approved' }, 
      //       { id: { [Op.isIn]: productIds } }
      //     ],
      //     category_id: { [Op.ne]: 4 }
      //   } };
      // }
    }

    const depots = await Depot.findAll({ ...depotCond, attributes: ['id', 'depot_name', 'state'] });
    const boxes = await Box.findAll({ ...boxCond, attributes: ['id', 'box_name', 'short_name'] });
    // const products = await Product.findAll({ ...productCond, attributes: ['id', 'product_name', 'short_name'] });
    // const nonEssentialProducts = await Product.findAll({ ...nonEssentialProductCond, attributes: ['id', 'product_name', 'short_name'] });
    // const recipes = await Recipe.findAll({ where: { status: 'Approved' } });
    
    // return { depots, boxes, products, nonEssentialProducts, recipes };
    return { depots, boxes };
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

export const getRequisitionItemDetails = async function(req) {
  // try {
    const depot_id = (req.params.depot_id) ? req.params.depot_id : 0;
    
    // let lastRequisitionDate = '2024-04-01 00:00:00';
    let lastRequisitionDate = new Date();
    lastRequisitionDate.setDate(lastRequisitionDate.getDate() - 5);
    // const lastRequisition = await Requisition.findOne({ order: [['requisition_date', 'desc']] });
    // if (lastRequisition) {
    //   lastRequisitionDate = lastRequisition.requisition_date ? lastRequisition.requisition_date : lastRequisitionDate;
    // }

    const depot = await Depot.findByPk(depot_id);

    // const sales = await Sale.findAll({ 
    //   where: { status: 'Approved', depot_id: depot_id, created_on: { [Op.gte]: lastRequisitionDate } }, 
    //   include: [
    //     { model: SaleItem, as: 'saleItems', include: 'box' }
    //   ]
    // });

    const saleItems = await SaleItem.findAll({ 
      include: [
        { 
          model: Sale, 
          as: 'sale', 
          where: { status: 'Approved', depot_id: depot_id, created_on: { [Op.gte]: lastRequisitionDate } }, 
          attributes: ['id'] 
        },
        { model: Box, as: 'box', attributes: ['id', 'box_name', 'short_name', 'moq_inventory', 'moq_production', 'category_id'], include: 'category' }
      ], 
      attributes: [
        'type', 'item_id', 'box.id', 'box.box_name', 'box.short_name', 
        'box.moq_inventory', 'box.moq_production', 'box.category_id', 'box.category.category_name', 
        [sequelize.fn('SUM', sequelize.col('qty')), 'totalQty']
      ],
      group: ['type', 'item_id', 'box.id', 'box.box_name', 'box.short_name', 'box.moq_inventory', 'box.moq_production', 'box.category_id', 'box.category.category_name'],
      order: [['type', 'Asc'], ['item_id', 'Asc']], 
      raw: true
    });

    const requisitionItems = [];
    // for (const sale of sales) {
      for (const item of saleItems) {
        const index = requisitionItems.findIndex(requisitionItem => requisitionItem.item_id === item.item_id);

        if (index !== -1) {
          requisitionItems[index].sales = round(parseFloat(requisitionItems[index].sales) + parseFloat(item.qty), 2);
        } else {
          const stock = new Stock();
          stock.box_id = item.item_id;
          stock.depot_id = depot && depot.id ? depot.id : 0;

          const sales = round(parseFloat(item.totalQty), 2);
          const totalStock = await stock.get_box_stock();
          const inventory = round(parseFloat(totalStock,2) + parseFloat(sales,2), 4);
          const moqInventory = item['box.moq_inventory'] ? parseFloat(item['box.moq_inventory'], 2) : 0;
          const moqProduction = item['box.moq_production'] ? parseFloat(item['box.moq_production'], 2) : 0;
          
          let raiseRequisitionFor = 0;
          if (totalStock < moqInventory) {
            if (totalStock < 0) {
              raiseRequisitionFor = (totalStock * -1) + moqInventory;
            } else {
              raiseRequisitionFor = moqInventory - totalStock;
            }

            if (raiseRequisitionFor < moqProduction) {
              raiseRequisitionFor = moqProduction;
            } else {
              let num = Math.floor(raiseRequisitionFor / moqProduction);
              let num2 = raiseRequisitionFor % moqProduction;

              if (num2 === 0) {
                raiseRequisitionFor = num * moqProduction;
              } else {
                raiseRequisitionFor = (num + 1) * moqProduction;
              }
            }
          }

          requisitionItems.push({
            requisition_id: 0,
            item_id: item.item_id,
            item_name: item['box.box_name'] ? item['box.box_name'] : '',
            category_id: item['box.category_id'] ? item['box.category_id'] : '',
            category_name: item['box.category.category_name'] ? item['box.category.category_name'] : '',
            sales: sales,
            inventory: inventory,
            difference: totalStock,
            moq_inventory: moqInventory,
            moq_production: moqProduction,
            raise_requisition_for: raiseRequisitionFor,
            depot_id: depot && depot.id ? depot.id : 0,
            depot_name: depot && depot.depot_name ? depot.depot_name : 0,
            raise: (raiseRequisitionFor > 0) ? 1 : 0,
            production_status: ''
          });
        }
      }
    // }

    return requisitionItems;
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

export const getRequisitionItemStock = async function(req) {
  // try {
    const depot_id = (req.params.depot_id) ? req.params.depot_id : 0;
    const item_id = (req.params.item_id) ? req.params.item_id : 0;

    const depot = await Depot.findByPk(depot_id);
    const box = await Box.findByPk(item_id, {include: 'category'});

    const stock = new Stock();
    stock.box_id = item_id;
    stock.depot_id = depot_id;

    const sales = 0;
    const totalStock = await stock.get_box_stock();
    const inventory = round(parseFloat(totalStock,2) + parseFloat(sales,2), 4);
    const moqInventory = box && box.moq_inventory ? parseFloat(box.moq_inventory, 2) : 0;
    const moqProduction = box && box.moq_production ? parseFloat(box.moq_production, 2) : 0;
    
    let raiseRequisitionFor = 0;
    if (totalStock < moqInventory) {
      if (totalStock < 0) {
        raiseRequisitionFor = (totalStock * -1) + moqInventory;
      } else {
        raiseRequisitionFor = moqInventory - totalStock;
      }

      if (raiseRequisitionFor < moqProduction) {
        raiseRequisitionFor = moqProduction;
      }
    }

    const requisitionItem = {
      requisition_id: 0,
      item_id: item_id,
      item_name: box && box.box_name ? box.box_name : '',
      category_id: box && box.category_id ? box.category_id : '',
      category_name: box && box.category && box.category.category_name ? box.category.category_name : '',
      sales: sales,
      inventory: inventory,
      difference: totalStock,
      moq_inventory: moqInventory,
      moq_production: moqProduction,
      raise_requisition_for: raiseRequisitionFor,
      depot_id: depot && depot.id ? depot.id : 0,
      depot_name: depot && depot.depot_name ? depot.depot_name : 0,
      raise: (raiseRequisitionFor > 0) ? 1 : 0,
      production_status: ''
    };
    // }

    return requisitionItem;
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

Requisition.prototype.getRequestData = function(req) {
  // try {
    const body = req.body ? req.body : null;

    this.requisition_date = body.requisition_date ? new Date(body.requisition_date).toISOString() : (this.requisition_date ? this.requisition_date : new Date().toISOString());
    this.depot_id = body.depot_id ? +body.depot_id : null;
    // this.delivery_date = body.delivery_date ? body.delivery_date : null;
    // this.ref_id = body.ref_id ? +body.ref_id : null;
    // this.status = body.status;
    this.remarks = body.remarks ? body.remarks.trim() : '';
  // } catch (error) {
  //   // console.log(error);
  //   return error;
  // }
}

Requisition.prototype.getRequisitionItems = function(body) {
  // try {
    const requisitionItems = [];
    if (body.requisitionItems) {
      for (const postedRequisitionItem of body.requisitionItems) {
        const item_id = (postedRequisitionItem.item_id) ? +postedRequisitionItem.item_id : null;
        // const item_desc = (postedRequisitionItem.item_desc) ? postedRequisitionItem.item_desc : '';
        const sales = (postedRequisitionItem.sales) ? +postedRequisitionItem.sales : 0;
        const inventory = (postedRequisitionItem.inventory) ? +postedRequisitionItem.inventory : 0;
        const difference = (postedRequisitionItem.difference) ? +postedRequisitionItem.difference : 0;
        const moq_inventory = (postedRequisitionItem.moq_inventory) ? +postedRequisitionItem.moq_inventory : 0;
        const moq_production = (postedRequisitionItem.moq_production) ? +postedRequisitionItem.moq_production : 0;
        const raise_requisition_for = (postedRequisitionItem.raise_requisition_for) ? +postedRequisitionItem.raise_requisition_for : 0;
        const raise = (postedRequisitionItem.raise) ? +postedRequisitionItem.raise : 0;
        const production_status = (postedRequisitionItem.production_status) ? postedRequisitionItem.production_status : '';
  
        const requisitionItem = {
          requisition_id: this.id,
          item_id: item_id,
          // item_desc: item_desc,
          sales: sales,
          inventory: inventory,
          difference: difference,
          depot_id: this.depot_id,
          moq_inventory: moq_inventory,
          moq_production: moq_production,
          raise_requisition_for: raise_requisition_for,
          raise: raise,
          production_status: production_status
        };

        requisitionItems.push(requisitionItem);
      }
    }
    
    return requisitionItems;
  // } catch (error) {
  //   return error;
  // }
}

Requisition.prototype.getRequisitionItemProducts = async function(requisitionItems) {
  // try {
    const requisitionProducts = [];
    if (requisitionItems) {
      for (const requisitionItem of requisitionItems) {
        if (!requisitionItem.raise) continue;

        const index = requisitionProducts.findIndex(item => item.product_id === requisitionItem.product_id);
        const total_kg = round(parseFloat(requisitionItem.total_grams) / 1000, 4);

        if (index !== -1) {
          requisitionProducts[index].requested_kg = requisitionProducts[index].requested_kg + total_kg;
        } else {
          const product = await Product.findByPk(requisitionItem.product_id);

          let type = 'Essentials';
          if (product && product.category_id && product.category_id !== 4) {
            type = 'Other';
          }

          const allocations = requisitionItems
            .filter(item => item.raise && item.product_id === requisitionItem.product_id)
            .map(item => (item.item_name + ' :- ' + item.raise_requisition_for + ' :- ' + item.mrp + ' :- ' + item.unit_selling_price))
            .join(', ');

          const requisitionProduct = {
            requisition_id: 0,
            type: type,
            product_id: requisitionItem.product_id,
            product_name: product && product.product_name ? product.product_name : '',
            no_of_batch: 1,
            requested_kg: total_kg,
            raise: 1,
            production_status: '',
            allocations: allocations
          }

          requisitionProducts.push(requisitionProduct);
        }
      }
    }
    
    return requisitionProducts;
  // } catch (error) {
  //   return error;
  // }
}

Requisition.prototype.getRequisitionProducts = function(body) {
  // try {
    const requisitionProducts = [];
    if (body.requisitionProducts) {
      for (const postedRequisitionProduct of body.requisitionProducts) {
        const id = (postedRequisitionProduct.id) ? postedRequisitionProduct.id : null;
        // const type = (postedRequisitionProduct.type) ? postedRequisitionProduct.type : 'Other';
        // const product_id = (postedRequisitionProduct.product_id) ? +postedRequisitionProduct.product_id : null;
        // const product_name = (postedRequisitionProduct.product_name) ? postedRequisitionProduct.product_name : '';
        // const no_of_batch = (postedRequisitionProduct.no_of_batch) ? +postedRequisitionProduct.no_of_batch : 0;
        const requested_kg = (postedRequisitionProduct.requested_kg) ? +postedRequisitionProduct.requested_kg : 0;
        // const allocations = (postedRequisitionProduct.allocations) ? postedRequisitionProduct.allocations : '';
        const raise = (postedRequisitionProduct.raise) ? +postedRequisitionProduct.raise : 0;
        const production_status = (postedRequisitionProduct.production_status) ? postedRequisitionProduct.production_status : '';
        const manufacturer_id = (postedRequisitionProduct.manufacturer_id) ? +postedRequisitionProduct.manufacturer_id : null;
  
        const requisitionProduct = {
          id: id,
          requisition_id: this.id,
          // type: type,
          // product_id: product_id,
          // product_name: product_name,
          // no_of_batch: no_of_batch,
          requested_kg: requested_kg,
          // allocations: allocations,
          raise: raise,
          production_status: production_status,
          manufacturer_id: manufacturer_id
        };

        requisitionProducts.push(requisitionProduct);
      }
    }
    
    return requisitionProducts;
  // } catch (error) {
  //   return error;
  // }
}

Requisition.prototype.raiseProduction = async function(requisitionProducts) {
  const items = requisitionProducts.filter(item => item.raise && item.production_status === '' && item.manufacturer_id && item.requested_kg).sort((a,b) => a.product_id-b.product_id);

  const productions = [];
  for (const item of items) {
    const production = await Production.build({
      manufacturer_id: item.manufacturer_id,
      depot_id: this.depot_id,
      product_id: item.product_id,
      requested_kg: item.requested_kg,
      production_stock_kg: 0,
      store_requested_kg: item.requested_kg,
      store_kg: 0,
      total_kg: 0,
      allocation_pending_kg: 0,
      output_kg: 0,
      transferred_kg: 0,
      retain_kg: 0,
      return_kg: 0,
      waste_kg: 0,
      process_loss: 0,
      use_production_stock: 0,
      fifo_not_followed: 0,
      raw_material_request: (item.type.trim().toUpperCase() === 'ESSENTIALS') ? 1 : 0,
      transfer: 0,
      return_raw_material: 0,
      keep_in_production: 0,
      waste_raw_material: 0,
      receive: 0,
      no_of_batch: item.no_of_batch,
      request_unit: 'Kg',
      p_type: item.type,
      check_batch_qty: (item.type.trim().toUpperCase() === 'OTHER') ? 1 : 0,
      transfer_pending: 0,
      production_day: 'Today',
      status: 'Drafted',
      date_of_processing: new Date().toISOString(),
      created_by: this.created_by,
      created_on: new Date().toISOString(),
      modified_by: this.modified_by,
      modified_on: new Date().toISOString(),
      requisition_id: this.id,
      allocations: item.allocations
    });

    // production.getRequestData(req);
    
    let error = await production.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    await production.setBatchNo();

    await production.setNoOfBatches();

    const rawMaterialRequests = await production.getRawMaterialRequest();
    
    // if (production.p_type.trim().toUpperCase() === 'ESSENTIALS') {
    //   await production.setProductionTotalStock();
    // }
    
    productions.push({ production: production, rawMaterialRequests: rawMaterialRequests });
  }

  return productions;
}

Requisition.prototype.setDetails = function(requisitionProducts, requisitionItems) {
  // try {
    // const items = requisitionItems.filter(item => item.qty !== 0 && item.draft_po !== 1);
    // if (items && items.length > 0) {
    //   this.status = 'Open';
    // } else {
    //   this.status = 'Closed';
    // }
  
    this.product_names = requisitionProducts.map(item => item.product_name).join(', ');
    this.item_names = requisitionItems.map(item => item.item_name).join(', ');
  // } catch (error) {
  //   return error;
  // }
}

// Requisition.prototype.setRawMaterialIn = function() {
//   // try {
//     if (this.po_status.trim().toUpperCase() === 'ADVANCE' || this.is_advance === 1) {
//       this.po_status = 'Closed';
//     } else {
//       this.po_status = 'Raw Material In';
//     }
//   // } catch (error) {
//   //   return error;
//   // }
// }

// Requisition.prototype.OpenPo = function() {
//   // try {
//     if (this.is_advance === 1) {
//       this.po_status = 'Advance';
//     } else if (!this.po_status || this.po_status.trim().toUpperCase() !== 'ADVANCE') {
//       this.po_status = 'Open';
//     }
//   // } catch (error) {
//   //   return error;
//   // }
// }

// Requisition.prototype.approve = function(req) {
//   // try {
//     // if (this.isDeleted) {
//     if (this.status === "Deleted") {
//       this.status = "InActive";
//     } else {
//       this.status = "Approved";
//     }

//     if (req && req.body && req.body.remarks) {
//       this.remarks = req.body.remarks;
//     } else {
//       this.remarks = '';
//     }
//     this.approved_by = req.userData.userId;
//     this.approved_on = new Date().toISOString();

//     return null;
//   // } catch (error) {
//   //   return error;
//   // }
// }

// Requisition.prototype.reject = function(req) {
//   // try {
//     this.status = "Rejected";
//     if (req && req.body && req.body.remarks) {
//       this.remarks = req.body.remarks;
//     } else {
//       this.remarks = '';
//     }
//     this.rejected_by = req.userData.userId;
//     this.rejected_on = new Date().toISOString();

//     return null;
//   // } catch (error) {
//   //   return error;
//   // }
// }

// Requisition.prototype.getRequisitionNo = function(series) {
//   // try {
//     if (this.po_no) {
//       return this.po_no;
//     }
  
//     const orderDate = this.requisition_date ? new Date(this.requisition_date) : new Date();
//     const financialYear = calculateFiscalYearForDate(orderDate);
//     // const monthName = getMonthName(orderDate.getMonth());

//     const requisitionNo = 'WHPL/' + financialYear + '/' + series;
    
//     this.po_no = requisitionNo;

//     return requisitionNo;
//   // } catch (error) {
//   //   return error;
//   // }
// }

Requisition.prototype.validateData = async function() {
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
      } else {
        const depot = await Depot.findByPk(this.depot_id);
        this.depot_name = depot && depot.depot_name ? depot.depot_name : '';
      }
    }
    // if (this.vendor_id) {
    //   count = await Vendor.count({ where: { id: this.vendor_id }});
    //   if (count === 0) {
    //     return { errors : { vendor_id: { message: `Vendor does not exist` } } };
    //   }
    // }
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}

export default Requisition;