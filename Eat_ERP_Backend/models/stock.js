import { DataTypes, Op } from 'sequelize';
import path from 'path';
import sequelize from '../lib/database.js';
import html_to_pdf from 'html-pdf-node';
import moment from 'moment/moment.js';
import { calculateFiscalYearForDate, calculateTransactionAmount, createPath, getReportPath, getBaseUrl, round } from '../lib/common.js';

import Depot from './depot.js';
import Product from './product.js';
import RawMaterial from './rawMaterial.js';
import User from './user.js';
import { group } from 'console';

const Stock = sequelize.define('stock', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  stock_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  depot_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  raw_material_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  quantity: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  stock_quantity: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  stock_type: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  expiry_date: {
    type: DataTypes.DATEONLY,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
  barcode: DataTypes.STRING,
  raw_material_in_id: DataTypes.INTEGER,
  depot_transfer_id: DataTypes.INTEGER,
  batch_processing_id: DataTypes.INTEGER,
  raw_material_in_out_id: DataTypes.INTEGER,
  production_id: DataTypes.INTEGER,
  raw_material_request_id: DataTypes.INTEGER,
  packaging_id: DataTypes.INTEGER,
  status: DataTypes.STRING,
  remarks: DataTypes.STRING,
  created_by: DataTypes.INTEGER,
  created_on: DataTypes.DATE,
  modified_by: DataTypes.INTEGER,
  modified_on: DataTypes.DATE,
  approved_by: DataTypes.INTEGER,
  approved_on: DataTypes.DATE,
  rejected_by: DataTypes.INTEGER,
  rejected_on: DataTypes.DATE,
  ref_id: DataTypes.INTEGER
}, 
{ 
  timestamps: true,
  createdAt: 'created_on',
  updatedAt: 'modified_on',
  freezeTableName: true
});

Stock.setStockDetails = function (type, transaction, session, req) {
  // try {
    if (transaction && transaction.status && transaction.status.trim().toUpperCase() === 'INACTIVE') {
      return null;
    }
    let dataArray = [];

    let data = {
      stock_date: null,
      depot_id: 0,
      raw_material_id: 0,
      quantity: 0,
      stock_quantity: 0,
      stock_type: type,
      expiry_date: null,
      barcode: '',
      raw_material_in_id: 0,
      depot_transfer_id: 0,
      batch_processing_id: 0,
      raw_material_in_out_id: 0,
      production_id: 0,
      raw_material_request_id: 0,
      packaging_id: 0,
      status: 'Approved',
      created_by: req.userData.userId,
      modified_by: req.userData.userId
    };

    let items = null;

    if (type === 'Raw Material In') {
      data.stock_date = transaction.date_of_receipt;
      data.depot_id = transaction.depot_id;
      data.raw_material_in_id = transaction.id;
      items = transaction.rawMaterialInItems;
    } else if (type === 'Depot Transfer') {
      data.stock_date = transaction.date_of_transfer;
      data.depot_id = transaction.depot_in_id;
      data.depot_transfer_id = transaction.id;
      items = transaction.depotTransferItems.filter(item => item.type === 'Raw Material');
    } else if (type === 'Batch Processing') {
      data.stock_date = transaction.date_of_processing;
      data.depot_id = transaction.depot_id;
      data.batch_processing_id = transaction.id;
      items = transaction.batchProcessingItems;
    } else if (type === 'Batch Packaging') {
      data.stock_date = transaction.date_of_processing;
      data.depot_id = transaction.production.depot_id;
      data.batch_processing_id = transaction.id;
      items = transaction.batchVariations;
    } else if (type === 'Raw Material In Out') {
      data.stock_date = transaction.date_of_processing;
      data.depot_id = transaction.depot_id;
      data.raw_material_in_out_id = transaction.id;
      items = transaction.rawMaterialInOutItems;
    } else if (type === 'Production Assemble') {
      data.stock_date = transaction.date_of_processing;
      data.depot_id = transaction.depot_id;
      data.production_id = transaction.id;
      items = transaction.productionRawMaterials;
    } else if (type === 'Packaging Assemble') {
      data.stock_date = transaction.date_of_processing;
      data.depot_id = transaction.depot_id;
      data.packaging_id = transaction.id;
      items = transaction.packagingItems;
    } else if (type === 'Production Retain') {
      data.stock_date = transaction.date_of_processing;
      data.depot_id = transaction.manufacturer_id;
      data.production_id = transaction.id;
      items = transaction.productionRetains;
    }

    data.status = transaction.status;

    // console.log(items);

    for (const item of items) {
      if (type === 'Depot Transfer') {
        data.depot_id = transaction.depot_in_id;
        data.raw_material_id = item.item_id;
      } else if (type === 'Batch Packaging') {
        data.raw_material_id = item.primary_packaging_id;
      } else {
        data.raw_material_id = item.raw_material_id;
      }
      
      if (type === 'Raw Material In') {
        for (const itemWeight of item.rawMaterialInItemWeights) {
          data.quantity = itemWeight.net_weight;
          data.barcode = itemWeight.barcode;
          data.stock_quantity = itemWeight.net_weight;
          data.expiry_date = itemWeight.expiry_date;

          dataArray.push({...data});
        }
      } else if (type === 'Batch Packaging') {
        if (item.primary_packaging_id && item.primary_packaging_qty) {
          data.quantity = item.primary_packaging_qty;
          data.stock_quantity = item.primary_packaging_qty * -1;

          dataArray.push({...data});
        }
      } else {
        data.quantity = item.qty;
        data.expiry_date = item.expiry_date;
        data.barcode = item.barcode;

        if (type === 'Batch Processing' || type === 'Production Assemble' || type === 'Packaging Assemble') {
          data.stock_quantity = item.qty * -1;
          data.raw_material_request_id = item.raw_material_request_id ? item.raw_material_request_id : 0;
        } else if (type === 'Raw Material In Out') {
          if (item.type && item.type.trim().toUpperCase() === 'STOCK OUT') {
            data.stock_quantity = item.qty * -1;
          } else {
            data.stock_quantity = item.qty;
          }
        } else {
          data.stock_quantity = item.qty;
        }

        dataArray.push({...data});
      }

      // const stock = new models.Stock(data);
      // await stock.save({ session });

      // let error = await models.Product.setStockQuantity(session, stock);
      // if (error) {
      //   throw error;
      // }

      if (type === 'Depot Transfer') {
        data.depot_id = transaction.depot_out_id;
        data.stock_quantity = item.qty * -1;
        dataArray.push({...data});

        // const stockOut = new models.Stock(data);
        // stockOut.depot = transaction.depot_out_id;
        // stockOut.stock_quantity = item.quantity * -1;
        // await stockOut.save({ session });

        // error = await models.Product.setStockQuantity(session, stockOut);
        // if (error) {
        //   throw error;
        // }
      } else if (type === 'Batch Packaging') {
        if (item.secondary_packaging_id && item.secondary_packaging_qty) {
          data.raw_material_id = item.secondary_packaging_id;
          data.quantity = item.secondary_packaging_qty;
          data.stock_quantity = item.secondary_packaging_qty * -1;
          dataArray.push({...data});
        }
      }
    }

    return dataArray;
  // } catch (error) {
  //   // console.log(error);

  //   return error;
  // }
}

