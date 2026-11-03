import { Op, Sequelize } from 'sequelize';
import sequelize from '../lib/database.js';
import {round} from '../lib/common.js';
import fs from 'fs';

import RawMaterialIn, {getRawMaterialInMasterData, getVendorPurchaseOrders, getPurchaseOrderDetails} from '../models/rawMaterialIn.js';
import RawMaterialInItem from '../models/rawMaterialInItem.js';
import RawMaterialInItemWeight from '../models/rawMaterialInItemWeight.js';
import RawMaterialInOtherCharge from '../models/rawMaterialInOtherCharge.js';
import Depot from '../models/depot.js';
import Vendor from '../models/vendor.js';
import { getSeries } from '../models/series.js';
import RawMaterial from '../models/rawMaterial.js';
import PurchaseOrder from '../models/purchaseOrder.js';
import PaymentVoucher from '../models/paymentVoucher.js';
import PaymentVoucherItem from '../models/paymentVoucherItem.js';
import { set_raw_material_rate, set_products, set_product_rate, send_updated_variations } from '../models/ingredient.js';
import User from '../models/user.js';
import Stock from '../models/stock.js';

export const getMasterData = async (req, res, next) => {
  try {
    const masterData = await getRawMaterialInMasterData(null, req);

    return res.status(200).json({ masterData });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Master Data failed!",
    //   error: JSON.stringify(error, Object.getOwnPropertyNames(error))
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Master Data failed!";
    next(error, req, res);
  }
};

