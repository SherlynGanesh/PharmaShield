import requests
import json
from pathlib import Path

BASE_URL = "http://localhost:5000/api/medicine"

# Locate the image in the project folder
project_folder = Path(__file__).resolve().parent


image_path = Path(__file__).parent / "test_images" / "diabetets_medicene.jpeg"

print("Project folder:", project_folder)
print("Image path:", image_path)
print("Image exists:", image_path.exists())

# STEP 1: Extract medicine information from the image
print("\nSTEP 1: Extracting medicine information...")

with image_path.open("rb") as image:
    response = requests.post(
        f"{BASE_URL}/gemini-vision",
        files={
            "image": (
                image_path.name,
                image,
                "image/jpeg"
            )
        }
    )

print("Extraction status:", response.status_code)

if response.status_code != 200:
    print(response.text)
    raise SystemExit("Image extraction failed.")

extraction_result = response.json()
medicine_info = extraction_result["medicineInfo"]

print("\nExtracted medicine information:")
print(json.dumps(medicine_info, indent=2))


# STEP 2: Verify the extracted information against the dataset
print("\nSTEP 2: Verifying medicine reference...")

verification_response = requests.post(
    f"{BASE_URL}/verify-reference",
    json={"medicineInfo": medicine_info}
)

print("Verification status:", verification_response.status_code)
print("\nVerification result:")
print(json.dumps(verification_response.json(), indent=2))
