const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/notifications',          authMiddleware, notificationController.listNotifications);
router.put('/notifications/read-all', authMiddleware, notificationController.markAllRead);
router.put('/notifications/:id/read', authMiddleware, notificationController.markOneRead);

module.exports = router;
