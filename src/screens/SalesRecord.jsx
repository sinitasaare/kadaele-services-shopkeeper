import React, { useState, useEffect } from 'react';
import dataService from '../services/dataService';
import './SalesRecord.css';

function SalesRecord() {
  const [purchases, setPurchases] = useState([]);
  const [filteredPurchases, setFilteredPurchases] = useState([]);

  // ── Pending (in-panel) filter state ──
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('today');
  const [selectedDate, setSelectedDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // ── Applied (committed) filter state ──
  const [appliedPaymentFilter, setAppliedPaymentFilter] = useState('all');
  const [appliedDateFilter, setAppliedDateFilter] = useState('today');
  const [appliedSelectedDate, setAppliedSelectedDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');

  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => { loadPurchases(); }, []);

  useEffect(() => {
    applyFilters();
  }, [purchases, appliedPaymentFilter, appliedDateFilter, appliedSelectedDate, appliedStartDate, appliedEndDate]);

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
        return new Date(p.timestamp || p.createdAt).toLocaleDateString() === today;
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
        const d = new Date(p.timestamp || p.createdAt);
        return d >= start && d <= end;
      });
    }

    setFilteredPurchases(filtered);
  };

  // ── Is the current pending filter fully filled? ──
  // "Today" is always complete. "Single Date" needs a date. "Range" needs both.
  const isFilterComplete = () => {
    if (dateFilter === 'today') return true;
    if (dateFilter === 'single') return !!selectedDate;
    if (dateFilter === 'range') return !!(startDate && endDate);
    return false;
  };

  // ── Has anything changed vs. applied? ──
  const hasChanged = () =>
    paymentFilter !== appliedPaymentFilter ||
    dateFilter !== appliedDateFilter ||
    selectedDate !== appliedSelectedDate ||
    startDate !== appliedStartDate ||
    endDate !== appliedEndDate;

  // Show "Apply Filter" label only when filter is complete AND something has changed
  const showApply = isFilterComplete() && hasChanged();

  const handleToggleOpen = () => {
    setShowFilters(true);
  };

  const handleClose = () => {
    // Revert pending selections back to last applied values
    setPaymentFilter(appliedPaymentFilter);
    setDateFilter(appliedDateFilter);
    setSelectedDate(appliedSelectedDate);
    setStartDate(appliedStartDate);
    setEndDate(appliedEndDate);
    setShowFilters(false);
  };

  const handleApply = () => {
    setAppliedPaymentFilter(paymentFilter);
    setAppliedDateFilter(dateFilter);
    setAppliedSelectedDate(selectedDate);
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setShowFilters(false);
  };

  const handleFilterButtonClick = () => {
    if (!showFilters) {
      handleToggleOpen();
    } else if (showApply) {
      handleApply();
    } else {
      handleClose();
    }
  };

  const getTodayDate = () => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  };

  const formatDisplayDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });

  // ── Table title (reflects APPLIED filters only) ──
  const getTableTitle = () => {
    const payMap = { all: 'All Sales', cash: 'Cash Sales', credit: 'Credit Sales' };
    const label = payMap[appliedPaymentFilter] || 'All Sales';

    if (appliedDateFilter === 'today') return `${label} Today`;

    if (appliedDateFilter === 'single' && appliedSelectedDate) {
      return `${label} on ${formatDisplayDate(appliedSelectedDate)}`;
    }

    if (appliedDateFilter === 'range' && appliedStartDate && appliedEndDate) {
      return `${label} from ${formatDisplayDate(appliedStartDate)} to ${formatDisplayDate(appliedEndDate)}`;
    }

    return `${label} Today`;
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

  const btnLabel = !showFilters
    ? 'Filter Sales'
    : showApply
      ? 'Apply Filter'
      : 'Close Filter';

  return (
    <div className="sales-record">

      {/* ── Sticky page header ── */}
      <div className="record-header">
        <h2 className="screen-title">Sales Journal</h2>
      </div>

      {/* ── Filter panel ── */}
      {showFilters && (
        <div className="filters-section">

          <div className="filter-group">
            <label>Payment Type</label>
            <div className="filter-buttons">
              {[['all', 'All Sales'], ['cash', 'Cash Only'], ['credit', 'Credit Only']].map(([val, lbl]) => (
                <button
                  key={val}
                  className={`filter-btn${paymentFilter === val ? ' active' : ''}`}
                  onClick={() => setPaymentFilter(val)}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <label>Date Filter</label>
            <div className="filter-buttons">
              {[['today', 'Today'], ['single', 'Single Date'], ['range', 'Date Range']].map(([val, lbl]) => (
                <button
                  key={val}
                  className={`filter-btn${dateFilter === val ? ' active' : ''}`}
                  onClick={() => {
                    setDateFilter(val);
                    setSelectedDate('');
                    setStartDate('');
                    setEndDate('');
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {dateFilter === 'single' && (
            <div className="filter-group">
              <label>Select Date</label>
              <input
                type="date"
                value={selectedDate}
                max={getTodayDate()}
                onChange={e => setSelectedDate(e.target.value)}
                className="date-input"
              />
            </div>
          )}

          {dateFilter === 'range' && (
            <div className="filter-group">
              <label>Date Range</label>
              <div className="date-range-inputs">
                <div className="date-range-field">
                  <label className="date-range-label">From:</label>
                  <input
                    type="date"
                    value={startDate}
                    max={getTodayDate()}
                    onChange={e => setStartDate(e.target.value)}
                    className="date-input"
                  />
                </div>
                <div className="date-range-field">
                  <label className="date-range-label">To:</label>
                  <input
                    type="date"
                    value={endDate}
                    max={getTodayDate()}
                    onChange={e => setEndDate(e.target.value)}
                    className="date-input"
                  />
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── Action button: centered, Add-Debtor gradient style ── */}
      <div className="filter-btn-wrapper">
        <button className="sales-filter-action-btn" onClick={handleFilterButtonClick}>
          {btnLabel}
        </button>
      </div>

      {/* ── Dynamic purple table title ── */}
      <h3 className="table-title">{getTableTitle()}</h3>

      {/* ── Stats cards ── */}
      <div className="stats-boxes">
        <div className="stat-box stat-box-purple">
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
                <td colSpan="7" className="empty-cell">No sales records found</td>
              </tr>
            ) : (
              filteredPurchases.map(purchase => {
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
