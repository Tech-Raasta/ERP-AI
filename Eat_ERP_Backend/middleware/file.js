import fs from "fs";
import path from "path";
import multer from "multer";

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

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isValid = MIME_TYPE_MAP[file.mimetype];
    let error = new Error("Invalid mime type");
    if (isValid) {
      error = null;
    }

    // console.log(req);
    
    const __dirname = path.resolve();
    let uploadPath = path.join(__dirname, "assets", "uploads");

    // console.log(req.baseUrl.trim().toLowerCase().substring(req.baseUrl.lastIndexOf('/') + 1));

    if (req.baseUrl.lastIndexOf('/') !== -1) {
      uploadPath = path.join(__dirname, "assets", "uploads", req.baseUrl.trim().toLowerCase().substring(req.baseUrl.lastIndexOf('/') + 1));
    }
    
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(error, uploadPath);
  },
  filename: (req, file, cb) => {
    const name = file.originalname
      .toLowerCase()
      .split(" ")
      .join("-")
      .substring(0, file.originalname.lastIndexOf('.'));
    const ext = MIME_TYPE_MAP[file.mimetype];
    cb(null, name + "-" + Date.now() + "." + ext);
  }
});

// module.exports = multer({ storage: storage }).single("image");
// export default multer({ storage: storage }).any();
export default multer({ storage: storage });