export const getVendorPos = async (req, res, next) => {
  try {
    const vendor_id = req.params.vendor_id;
    const purchaseOrders = await getVendorPurchaseOrders(vendor_id);

    return res.status(200).json({ 
      message: "Vendor Purchase Orders fetched successfully!",
      purchaseOrders 
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Master Data failed!",
    //   error: JSON.stringify(error, Object.getOwnPropertyNames(error))
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Master Data failed!";
    next(error, req, res);
  }
};

export const getPoDetails = async (req, res, next) => {
  try {
    const po_id = req.params.po_id;
    const { purchaseOrder, rawMaterialInQtys } = await getPurchaseOrderDetails(po_id, 0);

    return res.status(200).json({ 
      message: "Purchase Order Details fetched successfully!",
      purchaseOrder,
      rawMaterialInQtys
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Purchase Order Details failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Purchase Order Details failed!";
    next(error, req, res);
  }
};

export const createRawMaterialIn = async (req, res, next) => {
  let t;
  let rawMaterialIn;
  
  try {
    rawMaterialIn = await RawMaterialIn.build({
      status: 'Approved',
      grn_status: 'InCheck',
      created_by: req.userData.userId,
      modified_by: req.userData.userId
    });

    // console.log(req.body);

    rawMaterialIn.getRequestData(req);
    
    let error = await rawMaterialIn.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }
    
    const tax_type = await rawMaterialIn.setTaxType();

    const { purchaseOrder, rawMaterialInQtys } = await getPurchaseOrderDetails(rawMaterialIn.purchase_order_id, 0);
    
    const items = rawMaterialIn.getRawMaterialInItems(req.body);
    const rawMaterialInItems = [];
    const rawMaterialInItemWithWeights = [];
    for(const item of items) {
      const rawMaterialInItem = await RawMaterialInItem.build({
        tax_type: tax_type
      });
      rawMaterialInItem.getRequestData(item.rawMaterialInItem);
      error = await rawMaterialInItem.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      await rawMaterialInItem.setPoItemDetails();

      if (purchaseOrder && purchaseOrder.is_advance === 1) {
        await rawMaterialInItem.setPaymentVoucherItemDetails();
      }

      const rawMaterialInItemWeights = [];
      let no_of_boxes = 0;
      let net_weight = 0;
      let gross_weight = 0;
      let difference = 0;
      for(const itemWeight of item.rawMaterialInItemWeights) {
        const rawMaterialInItemWeight = await RawMaterialInItemWeight.build({
          vendor_id: rawMaterialIn.vendor_id
        });
        rawMaterialInItemWeight.getRequestData(itemWeight);
        error = await rawMaterialInItemWeight.validateData();
        if (error) {
          return res.status(422).json({
            message: "Invalid inputs passed, please check your data.",
            error: error
          });
        }

        rawMaterialInItemWeights.push(rawMaterialInItemWeight);
        no_of_boxes = no_of_boxes + 1;
        net_weight = round(net_weight + rawMaterialInItemWeight.net_weight, 4);
        gross_weight = round(gross_weight + rawMaterialInItemWeight.gross_weight, 4);
        difference = round(difference + rawMaterialInItemWeight.difference, 4);
      }

      if (rawMaterialInItem.no_of_boxes !== no_of_boxes || round(rawMaterialInItem.qty, 4) !== round(net_weight, 4)) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: { errors : { qty: { message: `Raw Material Item Weight does not match.` } } }
        });
      }
      rawMaterialInItem.gross_weight = gross_weight;
      rawMaterialInItem.difference = difference;

      rawMaterialInItem.setItemAmount();

      rawMaterialInItems.push(rawMaterialInItem);
      rawMaterialInItemWithWeights.push({rawMaterialInItem, rawMaterialInItemWeights});
    }

    // console.log(JSON.stringify(rawMaterialInItemWithWeights));

    // res.status(500).json({
    //   message: "Adding a Raw Material In Qty failed!"
    // });

    
    const otherCharges = purchaseOrder.purchaseOrderOtherCharges;
    const rawMaterialInOtherCharges = [];
    for(const otherCharge of otherCharges) {
      const rawMaterialInOtherCharge = await RawMaterialInOtherCharge.build({
        tax_type: tax_type,
        raw_material_id: otherCharge.item_id,
        qty: otherCharge.qty,
        item_desc: otherCharge.item_desc,
        rate: otherCharge.rate,
        tax_per: otherCharge.tax_per,
        amount: otherCharge.amount,
        hsn_code: otherCharge.hsn_code,
        po_quantity: otherCharge.qty,
        po_rate: otherCharge.rate,
        po_amount: otherCharge.amount,
        po_cgst_amt: otherCharge.cgst_amt,
        po_sgst_amt: otherCharge.sgst_amt,
        po_igst_amt: otherCharge.igst_amt,
        po_tax_amt: otherCharge.tax_amt,
        po_total_amt: otherCharge.total_amt,
        po_item_id: otherCharge.id
      });
      error = await rawMaterialInOtherCharge.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      if (purchaseOrder && purchaseOrder.is_advance === 1) {
        await rawMaterialInOtherCharge.setPaymentVoucherItemDetails();
      }
      
      await rawMaterialInOtherCharge.setItemAmount();
      
      rawMaterialInOtherCharges.push(rawMaterialInOtherCharge);
    }

    t = await sequelize.transaction();

    if (purchaseOrder) {
      await rawMaterialIn.setPaymentVoucherDetails();
      // rawMaterialIn.approve(req);

      if (!rawMaterialIn.raw_material_in_no) {
        const series = await getSeries(req, 'Raw_Material_In');
        rawMaterialIn.getRawMaterialInNo(series.series);
        await series.save({ transaction: t });
      }
    }
    
    rawMaterialIn.setTransactionAmount(rawMaterialInItems, rawMaterialInOtherCharges);

    // console.log(rawMaterialIn);
    // console.log(rawMaterialInOtherCharges);

    await rawMaterialIn.save({ transaction: t });

    for(const rawMaterialInItemWithWeight of rawMaterialInItemWithWeights) {
      const rawMaterialInItem = rawMaterialInItemWithWeight.rawMaterialInItem;
      rawMaterialInItem.raw_material_in_id = rawMaterialIn.id;
      await rawMaterialInItem.save({ transaction: t });

      for(const rawMaterialInItemWeight of rawMaterialInItemWithWeight.rawMaterialInItemWeights) {
        rawMaterialInItemWeight.raw_material_in_id = rawMaterialIn.id;
        rawMaterialInItemWeight.raw_material_in_item_id = rawMaterialInItem.id;
        rawMaterialInItemWeight.setRawMaterialInItemWeightDetails();
        await rawMaterialInItemWeight.save({ transaction: t });
      }
    }

    for(const rawMaterialInOtherCharge of rawMaterialInOtherCharges) {
      rawMaterialInOtherCharge.raw_material_in_id = rawMaterialIn.id;
      await rawMaterialInOtherCharge.save({ transaction: t });
    }

    if (!rawMaterialIn.partial_po) {
      let purchaseOrder = await PurchaseOrder.findByPk(rawMaterialIn.purchase_order_id);
      purchaseOrder.setRawMaterialIn();
      await purchaseOrder.save({ transaction: t });
    }

    // console.log(rawMaterialIn);
    // console.log(rawMaterialInOtherCharges);
    // console.log(purchaseOrder);
    
    await t.commit();
    
    rawMaterialIn = await RawMaterialIn.findByPk(rawMaterialIn.id, { 
      include: [{ 
          model: RawMaterialInItem , 
          as: "rawMaterialInItems", 
          include: [{ model: RawMaterial, as: "raw_material", attributes: ["id", "rm_name"]}, 
          "rawMaterialInItemWeights"] 
        }, 
        "rawMaterialInOtherCharges", "vendor", "depot"
      ] 
    });

    // t = await sequelize.transaction();
    await Stock.destroy({ where: { stock_type: 'Raw Material In', raw_material_in_id: rawMaterialIn.id }});
    let dataArray = Stock.setStockDetails('Raw Material In', rawMaterialIn, t, req);
    Stock.bulkCreate(dataArray);
    // await t.commit();
    // error = await Stock.setStockDetails('Raw Material In', rawMaterialIn, session, req);
    // if (error) throw error;

    return res.status(200).json({
      message: "Raw Material In Qty added successfully.",
      rawMaterialIn: rawMaterialIn
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Adding a Raw Material In Qty failed!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Adding a Raw Material In Qty failed!";
    next(error, req, res);
  }
};

export const updateRawMaterialIn = async (req, res, next) => {
  let t;

  try {
    let rawMaterialIn = await RawMaterialIn.findByPk(req.params.id);
    if (!rawMaterialIn) {
      return res.status(404).json({message: "Raw Material In not found!"});
    }

    if (rawMaterialIn.grn_status.trim().toUpperCase() !== 'INCHECK' && rawMaterialIn.grn_status.trim().toUpperCase() !== 'INPROCESS' && rawMaterialIn.grn_status.trim().toUpperCase() !== 'REJECTED') {
      return res.status(422).json({
        message: "Raw Material In rates are already processed."
      });
    }

    let blUpdate = false;
    if (rawMaterialIn.grn_status && rawMaterialIn.grn_status.trim().toUpperCase() === 'APPROVED') {
      rawMaterialIn = await RawMaterialIn.build({
        status: 'Approved',
        grn_status: 'InCheck',
        created_by: req.userData.userId,
        modified_by: req.userData.userId
      });
  
      rawMaterialIn.getRequestData(req);

      rawMaterialIn.ref_id = req.params.id;
    } else {
      rawMaterialIn.getRequestData(req);
      rawMaterialIn.status = 'Approved';
      rawMaterialIn.grn_status = 'InCheck';
      rawMaterialIn.modified_by = req.userData.userId;
      blUpdate = true;
    }

    let error = await rawMaterialIn.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    const tax_type = await rawMaterialIn.setTaxType();
    
    const { purchaseOrder, rawMaterialInQtys } = await getPurchaseOrderDetails(rawMaterialIn.purchase_order_id, 0);
    
    const items = rawMaterialIn.getRawMaterialInItems(req.body);
    const rawMaterialInItems = [];
    const rawMaterialInItemWithWeights = [];
    let index = 0;
    for(const item of items) {
      const rawMaterialInItem = await RawMaterialInItem.build({
        tax_type: tax_type
      });
      rawMaterialInItem.getRequestData(item.rawMaterialInItem);
      error = await rawMaterialInItem.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      await rawMaterialInItem.setPoItemDetails();

      if (purchaseOrder && purchaseOrder.is_advance === 1) {
        await rawMaterialInItem.setPaymentVoucherItemDetails();
      }

      const rawMaterialInItemWeights = [];
      let no_of_boxes = 0;
      let net_weight = 0;
      let gross_weight = 0;
      let difference = 0;
      for(const itemWeight of item.rawMaterialInItemWeights) {
        const rawMaterialInItemWeight = await RawMaterialInItemWeight.build({
          vendor_id: rawMaterialIn.vendor_id
        });
        
        rawMaterialInItemWeight.getRequestData(itemWeight);
        error = await rawMaterialInItemWeight.validateData();
        if (error) {
          return res.status(422).json({
            message: "Invalid inputs passed, please check your data.",
            error: error
          });
        }

        rawMaterialInItemWeights.push(rawMaterialInItemWeight);
        no_of_boxes = no_of_boxes + 1;
        net_weight = round(net_weight + rawMaterialInItemWeight.net_weight, 4);
        gross_weight = round(gross_weight + rawMaterialInItemWeight.gross_weight, 4);
        difference = round(difference + rawMaterialInItemWeight.difference, 4);
      }

      if (rawMaterialInItem.no_of_boxes !== no_of_boxes || round(rawMaterialInItem.qty, 4) !== round(net_weight, 4)) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: { errors : { qty: { message: `Raw Material Item Weight does not match.` } } }
        });
      }
      rawMaterialInItem.gross_weight = gross_weight;
      rawMaterialInItem.difference = difference;

      rawMaterialInItem.setItemAmount();

      rawMaterialInItems.push(rawMaterialInItem);
      rawMaterialInItemWithWeights.push({rawMaterialInItem, rawMaterialInItemWeights});

      index = index + 1;
    }

    const otherCharges = purchaseOrder.purchaseOrderOtherCharges;
    const rawMaterialInOtherCharges = [];
    for(const otherCharge of otherCharges) {
      const rawMaterialInOtherCharge = await RawMaterialInOtherCharge.build({
        tax_type: tax_type,
        raw_material_id: otherCharge.item_id,
        qty: otherCharge.qty,
        item_desc: otherCharge.item_desc,
        rate: otherCharge.rate,
        tax_per: otherCharge.tax_per,
        amount: otherCharge.amount,
        hsn_code: otherCharge.hsn_code,
        po_quantity: otherCharge.qty,
        po_rate: otherCharge.rate,
        po_amount: otherCharge.amount,
        po_cgst_amt: otherCharge.cgst_amt,
        po_sgst_amt: otherCharge.sgst_amt,
        po_igst_amt: otherCharge.igst_amt,
        po_tax_amt: otherCharge.tax_amt,
        po_total_amt: otherCharge.total_amt,
        po_item_id: otherCharge.id
      });
      error = await rawMaterialInOtherCharge.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      if (purchaseOrder && purchaseOrder.is_advance === 1) {
        await rawMaterialInOtherCharge.setPaymentVoucherItemDetails();
      }
      
      await rawMaterialInOtherCharge.setItemAmount();
      
      rawMaterialInOtherCharges.push(rawMaterialInOtherCharge);
    }

    t = await sequelize.transaction();

    if (purchaseOrder && purchaseOrder.is_advance === 1) {
      await rawMaterialIn.setPaymentVoucherDetails();
      rawMaterialIn.approve(req);

      // if (!rawMaterialIn.raw_material_in_no) {
      //   const series = await getSeries(req, 'Raw_Material_In');
      //   rawMaterialIn.getRawMaterialInNo(series.series);
      //   await series.save({ transaction: t });
      // }
    }
    
    rawMaterialIn.setTransactionAmount(rawMaterialInItems, rawMaterialInOtherCharges);

    await rawMaterialIn.save({ transaction: t });

    if (blUpdate === true) {
      await RawMaterialInItem.destroy({ where: { raw_material_in_id: rawMaterialIn.id }, transaction: t });
      await RawMaterialInItemWeight.destroy({ where: { raw_material_in_id: rawMaterialIn.id }, transaction: t });
      await RawMaterialInOtherCharge.destroy({ where: { raw_material_in_id: rawMaterialIn.id }, transaction: t });
    }
    
    for(const rawMaterialInItemWithWeight of rawMaterialInItemWithWeights) {
      const rawMaterialInItem = rawMaterialInItemWithWeight.rawMaterialInItem;
      rawMaterialInItem.raw_material_in_id = rawMaterialIn.id;
      await rawMaterialInItem.save({ transaction: t });
      // console.log(rawMaterialInItem);

      for(const rawMaterialInItemWeight of rawMaterialInItemWithWeight.rawMaterialInItemWeights) {
        rawMaterialInItemWeight.raw_material_in_id = rawMaterialIn.id;
        rawMaterialInItemWeight.raw_material_in_item_id = rawMaterialInItem.id;
        rawMaterialInItemWeight.setRawMaterialInItemWeightDetails();
        await rawMaterialInItemWeight.save({ transaction: t });
        // console.log(rawMaterialInItemWeight);
      }
    }

    for(const rawMaterialInOtherCharge of rawMaterialInOtherCharges) {
      rawMaterialInOtherCharge.raw_material_in_id = rawMaterialIn.id;
      await rawMaterialInOtherCharge.save({ transaction: t });
    }

    if (!rawMaterialIn.partial_po) {
      let purchaseOrder = await PurchaseOrder.findByPk(rawMaterialIn.purchase_order_id);
      purchaseOrder.setRawMaterialIn();
      await purchaseOrder.save({ transaction: t });
    } else {
      let purchaseOrder = await PurchaseOrder.findByPk(rawMaterialIn.purchase_order_id);
      purchaseOrder.OpenPo();
      await purchaseOrder.save({ transaction: t });
    }
    
    // console.log(rawMaterialIn);
    // console.log(purchaseOrder);
    // console.log(rawMaterialInOtherCharges);

    await t.commit();

    rawMaterialIn = await RawMaterialIn.findByPk(rawMaterialIn.id, { 
      include: [{ 
          model: RawMaterialInItem , 
          as: "rawMaterialInItems", 
          include: [{ model: RawMaterial, as: "raw_material", attributes: ["id", "rm_name"]}, 
          "rawMaterialInItemWeights"] 
        }, 
        "rawMaterialInOtherCharges", "vendor", "depot"
      ] 
    });

    // t = await sequelize.transaction();
    await Stock.destroy({ where: { stock_type: 'Raw Material In', raw_material_in_id: rawMaterialIn.id }});
    let dataArray = Stock.setStockDetails('Raw Material In', rawMaterialIn, t, req);
    Stock.bulkCreate(dataArray);
    // await t.commit();
    // error = await Stock.setStockDetails('Raw Material In', rawMaterialIn, session, req);
    // if (error) throw error;

    res.status(200).json({ message: "Update successful!", rawMaterialIn: rawMaterialIn });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't udpate rawMaterialIn!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't update Raw Material In!";
    next(error, req, res);
  }
};

