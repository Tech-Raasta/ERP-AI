// const config = require('config');
// const nodemailer = require('nodemailer');
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

// options.direct: the mail goes to its own recipient (a password reset link); without it every mail is sent to the
// technology mailbox, as before
const sendEmail = (mailOptions, options = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const transporter = nodemailer.createTransport({
        // service: 'gmail',

        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          // user: config.get('MAIL_EMAIL'),
          // pass: config.get('MAIL_PASSWORD')
          user: process.env.MAIL_EMAIL,
          pass: process.env.MAIL_PASSWORD
        },
        tls: {
          // do not fail on invalid certs
          rejectUnauthorized: false,
        },
      });

      // verify connection configuration
      // transporter.verify(function (error, success) {
      //   if (error) {
      //     console.log(error);
      //     reject(error);
      //   } else {
      //     console.log("Server is ready to take our messages");
      //   }
      // });
      
      // mailOptions = {
      //   from: 'technology@raastaconsulting.com',
      //   to: 'technology@raastaconsulting.com',
      //   subject: 'Proposal',
      //   text: 'This is your proposal!',
      //   html: '<b>This is your new proposal!</b>'
      // };
      // mailOptions.to = 'saurabh.mhatre@raastaconsulting.com';
      // mailOptions.cc = 'prasad.bhisale@raastaconsulting.com';
      // mailOptions.bcc = 'technology@raastaconsulting.com';

      if (!options.direct && process.env.ENVIRONMENT.trim().toUpperCase() === 'TEST') {
        mailOptions.to = 'prasad.bhisale@otbconsulting.co.in';
        mailOptions.cc = 'technology@raastaconsulting.com';
        mailOptions.bcc = 'technology@raastaconsulting.com';
      }

      if (!options.direct) {
        mailOptions.to = 'technology@raastaconsulting.com';
        mailOptions.cc = 'technology@raastaconsulting.com';
        mailOptions.bcc = 'prasad.bhisale@otbconsulting.co.in';
      }
    
      transporter.sendMail(mailOptions, function(error, info){
        if (error) {
          console.log(error);
          reject(error);
        } else {
          // console.log('Email sent: ' + info.response);
          resolve('Email sent: ' + info.response);
        }
      });
    
    } catch (error) {
      console.log(error);
      // return error;

      reject(error);
    }
  });
}

// exports.sendEmail = sendEmail;
export default sendEmail;