import { Op } from 'sequelize';
import sequelize from '../lib/database.js';

import VendorPayment, {getVendorPaymentsData, getVendorPaymentFile, mailVendorPaymentFile} from '../models/vendorPayment.js';
import VendorPaymentItem from '../models/vendorPaymentItem.js';
// import Depot from '../models/depot.js';
// import Vendor from '../models/vendor.js';
import { getSeries } from '../models/series.js';
import PaymentVoucher from '../models/paymentVoucher.js';
import User from '../models/user.js';
import Vendor from '../models/vendor.js';
// import RawMaterial from '../models/rawMaterial.js';
// import RawMaterialIn from '../models/rawMaterialIn.js';
// import { Sequelize } from 'sequelize';

export const getVendorPayments = async (req, res, next) => {
  try {
    const { count, statusCount, rows } = await getVendorPaymentsData(req);

    res.status(200).json({
      message: "Vendor Payments fetched successfully!",
      // totalCount: totalCount,
      total: count,
      statusCount: statusCount,
      rows: rows
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Vendor Payments failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Vendor Payments failed!";
    next(error, req, res);
  }
};

export const addVendorPayment = async (req, res, next) => {
  try {
    const roleDetails = req.userData.roleDetails;

    // console.log(roleDetails);

    const action = {
      update: false,
      delete: false,
      approve: false
    };

    // console.log(vendorPayment.modified_by.toString());
    // console.log(req.userData.userId);
    
    // if (vendorPayment.isFreezed) {
    //   if (vendorPayment.status.trim().toUpperCase() !== 'APPROVED' && vendorPayment.status.trim().toUpperCase() !== 'INACTIVE') {
    //     if (roleDetails.r_edit) {
    //       action.update = true;
    //     }
    //     if (roleDetails.r_delete) {
    //       action.delete = true;
    //     }
    //   }
    // } else {
      if (roleDetails.r_insert || roleDetails.r_edit) {
        action.update = true;
      }
      if (roleDetails.r_delete) {
        action.delete = false;
      }
    // }
    
    const vendors = await Vendor.findAll({ attributes: ['id', 'vendor_name', 'bank_acc_name'] });
    
    const vendorPayments = await PaymentVoucher.findAll({ 
      where: {
        status: 'Approved', 
        date_of_processing: {[Op.ne]: null}, 
        is_closed: 0, 
        [Op.or]: [
          {total_payable: {[Op.gt]: sequelize.col('paid_amount')}}, 
          {paid_amount: {[Op.is]: null}}
        ]
      },
      order: [['date_of_processing', 'ASC']],
      include: [ {model: Vendor, as: "vendor", attributes: ["id", "vendor_name", "bank_acc_name"] } ]
    });

    const { count, statusCount, rows } = await getVendorPaymentsData(req);

    return res.status(200).json({ 
      message: "Vendor Payment fetched successfully!",
      action, 
      vendorPayments, 
      vendors,
      total: count,
      statusCount: statusCount
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Vendor Payment failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Vendor Payment failed!";
    next(error, req, res);
  }
};

export const editVendorPayment = async (req, res, next) => {
  try {
    const vendorPaymentId = req.params.id;
    
    const vendorPayment = await VendorPayment.findByPk(vendorPaymentId, {
      include: [{ 
        model: VendorPaymentItem, 
        as: "vendorPaymentItems", 
        include: [
          { model: Vendor, as: "vendor", attributes: ["id", "vendor_name"] },
          // { model: PaymentVoucher, 
          //   as: "paymentVouchers",
          //   attributes: ['paymentVouchers.id', [sequelize.fn('sum', sequelize.col('paymentVouchers.paid_amount')), 'total_paid_amount']], 
          //   group:['paymentVouchers.id']
          // }
        ] 
      }]
    });
    if (!vendorPayment) {
      return res.status(404).json({ message: "Vendor Payment not found!" });
    }

    const roleDetails = req.userData.roleDetails;

    // console.log(roleDetails);

    const action = {
      update: false,
      delete: false,
      approve: false
    };

    // console.log(vendorPayment.modified_by.toString());
    // console.log(req.userData.userId);
    
    // if (vendorPayment.isFreezed) {
    //   if (vendorPayment.status.trim().toUpperCase() !== 'APPROVED' && vendorPayment.status.trim().toUpperCase() !== 'INACTIVE') {
    //     if (roleDetails.r_edit) {
    //       action.update = true;
    //     }
    //     if (roleDetails.r_delete) {
    //       action.delete = true;
    //     }
    //   }
    // } else {
      if (roleDetails.r_insert || roleDetails.r_edit) {
        action.update = true;
      }
      if (roleDetails.r_delete) {
        // action.delete = false;
        action.delete = true;
      }
    // }
    
    const vendors = await Vendor.findAll({ attributes: ['id', 'vendor_name', 'bank_acc_name'] });
    
    const vendorPayments = await PaymentVoucher.findAll({ 
      where: {
        status: 'Approved', 
        date_of_processing: {[Op.ne]: null}, 
        is_closed: 0, 
        [Op.or]: [
          {total_payable: {[Op.gt]: sequelize.col('paid_amount')}}, 
          {paid_amount: {[Op.is]: null}}
        ]
      },
      order: [['date_of_processing', 'ASC']],
      include: [ 
        {model: Vendor, as: "vendor", attributes: ["id", "vendor_name", "bank_acc_name"] }, 
        {
          model: VendorPaymentItem, 
          as: "vendorPaymentItems", 
          attributes: ["id", "vendor_payment_id", "vendor_payment_amount", "payment_remarks"],
          where: { vendor_payment_id: vendorPaymentId },
          required: false
        } 
      ]
    });

    const { count, statusCount, rows } = await getVendorPaymentsData(req);

    return res.status(200).json({ 
      message: "Vendor Payment fetched successfully!",
      action, 
      vendorPayment,
      vendorPayments, 
      vendors,
      total: count,
      statusCount: statusCount
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Vendor Payment failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Vendor Payment failed!";
    next(error, req, res);
  }
};

export const getVendorPayment = async (req, res, next) => {
  try {
    const vendorPayment = await VendorPayment.findByPk(req.params.id, {
      include: [{ 
        model: VendorPaymentItem, 
        as: "vendorPaymentItems", 
        include: [
          { model: Vendor, as: "vendor", attributes: ["id", "vendor_name"] },
          // { model: PaymentVoucher, 
          //   as: "paymentVouchers",
          //   attributes: ['paymentVouchers.id', [sequelize.fn('sum', sequelize.col('paymentVouchers.paid_amount')), 'total_paid_amount']], 
          //   group:['paymentVouchers.id']
          // }
        ] 
      }]
    });
    if (!vendorPayment) {
      return res.status(404).json({ message: "Vendor Payment not found!" });
    }

    const roleDetails = req.userData.roleDetails;

    console.log(roleDetails);

    const action = {
      update: false,
      delete: false,
      approve: false
    };

    // console.log(vendorPayment.modified_by.toString());
    // console.log(req.userData.userId);
    
    // if (vendorPayment.isFreezed) {
    //   if (vendorPayment.status.trim().toUpperCase() !== 'APPROVED' && vendorPayment.status.trim().toUpperCase() !== 'INACTIVE') {
    //     if (roleDetails.r_edit) {
    //       action.update = true;
    //     }
    //     if (roleDetails.r_delete) {
    //       action.delete = true;
    //     }
    //   }
    // } else {
      if (vendorPayment.status.trim().toUpperCase() === 'Approved') {
        //Do nothing
      } else if (!roleDetails.r_approvals || 
            (vendorPayment.status.trim().toUpperCase() !== 'PENDING' && 
            vendorPayment.status.trim().toUpperCase() !== 'DELETED') || 
            vendorPayment.modified_by.toString() === req.userData.userId.toString()) 
      {
        // if (roleDetails.r_edit) {
        //   action.update = true;
        // }
        // if (roleDetails.r_delete) {
        //   // action.delete = true;
        //   action.delete = false;
        // }
        //Do nothing
      } else if (roleDetails.r_approvals) {
        action.approve = true;
      }
    // }
    
    const vendors = await Vendor.findAll({ attributes: ['id', 'vendor_name', 'bank_acc_name'] });

    return res.status(200).json({ 
      message: "Vendor Payment fetched successfully!",
      action, 
      vendorPayment, 
      vendors 
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Vendor Payment failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Vendor Payment failed!";
    next(error, req, res);
  }
};

export const createVendorPayment = async (req, res, next) => {
  let t;
  
  try {
    const vendorPayment = await VendorPayment.build({
      status: 'Pending',
      created_by: req.userData.userId,
      modified_by: req.userData.userId
    });

    vendorPayment.getRequestData(req);
    
    let error = await vendorPayment.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }
    
    const items = vendorPayment.getVendorPaymentItems(req.body);
    const vendorPaymentItems = [];
    for(const item of items) {
      const vendorPaymentItem = await VendorPaymentItem.build({
        vendor_payment_id: null
      });
      vendorPaymentItem.getRequestData(item);
      error = await vendorPaymentItem.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      await vendorPaymentItem.setItemDetails();
      vendorPaymentItems.push(vendorPaymentItem);
    }

    vendorPayment.setTransactionAmount(vendorPaymentItems);

    t = await sequelize.transaction();

    await vendorPayment.save({ transaction: t });

    for(const vendorPaymentItem of vendorPaymentItems) {
      vendorPaymentItem.vendor_payment_id = vendorPayment.id;
      await vendorPaymentItem.save({ transaction: t });
    }

    await t.commit();
    
    return res.status(201).json({
      message: "Vendor Payment added successfully",
      vendorPayment: vendorPayment
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Creating a vendorPayment failed!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Creating a Vendor Payment failed!";
    next(error, req, res);
  }
};

export const updateVendorPayment = async (req, res, next) => {
  let t;

  try {
    let vendorPayment = await VendorPayment.findByPk(req.params.id);
    if (!vendorPayment) {
      return res.status(404).json({message: "Vendor Payment not found!"});
    }

    let blUpdate = false;
    if (vendorPayment.status && vendorPayment.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(404).json({message: "Vendor Payment is already approved!"});

      // vendorPayment = await VendorPayment.build({
      //   status: 'Pending',
      //   created_by: req.userData.userId,
      //   modified_by: req.userData.userId
      // });
  
      // vendorPayment.getRequestData(req);

      // vendorPayment.ref_id = req.params.id;
    } else {
      vendorPayment.getRequestData(req);
      vendorPayment.status = 'Pending';
      vendorPayment.modified_by = req.userData.userId;
      blUpdate = true;
    }

    let error = await vendorPayment.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    // console.log(vendorPayment);
    
    const items = vendorPayment.getVendorPaymentItems(req.body);
    const vendorPaymentItems = [];
    for(const item of items) {
      const vendorPaymentItem = await VendorPaymentItem.build({
        vendor_payment_id: null
      });
      vendorPaymentItem.getRequestData(item);
      error = await vendorPaymentItem.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      await vendorPaymentItem.setItemDetails();
      vendorPaymentItems.push(vendorPaymentItem);
    }

    vendorPayment.setTransactionAmount(vendorPaymentItems);

    t = await sequelize.transaction();
    await vendorPayment.save({ transaction: t });

    if (blUpdate === true) {
      await VendorPaymentItem.destroy({ where: { vendor_payment_id: vendorPayment.id }, transaction: t });
    }
    
    for(const vendorPaymentItem of vendorPaymentItems) {
      vendorPaymentItem.vendor_payment_id = vendorPayment.id;
      await vendorPaymentItem.save({ transaction: t });
    }

    await t.commit();

    res.status(200).json({ message: "Update successful!", vendorPayment: vendorPayment });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't udpate vendorPayment!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't update Vendor Payment!";
    next(error, req, res);
  }
};

export const approveVendorPayment = async (req, res, next) => {
  let t;
  let error = {};

  try {
    let vendorPayment = await VendorPayment.findByPk(req.params.id);
    if (!vendorPayment) {
      return res.status(404).json({
        message: "Vendor Payment not found!"
      });
    }

    // if (vendorPayment.modified_by === req.userData.userId) {
    //   return res.status(422).json({ 
    //     message: `You can't approve this VendorPayment.`, 
    //     error : { 
    //       errors : { 
    //         transaction_date: { message: `You can't approve this VendorPayment.` } 
    //       } 
    //     }
    //   });
    // }

    // console.log(vendorPayment);

    if (vendorPayment.status.trim().toUpperCase() !== 'PENDING' && vendorPayment.status.trim().toUpperCase() !== 'DELETED') {
      return res.status(422).json({ 
        message: `Vendor Payment status should be pending or deleted.`, 
        error : { 
          errors : { 
            transaction_date: { message: `Vendor Payment status should be pending or deleted.` } 
          } 
        }
      });
    }

    vendorPayment.approve(req);

    const items = vendorPayment.getVendorPaymentItems(req.body);
    const vendorPaymentItems = [];
    for(const item of items) {
      const vendorPaymentItem = await VendorPaymentItem.findByPk(item.id);
      if (!vendorPaymentItem) {
        return res.status(404).json({message: "Vendor Payment Item not found!"});
      }
      vendorPaymentItem.getRequestData(item);
      error = await vendorPaymentItem.validateData();
      if (error) {
        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      vendorPaymentItem.setItemDetails();
      vendorPaymentItems.push(vendorPaymentItem);
    }

    vendorPayment.setTransactionAmount(vendorPaymentItems);

    // console.log(error);
    // vendorPayment.approvedBy = req.userData.userId;
    // vendorPayment.approvedAt = new Date().toISOString();

    error = await vendorPayment.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    // try {
      t = await sequelize.transaction();
      
      // if (!vendorPayment.voucher_no) {
      //   const series = await getSeries(req, 'Payment_Voucher');
      //   vendorPayment.getVendorPaymentNo(series.series);
      //   await series.save({ transaction: t });
      // }
      
      if (!vendorPayment.ref_id) {
        await vendorPayment.save({ transaction: t });
        
        for(const vendorPaymentItem of vendorPaymentItems) {
          vendorPaymentItem.vendor_payment_id = vendorPayment.id;
          await vendorPaymentItem.save({ transaction: t });
        }
      } else {
        // const obj = JSON.parse(JSON.stringify(vendorPayment));
        // delete obj._id;
        // obj.ref_id = null;

        const ref_id = vendorPayment.ref_id;

        const obj = vendorPayment.dataValues;
        delete obj.id;
        obj.ref_id = null;

        // console.log(obj);
        // console.log(ref_id);
        // console.log(req.params.id);

        for(const vendorPaymentItem of vendorPaymentItems) {
          vendorPaymentItem.vendor_payment_id = vendorPayment.id;
          await vendorPaymentItem.save({ transaction: t });
        }

        await VendorPayment.destroy({ where: {id: req.params.id }}, { transaction: t });

        // vendorPayment = await VendorPayment.findByIdAndUpdate(ref_id, obj, { session: session, new: true });

        await VendorPayment.update(obj, { where: { id: ref_id } }, { transaction: t });

        await VendorPaymentItem.destroy({ where: {vendor_payment_id: ref_id }}, { transaction: t });

        await VendorPaymentItem.update({ vendor_payment_id: ref_id }, { where: { vendor_payment_id: req.params.id }}, { transaction: t });

        vendorPayment = await VendorPayment.findByPk(ref_id);

        // originalVendorPayment = await VendorPayment.findById(vendorPayment.ref_id);
        // originalVendorPayment.overwrite(vendorPayment);
        // originalVendorPayment.ref_id = null;
        // originalVendorPayment.vendorState = vendorPayment.vendorState;
        // // console.log(originalVendorPayment);
        // await originalVendorPayment.save({ session });
      }
      // console.log(vendorPaymentItems);

      for (const vendorPaymentItem of vendorPaymentItems) {
        if (vendorPaymentItem.is_approved === 1) {
          await PaymentVoucher.update(
            { is_paid: 1, paid_amount: sequelize.literal(`IFNULL(paid_amount,0) + ${vendorPaymentItem.vendor_payment_amount}`) }, 
            { where: { id: vendorPaymentItem.payment_voucher_id } },
            { transaction: t }
          );
        }
      }

      await t.commit();

      let message = "Approve successful.";

      if (vendorPayment.payment_type.trim().toUpperCase() === 'ONLINE') {
        t = '';
        
        vendorPayment.payment_file = await getVendorPaymentFile(vendorPayment.id);
        await vendorPayment.save();        

        // let result = await mailVendorPaymentFile(vendorPayment.id);
        // // console.log(result);
        // if (result.indexOf('Email sent') !== -1) {
        //   vendorPayment.mail_sent = 1;
        //   await vendorPayment.save();
        //   message = message + " Mail sent successfully.";
        // } else {
        //   vendorPayment.mail_sent = 0;
        //   await vendorPayment.save();
        //   message = message + " Mail sending failed.";
        // }

        mailVendorPaymentFile(vendorPayment.id)
          .then(async result => {
              if (result.indexOf('Email sent') !== -1) {
                vendorPayment.mail_sent = 1;
                await vendorPayment.save();
              } else {
                vendorPayment.mail_sent = 0;
                await vendorPayment.save();
              }

              // console.log(result);
              // return res.status(200).json({ result: result });
              // return result;
              // return true;
          })
          .catch(err => {
            throw err;
            
              // console.log(err);
              // const error = new Error(err);
              // error.httpStatusCode = 500;
              // return next(error);

              // return err;
          });
      }
      
    // } catch (error) { 
    //     await session.abortTransaction();
    // }
    
    res.status(200).json({ message: message });
  } catch (error) {
    // console.log(error);

    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    // res.status(500).json({
    //   message: 'Approving Vendor Payment failed! Error - ' + (error.message ? error.message : '')
    // });
    
    res.statusCode = 500;
    res.message = "Approving Vendor Payment failed!";
    next(error, req, res);
  }
};

export const generateVendorPaymentFile = async (req, res, next) => {
  let t;

  try {
    let payment_file = await getVendorPaymentFile(req.params.id);
    if (!payment_file) {
      return res.status(404).json({
        message: "Payment File not found!"
      });
    }

    // try {
      // t = await sequelize.transaction();
      
      // vendorPayment.payment_file = payment_file;
      // await vendorPayment.save({ transaction: t });
      
      // await t.commit();
         
    // } catch (error) { 
    //     await session.abortTransaction();
    // }
    
    res.status(200).json({ message: "Payment File - " + payment_file });
  } catch (error) {
    // console.log(error);

    if (t) {
      await t.rollback();
    }

    // res.status(500).json({
    //   message: 'Vendor Payment File generation failed! Error - ' + (error.message ? error.message : '')
    // });
    
    res.statusCode = 500;
    res.message = "Vendor Payment File generation failed!";
    next(error, req, res);
  }
};

export const sendVendorPaymentFile = async (req, res, next) => {
  let t;

  try {
    let result = await mailVendorPaymentFile(req.params.id);
    // console.log(result);

    if (result.indexOf('Email sent') !== -1) {
      res.status(200).json({ message: "Mail sent successfully" });
    } else {
      res.status(500).json({ message: "Mail sending failed" });
    }

    

    // if (!payment_file) {
    //   return res.status(404).json({
    //     message: "Payment File not found!"
    //   });
    // }

    // try {
      // t = await sequelize.transaction();
      
      // vendorPayment.payment_file = payment_file;
      // await vendorPayment.save({ transaction: t });
      
      // await t.commit();
         
    // } catch (error) { 
    //     await session.abortTransaction();
    // }
    
    // res.status(200).json({ message: "Payment File - " + payment_file });
  } catch (error) {
    // console.log(error);

    // if (t) {
    //   await t.rollback();
    // }

    // res.status(500).json({
    //   message: 'Vendor Payment File sending failed! Error - ' + (error.message ? error.message : '')
    // });
    
    res.statusCode = 500;
    res.message = "Vendor Payment File sending failed!";
    next(error, req, res);
  }
};

export const rejectVendorPayment = async (req, res, next) => {
  try {
    let vendorPayment = await VendorPayment.findByPk(req.params.id);

    if (!vendorPayment) {
      return res.status(404).json({
        message: "Vendor Payment not found!"
      });
    }

    if (vendorPayment.modified_by.toString() === req.userData.userId.toString()) {
      return res.status(422).json({ 
        message: `You can't reject this Vendor Payment.`, 
        error : { 
          errors : { 
            transaction_date: { message: `You can't reject this Vendor Payment.` } 
          } 
        }
      });
    }

    if (vendorPayment.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({ 
        message: `Vendor Payment is already approved.`, 
        error : { 
          errors : { 
            transaction_date: { message: `Vendor Payment is already approved.` } 
          } 
        }
      });
    }

    vendorPayment.reject(req);
    await vendorPayment.save();

    res.status(200).json({ message: "Reject successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Rejecting Vendor Payment failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Rejecting Vendor Payment failed!";
    next(error, req, res);
  }
};

export const deleteVendorPayment = async (req, res, next) => {
  let t;

  try {
    let vendorPayment = await VendorPayment.findByPk(req.params.id, {raw: true});
    if (!vendorPayment) {
      return res.status(404).json({ message: "Vendor Payment not found!" });
    }

    t = await sequelize.transaction();

    if (vendorPayment.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(404).json({message: "Vendor Payment is already approved!"});

      // vendorPayment.id = null;
      // vendorPayment.status = 'Deleted';
      // vendorPayment.ref_id = req.params.id;
      
      // vendorPayment = await VendorPayment.build({
      //   ...vendorPayment
      // });

      // await vendorPayment.save({ transaction: t });

      // let vendorPaymentItems = await VendorPaymentItem.findAll({ 
      //   where: { vendor_payment_id: req.params.id}, 
      //   // attributes: ['vendor_payment_id', 'item_person', 'email_id', 'mobile'], 
      //   raw: true 
      // });

      // vendorPaymentItems = vendorPaymentItems.map(vendorPaymentItem => {
      //   // vendorPaymentItem.id = null;
      //   delete vendorPaymentItem.id;
      //   vendorPaymentItem.vendor_payment_id = vendorPayment.id;
      //   return vendorPaymentItem;
      // });

      // await VendorPaymentItem.bulkCreate(vendorPaymentItems, { transaction: t });
      
      // // const error = await vendorPayment.validateData();
      // // if (error) {
      // //   return res.status(422).json({
      // //     message: "Invalid inputs passed, please check your data.",
      // //     error: error
      // //   });
      // // }
    } else {
      await VendorPaymentItem.destroy({ where: { vendor_payment_id: req.params.id }, transaction: t });
      await VendorPayment.destroy({ where: { id: req.params.id }, transaction: t });
    }

    await t.commit();
    
    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Deleting Vendor Payment failed!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Deleting Vendor Payment failed!";
    next(error, req, res);
  }
};