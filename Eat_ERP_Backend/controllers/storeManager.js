import { Op } from 'sequelize';
import sequelize from '../lib/database.js';
import Production from '../models/production.js';
// import ProductionRawMaterial from '../models/productionRawMaterial.js';
// import ProductionOtherCharge from '../models/productionOtherCharge.js';
import Depot from '../models/depot.js';
import Product from '../models/product.js';
// import { getSeries } from '../models/series.js';
// import RawMaterial from '../models/rawMaterial.js';
import { Sequelize } from 'sequelize';
import User from '../models/user.js';
import DepotTransfer from '../models/depotTransfer.js';
import DepotTransferItem from '../models/depotTransferItem.js';
import Stock from '../models/stock.js';
import { round } from '../lib/common.js';
import ProductionRawMaterial from '../models/productionRawMaterial.js';
import BatchRawMaterial from '../models/batchRawMaterial.js';
import BatchProcessing from '../models/batchProcessing.js';
import ProductionReturn from '../models/productionReturn.js';
import ProductionRawMaterialRequest from '../models/productionRawMaterialRequest.js';
import RawMaterial from '../models/rawMaterial.js';
import Packaging from '../models/packaging.js';
import { availableStock } from '../lib/availableStock.js';
import ProductionTransfer from '../models/productionTransfer.js';

