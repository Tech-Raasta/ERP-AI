import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';

// import PurchaseOrder from './purchaseOrder.js';
// import PurchaseOrderItem from './purchaseOrderItem.js';

const RawMaterial = sequelize.define('raw_material_master', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  rm_name: {
    type: DataTypes.STRING,
    unique: true,
    validate: {
      notEmpty: true
    }
  },
  rate: { 
    type: DataTypes.NUMBER,
    allowNull: false,
    validate: {
      notNull: true,
      isNumeric: true
    }
  },
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
  hsn_code: { 
    type: DataTypes.STRING,
    validate: {
      notEmpty: true
    }
  },
  tax_per: { 
    type: DataTypes.NUMBER,
    allowNull: false,
    validate: {
      notNull: true,
      isNumeric: true
    }
  },
  material_type: { 
    type: DataTypes.STRING,
    validate: {
      notEmpty: true,
      isIn: {
        args: [['Raw Material', 'Packaging Material', 'Asset']],
        msg: "Must be Raw Material, Packaging Material or Asset"
      }
    }
  },
  packaging_type: { 
    type: DataTypes.STRING,
    validate: {
      isIn: {
        args: [['', 'Primary', 'Secondary', "Tertiary"]],
        msg: "Must be Primary, Secondary or Tertiary"
      }
    }
  },
  shelf_life: {
    type: DataTypes.INTEGER,
    validate: {
      isNumeric: true
    }
  },
  standard_quantity: {
    type: DataTypes.INTEGER,
    validate: {
      isNumeric: true
    }
  }
}, 
{
  timestamps: true,
  createdAt: 'created_on',
  updatedAt: 'modified_on',
  freezeTableName: true
});

// RawMaterial.belongsToMany(PurchaseOrder, { through : PurchaseOrderItem, foreignKey: ['purchase_order_id'] });

RawMaterial.prototype.getRequestData = async function(req) {
  this.rm_name = req.body.rm_name ? req.body.rm_name.trim() : '';
  this.rate = (req.body.rate) ? +req.body.rate : 0;
  this.hsn_code = req.body.hsn_code ? req.body.hsn_code.trim() : '';
  this.tax_per = (req.body.tax_per) ? +req.body.tax_per : 0;
  this.material_type = req.body.material_type ? req.body.material_type.trim() : '';
  this.packaging_type = req.body.packaging_type ? req.body.packaging_type.trim() : '';
  this.status = req.body.status ? req.body.status.trim() : '';
  this.remarks = req.body.remarks ? req.body.remarks.trim() : '';
  this.shelf_life = (req.body.shelf_life) ? +req.body.shelf_life : 0;
  this.standard_quantity = (req.body.standard_quantity) ? +req.body.standard_quantity : 0;
}

RawMaterial.prototype.validateData = async function() {
  try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    let count = await RawMaterial.count({ where: { status: 'Approved', rm_name: this.rm_name, id: { [Op.ne]: (this.id ? this.id : 0) } }});
    if (count > 0) {
      return { errors : { rm_name: { message: `${this.material_type || 'Raw Material'} Name (${this.rm_name}) already exist` } } }
    }

    return null;
  } catch (error) {
    return error;
  }
}

export const getRawMaterialType = async (raw_material_id) => {
  try {
    const rawMaterial = await RawMaterial.findOne({ where: { id: raw_material_id }});
    if (rawMaterial) {
      return rawMaterial.material_type;
    }
    return null;
  } catch (error) {
    throw new Error("Fetching Raw Material Type failed!");
  }
}

export default RawMaterial;