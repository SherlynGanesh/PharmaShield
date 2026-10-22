# PharmaShield AI — Blockchain-Based Medicine Supply Chain Verification

PharmaShield AI is a pharmaceutical package authenticity and supply-chain verification system designed for university mini-projects and demonstrations.

---

## 🏛️ System Architecture & Existing APIs

### 1. Existing Modules (Preserved & Reused)
* **Image Extraction Module** (`/api/medicine/gemini-vision` & `/api/medicine/ocr`):
  * Accepts package image uploads via `multipart/form-data`.
  * Primary extractor: Vision AI (`qwen/qwen3.8-27b` via Groq) returning structured JSON containing medicine name, manufacturer, batch number, manufacturing date, and expiry date.
  * Local fallback extractor: Tesseract OCR (`extractTextFromImage`) and regex parser (`medicineParser.js`).
* **Medicine Reference Verification Module** (`/api/medicine/verify-reference`):
  * Compares extracted data against a static reference database (`medicineReference.json`).
  * *Maintained as a standalone module; strictly separated from the blockchain source of truth.*

---

### 2. New Blockchain Supply Chain Module (`/api/blockchain`)
The blockchain serves as the decentralized, tamper-evident **Source of Truth** across the supply chain:
$$\text{Manufacturer (Registration)} \longrightarrow \text{Retailer (Verification \& Transfer)} \longrightarrow \text{Wholesaler (Verification \& Transfer)}$$

* **Decoupled Source of Truth**: Verification does **NOT** use `medicineReference.json`. Instead, each stage verifies against the manufacturer's immutable record stored on the blockchain.
* **Cryptographic Hashing (SHA-256)**:
  * Generates a deterministic hash fingerprint of the normalized batch data.
  * Chains blocks together via `previousHash` $\rightarrow$ `hash` pointers.
* **Role-Based Access Control (RBAC)**:
  * `MANUFACTURER`: Authorized to register new batches.
  * `RETAILER`: Authorized to verify packages and record retailer receipt transfers.
  * `WHOLESALER`: Authorized to verify packages and record wholesaler transfers.
* **Anti-Tampering & Review Flags**:
  * Any discrepancy in medicine name, manufacturer, batch number, or dates sets `detailsMatch: false` and `reviewRequired: true`.
  * Inconsistent packages **cannot silently become verified transfers**.

---

## 🚀 Getting Started

### Prerequisites
* **Node.js** (v18+)
* **Python** (v3.9+) with `requests` library

### 1. Server Configuration & Startup
```bash
cd server
npm install
npm start
```
* Runs by default on `http://localhost:5000`.
* Optional: Add your Groq API key in `server/.env` (`GROQ_API_KEY=your_key`). If omitted, the server uses local OCR and simulated vision extraction.

### 2. Client Portal Startup
```bash
cd client
npm install
npm run dev
```
* Opens the PharmaShield AI Web Dashboard at `http://localhost:5173`.

---

## 🧪 Testing the Complete Supply Chain Workflow

### Automated Python End-to-End Test
Run the automated test script in the project root:
```bash
python test_blockchain_supplychain.py
```
This script exercises:
1. **Manufacturer Registration**: Registers batch `BATCH-AUTO-789` with package image.
2. **Retailer Verification**: Queries blockchain, extracts package details, verifies match.
3. **Retailer Transfer**: Records verified receipt block on the blockchain ledger.
4. **Wholesaler Mismatch Test**: Submits an altered expiry date; system flags review and blocks transfer.
5. **Wholesaler Genuine Verification**: Verifies matching package and records final transfer block.
6. **Audit & Cryptographic Check**: Validates block hashes and links across the entire chain.

---

## 📡 API Reference (`/api/blockchain`)

### 1. Register Batch (`POST /api/blockchain/register`)
* **Headers**: `x-role: MANUFACTURER`
* **Body** (`multipart/form-data` or `json`):
  * `medicineName`: String
  * `batchNumber`: String
  * `quantity`: Number
  * `manufacturerName`: String
  * `manufacturingDate`: String (e.g. `04/2026`)
  * `expiryDate`: String (e.g. `03/2028`)
  * `image`: File (optional: package photo)

### 2. Verify Package at Stage (`POST /api/blockchain/verify`)
* **Headers**: `x-role: RETAILER` or `WHOLESALER`
* **Body**:
  * `batchId`: String
  * `stage`: `"RETAILER"` or `"WHOLESALER"`
  * `image`: File or `medicineInfo` JSON

**Standard Verification Response Format**:
```json
{
  "batchId": "BATCH-123",
  "stage": "RETAILER",
  "registered": true,
  "detailsMatch": false,
  "checks": {
    "medicineName": "MATCH",
    "manufacturer": "MATCH",
    "batchNumber": "MATCH",
    "manufacturingDate": "MATCH",
    "expiryDate": "MISMATCH"
  },
  "reviewRequired": true,
  "warnings": [
    "Expiry date differs from the manufacturer's registered record"
  ],
  "originalRecord": { ... },
  "history": [ ... ]
}
```

### 3. Record Transfer (`POST /api/blockchain/transfer`)
* **Headers**: `x-role: RETAILER` or `WHOLESALER`
* **Body**:
  * `batchId`: String
  * `stage`: `"RETAILER"` or `"WHOLESALER"`
  * `sender`: String
  * `receiver`: String
  * `notes`: String
  * `verified`: Boolean (`true` required to record transfer)

### 4. Query Batch Lifecycle (`GET /api/blockchain/batch/:batchId`)
Returns the manufacturer's immutable record and all chronological transfer blocks.

### 5. Blockchain Ledger (`GET /api/blockchain/ledger`)
Returns all chain blocks, block count, and registered batches.

### 6. Audit Chain Integrity (`GET /api/blockchain/integrity`)
Verifies SHA-256 hashes and block links across the chain.