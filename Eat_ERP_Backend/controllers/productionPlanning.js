import { Op } from 'sequelize';
import sequelize from '../lib/database.js';
import ProductionPlanning, {getProductionPlanningMasterData, getProductionPlanningRawMaterials} from '../models/productionPlanning.js';
import ProductionPlanningItem from '../models/productionPlanningItem.js';
import ProductionPlanningProduct from '../models/productionPlanningProduct.js';
import Depot from '../models/depot.js';
import Vendor from '../models/vendor.js';
import { getSeries } from '../models/series.js';
import RawMaterial from '../models/rawMaterial.js';
import { Sequelize } from 'sequelize';
import User from '../models/user.js';
import PurchaseOrderItem from '../models/purchaseOrderItem.js';
import PurchaseOrder from '../models/purchaseOrder.js';
import Product from '../models/product.js';

export const getMasterData = async (req, res, next) => {
  try {
    const masterData = await getProductionPlanningMasterData(null, req);

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

export const getProductRawMaterials = async (req, res, next) => {
  try {
    const data = await getProductionPlanningRawMaterials(req);

    return res.status(200).json({ ...data });
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

export const createProductionPlanning = async (req, res, next) => {
  let t;
  
  try {
    const productionPlanning = await ProductionPlanning.build({
      status: 'Open',
      created_by: req.userData.userId,
      created_on: new Date().toISOString(),
      modified_by: req.userData.userId,
      modified_on: new Date().toISOString(),
      po_drafted: 0
    });

    productionPlanning.getRequestData(req);
    
    let error = await productionPlanning.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }
    
    // const data = await getProductionPlanningRawMaterials(null);

    const products = productionPlanning.getProductionPlanningProducts(req.body);
    const productionPlanningProducts = [];
    for(const item of products) {
      const productionPlanningProduct = await ProductionPlanningProduct.build({
        ...item
      });
      // productionPlanningProduct.getRequestData(item);
      error = await productionPlanningProduct.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      // await productionPlanningProduct.setItemAmount();
      productionPlanningProducts.push(productionPlanningProduct);
    }

    const items = productionPlanning.getProductionPlanningItems(req.body);
    const productionPlanningItems = [];
    for(const item of items) {
      const productionPlanningItem = await ProductionPlanningItem.build({
        ...item
      });
      // productionPlanningItem.getRequestData(item);
      error = await productionPlanningItem.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      await productionPlanningItem.setItemAmount();
      productionPlanningItems.push(productionPlanningItem);
    }

    productionPlanning.setTransactionAmount(productionPlanningProducts, productionPlanningItems);

    const purchaseOrders = await productionPlanning.draftPo(productionPlanningItems);

    for(const productionPlanningItem of productionPlanningItems) {
      if (productionPlanningItem.draft_po && productionPlanningItem.po_status === '' && productionPlanningItem.vendor_id && productionPlanningItem.qty) {
        productionPlanningItem.po_status = 'Drafted';
        productionPlanning.po_drafted = 1;
      }
    }

    t = await sequelize.transaction();
    await productionPlanning.save({ transaction: t });

    for(const productionPlanningProduct of productionPlanningProducts) {
      productionPlanningProduct.production_planning_id = productionPlanning.id;
      await productionPlanningProduct.save({ transaction: t });
    }

    for(const productionPlanningItem of productionPlanningItems) {
      productionPlanningItem.production_planning_id = productionPlanning.id;
      await productionPlanningItem.save({ transaction: t });
    }

    for (const item of purchaseOrders) {
      const purchaseOrder = item.purchaseOrder;
      const purchaseOrderItems = item.purchaseOrderItems;

      purchaseOrder.setTransactionAmount(purchaseOrderItems, []);

      purchaseOrder.production_planning_id = productionPlanning.id;
      await purchaseOrder.save({ transaction: t });

      for(const purchaseOrderItem of purchaseOrderItems) {
        purchaseOrderItem.purchase_order_id = purchaseOrder.id;
        await purchaseOrderItem.save({ transaction: t });
      }
    }

    await t.commit();
    
    return res.status(201).json({
      message: "Production Planning added successfully",
      productionPlanning: productionPlanning
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Creating a productionPlanning failed!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Creating a Production Planning failed!";
    next(error, req, res);
  }
};

export const updateProductionPlanning = async (req, res, next) => {
  let t;

  try {
    let productionPlanning = await ProductionPlanning.findByPk(req.params.id);
    if (!productionPlanning) {
      return res.status(404).json({message: "Production Planning not found!"});
    }

    let blUpdate = false;
    if (productionPlanning.status && productionPlanning.status.trim().toUpperCase() === 'APPROVED') {
      let productionPlanningOld = await ProductionPlanning.findByPk(req.params.id, { attributes: {exclude: ['id'] }, raw: true });

      // productionPlanning = await ProductionPlanning.build({
      //   status: 'Pending',
      //   po_status: 'Open',
      //   created_by: req.userData.userId,
      //   created_on: new Date().toISOString(),
      //   modified_by: req.userData.userId,
      //   modified_on: new Date().toISOString()
      // });
  
      productionPlanning = await ProductionPlanning.build({
        ...productionPlanningOld,
        status: 'Open',
        modified_by: req.userData.userId,
        modified_on: new Date().toISOString()
      });
  
      productionPlanning.getRequestData(req);

      productionPlanning.ref_id = req.params.id;
    } else {
      productionPlanning.getRequestData(req);
      productionPlanning.status = 'Open';
      productionPlanning.modified_by = req.userData.userId;
      productionPlanning.modified_on = new Date().toISOString();
      blUpdate = true;
    }

    let error = await productionPlanning.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }
    
    // const data = await getProductionPlanningRawMaterials(null);

    const products = productionPlanning.getProductionPlanningProducts(req.body);
    const productionPlanningProducts = [];
    for(const item of products) {
      const productionPlanningProduct = await ProductionPlanningProduct.build({
        ...item
      });
      // productionPlanningProduct.getRequestData(item);
      error = await productionPlanningProduct.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      // await productionPlanningProduct.setItemAmount();
      productionPlanningProducts.push(productionPlanningProduct);
    }

    const items = productionPlanning.getProductionPlanningItems(req.body);
    const productionPlanningItems = [];
    for(const item of items) {
      const productionPlanningItem = await ProductionPlanningItem.build({
        ...item
      });
      // productionPlanningItem.getRequestData(item);
      error = await productionPlanningItem.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      await productionPlanningItem.setItemAmount();
      productionPlanningItems.push(productionPlanningItem);
    }

    productionPlanning.setTransactionAmount(productionPlanningProducts, productionPlanningItems);

    const purchaseOrders = await productionPlanning.draftPo(productionPlanningItems);

    for(const productionPlanningItem of productionPlanningItems) {
      if (productionPlanningItem.draft_po && productionPlanningItem.po_status === '' && productionPlanningItem.vendor_id && productionPlanningItem.qty) {
        productionPlanningItem.po_status = 'Drafted';
        productionPlanning.po_drafted = 1;
      }
    }

    t = await sequelize.transaction();
    await productionPlanning.save({ transaction: t });

    if (blUpdate === true) {
      await ProductionPlanningProduct.destroy({ where: { production_planning_id: productionPlanning.id }, transaction: t });
      await ProductionPlanningItem.destroy({ where: { production_planning_id: productionPlanning.id }, transaction: t });
      
      // const pos = await PurchaseOrder.findAll({ 
      //   where: {production_planning_id: productionPlanning.id, status: 'Drafted'}, 
      //   attributes: ['id'],
      //   raw: true
      // });
      // let purchaseOrderIds = pos.map(po => po.id);
      // await PurchaseOrderItem.destroy({ where: { purchase_order_id: {[Op.in]: [...purchaseOrderIds]} }, transaction: t });

      // purchaseOrderIds = purchaseOrders.map(po => po.id);
      // await PurchaseOrder.destroy({ where: { production_planning_id: productionPlanning.id, status: 'Drafted', id: {[Op.notIn]: [...purchaseOrderIds]} }, transaction: t });
    }
    
    for(const productionPlanningProduct of productionPlanningProducts) {
      productionPlanningProduct.production_planning_id = productionPlanning.id;
      await productionPlanningProduct.save({ transaction: t });
    }

    for(const productionPlanningItem of productionPlanningItems) {
      productionPlanningItem.production_planning_id = productionPlanning.id;
      await productionPlanningItem.save({ transaction: t });
    }

    for (const item of purchaseOrders) {
      const purchaseOrder = item.purchaseOrder;
      const purchaseOrderItems = item.purchaseOrderItems;

      purchaseOrder.setTransactionAmount(purchaseOrderItems, []);

      purchaseOrder.production_planning_id = productionPlanning.id;
      await purchaseOrder.save({ transaction: t });

      for(const purchaseOrderItem of purchaseOrderItems) {
        purchaseOrderItem.purchase_order_id = purchaseOrder.id;
        await purchaseOrderItem.save({ transaction: t });
      }
    }

    await t.commit();
    
    res.status(200).json({ message: "Update successful!", productionPlanning: productionPlanning });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't udpate productionPlanning!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't update Production Planning!";
    next(error, req, res);
  }
};

export const approveProductionPlanning = async (req, res, next) => {
  let t;

  try {
    let productionPlanning = await ProductionPlanning.findByPk(req.params.id);
    if (!productionPlanning) {
      return res.status(404).json({
        message: "Production Planning not found!"
      });
    }

    // if (productionPlanning.modified_by === req.userData.userId) {
    //   return res.status(422).json({ 
    //     message: `You can't approve this ProductionPlanning.`, 
    //     error : { 
    //       errors : { 
    //         vendorDate: { message: `You can't approve this ProductionPlanning.` } 
    //       } 
    //     }
    //   });
    // }

    // console.log(productionPlanning);

    if (productionPlanning.status.trim().toUpperCase() !== 'PENDING' && productionPlanning.status.trim().toUpperCase() !== 'DELETED') {
      return res.status(422).json({ 
        message: `Production Planning status should be pending or deleted.`, 
        error : { 
          errors : { 
            vendorDate: { message: `Production Planning status should be pending or deleted.` } 
          } 
        }
      });
    }

    productionPlanning.approve(req);

    // console.log(error);
    // productionPlanning.approvedBy = req.userData.userId;
    // productionPlanning.approvedAt = new Date().toISOString();

    const error = await productionPlanning.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    // try {
      t = await sequelize.transaction();
      
      // if (!productionPlanning.po_no) {
      //   const series = await getSeries(req, 'Purchase_Order');
      //   productionPlanning.getProductionPlanningNo(series.series);
      //   await series.save({ transaction: t });
      // }
      
      if (!productionPlanning.ref_id) {
        await productionPlanning.save({ transaction: t });
      } else {
        // const obj = JSON.parse(JSON.stringify(productionPlanning));
        // delete obj._id;
        // obj.ref_id = null;

        const ref_id = productionPlanning.ref_id;

        const obj = productionPlanning.dataValues;
        delete obj.id;
        obj.ref_id = null;

        // console.log(obj);
        // console.log(ref_id);
        // console.log(req.params.id);

        await ProductionPlanning.destroy({ where: {id: req.params.id }}, { transaction: t });

        // productionPlanning = await ProductionPlanning.findByIdAndUpdate(ref_id, obj, { session: session, new: true });

        await ProductionPlanning.update(obj, { where: { id: ref_id } }, { transaction: t });

        await ProductionPlanningProduct.destroy({ where: {production_planning_id: ref_id }}, { transaction: t });

        await ProductionPlanningProduct.update({ production_planning_id: ref_id }, { where: { production_planning_id: req.params.id }}, { transaction: t });

        await ProductionPlanningItem.destroy({ where: {production_planning_id: ref_id }}, { transaction: t });

        await ProductionPlanningItem.update({ production_planning_id: ref_id }, { where: { production_planning_id: req.params.id }}, { transaction: t });

        // originalProductionPlanning = await ProductionPlanning.findById(productionPlanning.ref_id);
        // originalProductionPlanning.overwrite(productionPlanning);
        // originalProductionPlanning.ref_id = null;
        // originalProductionPlanning.vendorState = productionPlanning.vendorState;
        // // console.log(originalProductionPlanning);
        // await originalProductionPlanning.save({ session });
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
    //   message: 'Approving Production Planning failed! Error - ' + (error.message ? error.message : '')
    // });
    
    res.statusCode = 500;
    res.message = "Approving Production Planning failed!";
    next(error, req, res);
  }
};

export const rejectProductionPlanning = async (req, res, next) => {
  try {
    let productionPlanning = await ProductionPlanning.findByPk(req.params.id);

    if (!productionPlanning) {
      return res.status(404).json({
        message: "Production Planning not found!"
      });
    }

    if (productionPlanning.modified_by.toString() === req.userData.userId.toString()) {
      return res.status(422).json({ 
        message: `You can't reject this Production Planning.`, 
        error : { 
          errors : { 
            vendorDate: { message: `You can't reject this Production Planning.` } 
          } 
        }
      });
    }

    if (productionPlanning.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({ 
        message: `Production Planning is already approved.`, 
        error : { 
          errors : { 
            vendorDate: { message: `Production Planning is already approved.` } 
          } 
        }
      });
    }

    productionPlanning.reject(req);
    await productionPlanning.save();

    res.status(200).json({ message: "Reject successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Rejecting Production Planning failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Rejecting Production Planning failed!";
    next(error, req, res);
  }
};

export const getProductionPlannings = async (req, res, next) => {
  try {
    let status = 'Open';
    let pageSize = 10;
    let pageIndex = 0;
    let query = '';
    let sort = { key: 'modified_on', order: 'desc' };

    if (req.query) {
      status = req.query.status ? req.query.status : 'Open';
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
          // {'po_no': {[Op.like]: `%${query}%` }}, 
          // {'$depot.depot_name$': { [Op.like]: `%${query}%` }}, 
          // {'$vendor.vendor_name$': { [Op.like]: `%${query}%` }}, 
          // {'$productionPlanningItems.item_name$': { [Op.like]: `%${query}%` }}
          {'$depot_name$': { [Op.like]: `%${query}%` }}, 
          {'$product_names$': { [Op.like]: `%${query}%` }}, 
          {'$item_names$': { [Op.like]: `%${query}%` }}
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
    //   { model: ProductionPlanningItem, as: 'productionPlanningItems', attributes: ['item_name'], required: true, where: {item_name: { [Op.like]: `%${query}%` }} }
    // ];

    // let totalCount = 0;
    const statusCount = {
      // pending: 0,
      // approved: 0,
      // rejected: 0,
      // inActive: 0,
      open: 0,
      closed: 0
    };
    const data = await ProductionPlanning.findAll(
      { 
        ...condition, 
        attributes: [
          'status', 'depot_name', 'product_names', 'item_names', 
          [sequelize.fn('COUNT', sequelize.col('status')), 'count']
        ], 
        group:['status', 'depot_name', 'product_names', 'item_names'], 
        raw: true
      }
    );
    // console.log(data);
    for (const item of data) {
      // console.log(item.status);
      // console.log(item.count);
      if (item.status === "Open") {
        statusCount.open = statusCount.open + parseInt(item.count);
      }
      else if (item.status === "Closed") {
        statusCount.closed = statusCount.closed + parseInt(item.count);
      }

      // if (item.status === "Pending" || item.status === "Deleted") {
      //   statusCount.pending = statusCount.pending + parseInt(item.count);
      //   // totalCount = parseInt(item.count);
      // }
      // else if (item.status === "Approved") {
      //   statusCount.approved = statusCount.approved + parseInt(item.count);
      //   // totalCount = parseInt(item.count);
      //   if (item.po_status && item.po_status === 'Advance') {
      //     statusCount.advance = statusCount.advance + parseInt(item.count);
      //   } else if (item.po_status && item.po_status === 'Raw Material In') {
      //     statusCount.payment_pending = statusCount.payment_pending + parseInt(item.count);
      //   } else if (item.po_status && item.po_status === 'Closed') {
      //     // Do Nothing
      //   } else {
      //     statusCount.open = statusCount.open + parseInt(item.count);
      //   }
      // }
      // else if (item.status === "Rejected") {
      //   statusCount.rejected = statusCount.rejected + parseInt(item.count);
      //   // totalCount = parseInt(item.count);
      // }
      // else if (item.status === "InActive") {
      //   statusCount.inActive = statusCount.inActive + parseInt(item.count);
      //   // totalCount = parseInt(item.count);
      // }
    }
    
    let statusCondition = { status: 'Open' };
    if (status) {
      statusCondition = { status: status };

      // if (status.trim().toUpperCase() === 'PENDING') {
      //   statusCondition = { status: {[Op.or] : ['Pending', 'Deleted']} };
      // } else if (status.trim().toUpperCase() === 'OPEN') {
      //   statusCondition = { [Op.and]: [
      //     {status: 'Approved'}, 
      //     {po_status: {[Op.or] : [{[Op.is]: null}, '', {[Op.notIn]: ['Closed', 'Raw Material In', 'Advance']}]}}
      //   ]};
      // } else if (status.trim().toUpperCase() === 'PAYMENT_PENDING') {
      //   statusCondition = { [Op.and]: [
      //     {status: 'Approved'}, 
      //     {po_status: 'Raw Material In'}
      //   ]};
      // } else if (status.trim().toUpperCase() === 'ADVANCE') {
      //   statusCondition = { [Op.and]: [
      //     {status: 'Approved'}, 
      //     {po_status: 'Advance'}
      //   ]};
      // } else {
      //   statusCondition = { status: status };
      // }
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

    const { count, rows } = await ProductionPlanning.findAndCountAll(condition);
    // const rows = 

    res.status(200).json({
      message: "Production Plannings fetched successfully!",
      // totalCount: totalCount,
      total: count,
      statusCount: statusCount,
      rows: rows
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Production Plannings failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Production Plannings failed!";
    next(error, req, res);
  }
};

export const getProductionPlanning = async (req, res, next) => {
  try {
    const productionPlanning = await ProductionPlanning.findByPk(req.params.id, { 
      include: [
        { 
          model: ProductionPlanningProduct, 
          as: "productionPlanningProducts", 
          include: [{ model: Product, as: "product", attributes: ['id', 'product_name', 'short_name'] }]
        }, 
        { 
          model: ProductionPlanningItem, 
          as: "productionPlanningItems", 
          include: [{ model: RawMaterial, as: "raw_material", attributes: ['id', 'rm_name'] }]
        }, 
        // { model: Vendor, as: "vendor", attributes: ['id', 'vendor_name', 'vendor_code', 'address', 'city', 'pincode', 'state', 'country', 'gst_number', 'payment_due_days'] },
        { model: Depot, as: "depot", attributes: ['id', 'depot_name', 'address', 'city', 'pincode', 'state', 'country', 'gst_no'] },
        // { model: User, as: "created_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
        // { model: User, as: "modified_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
        // { model: User, as: "approved_by_user", attributes: ['id', 'first_name', 'last_name'] }
      ] 
    });
    if (!productionPlanning) {
      return res.status(404).json({ message: "Production Planning not found!" });
    }

    const roleDetails = req.userData.roleDetails;

    // console.log(roleDetails);

    const action = {
      update: false,
      delete: false,
      approve: false
    };

    // console.log(productionPlanning.modified_by.toString());
    // console.log(req.userData.userId);
    
    // if (productionPlanning.isFreezed) {
    //   if (productionPlanning.status.trim().toUpperCase() !== 'APPROVED' && productionPlanning.status.trim().toUpperCase() !== 'INACTIVE') {
    //     if (roleDetails.r_edit) {
    //       action.update = true;
    //     }
    //     if (roleDetails.r_delete) {
    //       action.delete = true;
    //     }
    //   }
    // } else {
      if (!roleDetails.r_approvals || 
            (productionPlanning.status.trim().toUpperCase() !== 'PENDING' && 
            productionPlanning.status.trim().toUpperCase() !== 'DELETED') || 
            productionPlanning.modified_by.toString() === req.userData.userId.toString()) 
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

    const masterData = await getProductionPlanningMasterData(productionPlanning, req);
  
    return res.status(200).json({ 
      message: "Production Planning fetched successfully!",
      action, 
      productionPlanning, 
      masterData 
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Production Planning failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Production Planning failed!";
    next(error, req, res);
  }
};

export const deleteProductionPlanning = async (req, res, next) => {
  let t;

  try {
    let productionPlanning = await ProductionPlanning.findByPk(req.params.id, {raw: true});
    if (!productionPlanning) {
      return res.status(404).json({ message: "Production Planning not found!" });
    }

    t = await sequelize.transaction();

    if (productionPlanning.status.trim().toUpperCase() === 'APPROVED') {
      productionPlanning.id = null;
      productionPlanning.status = 'Deleted';
      productionPlanning.ref_id = req.params.id;
      
      productionPlanning = await ProductionPlanning.build({
        ...productionPlanning
      });

      await productionPlanning.save({ transaction: t });

      let productionPlanningProducts = await ProductionPlanningProduct.findAll({ 
        where: { production_planning_id: req.params.id}, 
        // attributes: ['production_planning_id', 'item_person', 'email_id', 'mobile'], 
        raw: true 
      });

      productionPlanningProducts = productionPlanningProducts.map(productionPlanningProduct => {
        // productionPlanningProduct.id = null;
        delete productionPlanningProduct.id;
        productionPlanningProduct.production_planning_id = productionPlanning.id;
        return productionPlanningProduct;
      });

      await ProductionPlanningProduct.bulkCreate(productionPlanningProducts, { transaction: t });
      
      let productionPlanningItems = await ProductionPlanningItem.findAll({ 
        where: { production_planning_id: req.params.id}, 
        // attributes: ['production_planning_id', 'item_person', 'email_id', 'mobile'], 
        raw: true 
      });

      productionPlanningItems = productionPlanningItems.map(productionPlanningItem => {
        // productionPlanningItem.id = null;
        delete productionPlanningItem.id;
        productionPlanningItem.production_planning_id = productionPlanning.id;
        return productionPlanningItem;
      });

      await ProductionPlanningItem.bulkCreate(productionPlanningItems, { transaction: t });
      
      // const error = await productionPlanning.validateData();
      // if (error) {
      //   return res.status(422).json({
      //     message: "Invalid inputs passed, please check your data.",
      //     error: error
      //   });
      // }
    } else {
      const pos = await PurchaseOrder.findAll({ 
        where: {production_planning_id: req.params.id, status: 'Drafted'}, 
        attributes: ['id'],
        raw: true
      });
      const purchaseOrderIds = pos.map(item => item.id);

      await PurchaseOrderItem.destroy({ where: { purchase_order_id: {[Op.in]: [...purchaseOrderIds]} }, transaction: t });
      await PurchaseOrder.destroy({ where: { production_planning_id: req.params.id, status: 'Drafted' }, transaction: t });

      await ProductionPlanningProduct.destroy({ where: { production_planning_id: req.params.id }, transaction: t });
      await ProductionPlanningItem.destroy({ where: { production_planning_id: req.params.id }, transaction: t });
      await ProductionPlanning.destroy({ where: { id: req.params.id }, transaction: t });
    }

    await t.commit();
    
    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Deleting Production Planning failed!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Deleting Production Planning failed!";
    next(error, req, res);
  }
};