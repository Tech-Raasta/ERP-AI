import { DataTypes } from "sequelize";
import sequelize from "../lib/database.js";
import sendEmail from "../lib/email.js";
import { getUploadPath } from "../lib/common.js";

const ExhibitionVisitor = sequelize.define('exhibition_visitor', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true
  },
  business: {
    type: DataTypes.STRING,
  },
  full_name: {
    type: DataTypes.STRING,
  },
  company: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  state: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  phone_no: {
    type: DataTypes.INTEGER,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  created_date: DataTypes.DATE
}, 
{ 
  timestamps: false,
//   createdAt: 'created_date',
  // updatedAt: 'modified_on',
  freezeTableName: true
});

ExhibitionVisitor.prototype.getRequestData = async function(req) {
    try {
        this.business = req.body.business ? req.body.business.trim() : '';
        this.full_name = req.body.full_name ? req.body.full_name.trim() : '';
        this.company = req.body.company ? req.body.company.trim() : '';
        this.state = req.body.state ? req.body.state.trim() : '';
        this.phone_no = req.body.phone_no ? +req.body.phone_no : null;
        this.email = req.body.email ? req.body.email.trim() : '';
        let message = `<html> <head>
                        <style>
                            h3{
                                font-size: 15px;
                                font-family: sans-serif;
                                margin-bottom: 15px;
                            }
                            h4{
                                font-size: 13px;
                                font-family: sans-serif;
                                margin-top: 0;
                            }
                        </style>
                    </head>
                    <body>
                        <h4>Gift India Expo 2025 Visitor details</h4>
                        Business: ${this.business} <br>
                        Name: ${this.full_name} <br>
                        Company: ${this.company} <br>
                        Location: ${this.state} <br>
                        Phone No.: ${this.phone_no} <br>
                        Email ID: ${this.email} <br><br/>
                        Regards,
                        <br/>
                        CS
                    </body>
                    </html>`;
        

        const mailOptions = {
            // from: 'EAT MIS <cs@eatanytime.in>',
            // to: 'product@eatanytime.in, product1@eatanytime.in, prachi.sanghvi@eatanytime.in, orders@eatanytime.in, kumar.devwrat@eatanytime.in',
            // cc: 'lakshya.ajmera@eatanytime.in, rishit.sanghvi@eatanytime.in, dhaval.maru@otbconsulting.co.in',
            // bcc: 'prasad.bhisale@otbconsulting.co.in',
            to: 'technology@raastaconsulting.com',
            cc: 'dhaval.maru@otbconsulting.co.in, technology@raastaconsulting.com',
            bcc: 'technology@raastaconsulting.com',
            // bcc: 'rishit.sanghvi@eatanytime.in',
            subject: "Gift India Expo 2025 Visitor details",
            text: message,
            html: message,
            // attachments: [{ path: catelogue }]
        };
        return sendEmail(mailOptions);

    } catch (error) {
        return error;
    }
}

export default ExhibitionVisitor;