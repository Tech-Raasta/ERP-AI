import bcrypt from 'bcryptjs';
import { endSessions } from '../lib/sessions.js';
import { ACCESS_MINUTES, startSession, rotateSession, endSessionOfCookie, endAllSessions, pruneSessions } from '../lib/authTokens.js';

// What the screens need about the signed-in user (sign-in, refresh and /me answer the same)
const profileOf = async (user) => ({
  email: user.email_id,
  userId: user.id,
  userName: user.first_name,
  userRoleId: user.role_id,
  show_favourites: user.show_favourites,
  favourites: user.favourites,
  roleDetails: await user.getUserRoleDetails(),
  role: user.role
});

// The refresh cookie is sent by the browser on its own, so a refresh must also prove it comes from the ERP page: a
// custom header (no plain form or link can add one) and, when the browser names it, an allowed origin
const fromErpPage = (req) => {
  if (String(req.headers['x-requested-with'] || '') !== 'XMLHttpRequest') return false;
  const origin = req.headers.origin;
  return !origin || (req.app.get('allowedOrigins') || []).includes(origin);
};
// import jwt from 'jsonwebtoken';
// import config from 'config';

import User from '../models/user.js';
import UserRole from '../models/userRole.js';

export const userSignUp = async (req, res, next) => {
  let user = await User.findOne({ where: { email: req.body.email }});

  if (user) {
    return res.status(401).json({
      message: "User already registered!"
    });
  }

  bcrypt.hash(req.body.password, 10).then(hash => {
    user = new User({
      userName: req.body.userName,
      email: req.body.email,
      password: hash
    });
    user
      .save()
      .then(result => {
        res.status(201).json({
          message: "User created!",
          result: result
        });
      })
      .catch(err => {
        // res.status(500).json({
        //   message: "Invalid authentication credentials!"
        // });

        res.statusCode = 500;
        res.message = "Invalid authentication credentials!";
        next(err, req, res);
      });
  });
}

