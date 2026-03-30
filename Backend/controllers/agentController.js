const Package = require('../models/Package');

const getAssignedPackages = async (req, res) => {
    try {
        const packages = await Package.find({ 'assignedAgent._id': req.user._id }).sort({ updatedAt: -1 });

        return res.status(200).json({
            message: 'Assigned shipments loaded successfully.',
            data: packages
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to fetch assigned shipments.', error: error.message });
    }
};

module.exports = {
    getAssignedPackages
};
