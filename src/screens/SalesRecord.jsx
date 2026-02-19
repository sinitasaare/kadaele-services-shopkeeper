import React, { useState, useEffect } from 'react';
import dataService from '../services/dataService';
import './SalesRecord.css';

function SalesRecord() {
  const [purchases, setPurchases] = useState([]);
  const [filteredPurchases, setFilteredPurchases] = useState([]);
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('today');
  const [selectedDate, setSelectedDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [appliedPaymentFilter, setAppliedPaymentFilter] = useState('all');
  const [appliedDateFilter, setAppliedDateFilter] = useState('today');
  const [appliedSelectedDate, setAppliedSelectedDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const [filtersChanged, setFiltersChanged] = useState(false);

  useEffect(() => {
    loadPurchases();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [purchases, appliedPaymentFilter, appliedDateFilter, appliedSelectedDate, appliedStartDate, appliedEndDate]);

  useEffect(() => {
    const changed =
      paymentFilter !== appliedPaymentFilter ||
      dateFilter !== appliedDateFilter ||
      selectedDate !== appliedSelectedDate ||
      startDate !== appliedStartDate ||
      endDate !== appliedEndDate;
    setFiltersChanged(changed);
  }, [paymentFilter, dateFilter, selectedDate, startDate, endDate, appliedPaymentFilter, appliedDateFilter, appliedSelectedDate, appliedStartDate, appliedEndDate]);

  const loadPurchases = async () => {
    const data = await dataService.getPurchases();
    setPurchases(data || []);
  };

  const applyFilters = () => {
    let filtered = purchases;

    if (appliedPaymentFilter !== 'all') {
      filtered = filtered.filter(p => p.payment_type === appliedPaymentFilter);
    }

    if (appliedDateFilter === 'today') {
      const today = new Date().toLocaleDateString();
      filtered = filtered.filter(p => {
        if (!(p.timestamp || p.createdAt)) return false;
        const purchaseDate = new Date(p.timestamp || p.createdAt).toLocaleDateString();
        return purchaseDate === today;
      });
    }

    if (appliedDateFilter === 'single' && appliedSelectedDate) {
      filtered = filtered.filter(p => {
        if (!(p.timestamp || p.createdAt)) return false;
        const purchaseDate = new Date(p.timestamp || p.createdAt).toLocaleDateString();
        const selected = new Date(appliedSelectedDate).toLocaleDateString();
        return purchaseDate === selected;
      });
    }

    if (appliedDateFilter === 'range' && appliedStartDate && appliedEndDate) {
      const start = new Date(appliedStartDate);
      const end = new Date(appliedEndDate);
      end.setHours(23, 59, 59, 999);

      filtered = filtered.filter(p => {
        if (!(p.timestamp || p.createdAt)) return false;
        const purchaseDate = new Date(p.timestamp || p.createdAt);
        return purchaseDate >= start && purchaseDate <= end;
      });
    }

    setFilteredPurchases(filtered);
  };

  const toggleFilters = () => {
    setShowFilters(prev => !prev);
  };

  const handleApplyFilters = () => {
    if (!filtersChanged) return;

    setAppliedPaymentFilter(paymentFilter);
    setAppliedDateFilter(dateFilter);
    setAppliedSelectedDate(selectedDate);
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setShowFilters(false);

    setSelectedDate('');
    setStartDate('');
    setEndDate('');
    setFiltersChanged(false);
  };

  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getTableTitle = () => {
    let paymentText = 'All Sales';
    if (appliedPaymentFilter === 'cash') paymentText = 'Cash Sales';
    if (appliedPaymentFilter === 'credit') paymentText = 'Credit Sales';

    if (appliedDateFilter === 'today') {
      return `${paymentText} Today`;
    }

    if (appliedDateFilter === 'single') {
      if (appliedSelectedDate) {
        const selectedDateObj = new Date(appliedSelectedDate);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        selectedDateObj.setHours(0, 0, 0, 0);

        if (selectedDateObj.getTime() === yesterday.getTime()) {
          return `${paymentText} Yesterday`;
        }

        const date = new Date(appliedSelectedDate).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        return `${paymentText} on ${date}`;
      }
      return `${paymentText} Today`;
    }

    if (appliedDateFilter === 'range' && appliedStartDate && appliedEndDate) {
      const start = new Date(appliedStartDate).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const end = new Date(appliedEndDate).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      return `${paymentText} from ${start} to ${end}`;
    }

    return `${paymentText} Today`;
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return { date: 'N/A', time: 'N/A' };

    let date;
    if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }

    if (isNaN(date.getTime())) return { date: 'Invalid', time: 'Invalid' };

    return {
      date: date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    };
  };

  const totalRecords = filteredPurchases.length;
  const grandTotal = filteredPurchases.reduce((sum, p) => sum + (parseFloat(p.total_amount) || 0), 0);

  return (
    <div className="sales-record">

      {/* ── Page header (sticky, mirrors old record-header pattern) ── */}
      <div className="record-header">
        <h2 className="screen-title">Sales Journal</h2>
      </div>

      {/* ── Filter panel ── */}
      {showFilters && (
        <div className="filters-section">
          <div className="filter-group">
            <label>Payment Type:</label>
            <div className="filter-buttons">
              <button
                className={paymentFilter === 'all' ? 'filter-btn active' : 'filter-btn'}
                onClick={() => setPaymentFilter('all')}
              >
                All Sales
              </button>
              <button
                className={paymentFilter === 'cash' ? 'filter-btn active' : 'filter-btn'}
                onClick={() => setPaymentFilter('cash')}
              >
                Cash Only
              </button>
              <button
                className={paymentFilter === 'credit' ? 'filter-btn active' : 'filter-btn'}
                onClick={() => setPaymentFilter('credit')}
              >
                Credit Only
              </button>
            </div>
          </div>

          <div className="filter-group">
            <label>Date Filter:</label>
            <div className="filter-buttons">
              <button
                className={dateFilter === 'today' ? 'filter-btn active' : 'filter-btn'}
                onClick={() => setDateFilter('today')}
              >
                Today
              </button>
              <button
                className={dateFilter === 'single' ? 'filter-btn active' : 'filter-btn'}
                onClick={() => setDateFilter('single')}
              >
                Single Date
              </button>
              <button
                className={dateFilter === 'range' ? 'filter-btn active' : 'filter-btn'}
                onClick={() => setDateFilter('range')}
              >
                Date Range
              </button>
            </div>
          </div>

          {dateFilter === 'single' && (
            <div className="filter-group">
              <label>Select Date:</label>
              <input
                type="date"
                value={selectedDate}
                max={getTodayDate()}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="date-input"
              />
            </div>
          )}

          {dateFilter === 'range' && (
            <div className="filter-group">
              <label>Date Range:</label>
              <div className="date-range-inputs">
                <div className="date-range-field">
                  <label className="date-range-label">From:</label>
                  <input
                    type="date"
                    value={startDate}
                    max={getTodayDate()}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="date-input"
                  />
                </div>
                <div className="date-range-field">
                  <label className="date-range-label">To:</label>
                  <input
                    type="date"
                    value={endDate}
                    max={getTodayDate()}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="date-input"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Filter toggle / apply button (mirrors old summary-btn feel) ── */}
      <button
        className="filter-toggle-btn"
        onClick={showFilters ? (filtersChanged ? handleApplyFilters : toggleFilters) : toggleFilters}
      >
        {showFilters ? (filtersChanged ? 'Apply Filter' : 'Close Filter') : 'Filter Sales ▾'}
      </button>

      {/* ── Sub-header: dynamic title (mirrors old sub-header pattern) ── */}
      <h3 className="table-title">{getTableTitle()}</h3>

      {/* ── Stats summary boxes ── */}
      <div className="stats-boxes">
        <div className="stat-box stat-box-blue">
          <div className="stat-label">Total Records</div>
          <div className="stat-value">{totalRecords}</div>
        </div>
        <div className="stat-box stat-box-green">
          <div className="stat-label">Grand Total</div>
          <div className="stat-value">${grandTotal.toFixed(2)}</div>
        </div>
      </div>

      {/* ── Sales table ── */}
      <div className="table-wrapper">
        <table className="sales-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Items</th>
              <th>Qty</th>
              <th>Total</th>
              <th>Pay Type</th>
              <th>Customer</th>
            </tr>
          </thead>
          <tbody>
            {filteredPurchases.length === 0 ? (
              <tr>
                <td colSpan="7" className="empty-cell">
                  No sales records found
                </td>
              </tr>
            ) : (
              filteredPurchases.map((purchase) => {
                const dateTime = formatDateTime(purchase.timestamp || purchase.createdAt);
                const amount = parseFloat(purchase.total_amount) || 0;
                const totalQty = purchase.items?.reduce(
                  (sum, item) => sum + (item.qty || item.quantity || 0), 0
                ) || 0;

                return (
                  <tr key={purchase.id}>
                    <td>{dateTime.date}</td>
                    <td>{dateTime.time}</td>
                    <td className="items-cell">
                      {purchase.items?.map(item =>
                        `${item.name} × ${item.qty || item.quantity || 0}`
                      ).join(', ') || 'N/A'}
                    </td>
                    <td>{totalQty}</td>
                    <td>${amount.toFixed(2)}</td>
                    <td>
                      <span className={`payment-badge payment-${purchase.payment_type}`}>
                        {purchase.payment_type?.toUpperCase() || 'N/A'}
                      </span>
                    </td>
                    <td>{purchase.customer_name || '—'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SalesRecord;
