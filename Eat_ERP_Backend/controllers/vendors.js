import { Op } from 'sequelize';
import sequelize from '../lib/database.js';

import Vendor, {getVendorMasterData} from '../models/vendor.js';
import VendorContact from '../models/vendorContact.js';
// import Pincode from '../models/pincode.js';
// import City from '../models/city.js';
// import State from '../models/state.js';
// import Country from '../models/country.js';
import VendorType from '../models/vendorType.js';
import { getSeries } from '../models/series.js';

export const getMasterData = async (req, res, next) => {
  try {
    const masterData = await getVendorMasterData(null);

    return res.status(200).json({ masterData });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching Master Data failed!",
    //   error: JSON.stringify(error, Object.getOwnPropertyNames(error))
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Master Data failed!";
    next(error, req, res);
  }
};

export const createVendor = async (req, res, next) => {
  let t;
  
  try {

    // console.log(req.files);

    // return res.status(422).json({
    //   message: "Invalid inputs passed, please check your data.",
    //   file: req.files
    // });

    const vendor = await Vendor.build({
      status: 'Pending',
      created_by: req.userData.userId,
      modified_by: req.userData.userId
    });

    vendor.getRequestData(req);
    
    let error = await vendor.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }
    
    t = await sequelize.transaction();
    await vendor.save({ transaction: t });

    const contacts = vendor.getVendorContacts(req.body);
    for(const contact of contacts) {
      const vendorContact = await VendorContact.build({
        vendor_id: vendor.id
      });
      vendorContact.getRequestData(contact);
      error = await vendorContact.validateData();
      if (error) {
        await t.rollback();

        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      await vendorContact.save({ transaction: t });
    }

    await t.commit();
    
    return res.status(201).json({
      message: "Vendor added successfully",
      vendor: vendor
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Creating a vendor failed!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Creating a Vendor failed!";
    next(error, req, res);
  }
};

export const updateVendor = async (req, res, next) => {
  let t;

  // console.log(req.files.bank_document[0].filename);

  try {
    let vendor = await Vendor.findByPk(req.params.id);
    if (!vendor) {
      return res.status(404).json({message: "Vendor not found!"});
    }

    let blUpdate = false;
    if (vendor.status && vendor.status.trim().toUpperCase() === 'APPROVED') {
      // vendor = await Vendor.build({
      //   status: 'Pending',
      //   created_by: req.userData.userId,
      //   modified_by: req.userData.userId
      // });
      const newVendor = {...vendor.dataValues};
      delete newVendor.id;

      vendor = await Vendor.build({
        ...newVendor,
        status: 'Pending',
        created_by: req.userData.userId,
        modified_by: req.userData.userId
      });
      
      // vendor.id = null;
  
      vendor.getRequestData(req);

      vendor.ref_id = req.params.id;
    } else {
      vendor.getRequestData(req);
      vendor.status = 'Pending';
      vendor.modified_by = req.userData.userId;
      blUpdate = true;
    }

    let error = await vendor.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    t = await sequelize.transaction();
    await vendor.save({ transaction: t });

    if (blUpdate === true) {
      await VendorContact.destroy({ where: { vendor_id: vendor.id }, transaction: t });
    }
    
    const contacts = vendor.getVendorContacts(req.body);
    for(const contact of contacts) {
      const vendorContact = await VendorContact.build({
        vendor_id: vendor.id
      });
      vendorContact.getRequestData(contact);
      error = await vendorContact.validateData();
      if (error) {
        await t.rollback();

        return res.status(422).json({
          message: "Invalid inputs passed, please check your data.",
          error: error
        });
      }

      await vendorContact.save({ transaction: t });
    }

    await t.commit();

    res.status(200).json({ message: "Update successful!", vendor: vendor });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't udpate vendor!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Couldn't update Vendor!";
    next(error, req, res);
  }
};

export const approveVendor = async (req, res, next) => {
  let t;

  try {
    let vendor = await Vendor.findByPk(req.params.id);
    if (!vendor) {
      return res.status(404).json({
        message: "Vendor not found!"
      });
    }

    // if (vendor.modified_by === req.userData.userId) {
    //   return res.status(422).json({ 
    //     message: `You can't approve this Vendor.`, 
    //     error : { 
    //       errors : { 
    //         vendorDate: { message: `You can't approve this Vendor.` } 
    //       } 
    //     }
    //   });
    // }

    // console.log(vendor);

    if (vendor.status.trim().toUpperCase() !== 'PENDING' && vendor.status.trim().toUpperCase() !== 'DELETED') {
      return res.status(422).json({ 
        message: `Vendor status should be pending or deleted.`, 
        error : { 
          errors : { 
            vendorDate: { message: `Vendor status should be pending or deleted.` } 
          } 
        }
      });
    }

    vendor.approve(req);

    // console.log(error);
    // vendor.approvedBy = req.userData.userId;
    // vendor.approvedAt = new Date().toISOString();

    const error = await vendor.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    // try {
      t = await sequelize.transaction();
      
      if (!vendor.vendor_code) {
        const series = await getSeries(req, 'Vendor');
        vendor.getVendorCode(series.series);
        await series.save({ transaction: t });
      }
      
      if (!vendor.ref_id) {
        await vendor.save({ transaction: t });
      } else {
        // const obj = JSON.parse(JSON.stringify(vendor));
        // delete obj._id;
        // obj.ref_id = null;

        const ref_id = vendor.ref_id;

        const obj = vendor.dataValues;
        delete obj.id;
        obj.ref_id = null;

        // console.log(obj);
        // console.log(ref_id);
        // console.log(req.params.id);

        await Vendor.destroy({ where: {id: req.params.id }}, { transaction: t });

        // vendor = await Vendor.findByIdAndUpdate(ref_id, obj, { session: session, new: true });

        await Vendor.update(obj, { where: { id: ref_id } }, { transaction: t });

        await VendorContact.destroy({ where: {vendor_id: ref_id }}, { transaction: t });

        await VendorContact.update({ vendor_id: ref_id }, { where: { vendor_id: req.params.id }}, { transaction: t });

        // originalVendor = await Vendor.findById(vendor.ref_id);
        // originalVendor.overwrite(vendor);
        // originalVendor.ref_id = null;
        // originalVendor.vendorState = vendor.vendorState;
        // // console.log(originalVendor);
        // await originalVendor.save({ session });
      }

      await t.commit();
         
    // } catch (error) { 
    //     await session.abortTransaction();
    // }
    
    res.status(200).json({ message: "Approve successful!" });
  } catch (error) {
    // console.log(error);

    if (t) {
      await t.rollback();
    }

    // res.status(500).json({
    //   message: 'Approving Vendor failed! Error - ' + (error.message ? error.message : '')
    // });
    
    res.statusCode = 500;
    res.message = "Approving Vendor failed!";
    next(error, req, res);
  }
};

export const rejectVendor = async (req, res, next) => {
  try {
    let vendor = await Vendor.findByPk(req.params.id);

    if (!vendor) {
      return res.status(404).json({
        message: "Vendor not found!"
      });
    }

    if (vendor.modified_by.toString() === req.userData.userId) {
      return res.status(422).json({ 
        message: `You can't reject this Vendor.`, 
        error : { 
          errors : { 
            vendorDate: { message: `You can't reject this Vendor.` } 
          } 
        }
      });
    }

    if (vendor.status.trim().toUpperCase() === 'APPROVED') {
      return res.status(422).json({ 
        message: `Vendor is already approved.`, 
        error : { 
          errors : { 
            vendorDate: { message: `Vendor is already approved.` } 
          } 
        }
      });
    }

    vendor.reject(req);
    await vendor.save();

    res.status(200).json({ message: "Reject successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Rejecting Vendor failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Rejecting Vendor failed!";
    next(error, req, res);
  }
};

export const getVendors = async (req, res, next) => {
  try {
    let status = 'Pending';
    let pageSize = 10;
    let pageIndex = 0;
    let query = '';
    let sort = { key: 'modified_on', order: 'desc' };

    if (req.query) {
      status = req.query.status ? req.query.status : '';
      if (req.query.pageSize && req.query.pageSize.toString().trim().toUpperCase() === 'ALL') {
        pageSize = 'ALL';
      } else {
        pageSize = req.query.pageSize ? +req.query.pageSize : 10;
      }
      pageIndex = req.query.pageIndex ? +req.query.pageIndex : 0;
      query = req.query.query ? req.query.query : '';
      sort = { key: req.query.key ? req.query.key : 'modified_on', order: req.query.order ? req.query.order : 'desc' };
    }

    // let totalCount = 0;
    const statusCount = {
      pending: 0,
      approved: 0,
      rejected: 0,
      inActive: 0
    };
    const data = await Vendor.findAll(
      { 
        attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']], 
        group:['status'], 
        raw: true
      }
    );
    // console.log(data);
    for (const item of data) {
      // console.log(item.status);
      // console.log(item.count);
      if (item.status === "Pending" || item.status === "Deleted") {
        statusCount.pending = statusCount.pending + parseInt(item.count);
        // totalCount = parseInt(item.count);
      }
      else if (item.status === "Approved") {
        statusCount.approved = statusCount.approved + parseInt(item.count);
        // totalCount = parseInt(item.count);
      }
      else if (item.status === "Rejected") {
        statusCount.rejected = statusCount.rejected + parseInt(item.count);
        // totalCount = parseInt(item.count);
      }
      else if (item.status === "InActive") {
        statusCount.inActive = statusCount.inActive + parseInt(item.count);
        // totalCount = parseInt(item.count);
      }
    }
    
    let condition = {};
    let statusCondition = { status: 'Pending' };
    if (status) {
      if (status.trim().toUpperCase() === 'PENDING') {
        statusCondition = { status: {[Op.or] : ['Pending', 'Deleted']} };
      } else {
        statusCondition = { status: status };
      }
    }
    if (query) {
      condition['where'] = {
        [Op.and]: [
          {[Op.or]: [
            { 'vendor_name': {[Op.like]: `%${query}%` } }, 
            { 'email_id': {[Op.like]: `%${query}%` } }, 
            { 'mobile': {[Op.like]: `%${query}%` } }
          ]},
          statusCondition
        ]
      };
    } else {
      condition['where'] = statusCondition;
    }

    let order = [['modified_on', 'DESC']];
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

    condition['include'] = [{ model: VendorType, as: 'vendorType', attributes: ['vendor_type']}];

    const { count, rows } = await Vendor.findAndCountAll(condition);
    // const rows = 

    res.status(200).json({
      message: "Vendors fetched successfully!",
      // totalCount: totalCount,
      total: count,
      statusCount: statusCount,
      rows: rows
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching vendors failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching vendors failed!";
    next(error, req, res);
  }
};

export const getVendor = async (req, res, next) => {
  try {
    const vendor = await Vendor.findByPk(req.params.id, { include: ["contactPersons"] });
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found!" });
    }

    const roleDetails = req.userData.roleDetails;

    // console.log(roleDetails);

    const action = {
      update: false,
      delete: false,
      approve: false
    };

    // console.log(vendor.modified_by.toString());
    // console.log(req.userData.userId);
    
    // if (vendor.isFreezed) {
    //   if (vendor.status.trim().toUpperCase() !== 'APPROVED' && vendor.status.trim().toUpperCase() !== 'INACTIVE') {
    //     if (roleDetails.r_edit) {
    //       action.update = true;
    //     }
    //     if (roleDetails.r_delete) {
    //       action.delete = true;
    //     }
    //   }
    // } else {
      if (!roleDetails.r_approvals || 
            (vendor.status.trim().toUpperCase() !== 'PENDING' && 
            vendor.status.trim().toUpperCase() !== 'DELETED') || 
            vendor.modified_by.toString() === req.userData.userId.toString()) 
      {
        if (roleDetails.r_edit) {
          action.update = true;
        }
        if (roleDetails.r_delete) {
          action.delete = true;
        }
      } else if (roleDetails.r_approvals) {
        action.approve = true;
      }
    // }
    
  
    // const pincodes = await Pincode.findAll({ attributes: ['id', 'pincode', 'state_id'] });
    // const cities = await City.findAll({ attributes: ['id', 'city_name', 'state_id'] });
    // const states = await State.findAll({ attributes: ['id', 'state_name', 'country_id'] });
    // const countries = await Country.findAll({ attributes: ['id', 'country_name'] });

    const masterData = await getVendorMasterData(vendor);
  
    return res.status(200).json({ action, vendor, masterData });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching vendor failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching Vendor failed!";
    next(error, req, res);
  }
};

export const deleteVendor = async (req, res, next) => {
  let t;

  try {
    let vendor = await Vendor.findByPk(req.params.id, {raw: true});
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found!" });
    }

    t = await sequelize.transaction();

    if (vendor.status.trim().toUpperCase() === 'APPROVED') {
      vendor.id = null;
      vendor.status = 'Deleted';
      vendor.ref_id = req.params.id;
      
      vendor = await Vendor.build({
        ...vendor
      });

      await vendor.save({ transaction: t });

      let vendorContacts = await VendorContact.findAll({ 
        where: { vendor_id: req.params.id}, 
        attributes: ['vendor_id', 'contact_person', 'email_id', 'mobile'], 
        raw: true 
      });

      vendorContacts = vendorContacts.map(vendorContact => {
        vendorContact.vendor_id = vendor.id;
        return vendorContact;
      });

      await VendorContact.bulkCreate(vendorContacts, { transaction: t });
      
      // const error = await vendor.validateData();
      // if (error) {
      //   return res.status(422).json({
      //     message: "Invalid inputs passed, please check your data.",
      //     error: error
      //   });
      // }
    } else {
      await Vendor.destroy({ where: { id: req.params.id }, transaction: t });
      await VendorContact.destroy({ where: { vendor_id: req.params.id }, transaction: t });
    }

    await t.commit();
    
    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Deleting vendor failed!"
    // });

    if (t) {
      await t.rollback();
    }
    
    res.statusCode = 500;
    res.message = "Deleting Vendor failed!";
    next(error, req, res);
  }
};