import React, { useState, useEffect } from 'react';
import dataService from '../services/dataService';
import './SalesJournal.css';

function SalesJournal() {
  const [sales, setSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);

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

  useEffect(() => { loadSales(); }, []);

  useEffect(() => {
    applyFilters();
  }, [sales, appliedPaymentFilter, appliedDateFilter, appliedSelectedDate, appliedStartDate, appliedEndDate]);

  // ── Load from dataService (correct method: getSales) ──
  const loadSales = async () => {
    const data = await dataService.getSales();
    // Sort newest first
    const sorted = (data || []).sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt || a.timestamp || 0);
      const dateB = new Date(b.date || b.createdAt || b.timestamp || 0);
      return dateB - dateA;
    });
    setSales(sorted);
  };

  // ── Resolve the best timestamp from a sale record ──
  const resolveSaleDate = (sale) => {
    const raw = sale.date || sale.timestamp || sale.createdAt;
    if (!raw) return null;
    // Handle Firestore Timestamp object
    if (raw && typeof raw === 'object' && raw.seconds) {
      return new Date(raw.seconds * 1000);
    }
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  };

  // ── Strip a Date to midnight for day comparisons ──
  const toMidnight = (d) => {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
  };

  const applyFilters = () => {
    let filtered = [...sales];

    // Payment filter — use payment_type (canonical field set by dataService.addSale)
    if (appliedPaymentFilter !== 'all') {
      filtered = filtered.filter(s => s.payment_type === appliedPaymentFilter);
    }

    // Date filters
    const today = toMidnight(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (appliedDateFilter === 'today') {
      filtered = filtered.filter(s => {
        const d = resolveSaleDate(s);
        if (!d) return false;
        return d >= today && d < tomorrow;
      });
    }

    if (appliedDateFilter === 'single' && appliedSelectedDate) {
      const targetStart = toMidnight(new Date(appliedSelectedDate));
      const targetEnd = new Date(targetStart);
      targetEnd.setDate(targetEnd.getDate() + 1);
      filtered = filtered.filter(s => {
        const d = resolveSaleDate(s);
        if (!d) return false;
        return d >= targetStart && d < targetEnd;
      });
    }

    if (appliedDateFilter === 'range' && appliedStartDate && appliedEndDate) {
      const start = toMidnight(new Date(appliedStartDate));
      const end = new Date(toMidnight(new Date(appliedEndDate)));
      end.setDate(end.getDate() + 1); // inclusive end
      filtered = filtered.filter(s => {
        const d = resolveSaleDate(s);
        if (!d) return false;
        return d >= start && d < end;
      });
    }

    setFilteredSales(filtered);
  };

  // ── Is pending filter fully filled? ──
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

  const showApply = isFilterComplete() && hasChanged();

  const handleOpen = () => setShowFilters(true);

  const handleClose = () => {
    // Revert pending to applied
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
      handleOpen();
    } else if (showApply) {
      handleApply();
    } else {
      handleClose();
    }
  };

  // ── Date helpers ──
  const getTodayStr = () => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  };

  const formatDisplayDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });

  // ── Is the selected single date "yesterday"? ──
  const isYesterday = (dateStr) => {
    if (!dateStr) return false;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const selected = toMidnight(new Date(dateStr));
    return selected.getTime() === toMidnight(yesterday).getTime();
  };

  // ── Table title — reflects APPLIED filters ──
  const getTableTitle = () => {
    const payMap = { all: 'All Sales', cash: 'Cash Sales', credit: 'Credit Sales' };
    const label = payMap[appliedPaymentFilter] || 'All Sales';

    if (appliedDateFilter === 'today') return `${label} Today`;

    if (appliedDateFilter === 'single' && appliedSelectedDate) {
      if (isYesterday(appliedSelectedDate)) return `${label} Yesterday`;
      return `${label} on ${formatDisplayDate(appliedSelectedDate)}`;
    }

    if (appliedDateFilter === 'range' && appliedStartDate && appliedEndDate) {
      return `${label} from ${formatDisplayDate(appliedStartDate)} to ${formatDisplayDate(appliedEndDate)}`;
    }

    return `${label} Today`;
  };

  // ── Format a sale's date/time for display ──
  const formatDateTime = (sale) => {
    const d = resolveSaleDate(sale);
    if (!d) return { date: 'N/A', time: 'N/A' };
    return {
      date: d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    };
  };

  // ── Resolve item fields — handles both qty/quantity ──
  const getItemQty = (item) => item.quantity ?? item.qty ?? 0;
  const getItemName = (item) => item.name || '—';
  const getItemSubtotal = (item) => {
    if (item.subtotal != null) return parseFloat(item.subtotal);
    return parseFloat(item.price || 0) * getItemQty(item);
  };

  // ── Resolve sale total — handles both total/total_amount ──
  const getSaleTotal = (sale) => parseFloat(sale.total_amount ?? sale.total ?? 0);

  // ── Resolve payment type — handles both payment_type/paymentType ──
  const getSalePaymentType = (sale) => sale.payment_type || sale.paymentType || '';

  // ── Resolve customer name — handles both customer_name/customerName ──
  const getSaleCustomer = (sale) => sale.customer_name || sale.customerName || '';

  const totalRecords = filteredSales.length;
  const grandTotal = filteredSales.reduce((sum, s) => sum + getSaleTotal(s), 0);

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
                max={getTodayStr()}
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
                    max={getTodayStr()}
                    onChange={e => {
                      setStartDate(e.target.value);
                      // Reset To if it's now out of range
                      if (endDate && endDate < e.target.value) setEndDate('');
                    }}
                    className="date-input"
                  />
                </div>
                <div className="date-range-field">
                  <label className="date-range-label">To:</label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || undefined}   // only selectable from From-date onward
                    max={getTodayStr()}
                    disabled={!startDate}           // locked until From is chosen
                    onChange={e => setEndDate(e.target.value)}
                    className={`date-input${!startDate ? ' date-input-disabled' : ''}`}
                  />
                </div>
              </div>
              {!startDate && (
                <span className="date-range-hint">Select a "From" date first</span>
              )}
            </div>
          )}

        </div>
      )}

      {/* ── Action button — centered, 35% narrower than base, Add-Debtor style ── */}
      <div className="filter-btn-wrapper">
        <button className="sales-filter-action-btn" onClick={handleFilterButtonClick}>
          {btnLabel}
        </button>
      </div>

      {/* ── Dynamic purple table title — centered ── */}
      <h3 className="table-title">{getTableTitle()}</h3>

      {/* ── Stats cards: left / right float, 35% narrower ── */}
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
            {filteredSales.length === 0 ? (
              <tr>
                <td colSpan="7" className="empty-cell">No sales records found</td>
              </tr>
            ) : (
              filteredSales.map(sale => {
                const { date, time } = formatDateTime(sale);
                const total = getSaleTotal(sale);
                const payType = getSalePaymentType(sale);
                const customer = getSaleCustomer(sale);
                const items = sale.items || [];
                const totalQty = items.reduce((sum, item) => sum + getItemQty(item), 0);
                const itemsSummary = items.length > 0
                  ? items.map(item => `${getItemName(item)} × ${getItemQty(item)}`).join(', ')
                  : 'N/A';

                return (
                  <tr key={sale.id}>
                    <td>{date}</td>
                    <td>{time}</td>
                    <td className="items-cell">{itemsSummary}</td>
                    <td>{totalQty}</td>
                    <td>${total.toFixed(2)}</td>
                    <td>
                      <span className={`payment-badge payment-${payType}`}>
                        {payType ? payType.toUpperCase() : 'N/A'}
                      </span>
                    </td>
                    <td>{customer || '—'}</td>
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

export default SalesJournal;

