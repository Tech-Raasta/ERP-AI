import { Op } from 'sequelize';
import ExpenseCategory from '../models/expenseCategory.js';


export const createExpenseCategory = async (req, res, next) => {
  try {
    // console.log(req.body, req.userData);

    const expenseCategory = await ExpenseCategory.build({
      status:'Approved',
      created_by: req.userData.userId,
      updated_by: req.userData.userId
    });

    expenseCategory.getRequestData(req);

    // throw new Error('Test Error Logging');

    const error = await expenseCategory.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }
    
    await expenseCategory.save();

    return res.status(201).json({
      message: "Expense Category added successfully",
      expenseCategory: expenseCategory
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Creating a category failed!"
    // });
    res.statusCode = 500;
    res.message = "Creating an expense category failed!";
    next(error, req, res);
  }
};

export const updateExpenseCategory = async (req, res, next) => {
  try {
    const expenseCategory = await ExpenseCategory.findByPk(req.params.id);

    if (!expenseCategory) {
      return res.status(404).json({
        message: "Expense Category not found!"
      });
    }

    expenseCategory.getRequestData(req);
    expenseCategory.status = "Approved";
    expenseCategory.updated_by = req.userData.userId;

    const error = await expenseCategory.validateData();
    // console.log(error);
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }
    
    await expenseCategory.save();
    res.status(200).json({ message: "Update successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Couldn't udpate category!"
    // });
    
    res.statusCode = 500;
    res.message = "Couldn't udpate expense category!";
    next(error, req, res);
  }
};

export const getExpenseCategories = async (req, res, next) => {
  try {
    const pageSize = +req.query.pageSize;
    const pageIndex = +req.query.pageIndex;
    const query = req.query.query;
    const status = req.query.status ? req.query.status : "Approved";
    const sort = { key: req.query.key, order: req.query.order };

    const statusCount = {
      approved: 0,
      inActive: 0
    };

    let condition = {};
    let searchCondition ={}
    let statusCondition = {};

    if (query) {
      searchCondition = {
        'category': {
          [Op.like]: `%${query}%`
        }
      };

      condition['where'] = searchCondition;
    }

    const countData = await ExpenseCategory.findAll({...condition, attributes:[
      'status'
    ], raw:true});

    for(const item of countData){
      if(item.status === 'Approved'){
        statusCount.approved +=1;
      }else{
        statusCount.inActive +=1;
      }
    }


    statusCondition = {status:status}
    if (query) {
      searchCondition = {
        'category': {
          [Op.like]: `%${query}%`
        }
      };

      condition['where'] = {
        [Op.and] : [
          searchCondition,
          statusCondition
        ]
      }
    }else{
      condition['where'] = statusCondition
    }

    let order = [['updated_date', 'DESC']];
    if (sort) {
      if (sort.key) {
        order = [[sort.key, (sort.order ? sort.order : 'ASC')]];
      }
    }
    condition['order'] = order;

    if (pageIndex) {
      condition['offset'] = (pageIndex * pageSize);
    }
    
    if (pageSize) {
      condition['limit'] = pageSize;
    }

    const { count, rows } = await ExpenseCategory.findAndCountAll(condition);

    res.status(200).json({
      message: "Expense Categories fetched successfully!",
      rows: rows,
      statusCount:statusCount,
      total: count
    });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching categories failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching expense categories failed!";
    next(error, req, res);
  }
};

export const getExpenseCategory = async (req, res, next) => {
  try {
    const expenseCategory = await ExpenseCategory.findByPk(req.params.id);
    if (expenseCategory) {
      res.status(200).json(expenseCategory);
    } else {
      res.status(404).json({ message: "Expense Category not found!" });
    }
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching category failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Fetching expense category failed!";
    next(error, req, res);
  }
};

export const deleteExpenseCategory = async (req, res, next) => {
  try {
    const expenseCategory = await ExpenseCategory.findByPk(req.params.id);

    if (!expenseCategory) {
      return res.status(404).json({
        message: "Expense Category not found!"
      });
    }

    expenseCategory.status = "InActive";
    expenseCategory.updated_by = req.userData.userId;

    const error = await expenseCategory.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }
    
    await expenseCategory.save();
    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Deleting category failed!"
    // });
    
    res.statusCode = 500;
    res.message = "Deleting expense category failed!";
    next(error, req, res);
  }
};