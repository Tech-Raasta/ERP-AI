var fs = require('fs');

const { Schema, model } = require("mongoose");
const ExcelJS = require('exceljs');
// const AWS = require('aws-sdk');

const { uploadFileToS3Bucket } = require('../lib/s3bucket');
const { State } = require("./state");
// const { Country } = require("./country");
const Depot = require("./depot");
const Distributor = require("./distributor");
const Product = require("./product");
const Sell = require('./sell');
const SellUploadDetail = require('./sellUploadDetail');
const { round, getUploadPath, getTemplatePath, getReportPath, isValidDate } = require('../lib/common');

const sellUploadSchema = Schema({
  sellUploadDate: {
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
    ref: 'SellUpload'
  }
}, { timestamps: true, collation: { locale: 'en_US', strength: 1 } });

sellUploadSchema.methods.getRequestData = function(req) {
  try {
    // this.sellUploadDate = (req.body.sellUploadDate) ? req.body.sellUploadDate : '';
    this.sellUploadDate = new Date().toISOString().substring(0, 10);
    this.uploadedFile = '';
    this.checkFile = '';

    // console.log(req.file);

    // signedUrl = await signS3URL(req.file.filename, req.file.mimetype);

    return null;
  } catch (error) {
    // console.log(error);
    return error;
  }
}

sellUploadSchema.statics.getUploadFormat = async function() {
  try {
    const template = getTemplatePath() + 'Sells_upload_format.xlsx';

    if (!fs.existsSync(template)) {
      return 'Template not found.';
    }

    // console.log(template);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(template);
    const worksheet1 = workbook.getWorksheet(1);
    const worksheet2 = workbook.getWorksheet(2);

    let row = 2;
    const depots = await Depot.find({ status: 'Approved' }).select('depotName').sort({ depotName: 1 });
    for (const depot of depots) {
      worksheet2.getCell(`A${ row++ }`).value = depot.depotName;
    }

    row = 2;
    const distributors = await Distributor.find({ status: 'Approved' }).select('distributorName').sort({ distributorName: 1 });
    for (const distributor of distributors) {
      worksheet2.getCell(`C${ row++ }`).value = distributor.distributorName;
    }

    row = 2;
    const states = await State.find({ status: 'Approved' }).select('stateName').sort({ stateName: 1 });
    for (const state of states) {
      worksheet2.getCell(`E${ row++ }`).value = state.stateName;
    }

    row = 2;
    const products = await Product.find({ status: 'Approved' }).select('productName').sort({ productName: 1 });
    for (const product of products) {
      worksheet2.getCell(`G${ row++ }`).value = product.productName;
    }

    for (row = 5; row<=110; row++) {
      if (depots) {
        worksheet1.getCell(`B${ row }`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['Sheet2!$A$2:$A$' + (depots.length + 1)]
        };
      }
      if (distributors) {
        worksheet1.getCell(`C${ row }`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['Sheet2!$C$2:$C$' + (distributors.length + 1)]
        };
      }
      if (states) {
        worksheet1.getCell(`H${ row }`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['Sheet2!$E$2:$E$' + (states.length + 1)]
        };
      }
      if (products) {
        worksheet1.getCell(`K${ row }`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['Sheet2!$G$2:$G$' + (products.length + 1)]
        };
      }
    }

    worksheet2.state = 'hidden';

    // return workbook;

    

    const fileName = `Sells_upload_format_${Date.now()}.xlsx`;
    const filePath = getReportPath() + fileName;
    await workbook.xlsx.writeFile(filePath);

    const fileKey = `reports/${fileName}`;

    // await uploadFileToS3Bucket(filePath, fileKey, res, getUrl);

    const fileUrl = await uploadFileToS3Bucket(filePath, fileKey);

    // fs.readFile(filePath, async (err, data) => {
    //   if(err) {
    //     console.log(err);
    //     return err;
    //   }
    //   const result = await uploadFileToS3Bucket(data, fileKey);

    //   console.log(result);
    // });

    // const fileUrl = `https://wyn-erp-resources.s3.ap-south-1.amazonaws.com/${fileKey}`;

    // console.log(fileUrl);

    return fileUrl;
  } catch (error) {
    // console.log(error);
    return error;
  }
}

// sellUploadSchema.statics.getS3SignedUploadUrl = async () => {
//   try {
//     const key = `uploads/${Date.now()}.jpeg`;
//     // s3.getSignedUrl('putObject', {
//     //   Bucket: 'wyn-erp-resources',
//     //   ContentType: 'image/jpeg',
//     //   Expires: 5 * 60,
//     //   Key: key
//     // }, (err, url) => res.send({ key, url }));

