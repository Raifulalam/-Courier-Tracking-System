const { NEPAL_LOCATIONS, getLocationMeta } = require('../utils/locationCatalog');

const getLocations = async (_req, res) => {
    return res.status(200).json({
        message: 'Nepal locations fetched successfully.',
        data: NEPAL_LOCATIONS,
        meta: getLocationMeta()
    });
};

module.exports = { getLocations };
