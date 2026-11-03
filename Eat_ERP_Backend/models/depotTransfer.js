import { DataTypes, Op, fn, col } from 'sequelize';
import sequelize from '../lib/database.js';

import Depot from './depot.js';
import DepotTransferItem from './depotTransferItem.js';
import User from './user.js';
import RawMaterial from './rawMaterial.js';
import BatchRawMaterial from './batchRawMaterial.js';
import BatchProcessing from './batchProcessing.js';
import Box from './box.js';
import ComboBox from './comboBox.js';
import RawMaterialIn from './rawMaterialIn.js';
import RawMaterialInItemWeight from './rawMaterialInItemWeight.js';
import ProductionAllocation from './productionAllocation.js';
// import Production from './production.js';

const DepotTransfer = sequelize.define('depot_transfer', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  file_id:{
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  date_of_transfer: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  depot_out_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  depot_in_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  chalan_no: DataTypes.STRING,
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
  production_id: DataTypes.INTEGER,
  packaging_id: DataTypes.INTEGER,
  ref_id: DataTypes.INTEGER,
  transfer_type: DataTypes.STRING,
  depot_out_name: DataTypes.STRING,
  depot_in_name: DataTypes.STRING,
  item_names: DataTypes.TEXT
}, 
{ 
  timestamps: false,
  // createdAt: 'created_on',
  // updatedAt: 'modified_on',
  freezeTableName: true
});

DepotTransfer.belongsTo(Depot, { foreignKey: "depot_out_id", as: "depot_out" });
DepotTransfer.belongsTo(Depot, { foreignKey: "depot_in_id", as: "depot_in" });
// DepotTransfer.belongsTo(Production, { foreignKey: "production_id", as: "production" });
DepotTransfer.hasMany(DepotTransferItem, { foreignKey: "depot_transfer_id", as: "depotTransferItems", onDelete: 'CASCADE' });
// DepotTransfer.hasMany(DepotTransferOtherCharge, { foreignKey: "depot_transfer_id", as: "DepotTransferOtherCharges", onDelete: 'CASCADE' });
// RawMaterial.hasMany(DepotTransferItem, { foreignKey: "item_id", as: "DepotTransferItems" });
// DepotTransfer.belongsToMany(RawMaterial, { through : DepotTransferItem, as: "raw_material", foreignKey: 'depot_transfer_id' });
// RawMaterial.belongsToMany(DepotTransfer, { through : DepotTransferItem, as: "batch_processing", foreignKey: 'item_id' });
DepotTransfer.belongsTo(User, { foreignKey: "created_by", as: "created_by_user" });
DepotTransfer.belongsTo(User, { foreignKey: "modified_by", as: "modified_by_user" });
DepotTransfer.belongsTo(User, { foreignKey: "approved_by", as: "approved_by_user" });

DepotTransfer.setProductionData = async function(production, transfer_type) {
  let depotTransfer = null;

  // if (transfer_type && transfer_type.trim().toUpperCase() === 'BOX') {
  //   depotTransfer = await DepotTransfer.findOne({ 
  //     where: { 
  //       production_id: production.id, 
  //       transfer_type: transfer_type, 
  //       status: { [Op.or]: [ { [Op.is]: null }, { [Op.ne]: 'Approved' } ] } 
  //     } 
  //   });
  // } else {
  //   depotTransfer = await DepotTransfer.findOne({ where: { production_id: production.id, transfer_type: transfer_type } });
  // }

  depotTransfer = await DepotTransfer.findOne({ where: { production_id: production.id, transfer_type: transfer_type } });
  
  if (!depotTransfer) {
    depotTransfer = await DepotTransfer.build({
      status: production.status,
      created_by: production.created_by,
      created_on: production.created_on
    });
  }

  if (transfer_type === 'Raw Material') {
    depotTransfer.depot_in_id = production.manufacturer_id;
    depotTransfer.depot_out_id = production.depot_id;
  } else if (transfer_type === 'Box') {
    depotTransfer.depot_in_id = production.store_id;
    depotTransfer.depot_out_id = production.manufacturer_id;
  } else {
    depotTransfer.depot_in_id = production.depot_id;
    depotTransfer.depot_out_id = production.manufacturer_id;
  }

  depotTransfer.date_of_transfer = production.date_of_processing;
  depotTransfer.modified_by = production.modified_by;
  depotTransfer.modified_on = production.modified_on;
  depotTransfer.approved_by = production.approved_by;
  depotTransfer.approved_on = production.approved_on;
  depotTransfer.rejected_by = production.rejected_by;
  depotTransfer.rejected_on = production.rejected_on;
  depotTransfer.production_id = production.id;
  depotTransfer.transfer_type = transfer_type;

  return depotTransfer;
}

