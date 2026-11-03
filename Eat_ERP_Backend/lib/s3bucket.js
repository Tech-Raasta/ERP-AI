const { readFile, unlink } = require('fs');
const config = require('config');

const { S3Client, CreateBucketCommand, DeleteObjectCommand, PutObjectCommand, DeleteBucketCommand } = require("@aws-sdk/client-s3");
// const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// import multer from "multer";
// const multerS3 = require("multer-s3");

const REGION = "ap-south-1";
// const s3 = new S3Client({ region: REGION });

exports.uploadFileToS3Bucket = async (file, fileKey) => {
  const s3BucketName = config.get('S3BUCKETNAME');

  readFile(file, async (err, data) => {
    if(err) {
      // console.log(err);
      return err;
    }

    try {
      const s3Client = new S3Client({ region: REGION });

      // console.log(s3BucketName);
  
      const res = await s3Client.send(new PutObjectCommand({
        Bucket: s3BucketName,
        Key: fileKey,
        Body: data
      }));
  
      unlink(file, function(err){
        if(err) return err;
        console.log('file deleted successfully');
      });
      
      // console.log(res);
      return res;
    } catch (error) {
      // console.log(error);
      return error;
    }
    
  });

  // return `https://wyn-erp-resources.s3.ap-south-1.amazonaws.com/${fileKey}`;
  return `http://${s3BucketName}.s3.ap-south-1.amazonaws.com/${fileKey}`;
}

exports.deleteFileFromS3Bucket = async (fileKey) => {
  try {
    const s3Client = new S3Client({ region: REGION });
  
    const res = await s3Client.send(new DeleteObjectCommand({
      Bucket: config.get('S3BUCKETNAME'),
      Key: fileKey
    }));
  
    // console.log(res);
    return res;
  } catch (error) {
    return error;
  }
}

// exports.uploadFileToS3Bucket = async (file, fileKey) => {
//   const s3Client = new S3Client({ region: REGION });

//   const res = await s3Client.send(new PutObjectCommand({
//     Bucket: config.get('S3BUCKETNAME'),
//     Key: fileKey,
//     Body: file
//   }));

//   // console.log(res);
//   return res;
// }

// const fileFilter = (req, file, cb) => {
//   if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
//     cb(null, true);
//   } else {
//     cb(new Error("Invalid file type, only JPEG and PNG is allowed!"), false);
//   }
// };

// const fileFilter = (req, file, cb) => {
//   if (
//     file.mimetype.includes("excel") ||
//     file.mimetype.includes("spreadsheetml")
//   ) {
//     cb(null, true);
//   } else {
//     // cb("Please upload only excel file.", false);
//     cb(new Error("Invalid file type, only XLSX is allowed!"), false);
//   }
// };

// const upload = multer({
//   fileFilter,
//   storage: multerS3({
//     acl: "public-read",
//     s3,
//     bucket: config.get('S3BUCKETNAME'),
//     // acl: 'public-read',
//     metadata: function (req, file, cb) {
//       cb(null, { fieldName: file.fieldname });
//     },
//     key: function (req, file, cb) {
//       cb(null, `uploads/sells/${Date.now()}-${file.originalname}`);
//     },
//   }),
// });

// module.exports = upload;

// exports.uploadFileToS3Bucket = async (filePath, fileKey, res, getUrl) => {
//   fs.readFile(filePath, async (err, data) => {
//     if(err) {
//       console.log(err);
//       getUrl(err, res);
//     }
//     // const result = await uploadFileToS3Bucket(data, fileKey);

//     // console.log(result);

//     const s3Client = new S3Client({ region: REGION });

//     const res = await s3Client.send(new PutObjectCommand({
//       Bucket: config.get('S3BUCKETNAME'),
//       Key: fileKey,
//       Body: data
//     }));
//     // console.log(res);

//     const fileUrl = `https://wyn-erp-resources.s3.ap-south-1.amazonaws.com/${fileKey}`;
//     getUrl(err, res, fileUrl);
//   });
// }

// exports.getUrl = (err, res, url) => {
//   if (err) {
//     res.status(404).json({ error: err });
//   } else {
//     res.status(404).json({ url: url });
//   }
// }

// const signS3URL = async (fileName, fileType) => {
//   // const signS3URL = async (req, res, next) => {
//   // const { fileName, fileType } = req.file;
//   // const fileName = `uploads/sells/${Date.now()}.jpeg`;
//   // const fileType = 'jpeg';

//   console.log(fileName);
//   console.log(fileType);

//   try {
//     const s3Params = {
//       Bucket: config.get('S3BUCKETNAME'),
//       Key: fileName,
//       ContentType: fileType,
//       // ACL: 'bucket-owner-full-control'
//     };
//     const s3 = new S3Client({
//       accessKeyId: config.get('S3ACCESSKEYID'),
//       secretAccessKey: config.get('S3SECRETACCESSKEY'),
//       region: REGION,
//     });
//     const command = new PutObjectCommand(s3Params);

//     const signedUrl = await getSignedUrl(s3, command, { expiresIn: 10 * 60 });
//     console.log(signedUrl);
//     // res.json({ signedUrl });
//     return signedUrl;
//   } catch (error) {
//     console.error(err);
//     // next(err);
//     return error;
//   }
// };

// module.exports = signS3URL;
