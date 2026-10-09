const express = require("express");
const multer = require("multer");
const fs = require("fs");
const { extractTextFromImage } = require("../services/ocrService");
const { parseMedicineText } = require("../services/medicineParser");
const { detectPackageDamage } = require("../services/damageDetectionService");
const { analyzeMedicineImage } = require("../services/geminiVisionService");

const router = express.Router();

const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

router.post("/ocr", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image uploaded",
      });
    }

    const ocrResult = await extractTextFromImage(req.file.path);

    const medicineInfo = parseMedicineText(
      ocrResult.bestText || ocrResult.text || ""
    );

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      extractedText: ocrResult.text,
      bestText: ocrResult.bestText,
      ocrConfidence: ocrResult.confidence,
      medicineInfo,
    });
  } catch (error) {
    console.error("OCR Error:", error);

    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: "Failed to process image",
    });
  }
});
router.post(
  "/damage-detection",
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No image uploaded",
        });
      }

      const damageResult =
        await detectPackageDamage(req.file.path);

      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        damageDetection: damageResult,
      });
    } catch (error) {
      console.error(
        "Damage Detection Route Error:",
        error
      );

      if (
        req.file?.path &&
        fs.existsSync(req.file.path)
      ) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        success: false,
        message: "Failed to detect package damage",
      });
    }
  }
);
router.post("/gemini-vision", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a medicine image.",
        retryable: false,
      });
    }

    const result = await analyzeMedicineImage(req.file.path);

    res.status(200).json(result);

  } catch (error) {
    console.error("Gemini Vision Route Error:", error.message);

    res.status(503).json({
      success: false,
      message:
        "Image analysis is temporarily unavailable. Please try again in a moment.",
      retryable: true,
    });
  }
});
module.exports = router;