DepotTransfer.setProductionTransfer = async function(production, transfers) {
  // let transfers = productionTransfers.toSorted(function(a,b) {
  //   return (a.depot_id - b.depot_id);
  // });
  let last_depot_in_id = 0;
  let depotTransfer = {};
  let depotTransferItems = [];
  const depotTransfers = [];

  for (const transfer of transfers) {
    if (last_depot_in_id != transfer.depot_id) {
      last_depot_in_id = transfer.depot_id;

      depotTransferItems = [];

      depotTransfer = await DepotTransfer.findOne({ 
        where: { 
          production_id: production.id, 
          transfer_type: 'Box', 
          depot_in_id: transfer.depot_id,
          depot_out_id: production.manufacturer_id
        } 
      });
      if (!depotTransfer) {
        depotTransfer = await DepotTransfer.build({
          status: production.status,
          created_by: production.created_by,
          created_on: production.created_on
        });
      }

      depotTransfer.date_of_transfer = production.date_of_processing;
      depotTransfer.depot_in_id = transfer.depot_id;
      depotTransfer.depot_out_id = production.manufacturer_id;
      depotTransfer.modified_by = production.modified_by;
      depotTransfer.modified_on = production.modified_on;
      depotTransfer.approved_by = production.approved_by;
      depotTransfer.approved_on = production.approved_on;
      depotTransfer.rejected_by = production.rejected_by;
      depotTransfer.rejected_on = production.rejected_on;
      depotTransfer.production_id = production.id;
      depotTransfer.transfer_type = 'Box';
  
      depotTransfers.push({ depotTransfer: depotTransfer, depotTransferItems: depotTransferItems });
    }

    const depotTransferItem = await DepotTransferItem.build({
      depot_transfer_id: depotTransfer.id,
      type: 'Box',
      item_id: transfer.box_id,
      qty: transfer.qty,
      // this.barcode = productionRawMaterial.barcode;
      // this.expiry_date = productionRawMaterial.expiry_date;
    });

    depotTransferItems.push(depotTransferItem);
    
    depotTransfers.depotTransferItems = depotTransferItems;
  }

  return depotTransfers;
}

DepotTransfer.setPackagingData = async function(packaging, transfer_type) {
  let depotTransfer = await DepotTransfer.findOne({ where: { packaging_id: packaging.id, transfer_type: transfer_type } });
  if (!depotTransfer) {
    depotTransfer = await DepotTransfer.build({
      status: packaging.status,
      created_by: packaging.created_by,
      created_on: packaging.created_on
    });
  }

  if (transfer_type === 'Raw Material') {
    depotTransfer.depot_in_id = packaging.manufacturer_id;
    depotTransfer.depot_out_id = packaging.depot_id;
  } else if (transfer_type === 'Box') {
    depotTransfer.depot_in_id = packaging.store_id;
    depotTransfer.depot_out_id = packaging.manufacturer_id;
  } else {
    depotTransfer.depot_in_id = packaging.depot_id;
    depotTransfer.depot_out_id = packaging.manufacturer_id;
  }

  depotTransfer.date_of_transfer = packaging.date_of_processing;
  depotTransfer.modified_by = packaging.modified_by;
  depotTransfer.modified_on = packaging.modified_on;
  depotTransfer.approved_by = packaging.approved_by;
  depotTransfer.approved_on = packaging.approved_on;
  depotTransfer.rejected_by = packaging.rejected_by;
  depotTransfer.rejected_on = packaging.rejected_on;
  depotTransfer.packaging_id = packaging.id;
  depotTransfer.transfer_type = transfer_type;

  return depotTransfer;
}