export const userLogin = async (req, res, next) => {
  let fetchedUser;
  try {
    // console.log(req.body.email_id);
    const email = String((req.body && req.body.email_id) || '').trim();
    const password = String((req.body && req.body.password) || '');
    if (!email || !password) {
      return res.status(422).json({ message: "Please enter your email and password." });
    }
    const user = await User.findOne({
      where: { email_id: email, password },
      include: 'role'
    });
    if (!user) {
      return res.status(401).json({
        message: "The email or password is not correct."
      });
    }
    // PHP and check-auth refuse a deactivated user; signing in must too, not hand out a token that fails everywhere
    if ((user.status || '').trim().toUpperCase() === 'INACTIVE') {
      return res.status(401).json({ message: "Your account is not active. Please contact your administrator." });
    }
    fetchedUser = user;
    // return bcrypt.compare(req.body.password, user.password);

    // const token = jwt.sign(
    //   { email: fetchedUser.email_id, userName: fetchedUser.first_name, userId: fetchedUser.id, userRoleId: fetchedUser.role_id },
    //   config.get('JWTKEY'),
    //   { expiresIn: "10h" }
    // );

    // const now = new Date();

    // if (user.expiry_date && now > user.expiry_date) {
    //   return res.status(403).json({
    //     message: 'Password expired. Please reset your password.',
    //     code: 'PASSWORD_EXPIRED',
    //   });
    // }

    // The session goes in the httpOnly cookie; the answer carries only the short access token
    const sid = await startSession(req, res, user.id, !!req.body.rememberMe);
    pruneSessions().catch(() => {});

    res.status(200).json({
      token: user.generateAuthToken(sid || undefined),
      expiresIn: ACCESS_MINUTES * 60,
      persistent: !!sid,
      ...(await profileOf(fetchedUser))
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Invalid authentication credentials!";
    next(error, req, res);
  }


  // User
  //   .findOne({ where: { email_id: req.body.email, password: req.body.password }})
  //   .then(user => {
  //     if (!user) {
  //       return res.status(401).json({
  //         message: "Auth failed"
  //       });
  //     }
  //     fetchedUser = user;
  //     // return bcrypt.compare(req.body.password, user.password);
  //     res.status(200).json({
  //       // token: token,
  //       // expiresIn: 36000,
  //       userId: fetchedUser.id,
  //       userName: fetchedUser.first_name,
  //       userRole: fetchedUser.role_id
  //     });
  //   })
  //   .catch(err => {
  //     // console.log(err);
  //     // return res.status(401).json({
  //     //   message: "Invalid authentication credentials!"
  //     // });

  //     res.statusCode = 500;
  //     res.message = "Invalid authentication credentials!";
  //     next(err, req, res);
  //   });

  // User
  //   .findOne({ email: req.body.email })
  //   .populate('userRole')
  //   .then(user => {
  //     if (!user) {
  //       return res.status(401).json({
  //         message: "Auth failed"
  //       });
  //     }
  //     fetchedUser = user;
  //     return bcrypt.compare(req.body.password, user.password);
  //   })
  //   .then(result => {
  //     if (!result) {
  //       return res.status(401).json({
  //         message: "Auth failed"
  //       });
  //     }
  //     const userRoleId = fetchedUser.userRole && fetchedUser.userRole._id ? fetchedUser.userRole._id : fetchedUser.userRole;
  //     const token = jwt.sign(
  //       { userName: fetchedUser.userName, userId: fetchedUser._id, userRoleId: userRoleId },
  //       config.get('JWTKEY'),
  //       { expiresIn: "10h" }
  //     );
  //     res.status(200).json({
  //       token: token,
  //       expiresIn: 36000,
  //       userId: fetchedUser._id,
  //       userName: fetchedUser.userName,
  //       userRole: fetchedUser.userRole
  //     });
  //   })
  //   .catch(err => {
  //     // console.log(err);
  //     // return res.status(401).json({
  //     //   message: "Invalid authentication credentials!"
  //     // });

  //     res.statusCode = 500;
  //     res.message = "Invalid authentication credentials!";
  //     next(error, req, res);
  //   });
}

export const createUser = async (req, res, next) => {
  try {
    const user = new User({
      status: 'Approved',
      createdBy: req.userData.userId,
      updatedBy: req.userData.userId
    });

    await user.getRequestData(req);

    const error = await user.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    await user.save();

    return res.status(201).json({
      message: "User added successfully",
      user: user
    });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Creating a user failed!"
    // });

    res.statusCode = 500;
    res.message = "Creating a User failed!";
    next(error, req, res);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const user = await User.findById({ _id: req.params.id });

    if (!user) {
      return res.status(404).json({
        message: "User not found!"
      });
    }

    await user.getRequestData(req);
    user.updatedBy = req.userData.userId;

    const error = await user.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    await user.save();
    res.status(200).json({ message: "Update successful!" });
  } catch (error) {
    // console.log(error);
    // res.status(500).json({
    //   message: "Couldn't udpate user!"
    // });

    res.statusCode = 500;
    res.message = "Couldn't udpate user!";
    next(error, req, res);
  }
};

export const getUsers = (req, res, next) => {
  const pageSize = +req.query.pagesize;
  const currentPage = +req.query.page;
  const userQuery = User.find().sort('-updatedAt');
  let fetchedUsers;
  if (pageSize && currentPage) {
    userQuery.skip(pageSize * (currentPage - 1)).limit(pageSize);
  }
  userQuery
    .populate('userRole', 'roleName')
    .then(documents => {
      fetchedUsers = documents;
      return User.count();
    })
    .then(count => {
      res.status(200).json({
        message: "Users fetched successfully!",
        users: fetchedUsers,
        maxUsers: count
      });
    })
    .catch(error => {
      // res.status(500).json({
      //   message: "Fetching users failed!"
      // });

      res.statusCode = 500;
      res.message = "Fetching Users failed!";
      next(error, req, res);
    });
};

export const getUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id, { include: ["role"] });
    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    const userRole = await UserRole.findByPk(user.role_id, {include: ["sections"]});
    // const userRoles = await UserRole.find().select('roleName');

    // return res.status(200).json({ user, userRoles });
    return res.status(200).json({ user, userRole });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching user failed!"
    // });

    res.statusCode = 500;
    res.message = "Fetching User failed!";
    next(error, req, res);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById({ _id: req.params.id });

    if (!user) {
      return res.status(404).json({
        message: "User not found!"
      });
    }

    user.status = 'InActive';
    user.updatedBy = req.userData.userId;

    const error = await user.validateData();
    if (error) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: error
      });
    }

    await user.save();
    res.status(200).json({ message: "Deletion successful!" });
  } catch (error) {
    // res.status(500).json({
    //   message: "Deleting user failed!"
    // });

    res.statusCode = 500;
    res.message = "Deleting User failed!";
    next(error, req, res);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    // Only your own password, while logged in (routes/users.js: check-login)
    if (+req.params.id !== +req.userData.userId) {
      return res.status(401).json({ message: "You can only change your own password." });
    }

    // console.log(req.body);
    if (!req.body || !req.body.password) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: { errors : { oldPassword: { message: `Invalid inputs.` } } }
      });
    }

    // console.log(req.userData);

    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found!"
      });
    }

    const result = user.password === req.body.password;

    if (result) {
      return res.status(422).json({
        message: "Password is same",
        error: { errors : { password: { message: `New Password Must Not Match To Current Password` } } }
      });
    }

    user.password = req.body.password;

    // Setting 15 days of expiry
    const now = new Date();
    const expiry = new Date(now);
    expiry.setDate(expiry.getDate() + 15);
    user.expiry_date = expiry;

    await user.save();
    res.status(200).json({ message: "Password changed!" });
  } catch (err) {
    // console.log(err);
    // res.status(500).json({
    //   message: "Couldn't udpate user!"
    // });

    res.statusCode = 500;
    res.message = "Couldn't change password!";
    next(err, req, res);
  }
};

