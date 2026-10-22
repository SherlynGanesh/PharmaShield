import { useState, useEffect } from 'react';
import './App.css';

const API_BASE = 'http://localhost:5000/api/blockchain';

export default function App() {
  const [activeTab, setActiveTab] = useState('FLOW');
  const [activeRole, setActiveRole] = useState('MANUFACTURER');
  
  // Blockchain Ledger state
  const [ledger, setLedger] = useState({ chain: [], blockCount: 0, integrity: { isValid: true } });
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [auditResult, setAuditResult] = useState(null);

  // Manufacturer Registration Form State
  const [mfrForm, setMfrForm] = useState({
    medicineName: 'Piopar-GZ Total',
    batchNumber: 'BATCH-2026-X1',
    quantity: '500',
    manufacturerName: 'Bioaltus Pharmaceuticals Pvt. Ltd.',
    manufacturingDate: '04/2026',
    expiryDate: '03/2028',
  });
  const [mfrImageFile, setMfrImageFile] = useState(null);
  const [mfrImagePreview, setMfrImagePreview] = useState(null);
  const [mfrLoading, setMfrLoading] = useState(false);
  const [mfrResult, setMfrResult] = useState(null);
  const [mfrError, setMfrError] = useState(null);

  // Retailer Verification State
  const [retBatchId, setRetBatchId] = useState('BATCH-2026-X1');
  const [retImageFile, setRetImageFile] = useState(null);
  const [retImagePreview, setRetImagePreview] = useState(null);
  const [retLoading, setRetLoading] = useState(false);
  const [retResult, setRetResult] = useState(null);
  const [retTransferLoading, setRetTransferLoading] = useState(false);
  const [retTransferSuccess, setRetTransferSuccess] = useState(null);

  // Wholesaler Verification State
  const [whlBatchId, setWhlBatchId] = useState('BATCH-2026-X1');
  const [whlImageFile, setWhlImageFile] = useState(null);
  const [whlImagePreview, setWhlImagePreview] = useState(null);
  const [whlLoading, setWhlLoading] = useState(false);
  const [whlResult, setWhlResult] = useState(null);
  const [whlTransferLoading, setWhlTransferLoading] = useState(false);
  const [whlTransferSuccess, setWhlTransferSuccess] = useState(null);

  // Batch Audit Search State
  const [searchBatchId, setSearchBatchId] = useState('');
  const [auditBatchData, setAuditBatchData] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);

  // Fetch full ledger
  const fetchLedger = async () => {
    setLoadingLedger(true);
    try {
      const res = await fetch(`${API_BASE}/ledger`);
      const data = await res.json();
      if (data.success) {
        setLedger(data);
      }
    } catch (err) {
      console.error('Failed to fetch ledger:', err);
    } finally {
      setLoadingLedger(false);
    }
  };

  // Run integrity audit
  const runIntegrityAudit = async () => {
    try {
      const res = await fetch(`${API_BASE}/integrity`);
      const data = await res.json();
      setAuditResult(data.tamperEvidentAudit);
    } catch (err) {
      console.error('Failed to audit integrity:', err);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  // Handle Image Selection
  const handleImageChange = (e, setFile, setPreview) => {
    const file = e.target.files?.[0];
    if (file) {
      setFile(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  // Load sample Piopar-GZ preset into manufacturer form
  const loadManufacturerSample = () => {
    const randomId = 'BATCH-' + Math.floor(100 + Math.random() * 900);
    setMfrForm({
      medicineName: 'Piopar-GZ Total',
      batchNumber: randomId,
      quantity: '1000',
      manufacturerName: 'Bioaltus Pharmaceuticals Pvt. Ltd.',
      manufacturingDate: '04/2026',
      expiryDate: '03/2028',
    });
    setRetBatchId(randomId);
    setWhlBatchId(randomId);
    setMfrResult(null);
    setMfrError(null);
  };

  // Load sample PAN 40 preset (matches test_images/diabetets_medicene.jpeg)
  const loadPan40Sample = () => {
    const batchId = '19443036-' + Math.floor(100 + Math.random() * 900);
    setMfrForm({
      medicineName: 'PAN 40',
      batchNumber: batchId,
      quantity: '500',
      manufacturerName: 'Health Science',
      manufacturingDate: '11/2019',
      expiryDate: '04/2022',
    });
    setRetBatchId(batchId);
    setWhlBatchId(batchId);
    setMfrResult(null);
    setMfrError(null);
  };

  // Manufacturer Registration Submit
  const handleManufacturerRegister = async (e) => {
    e.preventDefault();
    setMfrLoading(true);
    setMfrResult(null);
    setMfrError(null);

    try {
      const formData = new FormData();
      formData.append('medicineName', mfrForm.medicineName);
      formData.append('batchNumber', mfrForm.batchNumber);
      formData.append('quantity', mfrForm.quantity);
      formData.append('manufacturerName', mfrForm.manufacturerName);
      formData.append('manufacturingDate', mfrForm.manufacturingDate);
      formData.append('expiryDate', mfrForm.expiryDate);

      // Provide simulated extracted details if no image file was attached
      if (mfrImageFile) {
        formData.append('image', mfrImageFile);
      } else {
        formData.append('medicineInfo', JSON.stringify({
          medicineName: mfrForm.medicineName,
          manufacturer: mfrForm.manufacturerName,
          batchNumber: mfrForm.batchNumber,
          manufacturingDate: mfrForm.manufacturingDate,
          expiryDate: mfrForm.expiryDate,
        }));
      }

      const res = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: {
          'x-role': 'MANUFACTURER',
          'x-participant-name': mfrForm.manufacturerName,
        },
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMfrResult(data);
        setRetBatchId(mfrForm.batchNumber);
        setWhlBatchId(mfrForm.batchNumber);
        fetchLedger();
      } else {
        setMfrResult(data);
        setMfrError(data.message || 'Registration flagged or rejected.');
      }
    } catch (err) {
      setMfrError('Network error connecting to backend server.');
    } finally {
      setMfrLoading(false);
    }
  };

  // Retailer Verification Submit
  const handleRetailerVerify = async (simulatedTamper = false) => {
    setRetLoading(true);
    setRetResult(null);
    setRetTransferSuccess(null);

    try {
      const formData = new FormData();
      formData.append('batchId', retBatchId);
      formData.append('stage', 'RETAILER');

      if (retImageFile) {
        formData.append('image', retImageFile);
      } else {
        formData.append('medicineInfo', JSON.stringify({
          medicineName: 'Piopar-GZ Total',
          manufacturer: 'Bioaltus Pharmaceuticals Pvt. Ltd.',
          batchNumber: retBatchId,
          manufacturingDate: '04/2026',
          expiryDate: simulatedTamper ? '11/2032' : '03/2028',
        }));
      }

      const res = await fetch(`${API_BASE}/verify`, {
        method: 'POST',
        headers: {
          'x-role': 'RETAILER',
          'x-participant-name': 'Apollo Prime Pharmacy',
        },
        body: formData,
      });

      const data = await res.json();
      setRetResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setRetLoading(false);
    }
  };

  // Retailer Transfer Submit
  const handleRetailerTransfer = async () => {
    setRetTransferLoading(true);
    try {
      const res = await fetch(`${API_BASE}/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-role': 'RETAILER',
          'x-participant-name': 'Apollo Prime Pharmacy',
        },
        body: JSON.stringify({
          batchId: retBatchId,
          stage: 'RETAILER',
          sender: retResult?.originalRecord?.registeredBy || 'Manufacturer',
          receiver: 'Apollo Prime Pharmacy',
          notes: 'Package verified and received into retail pharmacy inventory.',
          verified: retResult?.detailsMatch,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRetTransferSuccess(data);
        fetchLedger();
      } else {
        alert(data.message || 'Transfer failed.');
      }
    } catch (err) {
      alert('Failed to connect to blockchain server.');
    } finally {
      setRetTransferLoading(false);
    }
  };

  // Wholesaler Verification Submit
  const handleWholesalerVerify = async (simulatedTamper = false) => {
    setWhlLoading(true);
    setWhlResult(null);
    setWhlTransferSuccess(null);

    try {
      const formData = new FormData();
      formData.append('batchId', whlBatchId);
      formData.append('stage', 'WHOLESALER');

      if (whlImageFile) {
        formData.append('image', whlImageFile);
      } else {
        formData.append('medicineInfo', JSON.stringify({
          medicineName: 'Piopar-GZ Total',
          manufacturer: 'Bioaltus Pharmaceuticals Pvt. Ltd.',
          batchNumber: whlBatchId,
          manufacturingDate: '04/2026',
          expiryDate: simulatedTamper ? '09/2030' : '03/2028',
        }));
      }

      const res = await fetch(`${API_BASE}/verify`, {
        method: 'POST',
        headers: {
          'x-role': 'WHOLESALER',
          'x-participant-name': 'MedSupply Logistics',
        },
        body: formData,
      });

      const data = await res.json();
      setWhlResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setWhlLoading(false);
    }
  };

  // Wholesaler Transfer Submit
  const handleWholesalerTransfer = async () => {
    setWhlTransferLoading(true);
    try {
      const res = await fetch(`${API_BASE}/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-role': 'WHOLESALER',
          'x-participant-name': 'MedSupply Logistics',
        },
        body: JSON.stringify({
          batchId: whlBatchId,
          stage: 'WHOLESALER',
          sender: 'Apollo Prime Pharmacy',
          receiver: 'MedSupply Logistics & Wholesale Distribution',
          notes: 'Wholesaler verified package authenticity against blockchain manufacturer baseline.',
          verified: whlResult?.detailsMatch,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setWhlTransferSuccess(data);
        fetchLedger();
      } else {
        alert(data.message || 'Transfer failed.');
      }
    } catch (err) {
      alert('Failed to connect to blockchain server.');
    } finally {
      setWhlTransferLoading(false);
    }
  };

  // Search single batch audit
  const handleBatchAuditSearch = async (e) => {
    e?.preventDefault();
    if (!searchBatchId.trim()) return;
    setAuditLoading(true);
    setAuditBatchData(null);

    try {
      const res = await fetch(`${API_BASE}/batch/${encodeURIComponent(searchBatchId.trim())}`);
      const data = await res.json();
      setAuditBatchData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setAuditLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-inner">
          <div className="brand-section">
            <div className="brand-icon">
              <svg viewBox="0 0 24 24">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
              </svg>
            </div>
            <div>
              <h1 className="brand-title">PharmaShield AI</h1>
              <div className="brand-subtitle">Blockchain-Based Medicine Supply Chain Verification</div>
            </div>
          </div>

          <div className="participant-badge-container">
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Active Role:</span>
            <select
              value={activeRole}
              onChange={(e) => setActiveRole(e.target.value)}
              style={{ width: 'auto', padding: '4px 10px', fontSize: '0.82rem' }}
            >
              <option value="MANUFACTURER">Manufacturer (PharmaCorp)</option>
              <option value="RETAILER">Retailer (Apollo Prime)</option>
              <option value="WHOLESALER">Wholesaler (MedSupply)</option>
            </select>
            <div className="chain-live-status">
              <div className="pulse-dot"></div>
              <span>Ledger: {ledger.blockCount} Blocks</span>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs Navigation */}
      <nav className="tabs-navigation">
        <button
          className={`tab-btn ${activeTab === 'FLOW' ? 'active' : ''}`}
          onClick={() => setActiveTab('FLOW')}
        >
          <span>📦 Supply Chain Workflow</span>
          <span className="tab-badge">Core</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'LEDGER' ? 'active' : ''}`}
          onClick={() => { setActiveTab('LEDGER'); fetchLedger(); }}
        >
          <span>⛓️ Blockchain Ledger</span>
          <span className="tab-badge">{ledger.blockCount}</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'SIMULATOR' ? 'active' : ''}`}
          onClick={() => setActiveTab('SIMULATOR')}
        >
          <span>⚡ Tamper & Mismatch Simulator</span>
          <span className="tab-badge">Testing</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'AUDIT' ? 'active' : ''}`}
          onClick={() => setActiveTab('AUDIT')}
        >
          <span>🔍 Batch Lifecycle Audit</span>
        </button>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        {/* TAB 1: SUPPLY CHAIN WORKFLOW */}
        {activeTab === 'FLOW' && (
          <div>
            <div className="card" style={{ background: 'linear-gradient(180deg, rgba(16,185,129,0.06) 0%, rgba(18,24,38,0.7) 100%)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h2 style={{ fontSize: '1.3rem' }}>End-to-End Medicine Verification Pipeline</h2>
                  <p className="card-desc">
                    Every participant verifies against the <strong>Manufacturer's Immutable Blockchain Record</strong> (Source of Truth), not a local JSON database.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary" onClick={loadManufacturerSample}>
                    <span>⚡ Demo Preset</span>
                  </button>
                  <button className="btn btn-secondary" onClick={loadPan40Sample}>
                    <span>📷 Match Sample Image (PAN 40)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Stage 1: Manufacturer Registration */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="role-pill role-mfr">Stage 1</span>
                    <h2 className="card-title">Manufacturer Registration</h2>
                  </div>
                  <p className="card-desc">Source of Truth: Upload package image and register batch details on the blockchain.</p>
                </div>
                <span className="badge badge-info">Role: MANUFACTURER</span>
              </div>

              <form onSubmit={handleManufacturerRegister}>
                <div className="grid-3">
                  <div className="form-group">
                    <label className="form-label">Medicine Name</label>
                    <input
                      type="text"
                      value={mfrForm.medicineName}
                      onChange={(e) => setMfrForm({ ...mfrForm, medicineName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Batch Number</label>
                    <input
                      type="text"
                      value={mfrForm.batchNumber}
                      onChange={(e) => setMfrForm({ ...mfrForm, batchNumber: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Quantity</label>
                    <input
                      type="number"
                      value={mfrForm.quantity}
                      onChange={(e) => setMfrForm({ ...mfrForm, quantity: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Manufacturer Name</label>
                    <input
                      type="text"
                      value={mfrForm.manufacturerName}
                      onChange={(e) => setMfrForm({ ...mfrForm, manufacturerName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Manufacturing Date (MM/YYYY)</label>
                    <input
                      type="text"
                      value={mfrForm.manufacturingDate}
                      onChange={(e) => setMfrForm({ ...mfrForm, manufacturingDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Expiry Date (MM/YYYY)</label>
                    <input
                      type="text"
                      value={mfrForm.expiryDate}
                      onChange={(e) => setMfrForm({ ...mfrForm, expiryDate: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label className="form-label">Medicine Package Image (AI Vision Extraction)</label>
                  <label className="file-dropzone" style={{ display: 'block' }}>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => handleImageChange(e, setMfrImageFile, setMfrImagePreview)}
                    />
                    <div>📷 {mfrImageFile ? mfrImageFile.name : 'Click or drop medicine package image here (Optional: Uses AI extractor or preset)'}</div>
                  </label>
                  {mfrImagePreview && <img src={mfrImagePreview} alt="Preview" className="preview-img" />}
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '18px' }}>
                  <button type="submit" className="btn btn-primary" disabled={mfrLoading}>
                    {mfrLoading ? 'Analyzing & Registering on Blockchain...' : '🔐 Verify Image & Register Batch on Blockchain'}
                  </button>
                </div>
              </form>

              {/* Registration Result */}
              {mfrResult && (
                <div style={{ marginTop: '20px' }}>
                  {mfrResult.success ? (
                    <div className="alert-banner alert-success">
                      <div>
                        <strong>✅ Batch Successfully Registered on Blockchain!</strong>
                        <div>Block #{mfrResult.blockIndex} created. Cryptographic Batch SHA-256 fingerprint saved.</div>
                        <div className="hash-box" style={{ marginTop: '10px' }}>
                          <span>SHA-256 Batch Fingerprint: {mfrResult.dataHash}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="alert-banner alert-warning">
                      <div>
                        <strong>⚠️ Registration Flagged for Review!</strong>
                        <div>{mfrResult.message}</div>
                        {mfrResult.warnings?.map((w, idx) => (
                          <div key={idx} style={{ marginTop: '4px', fontSize: '0.85rem' }}>• {w}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Stage 2 & 3: Retailer & Wholesaler Grids */}
            <div className="grid-2">
              {/* Retailer Section */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <span className="role-pill role-ret">Stage 2</span>
                    <h3 style={{ marginTop: '6px' }}>Retailer Verification</h3>
                    <p className="card-desc">Compare medicine package against manufacturer's registered record.</p>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Batch ID to Verify</label>
                  <input
                    type="text"
                    value={retBatchId}
                    onChange={(e) => setRetBatchId(e.target.value)}
                    placeholder="e.g. BATCH-2026-X1"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Retailer Package Image</label>
                  <label className="file-dropzone" style={{ display: 'block', padding: '16px' }}>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => handleImageChange(e, setRetImageFile, setRetImagePreview)}
                    />
                    <div style={{ fontSize: '0.88rem' }}>📷 {retImageFile ? retImageFile.name : 'Upload Retailer Package Image'}</div>
                  </label>
                  {retImagePreview && <img src={retImagePreview} alt="Preview" className="preview-img" />}
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
                  <button className="btn btn-accent" onClick={() => handleRetailerVerify(false)} disabled={retLoading}>
                    {retLoading ? 'Verifying...' : '🔍 Verify Package'}
                  </button>
                  <button className="btn btn-secondary" onClick={() => handleRetailerVerify(true)} disabled={retLoading}>
                    Simulate Tampered Date
                  </button>
                </div>

                {/* Retailer Verification Result Output */}
                {retResult && (
                  <div style={{ marginTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Verification Result:</span>
                      {retResult.detailsMatch ? (
                        <span className="badge badge-match">AUTHENTIC & MATCHED</span>
                      ) : (
                        <span className="badge badge-mismatch">REVIEW REQUIRED</span>
                      )}
                    </div>

                    <table className="verification-checks-table">
                      <thead>
                        <tr>
                          <th>Check</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(retResult.checks || {}).map(([key, val]) => (
                          <tr key={key}>
                            <td>{key}</td>
                            <td>
                              <span className={`badge ${val === 'MATCH' ? 'badge-match' : val === 'MISMATCH' ? 'badge-mismatch' : 'badge-missing'}`}>
                                {val}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {retResult.warnings?.length > 0 && (
                      <div className="alert-banner alert-warning" style={{ marginTop: '14px' }}>
                        <div>
                          <strong>Warnings ({retResult.warnings.length}):</strong>
                          {retResult.warnings.map((w, idx) => (
                            <div key={idx} style={{ fontSize: '0.84rem', marginTop: '4px' }}>• {w}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {retResult.detailsMatch && (
                      <div style={{ marginTop: '16px' }}>
                        <button
                          className="btn btn-primary"
                          style={{ width: '100%' }}
                          onClick={handleRetailerTransfer}
                          disabled={retTransferLoading}
                        >
                          {retTransferLoading ? 'Committing Block...' : '✍️ Accept Receipt & Commit Retailer Block'}
                        </button>
                      </div>
                    )}

                    {retTransferSuccess && (
                      <div className="alert-banner alert-success" style={{ marginTop: '14px' }}>
                        <div>
                          <strong>Block #{retTransferSuccess.blockIndex} Committed to Blockchain!</strong>
                          <div style={{ fontSize: '0.82rem' }}>Event: TRANSFER_RETAILER</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Wholesaler Section */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <span className="role-pill role-whl">Stage 3</span>
                    <h3 style={{ marginTop: '6px' }}>Wholesaler Verification</h3>
                    <p className="card-desc">Verify directly against original manufacturer baseline.</p>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Batch ID to Verify</label>
                  <input
                    type="text"
                    value={whlBatchId}
                    onChange={(e) => setWhlBatchId(e.target.value)}
                    placeholder="e.g. BATCH-2026-X1"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Wholesaler Package Image</label>
                  <label className="file-dropzone" style={{ display: 'block', padding: '16px' }}>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => handleImageChange(e, setWhlImageFile, setWhlImagePreview)}
                    />
                    <div style={{ fontSize: '0.88rem' }}>📷 {whlImageFile ? whlImageFile.name : 'Upload Wholesaler Package Image'}</div>
                  </label>
                  {whlImagePreview && <img src={whlImagePreview} alt="Preview" className="preview-img" />}
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
                  <button className="btn btn-accent" onClick={() => handleWholesalerVerify(false)} disabled={whlLoading}>
                    {whlLoading ? 'Verifying...' : '🔍 Verify Package'}
                  </button>
                  <button className="btn btn-secondary" onClick={() => handleWholesalerVerify(true)} disabled={whlLoading}>
                    Simulate Inconsistent Date
                  </button>
                </div>

                {/* Wholesaler Verification Result Output */}
                {whlResult && (
                  <div style={{ marginTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Verification Result:</span>
                      {whlResult.detailsMatch ? (
                        <span className="badge badge-match">AUTHENTIC & MATCHED</span>
                      ) : (
                        <span className="badge badge-mismatch">REVIEW REQUIRED</span>
                      )}
                    </div>

                    <table className="verification-checks-table">
                      <thead>
                        <tr>
                          <th>Check</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(whlResult.checks || {}).map(([key, val]) => (
                          <tr key={key}>
                            <td>{key}</td>
                            <td>
                              <span className={`badge ${val === 'MATCH' ? 'badge-match' : val === 'MISMATCH' ? 'badge-mismatch' : 'badge-missing'}`}>
                                {val}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {whlResult.warnings?.length > 0 && (
                      <div className="alert-banner alert-warning" style={{ marginTop: '14px' }}>
                        <div>
                          <strong>Warnings ({whlResult.warnings.length}):</strong>
                          {whlResult.warnings.map((w, idx) => (
                            <div key={idx} style={{ fontSize: '0.84rem', marginTop: '4px' }}>• {w}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {whlResult.detailsMatch && (
                      <div style={{ marginTop: '16px' }}>
                        <button
                          className="btn btn-primary"
                          style={{ width: '100%' }}
                          onClick={handleWholesalerTransfer}
                          disabled={whlTransferLoading}
                        >
                          {whlTransferLoading ? 'Committing Block...' : '✍️ Accept Receipt & Commit Wholesaler Block'}
                        </button>
                      </div>
                    )}

                    {whlTransferSuccess && (
                      <div className="alert-banner alert-success" style={{ marginTop: '14px' }}>
                        <div>
                          <strong>Block #{whlTransferSuccess.blockIndex} Committed to Blockchain!</strong>
                          <div style={{ fontSize: '0.82rem' }}>Event: TRANSFER_WHOLESALER</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BLOCKCHAIN LEDGER EXPLORER */}
        {activeTab === 'LEDGER' && (
          <div>
            <div className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">Cryptographic Blockchain Ledger</h2>
                  <p className="card-desc">Tamper-evident chain of SHA-256 hashed blocks tracking every registration and verified transfer.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-secondary" onClick={fetchLedger} disabled={loadingLedger}>
                    🔄 Refresh
                  </button>
                  <button className="btn btn-accent" onClick={runIntegrityAudit}>
                    🛡️ Audit Chain Integrity
                  </button>
                </div>
              </div>

              {/* Integrity status alert */}
              {auditResult && (
                <div className={`alert-banner ${auditResult.isChainValid ? 'alert-success' : 'alert-danger'}`}>
                  <div>
                    <strong>{auditResult.isChainValid ? '🛡️ Blockchain Integrity Verified 100% Cryptographically Secure' : '🚨 Tampering Detected!'}</strong>
                    <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                      Audited {auditResult.totalBlocksAudited} blocks. Every previousHash linkage and SHA-256 block hash verified.
                    </div>
                  </div>
                </div>
              )}

              {/* Blocks */}
              <div className="blockchain-chain">
                {ledger.chain?.map((block, idx) => (
                  <div key={block.index || idx}>
                    <div className="block-item">
                      <div className="block-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="block-index">Block #{block.index}</span>
                          <span className={`badge ${block.eventType === 'GENESIS' ? 'badge-info' : block.eventType.includes('REGISTRATION') ? 'badge-match' : 'badge-match'}`}>
                            {block.eventType}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {new Date(block.timestamp).toLocaleString()}
                        </span>
                      </div>

                      <div className="grid-2" style={{ gap: '14px', marginBottom: '14px' }}>
                        <div>
                          <span className="form-label">Batch ID</span>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{block.batchId}</div>
                        </div>
                        <div>
                          <span className="form-label">Participants</span>
                          <div style={{ fontSize: '0.88rem' }}>{block.sender} ➔ {block.receiver}</div>
                        </div>
                      </div>

                      <div style={{ marginBottom: '8px' }}>
                        <span className="form-label">SHA-256 Data Hash (Normalized Batch Fingerprint)</span>
                        <div className="hash-box">
                          <span>{block.dataHash}</span>
                        </div>
                      </div>

                      <div style={{ marginBottom: '8px' }}>
                        <span className="form-label">Previous Block Hash (Linkage)</span>
                        <div className="hash-box" style={{ color: '#94a3b8' }}>
                          <span>{block.previousHash}</span>
                        </div>
                      </div>

                      <div>
                        <span className="form-label">Current Block Hash</span>
                        <div className="hash-box" style={{ color: '#34d399' }}>
                          <span>{block.hash}</span>
                        </div>
                      </div>
                    </div>

                    {idx < ledger.chain.length - 1 && (
                      <div className="chain-connector">
                        <span>↓ Linked by SHA-256 Hash ↓</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: TAMPER & MISMATCH SIMULATOR */}
        {activeTab === 'SIMULATOR' && (
          <div>
            <div className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">Tamper & Inconsistency Testing Lab</h2>
                  <p className="card-desc">
                    1-Click demonstrations of security controls: Mismatch detection, unauthorized role rejection, and unknown batch flagging.
                  </p>
                </div>
              </div>

              <div className="simulator-btn-grid">
                <button
                  className="sim-btn"
                  onClick={async () => {
                    const res = await fetch(`${API_BASE}/verify`, {
                      method: 'POST',
                      headers: { 'x-role': 'RETAILER', 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        batchId: 'BATCH-2026-X1',
                        stage: 'RETAILER',
                        medicineInfo: {
                          medicineName: 'Piopar-GZ Total',
                          manufacturer: 'Bioaltus Pharmaceuticals Pvt. Ltd.',
                          batchNumber: 'BATCH-2026-X1',
                          manufacturingDate: '04/2026',
                          expiryDate: '12/2035', // Tampered!
                        },
                      }),
                    });
                    const d = await res.json();
                    alert(`SIMULATION RESULT:\nDetails Match: ${d.detailsMatch}\nReview Required: ${d.reviewRequired}\nWarnings: ${d.warnings?.join(' | ')}`);
                  }}
                >
                  <div className="sim-title">🧪 1. Tampered Expiry Date</div>
                  <div className="sim-desc">Simulates a package label altered to 12/2035 vs registered 03/2028.</div>
                </button>

                <button
                  className="sim-btn"
                  onClick={async () => {
                    const res = await fetch(`${API_BASE}/verify`, {
                      method: 'POST',
                      headers: { 'x-role': 'WHOLESALER', 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        batchId: 'BATCH-2026-X1',
                        stage: 'WHOLESALER',
                        medicineInfo: {
                          medicineName: 'Piopar-GZ Total',
                          manufacturer: 'Fake Pharma Clone Inc.',
                          batchNumber: 'BATCH-2026-X1',
                          manufacturingDate: '04/2026',
                          expiryDate: '03/2028',
                        },
                      }),
                    });
                    const d = await res.json();
                    alert(`SIMULATION RESULT:\nManufacturer Match: ${d.checks?.manufacturer}\nReview Required: ${d.reviewRequired}\nWarnings: ${d.warnings?.join(' | ')}`);
                  }}
                >
                  <div className="sim-title">🧪 2. Mismatched Manufacturer</div>
                  <div className="sim-desc">Simulates a package with counterfeit manufacturer branding.</div>
                </button>

                <button
                  className="sim-btn"
                  onClick={async () => {
                    const res = await fetch(`${API_BASE}/verify`, {
                      method: 'POST',
                      headers: { 'x-role': 'RETAILER', 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        batchId: 'UNKNOWN-GHOST-999',
                        stage: 'RETAILER',
                        medicineInfo: {
                          medicineName: 'Generic Drug',
                          manufacturer: 'Unknown',
                          batchNumber: 'UNKNOWN-GHOST-999',
                          manufacturingDate: '01/2025',
                          expiryDate: '01/2027',
                        },
                      }),
                    });
                    const d = await res.json();
                    alert(`SIMULATION RESULT:\nRegistered: ${d.registered}\nReview Required: ${d.reviewRequired}\nWarnings: ${d.warnings?.join(' | ')}`);
                  }}
                >
                  <div className="sim-title">🧪 3. Unregistered Batch ID</div>
                  <div className="sim-desc">Simulates a package missing from blockchain registry.</div>
                </button>

                <button
                  className="sim-btn"
                  onClick={async () => {
                    const res = await fetch(`${API_BASE}/register`, {
                      method: 'POST',
                      headers: { 'x-role': 'RETAILER', 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        medicineName: 'Unauthorized Batch',
                        batchNumber: 'BATCH-HACK-1',
                        quantity: 100,
                        manufacturerName: 'Hacker',
                        manufacturingDate: '01/2026',
                        expiryDate: '01/2028',
                      }),
                    });
                    const d = await res.json();
                    alert(`SIMULATION RESULT (RBAC):\nStatus: ${res.status}\nError: ${d.error}`);
                  }}
                >
                  <div className="sim-title">🧪 4. Unauthorized Role Rejection</div>
                  <div className="sim-desc">Retailer attempts to register batch (only Manufacturer permitted).</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: BATCH LIFECYCLE AUDIT */}
        {activeTab === 'AUDIT' && (
          <div>
            <div className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">Search & Track Batch Lifecycle</h2>
                  <p className="card-desc">Look up any batch ID to audit its complete Manufacturer ➔ Retailer ➔ Wholesaler timeline.</p>
                </div>
              </div>

              <form onSubmit={handleBatchAuditSearch} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                <input
                  type="text"
                  value={searchBatchId}
                  onChange={(e) => setSearchBatchId(e.target.value)}
                  placeholder="Enter Batch ID (e.g. BATCH-2026-X1 or BATCH-123)"
                  style={{ maxWidth: '400px' }}
                  required
                />
                <button type="submit" className="btn btn-primary" disabled={auditLoading}>
                  {auditLoading ? 'Searching Chain...' : '🔎 Audit Batch'}
                </button>
              </form>

              {auditBatchData && (
                <div>
                  {auditBatchData.registered ? (
                    <div>
                      <div className="alert-banner alert-success">
                        <div>
                          <strong>Batch Verified on Blockchain: {auditBatchData.batchId}</strong>
                          <div>Current Supply Chain Stage: <span className="badge badge-match">{auditBatchData.currentStage}</span></div>
                          <div style={{ marginTop: '6px', fontSize: '0.85rem' }}>
                            Medicine: {auditBatchData.originalRecord?.medicineName} | Manufacturer: {auditBatchData.originalRecord?.manufacturer} | Mfg: {auditBatchData.originalRecord?.manufacturingDate} | Exp: {auditBatchData.originalRecord?.expiryDate}
                          </div>
                        </div>
                      </div>

                      <h3 style={{ margin: '20px 0 12px' }}>Chronological Supply Chain Events ({auditBatchData.eventCount}):</h3>
                      <div className="blockchain-chain">
                        {auditBatchData.history?.map((event) => (
                          <div key={event.index} className="block-item">
                            <div className="block-header">
                              <div>
                                <span className="badge badge-info">{event.eventType}</span>
                                <span style={{ marginLeft: '10px', fontWeight: 700 }}>Block #{event.index}</span>
                              </div>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {new Date(event.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.9rem', marginBottom: '8px' }}>
                              <strong>Participants:</strong> {event.sender} ➔ {event.receiver}
                            </div>
                            {event.batchData?.notes && (
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                <em>"{event.batchData.notes}"</em>
                              </div>
                            )}
                            <div className="hash-box">
                              <span>Block Hash: {event.hash}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="alert-banner alert-danger">
                      <div>
                        <strong>Batch Not Found on Blockchain</strong>
                        <div>No immutable manufacturer record exists for batch "{searchBatchId}".</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