DepotTransfer.setPackagingTransfer = async function(packaging, transfers) {
  // let transfers = packagingTransfers.toSorted(function(a,b) {
  //   return (a.depot_id - b.depot_id);
  // });
  let last_depot_in_id = 0;
  let depotTransfer = {};
  let depotTransferItems = [];
  const depotTransfers = [];

  for (const transfer of transfers) {
    if (last_depot_in_id != transfer.depot_id) {
      last_depot_in_id = transfer.depot_id;

      depotTransferItems = [];

      depotTransfer = await DepotTransfer.findOne({ 
        where: { 
          packaging_id: packaging.id, 
          transfer_type: 'Box', 
          depot_in_id: transfer.depot_id,
          depot_out_id: packaging.manufacturer_id
        } 
      });
      if (!depotTransfer) {
        depotTransfer = await DepotTransfer.build({
          status: packaging.status,
          created_by: packaging.created_by,
          created_on: packaging.created_on
        });
      }

      depotTransfer.date_of_transfer = packaging.date_of_processing;
      depotTransfer.depot_in_id = transfer.depot_id;
      depotTransfer.depot_out_id = packaging.manufacturer_id;
      depotTransfer.modified_by = packaging.modified_by;
      depotTransfer.modified_on = packaging.modified_on;
      depotTransfer.approved_by = packaging.approved_by;
      depotTransfer.approved_on = packaging.approved_on;
      depotTransfer.rejected_by = packaging.rejected_by;
      depotTransfer.rejected_on = packaging.rejected_on;
      depotTransfer.packaging_id = packaging.id;
      depotTransfer.transfer_type = 'Box';
  
      depotTransfers.push({ depotTransfer: depotTransfer, depotTransferItems: depotTransferItems });
    }

    const depotTransferItem = await DepotTransferItem.build({
      depot_transfer_id: depotTransfer.id,
      type: 'Box',
      item_id: transfer.box_id,
      qty: transfer.qty,
      // this.barcode = productionRawMaterial.barcode;
      // this.expiry_date = productionRawMaterial.expiry_date;
    });

    depotTransferItems.push(depotTransferItem);
    
    depotTransfers.depotTransferItems = depotTransferItems;
  }

  return depotTransfers;
}

