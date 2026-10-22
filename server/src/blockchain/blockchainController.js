const fs = require("fs");
const path = require("path");
const { blockchainInstance } = require("./blockchainModel");
const { verifyAgainstBlockchainRecord } = require("./comparisonService");
const { analyzeMedicineImage } = require("../services/geminiVisionService");

/**
 * Extracts medicine details from an uploaded file or JSON body.
 */
async function extractDetailsFromRequest(req) {
  // If pre-parsed medicineInfo is passed directly (useful for testing or direct API calls)
  if (req.body?.medicineInfo) {
    let parsed = req.body.medicineInfo;
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch (e) {
        // keep as is
      }
    }
    return parsed;
  }

  // If an image file was uploaded
  if (req.file?.path) {
    const analysis = await analyzeMedicineImage(req.file.path);
    return analysis.medicineInfo || analysis;
  }

  return null;
}

/**
 * Helper to safely delete uploaded temp files
 */
function cleanupFile(req) {
  if (req.file?.path && fs.existsSync(req.file.path)) {
    try {
      fs.unlinkSync(req.file.path);
    } catch (err) {
      console.warn("Failed to delete temp upload file:", err.message);
    }
  }
}

/**
 * 1. Manufacturer Registration Controller
 * Accepts manufacturer input form + package image.
 * Extracts image details using existing Vision API.
 * Compares entered data vs extracted data.
 * If matched: commits batch to blockchain.
 * If mismatched: flags for review.
 */
async function registerBatchController(req, res) {
  try {
    const {
      medicineName,
      batchNumber,
      quantity,
      manufacturerName,
      manufacturingDate,
      expiryDate,
    } = req.body;

    const manufacturer = manufacturerName || req.body.manufacturer || req.participant?.name;

    // Validate required fields
    if (!medicineName || !batchNumber || !manufacturer || !manufacturingDate || !expiryDate) {
      cleanupFile(req);
      return res.status(400).json({
        success: false,
        message: "Missing required registration fields: medicineName, batchNumber, manufacturer, manufacturingDate, expiryDate are required.",
      });
    }

    const normalizedBatchId = String(batchNumber).trim().toUpperCase();

    // Check if batch is already registered
    if (blockchainInstance.getBatch(normalizedBatchId)) {
      cleanupFile(req);
      return res.status(409).json({
        success: false,
        message: `Batch "${normalizedBatchId}" is already registered on the blockchain. Batch IDs are immutable and unique.`,
      });
    }

    // Step A: Extract details from the uploaded medicine package image
    let extractedDetails = null;
    if (req.file) {
      try {
        extractedDetails = await extractDetailsFromRequest(req);
      } catch (extractErr) {
        console.error("Extraction error during registration:", extractErr.message);
        cleanupFile(req);
        return res.status(502).json({
          success: false,
          message: `Failed to extract medicine information from image: ${extractErr.message}`,
        });
      }
    } else if (req.body.medicineInfo) {
      extractedDetails = await extractDetailsFromRequest(req);
    }

    cleanupFile(req);

    const enteredDetails = {
      medicineName,
      batchNumber: normalizedBatchId,
      quantity: quantity || 1,
      manufacturer,
      manufacturingDate,
      expiryDate,
    };

    // Step B: If package image was provided, compare entered form details against extracted image details
    if (extractedDetails) {
      const comparison = verifyAgainstBlockchainRecord(extractedDetails, enteredDetails, "MANUFACTURER");

      if (!comparison.detailsMatch) {
        // Flag for review: Do not silently accept inconsistent registrations!
        return res.status(422).json({
          success: false,
          reviewRequired: true,
          registered: false,
          message: "Registration flagged for review: Extracted package details do not match manually entered information.",
          checks: comparison.checks,
          warnings: comparison.warnings,
          enteredDetails,
          extractedDetails,
        });
      }
    }

    // Step C: Details match! Register batch on blockchain
    const registrationResult = blockchainInstance.registerBatch(
      {
        ...enteredDetails,
        extractedDetails,
      },
      req.participant
    );

    return res.status(201).json({
      success: true,
      message: `Batch "${normalizedBatchId}" successfully registered on the blockchain.`,
      batchId: normalizedBatchId,
      stage: "MANUFACTURER",
      registered: true,
      blockIndex: registrationResult.block.index,
      blockHash: registrationResult.block.hash,
      dataHash: registrationResult.dataHash,
      timestamp: registrationResult.block.timestamp,
      registeredRecord: registrationResult.registeredRecord,
      extractedDetails,
      checks: {
        medicineName: "MATCH",
        manufacturer: "MATCH",
        batchNumber: "MATCH",
        manufacturingDate: "MATCH",
        expiryDate: "MATCH",
      },
      reviewRequired: false,
      warnings: [],
    });
  } catch (error) {
    cleanupFile(req);
    console.error("Batch registration error:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to register batch on blockchain.",
    });
  }
}

