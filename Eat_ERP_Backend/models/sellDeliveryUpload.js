var fs = require('fs');

const { Schema, model } = require("mongoose");
const ExcelJS = require('exceljs');

const { uploadFileToS3Bucket, deleteFileFromS3Bucket } = require('../lib/s3bucket');
const { getUploadPath, getTemplatePath, getReportPath, isValidDate } = require('../lib/common');

const Sell = require('./sell');

const sellDeliveryUploadSchema = Schema({
  sellDeliveryUploadDate: {
    type: Date,
    required: true
  },
  uploadedFile: {
    type: String,
    // required: true
  },
  errorFile: {
    type: String,
    // required: true
  },
  checkFile: {
    type: String,
    // required: true
  },
  isFreezed: {
    type: Boolean,
    default: false
  },
  remarks: {
    type: String,
    // required: true
  },
  status: {
    type: String,
    required: true
  },
  isDeleted: {
    type: Boolean
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  rejectedAt: {
    type: Date
  },
  refId: {
    type: Schema.Types.ObjectId,
    ref: 'SellDeliveryUpload'
  }
}, { timestamps: true, collation: { locale: 'en_US', strength: 1 } });

sellDeliveryUploadSchema.methods.getRequestData = function(req) {
  try {
    this.sellDeliveryUploadDate = new Date().toISOString().substring(0, 10);
    this.uploadedFile = '';
    this.checkFile = '';

    return null;
  } catch (error) {
    return error;
  }
}

sellDeliveryUploadSchema.statics.getUploadFormat = async function() {
  try {
    const template = getTemplatePath() + 'Sell_delivery_upload_format.xlsx';

    if (!fs.existsSync(template)) {
      return 'Template not found.';
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(template);
    // const worksheet1 = workbook.getWorksheet(1);
    // const worksheet2 = workbook.getWorksheet(2);

    // let row = 2;
    // const depots = await Depot.find({ status: 'Approved' }).select('depotName').sort({ depotName: 1 });
    // for (const depot of depots) {
    //   worksheet2.getCell(`A${ row++ }`).value = depot.depotName;
    // }

    // row = 2;
    // const distributors = await Distributor.find({ status: 'Approved' }).select('distributorName').sort({ distributorName: 1 });
    // for (const distributor of distributors) {
    //   worksheet2.getCell(`C${ row++ }`).value = distributor.distributorName;
    // }

    // row = 2;
    // const products = await Product.find({ status: 'Approved' }).select('productName').sort({ productName: 1 });
    // for (const product of products) {
    //   worksheet2.getCell(`E${ row++ }`).value = product.productName;
    // }

    // for (row = 5; row<=110; row++) {
    //   if (depots) {
    //     worksheet1.getCell(`B${ row }`).dataValidation = {
    //       type: 'list',
    //       allowBlank: true,
    //       formulae: ['Sheet2!$A$2:$A$' + (depots.length + 1)]
    //     };
    //   }
    //   if (distributors) {
    //     worksheet1.getCell(`C${ row }`).dataValidation = {
    //       type: 'list',
    //       allowBlank: true,
    //       formulae: ['Sheet2!$C$2:$C$' + (distributors.length + 1)]
    //     };
    //   }
    //   if (products) {
    //     worksheet1.getCell(`F${ row }`).dataValidation = {
    //       type: 'list',
    //       allowBlank: true,
    //       formulae: ['Sheet2!$E$2:$E$' + (products.length + 1)]
    //     };
    //   }

    //   worksheet1.getCell(`K${ row }`).dataValidation = {
    //     type: 'list',
    //     allowBlank: true,
    //     formulae: ['Sheet2!$G$2:$G$3']
    //   };
    // }

    // worksheet2.state = 'hidden';

    const fileName = `Sell_delivery_upload_format_${Date.now()}.xlsx`;
    const filePath = getReportPath() + fileName;
    await workbook.xlsx.writeFile(filePath);

    const fileKey = `reports/${fileName}`;
    const fileUrl = await uploadFileToS3Bucket(filePath, fileKey);

    return fileUrl;
  } catch (error) {
    return error;
  }
}

sellDeliveryUploadSchema.methods.uploadFileData = async function(req) {
  try {
    const workbook = new ExcelJS.Workbook();
    const filePath = `${getUploadPath()}/${req.file.filename}`;
    const checkFile = `Check-${Date.now()}-${this._id}.xlsx`;
    const checkFilePath = `${getUploadPath()}/${checkFile}`;

    let fileKey = '';
    let fileUrl = '';
    
    if (!fs.existsSync(filePath)) {
      this.remarks = 'File No Found.';
      this.status = 'Failed';
      return 'File not found.';
    }
      
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1);

    if (worksheet.getCell('A4').value.trim().toUpperCase() !== 'ORDER NO' || 
        worksheet.getCell('B4').value.trim().toUpperCase() !== 'INVOICE NO' || 
        worksheet.getCell('C4').value.trim().toUpperCase() !== 'DISPATCH THROUGH' ||
        worksheet.getCell('D4').value.trim().toUpperCase() !== 'DISPATCH DOC NO' ||
        worksheet.getCell('E4').value.trim().toUpperCase() !== 'DISPATCH DATE' ||
        worksheet.getCell('F4').value.trim().toUpperCase() !== 'DELIVERY DATE' ||
        worksheet.getCell('G4').value.trim().toUpperCase() !== 'DELIVERY STATUS') {
          this.remarks = 'File Format does not match.';
          this.status = 'Failed';

          fileKey = `uploads/sellDelivery/${req.file.filename}`;
          fileUrl = await uploadFileToS3Bucket(filePath, fileKey);
          this.uploadedFile = req.file.filename;
          
          return 'File Format does not match.';
    }

    worksheet.getCell('H4').value = "Status";
    worksheet.getCell('I4').value = "Error Remark";

    const errorOrderNos = [];
    let successCount = 0;
    let failCount = 0;
    const rowsCount = worksheet.rowCount;

    for (let rowNum = 5; rowNum <= rowsCount; rowNum++) {
      // console.log(rowNum);
      const error = [];
      const orderNo = worksheet.getCell(`A${rowNum}`).text.trim();
      const invoiceNo = worksheet.getCell(`B${rowNum}`).text.trim();
      const dispatchThrough = worksheet.getCell(`C${rowNum}`).text.trim();
      const dispatchDocNo = worksheet.getCell(`D${rowNum}`).text.trim();
      const dispatchDate = worksheet.getCell(`E${rowNum}`).value;
      const deliveryDate = worksheet.getCell(`F${rowNum}`).value;
      const deliveryStatus = worksheet.getCell(`G${rowNum}`).text.trim();

      if (!dispatchDate) {
        worksheet.getCell(`H${rowNum}`).value = 'Not Uploaded';
        worksheet.getCell(`I${rowNum}`).value = 'Dispatch date not found.';
        continue;
      }
      if (!isValidDate(dispatchDate)) {
        error.push('Dispatch date should be in d-m-Y format.');
      }
      if (deliveryDate && !isValidDate(deliveryDate)) {
        error.push('Delivery date should be in d-m-Y format.');
      }
      if (!orderNo && !invoiceNo) {
        error.push('PO no Or Invoice no required.');
      }

      let sell = null;
      if (invoiceNo) {
        sell = await Sell.findOne({ invoiceNo: invoiceNo });

        if (!sell) {
          error.push(`Invoice no ${invoiceNo} details not found.`);
        }
      } else if (orderNo) {
        sell = await Sell.findOne({ orderNo: orderNo });

        if (!sell) {
          error.push(`Order no ${orderNo} details not found.`);
        }
      }

      console.log(error);

      if (error.length > 0 || errorOrderNos.indexOf(orderNo) !== -1) {
        worksheet.getCell(`H${rowNum}`).value = 'Not Uploaded';
        worksheet.getCell(`I${rowNum}`).value = error.join(' ');

        failCount = failCount + 1;

        continue;
      }

      if (sell) {
        sell.deliveryStatus = deliveryStatus;
        sell.dispatchDetails = {
          dispatchThrough: dispatchThrough,
          dispatchDocNo: dispatchDocNo,
          dispatchDate: dispatchDate,
          deliveryDate: deliveryDate ? deliveryDate : null
        }

        await sell.save();
        worksheet.getCell(`H${rowNum}`).value = 'Uploaded';
        successCount = successCount + 1;
      }
    }

    // if (failCount > 0) {
    //   await workbook.xlsx.writeFile(errorFilePath);
    // }

    // if (successCount > 0) {
      await workbook.xlsx.writeFile(checkFilePath);
    // }
    
    if (successCount === 0) {
      this.status = 'Failed';
    } else {
      // this.status = 'Pending for approval';
      this.status = 'Uploaded';
    }
    
    this.remarks = `Records uploaded - ${successCount}. Records failed - ${failCount}.`;
    

    fileKey = `uploads/sellDelivery/${req.file.filename}`;
    fileUrl = await uploadFileToS3Bucket(filePath, fileKey);
    this.uploadedFile = req.file.filename;

    fileKey = `uploads/sellDelivery/${checkFile}`;
    fileUrl = await uploadFileToS3Bucket(checkFilePath, fileKey);
    this.checkFile = checkFile;

    return null;
  } catch (error) {
    console.log(error);
    return error;
  }
}

sellDeliveryUploadSchema.methods.deleteUploadedFiles = async function(req) {
  try {
    let fileKey = `uploads/sellDelivery/${this.uploadedFile}`;
    let fileUrl = await deleteFileFromS3Bucket(fileKey);
    console.log(fileUrl);

    if (this.checkFile) {
      fileKey = `uploads/sellDelivery/${this.checkFile}`;
      fileUrl = await deleteFileFromS3Bucket(fileKey);
      console.log(fileUrl);
    }

    return null;
  } catch (error) {
    console.log(error);
    return error;
  }
}

sellDeliveryUploadSchema.methods.approve = function(req) {
  try {
    if (this.isDeleted) {
      this.status = "InActive";
    } else {
      this.status = "Approved";
    }

    // this.remarks = req.body.remarks;
    this.approvedBy = req.userData.userId;
    this.approvedAt = new Date().toISOString();

    return null;
  } catch (error) {
    return error;
  }
}

sellDeliveryUploadSchema.methods.reject = function(req) {
  try {
    this.status = "Rejected";
    // this.remarks = req.body.remarks;
    this.rejectedBy = req.userData.userId;
    this.rejectedAt = new Date().toISOString();

    return null;
  } catch (error) {
    return error;
  }
}

sellDeliveryUploadSchema.methods.validateData = async function() {
  try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    // let count = await Product.countDocuments({ sellDeliveryUploadName: this.sellDeliveryUploadName, _id: { $ne: this._id } });
    // if (count > 0) {
    //   return { errors : { sellDeliveryUploadName: { message: `Two sellDeliveryUploads cannot share the same sellDeliveryUploadName (${this.sellDeliveryUploadName})` } } }
    // }

    // if (this.asin) {
    //   count = await Product.countDocuments({ asin: this.asin, _id: { $ne: this._id } });
    //   if (count > 0) {
    //     return { errors : { sellDeliveryUploadName: { message: `Two sellDeliveryUploads cannot share the same asin (${this.asin})` } } }
    //   }
    // }
    
    // if (this.skuCode) {
    //   count = await Product.countDocuments({ skuCode: this.skuCode, _id: { $ne: this._id } });
    //   if (count > 0) {
    //     return { errors : { sellDeliveryUploadName: { message: `Two sellDeliveryUploads cannot share the same skuCode (${this.skuCode})` } } }
    //   }
    // }

    // if (this.category) {
    //   count = await Category.countDocuments({ _id: this.category });
    //   if (count === 0) {
    //     return { errors : { category: { message: `Category does not exist` } } }
    //   }
    // }

    return null;
  } catch (error) {
    return error;
  }
}

module.exports = model("SellDeliveryUpload", sellDeliveryUploadSchema);
