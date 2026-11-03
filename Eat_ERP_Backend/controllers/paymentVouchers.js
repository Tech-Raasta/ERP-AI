import { Op } from 'sequelize';
import sequelize from '../lib/database.js';

import PaymentVoucher, { 
  getPaymentVoucherMasterData, 
  getRawMaterialInData, 
  getVendorPurchaseOrders, 
  getPurchaseOrderDetails, 
  mailPaymnentRejection, 
  mailPaymnentVoucherRejection
} from '../models/paymentVoucher.js';
import PaymentVoucherItem from '../models/paymentVoucherItem.js';
// import Depot from '../models/depot.js';
// import Vendor from '../models/vendor.js';
import { getSeries } from '../models/series.js';
import PurchaseOrder from '../models/purchaseOrder.js';
import RawMaterialIn from '../models/rawMaterialIn.js';
// import RawMaterial from '../models/rawMaterial.js';
// import RawMaterialIn from '../models/rawMaterialIn.js';
// import { Sequelize } from 'sequelize';

export const getMasterData = async (req, res, next) => {
  try {
    const masterData = await getPaymentVoucherMasterData(null, req);

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

export const getVendorPos = async (req, res, next) => {
  try {
    const vendor_id = req.params.vendor_id;
    const purchaseOrders = await getVendorPurchaseOrders(vendor_id);

    return res.status(200).json({ 
      message: "Vendor Purchase Orders fetched successfully!",
      purchaseOrders 
    });
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

export const getPoDetails = async (req, res, next) => {
  try {
    const po_id = req.params.po_id;
    const { purchaseOrder } = await getPurchaseOrderDetails(po_id, 0);

    return res.status(200).json({ 
      message: "Purchase Order Details fetched successfully!",
      purchaseOrder
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Purchase Order Details failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Purchase Order Details failed!";
    next(error, req, res);
  }
};

export const getPaymentVouchers = async (req, res, next) => {
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
      sort = { key: req.query.key ? req.query.key : 'modified_on', order: req.query.order ? req.query.order : 'desc' };
    }

    // let totalCount = 0;
    const statusCount = {
      inProcess: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      inActive: 0
    };
    const data = await PaymentVoucher.findAll(
      { 
        where: { depot_id: {[Op.in]: req.userData.depotIds} }, 
        attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']], 
        group:['status'], 
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
      else if (item.status === "InProcess") {
        statusCount.inProcess = statusCount.inProcess + parseInt(item.count);
        // totalCount = parseInt(item.count);
      }
    }
    
    let condition = {};
    let statusCondition = { status: 'Pending' };
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
          {[Op.or]: [
            { 'invoice_no': {[Op.like]: `%${query}%` } }, 
            { 'vendor_name': {[Op.like]: `%${query}%` } }, 
            { 'total_payable': {[Op.like]: `%${query}%` } }
            // Sequelize.literal("`depot`.`depot_name` LIKE '%"+query+"%'"), 
            // Sequelize.literal("`vendor`.`vendor_name` LIKE '%"+query+"%'")
          ]},
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

    // condition['attributes'] = ['id', 'date_of_processing', 'vendor_state', 'default_state', 'depot_state', 'depot_id', 'vendor_id', 
    //                             'requestor_id', 'tds_per', 'total_payable', 'final_amount', 'voucher_no', 'invoice_date', 
    //                             'invoice_no', 'type_use', 'type', 'po_no', 'attached', 'tdsamount', 'po_id', 'po_status', 
    //                             'other_charges_amount', 'other_charges', 'po_previous_state', 'vendor_name', 'gst_in', 
    //                             'tax_type', 'pay_immediately', 'raw_material_in_id', 'doc_document', 'document_name', 
    //                             'is_paid', 'status', 'remark', 'created_by', 'modified_by', 'approved_by', 'approved_on', 
    //                             'rejected_by', 'rejected_on', 'round_off_amount', 'paid_amount', 'created_on', 'modified_on'];

    // condition['subQuery'] = false;

    // condition['include'] = [
    //   { model: Depot, as: 'depot', attributes: ['depot_name'] }, 
    //   { model: Vendor, as: 'vendor', attributes: ['vendor_name'] }
    // ];

    const { count, rows } = await PaymentVoucher.findAndCountAll(condition);

    // console.log(req.userData);

    // console.log(count);
    // console.log(rows);

    res.status(200).json({
      message: "Payment Vouchers fetched successfully!",
      // totalCount: totalCount,
      total: count,
      statusCount: statusCount,
      rows: rows
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Payment Vouchers failed!"
    // });

    // console.log(error);
    
    res.statusCode = 500;
    res.message = "Fetching Payment Vouchers failed!";
    next(error, req, res);
  }
};

export const getPaymentVoucher = async (req, res, next) => {
  try {
    const paymentVoucher = await PaymentVoucher.findByPk(req.params.id, {
      include: ['paymentVoucherItems', 'vendor', 'depot', 'purchase_order', 'requested_by_user', 'created_by_user', 'modified_by_user', 'approved_by_user']
    });
    if (!paymentVoucher) {
      return res.status(404).json({ message: "Payment Voucher not found!" });
    }

    const roleDetails = req.userData.roleDetails;

    // console.log(roleDetails);

    const action = {
      update: false,
      delete: false,
      approve: false
    };

    // console.log(paymentVoucher.modified_by.toString());
    // console.log(req.userData.userId);
    
    // if (paymentVoucher.isFreezed) {
    //   if (paymentVoucher.status.trim().toUpperCase() !== 'APPROVED' && paymentVoucher.status.trim().toUpperCase() !== 'INACTIVE') {
    //     if (roleDetails.r_edit) {
    //       action.update = true;
    //     }
    //     if (roleDetails.r_delete) {
    //       action.delete = true;
    //     }
    //   }
    // } else {
      if (paymentVoucher.status.trim().toUpperCase() === 'APPROVED' || paymentVoucher.status.trim().toUpperCase() === 'INACTIVE') {
        //Do Nothing
        if (roleDetails.r_edit) {
          action.update = true;
        }
        if (roleDetails.r_delete) {
          // action.delete = true;
          action.delete = false;
        }
      } else if (!roleDetails.r_approvals || 
            (paymentVoucher.status.trim().toUpperCase() !== 'PENDING' && 
            paymentVoucher.status.trim().toUpperCase() !== 'DELETED') || 
            paymentVoucher.modified_by.toString() === req.userData.userId.toString()) 
      {
        if (roleDetails.r_edit) {
          action.update = true;
        }
        if (roleDetails.r_delete) {
          action.delete = true;
          // action.delete = false;
        }
      } else if (roleDetails.r_approvals && (req.userData.userId === 3 || req.userData.userId === 2 || req.userData.userId === 439 || req.userData.userId === 148 || req.userData.userId === 483 || req.userData.userId === 509 || req.userData.userId === 519)) {
        action.approve = true;
      }
    // }
    
  
    // const pincodes = await Pincode.findAll({ attributes: ['id', 'pincode', 'state_id'] });
    // const cities = await City.findAll({ attributes: ['id', 'city_name', 'state_id'] });
    // const states = await State.findAll({ attributes: ['id', 'state_name', 'country_id'] });
    // const countries = await Country.findAll({ attributes: ['id', 'country_name'] });

    const masterData = await getPaymentVoucherMasterData(paymentVoucher, req);
    const rawMaterialIn = await getRawMaterialInData(paymentVoucher.raw_material_in_id);
  
    return res.status(200).json({ 
      message: "Payment Voucher fetched successfully!",
      action, 
      paymentVoucher, 
      rawMaterialIn, 
      masterData
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Payment Voucher failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Payment Voucher failed!";
    next(error, req, res);
  }
};

export const createPaymentVoucher = async (req, res, next) => {
  let t;
  
  try {
    const paymentVoucher = await PaymentVoucher.build({
      requestor_id: req.userData.userId,
      // type: 'Expense',
      default_state: 'Maharashtra',
      status: 'InProcess',
      is_paid: 0,
      paid_amount: 0,
      created_by: req.userData.userId,
      modified_by: req.userData.userId
    });

    paymentVoucher.getRequestData(req);
    
    let error = await paymentVoucher.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }
    
    const tax_type = await paymentVoucher.setTaxType();
    
    const items = paymentVoucher.getPaymentVoucherItems(req.body);
    const paymentVoucherItems = [];
    for(const item of items) {
      const paymentVoucherItem = await PaymentVoucherItem.build({
        tax_type: tax_type
      });
      paymentVoucherItem.getRequestData(item);
      error = await paymentVoucherItem.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      await paymentVoucherItem.setItemAmount();
      paymentVoucherItems.push(paymentVoucherItem);
    }

    paymentVoucher.setTransactionAmount(paymentVoucherItems);

    t = await sequelize.transaction();
    await paymentVoucher.save({ transaction: t });

    for(const paymentVoucherItem of paymentVoucherItems) {
      paymentVoucherItem.payment_voucher_id = paymentVoucher.id;
      await paymentVoucherItem.save({ transaction: t });
    }

    await t.commit();
    
    return res.status(201).json({
      message: "Payment Voucher added successfully",
      paymentVoucher: paymentVoucher
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Creating a paymentVoucher failed!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Creating a Payment Voucher failed!";
    next(error, req, res);
  }
};

export const updatePaymentVoucher = async (req, res, next) => {
  let t;

  try {
    let paymentVoucher = await PaymentVoucher.findByPk(req.params.id);
    if (!paymentVoucher) {
      return res.status(404).json({message: "Payment Voucher not found!"});
    }

    let blUpdate = false;
    // let items = [];
    // if (paymentVoucher.status && paymentVoucher.status.trim().toUpperCase() === 'APPROVED') {
    //   // return res.status(404).json({message: "Payment Voucher is already approved!"});

    //   // paymentVoucher = await PaymentVoucher.build({
    //   //   status: 'Pending',
    //   //   created_by: req.userData.userId,
    //   //   modified_by: req.userData.userId
    //   // });
  
    //   // paymentVoucher.getRequestDataForRate(req);

    //   // paymentVoucher.ref_id = req.params.id;

    //   // duplicate and insert existing raw material items & item weights
    //   // update raw material in item id in item weights
    //   // items = [];
    // } else {
    //   // paymentVoucher.getRequestData(req);
    //   // if (req.userData.userId === 3 || req.userData.userId === 2 || req.userData.userId === 439 || req.userData.userId === 449 || req.userData.userId === 466 || req.userData.userId === 148 || req.userData.userId === 483) {
    //   //   paymentVoucher.status = 'Pending';
    //   // } else {
    //   //   paymentVoucher.status = 'InProcess';
    //   // }
    //   // paymentVoucher.modified_by = req.userData.userId;
    //   // blUpdate = true;

    //   // items = paymentVoucher.getPaymentVoucherItemsForRate(req.body);
    // }

    if ((paymentVoucher.is_paid && paymentVoucher.is_paid === 1) || (paymentVoucher.paid_amount && paymentVoucher.paid_amount > 0)) {
      // return res.status(404).json({message: "Payment for this Voucher is already processed!"});

      return res.status(422).json({ 
        message: `Payment for this Voucher is already processed!`, 
        error : { 
          errors : { 
            invoice_no: { message: `Payment for this Voucher is already processed!` } 
          } 
        }
      });
    }

    paymentVoucher.getRequestData(req);
    if (req.userData.userId === 3 || req.userData.userId === 2 || req.userData.userId === 439 || req.userData.userId === 449 || req.userData.userId === 466 || req.userData.userId === 148 || req.userData.userId === 483 || req.userData.userId === 509 || req.userData.userId === 519) {
      paymentVoucher.status = 'Pending';
    } else {
      paymentVoucher.status = 'InProcess';
    }
    paymentVoucher.modified_by = req.userData.userId;
    blUpdate = true;

    let error = await paymentVoucher.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    const tax_type = await paymentVoucher.setTaxType();
    
    const items = paymentVoucher.getPaymentVoucherItems(req.body);
    const paymentVoucherItems = [];
    for(const item of items) {
      const paymentVoucherItem = await PaymentVoucherItem.build({
        tax_type: tax_type
      });
      paymentVoucherItem.getRequestData(item);
      error = await paymentVoucherItem.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      await paymentVoucherItem.setItemAmount();
      paymentVoucherItems.push(paymentVoucherItem);
    }

    paymentVoucher.setTransactionAmount(paymentVoucherItems);

    // console.log(paymentVoucher);
    // console.log(paymentVoucherItems);
    // console.log(paymentVoucherOtherCharges);

    t = await sequelize.transaction();
    await paymentVoucher.save({ transaction: t });

    if (blUpdate === true) {
      await PaymentVoucherItem.destroy({ where: { payment_voucher_id: paymentVoucher.id }, transaction: t });
    }
    
    for(const paymentVoucherItem of paymentVoucherItems) {
      paymentVoucherItem.payment_voucher_id = paymentVoucher.id;
      await paymentVoucherItem.save({ transaction: t });
    }

    // return res.status(422).json({
    //   message: "Invalid inputs passed, please check your data.",
    //   // error: error
    // });
    
    await t.commit();
    
    res.status(200).json({ message: "Update successful!", paymentVoucher: paymentVoucher });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't udpate paymentVoucher!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't update Payment Voucher!";
    next(error, req, res);
  }
};

export const checkPaymentVoucher = async (req, res, next) => {
  let t;

  try {
    let paymentVoucher = await PaymentVoucher.findByPk(req.params.id);
    if (!paymentVoucher) {
      return res.status(404).json({
        message: "Payment Voucher not found!"
      });
    }

    // let po_id = paymentVoucher.po_id;
    // let is_advance = paymentVoucher.is_advance;

    // if (paymentVoucher.modified_by === req.userData.userId) {
    //   return res.status(422).json({ 
    //     message: `You can't check this PaymentVoucher.`, 
    //     error : { 
    //       errors : { 
    //         date_of_processing: { message: `You can't check this PaymentVoucher.` } 
    //       } 
    //     }
    //   });
    // }

    // console.log(paymentVoucher);

    // if (paymentVoucher.status.trim().toUpperCase() !== 'INPROCESS') {
    //   return res.status(422).json({ 
    //     message: `Payment Voucher status should be InProcess.`, 
    //     error : { 
    //       errors : { 
    //         date_of_processing: { message: `Payment Voucher status should be  InProcess.` } 
    //       } 
    //     }
    //   });
    // }

    if (req.userData.userId === 3 || req.userData.userId === 2 || req.userData.userId === 439 || req.userData.userId === 449 || req.userData.userId === 466 || req.userData.userId === 148 || req.userData.userId === 483 || req.userData.userId === 509 || req.userData.userId === 519) {
      // Do nothing
    } else {
      return res.status(401).json({ 
        message: `You are not authorised to check Finance Voucher.`, 
        error : { 
          errors : { 
            date_of_processing: { message: `You are not authorised to check Finance Voucher.` } 
          } 
        }
      });
    }

    if (paymentVoucher.status && paymentVoucher.status.trim().toUpperCase() === 'APPROVED') {
      // return res.status(404).json({message: "Payment Voucher is already approved!"});

      if ((paymentVoucher.is_paid && paymentVoucher.is_paid === 1) || (paymentVoucher.paid_amount && paymentVoucher.paid_amount > 0)) {
        // return res.status(404).json({message: "Payment for this Voucher is already processed!"});
        return res.status(422).json({ 
              message: `Payment for this Voucher is already processed!`, 
              error : { 
                errors : { 
                  invoice_no: { message: `Payment for this Voucher is already processed!` } 
                } 
              }
            });
      }
    }

    // if (req.userData.userId != )

    // paymentVoucher.getRequestData(req);
    paymentVoucher.check(req);

    // console.log(error);
    // paymentVoucher.approvedBy = req.userData.userId;
    // paymentVoucher.approvedAt = new Date().toISOString();

    const error = await paymentVoucher.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    // try {
      t = await sequelize.transaction();
      
      // if (!paymentVoucher.voucher_no) {
      //   const series = await getSeries(req, 'Payment_Voucher');
      //   paymentVoucher.getPaymentVoucherNo(series.series);
      //   await series.save({ transaction: t });
      // }
      
      if (!paymentVoucher.ref_id) {
        await paymentVoucher.save({ transaction: t });
      } else {
        // const obj = JSON.parse(JSON.stringify(paymentVoucher));
        // delete obj._id;
        // obj.ref_id = null;

        const ref_id = paymentVoucher.ref_id;

        const obj = paymentVoucher.dataValues;
        delete obj.id;
        obj.ref_id = null;

        // console.log(obj);
        // console.log(ref_id);
        // console.log(req.params.id);

        await PaymentVoucher.destroy({ where: {id: req.params.id }}, { transaction: t });

        // paymentVoucher = await PaymentVoucher.findByIdAndUpdate(ref_id, obj, { session: session, new: true });

        await PaymentVoucher.update(obj, { where: { id: ref_id } }, { transaction: t });

        await PaymentVoucherItem.destroy({ where: {payment_voucher_id: ref_id }}, { transaction: t });

        await PaymentVoucherItem.update({ payment_voucher_id: ref_id }, { where: { payment_voucher_id: req.params.id }}, { transaction: t });

        // paymentVoucher = await PaymentVoucher.findByPk(ref_id);

        // originalPaymentVoucher = await PaymentVoucher.findById(paymentVoucher.ref_id);
        // originalPaymentVoucher.overwrite(paymentVoucher);
        // originalPaymentVoucher.ref_id = null;
        // originalPaymentVoucher.vendorState = paymentVoucher.vendorState;
        // // console.log(originalPaymentVoucher);
        // await originalPaymentVoucher.save({ session });
      }

      // if (paymentVoucher.po_status && paymentVoucher.po_status.toString().toUpperCase() === 'RAW MATERIAL IN') {
      //   const purchase_order = await PurchaseOrder.findByPk(paymentVoucher.po_id);
      //   purchase_order.po_status = 'Closed';
      //   purchase_order.save({ transaction: t })
      // }

      // if (po_id) {
      //   let purchaseOrder = await PurchaseOrder.findByPk(po_id);
      //   // purchaseOrder.setRawMaterialIn();
      //   // if (purchaseOrder.po_status && purchaseOrder.po_status.trim().toUpperCase() === 'OPEN') {
      //   if (is_advance) {
      //     purchaseOrder.po_status = 'Advance';
      //     purchaseOrder.is_advance = 1;
      //   } else if (paymentVoucher.po_status && paymentVoucher.po_status.toString().toUpperCase() === 'RAW MATERIAL IN') {
      //     purchaseOrder.po_status = 'Closed';
      //   }
      //   await purchaseOrder.save({ transaction: t });
      // }
  
      await t.commit();
         
    // } catch (error) { 
    //     await session.abortTransaction();
    // }
    
    res.status(200).json({ message: "Check successful!" });
  } catch (error) {
    // console.log(error);

    if (t) {
      await t.rollback();
    }

    // res.status(500).json({
    //   message: 'Approving Payment Voucher failed! Error - ' + (error.message ? error.message : '')
    // });
    
    res.statusCode = 500;
    res.message = "Checking Payment Voucher failed!";
    next(error, req, res);
  }
};

export const rejectGrn = async (req, res, next) => {
  let t;

  try {
    let paymentVoucher = await PaymentVoucher.findByPk(req.params.id);
    if (!paymentVoucher) {
      return res.status(404).json({
        message: "Payment Voucher not found!"
      });
    }

    // let po_id = paymentVoucher.po_id;
    // let is_advance = paymentVoucher.is_advance;

    // if (paymentVoucher.modified_by === req.userData.userId) {
    //   return res.status(422).json({ 
    //     message: `You can't check this PaymentVoucher.`, 
    //     error : { 
    //       errors : { 
    //         date_of_processing: { message: `You can't check this PaymentVoucher.` } 
    //       } 
    //     }
    //   });
    // }

    // console.log(paymentVoucher);

    if (paymentVoucher.status.trim().toUpperCase() !== 'INPROCESS' && paymentVoucher.status.trim().toUpperCase() !== 'REJECTED') {
      return res.status(422).json({ 
        message: `Payment Voucher status should be InProcess or Rejected.`, 
        error : { 
          errors : { 
            date_of_processing: { message: `Payment Voucher status should be InProcess or Rejected.` } 
          } 
        }
      });
    }

    if (req.userData.userId === 3 || req.userData.userId === 2 || req.userData.userId === 439 || req.userData.userId === 449 || req.userData.userId === 466 || req.userData.userId === 148 || req.userData.userId === 483 || req.userData.userId === 509 || req.userData.userId === 519) {
      // Do nothing
    } else {
      return res.status(401).json({ 
        message: `You are not authorised to reject Finance Voucher.`, 
        error : { 
          errors : { 
            date_of_processing: { message: `You are not authorised to reject Finance Voucher.` } 
          } 
        }
      });
    }

    if (paymentVoucher.type.trim().toUpperCase() === 'EXPENSE' || paymentVoucher.is_advance === 1) {
      t = await sequelize.transaction();
      paymentVoucher.reject(req);
      await paymentVoucher.save({ transaction: t });
      await t.commit();
      
      mailPaymnentVoucherRejection(req.params.id)
        .then(result => {
          // Do nothing
        })
        .catch(err => {
          throw err;
        });
    } else {
      let rawMaterialIn = await RawMaterialIn.findByPk(paymentVoucher.raw_material_in_id);
      if (!rawMaterialIn) {
        return res.status(404).json({
          message: "GRN Details not found!"
        });
      }

      t = await sequelize.transaction();
      rawMaterialIn.grn_status = 'Resubmit';
      rawMaterialIn.remarks = req.body.remark ? req.body.remark.trim() : '';
      await rawMaterialIn.save({ transaction: t });
      await PaymentVoucherItem.destroy({ where: { payment_voucher_id: req.params.id }, transaction: t });
      await PaymentVoucher.destroy({ where: { id: req.params.id }, transaction: t });
      await t.commit();

      
      mailPaymnentRejection(rawMaterialIn.id)
        .then(result => {
          // Do nothing
        })
        .catch(err => {
          throw err;
        });
    }
    
    res.status(200).json({ message: "Reject successful!" });
  } catch (error) {
    // console.log(error);

    if (t) {
      await t.rollback();
    }

    // res.status(500).json({
    //   message: 'Approving Payment Voucher failed! Error - ' + (error.message ? error.message : '')
    // });
    
    res.statusCode = 500;
    res.message = "Rejecting Payment Voucher failed!";
    next(error, req, res);
  }
};

export const approvePaymentVoucher = async (req, res, next) => {
  let t;

  try {
    let paymentVoucher = await PaymentVoucher.findByPk(req.params.id);
    if (!paymentVoucher) {
      return res.status(404).json({
        message: "Payment Voucher not found!"
      });
    }

    let po_id = paymentVoucher.po_id;
    let is_advance = paymentVoucher.is_advance;

    // if (paymentVoucher.modified_by === req.userData.userId) {
    //   return res.status(422).json({ 
    //     message: `You can't approve this PaymentVoucher.`, 
    //     error : { 
    //       errors : { 
    //         date_of_processing: { message: `You can't approve this PaymentVoucher.` } 
    //       } 
    //     }
    //   });
    // }

    // console.log(paymentVoucher);

    if (paymentVoucher.status.trim().toUpperCase() !== 'PENDING' && paymentVoucher.status.trim().toUpperCase() !== 'DELETED') {
      return res.status(422).json({ 
        message: `Payment Voucher status should be pending or deleted.`, 
        error : { 
          errors : { 
            date_of_processing: { message: `Payment Voucher status should be pending or deleted.` } 
          } 
        }
      });
    }

    if (req.userData.userId === 3 || req.userData.userId === 2 || req.userData.userId === 439 || req.userData.userId === 148 || req.userData.userId === 483 || req.userData.userId === 509 || req.userData.userId === 519) {
      // Do nothing
    } else {
      return res.status(401).json({ 
        message: `You are not authorised to approve or reject Finance Voucher.`, 
        error : { 
          errors : { 
            date_of_processing: { message: `You are not authorised to approve or reject Finance Voucher.` } 
          } 
        }
      });
    }

    // if (req.userData.userId != )

    // paymentVoucher.getRequestData(req);
    paymentVoucher.approve(req);

    // console.log(error);
    // paymentVoucher.approvedBy = req.userData.userId;
    // paymentVoucher.approvedAt = new Date().toISOString();

    const error = await paymentVoucher.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    // try {
      t = await sequelize.transaction();
      
      if (!paymentVoucher.voucher_no) {
        const series = await getSeries(req, 'Payment_Voucher');
        paymentVoucher.getPaymentVoucherNo(series.series);
        await series.save({ transaction: t });
      }
      
      if (!paymentVoucher.ref_id) {
        await paymentVoucher.save({ transaction: t });
      } else {
        // const obj = JSON.parse(JSON.stringify(paymentVoucher));
        // delete obj._id;
        // obj.ref_id = null;

        const ref_id = paymentVoucher.ref_id;

        const obj = paymentVoucher.dataValues;
        delete obj.id;
        obj.ref_id = null;

        // console.log(obj);
        // console.log(ref_id);
        // console.log(req.params.id);

        await PaymentVoucher.destroy({ where: {id: req.params.id }}, { transaction: t });

        // paymentVoucher = await PaymentVoucher.findByIdAndUpdate(ref_id, obj, { session: session, new: true });

        await PaymentVoucher.update(obj, { where: { id: ref_id } }, { transaction: t });

        await PaymentVoucherItem.destroy({ where: {payment_voucher_id: ref_id }}, { transaction: t });

        await PaymentVoucherItem.update({ payment_voucher_id: ref_id }, { where: { payment_voucher_id: req.params.id }}, { transaction: t });

        // paymentVoucher = await PaymentVoucher.findByPk(ref_id);

        // originalPaymentVoucher = await PaymentVoucher.findById(paymentVoucher.ref_id);
        // originalPaymentVoucher.overwrite(paymentVoucher);
        // originalPaymentVoucher.ref_id = null;
        // originalPaymentVoucher.vendorState = paymentVoucher.vendorState;
        // // console.log(originalPaymentVoucher);
        // await originalPaymentVoucher.save({ session });
      }

      // if (paymentVoucher.po_status && paymentVoucher.po_status.toString().toUpperCase() === 'RAW MATERIAL IN') {
      //   const purchase_order = await PurchaseOrder.findByPk(paymentVoucher.po_id);
      //   purchase_order.po_status = 'Closed';
      //   purchase_order.save({ transaction: t })
      // }

      if (po_id) {
        let purchaseOrder = await PurchaseOrder.findByPk(po_id);
        // purchaseOrder.setRawMaterialIn();
        // if (purchaseOrder.po_status && purchaseOrder.po_status.trim().toUpperCase() === 'OPEN') {
        if (is_advance) {
          purchaseOrder.po_status = 'Advance';
          purchaseOrder.is_advance = 1;
        } else if (paymentVoucher.po_status && paymentVoucher.po_status.toString().toUpperCase() === 'RAW MATERIAL IN') {
          purchaseOrder.po_status = 'Closed';
        }
        await purchaseOrder.save({ transaction: t });
      }
  
      await t.commit();
         
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
    //   message: 'Approving Payment Voucher failed! Error - ' + (error.message ? error.message : '')
    // });
    
    res.statusCode = 500;
    res.message = "Approving Payment Voucher failed!";
    next(error, req, res);
  }
};

export const rejectPaymentVoucher = async (req, res, next) => {
  try {
    let paymentVoucher = await PaymentVoucher.findByPk(req.params.id);

    if (!paymentVoucher) {
      return res.status(404).json({
        message: "Payment Voucher not found!"
      });
    }

    // if (paymentVoucher.modified_by.toString() === req.userData.userId) {
    //   return res.status(422).json({ 
    //     message: `You can't reject this Payment Voucher.`, 
    //     error : { 
    //       errors : { 
    //         date_of_processing: { message: `You can't reject this Payment Voucher.` } 
    //       } 
    //     }
    //   });
    // }

    if (paymentVoucher.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({ 
        message: `Payment Voucher is already approved.`, 
        error : { 
          errors : { 
            date_of_processing: { message: `Payment Voucher is already approved.` } 
          } 
        }
      });
    }

    if (req.userData.userId === 3 || req.userData.userId === 2 || req.userData.userId === 439 || req.userData.userId === 148 || req.userData.userId === 483 || req.userData.userId === 509 || req.userData.userId === 519) {
      // Do nothing
    } else {
      return res.status(401).json({ 
        message: `You are not authorised to approve or reject Finance Voucher.`, 
        error : { 
          errors : { 
            date_of_processing: { message: `You are not authorised to approve or reject Finance Voucher.` } 
          } 
        }
      });
    }

    paymentVoucher.reject(req);
    await paymentVoucher.save();

    res.status(200).json({ message: "Reject successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Rejecting Payment Voucher failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Rejecting Payment Voucher failed!";
    next(error, req, res);
  }
};

export const deletePaymentVoucher = async (req, res, next) => {
  let t;

  try {
    let paymentVoucher = await PaymentVoucher.findByPk(req.params.id, {raw: true});
    if (!paymentVoucher) {
      return res.status(404).json({ message: "Payment Voucher not found!" });
    }

    t = await sequelize.transaction();

    if (paymentVoucher.status.trim().toUpperCase() === 'APPROVED') {
      paymentVoucher.id = null;
      paymentVoucher.status = 'Deleted';
      paymentVoucher.ref_id = req.params.id;
      
      paymentVoucher = await PaymentVoucher.build({
        ...paymentVoucher
      });

      await paymentVoucher.save({ transaction: t });

      let paymentVoucherItems = await PaymentVoucherItem.findAll({ 
        where: { payment_voucher_id: req.params.id}, 
        // attributes: ['payment_voucher_id', 'item_person', 'email_id', 'mobile'], 
        raw: true 
      });

      paymentVoucherItems = paymentVoucherItems.map(paymentVoucherItem => {
        // paymentVoucherItem.id = null;
        delete paymentVoucherItem.id;
        paymentVoucherItem.payment_voucher_id = paymentVoucher.id;
        return paymentVoucherItem;
      });

      await PaymentVoucherItem.bulkCreate(paymentVoucherItems, { transaction: t });
      
      // const error = await paymentVoucher.validateData();
      // if (error) {
      //   return res.status(422).json({
      //     message: "Invalid inputs passed, please check your data.",
      //     error: error
      //   });
      // }
    } else {
      await PaymentVoucher.destroy({ where: { id: req.params.id }, transaction: t });
      await PaymentVoucherItem.destroy({ where: { payment_voucher_id: req.params.id }, transaction: t });
    }

    await t.commit();
    
    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Deleting Payment Voucher failed!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Deleting Payment Voucher failed!";
    next(error, req, res);
  }
};

// export const deleteAttachment = async (req, res, next) => {
//   let t;

//   try {
//     if (req.userData.userId === 3 || req.userData.userId === 2 || req.userData.userId === 439 || req.userData.userId === 449 || req.userData.userId === 466 || req.userData.userId === 148 || req.userData.userId === 483) {
//       // Do nothing
//     } else {
//       return res.status(401).json({ 
//         message: `You are not authorised to delete uploaded document.`, 
//         error : { 
//           errors : { 
//             date_of_processing: { message: `You are not authorised to delete uploaded document.` } 
//           } 
//         }
//       });
//     }

//     let paymentVoucher = await PaymentVoucher.findByPk(req.params.id, {raw: true});
//     if (!paymentVoucher) {
//       return res.status(404).json({ message: "Payment Voucher not found!" });
//     }

//     t = await sequelize.transaction();

//     paymentVoucher.doc_document = '';
//     paymentVoucher.document_name = '';

//     await paymentVoucher.save({ transaction: t });

//     await t.commit();
    
//     res.status(200).json({ message: "Document Deletion successful!" });
//   } catch (error) {
//     // res.status(500).json({
//     //   message: "Deleting Payment Voucher failed!"
//     // });

//     if (t) {
//       await t.rollback();
//     }
    
//     res.statusCode = 500;
//     res.message = "Deleting document failed!";
//     next(error, req, res);
//   }
// };