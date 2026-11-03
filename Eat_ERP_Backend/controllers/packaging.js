import { Op, Sequelize } from 'sequelize';
import { getSeries } from '../models/series.js';
import sequelize from '../lib/database.js';
import { getDateString, round } from '../lib/common.js';

import Packaging from '../models/packaging.js';
import Depot from '../models/depot.js';
import Product from '../models/product.js';
import User from '../models/user.js';
import BatchProcessing from '../models/batchProcessing.js';
import BatchRawMaterial from '../models/batchRawMaterial.js';
import Stock from '../models/stock.js';
import Recipe from '../models/recipe.js';
import RecipeVariation from '../models/recipeVariation.js';
import Box from '../models/box.js';
// import PackagingAllocation from '../models/packagingAllocation.js';
// import BatchVariation from '../models/batchVariation.js';
import DepotTransfer from '../models/depotTransfer.js';
// import PackagingTransfer from '../models/packagingTransfer.js';
// import PackagingReturn from '../models/packagingReturn.js';
import DepotTransferItem from '../models/depotTransferItem.js';
import PackagingItem from '../models/packagingItem.js';
// import PackagingRetain from '../models/packagingRetain.js';
// import PackagingWaste from '../models/packagingWaste.js';
import PackagingItemRequest from '../models/packagingItemRequest.js';
// import RecipeDetail from '../models/recipeDetail.js';
import RawMaterial from '../models/rawMaterial.js';
import PackagingReturn from '../models/packagingReturn.js';
// import RawMaterialInOut from '../models/rawMaterialInOut.js';
// import RawMaterialInOutItem from '../models/rawMaterialInOutItem.js';

