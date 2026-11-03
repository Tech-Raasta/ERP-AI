import { Op } from 'sequelize';
import sequelize from '../lib/database.js';
import Depot from '../models/depot.js';
import DepotTransfer from '../models/depotTransfer.js';
import DepotTransferItem from '../models/depotTransferItem.js';
import DepotTransferUpload from '../models/depotTransferUpload.js';
import DepotTransferUploadFiles from '../models/depotTransferUploadFiles.js';



// Downloadable template
export const getDepotTransferUploadFormat = async (req, res, next) => {
  try {
    const result = await DepotTransferUploadFiles.prototype.getUploadFormat(req);

    if (result instanceof Error) {
      throw result;
    }

    return res.status(200).json({ fileName: result });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Getting upload format failed!";
    next(error, req, res);
  }
};

// Upload filled excel file
export const createDepotTransferUpload = async (req, res, next) => {
  try {
    if (!req.files) {
      return res.status(422).json({ message: "Please upload an Excel file." });
    }

    // console.log(req.file);

    const depotTransferUpload = new DepotTransferUploadFiles({
      status: 'Uploading',
      created_by: req.userData.userId,
      modified_by: req.userData.userId
    });

    depotTransferUpload.getRequestData(req);

    // console.log(depotTransferUpload);

    const error = await depotTransferUpload.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }
    
    await depotTransferUpload.save();

    await depotTransferUpload.uploadFileData(req);

    await depotTransferUpload.save();

    res.status(201).json({
      message: "Depot Transfer Upload added successfully",
      depotTransferUpload: depotTransferUpload
    });

  } catch (error) {
    res.statusCode = 500;
    res.message = "Creating a Depot Transfer Upload failed!";
    next(error, req, res);
  }
};

// Approve depot transfer upload
export const approveDepotTransferUpload = async (req, res, next) => {
  let t;
  t = await sequelize.transaction();
  try {
    let depotTransfer = await DepotTransferUploadFiles.findByPk(req.params.id);

    if (!depotTransfer) {
      return res.status(404).json({
        message: "Depot Transfer Upload not found!"
      });
    }

    if(depotTransfer.status.trim().toUpperCase() === 'APPROVED'){
      return res.status(404).json({
        message: "Depot Transfer Upload Already Approved"
      });
    }

    if(depotTransfer.status.trim().toUpperCase() === 'REJECTED'){
      return res.status(404).json({
        message: "Cannot Reject Approved Depot Transfer Upload"
      });
    }

    const depotTransferUpload = await DepotTransferUpload.findAll({
      where:{file_id:depotTransfer.id},
      include:[{model: Depot, as: 'depot_in', attributes: ['id','depot_name']}, {model: Depot, as: 'depot_out', attributes: ["id",'depot_name']},'depotTransferUploadItem',]
    })

    for(const item of depotTransferUpload){
      let dtData = {
        file_id:item.file_id,
        date_of_transfer:item.date_of_processing,
        depot_in_id:item.depot_in_id,
        depot_out_id:item.depot_out_id,
        status:'Approved',
        created_by:item.created_by,
        created_on:item.created_at,
        modified_by:item.modified_by,
        modified_on:item.modified_at,
        approved_by:req.userData.userId,
        approved_on: new Date().toISOString(),
        depot_in_name:item.depot_in ? item.depot_in.depot_name : "",
        depot_out_name:item.depot_out ? item.depot_out.depot_name:"",
        item_names: item.depotTransferUploadItem ? item.depotTransferUploadItem.map(data=>data.box_name).join(","): "",
        remarks: item.depotTransferUploadItem ? item.depotTransferUploadItem.map(data=>data.remarks).join(","): "",
      }

      const finalDepotTransfer = new DepotTransfer({...dtData});
      await finalDepotTransfer.save({transaction:t});

      for(let dtitem of item.depotTransferUploadItem){
        let dtiData = {
          depot_transfer_id:finalDepotTransfer.id,
          type:dtitem.type,
          item_id:dtitem.box_id,
          item_name:dtitem.box_name,
          qty:dtitem.qty,
          batch_no:dtitem.batch_no,
        }
        const finalDepotTransferItem = new DepotTransferItem({...dtiData});
        await finalDepotTransferItem.save({transaction:t});
      }

      item.status = 'Approved';
      item.approved_by=req.userData.userId,
      item.approved_at= new Date().toISOString(),
      await item.save({transaction:t})

    }
    
    depotTransfer.status = "Approved";
    depotTransfer.approved_by = req.userData.userId;
    depotTransfer.approved_at = new Date().toISOString();

    await depotTransfer.save({ transaction:t });

    await t.commit();

    res.status(200).json({ message: "Approve successful!" });
    
  } catch (error) {
    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Approving Depot Transfer Upload failed!";
    next(error, req, res);
  }

}

