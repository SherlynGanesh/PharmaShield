
const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
require("dotenv").config();

const { extractTextFromImage } = require("./ocrService");
const { parseMedicineText } = require("./medicineParser");

let aiClient = null;
function getAiClient() {
  if (!process.env.GROQ_API_KEY) {
    require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
  }
  if (!process.env.GROQ_API_KEY) {
    return null;
  }
  if (!aiClient) {
    aiClient = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
      timeout: 45_000,
      maxRetries: 1,
    });
  }
  return aiClient;
}

const MODEL = "qwen/qwen3.8-27b";

const FIELD_DEFAULTS = {
  medicineName: null,
  manufacturer: null,
  marketer: null,
  composition: null,
  batchNumber: null,
  manufacturingDate: null,
  expiryDate: null,
  dosage: null,
  netVolume: null,
  mrp: null,
  usp: null,
  warnings: [],
};

function detectImageMimeType(buffer) {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    )
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  throw new Error("Unsupported image format. Upload a PNG, JPEG, or WebP image.");
}

function normalizeMedicineInfo(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("The AI returned an invalid medicine information object.");
  }

  const result = {};

  for (const field of Object.keys(FIELD_DEFAULTS)) {
    const value = data[field];

    if (field === "warnings") {
      if (value == null) {
        result[field] = [];
      } else if (
        Array.isArray(value) &&
        value.every((item) => typeof item === "string")
      ) {
        result[field] = value.map((item) => item.trim()).filter(Boolean);
      } else if (typeof value === "string" && value.trim()) {
        result[field] = [value.trim()];
      } else {
        throw new Error("The AI returned an invalid warnings field.");
      }

      continue;
    }

    if (value == null || value === "") {
      result[field] = null;
    } else if (typeof value === "string") {
      result[field] = value.trim() || null;
    } else {
      throw new Error(`The AI returned an invalid ${field} field.`);
    }
  }

  return result;
}

async function analyzeMedicineImage(imagePath) {
  if (!imagePath || typeof imagePath !== "string") {
    throw new Error("A valid image path is required.");
  }

  if (!fs.existsSync(imagePath)) {
    throw new Error("The uploaded image could not be found.");
  }

  const imageBuffer = fs.readFileSync(imagePath);

  if (imageBuffer.length === 0) {
    throw new Error("The uploaded image is empty.");
  }

  const mimeType = detectImageMimeType(imageBuffer);
  const base64Image = imageBuffer.toString("base64");

  const systemPrompt = `You are a high-precision pharmaceutical package vision extraction system.
Examine the package image with extreme care and accuracy.

Extraction rules:
1. medicineName: The prominent brand or medicine trade name (e.g., "Piopar-GZ Total", "PAN 40").
2. manufacturer: The manufacturing company name. Look specifically for "Manufactured by:" or "Mfg. by:". Read each letter with utmost precision (e.g. read "BIOALTUS PHARMACEUTICALS PVT. LTD.", do not misread as "BIOS").
3. marketer: If a separate "Marketed by:" company is printed, extract it (e.g., "MITOCH PHARMA PVT. LTD.").
4. batchNumber: The batch or lot identifier, typically stamped in dot-matrix ink at the bottom edge, flap, or crimp (e.g., following "B.No.", "Batch:"). Extract just the batch code without the "B.No." prefix (e.g., "BD260951B" or "19443036").
5. manufacturingDate: The manufacturing date (e.g., "MFG. DATE 04/2026"). Output as MM/YYYY.
6. expiryDate: The expiration date (e.g., "EXPIRY DATE 03/2028"). Output as MM/YYYY.
7. composition: All visible active ingredients and strengths.

Return one valid JSON object with exactly:
{
  "medicineName": string or null,
  "manufacturer": string or null,
  "marketer": string or null,
  "composition": string or null,
  "batchNumber": string or null,
  "manufacturingDate": string or null,
  "expiryDate": string or null,
  "dosage": string or null,
  "netVolume": string or null,
  "mrp": string or null,
  "usp": null,
  "warnings": []
}`;

  try {
    const ai = getAiClient();
    if (!ai) {
      console.log("GROQ_API_KEY not configured in environment. Using local OCR extraction fallback.");
      const ocrResult = await extractTextFromImage(imagePath);
      const parsed = parseMedicineText(ocrResult.bestText || ocrResult.text || "");
      const normalized = normalizeMedicineInfo({
        medicineName: parsed.medicineName || null,
        manufacturer: parsed.manufacturer || null,
        marketer: null,
        composition: null,
        batchNumber: parsed.batchNumber || null,
        manufacturingDate: parsed.manufacturingDate || null,
        expiryDate: parsed.expiryDate || null,
        dosage: null,
        netVolume: parsed.netVolume || null,
        mrp: parsed.mrp || null,
        usp: parsed.usp || null,
        warnings: parsed.warnings || [],
      });
      return {
        success: true,
        medicineInfo: normalized,
        extractor: "ocr-fallback",
      };
    }

    const response = await ai.chat.completions.create({
      model: MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Carefully inspect this medicine package image. Read the brand name, manufacturer, batch number, manufacturing date, and expiry date. Return valid JSON only.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content;

    if (!content || !content.trim()) {
      throw new Error("The AI returned an empty response.");
    }

    let parsed;

    try {
      const cleaned = content
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();

      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("The AI response was not valid JSON.");
    }

    const medicineInfo = normalizeMedicineInfo(parsed);

    return {
      success: true,
      medicineInfo,
    };
  } catch (error) {
    console.error("Medicine image analysis failed:", {
      message: error.message,
      status: error.status,
      code: error.code,
    });

    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) {
        throw new Error(
          "AI usage limit reached. Please wait before trying again."
        );
      }

      if (error.status === 401 || error.status === 403) {
        throw new Error(
          "AI authentication failed. Check the GROQ_API_KEY configuration."
        );
      }

      if (error.status === 400) {
        throw new Error(
          "The AI rejected the image or request. Check the image format and model configuration."
        );
      }

      if (error.status >= 500) {
        throw new Error(
          "The AI service is temporarily unavailable. Please try again later."
        );
      }
    }

    throw error;
  }
}

module.exports = { analyzeMedicineImage };