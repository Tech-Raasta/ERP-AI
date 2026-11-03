import { Op, Sequelize } from "sequelize";
import sequelize from "../lib/database.js";

import EasyEcomApi from "../lib/easyEcomApi.js";
import Box from "../models/box.js";
import ComboBox from "../models/comboBox.js";
import ComboBoxItem from "../models/comboBoxItem.js";
import Country from "../models/country.js";
import Depot from "../models/depot.js";
import Distributor from "../models/distributor.js";
import Pincode from "../models/pincode.js";
import Product from "../models/product.js";
import Production from "../models/production.js";
import ProductionTransfer from "../models/productionTransfer.js";
import Sale from "../models/sale.js";
import SaleItem from "../models/saleItem.js";
import SaleReturn from "../models/saleReturn.js";
import State from "../models/state.js";
import User from "../models/user.js";
import { getDateString, getDateTimeString, isValidDate, round } from "../lib/common.js";
import { getSeries } from "../models/series.js";
import SaleItemProduct from "../models/saleItemProduct1.js";
import AccountLedgerEntry from "../models/accountLedgerEntry.js";
import { getOrder, getShopifyOrderDistributor, getShopifyOrderNo } from "../lib/shopifyApi.js";
import SaleReturnItem from "../models/saleReturnItem.js";
import SaleReturnItemProduct from "../models/saleReturnItemProduct.js";
import EasyEcomInventory from "../models/easyEcomInventory.js";


// @desc Get All Easy Ecom Inventory
// @route Get /api/easyEcomInventory
// @access Private
export const getEasyEcomInventory = async (req, res, next) => {
  try {
    let status = 'Unsynced';
    let pageSize = 10;
    let pageIndex = 0;
    let query = '';
    let sort = { key: 'date_of_transfer', order: 'desc' };

    if (req.query) {
      status = req.query.status ? req.query.status : "Unsynched";
      if (req.query.pageSize && req.query.pageSize.toString().trim().toUpperCase() === 'ALL') {
        pageSize = 'ALL';
      } else {
        pageSize = req.query.pageSize ? +req.query.pageSize : 10;
      }
      pageIndex = req.query.pageIndex ? +req.query.pageIndex : 0;
      query = req.query.query ? req.query.query : '';
      sort = { key: req.query.key ? req.query.key : 'date_of_transfer', order: req.query.order ? req.query.order : 'desc' };
    }

    let condition = {};
    let searchCondition = {};

    if (query) {
      searchCondition = {
        [Op.or]: [ 
          Sequelize.literal("`product`.`product_name` LIKE '%"+query+"%'"), 
          Sequelize.literal("`product`.`short_name` LIKE '%"+query+"%'")
        ],
      };

      condition['where'] = searchCondition;
    } else {
      condition['where'] = { status };
    }


    condition['include'] = [
      { model: Product, as: "product", attributes: ['id', 'product_name', 'short_name'] },
    ];

    condition['group'] = ['production_id'];

    const statusCount = {
      synced: 0,
      unsynced: 0,
    };
    const allEasyEcomInventory = await EasyEcomInventory.findAll({ 
      ...condition, 
    });

    for(const easyEcomInventory of allEasyEcomInventory) {
      if (easyEcomInventory.status === 'Synced') {
        statusCount.synced += 1;
      } else {
        statusCount.unsynced += 1;
      }
    }

    condition['order'] = [[sort.key, sort.order]];

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

    const {count, rows}  = await EasyEcomInventory.findAndCountAll(condition);

    res.status(200).json({ 
      message: 'Easy Ecom Inventory fetched successfully.',
      total: count.length,
      statusCount: statusCount,
      easyEcomInventory: rows
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Easy Ecom Inventory fetched unsuccessful!";
    next(error, req, res);
  }
};

// @desc Get Easy Ecom Inventory By production_id
// @route Get /api/easyEcomInventory/:production_id
// @access Private
export const getEasyEcomInventoryById = async (req, res, next) => {
  try {

    if(req.params.production_id === 'undefined' || !req.params.production_id) {
      return res.status(422).json({
        message: "Invalid production_id"
      });
    }
    const condition = {
      where: { production_id: req.params.production_id },
      include: [
        { model: Box, as: 'box', attributes: ['id', 'box_name', 'sku_code'] },
        { model: Production, as: 'production', attributes: ['id', 'batch_id_as_per_fssai'] }
      ]
    };

    const easyEcomBoxes= await EasyEcomInventory.findAll(condition);

    res.status(200).json({ 
      message: 'Easy Ecom Inventory fetched successfully.',
      easyEcomInventory: easyEcomBoxes
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Easy Ecom Inventory fetched unsuccessful!";
    next(error, req, res);
  }
};

// @desc Bulk Update Easy Ecom Inventory
// @route POST /api/easyEcomInventory
// @access Private
export const updateBulkInventory = async (req, res, next) => {
  try {
    const easyEcomApi = new EasyEcomApi('ee41972946129')
    const {skus, easyEcomInventory} = await easyEcomApi.getSkuDetailsFromRequest(req);
    if (skus.message) {
      return res.status(422).json({ 
        message: skus.message,
        data: skus 
      });
    }

    const response = await easyEcomApi.bulkInventoryUpdate(skus);
    if (response instanceof Error) {
      return res.status(422).json({ 
        message: response.message,
        data: response.stack 
      });
    }

    // for (const productionTransfer of easyEcomInventory) {
    //   productionTransfer.status = 'Synced';
    //   productionTransfer.save();
    // }

    res.status(200).json({ 
      message: 'Bulk Inventory updated successfully.',
      data: response
    });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Bulk Inventory updation failed!"
    // });

    res.statusCode = 500;
    res.message = "Bulk Inventory updation failed!";
    next(error, req, res);
  }
};
// export const getInventoryWithBarcode = async (req, res, next) => {
//   try {
//     const productionTransfers = await ProductionTransfer.findAll({ 
//       where: { status: 'Approved', uploaded_to_easyecom: 0 }, 
//       include: [
//         { model: Box, as: 'box', attributes: ['id', 'box_name', 'sku_code'] },
//         { model: Production, as: 'production', attributes: ['id', 'batch_id_as_per_fssai'] }
//       ]
//     });
    
//     res.status(200).json({ 
//       message: 'Production transfers fetched successfully.',
//       productionTransfers: productionTransfers 
//     });
//   } catch (error) {
//     // console.log(error);
//     // res.status(500).json({
//     //   message: "Production transfers fetched successfully!"
//     // });

//     res.statusCode = 500;
//     res.message = "Production transfers fetched successfully!";
//     next(error, req, res);
//   }
// };


