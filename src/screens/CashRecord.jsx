import React, { useState, useEffect } from 'react';
import { Edit2 } from 'lucide-react';
import dataService from '../services/dataService';
import { useCurrency } from '../hooks/useCurrency';
import PdfTableButton from '../components/PdfTableButton';
import './CashRecord.css';

const TYPE_IN  = 'in';
const TYPE_OUT = 'out';

// ── Shared 30-minute edit window helper ──────────────────────────────────────
function isWithin30Mins(entry) {
  const ts = entry.createdAt || entry.date;
  if (!ts) return false;
  return (new Date() - new Date(ts)) / (1000 * 60) <= 30;
}

// ── Cash Entry Edit Modal ──────────────────────────────────────────────────
function CashEditModal({ entry, onSave, onClose, onDeleted, fmt }) {
  const [type, setType] = useState(entry.type || TYPE_IN);
  const [amount, setAmount] = useState(String(entry.amount || ''));
  const [note, setNote] = useState(entry.note || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) { alert('Please enter a valid amount.'); return; }
    if (!note.trim()) { alert('Please enter a description.'); return; }
    setSaving(true);
    try {
      await dataService.updateCashEntry(entry.id, { type, amount: parsedAmount, note: note.trim() });
      onSave();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this cash entry? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await dataService.deleteCashEntry(entry.id);
      onDeleted();
    } catch (e) { alert(e.message); }
    finally { setDeleting(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:'white', borderRadius:'12px', padding:'20px', width:'100%', maxWidth:'380px' }}>
        <h3 style={{ margin:'0 0 16px', color:'#1a1a2e', fontSize:'16px' }}>✏️ Edit Cash Entry</h3>

        <div style={{ marginBottom:'12px' }}>
          <label style={{ display:'block', fontWeight:600, fontSize:'13px', marginBottom:'4px' }}>Type</label>
          <div style={{ display:'flex', gap:'8px' }}>
            {[[TYPE_IN,'Cash In'],[TYPE_OUT,'Cash Out']].map(([t, lbl]) => (
              <button key={t} onClick={() => setType(t)} style={{
                flex:1, padding:'8px', borderRadius:'7px', border:'2px solid',
                borderColor: type === t ? (t === TYPE_IN ? '#16a34a' : '#dc2626') : '#d1d5db',
                background: type === t ? (t === TYPE_IN ? '#f0fdf4' : '#fff5f5') : 'white',
                fontWeight: type === t ? 700 : 400, cursor:'pointer', fontSize:'13px',
              }}>{lbl}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:'12px' }}>
          <label style={{ display:'block', fontWeight:600, fontSize:'13px', marginBottom:'4px' }}>Amount</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min="0.01" step="0.01"
            style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #d1d5db', borderRadius:'6px', fontSize:'14px', boxSizing:'border-box' }} />
        </div>

        <div style={{ marginBottom:'16px' }}>
          <label style={{ display:'block', fontWeight:600, fontSize:'13px', marginBottom:'4px' }}>Description</label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Description…"
            style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #d1d5db', borderRadius:'6px', fontSize:'14px', boxSizing:'border-box' }} />
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={onClose} style={{ flex:1, padding:'10px', borderRadius:'8px', border:'1.5px solid #d1d5db', background:'white', cursor:'pointer', fontWeight:600 }}>Cancel</button>
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

// ── Sub-modal for "Cash from" (Cash IN) ─────────────────────────────────────
function CashFromModal({ onSave, onCancel }) {
  const [from, setFrom] = useState('');
  const [reason, setReason] = useState('');
  return (
    <div className="cj-sub-overlay">
      <div className="cj-sub-modal">
        <h3 className="cj-sub-title">Cash From</h3>
        <div className="cj-modal-field">
          <label>Cash from</label>
          <input className="cj-modal-input" value={from} onChange={e => setFrom(e.target.value)} placeholder="Person or company name…" />
        </div>
        <div className="cj-modal-field">
          <label>Being for (reason)</label>
          <input className="cj-modal-input" value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for cash coming in…" />
        </div>
        <div className="cj-modal-buttons">
          <button className="cj-modal-cancel" onClick={onCancel}>Cancel</button>
          <button className="cj-modal-save" onClick={() => {
            if (!from.trim()) { alert('Please enter who the cash is from.'); return; }
            if (!reason.trim()) { alert('Please enter the reason.'); return; }
            onSave(`Received Cash from ${from.trim()} for ${reason.trim()}`);
          }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-modal for "Withdrawals" or "Paid to" (Cash OUT) ─────────────────────
function CashOutSubModal({ mode, onSave, onCancel }) {
  const [name, setName] = useState('');
  const [reason, setReason] = useState(mode === 'withdrawal' ? 'Personal use' : '');
  const title = mode === 'withdrawal' ? 'Withdrawal' : 'Bills';
  const nameLbl = mode === 'withdrawal' ? 'Person / Company withdrawing' : 'Bill / Company to pay';

  return (
    <div className="cj-sub-overlay">
      <div className="cj-sub-modal">
        <h3 className="cj-sub-title">{title}</h3>
        <div className="cj-modal-field">
          <label>{nameLbl}</label>
          <input className="cj-modal-input" value={name} onChange={e => setName(e.target.value)} placeholder="Enter name…" />
        </div>
        <div className="cj-modal-field">
          <label>Being for</label>
          <input className="cj-modal-input" value={reason} onChange={e => setReason(e.target.value)}
            placeholder={mode === 'withdrawal' ? 'Personal use' : 'Reason for payment…'}
            readOnly={mode === 'withdrawal'} style={mode === 'withdrawal' ? {background:'#f3f4f6',color:'#6b7280'} : {}} />
        </div>
        <div className="cj-modal-buttons">
          <button className="cj-modal-cancel" onClick={onCancel}>Cancel</button>
          <button className="cj-modal-save" onClick={() => {
            if (!name.trim()) { alert('Please enter a name.'); return; }
            onSave(`Paid Cash to ${name.trim()} for ${reason.trim() || 'Personal use'}`);
          }}>Save</button>
        </div>
      </div>
    </div>
  );
}

function CashRecord() {
  const { fmt } = useCurrency();
  const [entries, setEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [editEntry, setEditEntry] = useState(null);

  // Opening balance
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [openingInput, setOpeningInput] = useState('');

  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('today');
  const [selectedDate, setSelectedDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [appliedTypeFilter, setAppliedTypeFilter] = useState('all');
  const [appliedDateFilter, setAppliedDateFilter] = useState('today');
  const [appliedSelectedDate, setAppliedSelectedDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');

  const [showFilters, setShowFilters] = useState(false);

  // Add Entry modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [newType, setNewType] = useState(TYPE_IN);
  const [newAmount, setNewAmount] = useState('');
  // descriptionKey: null | 'float' | 'cash_from' | 'withdrawal' | 'paid_to'
  const [descriptionKey, setDescriptionKey] = useState(null);
  const [resolvedNote, setResolvedNote] = useState('');
  // subModal: null | 'cash_from' | 'withdrawal' | 'paid_to'
  const [subModal, setSubModal] = useState(null);
  const [descDropdownOpen, setDescDropdownOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // ── Data ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Check if opening balance has been set yet
    dataService.getSettings().then(s => {
      if (s.openingBalance === null || s.openingBalance === undefined) {
        setShowOpeningModal(true);
      }
    });
    loadEntries();
  }, []);
  // Reload when tab becomes visible again (after switching from SalesRegister)
  useEffect(() => {
    const handleVisibility = () => { if (!document.hidden) loadEntries(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { applyFilters(); }, [entries, appliedTypeFilter, appliedDateFilter, appliedSelectedDate, appliedStartDate, appliedEndDate]);

  const loadEntries = async () => {
    // All cash entries (sales, deposits, manual) are stored in localforage
    // via dataService.addCashEntry(). We simply read them all here.
    // Sales Register writes "CASH Sale" entries automatically.
    // Debtors deposit payments write "[Name] paid cash to repay debt" entries.
    const allEntries = await dataService.getCashEntries();

    const sorted = (allEntries || [])
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    let running = 0;
    const withBalance = sorted.map(entry => {
      running += entry.type === TYPE_IN ? entry.amount : -entry.amount;
      return { ...entry, balance: running };
    });

    setEntries([...withBalance].reverse());
  };

  const resolveDate = (entry) => {
    const raw = entry.date;
    if (!raw) return null;
    if (typeof raw === 'object' && raw.seconds) return new Date(raw.seconds * 1000);
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  };

  const toMidnight = (d) => { const c = new Date(d); c.setHours(0,0,0,0); return c; };

  const applyFilters = () => {
    let filtered = [...entries];
    if (appliedTypeFilter !== 'all') filtered = filtered.filter(e => e.type === appliedTypeFilter);
    const today = toMidnight(new Date());
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    if (appliedDateFilter === 'today')
      filtered = filtered.filter(e => { const d = resolveDate(e); return d && d >= today && d < tomorrow; });
    if (appliedDateFilter === 'single' && appliedSelectedDate) {
      const s = toMidnight(new Date(appliedSelectedDate)), e2 = new Date(s); e2.setDate(e2.getDate() + 1);
      filtered = filtered.filter(e => { const d = resolveDate(e); return d && d >= s && d < e2; });
    }
    if (appliedDateFilter === 'range' && appliedStartDate && appliedEndDate) {
      const s = toMidnight(new Date(appliedStartDate));
      const e2 = new Date(toMidnight(new Date(appliedEndDate))); e2.setDate(e2.getDate() + 1);
      filtered = filtered.filter(e => { const d = resolveDate(e); return d && d >= s && d < e2; });
    }
    setFilteredEntries(filtered);
  };

  // ── Filter controls ───────────────────────────────────────────────────────
  const isFilterComplete = () => {
    if (dateFilter === 'today')  return true;
    if (dateFilter === 'single') return !!selectedDate;
    if (dateFilter === 'range')  return !!(startDate && endDate);
    return false;
  };
  const hasChanged = () =>
    typeFilter !== appliedTypeFilter || dateFilter !== appliedDateFilter ||
    selectedDate !== appliedSelectedDate || startDate !== appliedStartDate || endDate !== appliedEndDate;
  const showApply = isFilterComplete() && hasChanged();

  const handleClose = () => {
    setTypeFilter(appliedTypeFilter); setDateFilter(appliedDateFilter);
    setSelectedDate(appliedSelectedDate); setStartDate(appliedStartDate); setEndDate(appliedEndDate);
    setShowFilters(false);
  };
  const handleApply = () => {
    setAppliedTypeFilter(typeFilter); setAppliedDateFilter(dateFilter);
    setAppliedSelectedDate(selectedDate); setAppliedStartDate(startDate); setAppliedEndDate(endDate);
    setShowFilters(false);
  };
  const handleFilterButtonClick = () => {
    if (!showFilters)    setShowFilters(true);
    else if (showApply)  handleApply();
    else                 handleClose();
  };

  // ── Add Entry ─────────────────────────────────────────────────────────────
  const resetAddModal = () => {
    setNewAmount(''); setDescriptionKey(null); setResolvedNote('');
    setSubModal(null); setNewType(TYPE_IN); setDescDropdownOpen(false);
  };
  const openAddModal = () => { resetAddModal(); setShowAddModal(true); };
  const closeAddModal = () => { setShowAddModal(false); resetAddModal(); };

  // When user picks a description option
  const handleDescriptionSelect = (key) => {
    setDescriptionKey(key);
    setResolvedNote('');
    if (key === 'float') {
      // Float is immediate — no sub-modal needed
      setResolvedNote('Float (notes and coins for change)');
    } else if (key === 'cash_from') {
      setSubModal('cash_from');
    } else if (key === 'withdrawal') {
      setSubModal('withdrawal');
    } else if (key === 'paid_to') {
      setSubModal('paid_to');
    }
  };

  const handleSubModalSave = (note) => {
    setResolvedNote(note);
    setSubModal(null);
  };

  const handleSaveEntry = async () => {
    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount <= 0) { alert('Please enter a valid amount.'); return; }
    if (!resolvedNote) { alert('Please select and complete a description.'); return; }
    setIsProcessing(true);
    try {
      const _now = new Date();
      await dataService.addCashEntry({
        type: newType, amount, note: resolvedNote,
        date: _now.toISOString(),
        source: 'manual',
        business_date: _now.toISOString().slice(0, 10),
      });
      closeAddModal();
      await loadEntries();
    } catch (err) {
      console.error('Error saving cash entry:', err);
      alert('Failed to save entry. Please try again.');
    } finally { setIsProcessing(false); }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getTodayStr = () => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  };
  const formatDisplayDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' });
  const isYesterday = (dateStr) => {
    if (!dateStr) return false;
    const y = new Date(); y.setDate(y.getDate()-1);
    return toMidnight(new Date(dateStr)).getTime() === toMidnight(y).getTime();
  };
  const getTableTitle = () => {
    const typeMap = { all:'All Entries', in:'Cash In', out:'Cash Out' };
    const label = typeMap[appliedTypeFilter] || 'All Entries';
    if (appliedDateFilter === 'today') return `${label} Today`;
    if (appliedDateFilter === 'single' && appliedSelectedDate) {
      if (isYesterday(appliedSelectedDate)) return `${label} Yesterday`;
      return `${label} on ${formatDisplayDate(appliedSelectedDate)}`;
    }
    if (appliedDateFilter === 'range' && appliedStartDate && appliedEndDate)
      return `${label} from ${formatDisplayDate(appliedStartDate)} to ${formatDisplayDate(appliedEndDate)}`;
    return `${label} Today`;
  };
  const formatDateTime = (entry) => {
    const d = resolveDate(entry);
    if (!d) return { date:'N/A', time:'N/A' };
    return {
      date: d.toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' }),
      // Show FORGOTTEN for entries entered via the Settings "Unrecorded Cash Entry" modal
      time: entry.isUnrecorded ? 'UNRECORDED' : d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true }),
    };
  };

  const totalRecords = filteredEntries.length;
  const netBalance = filteredEntries.reduce(
    (sum, e) => sum + (e.type === TYPE_IN ? e.amount : -e.amount), 0
  );
  const btnLabel = !showFilters ? 'Filter Entries' : showApply ? 'Apply Filter' : 'Close Filter';

  // IN description options
  const IN_OPTIONS = [
    { key: 'float',     label: 'Float (change money)' },
    { key: 'cash_from', label: 'Cash from…'           },
  ];
  // OUT description options
  const OUT_OPTIONS = [
    { key: 'withdrawal', label: 'Withdrawal'   },
    { key: 'paid_to',    label: 'Bills…'       },
  ];
  const currentOptions = newType === TYPE_IN ? IN_OPTIONS : OUT_OPTIONS;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="cj-record">

      {/* ── Sticky bar ── */}
      <div className="cj-sticky-bar">
        {/* Filter panel — inside sticky bar */}
        {showFilters && (
          <div className="cj-filters-section">
            <div className="cj-filter-group">
              <label>Entry Type</label>
              <div className="cj-filter-buttons">
                {[['all','All Entries'],[TYPE_IN,'Cash In'],[TYPE_OUT,'Cash Out']].map(([val,lbl]) => (
                  <button key={val} className={`cj-filter-btn${typeFilter===val?' active':''}`}
                    onClick={() => setTypeFilter(val)}>{lbl}</button>
                ))}
              </div>
            </div>
            <div className="cj-filter-group">
              <label>Date Filter</label>
              <div className="cj-filter-buttons">
                {[['today','Today'],['single','Single Date'],['range','Date Range']].map(([val,lbl]) => (
                  <button key={val} className={`cj-filter-btn${dateFilter===val?' active':''}`}
                    onClick={() => { setDateFilter(val); setSelectedDate(''); setStartDate(''); setEndDate(''); }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            {dateFilter === 'single' && (
              <div className="cj-filter-group">
                <label>Select Date</label>
                <input type="date" value={selectedDate} max={getTodayStr()}
                  onChange={e => setSelectedDate(e.target.value)} className="cj-date-input" />
              </div>
            )}
            {dateFilter === 'range' && (
              <div className="cj-filter-group">
                <label>Date Range</label>
                <div className="cj-date-range-inputs">
                  <div className="cj-date-range-field">
                    <label className="cj-date-range-label">From:</label>
                    <input type="date" value={startDate} max={getTodayStr()}
                      onChange={e => { setStartDate(e.target.value); if (endDate && endDate < e.target.value) setEndDate(''); }}
                      className="cj-date-input" />
                  </div>
                  <div className="cj-date-range-field">
                    <label className="cj-date-range-label">To:</label>
                    <input type="date" value={endDate} min={startDate||undefined} max={getTodayStr()}
                      disabled={!startDate} onChange={e => setEndDate(e.target.value)}
                      className={`cj-date-input${!startDate?' cj-date-input-disabled':''}`} />
                  </div>
                </div>
                {!startDate && <span className="cj-date-range-hint">Select a "From" date first</span>}
              </div>
            )}
          </div>
        )}

        <div className="cj-top-row">
          <button
            className={`cj-filter-action-btn${!showFilters ? ' cjfab-open' : showApply ? ' cjfab-apply' : ' cjfab-close'}`}
            onClick={handleFilterButtonClick}>{btnLabel}</button>
          {/* Hide + Add Entry while filter panel is open */}
          {!showFilters && (
            <button className="cj-add-btn" onClick={openAddModal}>+ Add Entry</button>
          )}
        </div>
        <h3 className="cj-table-title">{getTableTitle()}</h3>
        <div className="cj-stats-boxes">
          <div className="cj-stat-box cj-stat-purple">
            <div className="cj-stat-label">Total Records</div>
            <div className="cj-stat-value">{totalRecords}</div>
          </div>
          <div className={`cj-stat-box ${netBalance >= 0 ? 'cj-stat-green' : 'cj-stat-red'}`}>
            <div className="cj-stat-label">Net Balance</div>
            <div className="cj-stat-value">{netBalance < 0 ? '-' : ''}{fmt(Math.abs(netBalance))}</div>
          </div>
        </div>
      </div>

      {/* ── Scroll body — the ONLY scroll container; thead sticks at top:0 inside it ── */}
      <div className="cj-scroll-body">
        <div className="cj-table-wrapper" style={{position:'relative'}}>
          <PdfTableButton
            title="Cash Journal"
            columns={[
              {header:'Date',key:'date'},{header:'Time',key:'time'},{header:'Ref',key:'ref'},
              {header:'Description',key:'desc'},{header:'Amount',key:'amount'},
              {header:'Type',key:'type'},{header:'Balance',key:'balance'}
            ]}
            rows={filteredEntries.map(entry => {
              const {date,time} = formatDateTime(entry);
              return {
                date, time,
                ref: entry.invoiceRef||entry.ref||'—',
                desc: entry.description||'—',
                amount: fmt(entry.amount||0),
                type: entry.type===TYPE_IN ? 'IN':'OUT',
                balance: fmt(entry.balance||0),
              };
            })}
            summary={[{label:'Net Balance', value: fmt(Math.abs(netBalance))+(netBalance<0?' (deficit)':'')}]}
          />
        <table className="cj-table">
          <thead className="cj-thead">
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Ref</th>
              <th>Description</th>
              <th className="cj-col-right">Amount</th>
              <th className="cj-col-center">Type</th>
              <th className="cj-col-right">Balance</th>
              <th className="cj-col-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.length === 0 ? (
              <tr><td colSpan="8" className="cj-empty-cell">No entries found</td></tr>
            ) : (
              filteredEntries.map(entry => {
                const { date, time } = formatDateTime(entry);
                const editable = isWithin30Mins(entry);
                return (
                  <tr key={entry.id} className="cj-row">
                    <td>{date}</td>
                    <td>{time}</td>
                    <td className="cj-ref-cell">{entry.invoiceRef || entry.ref || '—'}</td>
                    <td className="cj-note-cell">{entry.note || '—'}</td>
                    <td className={`cj-col-right cj-amount ${entry.type === TYPE_IN ? 'cj-in' : 'cj-out'}`}>
                      {(() => { const s = entry.type === TYPE_IN ? '+' : '-'; const r = fmt(entry.amount); const sym = r.match(/^[^\d]+/)?.[0] ?? ''; const num = r.slice(sym.length); return `${s} ${sym} ${num}`; })()}
                    </td>
                    <td className="cj-col-center">
                      <span className={`cj-type-badge cj-badge-${entry.type}`}>
                        {entry.type === TYPE_IN ? 'IN' : 'OUT'}
                      </span>
                    </td>
                    <td className={`cj-col-right cj-balance ${entry.balance < 0 ? 'cj-balance-neg' : ''}`}>
                      {entry.balance < 0 ? '-' : ''}{fmt(Math.abs(entry.balance))}
                    </td>
                    <td className="cj-col-center">
                      {editable ? (
                        <button onClick={() => setEditEntry(entry)}
                          style={{ background:'none', border:'none', cursor:'pointer', color:'#667eea', padding:'4px', borderRadius:'4px', display:'inline-flex', alignItems:'center' }}
                          title="Edit entry">
                          <Edit2 size={15} />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* ── Add Entry modal ── */}
      {showAddModal && (
        <div className="cj-modal-overlay">
          <div className="cj-modal-content">
            <h2 className="cj-modal-title">Add Cash Entry</h2>

            {/* Type selector */}
            <div className="cj-modal-field">
              <label>Type</label>
              <div className="cj-modal-type-btns">
                <button
                  className={`cj-modal-type-btn${newType === TYPE_IN ? ' active-in' : ''}`}
                  onClick={() => { setNewType(TYPE_IN); setDescriptionKey(null); setResolvedNote(''); setDescDropdownOpen(false); }}>
                  Cash In
                </button>
                <button
                  className={`cj-modal-type-btn${newType === TYPE_OUT ? ' active-out' : ''}`}
                  onClick={() => { setNewType(TYPE_OUT); setDescriptionKey(null); setResolvedNote(''); setDescDropdownOpen(false); }}>
                  Cash Out
                </button>
              </div>
            </div>

            {/* Amount */}
            <div className="cj-modal-field">
              <label>Amount</label>
              <input type="number" className="cj-modal-input" placeholder="0.00"
                value={newAmount} onChange={e => setNewAmount(e.target.value)} min="0.01" step="0.01" />
            </div>

            {/* Description — click '...' to open dropdown */}
            <div className="cj-modal-field">
              <label>Description</label>
              <div className="cj-desc-field-wrapper">
                {/* The '...' trigger / selected value display */}
                <button
                  className={`cj-desc-trigger${descDropdownOpen ? ' open' : ''}${resolvedNote ? ' has-value' : ''}`}
                  onClick={() => setDescDropdownOpen(o => !o)}
                >
                  <span className="cj-desc-trigger-text">
                    {resolvedNote
                      ? resolvedNote
                      : descriptionKey && !resolvedNote
                        ? currentOptions.find(o => o.key === descriptionKey)?.label || '…'
                        : '…'}
                  </span>
                  <span className="cj-desc-chevron">{descDropdownOpen ? '▲' : '▼'}</span>
                </button>

                {/* Dropdown list — only shows when open */}
                {descDropdownOpen && (
                  <div className="cj-desc-dropdown">
                    {currentOptions.map(opt => (
                      <button
                        key={opt.key}
                        className={`cj-desc-dropdown-item${descriptionKey === opt.key ? ' selected' : ''}`}
                        onClick={() => {
                          setDescDropdownOpen(false);
                          handleDescriptionSelect(opt.key);
                        }}
                      >
                        {opt.label}
                        {descriptionKey === opt.key && resolvedNote && ' ✓'}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview of resolved description */}
              {resolvedNote && (
                <div className="cj-desc-preview">{resolvedNote}</div>
              )}
            </div>

            <div className="cj-modal-buttons">
              <button className="cj-modal-cancel" onClick={closeAddModal}>Cancel</button>
              <button className="cj-modal-save" onClick={handleSaveEntry}
                disabled={isProcessing || !resolvedNote || !newAmount}>
                Save
              </button>
            </div>

            {/* Sub-modals rendered inside the overlay stack */}
            {subModal === 'cash_from' && (
              <CashFromModal
                onSave={handleSubModalSave}
                onCancel={() => { setSubModal(null); setDescriptionKey(null); }}
              />
            )}
            {(subModal === 'withdrawal' || subModal === 'paid_to') && (
              <CashOutSubModal
                mode={subModal === 'withdrawal' ? 'withdrawal' : 'paid_to'}
                onSave={handleSubModalSave}
                onCancel={() => { setSubModal(null); setDescriptionKey(null); }}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Opening Balance Modal — shown once on first use ── */}
      {showOpeningModal && (
        <div className="cj-modal-overlay">
          <div className="cj-modal-content">
            <h2 className="cj-modal-title">Set Opening Balance</h2>
            <p style={{ fontSize:'13px', color:'#6b7280', marginBottom:'16px', lineHeight:'1.5' }}>
              Enter the amount of cash you currently have on hand before starting to use this system.
              This sets your starting balance. You can enter <strong>0</strong> if you are starting fresh.
            </p>
            <div className="cj-modal-field">
              <label>Cash on Hand</label>
              <input
                type="number"
                className="cj-modal-input"
                placeholder="0.00"
                value={openingInput}
                onChange={e => setOpeningInput(e.target.value)}
                min="0"
                step="0.01"
                autoFocus
              />
            </div>
            <div className="cj-modal-buttons">
              <button className="cj-modal-cancel" onClick={() => {
                // User dismissed — mark as set to 0 so we don't prompt again
                dataService.getSettings().then(s =>
                  dataService.saveSettings({ ...s, openingBalance: 0 })
                );
                setShowOpeningModal(false);
              }}>Skip (set to 0)</button>
              <button className="cj-modal-save" onClick={async () => {
                const amount = parseFloat(openingInput) || 0;
                await dataService.setOpeningBalance(amount);
                setShowOpeningModal(false);
                setOpeningInput('');
                await loadEntries();
              }}>Save Opening Balance</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Cash Entry Modal (2-hour window) ── */}
      {editEntry && (
        <CashEditModal
          entry={editEntry}
          fmt={fmt}
          onSave={async () => { setEditEntry(null); await loadEntries(); }}
          onDeleted={async () => { setEditEntry(null); await loadEntries(); }}
          onClose={() => setEditEntry(null)}
        />
      )}

    </div>
  );
}

export default CashRecord;
