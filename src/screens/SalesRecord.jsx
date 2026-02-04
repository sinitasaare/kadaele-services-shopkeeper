import React, { useState, useEffect } from 'react';
import { Search, Calendar, ChevronDown, ChevronUp, Edit, Trash2, XCircle, DollarSign, Eye } from 'lucide-react';
import { format } from 'date-fns';
import dataService from '../services/dataService';
import './SalesRecord.css';

function SalesRecord() {
  const [purchases, setPurchases] = useState([]);
  const [filteredPurchases, setFilteredPurchases] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [notification, setNotification] = useState(null);
  const [viewMode, setViewMode] = useState('today'); // 'today', 'byDate', 'cashByDate', 'creditByDate', 'summaryReport'
  const [selectedDate, setSelectedDate] = useState('');
  const [showSummaryDropdown, setShowSummaryDropdown] = useState(false);

  useEffect(() => {
    loadPurchases();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [purchases, searchTerm, startDate, endDate, viewMode, selectedDate]);

  const loadPurchases = async () => {
    const data = await dataService.getPurchases();
    setPurchases(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const applyFilters = () => {
    let filtered = [...purchases];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.items.some(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Date range or single date filter
    const targetDate = selectedDate ? new Date(selectedDate) : null;
    if (targetDate) {
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      filtered = filtered.filter(p => {
        const saleDate = new Date(p.date);
        return saleDate >= startOfDay && saleDate <= endOfDay;
      });
    } else if (viewMode === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      filtered = filtered.filter(p => {
        const saleDate = new Date(p.date);
        return saleDate >= today && saleDate < tomorrow;
      });
    }

    // Payment type filter based on view mode
    if (viewMode === 'cashByDate') {
      filtered = filtered.filter(p => p.paymentType === 'cash');
    } else if (viewMode === 'creditByDate') {
      filtered = filtered.filter(p => p.paymentType === 'credit');
    }

    setFilteredPurchases(filtered);
  };

  const canEdit = (purchase) => {
    const createdDate = new Date(purchase.createdAt);
    const now = new Date();
    const hoursDiff = (now - createdDate) / (1000 * 60 * 60);
    return hoursDiff <= 24;
  };

  const startEdit = (purchase) => {
    if (!canEdit(purchase)) {
      showNotification('Cannot edit this sale after 24 hours.', 'error');
      return;
    }
    setEditingId(purchase.id);
    setEditForm({
      customerName: purchase.customerName || '',
      customerPhone: purchase.customerPhone || '',
      items: [...purchase.items],
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async (purchaseId) => {
    try {
      const total = editForm.items.reduce((sum, item) => sum + item.subtotal, 0);
      await dataService.updatePurchase(purchaseId, {
        customerName: editForm.customerName,
        customerPhone: editForm.customerPhone,
        items: editForm.items,
        total,
      });
      showNotification('Sale updated successfully.', 'success');
      loadPurchases();
      setEditingId(null);
      setEditForm({});
    } catch (error) {
      showNotification(error.message || 'Failed to update sale.', 'error');
    }
  };

  const handleVoid = async (purchaseId) => {
    const reason = prompt('Please enter reason for voiding this sale:');
    if (reason) {
      try {
        await dataService.voidPurchase(purchaseId, reason);
        showNotification('Sale voided successfully.', 'success');
        loadPurchases();
      } catch (error) {
        showNotification('Failed to void sale.', 'error');
      }
    }
  };

  const handleRefund = async (purchaseId, total) => {
    const amount = prompt(`Enter refund amount (max: $${total.toFixed(2)}):`);
    if (amount) {
      const refundAmount = parseFloat(amount);
      if (isNaN(refundAmount) || refundAmount <= 0 || refundAmount > total) {
        showNotification('Invalid refund amount.', 'error');
        return;
      }
      const reason = prompt('Please enter reason for refund:');
      if (reason) {
        try {
          await dataService.refundPurchase(purchaseId, refundAmount, reason);
          showNotification('Refund processed successfully.', 'success');
          loadPurchases();
        } catch (error) {
          showNotification('Failed to process refund.', 'error');
        }
      }
    }
  };

  const updateItemQuantity = (index, quantity) => {
    const newItems = [...editForm.items];
    const qty = parseInt(quantity) || 0;
    if (qty > 0) {
      newItems[index].quantity = qty;
      newItems[index].subtotal = newItems[index].price * qty;
      setEditForm({ ...editForm, items: newItems });
    }
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <span className="badge badge-success">Active</span>;
      case 'voided':
        return <span className="badge badge-danger">Voided</span>;
      case 'refunded':
        return <span className="badge badge-warning">Refunded</span>;
      default:
        return <span className="badge badge-info">{status}</span>;
    }
  };

  const getSubHeader = () => {
    if (viewMode === 'today') {
      return 'Sales Today';
    } else if (viewMode === 'byDate') {
      return `Sales Record on ${selectedDate}`;
    } else if (viewMode === 'cashByDate') {
      return `Cash Sales on ${selectedDate}`;
    } else if (viewMode === 'creditByDate') {
      return `Credit Sales on ${selectedDate}`;
    } else if (viewMode === 'summaryReport') {
      return 'Sales Summary Report';
    }
    return '';
  };

  const handleSummaryClick = (mode, date = '') => {
    setViewMode(mode);
    setSelectedDate(date);
    setShowSummaryDropdown(false);
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setShowSummaryDropdown(false);
  };

  return (
    <div className="sales-record">
      <div className="record-header">
        <h2 className="screen-title">Sales Record</h2>
        <button
          className="btn btn-outline summary-btn"
          onClick={() => setShowSummaryDropdown(!showSummaryDropdown)}
        >
          Summary
          <ChevronDown size={16} />
        </button>
      </div>

      {showSummaryDropdown && (
        <div className="summary-dropdown card">
          <ul className="summary-menu">
            <li>
              <button
                className="summary-menu-item"
                onClick={() => handleSummaryClick('byDate')}
              >
                Sales by date
              </button>
            </li>
            <li>
              <button
                className="summary-menu-item"
                onClick={() => handleSummaryClick('cashByDate')}
              >
                Cash Sales by date
              </button>
            </li>
            <li>
              <button
                className="summary-menu-item"
                onClick={() => handleSummaryClick('creditByDate')}
              >
                Credit Sales by date
              </button>
            </li>
            <li>
              <button
                className="summary-menu-item"
                onClick={() => handleSummaryClick('summaryReport')}
              >
                Sales Summary Report
              </button>
            </li>
          </ul>
        </div>
      )}

      {notification && (
        <div className={`alert alert-${notification.type}`}>
          <span>{notification.message}</span>
        </div>
      )}

      <div className="sub-header">{getSubHeader()}</div>

      {viewMode === 'summaryReport' ? (
        <div className="summary-report card">
          <h3>Sales Summary Report</h3>
          <p>
            This report provides an overview of sales performance including total sales, cash vs credit breakdown, and top performing items.
          </p>
          <div className="summary-stats">
            <div className="summary-stat">
              <span className="summary-label">Total Sales</span>
              <span className="summary-value">
                ${filteredPurchases
                  .filter(p => p.status === 'active')
                  .reduce((sum, p) => sum + p.total, 0)
                  .toFixed(2)}
              </span>
            </div>
            <div className="summary-stat">
              <span className="summary-label">Cash Sales</span>
              <span className="summary-value">
                ${filteredPurchases
                  .filter(p => p.status === 'active' && p.paymentType === 'cash')
                  .reduce((sum, p) => sum + p.total, 0)
                  .toFixed(2)}
              </span>
            </div>
            <div className="summary-stat">
              <span className="summary-label">Credit Sales</span>
              <span className="summary-value">
                ${filteredPurchases
                  .filter(p => p.status === 'active' && p.paymentType === 'credit')
                  .reduce((sum, p) => sum + p.total, 0)
                  .toFixed(2)}
              </span>
            </div>
            <div className="summary-stat">
              <span className="summary-label">Transactions</span>
              <span className="summary-value">{filteredPurchases.length}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="sales-table-container">
          <table className="sales-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-cell">
                    No sales found
                  </td>
                </tr>
              ) : (
                filteredPurchases.map(purchase => (
                  <React.Fragment key={purchase.id}>
                    {purchase.items.map((item, index) => (
                      <tr key={`${purchase.id}-${index}`}>
                        <td>{format(new Date(purchase.date), 'MMM dd, yyyy')}</td>
                        <td>{format(new Date(purchase.date), 'HH:mm')}</td>
                        <td>{item.name}</td>
                        <td>{item.quantity}</td>
                        <td>${item.price.toFixed(2)}</td>
                        <td>${item.subtotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default SalesRecord;