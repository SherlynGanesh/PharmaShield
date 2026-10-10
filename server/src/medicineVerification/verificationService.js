const fs = require("fs");
const path = require("path");

const referencePath = path.join(
    __dirname,
    "data",
    "medicineReference.json"
);

function loadReferenceData() {
    const data = fs.readFileSync(referencePath, "utf8");
    const medicines = JSON.parse(data);

    console.log("Reference file:", referencePath);
    console.log("Number of records:", medicines.length);
    console.log(
        "Medicine names:",
        medicines.map(m => m.medicineName)
    );

    return medicines;
}

// Normalize text before comparing it.
function normalize(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

// Parse common medicine date formats.
// Examples: 06/2030, 2027-07, 07/2027.
function parseMedicineDate(value, isExpiry = false) {
    if (!value) {
        return null;
    }

    const text = String(value).trim();

    let year;
    let month;
    let day = 1;

    // YYYY-MM or YYYY-MM-DD
    let match = text.match(
        /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/
    );

    if (match) {
        year = Number(match[1]);
        month = Number(match[2]);
        day = match[3] ? Number(match[3]) : 1;
    } else {
        // MM/YYYY or MM/YYYY with surrounding whitespace
        match = text.match(/^(\d{1,2})\/(\d{4})$/);

        if (match) {
            month = Number(match[1]);
            year = Number(match[2]);
        } else {
            // DD/MM/YYYY
            match = text.match(
                /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
            );

            if (match) {
                day = Number(match[1]);
                month = Number(match[2]);
                year = Number(match[3]);
            } else {
                return null;
            }
        }
    }

    if (
        year < 1900 ||
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31
    ) {
        return null;
    }

    const date = new Date(
        Date.UTC(year, month - 1, day)
    );

    // Reject impossible dates such as 31 February.
    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        return null;
    }

    // When only month/year is printed, an expiry month
    // remains valid through the end of that month.
    if (isExpiry && !text.match(/^\d{4}-\d{1,2}-\d{1,2}$/)
        && !text.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        return new Date(
            Date.UTC(year, month, 0, 23, 59, 59)
        );
    }

    return date;
}

// Compare the extracted composition with the reference.
function normalizeComposition(value) {
    if (!value) {
        return "";
    }

    if (typeof value === "string") {
        return value
            .toLowerCase()
            .replace(/[®™]/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    if (Array.isArray(value)) {
        return value
            .map((item) => {
                if (typeof item === "string") {
                    return normalizeComposition(item);
                }

                return normalizeComposition(
                    `${item.ingredient || ""} ${item.strength || ""}`
                );
            })
            .filter(Boolean)
            .sort()
            .join(" ");
    }

    return "";
}

function compareComposition(extracted, reference) {
    const extractedText = normalizeComposition(extracted);
    const referenceText = normalizeComposition(reference);

    if (!extractedText || !referenceText) {
        return "MISSING_INFORMATION";
    }

    if (extractedText === referenceText) {
        return "MATCH";
    }

    return "REVIEW_REQUIRED";
}

function verifyMedicine(medicineInfo) {
    const referenceData = loadReferenceData();

    const warnings = [];

    if (!medicineInfo || typeof medicineInfo !== "object") {
        throw new Error("Valid medicine information is required");
    }

    const medicineName = medicineInfo.medicineName;
    const manufacturer = medicineInfo.manufacturer;

    if (!medicineName) {
        return {
            medicineFound: false,
            status: "INSUFFICIENT_INFORMATION",
            warnings: ["Medicine name is missing"],
            reviewRequired: true
        };
    }

    // Find the product by name and, when supplied,
    // manufacturer. A name alone may identify several products.
    // Step 1: Find products using medicine name only.
    const nameMatches = referenceData.filter(
        (item) =>
            normalize(item.medicineName) === normalize(medicineName)
    );

    // No matching name exists in the reference dataset.
    if (nameMatches.length === 0) {
        return {
            medicineFound: false,
            status: "REFERENCE_NOT_FOUND",
            warnings: [
                "Medicine name was not found in the reference dataset"
            ],
            reviewRequired: true
        };
    }

    // Multiple products share the same name.
    // Do not select an arbitrary reference.
    if (nameMatches.length > 1) {
        return {
            medicineFound: false,
            status: "AMBIGUOUS_REFERENCE",
            warnings: [
                "Multiple reference products have this medicine name"
            ],
            reviewRequired: true
        };
    }

    // Step 2: Name matched. Select the reference product.
    // Other fields will be compared separately.
    const reference = nameMatches[0];


    const manufacturerMatches =
        Boolean(medicineInfo.manufacturer) &&
        normalize(reference.manufacturer) ===
        normalize(medicineInfo.manufacturer);
    if (!medicineInfo.manufacturer) {
        warnings.push("Manufacturer information is missing");
    } else if (!manufacturerMatches) {
        warnings.push(
            `Manufacturer differs: extracted "${medicineInfo.manufacturer}", ` +
            `reference "${reference.manufacturer || "Not available"}"`
        );
    }
    const compositionStatus = compareComposition(
        medicineInfo.composition,
        reference.composition
    );

    if (compositionStatus !== "MATCH") {
        warnings.push(
            compositionStatus === "MISSING_INFORMATION"
                ? "Composition could not be fully compared"
                : "Extracted composition differs from the reference"
        );
    }

    // Check expiry independently of the product match.
    const expiryDate = parseMedicineDate(
        medicineInfo.expiryDate,
        true
    );

    let expiryStatus = "UNKNOWN";

    if (!medicineInfo.expiryDate) {
        expiryStatus = "MISSING";
        warnings.push("Expiry date was not extracted");
    } else if (!expiryDate) {
        expiryStatus = "INVALID_FORMAT";
        warnings.push("Expiry date could not be parsed");
    } else if (expiryDate < new Date()) {
        expiryStatus = "EXPIRED";
        warnings.push("The extracted expiry date has passed");
    } else {
        expiryStatus = "NOT_EXPIRED";
    }

    // Check whether the manufacturing date is valid
    // and whether it occurs after the expiry date.
    const manufacturingDate = parseMedicineDate(
        medicineInfo.manufacturingDate
    );

    if (
        medicineInfo.manufacturingDate &&
        !manufacturingDate
    ) {
        warnings.push("Manufacturing date could not be parsed");
    }

    if (
        manufacturingDate &&
        manufacturingDate > new Date()
    ) {
        warnings.push("Manufacturing date appears to be in the future");
    }

    if (
        manufacturingDate &&
        expiryDate &&
        manufacturingDate > expiryDate
    ) {
        warnings.push(
            "Manufacturing date occurs after the expiry date"
        );
    }

    // Batch numbers are NOT compared with product-level
    // reference records.
    const batchNumber = medicineInfo.batchNumber || null;

    return {
        medicineFound: true,
        productId: reference.productId,

        checks: {
            medicineName: "MATCH",

            manufacturer: !medicineInfo.manufacturer
                ? "MISSING_INFORMATION"
                : manufacturerMatches
                    ? "MATCH"
                    : "MISMATCH",

            composition: compositionStatus,
            expiry: expiryStatus,

            batchNumber: batchNumber
                ? "NOT_VERIFIED"
                : "MISSING_INFORMATION"
        },

        batchNumber,

        warnings,

        reviewRequired:
            warnings.length > 0 ||
            !manufacturer ||
            !batchNumber ||
            compositionStatus !== "MATCH" ||
            expiryStatus !== "NOT_EXPIRED"
    };
}

module.exports = {
    verifyMedicine
};