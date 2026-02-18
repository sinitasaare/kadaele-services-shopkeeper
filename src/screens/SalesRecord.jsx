import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import './SalesRecord.css';

// Mock data service for demonstration
const mockDataService = {
  getPurchases: async () => {
    return [
      {
        id: '1',
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        items: [
          { id: '1', name: 'Rice (1kg)', price: 50, quantity: 2, subtotal: 100 },
          { id: '2', name: 'Sugar (1kg)', price: 80, quantity: 1, subtotal: 80 }
        ],
        total: 180,
        paymentType: 'cash',
        customerName: '',
        customerPhone: '',
        status: 'active'
      },
      {
        id: '2',
        date: new Date(Date.now() - 3600000).toISOString(),
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        items: [
          { id: '3', name: 'Cooking Oil (1L)', price: 120, quantity: 1, subtotal: 120 }
        ],
        total: 120,
        paymentType: 'credit',
        customerName: 'John Doe',
        customerPhone: '+1234567890',
        status: 'active'
      },
      {
        id: '3',
        date: new Date(Date.now() - 7200000).toISOString(),
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        items: [
          { id: '4', name: 'Bread', price: 30, quantity: 3, subtotal: 90 },
          { id: '5', name: 'Milk (1L)', price: 60, quantity: 2, subtotal: 120 }
        ],
        total: 210,
        paymentType: 'cash',
        customerName: '',
        customerPhone: '',
        status: 'active'
      }
    ];
  }
};

// Simple date formatting function
const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}, ${date.getFullYear()}`;
};

const formatTime = (dateStr) => {
  const date = new Date(dateStr);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

function SalesRecord() {
  const [purchases, setPurchases] = useState([]);
  const [filteredPurchases, setFilteredPurchases] = useState([]);
  const [viewMode, setViewMode] = useState('today');
  const [selectedDate, setSelectedDate] = useState('');
  const [showSummaryDropdown, setShowSummaryDropdown] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    loadPurchases();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [purchases, viewMode, selectedDate]);

  const loadPurchases = async () => {
    const data = await mockDataService.getPurchases();
    setPurchases(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const applyFilters = () => {
    let filtered = [...purchases];

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

    if (viewMode === 'cashByDate') {
      filtered = filtered.filter(p => p.paymentType === 'cash');
    } else if (viewMode === 'creditByDate') {
      filtered = filtered.filter(p => p.paymentType === 'credit');
    }

    setFilteredPurchases(filtered);
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

  const handleSummaryClick = (mode) => {
    setViewMode(mode);
    setShowSummaryDropdown(false);
  };

  return (
    <div className="sales-record">
      <div className="record-header">
        <h2 className="screen-title">Sales Record</h2>
        <button
          className="summary-btn"
          onClick={() => setShowSummaryDropdown(!showSummaryDropdown)}
        >
          Summary
          <ChevronDown size={16} />
        </button>
      </div>

      {showSummaryDropdown && (
        <div className="summary-dropdown">
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
        <div className={`alert ${notification.type === 'error' ? 'alert-error' : 'alert-success'}`}>
          <span>{notification.message}</span>
        </div>
      )}

      <div className="sub-header">{getSubHeader()}</div>

      {viewMode === 'summaryReport' ? (
        <div className="summary-report">
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
                        <td>{formatDate(purchase.date)}</td>
                        <td>{formatTime(purchase.date)}</td>
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
