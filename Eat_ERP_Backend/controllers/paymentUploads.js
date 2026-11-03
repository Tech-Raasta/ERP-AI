import { Op, Sequelize, where } from 'sequelize';
import PaymentUpload from '../models/paymentUpload.js';
import PaymentUploadDetail from '../models/paymentUploadDetail.js';
import PaymentUploadItem from '../models/paymentUploadItem.js';
import Distributor from '../models/distributor.js';

// GET /api/payment_upload/getPaymentUploadFormat
// New Payment Upload (marketplace settlements) and Old Payment Upload (the PHP formats, controllers/oldPaymentUploads.js)
// share payment_upload_files. Files of this upload have no upload_type and are not on the old PHP server's path.
export const NEW_UPLOAD_FILES = `(ifnull(upload_type, '') = '' and ifnull(file_path, '') not like '%/eat_erp/%')`;

export const getPaymentUploadFormat = async (req, res, next) => {
  try {
    const fileName = await PaymentUpload.prototype.getUploadFormat();
    if (fileName instanceof Error) throw fileName;
    return res.status(200).json({ fileName });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Payment Upload Format failed!";
    next(error, req, res);
  }
};

// POST /api/payment_upload   (multipart with doc_document file, body.upload_type)
export const createPaymentUpload = async (req, res, next) => {
  try {
    if (!req.files || !req.files.doc_document) {
      return res.status(422).json({ message: "Please upload an Excel file." });
    }

    const paymentUpload = new PaymentUpload({
      status: 'Uploading',
      created_by: req.userData.userId,
      modified_by: req.userData.userId
    });
    paymentUpload.getRequestData(req);

    const error = await paymentUpload.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error
      });
    }

    // ── Step 1: Save file info to DB BEFORE processing ──────────────────
    await paymentUpload.saveFileInfo(req);   // <-- saves file_name, file_path, status='Queued'
    await paymentUpload.save();              // <-- now has ID + file_name visible in list

    // ── Step 2: Fire background processing ──────────────────────────────
    paymentUpload.uploadFileData(req).then(() => paymentUpload.save()).catch(async (err) => {
      paymentUpload.status  = 'Failed';
      paymentUpload.remarks = err.message;
      await paymentUpload.save();
      console.error('Background upload failed:', err);
    });;

    // ── Step 3: Respond immediately with file_name already set ──────────
    res.status(201).json({
      message: "Payment Upload added successfully",
      upload_id:  paymentUpload.id,
      file_name:  paymentUpload.file_name,   // <-- visible immediately
      status:     'Queued'
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Creating a Payment Upload failed!";
    next(error, req, res);
  }
};

