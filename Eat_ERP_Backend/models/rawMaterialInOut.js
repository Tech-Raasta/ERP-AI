import { DataTypes, Op, fn, col } from 'sequelize';
import sequelize from '../lib/database.js';

import Depot from './depot.js';
import RawMaterialInOutItem from './rawMaterialInOutItem.js';
import User from './user.js';
import RawMaterial from './rawMaterial.js';
import BatchRawMaterial from './batchRawMaterial.js';
import BatchProcessing from './batchProcessing.js';
import RawMaterialInItemWeight from './rawMaterialInItemWeight.js';
import RawMaterialIn from './rawMaterialIn.js';

const RawMaterialInOut = sequelize.define('raw_material_in_out', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  date_of_processing: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  depot_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  },
  depot_name: DataTypes.STRING,
  type: DataTypes.STRING,
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
  ref_id: DataTypes.INTEGER,
  ref_no: DataTypes.STRING,
  item_names: DataTypes.TEXT,
  raw_material_recon_id: DataTypes.INTEGER
}, 
{ 
  timestamps: false,
  // createdAt: 'created_on',
  // updatedAt: 'modified_on',
  freezeTableName: true
});

RawMaterialInOut.belongsTo(Depot, { foreignKey: "depot_id", as: "depot" });
// RawMaterialInOut.belongsTo(Production, { foreignKey: "production_id", as: "production" });
RawMaterialInOut.hasMany(RawMaterialInOutItem, { foreignKey: "raw_material_in_out_id", as: "rawMaterialInOutItems", onDelete: 'CASCADE' });
// RawMaterialInOut.belongsToMany(RawMaterial, { through : RawMaterialInOutItem, as: "raw_material", foreignKey: 'raw_material_in_out_id' });
RawMaterialInOut.belongsTo(User, { foreignKey: "created_by", as: "created_by_user" });
RawMaterialInOut.belongsTo(User, { foreignKey: "modified_by", as: "modified_by_user" });
RawMaterialInOut.belongsTo(User, { foreignKey: "approved_by", as: "approved_by_user" });

RawMaterialInOut.setProductionData = async function(production, type) {
  let rawMaterialInOut = await RawMaterialInOut.findOne({ where: { production_id: production.id, type: type } });
  if (!rawMaterialInOut) {
    rawMaterialInOut = await RawMaterialInOut.build({
      status: production.status,
      created_by: production.created_by,
      created_on: production.created_on
    });
  }

  rawMaterialInOut.date_of_processing = production.date_of_processing;
  rawMaterialInOut.depot_id = production.manufacturer_id;
  rawMaterialInOut.type = type;
  rawMaterialInOut.modified_by = production.modified_by;
  rawMaterialInOut.modified_on = production.modified_on;
  rawMaterialInOut.approved_by = production.approved_by;
  rawMaterialInOut.approved_on = production.approved_on;
  rawMaterialInOut.rejected_by = production.rejected_by;
  rawMaterialInOut.rejected_on = production.rejected_on;
  rawMaterialInOut.production_id = production.id;
  rawMaterialInOut.ref_no = '';

  return rawMaterialInOut;
}

RawMaterialInOut.setRawMaterialReconData = async function(rawMaterialRecon, type) {
  let rawMaterialInOut = await RawMaterialInOut.findOne({ where: { raw_material_recon_id: rawMaterialRecon.id, type: type } });
  if (!rawMaterialInOut) {
    rawMaterialInOut = await RawMaterialInOut.build({
      status: rawMaterialRecon.status,
      created_by: rawMaterialRecon.created_by,
      created_on: rawMaterialRecon.created_on
    });
  }

  rawMaterialInOut.date_of_processing = rawMaterialRecon.date_of_processing;
  rawMaterialInOut.depot_id = rawMaterialRecon.depot_id;
  rawMaterialInOut.type = type;
  rawMaterialInOut.modified_by = rawMaterialRecon.modified_by;
  rawMaterialInOut.modified_on = rawMaterialRecon.modified_on;
  rawMaterialInOut.approved_by = rawMaterialRecon.approved_by;
  rawMaterialInOut.approved_on = rawMaterialRecon.approved_on;
  rawMaterialInOut.rejected_by = rawMaterialRecon.rejected_by;
  rawMaterialInOut.rejected_on = rawMaterialRecon.rejected_on;
  rawMaterialInOut.raw_material_recon_id = rawMaterialRecon.id;
  rawMaterialInOut.ref_no = '';

  return rawMaterialInOut;
}

