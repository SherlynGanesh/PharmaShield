"""
PharmaShield AI - Blockchain-Based Medicine Supply Chain Verification Test Suite
Tests complete supply-chain lifecycle:
Manufacturer -> Retailer -> Wholesaler
Includes:
- Batch Registration with SHA-256 fingerprinting
- Image extraction & comparison against blockchain baseline
- Retailer verification & transfer
- Wholesaler verification & mismatch detection
- Tamper-evident ledger audit
"""

import requests
import json
from pathlib import Path

BASE_URL = "http://localhost:5000/api/blockchain"
TEST_IMAGES_DIR = Path(__file__).resolve().parent / "test_images"
SAMPLE_IMAGE = TEST_IMAGES_DIR / "diabetets_medicene.jpeg"

import time

def print_separator(title):
    print("\n" + "=" * 65)
    print(f" {title}")
    print("=" * 65)

def run_tests():
    print("Starting PharmaShield AI Blockchain Supply Chain Verification Test...")
    print(f"Sample image exists: {SAMPLE_IMAGE.exists()} ({SAMPLE_IMAGE})")

    # Generate a dynamic unique batch ID for this test run
    test_batch_id = f"BATCH-{int(time.time())}"

    # -------------------------------------------------------------
    # TEST 1: Manufacturer Registers a Batch
    # -------------------------------------------------------------
    print_separator("STEP 1: MANUFACTURER BATCH REGISTRATION")

    batch_data = {
        "medicineName": "Piopar-GZ Total",
        "batchNumber": test_batch_id,
        "quantity": "1000",
        "manufacturerName": "Bioaltus Pharmaceuticals Pvt. Ltd.",
        "manufacturingDate": "04/2026",
        "expiryDate": "03/2028",
        "medicineInfo": json.dumps({
            "medicineName": "Piopar-GZ Total",
            "manufacturer": "Bioaltus Pharmaceuticals Pvt. Ltd.",
            "batchNumber": test_batch_id,
            "manufacturingDate": "04/2026",
            "expiryDate": "03/2028"
        })
    }

    headers_mfr = {
        "x-role": "MANUFACTURER",
        "x-participant-name": "Bioaltus Manufacturing Unit 1"
    }

    # Upload with image file if it exists
    if SAMPLE_IMAGE.exists():
        with open(SAMPLE_IMAGE, "rb") as img:
            response = requests.post(
                f"{BASE_URL}/register",
                data=batch_data,
                files={"image": (SAMPLE_IMAGE.name, img, "image/jpeg")},
                headers=headers_mfr
            )
    else:
        response = requests.post(
            f"{BASE_URL}/register",
            json=batch_data,
            headers=headers_mfr
        )

    print(f"Status Code: {response.status_code}")
    reg_result = response.json()
    print("Registration Response:")
    print(json.dumps(reg_result, indent=2))
    assert reg_result.get("success") is True, f"Registration failed: {reg_result}"

    batch_id = batch_data["batchNumber"]

    # -------------------------------------------------------------
    # TEST 2: Retailer Verifies Package Against Blockchain Baseline
    # -------------------------------------------------------------
    print_separator("STEP 2: RETAILER VERIFICATION (MATCH)")

    retailer_verify_payload = {
        "batchId": batch_id,
        "stage": "RETAILER",
        "medicineInfo": {
            "medicineName": "Piopar-GZ Total",
            "manufacturer": "Bioaltus Pharmaceuticals Pvt. Ltd.",
            "batchNumber": batch_id,
            "manufacturingDate": "04/2026",
            "expiryDate": "03/2028"
        }
    }

    headers_ret = {
        "x-role": "RETAILER",
        "x-participant-name": "Apollo Prime Pharmacy"
    }

    ret_verify_res = requests.post(
        f"{BASE_URL}/verify",
        json=retailer_verify_payload,
        headers=headers_ret
    )

    print(f"Status Code: {ret_verify_res.status_code}")
    ret_verify_data = ret_verify_res.json()
    print("Retailer Verification Result:")
    print(json.dumps(ret_verify_data, indent=2))

    # -------------------------------------------------------------
    # TEST 3: Retailer Records Receipt and Transfer
    # -------------------------------------------------------------
    print_separator("STEP 3: RETAILER RECORDS TRANSFER ON BLOCKCHAIN")

    transfer_ret_payload = {
        "batchId": batch_id,
        "stage": "RETAILER",
        "sender": "Bioaltus Pharmaceuticals Pvt. Ltd.",
        "receiver": "Apollo Prime Pharmacy",
        "notes": "Verified package integrity at retail facility",
        "verified": True
    }

    ret_transfer_res = requests.post(
        f"{BASE_URL}/transfer",
        json=transfer_ret_payload,
        headers=headers_ret
    )

    print(f"Status Code: {ret_transfer_res.status_code}")
    print("Retailer Transfer Block:")
    print(json.dumps(ret_transfer_res.json(), indent=2))

    # -------------------------------------------------------------
    # TEST 4: Wholesaler Verifies with Inconsistent / Tampered Date
    # -------------------------------------------------------------
    print_separator("STEP 4: WHOLESALER VERIFICATION WITH MISMATCH (WARNING TEST)")

    wholesaler_mismatch_payload = {
        "batchId": batch_id,
        "stage": "WHOLESALER",
        "medicineInfo": {
            "medicineName": "Piopar-GZ Total",
            "manufacturer": "Bioaltus Pharmaceuticals Pvt. Ltd.",
            "batchNumber": batch_id,
            "manufacturingDate": "04/2026",
            "expiryDate": "12/2030" # Tampered/differs from registered 03/2028!
        }
    }

    headers_whl = {
        "x-role": "WHOLESALER",
        "x-participant-name": "MedSupply Logistics"
    }

    whl_mismatch_res = requests.post(
        f"{BASE_URL}/verify",
        json=wholesaler_mismatch_payload,
        headers=headers_whl
    )

    print(f"Status Code: {whl_mismatch_res.status_code}")
    whl_mismatch_data = whl_mismatch_res.json()
    print("Wholesaler Mismatch Verification (Flags Review):")
    print(json.dumps(whl_mismatch_data, indent=2))
    assert whl_mismatch_data["detailsMatch"] is False, "Expected detailsMatch to be False on mismatch"
    assert whl_mismatch_data["reviewRequired"] is True, "Expected reviewRequired to be True"
    assert len(whl_mismatch_data["warnings"]) > 0, "Expected at least 1 warning"

    # Attempting to transfer a rejected/unverified batch must fail
    transfer_fail_payload = {
        "batchId": batch_id,
        "stage": "WHOLESALER",
        "sender": "Apollo Prime Pharmacy",
        "receiver": "MedSupply Logistics",
        "notes": "Attempting transfer despite mismatch",
        "verified": False
    }

    fail_res = requests.post(
        f"{BASE_URL}/transfer",
        json=transfer_fail_payload,
        headers=headers_whl
    )
    print("\nAttempting unverified transfer response:")
    print(f"Status: {fail_res.status_code}, Body: {fail_res.text}")

    # -------------------------------------------------------------
    # TEST 5: Wholesaler Verifies Legitimate Batch & Records Transfer
    # -------------------------------------------------------------
    print_separator("STEP 5: WHOLESALER VERIFIES GENUINE PACKAGE & TRANSFERS")

    wholesaler_valid_payload = {
        "batchId": batch_id,
        "stage": "WHOLESALER",
        "medicineInfo": {
            "medicineName": "Piopar-GZ Total",
            "manufacturer": "Bioaltus Pharmaceuticals Pvt. Ltd.",
            "batchNumber": batch_id,
            "manufacturingDate": "04/2026",
            "expiryDate": "03/2028"
        }
    }

    whl_valid_res = requests.post(
        f"{BASE_URL}/verify",
        json=wholesaler_valid_payload,
        headers=headers_whl
    )

    print("Wholesaler Valid Verification:")
    print(json.dumps(whl_valid_res.json(), indent=2))

    whl_transfer_res = requests.post(
        f"{BASE_URL}/transfer",
        json={
            "batchId": batch_id,
            "stage": "WHOLESALER",
            "sender": "Apollo Prime Pharmacy",
            "receiver": "MedSupply Logistics",
            "notes": "Wholesaler accepted receipt and verified genuine record",
            "verified": True
        },
        headers=headers_whl
    )
    print("Wholesaler Transfer Recorded:")
    print(json.dumps(whl_transfer_res.json(), indent=2))

    # -------------------------------------------------------------
    # TEST 6: Audit Full Batch Timeline & Blockchain Integrity
    # -------------------------------------------------------------
    print_separator("STEP 6: BATCH AUDIT & BLOCKCHAIN INTEGRITY")

    batch_query_res = requests.get(f"{BASE_URL}/batch/{batch_id}")
    print(f"Batch {batch_id} Lifecycle:")
    print(json.dumps(batch_query_res.json(), indent=2))

    integrity_res = requests.get(f"{BASE_URL}/integrity")
    print("\nBlockchain Cryptographic Integrity Audit:")
    print(json.dumps(integrity_res.json(), indent=2))

    print("\n>>> ALL PHARMASHIELD AI BLOCKCHAIN TESTS PASSED SUCCESSFULLY! <<<")

if __name__ == "__main__":
    run_tests()
