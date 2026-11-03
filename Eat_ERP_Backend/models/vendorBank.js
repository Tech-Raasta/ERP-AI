import { DataTypes } from 'sequelize';
import sequelize from '../lib/database.js';

const VendorBank = sequelize.define('vendor_bank_master', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  bank_name: {
    type: DataTypes.STRING,
    unique: true,
    validate: {
      notnotEmpty: true
    }
  }
}, 
{ 
  timestamps: false,
  freezeTableName: true
});

// Series.prototype.getSeries = async function (req, seriesType) {

// export const getSeries = async function (req, seriesType) {
//   // try {
//     let series = await Series.findOne({ where: { type: seriesType }});
//     let count = 1;

//     if (series) {
//       count = parseInt(series.series) + 1;
//     }

//     // console.log(count);
    
//     // if (updateSeries) {
//       if (series) {
//         series.series = count;
//       } else {
//         series = await Series.build({
//           type: seriesType,
//           series: count
//         });
//       }
//     // }

//     return series;
//   // } catch (error) {
//   //   return error;
//   // }
// }

export default VendorBank;