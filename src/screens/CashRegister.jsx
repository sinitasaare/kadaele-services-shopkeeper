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

  useEffect(() => {
    loadGoods();
  }, []);

  const loadGoods = async () => {
    const goodsData = await dataService.getGoods();
    setGoods(goodsData);
  };

  const filteredGoods = goods.filter(good =>
    good.name.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 5);

  const addToCatalogue = (good) => {
    const existing = catalogue.find(item => item.id === good.id);
    if (existing) {
      setCatalogue(catalogue.map(item =>
        item.id === good.id
          ? { ...item, qty: item.qty + 1 }
          : item
      ));
    } else {
      setCatalogue([...catalogue, { ...good, qty: 1 }]);
    }
    setSearchTerm('');
    setShowResults(false);
  };

  const updateQuantity = (id, newQty) => {
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
    return catalogue.reduce((sum, item) => sum + (item.price * item.qty), 0);
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
      {/* Header */}
      <div className="header">
        <h1>Cash Register</h1>
      </div>

      {/* Scrollable Catalogue */}
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
                    <td className="total-cell">${(item.price * item.qty).toFixed(2)}</td>
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

      {/* Bottom Section */}
      <div className="bottom-section">
        <div className="cart-total">
          <span>Total:</span>
          <span className="total-amount">{calculateTotal().toFixed(2)}</span>
        </div>
        <div className="payment-buttons">
          <button 
            className="btn-pay-cash" 
            onClick={handlePayCash}
            disabled={isProcessing}
          >
            Pay with Cash
          </button>
          <button 
            className="btn-pay-credit" 
            onClick={handlePayCredit}
            disabled={isProcessing}
          >
            Buy on Credit
          </button>
        </div>
      </div>

      {/* Search Section */}
      <section className="search-section">
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
        />
        {showResults && (
          <div className="results-list">
            {filteredGoods.length === 0 ? (
              <div className="result-item">No matching goods</div>
            ) : (
              filteredGoods.map(good => (
                <div
                  key={good.id}
                  className="result-item"
                  onClick={() => addToCatalogue(good)}
                >
                  {good.name} - ${good.price.toFixed(2)}
                </div>
              ))
            )}
          </div>
        )}
      </section>

      {/* Cash Payment Popup */}
      {showCashPopup && (
        <div className="popup-overlay active">
          <div className="popup">
            <h3>Confirm Payment</h3>
            <p>Are you sure you want to proceed with this cash payment?</p>
            <div className="popup-buttons">
              <button 
                className="popup-btn popup-btn-cancel" 
                onClick={() => setShowCashPopup(false)}
              >
                Cancel
              </button>
              <button 
                className="popup-btn popup-btn-confirm" 
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
        <div className="modal-overlay active">
          <div className="modal">
            <h3>Buy on Credit</h3>
            <form className="modal-form" onSubmit={confirmCreditSale}>
              <div>
                <label htmlFor="debtor-name">Debtor Name:</label>
                <input
                  type="text"
                  id="debtor-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
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
              <div>
                <label>Photo of Credit Book (Optional):</label>
                <button 
                  type="button" 
                  className="photo-btn"
                  onClick={takeCreditPhoto}
                >
                  {capturedPhoto ? '📷 Retake Photo' : '📷 Take Photo'}
                </button>
                {capturedPhoto && (
                  <div className="photo-preview-small">
                    <img src={capturedPhoto} alt="Credit book" />
                  </div>
                )}
              </div>
              <div className="modal-buttons">
                <button
                  type="button"
                  className="modal-btn modal-btn-cancel"
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
                <button type="submit" className="modal-btn modal-btn-save">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Click outside to close search results */}
      {showResults && (
        <div 
          className="search-backdrop" 
          onClick={() => {
            setShowResults(false);
            setSearchTerm('');
          }}
        />
      )}
    </div>
  );
}

export default CashRegister;
