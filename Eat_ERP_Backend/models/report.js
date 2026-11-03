import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';
import path from 'path';

import ExcelJS from 'exceljs';
import Product from './product.js';
import BatchProcessing from './batchProcessing.js';
import BatchRawMaterial from './batchRawMaterial.js';
import BatchVariation from './batchVariation.js';
import Depot from './depot.js';
import RawMaterial from './rawMaterial.js';
import Box from './box.js';
import { getReportPath, getReportUrl, getTemplatePath } from '../lib/common.js';
import Production from './production.js';
import Category from './category.js';
import RawMaterialInItemWeight from './rawMaterialInItemWeight.js';
import RawMaterialIn from './rawMaterialIn.js';
import Vendor from './vendor.js';

const Report = sequelize.define('reports', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  // report_date: {
  //   type: DataTypes.DATEONLY,
  //   allowNull: false,
  //   validate: {
  //     notNull: true
  //   }
  // },
  report_name: {
    type: DataTypes.STRING,
  },
  report_path: {
    type: DataTypes.STRING,
  },
  file_name: DataTypes.STRING,
  status: DataTypes.STRING,
  remarks: DataTypes.STRING,
  created_by: DataTypes.INTEGER,
  created_on: DataTypes.DATE,
  modified_by: DataTypes.INTEGER,
  modified_on: DataTypes.DATE
}, 
{ 
  timestamps: false,
  createdAt: 'created_on',
  updatedAt: 'modified_on',
  freezeTableName: true
});

