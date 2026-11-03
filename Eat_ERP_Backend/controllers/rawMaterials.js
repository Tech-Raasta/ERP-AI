import { Op } from 'sequelize';

import RawMaterial from '../models/rawMaterial.js';
import { set_raw_material_rate, set_products, set_product_rate, send_updated_variations } from '../models/ingredient.js';

export const createRawMaterial = async (req, res, next) => {
  try {
    const rawMaterial = await RawMaterial.build({
      status: 'Approved',
      created_by: req.userData.userId,
      modified_by: req.userData.userId
    });

    await rawMaterial.getRequestData(req);

    rawMaterial.status = 'Approved';

    const error = await rawMaterial.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    await rawMaterial.save();

    const id = rawMaterial.id;
    const module = 'Raw Material';
    const rm_ids = await set_raw_material_rate(module, id, req.userData.userId);
    // console.log('rm_ids - ', rm_ids);
    const ing_ids = await set_products(module, id, req.userData.userId);
    // console.log('ing_ids - ', ing_ids);
    const box_ids = await set_product_rate(module, ing_ids, req.userData.userId);
    // console.log('box_ids - ', box_ids);
    send_updated_variations(rm_ids, ing_ids, box_ids)
      .then(r => console.log(r))
      .catch(err => console.log(err));

    return res.status(201).json({
      message: "Raw Material added successfully",
      rawMaterial: rawMaterial
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Creating a raw material failed!";
    next(error, req, res);
  }
};

export const updateRawMaterial = async (req, res, next) => {
  try {
    const rawMaterial = await RawMaterial.findByPk(req.params.id);
    if (!rawMaterial) {
      return res.status(404).json({ message: "Raw Material not found!" });
    }

    await rawMaterial.getRequestData(req);
    rawMaterial.modified_by = req.userData.userId;

    const error = await rawMaterial.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    await rawMaterial.save();
    
    const id = req.params.id;
    const module = 'Raw Material';
    const rm_ids = await set_raw_material_rate(module, id, req.userData.userId);
    // console.log('rm_ids - ', rm_ids);
    const ing_ids = await set_products(module, id, req.userData.userId);
    // console.log('ing_ids - ', ing_ids);
    const box_ids = await set_product_rate(module, ing_ids, req.userData.userId);
    // console.log('box_ids - ', box_ids);
    send_updated_variations(rm_ids, ing_ids, box_ids)
      .then(r => console.log(r))
      .catch(err => console.log(err));

    res.status(200).json({ 
      message: "Update successful!",
      rawMaterial: rawMaterial 
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Couldn't udpate raw material!";
    next(error, req, res);
  }
};

export const getRawMaterials = async (req, res, next) => {
  try {
    let status = 'Pending';
    let pageSize = 10;
    let pageIndex = 0;
    let query = '';
    let sort = { key: 'modified_on', order: 'desc' };
    let materialType = 'raw_material';

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
      materialType = req.query.materialType;
    }
    

    materialType = materialType ? materialType : 'raw_material';
    if (materialType.trim().toUpperCase() === 'PACKAGING_MATERIAL') {
      materialType = 'Packaging Material';
    } else if (materialType.trim().toUpperCase() === 'ASSET') {
      materialType = 'Asset';
    } else {
      materialType = 'Raw Material';
    }
    
    let condition = {};
    if (query) {
      condition['where'] = {
        [Op.and]: [
          {[Op.or]: [
            { 'rm_name': {[Op.like]: `%${query}%` } }, 
            { 'hsn_code': {[Op.like]: `%${query}%` } }, 
            { 'rate': {[Op.like]: `%${query}%` } }
          ]},
          // Old PHP lists every status, so search must not hide InActive records either
          { material_type: materialType }
        ]
      };
    } else {
      condition['where'] = { material_type: materialType };
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

    // console.log(condition);

    const { count, rows } = await RawMaterial.findAndCountAll(condition);

    res.status(200).json({
      message: materialType + "s fetched successfully!",
      rows: rows,
      total: count
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching " + materialType + "s failed!";
    next(error, req, res);
  }
};

export const getRawMaterial = async (req, res, next) => {
  try {
    const rawMaterial = await RawMaterial.findByPk(req.params.id);
    if (!rawMaterial) {
      return res.status(404).json({ message: "Raw Material not found!" });
    }

    return res.status(200).json({ rawMaterial });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching Raw Material failed!";
    next(error, req, res);
  }
};

export const deleteRawMaterial = async (req, res, next) => {
  try {
    const rawMaterial = await RawMaterial.findByPk(req.params.id);

    if (!rawMaterial) {
      return res.status(404).json({
        message: "Raw Material not found!"
      });
    }

    rawMaterial.status = 'InActive';
    rawMaterial.modified_by = req.userData.userId;

    const error = await rawMaterial.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }
    
    await rawMaterial.save();
    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Deleting Raw Materials failed!";
    next(error, req, res);
  }
};