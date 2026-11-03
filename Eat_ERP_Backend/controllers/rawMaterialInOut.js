import { Op } from 'sequelize';
import sequelize from '../lib/database.js';

import RawMaterialInOut, {getRawMaterialBarcodes, getRawMaterialInOutMasterData} from '../models/rawMaterialInOut.js';
import RawMaterialInOutItem from '../models/rawMaterialInOutItem.js';
import Depot from '../models/depot.js';
import RawMaterial from '../models/rawMaterial.js';
import User from '../models/user.js';
import Stock from '../models/stock.js';
import { availableStock } from '../lib/availableStock.js';

export const getMasterData = async (req, res, next) => {
  try {
    const masterData = await getRawMaterialInOutMasterData(null, req);

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

export const getBarcodes = async (req, res, next) => {
  try {
    const raw_material_id = req.params.raw_material_id ? +req.params.raw_material_id : 0;
    const depot_id = req.params.depot_id ? +req.params.depot_id : 0;

    const barcodes = await getRawMaterialBarcodes(raw_material_id);
    const {totalStock} = await availableStock(raw_material_id, depot_id);


    return res.status(200).json({ barcodes, totalStock });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching barcodes failed!",
    //   error: JSON.stringify(error, Object.getOwnPropertyNames(error))
    // });
    
    res.statusCode = 500;
    res.message = "Fetching barcodes failed!";
    next(error, req, res);
  }
};

export const createRawMaterialInOut = async (req, res, next) => {
  let t;
  let rawMaterialInOut;
  
  try {
    rawMaterialInOut = await RawMaterialInOut.build({
      status: 'Pending',
      created_by: req.userData.userId,
      created_on: new Date().toISOString(),
      modified_by: req.userData.userId,
      modified_on: new Date().toISOString()
    });

    // console.log(req.body);

    rawMaterialInOut.getRequestData(req);
    
    let error = await rawMaterialInOut.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }
    
    const items = rawMaterialInOut.getRawMaterialInOutItems(req.body);
    
    if (items.length === 0) {
      return res.status(422).json({
        message: "Please insert atleast one Item."
      });
    }

    // Stock overruled check
    // for(const item of items){
    //   if(item.type === 'Stock OUT'){

    //   }
    // }

    const checkStock = await Promise.all(items.map(async(item, index)=>{
      console.log(item);
      if(item.type === 'Stock OUT') {
        const {totalStock} = await availableStock(item.raw_material_id, rawMaterialInOut.depot_id);
        console.log("totalStock", totalStock);
        if(item.qty > totalStock) {
          return {
            index: index,
            stock:totalStock,
            error: true,
            message: `Stock cannot be negative.`
          }
        }else{
          return {
            index: index,
            stock:totalStock,
            error: false,
            message: `Stock is sufficient.`
          }
        }
      }else{
        return {
          index: index,
          stock:0,
          error: false,
          message: `Stock is sufficient.`
        }
      }
    }));

    const hasError = checkStock.some((item) => item.error);

    console.log("CheckStock", checkStock);
    console.log("hasError", hasError);

    if (hasError) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: checkStock
      });
      
    } else {
      // return res.status(422).json({
      //   message: "Right He Data",
      //   error: checkStock
      // });
    }
    const rawMaterialInOutItems = [];

    for(const item of items) {

      const rawMaterialInOutItem = await RawMaterialInOutItem.build({
        ...item
      });
      // rawMaterialInOutItem.getRequestData(item);
      error = await rawMaterialInOutItem.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      await rawMaterialInOutItem.setItemDetails();
      rawMaterialInOutItems.push(rawMaterialInOutItem);
    }
    
    t = await sequelize.transaction();

    await rawMaterialInOut.setDetails(rawMaterialInOutItems);

    await rawMaterialInOut.save({ transaction: t });

    for(const rawMaterialInOutItem of rawMaterialInOutItems) {
      rawMaterialInOutItem.raw_material_in_out_id = rawMaterialInOut.id;
      await rawMaterialInOutItem.save({ transaction: t });
    }
    // await t.commit();





    
    rawMaterialInOut = await RawMaterialInOut.findByPk(rawMaterialInOut.id, { 
      include: [{ 
          model: RawMaterialInOutItem , 
          as: "rawMaterialInOutItems", 
          include: [{ model: RawMaterial, as: "raw_material", attributes: ["id", "rm_name"]}] 
        }, 
        "depot"
      ] 
    });

    // t = await sequelize.transaction();
    await Stock.destroy({ where: { stock_type: 'Raw Material In Out', raw_material_in_out_id: rawMaterialInOut.id }});
    let dataArray = Stock.setStockDetails('Raw Material In Out', rawMaterialInOut, t, req);
    Stock.bulkCreate(dataArray);
    await t.commit();
    // error = await Stock.setStockDetails('Raw Material In Out', rawMaterialInOut, session, req);
    // if (error) throw error;

    return res.status(200).json({
      message: "Raw Material In Out added successfully.",
      rawMaterialInOut: rawMaterialInOut
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Adding a Raw Material In Out failed!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Adding a Raw Material In Out failed!";
    next(error, req, res);
  }
};

