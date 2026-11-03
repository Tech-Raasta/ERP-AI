import { Op } from 'sequelize';
import sequelize from '../lib/database.js';

import RawMaterialRecon, {getBarcodeStockForRecon, getRawMaterialBarcodes, getRawMaterialReconMasterData} from '../models/rawMaterialRecon.js';
import RawMaterialReconItem from '../models/rawMaterialReconItem.js';
import Depot from '../models/depot.js';
import RawMaterial from '../models/rawMaterial.js';
import User from '../models/user.js';
import Stock from '../models/stock.js';
import RawMaterialInOut from '../models/rawMaterialInOut.js';
import RawMaterialInOutItem from '../models/rawMaterialInOutItem.js';

export const getMasterData = async (req, res, next) => {
  try {
    const masterData = await getRawMaterialReconMasterData(null, req);

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

    const barcodes = await getRawMaterialBarcodes(raw_material_id);

    return res.status(200).json({ barcodes });
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

export const getBarcodeStock = async (req, res, next) => {
  try {
    const rawMaterialRecon = await RawMaterialRecon.findByPk(req.params.id);
    if (req.params.id && !rawMaterialRecon) {
      return res.status(404).json({ message: "Reconciliation not found!" });
    }

    let raw_material_recon_id = 0;
    if (rawMaterialRecon) {
      raw_material_recon_id = rawMaterialRecon.raw_material_recon_id ? rawMaterialRecon.raw_material_recon_id : 0;

      if (raw_material_recon_id) {
        const rawMaterialInOut = await RawMaterialInOut.findByPk(raw_material_recon_id);
        if (raw_material_recon_id && !rawMaterialInOut) {
          return res.status(404).json({ message: "Raw Material In/Out for reconciliation not found!" });
        }
      }
    }

    const depot_id = req.params.depot_id;
    const barcode = req.params.barcode;

    if(!depot_id) {
      return res.status(404).json({ message: "Please send depot id!" });
    }

    if(!barcode) {
      return res.status(404).json({ message: "Please send barcode!" });
    }

    let stock = await getBarcodeStockForRecon(raw_material_recon_id, depot_id, barcode);
    if(stock.length === 0) {
      // return res.status(404).json({ message: "Stock does not exist for barcode - " + barcode });
      stock = {
        // raw_material_id: raw_material_id, 
        barcode: barcode, 
        // expiry_date: expiry_date,  
        stock_qty: 0
      };
    }
    
    return res.status(200).json({ 
      message: "Barcode Stock fetched successfully!",
      stock
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Barcode Stock failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Barcode Stock failed!";
    next(error, req, res);
  }
};

export const createRawMaterialRecon = async (req, res, next) => {
  let t;
  let rawMaterialRecon;
  
  try {
    rawMaterialRecon = await RawMaterialRecon.build({
      status: 'Pending',
      created_by: req.userData.userId,
      created_on: new Date().toISOString(),
      modified_by: req.userData.userId,
      modified_on: new Date().toISOString()
    });

    // console.log(req.body);

    rawMaterialRecon.getRequestData(req);
    
    let error = await rawMaterialRecon.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }
    
    const items = rawMaterialRecon.getRawMaterialReconItems(req.body);
    
    if (items.length === 0) {
      return res.status(422).json({
        message: "Please insert atleast one Item."
      });
    }

    const rawMaterialReconItems = [];
    for(const item of items) {
      const rawMaterialReconItem = await RawMaterialReconItem.build({
        ...item
      });
      // rawMaterialReconItem.getRequestData(item);
      error = await rawMaterialReconItem.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      await rawMaterialReconItem.setItemDetails();
      rawMaterialReconItems.push(rawMaterialReconItem);
    }
    
    t = await sequelize.transaction();

    await rawMaterialRecon.setDetails(rawMaterialReconItems);

    await rawMaterialRecon.save({ transaction: t });

    for(const rawMaterialReconItem of rawMaterialReconItems) {
      rawMaterialReconItem.raw_material_recon_id = rawMaterialRecon.id;
      await rawMaterialReconItem.save({ transaction: t });
    }

    await t.commit();
    
    // rawMaterialRecon = await RawMaterialRecon.findByPk(rawMaterialRecon.id, { 
    //   include: [{ 
    //       model: RawMaterialReconItem , 
    //       as: "rawMaterialReconItems", 
    //       include: [{ model: RawMaterial, as: "raw_material", attributes: ["id", "rm_name"]}] 
    //     }, 
    //     "depot"
    //   ] 
    // });

    // // t = await sequelize.transaction();
    // await Stock.destroy({ where: { stock_type: 'Raw Material Recon', raw_material_recon_id: rawMaterialRecon.id }});
    // let dataArray = Stock.setStockDetails('Raw Material Recon', rawMaterialRecon, t, req);
    // Stock.bulkCreate(dataArray);
    // // await t.commit();
    // // error = await Stock.setStockDetails('Raw Material Recon', rawMaterialRecon, session, req);
    // // if (error) throw error;

    return res.status(200).json({
      message: "Raw Material Recon added successfully.",
      rawMaterialRecon: rawMaterialRecon
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Adding a Raw Material Recon failed!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Adding a Raw Material Recon failed!";
    next(error, req, res);
  }
};

export const updateRawMaterialRecon = async (req, res, next) => {
  let t;

  try {
    let rawMaterialRecon = await RawMaterialRecon.findByPk(req.params.id);
    if (!rawMaterialRecon) {
      return res.status(404).json({message: "Raw Material Recon not found!"});
    }

    let blUpdate = false;
    if (rawMaterialRecon.status.trim().toUpperCase() === 'APPROVED') {
      const raw_material_in_out_id = rawMaterialRecon.raw_material_in_out_id;

      rawMaterialRecon = await RawMaterialRecon.build({
        status: 'Pending',
        created_by: req.userData.userId,
        created_on: new Date().toISOString(),
        modified_by: req.userData.userId,
        modified_on: new Date().toISOString()
      });

      rawMaterialRecon.raw_material_in_out_id = raw_material_in_out_id;
  
      rawMaterialRecon.getRequestData(req);

      rawMaterialRecon.ref_id = req.params.id;
    } else {
      rawMaterialRecon.getRequestData(req);
      rawMaterialRecon.status = 'Pending';
      rawMaterialRecon.modified_by = req.userData.userId;
      rawMaterialRecon.modified_on = new Date().toISOString();
      blUpdate = true;
    }

    let error = await rawMaterialRecon.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    const items = rawMaterialRecon.getRawMaterialReconItems(req.body);

    if (items.length === 0) {
      return res.status(422).json({
        message: "Please insert atleast one Item."
      });
    }

    const rawMaterialReconItems = [];
    for(const item of items) {
      const rawMaterialReconItem = await RawMaterialReconItem.build({
        ...item
      });
      // rawMaterialReconItem.getRequestData(item);
      error = await rawMaterialReconItem.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      await rawMaterialReconItem.setItemDetails();
      rawMaterialReconItems.push(rawMaterialReconItem);
    }
    
    t = await sequelize.transaction();

    await rawMaterialRecon.setDetails(rawMaterialReconItems);

    await rawMaterialRecon.save({ transaction: t });

    if (blUpdate === true) {
      await RawMaterialReconItem.destroy({ where: { raw_material_recon_id: rawMaterialRecon.id }, transaction: t });
    }
    
    for(const rawMaterialReconItem of rawMaterialReconItems) {
      rawMaterialReconItem.raw_material_recon_id = rawMaterialRecon.id;
      await rawMaterialReconItem.save({ transaction: t });
    }

    await t.commit();

    // rawMaterialRecon = await RawMaterialRecon.findByPk(rawMaterialRecon.id, { 
    //   include: [{ 
    //       model: RawMaterialReconItem , 
    //       as: "rawMaterialReconItems", 
    //       include: [{ model: RawMaterial, as: "raw_material", attributes: ["id", "rm_name"]}] 
    //     }, 
    //     "depot"
    //   ] 
    // });

    // // t = await sequelize.transaction();
    // await Stock.destroy({ where: { stock_type: 'Raw Material Recon', raw_material_recon_id: rawMaterialRecon.id }});
    // let dataArray = Stock.setStockDetails('Raw Material Recon', rawMaterialRecon, t, req);
    // Stock.bulkCreate(dataArray);
    // // await t.commit();
    // // error = await Stock.setStockDetails('Raw Material Recon', rawMaterialRecon, session, req);
    // // if (error) throw error;

    res.status(200).json({ message: "Update successful!", rawMaterialRecon: rawMaterialRecon });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't udpate rawMaterialRecon!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't update Raw Material Recon!";
    next(error, req, res);
  }
};

export const approveRawMaterialRecon = async (req, res, next) => {
  let t;

  try {
    let raw_material_recon_id = req.params.id;
    let rawMaterialRecon = await RawMaterialRecon.findByPk(raw_material_recon_id);
    
    if (!rawMaterialRecon) {
      return res.status(404).json({
        message: "Raw Material Recon not found!"
      });
    }

    // if (rawMaterialRecon.modified_by === req.userData.userId) {
    //   return res.status(422).json({ 
    //     message: `You can't approve this RawMaterialRecon.`, 
    //     error : { 
    //       errors : { 
    //         vendorDate: { message: `You can't approve this RawMaterialRecon.` } 
    //       } 
    //     }
    //   });
    // }

    // console.log(rawMaterialRecon);

    if (rawMaterialRecon.status.trim().toUpperCase() !== 'PENDING' && rawMaterialRecon.status.trim().toUpperCase() !== 'DELETED') {
      return res.status(422).json({ 
        message: `Raw Material Recon status should be pending or deleted.`, 
        error : { 
          errors : { 
            vendorDate: { message: `Raw Material Recon status should be pending or deleted.` } 
          } 
        }
      });
    }

    rawMaterialRecon.approve(req);

    // console.log(error);
    // rawMaterialRecon.approvedBy = req.userData.userId;
    // rawMaterialRecon.approvedAt = new Date().toISOString();

    const error = await rawMaterialRecon.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    // try {
      t = await sequelize.transaction();
      
      if (!rawMaterialRecon.ref_id) {
        await rawMaterialRecon.save({ transaction: t });
      } else {
        // const obj = JSON.parse(JSON.stringify(rawMaterialRecon));
        // delete obj._id;
        // obj.ref_id = null;

        const ref_id = rawMaterialRecon.ref_id;
        raw_material_recon_id = rawMaterialRecon.ref_id;

        const obj = rawMaterialRecon.dataValues;
        delete obj.id;
        obj.ref_id = null;

        // console.log(obj);
        // console.log(ref_id);
        // console.log(req.params.id);

        await RawMaterialRecon.destroy({ where: {id: req.params.id }}, { transaction: t });


        // rawMaterialRecon = await RawMaterialRecon.findByIdAndUpdate(ref_id, obj, { session: session, new: true });
        await RawMaterialRecon.update(obj, { where: { id: ref_id } }, { transaction: t });

        await RawMaterialReconItem.destroy({ where: {raw_material_recon_id: ref_id }}, { transaction: t });

        await RawMaterialReconItem.update({ raw_material_recon_id: ref_id }, { where: { raw_material_recon_id: req.params.id }}, { transaction: t });

        // originalRawMaterialRecon = await RawMaterialRecon.findById(rawMaterialRecon.ref_id);
        // originalRawMaterialRecon.overwrite(rawMaterialRecon);
        // originalRawMaterialRecon.ref_id = null;
        // originalRawMaterialRecon.vendorState = rawMaterialRecon.vendorState;
        // // console.log(originalRawMaterialRecon);
        // await originalRawMaterialRecon.save({ session });
      }

      await t.commit();
      
      rawMaterialRecon = await RawMaterialRecon.findByPk(raw_material_recon_id, {
        include: [
          { model: Depot, as: "depot", attributes: ["id", "depot_name", "state"] }, 
          { 
            model: RawMaterialReconItem, 
            as: "rawMaterialReconItems", 
            include: { model: RawMaterial, as: "raw_material", attributes: ["id", "rm_name"] },
          }
        ]
      });

      t = await sequelize.transaction();
      
      let rawMaterialInOut = await RawMaterialInOut.setRawMaterialReconData(rawMaterialRecon, 'Adjustment');
      await rawMaterialInOut.save({ transaction: t });

      await RawMaterialInOutItem.destroy({ where: { raw_material_in_out_id: rawMaterialInOut.id }, transaction: t });

      const rawMaterialInOutItems = [];
      for (const rawMaterialReconItem of rawMaterialRecon.rawMaterialReconItems) {
        const rawMaterialInOutItem = await RawMaterialInOutItem.build({
          raw_material_in_out_id: rawMaterialInOut.id
        });
        rawMaterialInOutItem.setRawMaterialReconItemData(rawMaterialReconItem);
        await rawMaterialInOutItem.save({ transaction: t });

        rawMaterialInOutItems.push(rawMaterialInOutItem);
      }

      await rawMaterialInOut.setDetails(rawMaterialInOutItems);
      await rawMaterialInOut.save({ transaction: t });

      await t.commit();

      rawMaterialInOut = await RawMaterialInOut.findByPk(rawMaterialInOut.id, {
        include: [
          { model: RawMaterialInOutItem, as: "rawMaterialInOutItems" }
        ]
      });
      await Stock.destroy({ where: { stock_type: 'Raw Material In Out', raw_material_in_out_id: rawMaterialInOut.id }});
      let dataArray = Stock.setStockDetails('Raw Material In Out', rawMaterialInOut, t, req);
      await Stock.bulkCreate(dataArray);


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
    //   message: 'Approving Raw Material Recon failed! Error - ' + (error.message ? error.message : '')
    // });
    
    res.statusCode = 500;
    res.message = "Approving Raw Material Recon failed!";
    next(error, req, res);
  }
};

export const rejectRawMaterialRecon = async (req, res, next) => {
  try {
    let rawMaterialRecon = await RawMaterialRecon.findByPk(req.params.id);

    if (!rawMaterialRecon) {
      return res.status(404).json({
        message: "Raw Material Recon not found!"
      });
    }

    if (rawMaterialRecon.modified_by.toString() === req.userData.userId.toString()) {
      return res.status(422).json({ 
        message: `You can't reject this Raw Material Recon.`, 
        error : { 
          errors : { 
            vendorDate: { message: `You can't reject this Raw Material Recon.` } 
          } 
        }
      });
    }

    if (rawMaterialRecon.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({ 
        message: `Raw Material Recon is already approved.`, 
        error : { 
          errors : { 
            vendorDate: { message: `Raw Material Recon is already approved.` } 
          } 
        }
      });
    }

    rawMaterialRecon.reject(req);
    await rawMaterialRecon.save();

    res.status(200).json({ message: "Reject successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Rejecting Raw Material Recon failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Rejecting Raw Material Recon failed!";
    next(error, req, res);
  }
};

export const getRawMaterialRecons = async (req, res, next) => {
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
          // {'$type$': { [Op.like]: `%${query}%` }}
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
    //   { model: RawMaterialReconItem, InItems', attributes: ['item_name'] }
    // ];

    // let totalCount = 0;
    const statusCount = {
      pending: 0,
      approved: 0,
      rejected: 0,
      inActive: 0
    };
    const data = await RawMaterialRecon.findAll(
      { 
        ...condition, 
        attributes: [
          'status', 'depot_name', 'item_names', 
          [sequelize.fn('COUNT', sequelize.col('status')), 'count']
        ], 
        group:['status', 'depot_name', 'item_names'], 
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

    const { count, rows } = await RawMaterialRecon.findAndCountAll(condition);
    // const rows = 

    res.status(200).json({
      message: "Raw Material Recons fetched successfully!",
      // totalCount: totalCount,
      total: count,
      statusCount: statusCount,
      rows: rows
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Raw Material Recons failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Raw Material Recons failed!";
    next(error, req, res);
  }
};

export const getRawMaterialRecon = async (req, res, next) => {
  try {
    const rawMaterialRecon = await RawMaterialRecon.findByPk(req.params.id, { 
      include: [{ 
          model: RawMaterialReconItem , 
          as: "rawMaterialReconItems", 
          include: [{ model: RawMaterial, as: "raw_material", attributes: ["id", "rm_name"]}] 
        }, 
        { model: Depot, as: "depot", attributes: ['id', 'depot_name', 'address', 'city', 'pincode', 'state', 'country', 'gst_no'] },
        { model: User, as: "created_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
        { model: User, as: "modified_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
        { model: User, as: "approved_by_user", attributes: ['id', 'first_name', 'last_name'] }
      ] 
    });
    if (!rawMaterialRecon) {
      return res.status(404).json({ message: "Raw Material Recon not found!" });
    }

    const roleDetails = req.userData.roleDetails;

    // console.log(roleDetails);

    const action = {
      update: false,
      delete: false,
      approve: false
    };

    // console.log(rawMaterialRecon.modified_by.toString());
    // console.log(req.userData.userId);
    
    // if (rawMaterialRecon.isFreezed) {
    //   if (rawMaterialRecon.status.trim().toUpperCase() !== 'APPROVED' && rawMaterialRecon.status.trim().toUpperCase() !== 'INACTIVE') {
    //     if (roleDetails.r_edit) {
    //       action.update = true;
    //     }
    //     if (roleDetails.r_delete) {
    //       action.delete = true;
    //     }
    //   }
    // } else {
      if (!roleDetails.r_approvals || 
            (rawMaterialRecon.status.trim().toUpperCase() !== 'PENDING' && 
            rawMaterialRecon.status.trim().toUpperCase() !== 'DELETED') || 
            rawMaterialRecon.modified_by.toString() === req.userData.userId.toString()) //req.userData.userId.toString()
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

    const masterData = await getRawMaterialReconMasterData(rawMaterialRecon, req);

    const rawMaterialReconItemBarcodes = [];
    for (const rawMaterialReconItem of rawMaterialRecon.rawMaterialReconItems) {
      if (rawMaterialReconItem.raw_material_id) {
        const barcodes = await getRawMaterialBarcodes(rawMaterialReconItem.raw_material_id);
        rawMaterialReconItemBarcodes.push(barcodes);
      }
    }
    
    return res.status(200).json({ 
      message: "Raw Material Recon fetched successfully!",
      action, 
      rawMaterialRecon, 
      masterData,
      rawMaterialReconItemBarcodes
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Raw Material Recon failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Raw Material Recon failed!";
    next(error, req, res);
  }
};

export const deleteRawMaterialRecon = async (req, res, next) => {
  let t;

  try {
    let rawMaterialRecon = await RawMaterialRecon.findByPk(req.params.id, {raw: true});
    if (!rawMaterialRecon) {
      return res.status(404).json({ message: "Raw Material Recon not found!" });
    }

    if (rawMaterialRecon.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({ 
        message: `Raw Material Recon is already approved.`, 
        error : { 
          errors : { 
            vendorDate: { message: `Raw Material Recon is already approved.` } 
          } 
        }
      });
    }

    t = await sequelize.transaction();

    if (rawMaterialRecon.status.trim().toUpperCase() === 'APPROVED') {
      rawMaterialRecon.id = null;
      rawMaterialRecon.status = 'Deleted';
      rawMaterialRecon.ref_id = req.params.id;
      
      rawMaterialRecon = await RawMaterialRecon.build({
        ...rawMaterialRecon
      });

      await rawMaterialRecon.save({ transaction: t });

      let rawMaterialReconItems = await RawMaterialReconItem.findAll({ 
        where: { raw_material_recon_id: req.params.id}, 
        // attributes: ['raw_material_recon_id', 'item_person', 'email_id', 'mobile'], 
        raw: true 
      });

      // rawMaterialReconItems = rawMaterialReconItems.map(rawMaterialReconItem => {
      //   // rawMaterialReconItem.id = null;
      //   delete rawMaterialReconItem.id;
      //   rawMaterialReconItem.raw_material_recon_id = rawMaterialRecon.id;
      //   return rawMaterialReconItem;
      // });

      // await RawMaterialReconItem.bulkCreate(rawMaterialReconItems, { transaction: t });
      
      for (let rawMaterialReconItem of rawMaterialReconItems) {
        delete rawMaterialReconItem.id;
        rawMaterialReconItem.raw_material_recon_id = rawMaterialRecon.id;
        rawMaterialReconItem = await RawMaterialRecon.build({
          ...rawMaterialReconItem
        });
        await rawMaterialReconItem.save({ transaction: t });
      }

      // const error = await rawMaterialRecon.validateData();
      // if (error) {
      //   return res.status(422).json({
      //     message: "Invalid inputs passed, please check your data.",
      //     error: error
      //   });
      // }
    } else {
      await RawMaterialReconItem.destroy({ where: { raw_material_recon_id: req.params.id }, transaction: t });
      await RawMaterialRecon.destroy({ where: { id: req.params.id }, transaction: t });
    }

    await t.commit();
    
    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Deleting Raw Material Recon failed!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Deleting Raw Material Recon failed!";
    next(error, req, res);
  }
};