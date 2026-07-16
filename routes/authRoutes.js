const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');

// Map endpoints to controller functions cleanly
router.post('/register', register);
router.post('/login', login);

module.exports = router;