Stock.setRawMaterialStockDetails = function (type, transaction, transactionItems, session, req) {
  // try {
    if (transaction && transaction.status && transaction.status.trim().toUpperCase() === 'INACTIVE') {
      return null;
    }
    let dataArray = [];

    let data = {
      stock_date: null,
      depot_id: 0,
      raw_material_id: 0,
      quantity: 0,
      stock_quantity: 0,
      stock_type: type,
      expiry_date: null,
      barcode: '',
      raw_material_in_id: 0,
      depot_transfer_id: 0,
      batch_processing_id: 0,
      raw_material_in_out_id: 0,
      production_id: 0,
      raw_material_request_id: 0,
      status: 'Approved',
      created_by: req.userData.userId,
      modified_by: req.userData.userId
    };

    let items = null;

    if (type === 'Raw Material In') {
      data.stock_date = transaction.date_of_receipt;
      data.depot_id = transaction.depot_id;
      data.raw_material_in_id = transaction.id;
      items = transaction.rawMaterialInItems;
    } else if (type === 'Depot Transfer') {
      data.stock_date = transaction.date_of_transfer;
      data.depot_id = transaction.depot_in_id;
      data.depot_transfer_id = transaction.id;
      items = transaction.depotTransferItems.filter(item => item.type === 'Raw Material');
    } else if (type === 'Batch Processing') {
      data.stock_date = transaction.date_of_processing;
      data.depot_id = transaction.depot_id;
      data.batch_processing_id = transaction.id;
      items = transaction.batchProcessingItems;
    } else if (type === 'Batch Packaging') {
      data.stock_date = transaction.date_of_processing;
      data.depot_id = transaction.production.depot_id;
      data.batch_processing_id = transaction.id;
      items = transaction.batchVariations;
    } else if (type === 'Raw Material In Out') {
      data.stock_date = transaction.date_of_processing;
      data.depot_id = transaction.depot;
      data.raw_material_in_out_id = transaction.id;
      items = transaction.rawMaterialInOutItems;
    } else if (type === 'Production Assemble') {
      data.stock_date = transaction.date_of_processing;
      data.depot_id = transaction.depot_id;
      data.production_id = transaction.id;
      // items = transaction.productionRawMaterials;
      items = transactionItems;
    } else if (type === 'Packaging Assemble') {
      data.stock_date = transaction.date_of_processing;
      data.depot_id = transaction.depot_id;
      data.packaging_id = transaction.id;
      // items = transaction.productionRawMaterials;
      items = transactionItems;
    } else if (type === 'Production Retain') {
      data.stock_date = transaction.date_of_processing;
      data.depot_id = transaction.manufacturer_id;
      data.production_id = transaction.id;
      items = transaction.productionRetains;
    }

    data.status = transaction.status;

    // console.log(items);

    for (const item of items) {
      if (type === 'Depot Transfer') {
        data.depot_id = transaction.depot_in_id;
        data.raw_material_id = item.item_id;
      } else if (type === 'Batch Packaging') {
        data.raw_material_id = item.primary_packaging_id;
      } else {
        data.raw_material_id = item.raw_material_id;
      }
      
      if (type === 'Raw Material In') {
        for (const itemWeight of item.rawMaterialInItemWeights) {
          data.quantity = itemWeight.net_weight;
          data.barcode = itemWeight.barcode;
          data.stock_quantity = itemWeight.net_weight;
          data.expiry_date = itemWeight.expiry_date;

          dataArray.push({...data});
        }
      } else if (type === 'Batch Packaging') {
        if (item.primary_packaging_id && item.primary_packaging_qty) {
          data.quantity = item.primary_packaging_qty;
          data.stock_quantity = item.primary_packaging_qty * -1;

          dataArray.push({...data});
        }
      } else {
        data.quantity = item.qty;
        data.expiry_date = item.expiry_date;
        data.barcode = item.barcode;

        if (type === 'Batch Processing' || type === 'Production Assemble' || type === 'Packaging Assemble') {
          data.stock_quantity = item.qty * -1;
          data.raw_material_request_id = item.raw_material_request_id ? item.raw_material_request_id : 0;
        } else if (type === 'Raw Material In Out') {
          if (item.type && item.type.trim().toUpperCase() === 'STOCK OUT') {
            data.stock_quantity = item.qty * -1;
          } else {
            data.stock_quantity = item.qty;
          }
        } else {
          data.stock_quantity = item.qty;
        }

        dataArray.push({...data});
      }

      // const stock = new models.Stock(data);
      // await stock.save({ session });

      // let error = await models.Product.setStockQuantity(session, stock);
      // if (error) {
      //   throw error;
      // }

      if (type === 'Depot Transfer') {
        data.depot_id = transaction.depot_out_id;
        data.stock_quantity = item.qty * -1;
        dataArray.push({...data});

        // const stockOut = new models.Stock(data);
        // stockOut.depot = transaction.depot_out_id;
        // stockOut.stock_quantity = item.quantity * -1;
        // await stockOut.save({ session });

        // error = await models.Product.setStockQuantity(session, stockOut);
        // if (error) {
        //   throw error;
        // }
      } else if (type === 'Batch Packaging') {
        if (item.secondary_packaging_id && item.secondary_packaging_qty) {
          data.raw_material_id = item.secondary_packaging_id;
          data.quantity = item.secondary_packaging_qty;
          data.stock_quantity = item.secondary_packaging_qty * -1;
          dataArray.push({...data});
        }
      }
    }

    return dataArray;
  // } catch (error) {
  //   // console.log(error);

  //   return error;
  // }
}

