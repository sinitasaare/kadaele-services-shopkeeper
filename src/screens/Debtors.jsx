import React, { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, Camera } from 'lucide-react';
import dataService from '../services/dataService';
import './Debtors.css';

function Debtors() {
  const [debtors, setDebtors] = useState([]);
  const [selectedDebtor, setSelectedDebtor] = useState(null);
  const [debtorPurchases, setDebtorPurchases] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentPhoto, setPaymentPhoto] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDebtors();
  }, []);

  const loadDebtors = async () => {
    try {
      setLoading(true);
      const debtorsData = await dataService.getDebtors();
      setDebtors(debtorsData || []);
    } catch (error) {
      console.error('Error loading debtors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDebtorClick = async (debtor) => {
    setSelectedDebtor(debtor);
    
    // Load debtor's purchases
    try {
      const allPurchases = await dataService.getPurchases();
      const debtorPurchasesList = allPurchases.filter(p => 
        debtor.purchaseIds?.includes(p.id)
      );
      setDebtorPurchases(debtorPurchasesList);
    } catch (error) {
      console.error('Error loading debtor purchases:', error);
      setDebtorPurchases([]);
    }
  };

  const closeDebtorModal = () => {
    setSelectedDebtor(null);
    setDebtorPurchases([]);
  };

  const openPaymentModal = () => {
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentAmount('');
    setPaymentPhoto(null);
  };

  const handleTakePhoto = async () => {
    try {
      const { Camera } = await import('@capacitor/camera');
      const { CameraResultType, CameraSource } = await import('@capacitor/camera');
      
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });

      setPaymentPhoto(image.dataUrl);
    } catch (error) {
      console.error('Error taking photo:', error);
      alert('Failed to take photo');
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    try {
      const amount = parseFloat(paymentAmount);
      
      // Record payment in dataService
      await dataService.recordPayment(selectedDebtor.id, amount);
      
      alert(`Payment of $${amount.toFixed(2)} recorded successfully`);
      
      // Reload debtors and refresh current debtor
      await loadDebtors();
      const updatedDebtor = (await dataService.getDebtors()).find(d => d.id === selectedDebtor.id);
      if (updatedDebtor) {
        setSelectedDebtor(updatedDebtor);
      }
      
      closePaymentModal();
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Failed to record payment');
    }
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    let date;
    if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }
    
    if (isNaN(date.getTime())) return 'Invalid';
    
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="debtors-screen">
        <div className="loading-state">Loading debtors...</div>
      </div>
    );
  }

  return (
    <div className="debtors-screen">
      <div className="debtors-grid">
        {debtors.length === 0 ? (
          <div className="empty-state">
            <p>No debtors found</p>
          </div>
        ) : (
          debtors.map((debtor) => (
            <div
              key={debtor.id}
              className="debtor-card"
              onClick={() => handleDebtorClick(debtor)}
            >
              <div className="debtor-name">{debtor.name}</div>
              <div className="debtor-balance">${(debtor.totalDebt || 0).toFixed(2)}</div>
            </div>
          ))
        )}
      </div>

      {/* Debtor Details Modal */}
      {selectedDebtor && (
        <div className="modal-overlay" onClick={closeDebtorModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedDebtor.name}</h2>
              <button className="close-btn" onClick={closeDebtorModal}>
                <X size={24} />
              </button>
            </div>

            <div className="debtor-summary">
              <div className="summary-item">
                <span>Total Debt:</span>
                <strong>${(selectedDebtor.totalDebt || 0).toFixed(2)}</strong>
              </div>
              <div className="summary-item">
                <span>Phone:</span>
                <strong>{selectedDebtor.phone || 'N/A'}</strong>
              </div>
              <div className="summary-item">
                <span>Due Date:</span>
                <strong>{selectedDebtor.repaymentDate ? new Date(selectedDebtor.repaymentDate).toLocaleDateString('en-GB') : 'N/A'}</strong>
              </div>
            </div>

            <button className="deposit-btn" onClick={openPaymentModal}>
              <DollarSign size={20} />
              Deposit
            </button>

            <div className="purchases-table-wrapper">
              <table className="purchases-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Date</th>
                    <th>Items</th>
                    <th>Qty</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {debtorPurchases.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{textAlign: 'center', padding: '20px'}}>
                        No purchases found
                      </td>
                    </tr>
                  ) : (
                    debtorPurchases.map((purchase, index) => (
                      <tr key={purchase.id}>
                        <td>{index + 1}</td>
                        <td>{formatDateTime(purchase.timestamp || purchase.createdAt)}</td>
                        <td>{purchase.items?.map(item => item.name).join(', ')}</td>
                        <td>{purchase.items?.map(item => item.quantity).join(', ')}</td>
                        <td>${(purchase.total_amount || purchase.total || 0).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="modal-overlay payment-modal" onClick={closePaymentModal}>
          <div className="modal-content payment-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Record Payment</h2>
              <button className="close-btn" onClick={closePaymentModal}>
                <X size={24} />
              </button>
            </div>

            <div className="payment-form">
              <div className="form-group">
                <label>Payment Amount:</label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Enter amount"
                />
              </div>

              <button className="camera-btn" onClick={handleTakePhoto}>
                <Camera size={20} />
                {paymentPhoto ? 'Retake Photo' : 'Take Receipt Photo'}
              </button>

              {paymentPhoto && (
                <div className="photo-preview">
                  <img src={paymentPhoto} alt="Receipt" />
                </div>
              )}

              <div className="payment-actions">
                <button className="cancel-btn" onClick={closePaymentModal}>
                  Cancel
                </button>
                <button className="confirm-btn" onClick={handleRecordPayment}>
                  Confirm Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Debtors;
