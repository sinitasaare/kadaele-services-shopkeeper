import React, { useState, useEffect, useRef } from 'react';
import { Edit2 } from 'lucide-react';
import dataService from '../services/dataService';
import { useCurrency } from '../hooks/useCurrency';
import PdfTableButton from '../components/PdfTableButton';
import './SalesRecord.css';

// ── Shared 30-minute edit window helper ──────────────────────────────────────
function isWithin30Mins(entry) {
  const ts = entry.createdAt || entry.date || entry.timestamp;
  if (!ts) return false;
  const created = new Date(ts);
  return (new Date() - created) / (1000 * 60) <= 30;
}

// ── Sale Edit Modal ────────────────────────────────────────────────────────
function SaleEditModal({ sale, onSave, onClose, onDeleted, fmt }) {
  const [paymentType, setPaymentType] = useState(sale.payment_type || sale.paymentType || 'cash');
  const [customerName, setCustomerName] = useState(sale.customer_name || sale.customerName || '');
  const [items, setItems] = useState((sale.items || []).map(i => ({ ...i })));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const updateItem = (idx, field, val) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  };

  const total = items.reduce((sum, it) => {
    const qty = parseFloat(it.quantity ?? it.qty ?? 0);
    const price = parseFloat(it.price ?? 0);
    return sum + qty * price;
  }, 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedItems = items.map(it => ({
        ...it,
        quantity: parseFloat(it.quantity ?? it.qty ?? 0),
        qty: parseFloat(it.quantity ?? it.qty ?? 0),
        subtotal: parseFloat(it.quantity ?? it.qty ?? 0) * parseFloat(it.price ?? 0),
      }));
      await dataService.updateSale(sale.id, {
        items: updatedItems,
        total_amount: total,
        total,
        payment_type: paymentType,
        paymentType,
        customer_name: customerName,
        customerName,
      });
      onSave();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this sale record? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await dataService.deleteSale(sale.id);
      onDeleted();
    } catch (e) { alert(e.message); }
    finally { setDeleting(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', overflowY:'auto' }}>
      <div style={{ background:'var(--surface)', color:'var(--text-primary)', borderRadius:'12px', padding:'20px', width:'100%', maxWidth:'420px', maxHeight:'90vh', overflowY:'auto' }}>
        <h3 style={{ margin:'0 0 16px', color:'#1a1a2e', fontSize:'16px' }}>✏️ Edit Sale</h3>

        <div style={{ marginBottom:'12px' }}>
          <label style={{ display:'block', fontWeight:600, fontSize:'13px', marginBottom:'4px' }}>Payment Type</label>
          <div style={{ display:'flex', gap:'8px' }}>
            {['cash','credit'].map(pt => (
              <button key={pt} onClick={() => setPaymentType(pt)} style={{
                flex:1, padding:'8px', borderRadius:'7px', border:'2px solid',
                borderColor: paymentType === pt ? '#667eea' : '#d1d5db',
                background: paymentType === pt ? '#eef2ff' : 'var(--surface)',
                fontWeight: paymentType === pt ? 700 : 400, cursor:'pointer', fontSize:'13px', textTransform:'uppercase',
              }}>{pt}</button>
            ))}
          </div>
        </div>

        {paymentType === 'credit' && (
          <div style={{ marginBottom:'12px' }}>
            <label style={{ display:'block', fontWeight:600, fontSize:'13px', marginBottom:'4px' }}>Customer Name</label>
            <input value={customerName} onChange={e => setCustomerName(e.target.value)}
              style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #d1d5db', borderRadius:'6px', fontSize:'14px', boxSizing:'border-box' }} />
          </div>
        )}

        <div style={{ marginBottom:'12px' }}>
          <label style={{ display:'block', fontWeight:600, fontSize:'13px', marginBottom:'6px' }}>Products</label>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px', minWidth:'280px' }}>
              <thead>
                <tr style={{ background:'#f3f4f6' }}>
                  <th style={{ padding:'6px 8px', textAlign:'left', fontWeight:600, fontSize:'11px', color:'#6b7280', textTransform:'uppercase' }}>Product Name</th>
                  <th style={{ padding:'6px 8px', textAlign:'center', fontWeight:600, fontSize:'11px', color:'#6b7280', textTransform:'uppercase', width:'60px' }}>Qty</th>
                  <th style={{ padding:'6px 8px', textAlign:'right', fontWeight:600, fontSize:'11px', color:'#6b7280', textTransform:'uppercase', width:'70px' }}>Selling Price</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx}>
                    <td style={{ padding:'4px 8px' }}>
                      <input value={it.name || ''} onChange={e => updateItem(idx, 'name', e.target.value)} placeholder="Item name"
                        style={{ width:'100%', padding:'5px 6px', border:'1.5px solid #d1d5db', borderRadius:'5px', fontSize:'13px', boxSizing:'border-box' }} />
                    </td>
                    <td style={{ padding:'4px 8px' }}>
                      <input type="number" value={it.quantity ?? it.qty ?? ''} onChange={e => updateItem(idx, 'quantity', e.target.value)} placeholder="0"
                        style={{ width:'100%', padding:'5px 6px', border:'1.5px solid #d1d5db', borderRadius:'5px', fontSize:'13px', textAlign:'center', boxSizing:'border-box' }} />
                    </td>
                    <td style={{ padding:'4px 8px' }}>
                      <input type="number" value={it.price ?? ''} onChange={e => updateItem(idx, 'price', e.target.value)} placeholder="0.00"
                        style={{ width:'100%', padding:'5px 6px', border:'1.5px solid #d1d5db', borderRadius:'5px', fontSize:'13px', textAlign:'right', boxSizing:'border-box' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ textAlign:'right', fontWeight:700, fontSize:'15px', marginBottom:'16px', color:'#667eea' }}>
          Total: {fmt(total)}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={onClose} style={{ flex:1, padding:'10px', borderRadius:'8px', border:'1.5px solid var(--border)', background:'var(--surface)', color:'var(--text-primary)', cursor:'pointer', fontWeight:600 }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ flex:1, padding:'10px', borderRadius:'8px', border:'none', background:'#667eea', color:'white', cursor:'pointer', fontWeight:700 }}>
              {saving ? 'Saving…' : 'Update Record'}
            </button>
          </div>
          <button onClick={handleDelete} disabled={deleting} style={{ width:'100%', padding:'10px', borderRadius:'8px', border:'none', background:'#fee2e2', color:'#dc2626', cursor:'pointer', fontWeight:700 }}>
            {deleting ? 'Deleting…' : 'Delete Record'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SalesRecord() {
  const { fmt } = useCurrency();
  const [sales, setSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [editSale, setEditSale] = useState(null);

  // Void / Refund modal state
  const [voidSale, setVoidSale] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [refundSale, setRefundSale] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [actionProcessing, setActionProcessing] = useState(false);

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

  // No refs needed — sticky bar is now outside the scroll container,
  // so thead sticks at top:0 naturally within .sj-scroll-body.

  // ── Data ──────────────────────────────────────────────────────────────────
  useEffect(() => { loadSales(); }, []);
  useEffect(() => { applyFilters(); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sales, appliedPaymentFilter, appliedDateFilter, appliedSelectedDate, appliedStartDate, appliedEndDate]);

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

  const toMidnight = (d) => { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; };

  const applyFilters = () => {
    let filtered = [...sales];
    if (appliedPaymentFilter !== 'all')
      filtered = filtered.filter(s =>
        s.payment_type === appliedPaymentFilter || s.paymentType === appliedPaymentFilter
      );
    const today    = toMidnight(new Date());
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    if (appliedDateFilter === 'today')
      filtered = filtered.filter(s => { const d = resolveSaleDate(s); return d && d >= today && d < tomorrow; });
    if (appliedDateFilter === 'single' && appliedSelectedDate) {
      const s = toMidnight(new Date(appliedSelectedDate)), e = new Date(s); e.setDate(e.getDate() + 1);
      filtered = filtered.filter(sale => { const d = resolveSaleDate(sale); return d && d >= s && d < e; });
    }
    if (appliedDateFilter === 'range' && appliedStartDate && appliedEndDate) {
      const s = toMidnight(new Date(appliedStartDate));
      const e = new Date(toMidnight(new Date(appliedEndDate))); e.setDate(e.getDate() + 1);
      filtered = filtered.filter(sale => { const d = resolveSaleDate(sale); return d && d >= s && d < e; });
    }
    setFilteredSales(filtered);
  };

  // ── Filter controls ───────────────────────────────────────────────────────
  const isFilterComplete = () => {
    if (dateFilter === 'today')  return true;
    if (dateFilter === 'single') return !!selectedDate;
    if (dateFilter === 'range')  return !!(startDate && endDate);
    return false;
  };
  const hasChanged = () =>
    paymentFilter !== appliedPaymentFilter || dateFilter !== appliedDateFilter ||
    selectedDate  !== appliedSelectedDate  || startDate  !== appliedStartDate  || endDate !== appliedEndDate;
  const showApply = isFilterComplete() && hasChanged();

  const handleClose = () => {
    setPaymentFilter(appliedPaymentFilter); setDateFilter(appliedDateFilter);
    setSelectedDate(appliedSelectedDate);  setStartDate(appliedStartDate); setEndDate(appliedEndDate);
    setShowFilters(false);
  };
  const handleApply = () => {
    setAppliedPaymentFilter(paymentFilter); setAppliedDateFilter(dateFilter);
    setAppliedSelectedDate(selectedDate);  setAppliedStartDate(startDate); setAppliedEndDate(endDate);
    setShowFilters(false);
  };
  const handleFilterButtonClick = () => {
    if (!showFilters)    setShowFilters(true);
    else if (showApply)  handleApply();
    else                 handleClose();
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getTodayStr = () => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  };
  const formatDisplayDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const isYesterday = (dateStr) => {
    if (!dateStr) return false;
    const y = new Date(); y.setDate(y.getDate() - 1);
    return toMidnight(new Date(dateStr)).getTime() === toMidnight(y).getTime();
  };

  const getTableTitle = () => {
    const payMap = { all: 'All Sales', cash: 'Cash Sales', credit: 'Credit Sales' };
    const label  = payMap[appliedPaymentFilter] || 'All Sales';
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
      date: d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      // Show FORGOTTEN instead of time for pre-system entries entered via Settings
      time: sale.isUnrecorded ? 'UNRECORDED' : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    };
  };

  const getItemQty      = (item) => item.quantity ?? item.qty ?? 0;
  const getItemName     = (item) => item.name || '—';
  const getSaleTotal    = (sale) => parseFloat(sale.total_amount ?? sale.total ?? 0);
  const getSalePayType  = (sale) => sale.payment_type || sale.paymentType || '';
  const getSaleCustomer = (sale) => sale.customer_name || sale.customerName || '';

  const totalRecords = filteredSales.length;
  const grandTotal   = filteredSales.reduce((sum, s) => sum + getSaleTotal(s), 0);
  const btnLabel     = !showFilters ? 'Filter Sales' : showApply ? 'Apply Filter' : 'Close Filter';

  const HEADERS = ['Date', 'Time', 'Product', 'Qty', 'Sale Total', 'Payment', 'Customer'];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="sales-record">

      {/* ── placeholder — filter panel moved inside sticky bar below ── */}
      {false && (
        <div className="filters-section">
          <div className="filter-group">
            <label>Payment Type</label>
            <div className="filter-buttons">
              {[['all', 'All Sales'], ['cash', 'Cash Only'], ['credit', 'Credit Only']].map(([val, lbl]) => (
                <button key={val} className={`filter-btn${paymentFilter === val ? ' active' : ''}`}
                  onClick={() => setPaymentFilter(val)}>{lbl}</button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <label>Date Filter</label>
            <div className="filter-buttons">
              {[['today', 'Today'], ['single', 'Single Date'], ['range', 'Date Range']].map(([val, lbl]) => (
                <button key={val} className={`filter-btn${dateFilter === val ? ' active' : ''}`}
                  onClick={() => { setDateFilter(val); setSelectedDate(''); setStartDate(''); setEndDate(''); }}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          {dateFilter === 'single' && (
            <div className="filter-group">
              <label>Select Date</label>
              <input type="date" value={selectedDate} max={getTodayStr()}
                onChange={e => setSelectedDate(e.target.value)} className="date-input" />
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
                  <input type="date" value={endDate} min={startDate || undefined} max={getTodayStr()}
                    disabled={!startDate} onChange={e => setEndDate(e.target.value)}
                    className={`date-input${!startDate ? ' date-input-disabled' : ''}`} />
                </div>
              </div>
              {!startDate && <span className="date-range-hint">Select a "From" date first</span>}
            </div>
          )}
        </div>
      )}

      {/* ── Sticky bar — contains filter panel, button, title and cards ── */}
      <div className="sj-sticky-bar">
        {/* Filter panel — inside sticky bar so it scrolls with the bar */}
        {showFilters && (
          <div className="filters-section">
            <div className="filter-group">
              <label>Payment Type</label>
              <div className="filter-buttons">
                {[['all', 'All Sales'], ['cash', 'Cash Only'], ['credit', 'Credit Only']].map(([val, lbl]) => (
                  <button key={val} className={`filter-btn${paymentFilter === val ? ' active' : ''}`}
                    onClick={() => setPaymentFilter(val)}>{lbl}</button>
                ))}
              </div>
            </div>
            <div className="filter-group">
              <label>Date Filter</label>
              <div className="filter-buttons">
                {[['today', 'Today'], ['single', 'Single Date'], ['range', 'Date Range']].map(([val, lbl]) => (
                  <button key={val} className={`filter-btn${dateFilter === val ? ' active' : ''}`}
                    onClick={() => { setDateFilter(val); setSelectedDate(''); setStartDate(''); setEndDate(''); }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            {dateFilter === 'single' && (
              <div className="filter-group">
                <label>Select Date</label>
                <input type="date" value={selectedDate} max={getTodayStr()}
                  onChange={e => setSelectedDate(e.target.value)} className="date-input" />
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
                    <input type="date" value={endDate} min={startDate || undefined} max={getTodayStr()}
                      disabled={!startDate} onChange={e => setEndDate(e.target.value)}
                      className={`date-input${!startDate ? ' date-input-disabled' : ''}`} />
                  </div>
                </div>
                {!startDate && <span className="date-range-hint">Select a "From" date first</span>}
              </div>
            )}
          </div>
        )}
        <div className="filter-btn-wrapper">
          <button
            className={`sales-filter-action-btn${!showFilters ? ' sfab-open' : showApply ? ' sfab-apply' : ' sfab-close'}`}
            onClick={handleFilterButtonClick}>{btnLabel}</button>
        </div>
        <h3 className="table-title">{getTableTitle()}</h3>
        <div className="stats-boxes">
          <div className="stat-box stat-box-purple">
            <div className="stat-label">Total Records</div>
            <div className="stat-value">{totalRecords}</div>
          </div>
          <div className="stat-box stat-box-green">
            <div className="stat-label">Grand Total</div>
            <div className="stat-value">{fmt(grandTotal)}</div>
          </div>
        </div>
      </div>

      {/* ── Scroll body — the ONLY scroll container; thead sticks at top:0 inside it ── */}
      <div className="sj-scroll-body">
        <div className="table-wrapper" style={{position:'relative'}}>
          <PdfTableButton
            title="Sales Journal"
            columns={[
              {header:'Date',key:'date'},{header:'Time',key:'time'},{header:'Product',key:'product'},
              {header:'Qty',key:'qty'},{header:'Sale Total',key:'total'},
              {header:'Payment',key:'payment'},{header:'Customer',key:'customer'}
            ]}
            rows={filteredSales.flatMap(sale => {
              const {date, time} = formatDateTime(sale);
              const total = getSaleTotal(sale); const payment = getSalePayType(sale); const customer = getSaleCustomer(sale);
              const items = sale.items && sale.items.length > 0 ? sale.items : [null];
              return items.map((item, idx) => ({
                date: idx===0 ? date:'', time: idx===0 ? time:'',
                product: item ? (item.name||'N/A') : 'N/A',
                qty: item ? String(item.quantity||item.qty||0) : '—',
                total: idx===0 ? fmt(total) : '',
                payment: idx===0 ? payment : '', customer: idx===0 ? customer : '',
              }));
            })}
            summary={[{label:'Grand Total', value: fmt(grandTotal)}, {label:'Total Records', value: String(totalRecords)}]}
          />
          <table className="sales-table">

            <thead className="sj-thead">
              <tr>
                {HEADERS.map((h, i) => (
                  <th key={i} className={h === 'Qty' ? 'col-qty' : ''}>{h}</th>
                ))}
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredSales.length === 0 ? (
                <tr><td colSpan="8" className="empty-cell">No sales records found</td></tr>
              ) : (
                filteredSales.map(sale => {
                  const { date, time } = formatDateTime(sale);
                  const total    = getSaleTotal(sale);
                  const payType  = getSalePayType(sale);
                  const customer = getSaleCustomer(sale);
                  const items    = sale.items && sale.items.length > 0 ? sale.items : [null];
                  const rowSpan  = items.length;
                  const isActive = !sale.status || sale.status === 'active';
                  const canEdit = isActive && isWithin30Mins(sale);

                  return items.map((item, idx) => (
                    <tr key={`${sale.id}-${idx}`} className={idx > 0 ? 'sale-continuation-row' : 'sale-first-row'}
                      style={{ opacity: !isActive ? 0.55 : 1 }}>
                      {idx === 0 && <td rowSpan={rowSpan} className="merged-cell">{date}</td>}
                      {idx === 0 && <td rowSpan={rowSpan} className="merged-cell">{time}</td>}
                      <td className="items-cell">{item ? getItemName(item) : 'N/A'}</td>
                      <td className="col-qty">{item ? getItemQty(item) : '—'}</td>
                      {idx === 0 && <td rowSpan={rowSpan} className="merged-cell">{fmt(total)}</td>}
                      {idx === 0 && (
                        <td rowSpan={rowSpan} className="merged-cell">
                          {sale.status === 'voided' ? (
                            <span style={{ fontSize:'11px', background:'#fee2e2', color:'#dc2626', padding:'2px 6px', borderRadius:'4px', fontWeight:700 }}>VOID</span>
                          ) : sale.status === 'refunded' ? (
                            <span style={{ fontSize:'11px', background:'#fef3c7', color:'#d97706', padding:'2px 6px', borderRadius:'4px', fontWeight:700 }}>REFUND</span>
                          ) : (
                            <span className={`payment-badge payment-${payType}`}>
                              {payType ? payType.toUpperCase() : 'N/A'}
                            </span>
                          )}
                        </td>
                      )}
                      {idx === 0 && <td rowSpan={rowSpan} className="merged-cell">{customer || '—'}</td>}
                      {idx === 0 && (
                        <td rowSpan={rowSpan} className="merged-cell" style={{ textAlign:'center' }}>
                          {canEdit ? (
                            <button
                              onClick={e => { e.stopPropagation(); setEditSale(sale); }}
                              style={{ background:'none', border:'none', cursor:'pointer', color:'#667eea', padding:'4px', borderRadius:'4px', display:'inline-flex', alignItems:'center' }}
                              title="Edit sale">
                              <Edit2 size={15} />
                            </button>
                          ) : null}
                        </td>
                      )}
                    </tr>
                  ));
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Void Sale Modal ── */}
      {voidSale && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ background:'var(--surface)', color:'var(--text-primary)', borderRadius:'12px', padding:'24px', width:'100%', maxWidth:'360px' }}>
            <h3 style={{ margin:'0 0 12px', color:'#dc2626' }}>⛔ Void Sale</h3>
            <p style={{ fontSize:'13px', color:'#6b7280', marginBottom:'12px' }}>
              Voiding a sale marks it as cancelled. Total: <strong>{fmt(getSaleTotal(voidSale))}</strong>
            </p>
            <div style={{ marginBottom:'16px' }}>
              <label style={{ display:'block', fontWeight:600, fontSize:'13px', marginBottom:'4px' }}>Reason for voiding *</label>
              <input
                type="text"
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                placeholder="e.g. Customer cancelled, wrong item…"
                style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #d1d5db', borderRadius:'6px', fontSize:'14px', boxSizing:'border-box' }}
              />
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={() => setVoidSale(null)}
                style={{ flex:1, padding:'10px', borderRadius:'8px', border:'1.5px solid var(--border)', background:'var(--surface)', color:'var(--text-primary)', cursor:'pointer', fontWeight:600 }}>
                Cancel
              </button>
              <button disabled={actionProcessing || !voidReason.trim()}
                onClick={async () => {
                  if (!voidReason.trim()) return;
                  setActionProcessing(true);
                  try {
                    await dataService.voidSale(voidSale.id, voidReason.trim());
                    setVoidSale(null);
                    const data = await dataService.getSales();
                    setSales((data||[]).sort((a,b) => new Date(b.date||b.createdAt||0) - new Date(a.date||a.createdAt||0)));
                  } catch(e) { alert('Failed to void sale: ' + e.message); }
                  finally { setActionProcessing(false); }
                }}
                style={{ flex:1, padding:'10px', borderRadius:'8px', border:'none', background:'#dc2626', color:'white', cursor:'pointer', fontWeight:700 }}>
                {actionProcessing ? '…' : 'Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Refund Sale Modal ── */}
      {refundSale && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ background:'var(--surface)', color:'var(--text-primary)', borderRadius:'12px', padding:'24px', width:'100%', maxWidth:'360px' }}>
            <h3 style={{ margin:'0 0 12px', color:'#d97706' }}>↩ Refund Sale</h3>
            <p style={{ fontSize:'13px', color:'#6b7280', marginBottom:'12px' }}>
              Sale Total: <strong>{fmt(getSaleTotal(refundSale))}</strong>
            </p>
            <div style={{ marginBottom:'12px' }}>
              <label style={{ display:'block', fontWeight:600, fontSize:'13px', marginBottom:'4px' }}>Refund Amount *</label>
              <input
                type="number"
                value={refundAmount}
                onChange={e => setRefundAmount(e.target.value)}
                min="0.01" step="0.01"
                style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #d1d5db', borderRadius:'6px', fontSize:'14px', boxSizing:'border-box' }}
              />
            </div>
            <div style={{ marginBottom:'16px' }}>
              <label style={{ display:'block', fontWeight:600, fontSize:'13px', marginBottom:'4px' }}>Reason *</label>
              <input
                type="text"
                value={refundReason}
                onChange={e => setRefundReason(e.target.value)}
                placeholder="e.g. Defective product, wrong size…"
                style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #d1d5db', borderRadius:'6px', fontSize:'14px', boxSizing:'border-box' }}
              />
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={() => setRefundSale(null)}
                style={{ flex:1, padding:'10px', borderRadius:'8px', border:'1.5px solid var(--border)', background:'var(--surface)', color:'var(--text-primary)', cursor:'pointer', fontWeight:600 }}>
                Cancel
              </button>
              <button disabled={actionProcessing || !refundReason.trim() || !refundAmount}
                onClick={async () => {
                  if (!refundReason.trim() || !refundAmount) return;
                  setActionProcessing(true);
                  try {
                    await dataService.refundSale(refundSale.id, parseFloat(refundAmount), refundReason.trim());
                    setRefundSale(null);
                    const data = await dataService.getSales();
                    setSales((data||[]).sort((a,b) => new Date(b.date||b.createdAt||0) - new Date(a.date||a.createdAt||0)));
                  } catch(e) { alert('Failed to refund sale: ' + e.message); }
                  finally { setActionProcessing(false); }
                }}
                style={{ flex:1, padding:'10px', borderRadius:'8px', border:'none', background:'#d97706', color:'white', cursor:'pointer', fontWeight:700 }}>
                {actionProcessing ? '…' : 'Confirm Refund'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Sale Modal (2-hour window) ── */}
      {editSale && (
        <SaleEditModal
          sale={editSale}
          fmt={fmt}
          onSave={async () => {
            setEditSale(null);
            const data = await dataService.getSales();
            setSales((data||[]).sort((a,b) => new Date(b.date||b.createdAt||0) - new Date(a.date||a.createdAt||0)));
          }}
          onDeleted={async () => {
            setEditSale(null);
            const data = await dataService.getSales();
            setSales((data||[]).sort((a,b) => new Date(b.date||b.createdAt||0) - new Date(a.date||a.createdAt||0)));
          }}
          onClose={() => setEditSale(null)}
        />
      )}

    </div>
  );
}

export default SalesRecord;
