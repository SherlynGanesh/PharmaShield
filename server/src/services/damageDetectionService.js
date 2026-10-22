
const OpenAI = require("openai");
const fs = require("fs");

let aiClient = null;
function getAiClient() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing from the server environment.");
  }
  if (!aiClient) {
    aiClient = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }
  return aiClient;
}

const detectPackageDamage = async (imagePath) => {
  const ai = getAiClient();
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");

  const isPng =
    imageBuffer[0] === 0x89 &&
    imageBuffer[1] === 0x50 &&
    imageBuffer[2] === 0x4e &&
    imageBuffer[3] === 0x47;

  const mimeType = isPng ? "image/png" : "image/jpeg";

  const response = await ai.chat.completions.create({
    model: "qwen/qwen3.8-27b",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `
Inspect the image for visible physical damage to medicine packaging.

Look for:
- Torn or broken packaging
- Opened blister pockets
- Holes or leakage
- Crushed or deformed packaging
- Damaged seals
- Peeled or damaged labels
- Wet packaging

Do not decide whether medicine is fake or counterfeit.
Do not assume damage that is not visible.

Return JSON with exactly this structure:
{
  "damageDetected": false,
  "damageTypes": [],
  "severity": "none",
  "description": ""
}

Rules:
- damageDetected is true only when visible physical damage exists.
- List only damage types supported by visible evidence.
- severity must be none, minor, moderate, or severe.
- If no damage is visible, return false, [], none.
- Keep the description short.
        `,
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
            },
          },
          {
            type: "text",
            text: "Inspect this medicine package for physical damage.",
          },
        ],
      },
    ],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error("Groq returned an empty response.");
  }

  const damageInfo = JSON.parse(
    content.replace(/```json/gi, "").replace(/```/g, "").trim()
  );

  return damageInfo;
};

module.exports = { detectPackageDamage };