export const getProductionReport = async function(req) {
  try {
    let fromDate = (req.body.fromDate) ? new Date(req.body.fromDate) : new Date('2024-04-01 00:00:00');
    let toDate = (req.body.toDate) ? new Date(req.body.toDate) : new Date();

    // console.log(fromDate);
    // console.log(toDate);
    
    const batchProcessings = await BatchProcessing.findAll({
      where: { status: 'Approved', date_of_processing: {[Op.between]: [fromDate, toDate]}, depot_id: {[Op.in]: req.userData.depotIds} },
      include: [
        {model: Depot, as: 'depot', attributes: ['id', 'depot_name']},
        {
          model: Product, as: 'product', 
          attributes: ['id', 'product_name', 'short_name'],
          include: [
            {model: Category, as: 'category', attributes: ['id', 'category_name']},
          ]
        },
        {model: Production, as: 'production'},
        {
          model: BatchRawMaterial, 
          as: 'batchProcessingItems', 
          include: {model: RawMaterial, as: 'rawMaterial', attributes: ['id', 'rm_name']}
        },
        {
          model: BatchVariation, 
          as: 'batchVariations', 
          include: [
            {model: Box, as: 'box', attributes: ['id', 'box_name']},
            {model: RawMaterial, as: 'primaryPackaging', attributes: ['id', 'rm_name']},
            {model: RawMaterial, as: 'secondaryPackaging', attributes: ['id', 'rm_name']}
          ]
        }
      ]
    });

    if (batchProcessings) {
      // const template = path.join(getTemplatePath(), 'Production_report_format.xlsx');

      // if (!fs.existsSync(template)) {
      //   return 'Template not found.';
      // }

      // console.log(template);

      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Productions');
      const wsRms = workbook.addWorksheet('Raw Materials');
      const wsSkus = workbook.addWorksheet('SKU Details');
      // const workbook = new ExcelJS.Workbook();
      // await workbook.xlsx.readFile(template);
      // const ws = workbook.getWorksheet(1);
      // const wsRms = workbook.getWorksheet(2);
      // const wsSkus = workbook.getWorksheet(3);

      ws.getCell('A1').value = 'Id';
      ws.getCell('B1').value = 'Batch No';
      ws.getCell('C1').value = 'Date Of Processing';
      ws.getCell('D1').value = 'Depot Id';
      ws.getCell('E1').value = 'Depot Name';
      ws.getCell('F1').value = 'Product Id';
      ws.getCell('G1').value = 'Product Name';
      ws.getCell('H1').value = 'Category';
      ws.getCell('I1').value = 'Requested Kg';
      ws.getCell('J1').value = 'Received Kg';
      ws.getCell('K1').value = 'Output Kg';
      ws.getCell('L1').value = 'Retain Kg';
      ws.getCell('M1').value = 'Return Kg';
      ws.getCell('N1').value = 'Waste Kg';
      ws.getCell('O1').value = 'Process Loss';
      ws.getCell('P1').value = 'Status';
      ws.getCell('Q1').value = 'Remarks';

      // for (let cNum = 1; cNum <= 16; cNum++) {
      //   ws.getRow(1).getCell(cNum).border = {
      //     top: {style:'thin'},
      //     left: {style:'thin'},
      //     bottom: {style:'thin'},
      //     right: {style:'thin'}
      //   };
      // }

      wsRms.getCell('A1').value = 'Id';
      wsRms.getCell('B1').value = 'Batch Processing Id';
      wsRms.getCell('C1').value = 'Raw Material Id';
      wsRms.getCell('D1').value = 'Raw Material Name';
      wsRms.getCell('E1').value = 'Quantity';
      wsRms.getCell('F1').value = 'Barcode';
      wsRms.getCell('G1').value = 'Vendor Name';
      wsRms.getCell('H1').value = 'GRN Date';
      // wsRms.getCell('I1').value = 'Expiry Date';

      // for (let cNum = 1; cNum <= 7; cNum++) {
      //   wsRms.getRow(1).getCell(cNum).border = {
      //     top: {style:'thin'},
      //     left: {style:'thin'},
      //     bottom: {style:'thin'},
      //     right: {style:'thin'}
      //   };
      // }

      wsSkus.getCell('A1').value = 'Id';
      wsSkus.getCell('B1').value = 'Batch Processing Id';
      wsSkus.getCell('C1').value = 'Box Id';
      wsSkus.getCell('D1').value = 'Box Name';
      wsSkus.getCell('E1').value = 'Variation Qty';
      wsSkus.getCell('F1').value = 'Qty';
      wsSkus.getCell('G1').value = 'Primary Packaging Id';
      wsSkus.getCell('H1').value = 'Primary Packaging Name';
      wsSkus.getCell('I1').value = 'Primary Qty';
      wsSkus.getCell('J1').value = 'Primary Packaging Qty';
      wsSkus.getCell('K1').value = 'Secondary Packaging Id';
      wsSkus.getCell('L1').value = 'Secondary Packaging Name';
      wsSkus.getCell('M1').value = 'Secondary Qty';
      wsSkus.getCell('N1').value = 'Secondary Packaging Qty';

      // for (let cNum = 1; cNum <= 14; cNum++) {
      //   wsSkus.getRow(1).getCell(cNum).border = {
      //     top: {style:'thin'},
      //     left: {style:'thin'},
      //     bottom: {style:'thin'},
      //     right: {style:'thin'}
      //   };
      // }

      let rNum = 2;
      let rNumRm = 2;
      let rNumSku = 2;

      for (const data of batchProcessings) {
        // console.log(data);
        const batchProcessingItems = data.batchProcessingItems;
        const batchVariations = data.batchVariations;
        const production = data.production ? data.production : null;

        const row = ws.getRow(rNum);
        row.getCell(1).value = data.id ? data.id : 0;
        row.getCell(2).value = data.batch_id_as_per_fssai ? data.batch_id_as_per_fssai : '';
        row.getCell(3).value = data.date_of_processing ? data.date_of_processing : '';
        row.getCell(4).value = data.depot_id ? data.depot_id :0;
        row.getCell(5).value = data.depot && data.depot.depot_name ? data.depot.depot_name : '';
        row.getCell(6).value = data.product_id ? data.product_id : 0;
        row.getCell(7).value = data.product && data.product.product_name ? data.product.product_name : '';
        row.getCell(8).value = data.product && data.product.category && data.product.category.category_name ? data.product.category.category_name : '';
        row.getCell(9).value = data.requested_kg ? data.requested_kg : 0;
        row.getCell(10).value = data.total_kg ? data.total_kg : 0;
        row.getCell(11).value = data.output_kg ? data.output_kg : 0;
        row.getCell(12).value = production && production.retain_kg ? production.retain_kg : 0;
        row.getCell(13).value = production && production.return_kg ? production.return_kg : 0;
        row.getCell(14).value = production && production.waste_kg ? production.waste_kg : 0;
        row.getCell(15).value = data.wastage_percent ? data.wastage_percent : 0;
        row.getCell(16).value = data.status ? data.status : '';
        row.getCell(17).value = data.remarks ? data.remarks : '';

        for (const dataRms of batchProcessingItems) {
          const rowRms = wsRms.getRow(rNumRm);
          rowRms.getCell(1).value = dataRms.id ? dataRms.id : 0;
          rowRms.getCell(2).value = dataRms.batch_processing_id ? dataRms.batch_processing_id : 0;
          rowRms.getCell(3).value = dataRms.raw_material_id ? dataRms.raw_material_id : 0;
          rowRms.getCell(4).value = dataRms.rawMaterial && dataRms.rawMaterial.rm_name ? dataRms.rawMaterial.rm_name : '';
          rowRms.getCell(5).value = dataRms.qty ? dataRms.qty : 0;
          rowRms.getCell(6).value = dataRms.barcode ? dataRms.barcode : 0;
          // Fetch vendor name and GRN date based on barcode
          let vendorName = '';
          let grnDate = '';

          if (dataRms.barcode) {
            try {
              // Search barcode in raw_material_in_item_weights table
              const rawMaterialInItemWeight = await RawMaterialInItemWeight.findOne({
                where: { barcode: dataRms.barcode },
                attributes: ['raw_material_in_id', 'vendor_id']
              });

              if (rawMaterialInItemWeight) {
                const rawMaterialInId = rawMaterialInItemWeight.raw_material_in_id;
                const vendorId = rawMaterialInItemWeight.vendor_id;

                // Get GRN date from RawMaterialIn model
                const rawMaterialIn = await RawMaterialIn.findOne({
                  where: { id: rawMaterialInId },
                  attributes: ['date_of_receipt']
                });

                if (rawMaterialIn) {
                  grnDate = rawMaterialIn.date_of_receipt;
                }

                // Get vendor name from Vendor model
                const vendor = await Vendor.findOne({
                  where: { id: vendorId },
                  attributes: ['vendor_name']
                });

                if (vendor) {
                  vendorName = vendor.vendor_name;
                }else{
                  vendorName = "NA"
                }
              }
            } catch (error) {
              console.log('Error fetching vendor name and GRN date:', error);
            }
          }

          rowRms.getCell(7).value = vendorName;
          rowRms.getCell(8).value = grnDate;
          // rowRms.getCell(9).value = dataRms.expiry_date ? dataRms.expiry_date : 0;


          // for (let cNum = 1; cNum <= 9; cNum++) {
          //   rowRms.getCell(cNum).border = {
          //     top: {style:'thin'},
          //     left: {style:'thin'},
          //     bottom: {style:'thin'},
          //     right: {style:'thin'}
          //   };
          // }

          rNumRm += 1;
        }

        for (const dataSkus of batchVariations) {
          const rowSkus = wsSkus.getRow(rNumSku);
          rowSkus.getCell(1).value = dataSkus.id ? dataSkus.id : 0;
          rowSkus.getCell(2).value = dataSkus.batch_processing_id ? dataSkus.batch_processing_id : 0;
          rowSkus.getCell(3).value = dataSkus.box_id ? dataSkus.box_id : 0;
          rowSkus.getCell(4).value = dataSkus.box.box_name ? dataSkus.box.box_name : 0;
          rowSkus.getCell(5).value = dataSkus.variation_qty ? dataSkus.variation_qty : 0;
          rowSkus.getCell(6).value = dataSkus.qty ? dataSkus.qty : 0;
          rowSkus.getCell(7).value = dataSkus.primary_packaging_id ? dataSkus.primary_packaging_id : 0;
          rowSkus.getCell(8).value = dataSkus.primaryPackaging && dataSkus.primaryPackaging.rm_name ? dataSkus.primaryPackaging.rm_name : 0;
          rowSkus.getCell(9).value = dataSkus.primary_qty ? dataSkus.primary_qty : 0;
          rowSkus.getCell(10).value = dataSkus.primary_packaging_qty ? dataSkus.primary_packaging_qty : 0;
          rowSkus.getCell(11).value = dataSkus.secondary_packaging_id ? dataSkus.secondary_packaging_id : 0;
          rowSkus.getCell(12).value = dataSkus.secondaryPackaging && dataSkus.secondaryPackaging.rm_name ? dataSkus.secondaryPackaging.rm_name : 0;
          rowSkus.getCell(13).value = dataSkus.secondary_qty ? dataSkus.secondary_qty : 0;
          rowSkus.getCell(14).value = dataSkus.secondary_packaging_qty ? dataSkus.secondary_packaging_qty : 0;
          
          // for (let cNum = 1; cNum <= 14; cNum++) {
          //   rowSkus.getCell(cNum).border = {
          //     top: {style:'thin'},
          //     left: {style:'thin'},
          //     bottom: {style:'thin'},
          //     right: {style:'thin'}
          //   };
          // }

          rNumSku += 1;
        }

        // for (let cNum = 1; cNum <= 16; cNum++) {
        //   row.getCell(cNum).border = {
        //     top: {style:'thin'},
        //     left: {style:'thin'},
        //     bottom: {style:'thin'},
        //     right: {style:'thin'}
        //   };
        // }

        rNum++;
      }
      
      // worksheet.getCell('A1').font = { bold: true };

      const fileName = `Production_report_${Date.now()}.xlsx`;
      const filePath = path.join(getReportPath(), fileName);
      await workbook.xlsx.writeFile(filePath);

      // const fileKey = `reports/${fileName}`;
      // // const fileUrl = '';
      // const fileUrl = await uploadFileToS3Bucket(filePath, fileKey);

      const fileUrl = path.join(getReportUrl(), fileName);
      // console.log(fileUrl);

      return {fileUrl, fileName};
    } else {
      return 'No Records Found';
    }
  } catch (error) {
    console.log(error);
    return error;
  }
}