//     // const signedUrl = await s3.getSignedUrl('putObject', {
//     //                                               Bucket: 'wyn-erp-resources',
//     //                                               ContentType: 'jpeg',
//     //                                               Expires: 5 * 60,
//     //                                               Key: key
//     //                                             });

//     signedUrl = await signS3URL(key, 'image/jpeg');
    
//     return { key, signedUrl };
//   } catch (error) {
//     return error;
//   }
// }

sellUploadSchema.methods.uploadFileData = async function(req) {
  try {
    // console.log('Upload File Data');

    const workbook = new ExcelJS.Workbook();
    const filePath = `${getUploadPath()}/${req.file.filename}`;
    const checkFile = `Check-${Date.now()}-${this._id}.xlsx`;
    const checkFilePath = `${getUploadPath()}/${checkFile}`;
    // const errorFile = `Error-${Date.now()}-${this._id}'.xlsx`;
    // const errorFilePath = `${getUploadPath()}/${errorFile}`;
    // console.log(filePath);

    let fileKey = '';
    let fileUrl = '';

    if (!fs.existsSync(filePath)) {
      // console.log('File Not Found.');
      this.remarks = 'File Not Found.';
      this.status = 'Failed';
      return 'File not found.';
    }
      
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1);

    if (worksheet.getCell('A4').value.trim().toUpperCase() !== 'SELL DATE' || 
        worksheet.getCell('B4').value.trim().toUpperCase() !== 'DEPOT' || 
        worksheet.getCell('C4').value.trim().toUpperCase() !== 'DISTRIBUTOR NAME' ||
        worksheet.getCell('D4').value.trim().toUpperCase() !== 'NAME OF CUSTOMER' ||
        worksheet.getCell('E4').value.trim().toUpperCase() !== 'ADDRESS' ||
        worksheet.getCell('F4').value.trim().toUpperCase() !== 'CITY' ||
        worksheet.getCell('G4').value.trim().toUpperCase() !== 'PINCODE' ||
        worksheet.getCell('H4').value.trim().toUpperCase() !== 'STATE' ||
        worksheet.getCell('I4').value.trim().toUpperCase() !== 'MOBILE NO' ||
        worksheet.getCell('J4').value.trim().toUpperCase() !== 'PO NO' ||
        worksheet.getCell('K4').value.trim().toUpperCase() !== 'SKU NAME' ||
        worksheet.getCell('L4').value.trim().toUpperCase() !== 'QTY' ||
        worksheet.getCell('M4').value.trim().toUpperCase() !== 'SELL RATE' ||
        worksheet.getCell('N4').value.trim().toUpperCase() !== 'DISCOUNT %' ||
        worksheet.getCell('O4').value.trim().toUpperCase() !== 'TOTAL REALISATION VALUE' ||
        worksheet.getCell('P4').value.trim().toUpperCase() !== 'TRACK ID' ||
        worksheet.getCell('Q4').value.trim().toUpperCase() !== 'REMARKS') {
          this.remarks = 'File Format does not match.';
          this.status = 'Failed';

          fileKey = `uploads/sells/${req.file.filename}`;
          fileUrl = await uploadFileToS3Bucket(filePath, fileKey);
          this.uploadedFile = req.file.filename;
          
          return 'File Format does not match.';
    }

    worksheet.getCell('V4').value = "Status";
    worksheet.getCell('W4').value = "Error Remark";

    // const rows1 = worksheet.getRow(1);
    // console.log(rows1.getCell(1).value);

    // const rowsCount1 = worksheet.lastRow;
    // console.log('Last Row - ' + rowsCount1);

    // const rows = worksheet.getColumn(1);
    // const rowsCount = rows['_worksheet']['_rows'].length;
    // console.log(rowsCount);

    // console.log(worksheet.rowCount);

    const sellUploadDetails = [];
    const errorOrderNos = [];
    let successCount = 0;
    let failCount = 0;
    const rowsCount = worksheet.rowCount;
    // console.log(rowsCount);

    for (let rowNum = 5; rowNum <= rowsCount; rowNum++) {
      // console.log(rowNum);
      const row = worksheet.getRow(rowNum);
      const error = [];
      const sellDate = row.getCell(1).value;
      const depotName = row.getCell(2).text;
      const distributorName = row.getCell(3).text;
      const name = row.getCell(4).text;
      const address = row.getCell(5).text;
      const city = row.getCell(6).text;
      const pincode = row.getCell(7).text;
      const stateName = row.getCell(8).text;
      const mobileNo = row.getCell(9).text;
      const orderNo = row.getCell(10).text;
      const productName = row.getCell(11).text;
      let quantity = row.getCell(12).text;
      let sellRate = row.getCell(13).text;
      let discount = row.getCell(14).text;
      let totalOrderValue = row.getCell(15).text;
      const uniqueRefNo = row.getCell(16).text;
      const remarks = row.getCell(17).text;

      if (!sellDate) {
        continue;
      }

      // console.log(row.getCell(2).text);

      quantity = quantity ? parseFloat(quantity) : 0;
      sellRate = sellRate ? parseFloat(sellRate) : 0;
      discount = discount ? parseFloat(discount) : 0;
      totalOrderValue = totalOrderValue ? parseFloat(totalOrderValue) : 0;


      let sellUploadDetail = null;
      let sellUploadDetailIndex = -1;
      if (orderNo) {
        sellUploadDetailIndex = sellUploadDetails.findIndex(sellUploadDetail => {
          return sellUploadDetail.orderNo.trim().toUpperCase() === orderNo.trim().toUpperCase();
        });
        
        if (sellUploadDetailIndex !== -1) {
          sellUploadDetail = sellUploadDetails[sellUploadDetailIndex];
        }
      }
      
      
      if (!isValidDate(sellDate)) {
        error.push('Sell date should be in d-m-Y format.');
      }
      // console.log(depotName);
      // console.log(depotName.result);

      let depot = null;
      let depotState = '';
      if (depotName) {
        const depotObj = await Depot.findOne({ depotName });
        if (depotObj && depotObj.state && depotObj.state.stateName) {
          depot = depotObj._id.toString();
          depotState = depotObj.state.stateName;
        }
      }
      if (!depot) {
        error.push('Depot not found.');
      }

      let distributor = null;
      let distributorState = '';
      let distributorClass = '';
      let sellState = '';
      if (distributorName) {
        const distributorObj = await Distributor.findOne({ distributorName });
        if (distributorObj && distributorObj.state && distributorObj.state.stateName) {
          distributor = distributorObj._id.toString();
          distributorState = distributorObj.state.stateName;
          distributorClass = distributorObj.class;
          sellState = distributorObj.state;
        }
      }
      if (!distributor) {
        error.push('Distributor not found.');
      } 

      if (distributorClass.trim().toUpperCase() !== 'DIRECT' && (name || address || city || pincode || stateName || mobileNo)) {
        error.push('Distributor is not direct. Customer name, address, city, pincode, state, mobileNo should be blank.')
      }

      let state = null;
      let country = null;
      if (distributorClass.trim().toUpperCase() === 'DIRECT') {
        if (!name) {
          error.push('Customer Name not found.');
        }
        if (!address) {
          error.push('Customer Address not found.');
        }
        if (!city) {
          error.push('Customer City not found.');
        }
        if (!pincode) {
          error.push('Customer Pincode not found.');
        }
        
        if (stateName) {
          state = await State.findOne({ stateName }).populate('country').select('_id stateName stateCode country');
        }
        if (!state) {
          error.push('Customer State not found.');
        } else {
          distributorState = state.stateName;
          sellState = state;
          country = state.country;
        }
      }

      let taxType = 'Intra';
      if (distributorState === depotState) {
        taxType = "Intra";
      } else {
        taxType = "Inter"
      }

      if (!orderNo) {
        error.push('Order No not found.');
      } else {
        const sellCount = await Sell.countDocuments({ orderNo: orderNo, status: { $nin: ['Rejected', 'InActive'] } });
        if (sellCount) {
          error.push('Order No already exist.');
        } else {
          const sellUploadDetailCount = await SellUploadDetail.countDocuments({ orderNo: orderNo, status: 'Pending for approval' });
          if (sellUploadDetailCount) {
            error.push('Order No already pending for approval.');
          }
        }
      }

      if (!quantity || quantity <= 0) {
        error.push('Quantity should be greater than zero.');
        quantity = 0;
      }
      if (!sellRate || sellRate <= 0) {
        // error.push('Sell Rate should be greater than zero.');
        sellRate = 0;
      }
      if (!discount || discount <= 0) {
        // error.push('Discount should be greater than zero.');
        discount = 0;
      }
      if (!totalOrderValue || totalOrderValue <= 0) {
        // error.push('Total Order Value should be greater than zero.');
        totalOrderValue = 0;
      }
      if (sellRate === 0 && discount === 0 && totalOrderValue === 0) {
        error.push('Please enter Sell Rate, Discount % Or Total Realisation Value.');
      }

      let sellItem = null;
      let totalAmount = 0;
      let costAmount = 0;
      let sellItemValue = 0;
      if (productName) {
        const product = await Product.findOne({ productName });

        if (product) {
          totalAmount = quantity * product.mrp;
          costAmount = quantity * product.costWithoutGst;

          if (!totalOrderValue) {
            if (discount) {
              sellRate = round(product.mrp - ((product.mrp * discount) / 100), 2);
              // sellRate = round((sellRate / (100 + product.taxPercentage)) * 100, 2); // will be calculated in sell
            } 

            sellItemValue = quantity * sellRate;
          }
          

          sellItem = {
            productId: product._id,
            productName: product.productName,
            description: product.description,
            hsnCode: product.hsnCode,
            hsnName: product.hsnName,
            grams: product.grams,
            quantity: quantity,
            mrp: product.mrp,
            taxPercentage: product.taxPercentage,
            sellRate: sellRate,
            totalAmount: totalAmount,
            costWithoutGst: product.costWithoutGst,
            costAmount: costAmount,
            rowNum: rowNum
          }
        } else {
          error.push('SKU not found.');
        }
      }
      
      if (uniqueRefNo) {
        const sellCount = await Sell.countDocuments({ uniqueRefNo: uniqueRefNo, status: { $nin: ['Rejected', 'InActive'] } });
        if (sellCount) {
          error.push('Track Id already exist.');
        } else {
          const sellUploadDetailCount = await SellUploadDetail.countDocuments({ uniqueRefNo: uniqueRefNo });
          if (sellUploadDetailCount) {
            error.push('Track Id already exist.');
          }

          const sellUploadDetailFound = sellUploadDetails.find(sellUploadDetailCheck => {
            return sellUploadDetailCheck.orderNo.trim().toUpperCase() !== orderNo.trim().toUpperCase() && 
                    sellUploadDetailCheck.uniqueRefNo.trim().toUpperCase() === uniqueRefNo.trim().toUpperCase();
          });

          // console.log(sellUploadDetailFound);
        
          if (sellUploadDetailFound) {
            error.push(`Track Id already assigned to Order No ${ sellUploadDetailFound.orderNo }.`);
          }
        }
      }

      console.log(error);

      if (error.length > 0 || errorOrderNos.indexOf(orderNo) !== -1) {
        worksheet.getCell(`V${rowNum}`).value = 'Not Uploaded';
        worksheet.getCell(`W${rowNum}`).value = error.join(' ');

        if (errorOrderNos.indexOf(orderNo) === -1) {
          errorOrderNos.push(orderNo);
        }

        failCount = failCount + 1;

        continue;
      }

      if (sellUploadDetail) {
        sellUploadDetail.sellItems.push(sellItem);
        sellUploadDetail.rows.push(rowNum);
        sellUploadDetail.sellAmount = sellUploadDetail.sellAmount + totalAmount;
        sellUploadDetail.totalAmount = sellUploadDetail.totalAmount + totalAmount;
        sellUploadDetail.costAmount = sellUploadDetail.costAmount + costAmount;

        if (!totalOrderValue) {
          sellUploadDetail.totalOrderValue = sellUploadDetail.totalOrderValue + sellItemValue;
        }

        sellUploadDetails[sellUploadDetailIndex] = sellUploadDetail;
      } else {
        sellUploadDetail = {
          sellDate: sellDate,
          depot: depot,
          distributor: distributor,
          orderNo: orderNo,
          sellAmount: totalAmount,
          name: name,
          address: address,
          city: city,
          pincode: pincode,
          state: state,
          country: country,
          mobileNo: mobileNo,
          discount: discount,
          uniqueRefNo: uniqueRefNo,
          sellState: sellState,
          taxType: taxType,
          sellItems: [sellItem],
          totalAmount: totalAmount,
          costAmount: costAmount,
          shippingSameAsBilling: false,
          sellUpload: this._id,
          remarks: remarks,
          totalOrderValue: (totalOrderValue) ? totalOrderValue : sellItemValue,
          rows: [rowNum]
        }

        sellUploadDetails.push(sellUploadDetail);
      }

      // console.log(sellUploadDetail);
    }

    // if (failCount > 0) {
    //   await workbook.xlsx.writeFile(errorFilePath);
    // }
    
    for (const sellUploadDetail of sellUploadDetails) {
      const rows = sellUploadDetail.rows;
      if (errorOrderNos.indexOf(sellUploadDetail.orderNo) !== -1) {
        for (let i=0; i < rows.length; i++) {
          worksheet.getCell(`V${rows[i]}`).value = 'Not Uploaded';
        }
        continue;
      }

      const discountAmount = sellUploadDetail.totalAmount - sellUploadDetail.totalOrderValue;
      sellUploadDetail.discount = round((discountAmount / sellUploadDetail.totalAmount) * 100, 2);

      const sellUploadDetailFinal = new SellUploadDetail({
        sellDate: sellUploadDetail.sellDate,
        depot: sellUploadDetail.depot,
        distributor: sellUploadDetail.distributor,
        orderNo: sellUploadDetail.orderNo,
        sellAmount: sellUploadDetail.sellAmount,
        roundOffAmount: 0,
        invoiceAmount: 0,
        name: sellUploadDetail.name,
        address: sellUploadDetail.address,
        city: sellUploadDetail.city,
        pincode: sellUploadDetail.pincode,
        state: sellUploadDetail.state,
        country: sellUploadDetail.country,
        mobileNo: sellUploadDetail.mobileNo,
        discount: sellUploadDetail.discount,
        uniqueRefNo: sellUploadDetail.uniqueRefNo,
        sellState: sellUploadDetail.sellState,
        taxType: sellUploadDetail.taxType,
        sellItems: [],
        amount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        taxAmount: 0,
        totalAmount: sellUploadDetail.totalAmount,
        costAmount: sellUploadDetail.costAmount,
        shippingCharges: 0,
        shippingSameAsBilling: sellUploadDetail.shippingSameAsBilling,
        sellUpload: sellUploadDetail.sellUpload,
        remarks: sellUploadDetail.remarks,
        status: 'Pending',
        createdBy: req.userData.userId,
        updatedBy: req.userData.userId
      });

      const sellItemsFinal = sellUploadDetail.sellItems.map(sellItem => {
        return {
          productId: sellItem.productId,
          grams: sellItem.grams,
          quantity: sellItem.quantity,
          mrp: sellItem.mrp,
          taxPercentage: sellItem.taxPercentage,
          costWithoutGst: sellItem.costWithoutGst
        };
      });

      sellUploadDetailFinal.sellItems = sellItemsFinal;

      await sellUploadDetailFinal.setSellAmountDetails();

      await sellUploadDetailFinal.save();

      for (let i=0; i < rows.length; i++) {
        worksheet.getCell(`R${rows[i]}`).value = sellUploadDetailFinal.sellItems[i].taxableAmount;
        worksheet.getCell(`S${rows[i]}`).value = sellUploadDetailFinal.sellItems[i].cgstAmount;
        worksheet.getCell(`T${rows[i]}`).value = sellUploadDetailFinal.sellItems[i].sgstAmount;
        worksheet.getCell(`U${rows[i]}`).value = sellUploadDetailFinal.sellItems[i].igstAmount;
        worksheet.getCell(`V${rows[i]}`).value = 'Uploaded';
        successCount = successCount + 1;
      }
    }

    // if (successCount > 0) {
      await workbook.xlsx.writeFile(checkFilePath);
    // }
    
    if (successCount === 0) {
      this.status = 'Failed';
    } else {
      this.status = 'Pending for approval';
    }
    
    this.remarks = `Records uploaded - ${successCount} . Records failed - ${failCount}.`;
    
    fileKey = `uploads/sells/${req.file.filename}`;
    fileUrl = await uploadFileToS3Bucket(filePath, fileKey);
    this.uploadedFile = req.file.filename;

    fileKey = `uploads/sells/${checkFile}`;
    fileUrl = await uploadFileToS3Bucket(checkFilePath, fileKey);
    this.checkFile = checkFile;

    return null;
  } catch (error) {
    console.log(error);
    return error;
  }
}

sellUploadSchema.methods.approve = function(req) {
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

sellUploadSchema.methods.reject = function(req) {
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

sellUploadSchema.methods.validateData = async function() {
  try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    // let count = await Product.countDocuments({ sellUploadName: this.sellUploadName, _id: { $ne: this._id } });
    // if (count > 0) {
    //   return { errors : { sellUploadName: { message: `Two sellUploads cannot share the same sellUploadName (${this.sellUploadName})` } } }
    // }

    // if (this.asin) {
    //   count = await Product.countDocuments({ asin: this.asin, _id: { $ne: this._id } });
    //   if (count > 0) {
    //     return { errors : { sellUploadName: { message: `Two sellUploads cannot share the same asin (${this.asin})` } } }
    //   }
    // }
    
    // if (this.skuCode) {
    //   count = await Product.countDocuments({ skuCode: this.skuCode, _id: { $ne: this._id } });
    //   if (count > 0) {
    //     return { errors : { sellUploadName: { message: `Two sellUploads cannot share the same skuCode (${this.skuCode})` } } }
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

module.exports = model("SellUpload", sellUploadSchema);
