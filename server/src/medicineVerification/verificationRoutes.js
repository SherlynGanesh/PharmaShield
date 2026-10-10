const express = require("express");

const {
    verifyMedicineController
} = require("./verificationController");

const router = express.Router();

router.post(
    "/verify-reference",
    verifyMedicineController
);

module.exports = router;