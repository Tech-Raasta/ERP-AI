import express from "express";
import * as UserMasterController from "../controllers/userMaster.js";

import checkAuth from "../middleware/check-auth.js";
import checkLogin from "../middleware/check-login.js";

import * as UserController from '../controllers/users.js';
import * as PasswordResetController from '../controllers/passwordReset.js';
// const UserController = require("../controllers/users");

const router = express.Router();

// Users are created on the User screen; the old open sign-up made accounts for anyone
// router.post("/signup", UserController.userSignUp);

router.post("/login", UserController.userLogin);

// The refresh cookie (lib/authTokens.js) is the session: no access token needed for these two
router.post("/refresh", UserController.refreshSession);

router.post("/logout", UserController.userLogout);

router.get("/me", checkLogin, UserController.getMe);

// router.post("", checkAuth, UserController.createUser);

// router.put("/:id", checkAuth, UserController.updateUser);

// router.get("", checkAuth, UserController.getUsers);

router.get("/getFavourites/:id", checkLogin, UserController.getFavourites);

router.put("/setFavourites/:id", checkLogin, UserController.setFavourites);

// User (Users -> User, old PHP User); access from the 'User' role section
router.get("", checkAuth, UserMasterController.getUsers);

router.get("/master", checkAuth, UserMasterController.getMasterData);

router.get("/:id", checkAuth, UserMasterController.getUser);

router.post("", checkAuth, UserMasterController.createUser);

router.put("/:id", checkAuth, UserMasterController.updateUser);

// router.delete("/:id", checkAuth, UserController.deleteUser);

router.post("/reset-password/:id", checkLogin, UserController.resetPassword);

// Forgot password, before signing in: ask for a link, check it, set the new password (controllers/passwordReset.js)
router.post("/forgot-password", PasswordResetController.forgotPassword);

router.post("/reset-link/check", PasswordResetController.checkResetLink);

router.post("/reset-link/save", PasswordResetController.resetPasswordWithLink);

// module.exports = router;
export default router;