export const updateRawMaterialInRate = async (req, res, next) => {
  let t;

  try {
    let rawMaterialIn = await RawMaterialIn.findByPk(req.params.id);
    if (!rawMaterialIn) {
      return res.status(404).json({message: "Raw Material In not found!"});
    }

    let blUpdate = false;
    let items = [];
    if (rawMaterialIn.grn_status && rawMaterialIn.grn_status.trim().toUpperCase() === 'APPROVED') {
      return res.status(404).json({message: "Raw Material In is already approved!"});

      // rawMaterialIn = await RawMaterialIn.build({
      //   status: 'Pending',
      //   created_by: req.userData.userId,
      //   modified_by: req.userData.userId
      // });
  
      // rawMaterialIn.getRequestDataForRate(req);

      // rawMaterialIn.ref_id = req.params.id;

      // duplicate and insert existing raw material items & item weights
      // update raw material in item id in item weights
      // items = [];
    } else {
      rawMaterialIn.getRequestDataForRate(req);
      rawMaterialIn.grn_status = 'Pending';
      rawMaterialIn.modified_by = req.userData.userId;
      blUpdate = true;

      items = rawMaterialIn.getRawMaterialInItemsForRate(req.body);
    }

    let error = await rawMaterialIn.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    const tax_type = await rawMaterialIn.setTaxType();

    const rawMaterialInItems = [];
    for(const item of items) {
      const rawMaterialInItem = await RawMaterialInItem.findByPk(item.id);
      if (!rawMaterialInItem) {
        return res.status(404).json({message: "Raw Material In Item not found!"});
      }
      rawMaterialInItem.getRequestDataForRate(item);
      error = await rawMaterialInItem.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      rawMaterialInItem.setItemAmount();
      rawMaterialInItems.push(rawMaterialInItem);
    }

    const otherCharges = rawMaterialIn.getRawMaterialInOtherCharges(req.body);
    const rawMaterialInOtherCharges = [];
    for(const otherCharge of otherCharges) {
      let rawMaterialInOtherCharge = {};
      if (otherCharge.id) {
        rawMaterialInOtherCharge = await RawMaterialInOtherCharge.findByPk(otherCharge.id);

        if (!rawMaterialInOtherCharge) {
          return res.status(404).json({message: "Raw Material In Other Charge Item not found!"});
        }
      } else {
        rawMaterialInOtherCharge = await RawMaterialInOtherCharge.build({
          tax_type: tax_type
        });
      }
      
      rawMaterialInOtherCharge.getRequestData(otherCharge);
      error = await rawMaterialInOtherCharge.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      await rawMaterialInOtherCharge.setPoItemDetails();
      rawMaterialInOtherCharges.push(rawMaterialInOtherCharge);
    }

    rawMaterialIn.setTransactionAmount(rawMaterialInItems, rawMaterialInOtherCharges);

    // console.log(rawMaterialIn);
    // console.log(rawMaterialInItems);
    // console.log(rawMaterialInOtherCharges);

    t = await sequelize.transaction();
    await rawMaterialIn.save({ transaction: t });

    // if (blUpdate === true) {
    //   // await RawMaterialInItem.destroy({ where: { raw_material_in_id: rawMaterialIn.id }, transaction: t });
    //   // await RawMaterialInItemWeight.destroy({ where: { raw_material_in_id: rawMaterialIn.id }, transaction: t });
    //   await RawMaterialInOtherCharge.destroy({ where: { raw_material_in_id: rawMaterialIn.id }, transaction: t });
    // }
    
    for(const rawMaterialInItem of rawMaterialInItems) {
      rawMaterialInItem.raw_material_in_id = rawMaterialIn.id;
      await rawMaterialInItem.save({ transaction: t });
    }

    for(const rawMaterialInOtherCharge of rawMaterialInOtherCharges) {
      rawMaterialInOtherCharge.raw_material_in_id = rawMaterialIn.id;
      await rawMaterialInOtherCharge.save({ transaction: t });
    }

    // if (!rawMaterialIn.partial_po) {
    //   let purchaseOrder = await PurchaseOrder.findByPk(rawMaterialIn.purchase_order_id);
    //   purchaseOrder.setRawMaterialIn();
    //   await purchaseOrder.save({ transaction: t });
    // } else {
    //   let purchaseOrder = await PurchaseOrder.findByPk(rawMaterialIn.purchase_order_id);
    //   purchaseOrder.OpenPo();
    //   await purchaseOrder.save({ transaction: t });
    // }

    // return res.status(422).json({
    //   message: "Invalid inputs passed, please check your data.",
    //   // error: error
    // });
    
    await t.commit();
    
    res.status(200).json({ message: "Update successful!", rawMaterialIn: rawMaterialIn });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't udpate rawMaterialIn!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't update Raw Material In!";
    next(error, req, res);
  }
};