Stock.getStockDetails = async function (type, transaction) {
  // try {
    let condition = { depot_id: transaction.depot_id };
    let items = null;
    let raw_material_id_arr = [];

    if (type === 'Raw Material In') {
      items = transaction.rawMaterialInItems;
      raw_material_id_arr = transaction.rawMaterialInItems.map(rawMaterialInItem => rawMaterialInItem.raw_material_id);
      condition = { 
        [Op.and]: [
          { depot_id: transaction.depot_id }, 
          { [Op.or]: [
            { raw_material_in_id: {[Op.ne]: transaction.id} }, 
            { raw_material_in_id: {[Op.is]: null} }
          ]},
          { raw_material_id: {[Op.in]: raw_material_id_arr} }
        ]
      };
    } else if (type === 'Depot Transfer') {
      items = transaction.depotTransferItems.map(item => item.type === 'Raw Material');
      raw_material_id_arr = transaction.depotTransferItems.map(item => item.type === 'Raw Material' && item.item_id);
      condition = { 
        [Op.and]: [
          { depot_id: transaction.depot_id }, 
          { [Op.or]: [
            { depot_transfer_id: {[Op.ne]: transaction.id} }, 
            { depot_transfer_id: {[Op.is]: null} }
          ]},
          { raw_material_id: {[Op.in]: raw_material_id_arr} }
        ]
      };
    } else if (type === 'Batch Processing') {
      items = transaction.batchProcessingItems;
      raw_material_id_arr = transaction.batchProcessingItems.map(batchProcessingItem => batchProcessingItem.raw_material_id);
      condition = { 
        [Op.and]: [
          { depot_id: transaction.depot_id }, 
          { [Op.or]: [
            { batch_processing_id: {[Op.ne]: transaction.id} }, 
            { batch_processing_id: {[Op.is]: null} }
          ]},
          { raw_material_id: {[Op.in]: raw_material_id_arr} }
        ]
      };
    } else if (type === 'Batch Packaging') {
      items = transaction.batchVariations;
      raw_material_id_arr = transaction.batchVariations.map(batchVariation => batchVariation.primary_packaging_id);
      raw_material_id_arr = [...raw_material_id_arr, transaction.batchVariations.map(batchVariation => batchVariation.secondary_packaging_id)];
      condition = { 
        [Op.and]: [
          { depot_id: transaction.depot_id }, 
          { [Op.or]: [
            { batch_processing_id: {[Op.ne]: transaction.id} }, 
            { batch_processing_id: {[Op.is]: null} }
          ]},
          { raw_material_id: {[Op.in]: raw_material_id_arr} }
        ]
      };
    } else if (type === 'Raw Material In Out') {
      items = transaction.rawMaterialInOutItems;
      raw_material_id_arr = transaction.rawMaterialInOutItems.map(rawMaterialInOutItem => rawMaterialInOutItem.raw_material_id);
      condition = { 
        [Op.and]: [
          { depot_id: transaction.depot_id }, 
          { [Op.or]: [
            { raw_material_in_out_id: {[Op.ne]: transaction.id} }, 
            { raw_material_in_out_id: {[Op.is]: null} }
          ]},
          { raw_material_id: {[Op.in]: raw_material_id_arr} }
        ]
      };
    } else if (type === 'Production Assemble') {
      items = transaction.productionRawMaterials;
      raw_material_id_arr = transaction.productionRawMaterials.map(productionRawMaterial => productionRawMaterial.raw_material_id);
      condition = { 
        [Op.and]: [
          { depot_id: transaction.depot_id }, 
          { [Op.or]: [
            { production_id: {[Op.ne]: transaction.id} }, 
            { production_id: {[Op.is]: null} }
          ]},
          { raw_material_id: {[Op.in]: raw_material_id_arr} }
        ]
      };
    } else if (type === 'Packaging Assemble') {
      items = transaction.packagingItems;
      raw_material_id_arr = transaction.packagingItems.map(packagingItem => packagingItem.raw_material_id);
      condition = { 
        [Op.and]: [
          { depot_id: transaction.depot_id }, 
          { [Op.or]: [
            { production_id: {[Op.ne]: transaction.id} }, 
            { production_id: {[Op.is]: null} }
          ]},
          { raw_material_id: {[Op.in]: raw_material_id_arr} }
        ]
      };
    }

    const stock = await Stock.findAll({
      where: condition,
      attributes: [
        'raw_material_id', 
        'barcode', 
        'expiry_date', 
        [sequelize.fn('ROUND', sequelize.fn('SUM', sequelize.col('stock_quantity')), 4), 'stock_qty']
      ],
      group: ['raw_material_id', 'barcode', 'expiry_date'],
      order: [['expiry_date', 'ASC']],
      raw: true
    });
  
    return stock;

  // } catch (error) {
  //   // console.log(error);

  //   return error;
  // }
}

