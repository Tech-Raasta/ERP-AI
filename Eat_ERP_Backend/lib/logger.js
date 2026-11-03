import winston from 'winston';
// const winston = require("winston");
// require("winston-mongodb");
// const config = require('config');

// const MONGODB_URI = "mongodb+srv://technology:" +
//   process.env.WYNMONGOATLASPW +
//   "@cluster0.4gwry1q.mongodb.net/win?retryWrites=true&w=majority";

// const MONGODB_URI = config.get('mongodb.host') + 
//   config.get('MONGOATLASPW') + 
//   config.get('mongodb.cluster') + 
//   config.get('mongodb.database') + 
//   config.get('mongodb.options');


export default winston.createLogger({
  // const mongoClient = new MongoClient(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  transports: [
    new winston.transports.Console({ level: 'error', handleExceptions: true, format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ) }),
    new winston.transports.File({ filename: './log/error.log', level: 'error', format: winston.format.json() }),
    new winston.transports.File({ filename: './log/combined.log', level: 'info', format: winston.format.json() }),
    // new winston.transports.MongoDB({ 
    //   db: MONGODB_URI, 
    //   options: { useNewUrlParser: true, useUnifiedTopology: true }
    // }, { level: 'info', format: winston.format.json() })
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: './log/exceptions.log' })
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: './log/rejections.log' })
  ],
  exitOnError: false
});