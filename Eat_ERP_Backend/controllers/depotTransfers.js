import { Op, where } from 'sequelize';
import sequelize from '../lib/database.js';

import DepotTransfer, {getRawMaterialBarcodes, getDepotTransferMasterData} from '../models/depotTransfer.js';
import DepotTransferItem from '../models/depotTransferItem.js';
import Depot from '../models/depot.js';
import RawMaterial from '../models/rawMaterial.js';
import User from '../models/user.js';
import Stock from '../models/stock.js';
import ProductionTransfer from '../models/productionTransfer.js';
import Production, { getBoxBarcodes } from '../models/production.js';
import ComboBoxItem from '../models/comboBoxItem.js';
import DepotTransferCombo from '../models/depotTransferCombo.js';
import ComboBox from '../models/comboBox.js';
import { availableStock } from '../lib/availableStock.js';

export const getMasterData = async (req, res, next) => {
  try {
    const masterData = await getDepotTransferMasterData(null, req);

    if (masterData instanceof Error) {
      throw masterData;
    }

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
    const type = req.params.type ? req.params.type : 'Raw Material';
    const item_id = req.params.item_id ? +req.params.item_id : 0;

    let barcodes = [];
    if (type === 'Box') {
      barcodes = await getBoxBarcodes(item_id);
    } else if (type === 'Combo Box'){
      barcodes = [{
        batch_id_as_per_fssai: "NA",
        "productionAllocations.id": 0
      }]
    } else {
      barcodes = await getRawMaterialBarcodes(item_id);
    }

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

export const getRawMaterialStock = async (req, res, next) => {
  try {
    const depot_id = req.params.depot_id ? +req.params.depot_id : 0;
    const raw_material_id = req.params.item_id ? +req.params.item_id : 0;

    // const stock = await Stock.getDepotTotalStock(depot_id, raw_material_id);

    const {totalStock} = await availableStock(raw_material_id, depot_id);

    return res.status(200).json({ stock: totalStock, totalStock });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Raw Material Stock failed!",
    //   error: JSON.stringify(error, Object.getOwnPropertyNames(error))
    // });
      
    res.statusCode = 500;
    res.message = "Fetching Raw Material Stock failed!";
    next(error, req, res);
  }
};

export const createDepotTransfer = async (req, res, next) => {
  let t;
  let depotTransfer;
  
  try {
    depotTransfer = await DepotTransfer.build({
      status: 'Pending',
      created_by: req.userData.userId,
      created_on: new Date().toISOString(),
      modified_by: req.userData.userId,
      modified_on: new Date().toISOString()
    });

    // console.log(req.body);

    depotTransfer.getRequestData(req);
    
    let error = await depotTransfer.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }
    
    const items = depotTransfer.getDepotTransferItems(req.body);
    
    if (items.length === 0) {
      return res.status(422).json({
        message: "Please insert atleast one Item."
      });
    }

    const depotTransferItems = [];
    const depotTransferCombos = [];
    for(const item of items) {
      if(item.type === 'Combo Box'){
        const boxes = await ComboBoxItem.findAll({
          where:{combo_box_id:item.item_id}
        });

        const combo = await DepotTransferCombo.build({
          "combo_box_id": item.item_id,
          "qty": item.qty,
        })

        depotTransferCombos.push(combo);

        for(const box of boxes){
          const depotTransferItem = await DepotTransferItem.build({
              "type": "Box",
              "item_id": box.item_id,
              "combo_box_id": item.item_id,
              "qty": item.qty * box.qty,
              "stockQty": item.stockQty,
              "barcode": item.barcode,
              "expiry_date": item.expiry_date
          });
          // depotTransferItem.getRequestData(item);
          error = await depotTransferItem.validateData();
          if (error) {
            return res.status(422).json({
              message: "Invalid inputs passed, please check your data.",
              error: error
            });
          }
          await depotTransferItem.setItemDetails();
          depotTransferItems.push(depotTransferItem);  
        }

      }else{
        const depotTransferItem = await DepotTransferItem.build({
          ...item
        });
        // depotTransferItem.getRequestData(item);
        error = await depotTransferItem.validateData();
        if (error) {
          return res.status(422).json({
            message: "Invalid inputs passed, please check your data.",
            error: error
          });
        }
        await depotTransferItem.setItemDetails();
        depotTransferItems.push(depotTransferItem);
      }
    }
    
    t = await sequelize.transaction();

    await depotTransfer.setDetails(depotTransferItems);

    await depotTransfer.save({ transaction: t });

    
    for(const depotTransferItem of depotTransferItems) {
      depotTransferItem.depot_transfer_id = depotTransfer.id;
      await depotTransferItem.save({ transaction: t });
    }

    for(const combo of depotTransferCombos) {
      combo.depot_transfer_id = depotTransfer.id;
      await combo.save({ transaction: t });
    }

    await t.commit();
    
    // depotTransfer = await DepotTransfer.findByPk(depotTransfer.id, { 
    //   include: [{ 
    //       model: DepotTransferItem , 
    //       as: "depotTransferItems", 
    //       include: [{ model: RawMaterial, as: "raw_material", attributes: ["id", "rm_name"]}] 
    //     }, 
    //     "depot"
    //   ] 
    // });

    // // t = await sequelize.transaction();
    // await Stock.destroy({ where: { stock_type: 'Depot Transfer', depot_transfer_id: depotTransfer.id }});
    // let dataArray = Stock.setStockDetails('Depot Transfer', depotTransfer, t, req);
    // Stock.bulkCreate(dataArray);
    // // await t.commit();
    // // error = await Stock.setStockDetails('Depot Transfer', depotTransfer, session, req);
    // // if (error) throw error;

    return res.status(200).json({
      message: "Depot Transfer added successfully.",
      depotTransfer: depotTransfer
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Adding a Depot Transfer failed!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Adding a Depot Transfer failed!";
    next(error, req, res);
  }
};

export const updateDepotTransfer = async (req, res, next) => {
  let t;

  try {
    let depotTransfer = await DepotTransfer.findByPk(req.params.id);
    if (!depotTransfer) {
      return res.status(404).json({message: "Depot Transfer not found!"});
    }

    let blUpdate = false;
    if (depotTransfer.status.trim().toUpperCase() === 'APPROVED') {
      depotTransfer = await DepotTransfer.build({
        status: 'Pending',
        created_by: req.userData.userId,
        created_on: new Date().toISOString(),
        modified_by: req.userData.userId,
        modified_on: new Date().toISOString()
      });
  
      depotTransfer.getRequestData(req);

      depotTransfer.ref_id = req.params.id;
    } else {
      depotTransfer.getRequestData(req);
      depotTransfer.status = 'Pending';
      depotTransfer.modified_by = req.userData.userId;
      depotTransfer.modified_on = new Date().toISOString();
      blUpdate = true;
    }

    let error = await depotTransfer.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    const items = depotTransfer.getDepotTransferItems(req.body);
    
    if (items.length === 0) {
      return res.status(422).json({
        message: "Please insert atleast one Item."
      });
    }

    const depotTransferItems = [];
    const depotTransferCombos = [];
    for(const item of items) {

      if(item.type === 'Combo Box'){
        const boxes = await ComboBoxItem.findAll({
          where:{combo_box_id:item.item_id}
        });

        const combo = await DepotTransferCombo.build({
          "combo_box_id": item.item_id,
          "qty": item.qty,
        })

        depotTransferCombos.push(combo);

        for(const box of boxes){
          const depotTransferItem = await DepotTransferItem.build({
              "type": "Box",
              "item_id": box.item_id,
              "combo_box_id": item.item_id,
              "qty": item.qty * box.qty,
              "stockQty": item.stockQty,
              "barcode": item.barcode,
              "expiry_date": item.expiry_date
          });
          // depotTransferItem.getRequestData(item);
          error = await depotTransferItem.validateData();
          if (error) {
            return res.status(422).json({
              message: "Invalid inputs passed, please check your data.",
              error: error
            });
          }
          await depotTransferItem.setItemDetails();
          depotTransferItems.push(depotTransferItem);  
        }

      }else{
        const depotTransferItem = await DepotTransferItem.build({
          ...item
        });
        // depotTransferItem.getRequestData(item);
        error = await depotTransferItem.validateData();
        if (error) {
          return res.status(422).json({
            message: "Invalid inputs passed, please check your data.",
            error: error
          });
        }
        await depotTransferItem.setItemDetails();
        depotTransferItems.push(depotTransferItem);
      }
    }
    
    t = await sequelize.transaction();

    await depotTransfer.setDetails(depotTransferItems);

    await depotTransfer.save({ transaction: t });

    if (blUpdate === true) {
      await DepotTransferItem.destroy({ where: { depot_transfer_id: depotTransfer.id }, transaction: t });
      await DepotTransferCombo.destroy({ where: { depot_transfer_id: depotTransfer.id }, transaction: t });
    }
    
    for(const depotTransferItem of depotTransferItems) {
      depotTransferItem.depot_transfer_id = depotTransfer.id;
      await depotTransferItem.save({ transaction: t });
    }

    for(const combo of depotTransferCombos) {
      combo.depot_transfer_id = depotTransfer.id;
      await combo.save({ transaction: t });
    }

    await t.commit();

    // depotTransfer = await DepotTransfer.findByPk(depotTransfer.id, { 
    //   include: [{ 
    //       model: DepotTransferItem , 
    //       as: "depotTransferItems", 
    //       include: [{ model: RawMaterial, as: "raw_material", attributes: ["id", "rm_name"]}] 
    //     }, 
    //     "depot"
    //   ] 
    // });

    // // t = await sequelize.transaction();
    // await Stock.destroy({ where: { stock_type: 'Depot Transfer', depot_transfer_id: depotTransfer.id }});
    // let dataArray = Stock.setStockDetails('Depot Transfer', depotTransfer, t, req);
    // Stock.bulkCreate(dataArray);
    // // await t.commit();
    // // error = await Stock.setStockDetails('Depot Transfer', depotTransfer, session, req);
    // // if (error) throw error;

    res.status(200).json({ message: "Update successful!", depotTransfer: depotTransfer });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't udpate depotTransfer!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't update Depot Transfer!";
    next(error, req, res);
  }
};

export const approveDepotTransfer = async (req, res, next) => {
  let t;

  try {
    let depot_transfer_id = req.params.id;
    let depotTransfer = await DepotTransfer.findByPk(depot_transfer_id);
    
    if (!depotTransfer) {
      return res.status(404).json({
        message: "Depot Transfer not found!"
      });
    }

    // if (depotTransfer.modified_by === req.userData.userId) {
    //   return res.status(422).json({ 
    //     message: `You can't approve this DepotTransfer.`, 
    //     error : { 
    //       errors : { 
    //         vendorDate: { message: `You can't approve this DepotTransfer.` } 
    //       } 
    //     }
    //   });
    // }

    // console.log(depotTransfer);

    if (depotTransfer.status.trim().toUpperCase() !== 'PENDING' && depotTransfer.status.trim().toUpperCase() !== 'DELETED') {
      return res.status(422).json({ 
        message: `Depot Transfer status should be pending or deleted.`, 
        error : { 
          errors : { 
            vendorDate: { message: `Depot Transfer status should be pending or deleted.` } 
          } 
        }
      });
    }

    depotTransfer.approve(req);

    // console.log(error);
    // depotTransfer.approvedBy = req.userData.userId;
    // depotTransfer.approvedAt = new Date().toISOString();

    const error = await depotTransfer.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    // try {
      t = await sequelize.transaction();
      
      if (!depotTransfer.ref_id) {
        await depotTransfer.save({ transaction: t });
      } else {
        // const obj = JSON.parse(JSON.stringify(depotTransfer));
        // delete obj._id;
        // obj.ref_id = null;

        const ref_id = depotTransfer.ref_id;
        depot_transfer_id = depotTransfer.ref_id;

        const obj = depotTransfer.dataValues;
        delete obj.id;
        obj.ref_id = null;

        // console.log(obj);
        // console.log(ref_id);
        // console.log(req.params.id);

        await DepotTransfer.destroy({ where: {id: req.params.id }}, { transaction: t });

        // depotTransfer = await DepotTransfer.findByIdAndUpdate(ref_id, obj, { session: session, new: true });

        await DepotTransfer.update(obj, { where: { id: ref_id } }, { transaction: t });

        await DepotTransferItem.destroy({ where: {depot_transfer_id: ref_id }}, { transaction: t });

        await DepotTransferItem.update({ depot_transfer_id: ref_id }, { where: { depot_transfer_id: req.params.id }}, { transaction: t });

        await DepotTransferCombo.destroy({ where: {depot_transfer_id: ref_id }}, { transaction: t });

        await DepotTransferCombo.update({ depot_transfer_id: ref_id }, { where: { depot_transfer_id: req.params.id }}, { transaction: t });

        // originalDepotTransfer = await DepotTransfer.findById(depotTransfer.ref_id);
        // originalDepotTransfer.overwrite(depotTransfer);
        // originalDepotTransfer.ref_id = null;
        // originalDepotTransfer.vendorState = depotTransfer.vendorState;
        // // console.log(originalDepotTransfer);
        // await originalDepotTransfer.save({ session });
      }

      if (depotTransfer.status && depotTransfer.status.trim().toUpperCase() === 'APPROVED') {
        await ProductionTransfer.update({ status: 'Approved' }, { where: { depot_transfer_id: depot_transfer_id } }, { transaction: t });
      }

      // throw new Error('test');

      await t.commit();

      // if (depotTransfer.status && depotTransfer.status.trim().toUpperCase() === 'APPROVED') {
      //   const production = await Production.findOne({
      //     where: { depot_transfer_id: depot_transfer_id },  
      //     include: [
      //       { model: ProductionTransfer, as: "productionTransfers" }
      //     ]
      //   });
      //   if (production) {
      //     production.setTransferPending();
      //     production.save();
      //   }
      // }
      
      depotTransfer = await DepotTransfer.findByPk(depot_transfer_id, {
        include: [
          { model: Depot, as: "depot_out", attributes: ["id", "depot_name", "state"] }, 
          { model: Depot, as: "depot_in", attributes: ["id", "depot_name", "state"] }, 
          { 
            model: DepotTransferItem, 
            as: "depotTransferItems", 
            include: { model: RawMaterial, as: "raw_material", attributes: ["id", "rm_name"] },
          }
        ]
      });

      await Stock.destroy({ where: { stock_type: 'Depot Transfer', depot_transfer_id: depot_transfer_id }});
      let dataArray = Stock.setStockDetails('Depot Transfer', depotTransfer, t, req);
      Stock.bulkCreate(dataArray);

    // } catch (error) { 
    //     await session.abortTransaction();
    // }
    
    res.status(200).json({ message: "Approve successful!" });
  } catch (error) {
    // console.log(error);

    if (t && (!t.finished || (t.finished && t.finished !== 'commit'))) {
      await t.rollback();
    }

    // res.status(500).json({
    //   message: 'Approving Depot Transfer failed! Error - ' + (error.message ? error.message : '')
    // });
    
    res.statusCode = 500;
    res.message = "Approving Depot Transfer failed!";
    next(error, req, res);
  }
};

export const rejectDepotTransfer = async (req, res, next) => {
  try {
    let depot_transfer_id = req.params.id;
    let depotTransfer = await DepotTransfer.findByPk(depot_transfer_id);

    if (!depotTransfer) {
      return res.status(404).json({
        message: "Depot Transfer not found!"
      });
    }

    if (depotTransfer.modified_by.toString() === req.userData.userId.toString()) {
      return res.status(422).json({ 
        message: `You can't reject this Depot Transfer.`, 
        error : { 
          errors : { 
            vendorDate: { message: `You can't reject this Depot Transfer.` } 
          } 
        }
      });
    }

    if (depotTransfer.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({ 
        message: `Depot Transfer is already approved.`, 
        error : { 
          errors : { 
            vendorDate: { message: `Depot Transfer is already approved.` } 
          } 
        }
      });
    }

    depotTransfer.reject(req);
    await depotTransfer.save();
    
    if ((depotTransfer.status && depotTransfer.status.trim().toUpperCase() === 'REJECTED') && depotTransfer.production_id) {
      await ProductionTransfer.update({ status: 'Rejected' }, { where: { depot_transfer_id: depot_transfer_id } });
      const production = await Production.findOne({
        where: { depot_transfer_id: depot_transfer_id },  
        include: [
          { model: ProductionTransfer, as: "productionTransfers" }
        ]
      });
      if (production) {
        production.setTransferPending();
        production.save();
      }
    }

    res.status(200).json({ message: "Reject successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Rejecting Depot Transfer failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Rejecting Depot Transfer failed!";
    next(error, req, res);
  }
};

export const getDepotTransfers = async (req, res, next) => {
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
          {'$depot_out_name$': { [Op.like]: `%${query}%` }}, 
          {'$depot_in_name$': { [Op.like]: `%${query}%` }}, 
          {'$item_names$': { [Op.like]: `%${query}%` }}, 
          {'$chalan_no$': { [Op.like]: `%${query}%` }}
        ]
      };

      condition['where'] = searchCondition;
    } else {
      // condition['where'] = {};
    }

    // condition['include'] = [
    //   { model: PurchaseOrder, as: 'purchase_order', attributes: ['po_no'] },
    //   { model: Depot, as: 'depot', attributes: ['depot_name'] }, 
    //   { model: Vendor, as: 'vendor', attributes: ['vendor_name'] }, 
    //   { model: DepotTransferItem, InItems', attributes: ['item_name'] }
    // ];

    // let totalCount = 0;
    const statusCount = {
      pending: 0,
      approved: 0,
      rejected: 0,
      inActive: 0
    };
    const data = await DepotTransfer.findAll(
      { 
        ...condition, 
        attributes: [
          'status', 'chalan_no', 'depot_Out_name', 'depot_in_name', 'item_names', 
          [sequelize.fn('COUNT', sequelize.col('status')), 'count']
        ], 
        group:['status', 'chalan_no', 'depot_Out_name', 'depot_in_name', 'item_names'], 
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

    const { count, rows } = await DepotTransfer.findAndCountAll(condition);
    // const rows = 

    res.status(200).json({
      message: "Depot Transfers fetched successfully!",
      // totalCount: totalCount,
      total: count,
      statusCount: statusCount,
      rows: rows
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Depot Transfers failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Depot Transfers failed!";
    next(error, req, res);
  }
};

export const getDepotTransfer = async (req, res, next) => {
  try {
    const depotTransfer = await DepotTransfer.findByPk(req.params.id, { 
      include: [{ 
          model: DepotTransferItem , 
          as: "depotTransferItems", 
          include: [{ model: RawMaterial, as: "raw_material", attributes: ["id", "rm_name"]}] 
        },
        { model: Depot, as: "depot_out", attributes: ['id', 'depot_name', 'address', 'city', 'pincode', 'state', 'country', 'gst_no'] },
        { model: Depot, as: "depot_in", attributes: ['id', 'depot_name', 'address', 'city', 'pincode', 'state', 'country', 'gst_no'] },
        { model: User, as: "created_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
        { model: User, as: "modified_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
        { model: User, as: "approved_by_user", attributes: ['id', 'first_name', 'last_name'] }
      ] 
    });
    if (!depotTransfer) {
      return res.status(404).json({ message: "Depot Transfer not found!" });
    }
    
    // Check if there is any combo
    const combos = await DepotTransferCombo.findAll({
      where:{
        depot_transfer_id:req.params.id,
      },
      include: [
        {
          model: ComboBox,
          as: 'comboBox',
          attributes: ['id', 'combo_box_name']
        }
      ],
    });


    const roleDetails = req.userData.roleDetails;

    // console.log(roleDetails);

    const action = {
      update: false,
      delete: false,
      approve: false
    };

    // console.log(depotTransfer.modified_by.toString());
    // console.log(req.userData.userId);
    
    // if (depotTransfer.isFreezed) {
    //   if (depotTransfer.status.trim().toUpperCase() !== 'APPROVED' && depotTransfer.status.trim().toUpperCase() !== 'INACTIVE') {
    //     if (roleDetails.r_edit) {
    //       action.update = true;
    //     }
    //     if (roleDetails.r_delete) {
    //       action.delete = true;
    //     }
    //   }
    // } else {
      if (!roleDetails.r_approvals || 
            (depotTransfer.status.trim().toUpperCase() !== 'PENDING' && 
            depotTransfer.status.trim().toUpperCase() !== 'DELETED') || 
            depotTransfer.modified_by.toString() === req.userData.userId.toString()) //req.userData.userId.toString()
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

    const masterData = await getDepotTransferMasterData(depotTransfer, req);
    
    const depotTransferItemBarcodes = [];
    const depotTransferItemStocks = [];
    const depot_id = depotTransfer.depot_out_id ? +depotTransfer.depot_out_id : 0;
    for (const depotTransferItem of depotTransfer.depotTransferItems) {
      if (depotTransferItem.item_id && !depotTransferItem.combo_box_id) {
        if (depotTransferItem.type==='Raw Material') {
          const barcodes = await getRawMaterialBarcodes(depotTransferItem.item_id);
          depotTransferItemBarcodes.push(barcodes);

          const {totalStock} = await availableStock(depotTransferItem.item_id, depot_id);
          // const stock = await Stock.getDepotTotalStock(depot_id, depotTransferItem.item_id);
          depotTransferItemStocks.push(totalStock);
        } else {
          const barcodes = await getBoxBarcodes(depotTransferItem.item_id);
          depotTransferItemBarcodes.push(barcodes);

          depotTransferItemStocks.push(0);
        }
      }
    }

    const updatedDepotTransferItems = []
    
    const boxItem = depotTransfer.depotTransferItems.filter((depotTransferItem)=> depotTransferItem.combo_box_id === null)
    updatedDepotTransferItems.push(...boxItem);
    
    if(combos){
      const comboBoxItem = combos.map(combo => {
        const { comboBox} = combo // destructure comboBox out
        depotTransferItemBarcodes.push([{
            "barcode": "NA",
            "expiry_date": "",
            "raw_material_in.id": null
          }]);
        depotTransferItemStocks.push(0);
        
        return {
          id: combo.id,
          depot_transfer_id: combo.depot_transfer_id,
          type: "Combo Box",
          item_id: combo.combo_box_id,
          item_name: comboBox.combo_box_name,
          qty: combo.qty,
          barcode: "NA"
        }
      });

      updatedDepotTransferItems.push(...comboBoxItem);
    }

    const depotTransferJSON = depotTransfer.toJSON();
    depotTransferJSON.depotTransferItems = updatedDepotTransferItems;
    
    return res.status(200).json({ 
      message: "Depot Transfer fetched successfully!",
      action, 
      depotTransfer:depotTransferJSON, 
      updatedDepotTransferItems,
      masterData,
      depotTransferItemBarcodes,
      depotTransferItemStocks
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Depot Transfer failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Depot Transfer failed!";
    next(error, req, res);
  }
};

export const deleteDepotTransfer = async (req, res, next) => {
  let t;

  try {
    let depotTransfer = await DepotTransfer.findByPk(req.params.id, {raw: true});
    if (!depotTransfer) {
      return res.status(404).json({ message: "Depot Transfer not found!" });
    }

    t = await sequelize.transaction();

    if (depotTransfer.status.trim().toUpperCase() === 'APPROVED') {
      depotTransfer.id = null;
      depotTransfer.status = 'Deleted';
      depotTransfer.ref_id = req.params.id;
      
      depotTransfer = await DepotTransfer.build({
        ...depotTransfer
      });

      await depotTransfer.save({ transaction: t });

      let depotTransferItems = await DepotTransferItem.findAll({ 
        where: { depot_transfer_id: req.params.id}, 
        // attributes: ['depot_transfer_id', 'item_person', 'email_id', 'mobile'], 
        raw: true 
      });

      // depotTransferItems = depotTransferItems.map(depotTransferItem => {
      //   // depotTransferItem.id = null;
      //   delete depotTransferItem.id;
      //   depotTransferItem.depot_transfer_id = depotTransfer.id;
      //   return depotTransferItem;
      // });

      // await DepotTransferItem.bulkCreate(depotTransferItems, { transaction: t });
      
      for (let depotTransferItem of depotTransferItems) {
        delete depotTransferItem.id;
        depotTransferItem.depot_transfer_id = depotTransfer.id;
        depotTransferItem = await DepotTransfer.build({
          ...depotTransferItem
        });
        await depotTransferItem.save({ transaction: t });
      }

      // const error = await depotTransfer.validateData();
      // if (error) {
      //   return res.status(422).json({
      //     message: "Invalid inputs passed, please check your data.",
      //     error: error
      //   });
      // }
    } else {
      await DepotTransferItem.destroy({ where: { depot_transfer_id: req.params.id }, transaction: t });
      await DepotTransfer.destroy({ where: { id: req.params.id }, transaction: t });
      await DepotTransferCombo.destroy({ where: { depot_transfer_id: req.params.id }, transaction: t });
    }

    await t.commit();
    
    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Deleting Depot Transfer failed!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Deleting Depot Transfer failed!";
    next(error, req, res);
  }
};