export const updateRawMaterialInOut = async (req, res, next) => {
  let t;

  try {
    let rawMaterialInOut = await RawMaterialInOut.findByPk(req.params.id);
    if (!rawMaterialInOut) {
      return res.status(404).json({message: "Raw Material In Out not found!"});
    }

    let blUpdate = false;
    if (rawMaterialInOut.status.trim().toUpperCase() === 'APPROVED') {
      rawMaterialInOut = await RawMaterialInOut.build({
        status: 'Pending',
        created_by: req.userData.userId,
        created_on: new Date().toISOString(),
        modified_by: req.userData.userId,
        modified_on: new Date().toISOString()
      });
  
      rawMaterialInOut.getRequestData(req);

      rawMaterialInOut.ref_id = req.params.id;
    } else {
      rawMaterialInOut.getRequestData(req);
      rawMaterialInOut.status = 'Pending';
      rawMaterialInOut.modified_by = req.userData.userId;
      rawMaterialInOut.modified_on = new Date().toISOString();
      blUpdate = true;
    }

    let error = await rawMaterialInOut.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    const items = rawMaterialInOut.getRawMaterialInOutItems(req.body);

    if (items.length === 0) {
      return res.status(422).json({
        message: "Please insert atleast one Item."
      });
    }

    const rawMaterialInOutItems = [];
    for(const item of items) {
      const rawMaterialInOutItem = await RawMaterialInOutItem.build({
        ...item
      });
      // rawMaterialInOutItem.getRequestData(item);
      error = await rawMaterialInOutItem.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      await rawMaterialInOutItem.setItemDetails();
      rawMaterialInOutItems.push(rawMaterialInOutItem);
    }
    
    t = await sequelize.transaction();

    await rawMaterialInOut.setDetails(rawMaterialInOutItems);

    await rawMaterialInOut.save({ transaction: t });

    if (blUpdate === true) {
      await RawMaterialInOutItem.destroy({ where: { raw_material_in_out_id: rawMaterialInOut.id }, transaction: t });
    }
    
    for(const rawMaterialInOutItem of rawMaterialInOutItems) {
      rawMaterialInOutItem.raw_material_in_out_id = rawMaterialInOut.id;
      await rawMaterialInOutItem.save({ transaction: t });
    }

    // await t.commit();

    rawMaterialInOut = await RawMaterialInOut.findByPk(rawMaterialInOut.id, { 
      include: [{ 
          model: RawMaterialInOutItem , 
          as: "rawMaterialInOutItems", 
          include: [{ model: RawMaterial, as: "raw_material", attributes: ["id", "rm_name"]}] 
        }, 
        "depot"
      ] 
    });

    // t = await sequelize.transaction();
    await Stock.destroy({ where: { stock_type: 'Raw Material In Out', raw_material_in_out_id: rawMaterialInOut.id }});
    let dataArray = Stock.setStockDetails('Raw Material In Out', rawMaterialInOut, t, req);
    Stock.bulkCreate(dataArray);
    await t.commit();
    // error = await Stock.setStockDetails('Raw Material In Out', rawMaterialInOut, session, req);
    // if (error) throw error;

    res.status(200).json({ message: "Update successful!", rawMaterialInOut: rawMaterialInOut });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't udpate rawMaterialInOut!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't update Raw Material In Out!";
    next(error, req, res);
  }
};

