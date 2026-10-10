const {
    verifyMedicine
} = require("./verificationService");

function verifyMedicineController(req, res) {
    try {
        // Accept either { medicineInfo: {...} } or
        // a medicine object directly.
        const medicineInfo =
            req.body?.medicineInfo || req.body;

        const result = verifyMedicine(medicineInfo);

        return res.status(200).json({
            success: true,
            verification: result
        });
    } catch (error) {
        console.error(
            "Medicine verification error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Medicine verification failed"
        });
    }
}

module.exports = {
    verifyMedicineController
};