// Reject depot transfer upload
export const rejectDepotTransferUpload = async (req, res, next) => {
  let t;
  t = await sequelize.transaction();
  try {
    let depotTransfer = await DepotTransferUploadFiles.findByPk(req.params.id);

    if (!depotTransfer) {
      return res.status(404).json({
        message: "Depot Transfer Upload not found!"
      });
    }

    if(depotTransfer.status.trim().toUpperCase() === 'APPROVED'){
      return res.status(404).json({
        message: "Cannot Approve Rejected Depot Transfer Upload"
      });
    }

    if(depotTransfer.status.trim().toUpperCase() === 'REJECTED'){
      return res.status(404).json({
        message: "Depot Transfer Upload Already Rejected"
      });
    }

    const depotTransferUpload = await DepotTransferUpload.findAll({
      where:{file_id:depotTransfer.id},
      include:[{model: Depot, as: 'depot_in', attributes: ['id','depot_name']}, {model: Depot, as: 'depot_out', attributes: ["id",'depot_name']},'depotTransferUploadItem',]
    })

    for(const item of depotTransferUpload){
      let dtData = {
        file_id:item.file_id,
        date_of_transfer:item.date_of_processing,
        depot_in_id:item.depot_in_id,
        depot_out_id:item.depot_out_id,
        status:'Rejected',
        created_by:item.created_by,
        created_on:item.created_at,
        modified_by:item.modified_by,
        modified_on:item.modified_at,
        approved_by:req.userData.userId,
        approved_on: new Date().toISOString(),
        depot_in_name:item.depot_in ? item.depot_in.depot_name : "",
        depot_out_name:item.depot_out ? item.depot_out.depot_name:"",
        item_names: item.depotTransferUploadItem ? item.depotTransferUploadItem.map(data=>data.box_name).join(","): "",
        remarks: item.depotTransferUploadItem ? item.depotTransferUploadItem.map(data=>data.remarks).join(","): "",
      }

      const finalDepotTransfer = new DepotTransfer({...dtData});
      await finalDepotTransfer.save({transaction:t});

      for(let dtitem of item.depotTransferUploadItem){
        let dtiData = {
          depot_transfer_id:finalDepotTransfer.id,
          type:dtitem.type,
          item_id:dtitem.box_id,
          item_name:dtitem.box_name,
          qty:dtitem.qty,
          batch_no:dtitem.batch_no,
        }
        const finalDepotTransferItem = new DepotTransferItem({...dtiData});
        await finalDepotTransferItem.save({transaction:t});
      }

      item.status = 'Rejected';
      item.approved_by=req.userData.userId,
      item.approved_at= new Date().toISOString(),
      await item.save({transaction:t})

    }
    
    depotTransfer.status = "Rejected";
    depotTransfer.approved_by = req.userData.userId;
    depotTransfer.approved_at = new Date().toISOString();

    await depotTransfer.save({ transaction:t });

    await t.commit();

    res.status(200).json({ message: "Reject successful!" });
    
  } catch (error) {
    if (t && t.finished != 'commit') {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Approving Depot Transfer Upload failed!";
    next(error, req, res);
  }

}

// Get All depot transfer upload
export const getDepotTransferUploads = async (req, res, next) => {
  try {
    let pageSize = 10;
    let pageIndex = 0;
    let query = '';
    let sort = { key: 'modified_at', order: 'desc' };

    if (req.query) {
      if (req.query.pageSize && req.query.pageSize.toString().trim().toUpperCase() === 'ALL') {
        pageSize = 'ALL';
      } else {
        pageSize = req.query.pageSize ? +req.query.pageSize : 10;
      }
      pageIndex = req.query.pageIndex ? +req.query.pageIndex : 0;
      query = req.query.query ? req.query.query : '';
      sort = { key: (req.query.key ? req.query.key : 'modified_at'), order: (req.query.order ? req.query.order : 'desc') };
    }

    let condition = {};
    let searchCondition = {};

    if (query) {
      searchCondition = {
        [Op.or]: [
          {'$upload_date$': { [Op.like]: `%${query}%` }}, 
          {'$file_name$': { [Op.like]: `%${query}%` }}, 
          {'$remarks$': { [Op.like]: `%${query}%` }}
        ]
      };

      condition['where'] = searchCondition;
    }

    if (query) {
      condition['where'] = {
        [Op.and]: [
          searchCondition
        ]
      };
    }

    let order = [['modified_at', 'DESC']];
    if (sort) {
      if (sort.key) {
        order = [[sort.key, (sort.order ? sort.order : 'ASC')]];
      }
    }
    condition['order'] = order;

    if (pageSize.toString().trim().toUpperCase() === 'ALL') {
      //Do Nothing
    } else {
      if (pageIndex) {
        condition['offset'] = (pageIndex * pageSize);
      }
      
      if (pageSize) {
        condition['limit'] = pageSize;
      }
    }

    const { count, rows } = await DepotTransferUploadFiles.findAndCountAll(condition);

    res.status(200).json({
      message: "Depot Transfers Uploads fetched successfully!",
      total: count,
      rows: rows
    });
  } catch (error) {
    
    res.statusCode = 500;
    res.message = "Fetching Depot Transfers Uploads failed!";
    next(error, req, res);
  }
};