Stock.getDepotTotalStock = async function (depot_id, raw_material_id) {
  // let stock = await Stock.sum('stock_quantity', { where: { depot_id: depot_id, raw_material_id: raw_material_id } });

  let stock = await Stock.findOne({
    attributes: [[sequelize.fn('ROUND', sequelize.fn('SUM', sequelize.col('stock_quantity')), 4), 'total_stock']],
    where: { depot_id: depot_id, raw_material_id: raw_material_id },
    raw: true
  });

  if (stock) {
    stock = (stock.total_stock && stock.total_stock > 0) ? stock.total_stock : 0;
  }
  
  return stock;
}

Stock.getDepotStock = async function (depot_id, raw_material_id) {
  const stock = await Stock.findAll({
    where: { depot_id: depot_id, raw_material_id: raw_material_id },
    attributes: [
      'raw_material_id', 
      'barcode', 
      'expiry_date', 
      [sequelize.fn('ROUND', sequelize.fn('SUM', sequelize.col('stock_quantity')), 4), 'stock_qty']
    ],
    group: ['raw_material_id', 'barcode', 'expiry_date'],
    order: [['expiry_date', 'ASC']],
    raw: true
  });

  return stock;
}

Stock.getManufacturerTotalStock = async function (depot_id) {
  const stock = await Stock.findAll({
    where: { depot_id: depot_id },
    attributes: [
      'raw_material_id', 
      [sequelize.fn('ROUND', sequelize.fn('SUM', sequelize.col('stock_quantity')), 4), 'stock_qty']
    ],
    group: ['raw_material_id'],
    order: [['raw_material_id', 'ASC']],
    raw: true
  });

  return stock;
}

Stock.getManufacturerStock = async function (depot_id) {
  const stock = await Stock.findAll({
    where: { depot_id: depot_id },
    attributes: [
      'raw_material_id', 'barcode', 'expiry_date', 
      [sequelize.fn('ROUND', sequelize.fn('SUM', sequelize.col('stock_quantity')), 4), 'stock_qty']
    ],
    group: ['raw_material_id', 'barcode', 'expiry_date'],
    order: [['raw_material_id', 'ASC'], ['expiry_date', 'ASC']],
    raw: true
  });

  return stock;
}

Stock.getStock = async function (depot_id, raw_material_id, type, transaction_id) {
  let condition = { depot_id: depot_id, raw_material_id: raw_material_id };
  
  if (type === 'Raw Material In') {
    condition = { 
      [Op.and]: [
        { depot_id: depot_id }, 
        { [Op.or]: [
          { raw_material_in_id: {[Op.ne]: transaction_id} }, 
          { raw_material_in_id: {[Op.is]: null} }
        ]},
        { raw_material_id: raw_material_id }
      ]
    };
  } else if (type === 'Depot Transfer') {
    condition = { 
      [Op.and]: [
        { depot_id: depot_id }, 
        { [Op.or]: [
          { depot_transfer_id: {[Op.ne]: transaction_id} }, 
          { depot_transfer_id: {[Op.is]: null} }
        ]},
        { raw_material_id: raw_material_id }
      ]
    };
  } else if (type === 'Batch Processing' || type === 'Batch Packaging') {
    condition = { 
      [Op.and]: [
        { depot_id: depot_id }, 
        { [Op.or]: [
          { batch_processing_id: {[Op.ne]: transaction_id} }, 
          { batch_processing_id: {[Op.is]: null} }
        ]},
        { raw_material_id: raw_material_id }
      ]
    };
  } else if (type === 'Raw Material In Out') {
    condition = { 
      [Op.and]: [
        { depot_id: depot_id }, 
        { [Op.or]: [
          { raw_material_in_out_id: {[Op.ne]: transaction_id} }, 
          { raw_material_in_out_id: {[Op.is]: null} }
        ]},
        { raw_material_id: raw_material_id }
      ]
    };
  } else if (type === 'Production Assemble') {
    condition = { 
      [Op.and]: [
        { depot_id: depot_id }, 
        { [Op.or]: [
          { production_id: {[Op.ne]: transaction_id} }, 
          { production_id: {[Op.is]: null} }
        ]},
        { raw_material_id: raw_material_id }
      ]
    };
  } else if (type === 'Packaging Assemble') {
    condition = { 
      [Op.and]: [
        { depot_id: depot_id }, 
        { [Op.or]: [
          { packaging_id: {[Op.ne]: transaction_id} }, 
          { packaging_id: {[Op.is]: null} }
        ]},
        { raw_material_id: raw_material_id }
      ]
    };
  }

  const stock = await Stock.findAll({
    where: condition,
    attributes: [
      'raw_material_id', 
      'barcode', 
      'expiry_date', 
      [sequelize.fn('ROUND', sequelize.fn('SUM', sequelize.col('stock_quantity')), 4), 'stock_qty']
    ],
    group: ['raw_material_id', 'barcode', 'expiry_date'],
    order: [['expiry_date', 'ASC']],
    raw: true
  });

  return stock;
}

