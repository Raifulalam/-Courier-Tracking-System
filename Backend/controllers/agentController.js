const Package = require('../models/Package');

function getStatusBreakdown(packages) {
    return packages.reduce(
        (acc, pkg) => {
            acc.total += 1;

            if (['Requested', 'Approved', 'Scheduled', 'Assigned'].includes(pkg.status)) {
                acc.pending += 1;
            }

            if (['Picked Up', 'In Transit', 'Out for Delivery', 'Delayed', 'Exception'].includes(pkg.status)) {
                acc.active += 1;
            }

            if (pkg.status === 'Delivered') {
                acc.delivered += 1;
            }

            return acc;
        },
        { total: 0, pending: 0, active: 0, delivered: 0 }
    );
}

const getAssignedPackages = async (req, res) => {
    try {
        const packages = await Package.find({ 'assignedAgent._id': req.user._id }).sort({ updatedAt: -1 }).lean();

        return res.status(200).json({
            message: 'Assigned shipments loaded successfully.',
            data: packages,
            meta: getStatusBreakdown(packages)
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to fetch assigned shipments.', error: error.message });
    }
};

module.exports = {
    getAssignedPackages
};
