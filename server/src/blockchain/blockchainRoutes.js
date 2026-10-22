const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
  registerBatchController,
  verifyBatchController,
  recordTransferController,
  getBatchController,
  getLedgerController,
  verifyIntegrityController,
} = require("./blockchainController");

const { requireRole } = require("./authMiddleware");

const router = express.Router();

// Ensure upload destination exists
const uploadDir = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

/**
 * 1. Manufacturer Batch Registration
 * Only authorized manufacturers can register new batches.
 */
router.post(
  "/register",
  upload.single("image"),
  requireRole("MANUFACTURER"),
  registerBatchController
);

/**
 * 2. Stage Verification (Distributor / Wholesaler / Retailer / Patient)
 * Compares uploaded package image against the original blockchain manufacturer record.
 */
router.post(
  "/verify",
  upload.single("image"),
  requireRole("MANUFACTURER", "DISTRIBUTOR", "WHOLESALER", "RETAILER", "PATIENT"),
  verifyBatchController
);

/**
 * 3. Supply Chain Transfer & Receipt
 * Records accepted transfer event onto blockchain.
 */
router.post(
  "/transfer",
  requireRole("MANUFACTURER", "DISTRIBUTOR", "WHOLESALER", "RETAILER", "PATIENT"),
  recordTransferController
);

/**
 * 4. Batch Lookup & Supply-Chain Timeline
 */
router.get("/batch/:batchId", getBatchController);

/**
 * 5. Full Blockchain Ledger
 */
router.get("/ledger", getLedgerController);

/**
 * 6. Cryptographic Chain Integrity Audit
 */
router.get("/integrity", verifyIntegrityController);

module.exports = router;