export const approveRawMaterialInOut = async (req, res, next) => {
  let t;

  try {
    let raw_material_in_out_id = req.params.id;
    let rawMaterialInOut = await RawMaterialInOut.findByPk(raw_material_in_out_id);
    
    if (!rawMaterialInOut) {
      return res.status(404).json({
        message: "Raw Material In Out not found!"
      });
    }

    // if (rawMaterialInOut.modified_by === req.userData.userId) {
    //   return res.status(422).json({ 
    //     message: `You can't approve this RawMaterialInOut.`, 
    //     error : { 
    //       errors : { 
    //         vendorDate: { message: `You can't approve this RawMaterialInOut.` } 
    //       } 
    //     }
    //   });
    // }

    // console.log(rawMaterialInOut);

    if (rawMaterialInOut.status.trim().toUpperCase() !== 'PENDING' && rawMaterialInOut.status.trim().toUpperCase() !== 'DELETED') {
      return res.status(422).json({ 
        message: `Raw Material In Out status should be pending or deleted.`, 
        error : { 
          errors : { 
            vendorDate: { message: `Raw Material In Out status should be pending or deleted.` } 
          } 
        }
      });
    }

    rawMaterialInOut.approve(req);

    // console.log(error);
    // rawMaterialInOut.approvedBy = req.userData.userId;
    // rawMaterialInOut.approvedAt = new Date().toISOString();

    const error = await rawMaterialInOut.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    // try {
      t = await sequelize.transaction();
      
      if (!rawMaterialInOut.ref_id) {
        await rawMaterialInOut.save({ transaction: t });
      } else {
        // const obj = JSON.parse(JSON.stringify(rawMaterialInOut));
        // delete obj._id;
        // obj.ref_id = null;

        const ref_id = rawMaterialInOut.ref_id;
        raw_material_in_out_id = rawMaterialInOut.ref_id;

        const obj = rawMaterialInOut.dataValues;
        delete obj.id;
        obj.ref_id = null;

        // console.log(obj);
        // console.log(ref_id);
        // console.log(req.params.id);

        await RawMaterialInOut.destroy({ where: {id: req.params.id }}, { transaction: t });

        // rawMaterialInOut = await RawMaterialInOut.findByIdAndUpdate(ref_id, obj, { session: session, new: true });

        await RawMaterialInOut.update(obj, { where: { id: ref_id } }, { transaction: t });

        await RawMaterialInOutItem.destroy({ where: {raw_material_in_out_id: ref_id }}, { transaction: t });

        await RawMaterialInOutItem.update({ raw_material_in_out_id: ref_id }, { where: { raw_material_in_out_id: req.params.id }}, { transaction: t });

        // originalRawMaterialInOut = await RawMaterialInOut.findById(rawMaterialInOut.ref_id);
        // originalRawMaterialInOut.overwrite(rawMaterialInOut);
        // originalRawMaterialInOut.ref_id = null;
        // originalRawMaterialInOut.vendorState = rawMaterialInOut.vendorState;
        // // console.log(originalRawMaterialInOut);
        // await originalRawMaterialInOut.save({ session });
      }

      await t.commit();
      
      rawMaterialInOut = await RawMaterialInOut.findByPk(raw_material_in_out_id, {
        include: [
          { model: Depot, as: "depot", attributes: ["id", "depot_name", "state"] }, 
          { 
            model: RawMaterialInOutItem, 
            as: "rawMaterialInOutItems", 
            include: { model: RawMaterial, as: "raw_material", attributes: ["id", "rm_name"] },
          }
        ]
      });

      await Stock.destroy({ where: { stock_type: 'Raw Material In Out', raw_material_in_out_id: raw_material_in_out_id }});
      let dataArray = Stock.setStockDetails('Raw Material In Out', rawMaterialInOut, t, req);
      Stock.bulkCreate(dataArray);

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
    //   message: 'Approving Raw Material In Out failed! Error - ' + (error.message ? error.message : '')
    // });
    
    res.statusCode = 500;
    res.message = "Approving Raw Material In Out failed!";
    next(error, req, res);
  }
};

