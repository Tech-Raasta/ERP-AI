import { DataTypes, Op } from 'sequelize';
import sequelize from '../lib/database.js';

const Series = sequelize.define('series_master', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notNull: true
    }
  },
  series: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true
    }
  }
}, 
{ 
  timestamps: false,
  freezeTableName: true
});

// Series.prototype.getSeries = async function (req, seriesType) {

export const getSeries = async function (req, seriesType) {
  // try {
    let series = await Series.findOne({ where: { type: seriesType }});
    let count = 1;

    if (series) {
      count = parseInt(series.series) + 1;
    }

    // console.log(count);
    
    // if (updateSeries) {
      if (series) {
        series.series = count;
      } else {
        series = await Series.build({
          type: seriesType,
          series: count
        });
      }
    // }

    return series;
  // } catch (error) {
  //   return error;
  // }
}

export default Series;