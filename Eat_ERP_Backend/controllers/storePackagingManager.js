import { Op } from 'sequelize';
import sequelize from '../lib/database.js';
import Packaging from '../models/packaging.js';
// import PackagingItem from '../models/packagingItem.js';
// import PackagingOtherCharge from '../models/packagingOtherCharge.js';
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
import PackagingItem from '../models/packagingItem.js';
// import BatchRawMaterial from '../models/batchRawMaterial.js';
// import BatchProcessing from '../models/batchProcessing.js';
import PackagingReturn from '../models/packagingReturn.js';
import PackagingItemRequest from '../models/packagingItemRequest.js';
import RawMaterial from '../models/rawMaterial.js';
import Production from '../models/production.js';

export const getDepotList = async (req, res, next) => {
  try {
    const data = await Packaging.getRawMaterialDepotList(req);

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
    const stock = await Packaging.getPackagingDepotTotalStock(req);

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
    let depotCondition = { depot_id: depot_id, status: { [Op.ne]: 'InActive' }, depot_id: {[Op.in]: req.userData.depotIds} };
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
      pending: 0,
      transferred: 0
    };
    const data1 = await Production.findOne(
      { 
        // where: { depot_id: depot_id, status: { [Op.ne]: 'InActive' } },
        ...condition, 
        attributes: [
          'production_details.depot_id', 
          [sequelize.fn('sum', sequelize.col('production_details.raw_material_request')), 'total_request'],
          [sequelize.fn('sum', sequelize.col('production_details.receive')), 'total_return'],
          [sequelize.fn('sum', sequelize.col('production_details.transfer')), 'total_transfer']
        ], 
        group:['production_details.depot_id'], 
        raw: true
      }
    );
    const data2 = await Packaging.findOne(
      { 
        // where: { depot_id: depot_id, status: { [Op.ne]: 'InActive' } },
        ...condition, 
        attributes: [
          'packaging_details.depot_id', 
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

    if (data1) {
      total_request += data1.total_request ? +data1.total_request : 0;
      total_return += data1.total_return ? +data1.total_return : 0;
      total_transfer += data1.total_transfer ? +data1.total_transfer : 0;

      statusCount.pending = total_request + total_return;
      statusCount.transferred = total_transfer;
    }

    if (data2) {
      total_request += data2.total_request ? +data2.total_request : 0;
      total_return += data2.total_return ? +data2.total_return : 0;
      total_transfer += data2.total_transfer ? +data2.total_transfer : 0;

      statusCount.pending = total_request + total_return;
      statusCount.transferred = total_transfer;
    }

    // let statusCondition = { status: 'Pending' };
    let statusCondition = { transfer: 1 };
    
    if (status) {
      if (status.trim().toUpperCase() === 'PENDING') {
        // statusCondition = { status: {[Op.or] : ['Pending', 'Deleted']} };
        statusCondition = { [Op.or] : [{ raw_material_request: 1 }, { receive: 1 }] };
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
      { model: Product, as: 'product', attributes: ['product_name', 'short_name'] }
    ];

    const production  = await Production.findAndCountAll(condition);
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

export const getPackaging = async (req, res, next) => {
  try {
    const packaging = await Packaging.findByPk(req.params.id, { 
      include: [
        { 
          model: PackagingItem, 
          as: "packagingItems", 
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

    let balance_kg = 0;
    if (packaging) {
      let store_requested_kg = parseFloat(packaging.store_requested_kg);
      let store_kg = parseFloat(packaging.store_kg);
      balance_kg = round(store_requested_kg - store_kg, 4);
    }
    
    let depotStock = [];
    if (balance_kg > 0) {
      depotStock = await Packaging.getDepotStock(packaging.depot_id, packaging.product_id, balance_kg);
    }
    
    return res.status(200).json({ 
      message: "Packaging fetched successfully!",
      action, 
      packaging, 
      depotStock 
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

export const getBatchRawMaterial = async (req, res, next) => {
  try {
    const packaging = await Packaging.findByPk(req.params.id, { 
      include: [
        { model: Product, as: "product", attributes: ['id', 'product_name', 'short_name'] },
        { model: PackagingItemRequest, as: "packagingItemRequests", include: 'rawMaterial' }
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

    return res.status(200).json({ 
      message: "Raw Materials fetched successfully!", 
      action, 
      packaging
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Packaging failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Raw Materials failed!";
    next(error, req, res);
  }
};

export const getRawMaterialStock = async (req, res, next) => {
  try {
    const packagingItemRequest = await PackagingItemRequest.findByPk(req.params.id, { include: ['rawMaterial', 'packagingItems'] });
    if (!packagingItemRequest) {
      return res.status(404).json({ message: "Packaging Raw Material not found!" });
    }

    const packaging = await Packaging.findByPk(packagingItemRequest.packaging_id);
    if (!packaging) {
      return res.status(404).json({ message: "Packaging not found!" });
    }

    let balance_kg = 0;
    if (packaging) {
      let store_requested_kg = parseFloat(packagingItemRequest.store_requested_kg);
      let store_kg = parseFloat(packagingItemRequest.store_kg);
      balance_kg = round(store_requested_kg - store_kg, 4);
    }

    let depotStock = [];
    if (balance_kg > 0) {
      depotStock = await Packaging.getDepotRMStock(packaging.depot_id, packagingItemRequest.raw_material_id, balance_kg);
    }
    
    return res.status(200).json({ 
      message: "Raw Material Stock fetched successfully!", 
      packagingItemRequest, 
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
    const packagingItemRequest = await PackagingItemRequest.findByPk(req.params.id);
    if (!packagingItemRequest) {
      return res.status(404).json({ message: "Packaging Raw Material not found!" });
    }

    const packaging = await Packaging.findByPk(packagingItemRequest.packaging_id);
    if (!packaging) {
      return res.status(404).json({ message: "Packaging not found!" });
    }

    if(!req.params.barcode) {
      return res.status(404).json({ message: "Please send barcode!" });
    }

    const barcode = req.params.barcode;

    const raw_material_id = packagingItemRequest.raw_material_id;

    const depotStock = await Stock.getBarcodeStock(packaging.depot_id, barcode, 'Packaging Assemble', packaging.id);

    if(depotStock.length === 0) {
      return res.status(404).json({
        message: "Stock does not exist for barcode - " + barcode,
        error: { 
          errors : { 
            packaging: { message: "Stock does not exist for barcode - " + barcode } 
          } 
        }
      });
    }

    const stocks = depotStock.filter(stock => stock.raw_material_id !== raw_material_id);
    
    if(stocks.length > 0) {
      return res.status(422).json({
        message: "Barcode does not match with Raw Material, Please scan correct barcode!",
        error: { 
          errors : { 
            packaging: { message: "Barcode does not match with Raw Material, Please scan correct barcode!" } 
          } 
        }
      });
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
    const packagingItemRequest = await PackagingItemRequest.findByPk(req.params.id);
    if (!packagingItemRequest) {
      return res.status(404).json({ message: "Packaging Raw Material not found!" });
    }

    const packaging = await Packaging.findByPk(packagingItemRequest.packaging_id, { include: 'packagingItemRequests' });
    if (!packaging) {
      return res.status(404).json({ message: "Packaging not found!" });
    }

    const raw_material_id = packagingItemRequest.raw_material_id;

    const depotStock = await packagingItemRequest.getRawMaterialStock(packaging.depot_id, packagingItemRequest.store_requested_kg);

    const items = packagingItemRequest.getStoreRawMaterials(req.body);

    // if (packagingItemRequest.store_kg > packagingItemRequest.store_requested_kg) {
    //   return res.status(422).json({
    //     message: "Cannot Assemble more than store requested quantity.",
    //     error: { 
    //       errors : { 
    //         packaging: { message: `Cannot Assemble more than store requested quantity.` } 
    //       } 
    //     }
    //   });
    // }

    const packagingItems = [];
    let store_kg = 0;
    let fifo_not_followed = req.body.fifo_not_followed ? +req.body.fifo_not_followed : 0;
    for(const item of items) {
      if (raw_material_id !== item.raw_material_id) {
        return res.status(422).json({
          message: "Barcode does not match with Raw Material.",
          error: { 
            errors : { 
              packaging: { message: `Barcode does not match with Raw Material.` } 
            } 
          }
        });
      }

      const packagingItem = await PackagingItem.build({
        packaging_id: packaging.id,
        raw_material_request_id: packagingItemRequest.id
      });
      packagingItem.getRequestData(item);
      error = await packagingItem.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      store_kg = round(store_kg + packagingItem.qty, 4);

      // const fifo_followed = depotStock.some(stock => stock.barcode === packagingItem.barcode && stock.qty >= packagingItem.qty);
      const fifo_followed = depotStock.some(stock => stock.barcode === packagingItem.barcode);
      if (!fifo_followed) {
        fifo_not_followed = 1;
        packagingItem.fifo_not_followed = 1;
      }
      
      // await packagingItem.setItemAmount();
      packagingItems.push(packagingItem);
    }

    packagingItemRequest.store_kg = store_kg;
    packagingItemRequest.fifo_not_followed = fifo_not_followed;

    if (!packaging.fifo_not_followed) {
      packaging.fifo_not_followed = fifo_not_followed;
    }

    let totalStoreKg = store_kg;
    for (const item of packaging.packagingItemRequests) {
      if (item.id !== packagingItemRequest.id) {
        totalStoreKg = round(totalStoreKg + item.store_kg, 4);
      }
    }

    packaging.store_kg = round(totalStoreKg, 2);

    // packaging.setTotalKg();

    // error = await packaging.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }

    t = await sequelize.transaction();

    await Stock.destroy({ 
      where: { 
        stock_type: 'Packaging Assemble', 
        packaging_id: packaging.id, 
        raw_material_request_id: packagingItemRequest.id 
      }, 
      transaction: t 
    });

    await packaging.save({ transaction: t });

    await packagingItemRequest.save({ transaction: t });

    await PackagingItem.destroy({ 
      where: { 
        packaging_id: packaging.id, 
        raw_material_request_id: packagingItemRequest.id 
      }, 
      transaction: t 
    });
    
    for(const packagingItem of packagingItems) {
      packagingItem.packaging_id = packaging.id;
      packagingItem.raw_material_request_id = packagingItemRequest.id;
      await packagingItem.save({ transaction: t });
    }

    let dataArray = Stock.setRawMaterialStockDetails('Packaging Assemble', packaging, packagingItems, t, req);
    await Stock.bulkCreate(dataArray, { transaction: t });

    await t.commit();

    // packaging = await Packaging.findByPk(packaging.id, {
    //   include: [
    //     { 
    //       model: PackagingItem, 
    //       as: "packagingItems"
    //     }
    //   ]
    // });

    // // t = await sequelize.transaction();
    // let dataArray = Stock.setStockDetails('Packaging Assemble', packaging, t, req);
    // await Stock.bulkCreate(dataArray);
    // // await t.commit();
    // // error = await Stock.setStockDetails('Raw Material In', rawMaterialIn, session, req);
    // // if (error) throw error;

    res.status(200).json({ message: "Assemble Successful!", packaging: packaging });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't udpate packaging!"
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
    let packaging = await Packaging.findByPk(req.params.id);
    if (!packaging) {
      return res.status(404).json({message: "Packaging not found!"});
    }

    const raw_material_id = await Packaging.getProductRawMaterial(packaging.product_id);

    const depotStock = await packaging.getStock(packaging.depot_id, packaging.store_requested_kg);

    const items = packaging.getStoreRawMaterials(req.body);

    // if (packaging.store_kg > packaging.store_requested_kg) {
    //   return res.status(422).json({
    //     message: "Cannot Assemble more than store requested quantity.",
    //     error: { 
    //       errors : { 
    //         packaging: { message: `Cannot Assemble more than store requested quantity.` } 
    //       } 
    //     }
    //   });
    // }

    const packagingItems = [];
    let store_kg = 0;
    let fifo_not_followed = req.body.fifo_not_followed ? +req.body.fifo_not_followed : 0;
    for(const item of items) {
      if (raw_material_id !== item.raw_material_id) {
        return res.status(422).json({
          message: "Barcode does not match with Raw Material.",
          error: { 
            errors : { 
              packaging: { message: `Barcode does not match with Raw Material.` } 
            } 
          }
        });
      }

      const packagingItem = await PackagingItem.build({
        packaging_id: packaging.id
      });
      packagingItem.getRequestData(item);
      error = await packagingItem.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      store_kg = round(store_kg + packagingItem.qty, 4);

      // const fifo_followed = depotStock.some(stock => stock.barcode === packagingItem.barcode && stock.qty >= packagingItem.qty);
      const fifo_followed = depotStock.some(stock => stock.barcode === packagingItem.barcode);
      if (!fifo_followed) {
        fifo_not_followed = 1;
        packagingItem.fifo_not_followed = 1;
      }
      
      // await packagingItem.setItemAmount();
      packagingItems.push(packagingItem);
    }

    packaging.store_kg = store_kg;
    packaging.fifo_not_followed = fifo_not_followed;

    // packaging.setTotalKg();

    // error = await packaging.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }

    t = await sequelize.transaction();

    await Stock.destroy({ where: { stock_type: 'Packaging Assemble', packaging_id: packaging.id }, transaction: t });

    await packaging.save({ transaction: t });

    await PackagingItem.destroy({ where: { packaging_id: packaging.id }, transaction: t });
    
    for(const packagingItem of packagingItems) {
      packagingItem.packaging_id = packaging.id;
      await packagingItem.save({ transaction: t });
    }

    await t.commit();

    packaging = await Packaging.findByPk(packaging.id, {
      include: [
        { 
          model: PackagingItem, 
          as: "packagingItems"
        }
      ]
    });

    // t = await sequelize.transaction();
    let dataArray = Stock.setStockDetails('Packaging Assemble', packaging, t, req);
    await Stock.bulkCreate(dataArray);
    // await t.commit();
    // error = await Stock.setStockDetails('Raw Material In', rawMaterialIn, session, req);
    // if (error) throw error;

    res.status(200).json({ message: "Assemble successful!", packaging: packaging });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't udpate packaging!"
    // });

    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't Assemble Packaging!";
    next(error, req, res);
  }
};

export const getBarcodeStock = async (req, res, next) => {
  try {
    const packaging = await Packaging.findByPk(req.params.id);
    if (!packaging) {
      return res.status(404).json({ message: "Packaging not found!" });
    }

    if(!req.params.barcode) {
      return res.status(404).json({ message: "Please send barcode!" });
    }

    const barcode = req.params.barcode;

    const raw_material_id = await Packaging.getProductRawMaterial(packaging.product_id);

    const depotStock = await packaging.getBarcodeStock(packaging.depot_id, barcode);

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
    const packaging = await Packaging.findByPk(req.params.id);
    if (!packaging) {
      return res.status(404).json({ message: "Packaging not found!" });
    }

    if(!req.params.barcode) {
      return res.status(404).json({ message: "Please send barcode!" });
    }

    const barcode = req.params.barcode;

    const data = await packaging.checkBarcode(barcode, '');

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
    let packaging = await Packaging.findByPk(req.params.id, { include: [
      { model: PackagingItem, as: "packagingItems" }
    ]});
    if (!packaging) {
      return res.status(404).json({message: "Packaging not found!"});
    }

    packaging.transfer_raw_material(req);

    packaging.setTotalKg();

    // let batchProcessing = await BatchProcessing.setPackagingData(packaging);

    let depotTransfer = await DepotTransfer.setPackagingData(packaging, 'Raw Material');

    t = await sequelize.transaction();

    packaging.status = 'Approved';

    // await Stock.destroy({ where: { stock_type: 'Batch Processing', batch_processing_id: batchProcessing.id }, transaction: t });

    await packaging.save({ transaction: t });

    // batchProcessing.status = 'Approved';
    // await batchProcessing.save({ transaction: t });

    depotTransfer.status = 'Approved';

    
    await depotTransfer.save({ transaction: t });

    await DepotTransferItem.destroy({ where: { type: 'Raw Material', depot_transfer_id: depotTransfer.id }, transaction: t });

    // await BatchRawMaterial.destroy({ where: { batch_processing_id: batchProcessing.id, transfer: 1 }, transaction: t });

    const depotTransferItems = [];
    for (const packagingItem of packaging.packagingItems) {
      const depotTransferItem = await DepotTransferItem.build({
        depot_transfer_id: depotTransfer.id
      });
      depotTransferItem.setPackagingItem(packagingItem);
      await depotTransferItem.save({ transaction: t });

      depotTransferItems.push(depotTransferItem);

      // const batchRawMaterial = await BatchRawMaterial.build({
      //   batch_processing_id: batchProcessing.id, 
      //   transfer: 1
      // });
      // batchRawMaterial.setPackagingItem(packagingItem);
      // await batchRawMaterial.save({ transaction: t });
    }

    depotTransfer.setDetails(depotTransferItems);

    await t.commit();

    depotTransfer = await DepotTransfer.findByPk(depotTransfer.id, {
      include: [
        { model: DepotTransferItem, as: "depotTransferItems" }
      ]
    });

    await Stock.destroy({ where: { stock_type: 'Packaging Assemble', packaging_id: packaging.id }});
    await Stock.destroy({ where: { stock_type: 'Depot Transfer', depot_transfer_id: depotTransfer.id }});
    let dataArray = Stock.setStockDetails('Depot Transfer', depotTransfer, t, req);
    await Stock.bulkCreate(dataArray);

    // batchProcessing = await BatchProcessing.findByPk(batchProcessing.id, {
    //   include: [
    //     { model: BatchRawMaterial, as: "batchProcessingItems" }
    //   ]
    // });

    // // t = await sequelize.transaction();
    // dataArray = Stock.setStockDetails('Batch Processing', batchProcessing, t, req);
    // await Stock.bulkCreate(dataArray);
    // // await t.commit();
    // // error = await Stock.setStockDetails('Raw Material In', rawMaterialIn, session, req);
    // // if (error) throw error;
    
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

export const receive = async (req, res, next) => {
  let t;
  let error;

  try {
    let packaging = await Packaging.findByPk(req.params.id);
    if (!packaging) {
      return res.status(404).json({message: "Packaging not found!"});
    }

    const items = packaging.getStoreReturns(req.body);

    let return_kg = 0;
    for(const item of items) {
      const data = await packaging.checkBarcode(item.barcode, 'RETURN');

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

      if (data.qty < item.qty) {
        return res.status(422).json({
          message: "Cannot receive more than allocated quantity.",
          error: { 
            errors : { 
              packaging: { message: `Cannot receive more than allocated quantity.` } 
            } 
          }
        });
      }

      return_kg = round(return_kg + item.qty, 4);
    }

    packaging.return_kg = round(return_kg, 2);

    // if (packaging.return_kg > round(packaging.total_kg - packaging.output_kg - packaging.waste_kg - packaging.retain_kg, 4)) {
    //   return res.status(422).json({
    //     message: "Cannot Return more than balance quantity.",
    //     error: { 
    //       errors : { 
    //         packaging: { message: `Cannot Return more than balance quantity.` } 
    //       } 
    //     }
    //   });
    // }

    const packagingReturns = [];
    for(const item of items) {
      const packagingReturn = await PackagingReturn.build({
        packaging_id: packaging.id
      });
      packagingReturn.setReturnData(item);
      error = await packagingReturn.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      // await packagingReturn.setItemAmount();
      packagingReturns.push(packagingReturn);
    }

    packaging.receive = 0;

    packaging.setProcessLoss();

    // error = await packaging.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }

    let depotTransfer = await DepotTransfer.setPackagingData(packaging, 'Raw Material Return');

    // let batchProcessing = await BatchProcessing.setPackagingData(packaging);

    t = await sequelize.transaction();

    await Stock.destroy({ where: { stock_type: 'Packaging Return', packaging_id: packaging.id }, transaction: t });

    await PackagingReturn.destroy({ where: { packaging_id: packaging.id }, transaction: t });
    
    await DepotTransferItem.destroy({ where: { type: 'Raw Material', depot_transfer_id: depotTransfer.id }, transaction: t });

    // await BatchRawMaterial.destroy({ where: { batch_processing_id: batchProcessing.id, return: 1 }, transaction: t });

    await packaging.save({ transaction: t });

    depotTransfer.status = 'Approved';
    await depotTransfer.save({ transaction: t });

    // batchProcessing.status = 'Approved';
    // await batchProcessing.save({ transaction: t });

    for (const packagingReturn of packagingReturns) {
      packagingReturn.packaging_id = packaging.id;
      await packagingReturn.save({ transaction: t });

      const depotTransferItem = await DepotTransferItem.build({
        depot_transfer_id: depotTransfer.id
      });
      depotTransferItem.setPackagingReturn(packagingReturn);
      await depotTransferItem.save({ transaction: t });
      
      // const batchRawMaterial = await BatchRawMaterial.build({
      //   batch_processing_id: batchProcessing.id,
      //   return: 1
      // });
      // batchRawMaterial.setPackagingReturn(packagingReturn);
      // await batchRawMaterial.save({ transaction: t });
    }

    await t.commit();

    await Stock.destroy({ where: { stock_type: 'Packaging Return', packaging_id: packaging.id }});

    depotTransfer = await DepotTransfer.findByPk(depotTransfer.id, {
      include: [
        { model: DepotTransferItem, as: "depotTransferItems" }
      ]
    });
    await Stock.destroy({ where: { stock_type: 'Depot Transfer', depot_transfer_id: depotTransfer.id }});
    let dataArray = Stock.setStockDetails('Depot Transfer', depotTransfer, t, req);
    await Stock.bulkCreate(dataArray);

    // batchProcessing = await BatchProcessing.findByPk(batchProcessing.id, {
    //   include: [
    //     { model: BatchRawMaterial, as: "batchProcessingItems" }
    //   ]
    // });
    // // t = await sequelize.transaction();
    // await Stock.destroy({ where: { stock_type: 'Batch Processing', batch_processing_id: batchProcessing.id }});
    // dataArray = Stock.setStockDetails('Batch Processing', batchProcessing, t, req);
    // await Stock.bulkCreate(dataArray);
    // // await t.commit();
    // // error = await Stock.setStockDetails('Raw Material In', rawMaterialIn, session, req);
    // // if (error) throw error;
    
    res.status(200).json({ message: "Receive successful!", packaging: packaging });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't receive packaging!"
    // });

    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't Receive Packaging!";
    next(error, req, res);
  }
};

export const cancelReceive = async (req, res, next) => {
  let t;
  // let error;

  try {
    let packaging = await Packaging.findByPk(req.params.id);
    if (!packaging) {
      return res.status(404).json({message: "Packaging not found!"});
    }

    packaging.setCancelReceive();

    t = await sequelize.transaction();

    await packaging.save({ transaction: t });

    await t.commit();

    res.status(200).json({ message: "Receive cancelled!", packaging: packaging });
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
//     const data = await Packaging.findAll(
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

//     const { count, rows } = await Packaging.findAndCountAll(condition);
//     // const rows = 

//     res.status(200).json({
//       message: "Packagings fetched successfully!",
//       // totalCount: totalCount,
//       total: count,
//       statusCount: statusCount,
//       rows: rows
//     });
//   } catch (error) {
//     // res.status(500).json({
//     //   message: "Fetching Packagings failed!"
//     // });
    
//     res.statusCode = 500;
//     res.message = "Fetching Packagings failed!";
//     next(error, req, res);
//   }
// };

// export const emailPackaging = async (req, res, next) => {
//   try {
//     // const packagingFile = getPackaging(id);

//     let result = await mailPackaging(req.params.id);
//     // console.log(result);

//     if (result.indexOf('Email sent') !== -1) {
//       res.status(200).json({ message: "Mail sent successfully" });
//     } else {
//       res.status(500).json({ message: "Mail sending failed" });
//     }
                
//     // res.status(200).json({ packagingFile });

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

// export const approvePackaging = async (req, res, next) => {
//   let t;

//   try {
//     let packaging = await Packaging.findByPk(req.params.id);
//     if (!packaging) {
//       return res.status(404).json({
//         message: "Packaging not found!"
//       });
//     }

//     // if (packaging.modified_by === req.userData.userId) {
//     //   return res.status(422).json({ 
//     //     message: `You can't approve this Packaging.`, 
//     //     error : { 
//     //       errors : { 
//     //         productDate: { message: `You can't approve this Packaging.` } 
//     //       } 
//     //     }
//     //   });
//     // }

//     // console.log(packaging);

//     if (packaging.status.trim().toUpperCase() !== 'PENDING' && packaging.status.trim().toUpperCase() !== 'DELETED') {
//       return res.status(422).json({ 
//         message: `Packaging status should be pending or deleted.`, 
//         error : { 
//           errors : { 
//             productDate: { message: `Packaging status should be pending or deleted.` } 
//           } 
//         }
//       });
//     }

//     packaging.approve(req);

//     // console.log(error);
//     // packaging.approvedBy = req.userData.userId;
//     // packaging.approvedAt = new Date().toISOString();

//     const error = await packaging.validateData();
//     if (error) {
//       return res.status(422).json({
//         message: "Invalid inputs passed, please check your data.",
//         error: error
//       });
//     }

//     // try {
//       t = await sequelize.transaction();
      
//       if (!packaging.po_no) {
//         const series = await getSeries(req, 'Purchase_Order');
//         packaging.getPackagingNo(series.series);
//         await series.save({ transaction: t });
//       }
      
//       if (!packaging.ref_id) {
//         await packaging.save({ transaction: t });
//       } else {
//         // const obj = JSON.parse(JSON.stringify(packaging));
//         // delete obj._id;
//         // obj.ref_id = null;

//         const ref_id = packaging.ref_id;

//         const obj = packaging.dataValues;
//         delete obj.id;
//         obj.ref_id = null;

//         // console.log(obj);
//         // console.log(ref_id);
//         // console.log(req.params.id);

//         await Packaging.destroy({ where: {id: req.params.id }}, { transaction: t });

//         // packaging = await Packaging.findByIdAndUpdate(ref_id, obj, { session: session, new: true });

//         await Packaging.update(obj, { where: { id: ref_id } }, { transaction: t });

//         await PackagingItem.destroy({ where: {purchase_order_id: ref_id }}, { transaction: t });

//         await PackagingItem.update({ purchase_order_id: ref_id }, { where: { purchase_order_id: req.params.id }}, { transaction: t });

//         await PackagingOtherCharge.destroy({ where: {purchase_order_id: ref_id }}, { transaction: t });

//         await PackagingOtherCharge.update({ purchase_order_id: ref_id }, { where: { purchase_order_id: req.params.id }}, { transaction: t });

//         // originalPackaging = await Packaging.findById(packaging.ref_id);
//         // originalPackaging.overwrite(packaging);
//         // originalPackaging.ref_id = null;
//         // originalPackaging.productState = packaging.productState;
//         // // console.log(originalPackaging);
//         // await originalPackaging.save({ session });
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
//     //   message: 'Approving Packaging failed! Error - ' + (error.message ? error.message : '')
//     // });
    
//     res.statusCode = 500;
//     res.message = "Approving Packaging failed!";
//     next(error, req, res);
//   }
// };

// export const rejectPackaging = async (req, res, next) => {
//   try {
//     let packaging = await Packaging.findByPk(req.params.id);

//     if (!packaging) {
//       return res.status(404).json({
//         message: "Packaging not found!"
//       });
//     }

//     if (packaging.modified_by.toString() === req.userData.userId.toString()) {
//       return res.status(422).json({ 
//         message: `You can't reject this Packaging.`, 
//         error : { 
//           errors : { 
//             productDate: { message: `You can't reject this Packaging.` } 
//           } 
//         }
//       });
//     }

//     if (packaging.status.trim().toUpperCase() === 'APPROVED') {
//       return res.status(422).json({ 
//         message: `Packaging is already approved.`, 
//         error : { 
//           errors : { 
//             productDate: { message: `Packaging is already approved.` } 
//           } 
//         }
//       });
//     }

//     packaging.reject(req);
//     await packaging.save();

//     res.status(200).json({ message: "Reject successful!" });
//   } catch (error) {
//     // res.status(500).json({
//     //   message: "Rejecting Packaging failed!"
//     // });
    
//     res.statusCode = 500;
//     res.message = "Rejecting Packaging failed!";
//     next(error, req, res);
//   }
// };

// export const deletePackaging = async (req, res, next) => {
//   let t;

//   try {
//     let packaging = await Packaging.findByPk(req.params.id, {raw: true});
//     if (!packaging) {
//       return res.status(404).json({ message: "Packaging not found!" });
//     }

//     t = await sequelize.transaction();

//     if (packaging.status.trim().toUpperCase() === 'APPROVED') {
//       packaging.id = null;
//       packaging.status = 'Deleted';
//       packaging.ref_id = req.params.id;
      
//       packaging = await Packaging.build({
//         ...packaging
//       });

//       await packaging.save({ transaction: t });

//       let packagingItems = await PackagingItem.findAll({ 
//         where: { purchase_order_id: req.params.id}, 
//         // attributes: ['purchase_order_id', 'item_person', 'email_id', 'mobile'], 
//         raw: true 
//       });

//       packagingItems = packagingItems.map(packagingItem => {
//         // packagingItem.id = null;
//         delete packagingItem.id;
//         packagingItem.purchase_order_id = packaging.id;
//         return packagingItem;
//       });

//       await PackagingItem.bulkCreate(packagingItems, { transaction: t });
      
//       let packagingOtherCharges = await PackagingOtherCharge.findAll({ 
//         where: { purchase_order_id: req.params.id}, 
//         // attributes: ['purchase_order_id', 'item_person', 'email_id', 'mobile'], 
//         raw: true 
//       });

//       packagingOtherCharges = packagingOtherCharges.map(packagingOtherCharge => {
//         // packagingOtherCharge.id = null;
//         delete packagingOtherCharge.id;
//         packagingOtherCharge.purchase_order_id = packaging.id;
//         return packagingOtherCharge;
//       });

//       await PackagingOtherCharge.bulkCreate(packagingOtherCharges, { transaction: t });
      
//       // const error = await packaging.validateData();
//       // if (error) {
//       //   return res.status(422).json({
//       //     message: "Invalid inputs passed, please check your data.",
//       //     error: error
//       //   });
//       // }
//     } else {
//       await Packaging.destroy({ where: { id: req.params.id }, transaction: t });
//       await PackagingItem.destroy({ where: { purchase_order_id: req.params.id }, transaction: t });
//       await PackagingOtherCharge.destroy({ where: { purchase_order_id: req.params.id }, transaction: t });
//     }

//     await t.commit();
    
//     res.status(200).json({ message: "Deletion successful!" });
//   } catch (error) {
//     // res.status(500).json({
//     //   message: "Deleting Packaging failed!"
//     // });

//     if (t && t.finished != 'commit') {
//       await t.rollback();
//     }
    
//     res.statusCode = 500;
//     res.message = "Deleting Packaging failed!";
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
//     // const rawMaterial = await RawMaterial.findByPk(rawMaterialId, { include: Packaging });

//     // const rawMaterial = await Packaging.findByPk(2346, { include: 'packagingItems' });
//     // const rawMaterial = await Packaging.findByPk(2346, { include: { all: true, nested: true }});
//     // const rawMaterial = await Packaging.findByPk(2346, { include: [
//     //   { model: PackagingItem, as: 'packagingItems', include: [{ model: RawMaterial, as: 'raw_material' }]}] });

//     const rawMaterial = await RawMaterial.findByPk(rawMaterialId, { 
//       include: [
//         { model: Packaging, as: 'purchase_order', attributes: ["id", "order_date"] },
//         { model: PackagingItem, as: 'packagingItems', attributes: ["purchase_order_id", "rate"] }
//       ], 
//       order: [[{ model: Packaging, as: 'purchase_order'}, 'order_date', 'DESC' ]],
//       raw: false
//     });

//     // delete rawMaterial.purchase_order;
//     // if (rawMaterial.packagingItems.length > 0) {
//     //   rawMaterial.old
//     // }

//     return res.status(200).json({ rawMaterial });
//   } catch (error) {
//     res.statusCode = 500;
//     res.message = "Fetching Raw Material failed!";
//     next(error, req, res);
//   }
// };