// reportSchema.statics.setReportDetails = async function(type, transaction, session, req) {
//   try {
//     let data = {
//       reportDate: null,
//       depot: null,
//       productId: null,
//       reportQuantity: 0,
//       reportType: type,
//       grn: null,
//       depotTransfer: null,
//       sell: null,
//       sample: null,
//       sellReturn: null,
//       productName: null,
//       description: null,
//       hsnCode: null,
//       hsnName: null,
//       grams: 0,
//       quantity: 0,
//       mrp: 0,
//       taxPercentage: 0,
//       sellRate: 0,
//       amount: 0,
//       discountAmount: 0,
//       taxableAmount: 0,
//       cgst: 0,
//       sgst: 0,
//       igst: 0,
//       cgstAmount: 0,
//       sgstAmount: 0,
//       igstAmount: 0,
//       taxAmount: 0,
//       totalAmount: 0,
//       costWithoutGst: 0,
//       costAmount: 0,
//       status: 'Approved',
//       createdBy: req.userData.userId,
//       updatedBy: req.userData.userId
//     };

//     let items = null;

//     if (type === 'Grn') {
//       data.reportDate = transaction.grnDate;
//       data.depot = transaction.depot;
//       data.grn = transaction._id;
//       items = transaction.grnItems;
//     } else if (type === 'Depot Transfer') {
//       data.reportDate = transaction.depotTransferDate;
//       data.depot = transaction.depotIn;
//       data.depotTransfer = transaction._id;
//       items = transaction.depotTransferItems;
//     } else if (type === 'Sell') {
//       data.reportDate = transaction.sellDate;
//       data.depot = transaction.depot;
//       data.sell = transaction._id;
//       items = transaction.sellItems;
//     } else if (type === 'Sample' || type === 'Expired') {
//       data.reportDate = transaction.sampleDate;
//       data.depot = transaction.depot;
//       data.sample = transaction._id;
//       items = transaction.sampleItems;
//     } else if (type === 'Sell Return') {
//       data.reportDate = transaction.sellReturnDate;
//       data.depot = transaction.depot;
//       data.sellReturn = transaction._id;
//       items = transaction.sellReturnItems;
//     }

//     data.status = transaction.status;

//     // console.log(items);

//     for (const item of items) {
//       data.productId = item.productId;
//       data.productName = item.productName;
//       data.description = item.description;
//       data.hsnCode = item.hsnCode;
//       data.hsnName = item.hsnName;
//       data.grams = item.grams;
//       data.quantity = item.quantity;
//       data.taxPercentage = item.taxPercentage;
//       data.amount = item.amount;
//       data.cgst = item.cgst;
//       data.sgst = item.sgst;
//       data.igst = item.igst;
//       data.cgstAmount = item.cgstAmount;
//       data.sgstAmount = item.sgstAmount;
//       data.igstAmount = item.igstAmount;
//       data.taxAmount = item.taxAmount;
//       data.totalAmount = item.totalAmount;

//       if (type === 'Grn') {
//         data.mrp = item.ratePo;
//         data.sellRate = item.rate;
//         data.discountAmount = 0;
//         data.taxableAmount = item.amount;
//         data.costWithoutGst = item.rate;
//         data.costAmount = item.amount;
//       } else {
//         data.mrp = item.mrp;
//         data.sellRate = item.sellRate;
//         data.discountAmount = item.discountAmount;
//         data.taxableAmount = item.taxableAmount;
//         data.costWithoutGst = item.costWithoutGst;
//         data.costAmount = item.costAmount;
//       }
      
//       if (type === 'Sell' || type === 'Sample' || type === 'Expired') {
//         data.reportQuantity = item.quantity * -1;
//       } else {
//         data.reportQuantity = item.quantity;
//       }

//       const report = new models.Report(data);
//       await report.save({ session });

//       if (type === 'Depot Transfer') {
//         const reportOut = new models.Report(data);
//         reportOut.depot = transaction.depotOut;
//         reportOut.reportQuantity = item.quantity * -1;
//         await reportOut.save({ session });
//       }
//     }
    
//     return null;
//   } catch (error) {
//     console.log(error);

//     return error;
//   }
// }

// reportSchema.statics.getSellSkuReport = async function(req) {
//   try {
//     let fromDate = (req.body.fromDate) ? new Date(req.body.fromDate) : new Date('2023-04-01 00:00:00');
//     let toDate = (req.body.toDate) ? new Date(req.body.toDate) : new Date();
//     let sales = (req.body.sales) ? req.body.sales : false;
//     let salesReturn = (req.body.salesReturn) ? req.body.salesReturn : false;
//     let sampleAndExpired = (req.body.sampleAndExpired) ? req.body.sampleAndExpired : false;
//     // let invoiceLevelSales = (req.body.invoiceLevelSales) ? req.body.invoiceLevelSales : false;
//     // let invoiceLevelSalesReturn = (req.body.invoiceLevelSalesReturn) ? req.body.invoiceLevelSalesReturn : false;

//     // if (req.body.fromDate) {
//     //   fromDate = new Date(req.body.fromDate);
//     // }
//     // if (req.body.toDate) {
//     //   toDate = new Date(req.body.toDate);
//     // }

//     // console.log(fromDate);
//     // console.log(toDate);
//     // console.log(sales);
//     // console.log(salesReturn);
//     // console.log(sampleAndExpired);
//     // console.log(invoiceLevelSales);
//     // console.log(invoiceLevelSalesReturn);

//     let includes = [];

//     let sells = [];
//     if (sales) {
//       sells = await Sell.find({ status: 'Approved', isDepotTransfer: false, invoiceDate: {
//         $gte: fromDate, 
//         $lte: toDate
//       }}).populate([
//         { path: 'depot', select: { depotName: 1, state: 1 } }, 
//         { path: 'distributor', select: { distributorName: 1, prefix: 1, class: 1, state: 1, city: 1 }}, 
//         { path: 'sellItems', populate: { path: 'productId', model: Product, select: { productName: 1, shortName: 1, category: 1, hsnCode: 1 } }
//       }]).lean();

//       // console.log(sells);
//       // return sells;
//       includes.push('Sales');
//     }

//     let sellReturns = [];
//     if (salesReturn) {
//       sellReturns = await SellReturn.find({ status: 'Approved', sellReturnDate: {
//         $gte: fromDate, 
//         $lte: toDate
//       }}).populate([
//         { path: 'depot', select: { depotName: 1, state: 1 } }, 
//         { path: 'distributor', select: { distributorName: 1, prefix: 1, class: 1, state: 1, city: 1 }}, 
//         { path: 'sell', select: { name: 1, shippingSameAsBilling: 1, consignee: 1, gstNo: 1, city: 1 }}, 
//         { path: 'sellReturnItems', populate: { path: 'productId', model: Product, select: { productName: 1, shortName: 1, category: 1, hsnCode: 1 } }
//       }]).lean();

//       includes.push('Sales Return');
//     }
    
