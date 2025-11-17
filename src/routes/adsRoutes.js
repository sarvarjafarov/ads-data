const express = require('express');
const {
  getAllAds,
  getAdById,
  createAd,
  updateAd,
  deleteAd,
} = require('../controllers/adsController');

const router = express.Router();

router.get('/', getAllAds);
router.get('/:id', getAdById);
router.post('/', createAd);
router.put('/:id', updateAd);
router.delete('/:id', deleteAd);

module.exports = router;
