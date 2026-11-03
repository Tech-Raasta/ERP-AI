import fs from 'fs';
// import es from 'event-stream';
// import os from 'os';

import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';
// import { uploadFileToS3Bucket } from '../lib/s3bucket';
import { getReportPath } from '../lib/common.js';

const AmazonOrderFulfillmentCenter = sequelize.define('fc_details', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  order_id: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  order_item_id: {
    type: DataTypes.STRING,
  },
  order_item_name: {
    type: DataTypes.STRING,
  },
  fc_id: {
    type: DataTypes.STRING,
    // allowNull: false,
    // validate: {
    //   notNull: true
    // }
  },
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
}, 
{ 
  // timestamps: false,
  createdAt: 'created_on',
  updatedAt: 'modified_on',
  freezeTableName: true 
});

// AmazonOrderFulfillmentCenter.prototype.uploadFileData = async function(req) {
//   try {
//     // console.log('Upload File Data');

//     // const dest = path.join(getReportPath(), 'amazon', '136696019465.csv');

//     // const workbook = new ExcelJS.Workbook();
//     const filePath = path.join(getReportPath(), 'amazon', '136696019465.txt');
//     // const checkFile = `Check-${Date.now()}-${this._id}.xlsx`;
//     // const checkFilePath = `${getUploadPath()}/${checkFile}`;
//     // const errorFile = `Error-${Date.now()}-${this._id}'.xlsx`;
//     // const errorFilePath = `${getUploadPath()}/${errorFile}`;
//     // console.log(filePath);

//     let fileKey = '';
//     let fileUrl = '';

//     if (!fs.existsSync(filePath)) {
//         console.log('File Not Found.');
//         // this.remarks = 'File Not Found.';
//         // this.status = 'Failed';
//         return 'File not found.';
//     }

//     fs.createReadStream(path)
//     .pipe(es.split())
//     .pipe(es.mapSync(function(line) {
//             //pause the readstream
//             s.pause();
//             console.log("line:", line);
//             s.resume();
//         })
//         .on('error', function(err) {
//             console.log('Error:', err);
//         })
//         .on('end', function() {
//             console.log('Finish reading.');
//         })
//         );
    
//     // fileKey = `uploads/sells/${req.file.filename}`;
//     // fileUrl = await uploadFileToS3Bucket(filePath, fileKey);
//     // this.uploadedFile = req.file.filename;

//     // fileKey = `uploads/sells/${checkFile}`;
//     // fileUrl = await uploadFileToS3Bucket(checkFilePath, fileKey);
//     // this.checkFile = checkFile;

//     return null;
//   } catch (error) {
//     console.log(error);
//     return error;
//   }
// }

AmazonOrderFulfillmentCenter.prototype.approve = function(req) {
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

AmazonOrderFulfillmentCenter.prototype.reject = function(req) {
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

AmazonOrderFulfillmentCenter.prototype.validateData = async function() {
  try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    // let count = await Product.countDocuments({ orderFulfillmentCenterName: this.orderFulfillmentCenterName, _id: { $ne: this._id } });
    // if (count > 0) {
    //   return { errors : { orderFulfillmentCenterName: { message: `Two orderFulfillmentCenters cannot share the same orderFulfillmentCenterName (${this.orderFulfillmentCenterName})` } } }
    // }

    // if (this.asin) {
    //   count = await Product.countDocuments({ asin: this.asin, _id: { $ne: this._id } });
    //   if (count > 0) {
    //     return { errors : { orderFulfillmentCenterName: { message: `Two orderFulfillmentCenters cannot share the same asin (${this.asin})` } } }
    //   }
    // }
    
    // if (this.skuCode) {
    //   count = await Product.countDocuments({ skuCode: this.skuCode, _id: { $ne: this._id } });
    //   if (count > 0) {
    //     return { errors : { orderFulfillmentCenterName: { message: `Two orderFulfillmentCenters cannot share the same skuCode (${this.skuCode})` } } }
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

export default AmazonOrderFulfillmentCenter;