//     let samples = [];
//     if (sampleAndExpired) {
//       samples = await Sample.find({ status: 'Approved', sampleDate: {
//         $gte: fromDate, 
//         $lte: toDate
//       }}).populate([
//         { path: 'depot', select: { depotName: 1, state: 1 } }, 
//         { path: 'distributor', select: { distributorName: 1, prefix: 1, class: 1, state: 1, city: 1 }}, 
//         { path: 'sampleItems', populate: { path: 'productId', model: Product, select: { productName: 1, shortName: 1, category: 1, hsnCode: 1 } }
//       }]).lean();

//       includes.push('Sample And Expired');
//     }
    

//     if (sells || sellReturns || samples) {
//       const template = getTemplatePath() + 'Sale_invoice_sku_report_format.xlsx';

//       if (!fs.existsSync(template)) {
//         return 'Template not found.';
//       }

//       // console.log(template);

//       const workbook = new ExcelJS.Workbook();
//       await workbook.xlsx.readFile(template);
//       // const worksheet = workbook.addWorksheet('Report');
//       const worksheet = workbook.getWorksheet(1);

//       // worksheet.getCell('A1').value = 'WYN Wellness Pvt Ltd';
//       // worksheet.getCell('A2').value = 'Product Report Report';
//       worksheet.getCell('A3').value = fromDate.toLocaleDateString() + ' to ' + toDate.toLocaleDateString();
//       worksheet.getCell('B4').value = includes.join(', ');

//       let rNum = 7;

//       const finalData = sells.concat(sellReturns, samples);

//       for (const data of finalData) {
//         // console.log(data);
//         let recordType = 'Sell';
//         let recordItems = [];

//         if (data.sellDate) {
//           recordType = 'SALES';
//           recordItems = data.sellItems;
//         } else if (data.sellReturnDate) {
//           recordType = 'SALES RETURN';
//           recordItems = data.sellReturnItems;
//         } else if (data.sampleDate) {
//           recordType = (data.isExpired) ? 'EXPIRED' : 'SAMPLE';
//           recordItems = data.sampleItems;
//         } else {
//           continue;
//         }
        
//         let index = 0;

//         for (const item of recordItems) {
//           // const item = data.sellItems[index];
//           const row = worksheet.getRow(rNum);

//           if (recordType === 'SALES') {
//             row.getCell(4).value = data.invoiceDate;
//             row.getCell(7).value = data.invoiceNo;
//             row.getCell(22).value = (index === 0) ? data.invoiceAmount : 0;
//           } else if (recordType === 'SALES RETURN') {
//             row.getCell(4).value = data.sellReturnDate;
//             row.getCell(7).value = data.sellReturnNo;
//             row.getCell(22).value = (index === 0) ? data.sellReturnAmount : 0;
//           } else {
//             row.getCell(4).value = data.sampleDate;
//             row.getCell(7).value = data.sampleNo;
//             row.getCell(22).value = (index === 0) ? data.sampleAmount : 0;
//           }
        
//           row.getCell(1).value = { formula: `TEXT(D${rNum},"mmmm")` };
//           row.getCell(2).value = { formula: `CONCATENATE("Q"&ROUNDUP(MONTH(D${rNum})/3,0))` };
//           row.getCell(3).value = { formula: `=YEAR(D${rNum})` };
//           row.getCell(5).value = { formula: `=ROUNDUP(DAY(D${rNum})/7,0)` };
//           row.getCell(6).value = recordType;
//           row.getCell(8).value = item.productName;
//           row.getCell(9).value = item.productId.shortName;
//           row.getCell(10).value = item.productId.category.categoryName;
//           row.getCell(11).value = item.quantity;
//           row.getCell(12).value = item.mrp;
//           row.getCell(13).value = item.sellRate;
//           row.getCell(14).value = item.amount;
//           row.getCell(15).value = item.cgstAmount;
//           row.getCell(16).value = item.sgstAmount;
//           row.getCell(17).value = item.igstAmount;
//           row.getCell(18).value = item.taxAmount;

//           // if (index === 0 && data.roundOffAmount) {
//           if (index === 0) {
//             // row.getCell(19).value = round(item.totalAmount + data.roundOffAmount, 2);
//             row.getCell(19).value = item.totalAmount;
//             row.getCell(20).value = data.roundOffAmount;
//             row.getCell(21).value = data.shippingCharges;
//           } else {
//             row.getCell(19).value = item.totalAmount;
//             row.getCell(20).value = '';
//             row.getCell(21).value = '';
//             row.getCell(22).value = '';
//           }

//           row.getCell(23).value = data.depot.depotName;

//           let distributorName = '';
//           let distributorStateCode = '';
//           let distributorState = '';
//           let distributorGstNo = '';
//           let distributorCity = '';
//           let sellState = {};

//           if (data.distributor) {
//             // if (data.distributor.class === 'Direct' && recordType === 'SALES') {
//             //   if (data.depot.state.stateCode === data.state.stateCode) {
//             //     distributorName = data.distributor.prefix + ' Direct-Local';
//             //   } else {
//             //     distributorName = data.distributor.prefix + ' OOS-' + data.state.stateCode + '_' + data.state.stateName;
//             //   }
//             //   distributorStateCode = data.state.stateCode;
//             //   distributorState = data.state.stateName;
//             //   distributorGstNo = data.gstNo;
//             //   distributorCity = data.city;
//             // } else {
//             //   distributorName = data.distributor.distributorName;

//             //   if (!data.shippingSameAsBilling && data.consignee) {
//             //     distributorStateCode = data.consignee.state.stateCode;
//             //     distributorState = data.consignee.state.stateName;
//             //     distributorGstNo = data.consignee.gstNo;
//             //     distributorCity = data.consignee.city;
//             //   } else {
//             //     distributorStateCode = data.distributor.state.stateCode;
//             //     distributorState = data.distributor.state.stateName;
//             //     distributorGstNo = data.distributor.gstNo;
//             //     distributorCity = data.distributor.city;
//             //   }
//             // }

//             distributorName = data.distributor.distributorName;
//             sellState = data.distributor.state;
//             distributorGstNo = data.distributor.gstNo;
//             distributorCity = data.distributor.city;

//             if (recordType === 'SALES')  {
//               sellState = data.sellState;

//               if (data.distributor.class === 'Direct') {
//                 if (data.depot.state.stateCode === sellState.stateCode) {
//                   distributorName = data.distributor.prefix + ' Direct-Local';
//                 } else {
//                   distributorName = data.distributor.prefix + ' OOS-' + sellState.stateCode + '_' + sellState.stateName;
//                 }
//                 if (data.gstNo) {
//                   distributorGstNo = data.gstNo;

//                   if (data.name) {
//                     distributorName = data.name;
//                   }
//                 }
                
//                 if (data.city) {
//                   distributorCity = data.city;
//                 }
//               } else if (!data.shippingSameAsBilling && data.consignee) {
//                 distributorGstNo = data.consignee.gstNo;
//                 distributorCity = data.consignee.city;
//               }
//             } else if (recordType === 'SALES RETURN') {
//               sellState = data.sellReturnState;

