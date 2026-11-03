import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';
// import Product from './product.js';

const Category = sequelize.define('category_master', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  category_name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notNull: { msg: 'Category Name is required' },
      notEmpty: { msg: 'Category Name is required' }
    }
  },
  status: DataTypes.INTEGER,
  created_by: DataTypes.INTEGER,
  created_on: DataTypes.DATE,
  modified_by: DataTypes.INTEGER,
  modified_on: DataTypes.DATE,
  // Old PHP convention: is_deleted = 1 means the record is live, 0 means deleted
  is_deleted: DataTypes.INTEGER
},
{
  timestamps: true,
  createdAt: 'created_on',
  updatedAt: 'modified_on',
  freezeTableName: true
});

// Same filter the old PHP used everywhere: status = "1" and is_deleted = 1
Category.activeCondition = { status: 1, is_deleted: 1 };

Category.prototype.isActive = function() {
  return +this.status === 1 && +this.is_deleted === 1;
}

// Category.hasMany(Product, { foreignKey: 'category_id', as: 'products' });

Category.prototype.getRequestData = function(req) {
  this.category_name = req.body.category_name ? req.body.category_name.toString().trim() : '';
}

Category.prototype.validateData = async function() {
  try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    const count = await Category.count({ where: { ...Category.activeCondition, category_name: this.category_name, id: { [Op.ne]: (this.id ? this.id : 0) } }});
    if (count > 0) {
      return { errors : { category_name: { message: `Category Name (${this.category_name}) already exist` } } }
    }

    return null;
  } catch (error) {
    return error;
  }
}

// module.exports = Category;
export default Category;
