const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');

router.patch('/mark', attendanceController.markAttendance);
router.patch('/cancel', attendanceController.cancelAttendance);

module.exports = router;