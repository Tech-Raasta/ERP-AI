import { DataTypes, Op, fn, col } from 'sequelize';
import sequelize from '../lib/database.js';
import { calculateTransactionAmount, addDays, round } from '../lib/common.js';

import Depot from './depot.js';
import Vendor from './vendor.js';
import RawMaterial from './rawMaterial.js';
import RawMaterialInItem from './rawMaterialInItem.js';
import RawMaterialInOtherCharge from './rawMaterialInOtherCharge.js';
import RawMaterialInItemWeight from './rawMaterialInItemWeight.js';
import PurchaseOrder from './purchaseOrder.js';
import PurchaseOrderItem from '../models/purchaseOrderItem.js';
import User from './user.js';
import PaymentVoucher from './paymentVoucher.js';

const RawMaterialIn = sequelize.define('raw_material_in', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  date_of_receipt: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    validate: {
      notNull: true,
      // isValidDate: true
    }
  },
  purchase_order_id: {
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
  vendor_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  tax_type: DataTypes.STRING,
  amt: {
    type: DataTypes.DOUBLE,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  tds_per: DataTypes.DOUBLE,
  tds_amt: DataTypes.DOUBLE,
  cgst_amt: DataTypes.DOUBLE,
  sgst_amt: DataTypes.DOUBLE,
  igst_amt: DataTypes.DOUBLE,
  tax_amt: DataTypes.DOUBLE,
  total_amt: DataTypes.DOUBLE,
  round_off_amt: DataTypes.DOUBLE,
  final_amount: DataTypes.DOUBLE,
  gate_pass_no: DataTypes.STRING,
  raw_material_in_no: DataTypes.STRING,
  doc_document: DataTypes.STRING,
  document_name: DataTypes.STRING,
  partial_po: DataTypes.TINYINT,
  invoice_date: {
    type: DataTypes.DATEONLY,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  payment_due_date: DataTypes.DATEONLY,
  pay_immediately: DataTypes.TINYINT,
  invoice_no: {
    type: DataTypes.STRING,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  status: DataTypes.STRING,
  grn_status: DataTypes.STRING,
  remarks: DataTypes.STRING,
  created_by: DataTypes.INTEGER,
  modified_by: DataTypes.INTEGER,
  approved_by: DataTypes.INTEGER,
  approved_on: DataTypes.DATE,
  rejected_by: DataTypes.INTEGER,
  rejected_on: DataTypes.DATE,
  ref_id: DataTypes.INTEGER,
  po_no: DataTypes.STRING,
  depot_name: DataTypes.STRING,
  vendor_name: DataTypes.STRING,
  rm_in_item_names: DataTypes.STRING
}, 
{ 
  timestamps: true,
  createdAt: 'created_on',
  updatedAt: 'modified_on',
  freezeTableName: true
});

RawMaterialIn.belongsTo(PurchaseOrder, { foreignKey: "purchase_order_id", as: "purchase_order" });
RawMaterialIn.belongsTo(Vendor, { foreignKey: "vendor_id", as: "vendor" });
RawMaterialIn.belongsTo(Depot, { foreignKey: "depot_id", as: "depot" });
RawMaterialInItem.belongsTo(RawMaterialIn, { foreignKey: "raw_material_in_id", as: "raw_material_in" });
RawMaterialInItemWeight.belongsTo(RawMaterialIn, { foreignKey: "raw_material_in_id", as: "raw_material_in" });
RawMaterialInOtherCharge.belongsTo(RawMaterialIn, { foreignKey: "raw_material_in_id", as: "raw_material_in" });
RawMaterialInItem.belongsTo(RawMaterial, { foreignKey: "raw_material_id", as: "raw_material" });
RawMaterialIn.hasMany(RawMaterialInItem, { foreignKey: "raw_material_in_id", as: "rawMaterialInItems", onDelete: 'CASCADE' });
RawMaterialIn.hasMany(RawMaterialInItemWeight, { foreignKey: "raw_material_in_id", as: "rawMaterialInWeights", onDelete: 'CASCADE' });
RawMaterialInItem.hasMany(RawMaterialInItemWeight, { foreignKey: "raw_material_in_item_id", as: "rawMaterialInItemWeights", onDelete: 'CASCADE' });
RawMaterialIn.hasMany(RawMaterialInOtherCharge, { foreignKey: "raw_material_in_id", as: "rawMaterialInOtherCharges", onDelete: 'CASCADE' });
RawMaterial.hasMany(RawMaterialInItem, { foreignKey: "raw_material_id", as: "rawMaterialInItems" });
RawMaterialIn.belongsToMany(RawMaterial, { through : RawMaterialInItem, as: "raw_material", foreignKey: 'raw_material_in_id' });
RawMaterial.belongsToMany(RawMaterialIn, { through : RawMaterialInItem, as: "raw_material_in", foreignKey: 'raw_material_id' });
RawMaterialIn.belongsTo(User, { foreignKey: "created_by", as: "created_by_user" });
RawMaterialIn.belongsTo(User, { foreignKey: "modified_by", as: "modified_by_user" });
RawMaterialIn.belongsTo(User, { foreignKey: "approved_by", as: "approved_by_user" });

export const getRawMaterialInMasterData = async function(rawMaterialIn, req) {
  // try {
    let purchaseOrderCond = { where: {
      [Op.and]: [
        {status: 'Approved'}, 
        {po_status: {[Op.or]: [{[Op.notIn] : ['Raw Material IN', 'Closed']}, {[Op.is]: null}]}}
      ]
    } };
    let depotCond = { where: {status: 'Approved', id: {[Op.in]: req.userData.depotIds}} };
    let vendorCond = { where: {status: 'Approved'} };
    let rawMaterialCond = { where: {status: 'Approved'} };

    if (rawMaterialIn) {
      if (rawMaterialIn.purchase_order_id) {
        purchaseOrderCond = { where: {[Op.or]: [
          { id: rawMaterialIn.purchase_order_id }, 
          {[Op.and]: [
            { status: 'Approved' }, 
            { po_status: {[Op.or]: [{[Op.notIn] : ['Raw Material IN', 'Closed']}, {[Op.is]: null}]} },
            { vendor_id: rawMaterialIn.vendor_id }
          ]}
        ]} };
      }
      if (rawMaterialIn.depot_id) {
        depotCond = { where: {[Op.or]: [{ status: 'Approved', id: {[Op.in]: req.userData.depotIds} }, { id: rawMaterialIn.depot_id }]} };
      }
      if (rawMaterialIn.vendor_id) {
        vendorCond = { where: {[Op.or]: [{ status: 'Approved' }, { id: rawMaterialIn.vendor_id }]} };
      }
      if (rawMaterialIn.rawMaterialInItems && rawMaterialIn.rawMaterialInItems.length > 0) {
        const rawMaterialIds = rawMaterialIn.rawMaterialInItems.map(rawMaterialInItem => rawMaterialInItem.raw_material_id);
        rawMaterialCond = { where: {[Op.or]: [
          { status: 'Approved' }, 
          { id: { [Op.isIn]: rawMaterialIds } }
        ]} };
      }
    }

    const purchaseOrders = await PurchaseOrder.findAll({ ...purchaseOrderCond, attributes: ['id', 'po_no'] });
    const depots = await Depot.findAll({ ...depotCond, attributes: ['id', 'depot_name', 'state'] });
    const vendors = await Vendor.findAll({ ...vendorCond, attributes: ['id', 'vendor_name', 'state', 'payment_due_days'] });
    const rawMaterials = await RawMaterial.findAll({ ...rawMaterialCond, attributes: ['id', 'rm_name', 'rate'] });
    
    return { purchaseOrders, depots, vendors, rawMaterials };
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

export const getVendorPurchaseOrders = async function(vendor_id) {
  // try {
    let purchaseOrderCond = { where: {
      [Op.and]: [
        {status: 'Approved'},
        {vendor_id: vendor_id}, 
        {po_status: {[Op.or]: [{[Op.notIn] : ['Raw Material IN', 'Closed']}, {[Op.is]: null}]}}
      ]
    } };
    
    const purchaseOrders = await PurchaseOrder.findAll({ ...purchaseOrderCond, attributes: ['id', 'po_no'] });
    
    return { purchaseOrders };
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

export const getPurchaseOrderDetails = async function(po_id, raw_material_in_id) {
  // try {
    const purchaseOrder = await PurchaseOrder.findByPk(po_id, { 
      include: [
        { 
          model: PurchaseOrderItem, 
          as: "purchaseOrderItems", 
          include: [
            { model: RawMaterial, as: "raw_material", attributes: ["id", "rm_name"] },
            // { 
            //   model: RawMaterialInItem, 
            //   as: "rawMaterialInItems", 
            //   attributes: ['po_item_id', 'qty'], 
            //   // attributes: ['po_item_id', [sequelize.fn('sum', sequelize.col('purchaseOrderItems.rawMaterialInItems.qty')), 'total_in_qty']] 
            //   // where: { [Op.or]: { raw_material_in_id: { [Op.is]: null }, raw_material_in_id: { [Op.ne]: raw_material_in_id } } }
            // }
          ],
          
          // attributes: ['id'],
          // group: ['purchaseOrderItems.id', 'purchaseOrderItems.raw_material', 'purchaseOrderItems.rawMaterialInItems.po_item_id']
        }, 
        "purchaseOrderOtherCharges"
      ]
    });

    const poItemIds = purchaseOrder.purchaseOrderItems.map(purchaseOrderItem => purchaseOrderItem.id);
    const rawMaterialInQtys = await RawMaterialInItem.findAll({ 
      where: { po_item_id: {[Op.in]: poItemIds} },
      attributes: ['po_item_id', [sequelize.fn('sum', sequelize.col('qty')), 'total_in_qty']],
      group: ['po_item_id']
    });
    
    return { purchaseOrder, rawMaterialInQtys };
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

RawMaterialIn.prototype.getRequestData = function(req) {
  // try {
    const body = req.body ? req.body : null;
    const files = req.files ? req.files : null;

    this.date_of_receipt = body.date_of_receipt ? new Date(body.date_of_receipt).toISOString() : null;
    this.purchase_order_id = body.purchase_order_id ? +body.purchase_order_id : null;
    this.depot_id = body.depot_id ? +body.depot_id : null;
    this.vendor_id = body.vendor_id ? +body.vendor_id : null;
    this.gate_pass_no = body.gate_pass_no ? body.gate_pass_no : '';
    // this.amount = body.amount ? +body.amount : 0;
    // this.delivery_date = body.delivery_date ? body.delivery_date : null;
    // this.ref_id = body.ref_id ? +body.ref_id : null;
    this.partial_po = body.partial_po ? +body.partial_po : 0;
    // this.status = body.status;
    this.remarks = body.remarks ? body.remarks.trim() : '';
    this.tds_per = body.tds_per ? +body.tds_per : 0;
    this.round_off_amt = body.round_off_amt ? +body.round_off_amt : null;
    
    const days = 30; // Get Days from vendor Master
    this.payment_due_date = addDays(this.date_of_receipt, days);
    
    // console.log(files);
    
    if (files && files.doc_document && files.doc_document.length > 0) {
      if(this.doc_document) {
        this.doc_document = this.doc_document.toString() + ' | ' + files.doc_document.map(doc => doc.path).join(' | ');
      } else {
        this.doc_document = files.doc_document.map(doc => doc.path).join(' | ');
      }
      if(this.document_name) {
        this.document_name = this.document_name.toString() + ' | ' + files.doc_document.map(doc => doc.filename).join(' | ');
      } else {
        this.document_name = files.doc_document.map(doc => doc.filename).join(' | ');
      }
    }
    
  // } catch (error) {
  //   // console.log(error);
  //   return error;
  // }
}

RawMaterialIn.prototype.getRequestDataForRate = function(req) {
  // try {
    const body = req.body ? req.body : null;
    const files = req.files ? req.files : null;

    this.invoice_date = body.invoice_date ? new Date(body.invoice_date).toISOString() : null;
    this.invoice_no = body.invoice_no ? body.invoice_no.trim() : '';
    // this.date_of_receipt = body.date_of_receipt ? body.date_of_receipt : null;
    // this.purchase_order_id = body.purchase_order_id ? +body.purchase_order_id : null;
    // this.depot_id = body.depot_id ? +body.depot_id : null;
    // this.vendor_id = body.vendor_id ? +body.vendor_id : null;
    this.gate_pass_no = body.gate_pass_no ? body.gate_pass_no : '';
    this.payment_due_date = body.payment_due_date ? new Date(body.payment_due_date).toISOString() : '';
    // this.amount = body.amount ? +body.amount : 0;
    // this.delivery_date = body.delivery_date ? body.delivery_date : null;
    // this.ref_id = body.ref_id ? +body.ref_id : null;
    this.partial_po = body.partial_po ? +body.partial_po : 0;
    this.pay_immediately = (body.pay_immediately.toString().trim().toUpperCase() === 'TRUE') ? 1 : 0;
    // this.status = body.status;
    this.remarks = body.remarks ? body.remarks.trim() : '';

    this.tds_per = body.tds_per ? +body.tds_per : 0;
    this.round_off_amt = body.round_off_amt ? +body.round_off_amt : null;
    
    const days = 30; // Get Days from vendor Master
    this.payment_due_date = addDays(this.date_of_receipt, days);
    
    if (files && files.doc_document && files.doc_document.length > 0) {
      if(this.doc_document) {
        this.doc_document = this.doc_document.toString() + ' | ' + files.doc_document.map(doc => doc.path).join(' | ');
      } else {
        this.doc_document = files.doc_document.map(doc => doc.path).join(' | ');
      }
      if(this.document_name) {
        this.document_name = this.document_name.toString() + ' | ' + files.doc_document.map(doc => doc.filename).join(' | ');
      } else {
        this.document_name = files.doc_document.map(doc => doc.filename).join(' | ');
      }
    }
    
  // } catch (error) {
  //   // console.log(error);
  //   return error;
  // }
}

RawMaterialIn.prototype.setTaxType = async function() {
  const depot = await Depot.findByPk(this.depot_id);
  const vendor = await Vendor.findByPk(this.vendor_id);
  
  let taxType = 'Intra';
  if (depot.state.trim().toUpperCase() === vendor.state.trim().toUpperCase()) {
    taxType = "Intra";
  } else {
    taxType = "Inter"
  }
  
  this.tax_type = taxType;

  this.depot_name = depot && depot.depot_name ? depot.depot_name : '';
  this.vendor_name = vendor && vendor.vendor_name ? vendor.vendor_name : '';

  const purchaseOrder = await PurchaseOrder.findByPk(this.purchase_order_id);
  this.po_no = purchaseOrder && purchaseOrder.po_no ? purchaseOrder.po_no : '';

  return taxType;
}

RawMaterialIn.prototype.getRawMaterialInItems = function(body) {
  // try {
    const rawMaterialInItemWithWeights = [];
    if (body.rawMaterialInItems) {
      let postedRawMaterialInItems = body.rawMaterialInItems;
      if (typeof body.rawMaterialInItems === 'string') {
        postedRawMaterialInItems = JSON.parse(body.rawMaterialInItems);
      }
      for (const postedRawMaterialInItem of postedRawMaterialInItems) {
        const po_item_id = (postedRawMaterialInItem.po_item_id) ? +postedRawMaterialInItem.po_item_id : null;
        const raw_material_id = (postedRawMaterialInItem.raw_material_id) ? +postedRawMaterialInItem.raw_material_id : null;
        // const item_desc = (postedRawMaterialInItem.item_desc) ? postedRawMaterialInItem.item_desc : null;
        const qty = round((postedRawMaterialInItem.qty) ? +postedRawMaterialInItem.qty : 0, 4);
        // const rate = (postedRawMaterialInItem.rate) ? +postedRawMaterialInItem.rate : null;
        // const tax_type = (this.tax_type) ? this.tax_type : 'Intra';
        const no_of_boxes = round((postedRawMaterialInItem.no_of_boxes) ? +postedRawMaterialInItem.no_of_boxes : 0, 2);

        if (no_of_boxes <= 0) {
          continue;
        }
  
        const rawMaterialInItem = {
          raw_material_in_id: this.id,
          po_item_id: po_item_id,
          raw_material_id: raw_material_id,
          // item_desc: item_desc,
          qty: qty,
          // rate: rate,
          no_of_boxes: no_of_boxes
        };

        let rawMaterialInItemWeights = [];
        if (postedRawMaterialInItem.itemWeights) {
          for (const itemWeight of postedRawMaterialInItem.itemWeights) {
            // const item_id = (itemWeight.item_id) ? itemWeight.item_id : null;
            const gross_weight = round((itemWeight.gross_weight) ? +itemWeight.gross_weight : 0, 4);
            const net_weight = round((itemWeight.net_weight) ? +itemWeight.net_weight : 0, 4);
            const expiry_date = (itemWeight.expiry_date) ? new Date(itemWeight.expiry_date).toISOString() : null;
            const barcode = (itemWeight.barcode) ? +itemWeight.barcode : '';
            const difference = gross_weight - net_weight;
            
            const rawMaterialInItemWeight = {
              // raw_material_in_id: this.raw_material_in_id,
              // raw_material_in_item_id: this.id,
              // // vendor_id: this.vendor_id,
              raw_material_id: raw_material_id,
              // item_desc: item_desc,
              gross_weight: gross_weight,
              net_weight: net_weight,
              expiry_date: expiry_date,
              barcode: barcode,
              difference: difference
            };

            rawMaterialInItemWeights.push(rawMaterialInItemWeight);
          }
        }

        rawMaterialInItemWithWeights.push({rawMaterialInItem, rawMaterialInItemWeights});
      }
    }
    
    return rawMaterialInItemWithWeights;
  // } catch (error) {
  //   return error;
  // }
}

RawMaterialIn.prototype.getRawMaterialInItemWeights = function(body) {
  // try {
    const rawMaterialInItemWeights = [];
    if (body.rawMaterialInItems) {
      let postedRawMaterialInItems = body.rawMaterialInItems;
      if (typeof body.rawMaterialInItems === 'string') {
        postedRawMaterialInItems = JSON.parse(body.rawMaterialInItems);
      }
      for (const postedRawMaterialInItem of postedRawMaterialInItems) {
        if (postedRawMaterialInItem.itemWeights) {
          for (const itemWeight of postedRawMaterialInItem.itemWeights) {
            // const item_id = (itemWeight.item_id) ? itemWeight.item_id : null;
            const gross_weight = (itemWeight.gross_weight) ? +itemWeight.gross_weight : 0;
            const net_weight = (itemWeight.net_weight) ? +itemWeight.net_weight : 0;
            const expiry_date = (itemWeight.expiry_date) ? new Date(itemWeight.expiry_date).toISOString() : null;
            const barcode = (itemWeight.barcode) ? +itemWeight.barcode : '';
            const difference = gross_weight - net_weight;
            
            const rawMaterialInItemWeight = {
              // raw_material_in_id: this.raw_material_in_id,
              // raw_material_in_item_id: this.id,
              // // vendor_id: this.vendor_id,
              // raw_material_id: this.raw_material_id,
              // item_desc: item_desc,
              gross_weight: gross_weight,
              net_weight: net_weight,
              expiry_date: expiry_date,
              barcode: barcode,
              difference: difference
            };

            rawMaterialInItemWeights.push(rawMaterialInItemWeight);
          }
        }
      }
    }
    
    return rawMaterialInItemWeights;
  // } catch (error) {
  //   return error;
  // }
}

RawMaterialIn.prototype.getRawMaterialInItemsForRate = function(body) {
  // try {
    const rawMaterialInItems = [];
    if (body.rawMaterialInItems) {
      let postedRawMaterialInItems = body.rawMaterialInItems;
      if (typeof body.rawMaterialInItems === 'string') {
        postedRawMaterialInItems = JSON.parse(body.rawMaterialInItems);
      }
      for (const postedRawMaterialInItem of postedRawMaterialInItems) {
        const id = (postedRawMaterialInItem.id) ? +postedRawMaterialInItem.id : null;
        const discount = (postedRawMaterialInItem.discount) ? +postedRawMaterialInItem.discount : 0;
        const rate = (postedRawMaterialInItem.rate) ? +postedRawMaterialInItem.rate : 0;
  
        const rawMaterialInItem = {
          id: id,
          discount: discount,
          rate: rate
        };

        rawMaterialInItems.push(rawMaterialInItem);
      }
    }
    
    return rawMaterialInItems;
  // } catch (error) {
  //   return error;
  // }
}

RawMaterialIn.prototype.getRawMaterialInOtherCharges = function(body) {
  // try {
    const rawMaterialInOtherCharges = [];
    if (body.rawMaterialInOtherCharges) {
      let postedRawMaterialInOtherCharges = body.rawMaterialInOtherCharges;
      if (typeof body.rawMaterialInOtherCharges === 'string') {
        postedRawMaterialInOtherCharges = JSON.parse(body.rawMaterialInOtherCharges);
      }
      for (const postedRawMaterialInOtherCharge of postedRawMaterialInOtherCharges) {
        const id = (postedRawMaterialInOtherCharge.id) ? +postedRawMaterialInOtherCharge.id : null;
        const po_item_id = (postedRawMaterialInOtherCharge.po_item_id) ? +postedRawMaterialInOtherCharge.po_item_id : null;
        // const raw_material_id = (postedRawMaterialInOtherCharge.raw_material_id) ? +postedRawMaterialInOtherCharge.raw_material_id : null;
        const item_desc = (postedRawMaterialInOtherCharge.item_desc) ? postedRawMaterialInOtherCharge.item_desc : null;
        // const qty = (postedRawMaterialInOtherCharge.qty) ? +postedRawMaterialInOtherCharge.qty : null;
        // const rate = (postedRawMaterialInOtherCharge.rate) ? +postedRawMaterialInOtherCharge.rate : null;
        const amount = (postedRawMaterialInOtherCharge.amount) ? +postedRawMaterialInOtherCharge.amount : null;
        const tax_per = (postedRawMaterialInOtherCharge.tax_per) ? +postedRawMaterialInOtherCharge.tax_per : 0;
        // const tax_type = (this.tax_type) ? this.tax_type : 'Intra';
        // const old_po_rate = (postedRawMaterialInOtherCharge.old_po_rate) ? +postedRawMaterialInOtherCharge.old_po_rate : null;
  
        const rawMaterialInOtherCharge = {
          id: id,
          po_item_id: po_item_id,
          raw_material_in_id: this.id,
          // raw_material_id: raw_material_id,
          item_desc: item_desc,
          // qty: qty,
          // rate: rate,
          amount: amount,
          tax_per: tax_per,
          // old_po_rate: old_po_rate
        };

        rawMaterialInOtherCharges.push(rawMaterialInOtherCharge);
      }
    }
    
    return rawMaterialInOtherCharges;
  // } catch (error) {
  //   return error;
  // }
}

RawMaterialIn.prototype.setTransactionAmount = function(rawMaterialInItems, rawMaterialInOtherCharges) {
  // try {
    const items = rawMaterialInItems.concat(rawMaterialInOtherCharges);

    const transaction = calculateTransactionAmount(items, this.tds_per, this.round_off_amt);

    this.amt = transaction.amount;
    this.cgst_amt = transaction.cgst_amount;
    this.sgst_amt = transaction.sgst_amount;
    this.igst_amt = transaction.igst_amount;
    this.tax_amt = transaction.tax_amount;
    this.total_amt = transaction.total_amount;
    this.tds_amt = transaction.tds_amount;
    this.round_off_amt = transaction.round_off_amount;
    this.final_amount = transaction.final_amount;

    this.rm_in_item_names = items.map(item => item.item_name).join(',');
  // } catch (error) {
  //   return error;
  // }
}

RawMaterialIn.prototype.setPaymentVoucherDetails = async function() {
  // try {
    const paymentVoucher = await PaymentVoucher.findOne({ where: [ {po_id: this.purchase_order_id} ]});
    if(paymentVoucher) {
      this.invoice_no = paymentVoucher.invoice_no;
      this.invoice_date = paymentVoucher.invoice_date;
      this.tds_per = paymentVoucher.tds_per;
      
      if (paymentVoucher.doc_document) {
        if (this.doc_document) {
          this.doc_document = this.doc_document + ' | ' + paymentVoucher.doc_document;
        } else {
          this.doc_document = paymentVoucher.doc_document;
        }
      }
      
      if (paymentVoucher.document_name) {
        if (this.document_name) {
          this.document_name = this.document_name + ' | ' + paymentVoucher.document_name;
        } else {
          this.document_name = paymentVoucher.document_name;
        }
      }
      
      this.pay_immediately = paymentVoucher.pay_immediately;
    }
  // } catch (error) {
  //   return error;
  // }
}

RawMaterialIn.prototype.approve = function(req) {
  // try {
    // if (this.isDeleted) {
    if (this.grn_status === "Deleted") {
      this.status = "InActive";
      this.grn_status = "InActive";
    } else {
      this.status = "Approved";
      this.grn_status = "Approved";
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

RawMaterialIn.prototype.reject = function(req) {
  // try {
    // this.status = "Rejected";
    this.grn_status = "Rejected";
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

RawMaterialIn.prototype.getRawMaterialInNo = function(series) {
  // try {
    if (this.raw_material_in_no) {
      return this.raw_material_in_no;
    }
  
    // const orderDate = this.date_of_receipt ? new Date(this.date_of_receipt) : new Date();
    // const financialYear = calculateFiscalYearForDate(orderDate);
    // // const monthName = getMonthName(orderDate.getMonth());

    // const rawMaterialInNo = 'WHPL/' + financialYear + '/' + series;

    const rawMaterialInNo = 'WHPL/RMI/' + series;
    
    this.raw_material_in_no = rawMaterialInNo;

    return rawMaterialInNo;
  // } catch (error) {
  //   return error;
  // }
}

RawMaterialIn.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    let count = 0;
    if (this.purchase_order_id) {
      count = await PurchaseOrder.count({ where: { id: this.purchase_order_id }});
      if (count === 0) {
        return { errors : { purchase_order_id: { message: `Purchase Order not exist` } } };
      } else {
        const purchaseOrder = await PurchaseOrder.findByPk(this.purchase_order_id);
        if(purchaseOrder && purchaseOrder.vendor_id && this.vendor_id && purchaseOrder.vendor_id === this.vendor_id) {
          // if(!purchaseOrder.po_status || 
          //   (purchaseOrder.po_status.trim().toUpperCase() !== 'OPEN' && 
          //   purchaseOrder.po_status.trim().toUpperCase() !== 'ADVANCE')) {
          //   return { errors : { purchase_order_id: { message: `Purchase Order already imported` } } };
          // }
        } else {
          return { errors : { purchase_order_id: { message: `Purchase Order & Vendor does not match` } } };
        }
      }
    }
    if (this.depot_id) {
      count = await Depot.count({ where: { id: this.depot_id }});
      if (count === 0) {
        return { errors : { depot_id: { message: `Depot not exist` } } };
      }
    }
    if (this.vendor_id) {
      count = await Vendor.count({ where: { id: this.vendor_id }});
      if (count === 0) {
        return { errors : { vendor_id: { message: `Vendor does not exist` } } };
      }
    }
    if (this.purchase_order_id && !this.partial_po) {
      count = await RawMaterialIn.count({ where: { 
        purchase_order_id: this.purchase_order_id, 
        partial_po: 0,
        id: {[Op.or]: [{[Op.is]: null}, {[Op.ne] : this.id}]},
        grn_status: {[Op.and]: [{[Op.ne]: 'InActive'},{[Op.ne]: 'Rejected'}, {[Op.ne] : 'Deleted'}]}
      }});
      if (count > 0) {
        return { errors : { purchase_order_id: { message: `Purchase Order already imported.` } } };
      }
    }
    if (this.invoice_no) {
      count = await RawMaterialIn.count({ where: { 
        vendor_id: this.vendor_id, 
        invoice_no: this.invoice_no, 
        id: {[Op.or]: [{[Op.is]: null}, {[Op.ne] : this.id}, {[Op.ne] : (this.ref_id ? this.ref_id : this.id)}]},
        grn_status: {[Op.and]: [{[Op.ne]: 'InActive'}, {[Op.ne] : 'Deleted'}]}
      }});
      if (count > 0) {
        return { errors : { invoice_no: { message: `Invoice already imported.` } } };
      }
    }
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}

// Get GRN Stock Qty
export const getGRNStockQty = async function(raw_material_id, depot_id, barcode=null) {

  const rawMaterialIn = await RawMaterialIn.findAll({
    where: { 
      ...( depot_id && { depot_id: depot_id }), 
      status: 'Approved',
      // date_of_receipt: { [Op.gte]: "2026-04-01"},
    }
  });

  const rawMaterial_ids = rawMaterialIn.map(batch => batch.id);

  let grnQty = [];
  
  if(barcode){
    const rawMaterialItem = await RawMaterialInItemWeight.findAll({
      where:{
        barcode:barcode,
        raw_material_in_id:{[Op.in]:rawMaterial_ids}
      }
    })
    const rawMaterialItem_ids = rawMaterialItem.map(item => item.raw_material_in_item_id);

    grnQty = await RawMaterialInItem.findAll({
      attributes: [[fn('SUM', col('qty')), 'total_qty']],
      where: {
        raw_material_id: raw_material_id, 
        id: { [Op.in]: rawMaterialItem_ids },
      },
      raw: true,
    });

  }else{
    grnQty = await RawMaterialInItem.findAll({
      attributes: [[fn('SUM', col('qty')), 'total_qty']],
      where: {
        raw_material_id: raw_material_id, 
        raw_material_in_id: { [Op.in]: rawMaterial_ids }
      },
      raw: true,
    });
  }

  const totalQty = grnQty[0]?.total_qty ? +grnQty[0]?.total_qty : 0;

  return totalQty;
}


export default RawMaterialIn;