Stock.getBarcodeStock = async function (depot_id, barcode, type, transaction_id) {
  let condition = { depot_id: depot_id, barcode: barcode };
  
  if (type === 'Raw Material In') {
    condition = { 
      [Op.and]: [
        { depot_id: depot_id }, 
        { [Op.or]: [
          { raw_material_in_id: {[Op.ne]: transaction_id} }, 
          { raw_material_in_id: {[Op.is]: null} }
        ]},
        { barcode: barcode }
      ]
    };
  } else if (type === 'Depot Transfer') {
    condition = { 
      [Op.and]: [
        { depot_id: depot_id }, 
        { [Op.or]: [
          { depot_transfer_id: {[Op.ne]: transaction_id} }, 
          { depot_transfer_id: {[Op.is]: null} }
        ]},
        { barcode: barcode }
      ]
    };
  } else if (type === 'Batch Processing' || type === 'Batch Packaging') {
    condition = { 
      [Op.and]: [
        { depot_id: depot_id }, 
        { [Op.or]: [
          { batch_processing_id: {[Op.ne]: transaction_id} }, 
          { batch_processing_id: {[Op.is]: null} }
        ]},
        { barcode: barcode }
      ]
    };
  } else if (type === 'Raw Material In Out') {
    condition = { 
      [Op.and]: [
        { depot_id: depot_id }, 
        { [Op.or]: [
          { raw_material_in_out_id: {[Op.ne]: transaction_id} }, 
          { raw_material_in_out_id: {[Op.is]: null} }
        ]},
        { barcode: barcode }
      ]
    };
  } else if (type === 'Production Assemble') {
    condition = { 
      [Op.and]: [
        { depot_id: depot_id }, 
        { [Op.or]: [
          { production_id: {[Op.ne]: transaction_id} }, 
          { production_id: {[Op.is]: null} }
        ]},
        { barcode: barcode }
      ]
    };
  } else if (type === 'Packaging Assemble') {
    condition = { 
      [Op.and]: [
        { depot_id: depot_id }, 
        { [Op.or]: [
          { packaging_id: {[Op.ne]: transaction_id} }, 
          { packaging_id: {[Op.is]: null} }
        ]},
        { barcode: barcode }
      ]
    };
  }

  const stock = await Stock.findAll({
    where: condition,
    attributes: [
      'raw_material_id', 
      'barcode', 
      'expiry_date', 
      [sequelize.fn('ROUND', sequelize.fn('SUM', sequelize.col('stock_quantity')), 4), 'stock_qty']
    ],
    group: ['raw_material_id', 'barcode', 'expiry_date'],
    order: [['expiry_date', 'ASC']],
    raw: true
  });

  return stock;
}

// Stock.prototype.getStockReport = async function (req) {
//   try {
//     let fromDate = new Date('2023-04-01 00:00:00');
//     let toDate = new Date();

//     if (req.body.fromDate) {
//       fromDate = new Date(req.body.fromDate);
//     }
//     if (req.body.toDate) {
//       toDate = new Date(req.body.toDate);
//     }

//     // console.log(fromDate);
//     // console.log(toDate);

//     // const stocks = models.Stock.find({ stock_date: {
//     //   $gte: fromDate, 
//     //   $lte: toDate
//     // }});

//     // const stocks = await models.Stock.aggregate([{
//     //   $match: {
//     //     status: 'Approved', stock_date: {
//     //       $gte: fromDate,
//     //       $lte: toDate
//     //     }
//     //   }
//     // },
//     // {
//     //   $group: {
//     //     _id: ["$depot", "$stock_type", "$productId"],
//     //     totalQty: { $sum: "$stock_quantity" }
//     //   }
//     // }]);

//     const stocks = await Stock.findAll({ 
//       where: { status: 'Approved', stock_date: {[Op.gte]: fromDate}, stock_date: {[Op.lte]: toDate} }, 
//       attributes: [
//         'status', 'stock_date', 'depot_id', 'raw_material_id', 'stock_type', 
//         [sequelize.fn('SUM', sequelize.col('stock_quantity')), 'total_quantity']
//       ], 
//       group: []
//     });

