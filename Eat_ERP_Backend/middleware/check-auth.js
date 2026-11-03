import jwt from 'jsonwebtoken';
// import config from 'config';
import dotenv from 'dotenv';

import User, { USER_ADMIN_ROLES } from '../models/user.js';
import { validFrom, isRevoked } from '../lib/sessions.js';
import { isAccessToken, sessionActive } from '../lib/authTokens.js';
import UserRole from '../models/userRole.js';

dotenv.config();

// 400 ends the session in the frontend (BaseService signs the user out); 401 is "no access", 403 the expired password
const SESSION_ENDED = 400;
const TOKEN_ERRORS = ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'];

export default async (req, res, next) => {
  try {
    // console.log('Check-auth is been called');
    if (!req.headers || !req.headers.authorization || req.headers.authorization.indexOf(" ") === -1) {
      return res.status(400).json({ message: "You are not authenticated!" });
    }

    const token = req.headers.authorization.split(" ")[1];
    // const decodedToken = jwt.verify(token, config.get('JWTKEY'));
    const decodedToken = jwt.verify(token, process.env.JWTKEY);
    // A password-reset link (or any token not made for signing in) never opens the API
    if (!isAccessToken(decodedToken)) {
      return res.status(SESSION_ENDED).json({ message: "Invalid token!" });
    }
    req.userData = {
      email: decodedToken.email,
      userId: decodedToken.userId,
      userRoleId: decodedToken.userRoleId,
      // roleDetails: decodedToken.roleDetails ? decodedToken.roleDetails : {}
      roleDetails: {},
      depotIds: ''
    };

    if (!req.baseUrl) {
      return res.status(401).json({ message: "You are not authorised!" });
    }

    const user = await User.findByPk(decodedToken.userId);
    if(!user || (user.status || '').trim().toUpperCase() === "INACTIVE") {
      // A deactivated user is signed out at once, not left on screens that all fail
      return res.status(SESSION_ENDED).json({ message: "Your account is not active. Please contact your administrator." });
    } else if (decodedToken.sid ? !(await sessionActive(decodedToken.sid)) : isRevoked(decodedToken, await validFrom(user.id))) {
      return res.status(SESSION_ENDED).json({ message: "You have been signed out. Please sign in again." });
    } else {
      req.userData.depotIds = user.depot_ids ? user.depot_ids.split(',') : '';
      // The role in the database, not the one in the token: a changed role counts at once, not at the next login
      req.userData.userRoleId = user.role_id;
    }

    const now = new Date();
    if(user.expiry_date){
      if (now > user.expiry_date) {
        return res.status(403).json({
          message: 'Password expired. Please reset your password.',
          code: 'PASSWORD_EXPIRED',
        });
      }
    }else{
      if(user.modified_on && now > user.modified_on){
        return res.status(403).json({
          message: 'Password expired. Please reset your password.',
          code: 'PASSWORD_EXPIRED',
        });
      }
    }

    let baseUrl = req.baseUrl.trim().toUpperCase();

    // End of Month Sales is role based (Admin), not a role section: its controller checks the role
    if (baseUrl !== "/API/SECTIONS" && baseUrl !== "/API/END_OF_MONTH_SALES") {
      // console.log(req.baseUrl);
      // const userRole = await UserRole.findById(decodedToken.userRoleId);
      const userRole = await UserRole.findByPk(user.role_id, {include: ["sections"]});
      let checkSection = baseUrl;

      // if (baseUrl === '/API/FINANCE_VOUCHER') {
      //   baseUrl = '/API/RAW_MATERIAL_IN';
      //   baseUrl = '/API/PURCHASE_ORDER';
      // }

      if (baseUrl.trim().toUpperCase() === '/API/PRODUCTION') {
        checkSection = '/API/BATCH_PROCESSING';
      } else if (baseUrl.trim().toUpperCase() === '/API/STORE_MANAGER') {
        checkSection = '/API/RAW_MATERIAL_IN';
      } else if (baseUrl.trim().toUpperCase() === '/API/PRODUCTION_PLANNING') {
        checkSection = '/API/PURCHASE_ORDER';
      } else if (baseUrl.trim().toUpperCase() === '/API/RAW_MATERIAL_IN_OUT' || baseUrl.trim().toUpperCase() === '/API/RAW_MATERIAL_RECON') {
        checkSection = '/API/RAW_MATERIAL_IN';
      } else if (baseUrl.trim().toUpperCase() === '/API/REQUISITION') {
        checkSection = '/API/BATCH_PROCESSING';
      } else if (baseUrl.trim().toUpperCase() === '/API/PACKAGING') {
        checkSection = '/API/BATCH_PROCESSING';
      } else if (baseUrl.trim().toUpperCase() === '/API/STORE_PACKAGING_MANAGER') {
        checkSection = '/API/RAW_MATERIAL_IN';
      } else if (baseUrl.trim().toUpperCase() === '/API/DEPOT_TRANSFER_UPLOAD' || baseUrl.trim().toUpperCase() === '/API/PAYMENT_UPLOAD') {
        checkSection = '/API/RAW_MATERIAL_IN';
      } else if (baseUrl.trim().toUpperCase() === '/API/PRODUCTION_TRANSFER') {
        checkSection = '/API/RAW_MATERIAL_IN';
      } else if (baseUrl.trim().toUpperCase() === '/API/EASYECOMAPIS') {
        checkSection = '/API/RAW_MATERIAL_IN';
      } else if (baseUrl.trim().toUpperCase() === '/API/EASYECOMINVENTORY') {
        checkSection = '/API/RAW_MATERIAL_IN';
      }else if( baseUrl.trim().toUpperCase() === '/API/EXPENSE_CATEGORY' ){
        checkSection = '/API/FINANCE_VOUCHER';
      } else if (baseUrl.trim().toUpperCase() === '/API/OLD_PAYMENT_UPLOAD') {
        // Old PHP Payment_upload_model::get_access uses the 'Payment' section
        checkSection = '/API/PAYMENT';
      } else if (baseUrl.trim().toUpperCase() === '/API/CATEGORY') {
        // Category menu is shown from the Product role (user.js roleDetails.category)
        checkSection = '/API/PRODUCT';
      } else if (baseUrl.trim().toUpperCase() === '/API/COMBO_BOX') {
        // Old PHP Combo_box_model::get_access uses the 'Box' section
        checkSection = '/API/BOX';
      } else if (baseUrl.trim().toUpperCase() === '/API/SALES' || baseUrl.trim().toUpperCase() === '/API/SAMPLE_OUT' || baseUrl.trim().toUpperCase() === '/API/SALE_UPLOAD') {
        // Old PHP Sales, Sample / Expiry and Sales Upload (Distributor_out_model / Sample_out_model / Sales_upload_model::get_access) use the 'Distributor_Out' section
        checkSection = '/API/DISTRIBUTOR_OUT';
      } else if (baseUrl.trim().toUpperCase() === '/API/SALES_RETURN' || baseUrl.trim().toUpperCase() === '/API/SALES_RETURN_UPLOAD') {
        // Old PHP Sales Return and Sales Return Upload (Distributor_in_model / Sales_return_upload_model::get_access) use the 'Distributor_In' section
        checkSection = '/API/DISTRIBUTOR_IN';
      } else if (baseUrl.trim().toUpperCase() === '/API/LOCATION') {
        // Old PHP Location_model::get_access uses the 'Area' section
        checkSection = '/API/AREA';
      } else if (baseUrl.trim().toUpperCase() === '/API/RECIPE') {
        // Old PHP Recipe Master (Ingredients_master) uses the 'Ingredient_Master' section
        checkSection = '/API/INGREDIENT_MASTER';
      } else if (baseUrl.trim().toUpperCase() === '/API/PINCODE') {
        // Old PHP menu shows Global -> Pincode Master from the 'City_Master' section
        checkSection = '/API/CITY_MASTER';
      }

      let authorised = false;

      if(userRole && userRole.sections) {
        // console.log(userRole.sections);
        const section = userRole.sections.filter((section) => ("/API/" + section.section.trim().toUpperCase()) === checkSection);

        if (section) {
          // console.log(section[0].dataValues);

          if (section.length > 0) {
            const roleDetails = section[0].dataValues;

            // console.log(roleDetails);

            req.userData.roleDetails = roleDetails;

            if (roleDetails.section.trim().toUpperCase() === 'REPORTS' && roleDetails.r_view) {
              authorised = true;
            } else if (req.method.trim().toUpperCase() === 'GET' && roleDetails.r_view) {
              authorised = true;
            } else if (req.method.trim().toUpperCase() === 'PUT' && roleDetails.r_edit) {
              authorised = true;
            } else if (req.method.trim().toUpperCase() === 'DELETE' && roleDetails.r_delete) {
              authorised = true;
            } else if (req.url.search(/Approve/i) !== -1 && roleDetails.r_approvals) {
              authorised = true;
            } else if (req.url.search(/Reject/i) !== -1 && roleDetails.r_approvals) {
              authorised = true;
            } else if (req.url.search(/Download/i) !== -1 && roleDetails.r_export) {
              authorised = true;
            } else if (req.method.trim().toUpperCase() === 'POST' && roleDetails.r_insert) {
              authorised = true;
            }
          }
        }
      }

      // Admin and Super Admin can always manage users and roles, whatever their role options say
      if ((checkSection === '/API/USER' || checkSection === '/API/USER_ROLES') && USER_ADMIN_ROLES.includes(+user.role_id)) {
        req.userData.roleDetails = { ...req.userData.roleDetails, r_view: 1, r_insert: 1, r_edit: 1, r_delete: 1, r_approvals: 1 };
        authorised = true;
      }

      if (!authorised) {
        return res.status(401).json({ message: "You are not authorised!" });
      }
    }

    next();
  } catch (error) {
    // A bad or expired token ends the session; anything else (database down...) is a server error, not a sign-out
    // An expired access token is normal every 15 minutes: the page refreshes it and repeats the request
    if (error && error.name === 'TokenExpiredError') {
      return res.status(SESSION_ENDED).json({ message: "Your session has expired. Please sign in again.", code: 'TOKEN_EXPIRED' });
    }
    if (TOKEN_ERRORS.includes(error && error.name)) {
      return res.status(SESSION_ENDED).json({ message: "Invalid token!" });
    }
    res.statusCode = 500;
    res.message = "Checking your access failed!";
    return next(error, req, res);
  }
};
