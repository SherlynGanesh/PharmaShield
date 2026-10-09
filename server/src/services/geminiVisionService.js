
const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");

if (!process.env.GROQ_API_KEY) {
  throw new Error("GROQ_API_KEY is missing from the server environment.");
}

const ai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
  timeout: 45_000,
  maxRetries: 1,
});

const MODEL = "qwen/qwen3.8-27b";

const FIELD_DEFAULTS = {
  medicineName: null,
  manufacturer: null,
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

  const systemPrompt = `
You are a careful pharmaceutical package information extraction system.

Read only information visibly printed on the medicine packaging.
Do not use outside knowledge to fill missing information.
Do not infer details from the medicine name alone.

Return one valid JSON object with exactly these fields:
{
  "medicineName": null,
  "manufacturer": null,
  "composition": null,
  "batchNumber": null,
  "manufacturingDate": null,
  "expiryDate": null,
  "dosage": null,
  "netVolume": null,
  "mrp": null,
  "usp": null,
  "warnings": []
}

Extraction rules:
1. Use null when a field is absent, obscured, or unreadable.
2. medicineName: extract the printed brand or medicine name.
3. manufacturer: extract the manufacturer name, not the marketer,
   unless the package identifies only the marketer.
4. composition: extract ALL visible active ingredients and their
   strengths, exactly as printed. Keep them in one string.
   Include dosage-form wording only if printed as part of the composition.
   Do not invent ingredients or strengths.
5. batchNumber: preserve the printed batch/lot identifier exactly.
6. manufacturingDate and expiryDate: preserve the printed date text.
   Never calculate or guess dates.
7. dosage: extract printed strength or dosage information only when
   clearly identified. Do not confuse it with composition.
8. netVolume: extract the printed quantity, pack size, or net volume.
9. mrp: preserve the printed maximum retail price and currency text.
10. usp: extract a clearly printed USP or product claim, if present.
11. warnings: return visible medicine/package warnings as an array
    of strings. Use [] when none are readable.
12. Do not treat marketing claims as medical facts.
13. Do not confuse manufacturing details with expiry details.
14. Every field except warnings must be a string or null.
15. Do not add extra fields, explanations, or Markdown.

If text is blurry, partially visible, or ambiguous, prefer null
over a guessed answer.
`;

  try {
    const response = await ai.chat.completions.create({
      model: MODEL,
      temperature: 0,
      reasoning_effort: "none",
response_format: {
  type: "json_schema",
  json_schema: {
    name: "medicine_package",
    strict: true,
    schema: {
      type: "object",
      properties: {
        medicineName: { type: ["string", "null"] },
        manufacturer: { type: ["string", "null"] },
        composition: { type: ["string", "null"] },
        batchNumber: { type: ["string", "null"] },
        manufacturingDate: { type: ["string", "null"] },
        expiryDate: { type: ["string", "null"] },
        dosage: { type: ["string", "null"] },
        netVolume: { type: ["string", "null"] },
        mrp: { type: ["string", "null"] },
        usp: { type: ["string", "null"] },
        warnings: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: [
        "medicineName",
        "manufacturer",
        "composition",
        "batchNumber",
        "manufacturingDate",
        "expiryDate",
        "dosage",
        "netVolume",
        "mrp",
        "usp",
        "warnings"
      ],
      additionalProperties: false
    }
  }
},
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
                "Carefully inspect this medicine package. Read the composition panel and all visible printed details. Return the required JSON only.",
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