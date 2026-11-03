import { Op, Sequelize, where } from 'sequelize';
import { getSeries } from '../models/series.js';
import sequelize from '../lib/database.js';
import { getDateString, round } from '../lib/common.js';

import Production from '../models/production.js';
import Depot from '../models/depot.js';
import Product from '../models/product.js';
import User from '../models/user.js';
import BatchProcessing from '../models/batchProcessing.js';
import BatchRawMaterial from '../models/batchRawMaterial.js';
import Stock from '../models/stock.js';
import Recipe from '../models/recipe.js';
import RecipeVariation from '../models/recipeVariation.js';
import Box from '../models/box.js';
import ProductionAllocation from '../models/productionAllocation.js';
import BatchVariation from '../models/batchVariation.js';
import DepotTransfer from '../models/depotTransfer.js';
import ProductionTransfer from '../models/productionTransfer.js';
import ProductionReturn from '../models/productionReturn.js';
import DepotTransferItem from '../models/depotTransferItem.js';
import ProductionRawMaterial from '../models/productionRawMaterial.js';
import ProductionRetain from '../models/productionRetain.js';
import ProductionWaste from '../models/productionWaste.js';
import ProductionRawMaterialRequest from '../models/productionRawMaterialRequest.js';
import RecipeDetail from '../models/recipeDetail.js';
import RawMaterial from '../models/rawMaterial.js';
import RawMaterialInOut from '../models/rawMaterialInOut.js';
import RawMaterialInOutItem from '../models/rawMaterialInOutItem.js';