// POST /api/payment_upload/summary
// {
//     "from_date": "2026-05-23",
//     "to_date": "2026-05-07",
//     "distributor_name": "All"
// }   
export const createPaymentUploadSummary = async (req, res, next) => {
  try {
    
    const {from_date, to_date, distributor_id } = req.body;

    const result = await PaymentUpload.generateSummary(from_date, to_date, distributor_id);

    res.status(201).json({
      message: "Payment Upload Summary Created successfully",
      fileName: result.fileName
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Creating a Payment Upload Summary failed!";
    next(error, req, res);
  }
};

// GET /api/payment_upload
export const getPaymentUploads = async (req, res, next) => {
  try {
    let status = '';
    let pageSize = 10;
    let pageIndex = 0;
    let query = '';
    let sort = { key: 'modified_on', order: 'desc' };

    if (req.query) {
      status = req.query.status || '';
      if (req.query.pageSize && req.query.pageSize.toString().trim().toUpperCase() === 'ALL') {
        pageSize = 'ALL';
      } else {
        pageSize = req.query.pageSize ? +req.query.pageSize : 10;
      }
      pageIndex = req.query.pageIndex ? +req.query.pageIndex : 0;
      query = req.query.query || '';
      sort = { key: req.query.key || 'modified_on', order: req.query.order || 'desc' };
    }

    let searchCondition = {};
    if (query) {
      searchCondition = {
        [Op.or]: [
          { file_name: { [Op.like]: `%${query}%` } },
          { error_file_name: { [Op.like]: `%${query}%` } },
          { check_file_name: { [Op.like]: `%${query}%` } },
          { upload_date: { [Op.like]: `%${query}%` } },
          { upload_type: { [Op.like]: `%${query}%` } }
        ]
      };
    }

    const statusCount = { pending: 0, approved: 0, rejected: 0, error: 0 };
    const grouped = await PaymentUpload.findAll({
      where: { [Op.and]: [Sequelize.literal(NEW_UPLOAD_FILES), ...(query ? [searchCondition] : [])] },
      attributes: [
        'status',
        [Sequelize.fn('COUNT', Sequelize.col('status')), 'count']
      ],
      group: ['status'],
      raw: true
    });
    for (const item of grouped) {
      const s = (item.status || '').trim().toUpperCase();
      if (s === 'UPLOADING' || s === 'PENDING') statusCount.pending += parseInt(item.count, 10);
      else if (s === 'APPROVED') statusCount.approved += parseInt(item.count, 10);
      else if (s === 'REJECTED') statusCount.rejected += parseInt(item.count, 10);
      else if (s === 'ERROR' || s === 'FAILED') statusCount.error += parseInt(item.count, 10);
    }

    let statusCondition = {};
    if (status) {
      if (status.trim().toUpperCase() === 'PENDING') {
        statusCondition = { status: { [Op.or]: ['Uploading', 'Pending'] } };
      } else {
        statusCondition = { status };
      }
    }

    const condition = {
      where: query
        ? { [Op.and]: [Sequelize.literal(NEW_UPLOAD_FILES), searchCondition, statusCondition] }
        : { [Op.and]: [Sequelize.literal(NEW_UPLOAD_FILES), statusCondition] },
      order: [[sort.key || 'modified_on', (sort.order || 'desc').toUpperCase()]]
    };

    if (pageSize !== 'ALL') {
      if (pageIndex) condition.offset = pageIndex * pageSize;
      if (pageSize) condition.limit = pageSize;
    }

    const { count, rows } = await PaymentUpload.findAndCountAll(condition);

    res.status(200).json({
      message: "Payment Uploads fetched successfully!",
      maxPaymentUploads: count,
      statusCount,
      paymentUploads: rows
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Payment Uploads failed!";
    next(error, req, res);
  }
};

//GET /api/payment_upload/getMasterData

export const getMasterData = async (req, res, next)=>{
  const distributor = await Distributor.findAll({where:{status:'Approved'}, attributes:['id', 'distributor_name'], order: [['id', 'DESC']]});

  if(!distributor){
    return res.status(404).json({message:"Distributor Not Found."});
  }

  return res.status(200).json({distributor});
}

// GET /api/payment_upload/:id
export const getPaymentUpload = async (req, res, next) => {
  try {
    const paymentUpload = await PaymentUpload.findByPk(req.params.id, {
      include: [{ model: PaymentUploadDetail, as: 'details', include: [{ model: PaymentUploadItem, as: 'items' }] }]
    });
    if (!paymentUpload) {
      return res.status(404).json({ message: "Payment Upload not found!" });
    }
    return res.status(200).json({ paymentUpload });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Payment Upload failed!";
    next(error, req, res);
  }
};

// PUT /api/payment_upload/approve/:id
export const approvePaymentUpload = async (req, res, next) => {
  try {
    const paymentUpload = await PaymentUpload.findByPk(req.params.id);

    if (!paymentUpload) {
      return res.status(404).json({ message: 'Payment Upload not found!' });
    }

    if ((paymentUpload.status || '').trim().toUpperCase() !== 'PENDING') {
      return res.status(422).json({
        message: `Cannot approve. Current status is '${paymentUpload.status}'.`
      });
    }

    // ── Mark Approving + respond immediately ──────────────────────────────
    paymentUpload.status = 'Approving';
    await paymentUpload.save();

    // ── Fire and forget — no await ────────────────────────────────────────
    paymentUpload.approve(req)
      .then(async (err) => {
        if (err) {
          paymentUpload.status  = 'Failed';
          paymentUpload.remarks = err.message;
        }
        await paymentUpload.save();
      })
      .catch(async (err) => {
        paymentUpload.status  = 'Failed';
        paymentUpload.remarks = err.message;
        await paymentUpload.save();
        console.error('Approve crashed:', err);
      });

    // ── Return before approve finishes ────────────────────────────────────
    return res.status(200).json({
      message: 'Approval started. Please wait while processing completes.',
      upload_id: paymentUpload.id,
      status:    'Approving'
    });

  } catch (error) {
    res.statusCode = 500;
    res.message    = 'Approving Payment Upload failed!';
    next(error, req, res);
  }
};

// PUT /api/payment_upload/reject/:id
export const rejectPaymentUpload = async (req, res, next) => {
  try {
    const paymentUpload = await PaymentUpload.findByPk(req.params.id);
    if (!paymentUpload) {
      return res.status(404).json({ message: "Payment Upload not found!" });
    }
    if ((paymentUpload.status || '').trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({
        message: "Payment Upload already approved.",
        error: { errors: { paymentUpload: { message: "Payment Upload already approved." } } }
      });
    }

    const err = await paymentUpload.reject(req);
    if (err) throw err;
    await paymentUpload.save();

    res.status(200).json({ message: "Reject successful!" });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Rejecting Payment Upload failed!";
    next(error, req, res);
  }
};

// GET /api/payment_upload/payment_slip/:id
export const generatePaymentSlip = async (req, res, next) => {
  try {
    const paymentUpload = await PaymentUpload.findByPk(req.params.id);
    if (!paymentUpload) {
      return res.status(404).json({ message: "Payment Upload not found!" });
    }
    const data = await paymentUpload.generatePaymentSlip();
    if (!data || data.length === 0) {
      return res.status(200).json({ message: "No data found.", data: [] });
    }
    return res.status(200).json({ data });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Generating Payment Slip failed!";
    next(error, req, res);
  }
};

// GET /api/payment_upload/credit_debit_note/:id
export const generateCreditDebitNote = async (req, res, next) => {
  try {
    const paymentUpload = await PaymentUpload.findByPk(req.params.id);
    if (!paymentUpload) {
      return res.status(404).json({ message: "Payment Upload not found!" });
    }
    const data = await paymentUpload.generateCreditDebitNote();
    if (!data || data.length === 0) {
      return res.status(200).json({ message: "No data found.", data: [] });
    }
    return res.status(200).json({ data });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Generating Credit/Debit Note failed!";
    next(error, req, res);
  }
};
