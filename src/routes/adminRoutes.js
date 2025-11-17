const express = require('express');
const {
  getAllAds,
  getAdById,
  createAd,
  updateAd,
  deleteAd,
} = require('../controllers/adsController');
const {
  getAllUsers,
  getPendingUsers,
  getUserById,
  approveUser,
  rejectUser,
  deleteUser,
} = require('../controllers/userController');
const authenticate = require('../middleware/auth');

const router = express.Router();

// All admin routes require authentication
router.use(authenticate);

// Ads management
router.get('/ads', getAllAds);
router.get('/ads/:id', getAdById);
router.post('/ads', createAd);
router.put('/ads/:id', updateAd);
router.delete('/ads/:id', deleteAd);

// User management
router.get('/users', getAllUsers);
router.get('/users/pending', getPendingUsers);
router.get('/users/:id', getUserById);
router.post('/users/:id/approve', approveUser);
router.post('/users/:id/reject', rejectUser);
router.delete('/users/:id', deleteUser);

module.exports = router;