export const approveRawMaterialIn = async (req, res, next) => {
  let t;

  try {
    let raw_material_in_id = req.params.id;
    let rawMaterialIn = await RawMaterialIn.findByPk(raw_material_in_id);
    if (!rawMaterialIn) {
      return res.status(404).json({
        message: "Raw Material In not found!"
      });
    }

    // if (rawMaterialIn.modified_by === req.userData.userId) {
    //   return res.status(422).json({ 
    //     message: `You can't approve this RawMaterialIn.`, 
    //     error : { 
    //       errors : { 
    //         vendorDate: { message: `You can't approve this RawMaterialIn.` } 
    //       } 
    //     }
    //   });
    // }

    if (rawMaterialIn.modified_by.toString() === req.userData.userId.toString()) {
      return res.status(422).json({ 
        message: `You can't approve this Raw Material In.`, 
        error : { 
          errors : { 
            vendorDate: { message: `You can't approve this Raw Material In.` } 
          } 
        }
      });
    }

    // console.log(rawMaterialIn);

    if (rawMaterialIn.grn_status.trim().toUpperCase() !== 'PENDING' && rawMaterialIn.grn_status.trim().toUpperCase() !== 'DELETED') {
      return res.status(422).json({ 
        message: `Raw Material In status should be pending or deleted.`, 
        error : { 
          errors : { 
            vendorDate: { message: `Raw Material In status should be pending or deleted.` } 
          } 
        }
      });
    }

    rawMaterialIn.approve(req);

    // console.log(error);
    // rawMaterialIn.approvedBy = req.userData.userId;
    // rawMaterialIn.approvedAt = new Date().toISOString();

    const error = await rawMaterialIn.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    // try {
      t = await sequelize.transaction();
      
      // if (!rawMaterialIn.raw_material_in_no) {
      //   const series = await getSeries(req, 'Raw_Material_In');
      //   rawMaterialIn.getRawMaterialInNo(series.series);
      //   await series.save({ transaction: t });
      // }
      
      if (!rawMaterialIn.ref_id) {
        await rawMaterialIn.save({ transaction: t });
      } else {
        // const obj = JSON.parse(JSON.stringify(rawMaterialIn));
        // delete obj._id;
        // obj.ref_id = null;

        const ref_id = rawMaterialIn.ref_id;
        raw_material_in_id = rawMaterialIn.ref_id;

        const obj = rawMaterialIn.dataValues;
        delete obj.id;
        obj.ref_id = null;

        // console.log(obj);
        // console.log(ref_id);
        // console.log(req.params.id);

        await RawMaterialIn.destroy({ where: {id: req.params.id }}, { transaction: t });

        // rawMaterialIn = await RawMaterialIn.findByIdAndUpdate(ref_id, obj, { session: session, new: true });

        await RawMaterialIn.update(obj, { where: { id: ref_id } }, { transaction: t });

        await RawMaterialInItem.destroy({ where: {raw_material_in_id: ref_id }}, { transaction: t });

        await RawMaterialInItem.update({ raw_material_in_id: ref_id }, { where: { raw_material_in_id: req.params.id }}, { transaction: t });

        await RawMaterialInItemWeight.destroy({ where: {raw_material_in_id: ref_id }}, { transaction: t });

        await RawMaterialInItemWeight.update({ raw_material_in_id: ref_id }, { where: { raw_material_in_id: req.params.id }}, { transaction: t });

        await RawMaterialInOtherCharge.destroy({ where: {raw_material_in_id: ref_id }}, { transaction: t });

        await RawMaterialInOtherCharge.update({ raw_material_in_id: ref_id }, { where: { raw_material_in_id: req.params.id }}, { transaction: t });

        // originalRawMaterialIn = await RawMaterialIn.findById(rawMaterialIn.ref_id);
        // originalRawMaterialIn.overwrite(rawMaterialIn);
        // originalRawMaterialIn.ref_id = null;
        // originalRawMaterialIn.vendorState = rawMaterialIn.vendorState;
        // // console.log(originalRawMaterialIn);
        // await originalRawMaterialIn.save({ session });
      }

      rawMaterialIn = await RawMaterialIn.findByPk(raw_material_in_id, {
        include: [
          { model: Depot, as: "depot", attributes: ["id", "depot_name", "state"] }, 
          { model: Vendor, as: "vendor", attributes: ["id", "vendor_name", "state", "gst_number"] }, 
          { model: PurchaseOrder, as: "purchase_order", attributes: ["id", "po_no", "po_status"] },
          { 
            model: RawMaterialInItem, 
            as: "rawMaterialInItems", 
            include: { model: RawMaterial, as: "raw_material", attributes: ["id", "rm_name"] },
          },
          { model: RawMaterialInOtherCharge, as: "rawMaterialInOtherCharges" }
        ]
      });
      
      let purchaseOrder = await PurchaseOrder.findByPk(rawMaterialIn.purchase_order_id);

      if (!rawMaterialIn.partial_po) {
        purchaseOrder.setRawMaterialIn();
        await purchaseOrder.save({ transaction: t });
      } else {
        purchaseOrder.OpenPo();
        await purchaseOrder.save({ transaction: t });
      }

      if (purchaseOrder && purchaseOrder.is_advance !== 1) {
        const paymentVoucher = await PaymentVoucher.build({
          status: 'InProcess',
          requestor_id: req.userData.userId,
          created_by: req.userData.userId,
          modified_by: req.userData.userId
        });
        paymentVoucher.setRawMaterialInData(rawMaterialIn);
        await paymentVoucher.save({ transaction: t });
  
        for (const rawMaterialInItem of rawMaterialIn.rawMaterialInItems) {
          const paymentVoucherItem = await PaymentVoucherItem.build({
            payment_voucher_id: paymentVoucher.id
          });
          paymentVoucherItem.setRawMaterialInItemData(rawMaterialInItem);
          await paymentVoucherItem.save({ transaction: t });
        }
        for (const rawMaterialInOtherCharge of rawMaterialIn.rawMaterialInOtherCharges) {
          const paymentVoucherItem = await PaymentVoucherItem.build({
            payment_voucher_id: paymentVoucher.id
          });
          paymentVoucherItem.setRawMaterialInItemData(rawMaterialInOtherCharge);
          await paymentVoucherItem.save({ transaction: t });
        }
      }
      
      await t.commit();
          
      const id = raw_material_in_id;
      const module = 'Raw Material In';
      const rm_ids = await set_raw_material_rate(module, id, req.userData.userId);
      // console.log('rm_ids - ', rm_ids);
      const ing_ids = await set_products(module, id, req.userData.userId);
      // console.log('ing_ids - ', ing_ids);
      const box_ids = await set_product_rate(module, ing_ids, req.userData.userId);
      // console.log('box_ids - ', box_ids);
      send_updated_variations(rm_ids, ing_ids, box_ids)
        .then(r => console.log(r))
        .catch(err => console.log(err));

    // } catch (error) { 
    //     await session.abortTransaction();
    // }
    
    res.status(200).json({ message: "Approve successful!" });
  } catch (error) {
    // console.log(error);

    if (t) {
      await t.rollback();
    }

    // res.status(500).json({
    //   message: 'Approving Raw Material In failed! Error - ' + (error.message ? error.message : '')
    // });
    
    res.statusCode = 500;
    res.message = "Approving Raw Material In failed!";
    next(error, req, res);
  }
};

