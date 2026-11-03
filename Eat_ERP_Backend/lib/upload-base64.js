import fs from "fs";
import path from "path";
// import multer from "multer";

const MIME_TYPE_MAP = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpg",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx"
};

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
    

//     // console.log(req);
    
//     const __dirname = path.resolve();
//     let uploadPath = path.join(__dirname, "assets", "uploads");

//     // console.log(req.baseUrl.trim().toLowerCase().substring(req.baseUrl.lastIndexOf('/') + 1));

//     if (req.baseUrl.lastIndexOf('/') !== -1) {
//       uploadPath = path.join(__dirname, "assets", "uploads", req.baseUrl.trim().toLowerCase().substring(req.baseUrl.lastIndexOf('/') + 1));
//     }
    
//     if (!fs.existsSync(uploadPath)) {
//       fs.mkdirSync(uploadPath, { recursive: true });
//     }
//     cb(error, uploadPath);
//   },
//   filename: (req, file, cb) => {
//     const name = file.originalname
//       .toLowerCase()
//       .split(" ")
//       .join("-")
//       .substring(0, file.originalname.lastIndexOf('.'));
//     const ext = MIME_TYPE_MAP[file.mimetype];
//     cb(null, name + "-" + Date.now() + "." + ext);
//   }
// });

function decodeBase64Image(dataString) {
  const matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  const response = {};

  if (matches.length !== 3) {
    return new Error('Invalid input string');
  }

  response.type = matches[1];
  response.data = new Buffer(matches[2], 'base64');

  return response;
}

export default (image, req) => {
  // try {
    const decodedImg = decodeBase64Image(image);
    const imageBuffer = decodedImg.data;
    const type = decodedImg.type;
    // const ext = mime.getExtension(type);
    const ext = MIME_TYPE_MAP[type];
    let error = new Error("Invalid mime type");
    if (!ext) {
      throw error;
    }

    const __dirname = path.resolve();
    let uploadPath = path.join(__dirname, "assets", "uploads");

    // console.log(req.baseUrl.trim().toLowerCase().substring(req.baseUrl.lastIndexOf('/') + 1));

    if (req.baseUrl.lastIndexOf('/') !== -1) {
      uploadPath = path.join(__dirname, "assets", "uploads", req.baseUrl.trim().toLowerCase().substring(req.baseUrl.lastIndexOf('/') + 1));
    }
    
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    const filename = "image" + "-" + Date.now() + "." + ext;
    const filepath = path.join(uploadPath, filename);

    // try {
      fs.writeFileSync(filepath, imageBuffer, 'utf8');
      return { filepath, filename };
  //   } catch(err) {
  //     console.error(err);
  //     return err;
  //   }
  // } catch (error) {
  //   // console.log(error);
  //   res.status(400).json({ message: "File Upload Failed!" });
  // }
}