//               if (data.distributor.class === 'Direct') {
//                 if (data.depot.state.stateCode === sellState.stateCode) {
//                   distributorName = data.distributor.prefix + ' Direct-Local';
//                 } else {
//                   distributorName = data.distributor.prefix + ' OOS-' + sellState.stateCode + '_' + sellState.stateName;
//                 }

//                 if (data.sell) {
//                   if (data.sell.gstNo) {
//                     distributorGstNo = data.sell.gstNo;
  
//                     if (data.sell.name) {
//                       distributorName = data.sell.name;
//                     }
//                   }
                    
//                   if (data.sell.city) {
//                     distributorCity = data.sell.city;
//                   }
//                 }
//               } else {
//                 if (data.sell) {
//                   if (!data.sell.shippingSameAsBilling && data.sell.consignee) {
//                     distributorGstNo = data.sell.consignee.gstNo;
//                     distributorCity = data.sell.consignee.city;
//                   }
//                 }
//               }
//             }

//             distributorStateCode = sellState.stateCode;
//             distributorState = sellState.stateName;
//           }
          
//           row.getCell(24).value = distributorName;
//           row.getCell(25).value = distributorStateCode;
//           row.getCell(26).value = distributorState;
//           row.getCell(27).value = distributorGstNo;
//           row.getCell(28).value = distributorCity;
          
//           row.getCell(29).value = data.dueDate;
//           row.getCell(30).value = (data.orderNo) ? data.orderNo : '';
//           row.getCell(31).value = (data.orderDate) ? data.orderDate : '';
//           row.getCell(32).value = data.remarks;
//           row.getCell(33).value = data._id.toString();
//           row.getCell(34).value = data.status;
//           row.getCell(35).value = item.costAmount;
//           row.getCell(36).value = item.hsnCode;

//           for (let cNum = 1; cNum <= 36; cNum++) {
//             row.getCell(cNum).border = {
//               top: {style:'thin'},
//               left: {style:'thin'},
//               bottom: {style:'thin'},
//               right: {style:'thin'}
//             };
//           }

//           rNum++;
//           index++;
//         }
//       }
      
//       worksheet.getCell('A1').font = { bold: true };

//       const fileName = `Sale_invoice_sku_report_${Date.now()}.xlsx`;
//       const filePath = getReportPath() + fileName;
//       await workbook.xlsx.writeFile(filePath);

//       const fileKey = `reports/${fileName}`;

//       // const fileUrl = '';
//       const fileUrl = await uploadFileToS3Bucket(filePath, fileKey);

//       // console.log(fileUrl);

//       return fileUrl;
//     } else {
//       return 'No Records Found';
//     }
//   } catch (error) {
//     console.log(error);
//     return error;
//   }
// }

// reportSchema.statics.getSellInvoiceReport = async function(req) {
//   try {
//     let fromDate = (req.body.fromDate) ? new Date(req.body.fromDate) : new Date('2023-04-01 00:00:00');
//     let toDate = (req.body.toDate) ? new Date(req.body.toDate) : new Date();
//     let invoiceLevelSales = (req.body.invoiceLevelSales) ? req.body.invoiceLevelSales : false;
//     let invoiceLevelSalesReturn = (req.body.invoiceLevelSalesReturn) ? req.body.invoiceLevelSalesReturn : false;

//     // console.log(fromDate);
//     // console.log(toDate);
//     // console.log(invoiceLevelSales);
//     // console.log(invoiceLevelSalesReturn);

//     let includes = [];

//     let sells = [];
//     if (invoiceLevelSales) {
//       sells = await Sell.find({ status: { $in: ['Approved', 'InActive'] }, isDepotTransfer: false, invoiceDate: {
//         $gte: fromDate, 
//         $lte: toDate
//       }}).populate([
//         { path: 'depot', select: { depotName: 1, state: 1 } }, 
//         { path: 'distributor', select: { distributorName: 1, prefix: 1, class: 1, state: 1, city: 1 }}, 
//         { path: 'sellItems', populate: { path: 'productId', model: Product, select: { productName: 1, shortName: 1, category: 1, hsnCode: 1 } }
//       }]).lean();

//       // console.log(sells);
//       // return sells;
//       includes.push('Sales');
//     }

//     let sellReturns = [];
//     if (invoiceLevelSalesReturn) {
//       sellReturns = await SellReturn.find({ status: { $in: ['Approved', 'InActive'] }, sellReturnDate: {
//         $gte: fromDate, 
//         $lte: toDate
//       }}).populate([
//         { path: 'depot', select: { depotName: 1, state: 1 } }, 
//         { path: 'distributor', select: { distributorName: 1, prefix: 1, class: 1, state: 1, city: 1 }}, 
//         { path: 'sell', select: { name: 1, shippingSameAsBilling: 1, consignee: 1, gstNo: 1, city: 1 }}, 
//         { path: 'sellReturnItems', populate: { path: 'productId', model: Product, select: { productName: 1, shortName: 1, category: 1, hsnCode: 1 } }
//       }]).lean();

//       includes.push('Sales Return');
//     }

//     if (sells || sellReturns) {
//       const template = getTemplatePath() + 'Sale_invoice_report_format.xlsx';

//       if (!fs.existsSync(template)) {
//         return 'Template not found.';
//       }

//       // console.log(template);

//       const workbook = new ExcelJS.Workbook();
//       await workbook.xlsx.readFile(template);
//       // const worksheet = workbook.addWorksheet('Report');
//       const worksheet = workbook.getWorksheet(1);

//       // worksheet.getCell('A1').value = 'WYN Wellness Pvt Ltd';
//       // worksheet.getCell('A2').value = 'Sale Invoice Report';
//       worksheet.getCell('A3').value = fromDate.toLocaleDateString() + ' to ' + toDate.toLocaleDateString();
//       worksheet.getCell('B4').value = includes.join(', ');

//       let rNum = 7;

//       const finalData = sells.concat(sellReturns);

//       for (const data of finalData) {
//         // console.log(data);
//         let recordType = 'SALES';
//         let recordItems = [];

//         if (data.sellDate) {
//           recordType = 'SALES';
//           recordItems = data.sellItems;
//         } else if (data.sellReturnDate) {
//           recordType = 'SALES RETURN';
//           recordItems = data.sellReturnItems;
//         } else {
//           continue;
//         }
        
//         const row = worksheet.getRow(rNum);

//         if (recordType === 'SALES') {
//           row.getCell(4).value = data.invoiceDate;
//           row.getCell(7).value = data.invoiceNo;
//           row.getCell(26).value = data.invoiceAmount;
//         } else if (recordType === 'SALES RETURN') {
//           row.getCell(4).value = data.sellReturnDate;
//           row.getCell(7).value = data.sellReturnNo;
//           row.getCell(26).value = data.sellReturnAmount;
//         }
      
//         row.getCell(1).value = { formula: `TEXT(D${rNum},"mmmm")` };
//         row.getCell(2).value = { formula: `CONCATENATE("Q"&ROUNDUP(MONTH(D${rNum})/3,0))` };
//         row.getCell(3).value = { formula: `=YEAR(D${rNum})` };
//         row.getCell(5).value = { formula: `=ROUNDUP(DAY(D${rNum})/7,0)` };
//         row.getCell(6).value = recordType;

