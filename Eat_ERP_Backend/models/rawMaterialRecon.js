import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';

import Depot from './depot.js';
import RawMaterialReconItem from './rawMaterialReconItem.js';
import User from './user.js';
import RawMaterial from './rawMaterial.js';
// import BatchRawMaterial from './batchRawMaterial.js';
// import BatchProcessing from './batchProcessing.js';
import RawMaterialInItemWeight from './rawMaterialInItemWeight.js';
import RawMaterialIn from './rawMaterialIn.js';
import Stock from './stock.js';

const RawMaterialRecon = sequelize.define('raw_material_recon', {
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
  // type: DataTypes.STRING,
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
  // ref_no: DataTypes.STRING,
  item_names: DataTypes.TEXT
}, 
{ 
  timestamps: false,
  // createdAt: 'created_on',
  // updatedAt: 'modified_on',
  freezeTableName: true
});

RawMaterialRecon.belongsTo(Depot, { foreignKey: "depot_id", as: "depot" });
// RawMaterialRecon.belongsTo(Production, { foreignKey: "production_id", as: "production" });
RawMaterialRecon.hasMany(RawMaterialReconItem, { foreignKey: "raw_material_recon_id", as: "rawMaterialReconItems", onDelete: 'CASCADE' });
// RawMaterialRecon.belongsToMany(RawMaterial, { through : RawMaterialReconItem, as: "raw_material", foreignKey: 'raw_material_recon_id' });
RawMaterialRecon.belongsTo(User, { foreignKey: "created_by", as: "created_by_user" });
RawMaterialRecon.belongsTo(User, { foreignKey: "modified_by", as: "modified_by_user" });
RawMaterialRecon.belongsTo(User, { foreignKey: "approved_by", as: "approved_by_user" });

export const getRawMaterialReconMasterData = async function(rawMaterialRecon, req) {
  // try {
    let depotCond = { where: {status: 'Approved', type: {[Op.in]: ['Manufacturer', 'Depot']}, id: {[Op.in]: req.userData.depotIds}} };
    let rawMaterialCond = { where: {status: 'Approved'} };

    if (rawMaterialRecon) {
      if (rawMaterialRecon.depot_id) {
        depotCond = { where: {[Op.or]: [{ status: 'Approved', id: {[Op.in]: req.userData.depotIds} }, { id: rawMaterialRecon.depot_id }]} };
      }
      if (rawMaterialRecon.rawMaterialReconItems && rawMaterialRecon.rawMaterialReconItems.length > 0) {
        const rawMaterialIds = rawMaterialRecon.rawMaterialReconItems.map(rawMaterialReconItem => rawMaterialReconItem.raw_material_id);
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

export const getBarcodeStockForRecon = async function(raw_material_in_out_id, depot_id, barcode) {
  // try {
    const stock = await Stock.getBarcodeStock(depot_id, barcode, 'Raw Material In Out', raw_material_in_out_id);
    return stock;
  // } catch (error) {
  //   // console.log('Error', error);
  //   return error;
  // }
}

RawMaterialRecon.prototype.getRequestData = function(req) {
  // try {
    const body = req.body ? req.body : null;

    this.date_of_processing = body.date_of_processing ? new Date(body.date_of_processing).toISOString() : null;
    this.depot_id = body.depot_id ? +body.depot_id : null;
    // this.type = body.type ? body.type : '';
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

RawMaterialRecon.prototype.getRawMaterialReconItems = function(body) {
  // try {
    const rawMaterialReconItems = [];
    if (body.rawMaterialReconItems) {
      for (const postedRawMaterialReconItem of body.rawMaterialReconItems) {
        // const type = (postedRawMaterialReconItem.type) ? postedRawMaterialReconItem.type : '';
        const raw_material_id = (postedRawMaterialReconItem.raw_material_id) ? +postedRawMaterialReconItem.raw_material_id : null;
        const barcode = (postedRawMaterialReconItem.barcode) ? postedRawMaterialReconItem.barcode : '';
        const expiry_date = (postedRawMaterialReconItem.expiry_date) ? postedRawMaterialReconItem.expiry_date : null;
        const system_qty = (postedRawMaterialReconItem.system_qty) ? +postedRawMaterialReconItem.system_qty : 0;
        const physical_qty = (postedRawMaterialReconItem.physical_qty) ? +postedRawMaterialReconItem.physical_qty : 0;
        const difference_qty = (postedRawMaterialReconItem.difference_qty) ? +postedRawMaterialReconItem.difference_qty : 0;
  
        const rawMaterialReconItem = {
          raw_material_recon_id: this.id,
          // type: type,
          raw_material_id: raw_material_id,
          barcode: barcode,
          expiry_date: expiry_date,
          system_qty: system_qty,
          physical_qty: physical_qty,
          difference_qty: difference_qty,
        };

        rawMaterialReconItems.push(rawMaterialReconItem);
      }
    }
    
    return rawMaterialReconItems;
  // } catch (error) {
  //   return error;
  // }
}

RawMaterialRecon.prototype.setDetails = async function(rawMaterialReconItems) {
  const depot = await Depot.findByPk(this.depot_id);
  this.depot_name = depot && depot.depot_name ? depot.depot_name : '';

  this.item_names = rawMaterialReconItems.map(item => item.rm_name).join(',');

  return true;
}

RawMaterialRecon.prototype.approve = function(req) {
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

RawMaterialRecon.prototype.reject = function(req) {
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

RawMaterialRecon.prototype.validateData = async function() {
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

export default RawMaterialRecon;