export const getRawMaterialInOutMasterData = async function(rawMaterialInOut, req) {
  // try {
    let depotCond = { where: {status: 'Approved', type: {[Op.in]: ['Manufacturer', 'Depot']}, id: {[Op.in]: req.userData.depotIds}} };
    let rawMaterialCond = { where: {status: 'Approved'} };

    if (rawMaterialInOut) {
      if (rawMaterialInOut.depot_id) {
        depotCond = { where: {[Op.or]: [{ status: 'Approved', id: {[Op.in]: req.userData.depotIds} }, { id: rawMaterialInOut.depot_id }]} };
      }
      if (rawMaterialInOut.rawMaterialInOutItems && rawMaterialInOut.rawMaterialInOutItems.length > 0) {
        const rawMaterialIds = rawMaterialInOut.rawMaterialInOutItems.map(rawMaterialInOutItem => rawMaterialInOutItem.raw_material_id);
        rawMaterialCond = { where: {[Op.or]: [
          { status: 'Approved' }, 
          { id: { [Op.isIn]: rawMaterialIds } }
        ]} };
      }
    }

    const depots = await Depot.findAll({ ...depotCond, attributes: ['id', 'depot_name', 'state'] });
    const rawMaterials = await RawMaterial.findAll({ ...rawMaterialCond, attributes: ['id', 'rm_name', 'rate'] });
    
    return { depots, rawMaterials };
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

export const getRawMaterialBarcodes = async function(raw_material_id) {
  // try {
    // const raw_material_id = req.params.raw_material_id ? +req.params.raw_material_id : 0;

    // const barcodes = await BatchRawMaterial.findAll({
    //   include: [
    //     { model: BatchProcessing, as: 'batchProcessing', where: {status: 'Approved'}, attributes: ['id'] }
    //   ],
    //   where: { raw_material_id: raw_material_id, barcode: {[Op.not]: null} },
    //   attributes: ['barcode', 'expiry_date'],
    //   group: ['barcode', 'expiry_date'],
    //   raw: true
    // });

    const barcodes = await RawMaterialInItemWeight.findAll({
      include: [
        { model: RawMaterialIn, as: 'raw_material_in', where: {status: 'Approved'}, attributes: ['id'] }
      ],
      where: { raw_material_id: raw_material_id, barcode: {[Op.not]: null} },
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

RawMaterialInOut.prototype.getRequestData = function(req) {
  // try {
    const body = req.body ? req.body : null;

    this.date_of_processing = body.date_of_processing ? new Date(body.date_of_processing).toISOString() : null;
    this.depot_id = body.depot_id ? +body.depot_id : null;
    this.type = body.type ? body.type : '';
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

RawMaterialInOut.prototype.getRawMaterialInOutItems = function(body) {
  // try {
    const rawMaterialInOutItems = [];
    if (body.rawMaterialInOutItems) {
      for (const postedRawMaterialInOutItem of body.rawMaterialInOutItems) {
        const type = (postedRawMaterialInOutItem.type) ? postedRawMaterialInOutItem.type : '';
        const raw_material_id = (postedRawMaterialInOutItem.raw_material_id) ? +postedRawMaterialInOutItem.raw_material_id : null;
        const qty = (postedRawMaterialInOutItem.qty) ? +postedRawMaterialInOutItem.qty : 0;
        const barcode = (postedRawMaterialInOutItem.barcode) ? postedRawMaterialInOutItem.barcode : '';
        const expiry_date = (postedRawMaterialInOutItem.expiry_date) ? postedRawMaterialInOutItem.expiry_date : null;
        const id = (postedRawMaterialInOutItem.id) ? postedRawMaterialInOutItem.id : null;
  
        const rawMaterialInOutItem = {
          id:id,
          raw_material_in_out_id: this.id,
          type: type,
          raw_material_id: raw_material_id,
          qty: qty,
          barcode: barcode,
          expiry_date: expiry_date,
        };

        rawMaterialInOutItems.push(rawMaterialInOutItem);
      }
    }
    
    return rawMaterialInOutItems;
  // } catch (error) {
  //   return error;
  // }
}

RawMaterialInOut.prototype.setDetails = async function(rawMaterialInOutItems) {
  const depot = await Depot.findByPk(this.depot_id);
  this.depot_name = depot && depot.depot_name ? depot.depot_name : '';

  this.item_names = rawMaterialInOutItems.map(item => item.rm_name).join(',');

  return true;
}

RawMaterialInOut.prototype.approve = function(req) {
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

RawMaterialInOut.prototype.reject = function(req) {
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

RawMaterialInOut.prototype.validateData = async function() {
  // try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    let count = 0;
    if (this.depot_id) {
      count = await Depot.count({ where: { id: this.depot_id }});
      if (count === 0) {
        return { errors : { depot_id: { message: `Depot not exist` } } };
      }
    }
    
    return null;
  // } catch (error) {
  //   return error;
  // }
}

// RawMaterialInOut.setProductionTransfer = async function(production, transfers) {
//   // let transfers = productionTransfers.toSorted(function(a,b) {
//   //   return (a.depot_id - b.depot_id);
//   // });
//   let last_depot_in_id = 0;
//   let rawMaterialInOut = {};
//   let rawMaterialInOutItems = [];
//   const rawMaterialInOuts = [];

//   for (const transfer of transfers) {
//     if (last_depot_in_id != transfer.depot_id) {
//       last_depot_in_id = transfer.depot_id;

//       rawMaterialInOutItems = [];

//       rawMaterialInOut = await RawMaterialInOut.findOne({ 
//         where: { 
//           production_id: production.id, 
//           type: 'Box', 
//           depot_in_id: transfer.depot_id,
//           depot_id: production.manufacturer_id
//         } 
//       });
//       if (!rawMaterialInOut) {
//         rawMaterialInOut = await RawMaterialInOut.build({
//           status: production.status,
//           created_by: production.created_by,
//           created_on: production.created_on
//         });
//       }

//       rawMaterialInOut.date_of_processing = production.date_of_processing;
//       rawMaterialInOut.depot_in_id = transfer.depot_id;
//       rawMaterialInOut.depot_id = production.manufacturer_id;
//       rawMaterialInOut.modified_by = production.modified_by;
//       rawMaterialInOut.modified_on = production.modified_on;
//       rawMaterialInOut.approved_by = production.approved_by;
//       rawMaterialInOut.approved_on = production.approved_on;
//       rawMaterialInOut.rejected_by = production.rejected_by;
//       rawMaterialInOut.rejected_on = production.rejected_on;
//       rawMaterialInOut.production_id = production.id;
//       rawMaterialInOut.type = 'Box';
  
//       rawMaterialInOuts.push({ rawMaterialInOut: rawMaterialInOut, rawMaterialInOutItems: rawMaterialInOutItems });
//     }

//     const rawMaterialInOutItem = await RawMaterialInOutItem.build({
//       raw_material_in_out_id: rawMaterialInOut.id,
//       type: 'Box',
//       item_id: transfer.box_id,
//       qty: transfer.qty,
//       // this.barcode = productionRawMaterial.barcode;
//       // this.expiry_date = productionRawMaterial.expiry_date;
//     });

//     rawMaterialInOutItems.push(rawMaterialInOutItem);
    
//     rawMaterialInOuts.rawMaterialInOutItems = rawMaterialInOutItems;
//   }

//   return rawMaterialInOuts;
// }

// Get Raw Material In Stock Qty
export const getRawMaterialInStockQty = async function(raw_material_id, depot_id, barcode=null) {

  const rawMaterialInOut = await RawMaterialInOut.findAll({
    where: { 
      ...(depot_id && { depot_id: depot_id }),
      status: 'Approved',
      // date_of_processing: { [Op.gte]: "2026-04-01"},
    }
  });

  const rawMaterial_in_ids = rawMaterialInOut.map(batch => batch.id);

  const rawMaterialInQty = await RawMaterialInOutItem.findAll({
    attributes: [[fn('SUM', col('qty')), 'total_qty']],
    where: { 
      type:'Stock IN',
      raw_material_id: raw_material_id, 
      raw_material_in_out_id: { [Op.in]: rawMaterial_in_ids },
      ...(barcode && {barcode:barcode}) 
    },
    raw: true,
  });

  const totalQty = rawMaterialInQty[0]?.total_qty ? +rawMaterialInQty[0].total_qty : 0;

  return totalQty;
}

// Get Raw Material Out Stock Qty
export const getRawMaterialOutStockQty = async function(raw_material_id, depot_id, barcode=null) {

  const rawMaterialInOut = await RawMaterialInOut.findAll({
    where: { 
      ...(depot_id && { depot_id: depot_id }),
      status: 'Approved',
      // date_of_processing: { [Op.gte]: "2026-04-01"},
    }
  });

  const rawMaterial_out_ids = rawMaterialInOut.map(batch => batch.id);

  const rawMaterialOutQty = await RawMaterialInOutItem.findAll({
    attributes: [[fn('SUM', col('qty')), 'total_qty']],
    where: { 
      type:'Stock OUT',
      raw_material_id: raw_material_id, 
      raw_material_in_out_id: { [Op.in]: rawMaterial_out_ids },
      ...(barcode && {barcode:barcode})
    },
    raw: true,
  });

  const totalQty = rawMaterialOutQty[0]?.total_qty ? +rawMaterialOutQty[0].total_qty : 0;

  return totalQty;
}

export default RawMaterialInOut;