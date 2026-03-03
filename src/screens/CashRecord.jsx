import React, { useEffect, useState, useCallback } from 'react';
import { X, Plus } from 'lucide-react';
import dataService from '../services/dataService';
import { useCurrency } from '../hooks/useCurrency';
import './CashRecord.css';

// ── Page indices for cross-screen navigation ──────────────────────────────────
const SALES_PAGE_INDEX    = 1;
const EXPENSES_PAGE_INDEX = 3;
const PURCHASE_PAGE_INDEX = 4;
const DEBTORS_PAGE_INDEX  = 6;

// ── Reason lists ──────────────────────────────────────────────────────────────
const IN_REASONS = [
  'Opening Float Added',
  'Owner Cash Injection',
  'Bank Withdrawal',
  'Safe/Box Transfer In',
  'Cash Advance Returned',
  'Correction: Cash Over',
  'Other',
];
const OUT_REASONS = [
  'Float Reduced',
  'Bank Deposit',
  'Safe/Box Transfer Out',
  'Owner Withdrawal',
  'Correction: Cash Short',
  'Other',
];

const PARTY_TYPES = [
  { value: 'owner',             label: 'Owner' },
  { value: 'staff',             label: 'Staff' },
  { value: 'bank',              label: 'Bank' },
  { value: 'customer_unlinked', label: 'Customer (Unlinked)' },
  { value: 'other',             label: 'Other' },
];

// ── Source badge helpers ──────────────────────────────────────────────────────
const SOURCE_META = {
  sale:         { label: 'Sale',         bg: '#d1fae5', color: '#065f46' },
  purchase:     { label: 'Purchase',     bg: '#fee2e2', color: '#991b1b' },
  expense:      { label: 'Expense',      bg: '#fef3c7', color: '#92400e' },
  debt_payment: { label: 'Debt Payment', bg: '#dbeafe', color: '#1e40af' },
  manual:       { label: 'Manual',       bg: '#ede9fe', color: '#5b21b6' },
  deposit:      { label: 'Deposit',      bg: '#dbeafe', color: '#1e40af' },
  void_sale:    { label: 'Void Sale',    bg: '#f3f4f6', color: '#374151' },
};

function SourceBadge({ source }) {
  const meta = SOURCE_META[source] || { label: source || 'Manual', bg: '#f3f4f6', color: '#374151' };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.03em',
      backgroundColor: meta.bg, color: meta.color, whiteSpace: 'nowrap',
    }}>
      {meta.label}
    </span>
  );
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function toMidnight(d) { const c = new Date(d); c.setHours(0,0,0,0); return c; }
function resolveEntryDate(e) {
  const raw = e.date || e.createdAt;
  if (!raw) return null;
  if (typeof raw === 'object' && raw.seconds) return new Date(raw.seconds * 1000);
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}
function isWithin30Mins(entry) {
  const ts = entry.createdAt || entry.date;
  if (!ts) return false;
  return (new Date() - new Date(ts)) / (1000 * 60) <= 30;
}

