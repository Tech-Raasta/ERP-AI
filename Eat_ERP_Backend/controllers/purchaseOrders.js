import { Op } from 'sequelize';
import sequelize from '../lib/database.js';
import PurchaseOrder, {getOldPurchaseOrderRate, getPurchaseOrderMasterData, mailPurchaseOrder} from '../models/purchaseOrder.js';
import PurchaseOrderItem from '../models/purchaseOrderItem.js';
import PurchaseOrderOtherCharge from '../models/purchaseOrderOtherCharge.js';
import Depot from '../models/depot.js';
import Vendor from '../models/vendor.js';
import { getSeries } from '../models/series.js';
import RawMaterial from '../models/rawMaterial.js';
import User from '../models/user.js';
import { getDepotInStockQty, getDepotOutStockQty } from '../models/depotTransfer.js';
import { getBatchRawMaterialQty } from '../models/batchProcessing.js';
import { getGRNStockQty } from '../models/rawMaterialIn.js';
import { getRawMaterialInStockQty, getRawMaterialOutStockQty } from '../models/rawMaterialInOut.js';
import { availableStock } from '../lib/availableStock.js';

export const getMasterData = async (req, res, next) => {
  try {
    const masterData = await getPurchaseOrderMasterData(null, req);

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

export const emailPurchaseOrder = async (req, res, next) => {
  try {
    // const purchaseOrderFile = getPurchaseOrder(id);

    let result = await mailPurchaseOrder(req.params.id);
    // console.log(result);

    if (result.indexOf('Email sent') !== -1) {
      res.status(200).json({ message: "Mail sent successfully" });
    } else {
      res.status(500).json({ message: "Mail sending failed" });
    }
                
    // res.status(200).json({ purchaseOrderFile });

  } catch (error) {
    // res.status(500).json({
    //   message: "Generatiing PDF failed!",
    //   error: JSON.stringify(error, Object.getOwnPropertyNames(error))
    // });
    
    res.statusCode = 500;
    res.message = "Generatiing PDF failed!";
    next(error, req, res);
  }
}

export const createPurchaseOrder = async (req, res, next) => {
  let t;
  
  try {
    const purchaseOrder = await PurchaseOrder.build({
      status: 'Pending',
      po_status: 'Open',
      created_by: req.userData.userId,
      created_on: new Date().toISOString(),
      modified_by: req.userData.userId,
      modified_on: new Date().toISOString()
    });

    purchaseOrder.getRequestData(req);
    
    let error = await purchaseOrder.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }
    
    const tax_type = await purchaseOrder.setTaxType();
    
    const items = purchaseOrder.getPurchaseOrderItems(req.body);
    const purchaseOrderItems = [];
    for(const item of items) {
      const purchaseOrderItem = await PurchaseOrderItem.build({
        tax_type: tax_type
      });
      purchaseOrderItem.getRequestData(item);
      error = await purchaseOrderItem.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      await purchaseOrderItem.setItemAmount();
      purchaseOrderItems.push(purchaseOrderItem);
    }

    const otherCharges = purchaseOrder.getPurchaseOrderOtherCharges(req.body);
    const purchaseOrderOtherCharges = [];
    for(const otherCharge of otherCharges) {
      const purchaseOrderOtherCharge = await PurchaseOrderOtherCharge.build({
        tax_type: tax_type
      });
      purchaseOrderOtherCharge.getRequestData(otherCharge);
      error = await purchaseOrderOtherCharge.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      purchaseOrderOtherCharge.setItemAmount();
      purchaseOrderOtherCharges.push(purchaseOrderOtherCharge);
    }

    purchaseOrder.setTransactionAmount(purchaseOrderItems, purchaseOrderOtherCharges);

    t = await sequelize.transaction();
    await purchaseOrder.save({ transaction: t });

    for(const purchaseOrderItem of purchaseOrderItems) {
      purchaseOrderItem.purchase_order_id = purchaseOrder.id;
      await purchaseOrderItem.save({ transaction: t });
    }

    for(const purchaseOrderOtherCharge of purchaseOrderOtherCharges) {
      purchaseOrderOtherCharge.purchase_order_id = purchaseOrder.id;
      await purchaseOrderOtherCharge.save({ transaction: t });
    }

    await t.commit();
    
    return res.status(201).json({
      message: "Purchase Order added successfully",
      purchaseOrder: purchaseOrder
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Creating a purchaseOrder failed!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Creating a Purchase Order failed!";
    next(error, req, res);
  }
};

export const updatePurchaseOrder = async (req, res, next) => {
  let t;

  try {
    let purchaseOrder = await PurchaseOrder.findByPk(req.params.id);
    if (!purchaseOrder) {
      return res.status(404).json({message: "Purchase Order not found!"});
    }

    let blUpdate = false;
    if (purchaseOrder.status && purchaseOrder.status.trim().toUpperCase() === 'APPROVED') {
      let purchaseOrderOld = await PurchaseOrder.findByPk(req.params.id, { attributes: {exclude: ['id'] }, raw: true });

      // purchaseOrder = await PurchaseOrder.build({
      //   status: 'Pending',
      //   po_status: 'Open',
      //   created_by: req.userData.userId,
      //   created_on: new Date().toISOString(),
      //   modified_by: req.userData.userId,
      //   modified_on: new Date().toISOString()
      // });
  
      purchaseOrder = await PurchaseOrder.build({
        ...purchaseOrderOld,
        status: 'Pending',
        modified_by: req.userData.userId,
        modified_on: new Date().toISOString()
      });
  
      purchaseOrder.getRequestData(req);

      purchaseOrder.ref_id = req.params.id;
    } else {
      purchaseOrder.getRequestData(req);
      purchaseOrder.status = 'Pending';
      purchaseOrder.modified_by = req.userData.userId;
      purchaseOrder.modified_on = new Date().toISOString();
      blUpdate = true;
    }

    let error = await purchaseOrder.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }
    
    const tax_type = await purchaseOrder.setTaxType();
    
    const items = purchaseOrder.getPurchaseOrderItems(req.body);
    const purchaseOrderItems = [];
    for(const item of items) {
      const purchaseOrderItem = await PurchaseOrderItem.build({
        tax_type: tax_type
      });
      purchaseOrderItem.getRequestData(item);
      error = await purchaseOrderItem.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      await purchaseOrderItem.setItemAmount();
      purchaseOrderItems.push(purchaseOrderItem);
    }

    const otherCharges = purchaseOrder.getPurchaseOrderOtherCharges(req.body);
    const purchaseOrderOtherCharges = [];
    for(const otherCharge of otherCharges) {
      const purchaseOrderOtherCharge = await PurchaseOrderOtherCharge.build({
        tax_type: tax_type
      });
      purchaseOrderOtherCharge.getRequestData(otherCharge);
      error = await purchaseOrderOtherCharge.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      purchaseOrderOtherCharge.setItemAmount();
      purchaseOrderOtherCharges.push(purchaseOrderOtherCharge);
    }

    purchaseOrder.setTransactionAmount(purchaseOrderItems, purchaseOrderOtherCharges);

    error = await purchaseOrder.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    // console.log(purchaseOrder);

    t = await sequelize.transaction();
    await purchaseOrder.save({ transaction: t });

    if (blUpdate === true) {
      await PurchaseOrderItem.destroy({ where: { purchase_order_id: purchaseOrder.id }, transaction: t });
      await PurchaseOrderOtherCharge.destroy({ where: { purchase_order_id: purchaseOrder.id }, transaction: t });
    }
    
    for(const purchaseOrderItem of purchaseOrderItems) {
      purchaseOrderItem.purchase_order_id = purchaseOrder.id;
      await purchaseOrderItem.save({ transaction: t });
    }

    for(const purchaseOrderOtherCharge of purchaseOrderOtherCharges) {
      purchaseOrderOtherCharge.purchase_order_id = purchaseOrder.id;
      await purchaseOrderOtherCharge.save({ transaction: t });
    }

    await t.commit();

    res.status(200).json({ message: "Update successful!", purchaseOrder: purchaseOrder });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't udpate purchaseOrder!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't update Purchase Order!";
    next(error, req, res);
  }
};

export const approvePurchaseOrder = async (req, res, next) => {
  let t;

  try {
    let purchaseOrder = await PurchaseOrder.findByPk(req.params.id);
    if (!purchaseOrder) {
      return res.status(404).json({
        message: "Purchase Order not found!"
      });
    }

    // if (purchaseOrder.modified_by === req.userData.userId) {
    //   return res.status(422).json({ 
    //     message: `You can't approve this PurchaseOrder.`, 
    //     error : { 
    //       errors : { 
    //         vendorDate: { message: `You can't approve this PurchaseOrder.` } 
    //       } 
    //     }
    //   });
    // }

    // console.log(purchaseOrder);

    if (purchaseOrder.status.trim().toUpperCase() !== 'PENDING' && purchaseOrder.status.trim().toUpperCase() !== 'DELETED') {
      return res.status(422).json({ 
        message: `Purchase Order status should be pending or deleted.`, 
        error : { 
          errors : { 
            vendorDate: { message: `Purchase Order status should be pending or deleted.` } 
          } 
        }
      });
    }

    purchaseOrder.approve(req);

    // console.log(error);
    // purchaseOrder.approvedBy = req.userData.userId;
    // purchaseOrder.approvedAt = new Date().toISOString();

    const error = await purchaseOrder.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    // try {
      t = await sequelize.transaction();
      
      if (!purchaseOrder.po_no) {
        const series = await getSeries(req, 'Purchase_Order');
        purchaseOrder.getPurchaseOrderNo(series.series);
        await series.save({ transaction: t });
      }
      
      if (!purchaseOrder.ref_id) {
        await purchaseOrder.save({ transaction: t });
      } else {
        // const obj = JSON.parse(JSON.stringify(purchaseOrder));
        // delete obj._id;
        // obj.ref_id = null;

        const ref_id = purchaseOrder.ref_id;

        const obj = purchaseOrder.dataValues;
        delete obj.id;
        obj.ref_id = null;

        // console.log(obj);
        // console.log(ref_id);
        // console.log(req.params.id);

        await PurchaseOrder.destroy({ where: {id: req.params.id }}, { transaction: t });

        // purchaseOrder = await PurchaseOrder.findByIdAndUpdate(ref_id, obj, { session: session, new: true });

        await PurchaseOrder.update(obj, { where: { id: ref_id } }, { transaction: t });

        await PurchaseOrderItem.destroy({ where: {purchase_order_id: ref_id }}, { transaction: t });

        await PurchaseOrderItem.update({ purchase_order_id: ref_id }, { where: { purchase_order_id: req.params.id }}, { transaction: t });

        await PurchaseOrderOtherCharge.destroy({ where: {purchase_order_id: ref_id }}, { transaction: t });

        await PurchaseOrderOtherCharge.update({ purchase_order_id: ref_id }, { where: { purchase_order_id: req.params.id }}, { transaction: t });

        // originalPurchaseOrder = await PurchaseOrder.findById(purchaseOrder.ref_id);
        // originalPurchaseOrder.overwrite(purchaseOrder);
        // originalPurchaseOrder.ref_id = null;
        // originalPurchaseOrder.vendorState = purchaseOrder.vendorState;
        // // console.log(originalPurchaseOrder);
        // await originalPurchaseOrder.save({ session });
      }

      await t.commit();
         
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
    //   message: 'Approving Purchase Order failed! Error - ' + (error.message ? error.message : '')
    // });
    
    res.statusCode = 500;
    res.message = "Approving Purchase Order failed!";
    next(error, req, res);
  }
};

export const rejectPurchaseOrder = async (req, res, next) => {
  try {
    let purchaseOrder = await PurchaseOrder.findByPk(req.params.id);

    if (!purchaseOrder) {
      return res.status(404).json({
        message: "Purchase Order not found!"
      });
    }

    if (purchaseOrder.modified_by.toString() === req.userData.userId.toString()) {
      return res.status(422).json({ 
        message: `You can't reject this Purchase Order.`, 
        error : { 
          errors : { 
            vendorDate: { message: `You can't reject this Purchase Order.` } 
          } 
        }
      });
    }

    if (purchaseOrder.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({ 
        message: `Purchase Order is already approved.`, 
        error : { 
          errors : { 
            vendorDate: { message: `Purchase Order is already approved.` } 
          } 
        }
      });
    }

    purchaseOrder.reject(req);
    await purchaseOrder.save();

    res.status(200).json({ message: "Reject successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Rejecting Purchase Order failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Rejecting Purchase Order failed!";
    next(error, req, res);
  }
};

export const getPurchaseOrders = async (req, res, next) => {
  try {
    let status = 'Pending';
    let pageSize = 10;
    let pageIndex = 0;
    let query = '';
    let sort = { key: 'modified_on', order: 'desc' };

    if (req.query) {
      status = req.query.status ? req.query.status : 'Pending';
      if (req.query.pageSize && req.query.pageSize.toString().trim().toUpperCase() === 'ALL') {
        pageSize = 'ALL';
      } else {
        pageSize = req.query.pageSize ? +req.query.pageSize : 10;
      }
      pageIndex = req.query.pageIndex ? +req.query.pageIndex : 0;
      query = req.query.query ? req.query.query : '';
      sort = { key: req.query.key ? req.query.key : 'modified_on', order: req.query.order ? req.query.order : 'desc' };
    }
    
    let condition = {};
    let searchCondition = {};

    if (query) {
      searchCondition = {
        [Op.or]: [
          {'po_no': {[Op.like]: `%${query}%` }}, 
          // {'$depot.depot_name$': { [Op.like]: `%${query}%` }}, 
          // {'$vendor.vendor_name$': { [Op.like]: `%${query}%` }}, 
          // {'$purchaseOrderItems.item_name$': { [Op.like]: `%${query}%` }}
          {'$depot_name$': { [Op.like]: `%${query}%` }}, 
          {'$vendor_name$': { [Op.like]: `%${query}%` }}, 
          {'$po_item_names$': { [Op.like]: `%${query}%` }}
        ],
        depot_id: {[Op.in]: req.userData.depotIds}
      };

      condition['where'] = searchCondition;
    } else {
      condition['where'] = { depot_id: {[Op.in]: req.userData.depotIds} };
    }

    // condition['include'] = [
    //   { model: Depot, as: 'depot', attributes: ['depot_name'], required: true }, 
    //   { model: Vendor, as: 'vendor', attributes: ['vendor_name'], required: true }, 
    //   { model: PurchaseOrderItem, as: 'purchaseOrderItems', attributes: ['item_name'], required: true, where: {item_name: { [Op.like]: `%${query}%` }} }
    // ];

    // let totalCount = 0;
    const statusCount = {
      drafted: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      inActive: 0,
      open: 0,
      payment_pending: 0,
      advance: 0
    };
    const data = await PurchaseOrder.findAll(
      { 
        ...condition, 
        attributes: [
          'status', 'po_status', 'po_no', 'depot_name', 'vendor_name', 'po_item_names', 
          [sequelize.fn('COUNT', sequelize.col('status')), 'count']
        ], 
        group:['status', 'po_status', 'po_no', 'depot_name', 'vendor_name', 'po_item_names'], 
        raw: true
      }
    );
    // console.log(data);
    for (const item of data) {
      // console.log(item.status);
      // console.log(item.count);
      if (item.status === "Drafted") {
        statusCount.drafted = statusCount.drafted + parseInt(item.count);
        // totalCount = parseInt(item.count);
      }
      else if (item.status === "Pending" || item.status === "Deleted") {
        statusCount.pending = statusCount.pending + parseInt(item.count);
        // totalCount = parseInt(item.count);
      }
      else if (item.status === "Approved") {
        statusCount.approved = statusCount.approved + parseInt(item.count);
        // totalCount = parseInt(item.count);
        if (item.po_status && item.po_status === 'Advance') {
          statusCount.advance = statusCount.advance + parseInt(item.count);
        } else if (item.po_status && item.po_status === 'Raw Material In') {
          statusCount.payment_pending = statusCount.payment_pending + parseInt(item.count);
        } else if (item.po_status && item.po_status === 'Closed') {
          // Do Nothing
        } else {
          statusCount.open = statusCount.open + parseInt(item.count);
        }
      }
      else if (item.status === "Rejected") {
        statusCount.rejected = statusCount.rejected + parseInt(item.count);
        // totalCount = parseInt(item.count);
      }
      else if (item.status === "InActive") {
        statusCount.inActive = statusCount.inActive + parseInt(item.count);
        // totalCount = parseInt(item.count);
      }
    }
    
    let statusCondition = { status: 'Pending' };
    if (status) {
      if (status.trim().toUpperCase() === 'PENDING') {
        statusCondition = { status: {[Op.or] : ['Pending', 'Deleted']} };
      } else if (status.trim().toUpperCase() === 'OPEN') {
        statusCondition = { [Op.and]: [
          {status: 'Approved'}, 
          {po_status: {[Op.or] : [{[Op.is]: null}, '', {[Op.notIn]: ['Closed', 'Raw Material In', 'Advance']}]}}
        ]};
      } else if (status.trim().toUpperCase() === 'PAYMENT_PENDING') {
        statusCondition = { [Op.and]: [
          {status: 'Approved'}, 
          {po_status: 'Raw Material In'}
        ]};
      } else if (status.trim().toUpperCase() === 'ADVANCE') {
        statusCondition = { [Op.and]: [
          {status: 'Approved'}, 
          {po_status: 'Advance'}
        ]};
      } else {
        statusCondition = { status: status };
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
      condition['where'] = statusCondition;
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

    condition['include'] = { model: User, as: "created_by_user", attributes: ['id', 'first_name', 'last_name'] };

    const { count, rows } = await PurchaseOrder.findAndCountAll(condition);
    // const rows = 
    
    res.status(200).json({
      message: "Purchase Orders fetched successfully!",
      // totalCount: totalCount,
      total: count,
      statusCount: statusCount,
      rows: rows
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Purchase Orders failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Purchase Orders failed!";
    next(error, req, res);
  }
};

export const getPurchaseOrder = async (req, res, next) => {
  try {
    const purchaseOrder = await PurchaseOrder.findByPk(req.params.id, { 
      include: [
        { 
          model: PurchaseOrderItem, 
          as: "purchaseOrderItems", 
          include: [{ model: RawMaterial, as: "raw_material", attributes: ['id', 'rm_name'] }]
        }, 
        "purchaseOrderOtherCharges", 
        { model: Vendor, as: "vendor", attributes: ['id', 'vendor_name', 'vendor_code', 'address', 'city', 'pincode', 'state', 'country', 'gst_number', 'payment_due_days'] },
        { model: Depot, as: "depot", attributes: ['id', 'depot_name', 'address', 'city', 'pincode', 'state', 'country', 'gst_no'] },
        { model: User, as: "created_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
        { model: User, as: "modified_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
        { model: User, as: "approved_by_user", attributes: ['id', 'first_name', 'last_name'] }
      ] 
    });
    if (!purchaseOrder) {
      return res.status(404).json({ message: "Purchase Order not found!" });
    }

    const roleDetails = req.userData.roleDetails;

    // console.log(roleDetails);

    const action = {
      update: false,
      delete: false,
      approve: false
    };

    // console.log(purchaseOrder.modified_by.toString());
    // console.log(req.userData.userId);
    
    // if (purchaseOrder.isFreezed) {
    //   if (purchaseOrder.status.trim().toUpperCase() !== 'APPROVED' && purchaseOrder.status.trim().toUpperCase() !== 'INACTIVE') {
    //     if (roleDetails.r_edit) {
    //       action.update = true;
    //     }
    //     if (roleDetails.r_delete) {
    //       action.delete = true;
    //     }
    //   }
    // } else {
      if (!roleDetails.r_approvals || 
            (purchaseOrder.status.trim().toUpperCase() !== 'PENDING' && 
            purchaseOrder.status.trim().toUpperCase() !== 'DELETED') || 
            purchaseOrder.modified_by.toString() === req.userData.userId.toString()) 
      {
        if (roleDetails.r_edit) {
          action.update = true;
        }
        if (roleDetails.r_delete) {
          action.delete = true;
        }
      } else if (roleDetails.r_approvals) {
        action.approve = true;
      }
    // }
    
  
    // const pincodes = await Pincode.findAll({ attributes: ['id', 'pincode', 'state_id'] });
    // const cities = await City.findAll({ attributes: ['id', 'city_name', 'state_id'] });
    // const states = await State.findAll({ attributes: ['id', 'state_name', 'country_id'] });
    // const countries = await Country.findAll({ attributes: ['id', 'country_name'] });

    const masterData = await getPurchaseOrderMasterData(purchaseOrder, req);
  
    return res.status(200).json({ 
      message: "Purchase Order fetched successfully!",
      action, 
      purchaseOrder, 
      masterData 
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Purchase Order failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Purchase Order failed!";
    next(error, req, res);
  }
};

export const deletePurchaseOrder = async (req, res, next) => {
  let t;

  try {
    let purchaseOrder = await PurchaseOrder.findByPk(req.params.id, {raw: true});
    if (!purchaseOrder) {
      return res.status(404).json({ message: "Purchase Order not found!" });
    }

    t = await sequelize.transaction();

    if (purchaseOrder.status.trim().toUpperCase() === 'APPROVED') {
      purchaseOrder.id = null;
      purchaseOrder.status = 'Deleted';
      purchaseOrder.ref_id = req.params.id;
      
      purchaseOrder = await PurchaseOrder.build({
        ...purchaseOrder
      });

      await purchaseOrder.save({ transaction: t });

      let purchaseOrderItems = await PurchaseOrderItem.findAll({ 
        where: { purchase_order_id: req.params.id}, 
        // attributes: ['purchase_order_id', 'item_person', 'email_id', 'mobile'], 
        raw: true 
      });

      purchaseOrderItems = purchaseOrderItems.map(purchaseOrderItem => {
        // purchaseOrderItem.id = null;
        delete purchaseOrderItem.id;
        purchaseOrderItem.purchase_order_id = purchaseOrder.id;
        return purchaseOrderItem;
      });

      await PurchaseOrderItem.bulkCreate(purchaseOrderItems, { transaction: t });
      
      let purchaseOrderOtherCharges = await PurchaseOrderOtherCharge.findAll({ 
        where: { purchase_order_id: req.params.id}, 
        // attributes: ['purchase_order_id', 'item_person', 'email_id', 'mobile'], 
        raw: true 
      });

      purchaseOrderOtherCharges = purchaseOrderOtherCharges.map(purchaseOrderOtherCharge => {
        // purchaseOrderOtherCharge.id = null;
        delete purchaseOrderOtherCharge.id;
        purchaseOrderOtherCharge.purchase_order_id = purchaseOrder.id;
        return purchaseOrderOtherCharge;
      });

      await PurchaseOrderOtherCharge.bulkCreate(purchaseOrderOtherCharges, { transaction: t });
      
      // const error = await purchaseOrder.validateData();
      // if (error) {
      //   return res.status(422).json({
      //     message: "Invalid inputs passed, please check your data.",
      //     error: error
      //   });
      // }
    } else {
      await PurchaseOrder.destroy({ where: { id: req.params.id }, transaction: t });
      await PurchaseOrderItem.destroy({ where: { purchase_order_id: req.params.id }, transaction: t });
      await PurchaseOrderOtherCharge.destroy({ where: { purchase_order_id: req.params.id }, transaction: t });
    }

    await t.commit();
    
    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Deleting Purchase Order failed!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Deleting Purchase Order failed!";
    next(error, req, res);
  }
};

export const getOldPoRate = async (req, res, next) => {
  try {
    const { raw_material_id, depot_id } = req.params;
    const {rawMaterial, oldPoRate} = await getOldPurchaseOrderRate(raw_material_id);

    const { batchStock, depotInStock, depotOutStock, grnStock, rawMaterialInStock, rawMaterialOutStock, totalStock } = await availableStock(raw_material_id, depot_id);


    return res.status(200).json({ rawMaterial, oldPoRate, batchStock, depotInStock, depotOutStock, grnStock, rawMaterialInStock, rawMaterialOutStock, totalStock });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Raw Material failed!";
    next(error, req, res);
  }
};

export const mailPurchaseOrderDetails = async (req, res, next) => {
  try {
    const tables = await PurchaseOrder.mailPurchaseOrderDetails();

    res.status(200).json({ message: "Purchase Order details sent successful!", tables });
  } catch (error) {
    // res.status(500).json({
    //   message: "Sending Purchase Order details failed!"
    // });

    res.statusCode = 500;
    res.message = "Sending Purchase Order details failed!";
    next(error, req, res);
  }
};