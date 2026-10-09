const Tesseract = require("tesseract.js");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const extractTextFromImage = async (imagePath) => {
  const fileName = path.basename(
    imagePath,
    path.extname(imagePath)
  );

  const directory = path.dirname(imagePath);

  const tempFiles = {
    original: path.join(
      directory,
      `${fileName}-original.png`
    ),

    grayscale: path.join(
      directory,
      `${fileName}-grayscale.png`
    ),

    enhanced: path.join(
      directory,
      `${fileName}-enhanced.png`
    ),

    highContrast: path.join(
      directory,
      `${fileName}-high-contrast.png`
    ),

    inverted: path.join(
      directory,
      `${fileName}-inverted.png`
    ),
  };

  let worker = null;

  try {
    console.log("\n=================================");
    console.log("PHARMASHIELD AI - OCR STARTED");
    console.log("=================================\n");

    // ---------------------------------------------------------
    // 1. GET IMAGE INFORMATION
    // ---------------------------------------------------------

    const metadata = await sharp(imagePath).metadata();

    console.log("Original image:");
    console.log(`Width  : ${metadata.width}`);
    console.log(`Height : ${metadata.height}`);
    console.log(`Format : ${metadata.format}`);

    // ---------------------------------------------------------
    // 2. NORMALIZE + UPSCALE IMAGE
    // ---------------------------------------------------------

    console.log("\nPreparing image...");

    await sharp(imagePath)
      .rotate()
      .resize({
        width: 2400,
        height: 2400,
        fit: "inside",
        withoutEnlargement: false,
      })
      .png()
      .toFile(tempFiles.original);

    // ---------------------------------------------------------
    // 3. GRAYSCALE IMAGE
    // ---------------------------------------------------------

    console.log("Creating grayscale image...");

    await sharp(tempFiles.original)
      .grayscale()
      .normalize()
      .sharpen({
        sigma: 1,
      })
      .png()
      .toFile(tempFiles.grayscale);

    // ---------------------------------------------------------
    // 4. ENHANCED IMAGE
    // ---------------------------------------------------------

    console.log("Creating enhanced image...");

    await sharp(tempFiles.original)
      .grayscale()
      .normalize()
      .linear(1.25, -20)
      .sharpen({
        sigma: 1.2,
      })
      .png()
      .toFile(tempFiles.enhanced);

    // ---------------------------------------------------------
    // 5. HIGH CONTRAST IMAGE
    // ---------------------------------------------------------

    console.log("Creating high contrast image...");

    await sharp(tempFiles.original)
      .grayscale()
      .normalize()
      .linear(1.7, -60)
      .sharpen({
        sigma: 1.5,
      })
      .png()
      .toFile(tempFiles.highContrast);

    // ---------------------------------------------------------
    // 6. INVERTED IMAGE
    // ---------------------------------------------------------

    console.log("Creating inverted image...");

    await sharp(tempFiles.original)
      .grayscale()
      .normalize()
      .negate()
      .sharpen({
        sigma: 1,
      })
      .png()
      .toFile(tempFiles.inverted);

    console.log("\nImage preprocessing completed.");

    // ---------------------------------------------------------
    // 7. CREATE TESSERACT WORKER
    // ---------------------------------------------------------

    console.log("\nStarting Tesseract...");

    worker = await Tesseract.createWorker("eng", 1, {
      logger: (info) => {
        if (info.status === "recognizing text") {
          const progress = Math.round(
            info.progress * 100
          );

          console.log(
            `Tesseract progress: ${progress}%`
          );
        }
      },
    });

    // ---------------------------------------------------------
    // 8. OCR FUNCTION
    // ---------------------------------------------------------

    const runOCR = async (
      imagePathToRead,
      pageSegmentationMode,
      name
    ) => {
      console.log(
        `\nRunning ${name} OCR...`
      );

      await worker.setParameters({
        tessedit_pageseg_mode:
          String(pageSegmentationMode),

        preserve_interword_spaces: "1",

        user_defined_dpi: "300",
      });

      const result = await worker.recognize(
        imagePathToRead
      );

      const text =
        result?.data?.text || "";

      const confidence =
        typeof result?.data?.confidence === "number"
          ? result.data.confidence
          : 0;

      console.log(
        `${name} confidence: ${confidence.toFixed(2)}`
      );

      console.log(
        `${name} characters: ${text.length}`
      );

      return {
        name,
        text: text.trim(),
        confidence,
      };
    };

    // ---------------------------------------------------------
    // 9. RUN MULTIPLE OCR PASSES
    // ---------------------------------------------------------

    const results = [];

    // Normal text
    results.push(
      await runOCR(
        tempFiles.grayscale,
        6,
        "GRAYSCALE"
      )
    );

    // Scattered text / labels
    results.push(
      await runOCR(
        tempFiles.enhanced,
        11,
        "ENHANCED"
      )
    );

    // Small printed text
    results.push(
      await runOCR(
        tempFiles.highContrast,
        11,
        "HIGH CONTRAST"
      )
    );

    // White text on dark background
    results.push(
      await runOCR(
        tempFiles.inverted,
        11,
        "INVERTED"
      )
    );

    // ---------------------------------------------------------
    // 10. REMOVE EMPTY RESULTS
    // ---------------------------------------------------------

    const validResults = results.filter(
      (result) =>
        result.text &&
        result.text.trim().length > 0
    );

    // ---------------------------------------------------------
    // 11. FIND BEST OCR RESULT
    // ---------------------------------------------------------

    let bestResult = null;

    if (validResults.length > 0) {
      bestResult = [...validResults].sort(
        (a, b) => {
          const scoreA =
            a.confidence * 0.75 +
            Math.min(a.text.length, 2000) * 0.025;

          const scoreB =
            b.confidence * 0.75 +
            Math.min(b.text.length, 2000) * 0.025;

          return scoreB - scoreA;
        }
      )[0];
    }

    // ---------------------------------------------------------
    // 12. COMBINE ALL OCR RESULTS
    // ---------------------------------------------------------

    const combinedSections = [];

    for (const result of results) {
      combinedSections.push(
        [
          `===== ${result.name} OCR =====`,
          result.text,
          `OCR CONFIDENCE: ${result.confidence.toFixed(2)}`,
        ].join("\n")
      );
    }

    const combinedText =
      combinedSections.join("\n\n");

    // ---------------------------------------------------------
    // 13. DISPLAY BEST RESULT
    // ---------------------------------------------------------

    console.log(
      "\n================================="
    );

    console.log("OCR COMPLETED");

    console.log(
      "================================="
    );

    if (bestResult) {
      console.log(
        `Best OCR pass: ${bestResult.name}`
      );

      console.log(
        `Best confidence: ${bestResult.confidence.toFixed(2)}`
      );
    }

    console.log(
      "\n========== BEST OCR TEXT ==========\n"
    );

    console.log(
      bestResult
        ? bestResult.text
        : "No text detected"
    );

    console.log(
      "\n=================================\n"
    );

    // ---------------------------------------------------------
    // 14. RETURN OCR DATA
    // ---------------------------------------------------------

    return {
      text: combinedText,

      bestText: bestResult
        ? bestResult.text
        : "",

      confidence: bestResult
        ? Number(
            bestResult.confidence.toFixed(2)
          )
        : 0,

      passes: results.map((result) => ({
        type: result.name,

        confidence: Number(
          result.confidence.toFixed(2)
        ),

        text: result.text,
      })),
    };
  } catch (error) {
    console.error(
      "\nOCR SERVICE ERROR:"
    );

    console.error(error);

    throw error;
  } finally {
    // ---------------------------------------------------------
    // 15. TERMINATE TESSERACT
    // ---------------------------------------------------------

    if (worker) {
      try {
        await worker.terminate();

        console.log(
          "Tesseract worker terminated."
        );
      } catch (error) {
        console.error(
          "Error terminating Tesseract worker:",
          error.message
        );
      }
    }

    // ---------------------------------------------------------
    // 16. DELETE TEMPORARY FILES
    // ---------------------------------------------------------

    for (const filePath of Object.values(
      tempFiles
    )) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.error(
          `Could not delete temporary file: ${filePath}`
        );
      }
    }

    console.log(
      "Temporary OCR files cleaned."
    );
  }
};

module.exports = {
  extractTextFromImage,
};