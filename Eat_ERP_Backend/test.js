import Sequelize from 'sequelize';
import database from '../lib/database.js';

async function testDatabaseConnection() {
  try {
    await database.authenticate();
    console.log('Connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }

  console.log('Database name:', database.config.database);
  console.log('Username:', database.config.username);
  console.log('Password:', database.config.password);
  console.log('Host:', database.config.host);
  console.log('Dialect:', database.config.dialect);
  console.log('Logging:', database.config.logging);
}

testDatabaseConnection();