//     const openingStocks = await models.Stock.aggregate([{
//       $match: {
//         status: 'Approved', stock_date: {
//           $lt: toDate
//         }
//       }
//     },
//     {
//       $group: {
//         _id: ["$depot", "$productId"],
//         totalQty: { $sum: "$stock_quantity" }
//       }
//     }]);

//     const depots = await Depot.find();
//     const products = await Product.find().sort('productName');

//     const finalStocks = [];
//     for (const stock of stocks) {
//       const depotId = stock._id[0].toString();
//       const productId = stock._id[2].toString();

//       let index = finalStocks.findIndex(finalStock => {
//         return finalStock.depotId === depotId &&
//           finalStock.productId === productId
//       });

//       let item = {};

//       if (index === -1) {
//         const depot = depots.filter(depot => depot._id.toString() === depotId);
//         let depotName = '';
//         let depotCity = '';
//         let depotState = '';

//         if (depot && depot.length > 0) {
//           if (depot[0].depotName) {
//             depotName = depot[0].depotName;
//           }
//           if (depot[0].city) {
//             depotCity = depot[0].city;
//           }
//           if (depot[0].state && depot[0].state.stateName) {
//             depotState = depot[0].state.stateName;
//           }
//         }

//         // console.log(depot[0]);

//         for (const product of products) {
//           if (product._id.toString() == productId) {
//             index = finalStocks.length;
//           }

//           const openingStock = openingStocks.filter(openingStock => {
//             return openingStock._id[0].toString() == depotId &&
//               openingStock._id[1].toString() == product._id.toString();
//           });

//           let openingQty = 0;
//           if (openingStock && openingStock.length > 0) {
//             openingQty = openingStock[0].totalQty;
//           }

//           item = {
//             productId: product._id.toString(),
//             depotId: depotId,
//             state: depotState,
//             city: depotCity,
//             depotName: depotName,
//             productName: product.productName ? product.productName : '',
//             unitWeight: product.grams ? product.grams : '',
//             openingQty: openingQty,
//             grnQty: 0,
//             depotOutQty: 0,
//             depotInQty: 0,
//             saleQty: 0,
//             sampleQty: 0,
//             expiredQty: 0,
//             sellReturnQty: 0,
//             stockReconciliationQty: 0,
//             cost: product.costWithoutGst ? product.costWithoutGst : 0
//           };

//           finalStocks.push(item);
//         }
//       }

//       item = finalStocks[index];

//       if (stock._id[1] === 'Raw Material In') {
//         item.grnQty += parseFloat(stock.totalQty);
//       } else if (stock._id[1] === 'Depot Transfer') {
//         if (parseFloat(stock.totalQty) < 0) {
//           item.depotOutQty += parseFloat(stock.totalQty);
//         } else {
//           item.depotInQty += parseFloat(stock.totalQty);
//         }
//       } else if (stock._id[1] === 'Batch Processing') {
//         item.saleQty += parseFloat(stock.totalQty);
//       } else if (stock._id[1] === 'Raw Material In Out') {
//         item.stockReconciliationQty += parseFloat(stock.totalQty);
//       }

//       finalStocks[index] = item;
//     }

//     // console.log(finalStocks);

//     if (stocks) {
//       const template = getTemplatePath() + 'Product_stock_report_format.xlsx';

//       if (!fs.existsSync(template)) {
//         return 'Template not found.';
//       }

//       // console.log(template);

//       const workbook = new ExcelJS.Workbook();
//       await workbook.xlsx.readFile(template);
//       // const worksheet = workbook.addWorksheet('Stock');
//       const worksheet = workbook.getWorksheet(1);

//       // worksheet.getCell('A1').value = 'WYN Wellness Pvt Ltd';
//       // worksheet.getCell('A2').value = 'Product Stock Report';
//       worksheet.getCell('A3').value = fromDate.toLocaleDateString() + ' to ' + toDate.toLocaleDateString();

//       let rNum = 5;
//       let cNum = 1;

//       let row = worksheet.getRow(rNum++);
//       // row.getCell(cNum++).value = 'State';
//       // row.getCell(cNum++).value = 'City';
//       // row.getCell(cNum++).value = 'Depot Name';
//       // row.getCell(cNum++).value = 'Product';
//       // row.getCell(cNum++).value = 'Opening Qty';
//       // row.getCell(cNum++).value = 'Raw Material In Qty';
//       // row.getCell(cNum++).value = 'Depot In Qty';
//       // row.getCell(cNum++).value = 'Depot Out Qty';
//       // row.getCell(cNum++).value = 'Sale Qty';
//       // row.getCell(cNum++).value = 'Sample Qty';
//       // row.getCell(cNum++).value = 'Expire Qty';
//       // row.getCell(cNum++).value = 'Sale Return Qty';
//       // row.getCell(cNum++).value = 'Closing Balance';

//       // for (cNum = 1; cNum <= 13; cNum++) {
//       //   row.getCell(cNum).border = {
//       //     top: {style:'thin'},
//       //     left: {style:'thin'},
//       //     bottom: {style:'thin'},
//       //     right: {style:'thin'}
//       //   };
//       // }

