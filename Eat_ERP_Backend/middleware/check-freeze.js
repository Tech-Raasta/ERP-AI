const Freeze = require('../models/freeze');

module.exports = async (req, res, next) => {
    try {
        let checkDate = '';
        if (req.baseUrl.trim().toUpperCase() === "/API/GRNS") {
            checkDate = req.body.grnDate;
        } else if (req.baseUrl.trim().toUpperCase() === "/API/DEPOTTRANSFERS") {
            checkDate = req.body.depotTransferDate;
        } else if (req.baseUrl.trim().toUpperCase() === "/API/SAMPLES") {
            checkDate = req.body.sampleDate;
        } else if (req.baseUrl.trim().toUpperCase() === "/API/SELLS") {
            // checkDate = req.body.sellDate;
            checkDate = new Date().toISOString();
        } else if (req.baseUrl.trim().toUpperCase() === "/API/SELLRETURNS") {
            checkDate = req.body.sellReturnDate;
        } else if (req.baseUrl.trim().toUpperCase() === "/API/STOCKRECONCILIATIONS") {
            checkDate = req.body.stockReconciliationDate;
        }
        
        if (checkDate && checkDate instanceof Date) {
            const freeze = await Freeze.findOne({ startDate: { $lte: checkDate }, endDate: { $gte: checkDate } });
            
            if (freeze) {
                return res.status(402).json({ message: "Selected date is already freezed!" });
            }
        }
        
        next();
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Checking freezed month error!" });
    }
};
