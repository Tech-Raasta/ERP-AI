import { DataTypes, Op, fn, col } from 'sequelize';
// import path from 'path';
import sequelize from '../lib/database.js';
// import html_to_pdf from 'html-pdf-node';
// import moment from 'moment/moment.js';
// import { calculateFiscalYearForDate, calculateTransactionAmount, createPath, getReportPath, getBaseUrl } from '../lib/common.js';

import Depot from './depot.js';
import Product from './product.js';
import RawMaterial from './rawMaterial.js';
import BatchRawMaterial from './batchRawMaterial.js';
// import BatchProcessingOtherCharge from './BatchProcessingOtherCharge.js';
import User from './user.js';
// import sendEmail from '../lib/email.js';
import BatchVariation from './batchVariation.js';
// import Production from './production.js';

const BatchProcessing = sequelize.define('batch_processing', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  batch_id_as_per_fssai: {
    type: DataTypes.STRING,
  },
  batch_no_id: {
    type: DataTypes.INTEGER,
  },
  date_of_processing: {
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
  product_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  requested_kg: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  
  total_kg: DataTypes.DOUBLE,
  qty_in_bar: DataTypes.DOUBLE,
  actual_wastage: DataTypes.DOUBLE,
  wastage_percent: DataTypes.DOUBLE,
  anticipated_wastage: DataTypes.DOUBLE,
  wastage_variance: DataTypes.DOUBLE,
  output_kg: DataTypes.DOUBLE,
  avg_grams: DataTypes.DOUBLE,
  no_of_batch: DataTypes.INTEGER,
  production_id: DataTypes.INTEGER,
  anticipated_water_loss: DataTypes.DOUBLE,
  anticipated_output_in_kg: DataTypes.DOUBLE,
  anticipated_grams: DataTypes.DOUBLE,
  anticipated_output_in_bars: DataTypes.DOUBLE,
  difference_in_bars: DataTypes.DOUBLE,
  actual_water_loss: DataTypes.DOUBLE,
  total_wastage: DataTypes.DOUBLE,
  actual_wastage_percent: DataTypes.DOUBLE,
  tentative: DataTypes.TINYINT,
  packaging: DataTypes.TINYINT,
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
  timestamps: false,
  // createdAt: 'created_on',
  // updatedAt: 'modified_on',
  freezeTableName: true
});

BatchProcessing.belongsTo(Product, { foreignKey: "product_id", as: "product" });
BatchProcessing.belongsTo(Depot, { foreignKey: "depot_id", as: "depot" });
// BatchProcessing.belongsTo(Production, { foreignKey: "production_id", as: "production" });
BatchRawMaterial.belongsTo(BatchProcessing, { foreignKey: "batch_processing_id", as: "batchProcessing" });
BatchVariation.belongsTo(BatchProcessing, { foreignKey: "batch_processing_id", as: "batchProcessing" });
BatchRawMaterial.belongsTo(RawMaterial, { foreignKey: "raw_material_id", as: "rawMaterial" });
// BatchVariation.belongsTo(Box, { foreignKey: "box_id", as: "box" });
BatchProcessing.hasMany(BatchRawMaterial, { foreignKey: "batch_processing_id", as: "batchProcessingItems", onDelete: 'CASCADE' });
BatchProcessing.hasMany(BatchVariation, { foreignKey: "batch_processing_id", as: "batchVariations", onDelete: 'CASCADE' });
// RawMaterial.hasMany(BatchRawMaterial, { foreignKey: "item_id", as: "BatchRawMaterials" });
// BatchProcessing.belongsToMany(RawMaterial, { through : BatchRawMaterial, as: "raw_material", foreignKey: 'batch_processing_id' });
// RawMaterial.belongsToMany(BatchProcessing, { through : BatchRawMaterial, as: "batch_processing", foreignKey: 'item_id' });
BatchProcessing.belongsTo(User, { foreignKey: "created_by", as: "created_by_user" });
BatchProcessing.belongsTo(User, { foreignKey: "modified_by", as: "modified_by_user" });
BatchProcessing.belongsTo(User, { foreignKey: "approved_by", as: "approved_by_user" });