//       for (const stock of finalStocks) {
//         cNum = 1;
//         // const closingBalance = stock.grnQty + stock.depotInQty + stock.depotOutQty + stock.saleQty + stock.sampleQty + stock.expiredQty + stock.sellReturnQty + stock.stockReconciliationQty;

//         row = worksheet.getRow(rNum);
//         row.getCell(cNum++).value = stock.state;
//         row.getCell(cNum++).value = stock.city;
//         row.getCell(cNum++).value = stock.depotName;
//         row.getCell(cNum++).value = stock.productName;
//         row.getCell(cNum++).value = stock.openingQty;
//         row.getCell(cNum++).value = stock.grnQty;
//         row.getCell(cNum++).value = stock.depotInQty;
//         row.getCell(cNum++).value = stock.depotOutQty;
//         row.getCell(cNum++).value = stock.saleQty;
//         row.getCell(cNum++).value = stock.sampleQty;
//         row.getCell(cNum++).value = stock.expiredQty;
//         row.getCell(cNum++).value = stock.sellReturnQty;
//         row.getCell(cNum++).value = stock.stockReconciliationQty;
//         row.getCell(cNum++).value = { formula: `E${rNum} + F${rNum} + G${rNum} + H${rNum} + I${rNum} + J${rNum} + K${rNum} + L${rNum} + M${rNum}` };
//         row.getCell(cNum++).value = stock.cost;
//         row.getCell(cNum++).value = { formula: `N${rNum} * O${rNum}` };

//         for (cNum = 1; cNum <= 16; cNum++) {
//           row.getCell(cNum).border = {
//             top: { style: 'thin' },
//             left: { style: 'thin' },
//             bottom: { style: 'thin' },
//             right: { style: 'thin' }
//           };
//         }

//         rNum++;
//       }

//       worksheet.getCell('A1').font = { bold: true };

//       // worksheet.autoFilter = {
//       //   from: 'A1',
//       //   to: 'M' + rNum
//       // }

//       const fileName = `Product_stock_report_${Date.now()}.xlsx`;
//       const filePath = getReportPath() + fileName;
//       await workbook.xlsx.writeFile(filePath);

//       const fileKey = `reports/${fileName}`;

//       // const fileUrl = '';
//       const fileUrl = await uploadFileToS3Bucket(filePath, fileKey);

//       // console.log(fileUrl);

//       return fileUrl;
//     } else {
//       return 'No Stock Found';
//     }
//   } catch (error) {
//     console.log(error);
//     return error;
//   }
// }

// Stock.prototype.getDepotStock = async function (req) {
//   try {
//     let fromDate = new Date('2023-04-01 00:00:00');
//     let toDate = new Date();
//     let depot = '';

//     if (req.body && req.body.fromDate) {
//       fromDate = new Date(req.body.fromDate);
//     }
//     if (req.body && req.body.toDate) {
//       toDate = new Date(req.body.toDate);
//     }
//     if (req.body && req.body.depot) {
//       depot = req.body.depot;
//     }

//     // console.log(fromDate);
//     // console.log(toDate);
//     // console.log(depot);

//     // const stocks = models.Stock.find({ stock_date: {
//     //   $gte: fromDate, 
//     //   $lte: toDate
//     // }});

//     let condition = {};
//     if (depot) {
//       condition = {
//         status: 'Approved', depot: new Types.ObjectId(depot), stock_date: {
//           $gte: fromDate,
//           $lte: toDate
//         }
//       };
//     } else {
//       condition = {
//         status: 'Approved', stock_date: {
//           $gte: fromDate,
//           $lte: toDate
//         }
//       };
//     }

//     const stocks = await models.Stock.aggregate([{ $match: condition },
//     {
//       $group: {
//         _id: ["$depot", "$productId"],
//         totalQty: { $sum: "$stock_quantity" }
//       }
//     }]);

//     // console.log(stocks);

//     const products = await Product.find();
//     let depots = [];
//     if (depot) {
//       depots = await Depot.find({ status: 'Approved', _id: depot.toString() });
//     } else {
//       depots = await Depot.find({ status: 'Approved' });
//     }

//     const checkStocks = [];
//     for (const stock of stocks) {
//       const item = {
//         depotId: stock._id[0].toString(),
//         productId: stock._id[1].toString(),
//         quantity: stock.totalQty
//       };
//       checkStocks.push(item);
//     }

//     const finalStocks = [];
//     for (const depot of depots) {
//       const depotId = depot._id.toString();
//       for (const product of products) {
//         const productId = product._id.toString();
//         const index = checkStocks.findIndex(checkStock => {
//           return checkStock.depotId === depotId && checkStock.productId === productId;
//         });
//         let quantity = 0;
//         if (index !== -1) {
//           quantity = checkStocks[index].quantity;
//         }
//         const item = {
//           depotId: depotId,
//           depotName: depot.depotName,
//           productId: productId,
//           productName: product.productName,
//           quantity: quantity
//         }
//         finalStocks.push(item);
//       }
//     }

//     return finalStocks;
//   } catch (error) {
//     // console.log(error);
//     return error;
//   }
// }

// Stock.prototype.checkStock = async function (type, transaction) {
//   try {
//     let condition = { status: 'Approved' };
//     let items = [];
//     let depotOut = null;
//     let depotIn = null;