//         let total = { invoice5: 0, invoice12: 0, invoice18: 0, cgst5: 0, cgst12: 0, cgst18: 0, sgst5: 0, sgst12: 0, sgst18: 0, igst5: 0, igst12: 0, igst18: 0 };
//         total = recordItems.reduce((total, recordItem) => {
//           // console.log(recordItem);
//           // console.log(total);
//           if (recordItem.taxPercentage === 5) {
//             total.invoice5 += recordItem.amount;
//             total.cgst5 += recordItem.cgstAmount;
//             total.sgst5 += recordItem.sgstAmount;
//             total.igst5 += recordItem.igstAmount;
//           } else if (recordItem.taxPercentage === 12) {
//             total.invoice12 += recordItem.amount;
//             total.cgst12 += recordItem.cgstAmount;
//             total.sgst12 += recordItem.sgstAmount;
//             total.igst12 += recordItem.igstAmount;
//           } else if (recordItem.taxPercentage === 18) {
//             total.invoice18 += recordItem.amount;
//             total.cgst18 += recordItem.cgstAmount;
//             total.sgst18 += recordItem.sgstAmount;
//             total.igst18 += recordItem.igstAmount;
//           }
//           return total;
//         }, total);

//         // console.log(total);

//         row.getCell(8).value = total.invoice5;
//         row.getCell(9).value = total.invoice12;
//         row.getCell(10).value = total.invoice18;
//         row.getCell(11).value = {formula: `=(H${rNum}+I${rNum}+J${rNum})`};
//         row.getCell(12).value = total.cgst5;
//         row.getCell(13).value = total.cgst12;
//         row.getCell(14).value = total.cgst18;
//         row.getCell(15).value = {formula: `=(L${rNum}+M${rNum}+N${rNum})`};
//         row.getCell(16).value = total.sgst5;
//         row.getCell(17).value = total.sgst12;
//         row.getCell(18).value = total.sgst18;
//         row.getCell(19).value = {formula: `=(P${rNum}+Q${rNum}+R${rNum})`};
//         row.getCell(20).value = total.igst5;
//         row.getCell(21).value = total.igst12;
//         row.getCell(22).value = total.igst18;
//         row.getCell(23).value = {formula: `=(T${rNum}+U${rNum}+V${rNum})`};
//         row.getCell(24).value = {formula: `=(O${rNum}+S${rNum}+W${rNum})`};
//         row.getCell(25).value = {formula: `=ROUND(Z${rNum}-(+K${rNum}+O${rNum}+S${rNum}+W${rNum}),2)`};

//         row.getCell(27).value = data.depot.depotName;

//         let distributorName = '';
//         let distributorStateCode = '';
//         let distributorState = '';
//         let distributorGstNo = '';
//         let distributorCity = '';
//         if (data.distributor) {
//           // if (data.distributor.class === 'Direct') {
//           //   if (data.gstNo) {
//           //     distributorName = data.name;
//           //     distributorStateCode = data.state.stateCode;
//           //     distributorState = data.state.stateName;
//           //     distributorGstNo = data.gstNo;
//           //     distributorCity = data.city;
//           //   } else {
//           //     if (data.depot.state.stateCode === data.distributor.state.stateCode) {
//           //       distributorName = data.distributor.prefix + ' Direct-Local';
//           //     } else {
//           //       distributorName = data.distributor.prefix + ' OOS-' + data.distributor.state.stateCode + '_' + data.distributor.state.stateName;
//           //     }
//           //     distributorStateCode = data.distributor.state.stateCode;
//           //     distributorState = data.distributor.state.stateName;
//           //     distributorGstNo = data.distributor.gstNo;
//           //     distributorCity = data.distributor.city;
//           //   }
//           // } else {
//           //   distributorName = data.distributor.distributorName;

//           //   if (data.shippingSameAsBilling && data.consignee) {
//           //     distributorStateCode = data.consignee.state.stateCode;
//           //     distributorState = data.consignee.state.stateName;
//           //     distributorGstNo = data.consignee.gstNo;
//           //     distributorCity = data.consignee.city;
//           //   } else {
//           //     distributorStateCode = data.distributor.state.stateCode;
//           //     distributorState = data.distributor.state.stateName;
//           //     distributorGstNo = data.distributor.gstNo;
//           //     distributorCity = data.distributor.city;
//           //   }
//           // }

//           distributorName = data.distributor.distributorName;
//           sellState = data.distributor.state;
//           distributorGstNo = data.distributor.gstNo;
//           distributorCity = data.distributor.city;

//           if (recordType === 'SALES')  {
//             sellState = data.sellState;

//             if (data.distributor.class === 'Direct') {
//               if (data.depot.state.stateCode === sellState.stateCode) {
//                 distributorName = data.distributor.prefix + ' Direct-Local';
//               } else {
//                 distributorName = data.distributor.prefix + ' OOS-' + sellState.stateCode + '_' + sellState.stateName;
//               }
//               if (data.gstNo) {
//                 distributorGstNo = data.gstNo;

//                 if (data.name) {
//                   distributorName = data.name;
//                 }
//               }

//               if (data.city) {
//                 distributorCity = data.city;
//               }
//             } else if (!data.shippingSameAsBilling && data.consignee) {
//               distributorGstNo = data.consignee.gstNo;
//               distributorCity = data.consignee.city;
//             }
//           } else if (recordType === 'SALES RETURN') {
//             sellState = data.sellReturnState;

//             if (data.distributor.class === 'Direct') {
//               if (data.depot.state.stateCode === sellState.stateCode) {
//                 distributorName = data.distributor.prefix + ' Direct-Local';
//               } else {
//                 distributorName = data.distributor.prefix + ' OOS-' + sellState.stateCode + '_' + sellState.stateName;
//               }

//               if (data.sell) {
//                 if (data.sell.gstNo) {
//                   distributorGstNo = data.sell.gstNo;

//                   if (data.sell.name) {
//                     distributorName = data.sell.name;
//                     distributorCity = data.sell.city;
//                   }
//                 }

//                 if (data.sell.city) {
//                   distributorCity = data.sell.city;
//                 }
//               }
//             } else {
//               if (data.sell) {
//                 if (!data.sell.shippingSameAsBilling && data.sell.consignee) {
//                   distributorGstNo = data.sell.consignee.gstNo;
//                   distributorCity = data.sell.consignee.city;
//                 }
//               }
//             }
//           }

//           distributorStateCode = sellState.stateCode;
//           distributorState = sellState.stateName;
//         }
        
//         row.getCell(28).value = distributorName;
//         row.getCell(29).value = distributorStateCode;
//         row.getCell(30).value = distributorState;
//         row.getCell(31).value = distributorGstNo;
//         row.getCell(32).value = distributorCity;
        
