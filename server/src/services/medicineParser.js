const cleanText = (text) => {
  if (!text) return "";

  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
};

/*
 * Normalize only highly likely OCR mistakes.
 */
const normalizeBatch = (value) => {
  if (!value) return null;

  let result = value
    .replace(/[^A-Za-z0-9-]/g, "")
    .trim();

  // S0050524 -> B0050524
  if (/^S\d{5,}$/i.test(result)) {
    result = "B" + result.substring(1);
  }

  return result || null;
};

const parseMedicineText = (rawText) => {
  const text = cleanText(rawText);

  /*
   * ---------------------------------------------------------
   * MEDICINE NAME
   * ---------------------------------------------------------
   */

  let medicineName = null;

  const medicineNameMatch = text.match(
    /(?:medicine\s+name|drug\s+name|product\s+name)\s*[:.\-]?\s*\n?\s*([A-Za-z][A-Za-z0-9 .()'&+\-/]{2,60})/i
  );

  if (medicineNameMatch) {
    const candidate = medicineNameMatch[1]
      .replace(/\s+/g, " ")
      .trim();

    /*
     * Do not accept obvious generic words as medicine names.
     */
    const invalidNames = [
      "efficacy",
      "information",
      "products",
      "address",
      "feedback",
      "query",
      "manufacturing",
      "warning",
      "caution",
      "instructions",
    ];

    if (!invalidNames.includes(candidate.toLowerCase())) {
      medicineName = candidate;
    }
  }

  /*
   * Known medicine fallback.
   */
  if (!medicineName) {
    const knownMedicine = text.match(
      /\b(Paracetamol|Ibuprofen|Amoxicillin|Azithromycin|Cetirizine|Metformin|Pantoprazole|Omeprazole|Aspirin)\b/i
    );

    if (knownMedicine) {
      medicineName = knownMedicine[1];
    }
  }

  /*
   * ---------------------------------------------------------
   * MANUFACTURER
   * ---------------------------------------------------------
   */

  let manufacturer = null;

  const manufacturerMatch = text.match(
    /(?:mfg\.?\s*by|mfd\.?\s*by|manufactured\s*by)\s*[:.\-]?\s*([^\n]+)/i
  );

  if (manufacturerMatch) {
    manufacturer = manufacturerMatch[1]
      .replace(/[^A-Za-z0-9'&().,\- ]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /*
   * ---------------------------------------------------------
   * NET VOLUME
   * ---------------------------------------------------------
   */

  let netVolume = null;

  const volumeMatch = text.match(
    /(?:net\s*(?:vol|volume)|netvol\.?)\s*[:.\-]?\s*(\d+(?:\.\d+)?)\s*(ml|mL|l|L|mg|g|gm|kg)\b/i
  );

  if (volumeMatch) {
    const value = volumeMatch[1];
    const unit = volumeMatch[2].toLowerCase();

    let normalizedUnit = unit;

    if (unit === "ml") normalizedUnit = "ml";
    if (unit === "l") normalizedUnit = "L";
    if (unit === "mg") normalizedUnit = "mg";
    if (unit === "g" || unit === "gm") normalizedUnit = "g";
    if (unit === "kg") normalizedUnit = "kg";

    netVolume = `${value} ${normalizedUnit}`;
  }

  /*
   * ---------------------------------------------------------
   * BATCH NUMBER
   * ---------------------------------------------------------
   */

  let batchNumber = null;

  const batchMatch = text.match(
    /batch\s*(?:no|number)?\.?\s*:\s*\n?\s*([A-Za-z0-9-]{5,15})/i
  );

  if (batchMatch) {
    batchNumber = normalizeBatch(batchMatch[1]);
  }

  /*
   * ---------------------------------------------------------
   * MANUFACTURING DATE
   * ---------------------------------------------------------
   */

  let manufacturingDate = null;

  const manufacturingMatch = text.match(
    /(?:mfg|mfd|manufacturing)\s*(?:date|dt)?\s*:\s*\n?\s*((?:0?[1-9]|1[0-2])\s*[\/.\-]\s*(?:\d{2}|\d{4}))/i
  );

  if (manufacturingMatch) {
    manufacturingDate =
      manufacturingMatch[1].replace(/\s+/g, "");
  }

  /*
   * ---------------------------------------------------------
   * EXPIRY DATE
   * ---------------------------------------------------------
   */

  let expiryDate = null;

  const expiryMatch = text.match(
    /(?:expiry|exp|expiration)\s*(?:date|dt)?\s*:\s*\n?\s*((?:0?[1-9]|1[0-2])\s*[\/.\-]\s*(?:\d{2}|\d{4}))/i
  );

  if (expiryMatch) {
    expiryDate =
      expiryMatch[1].replace(/\s+/g, "");
  }

  /*
   * ---------------------------------------------------------
   * MRP
   * ---------------------------------------------------------
   *
   * IMPORTANT:
   * Only accept a value when it is directly associated with
   * the MRP label.
   */

  let mrp = null;

  const mrpMatch = text.match(
    /(?:M\.?\s*R\.?\s*P\.?|MRP)\s*[:.]?\s*(?:₹|Rs\.?|INR)?\s*(\d+(?:\.\d{1,2})?)\s*(?:\/-)?/i
  );

  if (mrpMatch) {
    const candidate = parseFloat(mrpMatch[1]);

    if (candidate >= 10 && candidate <= 100000) {
      mrp = candidate;
    }
  }

  /*
   * ---------------------------------------------------------
   * USP / PRICE PER ML
   * ---------------------------------------------------------
   */

  let usp = null;

  const uspMatch = text.match(
    /USP\s*(?:\/\s*ml|ml)?\s*[:.\-]?\s*(?:₹|Rs\.?|INR)?\s*(\d+(?:\.\d{1,2})?)\s*(?:\/-)?/i
  );

  if (uspMatch) {
    const value = parseFloat(uspMatch[1]);

    if (value > 0 && value < 10000) {
      usp = value;
    }
  }

  /*
   * ---------------------------------------------------------
   * PRICE VALIDATION
   * ---------------------------------------------------------
   */

  let priceValidation = null;

  if (mrp !== null && netVolume && usp !== null) {
    const volumeMatch = netVolume.match(
      /(\d+(?:\.\d+)?)/
    );

    if (volumeMatch) {
      const volume = parseFloat(volumeMatch[1]);

      if (volume > 0) {
        const calculatedUSP = mrp / volume;

        const difference =
          Math.abs(calculatedUSP - usp) /
          calculatedUSP;

        priceValidation = {
          valid: difference <= 0.02,
          calculatedUSP: Number(
            calculatedUSP.toFixed(2)
          ),
          extractedUSP: usp,
        };
      }
    }
  }

  /*
   * ---------------------------------------------------------
   * WARNINGS
   * ---------------------------------------------------------
   */

  const warnings = [];

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (
      /warning|caution|overdose|keep.*children|keep.*away|store.*light|store.*dry|store.*cool|store.*moisture|sunlight|external use only|for external use/i.test(
        line
      )
    ) {
      if (!warnings.includes(line)) {
        warnings.push(line);
      }
    }
  }

  /*
   * ---------------------------------------------------------
   * FINAL RESULT
   * ---------------------------------------------------------
   */

  return {
    medicineName,
    manufacturer,
    batchNumber,
    manufacturingDate,
    expiryDate,
    netVolume,
    mrp,
    usp,
    priceValidation,
    warnings,
  };
};

module.exports = {
  parseMedicineText,
};