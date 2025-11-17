const adsData = require('../models/adsData');

const getAllAds = (req, res) => {
  try {
    const ads = adsData.getAll();
    res.status(200).json({
      success: true,
      count: ads.length,
      data: ads,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getAdById = (req, res) => {
  try {
    const { id } = req.params;
    const ad = adsData.getById(id);

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found',
      });
    }

    res.status(200).json({
      success: true,
      data: ad,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const createAd = (req, res) => {
  try {
    const { title, description, price, category, image, status } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Title and description are required',
      });
    }

    const newAd = adsData.create({
      title,
      description,
      price: price || 0,
      category: category || 'General',
      image: image || 'https://via.placeholder.com/300',
      status: status || 'active',
    });

    res.status(201).json({
      success: true,
      data: newAd,
      message: 'Ad created successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const updateAd = (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const updatedAd = adsData.update(id, updateData);

    if (!updatedAd) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found',
      });
    }

    res.status(200).json({
      success: true,
      data: updatedAd,
      message: 'Ad updated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteAd = (req, res) => {
  try {
    const { id } = req.params;
    const deleted = adsData.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Ad deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getAllAds,
  getAdById,
  createAd,
  updateAd,
  deleteAd,
};