//         row.getCell(33).value = data.dueDate;
//         row.getCell(34).value = (data.orderNo) ? data.orderNo : '';
//         row.getCell(35).value = (data.orderDate) ? data.orderDate : '';
//         row.getCell(36).value = data.remarks;
//         row.getCell(37).value = data._id.toString();
//         row.getCell(38).value = data.status;
//         row.getCell(39).value = (data.mobileNo) ? data.mobileNo : '';
//         row.getCell(40).value = data.depot.state.stateName + ' - ' + distributorState;

//         for (let cNum = 1; cNum <= 40; cNum++) {
//           row.getCell(cNum).border = {
//             top: {style:'thin'},
//             left: {style:'thin'},
//             bottom: {style:'thin'},
//             right: {style:'thin'}
//           };
//         }

//         rNum++;
//       }
      
//       worksheet.getCell('A1').font = { bold: true };

//       const fileName = `Sale_invoice_report_${Date.now()}.xlsx`;
//       const filePath = getReportPath() + fileName;
//       await workbook.xlsx.writeFile(filePath);

//       const fileKey = `reports/${fileName}`;

//       // const fileUrl = '';
//       const fileUrl = await uploadFileToS3Bucket(filePath, fileKey);

//       // console.log(fileUrl);

//       return fileUrl;
//     } else {
//       return 'No Records Found';
//     }
//   } catch (error) {
//     console.log(error);
//     return error;
//   }
// }

// reportSchema.statics.getSellSummaryReport = async function(req) {
//   try {
//     let fromDate = (req.body.fromDate) ? new Date(req.body.fromDate) : new Date('2023-04-01 00:00:00');
//     let toDate = (req.body.toDate) ? new Date(req.body.toDate) : new Date();
    
//     const sells = await Sell.find({ status: 'Approved', isDepotTransfer: false, invoiceDate: {
//                                     $gte: fromDate, 
//                                     $lte: toDate
//                                   }}).populate([
//                                     { path: 'depot', select: { depotName: 1, state: 1 } }, 
//                                     { path: 'distributor', select: { distributorName: 1, prefix: 1, class: 1, state: 1, city: 1 }}, 
//                                     { path: 'sellItems', populate: { path: 'productId', model: Product, select: { productName: 1, shortName: 1, category: 1, hsnCode: 1 } }
//                                   }]).lean();
    
//     if (sells && sells.length > 0) {
//       const template = getTemplatePath() + 'Sale_invoice_report_format.xlsx';

//       if (!fs.existsSync(template)) {
//         return 'Template not found.';
//       }

//       const workbook = new ExcelJS.Workbook();
//       await workbook.xlsx.readFile(template);
//       const worksheet = workbook.getWorksheet(1);

//       // worksheet.getCell('A1').value = 'WYN Wellness Pvt Ltd';
//       // worksheet.getCell('A2').value = 'Sale Summary Report';
//       worksheet.getCell('A3').value = fromDate.toLocaleDateString() + ' to ' + toDate.toLocaleDateString();
//       worksheet.getCell('B4').value = 'Sales';

//       const finalSummary = [];

//       for (const data of sells) {
//         // console.log(data);
        
//         let distributorName = '';
//         let distributorStateCode = '';
//         let distributorState = '';
//         let distributorGstNo = '';
//         let distributorCity = '';
//         let distributorMobileNo = '';
//         if (data.distributor) {
//           // if (data.distributor.class === 'Direct') {
//           //   if (data.gstNo) {
//           //     distributorName = data.name;
//           //     distributorStateCode = data.state.stateCode;
//           //     distributorState = data.state.stateName;
//           //     distributorGstNo = data.gstNo;
//           //     distributorCity = data.city;
//           //     distributorMobileNo = data.mobileNo;
//           //   } else {
//           //     if (data.depot.state.stateCode === data.distributor.state.stateCode) {
//           //       distributorName = data.distributor.prefix + ' Direct-Local';
//           //     } else {
//           //       distributorName = data.distributor.prefix + ' OOS-' + data.distributor.state.stateCode + data.distributor.state.stateName;
//           //     }
//           //     distributorStateCode = data.distributor.state.stateCode;
//           //     distributorState = data.distributor.state.stateName;
//           //     distributorGstNo = data.distributor.gstNo;
//           //     distributorCity = data.distributor.city;
//           //     distributorMobileNo = data.distributor.mobileNo;
//           //   }
//           // } else {
//           //   distributorName = data.distributor.distributorName;

//           //   if (data.shippingSameAsBilling && data.consignee) {
//           //     distributorStateCode = data.consignee.state.stateCode;
//           //     distributorState = data.consignee.state.stateName;
//           //     distributorGstNo = data.consignee.gstNo;
//           //     distributorCity = data.consignee.city;
//           //   } else {
//           //     distributorStateCode = data.distributor.state.stateCode;
//           //     distributorState = data.distributor.state.stateName;
//           //     distributorGstNo = data.distributor.gstNo;
//           //     distributorCity = data.distributor.city;
//           //   }

//           //   distributorMobileNo = data.distributor.mobileNo;
//           // }

//           distributorName = data.distributor.distributorName;
//           sellState = data.distributor.state;
//           distributorGstNo = data.distributor.gstNo;
//           distributorCity = data.distributor.city;
//           distributorMobileNo = data.distributor.mobileNo;

//           sellState = data.sellState;

//           if (data.distributor.class === 'Direct') {
//             if (data.depot.state.stateCode === sellState.stateCode) {
//               distributorName = data.distributor.prefix + ' Direct-Local';
//             } else {
//               distributorName = data.distributor.prefix + ' OOS-' + sellState.stateCode + '_' + sellState.stateName;
//             }
//             if (data.gstNo) {
//               distributorGstNo = data.gstNo;

//               if (data.name) {
//                 distributorName = data.name;
//               }
//             }

//             if (data.city) {
//               distributorCity = data.city;
//             }
//             if (data.mobileNo) {
//               distributorMobileNo = data.mobileNo;
//             }
//           } else if (!data.shippingSameAsBilling && data.consignee) {
//             distributorGstNo = data.consignee.gstNo;
//             distributorCity = data.consignee.city;
//           }
          
//           distributorStateCode = sellState.stateCode;
//           distributorState = sellState.stateName;
//         }

//         const gstState = data.depot.state.stateName + ' - ' + distributorState;

//         let total = { 
//           invoice5: 0, 
//           invoice12: 0, 
//           invoice18: 0, 
//           cgst5: 0, 
//           cgst12: 0, 
//           cgst18: 0, 
//           sgst5: 0, 
//           sgst12: 0, 
//           sgst18: 0, 
//           igst5: 0, 
//           igst12: 0, 
//           igst18: 0, 
//           invoiceAmount: 0
//         };