export const getDepotList = async (req, res, next) => {
  try {
    const data = await Production.getProductionDepotList(req);

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
    const masterData = await Production.getProductionMasterData(null, req);

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

export const getProductionStock = async (req, res, next) => {
  try {
    if (!req.params.manufacturer_id) {
      return res.status(404).json({ message: "Manufacturer not found!" });
    }
    if (!req.params.product_id) {
      return res.status(404).json({ message: "Product not found!" });
    }
    const stock = await Production.getDepotTotalStock(req.params.manufacturer_id, req.params.product_id);

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
    if (!req.params.production_id) {
      return res.status(404).json({ message: "Production Id not found!" });
    }
    if (!req.params.product_id) {
      return res.status(404).json({ message: "Product Id not found!" });
    }
    const production = await Production.findByPk(req.params.production_id, { 
      include: [
        { model: BatchProcessing, as: "productionBatchProcessing" },
        { model: DepotTransfer, as: "productionDepotTransfer" }
      ]
    });
    const stock = await production.getManufacturerTotalStock(req.params.product_id);

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

export const getProductions = async (req, res, next) => {
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
          { 'batch_id_as_per_fssai': {[Op.like]: `%${query}%` } }, 
          Sequelize.literal("`manufacturer`.`depot_name` LIKE '%"+query+"%'"), 
          Sequelize.literal("`depot`.`depot_name` LIKE '%"+query+"%'"), 
          Sequelize.literal("`product`.`product_name` LIKE '%"+query+"%'"), 
          Sequelize.literal("`product`.`short_name` LIKE '%"+query+"%'")
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
      { model: Product, as: 'product', attributes: ['product_name', 'short_name'] }
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
      transferPending: 0
    };
    const data = await Production.findAll(
      { 
        // where: { manufacturer_id: depot_id, depot_id: { [Op.ne]: null } },
        ...condition, 
        attributes: [
          'production_details.status', 
          'production_details.transfer_pending', 
          [sequelize.fn('COUNT', sequelize.col('production_details.id')), 'count']
        ], 
        group:['production_details.status', 'production_details.transfer_pending'], 
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

    const { count, rows } = await Production.findAndCountAll(condition);
    // const rows = 

    res.status(200).json({
      message: "Productions fetched successfully!",
      // totalCount: totalCount,
      total: count,
      statusCount: statusCount,
      rows: rows
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Productions failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Productions failed!";
    next(error, req, res);
  }
};

export const createProduction = async (req, res, next) => {
  let t;
  let batchProcessing = {};
  
  try {
    const production = await Production.build({
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

    production.getRequestData(req);
    
    let error = await production.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    await production.setBatchNo();

    await production.setNoOfBatches();

    const rawMaterialRequests = await production.getRawMaterialRequest();
    
    if (production.p_type.trim().toUpperCase() === 'ESSENTIALS') {
      await production.setProductionTotalStock();
    }
    
    t = await sequelize.transaction();

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

    if (production.use_production_stock) {
      batchProcessing = await BatchProcessing.setProductionData(production);

      batchProcessing.status = 'Approved';
      await batchProcessing.save({ transaction: t });
      
      const depotStock = await Production.getDepotStock(production.manufacturer_id, production.product_id, production.requested_kg);
      for (const stock of depotStock) {
        if (stock.qty > 0) {
          const batchRawMaterial = await BatchRawMaterial.build({
            batch_processing_id: batchProcessing.id,
            raw_material_id: stock.raw_material_id,
            batch_qty: stock.batch_qty,
            qty: stock.qty,
            barcode: stock.barcode,
            expiry_date: stock.expiry_date
          });
        
          await batchRawMaterial.save({ transaction: t });
        }
      }
    }

    await t.commit();

    if (production.use_production_stock) {
      batchProcessing = await BatchProcessing.findByPk(batchProcessing.id, {
        include: [
          { model: BatchRawMaterial, as: "batchProcessingItems" }
        ]
      });

      // t = await sequelize.transaction();
      // await Stock.destroy({ where: { stock_type: 'Batch Processing', batch_processing_id: batchProcessing.id }, transaction: t });
      let dataArray = Stock.setStockDetails('Batch Processing', batchProcessing, t, req);
      if (dataArray && dataArray.length > 0) {
        await Stock.bulkCreate(dataArray);
      }
      // await t.commit();
      // error = await Stock.setStockDetails('Raw Material In', rawMaterialIn, session, req);
      // if (error) throw error;
    }
    
    return res.status(201).json({
      message: "Production added successfully",
      production: production
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Creating a production failed!"
    // });

    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Creating a Production failed!";
    next(error, req, res);
  }
};

export const updateProduction = async (req, res, next) => {
  let t;
  let batchProcessing = {};

  try {
    let production = await Production.findByPk(req.params.id);
    if (!production) {
      return res.status(404).json({message: "Production not found!"});
    }

    if (production.status.trim().toUpperCase() === 'DRAFTED') {
      production.status = 'InProcess';
    }

    production.getRequestData(req);
    
    let error = await production.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    if (production.store_kg > 0 || production.output_kg > 0 || production.retain_kg > 0 || 
      production.return_kg > 0 || production.waste_kg > 0) {
      return res.status(422).json({ 
        message: `Raw material, variation or return already allocated for this Production.`, 
        error : { 
          errors : { 
            production: { message: `Raw material, variation or return already allocated for this Production.` } 
          } 
        }
      });
    }

    if (!production.batch_id_as_per_fssai) {
      await production.setBatchNo();
    }

    await production.setNoOfBatches();
    
    t = await sequelize.transaction();

    if (production.use_production_stock) {
      batchProcessing = await BatchProcessing.setProductionData(production);

      await Stock.destroy({ where: { stock_type: 'Batch Processing', batch_processing_id: batchProcessing.id }, transaction: t });
    } else {
      batchProcessing = await BatchProcessing.findOne({ where: { production_id: production.id } });
      if (batchProcessing) {
        await BatchRawMaterial.destroy({ where: { batch_processing_id: batchProcessing.id }, transaction: t });
        await Stock.destroy({ where: { stock_type: 'Batch Processing', batch_processing_id: batchProcessing.id }, transaction: t });  
      }
    }

    if (production.p_type.trim().toUpperCase() === 'ESSENTIALS') {
      await production.setProductionTotalStock();
    }
    
    if (!production.p_id) {
      const series = await getSeries(req, 'Production');
      production.getProductionNo(series.series);
      await series.save({ transaction: t });
    }

    await production.save({ transaction: t });

    if (production.use_production_stock) {
      batchProcessing = await BatchProcessing.setProductionData(production);

      batchProcessing.status = 'Approved';
      await batchProcessing.save({ transaction: t });

      await BatchRawMaterial.destroy({ where: { batch_processing_id: batchProcessing.id }, transaction: t });

      if (production.p_type.trim().toUpperCase() === 'ESSENTIALS') {
        const depotStock = await Production.getDepotStock(production.manufacturer_id, production.product_id, production.requested_kg);
        for (const stock of depotStock) {
          if (stock.qty > 0) {
            const batchRawMaterial = await BatchRawMaterial.build({
              batch_processing_id: batchProcessing.id,
              raw_material_id: stock.raw_material_id,
              batch_qty: stock.batch_qty,
              qty: stock.qty,
              barcode: stock.barcode,
              expiry_date: stock.expiry_date
            });
            await batchRawMaterial.save({ transaction: t });
          }
        }
      }
    }

    await t.commit();

    if (production.use_production_stock && production.p_type.trim().toUpperCase() === 'ESSENTIALS') {
      batchProcessing = await BatchProcessing.findByPk(batchProcessing.id, {
        include: [
          { model: BatchRawMaterial, as: "batchProcessingItems" }
        ]
      });

      // t = await sequelize.transaction();
      let dataArray = Stock.setStockDetails('Batch Processing', batchProcessing, t, req);
      if (dataArray && dataArray.length > 0) {
        await Stock.bulkCreate(dataArray);
      }
      // await t.commit();
      // error = await Stock.setStockDetails('Raw Material In', rawMaterialIn, session, req);
      // if (error) throw error;
    }

    res.status(200).json({ message: "Update successful!", production: production });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't udpate production!"
    // });

    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't update Production!";
    next(error, req, res);
  }
};

export const getBatchQty = async (req, res, next) => {
  try {
    const production = await Production.findByPk(req.params.id, { 
      include: [
        { model: Product, as: "product", attributes: ['id', 'product_name', 'short_name'] },
        { model: ProductionRawMaterialRequest, as: "productionRawMaterialRequests", include: 'rawMaterial', raw: true }
      ],
      order: [
        [{ model: ProductionRawMaterialRequest, as: "productionRawMaterialRequests" }, 'raw_Material_id', 'ASC']
      ]
    });
    if (!production) {
      return res.status(404).json({ message: "Production not found!" });
    }

    // const product_id = production.product_id;
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

    const stocks = await Stock.getManufacturerTotalStock(production.manufacturer_id);

    const rawMaterialRequests = [];
    for (const productionRawMaterialRequest of production.productionRawMaterialRequests) {
      const stocksFound = stocks.filter(stock => stock.raw_material_id === productionRawMaterialRequest.raw_material_id);
      let stockQty = 0;

      for (const stock of stocksFound) {
        stockQty = round(stockQty + parseFloat(stock.stock_qty), 4);
      }

      // let stockQty = 0;
      // stocks.reduce((stockQty, stock) => {
      //   if (stock.raw_material_id === productionRawMaterialRequest.raw_material_id) {
      //     stockQty = round(stockQty + parseFloat(stock.stock_qty), 4);
      //   }
      // }, stockQty);
      
      if (productionRawMaterialRequest.use_production_stock) {
        productionRawMaterialRequest.available_kg = productionRawMaterialRequest.production_stock_kg ? round(parseFloat(productionRawMaterialRequest.production_stock_kg), 4) : 0;
      } else {
        productionRawMaterialRequest.available_kg = stockQty ? stockQty : 0;
      }
      
      productionRawMaterialRequest.requested_kg = round(productionRawMaterialRequest.requested_kg, 4);
      productionRawMaterialRequest.required_kg = round(productionRawMaterialRequest.required_kg, 4);
      rawMaterialRequests.push(productionRawMaterialRequest);
    }

    const rawMaterial = await RawMaterial.findAll({ where: { status: 'Approved', material_type: 'Raw Material' } });

    return res.status(200).json({ 
      message: "Allocations fetched successfully!", 
      production, 
      rawMaterialRequests, 
      rawMaterial
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Production failed!"
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
    let production = await Production.findByPk(req.params.id);
    if (!production) {
      return res.status(404).json({message: "Production not found!"});
    }

    // if (production.modified_by.toString() !== req.userData.userId.toString()) {
    //   return res.status(422).json({ 
    //     message: `You can't submit this Production.`, 
    //     error : { 
    //       errors : { 
    //         production: { message: `You can't submit this Production.` } 
    //       } 
    //     }
    //   });
    // }

    
    if (production.status.trim().toUpperCase() === 'DRAFTED') {
      production.status = 'InProcess';
    }

    if (production.status.trim().toUpperCase() !== 'INPROCESS') {
      return res.status(422).json({ 
        message: `Production status should be InProcess.`, 
        error : { 
          errors : { 
            production: { message: `Production status should be InProcess.` } 
          } 
        }
      });
    }

    const items = production.getProductionRawMaterialRequests(req);

    const productionRawMaterialRequests = [];
    for(const item of items) {
      const productionRawMaterialRequest = await ProductionRawMaterialRequest.build({
        production_id: production.id
      });
      productionRawMaterialRequest.setRequestData(item);
      error = await productionRawMaterialRequest.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      productionRawMaterialRequests.push(productionRawMaterialRequest);
    }

    t = await sequelize.transaction();

    production.status = 'Waiting';

    await production.save({ transaction: t });

    await ProductionRawMaterialRequest.destroy({ where: { production_id: production.id }, transaction: t });

    for(const productionRawMaterialRequest of productionRawMaterialRequests) {
      productionRawMaterialRequest.production_id = production.id;
      await productionRawMaterialRequest.save({ transaction: t });
    }

    await t.commit();

    res.status(200).json({ message: "Production sent for approval!", production: production });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't udpate production!"
    // });

    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't Update Production!";
    next(error, req, res);
  }
};

export const approveBatchQty = async (req, res, next) => {
  let t;
  let error;

  try {
    let production = await Production.findByPk(req.params.id);
    if (!production) {
      return res.status(404).json({message: "Production not found!"});
    }

    // if (production.modified_by.toString() !== req.userData.userId.toString()) {
    //   return res.status(422).json({ 
    //     message: `You can't submit this Production.`, 
    //     error : { 
    //       errors : { 
    //         production: { message: `You can't submit this Production.` } 
    //       } 
    //     }
    //   });
    // }

    if (production.status.trim().toUpperCase() !== 'WAITING') {
      return res.status(422).json({ 
        message: `Production status should be Waiting.`, 
        error : { 
          errors : { 
            production: { message: `Production status should be Waiting.` } 
          } 
        }
      });
    }

    t = await sequelize.transaction();

    production.status = 'InProcess';

    await production.save({ transaction: t });

    await ProductionRawMaterialRequest.update(
      { approved_kg: sequelize.col('requested_kg') }, 
      { where: { production_id: production.id } }, 
      { transaction: t }
    );

    await t.commit();

    res.status(200).json({ message: "Production Approved Successfully!", production: production });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't approve production!"
    // });

    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't Approve Production!";
    next(error, req, res);
  }
};

export const rejectBatchQty = async (req, res, next) => {
  let t;
  let error;

  try {
    let production = await Production.findByPk(req.params.id);
    if (!production) {
      return res.status(404).json({message: "Production not found!"});
    }

    // if (production.modified_by.toString() !== req.userData.userId.toString()) {
    //   return res.status(422).json({ 
    //     message: `You can't submit this Production.`, 
    //     error : { 
    //       errors : { 
    //         production: { message: `You can't submit this Production.` } 
    //       } 
    //     }
    //   });
    // }

    if (production.status.trim().toUpperCase() !== 'WAITING') {
      return res.status(422).json({ 
        message: `Production status should be Waiting.`, 
        error : { 
          errors : { 
            production: { message: `Production status should be Waiting.` } 
          } 
        }
      });
    }

    t = await sequelize.transaction();

    production.status = 'InProcess';

    await production.save({ transaction: t });

    // await ProductionRawMaterialRequest.update({ approved_kg: requested_kg }, { where: { production_id: production.id } }, { transaction: t });

    await t.commit();

    res.status(200).json({ message: "Production Rejected Successfully!", production: production });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't reject production!"
    // });

    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't Reject Production!";
    next(error, req, res);
  }
};

export const setBatchQty = async (req, res, next) => {
  let t;
  let error = {};
  let batchProcessing = {};
  let useProductionStock = 0;
  let totalProductionStockKg = 0;
  let totalStoreRequestedKg = 0;

  try {
    let production = await Production.findByPk(req.params.id);
    if (!production) {
      return res.status(404).json({message: "Production not found!"});
    }

    // if (production.output_kg > 0 || production.retain_kg > 0 || 
    //   production.return_kg > 0 || production.waste_kg > 0) {
    //   return res.status(422).json({ 
    //     message: `Raw material, variation or return already allocated for this Production.`, 
    //     error : { 
    //       errors : { 
    //         production: { message: `Raw material, variation or return already allocated for this Production.` } 
    //       } 
    //     }
    //   });
    // }

    batchProcessing = await BatchProcessing.setProductionData(production);

    const items = production.getProductionRawMaterials(req);
    const productionRawMaterialRequests = [];
    for(const item of items) {
      const productionRawMaterialRequest = await ProductionRawMaterialRequest.findByPk(item.id);
      
      if (!productionRawMaterialRequest) {
        return res.status(422).json({
          message: "Raw Material Request does not exist.",
          error: { errors : { [item.id]: { message: `Raw Material Request does not exist.` } } }
        });
      }
      error = await productionRawMaterialRequest.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      if (item.use_production_stock) {
        useProductionStock = 1;
      }
      
      productionRawMaterialRequest.use_production_stock = item.use_production_stock;
      productionRawMaterialRequest.production_stock_kg = item.production_stock_kg;

      productionRawMaterialRequests.push(productionRawMaterialRequest);

      if (batchProcessing) {
        await BatchRawMaterial.destroy({ where: { 
          batch_processing_id: batchProcessing.id, 
          raw_material_request_id: productionRawMaterialRequest.id 
        }});
        await Stock.destroy({ where: { 
          stock_type: 'Batch Processing', 
          batch_processing_id: batchProcessing.id 
        }});  
      }
    }

    t = await sequelize.transaction();

    batchProcessing.status = 'Approved';
    await batchProcessing.save({ transaction: t });

    const stocks = await Stock.getManufacturerStock(production.manufacturer_id);

    for (const productionRawMaterialRequest of productionRawMaterialRequests) {
      const stocksFound = stocks.filter(stock => stock.raw_material_id === productionRawMaterialRequest.raw_material_id && stock.stock_qty > 0);
      const approvedKg = round(parseFloat(productionRawMaterialRequest.approved_kg), 4);
      const storeKg = round(parseFloat(productionRawMaterialRequest.store_kg), 4);
      let availableKg = 0;
      let productionStockKg = 0;
      let storeRequestedKg = approvedKg;
      let balanceKg = round(approvedKg - storeKg, 4);
      
      for (const stock of stocksFound) {
        const stockQty = round(parseFloat(stock.stock_qty), 4);

        if (productionRawMaterialRequest.use_production_stock && balanceKg > 0) {
          let qty = 0;
          if (stockQty <= balanceKg) {
            qty = stockQty;
            balanceKg = round(balanceKg - stockQty, 4);
          } else {
            qty = balanceKg;
            balanceKg = 0;
          }

          const batchRawMaterial = await BatchRawMaterial.build({
            batch_processing_id: batchProcessing.id,
            raw_material_id: productionRawMaterialRequest.raw_material_id,
            batch_qty: qty,
            qty: qty,
            barcode: stock.barcode,
            expiry_date: stock.expiry_date,
            raw_material_request_id: productionRawMaterialRequest.id
          });

          await batchRawMaterial.save({ transaction: t });

          productionStockKg = round(productionStockKg + qty, 4);
        }

        availableKg = round(availableKg + stockQty, 4);
      }

      productionRawMaterialRequest.available_kg = availableKg;

      if (productionRawMaterialRequest.use_production_stock) {
        storeRequestedKg = round(approvedKg - productionStockKg, 4);
        
        productionRawMaterialRequest.production_stock_kg = productionStockKg;
        
        totalProductionStockKg = round(totalProductionStockKg + productionStockKg, 4);
      } else {
        productionRawMaterialRequest.production_stock_kg = 0;
      }
      
      productionRawMaterialRequest.store_requested_kg = storeRequestedKg;

      await productionRawMaterialRequest.save({ transaction: t });

      totalStoreRequestedKg = round(totalStoreRequestedKg + storeRequestedKg, 4);
    }

    production.use_production_stock = useProductionStock;
    production.production_stock_kg = totalProductionStockKg;
    production.store_requested_kg = totalStoreRequestedKg;
    production.check_batch_qty = 0;

    if (totalStoreRequestedKg > 0) {
      production.raw_material_request = 1;
      production.transfer = 0;
    }

    production.setTotalKg();
    
    await production.save({ transaction: t });

    await t.commit();

    if (production.use_production_stock) {
      batchProcessing = await BatchProcessing.findByPk(batchProcessing.id, {
        include: [
          { model: BatchRawMaterial, as: "batchProcessingItems" }
        ]
      });

      // t = await sequelize.transaction();
      let dataArray = Stock.setStockDetails('Batch Processing', batchProcessing, t, req);
      await Stock.bulkCreate(dataArray);
      // await t.commit();
      // error = await Stock.setStockDetails('Raw Material In', rawMaterialIn, session, req);
      // if (error) throw error;
    }

    res.status(200).json({ message: "Raw Material Request sent!", production: production });
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

export const getProduction = async (req, res, next) => {
  try {
    const production = await Production.findByPk(req.params.id, { 
      include: [
        { model: Product, as: "product", attributes: ['id', 'product_name', 'short_name'] },
        { model: Depot, as: "manufacturer", attributes: ['id', 'depot_name', 'address', 'city', 'pincode', 'state', 'country', 'gst_no'] },
        { model: Depot, as: "depot", attributes: ['id', 'depot_name', 'address', 'city', 'pincode', 'state', 'country', 'gst_no'] },
        { model: User, as: "created_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
        { model: User, as: "modified_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
        { model: User, as: "approved_by_user", attributes: ['id', 'first_name', 'last_name'] }
      ] 
    });
    if (!production) {
      return res.status(404).json({ message: "Production not found!" });
    }

    const roleDetails = req.userData.roleDetails;

    // console.log(roleDetails);

    const action = {
      update: false,
      delete: false,
      approve: false
    };

    // console.log(production.modified_by.toString());
    // console.log(req.userData.userId);
    
    // if (production.isFreezed) {
    //   if (production.status.trim().toUpperCase() !== 'APPROVED' && production.status.trim().toUpperCase() !== 'INACTIVE') {
    //     if (roleDetails.r_edit) {
    //       action.update = true;
    //     }
    //     if (roleDetails.r_delete) {
    //       action.delete = true;
    //     }
    //   }
    // } else {
      if (!roleDetails.r_approvals || 
            (production.status.trim().toUpperCase() !== 'PENDING' && 
            production.status.trim().toUpperCase() !== 'DELETED') || 
            production.modified_by.toString() === req.userData.userId.toString()) 
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

    const masterData = await Production.getProductionMasterData(production, req);
  
    return res.status(200).json({ 
      message: "Production fetched successfully!",
      action, 
      production, 
      masterData 
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Production failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Production failed!";
    next(error, req, res);
  }
};

export const getAllocations = async (req, res, next) => {
  try {
    const production = await Production.findByPk(req.params.id, { 
      include: [
        { model: Product, as: "product", attributes: ['id', 'product_name', 'short_name'] },
        { model: ProductionAllocation, as: "productionAllocations" }
      ]
    });
    if (!production) {
      return res.status(404).json({ message: "Production not found!" });
    }

    // Code By Saurabh


    let rawMaterialInOutItems = [];

    const rawMaterialInOut = await RawMaterialInOut.findOne({
      where: {
        production_id: req.params.id
      }
    });

    // console.log("rawMaterialInOut", rawMaterialInOut);
    if(rawMaterialInOut){
      rawMaterialInOutItems = await RawMaterialInOutItem.findAll({
        where:{
          raw_material_in_out_id:rawMaterialInOut.id
        }
      });
    }else{
      rawMaterialInOutItems = [];
    }

    // console.log("rawMaterialInOutItems", rawMaterialInOutItems);
    
    // Code By Saurabh


    const product_id = production.product_id;
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
      const productionAllocations = production.productionAllocations.filter(productionAllocation => productionAllocation.box_id === recipeVariation.box.id);
      data.push({ box: recipeVariation.box, productionAllocations });
    }

    return res.status(200).json({ 
      message: "Allocations fetched successfully!", 
      data, 
      production,
      rawMaterialInOutItems
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Production failed!"
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
    let production = await Production.findByPk(req.params.id);
    if (!production) {
      return res.status(404).json({message: "Production not found!"});
    }

    const items = production.getProductionAllocations(req);


    // Code By Saurabh
    
    let rawMaterialInOut = await RawMaterialInOut.findOne({
      where:{
        production_id:req.params.id
      }
    });
    
    if (!rawMaterialInOut) {
      rawMaterialInOut = await RawMaterialInOut.build({
        status: 'Approved',
        created_by: req.userData.userId,
        created_on: new Date().toISOString(),
        modified_by: req.userData.userId,
        modified_on: new Date().toISOString()
      });
    }else{
      rawMaterialInOut.modified_by = req.userData.userId;
      rawMaterialInOut.modified_on = new Date().toISOString();
    }
    

    // console.log(req.body);

    rawMaterialInOut.getRequestData(req);
    rawMaterialInOut.production_id = req.body.production_id;
    
    let error = await rawMaterialInOut.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }
    
    const rawitems = rawMaterialInOut.getRawMaterialInOutItems(req.body);
    
    // if (rawitems.length === 0) {
    //   return res.status(422).json({
    //     message: "Please insert atleast one Item."
    //   });
    // }
    

    // Code By Saurabh

    // if (production.output_kg > production.total_kg) {
    //   return res.status(422).json({
    //     message: "Cannot Allocate more than store assembled quantity.",
    //     error: { 
    //       errors : { 
    //         production: { message: `Cannot Allocate more than store assembled quantity.` } 
    //       } 
    //     }
    //   });
    // }

    if (production.output_kg < production.transferred_kg) {
      return res.status(422).json({
        message: "Cannot Allocate less than store transferred quantity.",
        error: { 
          errors : { 
            production: { message: `Cannot Allocate less than store transferred quantity.` } 
          } 
        }
      });
    }

    const productionAllocations = [];
    let output_kg = 0;
    for(const item of items) {
      const productionAllocation = await ProductionAllocation.build({
        production_id: production.id
      });
      productionAllocation.getRequestData(item);
      error = await productionAllocation.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      await productionAllocation.setVariationDetails();
      productionAllocations.push(productionAllocation);
      output_kg = round(output_kg + parseFloat(productionAllocation.total_kg), 4);
    }

    production.output_kg = output_kg;

    production.setProcessLoss();

    // error = await production.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }

    let batchProcessing = await BatchProcessing.setProductionData(production);

    t = await sequelize.transaction();

    // Code By Saurabh

    const rawMaterialInOutItems = [];
    for(const item of rawitems) {
      if(item.id == null){
        const rawMaterialInOutItem = await RawMaterialInOutItem.build({
          ...item
        });
        error = await rawMaterialInOutItem.validateData();
        if (error) {
          return res.status(422).json({
            message: "Invalid inputs passed, please check your data.",
            error: error
          });
        }
  
        await rawMaterialInOutItem.setItemDetails();
        rawMaterialInOutItems.push(rawMaterialInOutItem);
      }else{
        const rawMaterialInOutItem = await RawMaterialInOutItem.findOne({
          where:{id:item.id}
        })
          
          rawMaterialInOutItem.raw_material_id= item.raw_material_id,
          rawMaterialInOutItem.qty= item.qty,
          rawMaterialInOutItem.barcode= item.barcode,
          rawMaterialInOutItem.expiry_date= item.expiry_date,
        await rawMaterialInOutItem.setItemDetails();
        rawMaterialInOutItems.push(rawMaterialInOutItem);
      }
      // rawMaterialInOutItem.getRequestData(item);
    }

    await rawMaterialInOut.setDetails(rawMaterialInOutItems);

    await rawMaterialInOut.save({ transaction: t });

    // if (blUpdate === true) {
    //   await RawMaterialInOutItem.destroy({ where: { raw_material_in_out_id: rawMaterialInOut.id }, transaction: t });
    // }

    for(const rawMaterialInOutItem of rawMaterialInOutItems) {
      if(rawMaterialInOutItem.id == null){
        rawMaterialInOutItem.raw_material_in_out_id = rawMaterialInOut.id;
        await rawMaterialInOutItem.save({ transaction: t });
      }else{
        await RawMaterialInOutItem.update({
          raw_material_id:rawMaterialInOutItem.raw_material_id,
          rm_name:rawMaterialInOutItem.rm_name,
          qty:rawMaterialInOutItem.qty,
        }, {
          where:{id:rawMaterialInOutItem.id},
          transaction:t
        })
      }
    }

    // Code By Saurabh

    await Stock.destroy({ where: { stock_type: 'Batch Packaging', batch_processing_id: batchProcessing.id }, transaction: t });

    await production.save({ transaction: t });

    batchProcessing.status = 'Approved';
    await batchProcessing.save({ transaction: t });

    await ProductionAllocation.destroy({ where: { production_id: production.id }, transaction: t });
    // await BatchVariation.destroy({ where: { batch_processing_id: batchProcessing.id }, transaction: t });

    for(const productionAllocation of productionAllocations) {
      productionAllocation.production_id = production.id;
      await productionAllocation.save({ transaction: t });

      // const batchVariation = await BatchVariation.build({
      //   batch_processing_id: batchProcessing.id
      // });
      // batchVariation.getRequestData(productionAllocation);
      // await batchVariation.save({ transaction: t });
    }

    await t.commit();

    // batchProcessing = await BatchProcessing.findByPk(batchProcessing.id, {
    //   include: [
    //     // { model: Production, as: "production" },
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

    res.status(200).json({ message: "Allocate successful!", production: production, rawMaterialInOut: rawMaterialInOut });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't udpate production!"
    // });

    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't Allocate Production!";
    next(error, req, res);
  }
};

export const getTransfers = async (req, res, next) => {
  try {
    const production = await Production.findByPk(req.params.id, { 
      include: [
        { model: Product, as: "product", attributes: ['id', 'product_name', 'short_name'] },
        { model: ProductionAllocation, as: "productionAllocations" },
        { model: ProductionTransfer, as: "productionTransfers" }
      ]
    });
    if (!production) {
      return res.status(404).json({ message: "Production not found!" });
    }

    const product_id = production.product_id;
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
      const isAllocated = production.productionAllocations.some(productionAllocation => productionAllocation.box_id === recipeVariation.box.id);
      
      if (isAllocated) {
        let boxAllocatedQty = 0;
        production.productionAllocations.forEach(productionAllocation => {
          if (productionAllocation.box_id === recipeVariation.box.id) {
            boxAllocatedQty = round(boxAllocatedQty + productionAllocation.qty, 2);
          }
        });
        
        const productionTransfers = production.productionTransfers.filter(productionTransfer => productionTransfer.box_id === recipeVariation.box.id);
        const productionAllocations = production.productionAllocations.filter(productionAllocation => productionAllocation.box_id === recipeVariation.box.id);
        data.push({ box: recipeVariation.box, boxAllocatedQty, productionTransfers, productionAllocations });
      }
    }

    const depots = await Depot.findAll({ where: { status: 'Approved', id: { [Op.ne]: production.manufacturer_id }, id: {[Op.in]: req.userData.depotIds} } });

    return res.status(200).json({ 
      message: "Transfers fetched successfully!", 
      data, 
      depots, 
      production
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
    let production = await Production.findByPk(req.params.id, { 
      include: [
        { model: Product, as: "product", attributes: ['id', 'product_name', 'short_name'] },
        { model: ProductionAllocation, as: "productionAllocations" },
        { model: ProductionTransfer, as: "productionTransfers" }
      ]
    });
    if (!production) {
      return res.status(404).json({message: "Production not found!"});
    }

    const items = production.getTransfers(req);
    if (items.length === 0) {
      return res.status(404).json({message: "Please insert items to transfer!"});
    }

    if (!production.store_id) {
      return res.status(404).json({message: "Please select depot to transfer!"});
    }

    error = await production.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    const productionTransfers = [];
    let transferred_kg = 0;
    for(const item of items) {
      const isAllocated = production.productionAllocations.some(productionAllocation => productionAllocation.box_id === item.box_id);
      if (!isAllocated) {
        return res.status(422).json({
          message: "Entered box is not allocated in this production.",
          error: { 
            errors : { 
              production: { message: `Entered box is not allocated in this production.` } 
            } 
          }
        });
      }

      let boxAllocatedQty = 0;
      production.productionAllocations.forEach(productionAllocation => {
        if (productionAllocation.box_id === item.box_id) {
          boxAllocatedQty = round(boxAllocatedQty + productionAllocation.qty, 4);
        }
      });
      let boxTransferredQty = 0;
      production.productionTransfers.forEach(productionTransfer => {
        if (productionTransfer.box_id === item.box_id && productionTransfer.id != item.id) {
          boxTransferredQty = round(boxTransferredQty + productionTransfer.qty, 4);
        }
      });

      if (boxAllocatedQty < (round(boxTransferredQty + item.qty, 4))) {
        return res.status(422).json({
          message: "Cannot transfer more than allocated quantity.",
          error: { 
            errors : { 
              production: { message: `Cannot transfer more than allocated quantity.` } 
            } 
          }
        });
      }

      let productionTransfer = {};

      if (item.id) {
        productionTransfer = await ProductionTransfer.findByPk(item.id);
      } else {
        productionTransfer = await ProductionTransfer.build({
          production_id: production.id
        });
      }
      productionTransfer.getRequestData(item);
      error = await productionTransfer.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      await productionTransfer.setVariationDetails();
      productionTransfers.push(productionTransfer);
      transferred_kg = round(transferred_kg + productionTransfer.total_kg, 4);
    }

    // production.transferred_kg = round(parseFloat(production.transferred_kg) + transferred_kg, 4);

    // let depotTransfer = null;
    // if (productionTransfers.length > 0) {
    //   depotTransfer = await DepotTransfer.setProductionData(production, 'Box');
    // }
    
    // let depotTransferDetails = await DepotTransfer.setProductionTransfer(production, productionTransfers);

    // error = await depotTransfer.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }

    t = await sequelize.transaction();

    // production.setTransferPending();
    // await production.save({ transaction: t });

    if (productionTransfers.length > 0) {
      // depotTransfer.status = 'Approved';
      // depotTransfer.status = 'Pending';
      // await depotTransfer.save({ transaction: t });

      // await DepotTransferItem.destroy({ where: { depot_transfer_id: depotTransfer.id }, transaction: t });

      // await ProductionTransfer.destroy({ where: { production_id: production.id }, transaction: t });

      for(const productionTransfer of productionTransfers) {
        // productionTransfer.depot_transfer_id = depotTransfer.id;
        await productionTransfer.save({ transaction: t });

        // const depotTransferItem = await DepotTransferItem.build({
        //   depot_transfer_id: depotTransfer.id
        // });
        // depotTransferItem.setStoreTransfer(productionTransfer);
        // await depotTransferItem.save({ transaction: t });
      }
    }

    await production.save({ transaction: t });

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
    //     production_id: production.id, 
    //     transfer_type: 'Box'
    //   },
    //   attributes: ['id'],
    //   raw: true
    // });

    // await DepotTransferItem.destroy({ where: { depot_transfer_id: { [Op.in]: depotTransfers.id } }, transaction: t });
    // await DepotTransfer.destroy({ where: { id: { [Op.in]: depotTransfers.id } }, transaction: t });
    await t.commit();


    production = await Production.findByPk(req.params.id, { 
      include: [
        { model: Product, as: "product", attributes: ['id', 'product_name', 'short_name'] },
        { model: ProductionAllocation, as: "productionAllocations" },
        { model: ProductionTransfer, as: "productionTransfers" }
      ]
    });
    production.setTransferPending();
    await production.save();

    
    // depotTransfers = await DepotTransfer.findAll({
    //   where: { production_id: production.id, transfer_type: 'Box' }, 
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

    res.status(200).json({ message: "Transfer successful!", production: production });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't udpate production!"
    // });

    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't Transfer Production!";
    next(error, req, res);
  }
};

export const getReturns = async (req, res, next) => {
  try {
    const production = await Production.findByPk(req.params.id, { 
      include: [
        { model: Product, as: "product", attributes: ['id', 'product_name', 'short_name'] },
        { 
          model: BatchProcessing, 
          as: "productionBatchProcessing", 
          include: [{ model: BatchRawMaterial, as: "batchProcessingItems", include: 'rawMaterial' }]
        },
        { model: ProductionReturn, as: "productionReturns", include: 'rawMaterial' },
        { model: ProductionWaste, as: "productionWastes", include: 'rawMaterial' },
        { model: ProductionRetain, as: "productionRetains", include: 'rawMaterial' }
      ]
    });
    if (!production) {
      return res.status(404).json({ message: "Production not found!" });
    }

    // console.log(production);

    const rawMaterials = [];
    if (production.productionBatchProcessing && production.productionBatchProcessing.length > 0) {
      if (production.productionBatchProcessing[0].batchProcessingItems && production.productionBatchProcessing[0].batchProcessingItems.length > 0) {
        for (const batchProcessingItem of production.productionBatchProcessing[0].batchProcessingItems) {
          if (batchProcessingItem.waste || batchProcessingItem.retain || batchProcessingItem.return) {
            continue;
          }

          let index = rawMaterials.findIndex(rawMaterial => rawMaterial.raw_material_id === batchProcessingItem.raw_material_id);

          if (index !== -1) {
            let index2 = rawMaterials[index].barcodes.findIndex(barcode => barcode.barcode == batchProcessingItem.barcode);

            if (index2 !== -1) {
              rawMaterials[index].barcodes[index2].available_qty = rawMaterials[index].barcodes[index2].available_qty + (batchProcessingItem.qty ? +batchProcessingItem.qty : 0);
            } else {
              rawMaterials[index].barcodes.push({
                barcode: batchProcessingItem.barcode ? batchProcessingItem.barcode : '', 
                expiry_date: batchProcessingItem.expiry_date ? batchProcessingItem.expiry_date : '', 
                available_qty: batchProcessingItem.qty ? +batchProcessingItem.qty : 0
              });
            }
          } else {
            const rawMaterial = {
              raw_material_id: batchProcessingItem.raw_material_id, 
              rm_name: batchProcessingItem.rawMaterial && batchProcessingItem.rawMaterial.rm_name ? batchProcessingItem.rawMaterial.rm_name : '', 
              barcodes: [{
                barcode: batchProcessingItem.barcode ? batchProcessingItem.barcode : '', 
                expiry_date: batchProcessingItem.expiry_date ? batchProcessingItem.expiry_date : '', 
                available_qty: batchProcessingItem.qty ? +batchProcessingItem.qty : 0
              }]
            };

            rawMaterials.push(rawMaterial);
          }
        }
      }
    }

    return res.status(200).json({ 
      message: "Returns fetched successfully!", 
      production, 
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
    let production = await Production.findByPk(req.params.id);
    if(!production) {
      return res.status(404).json({message: "Production not found!"});
    }

    // const item = production.getWasteData(req);
    
    const items = production.getStoreReturns(req.body);

    let waste_kg = 0;
    for(const item of items) {
      const data = await production.checkBarcode(item.barcode, 'WASTE');

      if (!data.raw_material_id) {
        return res.status(422).json({
          message: "Barcode does not found in batch processing.",
          error: { 
            errors : { 
              production: { message: `Barcode does not found in batch processing.` } 
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
              production: { message: `Cannot waste more than allocated quantity.` } 
            } 
          }
        });
      }

      waste_kg = round(waste_kg + item.qty, 4);
    }

    production.waste_kg = waste_kg;

    // if (production.waste_kg > round(production.total_kg - production.output_kg - production.return_kg - production.retain_kg, 4)) {
    //   return res.status(422).json({
    //     message: "Cannot Waste more than balance quantity.",
    //     error: { 
    //       errors : { 
    //         production: { message: `Cannot Waste more than balance quantity.` } 
    //       } 
    //     }
    //   });
    // }

    // const productionWaste = await ProductionWaste.build({
    //   production_id: production.id
    // });
    // productionWaste.setWasteData(item);

    // error = await productionWaste.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }

    const productionWastes = [];
    for(const item of items) {
      const productionWaste = await ProductionWaste.build({
        production_id: production.id
      });
      productionWaste.setWasteData(item);
      error = await productionWaste.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      // await productionWaste.setItemAmount();
      productionWastes.push(productionWaste);
    }

    production.setProcessLoss();

    let rawMaterialInOut = await RawMaterialInOut.setProductionData(production, 'Waste');

    let batchProcessing = await BatchProcessing.setProductionData(production);

    t = await sequelize.transaction();

    // await Stock.destroy({ where: { stock_type: 'Production Waste', production_id: production.id }, transaction: t });

    await ProductionWaste.destroy({ where: { production_id: production.id }, transaction: t });

    await RawMaterialInOutItem.destroy({ where: { raw_material_in_out_id: rawMaterialInOut.id }, transaction: t });

    await BatchRawMaterial.destroy({ where: { batch_processing_id: batchProcessing.id, waste: 1 }, transaction: t });

    await production.save({ transaction: t });
    
    rawMaterialInOut.status = 'Approved';
    await rawMaterialInOut.save({ transaction: t });

    batchProcessing.status = 'Approved';
    await batchProcessing.save({ transaction: t });

    // await productionWaste.save({ transaction: t });

    const rawMaterialInOutItems = [];
    for (const productionWaste of productionWastes) {
      productionWaste.production_id = production.id;
      await productionWaste.save({ transaction: t });

      const rawMaterialInOutItem = await RawMaterialInOutItem.build({
        raw_material_in_out_id: rawMaterialInOut.id
      });
      rawMaterialInOutItem.setProductionReturn(productionWaste);
      await rawMaterialInOutItem.setItemDetails();
      await rawMaterialInOutItem.save({ transaction: t });
      rawMaterialInOutItems.push(rawMaterialInOutItem);
      
      const batchRawMaterial = await BatchRawMaterial.build({
        batch_processing_id: batchProcessing.id,
        waste: 1
      });
      batchRawMaterial.setProductionReturn(productionWaste);
      await batchRawMaterial.save({ transaction: t });
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

    batchProcessing = await BatchProcessing.findByPk(batchProcessing.id, {
      include: [
        { model: BatchRawMaterial, as: "batchProcessingItems" }
      ]
    });
    await Stock.destroy({ where: { stock_type: 'Batch Processing', batch_processing_id: batchProcessing.id }});
    dataArray = Stock.setStockDetails('Batch Processing', batchProcessing, t, req);
    await Stock.bulkCreate(dataArray);

    // production = await Production.findByPk(production.id, {
    //   include: [
    //     { model: ProductionWaste, as: "productionWastes" }
    //   ]
    // });
    
    // // t = await sequelize.transaction();
    // await Stock.destroy({ where: { stock_type: 'Production Waste', production_id: production.id }});
    // let dataArray = Stock.setStockDetails('Production Waste', production, t, req);
    // Stock.bulkCreate(dataArray);
    // // await t.commit();
    // // error = await Stock.setStockDetails('Production Waste', rawMaterialIn, session, req);
    // // if (error) throw error;

    return res.status(200).json({ 
      message: "Waste successful!", 
      production
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
    let production = await Production.findByPk(req.params.id);
    if(!production) {
      return res.status(404).json({message: "Production not found!"});
    }

    // const item = production.getRetainData(req);
    
    const items = production.getStoreReturns(req.body);

    let retain_kg = 0;
    for(const item of items) {
      const data = await production.checkBarcode(item.barcode, 'RETAIN');

      if (!data.raw_material_id) {
        return res.status(422).json({
          message: "Barcode does not found in batch processing.",
          error: { 
            errors : { 
              production: { message: `Barcode does not found in batch processing.` } 
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
              production: { message: `Cannot retain more than allocated quantity.` } 
            } 
          }
        });
      }

      retain_kg = round(retain_kg + item.qty, 4);
    }

    production.retain_kg = retain_kg;

    // if (production.retain_kg > round(production.total_kg - production.output_kg - production.return_kg - production.waste_kg, 4)) {
    //   return res.status(422).json({
    //     message: "Cannot Retain more than balance quantity.",
    //     error: { 
    //       errors : { 
    //         production: { message: `Cannot Retain more than balance quantity.` } 
    //       } 
    //     }
    //   });
    // }

    // const productionRetain = await ProductionRetain.build({
    //   production_id: production.id
    // });
    // productionRetain.setRetainData(item);

    // error = await productionRetain.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }

    
    const productionRetains = [];
    for(const item of items) {
      const productionRetain = await ProductionRetain.build({
        production_id: production.id
      });
      productionRetain.setRetainData(item);
      error = await productionRetain.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      // await productionRetain.setItemAmount();
      productionRetains.push(productionRetain);
    }

    production.setProcessLoss();

    let batchProcessing = await BatchProcessing.setProductionData(production);

    t = await sequelize.transaction();

    await Stock.destroy({ where: { stock_type: 'Production Retain', production_id: production.id }, transaction: t });

    await ProductionRetain.destroy({ where: { production_id: production.id }, transaction: t });

    await BatchRawMaterial.destroy({ where: { batch_processing_id: batchProcessing.id, retain: 1 }, transaction: t });

    await production.save({ transaction: t });
    
    batchProcessing.status = 'Approved';
    await batchProcessing.save({ transaction: t });

    // await productionRetain.save({ transaction: t });

    for (const productionRetain of productionRetains) {
      productionRetain.production_id = production.id;
      await productionRetain.save({ transaction: t });

      const batchRawMaterial = await BatchRawMaterial.build({
        batch_processing_id: batchProcessing.id,
        retain: 1
      });
      batchRawMaterial.setProductionReturn(productionRetain);
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
    
    production = await Production.findByPk(production.id, {
      include: [
        { model: ProductionRetain, as: "productionRetains" }
      ]
    });
    // // t = await sequelize.transaction();
    // await Stock.destroy({ where: { stock_type: 'Production Retain', production_id: production.id } });
    // dataArray = Stock.setStockDetails('Production Retain', production, t, req);
    // Stock.bulkCreate(dataArray);
    // // await t.commit();
    // // error = await Stock.setStockDetails('Raw Material In', rawMaterialIn, session, req);
    // // if (error) throw error;

    return res.status(200).json({ 
      message: "Retain successful!", 
      production
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
    let production = await Production.findByPk(req.params.id);
    if(!production) {
      return res.status(404).json({message: "Production not found!"});
    }

    production.getReturnData(req);

    // const item = production.getReturnData(req);
    // if (production.return_kg > (production.total_kg - production.output_kg)) {
    //   return res.status(422).json({
    //     message: "Cannot Return more than balance quantity.",
    //     error: { 
    //       errors : { 
    //         production: { message: `Cannot Return more than balance quantity.` } 
    //       } 
    //     }
    //   });
    // }

    // let productionReturn = {}
    // if (!production.return_raw_material) {
    //   productionReturn = await ProductionReturn.build({
    //     production_id: production.id
    //   });
    //   productionReturn.setReturnData(item);
  
    //   error = await productionReturn.validateData();
    //   if (error) {
    //     return res.status(422).json({
    //       message: "Invalid inputs passed, please check your data.",
    //       error: error
    //     });
    //   }
    // }

    // production.setProcessLoss();

    t = await sequelize.transaction();

    // await Stock.destroy({ where: { stock_type: 'Production Return', production_id: production.id }, transaction: t });

    // // await ProductionReturn.destroy({ where: { production_id: production.id }, transaction: t });

    // if (!production.return_raw_material) {
    //   await productionReturn.save({ transaction: t });
    // }

    await production.save({ transaction: t });
    
    await t.commit();

    // if (!production.return_raw_material) {
    //   production = await Production.findByPk(production.id, {
    //     include: [
    //       { model: ProductionReturn, as: "productionReturns" }
    //     ]
    //   });

    //   // t = await sequelize.transaction();
    //   let dataArray = Stock.setStockDetails('Production Return', production, t, req);
    //   Stock.bulkCreate(dataArray);
    //   // await t.commit();
    //   // error = await Stock.setStockDetails('Raw Material In', rawMaterialIn, session, req);
    //   // if (error) throw error;
    // }

    return res.status(200).json({ 
      message: "Return successful!", 
      production
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
    let production = await Production.findByPk(req.params.id);

    if (!production) {
      return res.status(404).json({
        message: "Production not found!"
      });
    }

    // if (production.modified_by.toString() !== req.userData.userId.toString()) {
    //   return res.status(422).json({ 
    //     message: `You can't submit this Production.`, 
    //     error : { 
    //       errors : { 
    //         production: { message: `You can't submit this Production.` } 
    //       } 
    //     }
    //   });
    // }

    if (production.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({ 
        message: `Production is already approved.`, 
        error : { 
          errors : { 
            production: { message: `Production is already approved.` } 
          } 
        }
      });
    }

    production.setAllocationPending(req);
    await production.save();

    res.status(200).json({ message: "Production set as Pending Allocation!", production });
  } catch (error) {
    // res.status(500).json({
    //   message: "Production Pending Allocation failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Production Pending Allocation failed!";
    next(error, req, res);
  }
};

export const workInProgress = async (req, res, next) => {
  try {
    let production = await Production.findByPk(req.params.id);

    if (!production) {
      return res.status(404).json({
        message: "Production not found!"
      });
    }

    // if (production.modified_by.toString() !== req.userData.userId.toString()) {
    //   return res.status(422).json({ 
    //     message: `You can't submit this Production.`, 
    //     error : { 
    //       errors : { 
    //         production: { message: `You can't submit this Production.` } 
    //       } 
    //     }
    //   });
    // }

    if (production.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({ 
        message: `Production is already approved.`, 
        error : { 
          errors : { 
            production: { message: `Production is already approved.` } 
          } 
        }
      });
    }

    production.setWorkInProgress(req);
    await production.save();

    res.status(200).json({ message: "Production set as Work In Progress!", production });
  } catch (error) {
    // res.status(500).json({
    //   message: "Production Work In Progress failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Production Work In Progress failed!";
    next(error, req, res);
  }
};

export const submitProduction = async (req, res, next) => {
  try {
    let production = await Production.findByPk(req.params.id, { 
      include: [
        { model: Product, as: "product", attributes: ['id', 'product_name', 'short_name'] },
        { model: ProductionAllocation, as: "productionAllocations" },
        { model: ProductionTransfer, as: "productionTransfers" }
      ]
    });

    if (!production) {
      return res.status(404).json({
        message: "Production not found!"
      });
    }

    // if (production.modified_by.toString() !== req.userData.userId.toString()) {
    //   return res.status(422).json({ 
    //     message: `You can't submit this Production.`, 
    //     error : { 
    //       errors : { 
    //         production: { message: `You can't submit this Production.` } 
    //       } 
    //     }
    //   });
    // }

    if (production.output_kg <= 0 && ((round((production.retain_kg + production.return_kg + production.waste_kg), 4)) != production.total_kg || production.total_kg <= 0)) {
      return res.status(422).json({ 
        message: `Cannot send production for approval.`, 
        error : { 
          errors : { 
            production: { message: `Cannot send production for approval.` } 
          } 
        }
      });
    }

    if (production.status.trim().toUpperCase() === 'PENDING') {
      return res.status(422).json({ 
        message: `Production is already sent for approval.`, 
        error : { 
          errors : { 
            production: { message: `Production is already sent for approval.` } 
          } 
        }
      });
    }

    if (production.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({ 
        message: `Production is already approved.`, 
        error : { 
          errors : { 
            production: { message: `Production is already approved.` } 
          } 
        }
      });
    }

    production.submit(req);
    production.setTransferPending();
    await production.save();

    res.status(200).json({ message: "Production sent for approval!", production });
  } catch (error) {
    // res.status(500).json({
    //   message: "Submitting Production failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Submitting Production failed!";
    next(error, req, res);
  }
};

export const approveProduction = async (req, res, next) => {
  let t;

  try {
    let production = await Production.findByPk(req.params.id, {
      include: [
        { model: BatchProcessing, as: "productionBatchProcessing", attributes: ['id'] },
        { model: DepotTransfer, as: "productionDepotTransfer", attributes: ['id'] }
      ]
    });
    if (!production) {
      return res.status(404).json({
        message: "Production not found!"
      });
    }

    if (production.modified_by === req.userData.userId) {
      return res.status(422).json({ 
        message: `You can't approve this Production.`, 
        error : { 
          errors : { 
            production: { message: `You can't approve this Production.` } 
          } 
        }
      });
    }

    // console.log(production);

    if (production.status.trim().toUpperCase() !== 'PENDING' && production.status.trim().toUpperCase() !== 'DELETED') {
      return res.status(422).json({ 
        message: `Production status should be pending or deleted.`, 
        error : { 
          errors : { 
            production: { message: `Production status should be pending or deleted.` } 
          } 
        }
      });
    }

    production.approve(req);

    // console.log(error);
    // production.approvedBy = req.userData.userId;
    // production.approvedAt = new Date().toISOString();

    // const error = await production.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }

    // try {
      t = await sequelize.transaction();
      
      // if (!production.p_id) {
      //   const series = await getSeries(req, 'Production');
      //   production.getProductionNo(series.series);
      //   await series.save({ transaction: t });
      // }

      await production.save({ transaction: t });

      await BatchProcessing.update(
        {
          status: production.status,
          approved_by: production.approved_by,
          approved_on: production.approved_on
        },
        {
          where: {
            production_id: production.id
          }
        },
        { transaction: t }
      );
      
      await DepotTransfer.update(
        {
          status: production.status,
          // approved_by: production.approved_by,
          // approved_on: production.approved_on
        },
        {
          where: {
            production_id: production.id
          }
        },
        { transaction: t }
      );

      const batchProcessingIds = production.productionBatchProcessing.map(batchProcessing => batchProcessing.id);
      const depotTransferIds = production.productionDepotTransfer.map(depotTransfer => depotTransfer.id);
      
      await Stock.update(
        {
          status: production.status,
          approved_by: production.approved_by,
          approved_on: production.approved_on
        },
        {
          where: {
            [Op.or] : [
              { production_id: production.id },
              { batch_processing_id: batchProcessingIds },
              { depot_transfer_id: depotTransferIds }
            ]
          }
        },
        { transaction: t }
      );
      
      // if (!production.ref_id) {
      //   await production.save({ transaction: t });
      // } else {
      //   // const obj = JSON.parse(JSON.stringify(production));
      //   // delete obj._id;
      //   // obj.ref_id = null;

      //   const ref_id = production.ref_id;

      //   const obj = production.dataValues;
      //   delete obj.id;
      //   obj.ref_id = null;

      //   // console.log(obj);
      //   // console.log(ref_id);
      //   // console.log(req.params.id);

      //   await Production.destroy({ where: {id: req.params.id }}, { transaction: t });

      //   // production = await Production.findByIdAndUpdate(ref_id, obj, { session: session, new: true });

      //   await Production.update(obj, { where: { id: ref_id } }, { transaction: t });

      //   await ProductionRawMaterial.destroy({ where: {production_id: ref_id }}, { transaction: t });

      //   await ProductionRawMaterial.update({ production_id: ref_id }, { where: { production_id: req.params.id }}, { transaction: t });

      //   await ProductionOtherCharge.destroy({ where: {production_id: ref_id }}, { transaction: t });

      //   await ProductionOtherCharge.update({ production_id: ref_id }, { where: { production_id: req.params.id }}, { transaction: t });

      //   // originalProduction = await Production.findById(production.ref_id);
      //   // originalProduction.overwrite(production);
      //   // originalProduction.ref_id = null;
      //   // originalProduction.productState = production.productState;
      //   // // console.log(originalProduction);
      //   // await originalProduction.save({ session });
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
    //   message: 'Approving Production failed! Error - ' + (error.message ? error.message : '')
    // });
    
    res.statusCode = 500;
    res.message = "Approving Production failed!";
    next(error, req, res);
  }
};

export const rejectProduction = async (req, res, next) => {
  try {
    let production = await Production.findByPk(req.params.id);

    if (!production) {
      return res.status(404).json({
        message: "Production not found!"
      });
    }

    if (production.modified_by.toString() === req.userData.userId.toString()) {
      return res.status(422).json({ 
        message: `You can't reject this Production.`, 
        error : { 
          errors : { 
            production: { message: `You can't reject this Production.` } 
          } 
        }
      });
    }

    if (production.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({ 
        message: `Production is already approved.`, 
        error : { 
          errors : { 
            production: { message: `Production is already approved.` } 
          } 
        }
      });
    }

    if (production.status.trim().toUpperCase() !== 'PENDING' && production.status.trim().toUpperCase() !== 'DELETED') {
      return res.status(422).json({ 
        message: `Production status should be pending or deleted.`, 
        error : { 
          errors : { 
            production: { message: `Production status should be pending or deleted.` } 
          } 
        }
      });
    }

    production.reject(req);
    await production.save();

    res.status(200).json({ message: "Reject successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Rejecting Production failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Rejecting Production failed!";
    next(error, req, res);
  }
};

export const deleteProduction = async (req, res, next) => {
  let t;

  try {
    let production = await Production.findByPk(req.params.id, {
      include: [
        { model: BatchProcessing, as: "productionBatchProcessing" },
        { model: DepotTransfer, as: "productionDepotTransfer" }
      ]
    });
    if (!production) {
      return res.status(404).json({ message: "Production not found!" });
    }

    // if (production.modified_by.toString() !== req.userData.userId.toString()) {
    //   return res.status(422).json({ 
    //     message: `You can't delete this Production.`, 
    //     error : { 
    //       errors : { 
    //         production: { message: `You can't delete this Production.` } 
    //       } 
    //     }
    //   });
    // }
    
    if (production.status.trim().toUpperCase() === 'DRAFTED') {
      production.status = 'InProcess';
    }

    if (production.status.trim().toUpperCase() !== 'INPROCESS') {
      return res.status(422).json({ 
        message: `Production status should be InProcess.`, 
        error : { 
          errors : { 
            production: { message: `Production status should be InProcess.` } 
          } 
        }
      });
    }

    if (production.total_kg > 0 || production.output_kg > 0 || production.retain_kg > 0 || 
      production.return_kg > 0 || production.waste_kg > 0) {
      return res.status(422).json({ 
        message: `Raw material, variation or return already allocated for this Production.`, 
        error : { 
          errors : { 
            production: { message: `Raw material, variation or return already allocated for this Production.` } 
          } 
        }
      });
    }

    t = await sequelize.transaction();

    const cond = [{ production_id: production.id }];
    const batchProcessingIds = production.productionBatchProcessing.map(batchProcessing => batchProcessing.id);
    const depotTransferIds = production.productionDepotTransfer.map(depotTransfer => depotTransfer.id);

    if (batchProcessingIds) {
      // await BatchRawMaterial.destroy({ where: { batch_processing_id: { [Op.in]: batchProcessingIds } }, transaction: t });
      // await BatchVariation.destroy({ where: { batch_processing_id: { [Op.in]: batchProcessingIds } }, transaction: t });
      // await BatchProcessing.destroy({ where: { id: { [Op.in]: batchProcessingIds } }, transaction: t });
      await BatchProcessing.update({ status: 'InActive' }, { where: { id: { [Op.in]: batchProcessingIds } } }, { transaction: t });
      cond.push({ batch_processing_id: { [Op.in]: batchProcessingIds } });
    }
    if (depotTransferIds) {
      // await DepotTransferItem.destroy({ where: { depot_transfer_id: { [Op.in]: depotTransferIds } }, transaction: t });
      // await DepotTransfer.destroy({ where: { id: { [Op.in]: depotTransferIds } }, transaction: t });
      await DepotTransfer.update({ status: 'InActive' }, { where: { id: { [Op.in]: depotTransferIds } } }, { transaction: t });
      cond.push({ depot_transfer_id: { [Op.in]: depotTransferIds } });
    }
    // await ProductionRawMaterial.destroy({ where: { production_id: production.id }, transaction: t });
    // await ProductionAllocation.destroy({ where: { production_id: production.id }, transaction: t });
    // await ProductionTransfer.destroy({ where: { production_id: production.id }, transaction: t });
    // await ProductionReturn.destroy({ where: { production_id: production.id }, transaction: t });
    // await Production.destroy({ where: { id: req.params.id }, transaction: t });
    await Production.update({ status: 'InActive' }, { where: { id: req.params.id } }, { transaction: t });

    await Stock.destroy({ 
      where: { [Op.or]: cond}, 
      transaction: t
    });

    // if (production.status.trim().toUpperCase() === 'APPROVED') {
    //   production.id = null;
    //   production.status = 'Deleted';
    //   production.ref_id = req.params.id;
      
    //   production = await Production.build({
    //     ...production
    //   });

    //   await production.save({ transaction: t });

    //   let productionRawMaterials = await ProductionRawMaterial.findAll({ 
    //     where: { production_id: req.params.id}, 
    //     // attributes: ['production_id', 'item_person', 'email_id', 'mobile'], 
    //     raw: true 
    //   });

    //   productionRawMaterials = productionRawMaterials.map(productionRawMaterial => {
    //     // productionRawMaterial.id = null;
    //     delete productionRawMaterial.id;
    //     productionRawMaterial.production_id = production.id;
    //     return productionRawMaterial;
    //   });

    //   await ProductionRawMaterial.bulkCreate(productionRawMaterials, { transaction: t });
      
    //   let productionOtherCharges = await ProductionOtherCharge.findAll({ 
    //     where: { production_id: req.params.id}, 
    //     // attributes: ['production_id', 'item_person', 'email_id', 'mobile'], 
    //     raw: true 
    //   });

    //   productionOtherCharges = productionOtherCharges.map(productionOtherCharge => {
    //     // productionOtherCharge.id = null;
    //     delete productionOtherCharge.id;
    //     productionOtherCharge.production_id = production.id;
    //     return productionOtherCharge;
    //   });

    //   await ProductionOtherCharge.bulkCreate(productionOtherCharges, { transaction: t });
      
    //   // const error = await production.validateData();
    //   // if (error) {
    //   //   return res.status(422).json({
    //   //     message: "Invalid inputs passed, please check your data.",
    //   //     error: error
    //   //   });
    //   // }
    // } else {
    //   await Production.destroy({ where: { id: req.params.id }, transaction: t });
    //   await ProductionRawMaterial.destroy({ where: { production_id: req.params.id }, transaction: t });
    //   await ProductionOtherCharge.destroy({ where: { production_id: req.params.id }, transaction: t });
    // }

    await t.commit();
    
    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Deleting Production failed!"
    // });

    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Deleting Production failed!";
    next(error, req, res);
  }
};

export const forceDeleteProduction = async (req, res, next) => {
  let t;

  try {
    let production = await Production.findByPk(req.params.id, {
      include: [
        { model: BatchProcessing, as: "productionBatchProcessing" },
        { model: DepotTransfer, as: "productionDepotTransfer" }
      ]
    });
    if (!production) {
      return res.status(404).json({ message: "Production not found!" });
    }

    // if (production.modified_by.toString() !== req.userData.userId.toString()) {
    //   return res.status(422).json({ 
    //     message: `You can't delete this Production.`, 
    //     error : { 
    //       errors : { 
    //         production: { message: `You can't delete this Production.` } 
    //       } 
    //     }
    //   });
    // }
    
    if (production.status.trim().toUpperCase() === 'DRAFTED') {
      production.status = 'InProcess';
    }

    if (production.status.trim().toUpperCase() !== 'INPROCESS') {
      return res.status(422).json({ 
        message: `Production status should be InProcess.`, 
        error : { 
          errors : { 
            production: { message: `Production status should be InProcess.` } 
          } 
        }
      });
    }

    // if (production.total_kg > 0 || production.output_kg > 0 || production.retain_kg > 0 || 
    //   production.return_kg > 0 || production.waste_kg > 0) {
    //   return res.status(422).json({ 
    //     message: `Raw material, variation or return already allocated for this Production.`, 
    //     error : { 
    //       errors : { 
    //         production: { message: `Raw material, variation or return already allocated for this Production.` } 
    //       } 
    //     }
    //   });
    // }

    t = await sequelize.transaction();

    const cond = [{ production_id: production.id }];
    const batchProcessingIds = production.productionBatchProcessing.map(batchProcessing => batchProcessing.id);
    const depotTransferIds = production.productionDepotTransfer.map(depotTransfer => depotTransfer.id);

    if (batchProcessingIds) {
      // await BatchRawMaterial.destroy({ where: { batch_processing_id: { [Op.in]: batchProcessingIds } }, transaction: t });
      // await BatchVariation.destroy({ where: { batch_processing_id: { [Op.in]: batchProcessingIds } }, transaction: t });
      // await BatchProcessing.destroy({ where: { id: { [Op.in]: batchProcessingIds } }, transaction: t });
      await BatchProcessing.update({ status: 'InActive' }, { where: { id: { [Op.in]: batchProcessingIds } } }, { transaction: t });
      cond.push({ batch_processing_id: { [Op.in]: batchProcessingIds } });
    }
    if (depotTransferIds) {
      // await DepotTransferItem.destroy({ where: { depot_transfer_id: { [Op.in]: depotTransferIds } }, transaction: t });
      // await DepotTransfer.destroy({ where: { id: { [Op.in]: depotTransferIds } }, transaction: t });
      await DepotTransfer.update({ status: 'InActive' }, { where: { id: { [Op.in]: depotTransferIds } } }, { transaction: t });
      cond.push({ depot_transfer_id: { [Op.in]: depotTransferIds } });
    }
    // await ProductionRawMaterial.destroy({ where: { production_id: production.id }, transaction: t });
    // await ProductionAllocation.destroy({ where: { production_id: production.id }, transaction: t });
    // await ProductionTransfer.destroy({ where: { production_id: production.id }, transaction: t });
    // await ProductionReturn.destroy({ where: { production_id: production.id }, transaction: t });
    // await Production.destroy({ where: { id: req.params.id }, transaction: t });
    await Production.update({ status: 'InActive' }, { where: { id: req.params.id } }, { transaction: t });

    await Stock.destroy({ 
      where: { [Op.or]: cond}, 
      transaction: t
    });

    // if (production.status.trim().toUpperCase() === 'APPROVED') {
    //   production.id = null;
    //   production.status = 'Deleted';
    //   production.ref_id = req.params.id;
      
    //   production = await Production.build({
    //     ...production
    //   });

    //   await production.save({ transaction: t });

    //   let productionRawMaterials = await ProductionRawMaterial.findAll({ 
    //     where: { production_id: req.params.id}, 
    //     // attributes: ['production_id', 'item_person', 'email_id', 'mobile'], 
    //     raw: true 
    //   });

    //   productionRawMaterials = productionRawMaterials.map(productionRawMaterial => {
    //     // productionRawMaterial.id = null;
    //     delete productionRawMaterial.id;
    //     productionRawMaterial.production_id = production.id;
    //     return productionRawMaterial;
    //   });

    //   await ProductionRawMaterial.bulkCreate(productionRawMaterials, { transaction: t });
      
    //   let productionOtherCharges = await ProductionOtherCharge.findAll({ 
    //     where: { production_id: req.params.id}, 
    //     // attributes: ['production_id', 'item_person', 'email_id', 'mobile'], 
    //     raw: true 
    //   });

    //   productionOtherCharges = productionOtherCharges.map(productionOtherCharge => {
    //     // productionOtherCharge.id = null;
    //     delete productionOtherCharge.id;
    //     productionOtherCharge.production_id = production.id;
    //     return productionOtherCharge;
    //   });

    //   await ProductionOtherCharge.bulkCreate(productionOtherCharges, { transaction: t });
      
    //   // const error = await production.validateData();
    //   // if (error) {
    //   //   return res.status(422).json({
    //   //     message: "Invalid inputs passed, please check your data.",
    //   //     error: error
    //   //   });
    //   // }
    // } else {
    //   await Production.destroy({ where: { id: req.params.id }, transaction: t });
    //   await ProductionRawMaterial.destroy({ where: { production_id: req.params.id }, transaction: t });
    //   await ProductionOtherCharge.destroy({ where: { production_id: req.params.id }, transaction: t });
    // }

    await t.commit();
    
    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Deleting Production failed!"
    // });

    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Deleting Production failed!";
    next(error, req, res);
  }
};

export const mailProductionDetails = async (req, res, next) => {
  try {
    await Production.mailProductionDetails(req);

    res.status(200).json({ message: "Production details sent successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Sending Production details failed!"
    // });

    res.statusCode = 500;
    res.message = "Sending Production details failed!";
    next(error, req, res);
  }
};