export const getBatchProcessingDepotList = async function(req) {
  // try {
    let depotCond = { where: {status: 'Approved', type: 'Manufacturer', id: {[Op.in]: req.userData.depotIds}} };

    const depots = await Depot.findAll({ ...depotCond, attributes: ['id', 'depot_name', 'depot_code', 'state'] });
    
    return { depots };
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

export const getBatchProcessingMasterData = async function(BatchProcessing) {
  // try {
    let depotCond = { where: {status: 'Approved', type: 'Depot', id: {[Op.in]: req.userData.depotIds}} };
    let productCond = { where: {status: 'Approved', category_id: 4 } };

    if (BatchProcessing) {
      if (BatchProcessing.depot_id) {
        depotCond = { where: {[Op.or]: [{ status: 'Approved' }, { id: BatchProcessing.depot_id }]} };
      }
      if (BatchProcessing.product_id) {
        productCond = { where: {[Op.or]: [{ status: 'Approved' }, { id: BatchProcessing.product_id }]} };
      }
    }

    const depots = await Depot.findAll({ ...depotCond, attributes: ['id', 'depot_name', 'depot_code', 'state'] });
    const products = await Product.findAll({ ...productCond, attributes: ['id', 'product_name', 'short_name'] });
    
    return { depots, products };
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

export const getBatchRawMaterials = async function(BatchProcessing) {
  // try {
    let rawMaterialCond = { where: { status: 'Approved' } };

    if (BatchProcessing) {
      if (BatchProcessing.BatchRawMaterials && BatchProcessing.BatchRawMaterials.length > 0) {
        const rawMaterialIds = BatchProcessing.BatchRawMaterials.map(BatchRawMaterial => BatchRawMaterial.item_id);
        rawMaterialCond = { where: {[Op.or]: [
          { status: 'Approved' }, 
          { id: { [Op.isIn]: rawMaterialIds } }
        ]} };
      }
    }

    const rawMaterials = await RawMaterial.findAll({ ...rawMaterialCond, attributes: ['id', 'rm_name', 'rate'] });
    
    return { rawMaterials };
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

BatchProcessing.setProductionData = async function(production) {
  let batchProcessing = await BatchProcessing.findOne({ where: { production_id: production.id } });
  if (!batchProcessing) {
    batchProcessing = await BatchProcessing.build({
      status: production.status,
      created_by: production.created_by,
      created_on: production.created_on
    });
  }

  batchProcessing.batch_id_as_per_fssai = production.batch_id_as_per_fssai;
  batchProcessing.date_of_processing = production.date_of_processing;
  batchProcessing.depot_id = production.manufacturer_id;
  batchProcessing.product_id = production.product_id;
  batchProcessing.wastage_percent = production.process_loss;
  batchProcessing.requested_kg = production.requested_kg;
  batchProcessing.total_kg = production.total_kg;
  batchProcessing.output_kg = production.output_kg;
  batchProcessing.allocated_kg = production.allocated_kg;
  batchProcessing.modified_by = production.modified_by;
  batchProcessing.modified_on = production.modified_on;
  batchProcessing.approved_by = production.approved_by;
  batchProcessing.approved_on = production.approved_on;
  batchProcessing.rejected_by = production.rejected_by;
  batchProcessing.rejected_on = production.rejected_on;
  batchProcessing.production_id = production.id;

  return batchProcessing;
}

BatchProcessing.prototype.getRequestData = function(req) {
  // try {
    const body = req.body ? req.body : null;

    // this.date_of_processing = body.date_of_processing ? body.date_of_processing : null;
    this.depot_id = body.depot_id ? +body.depot_id : null;
    this.product_id = body.product_id ? +body.product_id : null;
    this.requested_kg = body.requested_kg ? +body.requested_kg : 0;
    // this.delivery_date = body.delivery_date ? body.delivery_date : null;
    // this.ref_id = body.ref_id ? +body.ref_id : null;
    // this.status = body.status;
    // this.remarks = body.remarks ? body.remarks.trim() : '';
  // } catch (error) {
  //   // console.log(error);
  //   return error;
  // }
}

BatchProcessing.prototype.setBatchNo = async function() {
  const depot = await Depot.findByPk(this.depot_id);

  const date_of_processing = new Date(this.date_of_processing);
  const year = date_of_processing.getFullYear().toString();
  const month = (date_of_processing.getMonth() + 1).toString().padStart(2,"0");
  const date = date_of_processing.getDate().toString().padStart(2,"0");
  
  this.batch_id_as_per_fssai = depot.depot_code + date + month + year;

  return this.batch_id_as_per_fssai;
}

BatchProcessing.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    let count = 0;
    if (this.depot_id) {
      count = await Depot.count({ where: { id: this.depot_id }});
      if (count === 0) {
        return { errors : { depot_id: { message: `Depot not exist` } } };
      }
    }
    if (this.product_id) {
      count = await Product.count({ where: { id: this.product_id }});
      if (count === 0) {
        return { errors : { product_id: { message: `Product does not exist` } } };
      }
    }
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}

export const getBatchProcessing = async function(id) {
  // try {
    const BatchProcessing = await BatchProcessing.findByPk(id, { 
      include: [
        { 
          model: BatchRawMaterial, 
          as: "BatchRawMaterials", 
          include: [{ model: RawMaterial, as: "raw_material", attributes: ['id', 'rm_name'] }]
        }, 
        "BatchProcessingOtherCharges", 
        { model: Product, as: "product", attributes: ['id', 'product_name', 'short_name'] },
        { model: Depot, as: "depot", attributes: ['id', 'depot_name', 'address', 'city', 'pincode', 'state', 'country', 'gst_no'] },
        { model: User, as: "created_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
        { model: User, as: "modified_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
        { model: User, as: "approved_by_user", attributes: ['id', 'first_name', 'last_name'] }
      ] 
    });

    return {};
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

// export const mailBatchProcessing = async function(id) {
//   // try {
//     const {fileName, filePath} = await getBatchProcessing(id);
//     let result = '';

//     // const reportPath = path.join(getReportPath(), "batch_processings");
//     // paymentFile = path.join(reportPath, productPayment.payment_file);

//     const BatchProcessing = await BatchProcessing.findByPk(id, { 
//       include: [
//         { 
//           model: BatchRawMaterial, 
//           as: "BatchRawMaterials", 
//           include: [{ model: RawMaterial, as: "raw_material", attributes: ['id', 'rm_name'] }]
//         }, 
//         "BatchProcessingOtherCharges", 
//         { model: Product, as: "product", attributes: ['id', 'product_name', 'product_code', 'address', 'city', 'pincode', 'state', 'country', 'gst_number', 'payment_due_days', 'email_id', 'bank_email'] },
//         { model: Depot, as: "depot", attributes: ['id', 'depot_name', 'address', 'city', 'pincode', 'state', 'country', 'gst_no'] },
//         { model: User, as: "created_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
//         { model: User, as: "modified_by_user", attributes: ['id', 'first_name', 'last_name'] }, 
//         { model: User, as: "approved_by_user", attributes: ['id', 'first_name', 'last_name'] }
//       ] 
//     });

//     if (BatchProcessing) {
//       if (filePath != '') {
//         // let date_of_processing = new Date(BatchProcessing.date_of_processing).toLocaleDateString("en-US");
//         let date_of_processing = moment(BatchProcessing.date_of_processing).format('DD-MM-YYYY');
//         let subject = 'Purchase Order from Wholesome Habits Pvt Ltd - ' + BatchProcessing.no_of_batch;
//         const message = `<html><head></head><body>Dear ${BatchProcessing.product.product_name},<br /><br />
//                         Please find our purchase order attached to this email.
//                         <br /><br />Thank you<br />Team eatanytime
//                         <br /><br />
//                         &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-----------------   Purchase Order Summary  -------------------<br />
//                         &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Purchase Order No. : ${BatchProcessing.no_of_batch}<br />
//                         &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Purchase Order Date: ${date_of_processing}<br />
//                         &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Total: Rs ${BatchProcessing.avg_grams.toLocaleString('en-US', { style: 'currency', currency: 'INR' })}<br />&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;--------------------------------------------------------------------------
//                         </body></html>`;

//         // let from_email = 'cs@eatanytime.in';
//         // let from_email_sender = 'EAT MIS';

//         let to_email = 'product@eatanytime.in';

//         if (BatchProcessing.product.email_id) {
//           to_email = to_email + ', ' + BatchProcessing.product.email_id;
//         }
//         if (BatchProcessing.product.bank_email) {
//           to_email = to_email + ', ' + BatchProcessing.product.bank_email;
//         }

//         const mailOptions = {
//             from: 'EAT MIS <cs@eatanytime.in>',
//             to: to_email,
//             cc: 'prachi.sanghvi@eatanytime.in, dhaval.maru@otbconsulting.co.in',
//             bcc: 'technology@otbconsulting.co.in',
//             // to: 'prasad.bhisale@raastaconsulting.com',
//             // cc: 'technology@raastaconsulting.com',
//             // bcc: 'technology@raastaconsulting.com',
//             // cc: 'dhaval.maru@otbconsulting.co.in',
//             // bcc: 'rishit.sanghvi@eatanytime.in',
//             subject: subject,
//             text: message,
//             html: message,
//             attachments: [{ filename: fileName, path: filePath }]
//         };

//         // result = await sendEmail(mailOptions);

//         return sendEmail(mailOptions);

//         // sendEmail(mailOptions)
//         //     .then(result => {
//         //         // console.log(result);
//         //         // return res.status(200).json({ result: result });
//         //         return result;
//         //         // return true;
//         //     })
//         //     .catch(err => {
//         //         // console.log(err);
//         //         // const error = new Error(err);
//         //         // error.httpStatusCode = 500;
//         //         // return next(error);

//         //         return err;
//         //     });

//         // // echo $mailSent;
//         // // echo '<br/><br/>';

//         // if ($mailSent == 1) {
//         //     // echo 'Mail sent successfully.';
//         //     // echo '<br/><br/>';
//         //     $this->session->set_flashdata('success', 'Mail sent successfully.');
//         //     // $this->session->keep_flashdata('success');
//         // } else {
//         //     // echo 'Mail sending failed.';
//         //     // echo '<br/><br/>';
//         //     $this->session->set_flashdata('error', 'Mail sending failed.');
//         //     // $this->session->keep_flashdata('error');
//         // }
        

//         // if($mailSent==1){
//         //     $sql = "update product_payment_details set mail_sent = '1' where id = '".$id."'";
//         //     $this->db->query($sql);

//         //     $logarray['table_id']=$this->session->userdata('session_id');
//         //     $logarray['module_name']='Product_Payment';
//         //     $logarray['cnt_name']='Product_Payment';
//         //     $logarray['action']='Product Payment File sent.';
//         //     $this->user_access_log_model->insertAccessLog($logarray);
//         // }
//       }
//     }

//     // return result;
//   // } catch (error) {
//   //   // console.log('Error', error);
//   //   return error;
//   // }
// }

// BatchProcessing.prototype.getBatchRawMaterials = function(body) {
//   // try {
//     const BatchRawMaterials = [];
//     if (body.BatchRawMaterials) {
//       for (const postedBatchRawMaterial of body.BatchRawMaterials) {
//         const item_id = (postedBatchRawMaterial.item_id) ? +postedBatchRawMaterial.item_id : null;
//         const item_desc = (postedBatchRawMaterial.item_desc) ? postedBatchRawMaterial.item_desc : '';
//         const qty = (postedBatchRawMaterial.qty) ? +postedBatchRawMaterial.qty : 0;
//         const rate = (postedBatchRawMaterial.rate) ? +postedBatchRawMaterial.rate : 0;
//         // const tax_type = (this.tax_type) ? this.tax_type : 'Intra';
//         const old_po_rate = (postedBatchRawMaterial.old_po_rate) ? +postedBatchRawMaterial.old_po_rate : 0;
  
//         const BatchRawMaterial = {
//           batch_processing_id: this.id,
//           item_id: item_id,
//           item_desc: item_desc,
//           qty: qty,
//           rate: rate,
//           old_po_rate: old_po_rate
//         };

//         BatchRawMaterials.push(BatchRawMaterial);
//       }
//     }
    
//     return BatchRawMaterials;
//   // } catch (error) {
//   //   return error;
//   // }
// }

// BatchProcessing.prototype.getBatchProcessingOtherCharges = function(body) {
//   // try {
//     const BatchProcessingOtherCharges = [];
//     if (body.BatchProcessingOtherCharges) {
//       for (const postedBatchProcessingOtherCharge of body.BatchProcessingOtherCharges) {
//         // const item_id = (postedBatchProcessingOtherCharge.item_id) ? +postedBatchProcessingOtherCharge.item_id : null;
//         const item_desc = (postedBatchProcessingOtherCharge.item_desc) ? postedBatchProcessingOtherCharge.item_desc : '';
//         // const qty = (postedBatchProcessingOtherCharge.qty) ? +postedBatchProcessingOtherCharge.qty : null;
//         // const rate = (postedBatchProcessingOtherCharge.rate) ? +postedBatchProcessingOtherCharge.rate : null;
//         const requested_kg = (postedBatchProcessingOtherCharge.requested_kg) ? +postedBatchProcessingOtherCharge.requested_kg : 0;
//         const tax_per = (postedBatchProcessingOtherCharge.tax_per) ? +postedBatchProcessingOtherCharge.tax_per : 0;
//         // const tax_type = (this.tax_type) ? this.tax_type : 'Intra';
//         // const old_po_rate = (postedBatchProcessingOtherCharge.old_po_rate) ? +postedBatchProcessingOtherCharge.old_po_rate : null;
  
//         const BatchProcessingOtherCharge = {
//           batch_processing_id: this.id,
//           // item_id: item_id,
//           item_desc: item_desc,
//           // qty: qty,
//           // rate: rate,
//           requested_kg: requested_kg,
//           tax_per: tax_per,
//           // old_po_rate: old_po_rate
//         };

//         BatchProcessingOtherCharges.push(BatchProcessingOtherCharge);
//       }
//     }
    
//     return BatchProcessingOtherCharges;
//   // } catch (error) {
//   //   return error;
//   // }
// }

// BatchProcessing.prototype.setTransactionAmount = function(BatchRawMaterials, BatchProcessingOtherCharges) {
//   // try {
//     const items = BatchRawMaterials.concat(BatchProcessingOtherCharges);

//     const transaction = calculateTransactionAmount(items, 0, 0);

//     this.requested_kg = transaction.requested_kg;
//     this.qty_in_bar = transaction.qty_in_bar;
//     this.actual_wastage = transaction.actual_wastage;
//     this.wastage_percent = transaction.wastage_percent;
//     this.anticipated_wastage = transaction.anticipated_wastage;
//     this.wastage_variance = transaction.wastage_variance;
//     this.output_kg = transaction.output_kg;
//     this.avg_grams = transaction.final_amount;
//   // } catch (error) {
//   //   return error;
//   // }
// }

// BatchProcessing.prototype.setRawMaterialIn = function() {
//   // try {
//     if (this.production_id.trim().toUpperCase() === 'ADVANCE' || this.anticipated_water_loss === 1) {
//       this.production_id = 'Closed';
//     } else {
//       this.production_id = 'Raw Material In';
//     }
//   // } catch (error) {
//   //   return error;
//   // }
// }

// BatchProcessing.prototype.OpenPo = function() {
//   // try {
//     if (this.anticipated_water_loss === 1) {
//       this.production_id = 'Advance';
//     } else if (!this.production_id || this.production_id.trim().toUpperCase() !== 'ADVANCE') {
//       this.production_id = 'Open';
//     }
//   // } catch (error) {
//   //   return error;
//   // }
// }

// BatchProcessing.prototype.approve = function(req) {
//   // try {
//     // if (this.isDeleted) {
//     if (this.status === "Deleted") {
//       this.status = "InActive";
//     } else {
//       this.status = "Approved";
//     }

//     if (req && req.body && req.body.remarks) {
//       this.remarks = req.body.remarks;
//     } else {
//       this.remarks = '';
//     }
//     this.approved_by = req.userData.userId;
//     this.approved_on = new Date().toISOString();

//     return null;
//   // } catch (error) {
//   //   return error;
//   // }
// }

// BatchProcessing.prototype.reject = function(req) {
//   // try {
//     this.status = "Rejected";
//     if (req && req.body && req.body.remarks) {
//       this.remarks = req.body.remarks;
//     } else {
//       this.remarks = '';
//     }
//     this.rejected_by = req.userData.userId;
//     this.rejected_on = new Date().toISOString();

//     return null;
//   // } catch (error) {
//   //   return error;
//   // }
// }

// BatchProcessing.prototype.getBatchProcessingNo = function(series) {
//   // try {
//     if (this.no_of_batch) {
//       return this.no_of_batch;
//     }
  
//     const orderDate = this.date_of_processing ? new Date(this.date_of_processing) : new Date();
//     const financialYear = calculateFiscalYearForDate(orderDate);
//     // const monthName = getMonthName(orderDate.getMonth());

//     const BatchProcessingNo = 'WHPL/' + financialYear + '/' + series;
    
//     this.no_of_batch = BatchProcessingNo;

//     return BatchProcessingNo;
//   // } catch (error) {
//   //   return error;
//   // }
// }

// Get Batch Raw Material Qty
export const getBatchRawMaterialQty = async function(raw_material_id, depot_id, barcode=null) {

  const batchProcessing = await BatchProcessing.findAll({
    where: { 
      ...(depot_id && { depot_id: depot_id }), 
      status: 'Approved',
      // date_of_processing: { [Op.gte]: "2026-04-01"},
    }
  });

  const batch_process_ids = batchProcessing.map(batch => batch.id);

  const batchRawMaterial = await BatchRawMaterial.findAll({
    attributes: [[fn('SUM', col('qty')), 'total_qty']],
    where: { 
      raw_material_id: raw_material_id,
      batch_processing_id: { [Op.in]: batch_process_ids },
      ...(barcode && {barcode:barcode}) 
    },
    raw: true,
  });

  const totalQty = batchRawMaterial[0]?.total_qty ? +batchRawMaterial[0].total_qty : 0;

  return totalQty;
}

export const getBatchVariationQty = async function(raw_material_id, depot_id, barcode = null) {

  if(!barcode){
    const batchProcessing = await BatchProcessing.findAll({
      where: { 
        ...(depot_id && { depot_id: depot_id }), 
        status: 'Approved',
        // date_of_processing: { [Op.gte]: "2026-04-01"},
      }
    });
  
    const batch_process_ids = batchProcessing.map(batch => batch.id);
  
    const batchVariations = await BatchVariation.findAll({
      attributes: [[fn('SUM', col('primary_packaging_qty')), 'total_qty']],
      where: { 
        primary_packaging_id: raw_material_id, 
        batch_processing_id: { [Op.in]: batch_process_ids },
      },
      raw: true,
    });
  
    const totalQty = batchVariations[0].total_qty ? +batchVariations[0].total_qty : 0;
  
    return totalQty;
  }

  return 0;
}

export default BatchProcessing;