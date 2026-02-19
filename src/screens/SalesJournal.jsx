import React, { useState, useEffect, useRef } from 'react';
import dataService from '../services/dataService';
import './SalesJournal.css';

function SalesJournal() {
  const [sales, setSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);

  const [paymentFilter, setPaymentFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('today');
  const [selectedDate, setSelectedDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [appliedPaymentFilter, setAppliedPaymentFilter] = useState('all');
  const [appliedDateFilter, setAppliedDateFilter] = useState('today');
  const [appliedSelectedDate, setAppliedSelectedDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');

  const [showFilters, setShowFilters] = useState(false);

  const stickyBarRef = useRef(null);
  const [theadTop, setTheadTop] = useState(0);

  useEffect(() => { loadSales(); }, []);
  useEffect(() => { applyFilters(); }, [sales, appliedPaymentFilter, appliedDateFilter, appliedSelectedDate, appliedStartDate, appliedEndDate]);

  // Measure the sticky bar height so thead sticks just below it
  useEffect(() => {
    const updateTheadTop = () => {
      if (stickyBarRef.current) {
        const rect = stickyBarRef.current.getBoundingClientRect();
        setTheadTop(rect.bottom);
      }
    };
    updateTheadTop();
    window.addEventListener('resize', updateTheadTop);
    return () => window.removeEventListener('resize', updateTheadTop);
  }, [showFilters, filteredSales]);

  // Also update when sticky bar content changes
  useEffect(() => {
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
      if (stickyBarRef.current) {
        const rect = stickyBarRef.current.getBoundingClientRect();
        setTheadTop(rect.bottom);
      }
    }) : null;
    if (observer && stickyBarRef.current) {
      observer.observe(stickyBarRef.current);
    }
    return () => { if (observer) observer.disconnect(); };
  }, [showFilters]);


  const loadSales = async () => {
    const data = await dataService.getSales();
    const sorted = (data || []).sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt || a.timestamp || 0);
      const dateB = new Date(b.date || b.createdAt || b.timestamp || 0);
      return dateB - dateA;
    });
    setSales(sorted);
  };

  const resolveSaleDate = (sale) => {
    const raw = sale.date || sale.timestamp || sale.createdAt;
    if (!raw) return null;
    if (raw && typeof raw === 'object' && raw.seconds) return new Date(raw.seconds * 1000);
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  };

  const toMidnight = (d) => { const c = new Date(d); c.setHours(0,0,0,0); return c; };

  const applyFilters = () => {
    let filtered = [...sales];
    if (appliedPaymentFilter !== 'all') filtered = filtered.filter(s => s.payment_type === appliedPaymentFilter);
    const today = toMidnight(new Date());
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    if (appliedDateFilter === 'today') {
      filtered = filtered.filter(s => { const d = resolveSaleDate(s); return d && d >= today && d < tomorrow; });
    }
    if (appliedDateFilter === 'single' && appliedSelectedDate) {
      const s = toMidnight(new Date(appliedSelectedDate)), e = new Date(s); e.setDate(e.getDate()+1);
      filtered = filtered.filter(sale => { const d = resolveSaleDate(sale); return d && d >= s && d < e; });
    }
    if (appliedDateFilter === 'range' && appliedStartDate && appliedEndDate) {
      const s = toMidnight(new Date(appliedStartDate)), e = new Date(toMidnight(new Date(appliedEndDate))); e.setDate(e.getDate()+1);
      filtered = filtered.filter(sale => { const d = resolveSaleDate(sale); return d && d >= s && d < e; });
    }
    setFilteredSales(filtered);
  };

  const isFilterComplete = () => {
    if (dateFilter === 'today') return true;
    if (dateFilter === 'single') return !!selectedDate;
    if (dateFilter === 'range') return !!(startDate && endDate);
    return false;
  };
  const hasChanged = () => paymentFilter !== appliedPaymentFilter || dateFilter !== appliedDateFilter || selectedDate !== appliedSelectedDate || startDate !== appliedStartDate || endDate !== appliedEndDate;
  const showApply = isFilterComplete() && hasChanged();

  const handleClose = () => {
    setPaymentFilter(appliedPaymentFilter); setDateFilter(appliedDateFilter);
    setSelectedDate(appliedSelectedDate); setStartDate(appliedStartDate); setEndDate(appliedEndDate);
    setShowFilters(false);
  };
  const handleApply = () => {
    setAppliedPaymentFilter(paymentFilter); setAppliedDateFilter(dateFilter);
    setAppliedSelectedDate(selectedDate); setAppliedStartDate(startDate); setAppliedEndDate(endDate);
    setShowFilters(false);
  };
  const handleFilterButtonClick = () => {
    if (!showFilters) setShowFilters(true);
    else if (showApply) handleApply();
    else handleClose();
  };

  const getTodayStr = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`; };
  const formatDisplayDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' });
  const isYesterday = (dateStr) => {
    if (!dateStr) return false;
    const y = new Date(); y.setDate(y.getDate()-1);
    return toMidnight(new Date(dateStr)).getTime() === toMidnight(y).getTime();
  };

  const getTableTitle = () => {
    const payMap = { all: 'All Sales', cash: 'Cash Sales', credit: 'Credit Sales' };
    const label = payMap[appliedPaymentFilter] || 'All Sales';
    if (appliedDateFilter === 'today') return `${label} Today`;
    if (appliedDateFilter === 'single' && appliedSelectedDate) {
      if (isYesterday(appliedSelectedDate)) return `${label} Yesterday`;
      return `${label} on ${formatDisplayDate(appliedSelectedDate)}`;
    }
    if (appliedDateFilter === 'range' && appliedStartDate && appliedEndDate)
      return `${label} from ${formatDisplayDate(appliedStartDate)} to ${formatDisplayDate(appliedEndDate)}`;
    return `${label} Today`;
  };

  const formatDateTime = (sale) => {
    const d = resolveSaleDate(sale);
    if (!d) return { date: 'N/A', time: 'N/A' };
    return {
      date: d.toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true }),
    };
  };

  const getItemQty        = (item) => item.quantity ?? item.qty ?? 0;
  const getItemName       = (item) => item.name || '—';
  const getSaleTotal      = (sale) => parseFloat(sale.total_amount ?? sale.total ?? 0);
  const getSalePayType    = (sale) => sale.payment_type || sale.paymentType || '';
  const getSaleCustomer   = (sale) => sale.customer_name || sale.customerName || '';

  const totalRecords = filteredSales.length;
  const grandTotal   = filteredSales.reduce((sum, s) => sum + getSaleTotal(s), 0);
  const btnLabel     = !showFilters ? 'Filter Sales' : showApply ? 'Apply Filter' : 'Close Filter';

  // Shared content: button + title + cards — always sticky
  const TopControls = () => (
    <div className="sj-sticky-bar" ref={stickyBarRef}>
      <div className="filter-btn-wrapper">
        <button className="sales-filter-action-btn" onClick={handleFilterButtonClick}>{btnLabel}</button>
      </div>
      <h3 className="table-title">{getTableTitle()}</h3>
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
    </div>
  );

  return (
    <div className="sales-record" style={{ '--sj-thead-top': `${theadTop}px` }}>

      {/* Top controls: always sticky */}
      <TopControls />

      {/* Filter panel — only visible when open, below the sticky bar */}
      {showFilters && (
        <div className="filters-section">
          <div className="filter-group">
            <label>Payment Type</label>
            <div className="filter-buttons">
              {[['all','All Sales'],['cash','Cash Only'],['credit','Credit Only']].map(([val,lbl]) => (
                <button key={val} className={`filter-btn${paymentFilter===val?' active':''}`} onClick={() => setPaymentFilter(val)}>{lbl}</button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <label>Date Filter</label>
            <div className="filter-buttons">
              {[['today','Today'],['single','Single Date'],['range','Date Range']].map(([val,lbl]) => (
                <button key={val} className={`filter-btn${dateFilter===val?' active':''}`}
                  onClick={() => { setDateFilter(val); setSelectedDate(''); setStartDate(''); setEndDate(''); }}>{lbl}</button>
              ))}
            </div>
          </div>
          {dateFilter === 'single' && (
            <div className="filter-group">
              <label>Select Date</label>
              <input type="date" value={selectedDate} max={getTodayStr()} onChange={e => setSelectedDate(e.target.value)} className="date-input" />
            </div>
          )}
          {dateFilter === 'range' && (
            <div className="filter-group">
              <label>Date Range</label>
              <div className="date-range-inputs">
                <div className="date-range-field">
                  <label className="date-range-label">From:</label>
                  <input type="date" value={startDate} max={getTodayStr()}
                    onChange={e => { setStartDate(e.target.value); if (endDate && endDate < e.target.value) setEndDate(''); }}
                    className="date-input" />
                </div>
                <div className="date-range-field">
                  <label className="date-range-label">To:</label>
                  <input type="date" value={endDate} min={startDate||undefined} max={getTodayStr()}
                    disabled={!startDate} onChange={e => setEndDate(e.target.value)}
                    className={`date-input${!startDate?' date-input-disabled':''}`} />
                </div>
              </div>
              {!startDate && <span className="date-range-hint">Select a "From" date first</span>}
            </div>
          )}
        </div>
      )}

      {/* Sales table */}
      <div className="table-wrapper">
        <table className="sales-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Items</th>
              <th className="col-qty">Qty</th>
              <th>Total</th>
              <th>Pay Type</th>
              <th>Customer</th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.length === 0 ? (
              <tr><td colSpan="7" className="empty-cell">No sales records found</td></tr>
            ) : (
              filteredSales.map(sale => {
                const { date, time } = formatDateTime(sale);
                const total    = getSaleTotal(sale);
                const payType  = getSalePayType(sale);
                const customer = getSaleCustomer(sale);
                const items    = sale.items && sale.items.length > 0 ? sale.items : [null];
                const rowSpan  = items.length;

                return items.map((item, idx) => (
                  <tr key={`${sale.id}-${idx}`} className={idx > 0 ? 'sale-continuation-row' : 'sale-first-row'}>

                    {/* DATE — rowSpan merges all item rows into one cell */}
                    {idx === 0 && <td rowSpan={rowSpan} className="merged-cell">{date}</td>}

                    {/* TIME — merged */}
                    {idx === 0 && <td rowSpan={rowSpan} className="merged-cell">{time}</td>}

                    {/* ITEMS — one per row */}
                    <td className="items-cell">{item ? getItemName(item) : 'N/A'}</td>

                    {/* QTY — one per row */}
                    <td className="col-qty">{item ? getItemQty(item) : '—'}</td>

                    {/* TOTAL — one per row */}
                    <td>${total.toFixed(2)}</td>

                    {/* PAY TYPE — merged */}
                    {idx === 0 && (
                      <td rowSpan={rowSpan} className="merged-cell">
                        <span className={`payment-badge payment-${payType}`}>
                          {payType ? payType.toUpperCase() : 'N/A'}
                        </span>
                      </td>
                    )}

                    {/* CUSTOMER — merged */}
                    {idx === 0 && <td rowSpan={rowSpan} className="merged-cell">{customer || '—'}</td>}
                  </tr>
                ));
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SalesJournal;
