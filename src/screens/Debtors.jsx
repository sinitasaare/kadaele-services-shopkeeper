import React, { useState, useEffect } from 'react';
import { Search, DollarSign, Phone, User, ChevronDown, ChevronUp, CheckCircle, AlertCircle, Download, Share2 } from 'lucide-react';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import dataService from '../services/dataService';
import './Debtors.css';

function Debtors() {
  const [debtors, setDebtors] = useState([]);
  const [filteredDebtors, setFilteredDebtors] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [paymentModal, setPaymentModal] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedPurchases, setSelectedPurchases] = useState([]);
  const [notification, setNotification] = useState(null);
  const [creditNoteModal, setCreditNoteModal] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [debtors, searchTerm]);

  const loadData = async () => {
    const debtorsData = await dataService.getDebtors();
    const purchasesData = await dataService.getPurchases();
    setDebtors(debtorsData.sort((a, b) => b.balance - a.balance));
    setPurchases(purchasesData);
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const applyFilters = () => {
    let filtered = [...debtors];

    if (searchTerm) {
      filtered = filtered.filter(d =>
        d.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.customerPhone.includes(searchTerm)
      );
    }

    setFilteredDebtors(filtered);
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getDebtorPurchases = (debtor) => {
    return purchases.filter(p => debtor.purchaseIds.includes(p.id));
  };

  const openPaymentModal = (debtor) => {
    setPaymentModal(debtor);
    setPaymentAmount('');
    setSelectedPurchases([]);
  };

  const closePaymentModal = () => {
    setPaymentModal(null);
    setPaymentAmount('');
    setSelectedPurchases([]);
  };

  const handleRecordPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      showNotification('Please enter a valid payment amount.', 'error');
      return;
    }

    if (amount > paymentModal.balance) {
      showNotification('Payment amount cannot exceed the balance.', 'error');
      return;
    }

    try {
      await dataService.recordPayment(paymentModal.id, amount, selectedPurchases);
      showNotification(`Payment of $${amount.toFixed(2)} recorded successfully.`, 'success');
      loadData();
      closePaymentModal();
    } catch (error) {
      showNotification('Failed to record payment.', 'error');
    }
  };

  const togglePurchaseSelection = (purchaseId) => {
    setSelectedPurchases(prev =>
      prev.includes(purchaseId)
        ? prev.filter(id => id !== purchaseId)
        : [...prev, purchaseId]
    );
  };

  const getTotalDebt = () => {
    return filteredDebtors.reduce((sum, d) => sum + d.balance, 0);
  };

  const getOverdueCount = () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return filteredDebtors.filter(d => {
      const lastPurchase = new Date(d.lastPurchase);
      return lastPurchase < thirtyDaysAgo && d.balance > 0;
    }).length;
  };

  const openCreditNoteModal = (debtor, purchase) => {
    setCreditNoteModal({ debtor, purchase });
  };

  const closeCreditNoteModal = () => {
    setCreditNoteModal(null);
  };

  const generateCreditNote = async () => {
    const noteElement = document.getElementById('credit-note-card');
    if (!noteElement) return;

    try {
      const canvas = await html2canvas(noteElement, {
        backgroundColor: '#ffffff',
        scale: 2,
      });

      const dataUrl = canvas.toDataURL('image/png');

      if (Capacitor.isNativePlatform()) {
        // On mobile, use Capacitor Share
        await Share.share({
          title: `Credit Note - ${creditNoteModal.debtor.customerName}`,
          text: `Credit Sale No: ${creditNoteModal.purchase.id.slice(-8)}`,
          url: dataUrl,
          dialogTitle: 'Share Credit Note',
        });
      } else {
        // On web, download the image
        const link = document.createElement('a');
        link.download = `credit-note-${creditNoteModal.purchase.id}.png`;
        link.href = dataUrl;
        link.click();
      }

      showNotification('Credit note generated successfully.', 'success');
    } catch (error) {
      console.error('Error generating credit note:', error);
      showNotification('Failed to generate credit note.', 'error');
    }
  };

  return (
    <div className="debtors">
      <div className="debtors-header">
        <h2 className="screen-title">Debtors</h2>
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            className="input-field"
            placeholder="Search by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {notification && (
        <div className={`alert alert-${notification.type}`}>
          <span>{notification.message}</span>
        </div>
      )}

      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-icon" style={{ backgroundColor: '#fee2e2' }}>
            <DollarSign size={24} color="#991b1b" />
          </div>
          <div className="summary-content">
            <p className="summary-label">Total Outstanding</p>
            <p className="summary-value">${getTotalDebt().toFixed(2)}</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon" style={{ backgroundColor: '#fef3c7' }}>
            <AlertCircle size={24} color="#92400e" />
          </div>
          <div className="summary-content">
            <p className="summary-label">Overdue Accounts</p>
            <p className="summary-value">{getOverdueCount()}</p>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon" style={{ backgroundColor: '#dbeafe' }}>
            <User size={24} color="#1e40af" />
          </div>
          <div className="summary-content">
            <p className="summary-label">Active Debtors</p>
            <p className="summary-value">{filteredDebtors.length}</p>
          </div>
        </div>
      </div>

      {filteredDebtors.length === 0 ? (
        <div className="card empty-state">
          <Users size={64} />
          <h3>No debtors found</h3>
          <p>Credit customers will appear here when you make credit sales.</p>
        </div>
      ) : (
        <div className="debtors-list">
          {filteredDebtors.map(debtor => (
            <div key={debtor.id} className="debtor-card card">
              <div className="debtor-header" onClick={() => toggleExpand(debtor.id)}>
                <div className="debtor-info">
                  <h3 className="debtor-name">{debtor.customerName}</h3>
                  <div className="debtor-contact">
                    <Phone size={14} />
                    <span>{debtor.customerPhone}</span>
                  </div>
                </div>
                <div className="debtor-stats">
                  <div className="stat">
                    <span className="stat-label">Due:</span>
                    <span className="stat-value due">${debtor.totalDue.toFixed(2)}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Paid:</span>
                    <span className="stat-value paid">${debtor.totalPaid.toFixed(2)}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Balance:</span>
                    <span className="stat-value balance">${debtor.balance.toFixed(2)}</span>
                  </div>
                </div>
                <button className="expand-btn">
                  {expandedId === debtor.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
              </div>

              {expandedId === debtor.id && (
                <div className="debtor-details">
                  <div className="details-header">
                    <h4>Credit Sales History</h4>
                    <button className="btn btn-primary" onClick={() => openPaymentModal(debtor)}>
                      <DollarSign size={18} />
                      Record Payment
                    </button>
                  </div>

                  <div className="purchases-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Items</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getDebtorPurchases(debtor).map(purchase => (
                          <tr key={purchase.id}>
                            <td>{format(new Date(purchase.date), 'MMM dd, yyyy')}</td>
                            <td>
                              <div className="items-summary">
                                {purchase.items.slice(0, 2).map((item, i) => (
                                  <span key={i}>{item.name}</span>
                                ))}
                                {purchase.items.length > 2 && (
                                  <span className="more-items">+{purchase.items.length - 2} more</span>
                                )}
                              </div>
                            </td>
                            <td className="amount">${purchase.total.toFixed(2)}</td>
                            <td>
                              {purchase.paid ? (
                                <span className="badge badge-success">Paid</span>
                              ) : (
                                <span className="badge badge-warning">Unpaid</span>
                              )}
                            </td>
                            <td>
                              <button
                                className="btn-icon"
                                onClick={() => openCreditNoteModal(debtor, purchase)}
                                title="Generate Credit Note"
                              >
                                <Download size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {paymentModal && (
        <div className="modal-overlay" onClick={closePaymentModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Record Payment</h3>
              <button className="close-btn" onClick={closePaymentModal}>
                <span>&times;</span>
              </button>
            </div>

            <div className="modal-content">
              <div className="payment-info">
                <div className="info-row">
                  <span className="info-label">Customer:</span>
                  <span className="info-value">{paymentModal.customerName}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Total Balance:</span>
                  <span className="info-value balance">${paymentModal.balance.toFixed(2)}</span>
                </div>
              </div>

              <div className="form-group">
                <label>Payment Amount *</label>
                <input
                  type="number"
                  className="input-field"
                  placeholder="Enter amount"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  step="0.01"
                  min="0"
                  max={paymentModal.balance}
                />
              </div>

              <div className="form-group">
                <label>Mark Specific Sales as Paid (Optional)</label>
                <div className="purchases-checklist">
                  {getDebtorPurchases(paymentModal).map(purchase => (
                    <label key={purchase.id} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedPurchases.includes(purchase.id)}
                        onChange={() => togglePurchaseSelection(purchase.id)}
                      />
                      <span>
                        {format(new Date(purchase.date), 'MMM dd')} - ${purchase.total.toFixed(2)}
                        {purchase.items.length > 0 && ` (${purchase.items[0].name}${purchase.items.length > 1 ? '...' : ''})`}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closePaymentModal}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleRecordPayment}
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
              >
                <CheckCircle size={18} />
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {creditNoteModal && (
        <div className="modal-overlay" onClick={closeCreditNoteModal}>
          <div className="modal credit-note-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Credit Note</h3>
              <button className="close-btn" onClick={closeCreditNoteModal}>
                <span>&times;</span>
              </button>
            </div>

            <div className="modal-content">
              <div id="credit-note-card" className="credit-note-card">
                <div className="note-header">
                  <h2>Kadaele Shop</h2>
                  <p className="note-subtitle">Credit Sale Receipt</p>
                </div>

                <div className="note-divider"></div>

                <div className="note-details">
                  <div className="note-row">
                    <span className="note-label">Credit Sale No:</span>
                    <span className="note-value">#{creditNoteModal.purchase.id.slice(-8)}</span>
                  </div>
                  <div className="note-row">
                    <span className="note-label">Date:</span>
                    <span className="note-value">
                      {format(new Date(creditNoteModal.purchase.date), 'MMM dd, yyyy')}
                    </span>
                  </div>
                  <div className="note-row">
                    <span className="note-label">Customer:</span>
                    <span className="note-value">{creditNoteModal.debtor.customerName}</span>
                  </div>
                  <div className="note-row">
                    <span className="note-label">Phone:</span>
                    <span className="note-value">{creditNoteModal.debtor.customerPhone}</span>
                  </div>
                </div>

                <div className="note-divider"></div>

                <div className="note-items">
                  <h4>Items</h4>
                  {creditNoteModal.purchase.items.map((item, index) => (
                    <div key={index} className="note-item">
                      <span className="item-desc">
                        {item.quantity}x {item.name}
                      </span>
                      <span className="item-amount">${item.subtotal.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="note-divider"></div>

                <div className="note-total">
                  <span className="total-label">Total Amount</span>
                  <span className="total-value">${creditNoteModal.purchase.total.toFixed(2)}</span>
                </div>

                <div className="note-footer">
                  <p className="note-terms">Please pay within 7 days</p>
                  <p className="note-contact">Thank you for your business!</p>
                </div>
              </div>

              <div className="note-actions">
                <button className="btn btn-outline" onClick={generateCreditNote}>
                  <Download size={18} />
                  Save as Image
                </button>
                {Capacitor.isNativePlatform() && (
                  <button className="btn btn-primary" onClick={generateCreditNote}>
                    <Share2 size={18} />
                    Share
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Placeholder icon
function Users({ size }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export default Debtors;
