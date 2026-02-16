import React, { useState, useEffect } from 'react';
import { Camera as CapCamera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import dataService from '../services/dataService';
import './CashRegister.css';

function CashRegister() {
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

  // Debtor autocomplete states
  const [existingDebtors, setExistingDebtors] = useState([]);
  const [showDebtorSuggestions, setShowDebtorSuggestions] = useState(false);
  const [filteredDebtors, setFilteredDebtors] = useState([]);
  
  // New states for quantity modal
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

  const handleCustomerNameChange = (value) => {
    setCustomerName(value);
    
    if (value.length >= 2) {
      const filtered = existingDebtors.filter(debtor =>
        debtor.name?.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredDebtors(filtered);
      setShowDebtorSuggestions(filtered.length > 0);
    } else {
      setShowDebtorSuggestions(false);
    }
  };

  const selectDebtor = (debtor) => {
    setCustomerName(debtor.name);
    setCustomerPhone(debtor.phone || '');
    setShowDebtorSuggestions(false);
  };

  const filteredGoods = goods.filter(good =>
    good.name.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 5);

  const handleItemClick = (good) => {
    setSelectedItem(good);
    setQuantityToAdd(''); // Empty by default (not 1)
    setShowQuantityModal(true);
    setSearchTerm('');
    setShowResults(false);
  };

  const confirmAddItem = () => {
    const qty = parseInt(quantityToAdd, 10);
    if (isNaN(qty) || qty < 1) {
      alert('Please enter a valid quantity (minimum 1)');
      return;
    }

    const existing = catalogue.find(item => item.id === selectedItem.id);
    if (existing) {
      setCatalogue(catalogue.map(item =>
        item.id === selectedItem.id
          ? { ...item, qty: item.qty + qty }
          : item
      ));
    } else {
      setCatalogue([...catalogue, { ...selectedItem, qty }]);
    }

    // Reset
    setShowQuantityModal(false);
    setSelectedItem(null);
    setQuantityToAdd('');
  };

  const updateQuantity = (id, newQty) => {
    // Allow empty string for editing
    if (newQty === '') {
      setCatalogue(catalogue.map(item =>
        item.id === id ? { ...item, qty: '' } : item
      ));
      return;
    }

    const qty = parseInt(newQty, 10);
    if (isNaN(qty) || qty < 1) return;

    setCatalogue(catalogue.map(item =>
      item.id === id ? { ...item, qty } : item
    ));
  };

  const removeFromCatalogue = (id) => {
    setCatalogue(catalogue.filter(item => item.id !== id));
  };

  const calculateTotal = () => {
    return catalogue.reduce((sum, item) => {
      const qty = typeof item.qty === 'number' ? item.qty : (parseInt(item.qty, 10) || 0);
      return sum + (item.price * qty);
    }, 0);
  };

  const handlePayCash = async () => {
    if (catalogue.length === 0) {
      alert('Cart is empty.');
      return;
    }
    setShowCashPopup(true);
  };

  const confirmCashPayment = async () => {
    setIsProcessing(true);
    setShowCashPopup(false);

    try {
      const total = calculateTotal();
      const items = catalogue.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.qty,
        subtotal: item.price * item.qty,
      }));

      await dataService.addPurchase({
        items,
        total,
        paymentType: 'cash',
        customerName: '',
        customerPhone: '',
        photoUrl: null,
        repaymentDate: '',
        isDebt: false,
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

  const handlePayCredit = () => {
    if (catalogue.length === 0) {
      alert('Cart is empty.');
      return;
    }
    setShowCreditModal(true);
  };

  const takeCreditPhoto = async () => {
    if (!Capacitor.isNativePlatform()) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'camera';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setCapturedPhoto(event.target.result);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      try {
        const image = await CapCamera.getPhoto({
          quality: 70,
          allowEditing: false,
          resultType: 'dataUrl',
        });
        setCapturedPhoto(image.dataUrl);
      } catch (error) {
        alert('Could not capture photo. Please try again.');
      }
    }
  };

  const confirmCreditSale = async (e) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      const total = calculateTotal();
      const items = catalogue.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.qty,
        subtotal: item.price * item.qty,
      }));

      let photoUrl = null;
      if (capturedPhoto) {
        try {
          photoUrl = await dataService.savePhoto(capturedPhoto, Date.now().toString());
        } catch (error) {
          console.error('Photo save error:', error);
        }
      }

      await dataService.addPurchase({
        items,
        total,
        paymentType: 'credit',
        customerName,
        customerPhone,
        photoUrl,
        repaymentDate,
        isDebt: true,
      });

      alert(`Debtor: ${customerName}\nRepayment Date: ${repaymentDate}\nCredit sale recorded.`);

      setCatalogue([]);
      setCustomerName('');
      setCustomerPhone('');
      setRepaymentDate('');
      setCapturedPhoto(null);
      setShowCreditModal(false);
    } catch (error) {
      console.error('Credit sale error:', error);
      alert('Failed to record credit sale. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };
  return (
    <div className="container">

      {/* Middle: Table with scrollable body */}
      <div className="catalogue-area">
        <div className="catalogue-wrapper">
          <table className="catalogue-table">
            <thead>
              <tr>
                <th>Qty</th>
                <th>Item</th>
                <th>Price</th>
                <th>Total</th>
                <th>Edit</th>
              </tr>
            </thead>
            <tbody>
              {catalogue.length === 0 ? (
                <tr>
                  <td colSpan="5" className="catalogue-empty">
                    Catalogue is empty
                  </td>
                </tr>
              ) : (
                catalogue.map(item => (
                  <tr key={item.id}>
                    <td className="qty-cell">
                      <input
                        type="number"
                        value={item.qty}
                        onChange={(e) => updateQuantity(item.id, e.target.value)}
                        min="1"
                      />
                    </td>
                    <td>{item.name}</td>
                    <td className="price-cell">${item.price.toFixed(2)}</td>
                    <td className="total-cell">${(item.price * (parseInt(item.qty, 10) || 0)).toFixed(2)}</td>
                    <td className="edit-cell">
                      <button onClick={() => removeFromCatalogue(item.id)}>×</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Section - FIXED at screen bottom */}
      <div className="bottom-section">
        <div className="cart-total">
          <span>Total:</span>
          <span className="total-amount">{calculateTotal().toFixed(2)}</span>
        </div>
        
        <div className="payment-buttons">
          <button 
            className="btn-credit" 
            onClick={handlePayCredit}
            disabled={isProcessing}
          >
            Buy on Credit
          </button>
          <button 
            className="btn-cash" 
            onClick={handlePayCash}
            disabled={isProcessing}
          >
            Pay with Cash
          </button>
        </div>

        {/* Search at bottom */}
        <div className="search-section">
          <input
            type="text"
            className="search-input"
            placeholder="Type to search goods..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setShowResults(e.target.value.trim().length > 0);
            }}
            onFocus={() => setShowResults(searchTerm.trim().length > 0)}
            onBlur={() => {
              setTimeout(() => setShowResults(false), 200);
            }}
          />
          {showResults && filteredGoods.length > 0 && (
            <div className="search-results">
              {filteredGoods.map(good => (
                <div
                  key={good.id}
                  className="search-result-item"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleItemClick(good);
                  }}
                >
                  <span className="item-name">{good.name}</span>
                  <span className="item-price">${good.price.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quantity Modal */}
      {showQuantityModal && selectedItem && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Add to Cart</h2>
            <p><strong>{selectedItem.name}</strong></p>
            <p className="item-price-display">Price: ${selectedItem.price.toFixed(2)}</p>
            
            <div className="quantity-input-section">
              <label htmlFor="quantity-input">Quantity:</label>
              <input
                type="number"
                id="quantity-input"
                className="quantity-input"
                value={quantityToAdd}
                onChange={(e) => setQuantityToAdd(e.target.value)}
                placeholder="Enter quantity"
                min="1"
                autoFocus
              />
            </div>

            <div className="modal-buttons">
              <button 
                className="btn-cancel" 
                onClick={() => {
                  setShowQuantityModal(false);
                  setSelectedItem(null);
                  setQuantityToAdd('');
                }}
              >
                Cancel
              </button>
              <button 
                className="btn-confirm" 
                onClick={confirmAddItem}
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cash Payment Popup */}
      {showCashPopup && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Confirm Payment</h2>
            <p>Are you sure you want to proceed with this cash payment?</p>
            <div className="modal-buttons">
              <button 
                className="btn-cancel" 
                onClick={() => setShowCashPopup(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-confirm" 
                onClick={confirmCashPayment}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credit Sale Modal */}
      {showCreditModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Buy on Credit</h2>
            <form className="credit-form" onSubmit={confirmCreditSale}>
              <div style={{position: 'relative'}}>
                <label htmlFor="debtor-name">Debtor Name:</label>
                <input
                  type="text"
                  id="debtor-name"
                  value={customerName}
                  onChange={(e) => handleCustomerNameChange(e.target.value)}
                  onFocus={() => customerName.length >= 2 && setShowDebtorSuggestions(true)}
                  required
                />
                {showDebtorSuggestions && filteredDebtors.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'white',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    maxHeight: '150px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                  }}>
                    {filteredDebtors.map((debtor, index) => (
                      <div
                        key={index}
                        onClick={() => selectDebtor(debtor)}
                        style={{
                          padding: '10px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #eee'
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#f5f5f5'}
                        onMouseLeave={(e) => e.target.style.background = 'white'}
                      >
                        <div style={{fontWeight: 'bold'}}>{debtor.name}</div>
                        {debtor.phone && <div style={{fontSize: '12px', color: '#666'}}>{debtor.phone}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="debtor-phone">Debtor Phone:</label>
                <input
                  type="tel"
                  id="debtor-phone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="repayment-date">Repayment Date:</label>
                <input
                  type="date"
                  id="repayment-date"
                  value={repaymentDate}
                  onChange={(e) => setRepaymentDate(e.target.value)}
                  required
                />
              </div>
              <div className="photo-section">
                <label>Photo of Credit Book (Optional):</label>
                <button 
                  type="button" 
                  className="btn-photo"
                  onClick={takeCreditPhoto}
                >
                  {capturedPhoto ? '📷 Retake Photo' : '📷 Take Photo'}
                </button>
                {capturedPhoto && (
                  <img src={capturedPhoto} alt="Credit book" className="photo-preview" />
                )}
              </div>
              <div className="modal-buttons">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => {
                    setShowCreditModal(false);
                    setCustomerName('');
                    setCustomerPhone('');
                    setRepaymentDate('');
                    setCapturedPhoto(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-confirm">
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

export default CashRegister;