/**
 * 2. Retailer & Wholesaler Verification Controller
 * Retrieves manufacturer's original registered batch info.
 * Extracts details from participant's uploaded package image.
 * Compares extracted fields against manufacturer baseline.
 * Returns exact JSON verification response format.
 */
async function verifyBatchController(req, res) {
  try {
    const { batchId } = req.body;
    const stage = (req.body.stage || req.participant?.role || "RETAILER").toUpperCase();

    if (!batchId) {
      cleanupFile(req);
      return res.status(400).json({
        success: false,
        message: "batchId is required for verification.",
      });
    }

    const normalizedBatchId = String(batchId).trim().toUpperCase();

    // Retrieve original manufacturer record from blockchain
    const originalRecord = blockchainInstance.getBatch(normalizedBatchId);
    const history = blockchainInstance.getBatchHistory(normalizedBatchId);

    // If batch is not registered on blockchain
    if (!originalRecord) {
      cleanupFile(req);
      return res.status(200).json({
        batchId: normalizedBatchId,
        stage,
        registered: false,
        detailsMatch: false,
        checks: {
          medicineName: "NOT_CHECKED",
          manufacturer: "NOT_CHECKED",
          batchNumber: "NOT_CHECKED",
          manufacturingDate: "NOT_CHECKED",
          expiryDate: "NOT_CHECKED",
        },
        reviewRequired: true,
        warnings: [
          `Batch "${normalizedBatchId}" is not registered on the blockchain. Unknown or unregistered batch.`,
        ],
        history: [],
      });
    }

    // Extract details from the uploaded package image
    let extractedDetails = null;
    try {
      extractedDetails = await extractDetailsFromRequest(req);
    } catch (extractErr) {
      cleanupFile(req);
      return res.status(502).json({
        success: false,
        message: `Image extraction failed: ${extractErr.message}`,
      });
    }

    cleanupFile(req);

    if (!extractedDetails) {
      return res.status(400).json({
        success: false,
        message: "Package image or extracted medicineInfo must be provided for verification.",
      });
    }

    // Compare extracted details with manufacturer's original immutable record
    const result = verifyAgainstBlockchainRecord(extractedDetails, originalRecord, stage);

    return res.status(200).json({
      batchId: normalizedBatchId,
      stage,
      registered: true,
      detailsMatch: result.detailsMatch,
      checks: result.checks,
      reviewRequired: result.reviewRequired,
      warnings: result.warnings,
      originalRecord: {
        medicineName: originalRecord.medicineName,
        manufacturer: originalRecord.manufacturer,
        batchNumber: originalRecord.batchNumber,
        manufacturingDate: originalRecord.manufacturingDate,
        expiryDate: originalRecord.expiryDate,
        dataHash: originalRecord.dataHash,
        registeredAt: originalRecord.registeredAt,
        registeredBy: originalRecord.registeredBy,
      },
      extractedDetails,
      history,
    });
  } catch (error) {
    cleanupFile(req);
    console.error("Batch verification error:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to verify batch against blockchain.",
    });
  }
}

/**
 * 3. Record Transfer Controller
 * Records receipt and transfer event onto the blockchain.
 * Rejects transfers if verification failed or was not completed.
 */