export const rejectRawMaterialInOut = async (req, res, next) => {
  try {
    let rawMaterialInOut = await RawMaterialInOut.findByPk(req.params.id);

    if (!rawMaterialInOut) {
      return res.status(404).json({
        message: "Raw Material In Out not found!"
      });
    }

    if (rawMaterialInOut.modified_by.toString() === req.userData.userId.toString()) {
      return res.status(422).json({ 
        message: `You can't reject this Raw Material In Out.`, 
        error : { 
          errors : { 
            vendorDate: { message: `You can't reject this Raw Material In Out.` } 
          } 
        }
      });
    }

    if (rawMaterialInOut.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({ 
        message: `Raw Material In Out is already approved.`, 
        error : { 
          errors : { 
            vendorDate: { message: `Raw Material In Out is already approved.` } 
          } 
        }
      });
    }

    rawMaterialInOut.reject(req);
    await rawMaterialInOut.save();

    res.status(200).json({ message: "Reject successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Rejecting Raw Material In Out failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Rejecting Raw Material In Out failed!";
    next(error, req, res);
  }
};

export const getRawMaterialInOuts = async (req, res, next) => {
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
      sort = { key: (req.query.key ? req.query.key : 'modified_on'), order: (req.query.order ? req.query.order : 'desc') };
    }

    let condition = {};
    let searchCondition = {};

    if (query) {
      searchCondition = {
        [Op.or]: [
          {'$depot_name$': { [Op.like]: `%${query}%` }}, 
          {'$item_names$': { [Op.like]: `%${query}%` }}, 
          {'$type$': { [Op.like]: `%${query}%` }}
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
    //   { model: RawMaterialInOutItem, InItems', attributes: ['item_name'] }
    // ];

    // let totalCount = 0;
    const statusCount = {
      pending: 0,
      approved: 0,
      rejected: 0,
      inActive: 0
    };
    const data = await RawMaterialInOut.findAll(
      { 
        ...condition, 
        attributes: [
          'status', 'type', 'depot_name', 'item_names', 
          [sequelize.fn('COUNT', sequelize.col('status')), 'count']
        ], 
        group:['status', 'type', 'depot_name', 'item_names'], 
        raw: true
      }
    );
    // console.log(data);
    for (const item of data) {
      // console.log(item.status);
      // console.log(item.count);
      if (item.status === "Pending" || item.status === "Deleted") {
        statusCount.pending = statusCount.pending + parseInt(item.count);
        // totalCount = parseInt(item.count);
      }
      else if (item.status === "Approved") {
        statusCount.approved = statusCount.approved + parseInt(item.count);
        // totalCount = parseInt(item.count);
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
    
    let statusCondition = { status: status };
    if (status) {
      if (status.trim().toUpperCase() === 'PENDING') {
        statusCondition = { status: {[Op.or] : ['Pending', 'Deleted']} };
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

    const { count, rows } = await RawMaterialInOut.findAndCountAll(condition);
    // const rows = 

    res.status(200).json({
      message: "Raw Material In Outs fetched successfully!",
      // totalCount: totalCount,
      total: count,
      statusCount: statusCount,
      rows: rows
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Raw Material In Outs failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Raw Material In Outs failed!";
    next(error, req, res);
  }
};

export const getRawMaterialInOut = async (req, res, next) => {
  try {
    const rawMaterialInOut = await RawMaterialInOut.findByPk(req.params.id, { 
      include: [{ 
          model: RawMaterialInOutItem , 
          as: "rawMaterialInOutItems", 
          include: [{ model: RawMaterial, as: "raw_material", attributes: ["id", "rm_name"]}] 
        }, 
        { model: Depot, as: "depot", attributes: ['id', 'depot_name', 'address', 'city', 'pincode', 'state', 'country', 'gst_no'] },
        { model: User, as: "created_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
        { model: User, as: "modified_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
        { model: User, as: "approved_by_user", attributes: ['id', 'first_name', 'last_name'] }
      ] 
    });
    if (!rawMaterialInOut) {
      return res.status(404).json({ message: "Raw Material In Out not found!" });
    }

    const roleDetails = req.userData.roleDetails;

    // console.log(roleDetails);

    const action = {
      update: false,
      delete: false,
      approve: false
    };

    // console.log(rawMaterialInOut.modified_by.toString());
    // console.log(req.userData.userId);
    
    // if (rawMaterialInOut.isFreezed) {
    //   if (rawMaterialInOut.status.trim().toUpperCase() !== 'APPROVED' && rawMaterialInOut.status.trim().toUpperCase() !== 'INACTIVE') {
    //     if (roleDetails.r_edit) {
    //       action.update = true;
    //     }
    //     if (roleDetails.r_delete) {
    //       action.delete = true;
    //     }
    //   }
    // } else {
      if (!roleDetails.r_approvals || 
            (rawMaterialInOut.status.trim().toUpperCase() !== 'PENDING' && 
            rawMaterialInOut.status.trim().toUpperCase() !== 'DELETED') || 
            rawMaterialInOut.modified_by.toString() === req.userData.userId.toString()) //req.userData.userId.toString()
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

    const masterData = await getRawMaterialInOutMasterData(rawMaterialInOut, req);

    const rawMaterialInOutItemBarcodes = [];
    for (const rawMaterialInOutItem of rawMaterialInOut.rawMaterialInOutItems) {
      if (rawMaterialInOutItem.raw_material_id) {
        const barcodes = await getRawMaterialBarcodes(rawMaterialInOutItem.raw_material_id);
        const {totalStock} = await availableStock(rawMaterialInOutItem.raw_material_id, rawMaterialInOut.depot_id);
        rawMaterialInOutItem.dataValues.totalStock = totalStock;
        rawMaterialInOutItemBarcodes.push(barcodes);
      }
    }
    
    return res.status(200).json({ 
      message: "Raw Material In Out fetched successfully!",
      action, 
      rawMaterialInOut, 
      masterData,
      rawMaterialInOutItemBarcodes
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Raw Material In Out failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Raw Material In Out failed!";
    next(error, req, res);
  }
};

export const deleteRawMaterialInOut = async (req, res, next) => {
  let t;

  try {
    let rawMaterialInOut = await RawMaterialInOut.findByPk(req.params.id, {raw: true});
    if (!rawMaterialInOut) {
      return res.status(404).json({ message: "Raw Material In Out not found!" });
    }

    if (rawMaterialInOut.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({ 
        message: `Raw Material In Out is already approved.`, 
        error : { 
          errors : { 
            vendorDate: { message: `Raw Material In Out is already approved.` } 
          } 
        }
      });
    }

    t = await sequelize.transaction();

    if (rawMaterialInOut.status.trim().toUpperCase() === 'APPROVED') {
      rawMaterialInOut.id = null;
      rawMaterialInOut.status = 'Deleted';
      rawMaterialInOut.ref_id = req.params.id;
      
      rawMaterialInOut = await RawMaterialInOut.build({
        ...rawMaterialInOut
      });

      await rawMaterialInOut.save({ transaction: t });

      let rawMaterialInOutItems = await RawMaterialInOutItem.findAll({ 
        where: { raw_material_in_out_id: req.params.id}, 
        // attributes: ['raw_material_in_out_id', 'item_person', 'email_id', 'mobile'], 
        raw: true 
      });

      // rawMaterialInOutItems = rawMaterialInOutItems.map(rawMaterialInOutItem => {
      //   // rawMaterialInOutItem.id = null;
      //   delete rawMaterialInOutItem.id;
      //   rawMaterialInOutItem.raw_material_in_out_id = rawMaterialInOut.id;
      //   return rawMaterialInOutItem;
      // });

      // await RawMaterialInOutItem.bulkCreate(rawMaterialInOutItems, { transaction: t });
      
      for (let rawMaterialInOutItem of rawMaterialInOutItems) {
        delete rawMaterialInOutItem.id;
        rawMaterialInOutItem.raw_material_in_out_id = rawMaterialInOut.id;
        rawMaterialInOutItem = await RawMaterialInOut.build({
          ...rawMaterialInOutItem
        });
        await rawMaterialInOutItem.save({ transaction: t });
      }

      // const error = await rawMaterialInOut.validateData();
      // if (error) {
      //   return res.status(422).json({
      //     message: "Invalid inputs passed, please check your data.",
      //     error: error
      //   });
      // }
    } else {
      await RawMaterialInOutItem.destroy({ where: { raw_material_in_out_id: req.params.id }, transaction: t });
      await RawMaterialInOut.destroy({ where: { id: req.params.id }, transaction: t });
    }

    await t.commit();
    
    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Deleting Raw Material In Out failed!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Deleting Raw Material In Out failed!";
    next(error, req, res);
  }
};