// ── ManualCashEntryModal ──────────────────────────────────────────────────────
function ManualCashEntryModal({ entry, onSaved, onDeleted, onClose }) {
  const isEdit = !!entry;

  // When editing, the combined note string is "Reason — UserNote"; split it back
  const parseNote = () => {
    if (!entry) return '';
    const raw = entry.note || '';
    if (entry.reason && raw.startsWith(entry.reason + ' — ')) return raw.slice((entry.reason + ' — ').length);
    return raw;
  };

  const [type,      setType]      = useState(entry?.type      || 'in');
  const [amount,    setAmount]    = useState(entry?.amount != null ? String(entry.amount) : '');
  const [partyType, setPartyType] = useState(entry?.partyType || 'owner');
  const [partyName, setPartyName] = useState(entry?.partyName || '');
  const [reason,    setReason]    = useState(entry?.reason    || '');
  const [note,      setNote]      = useState(parseNote);
  const [ref,       setRef]       = useState(entry?.ref       || '');
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [error,     setError]     = useState('');

  const reasons       = type === 'in' ? IN_REASONS : OUT_REASONS;
  const showPartyName = partyType !== 'owner' && partyType !== 'bank';

  const validate = () => {
    if (!amount || parseFloat(amount) <= 0) return 'Amount is required and must be greater than zero.';
    if (!reason) return 'Please select a reason.';
    if (reason === 'Other' && !note.trim()) return 'Note is required when reason is "Other".';
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        type,
        amount: parseFloat(amount),
        partyType,
        partyName: showPartyName ? partyName.trim() : '',
        reason,
        note: note.trim(),
        ref: ref.trim(),
      };
      if (isEdit) {
        await dataService.updateCashEntryManual(entry.id, payload);
      } else {
        await dataService.addCashEntryManual(payload);
      }
      onSaved();
    } catch (e) {
      setError(e.message || 'Failed to save. Please try again.');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this manual cash entry? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await dataService.deleteCashEntryManual(entry.id);
      onDeleted();
    } catch (e) {
      setError(e.message || 'Failed to delete.');
      setDeleting(false);
    }
  };

  return (
    <div className="cj-modal-overlay" onClick={onClose}>
      <div className="cj-modal-content" style={{ maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>

        <h3 className="cj-modal-title">
          {isEdit ? '✏️ Edit Manual Entry' : '➕ Manual Cash Entry'}
        </h3>

        {/* Type */}
        <div className="cj-modal-field">
          <label>Type</label>
          <div className="cj-modal-type-btns">
            {[['in','💵 Cash IN'],['out','💸 Cash OUT']].map(([val, lbl]) => (
              <button key={val} type="button"
                className={`cj-modal-type-btn${type === val ? (val==='in' ? ' active-in' : ' active-out') : ''}`}
                onClick={() => { setType(val); setReason(''); setError(''); }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div className="cj-modal-field">
          <label>Amount *</label>
          <input type="number" className="cj-modal-input" placeholder="0.00" min="0" step="0.01"
            value={amount} onChange={e => { setAmount(e.target.value); setError(''); }} />
        </div>

        {/* Party Type */}
        <div className="cj-modal-field">
          <label>Party Type</label>
          <select className="cj-modal-input" value={partyType} onChange={e => setPartyType(e.target.value)}>
            {PARTY_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {/* Party Name — only when not Owner or Bank */}
        {showPartyName && (
          <div className="cj-modal-field">
            <label>Party Name <span style={{fontWeight:400,color:'#9ca3af'}}>(optional)</span></label>
            <input type="text" className="cj-modal-input" placeholder="Name…"
              value={partyName} onChange={e => setPartyName(e.target.value)} />
          </div>
        )}

        {/* Reason */}
        <div className="cj-modal-field">
          <label>Reason *</label>
          <select className="cj-modal-input" value={reason}
            onChange={e => { setReason(e.target.value); setError(''); }}>
            <option value="">Select reason…</option>
            {reasons.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Note */}
        <div className="cj-modal-field">
          <label>Note {reason === 'Other' ? '*' : <span style={{fontWeight:400,color:'#9ca3af'}}>(optional)</span>}</label>
          <input type="text" className="cj-modal-input"
            placeholder={reason === 'Other' ? 'Required — describe the reason' : 'Additional details…'}
            value={note} onChange={e => { setNote(e.target.value); setError(''); }} />
        </div>

        {/* Ref */}
        <div className="cj-modal-field">
          <label>Reference <span style={{fontWeight:400,color:'#9ca3af'}}>(optional)</span></label>
          <input type="text" className="cj-modal-input" placeholder="Receipt / ref number"
            value={ref} onChange={e => setRef(e.target.value)} />
        </div>

        {error && (
          <div style={{
            background: '#fee2e2', color: '#991b1b', borderRadius: 6,
            padding: '8px 12px', fontSize: 13, marginBottom: 8,
          }}>
            {error}
          </div>
        )}

        <div className="cj-modal-buttons">
          <button className="cj-modal-cancel" onClick={onClose}>Cancel</button>
          <button className="cj-modal-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Update' : 'Save Entry'}
          </button>
        </div>

        {isEdit && (
          <button onClick={handleDelete} disabled={deleting} style={{
            width: '100%', marginTop: 10, padding: '10px', borderRadius: 8,
            border: 'none', background: '#fee2e2', color: '#dc2626',
            cursor: 'pointer', fontWeight: 700, fontSize: 14,
          }}>
            {deleting ? 'Deleting…' : '🗑 Delete Entry'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main CashRecord screen ────────────────────────────────────────────────────
export default function CashRecord({ onNavigate }) {
  const { fmt } = useCurrency();

  const [entries,      setEntries]      = useState([]);
  const [filtered,     setFiltered]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showFilters,  setShowFilters]  = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editEntry,    setEditEntry]    = useState(null);

  // Pending filter state
  const [typeFilter,   setTypeFilter]   = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [dateFilter,   setDateFilter]   = useState('today');
  const [selectedDate, setSelectedDate] = useState('');
  const [startDate,    setStartDate]    = useState('');
  const [endDate,      setEndDate]      = useState('');

  // Applied filter state
  const [appliedType,    setAppliedType]    = useState('all');
  const [appliedSource,  setAppliedSource]  = useState('all');
  const [appliedDate,    setAppliedDate]    = useState('today');
  const [appliedSelDate, setAppliedSelDate] = useState('');
  const [appliedStart,   setAppliedStart]   = useState('');
  const [appliedEnd,     setAppliedEnd]     = useState('');

  const load = useCallback(async () => {
    try {
      const data = await dataService.getCashEntries();
      const sorted = (data || []).sort((a, b) => {
        const da = resolveEntryDate(a) || new Date(0);
        const db_ = resolveEntryDate(b) || new Date(0);
        return db_ - da; // newest first
      });
      setEntries(sorted);
    } catch (e) {
      console.error('Error loading cash entries:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onVisibility = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [load]);

  // Re-filter whenever entries or applied filter values change
  useEffect(() => {
    let f = [...entries];

    if (appliedType !== 'all') f = f.filter(e => e.type === appliedType);
    if (appliedSource !== 'all') f = f.filter(e => (e.source || 'manual') === appliedSource);

    const today    = toMidnight(new Date());
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    if (appliedDate === 'today') {
      f = f.filter(e => { const d = resolveEntryDate(e); return d && d >= today && d < tomorrow; });
    } else if (appliedDate === 'single' && appliedSelDate) {
      const s = toMidnight(new Date(appliedSelDate));
      const end = new Date(s); end.setDate(end.getDate() + 1);
      f = f.filter(e => { const d = resolveEntryDate(e); return d && d >= s && d < end; });
    } else if (appliedDate === 'range' && appliedStart && appliedEnd) {
      const s   = toMidnight(new Date(appliedStart));
      const end = new Date(toMidnight(new Date(appliedEnd))); end.setDate(end.getDate() + 1);
      f = f.filter(e => { const d = resolveEntryDate(e); return d && d >= s && d < end; });
    }

    setFiltered(f);
  }, [entries, appliedType, appliedSource, appliedDate, appliedSelDate, appliedStart, appliedEnd]);

  // Summary totals on filtered set
  const totalIn  = filtered.filter(e => e.type === 'in').reduce((s, e)  => s + (parseFloat(e.amount)||0), 0);
  const totalOut = filtered.filter(e => e.type === 'out').reduce((s, e) => s + (parseFloat(e.amount)||0), 0);
  const netBalance = totalIn - totalOut;

  // Filter button logic
  const isFilterComplete = () => {
    if (dateFilter === 'today')  return true;
    if (dateFilter === 'single') return !!selectedDate;
    if (dateFilter === 'range')  return !!(startDate && endDate);
    return false;
  };
  const hasChanged = () =>
    typeFilter   !== appliedType   || sourceFilter !== appliedSource ||
    dateFilter   !== appliedDate   || selectedDate !== appliedSelDate ||
    startDate    !== appliedStart  || endDate      !== appliedEnd;
  const showApply = isFilterComplete() && hasChanged();

  const handleApply = () => {
    setAppliedType(typeFilter);   setAppliedSource(sourceFilter);
    setAppliedDate(dateFilter);   setAppliedSelDate(selectedDate);
    setAppliedStart(startDate);   setAppliedEnd(endDate);
    setShowFilters(false);
  };
  const handleCloseFilter = () => {
    setTypeFilter(appliedType);     setSourceFilter(appliedSource);
    setDateFilter(appliedDate);     setSelectedDate(appliedSelDate);
    setStartDate(appliedStart);     setEndDate(appliedEnd);
    setShowFilters(false);
  };
  const handleFilterBtn = () => {
    if (!showFilters) { setShowFilters(true); return; }
    if (showApply) handleApply(); else handleCloseFilter();
  };

  // Table title
  const fmtDate = ds => new Date(ds).toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'});
  const isYesterday = ds => {
    if (!ds) return false;
    const y = new Date(); y.setDate(y.getDate()-1);
    return toMidnight(new Date(ds)).getTime() === toMidnight(y).getTime();
  };
  const getTableTitle = () => {
    if (appliedDate === 'today') return 'Cash Ledger — Today';
    if (appliedDate === 'single' && appliedSelDate) {
      if (isYesterday(appliedSelDate)) return 'Cash Ledger — Yesterday';
      return `Cash Ledger — ${fmtDate(appliedSelDate)}`;
    }
    if (appliedDate === 'range' && appliedStart && appliedEnd)
      return `Cash Ledger — ${fmtDate(appliedStart)} to ${fmtDate(appliedEnd)}`;
    return 'Cash Ledger — Today';
  };

  // Row interaction
  function handleRowClick(entry) {
    const source = entry.source || 'manual';
    if (source === 'manual') {
      if (isWithin30Mins(entry)) setEditEntry(entry);
      return;
    }
    if (!onNavigate) return;
    if (source === 'sale' || source === 'void_sale')          onNavigate(SALES_PAGE_INDEX);
    else if (source === 'purchase')                           onNavigate(PURCHASE_PAGE_INDEX);
    else if (source === 'expense')                            onNavigate(EXPENSES_PAGE_INDEX);
    else if (source === 'debt_payment' || source === 'deposit') onNavigate(DEBTORS_PAGE_INDEX);
  }

  function rowHighlight(entry) {
    const s = entry.source || 'manual';
    if (s === 'debt_payment' || s === 'deposit') return '#eff6ff';
    if (s === 'purchase')  return '#fff7ed';
    if (s === 'expense')   return '#fffbeb';
    if (s === 'sale')      return '#f0fdf4';
    return 'transparent';
  }

  function rowActionLabel(entry) {
    const s = entry.source || 'manual';
    if (s === 'sale' || s === 'void_sale')               return 'View Sale →';
    if (s === 'purchase')                                return 'View Purchase →';
    if (s === 'expense')                                 return 'View Expense →';
    if (s === 'debt_payment' || s === 'deposit')         return 'View Debtor →';
    if (s === 'manual' && isWithin30Mins(entry))         return '✏️ Edit';
    return null;
  }

  const btnLabel = !showFilters ? 'Filter Ledger' : showApply ? 'Apply Filter' : 'Close Filter';
  const btnClass = !showFilters ? 'cjfab-open'    : showApply ? 'cjfab-apply'  : 'cjfab-close';

  if (loading) return (
    <div className="cj-record">
      <div style={{padding:30,textAlign:'center',color:'#888'}}>Loading cash ledger…</div>
    </div>
  );

  return (
    <div className="cj-record">

      {/* ── Sticky top bar ── */}
      <div className="cj-sticky-bar">

        {/* Filter panel */}
        {showFilters && (
          <div className="cj-filters-section">

            {/* Type */}
            <div className="cj-filter-group">
              <label>TYPE</label>
              <div className="cj-filter-buttons">
                {[['all','All'],['in','Cash IN'],['out','Cash OUT']].map(([val,lbl]) => (
                  <button key={val} className={`cj-filter-btn${typeFilter===val?' active':''}`}
                    onClick={() => setTypeFilter(val)}>{lbl}</button>
                ))}
              </div>
            </div>

            {/* Source */}
            <div className="cj-filter-group">
              <label>SOURCE</label>
              <div className="cj-filter-buttons">
                {[['all','All'],['sale','Sale'],['purchase','Purchase'],['expense','Expense'],['debt_payment','Debt Payment'],['manual','Manual']].map(([val,lbl]) => (
                  <button key={val} className={`cj-filter-btn${sourceFilter===val?' active':''}`}
                    onClick={() => setSourceFilter(val)}>{lbl}</button>
                ))}
              </div>
            </div>

            {/* Date */}
            <div className="cj-filter-group">
              <label>DATE</label>
              <div className="cj-filter-buttons">
                {[['today','Today'],['single','Single Date'],['range','Date Range']].map(([val,lbl]) => (
                  <button key={val} className={`cj-filter-btn${dateFilter===val?' active':''}`}
                    onClick={() => { setDateFilter(val); setSelectedDate(''); setStartDate(''); setEndDate(''); }}>
                    {lbl}
                  </button>
                ))}
              </div>
              {dateFilter === 'single' && (
                <input type="date" className="cj-date-input" value={selectedDate} max={todayStr()}
                  onChange={e => setSelectedDate(e.target.value)} />
              )}
              {dateFilter === 'range' && (
                <div className="cj-date-range-inputs">
                  <div className="cj-date-range-field">
                    <span className="cj-date-range-label">From</span>
                    <input type="date" className="cj-date-input" value={startDate} max={todayStr()}
                      onChange={e => { setStartDate(e.target.value); if (endDate && endDate < e.target.value) setEndDate(''); }} />
                  </div>
                  <div className="cj-date-range-field">
                    <span className="cj-date-range-label">To</span>
                    <input type="date"
                      className={`cj-date-input${!startDate?' cj-date-input-disabled':''}`}
                      value={endDate} min={startDate||undefined} max={todayStr()} disabled={!startDate}
                      onChange={e => setEndDate(e.target.value)} />
                  </div>
                </div>
              )}
              {dateFilter === 'range' && !startDate && (
                <span className="cj-date-range-hint">Select a "From" date first</span>
              )}
            </div>

          </div>
        )}

        {/* Top row buttons */}
        <div className="cj-top-row">
          <button className={`cj-filter-action-btn ${btnClass}`} onClick={handleFilterBtn}>
            {btnLabel}
          </button>
          <button className="cj-add-btn" onClick={() => setShowAddModal(true)}>
            <Plus size={14} style={{marginRight:5,verticalAlign:'middle'}} />
            Manual Entry
          </button>
        </div>

        {/* Title */}
        <h3 className="cj-table-title">{getTableTitle()}</h3>

        {/* Stats */}
        <div className="cj-stats-boxes">
          <div className="cj-stat-box cj-stat-green">
            <div className="cj-stat-label">Cash IN</div>
            <div className="cj-stat-value">{fmt(totalIn)}</div>
          </div>
          <div className="cj-stat-box cj-stat-red">
            <div className="cj-stat-label">Cash OUT</div>
            <div className="cj-stat-value">{fmt(totalOut)}</div>
          </div>
          <div className="cj-stat-box cj-stat-purple">
            <div className="cj-stat-label">Net Balance</div>
            <div className="cj-stat-value" style={{color: netBalance < 0 ? '#fca5a5' : 'white'}}>
              {fmt(netBalance)}
            </div>
          </div>
        </div>

      </div>

      {/* ── Ledger table ── */}
      <div className="cj-scroll-body">
        <div className="cj-table-wrapper">
          <table className="cj-table">
            <thead className="cj-thead">
              <tr>
                <th>Date / Time</th>
                <th>Source</th>
                <th>Note</th>
                <th>Ref</th>
                <th className="cj-col-right">IN</th>
                <th className="cj-col-right">OUT</th>
                <th className="cj-col-right">Balance</th>
                <th className="cj-col-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="8" className="cj-empty-cell">No cash entries found for this filter.</td></tr>
              ) : (() => {
                // Compute running balance from oldest to newest, display newest first
                const chrono = [...filtered].reverse();
                let running = 0;
                const withBalance = chrono.map(entry => {
                  const amt = parseFloat(entry.amount) || 0;
                  running += entry.type === 'in' ? amt : -amt;
                  return { entry, balance: running };
                });
                return withBalance.reverse().map(({ entry, balance }) => {
                  const d       = resolveEntryDate(entry);
                  const dateStr = d ? d.toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'}) : 'N/A';
                  const timeStr = d ? d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true}) : '';
                  const amt     = parseFloat(entry.amount) || 0;
                  const isIn    = entry.type === 'in';
                  const action  = rowActionLabel(entry);
                  const bg      = rowHighlight(entry);
                  const clickable = action !== null;

                  return (
                    <tr key={entry.id}
                      style={{ background: bg, cursor: clickable ? 'pointer' : 'default' }}
                      onClick={clickable ? () => handleRowClick(entry) : undefined}
                    >
                      <td style={{whiteSpace:'nowrap',fontSize:12}}>
                        <div style={{fontWeight:600}}>{dateStr}</div>
                        <div style={{color:'#9ca3af',fontSize:11}}>{timeStr}</div>
                      </td>
                      <td><SourceBadge source={entry.source || 'manual'} /></td>
                      <td className="cj-note-cell" style={{maxWidth:160,overflow:'hidden',textOverflow:'ellipsis'}}>
                        {entry.note || '—'}
                      </td>
                      <td className="cj-ref-cell">{entry.ref || entry.invoiceRef || '—'}</td>
                      <td className="cj-col-right">
                        {isIn ? <span className="cj-amount cj-in">{fmt(amt)}</span> : <span style={{color:'#d1d5db'}}>—</span>}
                      </td>
                      <td className="cj-col-right">
                        {!isIn ? <span className="cj-amount cj-out">{fmt(amt)}</span> : <span style={{color:'#d1d5db'}}>—</span>}
                      </td>
                      <td className="cj-col-right">
                        <span className={`cj-balance${balance < 0 ? ' cj-balance-neg' : ''}`}>{fmt(balance)}</span>
                      </td>
                      <td className="cj-col-center" onClick={e => e.stopPropagation()}>
                        {action && (
                          <span
                            style={{color:'#667eea',fontSize:12,cursor:'pointer',textDecoration:'underline',whiteSpace:'nowrap'}}
                            onClick={() => handleRowClick(entry)}
                          >
                            {action}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add modal ── */}
      {showAddModal && (
        <ManualCashEntryModal
          onSaved={() => { setShowAddModal(false); load(); }}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* ── Edit modal ── */}
      {editEntry && (
        <ManualCashEntryModal
          entry={editEntry}
          onSaved={() => { setEditEntry(null); load(); }}
          onDeleted={() => { setEditEntry(null); load(); }}
          onClose={() => setEditEntry(null)}
        />
      )}
    </div>
  );
}