//     if (transaction) {
//       if (type === 'Raw Material In') {
//         if (transaction.refId) {
//           condition = { status: 'Approved', raw_material_in_id: { $ne: transaction.refId } };
//         } else if (transaction.status && transaction.status.trim().toUpperCase() === 'APPROVED') {
//           condition = { status: 'Approved', raw_material_in_id: { $ne: transaction._id } };
//         }
//         items = transaction.rawMaterialInItems ? transaction.rawMaterialInItems : [];
//         depotIn = transaction.depot;
//       } else if (type === 'Depot Transfer') {
//         if (transaction.refId) {
//           condition = { status: 'Approved', depotTransfer: { $ne: transaction.refId } };
//         } else if (transaction.status && transaction.status.trim().toUpperCase() === 'APPROVED') {
//           condition = { status: 'Approved', depotTransfer: { $ne: transaction._id } };
//         }
//         items = transaction.depotTransferItems ? transaction.depotTransferItems : [];
//         depotOut = transaction.depotOut;
//         depotIn = transaction.depotIn;
//       } else if (type === 'Batch Processing') {
//         if (transaction.refId) {
//           condition = { status: 'Approved', sell: { $ne: transaction.refId } };
//         } else if (transaction.status && transaction.status.trim().toUpperCase() === 'APPROVED') {
//           condition = { status: 'Approved', sell: { $ne: transaction._id } };
//         }
//         items = transaction.sellItems ? transaction.sellItems : [];
//         depotOut = transaction.depot;
//       } else if (type === 'Raw Material In Out') {
//         if (transaction.refId) {
//           condition = { status: 'Approved', stockReconciliation: { $ne: transaction.refId } };
//         } else if (transaction.status && transaction.status.trim().toUpperCase() === 'APPROVED') {
//           condition = { status: 'Approved', stockReconciliation: { $ne: transaction._id } };
//         }
//         items = transaction.stockReconciliationItems ? transaction.stockReconciliationItems : [];
//         depotIn = transaction.depot;
//       }
//     }

//     const stocks = await models
//       .Stock
//       .aggregate(
//         [
//           { $match: condition },
//           {
//             $group: {
//               _id: ['$depot', '$productId'],
//               totalQty: { $sum: '$stock_quantity' }
//             }
//           }
//         ]
//       );

//     const products = await Product.find();
//     const depots = await Depot.find();
//     const checkStock = [];
//     if (products) {
//       for (const product of products) {
//         for (const depot of depots) {
//           checkStock.push({
//             depot: depot._id.toString(),
//             product: product._id.toString(),
//             productName: product.productName,
//             stock_quantity: 0,
//             quantity: 0
//           });
//         }
//       }
//     }

//     for (const stock of stocks) {
//       if (stock && stock._id && stock._id.length === 2) {
//         const index = checkStock.findIndex(chkStock => {
//           return (chkStock.depot === stock._id[0].toString() && chkStock.product === stock._id[1].toString());
//         });

//         let chkStock = {
//           depot: stock._id[0].toString(),
//           product: stock._id[1].toString(),
//           productName: '',
//           stock_quantity: round(stock.totalQty ? stock.totalQty : 0, 4),
//           quantity: round(stock.totalQty ? stock.totalQty : 0, 4)
//         };
//         if (index !== -1) {
//           chkStock = checkStock[index];
//           chkStock.stock_quantity = round(stock.totalQty ? stock.totalQty : 0, 4);
//           chkStock.quantity += round(stock.totalQty ? stock.totalQty : 0, 4);
//           checkStock[index] = chkStock;
//         } else {
//           checkStock.push(chkStock);
//         }
//       }
//     }

//     if (!transaction.isDeleted) {
//       for (const item of items) {
//         if (item && item.productId && item.quantity) {
//           if (depotOut) {
//             const index = checkStock.findIndex(chkStock => {
//               return chkStock.depot === depotOut.toString() && chkStock.product === item.productId.toString();
//             });
  
//             let chkStock = {
//               depot: depotOut.toString(),
//               product: item.productId.toString(),
//               productName: '',
//               stock_quantity: 0,
//               quantity: round(item.quantity, 4)
//             };
//             if (index !== -1) {
//               chkStock = checkStock[index];
//               chkStock.quantity -= round(item.quantity, 4);
//               checkStock[index] = chkStock;
//             } else {
//               checkStock.push(chkStock);
//             }
//           }
//           if (depotIn) {
//             const index = checkStock.findIndex(chkStock => {
//               return chkStock.depot === depotIn.toString() && chkStock.product === item.productId.toString();
//             });
  
//             let chkStock = {
//               depot: depotIn.toString(),
//               product: item.productId.toString(),
//               productName: '',
//               stock_quantity: 0,
//               quantity: round(item.quantity, 4)
//             };
//             if (index !== -1) {
//               chkStock = checkStock[index];
//               chkStock.quantity += round(item.quantity, 4);
//               checkStock[index] = chkStock;
//             } else {
//               checkStock.push(chkStock);
//             }
//           }
//         }
//       }
//     }
    
//     const stock = checkStock.filter(chkStock => chkStock.quantity < 0);
//     // console.log(stock);
//     if (stock && stock.length > 0) {
//       let message = 'Stock will be negative. ';
//       message += stock.map(s => s.productName + ' (stock: ' + s.stock_quantity + ') (Difference: ' + s.quantity + ')').join(' ');
//       return message;
//     } else {
//       return null;
//     }
//   } catch (error) {
//     return error;
//   }
// }

export default Stock;