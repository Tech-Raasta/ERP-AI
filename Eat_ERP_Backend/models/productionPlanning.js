import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';
import { round } from '../lib/common.js';

import Depot from './depot.js';
import Vendor from './vendor.js';
import RawMaterial from './rawMaterial.js';
import ProductionPlanningItem from './productionPlanningItem.js';
import ProductionPlanningProduct from './productionPlanningProduct.js';
import Product from './product.js';
import Recipe from './recipe.js';
import RecipeDetail from './recipeDetail.js';
import { getOldPurchaseOrderRate } from './purchaseOrder.js';
import Stock from './stock.js';
import PurchaseOrder from './purchaseOrder.js';
import PurchaseOrderItem from './purchaseOrderItem.js';

const ProductionPlanning = sequelize.define('production_planning', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  order_date: {
    type: DataTypes.DATEONLY,
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
  po_drafted: DataTypes.TINYINT,
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

ProductionPlanning.belongsTo(Depot, { foreignKey: "depot_id", as: "depot" });
ProductionPlanningProduct.belongsTo(ProductionPlanning, { foreignKey: "production_planning_id", as: "production_planning" });
ProductionPlanningProduct.belongsTo(Product, { foreignKey: "product_id", as: "product" });
ProductionPlanningItem.belongsTo(ProductionPlanning, { foreignKey: "production_planning_id", as: "production_planning" });
ProductionPlanningItem.belongsTo(RawMaterial, { foreignKey: "item_id", as: "raw_material" });
ProductionPlanningItem.belongsTo(Vendor, { foreignKey: "vendor_id", as: "vendor" });
ProductionPlanningItem.belongsTo(Depot, { foreignKey: "depot_id", as: "depot" });
ProductionPlanning.hasMany(ProductionPlanningProduct, { foreignKey: "production_planning_id", as: "productionPlanningProducts", onDelete: 'CASCADE' });
ProductionPlanning.hasMany(ProductionPlanningItem, { foreignKey: "production_planning_id", as: "productionPlanningItems", onDelete: 'CASCADE' });
// RawMaterial.hasMany(ProductionPlanningItem, { foreignKey: "item_id", as: "productionPlanningItems" });
// ProductionPlanning.belongsToMany(RawMaterial, { through : ProductionPlanningItem, as: "raw_material", foreignKey: 'production_planning_id' });
// RawMaterial.belongsToMany(ProductionPlanning, { through : ProductionPlanningItem, as: "production_planning", foreignKey: 'item_id' });
// ProductionPlanning.belongsTo(User, { foreignKey: "created_by", as: "created_by_user" });
// ProductionPlanning.belongsTo(User, { foreignKey: "modified_by", as: "modified_by_user" });
// ProductionPlanning.belongsTo(User, { foreignKey: "approved_by", as: "approved_by_user" });

export const getProductionPlanningMasterData = async function(productionPlanning, req) {
  // try {
    let depotCond = { where: {status: 'Approved', type: {[Op.in]: ['Manufacturer', 'Depot']}, id: {[Op.in]: req.userData.depotIds}} };
    let vendorCond = { where: {status: 'Approved'} };
    let productCond = { where: {status: 'Approved', category_id: 4 } };
    let nonEssentialProductCond = { where: {status: 'Approved', category_id: { [Op.ne]: 4 } } };

    if (productionPlanning) {
      if (productionPlanning.depot_id) {
        depotCond = { where: {[Op.or]: [{ status: 'Approved', id: {[Op.in]: req.userData.depotIds} }, { id: productionPlanning.depot_id }]} };
      }
      if (productionPlanning.vendor_id) {
        vendorCond = { where: {[Op.or]: [{ status: 'Approved' }, { id: productionPlanning.vendor_id }]} };
      }
      if (productionPlanning.productionPlanningProducts && productionPlanning.productionPlanningProducts.length > 0) {
        const productIds = productionPlanning.productionPlanningProducts.map(productionPlanningProduct => productionPlanningProduct.item_id);
        productCond = { where: {
          [Op.or]: [
            { status: 'Approved' }, 
            { id: { [Op.isIn]: productIds } }
          ],
          category_id: 4
        } };
        nonEssentialProductCond = { where: {
          [Op.or]: [
            { status: 'Approved' }, 
            { id: { [Op.isIn]: productIds } }
          ],
          category_id: { [Op.ne]: 4 }
        } };
      }
    }

    const depots = await Depot.findAll({ ...depotCond, attributes: ['id', 'depot_name', 'state'] });
    const vendors = await Vendor.findAll({ ...vendorCond, attributes: ['id', 'vendor_name', 'state'] });
    const products = await Product.findAll({ ...productCond, attributes: ['id', 'product_name', 'short_name'] });
    const nonEssentialProducts = await Product.findAll({ ...nonEssentialProductCond, attributes: ['id', 'product_name', 'short_name'] });
    const recipes = await Recipe.findAll({ where: { status: 'Approved' } });
    
    return { depots, vendors, products, nonEssentialProducts, recipes };
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

export const getProductionPlanningRawMaterials = async function(req) {
  // try {
    const depot_id = (req.body.depot_id) ? req.body.depot_id : 0;
    const productionPlanningProducts = [];
    const productionPlanningRawMaterials = [];

    if (req.body.productionPlanningProducts) {
      for (const postedProductionPlanningProduct of req.body.productionPlanningProducts) {
        const type = (postedProductionPlanningProduct.type) ? postedProductionPlanningProduct.type : 'Other';
        const product_id = (postedProductionPlanningProduct.product_id) ? +postedProductionPlanningProduct.product_id : 0;
        const requested_kg = (postedProductionPlanningProduct.requested_kg) ? +postedProductionPlanningProduct.requested_kg : 0;
        let no_of_batch = (postedProductionPlanningProduct.no_of_batch) ? +postedProductionPlanningProduct.no_of_batch : 1;

        const recipe = await Recipe.findOne({ 
          where: { product_id: product_id }, 
          include: ['product', { model: RecipeDetail, as: 'recipeDetails', include: 'rawMaterial' }] 
        });

        if (type.trim().toUpperCase() === 'OTHER') {
          // const recipe = await Recipe.findOne({ where: { product_id: product_id } });
      
          if (recipe) {
            const total_kgs = recipe.total_kgs ? parseFloat(recipe.total_kgs) : 1;
            no_of_batch = round((requested_kg / total_kgs), 2);
          }
        } else {
          no_of_batch = requested_kg;
        }
        
        if (recipe) {
          for (const recipeDetail of recipe.recipeDetails) {
            if (recipeDetail) {
              const item_id = recipeDetail.rm_id ? +recipeDetail.rm_id : 0;
              const qty_per_batch = recipeDetail.qty_per_batch ? +recipeDetail.qty_per_batch : 0;
              const total_qty = round(no_of_batch * qty_per_batch, 4);

              const index = productionPlanningRawMaterials.findIndex(item => item.item_id === item_id);

              if (index === -1) {
                const {rawMaterial, oldPoRate, vendorId} = await getOldPurchaseOrderRate(item_id);

                const stock = await Stock.getDepotTotalStock(depot_id, item_id);
                const available_qty = stock ? +stock : 0;
                const difference_qty = total_qty < available_qty ? 0 : round(total_qty - available_qty, 4);

                const item = { 
                  item_id: recipeDetail.rm_id ? recipeDetail.rm_id : '',
                  item_name: rawMaterial && rawMaterial.rm_name ? rawMaterial.rm_name : '',
                  item_desc: '',
                  required_qty: total_qty,
                  available_qty: available_qty,
                  difference_qty: difference_qty,
                  rate: rawMaterial && rawMaterial.rate ? +rawMaterial.rate : 0,
                  old_po_rate: oldPoRate ? +oldPoRate : 0,
                  vendor_id: vendorId ? +vendorId : 0,
                  qty: difference_qty,
                  draft_po: (difference_qty > 0) ? 1 : 0,
                  po_status: ''
                };

                productionPlanningRawMaterials.push(item);
              } else {
                productionPlanningRawMaterials[index].required_qty = round(productionPlanningRawMaterials[index].required_qty + total_qty, 4);
                if (productionPlanningRawMaterials[index].required_qty < productionPlanningRawMaterials[index].available_qty) {
                  productionPlanningRawMaterials[index].difference_qty = 0;
                } else {
                  productionPlanningRawMaterials[index].difference_qty = round(productionPlanningRawMaterials[index].required_qty - productionPlanningRawMaterials[index].available_qty, 4);
                }
              }
            }
          }
        }
  
        const productionPlanningProduct = {
          // production_planning_id: 0,
          type: type,
          product_id: product_id,
          product_name: recipe && recipe.product && recipe.product.product_name ? recipe.product.product_name : '',
          no_of_batch: no_of_batch,
          requested_kg: requested_kg
        };

        productionPlanningProducts.push(productionPlanningProduct);
      }
    }
    
    return { productionPlanningProducts, productionPlanningRawMaterials };
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

ProductionPlanning.prototype.getRequestData = function(req) {
  // try {
    const body = req.body ? req.body : null;

    this.order_date = body.order_date ? new Date(body.order_date).toISOString() : (this.order_date ? this.order_date : new Date().toISOString());
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

// ProductionPlanning.prototype.setTaxType = async function() {
//   const depot = await Depot.findByPk(this.depot_id);
//   const vendor = await Vendor.findByPk(this.vendor_id);
  
//   let taxType = 'Intra';
//   if (depot.state.trim().toUpperCase() === vendor.state.trim().toUpperCase()) {
//     taxType = "Intra";
//   } else {
//     taxType = "Inter"
//   }
  
//   this.tax_type = taxType;

//   this.depot_name = depot && depot.depot_name ? depot.depot_name : '';
//   this.vendor_name = vendor && vendor.vendor_name ? vendor.vendor_name : '';

//   return taxType;
// }

ProductionPlanning.prototype.getProductionPlanningProducts = function(body) {
  // try {
    const productionPlanningProducts = [];
    if (body.productionPlanningProducts) {
      for (const postedProductionPlanningProduct of body.productionPlanningProducts) {
        const type = (postedProductionPlanningProduct.type) ? postedProductionPlanningProduct.type : '';
        const product_id = (postedProductionPlanningProduct.product_id) ? +postedProductionPlanningProduct.product_id : null;
        const product_name = (postedProductionPlanningProduct.product_name) ? postedProductionPlanningProduct.product_name : '';
        const requested_kg = (postedProductionPlanningProduct.requested_kg) ? +postedProductionPlanningProduct.requested_kg : 0;
        let no_of_batch = (postedProductionPlanningProduct.no_of_batch) ? +postedProductionPlanningProduct.no_of_batch : 1;
        // const qty = (postedProductionPlanningProduct.qty) ? +postedProductionPlanningProduct.qty : null;
        // const rate = (postedProductionPlanningProduct.rate) ? +postedProductionPlanningProduct.rate : null;
        // const amount = (postedProductionPlanningProduct.amount) ? +postedProductionPlanningProduct.amount : 0;
        // const tax_per = (postedProductionPlanningProduct.tax_per) ? +postedProductionPlanningProduct.tax_per : 0;
        // const tax_type = (this.tax_type) ? this.tax_type : 'Intra';
        // const old_po_rate = (postedProductionPlanningProduct.old_po_rate) ? +postedProductionPlanningProduct.old_po_rate : null;
  
        const productionPlanningProduct = {
          production_planning_id: this.id,
          type: type,
          product_id: product_id,
          product_name: product_name,
          requested_kg: requested_kg,
          no_of_batch: no_of_batch
          // rate: rate,
          // amount: amount,
          // tax_per: tax_per,
          // old_po_rate: old_po_rate
        };

        productionPlanningProducts.push(productionPlanningProduct);
      }
    }
    
    return productionPlanningProducts;
  // } catch (error) {
  //   return error;
  // }
}

ProductionPlanning.prototype.getProductionPlanningItems = function(body) {
  // try {
    const productionPlanningItems = [];
    if (body.productionPlanningItems) {
      for (const postedProductionPlanningItem of body.productionPlanningItems) {
        const item_id = (postedProductionPlanningItem.item_id) ? +postedProductionPlanningItem.item_id : null;
        // const item_desc = (postedProductionPlanningItem.item_desc) ? postedProductionPlanningItem.item_desc : '';
        const required_qty = (postedProductionPlanningItem.required_qty) ? +postedProductionPlanningItem.required_qty : 0;
        const available_qty = (postedProductionPlanningItem.available_qty) ? +postedProductionPlanningItem.available_qty : 0;
        const difference_qty = (postedProductionPlanningItem.difference_qty) ? +postedProductionPlanningItem.difference_qty : 0;
        const vendor_id = (postedProductionPlanningItem.vendor_id) ? +postedProductionPlanningItem.vendor_id : 0;
        const qty = (postedProductionPlanningItem.qty) ? +postedProductionPlanningItem.qty : 0;
        const rate = (postedProductionPlanningItem.rate) ? +postedProductionPlanningItem.rate : 0;
        // const tax_type = (this.tax_type) ? this.tax_type : 'Intra';
        const old_po_rate = (postedProductionPlanningItem.old_po_rate) ? +postedProductionPlanningItem.old_po_rate : 0;
        const draft_po = (postedProductionPlanningItem.draft_po) ? +postedProductionPlanningItem.draft_po : 0;
        const po_status = (postedProductionPlanningItem.po_status) ? postedProductionPlanningItem.po_status : '';
  
        const productionPlanningItem = {
          production_planning_id: this.id,
          item_id: item_id,
          // item_desc: item_desc,
          required_qty: required_qty,
          available_qty: available_qty,
          difference_qty: difference_qty,
          depot_id: this.depot_id,
          vendor_id: vendor_id,
          qty: qty,
          rate: rate,
          old_po_rate: old_po_rate,
          draft_po: draft_po,
          po_status: po_status
        };

        productionPlanningItems.push(productionPlanningItem);
      }
    }
    
    return productionPlanningItems;
  // } catch (error) {
  //   return error;
  // }
}

ProductionPlanning.prototype.draftPo = async function(productionPlanningItems) {
  const items = productionPlanningItems.filter(item => item.draft_po && item.po_status === '' && item.vendor_id && item.qty).sort((a,b) => a.vendor_id-b.vendor_id);

  const purchaseOrders = [];
  let prev_vendor_id = 0;
  for (const item of items) {
    if (item.vendor_id !== prev_vendor_id) {
      prev_vendor_id = item.vendor_id;

      let purchaseOrder = await PurchaseOrder.findOne({ 
        where: { production_planning_id: this.id, vendor_id: item.vendor_id, status: 'Drafted' }, 
        include: 'purchaseOrderItems'
      });
      let purchaseOrderItems = [];

      if (!purchaseOrder) {
        purchaseOrder = await PurchaseOrder.build({
          order_date: this.order_date,
          depot_id: this.depot_id,
          vendor_id: item.vendor_id,
          tax_type: item.tax_type,
          depot_name: item.depot_name,
          vendor_name: item.vendor_name,
          status: 'Drafted',
          po_status: 'Open',
          created_by: this.created_by,
          created_on: new Date().toISOString(),
          modified_by: this.modified_by,
          modified_on: new Date().toISOString()
        });
      } else {
        purchaseOrderItems = purchaseOrder.purchaseOrderItems;
      }

      purchaseOrders.push({ purchaseOrder: purchaseOrder, purchaseOrderItems: purchaseOrderItems });
    }

    const purchaseOrderItem = await PurchaseOrderItem.build({
      purchase_order_id: 0,
      item_id: item.item_id,
      item_desc: item.item_desc,
      qty: item.qty,
      rate: item.rate,
      old_po_rate: item.old_po_rate,
      tax_type: item.tax_type
    });
    // error = await purchaseOrderItem.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }

    await purchaseOrderItem.setItemAmount();
    purchaseOrders[purchaseOrders.length - 1].purchaseOrderItems.push(purchaseOrderItem);
  }

  return purchaseOrders;
}

ProductionPlanning.prototype.setTransactionAmount = function(productionPlanningProducts, productionPlanningItems) {
  // try {
    // const items = productionPlanningItems.concat(productionPlanningProducts);

    // const transaction = calculateTransactionAmount(items, 0, 0);

    // this.amount = transaction.amount;
    // this.cgst_amount = transaction.cgst_amount;
    // this.sgst_amount = transaction.sgst_amount;
    // this.igst_amount = transaction.igst_amount;
    // this.tax_amount = transaction.tax_amount;
    // this.total_amount = transaction.total_amount;
    // this.round_off_amount = transaction.round_off_amount;
    // this.po_amount = transaction.final_amount;

    const items = productionPlanningItems.filter(item => item.qty !== 0 && item.draft_po !== 1);
    if (items && items.length > 0) {
      this.status = 'Open';
    } else {
      this.status = 'Closed';
    }
  
    this.product_names = productionPlanningProducts.map(item => item.product_name).join(',');
    this.item_names = productionPlanningItems.map(item => item.item_name).join(',');
  // } catch (error) {
  //   return error;
  // }
}

// ProductionPlanning.prototype.setRawMaterialIn = function() {
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

// ProductionPlanning.prototype.OpenPo = function() {
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

// ProductionPlanning.prototype.approve = function(req) {
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

// ProductionPlanning.prototype.reject = function(req) {
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

// ProductionPlanning.prototype.getProductionPlanningNo = function(series) {
//   // try {
//     if (this.po_no) {
//       return this.po_no;
//     }
  
//     const orderDate = this.order_date ? new Date(this.order_date) : new Date();
//     const financialYear = calculateFiscalYearForDate(orderDate);
//     // const monthName = getMonthName(orderDate.getMonth());

//     const productionPlanningNo = 'WHPL/' + financialYear + '/' + series;
    
//     this.po_no = productionPlanningNo;

//     return productionPlanningNo;
//   // } catch (error) {
//   //   return error;
//   // }
// }

ProductionPlanning.prototype.validateData = async function() {
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

export default ProductionPlanning;