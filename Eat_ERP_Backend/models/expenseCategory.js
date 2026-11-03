import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';
// import Product from './product.js';

const ExpenseCategory = sequelize.define('exp_cat_master', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notNull: true,
      notEmpty: true
    }
  },
  status: DataTypes.INTEGER,
  created_by: DataTypes.INTEGER,
  created_date: DataTypes.DATE,
  updated_by: DataTypes.INTEGER,
  updated_date: DataTypes.DATE,
}, 
{
  timestamps: true,
  createdAt: 'created_date',
  updatedAt: 'updated_date',
  freezeTableName: true
});

// ExpenseCategory.hasMany(Product, { foreignKey: 'category_id', as: 'products' });

ExpenseCategory.prototype.getRequestData = function(req) {
  this.category = req.body.category;
}

ExpenseCategory.prototype.validateData = async function() {
  try {
    const error = await this.validate().then(() => null, error => error);
    if (error) {
      return error;
    }

    const count = await ExpenseCategory.count({ where: { category: this.category, id: { [Op.ne]: this.id } }});
    if (count > 0) {
      return { errors : { category: { message: `Expense Category Name (${this.category}) already exist` } } }
    }
    
    return null;
  } catch (error) {
    return error;
  }
}

// module.exports = ExpenseCategory;
export default ExpenseCategory;