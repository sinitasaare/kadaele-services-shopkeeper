import React, { useState, useEffect } from 'react';
import { Camera as CapCamera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import dataService from '../services/dataService';
import './SalesRegister.css';

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

  useEffect(() => {
    loadGoods();
    loadDebtors();
  }, []);

  const loadGoods = async () => {
    const goodsData = await dataService.getGoods();
    setGoods(goodsData);
  };

  const loadDebtors = async () => {
    const debtorsData = await dataService.getDebtors();
    setExistingDebtors(debtorsData || []);
  };

  // ── Repayment date helpers ────────────────────────────────────────────────
  // min = tomorrow, max = 14 days from today
  const dateStr = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const getTomorrowStr = () => {
    const d = new Date(); d.setDate(d.getDate() + 1); return dateStr(d);
  };
  const getMax14DaysStr = () => {
    const d = new Date(); d.setDate(d.getDate() + 14); return dateStr(d);
  };

  // ── Debtor search ─────────────────────────────────────────────────────────
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
    setCustomerName('');
    setCustomerPhone('');
    setSelectedDebtorId(null);
    setShowDebtorSuggestions(false);
  };

  // ── Catalogue ─────────────────────────────────────────────────────────────
  const filteredGoods = goods.filter(good =>
    good.name.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 5);

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
    const existing = catalogue.find(item => item.id === selectedItem.id);
    if (existing) {
      setCatalogue(catalogue.map(item =>
        item.id === selectedItem.id ? { ...item, qty: item.qty + qty } : item
      ));
    } else {
      setCatalogue([...catalogue, { ...selectedItem, qty }]);
    }
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

  // ── Cash payment ──────────────────────────────────────────────────────────
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
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Credit payment ────────────────────────────────────────────────────────
  const handlePayCredit = () => {
    if (catalogue.length === 0) { alert('Cart is empty.'); return; }
    // Refresh debtor list each time modal opens so it's always current
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
      } catch (error) {
        alert('Could not capture photo. Please try again.');
      }
    }
  };

  const confirmCreditSale = async (e) => {
    e.preventDefault();

    if (!selectedDebtorId) {
      alert('Please select a registered debtor from the dropdown.');
      return;
    }
    if (!repaymentDate) {
      alert('Please select a repayment date.');
      return;
    }

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

      // addSale will call updateDebtor internally, which updates the debtor
      // record in localforage and syncs it to Firebase
      await dataService.addSale({
        items,
        total,
        paymentType: 'credit',
        customerName,
        customerPhone,
        debtorId: selectedDebtorId,   // ← exact match key for updateDebtor
        photoUrl,
        repaymentDate,
        isDebt: true,
      });

      alert(`Credit sale saved.\nDebtor: ${customerName}\nRepayment Date: ${repaymentDate}`);
      setCatalogue([]);
      closeCreditModal();
    } catch (error) {
      console.error('Credit sale error:', error);
      alert('Failed to record credit sale. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="sr-container">

      {/* Catalogue table */}
      <div className="sr-catalogue-area">
        <div className="sr-catalogue-wrapper">
          <table className="sr-catalogue-table">
            <thead>
              <tr>
                <th>Qty</th><th>Item</th><th>Price</th><th>Total</th><th>Edit</th>
              </tr>
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
        <div className="sr-payment-buttons">
          <button className="sr-btn-credit" onClick={handlePayCredit} disabled={isProcessing}>
            Buy on Credit
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

              {/* Debtor Name — search only, no free typing */}
              <div style={{ position: 'relative', marginBottom: '12px' }}>
                <label htmlFor="debtor-name" style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Debtor Name:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    id="debtor-name"
                    value={customerName}
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
                      width: '100%',
                      padding: '8px 32px 8px 10px',
                      border: '1.5px solid #ccc',
                      borderRadius: '6px',
                      backgroundColor: selectedDebtorId ? '#f0f0f0' : 'white',
                      cursor: selectedDebtorId ? 'default' : 'text',
                    }}
                  />
                  {/* Clear button — shown only once a debtor is locked in */}
                  {selectedDebtorId && (
                    <button type="button" onClick={clearDebtorSelection}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#999', lineHeight: 1 }}>
                      ×
                    </button>
                  )}
                </div>

                {/* Dropdown suggestions */}
                {showDebtorSuggestions && filteredDebtors.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
                    background: 'white', border: '1px solid #ccc', borderRadius: '6px',
                    maxHeight: '160px', overflowY: 'auto',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}>
                    {filteredDebtors.map((debtor) => (
                      <div key={debtor.id}
                        onMouseDown={(e) => { e.preventDefault(); selectDebtor(debtor); }}
                        style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                      >
                        <div style={{ fontWeight: 600 }}>{debtor.name || debtor.customerName}</div>
                        <div style={{ fontSize: '12px', color: '#888' }}>
                          Balance: ${(debtor.balance || debtor.totalDue || 0).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {existingDebtors.length === 0 && (
                  <p style={{ fontSize: '12px', color: '#c00', marginTop: '4px' }}>
                    No registered debtors found. Add one in the Debtors section first.
                  </p>
                )}
              </div>

              {/* Repayment Date — min = tomorrow, max = +14 days */}
              <div style={{ marginBottom: '12px' }}>
                <label htmlFor="repayment-date" style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Repayment Date:
                </label>
                <input
                  type="date"
                  id="repayment-date"
                  value={repaymentDate}
                  min={getTomorrowStr()}
                  max={getMax14DaysStr()}
                  onChange={(e) => setRepaymentDate(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #ccc', borderRadius: '6px' }}
                />
                <p style={{ fontSize: '11px', color: '#888', marginTop: '3px' }}>
                  Only dates within the next 14 days are selectable.
                </p>
              </div>

              {/* Optional photo */}
              <div className="sr-photo-section">
                <label>Photo of Credit Book (Optional):</label>
                <button type="button" className="sr-btn-photo" onClick={takeCreditPhoto}>
                  {capturedPhoto ? '📷 Retake Photo' : '📷 Take Photo'}
                </button>
                {capturedPhoto && <img src={capturedPhoto} alt="Credit book" className="sr-photo-preview" />}
              </div>

              <div className="sr-modal-buttons">
                <button type="button" className="sr-btn-cancel" onClick={closeCreditModal}>
                  Cancel
                </button>
                <button type="submit" className="sr-btn-confirm" disabled={isProcessing || !selectedDebtorId}>
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default SalesRegister;