export const getDepotList = async (req, res, next) => {
  try {
    const data = await Packaging.getPackagingDepotList();

    return res.status(200).json({ data });
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

export const getMasterData = async (req, res, next) => {
  try {
    const masterData = await Packaging.getPackagingMasterData(null, req);

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

export const getPackagingStock = async (req, res, next) => {
  try {
    if (!req.params.manufacturer_id) {
      return res.status(404).json({ message: "Manufacturer not found!" });
    }
    if (!req.params.product_id) {
      return res.status(404).json({ message: "Product not found!" });
    }
    const stock = await Packaging.getDepotTotalStock(req.params.manufacturer_id, req.params.product_id);

    return res.status(200).json({ stock });
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

export const getManufacturerTotalStock = async (req, res, next) => {
  try {
    if (!req.params.packaging_id) {
      return res.status(404).json({ message: "Packaging Id not found!" });
    }
    if (!req.params.product_id) {
      return res.status(404).json({ message: "Product Id not found!" });
    }
    const packaging = await Packaging.findByPk(req.params.packaging_id, { 
      include: [
        { model: BatchProcessing, as: "packagingBatchProcessing" },
        { model: DepotTransfer, as: "packagingDepotTransfer" }
      ]
    });
    const stock = await packaging.getManufacturerTotalStock(req.params.product_id);

    return res.status(200).json({ stock });
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

export const getPackagings = async (req, res, next) => {
  try {
    let status = 'Pending';
    let pageSize = 10;
    let pageIndex = 0;
    let query = '';
    let sort = { key: 'modified_on', order: 'desc' };
    let depot_id = 0;

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

      depot_id = req.query.depot_id ? +req.query.depot_id : 0;
    }

    let condition = {};
    let depotCondition = { 
      manufacturer_id: depot_id, 
      depot_id: { [Op.in]: req.userData.depotIds }, 
      [Op.or]: {date_of_processing: { [Op.lte]: getDateString(new Date()) }, check_batch_qty: 1} 
    };
    let searchCondition = {};

    if (query) {
      searchCondition = {
        [Op.or]: [
          // { 'batch_id_as_per_fssai': {[Op.like]: `%${query}%` } }, 
          Sequelize.literal("`manufacturer`.`depot_name` LIKE '%"+query+"%'"), 
          Sequelize.literal("`depot`.`depot_name` LIKE '%"+query+"%'"), 
          // Sequelize.literal("`product`.`product_name` LIKE '%"+query+"%'"), 
          // Sequelize.literal("`product`.`short_name` LIKE '%"+query+"%'")
        ]
      };

      condition['where'] = {
        [Op.and]: [
          { ...searchCondition }, 
          depotCondition
        ]
      };
    } else {
      condition['where'] = {
        [Op.and]: [
          depotCondition
        ]
      };
    }

    condition['include'] = [
      { model: Depot, as: 'manufacturer', attributes: ['depot_name'] }, 
      { model: Depot, as: 'depot', attributes: ['depot_name'] }, 
      // { model: Product, as: 'product', attributes: ['product_name', 'short_name'] }
    ];

    // let totalCount = 0;
    const statusCount = {
      drafted: 0,
      inProcess: 0,
      workInProgress: 0,
      allocationPending: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      inActive: 0,
      waiting: 0,
      transferPending: 0,
      transferred: 0
    };
    const data = await Packaging.findAll(
      { 
        // where: { manufacturer_id: depot_id, depot_id: { [Op.ne]: null } },
        ...condition, 
        attributes: [
          'packaging_details.status', 
          'packaging_details.transfer_pending', 
          [sequelize.fn('COUNT', sequelize.col('packaging_details.status')), 'count']
        ], 
        group:['packaging_details.status', 'packaging_details.transfer_pending'], 
        raw: true
      }
    );
    // console.log(data);
    for (const item of data) {
      // console.log(item.status);
      // console.log(item.count);
      if (item.status.trim().toUpperCase() === "DRAFTED") {
        statusCount.drafted = statusCount.drafted + parseInt(item.count);
        // totalCount = parseInt(item.count);
      }
      if (item.status.trim().toUpperCase() === "INPROCESS") {
        statusCount.inProcess = statusCount.inProcess + parseInt(item.count);
        // totalCount = parseInt(item.count);
      }
      else if (item.status.trim().toUpperCase() === "WORK_IN_PROGRESS") {
        statusCount.workInProgress = statusCount.workInProgress + parseInt(item.count);
        // totalCount = parseInt(item.count);
      }
      else if (item.status.trim().toUpperCase() === "ALLOCATION_PENDING") {
        statusCount.allocationPending = statusCount.allocationPending + parseInt(item.count);
        // totalCount = parseInt(item.count);
      }
      else if (item.status.trim().toUpperCase() === "PENDING" || item.status.trim().toUpperCase() === "DELETED") {
        statusCount.pending = statusCount.pending + parseInt(item.count);
        // totalCount = parseInt(item.count);
      }
      else if (item.status.trim().toUpperCase() === "APPROVED") {
        statusCount.approved = statusCount.approved + parseInt(item.count);
        // totalCount = parseInt(item.count);
      }
      else if (item.status.trim().toUpperCase() === "REJECTED") {
        statusCount.rejected = statusCount.rejected + parseInt(item.count);
        // totalCount = parseInt(item.count);
      }
      else if (item.status.trim().toUpperCase() === "INACTIVE") {
        statusCount.inActive = statusCount.inActive + parseInt(item.count);
        // totalCount = parseInt(item.count);
      }
      else if (item.status.trim().toUpperCase() === "WAITING") {
        statusCount.waiting = statusCount.waiting + parseInt(item.count);
        // totalCount = parseInt(item.count);
      }

      if (item.transfer_pending) {
        statusCount.transferPending = statusCount.transferPending + parseInt(item.count);
      }
    }
    
    let statusCondition = { status: 'Pending' };
    if (status) {
      if (status.trim().toUpperCase() === 'PENDING') {
        statusCondition = { status: {[Op.or] : ['Pending', 'Deleted']} };
      } else if (status.trim().toUpperCase() === 'TRANSFER_PENDING') {
        statusCondition = { transfer_pending : 1 };
      } else {
        statusCondition = { status: status };
      }
    }

    if (query) {
      condition['where'] = {
        [Op.and]: [
          searchCondition,
          statusCondition,
          depotCondition
        ]
      };
    } else {
      condition['where'] = {
        [Op.and]: [
          statusCondition,
          depotCondition
        ]
      };
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

    const { count, rows } = await Packaging.findAndCountAll(condition);
    // const rows = 

    res.status(200).json({
      message: "Packagings fetched successfully!",
      // totalCount: totalCount,
      total: count,
      statusCount: statusCount,
      rows: rows
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Packagings failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Packagings failed!";
    next(error, req, res);
  }
};

export const createPackaging = async (req, res, next) => {
  let t;
  // let batchProcessing = {};
  
  try {
    const packaging = await Packaging.build({
      requested_kg: 0,
      production_stock_kg: 0,
      store_requested_kg: 0,
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
      raw_material_request: 0,
      transfer: 0,
      return_raw_material: 0,
      keep_in_production: 0,
      waste_raw_material: 0,
      receive: 0,
      no_of_batch: 0,
      request_unit: 'Kg',
      p_type: 'Essentials',
      check_batch_qty: 0,
      transfer_pending: 0,
      production_day: 'Today',
      status: 'InProcess',
      date_of_processing: new Date().toISOString(),
      created_by: req.userData.userId,
      created_on: new Date().toISOString(),
      modified_by: req.userData.userId,
      modified_on: new Date().toISOString()
    });

    packaging.getRequestData(req);
    
    let error = await packaging.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    // await packaging.setBatchNo();

    // await packaging.setNoOfBatches();

    const itemRequests = await packaging.getItemRequests(req);
    
    const packagingItemRequests = [];
    for(const item of itemRequests) {
      const packagingItemRequest = await PackagingItemRequest.build({
        packaging_id: 0
      });
      packagingItemRequest.setRequestData(item);
      error = await packagingItemRequest.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }
      packagingItemRequests.push(packagingItemRequest);
    }

    packaging.setPackagingRequestDetails(packagingItemRequests);

    // if (packaging.p_type.trim().toUpperCase() === 'ESSENTIALS') {
    //   await packaging.setPackagingTotalStock();
    // }
    
    t = await sequelize.transaction();

    // if (!packaging.p_id) {
    //   const series = await getSeries(req, 'Packaging');
    //   packaging.getPackagingNo(series.series);
    //   await series.save({ transaction: t });
    // }

    await packaging.save({ transaction: t });

    for (const packagingItemRequest of packagingItemRequests) {
      packagingItemRequest.packaging_id = packaging.id;
      await packagingItemRequest.save({ transaction: t });
    }

    // if (packaging.use_production_stock) {
    //   batchProcessing = await BatchProcessing.setPackagingData(packaging);

    //   batchProcessing.status = 'Approved';
    //   await batchProcessing.save({ transaction: t });
      
    //   const depotStock = await Packaging.getDepotStock(packaging.manufacturer_id, packaging.product_id, packaging.requested_kg);
    //   for (const stock of depotStock) {
    //     if (stock.qty > 0) {
    //       const batchRawMaterial = await BatchRawMaterial.build({
    //         batch_processing_id: batchProcessing.id,
    //         raw_material_id: stock.raw_material_id,
    //         batch_qty: stock.batch_qty,
    //         qty: stock.qty,
    //         barcode: stock.barcode,
    //         expiry_date: stock.expiry_date
    //       });
        
    //       await batchRawMaterial.save({ transaction: t });
    //     }
    //   }
    // }

    await t.commit();

    // if (packaging.use_production_stock) {
    //   batchProcessing = await BatchProcessing.findByPk(batchProcessing.id, {
    //     include: [
    //       { model: BatchRawMaterial, as: "batchProcessingItems" }
    //     ]
    //   });

    //   // t = await sequelize.transaction();
    //   // await Stock.destroy({ where: { stock_type: 'Batch Processing', batch_processing_id: batchProcessing.id }, transaction: t });
    //   let dataArray = Stock.setStockDetails('Batch Processing', batchProcessing, t, req);
    //   if (dataArray && dataArray.length > 0) {
    //     await Stock.bulkCreate(dataArray);
    //   }
    //   // await t.commit();
    //   // error = await Stock.setStockDetails('Raw Material In', rawMaterialIn, session, req);
    //   // if (error) throw error;
    // }
    
    return res.status(201).json({
      message: "Packaging added successfully",
      packaging: packaging
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Creating a packaging failed!"
    // });

    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Creating a Packaging failed!";
    next(error, req, res);
  }
};

export const updatePackaging = async (req, res, next) => {
  let t;
  // let batchProcessing = {};

  try {
    let packaging = await Packaging.findByPk(req.params.id);
    if (!packaging) {
      return res.status(404).json({message: "Packaging not found!"});
    }

    if (packaging.status.trim().toUpperCase() === 'DRAFTED') {
      packaging.status = 'InProcess';
    }
    
    if (packaging.store_kg > 0 || packaging.output_kg > 0 || packaging.retain_kg > 0 || 
      packaging.return_kg > 0 || packaging.waste_kg > 0) {
      return res.status(422).json({ 
        message: `Raw material, variation or return already allocated for this Packaging.`, 
        error : { 
          errors : { 
            packaging: { message: `Raw material, variation or return already allocated for this Packaging.` } 
          } 
        }
      });
    }
    packaging.getRequestData(req);
    
    let error = await packaging.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    // if (!packaging.batch_id_as_per_fssai) {
    //   await packaging.setBatchNo();
    // }

    // await packaging.setNoOfBatches();

    const itemRequests = await packaging.getItemRequests(req);
    
    const packagingItemRequests = [];
    for(const item of itemRequests) {
      const packagingItemRequest = await PackagingItemRequest.build({
        packaging_id: 0
      });
      packagingItemRequest.setRequestData(item);
      error = await packagingItemRequest.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }
      packagingItemRequests.push(packagingItemRequest);
    }

    packaging.setPackagingRequestDetails(packagingItemRequests);
    
    t = await sequelize.transaction();

    // if (packaging.use_production_stock) {
    //   batchProcessing = await BatchProcessing.setPackagingData(packaging);

    //   await Stock.destroy({ where: { stock_type: 'Batch Processing', batch_processing_id: batchProcessing.id }, transaction: t });
    // } else {
    //   batchProcessing = await BatchProcessing.findOne({ where: { packaging_id: packaging.id } });
    //   if (batchProcessing) {
    //     await BatchRawMaterial.destroy({ where: { batch_processing_id: batchProcessing.id }, transaction: t });
    //     await Stock.destroy({ where: { stock_type: 'Batch Processing', batch_processing_id: batchProcessing.id }, transaction: t });  
    //   }
    // }

    // if (packaging.p_type.trim().toUpperCase() === 'ESSENTIALS') {
    //   await packaging.setPackagingTotalStock();
    // }
    
    // if (!packaging.p_id) {
    //   const series = await getSeries(req, 'Packaging');
    //   packaging.getPackagingNo(series.series);
    //   await series.save({ transaction: t });
    // }

    await packaging.save({ transaction: t });

    await PackagingItemRequest.destroy({ where: {packaging_id: packaging.id} });

    for (const packagingItemRequest of packagingItemRequests) {
      packagingItemRequest.packaging_id = packaging.id;
      await packagingItemRequest.save({ transaction: t });
    }

    // if (packaging.use_production_stock) {
    //   batchProcessing = await BatchProcessing.setPackagingData(packaging);

    //   batchProcessing.status = 'Approved';
    //   await batchProcessing.save({ transaction: t });

    //   await BatchRawMaterial.destroy({ where: { batch_processing_id: batchProcessing.id }, transaction: t });

    //   if (packaging.p_type.trim().toUpperCase() === 'ESSENTIALS') {
    //     const depotStock = await Packaging.getDepotStock(packaging.manufacturer_id, packaging.product_id, packaging.requested_kg);
    //     for (const stock of depotStock) {
    //       if (stock.qty > 0) {
    //         const batchRawMaterial = await BatchRawMaterial.build({
    //           batch_processing_id: batchProcessing.id,
    //           raw_material_id: stock.raw_material_id,
    //           batch_qty: stock.batch_qty,
    //           qty: stock.qty,
    //           barcode: stock.barcode,
    //           expiry_date: stock.expiry_date
    //         });
    //         await batchRawMaterial.save({ transaction: t });
    //       }
    //     }
    //   }
    // }

    await t.commit();

    // if (packaging.use_production_stock && packaging.p_type.trim().toUpperCase() === 'ESSENTIALS') {
    //   batchProcessing = await BatchProcessing.findByPk(batchProcessing.id, {
    //     include: [
    //       { model: BatchRawMaterial, as: "batchProcessingItems" }
    //     ]
    //   });

    //   // t = await sequelize.transaction();
    //   let dataArray = Stock.setStockDetails('Batch Processing', batchProcessing, t, req);
    //   if (dataArray && dataArray.length > 0) {
    //     await Stock.bulkCreate(dataArray);
    //   }
    //   // await t.commit();
    //   // error = await Stock.setStockDetails('Raw Material In', rawMaterialIn, session, req);
    //   // if (error) throw error;
    // }

    res.status(200).json({ message: "Update successful!", packaging: packaging });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't udpate packaging!"
    // });

    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't update Packaging!";
    next(error, req, res);
  }
};

export const getBatchQty = async (req, res, next) => {
  try {
    const packaging = await Packaging.findByPk(req.params.id, { 
      include: [
        { model: Product, as: "product", attributes: ['id', 'product_name', 'short_name'] },
        { model: PackagingItemRequest, as: "packagingItemRequests", include: 'rawMaterial', raw: true }
      ],
      order: [
        [{ model: PackagingItemRequest, as: "packagingItemRequests" }, 'raw_Material_id', 'ASC']
      ]
    });
    if (!packaging) {
      return res.status(404).json({ message: "Packaging not found!" });
    }

    // const product_id = packaging.product_id;
    // let recipe = await Recipe.findOne({ where: { product_id: product_id }});
    // recipe = await Recipe.findByPk(recipe.id, {
    //   include: { 
    //     model: RecipeDetail, as: 'recipeDetails',
    //     required: false,
    //     include: [
    //       { model: RawMaterial, as: "rawMaterial", attributes: ['id', 'rm_name', 'rate', 'tax_per'], raw: true }
    //     ]
    //   }
    // });

    const stocks = await Stock.getManufacturerTotalStock(packaging.manufacturer_id);

    const itemRequests = [];
    for (const packagingItemRequest of packaging.packagingItemRequests) {
      const stocksFound = stocks.filter(stock => stock.raw_material_id === packagingItemRequest.raw_material_id);
      let stockQty = 0;

      for (const stock of stocksFound) {
        stockQty = round(stockQty + parseFloat(stock.stock_qty), 4);
      }

      // let stockQty = 0;
      // stocks.reduce((stockQty, stock) => {
      //   if (stock.raw_material_id === packagingItemRequest.raw_material_id) {
      //     stockQty = round(stockQty + parseFloat(stock.stock_qty), 4);
      //   }
      // }, stockQty);
      
      if (packagingItemRequest.use_production_stock) {
        packagingItemRequest.available_kg = packagingItemRequest.production_stock_kg ? round(parseFloat(packagingItemRequest.production_stock_kg), 4) : 0;
      } else {
        packagingItemRequest.available_kg = stockQty ? stockQty : 0;
      }
      
      packagingItemRequest.requested_kg = round(packagingItemRequest.requested_kg, 4);
      packagingItemRequest.required_kg = round(packagingItemRequest.required_kg, 4);
      itemRequests.push(packagingItemRequest);
    }

    const rawMaterial = await RawMaterial.findAll({ where: { status: 'Approved', material_type: 'Raw Material' } });

    return res.status(200).json({ 
      message: "Allocations fetched successfully!", 
      packaging, 
      itemRequests, 
      rawMaterial
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Packaging failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Allocations failed!";
    next(error, req, res);
  }
};

export const updateBatchQty = async (req, res, next) => {
  let t;
  let error;

  try {
    let packaging = await Packaging.findByPk(req.params.id);
    if (!packaging) {
      return res.status(404).json({message: "Packaging not found!"});
    }

    // if (packaging.modified_by.toString() !== req.userData.userId.toString()) {
    //   return res.status(422).json({ 
    //     message: `You can't submit this Packaging.`, 
    //     error : { 
    //       errors : { 
    //         packaging: { message: `You can't submit this Packaging.` } 
    //       } 
    //     }
    //   });
    // }

    
    if (packaging.status.trim().toUpperCase() === 'DRAFTED') {
      packaging.status = 'InProcess';
    }

    if (packaging.status.trim().toUpperCase() !== 'INPROCESS') {
      return res.status(422).json({ 
        message: `Packaging status should be InProcess.`, 
        error : { 
          errors : { 
            packaging: { message: `Packaging status should be InProcess.` } 
          } 
        }
      });
    }

    const items = packaging.getPackagingItemRequests(req);

    const packagingItemRequests = [];
    for(const item of items) {
      const packagingItemRequest = await PackagingItemRequest.build({
        packaging_id: packaging.id
      });
      packagingItemRequest.setRequestData(item);
      error = await packagingItemRequest.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      packagingItemRequests.push(packagingItemRequest);
    }

    t = await sequelize.transaction();

    packaging.status = 'Waiting';

    await packaging.save({ transaction: t });

    await PackagingItemRequest.destroy({ where: { packaging_id: packaging.id }, transaction: t });

    for(const packagingItemRequest of packagingItemRequests) {
      packagingItemRequest.packaging_id = packaging.id;
      await packagingItemRequest.save({ transaction: t });
    }

    await t.commit();

    res.status(200).json({ message: "Packaging sent for approval!", packaging: packaging });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't udpate packaging!"
    // });

    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't Update Packaging!";
    next(error, req, res);
  }
};

export const approveBatchQty = async (req, res, next) => {
  let t;
  let error;

  try {
    let packaging = await Packaging.findByPk(req.params.id);
    if (!packaging) {
      return res.status(404).json({message: "Packaging not found!"});
    }

    // if (packaging.modified_by.toString() !== req.userData.userId.toString()) {
    //   return res.status(422).json({ 
    //     message: `You can't submit this Packaging.`, 
    //     error : { 
    //       errors : { 
    //         packaging: { message: `You can't submit this Packaging.` } 
    //       } 
    //     }
    //   });
    // }

    if (packaging.status.trim().toUpperCase() !== 'WAITING') {
      return res.status(422).json({ 
        message: `Packaging status should be Waiting.`, 
        error : { 
          errors : { 
            packaging: { message: `Packaging status should be Waiting.` } 
          } 
        }
      });
    }

    t = await sequelize.transaction();

    packaging.status = 'InProcess';

    await packaging.save({ transaction: t });

    await PackagingItemRequest.update(
      { approved_kg: sequelize.col('requested_kg') }, 
      { where: { packaging_id: packaging.id } }, 
      { transaction: t }
    );

    await t.commit();

    res.status(200).json({ message: "Packaging Approved Successfully!", packaging: packaging });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't approve packaging!"
    // });

    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't Approve Packaging!";
    next(error, req, res);
  }
};

export const rejectBatchQty = async (req, res, next) => {
  let t;
  let error;

  try {
    let packaging = await Packaging.findByPk(req.params.id);
    if (!packaging) {
      return res.status(404).json({message: "Packaging not found!"});
    }

    // if (packaging.modified_by.toString() !== req.userData.userId.toString()) {
    //   return res.status(422).json({ 
    //     message: `You can't submit this Packaging.`, 
    //     error : { 
    //       errors : { 
    //         packaging: { message: `You can't submit this Packaging.` } 
    //       } 
    //     }
    //   });
    // }

    if (packaging.status.trim().toUpperCase() !== 'WAITING') {
      return res.status(422).json({ 
        message: `Packaging status should be Waiting.`, 
        error : { 
          errors : { 
            packaging: { message: `Packaging status should be Waiting.` } 
          } 
        }
      });
    }

    t = await sequelize.transaction();

    packaging.status = 'InProcess';

    await packaging.save({ transaction: t });

    // await PackagingItemRequest.update({ approved_kg: requested_kg }, { where: { packaging_id: packaging.id } }, { transaction: t });

    await t.commit();

    res.status(200).json({ message: "Packaging Rejected Successfully!", packaging: packaging });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't reject packaging!"
    // });

    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't Reject Packaging!";
    next(error, req, res);
  }
};

export const setBatchQty = async (req, res, next) => {
  let t;
  let error = {};
  // let batchProcessing = {};
  let usePackagingStock = 0;
  let totalPackagingStockKg = 0;
  let totalStoreRequestedKg = 0;

  try {
    let packaging = await Packaging.findByPk(req.params.id);
    if (!packaging) {
      return res.status(404).json({message: "Packaging not found!"});
    }

    // if (packaging.output_kg > 0 || packaging.retain_kg > 0 || 
    //   packaging.return_kg > 0 || packaging.waste_kg > 0) {
    //   return res.status(422).json({ 
    //     message: `Raw material, variation or return already allocated for this Packaging.`, 
    //     error : { 
    //       errors : { 
    //         packaging: { message: `Raw material, variation or return already allocated for this Packaging.` } 
    //       } 
    //     }
    //   });
    // }

    // batchProcessing = await BatchProcessing.setPackagingData(packaging);

    const items = packaging.getPackagingItems(req);
    const packagingItemRequests = [];
    for(const item of items) {
      const packagingItemRequest = await PackagingItemRequest.findByPk(item.id);
      
      if (!packagingItemRequest) {
        return res.status(422).json({
          message: "Raw Material Request does not exist.",
          error: { errors : { [item.id]: { message: `Raw Material Request does not exist.` } } }
        });
      }
      error = await packagingItemRequest.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      if (item.use_production_stock) {
        usePackagingStock = 1;
      }
      
      packagingItemRequest.use_production_stock = item.use_production_stock;
      packagingItemRequest.production_stock_kg = item.production_stock_kg;

      packagingItemRequests.push(packagingItemRequest);

      // if (batchProcessing) {
      //   await BatchRawMaterial.destroy({ where: { 
      //     batch_processing_id: batchProcessing.id, 
      //     raw_material_request_id: packagingItemRequest.id 
      //   }});
      //   await Stock.destroy({ where: { 
      //     stock_type: 'Batch Processing', 
      //     batch_processing_id: batchProcessing.id 
      //   }});  
      // }
    }

    t = await sequelize.transaction();

    // batchProcessing.status = 'Approved';
    // await batchProcessing.save({ transaction: t });

    const stocks = await Stock.getManufacturerStock(packaging.manufacturer_id);

    for (const packagingItemRequest of packagingItemRequests) {
      const stocksFound = stocks.filter(stock => stock.raw_material_id === packagingItemRequest.raw_material_id && stock.stock_qty > 0);
      const approvedKg = round(parseFloat(packagingItemRequest.approved_kg), 4);
      const storeKg = round(parseFloat(packagingItemRequest.store_kg), 4);
      let availableKg = 0;
      let packagingStockKg = 0;
      let storeRequestedKg = approvedKg;
      let balanceKg = round(approvedKg - storeKg, 4);
      
      for (const stock of stocksFound) {
        const stockQty = round(parseFloat(stock.stock_qty), 4);

        if (packagingItemRequest.use_production_stock && balanceKg > 0) {
          let qty = 0;
          if (stockQty <= balanceKg) {
            qty = stockQty;
            balanceKg = round(balanceKg - stockQty, 4);
          } else {
            qty = balanceKg;
            balanceKg = 0;
          }

          // const batchRawMaterial = await BatchRawMaterial.build({
          //   batch_processing_id: batchProcessing.id,
          //   raw_material_id: packagingItemRequest.raw_material_id,
          //   batch_qty: qty,
          //   qty: qty,
          //   barcode: stock.barcode,
          //   expiry_date: stock.expiry_date,
          //   raw_material_request_id: packagingItemRequest.id
          // });

          // await batchRawMaterial.save({ transaction: t });

          packagingStockKg = round(packagingStockKg + qty, 4);
        }

        availableKg = round(availableKg + stockQty, 4);
      }

      packagingItemRequest.available_kg = availableKg;

      if (packagingItemRequest.use_production_stock) {
        storeRequestedKg = round(approvedKg - packagingStockKg, 4);
        
        packagingItemRequest.production_stock_kg = packagingStockKg;
        
        totalPackagingStockKg = round(totalPackagingStockKg + packagingStockKg, 4);
      } else {
        packagingItemRequest.production_stock_kg = 0;
      }
      
      packagingItemRequest.store_requested_kg = storeRequestedKg;

      await packagingItemRequest.save({ transaction: t });

      totalStoreRequestedKg = round(totalStoreRequestedKg + storeRequestedKg, 4);
    }

    packaging.use_production_stock = usePackagingStock;
    packaging.production_stock_kg = totalPackagingStockKg;
    packaging.store_requested_kg = totalStoreRequestedKg;
    packaging.check_batch_qty = 0;

    if (totalStoreRequestedKg > 0) {
      packaging.raw_material_request = 1;
      packaging.transfer = 0;
    }

    packaging.setTotalKg();
    
    await packaging.save({ transaction: t });

    await t.commit();

    // if (packaging.use_production_stock) {
    //   batchProcessing = await BatchProcessing.findByPk(batchProcessing.id, {
    //     include: [
    //       { model: BatchRawMaterial, as: "batchProcessingItems" }
    //     ]
    //   });

    //   // t = await sequelize.transaction();
    //   let dataArray = Stock.setStockDetails('Batch Processing', batchProcessing, t, req);
    //   await Stock.bulkCreate(dataArray);
    //   // await t.commit();
    //   // error = await Stock.setStockDetails('Raw Material In', rawMaterialIn, session, req);
    //   // if (error) throw error;
    // }

    res.status(200).json({ message: "Raw Material Request sent!", packaging: packaging });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't send raw material request!"
    // });

    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't send raw material request!";
    next(error, req, res);
  }
};

export const getPackaging = async (req, res, next) => {
  try {
    const packaging = await Packaging.findByPk(req.params.id, { 
      include: [
        // { model: Product, as: "product", attributes: ['id', 'product_name', 'short_name'] },
        { model: Depot, as: "manufacturer", attributes: ['id', 'depot_name', 'address', 'city', 'pincode', 'state', 'country', 'gst_no'] },
        { model: Depot, as: "depot", attributes: ['id', 'depot_name', 'address', 'city', 'pincode', 'state', 'country', 'gst_no'] },
        { model: User, as: "created_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
        { model: User, as: "modified_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
        { model: User, as: "approved_by_user", attributes: ['id', 'first_name', 'last_name'] }
      ] 
    });
    if (!packaging) {
      return res.status(404).json({ message: "Packaging not found!" });
    }

    const roleDetails = req.userData.roleDetails;

    // console.log(roleDetails);

    const action = {
      update: false,
      delete: false,
      approve: false
    };

    // console.log(packaging.modified_by.toString());
    // console.log(req.userData.userId);
    
    // if (packaging.isFreezed) {
    //   if (packaging.status.trim().toUpperCase() !== 'APPROVED' && packaging.status.trim().toUpperCase() !== 'INACTIVE') {
    //     if (roleDetails.r_edit) {
    //       action.update = true;
    //     }
    //     if (roleDetails.r_delete) {
    //       action.delete = true;
    //     }
    //   }
    // } else {
      if (!roleDetails.r_approvals || 
            (packaging.status.trim().toUpperCase() !== 'PENDING' && 
            packaging.status.trim().toUpperCase() !== 'DELETED') || 
            packaging.modified_by.toString() === req.userData.userId.toString()) 
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

    const masterData = await Packaging.getPackagingMasterData(packaging, req);
  
    return res.status(200).json({ 
      message: "Packaging fetched successfully!",
      action, 
      packaging, 
      masterData 
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Packaging failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Packaging failed!";
    next(error, req, res);
  }
};

export const getAllocations = async (req, res, next) => {
  try {
    const packaging = await Packaging.findByPk(req.params.id, { 
      include: [
        { model: Product, as: "product", attributes: ['id', 'product_name', 'short_name'] },
        { model: PackagingAllocation, as: "packagingAllocations" }
      ]
    });
    if (!packaging) {
      return res.status(404).json({ message: "Packaging not found!" });
    }

    const product_id = packaging.product_id;
    let recipe = await Recipe.findOne({ where: { product_id: product_id }});
    // const data = await Recipe.findAll({ where: [{ product_id: product_id }]}, {
    // // const data = await Recipe.findByPk(160, {
    //   include: [{ 
    //     model: RecipeVariation, as: 'recipeVariations',
    //     required: false, 
    //     nested: true
    //   }]
    // });

    recipe = await Recipe.findByPk(recipe.id, {
      include: { 
        model: RecipeVariation, as: 'recipeVariations',
        required: false,
        include: [
          { model: Box, as: "box", attributes: ['id', 'box_name', 'short_name', 'grams'], raw: true }
        ]
      }
    });

    const data = [];
    for (const recipeVariation of recipe.recipeVariations) {
      const packagingAllocations = packaging.packagingAllocations.filter(packagingAllocation => packagingAllocation.box_id === recipeVariation.box.id);
      data.push({ box: recipeVariation.box, packagingAllocations });
    }

    return res.status(200).json({ 
      message: "Allocations fetched successfully!", 
      data, 
      packaging
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Packaging failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Allocations failed!";
    next(error, req, res);
  }
};

export const allocate = async (req, res, next) => {
  let t;
  let error;

  try {
    let packaging = await Packaging.findByPk(req.params.id);
    if (!packaging) {
      return res.status(404).json({message: "Packaging not found!"});
    }

    const items = packaging.getPackagingAllocations(req);

    // if (packaging.output_kg > packaging.total_kg) {
    //   return res.status(422).json({
    //     message: "Cannot Allocate more than store assembled quantity.",
    //     error: { 
    //       errors : { 
    //         packaging: { message: `Cannot Allocate more than store assembled quantity.` } 
    //       } 
    //     }
    //   });
    // }

    if (packaging.output_kg < packaging.transferred_kg) {
      return res.status(422).json({
        message: "Cannot Allocate less than store transferred quantity.",
        error: { 
          errors : { 
            packaging: { message: `Cannot Allocate less than store transferred quantity.` } 
          } 
        }
      });
    }

    const packagingAllocations = [];
    let output_kg = 0;
    for(const item of items) {
      const packagingAllocation = await PackagingAllocation.build({
        packaging_id: packaging.id
      });
      packagingAllocation.getRequestData(item);
      error = await packagingAllocation.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      await packagingAllocation.setVariationDetails();
      packagingAllocations.push(packagingAllocation);
      output_kg = round(output_kg + parseFloat(packagingAllocation.total_kg), 4);
    }

    packaging.output_kg = output_kg;

    packaging.setProcessLoss();

    // error = await packaging.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }

    let batchProcessing = await BatchProcessing.setPackagingData(packaging);

    t = await sequelize.transaction();

    await Stock.destroy({ where: { stock_type: 'Batch Packaging', batch_processing_id: batchProcessing.id }, transaction: t });

    await packaging.save({ transaction: t });

    batchProcessing.status = 'Approved';
    await batchProcessing.save({ transaction: t });

    await PackagingAllocation.destroy({ where: { packaging_id: packaging.id }, transaction: t });
    await BatchVariation.destroy({ where: { batch_processing_id: batchProcessing.id }, transaction: t });

    for(const packagingAllocation of packagingAllocations) {
      packagingAllocation.packaging_id = packaging.id;
      await packagingAllocation.save({ transaction: t });

      const batchVariation = await BatchVariation.build({
        batch_processing_id: batchProcessing.id
      });
      batchVariation.getRequestData(packagingAllocation);
      await batchVariation.save({ transaction: t });
    }

    await t.commit();

    // batchProcessing = await BatchProcessing.findByPk(batchProcessing.id, {
    //   include: [
    //     // { model: Packaging, as: "packaging" },
    //     // { model: BatchRawMaterial, as: "batchProcessingItems" },
    //     { model: BatchVariation, as: "batchVariations" }
    //   ]
    // });

    // // t = await sequelize.transaction();
    // let dataArray = Stock.setStockDetails('Batch Packaging', batchProcessing, t, req);
    // Stock.bulkCreate(dataArray);
    // // await t.commit();
    // // error = await Stock.setStockDetails('Raw Material In', rawMaterialIn, session, req);
    // // if (error) throw error;

    res.status(200).json({ message: "Allocate successful!", packaging: packaging });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't udpate packaging!"
    // });

    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't Allocate Packaging!";
    next(error, req, res);
  }
};

export const getTransfers = async (req, res, next) => {
  try {
    const packaging = await Packaging.findByPk(req.params.id, { 
      include: [
        { model: Product, as: "product", attributes: ['id', 'product_name', 'short_name'] },
        { model: PackagingAllocation, as: "packagingAllocations" },
        { model: PackagingTransfer, as: "packagingTransfers" }
      ]
    });
    if (!packaging) {
      return res.status(404).json({ message: "Packaging not found!" });
    }

    const product_id = packaging.product_id;
    let recipe = await Recipe.findOne({ where: { product_id: product_id }});
    // const data = await Recipe.findAll({ where: [{ product_id: product_id }]}, {
    // // const data = await Recipe.findByPk(160, {
    //   include: [{ 
    //     model: RecipeVariation, as: 'recipeVariations',
    //     required: false, 
    //     nested: true
    //   }]
    // });

    recipe = await Recipe.findByPk(recipe.id, {
      include: { 
        model: RecipeVariation, as: 'recipeVariations',
        required: false,
        include: [
          { model: Box, as: "box", attributes: ['id', 'box_name', 'short_name', 'grams'], raw: true }
        ]
      }
    });

    const data = [];
    for (const recipeVariation of recipe.recipeVariations) {
      const isAllocated = packaging.packagingAllocations.some(packagingAllocation => packagingAllocation.box_id === recipeVariation.box.id);
      
      if (isAllocated) {
        let boxAllocatedQty = 0;
        packaging.packagingAllocations.forEach(packagingAllocation => {
          if (packagingAllocation.box_id === recipeVariation.box.id) {
            boxAllocatedQty = round(boxAllocatedQty + packagingAllocation.qty, 2);
          }
        });
        
        const packagingTransfers = packaging.packagingTransfers.filter(packagingTransfer => packagingTransfer.box_id === recipeVariation.box.id);
        const packagingAllocations = packaging.packagingAllocations.filter(packagingAllocation => packagingAllocation.box_id === recipeVariation.box.id);
        data.push({ box: recipeVariation.box, boxAllocatedQty, packagingTransfers, packagingAllocations });
      }
    }

    const depots = await Depot.findAll({ where: { status: 'Approved', id: { [Op.ne]: packaging.manufacturer_id }, id: {[Op.in]: req.userData.depotIds} } });

    return res.status(200).json({ 
      message: "Transfers fetched successfully!", 
      data, 
      depots, 
      packaging
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Transfers failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Transfers failed!";
    next(error, req, res);
  }
};

export const transfer = async (req, res, next) => {
  let t;
  let error;

  try {
    let packaging = await Packaging.findByPk(req.params.id, { 
      include: [
        { model: Product, as: "product", attributes: ['id', 'product_name', 'short_name'] },
        { model: PackagingAllocation, as: "packagingAllocations" },
        { model: PackagingTransfer, as: "packagingTransfers" }
      ]
    });
    if (!packaging) {
      return res.status(404).json({message: "Packaging not found!"});
    }

    const items = packaging.getTransfers(req);
    if (items.length === 0) {
      return res.status(404).json({message: "Please insert items to transfer!"});
    }

    if (!packaging.store_id) {
      return res.status(404).json({message: "Please select depot to transfer!"});
    }

    error = await packaging.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    const packagingTransfers = [];
    let transferred_kg = 0;
    for(const item of items) {
      const isAllocated = packaging.packagingAllocations.some(packagingAllocation => packagingAllocation.box_id === item.box_id);
      if (!isAllocated) {
        return res.status(422).json({
          message: "Entered box is not allocated in this packaging.",
          error: { 
            errors : { 
              packaging: { message: `Entered box is not allocated in this packaging.` } 
            } 
          }
        });
      }

      let boxAllocatedQty = 0;
      packaging.packagingAllocations.forEach(packagingAllocation => {
        if (packagingAllocation.box_id === item.box_id) {
          boxAllocatedQty = round(boxAllocatedQty + packagingAllocation.qty, 4);
        }
      });
      let boxTransferredQty = 0;
      packaging.packagingTransfers.forEach(packagingTransfer => {
        if (packagingTransfer.box_id === item.box_id) {
          boxTransferredQty = round(boxTransferredQty + packagingTransfer.qty, 4);
        }
      });

      if (boxAllocatedQty < (round(boxTransferredQty + item.qty, 4))) {
        return res.status(422).json({
          message: "Cannot transfer more than allocated quantity.",
          error: { 
            errors : { 
              packaging: { message: `Cannot transfer more than allocated quantity.` } 
            } 
          }
        });
      }

      const packagingTransfer = await PackagingTransfer.build({
        packaging_id: packaging.id
      });
      packagingTransfer.getRequestData(item);
      error = await packagingTransfer.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      await packagingTransfer.setVariationDetails();
      packagingTransfers.push(packagingTransfer);
      transferred_kg = round(transferred_kg + packagingTransfer.total_kg, 4);
    }

    packaging.transferred_kg = round(parseFloat(packaging.transferred_kg) + transferred_kg, 4);

    let depotTransfer = await DepotTransfer.setPackagingData(packaging, 'Box');
    // let depotTransferDetails = await DepotTransfer.setPackagingTransfer(packaging, packagingTransfers);

    // error = await depotTransfer.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }

    t = await sequelize.transaction();

    packaging.setTransferPending();
    await packaging.save({ transaction: t });

    depotTransfer.status = 'Approved';
    await depotTransfer.save({ transaction: t });

    // await PackagingTransfer.destroy({ where: { packaging_id: packaging.id }, transaction: t });

    for(const packagingTransfer of packagingTransfers) {
      await packagingTransfer.save({ transaction: t });

      const depotTransferItem = await DepotTransferItem.build({
        depot_transfer_id: depotTransfer.id
      });
      depotTransferItem.setStoreTransfer(packagingTransfer);
      await depotTransferItem.save({ transaction: t });
    }

    // const depotTransferIds = [];
    // for (const depotTransferDetail of depotTransferDetails) {
    //   const depotTransfer = depotTransferDetail.depotTransfer;
    //   await depotTransfer.save({ transaction: t });

    //   for (const depotTransferItem of depotTransferDetail.depotTransferItems) {
    //     depotTransferItem.depot_transfer_id = depotTransfer.id;
    //     await depotTransferItem.save({ transaction: t });
    //   }

    //   depotTransferIds.push(depotTransfer.id);
    // }

    // let depotTransfers = await DepotTransfer.findAll({ 
    //   where: { 
    //     id: { [Op.notIn]: depotTransferIds }, 
    //     packaging_id: packaging.id, 
    //     transfer_type: 'Box'
    //   },
    //   attributes: ['id'],
    //   raw: true
    // });

    // await DepotTransferItem.destroy({ where: { depot_transfer_id: { [Op.in]: depotTransfers.id } }, transaction: t });
    // await DepotTransfer.destroy({ where: { id: { [Op.in]: depotTransfers.id } }, transaction: t });
    await t.commit();

    
    // depotTransfers = await DepotTransfer.findAll({
    //   where: { packaging_id: packaging.id, transfer_type: 'Box' }, 
    //   include: [
    //     { model: DepotTransferItem, as: "depotTransferItems" }
    //   ]
    // });

    // for (const depotTransfer of depotTransfers) {
    //   // t = await sequelize.transaction();
    //   let dataArray = Stock.setStockDetails('Depot Transfer', depotTransfer, t, req);
    //   Stock.bulkCreate(dataArray);
    //   // await t.commit();
    //   // error = await Stock.setStockDetails('Raw Material In', rawMaterialIn, session, req);
    //   // if (error) throw error;
    // }

    res.status(200).json({ message: "Transfer successful!", packaging: packaging });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't udpate packaging!"
    // });

    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't Transfer Packaging!";
    next(error, req, res);
  }
};

export const getReturns = async (req, res, next) => {
  try {
    const packaging = await Packaging.findByPk(req.params.id, { 
      include: [
        { model: Product, as: "product", attributes: ['id', 'product_name', 'short_name'] },
        // { 
        //   model: BatchProcessing, 
        //   as: "packagingBatchProcessing", 
        //   include: [{ model: BatchRawMaterial, as: "batchProcessingItems", include: 'rawMaterial' }]
        // },
        { 
          model: DepotTransfer, 
          as: "packagingDepotTransfer", 
          include: [{ model: DepotTransferItem, as: "depotTransferItems", include: 'raw_material' }]
        },
        { model: PackagingReturn, as: "packagingReturns", include: 'rawMaterial' },
        // { model: PackagingWaste, as: "packagingWastes", include: 'rawMaterial' },
        // { model: PackagingRetain, as: "packagingRetains", include: 'rawMaterial' }
      ]
    });
    if (!packaging) {
      return res.status(404).json({ message: "Packaging not found!" });
    }

    // console.log(packaging);

    const rawMaterials = [];
    if (packaging.packagingDepotTransfer && packaging.packagingDepotTransfer.length > 0) {
      if (packaging.packagingDepotTransfer[0].depotTransferItems && packaging.packagingDepotTransfer[0].depotTransferItems.length > 0) {
        for (const depotTransferItem of packaging.packagingDepotTransfer[0].depotTransferItems) {
          // if (depotTransferItem.waste || depotTransferItem.retain || depotTransferItem.return) {
          //   continue;
          // }

          let index = rawMaterials.findIndex(rawMaterial => rawMaterial.raw_material_id === depotTransferItem.raw_material_id);

          if (index !== -1) {
            let index2 = rawMaterials[index].barcodes.findIndex(barcode => barcode.barcode == depotTransferItem.barcode);

            if (index2 !== -1) {
              rawMaterials[index].barcodes[index2].available_qty = rawMaterials[index].barcodes[index2].available_qty + (depotTransferItem.qty ? +depotTransferItem.qty : 0);
            } else {
              rawMaterials[index].barcodes.push({
                barcode: depotTransferItem.barcode ? depotTransferItem.barcode : '', 
                expiry_date: depotTransferItem.expiry_date ? depotTransferItem.expiry_date : '', 
                available_qty: depotTransferItem.qty ? +depotTransferItem.qty : 0
              });
            }
          } else {
            const rawMaterial = {
              raw_material_id: depotTransferItem.raw_material_id, 
              rm_name: depotTransferItem.raw_material && depotTransferItem.raw_material.rm_name ? depotTransferItem.raw_material.rm_name : '', 
              barcodes: [{
                barcode: depotTransferItem.barcode ? depotTransferItem.barcode : '', 
                expiry_date: depotTransferItem.expiry_date ? depotTransferItem.expiry_date : '', 
                available_qty: depotTransferItem.qty ? +depotTransferItem.qty : 0
              }]
            };

            rawMaterials.push(rawMaterial);
          }
        }
      }
    }
    // if (packaging.packagingBatchProcessing && packaging.packagingBatchProcessing.length > 0) {
    //   if (packaging.packagingBatchProcessing[0].batchProcessingItems && packaging.packagingBatchProcessing[0].batchProcessingItems.length > 0) {
    //     for (const batchProcessingItem of packaging.packagingBatchProcessing[0].batchProcessingItems) {
    //       if (batchProcessingItem.waste || batchProcessingItem.retain || batchProcessingItem.return) {
    //         continue;
    //       }

    //       let index = rawMaterials.findIndex(rawMaterial => rawMaterial.raw_material_id === batchProcessingItem.raw_material_id);

    //       if (index !== -1) {
    //         let index2 = rawMaterials[index].barcodes.findIndex(barcode => barcode.barcode == batchProcessingItem.barcode);

    //         if (index2 !== -1) {
    //           rawMaterials[index].barcodes[index2].available_qty = rawMaterials[index].barcodes[index2].available_qty + (batchProcessingItem.qty ? +batchProcessingItem.qty : 0);
    //         } else {
    //           rawMaterials[index].barcodes.push({
    //             barcode: batchProcessingItem.barcode ? batchProcessingItem.barcode : '', 
    //             expiry_date: batchProcessingItem.expiry_date ? batchProcessingItem.expiry_date : '', 
    //             available_qty: batchProcessingItem.qty ? +batchProcessingItem.qty : 0
    //           });
    //         }
    //       } else {
    //         const rawMaterial = {
    //           raw_material_id: batchProcessingItem.raw_material_id, 
    //           rm_name: batchProcessingItem.rawMaterial && batchProcessingItem.rawMaterial.rm_name ? batchProcessingItem.rawMaterial.rm_name : '', 
    //           barcodes: [{
    //             barcode: batchProcessingItem.barcode ? batchProcessingItem.barcode : '', 
    //             expiry_date: batchProcessingItem.expiry_date ? batchProcessingItem.expiry_date : '', 
    //             available_qty: batchProcessingItem.qty ? +batchProcessingItem.qty : 0
    //           }]
    //         };

    //         rawMaterials.push(rawMaterial);
    //       }
    //     }
    //   }
    // }

    return res.status(200).json({ 
      message: "Returns fetched successfully!", 
      packaging, 
      rawMaterials
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Returns failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Returns failed!";
    next(error, req, res);
  }
};

export const wasteBalanceMaterial = async (req, res, next) => {
  let t;
  let error;

  try {
    let packaging = await Packaging.findByPk(req.params.id);
    if(!packaging) {
      return res.status(404).json({message: "Packaging not found!"});
    }

    // const item = packaging.getWasteData(req);
    
    const items = packaging.getStoreReturns(req.body);

    let waste_kg = 0;
    for(const item of items) {
      const data = await packaging.checkBarcode(item.barcode, 'WASTE');

      if (!data.raw_material_id) {
        return res.status(422).json({
          message: "Barcode does not found in batch processing.",
          error: { 
            errors : { 
              packaging: { message: `Barcode does not found in batch processing.` } 
            } 
          }
        });
      }

      const total_qty = items.reduce((total_qty, item2) => {
        if (item.barcode === item2.barcode) 
          return total_qty + item2.qty;
        else 
          return total_qty;
      }, 0);

      if (data.qty < total_qty) {
        return res.status(422).json({
          message: "Cannot waste more than allocated quantity.",
          error: { 
            errors : { 
              packaging: { message: `Cannot waste more than allocated quantity.` } 
            } 
          }
        });
      }

      waste_kg = round(waste_kg + item.qty, 4);
    }

    packaging.waste_kg = waste_kg;

    // if (packaging.waste_kg > round(packaging.total_kg - packaging.output_kg - packaging.return_kg - packaging.retain_kg, 4)) {
    //   return res.status(422).json({
    //     message: "Cannot Waste more than balance quantity.",
    //     error: { 
    //       errors : { 
    //         packaging: { message: `Cannot Waste more than balance quantity.` } 
    //       } 
    //     }
    //   });
    // }

    // const packagingWaste = await PackagingWaste.build({
    //   packaging_id: packaging.id
    // });
    // packagingWaste.setWasteData(item);

    // error = await packagingWaste.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }

    const packagingWastes = [];
    for(const item of items) {
      const packagingWaste = await PackagingWaste.build({
        packaging_id: packaging.id
      });
      packagingWaste.setWasteData(item);
      error = await packagingWaste.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      // await packagingWaste.setItemAmount();
      packagingWastes.push(packagingWaste);
    }

    packaging.setProcessLoss();

    let rawMaterialInOut = await RawMaterialInOut.setPackagingData(packaging, 'Waste');

    let batchProcessing = await BatchProcessing.setPackagingData(packaging);

    t = await sequelize.transaction();

    // await Stock.destroy({ where: { stock_type: 'Packaging Waste', packaging_id: packaging.id }, transaction: t });

    await PackagingWaste.destroy({ where: { packaging_id: packaging.id }, transaction: t });

    await RawMaterialInOutItem.destroy({ where: { raw_material_in_out_id: rawMaterialInOut.id }, transaction: t });

    await BatchRawMaterial.destroy({ where: { batch_processing_id: batchProcessing.id, waste: 1 }, transaction: t });

    await packaging.save({ transaction: t });
    
    rawMaterialInOut.status = 'Approved';
    await rawMaterialInOut.save({ transaction: t });

    batchProcessing.status = 'Approved';
    await batchProcessing.save({ transaction: t });

    // await packagingWaste.save({ transaction: t });

    for (const packagingWaste of packagingWastes) {
      packagingWaste.packaging_id = packaging.id;
      await packagingWaste.save({ transaction: t });

      const rawMaterialInOutItem = await RawMaterialInOutItem.build({
        raw_material_in_out_id: rawMaterialInOut.id
      });
      rawMaterialInOutItem.setPackagingReturn(packagingWaste);
      await rawMaterialInOutItem.save({ transaction: t });
      
      const batchRawMaterial = await BatchRawMaterial.build({
        batch_processing_id: batchProcessing.id,
        waste: 1
      });
      batchRawMaterial.setPackagingReturn(packagingWaste);
      await batchRawMaterial.save({ transaction: t });
    }

    await t.commit();

    rawMaterialInOut = await RawMaterialInOut.findByPk(rawMaterialInOut.id, {
      include: [
        { model: RawMaterialInOutItem, as: "rawMaterialInOutItems" }
      ]
    });
    await Stock.destroy({ where: { stock_type: 'Raw Material In Out', raw_material_in_out_id: rawMaterialInOut.id }});
    let dataArray = Stock.setStockDetails('Raw Material In Out', rawMaterialInOut, t, req);
    await Stock.bulkCreate(dataArray);

    batchProcessing = await BatchProcessing.findByPk(batchProcessing.id, {
      include: [
        { model: BatchRawMaterial, as: "batchProcessingItems" }
      ]
    });
    await Stock.destroy({ where: { stock_type: 'Batch Processing', batch_processing_id: batchProcessing.id }});
    dataArray = Stock.setStockDetails('Batch Processing', batchProcessing, t, req);
    await Stock.bulkCreate(dataArray);

    // packaging = await Packaging.findByPk(packaging.id, {
    //   include: [
    //     { model: PackagingWaste, as: "packagingWastes" }
    //   ]
    // });
    
    // // t = await sequelize.transaction();
    // await Stock.destroy({ where: { stock_type: 'Packaging Waste', packaging_id: packaging.id }});
    // let dataArray = Stock.setStockDetails('Packaging Waste', packaging, t, req);
    // Stock.bulkCreate(dataArray);
    // // await t.commit();
    // // error = await Stock.setStockDetails('Packaging Waste', rawMaterialIn, session, req);
    // // if (error) throw error;

    return res.status(200).json({ 
      message: "Waste successful!", 
      packaging
    });
    
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't Waste balance material!"
    // });

    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't Waste balance material!";
    next(error, req, res);
  }
}

export const retainBalanceMaterial = async (req, res, next) => {
  let t;
  let error;

  try {
    let packaging = await Packaging.findByPk(req.params.id);
    if(!packaging) {
      return res.status(404).json({message: "Packaging not found!"});
    }

    // const item = packaging.getRetainData(req);
    
    const items = packaging.getStoreReturns(req.body);

    let retain_kg = 0;
    for(const item of items) {
      const data = await packaging.checkBarcode(item.barcode, 'RETAIN');

      if (!data.raw_material_id) {
        return res.status(422).json({
          message: "Barcode does not found in batch processing.",
          error: { 
            errors : { 
              packaging: { message: `Barcode does not found in batch processing.` } 
            } 
          }
        });
      }

      const total_qty = items.reduce((total_qty, item2) => {
        if (item.barcode === item2.barcode) 
          return total_qty + item2.qty;
        else 
          return total_qty;
      }, 0);

      if (data.qty < total_qty) {
        return res.status(422).json({
          message: "Cannot retain more than allocated quantity.",
          error: { 
            errors : { 
              packaging: { message: `Cannot retain more than allocated quantity.` } 
            } 
          }
        });
      }

      retain_kg = round(retain_kg + item.qty, 4);
    }

    packaging.retain_kg = retain_kg;

    // if (packaging.retain_kg > round(packaging.total_kg - packaging.output_kg - packaging.return_kg - packaging.waste_kg, 4)) {
    //   return res.status(422).json({
    //     message: "Cannot Retain more than balance quantity.",
    //     error: { 
    //       errors : { 
    //         packaging: { message: `Cannot Retain more than balance quantity.` } 
    //       } 
    //     }
    //   });
    // }

    // const packagingRetain = await PackagingRetain.build({
    //   packaging_id: packaging.id
    // });
    // packagingRetain.setRetainData(item);

    // error = await packagingRetain.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }

    
    const packagingRetains = [];
    for(const item of items) {
      const packagingRetain = await PackagingRetain.build({
        packaging_id: packaging.id
      });
      packagingRetain.setRetainData(item);
      error = await packagingRetain.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      // await packagingRetain.setItemAmount();
      packagingRetains.push(packagingRetain);
    }

    packaging.setProcessLoss();

    let batchProcessing = await BatchProcessing.setPackagingData(packaging);

    t = await sequelize.transaction();

    await Stock.destroy({ where: { stock_type: 'Packaging Retain', packaging_id: packaging.id }, transaction: t });

    await PackagingRetain.destroy({ where: { packaging_id: packaging.id }, transaction: t });

    await BatchRawMaterial.destroy({ where: { batch_processing_id: batchProcessing.id, retain: 1 }, transaction: t });

    await packaging.save({ transaction: t });
    
    batchProcessing.status = 'Approved';
    await batchProcessing.save({ transaction: t });

    // await packagingRetain.save({ transaction: t });

    for (const packagingRetain of packagingRetains) {
      packagingRetain.packaging_id = packaging.id;
      await packagingRetain.save({ transaction: t });

      const batchRawMaterial = await BatchRawMaterial.build({
        batch_processing_id: batchProcessing.id,
        retain: 1
      });
      batchRawMaterial.setPackagingReturn(packagingRetain);
      await batchRawMaterial.save({ transaction: t });
    }
    
    await t.commit();

    batchProcessing = await BatchProcessing.findByPk(batchProcessing.id, {
      include: [
        { model: BatchRawMaterial, as: "batchProcessingItems" }
      ]
    });
    // t = await sequelize.transaction();
    await Stock.destroy({ where: { stock_type: 'Batch Processing', batch_processing_id: batchProcessing.id }});
    let dataArray = Stock.setStockDetails('Batch Processing', batchProcessing, t, req);
    await Stock.bulkCreate(dataArray);
    // await t.commit();
    // error = await Stock.setStockDetails('Raw Material In', rawMaterialIn, session, req);
    // if (error) throw error;
    
    packaging = await Packaging.findByPk(packaging.id, {
      include: [
        { model: PackagingRetain, as: "packagingRetains" }
      ]
    });
    // // t = await sequelize.transaction();
    // await Stock.destroy({ where: { stock_type: 'Packaging Retain', packaging_id: packaging.id } });
    // dataArray = Stock.setStockDetails('Packaging Retain', packaging, t, req);
    // Stock.bulkCreate(dataArray);
    // // await t.commit();
    // // error = await Stock.setStockDetails('Raw Material In', rawMaterialIn, session, req);
    // // if (error) throw error;

    return res.status(200).json({ 
      message: "Retain successful!", 
      packaging
    });
    
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't Retain balance material!"
    // });

    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Retain Failed!";
    next(error, req, res);
  }
}

export const returnBalanceMaterial = async (req, res, next) => {
  let t;
  let error;

  try {
    let packaging = await Packaging.findByPk(req.params.id);
    if(!packaging) {
      return res.status(404).json({message: "Packaging not found!"});
    }

    packaging.getReturnData(req);

    // const item = packaging.getReturnData(req);
    // if (packaging.return_kg > (packaging.total_kg - packaging.output_kg)) {
    //   return res.status(422).json({
    //     message: "Cannot Return more than balance quantity.",
    //     error: { 
    //       errors : { 
    //         packaging: { message: `Cannot Return more than balance quantity.` } 
    //       } 
    //     }
    //   });
    // }

    // let packagingReturn = {}
    // if (!packaging.return_raw_material) {
    //   packagingReturn = await PackagingReturn.build({
    //     packaging_id: packaging.id
    //   });
    //   packagingReturn.setReturnData(item);
  
    //   error = await packagingReturn.validateData();
    //   if (error) {
    //     return res.status(422).json({
    //       message: "Invalid inputs passed, please check your data.",
    //       error: error
    //     });
    //   }
    // }

    // packaging.setProcessLoss();

    t = await sequelize.transaction();

    // await Stock.destroy({ where: { stock_type: 'Packaging Return', packaging_id: packaging.id }, transaction: t });

    // // await PackagingReturn.destroy({ where: { packaging_id: packaging.id }, transaction: t });

    // if (!packaging.return_raw_material) {
    //   await packagingReturn.save({ transaction: t });
    // }

    await packaging.save({ transaction: t });
    
    await t.commit();

    // if (!packaging.return_raw_material) {
    //   packaging = await Packaging.findByPk(packaging.id, {
    //     include: [
    //       { model: PackagingReturn, as: "packagingReturns" }
    //     ]
    //   });

    //   // t = await sequelize.transaction();
    //   let dataArray = Stock.setStockDetails('Packaging Return', packaging, t, req);
    //   Stock.bulkCreate(dataArray);
    //   // await t.commit();
    //   // error = await Stock.setStockDetails('Raw Material In', rawMaterialIn, session, req);
    //   // if (error) throw error;
    // }

    return res.status(200).json({ 
      message: "Return successful!", 
      packaging
    });
    
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't return balance material!"
    // });

    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't return balance material!";
    next(error, req, res);
  }
}

export const allocationPending = async (req, res, next) => {
  try {
    let packaging = await Packaging.findByPk(req.params.id);

    if (!packaging) {
      return res.status(404).json({
        message: "Packaging not found!"
      });
    }

    // if (packaging.modified_by.toString() !== req.userData.userId.toString()) {
    //   return res.status(422).json({ 
    //     message: `You can't submit this Packaging.`, 
    //     error : { 
    //       errors : { 
    //         packaging: { message: `You can't submit this Packaging.` } 
    //       } 
    //     }
    //   });
    // }

    if (packaging.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({ 
        message: `Packaging is already approved.`, 
        error : { 
          errors : { 
            packaging: { message: `Packaging is already approved.` } 
          } 
        }
      });
    }

    packaging.setAllocationPending(req);
    await packaging.save();

    res.status(200).json({ message: "Packaging set as Pending Allocation!", packaging });
  } catch (error) {
    // res.status(500).json({
    //   message: "Packaging Pending Allocation failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Packaging Pending Allocation failed!";
    next(error, req, res);
  }
};

export const workInProgress = async (req, res, next) => {
  try {
    let packaging = await Packaging.findByPk(req.params.id);

    if (!packaging) {
      return res.status(404).json({
        message: "Packaging not found!"
      });
    }

    // if (packaging.modified_by.toString() !== req.userData.userId.toString()) {
    //   return res.status(422).json({ 
    //     message: `You can't submit this Packaging.`, 
    //     error : { 
    //       errors : { 
    //         packaging: { message: `You can't submit this Packaging.` } 
    //       } 
    //     }
    //   });
    // }

    if (packaging.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({ 
        message: `Packaging is already approved.`, 
        error : { 
          errors : { 
            packaging: { message: `Packaging is already approved.` } 
          } 
        }
      });
    }

    packaging.setWorkInProgress(req);
    await packaging.save();

    res.status(200).json({ message: "Packaging set as Work In Progress!", packaging });
  } catch (error) {
    // res.status(500).json({
    //   message: "Packaging Work In Progress failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Packaging Work In Progress failed!";
    next(error, req, res);
  }
};

export const submitPackaging = async (req, res, next) => {
  try {
    let packaging = await Packaging.findByPk(req.params.id);

    if (!packaging) {
      return res.status(404).json({
        message: "Packaging not found!"
      });
    }

    // if (packaging.modified_by.toString() !== req.userData.userId.toString()) {
    //   return res.status(422).json({ 
    //     message: `You can't submit this Packaging.`, 
    //     error : { 
    //       errors : { 
    //         packaging: { message: `You can't submit this Packaging.` } 
    //       } 
    //     }
    //   });
    // }

    if (packaging.output_kg <= 0 && ((round((packaging.retain_kg + packaging.return_kg + packaging.waste_kg), 4)) != packaging.total_kg || packaging.total_kg <= 0)) {
      return res.status(422).json({ 
        message: `Cannot send packaging for approval.`, 
        error : { 
          errors : { 
            packaging: { message: `Cannot send packaging for approval.` } 
          } 
        }
      });
    }

    if (packaging.status.trim().toUpperCase() === 'PENDING') {
      return res.status(422).json({ 
        message: `Packaging is already sent for approval.`, 
        error : { 
          errors : { 
            packaging: { message: `Packaging is already sent for approval.` } 
          } 
        }
      });
    }

    if (packaging.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({ 
        message: `Packaging is already approved.`, 
        error : { 
          errors : { 
            packaging: { message: `Packaging is already approved.` } 
          } 
        }
      });
    }

    packaging.submit(req);
    packaging.setTransferPending();
    await packaging.save();

    res.status(200).json({ message: "Packaging sent for approval!", packaging });
  } catch (error) {
    // res.status(500).json({
    //   message: "Submitting Packaging failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Submitting Packaging failed!";
    next(error, req, res);
  }
};

export const approvePackaging = async (req, res, next) => {
  let t;

  try {
    let packaging = await Packaging.findByPk(req.params.id, {
      include: [
        { model: BatchProcessing, as: "packagingBatchProcessing", attributes: ['id'] },
        { model: DepotTransfer, as: "packagingDepotTransfer", attributes: ['id'] }
      ]
    });
    if (!packaging) {
      return res.status(404).json({
        message: "Packaging not found!"
      });
    }

    if (packaging.modified_by === req.userData.userId) {
      return res.status(422).json({ 
        message: `You can't approve this Packaging.`, 
        error : { 
          errors : { 
            packaging: { message: `You can't approve this Packaging.` } 
          } 
        }
      });
    }

    // console.log(packaging);

    if (packaging.status.trim().toUpperCase() !== 'PENDING' && packaging.status.trim().toUpperCase() !== 'DELETED') {
      return res.status(422).json({ 
        message: `Packaging status should be pending or deleted.`, 
        error : { 
          errors : { 
            packaging: { message: `Packaging status should be pending or deleted.` } 
          } 
        }
      });
    }

    packaging.approve(req);

    // console.log(error);
    // packaging.approvedBy = req.userData.userId;
    // packaging.approvedAt = new Date().toISOString();

    // const error = await packaging.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }

    // try {
      t = await sequelize.transaction();
      
      // if (!packaging.p_id) {
      //   const series = await getSeries(req, 'Packaging');
      //   packaging.getPackagingNo(series.series);
      //   await series.save({ transaction: t });
      // }

      await packaging.save({ transaction: t });

      await BatchProcessing.update(
        {
          status: packaging.status,
          approved_by: packaging.approved_by,
          approved_on: packaging.approved_on
        },
        {
          where: {
            packaging_id: packaging.id
          }
        },
        { transaction: t }
      );
      
      await DepotTransfer.update(
        {
          status: packaging.status,
          approved_by: packaging.approved_by,
          approved_on: packaging.approved_on
        },
        {
          where: {
            packaging_id: packaging.id
          }
        },
        { transaction: t }
      );

      const batchProcessingIds = packaging.packagingBatchProcessing.map(batchProcessing => batchProcessing.id);
      const depotTransferIds = packaging.packagingDepotTransfer.map(depotTransfer => depotTransfer.id);
      
      await Stock.update(
        {
          status: packaging.status,
          approved_by: packaging.approved_by,
          approved_on: packaging.approved_on
        },
        {
          where: {
            [Op.or] : [
              { packaging_id: packaging.id },
              { batch_processing_id: batchProcessingIds },
              { depot_transfer_id: depotTransferIds }
            ]
          }
        },
        { transaction: t }
      );
      
      // if (!packaging.ref_id) {
      //   await packaging.save({ transaction: t });
      // } else {
      //   // const obj = JSON.parse(JSON.stringify(packaging));
      //   // delete obj._id;
      //   // obj.ref_id = null;

      //   const ref_id = packaging.ref_id;

      //   const obj = packaging.dataValues;
      //   delete obj.id;
      //   obj.ref_id = null;

      //   // console.log(obj);
      //   // console.log(ref_id);
      //   // console.log(req.params.id);

      //   await Packaging.destroy({ where: {id: req.params.id }}, { transaction: t });

      //   // packaging = await Packaging.findByIdAndUpdate(ref_id, obj, { session: session, new: true });

      //   await Packaging.update(obj, { where: { id: ref_id } }, { transaction: t });

      //   await PackagingItem.destroy({ where: {packaging_id: ref_id }}, { transaction: t });

      //   await PackagingItem.update({ packaging_id: ref_id }, { where: { packaging_id: req.params.id }}, { transaction: t });

      //   await PackagingOtherCharge.destroy({ where: {packaging_id: ref_id }}, { transaction: t });

      //   await PackagingOtherCharge.update({ packaging_id: ref_id }, { where: { packaging_id: req.params.id }}, { transaction: t });

      //   // originalPackaging = await Packaging.findById(packaging.ref_id);
      //   // originalPackaging.overwrite(packaging);
      //   // originalPackaging.ref_id = null;
      //   // originalPackaging.productState = packaging.productState;
      //   // // console.log(originalPackaging);
      //   // await originalPackaging.save({ session });
      // }

      await t.commit();
         
    // } catch (error) { 
    //     await session.abortTransaction();
    // }
    
    res.status(200).json({ message: "Approve successful!" });
  } catch (error) {
    // console.log(error);

    if (t && t.finished != 'commit') {
      await t.rollback();
    }

    // res.status(500).json({
    //   message: 'Approving Packaging failed! Error - ' + (error.message ? error.message : '')
    // });
    
    res.statusCode = 500;
    res.message = "Approving Packaging failed!";
    next(error, req, res);
  }
};

export const rejectPackaging = async (req, res, next) => {
  try {
    let packaging = await Packaging.findByPk(req.params.id);

    if (!packaging) {
      return res.status(404).json({
        message: "Packaging not found!"
      });
    }

    if (packaging.modified_by.toString() === req.userData.userId.toString()) {
      return res.status(422).json({ 
        message: `You can't reject this Packaging.`, 
        error : { 
          errors : { 
            packaging: { message: `You can't reject this Packaging.` } 
          } 
        }
      });
    }

    if (packaging.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({ 
        message: `Packaging is already approved.`, 
        error : { 
          errors : { 
            packaging: { message: `Packaging is already approved.` } 
          } 
        }
      });
    }

    if (packaging.status.trim().toUpperCase() !== 'PENDING' && packaging.status.trim().toUpperCase() !== 'DELETED') {
      return res.status(422).json({ 
        message: `Packaging status should be pending or deleted.`, 
        error : { 
          errors : { 
            packaging: { message: `Packaging status should be pending or deleted.` } 
          } 
        }
      });
    }

    packaging.reject(req);
    await packaging.save();

    res.status(200).json({ message: "Reject successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Rejecting Packaging failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Rejecting Packaging failed!";
    next(error, req, res);
  }
};

export const deletePackaging = async (req, res, next) => {
  let t;

  try {
    let packaging = await Packaging.findByPk(req.params.id, {
      include: [
        // { model: BatchProcessing, as: "packagingBatchProcessing" },
        { model: DepotTransfer, as: "packagingDepotTransfer" }
      ]
    });
    if (!packaging) {
      return res.status(404).json({ message: "Packaging not found!" });
    }

    // if (packaging.modified_by.toString() !== req.userData.userId.toString()) {
    //   return res.status(422).json({ 
    //     message: `You can't delete this Packaging.`, 
    //     error : { 
    //       errors : { 
    //         packaging: { message: `You can't delete this Packaging.` } 
    //       } 
    //     }
    //   });
    // }
    
    if (packaging.status.trim().toUpperCase() === 'DRAFTED') {
      packaging.status = 'InProcess';
    }

    if (packaging.status.trim().toUpperCase() !== 'INPROCESS') {
      return res.status(422).json({ 
        message: `Packaging status should be InProcess.`, 
        error : { 
          errors : { 
            packaging: { message: `Packaging status should be InProcess.` } 
          } 
        }
      });
    }

    if (packaging.total_kg > 0 || packaging.output_kg > 0 || packaging.retain_kg > 0 || 
      packaging.return_kg > 0 || packaging.waste_kg > 0) {
      return res.status(422).json({ 
        message: `Packaging material, variation or return already allocated for this Packaging.`, 
        error : { 
          errors : { 
            packaging: { message: `Packaging material, variation or return already allocated for this Packaging.` } 
          } 
        }
      });
    }

    t = await sequelize.transaction();

    const cond = [{ packaging_id: packaging.id }];

    // if (packaging.packagingBatchProcessing) {
    //   const batchProcessingIds = packaging.packagingBatchProcessing.map(batchProcessing => batchProcessing.id);
    //   if (batchProcessingIds) {
    //     // await BatchRawMaterial.destroy({ where: { batch_processing_id: { [Op.in]: batchProcessingIds } }, transaction: t });
    //     // await BatchVariation.destroy({ where: { batch_processing_id: { [Op.in]: batchProcessingIds } }, transaction: t });
    //     // await BatchProcessing.destroy({ where: { id: { [Op.in]: batchProcessingIds } }, transaction: t });
    //     await BatchProcessing.update({ status: 'InActive' }, { where: { id: { [Op.in]: batchProcessingIds } } }, { transaction: t });
    //     cond.push({ batch_processing_id: { [Op.in]: batchProcessingIds } });
    //   }
    // }
    
    if (packaging.packagingDepotTransfer) {
      const depotTransferIds = packaging.packagingDepotTransfer.map(depotTransfer => depotTransfer.id);
      if (depotTransferIds) {
        // await DepotTransferItem.destroy({ where: { depot_transfer_id: { [Op.in]: depotTransferIds } }, transaction: t });
        // await DepotTransfer.destroy({ where: { id: { [Op.in]: depotTransferIds } }, transaction: t });
        await DepotTransfer.update({ status: 'InActive' }, { where: { id: { [Op.in]: depotTransferIds } } }, { transaction: t });
        cond.push({ depot_transfer_id: { [Op.in]: depotTransferIds } });
      }
    }
    
    // await PackagingItem.destroy({ where: { packaging_id: packaging.id }, transaction: t });
    // await PackagingAllocation.destroy({ where: { packaging_id: packaging.id }, transaction: t });
    // await PackagingTransfer.destroy({ where: { packaging_id: packaging.id }, transaction: t });
    // await PackagingReturn.destroy({ where: { packaging_id: packaging.id }, transaction: t });
    // await Packaging.destroy({ where: { id: req.params.id }, transaction: t });
    await Packaging.update({ status: 'InActive' }, { where: { id: req.params.id } }, { transaction: t });

    await Stock.destroy({ 
      where: { [Op.or]: cond}, 
      transaction: t
    });

    // if (packaging.status.trim().toUpperCase() === 'APPROVED') {
    //   packaging.id = null;
    //   packaging.status = 'Deleted';
    //   packaging.ref_id = req.params.id;
      
    //   packaging = await Packaging.build({
    //     ...packaging
    //   });

    //   await packaging.save({ transaction: t });

    //   let packagingItems = await PackagingItem.findAll({ 
    //     where: { packaging_id: req.params.id}, 
    //     // attributes: ['packaging_id', 'item_person', 'email_id', 'mobile'], 
    //     raw: true 
    //   });

    //   packagingItems = packagingItems.map(packagingItem => {
    //     // packagingItem.id = null;
    //     delete packagingItem.id;
    //     packagingItem.packaging_id = packaging.id;
    //     return packagingItem;
    //   });

    //   await PackagingItem.bulkCreate(packagingItems, { transaction: t });
      
    //   let packagingOtherCharges = await PackagingOtherCharge.findAll({ 
    //     where: { packaging_id: req.params.id}, 
    //     // attributes: ['packaging_id', 'item_person', 'email_id', 'mobile'], 
    //     raw: true 
    //   });

    //   packagingOtherCharges = packagingOtherCharges.map(packagingOtherCharge => {
    //     // packagingOtherCharge.id = null;
    //     delete packagingOtherCharge.id;
    //     packagingOtherCharge.packaging_id = packaging.id;
    //     return packagingOtherCharge;
    //   });

    //   await PackagingOtherCharge.bulkCreate(packagingOtherCharges, { transaction: t });
      
    //   // const error = await packaging.validateData();
    //   // if (error) {
    //   //   return res.status(422).json({
    //   //     message: "Invalid inputs passed, please check your data.",
    //   //     error: error
    //   //   });
    //   // }
    // } else {
    //   await Packaging.destroy({ where: { id: req.params.id }, transaction: t });
    //   await PackagingItem.destroy({ where: { packaging_id: req.params.id }, transaction: t });
    //   await PackagingOtherCharge.destroy({ where: { packaging_id: req.params.id }, transaction: t });
    // }

    await t.commit();
    
    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Deleting Packaging failed!"
    // });

    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Deleting Packaging failed!";
    next(error, req, res);
  }
};

export const mailPackagingDetails = async (req, res, next) => {
  try {
    await Packaging.mailPackagingDetails(req);

    res.status(200).json({ message: "Packaging details sent successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Sending Packaging details failed!"
    // });

    res.statusCode = 500;
    res.message = "Sending Packaging details failed!";
    next(error, req, res);
  }
};