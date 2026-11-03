import express from "express";

import * as AttendanceController from "../controllers/attendance.js";

import checkLogin from "../middleware/check-login.js";
import { xlsxUpload } from "../lib/excelUpload.js";

const router = express.Router();

// Eat Attendance (old PHP Eat_Attendence). Any logged in user reaches this for their own attendance; the controller
// checks what else they may do (the 'Attendance' role section).
const handleUpload = xlsxUpload(AttendanceController.UPLOAD_PATH, 'attendance');

router.get("", checkLogin, AttendanceController.getAttendance);

router.post("/upload", checkLogin, handleUpload, AttendanceController.uploadAttendance);

router.post("/download/:kind", checkLogin, AttendanceController.downloadAttendance);

router.post("/mail", checkLogin, AttendanceController.mailAttendance);

router.get("/employee/:empNo", checkLogin, AttendanceController.getEmployeeAttendance);

router.post("/employee/:empNo", checkLogin, AttendanceController.saveEmployeeAttendance);

export default router;
