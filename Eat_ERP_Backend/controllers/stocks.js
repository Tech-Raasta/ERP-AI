import { Op } from 'sequelize';
import sequelize from '../lib/database.js';
import { Sequelize } from 'sequelize';
import Stock from '../models/stock.js';

export const getBarcodeStock = async (req, res, next) => {
  try {
    // const stock = await Stock.getBarcodeStock(req);

    // return res.status(200).json({ stock });
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
