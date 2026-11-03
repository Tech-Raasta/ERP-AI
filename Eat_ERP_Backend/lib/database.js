import Sequelize from 'sequelize';
// import config from 'config';
import dotenv from 'dotenv';
dotenv.config();

// const sequelize = new Sequelize(config.get('mysql.database'), config.get('mysql.user'), config.get('mysql.password'), {
//     dialect: 'mysql',
//     host: config.get('mysql.host'),
//     logging: false
// });

const sequelize = new Sequelize(process.env.DATABASE, process.env.DB_USER, process.env.PASSWORD, {
    dialect: 'mysql',
    host: process.env.HOST,
    logging: false,
    timezone: "+05:30"
});

// Test connection
sequelize.authenticate()
  .then(() => {
    console.log('Connection has been established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });

export default sequelize;
// module.exports = sequelize;