async function recordTransferController(req, res) {
  try {
    const {
      batchId,
      stage,
      sender,
      receiver,
      notes,
      verified,
      extractedDetails,
    } = req.body;

    if (!batchId || !stage || !sender || !receiver) {
      return res.status(400).json({
        success: false,
        message: "Missing required transfer fields: batchId, stage, sender, and receiver are required.",
      });
    }

    const normalizedBatchId = String(batchId).trim().toUpperCase();

    // Check if batch is registered
    const originalRecord = blockchainInstance.getBatch(normalizedBatchId);
    if (!originalRecord) {
      return res.status(404).json({
        success: false,
        message: `Cannot record transfer: Batch "${normalizedBatchId}" is not registered on the blockchain.`,
      });
    }

    // A failed verification must raise a warning and must not silently become a verified transfer.
    if (verified === false || verified === "false") {
      return res.status(422).json({
        success: false,
        reviewRequired: true,
        message: "Transfer rejected: Medicine package failed verification or requires review. Inconsistent batches cannot be recorded as verified transfers.",
      });
    }

    // Append transfer block to the blockchain
    const transferResult = blockchainInstance.recordTransfer(
      normalizedBatchId,
      sender,
      receiver,
      stage,
      notes || `Verified receipt and transfer at ${stage}`,
      extractedDetails || null
    );

    return res.status(201).json({
      success: true,
      message: `Transfer event successfully recorded on blockchain for batch "${normalizedBatchId}".`,
      batchId: normalizedBatchId,
      stage: stage.toUpperCase(),
      blockIndex: transferResult.block.index,
      blockHash: transferResult.block.hash,
      dataHash: transferResult.block.dataHash,
      previousHash: transferResult.block.previousHash,
      timestamp: transferResult.block.timestamp,
      transfer: transferResult.transfer,
      originalRecord: transferResult.originalRecord,
    });
  } catch (error) {
    console.error("Transfer recording error:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to record transfer on blockchain.",
    });
  }
}

/**
 * 4. Get Batch Details & History Controller
 */
async function getBatchController(req, res) {
  try {
    const { batchId } = req.params;
    const normalizedBatchId = String(batchId).trim().toUpperCase();

    const originalRecord = blockchainInstance.getBatch(normalizedBatchId);
    if (!originalRecord) {
      return res.status(404).json({
        success: false,
        registered: false,
        message: `Batch "${normalizedBatchId}" not found on the blockchain.`,
      });
    }

    const history = blockchainInstance.getBatchHistory(normalizedBatchId);
    const latestEvent = history[history.length - 1];

    return res.status(200).json({
      success: true,
      registered: true,
      batchId: normalizedBatchId,
      currentStage: latestEvent ? latestEvent.eventType.replace("TRANSFER_", "") : "MANUFACTURER",
      originalRecord,
      history,
      eventCount: history.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve batch information.",
    });
  }
}

/**
 * 5. Get Blockchain Ledger Controller
 */
async function getLedgerController(req, res) {
  try {
    const chain = blockchainInstance.chain;
    const integrity = blockchainInstance.isChainValid();

    return res.status(200).json({
      success: true,
      blockCount: chain.length,
      integrity: {
        isValid: integrity.valid,
        error: integrity.error,
      },
      registeredBatchesCount: Object.keys(blockchainInstance.registeredBatches).length,
      registeredBatches: blockchainInstance.registeredBatches,
      chain,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve blockchain ledger.",
    });
  }
}

/**
 * 6. Audit Chain Integrity Controller
 */
async function verifyIntegrityController(req, res) {
  try {
    const result = blockchainInstance.isChainValid();
    return res.status(200).json({
      success: true,
      tamperEvidentAudit: {
        isChainValid: result.valid,
        error: result.error,
        tamperedBlockIndex: result.tamperedBlockIndex || null,
        totalBlocksAudited: blockchainInstance.chain.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to audit chain integrity.",
    });
  }
}

module.exports = {
  registerBatchController,
  verifyBatchController,
  recordTransferController,
  getBatchController,
  getLedgerController,
  verifyIntegrityController,
};
