import { Op } from 'sequelize';
import sequelize from '../lib/database.js';
import Requisition, {getRequisitionItemDetails, getRequisitionItemStock, getRequisitionMasterData} from '../models/requisition.js';
import RequisitionItem from '../models/requisitionItem.js';
import RequisitionProduct from '../models/requisitionProduct.js';
import Depot from '../models/depot.js';
import { getSeries } from '../models/series.js';
import Product from '../models/product.js';
import ProductionRawMaterialRequest from '../models/productionRawMaterialRequest.js';
import Production from '../models/production.js';
import Box from '../models/box.js';

export const getMasterData = async (req, res, next) => {
  try {
    const masterData = await getRequisitionMasterData(null, req);

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

export const getRequisitionItems = async (req, res, next) => {
  try {
    const requisitionItems = await getRequisitionItemDetails(req);

    return res.status(200).json({ requisitionItems });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Requisition Items failed!",
    //   error: JSON.stringify(error, Object.getOwnPropertyNames(error))
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Requisition Items failed!";
    next(error, req, res);
  }
};

export const getItemStock = async (req, res, next) => {
  try {
    const requisitionItem = await getRequisitionItemStock(req);

    return res.status(200).json({ requisitionItem });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Requisition Item Stock failed!",
    //   error: JSON.stringify(error, Object.getOwnPropertyNames(error))
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Requisition Item Stock failed!";
    next(error, req, res);
  }
};

export const createRequisition = async (req, res, next) => {
  let t;
  
  try {
    const requisition = await Requisition.build({
      status: 'Open',
      created_by: req.userData.userId,
      created_on: new Date().toISOString(),
      modified_by: req.userData.userId,
      modified_on: new Date().toISOString(),
      raised: 0
    });

    requisition.getRequestData(req);
    
    let error = await requisition.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }
    
    const items = requisition.getRequisitionItems(req.body);
    const requisitionItems = [];
    for(const item of items) {
      const requisitionItem = await RequisitionItem.build({
        ...item
      });
      // requisitionItem.getRequestData(item);
      error = await requisitionItem.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      await requisitionItem.setDetails();
      requisitionItems.push(requisitionItem);
    }

    const products = await requisition.getRequisitionItemProducts(requisitionItems);
    const requisitionProducts = [];
    for(const item of products) {
      const requisitionProduct = await RequisitionProduct.build({
        ...item
      });
      // requisitionProduct.getRequestData(item);
      // error = await requisitionProduct.validateData();
      // if (error) {
      //   return res.status(422).json({
      //     message: "Invalid inputs passed, please check your data.",
      //     error: error
      //   });
      // }

      // await requisitionProduct.setItemAmount();
      requisitionProducts.push(requisitionProduct);
    }

    requisition.setDetails(requisitionProducts, requisitionItems);
    
    t = await sequelize.transaction();
    await requisition.save({ transaction: t });

    for(const requisitionItem of requisitionItems) {
      requisitionItem.requisition_id = requisition.id;
      await requisitionItem.save({ transaction: t });
    }

    for(const requisitionProduct of requisitionProducts) {
      requisitionProduct.requisition_id = requisition.id;
      await requisitionProduct.save({ transaction: t });
    }

    await t.commit();
    
    return res.status(201).json({
      message: "Requisition added successfully",
      requisition: requisition
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Creating a requisition failed!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Creating a Requisition failed!";
    next(error, req, res);
  }
};

export const updateRequisition = async (req, res, next) => {
  let t;

  try {
    let requisition = await Requisition.findByPk(req.params.id);
    if (!requisition) {
      return res.status(422).json({message: "Requisition not found!"});
    }

    if (requisition.status.trim().toUpperCase() === 'CLOSED') {
      return res.status(422).json({message: "Requisition is already closed!"});
    }

    let blUpdate = false;
    if (requisition.status && requisition.status.trim().toUpperCase() === 'APPROVED') {
      let requisitionOld = await Requisition.findByPk(req.params.id, { attributes: {exclude: ['id'] }, raw: true });

      // requisition = await Requisition.build({
      //   status: 'Pending',
      //   po_status: 'Open',
      //   created_by: req.userData.userId,
      //   created_on: new Date().toISOString(),
      //   modified_by: req.userData.userId,
      //   modified_on: new Date().toISOString()
      // });
  
      requisition = await Requisition.build({
        ...requisitionOld,
        status: 'Open',
        modified_by: req.userData.userId,
        modified_on: new Date().toISOString()
      });
  
      requisition.getRequestData(req);

      requisition.ref_id = req.params.id;
    } else {
      requisition.getRequestData(req);
      requisition.status = 'Open';
      requisition.modified_by = req.userData.userId;
      requisition.modified_on = new Date().toISOString();
      blUpdate = true;
    }

    let error = await requisition.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }
    
    const items = requisition.getRequisitionItems(req.body);
    const requisitionItems = [];
    for(const item of items) {
      const requisitionItem = await RequisitionItem.build({
        ...item
      });
      // requisitionItem.getRequestData(item);
      error = await requisitionItem.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      await requisitionItem.setDetails();
      requisitionItems.push(requisitionItem);
    }

    const products = await requisition.getRequisitionItemProducts(requisitionItems);
    const requisitionProducts = [];
    for(const item of products) {
      const requisitionProduct = await RequisitionProduct.build({
        ...item
      });
      // requisitionProduct.getRequestData(item);
      // error = await requisitionProduct.validateData();
      // if (error) {
      //   return res.status(422).json({
      //     message: "Invalid inputs passed, please check your data.",
      //     error: error
      //   });
      // }

      // await requisitionProduct.setItemAmount();
      requisitionProducts.push(requisitionProduct);
    }

    requisition.setDetails(requisitionProducts, requisitionItems);

    t = await sequelize.transaction();
    await requisition.save({ transaction: t });

    if (blUpdate === true) {
      await RequisitionProduct.destroy({ where: { requisition_id: requisition.id }, transaction: t });
      await RequisitionItem.destroy({ where: { requisition_id: requisition.id }, transaction: t });
      
      // const pos = await Production.findAll({ 
      //   where: {requisition_id: requisition.id, status: 'Drafted'}, 
      //   attributes: ['id'],
      //   raw: true
      // });
      // let productionIds = pos.map(po => po.id);
      // await ProductionItem.destroy({ where: { production_id: {[Op.in]: [...productionIds]} }, transaction: t });

      // productionIds = productions.map(po => po.id);
      // await Production.destroy({ where: { requisition_id: requisition.id, status: 'Drafted', id: {[Op.notIn]: [...productionIds]} }, transaction: t });
    }
    
    for(const requisitionItem of requisitionItems) {
      requisitionItem.requisition_id = requisition.id;
      await requisitionItem.save({ transaction: t });
    }

    for(const requisitionProduct of requisitionProducts) {
      requisitionProduct.requisition_id = requisition.id;
      await requisitionProduct.save({ transaction: t });
    }

    await t.commit();
    
    res.status(200).json({ message: "Update successful!", requisition: requisition });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't udpate requisition!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't update Requisition!";
    next(error, req, res);
  }
};

export const raiseProduction = async (req, res, next) => {
  let t;

  try {
    let requisition = await Requisition.findByPk(req.params.id);
    if (!requisition) {
      return res.status(422).json({message: "Requisition not found!"});
    }

    if (requisition.status.trim().toUpperCase() === 'CLOSED') {
      return res.status(422).json({message: "Requisition is already closed!"});
    }

    let blUpdate = false;
    if (requisition.status && requisition.status.trim().toUpperCase() === 'APPROVED') {
      let requisitionOld = await Requisition.findByPk(req.params.id, { attributes: {exclude: ['id'] }, raw: true });

      // requisition = await Requisition.build({
      //   status: 'Pending',
      //   po_status: 'Open',
      //   created_by: req.userData.userId,
      //   created_on: new Date().toISOString(),
      //   modified_by: req.userData.userId,
      //   modified_on: new Date().toISOString()
      // });
  
      requisition = await Requisition.build({
        ...requisitionOld,
        status: 'Open',
        modified_by: req.userData.userId,
        modified_on: new Date().toISOString()
      });
  
      requisition.getRequestData(req);

      requisition.ref_id = req.params.id;
    } else {
      requisition.getRequestData(req);
      requisition.status = 'Open';
      requisition.modified_by = req.userData.userId;
      requisition.modified_on = new Date().toISOString();
      blUpdate = true;
    }

    let error = await requisition.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }
    
    // const data = await getRequisitionRawMaterials(null);

    const products = requisition.getRequisitionProducts(req.body);
    const requisitionProducts = [];
    for(const item of products) {
      const requisitionProduct = await RequisitionProduct.findByPk(item.id);
      if (!requisitionProduct) {
        return res.status(404).json({message: "Requisition Item not found!"});
      }
      requisitionProduct.getRequestData(item);
      error = await requisitionProduct.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      // await requisitionProduct.setItemAmount();
      requisitionProducts.push(requisitionProduct);
    }

    const productions = await requisition.raiseProduction(requisitionProducts);
    
    for(const requisitionProduct of requisitionProducts) {
      if (requisitionProduct.raise && requisitionProduct.production_status === '' && requisitionProduct.manufacturer_id && requisitionProduct.requested_kg) {
        requisitionProduct.production_status = 'Raised';
        requisition.raised = 1;
        requisition.status = 'Closed';
      }
    }

    t = await sequelize.transaction();
    await requisition.save({ transaction: t });

    for(const requisitionProduct of requisitionProducts) {
      requisitionProduct.requisition_id = requisition.id;
      await requisitionProduct.save({ transaction: t });
    }

    for (const item of productions) {
      const production = item.production;
      const rawMaterialRequests = item.rawMaterialRequests;
      
      if (!production.p_id) {
        const series = await getSeries(req, 'Production');
        production.getProductionNo(series.series);
        await series.save({ transaction: t });
      }
  
      await production.save({ transaction: t });
  
      for (const rawMaterialRequest of rawMaterialRequests) {
        const productionRawMaterialRequest = await ProductionRawMaterialRequest.build({
          production_id: production.id
        });
        productionRawMaterialRequest.setRequestData(rawMaterialRequest);
        await productionRawMaterialRequest.save({ transaction: t });
      }
    }

    await t.commit();
    
    res.status(200).json({ message: "Productions Raised successful!", requisition: requisition });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't raise Production!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't raise Production!";
    next(error, req, res);
  }
};

export const approveRequisition = async (req, res, next) => {
  let t;

  try {
    let requisition = await Requisition.findByPk(req.params.id);
    if (!requisition) {
      return res.status(404).json({
        message: "Requisition not found!"
      });
    }

    // if (requisition.modified_by === req.userData.userId) {
    //   return res.status(422).json({ 
    //     message: `You can't approve this Requisition.`, 
    //     error : { 
    //       errors : { 
    //         vendorDate: { message: `You can't approve this Requisition.` } 
    //       } 
    //     }
    //   });
    // }

    // console.log(requisition);

    if (requisition.status.trim().toUpperCase() !== 'PENDING' && requisition.status.trim().toUpperCase() !== 'DELETED') {
      return res.status(422).json({ 
        message: `Requisition status should be pending or deleted.`, 
        error : { 
          errors : { 
            vendorDate: { message: `Requisition status should be pending or deleted.` } 
          } 
        }
      });
    }

    requisition.approve(req);

    // console.log(error);
    // requisition.approvedBy = req.userData.userId;
    // requisition.approvedAt = new Date().toISOString();

    const error = await requisition.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    // try {
      t = await sequelize.transaction();
      
      // if (!requisition.po_no) {
      //   const series = await getSeries(req, 'Purchase_Order');
      //   requisition.getRequisitionNo(series.series);
      //   await series.save({ transaction: t });
      // }
      
      if (!requisition.ref_id) {
        await requisition.save({ transaction: t });
      } else {
        // const obj = JSON.parse(JSON.stringify(requisition));
        // delete obj._id;
        // obj.ref_id = null;

        const ref_id = requisition.ref_id;

        const obj = requisition.dataValues;
        delete obj.id;
        obj.ref_id = null;

        // console.log(obj);
        // console.log(ref_id);
        // console.log(req.params.id);

        await Requisition.destroy({ where: {id: req.params.id }}, { transaction: t });

        // requisition = await Requisition.findByIdAndUpdate(ref_id, obj, { session: session, new: true });

        await Requisition.update(obj, { where: { id: ref_id } }, { transaction: t });

        await RequisitionProduct.destroy({ where: {requisition_id: ref_id }}, { transaction: t });

        await RequisitionProduct.update({ requisition_id: ref_id }, { where: { requisition_id: req.params.id }}, { transaction: t });

        await RequisitionItem.destroy({ where: {requisition_id: ref_id }}, { transaction: t });

        await RequisitionItem.update({ requisition_id: ref_id }, { where: { requisition_id: req.params.id }}, { transaction: t });

        // originalRequisition = await Requisition.findById(requisition.ref_id);
        // originalRequisition.overwrite(requisition);
        // originalRequisition.ref_id = null;
        // originalRequisition.vendorState = requisition.vendorState;
        // // console.log(originalRequisition);
        // await originalRequisition.save({ session });
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
    //   message: 'Approving Requisition failed! Error - ' + (error.message ? error.message : '')
    // });
    
    res.statusCode = 500;
    res.message = "Approving Requisition failed!";
    next(error, req, res);
  }
};

export const rejectRequisition = async (req, res, next) => {
  try {
    let requisition = await Requisition.findByPk(req.params.id);

    if (!requisition) {
      return res.status(404).json({
        message: "Requisition not found!"
      });
    }

    if (requisition.modified_by.toString() === req.userData.userId.toString()) {
      return res.status(422).json({ 
        message: `You can't reject this Requisition.`, 
        error : { 
          errors : { 
            vendorDate: { message: `You can't reject this Requisition.` } 
          } 
        }
      });
    }

    if (requisition.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({ 
        message: `Requisition is already approved.`, 
        error : { 
          errors : { 
            vendorDate: { message: `Requisition is already approved.` } 
          } 
        }
      });
    }

    requisition.reject(req);
    await requisition.save();

    res.status(200).json({ message: "Reject successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Rejecting Requisition failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Rejecting Requisition failed!";
    next(error, req, res);
  }
};

export const getRequisitions = async (req, res, next) => {
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
          // {'$requisitionItems.item_name$': { [Op.like]: `%${query}%` }}
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
    //   { model: RequisitionItem, as: 'requisitionItems', attributes: ['item_name'], required: true, where: {item_name: { [Op.like]: `%${query}%` }} }
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
    const data = await Requisition.findAll(
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

    const { count, rows } = await Requisition.findAndCountAll(condition);
    // const rows = 

    res.status(200).json({
      message: "Requisitions fetched successfully!",
      // totalCount: totalCount,
      total: count,
      statusCount: statusCount,
      rows: rows
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Requisitions failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Requisitions failed!";
    next(error, req, res);
  }
};

export const getRequisition = async (req, res, next) => {
  try {
    const requisition = await Requisition.findByPk(req.params.id, { 
      include: [
        { 
          model: RequisitionProduct, 
          as: "requisitionProducts", 
          include: [{ model: Product, as: "product", attributes: ['id', 'product_name', 'short_name'] }]
        }, 
        { 
          model: RequisitionItem, 
          as: "requisitionItems", 
          include: [{ model: Box, as: "box", attributes: ['id', 'box_name'], include: 'category' }]
        }, 
        // { model: Vendor, as: "vendor", attributes: ['id', 'vendor_name', 'vendor_code', 'address', 'city', 'pincode', 'state', 'country', 'gst_number', 'payment_due_days'] },
        { model: Depot, as: "depot", attributes: ['id', 'depot_name', 'address', 'city', 'pincode', 'state', 'country', 'gst_no'] },
        // { model: User, as: "created_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
        // { model: User, as: "modified_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
        // { model: User, as: "approved_by_user", attributes: ['id', 'first_name', 'last_name'] }
      ] 
    });
    if (!requisition) {
      return res.status(404).json({ message: "Requisition not found!" });
    }

    const roleDetails = req.userData.roleDetails;

    // console.log(roleDetails);

    const action = {
      update: false,
      delete: false,
      approve: false
    };

    // console.log(requisition.modified_by.toString());
    // console.log(req.userData.userId);
    
    // if (requisition.isFreezed) {
    //   if (requisition.status.trim().toUpperCase() !== 'APPROVED' && requisition.status.trim().toUpperCase() !== 'INACTIVE') {
    //     if (roleDetails.r_edit) {
    //       action.update = true;
    //     }
    //     if (roleDetails.r_delete) {
    //       action.delete = true;
    //     }
    //   }
    // } else {
      if (!roleDetails.r_approvals || 
            (requisition.status.trim().toUpperCase() !== 'PENDING' && 
            requisition.status.trim().toUpperCase() !== 'DELETED') || 
            requisition.modified_by.toString() === req.userData.userId.toString()) 
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

    const masterData = await getRequisitionMasterData(requisition, req);
  
    return res.status(200).json({ 
      message: "Requisition fetched successfully!",
      action, 
      requisition, 
      masterData 
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Requisition failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Requisition failed!";
    next(error, req, res);
  }
};

export const deleteRequisition = async (req, res, next) => {
  let t;

  try {
    let requisition = await Requisition.findByPk(req.params.id, {raw: true});
    if (!requisition) {
      return res.status(404).json({ message: "Requisition not found!" });
    }

    t = await sequelize.transaction();

    if (requisition.status.trim().toUpperCase() === 'APPROVED') {
      requisition.id = null;
      requisition.status = 'Deleted';
      requisition.ref_id = req.params.id;
      
      requisition = await Requisition.build({
        ...requisition
      });

      await requisition.save({ transaction: t });

      let requisitionProducts = await RequisitionProduct.findAll({ 
        where: { requisition_id: req.params.id}, 
        // attributes: ['requisition_id', 'item_person', 'email_id', 'mobile'], 
        raw: true 
      });

      requisitionProducts = requisitionProducts.map(requisitionProduct => {
        // requisitionProduct.id = null;
        delete requisitionProduct.id;
        requisitionProduct.requisition_id = requisition.id;
        return requisitionProduct;
      });

      await RequisitionProduct.bulkCreate(requisitionProducts, { transaction: t });
      
      let requisitionItems = await RequisitionItem.findAll({ 
        where: { requisition_id: req.params.id}, 
        // attributes: ['requisition_id', 'item_person', 'email_id', 'mobile'], 
        raw: true 
      });

      requisitionItems = requisitionItems.map(requisitionItem => {
        // requisitionItem.id = null;
        delete requisitionItem.id;
        requisitionItem.requisition_id = requisition.id;
        return requisitionItem;
      });

      await RequisitionItem.bulkCreate(requisitionItems, { transaction: t });
      
      // const error = await requisition.validateData();
      // if (error) {
      //   return res.status(422).json({
      //     message: "Invalid inputs passed, please check your data.",
      //     error: error
      //   });
      // }
    } else {
      const pos = await Production.findAll({ 
        where: {requisition_id: req.params.id, status: 'Drafted'}, 
        attributes: ['id'],
        raw: true
      });
      const productionIds = pos.map(item => item.id);

      await ProductionRawMaterialRequest.destroy({ where: { production_id: {[Op.in]: [...productionIds]} }, transaction: t });
      await Production.destroy({ where: { requisition_id: req.params.id, status: 'Drafted' }, transaction: t });

      await RequisitionProduct.destroy({ where: { requisition_id: req.params.id }, transaction: t });
      await RequisitionItem.destroy({ where: { requisition_id: req.params.id }, transaction: t });
      await Requisition.destroy({ where: { id: req.params.id }, transaction: t });
    }

    await t.commit();
    
    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Deleting Requisition failed!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Deleting Requisition failed!";
    next(error, req, res);
  }
};