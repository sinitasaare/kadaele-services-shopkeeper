import React, { useState, useEffect, useRef } from 'react';
import { Camera as CapCamera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import dataService from '../services/dataService';
import './SalesRegister.css';

// ── Barcode beep (Web Audio API — no file needed) ──────────────────────────
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046, ctx.currentTime);       // C6
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.18);
  } catch (_) {}
}

function SalesRegister() {
  const [goods, setGoods] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [repaymentDate, setRepaymentDate] = useState('');
  const [showCashPopup, setShowCashPopup] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Debtor search states
  const [existingDebtors, setExistingDebtors] = useState([]);
  const [showDebtorSuggestions, setShowDebtorSuggestions] = useState(false);
  const [filteredDebtors, setFilteredDebtors] = useState([]);
  const [selectedDebtorId, setSelectedDebtorId] = useState(null);

  // Quantity modal states
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantityToAdd, setQuantityToAdd] = useState('');

  // ── Barcode scanner states ─────────────────────────────────────────────
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [lastScanned, setLastScanned] = useState(null); // {barcode, timestamp}
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  // Prevent duplicate scans within 1.5s of the same barcode
  const lastScanRef = useRef({ code: null, ts: 0 });

  useEffect(() => {
    loadGoods();
    loadDebtors();
    return () => stopScanner();
  }, []);

  const loadGoods = async () => {
    const goodsData = await dataService.getGoods();
    setGoods(goodsData);
  };
  const loadDebtors = async () => {
    const debtorsData = await dataService.getDebtors();
    setExistingDebtors(debtorsData || []);
  };

  // ── Repayment date helpers ─────────────────────────────────────────────
  const dateStr = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const getTomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return dateStr(d); };
  const getMax14DaysStr = () => { const d = new Date(); d.setDate(d.getDate() + 14); return dateStr(d); };

  // ── Debtor search ──────────────────────────────────────────────────────
  const handleDebtorSearchChange = (value) => {
    setCustomerName(value);
    if (value.length === 0) {
      setFilteredDebtors(existingDebtors);
      setShowDebtorSuggestions(existingDebtors.length > 0);
    } else {
      const f = existingDebtors.filter(d =>
        (d.name || d.customerName || '').toLowerCase().includes(value.toLowerCase())
      );
      setFilteredDebtors(f);
      setShowDebtorSuggestions(f.length > 0);
    }
  };
  const selectDebtor = (debtor) => {
    setCustomerName(debtor.name || debtor.customerName || '');
    setCustomerPhone(debtor.phone || debtor.customerPhone || '');
    setSelectedDebtorId(debtor.id);
    setShowDebtorSuggestions(false);
  };
  const clearDebtorSelection = () => {
    setCustomerName(''); setCustomerPhone(''); setSelectedDebtorId(null); setShowDebtorSuggestions(false);
  };

  // ── Catalogue ──────────────────────────────────────────────────────────
  const filteredGoods = goods.filter(good =>
    good.name.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 5);

  const addToCart = (good, qty = 1) => {
    const existing = catalogue.find(item => item.id === good.id);
    if (existing) {
      setCatalogue(prev => prev.map(item =>
        item.id === good.id ? { ...item, qty: item.qty + qty } : item
      ));
    } else {
      setCatalogue(prev => [...prev, { ...good, qty }]);
    }
  };

  const handleItemClick = (good) => {
    setSelectedItem(good);
    setQuantityToAdd('');
    setShowQuantityModal(true);
    setSearchTerm('');
    setShowResults(false);
  };

  const confirmAddItem = () => {
    const qty = parseInt(quantityToAdd, 10);
    if (isNaN(qty) || qty < 1) { alert('Please enter a valid quantity (minimum 1)'); return; }
    addToCart(selectedItem, qty);
    setShowQuantityModal(false);
    setSelectedItem(null);
    setQuantityToAdd('');
  };

  const updateQuantity = (id, newQty) => {
    if (newQty === '') {
      setCatalogue(catalogue.map(item => item.id === id ? { ...item, qty: '' } : item));
      return;
    }
    const qty = parseInt(newQty, 10);
    if (isNaN(qty) || qty < 1) return;
    setCatalogue(catalogue.map(item => item.id === id ? { ...item, qty } : item));
  };
  const removeFromCatalogue = (id) => setCatalogue(catalogue.filter(item => item.id !== id));
  const calculateTotal = () =>
    catalogue.reduce((sum, item) => {
      const qty = typeof item.qty === 'number' ? item.qty : (parseInt(item.qty, 10) || 0);
      return sum + (item.price * qty);
    }, 0);

  // ── Barcode scanner ────────────────────────────────────────────────────
  // Uses the BarcodeDetector API (supported on Android Chrome / WebView API 83+)
  // with a fallback message if unsupported.
  const startScanner = async () => {
    setScannerError('');
    setLastScanned(null);

    if (!('BarcodeDetector' in window)) {
      setScannerError('Barcode scanning is not supported on this device.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      setScannerActive(true);

      // Wait a tick for the video element to mount
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 50);

      const detector = new window.BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code', 'itf', 'data_matrix']
      });

      // Poll every 400ms — fast enough to be snappy, not so fast it hammers CPU
      scanIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length === 0) return;

          const code = barcodes[0].rawValue;
          const now = Date.now();

          // Debounce: ignore same code within 1.5 seconds
          if (code === lastScanRef.current.code && now - lastScanRef.current.ts < 1500) return;
          lastScanRef.current = { code, ts: now };

          handleBarcodeDetected(code);
        } catch (_) {}
      }, 400);

    } catch (err) {
      setScannerError('Camera access denied. Please allow camera permission and try again.');
      setScannerActive(false);
    }
  };

  const stopScanner = () => {
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) { videoRef.current.srcObject = null; }
    setScannerActive(false);
  };

  const handleBarcodeDetected = (code) => {
    // Look for a goods item with a matching barcode
    const match = goods.find(g =>
      g.barcode && String(g.barcode).trim() === String(code).trim()
    );

    if (!match) {
      // No match — show brief error, stop scanner silently (no beep)
      setLastScanned({ code, matched: false });
      stopScanner();
      return;
    }

    // Match found — beep and add to cart
    playBeep();
    addToCart(match, 1);
    setLastScanned({ code, matched: true, name: match.name });
    // Do NOT stop the scanner — user can swipe away and scan another item
  };

  // ── Cash payment ───────────────────────────────────────────────────────
  const handlePayCash = () => {
    if (catalogue.length === 0) { alert('Cart is empty.'); return; }
    setShowCashPopup(true);
  };
  const confirmCashPayment = async () => {
    setIsProcessing(true);
    setShowCashPopup(false);
    try {
      const total = calculateTotal();
      const items = catalogue.map(item => ({
        id: item.id, name: item.name, price: item.price,
        quantity: item.qty, subtotal: item.price * item.qty,
      }));
      await dataService.addSale({
        items, total, paymentType: 'cash',
        customerName: '', customerPhone: '', photoUrl: null, repaymentDate: '', isDebt: false,
      });
      alert(`Cash payment confirmed. Total: $${total.toFixed(2)}`);
      setCatalogue([]);
    } catch (error) {
      console.error('Payment error:', error);
      alert('Payment failed. Please try again.');
    } finally { setIsProcessing(false); }
  };

  // ── Credit payment ─────────────────────────────────────────────────────
  const handlePayCredit = () => {
    if (catalogue.length === 0) { alert('Cart is empty.'); return; }
    loadDebtors();
    setShowCreditModal(true);
  };
  const closeCreditModal = () => {
    setShowCreditModal(false);
    clearDebtorSelection();
    setRepaymentDate('');
    setCapturedPhoto(null);
  };
  const takeCreditPhoto = async () => {
    if (!Capacitor.isNativePlatform()) {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*'; input.capture = 'camera';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => setCapturedPhoto(ev.target.result);
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      try {
        const image = await CapCamera.getPhoto({ quality: 70, allowEditing: false, resultType: 'dataUrl' });
        setCapturedPhoto(image.dataUrl);
      } catch { alert('Could not capture photo. Please try again.'); }
    }
  };
  const confirmCreditSale = async (e) => {
    e.preventDefault();
    if (!selectedDebtorId) { alert('Please select a registered debtor from the dropdown.'); return; }
    if (!repaymentDate) { alert('Please select a repayment date.'); return; }
    setIsProcessing(true);
    try {
      const total = calculateTotal();
      const items = catalogue.map(item => ({
        id: item.id, name: item.name, price: item.price,
        quantity: item.qty, subtotal: item.price * item.qty,
      }));
      let photoUrl = null;
      if (capturedPhoto) {
        try { photoUrl = await dataService.savePhoto(capturedPhoto, Date.now().toString()); }
        catch (err) { console.error('Photo save error:', err); }
      }
      await dataService.addSale({
        items, total, paymentType: 'credit',
        customerName, customerPhone, debtorId: selectedDebtorId,
        photoUrl, repaymentDate, isDebt: true,
      });
      alert(`Credit sale saved.\nDebtor: ${customerName}\nRepayment Date: ${repaymentDate}`);
      setCatalogue([]);
      closeCreditModal();
    } catch (error) {
      console.error('Credit sale error:', error);
      alert('Failed to record credit sale. Please try again.');
    } finally { setIsProcessing(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="sr-container">

      {/* Catalogue table */}
      <div className="sr-catalogue-area">
        <div className="sr-catalogue-wrapper">
          <table className="sr-catalogue-table">
            <thead>
              <tr><th>Qty</th><th>Item</th><th>Price</th><th>Total</th><th>Edit</th></tr>
            </thead>
            <tbody>
              {catalogue.length === 0 ? (
                <tr><td colSpan="5" className="sr-catalogue-empty">Catalogue is empty</td></tr>
              ) : (
                catalogue.map(item => (
                  <tr key={item.id}>
                    <td className="sr-qty-cell">
                      <input type="number" value={item.qty}
                        onChange={(e) => updateQuantity(item.id, e.target.value)} min="1" />
                    </td>
                    <td>{item.name}</td>
                    <td className="sr-price-cell">${item.price.toFixed(2)}</td>
                    <td className="sr-total-cell">${(item.price * (parseInt(item.qty, 10) || 0)).toFixed(2)}</td>
                    <td className="sr-edit-cell">
                      <button onClick={() => removeFromCatalogue(item.id)}>×</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="sr-bottom-section">
        <div className="sr-cart-total">
          <span>Total:</span>
          <span className="sr-total-amount">{calculateTotal().toFixed(2)}</span>
        </div>

        {/* Three-button row: Credit | Scanner | Cash */}
        <div className="sr-payment-buttons">
          <button className="sr-btn-credit" onClick={handlePayCredit} disabled={isProcessing}>
            Buy on Credit
          </button>

          <button
            className={`sr-btn-scan${scannerActive ? ' sr-btn-scan-active' : ''}`}
            onClick={() => scannerActive ? stopScanner() : startScanner()}
            disabled={isProcessing}
            title={scannerActive ? 'Stop scanner' : 'Scan barcode'}
          >
            {/* Barcode scanner SVG icon */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
              <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
              <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
              <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
              <line x1="7" y1="7" x2="7" y2="17"/>
              <line x1="10" y1="7" x2="10" y2="17"/>
              <line x1="13" y1="7" x2="13" y2="17"/>
              <line x1="16" y1="7" x2="16" y2="17"/>
            </svg>
          </button>

          <button className="sr-btn-cash" onClick={handlePayCash} disabled={isProcessing}>
            Pay with Cash
          </button>
        </div>

        <div className="sr-search-section">
          <input type="text" className="sr-search-input" placeholder="Type to search goods..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setShowResults(e.target.value.trim().length > 0); }}
            onFocus={() => setShowResults(searchTerm.trim().length > 0)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
          />
          {showResults && filteredGoods.length > 0 && (
            <div className="sr-search-results">
              {filteredGoods.map(good => (
                <div key={good.id} className="sr-search-result-item"
                  onMouseDown={(e) => { e.preventDefault(); handleItemClick(good); }}>
                  <span className="sr-item-name">{good.name}</span>
                  <span className="sr-item-price">${good.price.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Barcode scanner overlay ── */}
      {scannerActive && (
        <div className="sr-scanner-overlay">
          <div className="sr-scanner-modal">
            <div className="sr-scanner-header">
              <span className="sr-scanner-title">Scan Barcode</span>
              <button className="sr-scanner-close" onClick={stopScanner}>✕</button>
            </div>

            <div className="sr-scanner-viewport">
              <video ref={videoRef} className="sr-scanner-video" playsInline muted autoPlay />
              {/* Targeting reticle */}
              <div className="sr-scanner-reticle">
                <div className="sr-reticle-corner sr-reticle-tl" />
                <div className="sr-reticle-corner sr-reticle-tr" />
                <div className="sr-reticle-corner sr-reticle-bl" />
                <div className="sr-reticle-corner sr-reticle-br" />
                <div className="sr-reticle-line" />
              </div>
            </div>

            <div className="sr-scanner-hint">
              {lastScanned ? (
                lastScanned.matched ? (
                  <span className="sr-scan-success">✓ Added: {lastScanned.name} — scan again for another item</span>
                ) : (
                  <span className="sr-scan-fail">No product found for barcode "{lastScanned.code}"</span>
                )
              ) : (
                <span>Point camera at a barcode</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scanner error (no BarcodeDetector support) */}
      {scannerError && !scannerActive && (
        <div className="sr-scanner-overlay">
          <div className="sr-scanner-modal sr-scanner-modal-sm">
            <div className="sr-scanner-header">
              <span className="sr-scanner-title">Scanner Unavailable</span>
              <button className="sr-scanner-close" onClick={() => setScannerError('')}>✕</button>
            </div>
            <p className="sr-scanner-error-msg">{scannerError}</p>
            <button className="sr-btn-confirm" style={{marginTop:'1rem',width:'100%'}} onClick={() => setScannerError('')}>OK</button>
          </div>
        </div>
      )}

      {/* ── Quantity modal ── */}
      {showQuantityModal && selectedItem && (
        <div className="sr-modal-overlay">
          <div className="sr-modal-content">
            <h2>Add to Cart</h2>
            <p><strong>{selectedItem.name}</strong></p>
            <p className="sr-item-price-display">Price: ${selectedItem.price.toFixed(2)}</p>
            <div className="sr-quantity-input-section">
              <label htmlFor="quantity-input">Quantity:</label>
              <input type="number" id="quantity-input" className="sr-quantity-input"
                value={quantityToAdd} onChange={(e) => setQuantityToAdd(e.target.value)}
                placeholder="Enter quantity" min="1" autoFocus />
            </div>
            <div className="sr-modal-buttons">
              <button className="sr-btn-cancel" onClick={() => { setShowQuantityModal(false); setSelectedItem(null); setQuantityToAdd(''); }}>Cancel</button>
              <button className="sr-btn-confirm" onClick={confirmAddItem}>Add to Cart</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cash confirm popup ── */}
      {showCashPopup && (
        <div className="sr-modal-overlay">
          <div className="sr-modal-content">
            <h2>Confirm Payment</h2>
            <p>Are you sure you want to proceed with this cash payment?</p>
            <div className="sr-modal-buttons">
              <button className="sr-btn-cancel" onClick={() => setShowCashPopup(false)}>Cancel</button>
              <button className="sr-btn-confirm" onClick={confirmCashPayment}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Buy on Credit modal ── */}
      {showCreditModal && (
        <div className="sr-modal-overlay">
          <div className="sr-modal-content">
            <h2>Buy on Credit</h2>
            <form className="sr-credit-form" onSubmit={confirmCreditSale}>
              <div style={{ position: 'relative', marginBottom: '12px' }}>
                <label htmlFor="debtor-name" style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Debtor Name:
                </label>
                <div style={{ position: 'relative' }}>
                  <input type="text" id="debtor-name" value={customerName}
                    readOnly={!!selectedDebtorId}
                    onChange={(e) => { if (!selectedDebtorId) handleDebtorSearchChange(e.target.value); }}
                    onFocus={() => {
                      if (!selectedDebtorId) {
                        setFilteredDebtors(existingDebtors);
                        setShowDebtorSuggestions(existingDebtors.length > 0);
                      }
                    }}
                    onBlur={() => setTimeout(() => setShowDebtorSuggestions(false), 200)}
                    placeholder={existingDebtors.length === 0 ? 'No registered debtors yet' : 'Search debtor name…'}
                    disabled={existingDebtors.length === 0}
                    required
                    style={{
                      width: '100%', padding: '8px 32px 8px 10px',
                      border: '1.5px solid #ccc', borderRadius: '6px',
                      backgroundColor: selectedDebtorId ? '#f0f0f0' : 'white',
                      cursor: selectedDebtorId ? 'default' : 'text',
                    }}
                  />
                  {selectedDebtorId && (
                    <button type="button" onClick={clearDebtorSelection}
                      style={{ position:'absolute', right:'8px', top:'50%', transform:'translateY(-50%)',
                        background:'none', border:'none', cursor:'pointer', fontSize:'18px', color:'#999', lineHeight:1 }}>
                      ×
                    </button>
                  )}
                </div>
                {showDebtorSuggestions && filteredDebtors.length > 0 && (
                  <div style={{
                    position:'absolute', top:'100%', left:0, right:0, zIndex:1000,
                    background:'white', border:'1px solid #ccc', borderRadius:'6px',
                    maxHeight:'160px', overflowY:'auto', boxShadow:'0 4px 12px rgba(0,0,0,0.15)',
                  }}>
                    {filteredDebtors.map((debtor) => (
                      <div key={debtor.id}
                        onMouseDown={(e) => { e.preventDefault(); selectDebtor(debtor); }}
                        style={{ padding:'10px 12px', cursor:'pointer', borderBottom:'1px solid #eee' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                      >
                        <div style={{ fontWeight:600 }}>{debtor.name || debtor.customerName}</div>
                        <div style={{ fontSize:'12px', color:'#888' }}>
                          Balance: ${(debtor.balance || debtor.totalDue || 0).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {existingDebtors.length === 0 && (
                  <p style={{ fontSize:'12px', color:'#c00', marginTop:'4px' }}>
                    No registered debtors found. Add one in the Debtors section first.
                  </p>
                )}
              </div>

              <div style={{ marginBottom:'12px' }}>
                <label htmlFor="repayment-date" style={{ display:'block', marginBottom:'4px', fontWeight:600 }}>
                  Repayment Date:
                </label>
                <input type="date" id="repayment-date" value={repaymentDate}
                  min={getTomorrowStr()} max={getMax14DaysStr()}
                  onChange={(e) => setRepaymentDate(e.target.value)} required
                  style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #ccc', borderRadius:'6px' }} />
                <p style={{ fontSize:'11px', color:'#888', marginTop:'3px' }}>
                  Only dates within the next 14 days are selectable.
                </p>
              </div>

              <div className="sr-photo-section">
                <label>Photo of Credit Book (Optional):</label>
                <button type="button" className="sr-btn-photo" onClick={takeCreditPhoto}>
                  {capturedPhoto ? '📷 Retake Photo' : '📷 Take Photo'}
                </button>
                {capturedPhoto && <img src={capturedPhoto} alt="Credit book" className="sr-photo-preview" />}
              </div>

              <div className="sr-modal-buttons">
                <button type="button" className="sr-btn-cancel" onClick={closeCreditModal}>Cancel</button>
                <button type="submit" className="sr-btn-confirm" disabled={isProcessing || !selectedDebtorId}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default SalesRegister;