export const approvePendingRawMaterialIn = async (req, res, next) => {
  let t;

  try {
    let raw_material_in_id = req.params.id;
    let rawMaterialIn = await RawMaterialIn.findByPk(raw_material_in_id);
    if (!rawMaterialIn) {
      return res.status(404).json({
        message: "Raw Material In not found!"
      });
    }

    if (rawMaterialIn.grn_status.trim().toUpperCase() !== 'INCHECK'  && rawMaterialIn.grn_status.trim().toUpperCase() !== 'PENDING'  && rawMaterialIn.grn_status.trim().toUpperCase() !== 'DELETED') {
      return res.status(422).json({ 
        message: `Raw Material In status should be pending or deleted.`, 
        error : { 
          errors : { 
            vendorDate: { message: `Raw Material In status should be pending or deleted.` } 
          } 
        }
      });
    }

    rawMaterialIn.grn_status = "InProcess";
    rawMaterialIn.approvedBy = req.userData.userId;
    rawMaterialIn.approvedAt = new Date().toISOString();

    await rawMaterialIn.save();
    res.status(200).json({ message: "Approve successful!" });

  } catch (error) {
    
    res.statusCode = 500;
    res.message = "Approving Raw Material In failed!";
    next(error, req, res);
  }
};

export const rejectRawMaterialIn = async (req, res, next) => {
  let t;
  try {
    let rawMaterialIn = await RawMaterialIn.findByPk(req.params.id);

    if (!rawMaterialIn) {
      return res.status(404).json({
        message: "Raw Material In not found!"
      });
    }

    if (rawMaterialIn.modified_by.toString() === req.userData.userId.toString()) {
      return res.status(422).json({ 
        message: `You can't reject this Raw Material In.`, 
        error : { 
          errors : { 
            vendorDate: { message: `You can't reject this Raw Material In.` } 
          } 
        }
      });
    }

    if (rawMaterialIn.grn_status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({ 
        message: `Raw Material In is already approved.`, 
        error : { 
          errors : { 
            vendorDate: { message: `Raw Material In is already approved.` } 
          } 
        }
      });
    }

    t = await sequelize.transaction();
    let purchaseOrder = await PurchaseOrder.findByPk(rawMaterialIn.purchase_order_id);
    purchaseOrder.po_status = '';
    rawMaterialIn.reject(req);
    await purchaseOrder.save({ transaction: t });
    await rawMaterialIn.save({ transaction: t });

    await t.commit();

    res.status(200).json({ message: "Reject successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Rejecting Raw Material In failed!"
    // });
    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Rejecting Raw Material In failed!";
    next(error, req, res);
  }
};

export const getRawMaterialIns = async (req, res, next) => {
  try {
    let status = 'InCheck';
    let pageSize = 10;
    let pageIndex = 0;
    let query = '';
    let sort = { key: 'modified_on', order: 'desc' };

    if (req.query) {
      status = req.query.status ? req.query.status : 'InCheck';
      if (req.query.pageSize && req.query.pageSize.toString().trim().toUpperCase() === 'ALL') {
        pageSize = 'ALL';
      } else {
        pageSize = req.query.pageSize ? +req.query.pageSize : 10;
      }
      pageIndex = req.query.pageIndex ? +req.query.pageIndex : 0;
      query = req.query.query ? req.query.query : '';
      sort = { key: (req.query.key ? req.query.key : 'modified_on'), order: (req.query.order ? req.query.order : 'desc') };
    }

    let condition = {};
    let searchCondition = {};

    if (query) {
      searchCondition = {
        [Op.or]: [
          { 'raw_material_in_no': {[Op.like]: `%${query}%` } }, 
          // Sequelize.literal("`purchase_order`.`po_no` LIKE '%"+query+"%'"),
          // Sequelize.literal("`depot`.`depot_name` LIKE '%"+query+"%'"), 
          // Sequelize.literal("`vendor`.`vendor_name` LIKE '%"+query+"%'"), 
          // Sequelize.literal("`rawMaterialInItems`.`item_name` LIKE '%"+query+"%'")
          
          {'$po_no$': { [Op.like]: `%${query}%` }}, 
          {'$depot_name$': { [Op.like]: `%${query}%` }}, 
          {'$vendor_name$': { [Op.like]: `%${query}%` }}, 
          {'$rm_in_item_names$': { [Op.like]: `%${query}%` }}
        ],
        depot_id: {[Op.in]: req.userData.depotIds}
      };

      condition['where'] = searchCondition;
    } else {
      condition['where'] = { depot_id: {[Op.in]: req.userData.depotIds} };
    }

    // condition['include'] = [
    //   { model: PurchaseOrder, as: 'purchase_order', attributes: ['po_no'] },
    //   { model: Depot, as: 'depot', attributes: ['depot_name'] }, 
    //   { model: Vendor, as: 'vendor', attributes: ['vendor_name'] }, 
    //   { model: RawMaterialInItem, InItems', attributes: ['item_name'] }
    // ];

    // let totalCount = 0;
    const statusCount = {
      pending: 0,
      approved: 0,
      inCheck: 0,
      rejected: 0,
      inActive: 0,
      inProcess: 0,
      processed: 0,
      resubmit: 0
    };
    const data = await RawMaterialIn.findAll(
      { 
        ...condition, 
        attributes: [
          'status', 'grn_status', 'po_no', 'depot_name', 'vendor_name', 'rm_in_item_names', 
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ], 
        group:['status', 'grn_status', 'po_no', 'depot_name', 'vendor_name', 'rm_in_item_names'], 
        raw: true
      }
    );
    // console.log(data);
    for (const item of data) {
      // console.log(item.grn_status);
      // console.log(item.count);
      if (item.grn_status === "Pending" || item.grn_status === "Deleted") {
        statusCount.pending = statusCount.pending + parseInt(item.count);
        // totalCount = parseInt(item.count);
      }
      else if (item.grn_status === "Approved") {
        statusCount.approved = statusCount.approved + parseInt(item.count);
        // totalCount = parseInt(item.count);
      }
      else if (item.grn_status === "InProcess" || (item.grn_status === "Rejected" && item.status === "Approved")) {
      // else if (item.grn_status === "InProcess") {
        statusCount.inProcess = statusCount.inProcess + parseInt(item.count);
        // totalCount = parseInt(item.count);
      }
      else if (item.grn_status === "Rejected") {
        statusCount.rejected = statusCount.rejected + parseInt(item.count);
        // totalCount = parseInt(item.count);
      }
      else if (item.grn_status === "Rejected") {
        statusCount.rejected = statusCount.rejected + parseInt(item.count);
        // totalCount = parseInt(item.count);
      }
      else if (item.grn_status === "Rejected") {
        statusCount.rejected = statusCount.rejected + parseInt(item.count);
        // totalCount = parseInt(item.count);
      }
      else if (item.grn_status === "InCheck") {
        statusCount.inCheck = statusCount.inCheck + parseInt(item.count);
        // totalCount = parseInt(item.count);
      }
      else if (item.grn_status === "InActive") {
        statusCount.inActive = statusCount.inActive + parseInt(item.count);
        // totalCount = parseInt(item.count);
      }
      else if (item.grn_status === "Resubmit") {
        statusCount.resubmit = statusCount.resubmit + parseInt(item.count);
        // totalCount = parseInt(item.count);
      }

      if (item.grn_status != "InProcess") {
        statusCount.processed = statusCount.processed + parseInt(item.count);
      }
    }
    
    let statusCondition = { grn_status: status };
    if (status) {
      if (status.trim().toUpperCase() === 'PENDING') {
        statusCondition = { grn_status: {[Op.or] : ['Pending', 'Deleted']} };
      } else if (status.trim().toUpperCase() === 'INPROCESS') {
        // statusCondition = { [Op.or] : [{grn_status: 'InProcess'}, {grn_status: 'Rejected', status: 'Approved'}] };
        statusCondition = {grn_status: 'InProcess'};
      } else if (status.trim().toUpperCase() === 'PROCESSED') {
        statusCondition = { grn_status: {[Op.notIn] : ['InProcess', 'InCheck', 'Rejected']} };
      } else {
        statusCondition = { grn_status: status };
      }
    }
    if (query) {
      condition['where'] = {
        [Op.and]: [
          searchCondition,
          statusCondition
        ]
      };
    } else {
      condition['where'] = { ...statusCondition, depot_id: {[Op.in]: req.userData.depotIds} };
    }

    let order = [['modified_on', 'DESC']];
    if (sort) {
      if (sort.key) {
        order = [[sort.key, (sort.order ? sort.order : 'ASC')]];
      }
    }
    condition['order'] = order;

    if (pageSize.toString().trim().toUpperCase() === 'ALL') {
      //Do Nothing
    } else {
      if (pageIndex) {
        condition['offset'] = (pageIndex * pageSize);
      }
      
      if (pageSize) {
        condition['limit'] = pageSize;
      }
    }

    const { count, rows } = await RawMaterialIn.findAndCountAll(condition);
    // const rows = 

    res.status(200).json({
      message: "Raw Material Ins fetched successfully!",
      // totalCount: totalCount,
      total: count,
      statusCount: statusCount,
      rows: rows
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Raw Material Ins failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Raw Material Ins failed!";
    next(error, req, res);
  }
};

export const getRawMaterialIn = async (req, res, next) => {
  try {
    const rawMaterialIn = await RawMaterialIn.findByPk(req.params.id, { 
      include: [{ 
          model: RawMaterialInItem , 
          as: "rawMaterialInItems", 
          include: [{ model: RawMaterial, as: "raw_material", attributes: ["id", "rm_name"]}, 
          "rawMaterialInItemWeights"] 
        }, 
        "rawMaterialInOtherCharges", 
        { model: Vendor, as: "vendor", attributes: ['id', 'vendor_name', 'vendor_code', 'address', 'city', 'pincode', 'state', 'country', 'gst_number', 'payment_due_days'] },
        { model: Depot, as: "depot", attributes: ['id', 'depot_name', 'address', 'city', 'pincode', 'state', 'country', 'gst_no'] },
        { model: User, as: "created_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
        { model: User, as: "modified_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
        { model: User, as: "approved_by_user", attributes: ['id', 'first_name', 'last_name'] }
      ] 
    });
    if (!rawMaterialIn) {
      return res.status(404).json({ message: "Raw Material In not found!" });
    }

    const roleDetails = req.userData.roleDetails;

    // console.log(roleDetails);

    const action = {
      update: false,
      delete: false,
      approve: false
    };

    // console.log(rawMaterialIn.modified_by.toString());
    // console.log(req.userData.userId);
    
    // if (rawMaterialIn.isFreezed) {
    //   if (rawMaterialIn.status.trim().toUpperCase() !== 'APPROVED' && rawMaterialIn.status.trim().toUpperCase() !== 'INACTIVE') {
    //     if (roleDetails.r_edit) {
    //       action.update = true;
    //     }
    //     if (roleDetails.r_delete) {
    //       action.delete = true;
    //     }
    //   }
    // } else {
      if (!roleDetails.r_approvals || 
            (rawMaterialIn.grn_status.trim().toUpperCase() !== 'PENDING' && rawMaterialIn.grn_status.trim().toUpperCase() !== 'INCHECK' && 
            rawMaterialIn.grn_status.trim().toUpperCase() !== 'DELETED') || 
            rawMaterialIn.modified_by.toString() === req.userData.userId.toString()) //req.userData.userId.toString()
      {
        if (roleDetails.r_edit) {
          action.update = true;
        }
        if (roleDetails.r_delete) {
          // action.delete = true;
        }
      } else if (roleDetails.r_approvals) {
        action.approve = true;
      }
    // }
    
  
    // const pincodes = await Pincode.findAll({ attributes: ['id', 'pincode', 'state_id'] });
    // const cities = await City.findAll({ attributes: ['id', 'city_name', 'state_id'] });
    // const states = await State.findAll({ attributes: ['id', 'state_name', 'country_id'] });
    // const countries = await Country.findAll({ attributes: ['id', 'country_name'] });

    const masterData = await getRawMaterialInMasterData(rawMaterialIn, req);
    const { purchaseOrder, rawMaterialInQtys } = await getPurchaseOrderDetails(rawMaterialIn.purchase_order_id, rawMaterialIn.id);
  
    return res.status(200).json({ 
      message: "Raw Material In fetched successfully!",
      action, 
      rawMaterialIn, 
      masterData, 
      purchaseOrder,
      rawMaterialInQtys
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Raw Material In failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Raw Material In failed!";
    next(error, req, res);
  }
};

export const deleteRawMaterialIn = async (req, res, next) => {
  let t;

  try {
    let rawMaterialIn = await RawMaterialIn.findByPk(req.params.id, {raw: true});
    if (!rawMaterialIn) {
      return res.status(404).json({ message: "Raw Material In not found!" });
    }

    t = await sequelize.transaction();

    if (rawMaterialIn.grn_status.trim().toUpperCase() === 'APPROVED') {
      rawMaterialIn.id = null;
      rawMaterialIn.grn_status = 'Deleted';
      rawMaterialIn.ref_id = req.params.id;
      
      rawMaterialIn = await RawMaterialIn.build({
        ...rawMaterialIn
      });

      await rawMaterialIn.save({ transaction: t });

      let rawMaterialInItems = await RawMaterialInItem.findAll({ 
        where: { raw_material_in_id: req.params.id}, 
        // attributes: ['raw_material_in_id', 'item_person', 'email_id', 'mobile'], 
        raw: true 
      });

      // rawMaterialInItems = rawMaterialInItems.map(rawMaterialInItem => {
      //   // rawMaterialInItem.id = null;
      //   delete rawMaterialInItem.id;
      //   rawMaterialInItem.raw_material_in_id = rawMaterialIn.id;
      //   return rawMaterialInItem;
      // });

      // await RawMaterialInItem.bulkCreate(rawMaterialInItems, { transaction: t });
      
      for (const rawMaterialInItem of rawMaterialInItems) {
        let rawMaterialInItemWeights = await RawMaterialInItemWeight.findAll({ 
          where: { raw_material_in_id: req.params.id, raw_material_in_item_id: rawMaterialInItem.id }, 
          // attributes: ['raw_material_in_id', 'item_person', 'email_id', 'mobile'], 
          raw: true 
        });

        delete rawMaterialInItem.id;
        rawMaterialInItem.raw_material_in_id = rawMaterialIn.id;
        rawMaterialInItem = await RawMaterialIn.build({
          ...rawMaterialInItem
        });
        await rawMaterialInItem.save({ transaction: t });
  
        rawMaterialInItemWeights = rawMaterialInItemWeights.map(rawMaterialInItemWeight => {
          // rawMaterialInItemWeight.id = null;
          delete rawMaterialInItemWeight.id;
          rawMaterialInItemWeight.raw_material_in_id = rawMaterialIn.id;
          rawMaterialInItemWeight.raw_material_in_item_id = rawMaterialInItem.id;
          return rawMaterialInItemWeight;
        });
  
        await RawMaterialInItemWeight.bulkCreate(rawMaterialInItemWeights, { transaction: t });
      }

      let rawMaterialInOtherCharges = await RawMaterialInOtherCharge.findAll({ 
        where: { raw_material_in_id: req.params.id}, 
        // attributes: ['raw_material_in_id', 'item_person', 'email_id', 'mobile'], 
        raw: true 
      });

      rawMaterialInOtherCharges = rawMaterialInOtherCharges.map(rawMaterialInOtherCharge => {
        // rawMaterialInOtherCharge.id = null;
        delete rawMaterialInOtherCharge.id;
        rawMaterialInOtherCharge.raw_material_in_id = rawMaterialIn.id;
        return rawMaterialInOtherCharge;
      });

      await RawMaterialInOtherCharge.bulkCreate(rawMaterialInOtherCharges, { transaction: t });
      
      // const error = await rawMaterialIn.validateData();
      // if (error) {
      //   return res.status(422).json({
      //     message: "Invalid inputs passed, please check your data.",
      //     error: error
      //   });
      // }
    } else {
      await RawMaterialIn.destroy({ where: { id: req.params.id }, transaction: t });
      await RawMaterialInItem.destroy({ where: { raw_material_in_id: req.params.id }, transaction: t });
      await RawMaterialInItemWeight.destroy({ where: { raw_material_in_id: req.params.id }, transaction: t });
      await RawMaterialInOtherCharge.destroy({ where: { raw_material_in_id: req.params.id }, transaction: t });
    }

    await t.commit();
    
    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Deleting Raw Material In failed!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Deleting Raw Material In failed!";
    next(error, req, res);
  }
};

export const setRawMaterialRate = async (req, res, next) => {
  let t;

  try {
    // const id = 6;
    // const module = 'Raw Material';

    // const id = 3483;
    const id = 3163;
    const module = 'Raw Material In';

    // const result = await set_raw_material_rate(module, id, req.userData.userId);
    // console.log(result);

    // if($status=='Approved') {
      let rm_ids = await set_raw_material_rate(module, id, req.userData.userId);
      console.log('rm_ids - ', rm_ids);
      // rm_ids = '167';
      let ing_ids = await set_products(module, id, req.userData.userId);
      console.log('ing_ids - ', ing_ids);
      // ing_ids = '30,34,35,36'
      const box_ids = await set_product_rate(module, ing_ids, req.userData.userId);
      console.log('box_ids - ', box_ids);
      send_updated_variations(rm_ids, ing_ids, box_ids)
        .then(r => console.log(r))
        .catch(err => console.log(err));
    // }

    // await t.commit();
    
    res.status(200).json({ message: "Setting Raw Material Rate successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Deleting Raw Material In failed!"
    // });

    // if (t) {
    //   await t.rollback();
    // }
    
    res.statusCode = 500;
    res.message = "Setting Raw Material Rate failed!";
    next(error, req, res);
  }
}

export const deleteAttachment = async (req, res, next) => {
  let t;

  try {
    let rawMaterialIn = await RawMaterialIn.findByPk(req.params.id);
    if (!rawMaterialIn) {
      return res.status(404).json({ message: "Raw Material In not found!" });
    }

    const documents = req.body.documents ? req.body.documents : '';

    if (!documents) {
      return res.status(404).json({ message: "Please select documents to delete!" });
    }

    let doc_document = rawMaterialIn.doc_document.split(' | ');
    let document_name = rawMaterialIn.document_name.split(' | ');

    for (const document of documents) {
      // const doc_documents = doc_document.split('|');
      // const document_names = document_name.split('|');

      const deleteDocument = doc_document.find(doc => doc.indexOf(document) !== -1);
      // fs.unlinkSync(deleteDocument);

      doc_document = doc_document.filter(doc => doc.indexOf(document) === -1);
      document_name = document_name.filter(doc => doc.indexOf(document) === -1);
    }

    t = await sequelize.transaction();

    rawMaterialIn.doc_document = doc_document.join(' | ');
    rawMaterialIn.document_name = document_name.join(' | ');

    await rawMaterialIn.save({ transaction: t })

    await t.commit();
    
    res.status(200).json({ message: "Deletion successful!", rawMaterialIn: rawMaterialIn });
  } catch (error) {
    // res.status(500).json({
    //   message: "Deleting Raw Material In failed!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Deleting Raw Material Attaachment In failed!";
    next(error, req, res);
  }
};