export const getDepotList = async (req, res, next) => {
  try {
    const data = await Production.getRawMaterialDepotList(req);

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
    const masterData = await Production.getProductionMasterData(null);

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
    const stock = await Production.getProductionDepotTotalStock(req);

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
    let depotCondition = { [Op.or]: [{depot_id: depot_id}, {store_id: depot_id}], status: { [Op.ne]: 'InActive' } };

    // Code Change By Saurabh
    // let depotCondition = {
    //   [Op.and]: [
    //     {
    //       [Op.or]: [
    //         // store_id is NOT NULL → match store_id
    //         { store_id: { [Op.and]: { [Op.ne]: null, [Op.eq]: depot_id } } },
    //         // store_id IS NULL → fall back to depot_id
    //         { store_id: null, depot_id: depot_id }
    //       ]
    //     },
    //     { status: { [Op.ne]: 'InActive' } }
    //   ]0
    // };
    
    let searchCondition = {};

    if (query) {
      searchCondition = {
        [Op.or]: [
          { 'batch_id_as_per_fssai': {[Op.like]: `%${query}%` } }, 
          Sequelize.literal("`manufacturer`.`depot_name` LIKE '%"+query+"%'"), 
          Sequelize.literal("`depot`.`depot_name` LIKE '%"+query+"%'"), 
          Sequelize.literal("`store`.`depot_name` LIKE '%"+query+"%'"), 
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
      { model: Depot, as: 'store', attributes: ['depot_name'] }, 
      { model: Product, as: 'product', attributes: ['product_name', 'short_name'] }
    ];

    // let totalCount = 0;
    const statusCount = {
      pending: 0,
      transferred: 0
    };
    const data1 = await Production.findAll(
      { 
        // where: { depot_id: depot_id, status: { [Op.ne]: 'InActive' } },
        ...condition, 
        attributes: [
          'production_details.depot_id', 
          'production_details.store_id', 
          [sequelize.fn('sum', sequelize.col('production_details.raw_material_request')), 'total_request'],
          [sequelize.fn('sum', sequelize.col('production_details.receive')), 'total_return'],
          [sequelize.fn('sum', sequelize.col('production_details.transfer')), 'total_transfer'],
          [sequelize.fn('sum', sequelize.col('production_details.transfer_approval')), 'transfer_approval']
        ], 
        group:['production_details.depot_id'], 
        raw: true
      }
    );
    const data2 = await Packaging.findAll(
      { 
        // where: { depot_id: depot_id, status: { [Op.ne]: 'InActive' } },
        ...condition, 
        attributes: [
          'packaging_details.depot_id', 
          'packaging_details.store_id', 
          [sequelize.fn('sum', sequelize.col('packaging_details.raw_material_request')), 'total_request'],
          [sequelize.fn('sum', sequelize.col('packaging_details.receive')), 'total_return'],
          [sequelize.fn('sum', sequelize.col('packaging_details.transfer')), 'total_transfer']
        ], 
        group:['packaging_details.depot_id'], 
        raw: true
      }
    );

    // const data = data1.concat(data2);

    let total_request = 0;
    let total_return = 0;
    let total_transfer = 0;
    let transfer_approval = 0;

    if (data1) {
      for (const data of data1) {
        total_request += data.total_request ? +data.total_request : 0;
        total_return += data.total_return ? +data.total_return : 0;
        total_transfer += data.total_transfer ? +data.total_transfer : 0;
        transfer_approval += data.transfer_approval ? +data.transfer_approval : 0;

        statusCount.pending = total_request + total_return + transfer_approval;
        statusCount.transferred = total_transfer;
      }
    }

    if (data2) {
      for (const data of data2) {
        total_request += data.total_request ? +data.total_request : 0;
        total_return += data.total_return ? +data.total_return : 0;
        total_transfer += data.total_transfer ? +data.total_transfer : 0;
  
        statusCount.pending = total_request + total_return;
        statusCount.transferred = total_transfer;
      }
    }

    // let statusCondition = { status: 'Pending' };
    let statusCondition = { transfer: 1 };
    
    if (status) {
      if (status.trim().toUpperCase() === 'PENDING') {
        // statusCondition = { status: {[Op.or] : ['Pending', 'Deleted']} };
        statusCondition = { [Op.or] : [{ raw_material_request: 1 }, { receive: 1 }, { transfer_approval: 1 }] };
      } else {
        statusCondition = { [Op.or] : [{ transfer: 1 }, { return_raw_material: 1 }] };
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

    condition['include'] = [
      { model: Depot, as: 'manufacturer', attributes: ['depot_name'] }, 
      { model: Depot, as: 'depot', attributes: ['depot_name'] }, 
      { model: Depot, as: 'store', attributes: ['depot_name'] }, 
      { model: Product, as: 'product', attributes: ['product_name', 'short_name'] },
    ];

    const production  = await Production.findAndCountAll({...condition, include:[...(condition.include || []),{ model:ProductionTransfer, as: 'productionTransfers', attributes: ["id", "qty", "total_kg"] }]});
    const packaging = await Packaging.findAndCountAll(condition);

    let totalCount = production.count;
    totalCount = totalCount + packaging.count;

    let prodRows = Math.ceil(pageSize / 2);
    let packRows = pageSize - prodRows;

    if (prodRows > production.count) {
      packRows = packRows + prodRows - production.count;
    }

    if (packRows > packaging.count) {
      prodRows = prodRows + packRows - packaging.count;
    }
    
    let fetched = 0;
    let totalRows = [];
    for (const row of production.rows) {
      totalRows.push(row);
      fetched++;
      if (fetched === prodRows) {
        break;
      }
    }
    
    fetched = 0;
    for (const row of packaging.rows) {
      totalRows.push(row);
      fetched++;
      if (fetched === packRows) {
        break;
      }
    }
    
    res.status(200).json({
      message: "Productions fetched successfully!",
      // totalCount: totalCount,
      total: totalCount,
      statusCount: statusCount,
      rows: totalRows
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

export const getProduction = async (req, res, next) => {
  try {
    const production = await Production.findByPk(req.params.id, { 
      include: [
        { 
          model: ProductionRawMaterial, 
          as: "productionRawMaterials", 
          include: [{ model: RawMaterial, as: 'rawMaterial', attributes: ['rm_name'] }]
        },
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

    let balance_kg = 0;
    if (production) {
      let store_requested_kg = parseFloat(production.store_requested_kg);
      let store_kg = parseFloat(production.store_kg);
      balance_kg = round(store_requested_kg - store_kg, 4);
    }
    
    let depotStock = [];
    if (balance_kg > 0) {
      depotStock = await Production.getDepotStock(production.depot_id, production.product_id, balance_kg);
    }
    
    return res.status(200).json({ 
      message: "Production fetched successfully!",
      action, 
      production, 
      depotStock 
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

export const getBatchRawMaterial = async (req, res, next) => {
  try {
    const production = await Production.findByPk(req.params.id, { 
      include: [
        { model: Product, as: "product", attributes: ['id', 'product_name', 'short_name'] },
        { model: ProductionRawMaterialRequest, as: "productionRawMaterialRequests", include: 'rawMaterial' }
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

    return res.status(200).json({ 
      message: "Raw Materials fetched successfully!", 
      action, 
      production
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Production failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Raw Materials failed!";
    next(error, req, res);
  }
};

export const getRawMaterialStock = async (req, res, next) => {
  try {
    const productionRawMaterialRequest = await ProductionRawMaterialRequest.findByPk(req.params.id, { include: ['rawMaterial', 'productionRawMaterials'] });
    if (!productionRawMaterialRequest) {
      return res.status(404).json({ message: "Production Raw Material not found!" });
    }

    const production = await Production.findByPk(productionRawMaterialRequest.production_id);
    if (!production) {
      return res.status(404).json({ message: "Production not found!" });
    }

    let balance_kg = 0;
    if (production) {
      let store_requested_kg = parseFloat(productionRawMaterialRequest.store_requested_kg);
      let store_kg = parseFloat(productionRawMaterialRequest.store_kg);
      balance_kg = round(store_requested_kg - store_kg, 4);
    }

    let depotStock = [];
    if (balance_kg > 0) {
      depotStock = await Production.getDepotRMStock(production.depot_id, productionRawMaterialRequest.raw_material_id, balance_kg);
    }
    
    return res.status(200).json({ 
      message: "Raw Material Stock fetched successfully!", 
      productionRawMaterialRequest, 
      depotStock 
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Raw Material Stock failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Raw Material Stock failed!";
    next(error, req, res);
  }
};

export const getRawMaterialBarcodeStock = async (req, res, next) => {
  try {
    const productionRawMaterialRequest = await ProductionRawMaterialRequest.findByPk(req.params.id);
    if (!productionRawMaterialRequest) {
      return res.status(404).json({ message: "Production Raw Material not found!" });
    }

    const production = await Production.findByPk(productionRawMaterialRequest.production_id);
    if (!production) {
      return res.status(404).json({ message: "Production not found!" });
    }

    if(!req.params.barcode) {
      return res.status(404).json({ message: "Please send barcode!" });
    }

    const barcode = req.params.barcode;

    const raw_material_id = productionRawMaterialRequest.raw_material_id;

    let depotStock = await Stock.getBarcodeStock(production.depot_id, barcode, 'Production Assemble', production.id);

    if(depotStock.length === 0 && barcode.trim().toUpperCase() !== 'NA') {
      return res.status(404).json({
        message: "Stock does not exist for barcode - " + barcode,
        error: { 
          errors : { 
            production: { message: "Stock does not exist for barcode - " + barcode } 
          } 
        }
      });
    }

    const stocks = depotStock.filter(stock => stock.raw_material_id !== raw_material_id);
    
    if(stocks.length > 0) {
      if (barcode.trim().toUpperCase() !== 'NA') {
        return res.status(422).json({
          message: "Barcode does not match with Raw Material, Please scan correct barcode!",
          error: { 
            errors : { 
              production: { message: "Barcode does not match with Raw Material, Please scan correct barcode!" } 
            } 
          }
        });
      } else {
        depotStock = [{
          "raw_material_id": raw_material_id,
          "barcode": "NA",
          "expiry_date": null,
          "stock_qty": 0
        }];
      }
    }
    
    return res.status(200).json({ 
      message: "Barcode Stock fetched successfully!",
      depotStock 
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

export const assembleRawMaterial = async (req, res, next) => {
  let t;
  let error;

  try {
    const productionRawMaterialRequest = await ProductionRawMaterialRequest.findByPk(req.params.id);
    if (!productionRawMaterialRequest) {
      return res.status(404).json({ message: "Production Raw Material not found!" });
    }

    const production = await Production.findByPk(productionRawMaterialRequest.production_id, { include: 'productionRawMaterialRequests' });
    if (!production) {
      return res.status(404).json({ message: "Production not found!" });
    }

    const raw_material_id = productionRawMaterialRequest.raw_material_id;

    const depotStock = await productionRawMaterialRequest.getRawMaterialStock(production.depot_id, productionRawMaterialRequest.store_requested_kg);

    const items = productionRawMaterialRequest.getStoreRawMaterials(req.body);

    // if (productionRawMaterialRequest.store_kg > productionRawMaterialRequest.store_requested_kg) {
    //   return res.status(422).json({
    //     message: "Cannot Assemble more than store requested quantity.",
    //     error: { 
    //       errors : { 
    //         production: { message: `Cannot Assemble more than store requested quantity.` } 
    //       } 
    //     }
    //   });
    // }

    const productionRawMaterials = [];
    let store_kg = 0;
    let fifo_not_followed = req.body.fifo_not_followed ? +req.body.fifo_not_followed : 0;
    for(const item of items) {
      if (raw_material_id !== item.raw_material_id) {
        return res.status(422).json({
          message: "Barcode does not match with Raw Material.",
          error: { 
            errors : { 
              production: { message: `Barcode does not match with Raw Material.` } 
            } 
          }
        });
      }

      const productionRawMaterial = await ProductionRawMaterial.build({
        production_id: production.id,
        raw_material_request_id: productionRawMaterialRequest.id
      });
      productionRawMaterial.getRequestData(item);
      error = await productionRawMaterial.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      store_kg = round(store_kg + productionRawMaterial.qty, 4);

      // const fifo_followed = depotStock.some(stock => stock.barcode === productionRawMaterial.barcode && stock.qty >= productionRawMaterial.qty);
      const fifo_followed = depotStock.some(stock => stock.barcode === productionRawMaterial.barcode);
      if (!fifo_followed) {
        fifo_not_followed = 1;
        productionRawMaterial.fifo_not_followed = 1;
      }
      
      // await productionRawMaterial.setItemAmount();
      productionRawMaterials.push(productionRawMaterial);
    }

    productionRawMaterialRequest.store_kg = store_kg;
    productionRawMaterialRequest.fifo_not_followed = fifo_not_followed;

    if (!production.fifo_not_followed) {
      production.fifo_not_followed = fifo_not_followed;
    }

    let totalStoreKg = store_kg;
    for (const item of production.productionRawMaterialRequests) {
      if (item.id !== productionRawMaterialRequest.id) {
        totalStoreKg = round(totalStoreKg + item.store_kg, 4);
      }
    }

    production.store_kg = round(totalStoreKg, 2);

    production.setTotalKg();

    // error = await production.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }

    // Check Total Available stock for requested quantity
    const {totalStock} = await availableStock(raw_material_id, production.depot_id);

    if(store_kg > totalStock) {
      return res.status(422).json({
        message: `Stock cannot be negative. Total available Stock is ${totalStock}`,
        depot_id: production.depot_id,
        raw_material_id: raw_material_id,
        available_stock: totalStock,
        store_kg: store_kg,
      });
    }

    t = await sequelize.transaction();

    await Stock.destroy({ 
      where: { 
        stock_type: 'Production Assemble', 
        production_id: production.id, 
        raw_material_request_id: productionRawMaterialRequest.id 
      }, 
      transaction: t 
    });

    await production.save({ transaction: t });

    await productionRawMaterialRequest.save({ transaction: t });

    await ProductionRawMaterial.destroy({ 
      where: { 
        production_id: production.id, 
        raw_material_request_id: productionRawMaterialRequest.id 
      }, 
      transaction: t 
    });
    
    for(const productionRawMaterial of productionRawMaterials) {
      productionRawMaterial.production_id = production.id;
      productionRawMaterial.raw_material_request_id = productionRawMaterialRequest.id;
      await productionRawMaterial.save({ transaction: t });
    }

    let dataArray = Stock.setRawMaterialStockDetails('Production Assemble', production, productionRawMaterials, t, req);
    await Stock.bulkCreate(dataArray, { transaction: t });

    await t.commit();

    // production = await Production.findByPk(production.id, {
    //   include: [
    //     { 
    //       model: ProductionRawMaterial, 
    //       as: "productionRawMaterials"
    //     }
    //   ]
    // });

    // // t = await sequelize.transaction();
    // let dataArray = Stock.setStockDetails('Production Assemble', production, t, req);
    // await Stock.bulkCreate(dataArray);
    // // await t.commit();
    // // error = await Stock.setStockDetails('Raw Material In', rawMaterialIn, session, req);
    // // if (error) throw error;

    res.status(200).json({ message: "Assemble Successful!", production: production, totalStock: totalStock });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't udpate production!"
    // });

    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Assemble Failed!";
    next(error, req, res);
  }
};

export const assemble = async (req, res, next) => {
  let t;
  let error;

  try {
    let production = await Production.findByPk(req.params.id);
    if (!production) {
      return res.status(404).json({message: "Production not found!"});
    }

    const raw_material_id = await Production.getProductRawMaterial(production.product_id);

    const depotStock = await production.getStock(production.depot_id, production.store_requested_kg);

    const items = production.getStoreRawMaterials(req.body);

    // if (production.store_kg > production.store_requested_kg) {
    //   return res.status(422).json({
    //     message: "Cannot Assemble more than store requested quantity.",
    //     error: { 
    //       errors : { 
    //         production: { message: `Cannot Assemble more than store requested quantity.` } 
    //       } 
    //     }
    //   });
    // }

    const productionRawMaterials = [];
    let store_kg = 0;
    let fifo_not_followed = req.body.fifo_not_followed ? +req.body.fifo_not_followed : 0;
    for(const item of items) {
      if (raw_material_id !== item.raw_material_id) {
        return res.status(422).json({
          message: "Barcode does not match with Raw Material.",
          error: { 
            errors : { 
              production: { message: `Barcode does not match with Raw Material.` } 
            } 
          }
        });
      }

      const productionRawMaterial = await ProductionRawMaterial.build({
        production_id: production.id
      });
      productionRawMaterial.getRequestData(item);
      error = await productionRawMaterial.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      store_kg = round(store_kg + productionRawMaterial.qty, 4);

      // const fifo_followed = depotStock.some(stock => stock.barcode === productionRawMaterial.barcode && stock.qty >= productionRawMaterial.qty);
      const fifo_followed = depotStock.some(stock => stock.barcode === productionRawMaterial.barcode);
      if (!fifo_followed) {
        fifo_not_followed = 1;
        productionRawMaterial.fifo_not_followed = 1;
      }
      
      // await productionRawMaterial.setItemAmount();
      productionRawMaterials.push(productionRawMaterial);
    }

    production.store_kg = store_kg;
    production.fifo_not_followed = fifo_not_followed;

    // production.setTotalKg();

    // error = await production.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }

    // Check Total Available stock for requested quantity
    const {totalStock} = await availableStock(raw_material_id, production.depot_id);

    if(store_kg > totalStock) {
      return res.status(422).json({
        message: `Stock cannot be negative. Total available Stock is ${totalStock}`,
        depot_id: production.depot_id,
        raw_material_id: raw_material_id,
        available_stock: totalStock,
        store_kg: store_kg,
      });
    }

    t = await sequelize.transaction();

    await Stock.destroy({ where: { stock_type: 'Production Assemble', production_id: production.id }, transaction: t });

    await production.save({ transaction: t });

    await ProductionRawMaterial.destroy({ where: { production_id: production.id }, transaction: t });
    
    for(const productionRawMaterial of productionRawMaterials) {
      productionRawMaterial.production_id = production.id;
      await productionRawMaterial.save({ transaction: t });
    }

    await t.commit();

    production = await Production.findByPk(production.id, {
      include: [
        { 
          model: ProductionRawMaterial, 
          as: "productionRawMaterials"
        }
      ]
    });

    // t = await sequelize.transaction();
    let dataArray = Stock.setStockDetails('Production Assemble', production, t, req);
    await Stock.bulkCreate(dataArray);
    // await t.commit();
    // error = await Stock.setStockDetails('Raw Material In', rawMaterialIn, session, req);
    // if (error) throw error;

    res.status(200).json({ message: "Assemble successful!", production: production, totalStock: totalStock });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't udpate production!"
    // });

    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't Assemble Production!";
    next(error, req, res);
  }
};

export const getBarcodeStock = async (req, res, next) => {
  try {
    const production = await Production.findByPk(req.params.id);
    if (!production) {
      return res.status(404).json({ message: "Production not found!" });
    }

    if(!req.params.barcode) {
      return res.status(404).json({ message: "Please send barcode!" });
    }

    const barcode = req.params.barcode;

    const raw_material_id = await Production.getProductRawMaterial(production.product_id);

    const depotStock = await production.getBarcodeStock(production.depot_id, barcode);

    if(depotStock.length === 0) {
      return res.status(404).json({ message: "Stock does not exist for barcode - " + barcode });
    }

    const stocks = depotStock.filter(stock => stock.raw_material_id !== raw_material_id);
    
    if(stocks.length > 0) {
      return res.status(404).json({ message: "Please scan correct barcode!" });
    }
    
    return res.status(200).json({ 
      message: "Barcode Stock fetched successfully!",
      depotStock 
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

export const checkBarcode = async (req, res, next) => {
  try {
    const production = await Production.findByPk(req.params.id);
    if (!production) {
      return res.status(404).json({ message: "Production not found!" });
    }

    if(!req.params.barcode) {
      return res.status(404).json({ message: "Please send barcode!" });
    }

    const barcode = req.params.barcode;

    const data = await production.checkBarcode(barcode, '');

    if (!data.raw_material_id) {
      return res.status(404).json({ message: "Barcode does not found in batch processing!" });
    }

    return res.status(200).json({ 
      message: "Barcode data fetched successfully!",
      data 
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Barcode Data failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Barcode Data failed!";
    next(error, req, res);
  }
};

export const transfer = async (req, res, next) => {
  let t;
  let error;

  try {
    let production = await Production.findByPk(req.params.id, { include: [
      { model: ProductionRawMaterial, as: "productionRawMaterials" }
    ]});
    if (!production) {
      return res.status(404).json({message: "Production not found!"});
    }

    production.transfer_raw_material(req);

    production.setTotalKg();

    let batchProcessing = await BatchProcessing.setProductionData(production);

    let depotTransfer = await DepotTransfer.setProductionData(production, 'Raw Material');

    t = await sequelize.transaction();

    await Stock.destroy({ where: { stock_type: 'Batch Processing', batch_processing_id: batchProcessing.id }, transaction: t });

    await production.save({ transaction: t });

    batchProcessing.status = 'Approved';
    await batchProcessing.save({ transaction: t });

    depotTransfer.status = 'Approved';
    await depotTransfer.save({ transaction: t });

    await DepotTransferItem.destroy({ where: { type: 'Raw Material', depot_transfer_id: depotTransfer.id }, transaction: t });

    await BatchRawMaterial.destroy({ where: { batch_processing_id: batchProcessing.id, transfer: 1 }, transaction: t });

    for (const productionRawMaterial of production.productionRawMaterials) {
      const depotTransferItem = await DepotTransferItem.build({
        depot_transfer_id: depotTransfer.id
      });
      depotTransferItem.setProductionRawMaterial(productionRawMaterial);
      await depotTransferItem.save({ transaction: t });

      const batchRawMaterial = await BatchRawMaterial.build({
        batch_processing_id: batchProcessing.id, 
        transfer: 1
      });
      batchRawMaterial.setProductionRawMaterial(productionRawMaterial);
      await batchRawMaterial.save({ transaction: t });
    }

    await t.commit();

    depotTransfer = await DepotTransfer.findByPk(depotTransfer.id, {
      include: [
        { model: DepotTransferItem, as: "depotTransferItems" }
      ]
    });

    await Stock.destroy({ where: { stock_type: 'Production Assemble', production_id: production.id }});
    await Stock.destroy({ where: { stock_type: 'Depot Transfer', depot_transfer_id: depotTransfer.id }});
    let dataArray = Stock.setStockDetails('Depot Transfer', depotTransfer, t, req);
    await Stock.bulkCreate(dataArray);

    batchProcessing = await BatchProcessing.findByPk(batchProcessing.id, {
      include: [
        { model: BatchRawMaterial, as: "batchProcessingItems" }
      ]
    });

    // t = await sequelize.transaction();
    dataArray = Stock.setStockDetails('Batch Processing', batchProcessing, t, req);
    await Stock.bulkCreate(dataArray);
    // await t.commit();
    // error = await Stock.setStockDetails('Raw Material In', rawMaterialIn, session, req);
    // if (error) throw error;
    
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

export const receive = async (req, res, next) => {
  let t;
  let error;

  try {
    let production = await Production.findByPk(req.params.id);
    if (!production) {
      return res.status(404).json({message: "Production not found!"});
    }

    const items = production.getStoreReturns(req.body);

    let return_kg = 0;
    for(const item of items) {
      const data = await production.checkBarcode(item.barcode, 'RETURN');

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

      if (data.qty < item.qty) {
        return res.status(422).json({
          message: "Cannot receive more than allocated quantity.",
          error: { 
            errors : { 
              production: { message: `Cannot receive more than allocated quantity.` } 
            } 
          }
        });
      }

      return_kg = round(return_kg + item.qty, 4);
    }

    production.return_kg = round(return_kg, 2);

    // if (production.return_kg > round(production.total_kg - production.output_kg - production.waste_kg - production.retain_kg, 4)) {
    //   return res.status(422).json({
    //     message: "Cannot Return more than balance quantity.",
    //     error: { 
    //       errors : { 
    //         production: { message: `Cannot Return more than balance quantity.` } 
    //       } 
    //     }
    //   });
    // }

    const productionReturns = [];
    for(const item of items) {
      const productionReturn = await ProductionReturn.build({
        production_id: production.id
      });
      productionReturn.setReturnData(item);
      error = await productionReturn.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      // await productionReturn.setItemAmount();
      productionReturns.push(productionReturn);
    }

    production.receive = 0;

    production.setProcessLoss();

    // error = await production.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }

    let depotTransfer = await DepotTransfer.setProductionData(production, 'Raw Material Return');

    let batchProcessing = await BatchProcessing.setProductionData(production);

    t = await sequelize.transaction();

    await Stock.destroy({ where: { stock_type: 'Production Return', production_id: production.id }, transaction: t });

    await ProductionReturn.destroy({ where: { production_id: production.id }, transaction: t });
    
    await DepotTransferItem.destroy({ where: { type: 'Raw Material', depot_transfer_id: depotTransfer.id }, transaction: t });

    await BatchRawMaterial.destroy({ where: { batch_processing_id: batchProcessing.id, return: 1 }, transaction: t });

    await production.save({ transaction: t });

    depotTransfer.status = 'Approved';
    await depotTransfer.save({ transaction: t });

    batchProcessing.status = 'Approved';
    await batchProcessing.save({ transaction: t });

    for (const productionReturn of productionReturns) {
      productionReturn.production_id = production.id;
      await productionReturn.save({ transaction: t });

      const depotTransferItem = await DepotTransferItem.build({
        depot_transfer_id: depotTransfer.id
      });
      depotTransferItem.setProductionReturn(productionReturn);
      await depotTransferItem.save({ transaction: t });
      
      const batchRawMaterial = await BatchRawMaterial.build({
        batch_processing_id: batchProcessing.id,
        return: 1
      });
      batchRawMaterial.setProductionReturn(productionReturn);
      await batchRawMaterial.save({ transaction: t });
    }

    await t.commit();

    await Stock.destroy({ where: { stock_type: 'Production Return', production_id: production.id }});

    depotTransfer = await DepotTransfer.findByPk(depotTransfer.id, {
      include: [
        { model: DepotTransferItem, as: "depotTransferItems" }
      ]
    });
    await Stock.destroy({ where: { stock_type: 'Depot Transfer', depot_transfer_id: depotTransfer.id }});
    let dataArray = Stock.setStockDetails('Depot Transfer', depotTransfer, t, req);
    await Stock.bulkCreate(dataArray);

    batchProcessing = await BatchProcessing.findByPk(batchProcessing.id, {
      include: [
        { model: BatchRawMaterial, as: "batchProcessingItems" }
      ]
    });
    // t = await sequelize.transaction();
    await Stock.destroy({ where: { stock_type: 'Batch Processing', batch_processing_id: batchProcessing.id }});
    dataArray = Stock.setStockDetails('Batch Processing', batchProcessing, t, req);
    await Stock.bulkCreate(dataArray);
    // await t.commit();
    // error = await Stock.setStockDetails('Raw Material In', rawMaterialIn, session, req);
    // if (error) throw error;
    
    res.status(200).json({ message: "Receive successful!", production: production });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't receive production!"
    // });

    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't Receive Production!";
    next(error, req, res);
  }
};

export const cancelReceive = async (req, res, next) => {
  let t;
  // let error;

  try {
    let production = await Production.findByPk(req.params.id);
    if (!production) {
      return res.status(404).json({message: "Production not found!"});
    }

    production.setCancelReceive();

    t = await sequelize.transaction();

    await production.save({ transaction: t });

    await t.commit();

    res.status(200).json({ message: "Receive cancelled!", production: production });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't Cancel Receive!"
    // });

    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't Cancel Receive!";
    next(error, req, res);
  }
}

// export const getRMRequest = async (req, res, next) => {
//   try {
//     let status = 'Pending';
//     let pageSize = 10;
//     let pageIndex = 0;
//     let query = '';
//     let sort = { key: 'modified_on', order: 'desc' };

//     if (req.query) {
//       status = req.query.status ? req.query.status : 'Pending';
//       if (req.query.pageSize && req.query.pageSize.toString().trim().toUpperCase() === 'ALL') {
//         pageSize = 'ALL';
//       } else {
//         pageSize = req.query.pageSize ? +req.query.pageSize : 10;
//       }
//       pageIndex = req.query.pageIndex ? +req.query.pageIndex : 0;
//       query = req.query.query ? req.query.query : '';
//       sort = { key: req.query.key ? req.query.key : 'modified_on', order: req.query.order ? req.query.order : 'desc' };
//     }

//     // let totalCount = 0;
//     const statusCount = {
//       inProcess: 0,
//       pending: 0,
//       approved: 0,
//       rejected: 0,
//       inActive: 0
//     };
//     const data = await Production.findAll(
//       { 
//         attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']], 
//         group:['status'], 
//         raw: true
//       }
//     );
//     // console.log(data);
//     for (const item of data) {
//       // console.log(item.status);
//       // console.log(item.count);
//       if (item.status.trim().toUpperCase() === "INPROCESS") {
//         statusCount.inProcess = statusCount.inProcess + parseInt(item.count);
//         // totalCount = parseInt(item.count);
//       }
//       else if (item.status.trim().toUpperCase() === "PENDING" || item.status.trim().toUpperCase() === "DELETED") {
//         statusCount.pending = statusCount.pending + parseInt(item.count);
//         // totalCount = parseInt(item.count);
//       }
//       else if (item.status.trim().toUpperCase() === "APPROVED") {
//         statusCount.approved = statusCount.approved + parseInt(item.count);
//         // totalCount = parseInt(item.count);
//       }
//       else if (item.status.trim().toUpperCase() === "REJECTED") {
//         statusCount.rejected = statusCount.rejected + parseInt(item.count);
//         // totalCount = parseInt(item.count);
//       }
//       else if (item.status.trim().toUpperCase() === "INACTIVE") {
//         statusCount.inActive = statusCount.inActive + parseInt(item.count);
//         // totalCount = parseInt(item.count);
//       }
//     }
    
//     let condition = {};
//     let statusCondition = { status: 'Pending' };
//     if (status) {
//       if (status.trim().toUpperCase() === 'PENDING') {
//         statusCondition = { status: {[Op.or] : ['Pending', 'Deleted']} };
//       } else {
//         statusCondition = { status: status };
//       }
//     }
//     if (query) {
//       condition['where'] = {
//         [Op.and]: [
//           {[Op.or]: [
//             { 'po_no': {[Op.like]: `%${query}%` } }, 
//             Sequelize.literal("`depot`.`depot_name` LIKE '%"+query+"%'"), 
//             Sequelize.literal("`product`.`product_name` LIKE '%"+query+"%'")
//           ]},
//           statusCondition
//         ]
//       };
//     } else {
//       condition['where'] = statusCondition;
//     }

//     let order = [['modified_on', 'DESC']];
//     if (sort) {
//       if (sort.key) {
//         order = [[sort.key, (sort.order ? sort.order : 'ASC')]];
//       }
//     }
//     condition['order'] = order;

//     if (pageSize.toString().trim().toUpperCase() === 'ALL') {
//       //Do Nothing
//     } else {
//       if (pageIndex) {
//         condition['offset'] = (pageIndex * pageSize);
//       }
      
//       if (pageSize) {
//         condition['limit'] = pageSize;
//       }
//     }

//     condition['include'] = [
//       { model: Depot, as: 'depot', attributes: ['depot_name'] }, 
//       { model: Product, as: 'product', attributes: ['product_name'] }
//     ];

//     const { count, rows } = await Production.findAndCountAll(condition);
//     // const rows = 

//     res.status(200).json({
//       message: "Productions fetched successfully!",
//       // totalCount: totalCount,
//       total: count,
//       statusCount: statusCount,
//       rows: rows
//     });
//   } catch (error) {
//     // res.status(500).json({
//     //   message: "Fetching Productions failed!"
//     // });
    
//     res.statusCode = 500;
//     res.message = "Fetching Productions failed!";
//     next(error, req, res);
//   }
// };

// export const emailProduction = async (req, res, next) => {
//   try {
//     // const productionFile = getProduction(id);

//     let result = await mailProduction(req.params.id);
//     // console.log(result);

//     if (result.indexOf('Email sent') !== -1) {
//       res.status(200).json({ message: "Mail sent successfully" });
//     } else {
//       res.status(500).json({ message: "Mail sending failed" });
//     }
                
//     // res.status(200).json({ productionFile });

//   } catch (error) {
//     // res.status(500).json({
//     //   message: "Generatiing PDF failed!",
//     //   error: JSON.stringify(error, Object.getOwnPropertyNames(error))
//     // });
    
//     res.statusCode = 500;
//     res.message = "Generatiing PDF failed!";
//     next(error, req, res);
//   }
// }

// export const approveProduction = async (req, res, next) => {
//   let t;

//   try {
//     let production = await Production.findByPk(req.params.id);
//     if (!production) {
//       return res.status(404).json({
//         message: "Production not found!"
//       });
//     }

//     // if (production.modified_by === req.userData.userId) {
//     //   return res.status(422).json({ 
//     //     message: `You can't approve this Production.`, 
//     //     error : { 
//     //       errors : { 
//     //         productDate: { message: `You can't approve this Production.` } 
//     //       } 
//     //     }
//     //   });
//     // }

//     // console.log(production);

//     if (production.status.trim().toUpperCase() !== 'PENDING' && production.status.trim().toUpperCase() !== 'DELETED') {
//       return res.status(422).json({ 
//         message: `Production status should be pending or deleted.`, 
//         error : { 
//           errors : { 
//             productDate: { message: `Production status should be pending or deleted.` } 
//           } 
//         }
//       });
//     }

//     production.approve(req);

//     // console.log(error);
//     // production.approvedBy = req.userData.userId;
//     // production.approvedAt = new Date().toISOString();

//     const error = await production.validateData();
//     if (error) {
//       return res.status(422).json({
//         message: "Invalid inputs passed, please check your data.",
//         error: error
//       });
//     }

//     // try {
//       t = await sequelize.transaction();
      
//       if (!production.po_no) {
//         const series = await getSeries(req, 'Purchase_Order');
//         production.getProductionNo(series.series);
//         await series.save({ transaction: t });
//       }
      
//       if (!production.ref_id) {
//         await production.save({ transaction: t });
//       } else {
//         // const obj = JSON.parse(JSON.stringify(production));
//         // delete obj._id;
//         // obj.ref_id = null;

//         const ref_id = production.ref_id;

//         const obj = production.dataValues;
//         delete obj.id;
//         obj.ref_id = null;

//         // console.log(obj);
//         // console.log(ref_id);
//         // console.log(req.params.id);

//         await Production.destroy({ where: {id: req.params.id }}, { transaction: t });

//         // production = await Production.findByIdAndUpdate(ref_id, obj, { session: session, new: true });

//         await Production.update(obj, { where: { id: ref_id } }, { transaction: t });

//         await ProductionRawMaterial.destroy({ where: {purchase_order_id: ref_id }}, { transaction: t });

//         await ProductionRawMaterial.update({ purchase_order_id: ref_id }, { where: { purchase_order_id: req.params.id }}, { transaction: t });

//         await ProductionOtherCharge.destroy({ where: {purchase_order_id: ref_id }}, { transaction: t });

//         await ProductionOtherCharge.update({ purchase_order_id: ref_id }, { where: { purchase_order_id: req.params.id }}, { transaction: t });

//         // originalProduction = await Production.findById(production.ref_id);
//         // originalProduction.overwrite(production);
//         // originalProduction.ref_id = null;
//         // originalProduction.productState = production.productState;
//         // // console.log(originalProduction);
//         // await originalProduction.save({ session });
//       }

//       await t.commit();
         
//     // } catch (error) { 
//     //     await session.abortTransaction();
//     // }
    
//     res.status(200).json({ message: "Approve successful!" });
//   } catch (error) {
//     // console.log(error);

//     if (t && t.finished != 'commit') {
//       await t.rollback();
//     }

//     // res.status(500).json({
//     //   message: 'Approving Production failed! Error - ' + (error.message ? error.message : '')
//     // });
    
//     res.statusCode = 500;
//     res.message = "Approving Production failed!";
//     next(error, req, res);
//   }
// };

// export const rejectProduction = async (req, res, next) => {
//   try {
//     let production = await Production.findByPk(req.params.id);

//     if (!production) {
//       return res.status(404).json({
//         message: "Production not found!"
//       });
//     }

//     if (production.modified_by.toString() === req.userData.userId.toString()) {
//       return res.status(422).json({ 
//         message: `You can't reject this Production.`, 
//         error : { 
//           errors : { 
//             productDate: { message: `You can't reject this Production.` } 
//           } 
//         }
//       });
//     }

//     if (production.status.trim().toUpperCase() === 'APPROVED') {
//       return res.status(422).json({ 
//         message: `Production is already approved.`, 
//         error : { 
//           errors : { 
//             productDate: { message: `Production is already approved.` } 
//           } 
//         }
//       });
//     }

//     production.reject(req);
//     await production.save();

//     res.status(200).json({ message: "Reject successful!" });
//   } catch (error) {
//     // res.status(500).json({
//     //   message: "Rejecting Production failed!"
//     // });
    
//     res.statusCode = 500;
//     res.message = "Rejecting Production failed!";
//     next(error, req, res);
//   }
// };

// export const deleteProduction = async (req, res, next) => {
//   let t;

//   try {
//     let production = await Production.findByPk(req.params.id, {raw: true});
//     if (!production) {
//       return res.status(404).json({ message: "Production not found!" });
//     }

//     t = await sequelize.transaction();

//     if (production.status.trim().toUpperCase() === 'APPROVED') {
//       production.id = null;
//       production.status = 'Deleted';
//       production.ref_id = req.params.id;
      
//       production = await Production.build({
//         ...production
//       });

//       await production.save({ transaction: t });

//       let productionRawMaterials = await ProductionRawMaterial.findAll({ 
//         where: { purchase_order_id: req.params.id}, 
//         // attributes: ['purchase_order_id', 'item_person', 'email_id', 'mobile'], 
//         raw: true 
//       });

//       productionRawMaterials = productionRawMaterials.map(productionRawMaterial => {
//         // productionRawMaterial.id = null;
//         delete productionRawMaterial.id;
//         productionRawMaterial.purchase_order_id = production.id;
//         return productionRawMaterial;
//       });

//       await ProductionRawMaterial.bulkCreate(productionRawMaterials, { transaction: t });
      
//       let productionOtherCharges = await ProductionOtherCharge.findAll({ 
//         where: { purchase_order_id: req.params.id}, 
//         // attributes: ['purchase_order_id', 'item_person', 'email_id', 'mobile'], 
//         raw: true 
//       });

//       productionOtherCharges = productionOtherCharges.map(productionOtherCharge => {
//         // productionOtherCharge.id = null;
//         delete productionOtherCharge.id;
//         productionOtherCharge.purchase_order_id = production.id;
//         return productionOtherCharge;
//       });

//       await ProductionOtherCharge.bulkCreate(productionOtherCharges, { transaction: t });
      
//       // const error = await production.validateData();
//       // if (error) {
//       //   return res.status(422).json({
//       //     message: "Invalid inputs passed, please check your data.",
//       //     error: error
//       //   });
//       // }
//     } else {
//       await Production.destroy({ where: { id: req.params.id }, transaction: t });
//       await ProductionRawMaterial.destroy({ where: { purchase_order_id: req.params.id }, transaction: t });
//       await ProductionOtherCharge.destroy({ where: { purchase_order_id: req.params.id }, transaction: t });
//     }

//     await t.commit();
    
//     res.status(200).json({ message: "Deletion successful!" });
//   } catch (error) {
//     // res.status(500).json({
//     //   message: "Deleting Production failed!"
//     // });

//     if (t && t.finished != 'commit') {
//       await t.rollback();
//     }
    
//     res.statusCode = 500;
//     res.message = "Deleting Production failed!";
//     next(error, req, res);
//   }
// };

// export const getOldPoRate = async (req, res, next) => {
//   try {
//     // const rawMaterial = await RawMaterial.findByPk(req.params.id);
//     // if (!rawMaterial) {
//     //   return res.status(404).json({ message: "Raw Material not found!" });
//     // }

//     const rawMaterialId = req.params.raw_material_id;
//     // const rawMaterial = await RawMaterial.findByPk(rawMaterialId, { include: Production });

//     // const rawMaterial = await Production.findByPk(2346, { include: 'productionRawMaterials' });
//     // const rawMaterial = await Production.findByPk(2346, { include: { all: true, nested: true }});
//     // const rawMaterial = await Production.findByPk(2346, { include: [
//     //   { model: ProductionRawMaterial, as: 'productionRawMaterials', include: [{ model: RawMaterial, as: 'raw_material' }]}] });

//     const rawMaterial = await RawMaterial.findByPk(rawMaterialId, { 
//       include: [
//         { model: Production, as: 'purchase_order', attributes: ["id", "order_date"] },
//         { model: ProductionRawMaterial, as: 'productionRawMaterials', attributes: ["purchase_order_id", "rate"] }
//       ], 
//       order: [[{ model: Production, as: 'purchase_order'}, 'order_date', 'DESC' ]],
//       raw: false
//     });

//     // delete rawMaterial.purchase_order;
//     // if (rawMaterial.productionRawMaterials.length > 0) {
//     //   rawMaterial.old
//     // }

//     return res.status(200).json({ rawMaterial });
//   } catch (error) {
//     res.statusCode = 500;
//     res.message = "Fetching Raw Material failed!";
//     next(error, req, res);
//   }
// };