// The signed-in user as the screens need them, read fresh: a role changed by an administrator counts without signing in
// again (the frontend asks for this when it starts)
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.userData.userId, { include: 'role' });
    if (!user) return res.status(400).json({ message: "Your account no longer exists." });
    return res.status(200).json(await profileOf(user));
  } catch (error) {
    res.statusCode = 500;
    res.message = "Fetching your details failed!";
    return next(error, req, res);
  }
};

// A new access token from the refresh cookie (the page calls this when it opens and before the token runs out).
// 401 when there is no session: the page then shows sign-in.
export const refreshSession = async (req, res, next) => {
  try {
    if (!fromErpPage(req)) return res.status(401).json({ message: "Refused.", code: 'NO_SESSION' });
    const result = await rotateSession(req, res);
    if (result.error) return res.status(401).json({ message: result.error, code: 'NO_SESSION' });
    const user = await User.findByPk(result.userId, { include: 'role' });
    if (!user || (user.status || '').trim().toUpperCase() === 'INACTIVE') {
      await endAllSessions(result.userId);
      return res.status(401).json({ message: "Your account is not active. Please contact your administrator.", code: 'NO_SESSION' });
    }
    return res.status(200).json({
      token: user.generateAuthToken(result.family),
      expiresIn: ACCESS_MINUTES * 60,
      ...(await profileOf(user))
    });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Refreshing your session failed!";
    return next(error, req, res);
  }
};

// Sign-out of this browser: its session ends on the server and the cookie is removed. Works with an expired access
// token too, since the cookie is what identifies the session.
export const userLogout = async (req, res, next) => {
  try {
    if (!fromErpPage(req)) return res.status(401).json({ message: "Refused.", code: 'NO_SESSION' });
    const userId = await endSessionOfCookie(req, res);
    return res.status(200).json({ message: "Signed out.", serverSession: !!userId });
  } catch (error) {
    res.statusCode = 500;
    res.message = "Signing out failed!";
    return next(error, req, res);
  }
};

export const getFavourites = async (req, res, next) => {
  try {
    if (+req.params.id !== +req.userData.userId) {
      return res.status(401).json({ message: "You can only read your own favourites." });
    }
    const user = await User.findByPk(req.params.id, { attributes: ['first_name', 'last_name', 'show_favourites', 'favourites'] });
    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    // return res.status(200).json({ user, userRoles });
    return res.status(200).json({ user });
  } catch (error) {
    // res.status(500).json({
    //   message: "Fetching favourites failed!"
    // });

    res.statusCode = 500;
    res.message = "Fetching favourites failed!";
    next(error, req, res);
  }
}

export const setFavourites = async (req, res, next) => {
  try {
    // Only your own menu
    if (+req.params.id !== +req.userData.userId) {
      return res.status(401).json({ message: "You can only change your own favourites." });
    }
    // console.log(req.body);
    if (!req.body.favourites) {
      return res.status(422).json({
        message: "Invalid inputs passed, please check your data.",
        error: { errors : { favourites: { message: `Invalid inputs.` } } }
      });
    }

    // console.log(req.params);

    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found!"
      });
    }

    // console.log(req.body.favourites);
    // console.log(req.params.id);

    user.show_favourites = req.body.show_favourites ? 1 : 0;
    user.favourites = req.body.favourites;
    user.updatedBy = req.params.id;

    // console.log(user);

    await user.save();
    res.status(200).json({ message: "Favourites set successfully!", user: user });
  } catch (err) {
    // console.log(err);
    // res.status(500).json({
    //   message: "Couldn't set favourites!"
    // });

    res.statusCode = 500;
    res.message = "Couldn't set favourites!";
    next(err, req, res);
  }
}