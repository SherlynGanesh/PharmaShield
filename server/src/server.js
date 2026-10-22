const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const medicineRoutes = require("./routes/medicineRoutes");

const verificationRoutes = require(
  "./medicineVerification/verificationRoutes"
);

const blockchainRoutes = require("./blockchain/blockchainRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// Existing Gemini Vision, OCR, and damage-detection routes
app.use("/api/medicine", medicineRoutes);

// Existing medicine reference JSON verification route (kept separate)
app.use("/api/medicine", verificationRoutes);

// New Blockchain-Based Medicine Supply Chain Verification routes
app.use("/api/blockchain", blockchainRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "PharmaShield AI backend is running!",
    modules: {
      visionExtraction: "/api/medicine/gemini-vision",
      ocrExtraction: "/api/medicine/ocr",
      damageDetection: "/api/medicine/damage-detection",
      referenceVerification: "/api/medicine/verify-reference",
      blockchainVerification: "/api/blockchain",
    },
  });
});

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});  