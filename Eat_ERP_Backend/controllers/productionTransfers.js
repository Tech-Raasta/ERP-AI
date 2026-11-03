import { Op, Sequelize } from 'sequelize';
import sequelize from '../lib/database.js';
import ProductionTransfer from '../models/productionTransfer.js';
import DepotTransfer from '../models/depotTransfer.js';
import DepotTransferItem from '../models/depotTransferItem.js';
import Production from '../models/production.js';
import Product from '../models/product.js';
import EasyEcomInventory from '../models/easyEcomInventory.js';
import Box from '../models/box.js';
import EasyEcomApi from '../lib/easyEcomApi.js';
import axios from 'axios';
import dotenv from 'dotenv';

export const getProductionTransfers = async (req, res, next) => {
  try {
    const production = await Production.findByPk(req.params.id, { 
      include: [
        { model: Product, as: "product", attributes: ['id', 'product_name', 'short_name'] },
        { model: ProductionTransfer, as: "productionTransfers", include: 'box' }
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
      message: "Production Transfers fetched successfully!", 
      action, 
      production
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Production Transfers failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Production Transfers failed!";
    next(error, req, res);
  }
};

export const approveProductionTransfer = async (req, res, next) => {
  let t;

  try {
    let productionTransfer = await ProductionTransfer.findByPk(req.params.id);
    if (!productionTransfer) {
      return res.status(404).json({
        message: "Production Transfer not found!"
      });
    }

    // if (productionTransfer.modified_by === req.userData.userId) {
    //   return res.status(422).json({ 
    //     message: `You can't approve this Production.`, 
    //     error : { 
    //       errors : { 
    //         productionTransfer: { message: `You can't approve this Production.` } 
    //       } 
    //     }
    //   });
    // }

    // console.log(productionTransfer);

    if (productionTransfer.status.trim().toUpperCase() !== 'PENDING' && productionTransfer.status.trim().toUpperCase() !== 'REJECTED' && productionTransfer.status.trim().toUpperCase() !== 'DELETED') {
      return res.status(422).json({ 
        message: `Production Transfer status should be pending, rejected or deleted.`, 
        error : { 
          errors : { 
            productionTransfer: { message: `Production Transfer status should be pending, rejected or deleted.` } 
          } 
        }
      });
    }

    let production = await Production.findByPk(productionTransfer.production_id, { include: 'productionTransfers' });

    let depotTransfer = await DepotTransfer.setProductionData(production, 'Box');

    // const depotTransfer = await DepotTransfer.findByPk(productionTransfer.depot_transfer_id);
    if (!depotTransfer) {
      return res.status(422).json({ 
        message: `Depot transfer not found.`, 
        error : { 
          errors : { 
            productionTransfer: { message: `Depot transfer not found.` } 
          } 
        }
      });
    }

    // if (depotTransfer.status.trim().toUpperCase() === 'APPROVED') {
    //   return res.status(422).json({ 
    //     message: `Depot Transfer is already approved.`, 
    //     error : { 
    //       errors : { 
    //         productionTransfer: { message: `Depot Transfer is already approved.` } 
    //       } 
    //     }
    //   });
    // }

    productionTransfer.approve(req);
    depotTransfer.approve(req);

    // console.log(error);
    // productionTransfer.approvedBy = req.userData.userId;
    // productionTransfer.approvedAt = new Date().toISOString();

    // const error = await productionTransfer.validateData();
    // if (error) {
    //   return res.status(422).json({
    //     message: "Invalid inputs passed, please check your data.",
    //     error: error
    //   });
    // }

    // try {
      t = await sequelize.transaction();
      
      await productionTransfer.save({ transaction: t });

      await depotTransfer.save({ transaction: t });

      const depotTransferItem = await DepotTransferItem.build({
        depot_transfer_id: depotTransfer.id
      });
      depotTransferItem.setStoreTransfer(productionTransfer);
      const box = await Box.findByPk(depotTransferItem.item_id);
      if(box) {
        depotTransferItem.item_name = box.box_name;
      }

      depotTransferItem.barcode = production.batch_id_as_per_fssai;

      await depotTransferItem.save({ transaction: t });
      
      // await EasyEcomInventory.create({
      //   id: productionTransfer.id,
      //   product_id: production.product_id,
      //   production_id: productionTransfer.production_id,
      //   box_id: productionTransfer.box_id,
      //   variation_qty: productionTransfer.variation_qty,
      //   qty: productionTransfer.qty,
      //   grams: productionTransfer.grams,
      //   date_of_transfer: new Date(),
      //   date_of_synced: null,
      //   date_of_synced_by: null,
      // },{ transaction: t });

      await t.commit();

      production = await Production.findByPk(productionTransfer.production_id, { include: 'productionTransfers' });
      production.setTransferPending();
      production.save();
         
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

export const rejectProductionTransfer = async (req, res, next) => {
  let t;
  
  try {
    let productionTransfer = await ProductionTransfer.findByPk(req.params.id);

    if (!productionTransfer) {
      return res.status(404).json({
        message: "Production Transfer not found!"
      });
    }

    // if (productionTransfer.modified_by.toString() === req.userData.userId.toString()) {
    //   return res.status(422).json({ 
    //     message: `You can't reject this Production.`, 
    //     error : { 
    //       errors : { 
    //         productionTransfer: { message: `You can't reject this Production.` } 
    //       } 
    //     }
    //   });
    // }

    if (productionTransfer.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({ 
        message: `Production Transfer is already approved.`, 
        error : { 
          errors : { 
            productionTransfer: { message: `Production Transfer is already approved.` } 
          } 
        }
      });
    }

    if (productionTransfer.status.trim().toUpperCase() !== 'PENDING' && productionTransfer.status.trim().toUpperCase() !== 'REJECTED' && productionTransfer.status.trim().toUpperCase() !== 'DELETED') {
      return res.status(422).json({ 
        message: `Production Transfer status should be pending, rejected or deleted.`, 
        error : { 
          errors : { 
            productionTransfer: { message: `Production Transfer status should be pending, rejected or deleted.` } 
          } 
        }
      });
    }

    // const depotTransfer = await DepotTransfer.findByPk(productionTransfer.depot_transfer_id);
    // if (!depotTransfer) {
    //   return res.status(422).json({ 
    //     message: `Depot transfer not found.`, 
    //     error : { 
    //       errors : { 
    //         productionTransfer: { message: `Depot transfer not found.` } 
    //       } 
    //     }
    //   });
    // }

    // if (depotTransfer.status.trim().toUpperCase() === 'APPROVED') {
    //   return res.status(422).json({ 
    //     message: `Depot Transfer is already approved.`, 
    //     error : { 
    //       errors : { 
    //         productionTransfer: { message: `Depot Transfer is already approved.` } 
    //       } 
    //     }
    //   });
    // }

    productionTransfer.reject(req);
    // depotTransfer.reject(req);

    t = await sequelize.transaction();
    
    await productionTransfer.save({ transaction: t });
    // await depotTransfer.save({ transaction: t });
    
    await t.commit();


    // const production = await Production.findByPk(productionTransfer.production_id, { include: 'productionTransfers' });
    // production.setTransferPending();
    // production.save();
       

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

export const deleteProductionTransfer = async (req, res, next) => {
  let t;

  try {
    let productionTransfer = await ProductionTransfer.findByPk(req.params.id);
    if (!productionTransfer) {
      return res.status(404).json({ message: "Production not found!" });
    }

    // if (productionTransfer.modified_by.toString() !== req.userData.userId.toString()) {
    //   return res.status(422).json({ 
    //     message: `You can't delete this Production.`, 
    //     error : { 
    //       errors : { 
    //         productionTransfer: { message: `You can't delete this Production.` } 
    //       } 
    //     }
    //   });
    // }
    
    if (productionTransfer.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({ 
        message: `Production Transfer is already approved.`, 
        error : { 
          errors : { 
            productionTransfer: { message: `Production Transfer is already approved.` } 
          } 
        }
      });
    }

    if (productionTransfer.status.trim().toUpperCase() !== 'PENDING' && productionTransfer.status.trim().toUpperCase() !== 'REJECTED' && productionTransfer.status.trim().toUpperCase() !== 'DELETED') {
      return res.status(422).json({ 
        message: `Production Transfer status should be pending, rejected or deleted.`, 
        error : { 
          errors : { 
            productionTransfer: { message: `Production Transfer status should be pending, rejected or deleted.` } 
          } 
        }
      });
    }

    // const depotTransfer = await DepotTransfer.findByPk(productionTransfer.depot_transfer_id);
    // if (!depotTransfer) {
    //   return res.status(422).json({ 
    //     message: `Depot transfer not found.`, 
    //     error : { 
    //       errors : { 
    //         productionTransfer: { message: `Depot transfer not found.` } 
    //       } 
    //     }
    //   });
    // }

    // if (depotTransfer.status.trim().toUpperCase() === 'APPROVED') {
    //   return res.status(422).json({ 
    //     message: `Depot Transfer is already approved.`, 
    //     error : { 
    //       errors : { 
    //         productionTransfer: { message: `Depot Transfer is already approved.` } 
    //       } 
    //     }
    //   });
    // }

    t = await sequelize.transaction();

    await ProductionTransfer.destroy({ where: { id: productionTransfer.id }, transaction: t });
    // await DepotTransferItem.destroy({ where: { depot_transfer_id: depotTransfer.id }, transaction: t });
    // await DepotTransfer.destroy({ where: { id: depotTransfer.id }, transaction: t });

    await t.commit();
    
    // const production = await Production.findByPk(productionTransfer.production_id, { include: 'productionTransfers' });
    // production.setTransferPending();
    // production.save();
       
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


// @desc Bulk Create Easy Ecom autoGRN
// @route POST /api/production_transfer/sync
// @access Private
export const syncProductionTransfer = async (req, res, next) => {
  let t;

  try {

    const { vendor_id, batch_code, date_of_processing, date_of_expiry, location_key, items } = req.body;

    // Validate request body
    if (!vendor_id || !items || items.length === 0) {
      return res.status(404).json({
        message: "vendor_id and items are required!"
      });
    }

    const itemIds = items.map(item => item.transfer_id);

    const productionTransfers = await ProductionTransfer.findAll({ where: { status: 'Approved', uploaded_to_easyecom:0, id: { [Op.in]: itemIds } } });

    if (productionTransfers.length !== items.length) {
      return res.status(404).json({
        message: "One or more Production Transfers not found!"
      });
    }
    

    if(location_key) {

      t = await sequelize.transaction();
  
      // Create auto GRN in Easy Ecom for each item and update the production transfer records in our database
      const autoGrnItems = items.map(item => {
                            return {
                              sku: item.sku, 
                              quantity: item.quantity, 
                              cost: item.cost, 
                              batch_code: batch_code,
                              expiry_date: date_of_expiry,
                              mfg_date: date_of_processing
                            }
                          });
  
      const easyEcomApi = new EasyEcomApi(location_key);
      console.log(`Syncing with EasyEcom for location key: ${location_key}`);
      const tokenDetails = await easyEcomApi.getToken();
      console.log(`Syncing with EasyEcom for tokenDetails: ${tokenDetails}`);
      const headers = {
          'x-api-key': process.env.EASYECOMAPI_X_API_KEY,
          'Authorization': 'Bearer ' + tokenDetails.jwt_token
      };
      
      const uri = process.env.EASYECOMAPI_URI + 'wms/QueueGrnApi';
      console.log(`Request URI: ${uri} with payload: ${JSON.stringify({vendor_id:vendor_id, items:autoGrnItems})}`);
      const response = await axios.post(uri, {vendor_id:vendor_id, items:autoGrnItems}, { headers: headers });
      console.log(`Response from EasyEcom: ${JSON.stringify(response.data)}`);
      if (response.data.code === 200) {
        // return response;
        for(const item of items) {
          // Update the created grn against po in our database 
          const productionTransfer = productionTransfers.find(pt => pt.id === item.transfer_id);
          if (productionTransfer) {
            productionTransfer.syncToEasyEcom();
            productionTransfer.uploaded_by = req.userData.userId;
            productionTransfer.uploaded_qty = item.quantity;
            await productionTransfer.save({ transaction: t });
          }
        }
        await t.commit();
        res.status(200).json({ message: "Sync Successful!", ProductionTransfers: productionTransfers });
      } else if(response.data.code === 400){
        const errorResponse = response.data;
        res.status(422).json({ error:"Sync Failed!", message: errorResponse.message ? errorResponse.message : errorResponse});
      } else {
          const errorResponse = response.data;
          const err = response.statusText;
          console.log(`error Response: ${JSON.stringify(errorResponse)} reason: ${err}`);
  
          return err;
      }
    }else{
      res.status(406).json({ error:"Sync Failed!", message: "Location Key is required for syncing with EasyEcom!" });
    }
    

  } catch (error) {
    
    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Proctions Transfer Sync Failed!";
    next(error, req, res);
  }
};