//         total = data.sellItems.reduce((total, recordItem) => {
//           if (recordItem.taxPercentage === 5) {
//             total.invoice5 += recordItem.amount;
//             total.cgst5 += recordItem.cgstAmount;
//             total.sgst5 += recordItem.sgstAmount;
//             total.igst5 += recordItem.igstAmount;
//           } else if (recordItem.taxPercentage === 12) {
//             total.invoice12 += recordItem.amount;
//             total.cgst12 += recordItem.cgstAmount;
//             total.sgst12 += recordItem.sgstAmount;
//             total.igst12 += recordItem.igstAmount;
//           } else if (recordItem.taxPercentage === 18) {
//             total.invoice18 += recordItem.amount;
//             total.cgst18 += recordItem.cgstAmount;
//             total.sgst18 += recordItem.sgstAmount;
//             total.igst18 += recordItem.igstAmount;
//           }
//           return total;
//         }, total);

//         const index = finalSummary.findIndex(summary => {
//           return (
//             summary.distributorName === distributorName && 
//             summary.gstState === gstState && 
//             summary.distributorGstNo === distributorGstNo
//           );
//         });
//         if (index !== -1) {
//           const summary = finalSummary[index];
          
//           summary.invoiceDate = '';
//           summary.invoiceNo = '';
//           summary.invoiceAmount += data.invoiceAmount;
//           summary.invoice5 += total.invoice5;
//           summary.invoice12 += total.invoice12;
//           summary.invoice18 += total.invoice18;
//           summary.cgst5 += total.cgst5;
//           summary.cgst12 += total.cgst12;
//           summary.cgst18 += total.cgst18;
//           summary.sgst5 += total.sgst5;
//           summary.sgst12 += total.sgst12;
//           summary.sgst18 += total.sgst18;
//           summary.igst5 += total.igst5;
//           summary.igst12 += total.igst12;
//           summary.igst18 += total.igst18;
//           summary.depotName = '';
//           summary.distributorName = distributorName;
//           summary.distributorStateCode = distributorStateCode;
//           summary.distributorState = distributorState;
//           summary.distributorGstNo = distributorGstNo;
//           summary.distributorCity = distributorCity;
//           summary.dueDate = '';
//           summary.orderNo = '';
//           summary.orderDate = '';
//           summary.remarks = '';
//           summary.id = '';
//           summary.status = '';
//           summary.mobileNo = distributorMobileNo;
//           summary.gstState = gstState;
//         } else {
//           const sell = {
//             invoiceDate: data.invoiceDate,
//             invoiceNo: data.invoiceNo,
//             invoiceAmount: data.invoiceAmount,
//             invoice5: total.invoice5,
//             invoice12: total.invoice12,
//             invoice18: total.invoice18,
//             cgst5: total.cgst5,
//             cgst12: total.cgst12,
//             cgst18: total.cgst18,
//             sgst5: total.sgst5,
//             sgst12: total.sgst12,
//             sgst18: total.sgst18,
//             igst5: total.igst5,
//             igst12: total.igst12,
//             igst18: total.igst18,
//             depotName: data.depot.depotName,
//             distributorName: distributorName,
//             distributorStateCode: distributorStateCode,
//             distributorState: distributorState,
//             distributorGstNo: distributorGstNo,
//             distributorCity: distributorCity,
//             dueDate: data.dueDate,
//             orderNo: data.orderNo,
//             orderDate: data.orderDate,
//             remarks: data.remarks,
//             id: data._id.toString(),
//             status: data.status,
//             mobileNo: distributorMobileNo,
//             gstState: gstState
//           };

//           finalSummary.push(sell);
//         }
//       }

//       let rNum = 7;
//       for (const data of finalSummary) {
//         const row = worksheet.getRow(rNum);

//         row.getCell(4).value = data.invoiceDate;
//         row.getCell(7).value = data.invoiceNo;
//         row.getCell(26).value = data.invoiceAmount;
        
//         if (data.invoiceDate) {
//           row.getCell(1).value = { formula: `TEXT(D${rNum},"mmmm")` };
//           row.getCell(2).value = { formula: `CONCATENATE("Q"&ROUNDUP(MONTH(D${rNum})/3,0))` };
//           row.getCell(3).value = { formula: `=YEAR(D${rNum})` };
//           row.getCell(5).value = { formula: `=ROUNDUP(DAY(D${rNum})/7,0)` };
//         }
        
//         row.getCell(6).value = 'SALES';

//         row.getCell(8).value = data.invoice5;
//         row.getCell(9).value = data.invoice12;
//         row.getCell(10).value = data.invoice18;
//         row.getCell(11).value = {formula: `=(H${rNum}+I${rNum}+J${rNum})`};
//         row.getCell(12).value = data.cgst5;
//         row.getCell(13).value = data.cgst12;
//         row.getCell(14).value = data.cgst18;
//         row.getCell(15).value = {formula: `=(L${rNum}+M${rNum}+N${rNum})`};
//         row.getCell(16).value = data.sgst5;
//         row.getCell(17).value = data.sgst12;
//         row.getCell(18).value = data.sgst18;
//         row.getCell(19).value = {formula: `=(P${rNum}+Q${rNum}+R${rNum})`};
//         row.getCell(20).value = data.igst5;
//         row.getCell(21).value = data.igst12;
//         row.getCell(22).value = data.igst18;
//         row.getCell(23).value = {formula: `=(T${rNum}+U${rNum}+V${rNum})`};
//         row.getCell(24).value = {formula: `=(O${rNum}+S${rNum}+W${rNum})`};
//         row.getCell(25).value = {formula: `=ROUND(Z${rNum}-(+K${rNum}+O${rNum}+S${rNum}+W${rNum}),2)`};

//         row.getCell(27).value = data.depotName;

//         row.getCell(28).value = data.distributorName;
//         row.getCell(29).value = data.distributorStateCode;
//         row.getCell(30).value = data.distributorState;
//         row.getCell(31).value = data.distributorGstNo;
//         row.getCell(32).value = data.distributorCity;
        
//         row.getCell(33).value = data.dueDate;
//         row.getCell(34).value = (data.orderNo) ? data.orderNo : '';
//         row.getCell(35).value = (data.orderDate) ? data.orderDate : '';
//         row.getCell(36).value = data.remarks;
//         row.getCell(37).value = data.id;
//         row.getCell(38).value = data.status;
//         row.getCell(39).value = (data.mobileNo) ? data.mobileNo : '';
//         row.getCell(40).value = data.gstState;

//         for (let cNum = 1; cNum <= 40; cNum++) {
//           row.getCell(cNum).border = {
//             top: {style:'thin'},
//             left: {style:'thin'},
//             bottom: {style:'thin'},
//             right: {style:'thin'}
//           };
//         }

//         rNum++;
//       }
      
//       worksheet.getCell('A1').font = { bold: true };

//       const fileName = `Sale_Summary_report_${Date.now()}.xlsx`;
//       const filePath = getReportPath() + fileName;
//       await workbook.xlsx.writeFile(filePath);

//       let fileKey = `reports/${fileName}`;

//       if (req.body.freeze) {
//         fileKey = `reports/salesSummary/${fileName}`;
//       }

//       // const fileUrl = '';
//       const fileUrl = await uploadFileToS3Bucket(filePath, fileKey);

//       // console.log(fileUrl);

//       return { fileUrl, fileName };
//     } else {
//       return { message: 'No Records Found' };
//     }
//   } catch (error) {
//     console.log(error);
//     return error;
//   }
// }

export default Report;