import React, { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, Camera, Phone, Mail, MapPin, Edit2, MessageSquare } from 'lucide-react';
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
  
  // Notify modal state
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  
  // Add Debtor Modal states
  const [showAddDebtorModal, setShowAddDebtorModal] = useState(false);
  const [newDebtor, setNewDebtor] = useState({
    fullName: '',
    gender: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: ''
  });
  
  // Edit mode states
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedDebtor, setEditedDebtor] = useState(null);
  
  // View debtor details tab
  const [activeTab, setActiveTab] = useState('details'); // 'details' or 'history'

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
    setEditedDebtor({...debtor});
    setIsEditMode(false);
    setActiveTab('details');
    
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
    setIsEditMode(false);
    setEditedDebtor(null);
    setActiveTab('details');
  };
  
  // Add Debtor handlers
  const openAddDebtorModal = () => {
    setShowAddDebtorModal(true);
    setNewDebtor({
      fullName: '',
      gender: '',
      phone: '',
      whatsapp: '',
      email: '',
      address: ''
    });
  };
  
  const closeAddDebtorModal = () => {
    setShowAddDebtorModal(false);
    setNewDebtor({
      fullName: '',
      gender: '',
      phone: '',
      whatsapp: '',
      email: '',
      address: ''
    });
  };
  
  const handleAddDebtor = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!newDebtor.fullName || !newDebtor.gender || !newDebtor.phone) {
      alert('Please fill in all required fields: Full Name, Gender, and Phone');
      return;
    }
    
    if (!newDebtor.whatsapp && !newDebtor.email) {
      alert('Please provide at least WhatsApp or Email');
      return;
    }
    
    if (!newDebtor.address) {
      alert('Please provide an address');
      return;
    }
    
    try {
      // Create new debtor object
      const debtorData = {
        id: dataService.generateId(),
        customerName: newDebtor.fullName,
        name: newDebtor.fullName,
        phone: newDebtor.phone,
        customerPhone: newDebtor.phone,
        gender: newDebtor.gender,
        whatsapp: newDebtor.whatsapp,
        email: newDebtor.email,
        address: newDebtor.address,
        totalDue: 0,
        totalPaid: 0,
        balance: 0,
        purchaseIds: [],
        createdAt: new Date().toISOString(),
        lastPurchase: null
      };
      
      // Add to debtors list
      const currentDebtors = await dataService.getDebtors();
      currentDebtors.push(debtorData);
      await dataService.setDebtors(currentDebtors);
      
      alert('Debtor added successfully!');
      closeAddDebtorModal();
      await loadDebtors();
    } catch (error) {
      console.error('Error adding debtor:', error);
      alert('Failed to add debtor. Please try again.');
    }
  };
  
  // Edit debtor handlers
  const enableEditMode = () => {
    setIsEditMode(true);
  };
  
  const cancelEditMode = () => {
    setIsEditMode(false);
    setEditedDebtor({...selectedDebtor});
  };
  
  const saveDebtorEdits = async () => {
    // Validation
    if (!editedDebtor.name || !editedDebtor.gender || !editedDebtor.phone) {
      alert('Please fill in all required fields: Full Name, Gender, and Phone');
      return;
    }
    
    if (!editedDebtor.whatsapp && !editedDebtor.email) {
      alert('Please provide at least WhatsApp or Email');
      return;
    }
    
    if (!editedDebtor.address) {
      alert('Please provide an address');
      return;
    }
    
    try {
      const currentDebtors = await dataService.getDebtors();
      const index = currentDebtors.findIndex(d => d.id === editedDebtor.id);
      
      if (index !== -1) {
        currentDebtors[index] = {
          ...currentDebtors[index],
          name: editedDebtor.name,
          customerName: editedDebtor.name,
          phone: editedDebtor.phone,
          customerPhone: editedDebtor.phone,
          gender: editedDebtor.gender,
          whatsapp: editedDebtor.whatsapp,
          email: editedDebtor.email,
          address: editedDebtor.address
        };
        
        await dataService.setDebtors(currentDebtors);
        setSelectedDebtor(currentDebtors[index]);
        setIsEditMode(false);
        await loadDebtors();
        alert('Debtor updated successfully!');
      }
    } catch (error) {
      console.error('Error updating debtor:', error);
      alert('Failed to update debtor. Please try again.');
    }
  };

  const openPaymentModal = () => {
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentAmount('');
    setPaymentPhoto(null);
  };

  // Notify handlers
  const openNotifyModal = () => {
    setShowNotifyModal(true);
  };

  const closeNotifyModal = () => {
    setShowNotifyModal(false);
  };

  const handleNotify = (method) => {
    const debtor = selectedDebtor;
    const balance = debtor.balance || debtor.totalDue || 0;
    const message = `Hello ${debtor.name || debtor.customerName}, this is a reminder that you have an outstanding balance of $${balance.toFixed(2)} with Kadaele Services. Please make payment at your earliest convenience. Thank you!`;
    
    if (method === 'whatsapp') {
      const phone = debtor.whatsapp || debtor.phone || debtor.customerPhone;
      if (!phone) {
        alert('No WhatsApp number available for this debtor');
        return;
      }
      // Remove any non-numeric characters and format for WhatsApp
      const cleanPhone = phone.replace(/\D/g, '');
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
    } else if (method === 'email') {
      const email = debtor.email;
      if (!email) {
        alert('No email available for this debtor');
        return;
      }
      const subject = 'Payment Reminder - Kadaele Services';
      const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
      window.location.href = mailtoUrl;
    } else if (method === 'sms') {
      const phone = debtor.phone || debtor.customerPhone;
      if (!phone) {
        alert('No phone number available for this debtor');
        return;
      }
      const smsUrl = `sms:${phone}?body=${encodeURIComponent(message)}`;
      window.location.href = smsUrl;
    }
    
    closeNotifyModal();
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
      {/* Add Debtor Button */}
      <div className="debtors-header">
        <button className="add-debtor-btn" onClick={openAddDebtorModal}>
          + Add Debtor
        </button>
      </div>
      
      <div className="debtors-grid">
        {debtors.length === 0 ? (
          <div className="empty-state">
            <p>No debtors found</p>
            <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
              Click "Add Debtor" to register a new debtor
            </p>
          </div>
        ) : (
          debtors.map((debtor) => (
            <div
              key={debtor.id}
              className="debtor-card"
              onClick={() => handleDebtorClick(debtor)}
            >
              <div className="debtor-name">{debtor.name || debtor.customerName}</div>
              <div className="debtor-balance">${(debtor.totalDebt || 0).toFixed(2)}</div>
            </div>
          ))
        )}
      </div>

      {/* Debtor Details Modal */}
      {selectedDebtor && (
        <div className="modal-overlay" onClick={closeDebtorModal}>
          <div className="modal-content debtor-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedDebtor.name || selectedDebtor.customerName}</h2>
              <div className="header-actions">
                {!isEditMode && (
                  <button className="edit-btn" onClick={enableEditMode} title="Edit Details">
                    <Edit2 size={20} />
                  </button>
                )}
                <button className="close-btn" onClick={closeDebtorModal}>
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="tabs-nav">
              <button 
                className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`}
                onClick={() => setActiveTab('details')}
              >
                Details
              </button>
              <button 
                className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveTab('history')}
              >
                Debt History
              </button>
            </div>

            {/* Details Tab */}
            {activeTab === 'details' && (
              <div className="details-tab">
                {isEditMode ? (
                  <div className="edit-form">
                    <div className="form-group">
                      <label>Full Name: *</label>
                      <input
                        type="text"
                        value={editedDebtor?.name || ''}
                        onChange={(e) => setEditedDebtor({...editedDebtor, name: e.target.value})}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Gender: *</label>
                      <div className="gender-checkboxes">
                        <label className="checkbox-label">
                          <input
                            type="radio"
                            name="gender-edit"
                            checked={editedDebtor?.gender === 'Male'}
                            onChange={() => setEditedDebtor({...editedDebtor, gender: 'Male'})}
                          />
                          Male
                        </label>
                        <label className="checkbox-label">
                          <input
                            type="radio"
                            name="gender-edit"
                            checked={editedDebtor?.gender === 'Female'}
                            onChange={() => setEditedDebtor({...editedDebtor, gender: 'Female'})}
                          />
                          Female
                        </label>
                      </div>
                    </div>

                    <div className="form-group">
                      <label><Phone size={16} /> Phone: *</label>
                      <input
                        type="tel"
                        value={editedDebtor?.phone || ''}
                        onChange={(e) => setEditedDebtor({...editedDebtor, phone: e.target.value})}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label><Phone size={16} /> WhatsApp:</label>
                      <input
                        type="tel"
                        value={editedDebtor?.whatsapp || ''}
                        onChange={(e) => setEditedDebtor({...editedDebtor, whatsapp: e.target.value})}
                      />
                    </div>

                    <div className="form-group">
                      <label><Mail size={16} /> Email:</label>
                      <input
                        type="email"
                        value={editedDebtor?.email || ''}
                        onChange={(e) => setEditedDebtor({...editedDebtor, email: e.target.value})}
                      />
                    </div>

                    <div className="form-group">
                      <label><MapPin size={16} /> Address: *</label>
                      <textarea
                        value={editedDebtor?.address || ''}
                        onChange={(e) => setEditedDebtor({...editedDebtor, address: e.target.value})}
                        rows="3"
                        required
                      />
                    </div>

                    <div className="edit-actions">
                      <button className="cancel-btn-inline" onClick={cancelEditMode}>
                        Cancel
                      </button>
                      <button className="save-btn-inline" onClick={saveDebtorEdits}>
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="details-view">
                    <div className="detail-item detail-item-stacked">
                      <strong>Name:</strong>
                      <span>{selectedDebtor.name || selectedDebtor.customerName || 'N/A'}</span>
                    </div>
                    <div className="detail-item">
                      <strong>Gender:</strong>
                      <span>{selectedDebtor.gender || 'N/A'}</span>
                    </div>
                    <div className="detail-item">
                      <strong><Phone size={16} /> Phone:</strong>
                      <span>{selectedDebtor.phone || selectedDebtor.customerPhone || 'N/A'}</span>
                    </div>
                    <div className="detail-item detail-item-stacked">
                      <strong><Phone size={16} /> WhatsApp:</strong>
                      <span>{selectedDebtor.whatsapp || 'N/A'}</span>
                    </div>
                    <div className="detail-item detail-item-stacked">
                      <strong><Mail size={16} /> Email:</strong>
                      <span>{selectedDebtor.email || 'N/A'}</span>
                    </div>
                    <div className="detail-item">
                      <strong><MapPin size={16} /> Address:</strong>
                      <span>{selectedDebtor.address || 'N/A'}</span>
                    </div>
                    <div className="detail-item debt-summary">
                      <strong>Total Debt:</strong>
                      <span className="debt-amount">${(selectedDebtor.balance || selectedDebtor.totalDue || 0).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Debt History Tab */}
            {activeTab === 'history' && (
              <div className="history-tab">
                {!isEditMode && (
                  <div className="action-buttons-row">
                    <button className="notify-btn" onClick={openNotifyModal}>
                      <MessageSquare size={20} />
                      Notify
                    </button>
                    <button className="deposit-btn" onClick={openPaymentModal}>
                      <DollarSign size={20} />
                      Deposit
                    </button>
                  </div>
                )}

                <div className="debt-history-table-wrapper">
                  <table className="debt-history-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Qtt</th>
                        <th>Item</th>
                        <th>Price</th>
                        <th>Total</th>
                        <th>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {debtorPurchases.length === 0 ? (
                        <tr>
                          <td colSpan="7" style={{textAlign: 'center', padding: '20px', color: '#999'}}>
                            No purchase history
                          </td>
                        </tr>
                      ) : (
                        debtorPurchases.map((purchase) => {
                          const dateTime = formatDateTime(purchase.date || purchase.timestamp || purchase.createdAt);
                          const time = purchase.date || purchase.timestamp || purchase.createdAt 
                            ? new Date(purchase.date || purchase.timestamp || purchase.createdAt).toLocaleTimeString('en-US', { 
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                              })
                            : 'N/A';
                          
                          return purchase.items?.map((item, index) => (
                            <tr key={`${purchase.id}-${index}`}>
                              <td>{dateTime}</td>
                              <td>{time}</td>
                              <td>{item.quantity || 0}</td>
                              <td>{item.name || 'N/A'}</td>
                              <td>${(item.price || 0).toFixed(2)}</td>
                              <td>${(item.subtotal || (item.price * item.quantity) || 0).toFixed(2)}</td>
                              <td>${(purchase.total || purchase.total_amount || 0).toFixed(2)}</td>
                            </tr>
                          ));
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Debtor Modal */}
      {showAddDebtorModal && (
        <div className="modal-overlay" onClick={closeAddDebtorModal}>
          <div className="modal-content add-debtor-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Debtor</h2>
              <button className="close-btn" onClick={closeAddDebtorModal}>
                <X size={24} />
              </button>
            </div>

            <form className="add-debtor-form" onSubmit={handleAddDebtor}>
              <div className="form-group">
                <label>Full Name: *</label>
                <input
                  type="text"
                  value={newDebtor.fullName}
                  onChange={(e) => setNewDebtor({...newDebtor, fullName: e.target.value})}
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div className="form-group">
                <label>Gender: *</label>
                <div className="gender-checkboxes">
                  <label className="checkbox-label">
                    <input
                      type="radio"
                      name="gender"
                      checked={newDebtor.gender === 'Male'}
                      onChange={() => setNewDebtor({...newDebtor, gender: 'Male'})}
                      required
                    />
                    Male
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="radio"
                      name="gender"
                      checked={newDebtor.gender === 'Female'}
                      onChange={() => setNewDebtor({...newDebtor, gender: 'Female'})}
                      required
                    />
                    Female
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label><Phone size={16} /> Phone: *</label>
                <input
                  type="tel"
                  value={newDebtor.phone}
                  onChange={(e) => setNewDebtor({...newDebtor, phone: e.target.value})}
                  placeholder="Enter phone number"
                  required
                />
              </div>

              <div className="form-group">
                <label><Phone size={16} /> WhatsApp:</label>
                <input
                  type="tel"
                  value={newDebtor.whatsapp}
                  onChange={(e) => setNewDebtor({...newDebtor, whatsapp: e.target.value})}
                  placeholder="Enter WhatsApp number (optional)"
                />
              </div>

              <div className="form-group">
                <label><Mail size={16} /> Email:</label>
                <input
                  type="email"
                  value={newDebtor.email}
                  onChange={(e) => setNewDebtor({...newDebtor, email: e.target.value})}
                  placeholder="Enter email address (optional)"
                />
              </div>

              <div className="form-group">
                <label><MapPin size={16} /> Address: *</label>
                <textarea
                  value={newDebtor.address}
                  onChange={(e) => setNewDebtor({...newDebtor, address: e.target.value})}
                  placeholder="Enter address"
                  rows="3"
                  required
                />
              </div>

              <div className="form-note">
                <small>* Required fields | At least WhatsApp or Email required</small>
              </div>

              <div className="form-actions">
                <button type="button" className="cancel-btn-inline" onClick={closeAddDebtorModal}>
                  Cancel
                </button>
                <button type="submit" className="save-btn-inline">
                  Save
                </button>
              </div>
            </form>
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

      {/* Notify Modal */}
      {showNotifyModal && (
        <div className="modal-overlay notify-modal" onClick={closeNotifyModal}>
          <div className="modal-content notify-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Select Contact Method</h2>
              <button className="close-btn" onClick={closeNotifyModal}>
                <X size={24} />
              </button>
            </div>

            <div className="notify-options">
              <button className="notify-option-btn whatsapp-btn" onClick={() => handleNotify('whatsapp')}>
                <MessageSquare size={24} />
                <span>WhatsApp</span>
              </button>
              <button className="notify-option-btn email-btn" onClick={() => handleNotify('email')}>
                <Mail size={24} />
                <span>Email</span>
              </button>
              <button className="notify-option-btn sms-btn" onClick={() => handleNotify('sms')}>
                <Phone size={24} />
                <span>SMS</span>
              </button>
            </div>

            <div className="notify-preview">
              <p className="notify-preview-label">Message Preview:</p>
              <p className="notify-preview-text">
                Hello {selectedDebtor?.name || selectedDebtor?.customerName}, this is a reminder that you have an outstanding balance of ${(selectedDebtor?.balance || selectedDebtor?.totalDue || 0).toFixed(2)} with Kadaele Services. Please make payment at your earliest convenience. Thank you!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Debtors;