export const getDepotTransferMasterData = async function(depotTransfer, req) {
  // try {
    // let depotCond = { where: {status: 'Approved', type: {[Op.in]: ['Manufacturer', 'Depot']}, id: {[Op.in]: req.userData.depotIds}} };
    let depotCond = { where: {status: 'Approved', type: {[Op.in]: ['Manufacturer', 'Depot']}} };
    let rawMaterialCond = { where: {status: 'Approved'} };
    let boxCond = { where: {status: 'Approved'} };
    let comboBoxCond = { where: {status: 'Approved'} };

    if (depotTransfer) {
      depotCond = { where: {[Op.or]: [
        // {[Op.and]: { status: 'Approved', id: { [Op.in]: req.userData.depotIds } }}, 
        {[Op.and]: { status: 'Approved' }}, 
        { id: depotTransfer.depot_out_id },
        { id: depotTransfer.depot_in_id }
      ]} };
      if (depotTransfer.depotTransferItems && depotTransfer.depotTransferItems.length > 0) {
        // const rawMaterialIds = depotTransfer.depotTransferItems.map(depotTransferItem => depotTransferItem.item_id);
        const rawMaterialIds = depotTransfer.depotTransferItems.filter(depotTransferItem => 
          depotTransferItem.type==='Raw Material' && depotTransferItem.item_id
        ).map(depotTransferItem => depotTransferItem.item_id);
        rawMaterialCond = { where: {[Op.or]: [
          { status: 'Approved' }, 
          { id: { [Op.isIn]: rawMaterialIds } }
        ]} };

        const boxIds = depotTransfer.depotTransferItems.filter(depotTransferItem => 
          depotTransferItem.type==='Box' && depotTransferItem.item_id
        ).map(depotTransferItem => {
          if(depotTransferItem.combo_box_id) {
            return depotTransferItem.item_id
          }
        });
        boxCond = { where: {[Op.or]: [
          { status: 'Approved' }, 
          { id: { [Op.isIn]: boxIds } },
        ]} };

        const comboBoxIds = depotTransfer.depotTransferItems.filter(depotTransferItem => 
          depotTransferItem.type==='Combo Box' && depotTransferItem.combo_box_id
        ).map(depotTransferItem => depotTransferItem.combo_box_id);
        comboBoxCond = { where: {[Op.or]: [
          { status: 'Approved' }, 
          { id: { [Op.isIn]: comboBoxIds } },
        ]} };

      }
    }

    const depots = await Depot.findAll({ ...depotCond, attributes: ['id', 'depot_name', 'state'] });
    const rawMaterials = await RawMaterial.findAll({ ...rawMaterialCond, attributes: ['id', 'rm_name', 'rate'] });
    const boxes = await Box.findAll({ ...boxCond, attributes: ['id', 'box_name', 'rate'] });
    const combo_boxes = await ComboBox.findAll({ ...comboBoxCond, attributes: ['id', 'combo_box_name', 'rate'] });
    
    return { depots, rawMaterials, boxes, combo_boxes };
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

export const getRawMaterialBarcodes = async function(item_id) {
  // try {
    // const item_id = req.params.item_id ? +req.params.item_id : 0;

    // const barcodes = await BatchRawMaterial.findAll({
    //   include: [
    //     { model: BatchProcessing, as: 'batchProcessing', where: {status: 'Approved'}, attributes: ['id'] }
    //   ],
    //   where: { item_id: item_id, barcode: {[Op.not]: null} },
    //   attributes: ['barcode', 'expiry_date'],
    //   group: ['barcode', 'expiry_date'],
    //   raw: true
    // });

    const barcodes = await RawMaterialInItemWeight.findAll({
      include: [
        { model: RawMaterialIn, as: 'raw_material_in', where: {status: 'Approved'}, attributes: ['id'] }
      ],
      where: { raw_material_id: item_id, barcode: {[Op.not]: null} },
      attributes: ['barcode', 'expiry_date'],
      group: ['barcode', 'expiry_date'],
      order: [['expiry_date', 'desc']],
      raw: true
    });

    barcodes.push({
      barcode: "NA",
      expiry_date: "",
      "raw_material_in.id": 0,
    });
    
    return barcodes;
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

DepotTransfer.prototype.getRequestData = function(req) {
  // try {
    const body = req.body ? req.body : null;

    this.date_of_transfer = body.date_of_transfer ? new Date(body.date_of_transfer).toISOString() : null;
    this.depot_out_id = body.depot_out_id ? +body.depot_out_id : null;
    this.depot_in_id = body.depot_in_id ? +body.depot_in_id : null;
    this.type = body.type ? body.type : '';
    this.chalan_no = body.chalan_no ? body.chalan_no : '';
    // this.amount = body.amount ? +body.amount : 0;
    // this.delivery_date = body.delivery_date ? body.delivery_date : null;
    // this.ref_id = body.ref_id ? +body.ref_id : null;
    // this.status = body.status;
    this.remarks = body.remarks ? body.remarks.trim() : '';
  // } catch (error) {
  //   // console.log(error);
  //   return error;
  // }
}

DepotTransfer.prototype.getDepotTransferItems = function(body) {
  // try {
    const depotTransferItems = [];
    if (body.depotTransferItems) {
      for (const postedDepotTransferItem of body.depotTransferItems) {
        const type = (postedDepotTransferItem.type) ? postedDepotTransferItem.type : '';
        const item_id = (postedDepotTransferItem.item_id) ? +postedDepotTransferItem.item_id : null;
        const qty = (postedDepotTransferItem.qty) ? +postedDepotTransferItem.qty : 0;
        const barcode = (postedDepotTransferItem.barcode) ? postedDepotTransferItem.barcode : '';
        const expiry_date = (postedDepotTransferItem.expiry_date) ? postedDepotTransferItem.expiry_date : null;
  
        const depotTransferItem = {
          depot_transfer_id: this.id,
          type: type,
          item_id: item_id,
          qty: qty,
          barcode: barcode,
          expiry_date: expiry_date,
        };

        depotTransferItems.push(depotTransferItem);
      }
    }
    
    return depotTransferItems;
  // } catch (error) {
  //   return error;
  // }
}

DepotTransfer.prototype.setDetails = async function(depotTransferItems) {
  const depot_out = await Depot.findByPk(this.depot_out_id);
  this.depot_out_name = depot_out && depot_out.depot_name ? depot_out.depot_name : '';

  const depot_in = await Depot.findByPk(this.depot_in_id);
  this.depot_in_name = depot_in && depot_in.depot_name ? depot_in.depot_name : '';

  this.item_names = depotTransferItems.map(item => item.type === 'Raw Material' ? 'RM-'+item.item_name : item.item_name).join(', ');

  return true;
}

DepotTransfer.prototype.approve = function(req) {
  // try {
    // if (this.isDeleted) {
    if (this.status === "Deleted") {
      this.status = "InActive";
    } else {
      this.status = "Approved";
    }

    if (req && req.body && req.body.remarks) {
      this.remarks = req.body.remarks;
    } else {
      this.remarks = '';
    }
    this.approved_by = req.userData.userId;
    this.approved_on = new Date().toISOString();

    return null;
  // } catch (error) {
  //   return error;
  // }
}

DepotTransfer.prototype.reject = function(req) {
  // try {
    this.status = "Rejected";
    if (req && req.body && req.body.remarks) {
      this.remarks = req.body.remarks;
    } else {
      this.remarks = '';
    }
    this.rejected_by = req.userData.userId;
    this.rejected_on = new Date().toISOString();

    return null;
  // } catch (error) {
  //   return error;
  // }
}

DepotTransfer.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    let count = 0;
    if (this.depot_out_id) {
      count = await Depot.count({ where: { id: this.depot_out_id }});
      if (count === 0) {
        return { errors : { depot_out_id: { message: `Depot does not exist` } } };
      }
    }
    if (this.depot_in_id) {
      count = await Depot.count({ where: { id: this.depot_in_id }});
      if (count === 0) {
        return { errors : { depot_in_id: { message: `Depot does not exist` } } };
      }
    }
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}


// Get Depot In Stock Qty
export const getDepotInStockQty = async function(raw_material_id, depot_id, barcode=null) {

  const depotTransfer = await DepotTransfer.findAll({
    where: { 
      ...( depot_id && { depot_in_id: depot_id }),
      status: 'Approved',
      // date_of_transfer: { [Op.gte]: "2026-04-01"},
    }
  });

  const depot_in_ids = depotTransfer.map(batch => batch.id);

  const depotInQty = await DepotTransferItem.findAll({
    attributes: [[fn('SUM', col('qty')), 'total_qty']],
    where: { 
      type:'Raw Material',
      item_id: raw_material_id, 
      depot_transfer_id: { [Op.in]: depot_in_ids },
      ...(barcode && {barcode:barcode})
    },
    raw: true,
  });

  const totalQty = depotInQty[0]?.total_qty ? +depotInQty[0].total_qty : 0;

  return totalQty;
}

// Get Depot Out Stock Qty
export const getDepotOutStockQty = async function(raw_material_id, depot_id, barcode=null) {

  const depotTransfer = await DepotTransfer.findAll({
    where: { 
      ...( depot_id && { depot_out_id: depot_id } ), 
      status: 'Approved',
      // date_of_transfer: { [Op.gte]: "2026-04-01"},
    }
  });

  const depot_out_ids = depotTransfer.map(batch => batch.id);

  const depotOutQty = await DepotTransferItem.findAll({
    attributes: [[fn('SUM', col('qty')), 'total_qty']],
    where: { 
      type:'Raw Material',
      item_id: raw_material_id, 
      depot_transfer_id: { [Op.in]: depot_out_ids },
      ...(barcode && {barcode:barcode}) 
    },
    raw: true,
  });

  const totalQty = depotOutQty[0]?.total_qty ? +depotOutQty[0].total_qty : 0;

  return totalQty;
}

export default DepotTransfer;