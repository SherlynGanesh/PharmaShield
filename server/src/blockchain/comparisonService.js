/**
 * Normalizes a text string for fuzzy / robust comparisons.
 */
function normalizeString(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .toLowerCase()
    .replace(/[®™.,\-_\/()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalizes batch number identifiers (strips punctuation and spaces).
 */
function normalizeBatchNumber(value) {
  if (!value) return "";
  return String(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

/**
 * Parses common date formats (YYYY-MM, MM/YYYY, DD/MM/YYYY, Month YYYY) into { year, month }.
 */
function parseDateParts(value) {
  if (!value) return null;
  const str = String(value).trim();

  // Try standard YYYY-MM or YYYY-MM-DD
  let match = str.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.]\d{1,2})?$/);
  if (match) {
    return { year: parseInt(match[1], 10), month: parseInt(match[2], 10) };
  }

  // Try MM/YYYY or DD/MM/YYYY
  match = str.match(/^(?:(\d{1,2})[-/.])?(\d{1,2})[-/.](\d{4})$/);
  if (match) {
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    return { year, month };
  }

  // Try MM/YY (2-digit year like 04/26 -> 2026)
  match = str.match(/^(\d{1,2})[-/.](\d{2})$/);
  if (match) {
    const month = parseInt(match[1], 10);
    const year = 2000 + parseInt(match[2], 10);
    return { year, month };
  }

  // Try Month Name YYYY (e.g. "Apr 2026" or "April 2026")
  const months = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
  };
  const monthMatch = str.match(/([a-zA-Z]{3,9})\s*[-/.,]?\s*(\d{2,4})/);
  if (monthMatch) {
    const mStr = monthMatch[1].substring(0, 3).toLowerCase();
    if (months[mStr]) {
      let yr = parseInt(monthMatch[2], 10);
      if (yr < 100) yr += 2000;
      return { year: yr, month: months[mStr] };
    }
  }

  return null;
}

/**
 * Compares two medicine dates for equivalence (comparing Year and Month).
 */
function compareDates(extracted, registered) {
  if (!extracted || !registered) {
    return { match: false, reason: "Date information missing" };
  }

  // Exact string match check
  if (normalizeString(extracted) === normalizeString(registered)) {
    return { match: true };
  }

  const pExtracted = parseDateParts(extracted);
  const pRegistered = parseDateParts(registered);

  if (pExtracted && pRegistered) {
    if (pExtracted.year === pRegistered.year && pExtracted.month === pRegistered.month) {
      return { match: true };
    }
    return {
      match: false,
      reason: `Dates do not match (extracted ${pExtracted.month}/${pExtracted.year} vs registered ${pRegistered.month}/${pRegistered.year})`
    };
  }

  // Fallback to normalized substring comparison
  const nExt = normalizeString(extracted);
  const nReg = normalizeString(registered);
  if (nExt.includes(nReg) || nReg.includes(nExt)) {
    return { match: true };
  }

  return { match: false, reason: `Unrecognized or mismatched date format ("${extracted}" vs "${registered}")` };
}

/**
 * Compares extracted medicine package details against the registered manufacturer baseline.
 * Produces field-by-field verification status and warnings.
 *
 * @param {Object} extractedDetails - Fields extracted via AI vision/OCR
 * @param {Object} registeredRecord - Immutable batch record from blockchain
 * @param {string} stage - Current supply chain stage (e.g., 'MANUFACTURER', 'RETAILER', 'WHOLESALER')
 * @returns {Object} Verification result object adhering to user specification
 */
function verifyAgainstBlockchainRecord(extractedDetails, registeredRecord, stage = "RETAILER") {
  const warnings = [];
  const checks = {
    medicineName: "MISMATCH",
    manufacturer: "MISMATCH",
    batchNumber: "MISMATCH",
    manufacturingDate: "MISMATCH",
    expiryDate: "MISMATCH",
  };

  if (!registeredRecord) {
    return {
      batchId: extractedDetails?.batchNumber || "UNKNOWN",
      stage: stage.toUpperCase(),
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
      warnings: ["Batch number is not registered on the blockchain. Verification cannot proceed."],
      history: [],
    };
  }

  const batchId = registeredRecord.batchNumber;

  // 1. Medicine Name Check
  if (!extractedDetails?.medicineName) {
    checks.medicineName = "MISSING_INFORMATION";
    warnings.push("Medicine name was not detected on the uploaded package image");
  } else {
    const extName = normalizeString(extractedDetails.medicineName);
    const regName = normalizeString(registeredRecord.medicineName);

    if (extName === regName || extName.includes(regName) || regName.includes(extName)) {
      checks.medicineName = "MATCH";
    } else {
      checks.medicineName = "MISMATCH";
      warnings.push(`Medicine name differs: extracted "${extractedDetails.medicineName}", registered "${registeredRecord.medicineName}"`);
    }
  }

  // 2. Manufacturer Check
  const regMfr = registeredRecord.manufacturer || registeredRecord.manufacturerName;
  if (!extractedDetails?.manufacturer) {
    checks.manufacturer = "MISSING_INFORMATION";
    warnings.push("Manufacturer name was not detected on the package image");
  } else {
    const extMfr = normalizeString(extractedDetails.manufacturer);
    const regMfrNorm = normalizeString(regMfr);

    if (extMfr === regMfrNorm || extMfr.includes(regMfrNorm) || regMfrNorm.includes(extMfr)) {
      checks.manufacturer = "MATCH";
    } else {
      checks.manufacturer = "MISMATCH";
      warnings.push(`Manufacturer differs from registered record: extracted "${extractedDetails.manufacturer}", registered "${regMfr}"`);
    }
  }

  // 3. Batch Number Check
  if (!extractedDetails?.batchNumber) {
    checks.batchNumber = "MISSING_INFORMATION";
    warnings.push("Batch number was not detected on the package image");
  } else {
    const extBatch = normalizeBatchNumber(extractedDetails.batchNumber);
    const regBatch = normalizeBatchNumber(registeredRecord.batchNumber);

    if (extBatch === regBatch || extBatch.includes(regBatch) || regBatch.includes(extBatch)) {
      checks.batchNumber = "MATCH";
    } else {
      checks.batchNumber = "MISMATCH";
      warnings.push(`Batch number differs: extracted "${extractedDetails.batchNumber}", registered "${registeredRecord.batchNumber}"`);
    }
  }

  // 4. Manufacturing Date Check
  if (!extractedDetails?.manufacturingDate) {
    checks.manufacturingDate = "MISSING_INFORMATION";
    warnings.push("Manufacturing date was not detected on the package image");
  } else {
    const mfgComp = compareDates(extractedDetails.manufacturingDate, registeredRecord.manufacturingDate);
    if (mfgComp.match) {
      checks.manufacturingDate = "MATCH";
    } else {
      checks.manufacturingDate = "MISMATCH";
      warnings.push(`Manufacturing date differs: extracted "${extractedDetails.manufacturingDate}", registered "${registeredRecord.manufacturingDate}"`);
    }
  }

  // 5. Expiry Date Check
  if (!extractedDetails?.expiryDate) {
    checks.expiryDate = "MISSING_INFORMATION";
    warnings.push("Expiry date was not detected on the package image");
  } else {
    const expComp = compareDates(extractedDetails.expiryDate, registeredRecord.expiryDate);
    if (expComp.match) {
      checks.expiryDate = "MATCH";
    } else {
      checks.expiryDate = "MISMATCH";
      warnings.push(`Expiry date differs from the manufacturer's registered record: extracted "${extractedDetails.expiryDate}", registered "${registeredRecord.expiryDate}"`);
    }
  }

  // Check if any critical field failed
  const allMatched =
    checks.medicineName === "MATCH" &&
    checks.manufacturer === "MATCH" &&
    checks.batchNumber === "MATCH" &&
    checks.manufacturingDate === "MATCH" &&
    checks.expiryDate === "MATCH";

  const reviewRequired = !allMatched || warnings.length > 0;

  return {
    batchId,
    stage: stage.toUpperCase(),
    registered: true,
    detailsMatch: allMatched,
    checks,
    reviewRequired,
    warnings,
  };
}

module.exports = {
  normalizeString,
  normalizeBatchNumber,
  compareDates,
  verifyAgainstBlockchainRecord,
};
