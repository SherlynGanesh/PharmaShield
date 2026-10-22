const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const LEDGER_FILE_PATH = path.join(__dirname, "data", "blockchainLedger.json");

/**
 * Computes a SHA-256 cryptographic hash of any JavaScript object or string.
 */
function sha256(data) {
  const content = typeof data === "object" ? JSON.stringify(data) : String(data);
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Normalizes batch data to ensure deterministic hashing across participants.
 */
function normalizeBatchData(data) {
  if (!data || typeof data !== "object") return {};
  return {
    medicineName: String(data.medicineName || "").trim().toLowerCase(),
    batchNumber: String(data.batchNumber || "").trim().toUpperCase(),
    manufacturer: String(data.manufacturer || data.manufacturerName || "").trim().toLowerCase(),
    manufacturingDate: String(data.manufacturingDate || "").trim(),
    expiryDate: String(data.expiryDate || "").trim(),
    quantity: data.quantity ? Number(data.quantity) : null,
  };
}

/**
 * Represents an individual block in the tamper-evident supply chain blockchain.
 */
class Block {
  constructor(index, timestamp, eventType, batchId, sender, receiver, batchData, previousHash = "") {
    this.index = index;
    this.timestamp = timestamp;
    this.eventType = eventType; // e.g., 'GENESIS', 'BATCH_REGISTRATION', 'TRANSFER_RETAILER', 'TRANSFER_WHOLESALER'
    this.batchId = batchId;
    this.sender = sender;
    this.receiver = receiver;
    this.batchData = batchData;
    // Cryptographic hash of normalized batch details (fingerprint of physical package data)
    this.dataHash = batchData ? sha256(normalizeBatchData(batchData)) : "0".repeat(64);
    this.previousHash = previousHash;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    return sha256({
      index: this.index,
      timestamp: this.timestamp,
      eventType: this.eventType,
      batchId: this.batchId,
      sender: this.sender,
      receiver: this.receiver,
      dataHash: this.dataHash,
      previousHash: this.previousHash,
    });
  }
}

/**
 * Manages the tamper-evident blockchain ledger and supply-chain state.
 */
class Blockchain {
  constructor() {
    this.chain = [];
    this.registeredBatches = {}; // batchId -> immutable manufacturer record
    this.loadFromDisk();
  }

  /**
   * Initializes the blockchain with a Genesis block if empty.
   */
  initGenesisBlock() {
    const genesisBlock = new Block(
      0,
      new Date("2026-01-01T00:00:00.000Z").toISOString(),
      "GENESIS",
      "SYSTEM",
      "PHARMASHIELD_CORE",
      "NETWORK",
      { message: "PharmaShield AI Genesis Ledger Block" },
      "0".repeat(64)
    );
    this.chain = [genesisBlock];
    this.registeredBatches = {};
    this.saveToDisk();
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  /**
   * Registers a new batch on the blockchain by the manufacturer.
   * Enforces immutability: the manufacturer's record becomes the eternal source of truth.
   */
  registerBatch(batchInfo, participant) {
    const normalizedBatchId = String(batchInfo.batchNumber || "").trim().toUpperCase();

    if (!normalizedBatchId) {
      throw new Error("Batch number is required for registration.");
    }

    if (this.registeredBatches[normalizedBatchId]) {
      throw new Error(`Batch "${normalizedBatchId}" is already registered on the blockchain.`);
    }

    const timestamp = new Date().toISOString();
    const immutableRecord = {
      medicineName: batchInfo.medicineName,
      batchNumber: normalizedBatchId,
      quantity: batchInfo.quantity || 1,
      manufacturer: batchInfo.manufacturer || batchInfo.manufacturerName,
      manufacturingDate: batchInfo.manufacturingDate,
      expiryDate: batchInfo.expiryDate,
      registeredBy: participant?.name || batchInfo.manufacturer || "Authorized Manufacturer",
      registeredAt: timestamp,
      rawExtracted: batchInfo.extractedDetails || null,
    };

    const dataHash = sha256(normalizeBatchData(immutableRecord));
    immutableRecord.dataHash = dataHash;

    const newBlock = new Block(
      this.chain.length,
      timestamp,
      "BATCH_REGISTRATION",
      normalizedBatchId,
      participant?.name || batchInfo.manufacturer || "Manufacturer",
      "SUPPLY_CHAIN_NETWORK",
      immutableRecord,
      this.getLatestBlock().hash
    );

    this.chain.push(newBlock);
    this.registeredBatches[normalizedBatchId] = {
      ...immutableRecord,
      blockIndex: newBlock.index,
      blockHash: newBlock.hash,
    };

    this.saveToDisk();

    return {
      success: true,
      block: newBlock,
      registeredRecord: this.registeredBatches[normalizedBatchId],
      dataHash,
    };
  }

  /**
   * Records a transfer or receipt event for an existing batch.
   * Does NOT alter the manufacturer's original record.
   */
  recordTransfer(batchId, sender, receiver, stage, notes = "", extractedDetails = null) {
    const normalizedBatchId = String(batchId || "").trim().toUpperCase();
    const originalRecord = this.registeredBatches[normalizedBatchId];

    if (!originalRecord) {
      throw new Error(`Batch "${normalizedBatchId}" is not registered on the blockchain.`);
    }

    const timestamp = new Date().toISOString();
    const transferPayload = {
      batchId: normalizedBatchId,
      stage: stage.toUpperCase(),
      sender,
      receiver,
      notes,
      verifiedAgainstManufacturer: true,
      originalDataHash: originalRecord.dataHash,
      timestamp,
      extractedDetails,
    };

    const newBlock = new Block(
      this.chain.length,
      timestamp,
      `TRANSFER_${stage.toUpperCase()}`,
      normalizedBatchId,
      sender,
      receiver,
      transferPayload,
      this.getLatestBlock().hash
    );

    this.chain.push(newBlock);
    this.saveToDisk();

    return {
      success: true,
      block: newBlock,
      transfer: transferPayload,
      originalRecord,
    };
  }

  /**
   * Retrieves the immutable manufacturer record for a batch.
   */
  getBatch(batchId) {
    const normalizedBatchId = String(batchId || "").trim().toUpperCase();
    return this.registeredBatches[normalizedBatchId] || null;
  }

  /**
   * Retrieves the full chronological supply-chain transfer history for a batch.
   */
  getBatchHistory(batchId) {
    const normalizedBatchId = String(batchId || "").trim().toUpperCase();
    return this.chain.filter((block) => block.batchId === normalizedBatchId);
  }

  /**
   * Verifies the cryptographic integrity of the entire blockchain.
   * Detects tampering of block data, hashes, or chain linkages.
   */
  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      // Verify block hash calculation
      const calculatedHash = sha256({
        index: currentBlock.index,
        timestamp: currentBlock.timestamp,
        eventType: currentBlock.eventType,
        batchId: currentBlock.batchId,
        sender: currentBlock.sender,
        receiver: currentBlock.receiver,
        dataHash: currentBlock.dataHash,
        previousHash: currentBlock.previousHash,
      });

      if (currentBlock.hash !== calculatedHash) {
        return {
          valid: false,
          error: `Block #${currentBlock.index} hash is invalid. Stored: ${currentBlock.hash}, Calculated: ${calculatedHash}`,
          tamperedBlockIndex: currentBlock.index,
        };
      }

      // Verify chain linkage
      if (currentBlock.previousHash !== previousBlock.hash) {
        return {
          valid: false,
          error: `Block #${currentBlock.index} previousHash does not match Block #${previousBlock.index} hash.`,
          tamperedBlockIndex: currentBlock.index,
        };
      }
    }

    return { valid: true, error: null };
  }

  /**
   * Persists ledger to JSON file for survival across server restarts.
   */
  saveToDisk() {
    try {
      const dataDir = path.dirname(LEDGER_FILE_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const payload = {
        updatedAt: new Date().toISOString(),
        blockCount: this.chain.length,
        registeredBatches: this.registeredBatches,
        chain: this.chain,
      };

      fs.writeFileSync(LEDGER_FILE_PATH, JSON.stringify(payload, null, 2), "utf8");
    } catch (err) {
      console.error("Failed to save blockchain ledger to disk:", err.message);
    }
  }

  /**
   * Loads ledger from JSON file if present, else creates Genesis block.
   */
  loadFromDisk() {
    try {
      if (fs.existsSync(LEDGER_FILE_PATH)) {
        const raw = fs.readFileSync(LEDGER_FILE_PATH, "utf8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.chain) && parsed.chain.length > 0) {
          this.chain = parsed.chain.map((b) => {
            const block = new Block(
              b.index,
              b.timestamp,
              b.eventType,
              b.batchId,
              b.sender,
              b.receiver,
              b.batchData,
              b.previousHash
            );
            block.dataHash = b.dataHash;
            block.hash = b.hash;
            return block;
          });
          this.registeredBatches = parsed.registeredBatches || {};
          console.log(`Loaded blockchain ledger from disk with ${this.chain.length} blocks.`);
          return;
        }
      }
    } catch (err) {
      console.warn("Could not read blockchain ledger file, creating new chain:", err.message);
    }

    this.initGenesisBlock();
  }
}

// Singleton blockchain instance
const blockchainInstance = new Blockchain();

module.exports = {
  Block,
  Blockchain,
  blockchainInstance,
  sha256,
  normalizeBatchData,
};
