import { useState, useEffect } from 'react';
import './App.css';

const API_BASE = 'http://localhost:5000/api/blockchain';

export default function App() {
  // Read initial portal and role from URL params if present
  const getInitialParams = () => {
    if (typeof window === 'undefined') return { portal: 'STAKEHOLDER', role: 'MANUFACTURER', batch: '' };
    const params = new URLSearchParams(window.location.search);
    return {
      portal: params.get('portal')?.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'STAKEHOLDER',
      role: params.get('role')?.toUpperCase() || 'MANUFACTURER',
      batch: params.get('batchId') || params.get('batch') || '',
    };
  };

  const initialParams = getInitialParams();

  // Top Portal Selection: 'STAKEHOLDER' (Role Portal) vs 'ADMIN' (Central Admin Track & Trace)
  const [portalMode, setPortalMode] = useState(initialParams.portal);

  // Stakeholder Active Role: 'MANUFACTURER' | 'DISTRIBUTOR' | 'WHOLESALER' | 'RETAILER' | 'PATIENT'
  const [stakeholderRole, setStakeholderRole] = useState(initialParams.role);

  // Admin Subtabs: 'PIPELINE' | 'LEDGER' | 'INTEGRITY' | 'SIMULATOR'
  const [adminTab, setAdminTab] = useState('PIPELINE');

  // Global Ledger State
  const [ledger, setLedger] = useState({ chain: [], blockCount: 0, registeredBatches: {}, integrity: { isValid: true } });
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [auditResult, setAuditResult] = useState(null);
  const [auditing, setAuditing] = useState(false);

  // Active Batch Selected for Inspection / Flow
  const [selectedBatchId, setSelectedBatchId] = useState(initialParams.batch || 'BATCH-2026-X1');

  // Sync URL parameters when switching portals or roles
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('portal', portalMode.toLowerCase());
    if (portalMode === 'STAKEHOLDER') {
      params.set('role', stakeholderRole);
    }
    if (selectedBatchId) {
      params.set('batchId', selectedBatchId);
    }
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [portalMode, stakeholderRole, selectedBatchId]);

  // Fetch full blockchain ledger
  const fetchLedger = async () => {
    setLoadingLedger(true);
    try {
      const res = await fetch(`${API_BASE}/ledger`);
      const data = await res.json();
      if (data.success) {
        setLedger(data);
        // Default selected batch to latest registered batch if not set
        const batchKeys = Object.keys(data.registeredBatches || {});
        if (batchKeys.length > 0 && (!selectedBatchId || !data.registeredBatches[selectedBatchId])) {
          setSelectedBatchId(batchKeys[batchKeys.length - 1]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch ledger:', err);
    } finally {
      setLoadingLedger(false);
    }
  };

  // Run cryptographic integrity audit
  const runIntegrityAudit = async () => {
    setAuditing(true);
    try {
      const res = await fetch(`${API_BASE}/integrity`);
      const data = await res.json();
      setAuditResult(data.tamperEvidentAudit);
    } catch (err) {
      console.error('Failed to audit integrity:', err);
    } finally {
      setAuditing(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, []);

  // =========================================================================
  // 1. MANUFACTURER STATE & HANDLERS
  // =========================================================================
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
    setSelectedBatchId(randomId);
    setMfrResult(null);
    setMfrError(null);
  };

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
    setSelectedBatchId(batchId);
    setMfrResult(null);
    setMfrError(null);
  };

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
        setSelectedBatchId(mfrForm.batchNumber);
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

  // =========================================================================
  // 2. DISTRIBUTOR STATE & HANDLERS
  // =========================================================================
  const [distBatchId, setDistBatchId] = useState(selectedBatchId || '');
  const [distImageFile, setDistImageFile] = useState(null);
  const [distImagePreview, setDistImagePreview] = useState(null);
  const [distLoading, setDistLoading] = useState(false);
  const [distResult, setDistResult] = useState(null);
  const [distTransferLoading, setDistTransferLoading] = useState(false);
  const [distTransferSuccess, setDistTransferSuccess] = useState(null);
  const [distNotes, setDistNotes] = useState('Package received in pristine condition; temperature controlled at 20°C.');

  // Keep batch ID synced when selectedBatchId changes
  useEffect(() => {
    if (selectedBatchId) {
      setDistBatchId(selectedBatchId);
      setWhlBatchId(selectedBatchId);
      setRetBatchId(selectedBatchId);
      setPatientBatchId(selectedBatchId);
    }
  }, [selectedBatchId]);

  const handleDistributorVerify = async (simulatedTamper = false) => {
    setDistLoading(true);
    setDistResult(null);
    setDistTransferSuccess(null);

    try {
      const formData = new FormData();
      formData.append('batchId', distBatchId);
      formData.append('stage', 'DISTRIBUTOR');

      if (distImageFile) {
        formData.append('image', distImageFile);
      } else {
        formData.append('medicineInfo', JSON.stringify({
          medicineName: 'Piopar-GZ Total',
          manufacturer: 'Bioaltus Pharmaceuticals Pvt. Ltd.',
          batchNumber: distBatchId,
          manufacturingDate: '04/2026',
          expiryDate: simulatedTamper ? '11/2032' : '03/2028',
        }));
      }

      const res = await fetch(`${API_BASE}/verify`, {
        method: 'POST',
        headers: {
          'x-role': 'DISTRIBUTOR',
          'x-participant-name': 'Apex Global Distribution Network',
        },
        body: formData,
      });

      const data = await res.json();
      setDistResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setDistLoading(false);
    }
  };

  const handleDistributorTransfer = async () => {
    setDistTransferLoading(true);
    try {
      const res = await fetch(`${API_BASE}/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-role': 'DISTRIBUTOR',
          'x-participant-name': 'Apex Global Distribution Network',
        },
        body: JSON.stringify({
          batchId: distBatchId,
          stage: 'DISTRIBUTOR',
          sender: distResult?.originalRecord?.manufacturer || 'PharmaCorp Manufacturing Ltd.',
          receiver: 'Apex Global Distribution Network',
          notes: distNotes,
          verified: distResult?.detailsMatch,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDistTransferSuccess(data);
        fetchLedger();
      } else {
        alert(data.message || 'Transfer failed.');
      }
    } catch (err) {
      alert('Failed to connect to blockchain server.');
    } finally {
      setDistTransferLoading(false);
    }
  };

  // =========================================================================
  // 3. WHOLESALER STATE & HANDLERS
  // =========================================================================
  const [whlBatchId, setWhlBatchId] = useState(selectedBatchId || '');
  const [whlImageFile, setWhlImageFile] = useState(null);
  const [whlImagePreview, setWhlImagePreview] = useState(null);
  const [whlLoading, setWhlLoading] = useState(false);
  const [whlResult, setWhlResult] = useState(null);
  const [whlTransferLoading, setWhlTransferLoading] = useState(false);
  const [whlTransferSuccess, setWhlTransferSuccess] = useState(null);
  const [whlNotes, setWhlNotes] = useState('Bulk shipment verified against blockchain baseline; stored in central warehouse.');

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
          'x-participant-name': 'MedSupply Logistics & Wholesale',
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

  const handleWholesalerTransfer = async () => {
    setWhlTransferLoading(true);
    try {
      const res = await fetch(`${API_BASE}/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-role': 'WHOLESALER',
          'x-participant-name': 'MedSupply Logistics & Wholesale',
        },
        body: JSON.stringify({
          batchId: whlBatchId,
          stage: 'WHOLESALER',
          sender: 'Apex Global Distribution Network',
          receiver: 'MedSupply Logistics & Wholesale',
          notes: whlNotes,
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

  // =========================================================================
  // 4. RETAILER / PHARMACY STATE & HANDLERS
  // =========================================================================
  const [retBatchId, setRetBatchId] = useState(selectedBatchId || '');
  const [retImageFile, setRetImageFile] = useState(null);
  const [retImagePreview, setRetImagePreview] = useState(null);
  const [retLoading, setRetLoading] = useState(false);
  const [retResult, setRetResult] = useState(null);
  const [retTransferLoading, setRetTransferLoading] = useState(false);
  const [retTransferSuccess, setRetTransferSuccess] = useState(null);
  const [retNotes, setRetNotes] = useState('Stock received at pharmacy branch; seal intact and verified on blockchain.');

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
          sender: 'MedSupply Logistics & Wholesale',
          receiver: 'Apollo Prime Pharmacy',
          notes: retNotes,
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

  // =========================================================================
  // 5. PATIENT / CONSUMER STATE & HANDLERS
  // =========================================================================
  const [patientBatchId, setPatientBatchId] = useState(selectedBatchId || '');
  const [patientLoading, setPatientLoading] = useState(false);
  const [patientData, setPatientData] = useState(null);

  const handlePatientVerify = async (e) => {
    e?.preventDefault();
    if (!patientBatchId.trim()) return;
    setPatientLoading(true);
    setPatientData(null);

    try {
      const res = await fetch(`${API_BASE}/batch/${encodeURIComponent(patientBatchId.trim())}`);
      const data = await res.json();
      setPatientData(data);
    } catch (err) {
      console.error('Patient verification failed:', err);
    } finally {
      setPatientLoading(false);
    }
  };

  // =========================================================================
  // 6. ADMIN PORTAL: MULTI-LAYER SIMULTANEOUS TRACK & TRACE STATE
  // =========================================================================
  const [adminSearchBatch, setAdminSearchBatch] = useState(selectedBatchId || '');
  const [adminBatchData, setAdminBatchData] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);

  const fetchAdminBatch = async (batchToQuery) => {
    const bId = (batchToQuery || adminSearchBatch || selectedBatchId || '').trim();
    if (!bId) return;
    setAdminLoading(true);
    try {
      const res = await fetch(`${API_BASE}/batch/${encodeURIComponent(bId)}`);
      const data = await res.json();
      setAdminBatchData(data);
    } catch (err) {
      console.error('Admin query failed:', err);
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    if (portalMode === 'ADMIN' && selectedBatchId) {
      setAdminSearchBatch(selectedBatchId);
      fetchAdminBatch(selectedBatchId);
    }
  }, [portalMode, selectedBatchId]);

  // Handle generic image select
  const handleImageChange = (e, setFile, setPreview) => {
    const file = e.target.files?.[0];
    if (file) {
      setFile(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  // Registered batches list for easy clicking
  const registeredBatchKeys = Object.keys(ledger.registeredBatches || {});

  // =========================================================================
  // RENDER HELPERS
  // =========================================================================
  const renderVerificationTable = (result) => {
    if (!result || !result.checks) return null;
    return (
      <div style={{ marginTop: '16px' }}>
        <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>
          Detailed AI Vision & Blockchain Cross-Check
        </h4>
        <table className="verification-checks-table">
          <thead>
            <tr>
              <th>Package Field</th>
              <th>Extracted Value</th>
              <th>Blockchain Baseline</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Medicine Name</td>
              <td>{result.extractedDetails?.medicineName || '—'}</td>
              <td>{result.originalRecord?.medicineName || '—'}</td>
              <td>
                <span className={`badge ${result.checks.medicineName === 'MATCH' ? 'badge-match' : 'badge-mismatch'}`}>
                  {result.checks.medicineName}
                </span>
              </td>
            </tr>
            <tr>
              <td>Manufacturer</td>
              <td>{result.extractedDetails?.manufacturer || '—'}</td>
              <td>{result.originalRecord?.manufacturer || result.originalRecord?.manufacturerName || '—'}</td>
              <td>
                <span className={`badge ${result.checks.manufacturer === 'MATCH' ? 'badge-match' : 'badge-mismatch'}`}>
                  {result.checks.manufacturer}
                </span>
              </td>
            </tr>
            <tr>
              <td>Batch Number</td>
              <td>{result.extractedDetails?.batchNumber || '—'}</td>
              <td>{result.originalRecord?.batchNumber || '—'}</td>
              <td>
                <span className={`badge ${result.checks.batchNumber === 'MATCH' ? 'badge-match' : 'badge-mismatch'}`}>
                  {result.checks.batchNumber}
                </span>
              </td>
            </tr>
            <tr>
              <td>Manufacturing Date</td>
              <td>{result.extractedDetails?.manufacturingDate || '—'}</td>
              <td>{result.originalRecord?.manufacturingDate || '—'}</td>
              <td>
                <span className={`badge ${result.checks.manufacturingDate === 'MATCH' ? 'badge-match' : 'badge-mismatch'}`}>
                  {result.checks.manufacturingDate}
                </span>
              </td>
            </tr>
            <tr>
              <td>Expiry Date</td>
              <td>{result.extractedDetails?.expiryDate || '—'}</td>
              <td>{result.originalRecord?.expiryDate || '—'}</td>
              <td>
                <span className={`badge ${result.checks.expiryDate === 'MATCH' ? 'badge-match' : 'badge-mismatch'}`}>
                  {result.checks.expiryDate}
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        {result.warnings?.length > 0 && (
          <div className="alert-banner alert-warning" style={{ marginTop: '14px' }}>
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <div>
              <strong>Security & Consistency Warning:</strong>
              <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                {result.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="app-header">
        <div className="header-inner">
          <div className="brand-section">
            <div className="brand-icon">
              <svg viewBox="0 0 24 24">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
              </svg>
            </div>
            <div>
              <h1 className="brand-title">PharmaShield AI</h1>
              <div className="brand-subtitle">Blockchain-Based Medicine Supply Chain Verification</div>
            </div>
          </div>

          <div className="participant-badge-container">
            <div className="chain-live-status">
              <div className="pulse-dot"></div>
              <span>Ledger: {ledger.blockCount} Blocks</span>
            </div>
          </div>
        </div>

        {/* Dual Portal Switcher */}
        <div className="portal-switch-bar">
          <button
            className={`portal-switch-btn ${portalMode === 'STAKEHOLDER' ? 'active' : ''}`}
            onClick={() => setPortalMode('STAKEHOLDER')}
          >
            <span>🏢 Stakeholder Supply Chain Portal</span>
          </button>
          <button
            className={`portal-switch-btn admin-active ${portalMode === 'ADMIN' ? 'active admin-active' : ''}`}
            onClick={() => {
              setPortalMode('ADMIN');
              fetchAdminBatch(selectedBatchId);
            }}
          >
            <span>🛡️ Central Admin & Multi-Layer Audit Portal</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="main-content">
        {/* ===================================================================
            FRONTEND 1: STAKEHOLDER PORTAL (Role-Based Login / View)
            =================================================================== */}
        {portalMode === 'STAKEHOLDER' && (
          <div>
            {/* Role Switcher */}
            <div className="role-selector-bar">
              <button
                className={`role-tab-btn mfr ${stakeholderRole === 'MANUFACTURER' ? 'active mfr' : ''}`}
                onClick={() => setStakeholderRole('MANUFACTURER')}
              >
                <span>🏭 Manufacturer</span>
                <span className="tab-badge">Stage 1</span>
              </button>
              <button
                className={`role-tab-btn dist ${stakeholderRole === 'DISTRIBUTOR' ? 'active dist' : ''}`}
                onClick={() => setStakeholderRole('DISTRIBUTOR')}
              >
                <span>🚚 Distributor</span>
                <span className="tab-badge">Stage 2</span>
              </button>
              <button
                className={`role-tab-btn whl ${stakeholderRole === 'WHOLESALER' ? 'active whl' : ''}`}
                onClick={() => setStakeholderRole('WHOLESALER')}
              >
                <span>🏢 Wholesaler</span>
                <span className="tab-badge">Stage 3</span>
              </button>
              <button
                className={`role-tab-btn ret ${stakeholderRole === 'RETAILER' ? 'active ret' : ''}`}
                onClick={() => setStakeholderRole('RETAILER')}
              >
                <span>🏪 Retailer / Pharmacy</span>
                <span className="tab-badge">Stage 4</span>
              </button>
              <button
                className={`role-tab-btn pat ${stakeholderRole === 'PATIENT' ? 'active pat' : ''}`}
                onClick={() => setStakeholderRole('PATIENT')}
              >
                <span>🩺 Patient / Consumer</span>
                <span className="tab-badge">Stage 5</span>
              </button>
            </div>

            {/* Quick Batch Selector */}
            {registeredBatchKeys.length > 0 && stakeholderRole !== 'MANUFACTURER' && (
              <div className="batch-chips-bar">
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Registered Batches:</span>
                {registeredBatchKeys.map((bId) => (
                  <button
                    key={bId}
                    className={`batch-chip ${selectedBatchId === bId ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedBatchId(bId);
                      setDistBatchId(bId);
                      setWhlBatchId(bId);
                      setRetBatchId(bId);
                      setPatientBatchId(bId);
                    }}
                  >
                    {bId}
                  </button>
                ))}
              </div>
            )}

            {/* 1. MANUFACTURER WORKSPACE */}
            {stakeholderRole === 'MANUFACTURER' && (
              <div>
                <div className="card" style={{ background: 'linear-gradient(180deg, rgba(16,185,129,0.06) 0%, rgba(18,24,38,0.7) 100%)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <h2 style={{ fontSize: '1.3rem' }}>🏭 Manufacturer Portal: Batch Production & Genesis Registration</h2>
                      <p className="card-desc">
                        Register newly manufactured pharmaceutical batches directly onto the immutable blockchain ledger with a cryptographic SHA-256 fingerprint.
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

                <div className="card">
                  <div className="card-header">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="role-pill role-mfr">Stage 1: Production</span>
                        <h2 className="card-title">Register Medicine Batch</h2>
                      </div>
                      <p className="card-desc">Source of Truth: Upload package image and register batch details on the blockchain.</p>
                    </div>
                  </div>

                  <form onSubmit={handleManufacturerRegister}>
                    <div className="grid-2">
                      <div>
                        <div className="form-group">
                          <label className="form-label">Medicine Commercial Name *</label>
                          <input
                            type="text"
                            value={mfrForm.medicineName}
                            onChange={(e) => setMfrForm({ ...mfrForm, medicineName: e.target.value })}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Batch ID / Lot Number *</label>
                          <input
                            type="text"
                            value={mfrForm.batchNumber}
                            onChange={(e) => setMfrForm({ ...mfrForm, batchNumber: e.target.value })}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Manufacturing Unit / Company *</label>
                          <input
                            type="text"
                            value={mfrForm.manufacturerName}
                            onChange={(e) => setMfrForm({ ...mfrForm, manufacturerName: e.target.value })}
                            required
                          />
                        </div>

                        <div className="grid-2">
                          <div className="form-group">
                            <label className="form-label">Mfg Date *</label>
                            <input
                              type="text"
                              value={mfrForm.manufacturingDate}
                              onChange={(e) => setMfrForm({ ...mfrForm, manufacturingDate: e.target.value })}
                              placeholder="MM/YYYY"
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Expiry Date *</label>
                            <input
                              type="text"
                              value={mfrForm.expiryDate}
                              onChange={(e) => setMfrForm({ ...mfrForm, expiryDate: e.target.value })}
                              placeholder="MM/YYYY"
                              required
                            />
                          </div>
                        </div>

                        <div className="form-group">
                          <label className="form-label">Production Quantity (Units)</label>
                          <input
                            type="number"
                            value={mfrForm.quantity}
                            onChange={(e) => setMfrForm({ ...mfrForm, quantity: e.target.value })}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="form-group">
                          <label className="form-label">Physical Packaging Verification Photo</label>
                          <div
                            className="file-dropzone"
                            onClick={() => document.getElementById('mfr-file-input').click()}
                          >
                            <input
                              type="file"
                              id="mfr-file-input"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={(e) => handleImageChange(e, setMfrImageFile, setMfrImagePreview)}
                            />
                            {mfrImagePreview ? (
                              <div>
                                <img src={mfrImagePreview} alt="Preview" className="preview-img" />
                                <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--accent-emerald)' }}>
                                  ✓ Package image attached
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📸</div>
                                <div style={{ fontWeight: 600 }}>Click to attach package photo</div>
                                <div className="form-hint">AI Vision / OCR will cross-check image against form details</div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ marginTop: '24px' }}>
                          <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '14px' }}
                            disabled={mfrLoading}
                          >
                            {mfrLoading ? 'Registering on Blockchain...' : '🔐 Commit Batch to Blockchain'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>

                  {mfrResult && (
                    <div style={{ marginTop: '24px' }}>
                      {mfrResult.success ? (
                        <div className="alert-banner alert-success">
                          <span style={{ fontSize: '1.4rem' }}>🛡️</span>
                          <div style={{ width: '100%' }}>
                            <strong>Batch {mfrResult.batchId} Successfully Registered on Blockchain!</strong>
                            <div style={{ marginTop: '4px', fontSize: '0.88rem' }}>
                              Block #{mfrResult.blockIndex} created. Cryptographic Batch SHA-256 fingerprint saved.
                            </div>
                            <div className="hash-box" style={{ marginTop: '8px' }}>
                              <span>Data Hash: {mfrResult.dataHash}</span>
                            </div>
                            <div className="hash-box">
                              <span>Block Hash: {mfrResult.blockHash}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="alert-banner alert-danger">
                          <span style={{ fontSize: '1.4rem' }}>🚨</span>
                          <div>
                            <strong>Registration Flagged or Rejected:</strong>
                            <div>{mfrResult.message}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. DISTRIBUTOR WORKSPACE */}
            {stakeholderRole === 'DISTRIBUTOR' && (
              <div>
                <div className="card" style={{ background: 'linear-gradient(180deg, rgba(6,182,212,0.06) 0%, rgba(18,24,38,0.7) 100%)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <h2 style={{ fontSize: '1.3rem' }}>🚚 Distributor Portal: Regional Logistics Intake & Verification</h2>
                      <p className="card-desc">
                        Inspect batches received from the manufacturer. Cross-verify against the manufacturer’s immutable blockchain record before accepting transfer to Wholesaler.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="role-pill role-ret">Stage 2: Regional Distributor</span>
                        <h2 className="card-title">Intake Verification & Transfer to Wholesaler</h2>
                      </div>
                      <p className="card-desc">Authorized Participant: Apex Global Distribution Network</p>
                    </div>
                  </div>

                  <div className="grid-2">
                    <div>
                      <div className="form-group">
                        <label className="form-label">Batch ID to Inspect *</label>
                        <input
                          type="text"
                          value={distBatchId}
                          onChange={(e) => setDistBatchId(e.target.value)}
                          placeholder="e.g. BATCH-2026-X1"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Transfer Shipment Notes</label>
                        <input
                          type="text"
                          value={distNotes}
                          onChange={(e) => setDistNotes(e.target.value)}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-primary"
                          onClick={() => handleDistributorVerify(false)}
                          disabled={distLoading || !distBatchId}
                        >
                          {distLoading ? 'Verifying...' : '🔍 Verify Against Blockchain Baseline'}
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleDistributorVerify(true)}
                          disabled={distLoading || !distBatchId}
                          title="Simulate altered expiry date to test anti-tampering"
                        >
                          ⚡ Test Altered Expiry Tamper
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="form-group">
                        <label className="form-label">Upload Package Photo (Optional)</label>
                        <div
                          className="file-dropzone"
                          onClick={() => document.getElementById('dist-file-input').click()}
                        >
                          <input
                            type="file"
                            id="dist-file-input"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => handleImageChange(e, setDistImageFile, setDistImagePreview)}
                          />
                          {distImagePreview ? (
                            <div>
                              <img src={distImagePreview} alt="Preview" className="preview-img" />
                              <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                                ✓ Package photo attached
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📷</div>
                              <div style={{ fontWeight: 600 }}>Click to attach package photo</div>
                              <div className="form-hint">AI Vision extracts text and verifies against manufacturer record</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Verification Results */}
                  {distResult && (
                    <div style={{ marginTop: '24px' }}>
                      {distResult.detailsMatch ? (
                        <div className="alert-banner alert-success">
                          <span style={{ fontSize: '1.4rem' }}>✅</span>
                          <div style={{ width: '100%' }}>
                            <strong>Verification Passed: Package Authenticity 100% Confirmed</strong>
                            <div>All package attributes exactly match the manufacturer baseline recorded on the blockchain.</div>
                            <div style={{ marginTop: '12px' }}>
                              <button
                                className="btn btn-accent"
                                onClick={handleDistributorTransfer}
                                disabled={distTransferLoading}
                              >
                                {distTransferLoading ? 'Recording Transfer...' : '📦 Record Distributor Transfer on Blockchain'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="alert-banner alert-danger">
                          <span style={{ fontSize: '1.4rem' }}>🚨</span>
                          <div>
                            <strong>Verification Failed / Review Required:</strong>
                            <div>Discrepancy detected between physical package and manufacturer blockchain baseline. Inconsistent batches cannot be recorded as verified transfers.</div>
                          </div>
                        </div>
                      )}

                      {renderVerificationTable(distResult)}

                      {distTransferSuccess && (
                        <div className="alert-banner alert-success" style={{ marginTop: '16px' }}>
                          <span style={{ fontSize: '1.4rem' }}>⛓️</span>
                          <div>
                            <strong>Distributor Transfer Block #{distTransferSuccess.blockIndex} Appended to Blockchain!</strong>
                            <div className="hash-box" style={{ marginTop: '6px' }}>
                              <span>Block Hash: {distTransferSuccess.blockHash}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. WHOLESALER WORKSPACE */}
            {stakeholderRole === 'WHOLESALER' && (
              <div>
                <div className="card" style={{ background: 'linear-gradient(180deg, rgba(139,92,246,0.06) 0%, rgba(18,24,38,0.7) 100%)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <h2 style={{ fontSize: '1.3rem' }}>🏢 Wholesaler Portal: Bulk Storage & Inspection</h2>
                      <p className="card-desc">
                        Verify medicine authenticity before accepting into wholesale distribution. Any tampered dates or counterfeit batches are blocked from transfer.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="role-pill role-whl">Stage 3: Wholesaler</span>
                        <h2 className="card-title">Bulk Inspection & Transfer to Pharmacy</h2>
                      </div>
                      <p className="card-desc">Authorized Participant: MedSupply Logistics & Wholesale</p>
                    </div>
                  </div>

                  <div className="grid-2">
                    <div>
                      <div className="form-group">
                        <label className="form-label">Batch ID to Inspect *</label>
                        <input
                          type="text"
                          value={whlBatchId}
                          onChange={(e) => setWhlBatchId(e.target.value)}
                          placeholder="e.g. BATCH-2026-X1"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Wholesale Dispatch Notes</label>
                        <input
                          type="text"
                          value={whlNotes}
                          onChange={(e) => setWhlNotes(e.target.value)}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-primary"
                          onClick={() => handleWholesalerVerify(false)}
                          disabled={whlLoading || !whlBatchId}
                        >
                          {whlLoading ? 'Verifying...' : '🔍 Verify Against Blockchain Baseline'}
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleWholesalerVerify(true)}
                          disabled={whlLoading || !whlBatchId}
                          title="Simulate altered expiry date to test anti-tampering"
                        >
                          ⚡ Test Altered Expiry Tamper
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="form-group">
                        <label className="form-label">Upload Package Photo (Optional)</label>
                        <div
                          className="file-dropzone"
                          onClick={() => document.getElementById('whl-file-input').click()}
                        >
                          <input
                            type="file"
                            id="whl-file-input"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => handleImageChange(e, setWhlImageFile, setWhlImagePreview)}
                          />
                          {whlImagePreview ? (
                            <div>
                              <img src={whlImagePreview} alt="Preview" className="preview-img" />
                              <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--accent-purple)' }}>
                                ✓ Package photo attached
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📷</div>
                              <div style={{ fontWeight: 600 }}>Click to attach package photo</div>
                              <div className="form-hint">AI Vision extracts text and verifies against manufacturer record</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Verification Results */}
                  {whlResult && (
                    <div style={{ marginTop: '24px' }}>
                      {whlResult.detailsMatch ? (
                        <div className="alert-banner alert-success">
                          <span style={{ fontSize: '1.4rem' }}>✅</span>
                          <div style={{ width: '100%' }}>
                            <strong>Verification Passed: Authentic Wholesale Batch Confirmed</strong>
                            <div>All package details match manufacturer record. Authorized to proceed with pharmacy dispatch.</div>
                            <div style={{ marginTop: '12px' }}>
                              <button
                                className="btn btn-accent"
                                onClick={handleWholesalerTransfer}
                                disabled={whlTransferLoading}
                              >
                                {whlTransferLoading ? 'Recording Transfer...' : '📦 Record Wholesaler Transfer on Blockchain'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="alert-banner alert-danger">
                          <span style={{ fontSize: '1.4rem' }}>🚨</span>
                          <div>
                            <strong>Verification Failed / Review Required:</strong>
                            <div>Discrepancy detected between physical package and manufacturer blockchain baseline. Inconsistent batches cannot be recorded as verified transfers.</div>
                          </div>
                        </div>
                      )}

                      {renderVerificationTable(whlResult)}

                      {whlTransferSuccess && (
                        <div className="alert-banner alert-success" style={{ marginTop: '16px' }}>
                          <span style={{ fontSize: '1.4rem' }}>⛓️</span>
                          <div>
                            <strong>Wholesaler Transfer Block #{whlTransferSuccess.blockIndex} Appended to Blockchain!</strong>
                            <div className="hash-box" style={{ marginTop: '6px' }}>
                              <span>Block Hash: {whlTransferSuccess.blockHash}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. RETAILER / PHARMACY WORKSPACE */}
            {stakeholderRole === 'RETAILER' && (
              <div>
                <div className="card" style={{ background: 'linear-gradient(180deg, rgba(245,158,11,0.06) 0%, rgba(18,24,38,0.7) 100%)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <h2 style={{ fontSize: '1.3rem' }}>🏪 Retailer / Pharmacy Portal: Stock Intake & Patient Dispense</h2>
                      <p className="card-desc">
                        Verify medicine batches received from wholesalers before stocking on pharmacy shelves. Ensures only genuine pharmaceuticals reach consumers.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="role-pill role-mfr" style={{ color: '#f59e0b', borderColor: 'rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.1)' }}>
                          Stage 4: Pharmacy Retailer
                        </span>
                        <h2 className="card-title">Pharmacy Intake Verification</h2>
                      </div>
                      <p className="card-desc">Authorized Participant: Apollo Prime Pharmacy</p>
                    </div>
                  </div>

                  <div className="grid-2">
                    <div>
                      <div className="form-group">
                        <label className="form-label">Batch ID to Inspect *</label>
                        <input
                          type="text"
                          value={retBatchId}
                          onChange={(e) => setRetBatchId(e.target.value)}
                          placeholder="e.g. BATCH-2026-X1"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Pharmacy Intake Notes</label>
                        <input
                          type="text"
                          value={retNotes}
                          onChange={(e) => setRetNotes(e.target.value)}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-primary"
                          onClick={() => handleRetailerVerify(false)}
                          disabled={retLoading || !retBatchId}
                        >
                          {retLoading ? 'Verifying...' : '🔍 Verify Against Blockchain Baseline'}
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleRetailerVerify(true)}
                          disabled={retLoading || !retBatchId}
                          title="Simulate altered expiry date to test anti-tampering"
                        >
                          ⚡ Test Altered Expiry Tamper
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="form-group">
                        <label className="form-label">Upload Package Photo (Optional)</label>
                        <div
                          className="file-dropzone"
                          onClick={() => document.getElementById('ret-file-input').click()}
                        >
                          <input
                            type="file"
                            id="ret-file-input"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => handleImageChange(e, setRetImageFile, setRetImagePreview)}
                          />
                          {retImagePreview ? (
                            <div>
                              <img src={retImagePreview} alt="Preview" className="preview-img" />
                              <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--accent-amber)' }}>
                                ✓ Package photo attached
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📷</div>
                              <div style={{ fontWeight: 600 }}>Click to attach package photo</div>
                              <div className="form-hint">AI Vision extracts text and verifies against manufacturer record</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Verification Results */}
                  {retResult && (
                    <div style={{ marginTop: '24px' }}>
                      {retResult.detailsMatch ? (
                        <div className="alert-banner alert-success">
                          <span style={{ fontSize: '1.4rem' }}>✅</span>
                          <div style={{ width: '100%' }}>
                            <strong>Verification Passed: Authentic Pharmacy Stock Confirmed</strong>
                            <div>All package details match manufacturer record. Medicine approved for retail shelf and dispensing.</div>
                            <div style={{ marginTop: '12px' }}>
                              <button
                                className="btn btn-accent"
                                onClick={handleRetailerTransfer}
                                disabled={retTransferLoading}
                              >
                                {retTransferLoading ? 'Recording Receipt...' : '📦 Record Pharmacy Receipt on Blockchain'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="alert-banner alert-danger">
                          <span style={{ fontSize: '1.4rem' }}>🚨</span>
                          <div>
                            <strong>Verification Failed / Review Required:</strong>
                            <div>Discrepancy detected between physical package and manufacturer blockchain baseline. Inconsistent batches cannot be recorded as verified transfers.</div>
                          </div>
                        </div>
                      )}

                      {renderVerificationTable(retResult)}

                      {retTransferSuccess && (
                        <div className="alert-banner alert-success" style={{ marginTop: '16px' }}>
                          <span style={{ fontSize: '1.4rem' }}>⛓️</span>
                          <div>
                            <strong>Pharmacy Receipt Block #{retTransferSuccess.blockIndex} Appended to Blockchain!</strong>
                            <div className="hash-box" style={{ marginTop: '6px' }}>
                              <span>Block Hash: {retTransferSuccess.blockHash}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 5. PATIENT / CONSUMER WORKSPACE */}
            {stakeholderRole === 'PATIENT' && (
              <div>
                <div className="patient-shield-hero">
                  <div className="shield-icon-large">🛡️</div>
                  <h2 className="shield-verdict-title">Consumer Medicine Authenticity Verification</h2>
                  <p style={{ maxWidth: '640px', margin: '0 auto', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                    Enter your package Batch ID to instantly authenticate your medicine against the immutable blockchain registry and view its full supply chain journey.
                  </p>
                </div>

                <div className="card" style={{ maxWidth: '780px', margin: '0 auto 24px' }}>
                  <form onSubmit={handlePatientVerify}>
                    <div className="form-group">
                      <label className="form-label">Medicine Package Batch ID / Lot Number</label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <input
                          type="text"
                          value={patientBatchId}
                          onChange={(e) => setPatientBatchId(e.target.value)}
                          placeholder="e.g. BATCH-123, BATCH-2026-X1"
                          style={{ flex: 1, fontSize: '1rem', padding: '12px 16px' }}
                          required
                        />
                        <button type="submit" className="btn btn-primary" disabled={patientLoading}>
                          {patientLoading ? 'Verifying...' : '🔍 Check Authenticity'}
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* Patient Verification Results */}
                  {patientData && (
                    <div style={{ marginTop: '24px' }}>
                      {patientData.registered ? (
                        <div>
                          <div className="alert-banner alert-success">
                            <span style={{ fontSize: '1.8rem' }}>✅</span>
                            <div>
                              <strong style={{ fontSize: '1.1rem' }}>100% Genuine Pharmaceutical Medicine</strong>
                              <div style={{ marginTop: '4px' }}>
                                Verified on the decentralized PharmaShield AI blockchain ledger.
                              </div>
                            </div>
                          </div>

                          <div className="grid-2" style={{ marginTop: '20px' }}>
                            <div className="card" style={{ background: 'rgba(0,0,0,0.2)' }}>
                              <h3 style={{ fontSize: '1rem', marginBottom: '12px', color: 'var(--accent-emerald)' }}>
                                💊 Medicine Specifications
                              </h3>
                              <div style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div><strong>Medicine:</strong> {patientData.originalRecord?.medicineName}</div>
                                <div><strong>Manufacturer:</strong> {patientData.originalRecord?.manufacturer}</div>
                                <div><strong>Batch ID:</strong> {patientData.batchId}</div>
                                <div><strong>Mfg Date:</strong> {patientData.originalRecord?.manufacturingDate}</div>
                                <div><strong>Expiry Date:</strong> {patientData.originalRecord?.expiryDate}</div>
                              </div>
                            </div>

                            <div className="card" style={{ background: 'rgba(0,0,0,0.2)' }}>
                              <h3 style={{ fontSize: '1rem', marginBottom: '12px', color: 'var(--accent-cyan)' }}>
                                📜 Cryptographic Pedigree
                              </h3>
                              <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div><strong>Current Stage:</strong> {patientData.currentStage}</div>
                                <div><strong>Supply Chain Steps:</strong> {patientData.eventCount} Verified Events</div>
                                <div><strong>Registration Block:</strong> #{patientData.originalRecord?.blockIndex}</div>
                                <div className="hash-box" style={{ fontSize: '0.72rem' }}>
                                  <span>Fingerprint: {patientData.originalRecord?.dataHash}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Chronological Journey */}
                          <div style={{ marginTop: '20px' }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: '12px' }}>Verified Supply Chain Timeline</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {patientData.history?.map((step, idx) => (
                                <div key={idx} className="block-item" style={{ padding: '14px 18px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                      <strong>{step.eventType.replace('TRANSFER_', '')} Checkpoint</strong>
                                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        {step.sender} → {step.receiver}
                                      </div>
                                    </div>
                                    <span className="badge badge-match">Verified #{step.index}</span>
                                  </div>
                                  {step.batchData?.notes && (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                                      "{step.batchData.notes}"
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="alert-banner alert-danger">
                          <span style={{ fontSize: '1.8rem' }}>🚨</span>
                          <div>
                            <strong style={{ fontSize: '1.1rem' }}>WARNING: Unregistered or Counterfeit Batch</strong>
                            <div>
                              This batch ID was NOT found in the blockchain manufacturer registry. Do not consume without consulting your pharmacist or healthcare provider.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            FRONTEND 2: CENTRAL ADMIN & MULTI-LAYER AUDIT PORTAL
            =================================================================== */}
        {portalMode === 'ADMIN' && (
          <div>
            {/* Admin Header Card */}
            <div className="card" style={{ background: 'linear-gradient(180deg, rgba(139,92,246,0.08) 0%, rgba(18,24,38,0.7) 100%)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="role-pill role-whl">Central Admin</span>
                    <h2 style={{ fontSize: '1.35rem' }}>Multi-Layer Supply Chain Audit & Track-and-Trace</h2>
                  </div>
                  <p className="card-desc">
                    Simultaneously monitor batch details and integrity across all 5 supply chain layers: <strong>Manufacturer → Distributor → Wholesaler → Retailer → Patient</strong>.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button className="btn btn-secondary" onClick={() => fetchAdminBatch(adminSearchBatch)}>
                    <span>🔄 Refresh Data</span>
                  </button>
                  <button className="btn btn-primary" onClick={runIntegrityAudit} disabled={auditing}>
                    {auditing ? 'Auditing...' : '🛡️ Audit Chain Integrity'}
                  </button>
                </div>
              </div>

              {/* Batch Search Bar */}
              <div style={{ marginTop: '20px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '260px' }}>
                  <input
                    type="text"
                    value={adminSearchBatch}
                    onChange={(e) => setAdminSearchBatch(e.target.value)}
                    placeholder="Search Batch ID to track across all layers (e.g. BATCH-123)..."
                    style={{ width: '100%' }}
                  />
                </div>
                <button
                  className="btn btn-accent"
                  onClick={() => fetchAdminBatch(adminSearchBatch)}
                  disabled={adminLoading}
                >
                  {adminLoading ? 'Tracking...' : 'Inspect 5-Layer Pipeline'}
                </button>
              </div>

              {/* Batch Quick Selector Chips */}
              {registeredBatchKeys.length > 0 && (
                <div className="batch-chips-bar" style={{ marginBottom: 0 }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Quick Select:</span>
                  {registeredBatchKeys.map((bId) => (
                    <button
                      key={bId}
                      className={`batch-chip ${adminSearchBatch === bId ? 'active' : ''}`}
                      onClick={() => {
                        setAdminSearchBatch(bId);
                        setSelectedBatchId(bId);
                        fetchAdminBatch(bId);
                      }}
                    >
                      {bId}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Admin Subtabs */}
            <nav className="tabs-navigation" style={{ margin: '14px 0 24px' }}>
              <button
                className={`tab-btn ${adminTab === 'PIPELINE' ? 'active' : ''}`}
                onClick={() => setAdminTab('PIPELINE')}
              >
                <span>🗺️ Simultaneous 5-Layer Pipeline Track & Trace</span>
              </button>
              <button
                className={`tab-btn ${adminTab === 'LEDGER' ? 'active' : ''}`}
                onClick={() => {
                  setAdminTab('LEDGER');
                  fetchLedger();
                }}
              >
                <span>⛓️ Cryptographic Ledger Explorer</span>
                <span className="tab-badge">{ledger.blockCount}</span>
              </button>
              <button
                className={`tab-btn ${adminTab === 'INTEGRITY' ? 'active' : ''}`}
                onClick={() => {
                  setAdminTab('INTEGRITY');
                  runIntegrityAudit();
                }}
              >
                <span>🛡️ Cryptographic Integrity & Tamper Audit</span>
              </button>
            </nav>

            {/* SUBTAB 1: SIMULTANEOUS 5-LAYER PIPELINE */}
            {adminTab === 'PIPELINE' && (
              <div>
                {adminBatchData?.registered ? (
                  <div>
                    {/* Summary Card */}
                    <div className="card" style={{ marginBottom: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Batch Track Record</div>
                          <h3 style={{ fontSize: '1.3rem', color: 'var(--accent-cyan)' }}>
                            {adminBatchData.batchId} — {adminBatchData.originalRecord?.medicineName}
                          </h3>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            Manufactured by: <strong>{adminBatchData.originalRecord?.manufacturer}</strong> | Mfg: {adminBatchData.originalRecord?.manufacturingDate} | Exp: {adminBatchData.originalRecord?.expiryDate}
                          </div>
                        </div>
                        <div>
                          <span className="role-pill role-mfr" style={{ fontSize: '0.85rem', padding: '6px 14px' }}>
                            Current Stage: {adminBatchData.currentStage}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 5-Layer Pipeline Container */}
                    <div className="pipeline-track-container">
                      {/* =======================================================
                          LAYER 1: MANUFACTURER
                          ======================================================= */}
                      {(() => {
                        const mfrBlock = adminBatchData.history?.find((b) => b.eventType === 'BATCH_REGISTRATION');
                        return (
                          <div className="pipeline-layer-card status-completed">
                            <div className="layer-header">
                              <div className="layer-title-group">
                                <div className="layer-number-badge" style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399', borderColor: '#10b981' }}>
                                  1
                                </div>
                                <div>
                                  <h3 style={{ fontSize: '1.15rem' }}>🏭 Layer 1: Manufacturer (Production & Fingerprinting)</h3>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    Source of Truth Creation: Digital SHA-256 baseline locked into Genesis/Registration block.
                                  </div>
                                </div>
                              </div>
                              <span className="badge badge-match">✅ Completed & Cryptographically Locked</span>
                            </div>

                            <div className="grid-2" style={{ fontSize: '0.88rem' }}>
                              <div>
                                <div><strong>Registered By:</strong> {adminBatchData.originalRecord?.registeredBy}</div>
                                <div><strong>Registered At:</strong> {new Date(adminBatchData.originalRecord?.registeredAt).toLocaleString()}</div>
                                <div><strong>Batch Size:</strong> {adminBatchData.originalRecord?.quantity} Units</div>
                              </div>
                              <div>
                                <div><strong>Block Index:</strong> #{adminBatchData.originalRecord?.blockIndex}</div>
                                <div className="hash-box" style={{ fontSize: '0.74rem' }}>
                                  <span>Data Hash: {adminBatchData.originalRecord?.dataHash}</span>
                                </div>
                                <div className="hash-box" style={{ fontSize: '0.74rem' }}>
                                  <span>Block Hash: {adminBatchData.originalRecord?.blockHash}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Arrow Connector */}
                      <div className="layer-connector-down">
                        <div className="connector-line"></div>
                        <div className="connector-arrow">↓</div>
                      </div>

                      {/* =======================================================
                          LAYER 2: DISTRIBUTOR
                          ======================================================= */}
                      {(() => {
                        const distBlock = adminBatchData.history?.find((b) => b.eventType === 'TRANSFER_DISTRIBUTOR');
                        const isCompleted = !!distBlock;
                        const isFlagged = !isCompleted && adminBatchData.history?.some((b) => b.eventType.includes('WHOLESALER'));

                        return (
                          <div className={`pipeline-layer-card ${isCompleted ? 'status-completed' : isFlagged ? 'status-flagged' : 'status-pending'}`}>
                            <div className="layer-header">
                              <div className="layer-title-group">
                                <div className="layer-number-badge" style={{ background: isCompleted ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.06)', color: isCompleted ? '#22d3ee' : 'inherit' }}>
                                  2
                                </div>
                                <div>
                                  <h3 style={{ fontSize: '1.15rem' }}>🚚 Layer 2: Regional Distributor (Logistics Intake)</h3>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    Regional verification and transit validation from manufacturing site.
                                  </div>
                                </div>
                              </div>
                              {isCompleted ? (
                                <span className="badge badge-match">✅ Verified & Transferred</span>
                              ) : isFlagged ? (
                                <span className="badge badge-missing">⚠️ Direct Shipment / Bypassed</span>
                              ) : (
                                <span className="badge badge-info">⏳ In Transit / Pending Distributor Intake</span>
                              )}
                            </div>

                            {isCompleted ? (
                              <div className="grid-2" style={{ fontSize: '0.88rem' }}>
                                <div>
                                  <div><strong>Sender:</strong> {distBlock.sender}</div>
                                  <div><strong>Receiver:</strong> {distBlock.receiver}</div>
                                  <div><strong>Notes:</strong> {distBlock.batchData?.notes || 'Verified transfer'}</div>
                                </div>
                                <div>
                                  <div><strong>Block Index:</strong> #{distBlock.index}</div>
                                  <div><strong>Timestamp:</strong> {new Date(distBlock.timestamp).toLocaleString()}</div>
                                  <div className="hash-box" style={{ fontSize: '0.74rem' }}>
                                    <span>Block Hash: {distBlock.hash}</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                                {isFlagged
                                  ? 'Note: Batch was moved directly to wholesale inventory without a separate regional distributor checkpoint.'
                                  : 'Awaiting regional distributor to verify package physical details against manufacturer blockchain record.'}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Arrow Connector */}
                      <div className="layer-connector-down">
                        <div className="connector-line"></div>
                        <div className="connector-arrow">↓</div>
                      </div>

                      {/* =======================================================
                          LAYER 3: WHOLESALER
                          ======================================================= */}
                      {(() => {
                        const whlBlock = adminBatchData.history?.find((b) => b.eventType === 'TRANSFER_WHOLESALER');
                        const isCompleted = !!whlBlock;

                        return (
                          <div className={`pipeline-layer-card ${isCompleted ? 'status-completed' : 'status-pending'}`}>
                            <div className="layer-header">
                              <div className="layer-title-group">
                                <div className="layer-number-badge" style={{ background: isCompleted ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.06)', color: isCompleted ? '#a78bfa' : 'inherit' }}>
                                  3
                                </div>
                                <div>
                                  <h3 style={{ fontSize: '1.15rem' }}>🏢 Layer 3: Wholesaler (Bulk Storage & Cross-Check)</h3>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    Bulk inspection against manufacturer baseline. Blocks tampered or relabeled batches.
                                  </div>
                                </div>
                              </div>
                              {isCompleted ? (
                                <span className="badge badge-match">✅ Verified & Transferred</span>
                              ) : (
                                <span className="badge badge-info">⏳ Pending Wholesale Intake</span>
                              )}
                            </div>

                            {isCompleted ? (
                              <div className="grid-2" style={{ fontSize: '0.88rem' }}>
                                <div>
                                  <div><strong>Sender:</strong> {whlBlock.sender}</div>
                                  <div><strong>Receiver:</strong> {whlBlock.receiver}</div>
                                  <div><strong>Notes:</strong> {whlBlock.batchData?.notes || 'Verified wholesale reception'}</div>
                                </div>
                                <div>
                                  <div><strong>Block Index:</strong> #{whlBlock.index}</div>
                                  <div><strong>Timestamp:</strong> {new Date(whlBlock.timestamp).toLocaleString()}</div>
                                  <div className="hash-box" style={{ fontSize: '0.74rem' }}>
                                    <span>Block Hash: {whlBlock.hash}</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                                Awaiting wholesale warehouse inspection. Package has not yet been checked in at wholesale hub.
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Arrow Connector */}
                      <div className="layer-connector-down">
                        <div className="connector-line"></div>
                        <div className="connector-arrow">↓</div>
                      </div>

                      {/* =======================================================
                          LAYER 4: RETAILER / PHARMACY
                          ======================================================= */}
                      {(() => {
                        const retBlock = adminBatchData.history?.find((b) => b.eventType === 'TRANSFER_RETAILER');
                        const isCompleted = !!retBlock;

                        return (
                          <div className={`pipeline-layer-card ${isCompleted ? 'status-completed' : 'status-pending'}`}>
                            <div className="layer-header">
                              <div className="layer-title-group">
                                <div className="layer-number-badge" style={{ background: isCompleted ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)', color: isCompleted ? '#fbbf24' : 'inherit' }}>
                                  4
                                </div>
                                <div>
                                  <h3 style={{ fontSize: '1.15rem' }}>🏪 Layer 4: Retailer / Pharmacy (Retail Inventory)</h3>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    Pharmacy stock intake and validation before patient dispensing.
                                  </div>
                                </div>
                              </div>
                              {isCompleted ? (
                                <span className="badge badge-match">✅ Stocked in Pharmacy</span>
                              ) : (
                                <span className="badge badge-info">⏳ Pending Pharmacy Intake</span>
                              )}
                            </div>

                            {isCompleted ? (
                              <div className="grid-2" style={{ fontSize: '0.88rem' }}>
                                <div>
                                  <div><strong>Sender:</strong> {retBlock.sender}</div>
                                  <div><strong>Receiver:</strong> {retBlock.receiver}</div>
                                  <div><strong>Notes:</strong> {retBlock.batchData?.notes || 'Stocked in retail pharmacy'}</div>
                                </div>
                                <div>
                                  <div><strong>Block Index:</strong> #{retBlock.index}</div>
                                  <div><strong>Timestamp:</strong> {new Date(retBlock.timestamp).toLocaleString()}</div>
                                  <div className="hash-box" style={{ fontSize: '0.74rem' }}>
                                    <span>Block Hash: {retBlock.hash}</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                                Batch is awaiting delivery and verification at retail pharmacy branches.
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Arrow Connector */}
                      <div className="layer-connector-down">
                        <div className="connector-line"></div>
                        <div className="connector-arrow">↓</div>
                      </div>

                      {/* =======================================================
                          LAYER 5: PATIENT / CONSUMER
                          ======================================================= */}
                      {(() => {
                        const patBlock = adminBatchData.history?.find((b) => b.eventType === 'TRANSFER_PATIENT' || b.eventType === 'DISPENSE_PATIENT');
                        const isDispensed = !!patBlock;
                        const isAtPharmacy = adminBatchData.history?.some((b) => b.eventType === 'TRANSFER_RETAILER');

                        return (
                          <div className={`pipeline-layer-card ${isDispensed ? 'status-completed' : isAtPharmacy ? 'status-completed' : 'status-pending'}`} style={{ borderLeftColor: '#ec4899' }}>
                            <div className="layer-header">
                              <div className="layer-title-group">
                                <div className="layer-number-badge" style={{ background: 'rgba(236,72,153,0.2)', color: '#f472b6' }}>
                                  5
                                </div>
                                <div>
                                  <h3 style={{ fontSize: '1.15rem' }}>🩺 Layer 5: Patient / Consumer (Authenticity & Dispense)</h3>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    Patient scans package barcode/QR to verify genuine origin and expiry validity.
                                  </div>
                                </div>
                              </div>
                              {isDispensed ? (
                                <span className="badge badge-match">✅ Dispensed to Patient</span>
                              ) : isAtPharmacy ? (
                                <span className="badge badge-match" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                                  Ready for Patient Dispense
                                </span>
                              ) : (
                                <span className="badge badge-info">⏳ En Route to Retailer</span>
                              )}
                            </div>

                            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                              {isDispensed ? (
                                <div>Batch successfully dispensed to patient with verified provenance proof.</div>
                              ) : isAtPharmacy ? (
                                <div>Medicine package is stocked at licensed retail pharmacy, verified authentic, and available for prescription fulfillment.</div>
                              ) : (
                                <div>Medicine has not yet arrived at retail pharmacy. Patient verification will confirm genuine status upon arrival.</div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🔍</div>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '6px' }}>Select or Search a Batch to Track</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '500px', margin: '0 auto' }}>
                      Enter a Batch ID in the search bar above or click one of the quick selection chips to inspect its multi-layer supply chain status.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* SUBTAB 2: FULL BLOCKCHAIN LEDGER */}
            {adminTab === 'LEDGER' && (
              <div className="card">
                <div className="card-header">
                  <div>
                    <h2 className="card-title">Cryptographic Blockchain Ledger</h2>
                    <p className="card-desc">
                      Every registration and transfer is sealed with SHA-256. Previous hashes chain blocks together.
                    </p>
                  </div>
                  <button className="btn btn-secondary" onClick={fetchLedger} disabled={loadingLedger}>
                    {loadingLedger ? 'Refreshing...' : '🔄 Refresh Ledger'}
                  </button>
                </div>

                <div className="blockchain-chain">
                  {ledger.chain?.map((block) => (
                    <div key={block.index} className="block-item">
                      <div className="block-header">
                        <div>
                          <span className="block-index">Block #{block.index}</span>
                          <span className="role-pill role-mfr" style={{ marginLeft: '12px' }}>
                            {block.eventType}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {new Date(block.timestamp).toLocaleString()}
                        </div>
                      </div>

                      <div className="grid-2" style={{ fontSize: '0.85rem' }}>
                        <div>
                          <div><strong>Batch ID:</strong> {block.batchId}</div>
                          <div><strong>Sender:</strong> {block.sender}</div>
                          <div><strong>Receiver:</strong> {block.receiver}</div>
                        </div>
                        <div>
                          <div className="hash-box">
                            <span>Hash: {block.hash}</span>
                          </div>
                          <div className="hash-box" style={{ color: 'var(--text-muted)' }}>
                            <span>Prev: {block.previousHash}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SUBTAB 3: CRYPTOGRAPHIC INTEGRITY AUDIT */}
            {adminTab === 'INTEGRITY' && (
              <div className="card">
                <div className="card-header">
                  <div>
                    <h2 className="card-title">Cryptographic Chain Integrity & Tamper Audit</h2>
                    <p className="card-desc">
                      Recomputes SHA-256 hashes of every block and verifies previousHash linkage across the entire chain.
                    </p>
                  </div>
                  <button className="btn btn-primary" onClick={runIntegrityAudit} disabled={auditing}>
                    {auditing ? 'Auditing...' : '🛡️ Re-Audit Ledger Now'}
                  </button>
                </div>

                {auditResult && (
                  <div style={{ marginTop: '16px' }}>
                    <div className={`alert-banner ${auditResult.isChainValid ? 'alert-success' : 'alert-danger'}`}>
                      <span style={{ fontSize: '1.8rem' }}>{auditResult.isChainValid ? '🛡️' : '🚨'}</span>
                      <div>
                        <strong style={{ fontSize: '1.1rem' }}>
                          {auditResult.isChainValid ? 'Blockchain Integrity Verified 100% Cryptographically Secure' : 'Tampering Detected in Ledger!'}
                        </strong>
                        <div style={{ marginTop: '4px' }}>
                          {auditResult.isChainValid
                            ? `Audited ${auditResult.totalBlocksAudited} blocks. Zero broken links, zero hash mismatches.`
                            : `Tampered Block Index: #${auditResult.tamperedBlockIndex}. Error: ${auditResult.error}`}
                        </div>
                        <div style={{ fontSize: '0.75rem', marginTop: '6px', color: 'var(--text-muted)' }}>
                          Audit Timestamp: {new Date(auditResult.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
