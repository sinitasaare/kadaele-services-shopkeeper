import React, { useState, useEffect } from 'react';
import { Edit2 } from 'lucide-react';
import dataService from '../services/dataService';
import { useCurrency } from '../hooks/useCurrency';
import PdfTableButton from '../components/PdfTableButton';
import './CashRecord.css';

const TYPE_IN  = 'in';
const TYPE_OUT = 'out';

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
      <div style={{ background:'var(--surface)', color:'var(--text-primary)', borderRadius:'12px', padding:'20px', width:'100%', maxWidth:'380px' }}>
        <h3 style={{ margin:'0 0 16px', fontSize:'16px' }}>✏️ Edit Cash Entry</h3>
        <div style={{ marginBottom:'12px' }}>
          <label style={{ display:'block', fontWeight:600, fontSize:'13px', marginBottom:'4px' }}>Type</label>
          <div style={{ display:'flex', gap:'8px' }}>
            {[[TYPE_IN,'Cash In'],[TYPE_OUT,'Cash Out']].map(([t, lbl]) => (
              <button key={t} onClick={() => setType(t)} style={{
                flex:1, padding:'8px', borderRadius:'7px', border:'2px solid',
                borderColor: type === t ? (t === TYPE_IN ? '#16a34a' : '#dc2626') : '#d1d5db',
                background: type === t ? (t === TYPE_IN ? '#f0fdf4' : '#fff5f5') : 'var(--surface)',
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

// ── Sub-modal: Cash From (Cash IN) ───────────────────────────────────────────
const CASH_FROM_NAMES   = ['Riti', 'Kamwatie', 'Tikanboi', 'Baikite', 'Others'];
const CASH_FROM_REASONS = [
  { key: 'float',        label: 'Float (change money)',      phrase: 'for float (change money)' },
  { key: 'purchases',    label: 'Purchases (money to pay stock)', phrase: 'to purchase stock' },
  { key: 'safe_keeping', label: 'For Safe Keeping',          phrase: 'for Safe Keeping' },
];

function CashFromModal({ onSave, onCancel }) {
  const [from, setFrom]             = useState('');
  const [isOthers, setIsOthers]     = useState(false);
  const [showFromDrop, setShowFromDrop] = useState(false);
  const [reason, setReason]         = useState('');
  const [showReasonDrop, setShowReasonDrop] = useState(false);

  const handleNameSelect = (name) => {
    setShowFromDrop(false);
    if (name === 'Others') { setIsOthers(true); setFrom(''); }
    else                   { setIsOthers(false); setFrom(name); }
  };

  const handleSave = () => {
    if (!from.trim())   { alert('Please enter who the cash is from.'); return; }
    if (!reason)        { alert('Please select a reason.'); return; }
    const r = CASH_FROM_REASONS.find(x => x.key === reason);
    onSave(`Cash from ${from.trim()} ${r.phrase}.`);
  };

  return (
    <div className="cj-sub-overlay">
      <div className="cj-sub-modal">
        <h3 className="cj-sub-title">Cash From</h3>

        {/* Cash From field */}
        <div className="cj-modal-field" style={{ position:'relative' }}>
          <label>Cash From</label>
          {isOthers ? (
            <input
              className="cj-modal-input"
              value={from}
              onChange={e => setFrom(e.target.value)}
              placeholder="Type name…"
              autoFocus
            />
          ) : (
            <button
              className={`cj-desc-trigger${from ? ' has-value' : ''}`}
              onClick={() => setShowFromDrop(o => !o)}
            >
              <span className="cj-desc-trigger-text">{from || 'Select name…'}</span>
              <span className="cj-desc-chevron">{showFromDrop ? '▲' : '▼'}</span>
            </button>
          )}
          {showFromDrop && !isOthers && (
            <div className="cj-desc-dropdown" style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:300 }}>
              {CASH_FROM_NAMES.map(n => (
                <button key={n} className="cj-desc-dropdown-item" onMouseDown={() => handleNameSelect(n)}>{n}</button>
              ))}
            </div>
          )}
          {isOthers && (
            <button style={{ marginTop:'4px', fontSize:'11px', color:'#667eea', background:'none', border:'none', cursor:'pointer', padding:0 }}
              onClick={() => { setIsOthers(false); setFrom(''); }}>
              ← Back to list
            </button>
          )}
        </div>

        {/* Being For field */}
        <div className="cj-modal-field" style={{ position:'relative' }}>
          <label>Being For</label>
          <button
            className={`cj-desc-trigger${reason ? ' has-value' : ''}`}
            onClick={() => setShowReasonDrop(o => !o)}
          >
            <span className="cj-desc-trigger-text">
              {reason ? CASH_FROM_REASONS.find(x => x.key === reason)?.label : 'Select reason…'}
            </span>
            <span className="cj-desc-chevron">{showReasonDrop ? '▲' : '▼'}</span>
          </button>
          {showReasonDrop && (
            <div className="cj-desc-dropdown" style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:300 }}>
              {CASH_FROM_REASONS.map(r => (
                <button key={r.key} className={`cj-desc-dropdown-item${reason === r.key ? ' selected' : ''}`}
                  onMouseDown={() => { setReason(r.key); setShowReasonDrop(false); }}>
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="cj-modal-buttons">
          <button className="cj-modal-cancel" onClick={onCancel}>Cancel</button>
          <button className="cj-modal-save" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-modal: Cash Out ───────────────────────────────────────────────────────
const PAID_TO_NAMES   = ['Riti', 'Kamwatie', 'Tikanboi', 'Baikite', 'Others'];
const PAID_TO_REASONS = [
  { key: 'advance',      label: 'Cash Advance',         phrase: 'for Cash Advance' },
  { key: 'electricity',  label: 'Pay electricity bill',  phrase: 'to pay electricity bill' },
  { key: 'stationary',   label: 'Buy stationary',        phrase: 'to buy stationary' },
  { key: 'rent',         label: 'Pay rent',              phrase: 'to pay rent' },
  { key: 'other',        label: 'Other reason…',         phrase: '' },
];

function WithdrawalSubModal({ onSave, onCancel }) {
  const [paidTo, setPaidTo]             = useState('');
  const [isOthers, setIsOthers]         = useState(false);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [suppliers, setSuppliers]       = useState([]);
  const [showSupplierDrop, setShowSupplierDrop] = useState(false);
  const [showNameDrop, setShowNameDrop] = useState(false);
  const [reason, setReason]             = useState('');
  const [showReasonDrop, setShowReasonDrop] = useState(false);
  const [otherReason, setOtherReason]   = useState('');
  const [showOtherModal, setShowOtherModal] = useState(false);
  const [refNumber, setRefNumber]       = useState('');

  useEffect(() => {
    dataService.getSuppliers().then(s => setSuppliers(s || []));
  }, []);

  const filteredSuppliers = suppliers.filter(s =>
    (s.name || s.customerName || '').toLowerCase().includes(supplierSearch.toLowerCase())
  );

  const handleNameSelect = (name) => {
    setShowNameDrop(false);
    if (name === 'Others') {
      setIsOthers(true);
      setPaidTo('');
      setSupplierSearch('');
    } else {
      setIsOthers(false);
      setPaidTo(name);
      setSupplierSearch('');
    }
  };

  const handleReasonSelect = (key) => {
    setShowReasonDrop(false);
    setReason(key);
    if (key === 'other') setShowOtherModal(true);
    else setOtherReason('');
  };

  const getPhrase = () => {
    if (reason === 'other') return otherReason.trim() ? `for ${otherReason.trim()}` : '';
    return PAID_TO_REASONS.find(r => r.key === reason)?.phrase || '';
  };

  const handleSave = () => {
    const name = isOthers ? supplierSearch.trim() || paidTo.trim() : paidTo.trim();
    if (!name) { alert('Please enter who the cash is paid to.'); return; }
    if (!reason) { alert('Please select a reason.'); return; }
    if (reason === 'other' && !otherReason.trim()) { alert('Please enter the reason.'); return; }
    const phrase = getPhrase();
    onSave({
      note: `Paid ${name} ${phrase}.`,
      invoiceRef: refNumber.trim() || '',
    });
  };

  // Other Reason child modal
  if (showOtherModal) {
    return (
      <div className="cj-sub-overlay">
        <div className="cj-sub-modal">
          <h3 className="cj-sub-title">Enter Reason</h3>
          <div className="cj-modal-field">
            <label>Reason for payment</label>
            <input className="cj-modal-input" value={otherReason} onChange={e => setOtherReason(e.target.value)}
              placeholder="Describe the reason…" autoFocus />
          </div>
          <div className="cj-modal-buttons">
            <button className="cj-modal-cancel" onClick={() => { setShowOtherModal(false); setReason(''); }}>Cancel</button>
            <button className="cj-modal-save" onClick={() => {
              if (!otherReason.trim()) { alert('Please enter a reason.'); return; }
              setShowOtherModal(false);
            }}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cj-sub-overlay">
      <div className="cj-sub-modal">
        <h3 className="cj-sub-title">Cash Out</h3>

        {/* Paid To field */}
        <div className="cj-modal-field" style={{ position:'relative' }}>
          <label>Paid To</label>
          {isOthers ? (
            <>
              <input
                className="cj-modal-input"
                value={supplierSearch}
                onChange={e => { setSupplierSearch(e.target.value); setShowSupplierDrop(true); }}
                onFocus={() => setShowSupplierDrop(true)}
                onBlur={() => setTimeout(() => setShowSupplierDrop(false), 200)}
                placeholder="Search from Suppliers list…"
                autoFocus
              />
              {showSupplierDrop && filteredSuppliers.length > 0 && (
                <div className="cj-desc-dropdown" style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:300 }}>
                  {filteredSuppliers.map(s => {
                    const name = s.name || s.customerName;
                    return (
                      <button key={s.id} className="cj-desc-dropdown-item"
                        onMouseDown={() => { setSupplierSearch(name); setShowSupplierDrop(false); }}>
                        {name}
                      </button>
                    );
                  })}
                </div>
              )}
              <button style={{ marginTop:'4px', fontSize:'11px', color:'#667eea', background:'none', border:'none', cursor:'pointer', padding:0 }}
                onClick={() => { setIsOthers(false); setPaidTo(''); setSupplierSearch(''); }}>
                ← Back to list
              </button>
            </>
          ) : (
            <button
              className={`cj-desc-trigger${paidTo ? ' has-value' : ''}`}
              onClick={() => setShowNameDrop(o => !o)}
            >
              <span className="cj-desc-trigger-text">{paidTo || 'Select name…'}</span>
              <span className="cj-desc-chevron">{showNameDrop ? '▲' : '▼'}</span>
            </button>
          )}
          {showNameDrop && !isOthers && (
            <div className="cj-desc-dropdown" style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:300 }}>
              {PAID_TO_NAMES.map(n => (
                <button key={n} className="cj-desc-dropdown-item" onMouseDown={() => handleNameSelect(n)}>{n}</button>
              ))}
            </div>
          )}
        </div>

        {/* Being For field */}
        <div className="cj-modal-field" style={{ position:'relative' }}>
          <label>Being For</label>
          <button
            className={`cj-desc-trigger${reason ? ' has-value' : ''}`}
            onClick={() => setShowReasonDrop(o => !o)}
          >
            <span className="cj-desc-trigger-text">
              {reason === 'other' && otherReason
                ? otherReason
                : reason
                  ? PAID_TO_REASONS.find(r => r.key === reason)?.label
                  : 'Select reason…'}
            </span>
            <span className="cj-desc-chevron">{showReasonDrop ? '▲' : '▼'}</span>
          </button>
          {showReasonDrop && (
            <div className="cj-desc-dropdown" style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:300 }}>
              {PAID_TO_REASONS.map(r => (
                <button key={r.key} className={`cj-desc-dropdown-item${reason === r.key ? ' selected' : ''}`}
                  onMouseDown={() => handleReasonSelect(r.key)}>
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Ref Number */}
        <div className="cj-modal-field">
          <label>Reference Number <span style={{ fontWeight:400, color:'#9ca3af' }}>(optional)</span></label>
          <input className="cj-modal-input" value={refNumber} onChange={e => setRefNumber(e.target.value)}
            placeholder="Invoice / receipt ref…" />
        </div>

        <div className="cj-modal-buttons">
          <button className="cj-modal-cancel" onClick={onCancel}>Cancel</button>
          <button className="cj-modal-save" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Store Closed Banner ────────────────────────────────────────────────────────
function StoreClosedBanner() {
  return (
    <div style={{
      background:'#fef3c7', border:'1.5px solid #f59e0b', borderRadius:'10px',
      padding:'20px', margin:'16px', textAlign:'center', color:'#92400e'
    }}>
      <div style={{ fontSize:'32px', marginBottom:'8px' }}>🔒</div>
      <div style={{ fontWeight:700, fontSize:'15px', marginBottom:'4px' }}>Store Not Open</div>
      <div style={{ fontSize:'13px', lineHeight:'1.5' }}>
        Open the day in <strong>Cash Reconciliation</strong> to use the Cash Record and add entries.
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
function CashRecord({ isUnlocked = false }) {
  const { fmt } = useCurrency();
  const [entries, setEntries]             = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [editEntry, setEditEntry]         = useState(null);
  const [currentBalance, setCurrentBalance] = useState(0);

  // Filter states
  const [typeFilter, setTypeFilter]       = useState('all');
  const [dateFilter, setDateFilter]       = useState('today');
  const [selectedDate, setSelectedDate]   = useState('');
  const [startDate, setStartDate]         = useState('');
  const [endDate, setEndDate]             = useState('');
  const [appliedTypeFilter, setAppliedTypeFilter] = useState('all');
  const [appliedDateFilter, setAppliedDateFilter] = useState('today');
  const [appliedSelectedDate, setAppliedSelectedDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate]     = useState('');
  const [showFilters, setShowFilters]     = useState(false);

  // Add Entry modal
  const [showAddModal, setShowAddModal]   = useState(false);
  const [newType, setNewType]             = useState(TYPE_IN);
  const [newAmount, setNewAmount]         = useState('');
  const [descriptionKey, setDescriptionKey] = useState(null);
  const [resolvedNote, setResolvedNote]   = useState('');
  const [resolvedRef, setResolvedRef]     = useState('');
  const [subModal, setSubModal]           = useState(null);
  const [descDropdownOpen, setDescDropdownOpen] = useState(false);
  const [isProcessing, setIsProcessing]   = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadEntries();
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) { loadEntries(); }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { applyFilters(); }, [entries, appliedTypeFilter, appliedDateFilter, appliedSelectedDate, appliedStartDate, appliedEndDate]);



  const loadEntries = async () => {
    const allEntries = await dataService.getCashEntries();
    const sorted = (allEntries || []).sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    let running = 0;
    const withBalance = sorted.map(entry => {
      running += entry.type === TYPE_IN ? entry.amount : -entry.amount;
      return { ...entry, balance: running };
    });
    setCurrentBalance(running);
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
    if (dateFilter === 'today') return true;
    if (dateFilter === 'single') return !!selectedDate;
    if (dateFilter === 'range') return !!(startDate && endDate);
    return false;
  };
  const hasChanged = () =>
    typeFilter !== appliedTypeFilter || dateFilter !== appliedDateFilter ||
    selectedDate !== appliedSelectedDate || startDate !== appliedStartDate || endDate !== appliedEndDate;
  const showApply = isFilterComplete() && hasChanged();

  const handleCloseFilter = () => {
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
    else                 handleCloseFilter();
  };

  // ── Add Entry ─────────────────────────────────────────────────────────────
  const resetAddModal = () => {
    setNewAmount(''); setDescriptionKey(null); setResolvedNote('');
    setSubModal(null); setNewType(TYPE_IN); setDescDropdownOpen(false);
    setResolvedRef('');
  };
  const openAddModal = () => { resetAddModal(); setShowAddModal(true); };
  const closeAddModal = () => { setShowAddModal(false); resetAddModal(); };

  // Cash In: quick-select options resolve immediately; 'cash_from' opens sub-modal
  const IN_OPTIONS = [
    { key: 'float',        label: 'Float (change money)',           note: 'Float (change money)' },
    { key: 'purchases',    label: 'Purchases (money to pay stock)', note: 'Purchases (money to pay stock)' },
    { key: 'safe_keeping', label: 'For Safe Keeping',               note: 'For Safe Keeping' },
    { key: 'cash_from',    label: 'Cash from a person…',            note: null }, // opens sub-modal
  ];
  const currentOptions = newType === TYPE_IN ? IN_OPTIONS : [];

  const handleDescriptionSelect = (key) => {
    setDescriptionKey(key);
    setResolvedNote('');
    setResolvedRef('');
    if (key === 'cash_from')  { setSubModal('cash_from'); return; }
    if (newType === TYPE_OUT) { setSubModal('withdrawal'); return; }
    // Quick-select for Cash In
    const opt = IN_OPTIONS.find(o => o.key === key);
    if (opt?.note) setResolvedNote(opt.note);
  };

  // Sub-modal save — accepts { note, invoiceRef? } or plain string (legacy)
  const handleSubModalSave = (result) => {
    if (typeof result === 'string') {
      setResolvedNote(result);
      setResolvedRef('');
    } else {
      setResolvedNote(result.note || '');
      setResolvedRef(result.invoiceRef || '');
    }
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
        ...(resolvedRef ? { invoiceRef: resolvedRef } : {}),
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
      time: entry.isUnrecorded ? 'UNRECORDED' : d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true }),
    };
  };

  const totalRecords = filteredEntries.length;
  const netBalance = filteredEntries.reduce((sum, e) => sum + (e.type === TYPE_IN ? e.amount : -e.amount), 0);
  const btnLabel = !showFilters ? 'Filter Entries' : showApply ? 'Apply Filter' : 'Close Filter';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="cj-record">

      {/* ── Sticky header ── */}
      <div className="cj-sticky-bar">
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
          {!showFilters && isUnlocked && (
            <button className="cj-add-btn" onClick={openAddModal}>+ Add Entry</button>
          )}
          {!showFilters && !isUnlocked && (
            <span style={{ fontSize:'12px', color:'#ef4444', fontWeight:600, padding:'6px 8px' }}>🔒 Locked</span>
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

      {/* ── Scroll body ── */}
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
                desc: entry.note||'—',
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
                <th>Date</th><th>Time</th><th>Ref</th><th>Description</th>
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
      {showAddModal && isUnlocked && (
        <div className="cj-modal-overlay">
          <div className="cj-modal-content">
            <h2 className="cj-modal-title">Add Cash Entry</h2>

            {/* Type */}
            <div className="cj-modal-field">
              <label>Type</label>
              <div className="cj-modal-type-btns">
                <button
                  className={`cj-modal-type-btn${newType === TYPE_IN ? ' active-in' : ''}`}
                  onClick={() => { setNewType(TYPE_IN); setDescriptionKey(null); setResolvedNote(''); setResolvedRef(''); setDescDropdownOpen(false); setSubModal(null); }}>
                  Cash In
                </button>
                <button
                  className={`cj-modal-type-btn${newType === TYPE_OUT ? ' active-out' : ''}`}
                  onClick={() => { setNewType(TYPE_OUT); setDescriptionKey(null); setResolvedNote(''); setResolvedRef(''); setDescDropdownOpen(false); setSubModal(null); }}>
                  Cash Out
                </button>
              </div>
            </div>

            {/* Amount */}
            <div className="cj-modal-field">
              <label>Amount</label>
              <input type="number" className="cj-modal-input" placeholder="0.00"
                value={newAmount} onChange={e => setNewAmount(e.target.value)} min="0.01" step="0.01" />
              {newType === TYPE_OUT && (
                <div style={{ fontSize:'12px', color:'#6b7280', marginTop:'4px' }}>
                  Current cash balance: {fmt(Math.max(0, currentBalance))}
                </div>
              )}
            </div>

            {/* Description */}
            <div className="cj-modal-field">
              <label>Description</label>
              {newType === TYPE_IN ? (
                // Cash In — show dropdown with quick options + Cash From sub-modal option
                <div className="cj-desc-field-wrapper">
                  <button
                    className={`cj-desc-trigger${descDropdownOpen ? ' open' : ''}${resolvedNote ? ' has-value' : ''}`}
                    onClick={() => setDescDropdownOpen(o => !o)}
                  >
                    <span className="cj-desc-trigger-text">
                      {resolvedNote || (descriptionKey === 'cash_from' ? 'Cash from a person…' : 'Select description…')}
                    </span>
                    <span className="cj-desc-chevron">{descDropdownOpen ? '▲' : '▼'}</span>
                  </button>
                  {descDropdownOpen && (
                    <div className="cj-desc-dropdown">
                      {IN_OPTIONS.map(opt => (
                        <button
                          key={opt.key}
                          className={`cj-desc-dropdown-item${descriptionKey === opt.key ? ' selected' : ''}`}
                          onClick={() => { setDescDropdownOpen(false); handleDescriptionSelect(opt.key); }}
                        >
                          {opt.label}
                          {descriptionKey === opt.key && resolvedNote && ' ✓'}
                        </button>
                      ))}
                    </div>
                  )}
                  {resolvedNote && <div className="cj-desc-preview">{resolvedNote}</div>}
                </div>
              ) : (
                // Cash Out — tap to open sub-modal directly
                <button
                  className={`cj-desc-trigger${resolvedNote ? ' has-value' : ''}`}
                  onClick={() => { setDescriptionKey('withdrawal'); setSubModal('withdrawal'); }}
                >
                  <span className="cj-desc-trigger-text">{resolvedNote || 'Tap to fill description…'}</span>
                  <span className="cj-desc-chevron">›</span>
                </button>
              )}
            </div>

            <div className="cj-modal-buttons">
              <button className="cj-modal-cancel" onClick={closeAddModal}>Cancel</button>
              <button className="cj-modal-save" onClick={handleSaveEntry}
                disabled={isProcessing || !resolvedNote || !newAmount}>
                Save
              </button>
            </div>

            {/* Sub-modals */}
            {subModal === 'cash_from' && (
              <CashFromModal
                onSave={handleSubModalSave}
                onCancel={() => { setSubModal(null); setDescriptionKey(null); }}
              />
            )}
            {subModal === 'withdrawal' && (
              <WithdrawalSubModal
                onSave={handleSubModalSave}
                onCancel={() => { setSubModal(null); setDescriptionKey(null); }}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Edit Cash Entry Modal ── */}
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
