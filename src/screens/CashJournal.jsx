import React, { useState, useEffect } from 'react';
import dataService from '../services/dataService';
import './CashJournal.css';

// ── Entry type constants ────────────────────────────────────────────────────
const TYPE_IN  = 'in';
const TYPE_OUT = 'out';

function CashJournal() {
  const [entries, setEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);

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

  // ── Add Entry modal ─────────────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [newType, setNewType] = useState(TYPE_IN);
  const [newAmount, setNewAmount] = useState('');
  const [newNote, setNewNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // ── Data ──────────────────────────────────────────────────────────────────
  useEffect(() => { loadEntries(); }, []);
  useEffect(() => { applyFilters(); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, appliedTypeFilter, appliedDateFilter, appliedSelectedDate, appliedStartDate, appliedEndDate]);

  const loadEntries = async () => {
    // Pull cash sales from Sales Register (cash payment type only)
    const sales = await dataService.getSales();
    const cashSaleEntries = (sales || [])
      .filter(s => (s.paymentType === 'cash' || s.payment_type === 'cash') && s.status !== 'voided')
      .map(s => ({
        id: s.id,
        source: 'sale',
        type: TYPE_IN,
        amount: parseFloat(s.total_amount ?? s.total ?? 0),
        note: s.items && s.items.length > 0
          ? s.items.map(i => i.name).join(', ')
          : 'Cash Sale',
        date: s.date || s.timestamp || s.createdAt,
      }));

    // Pull manual cash journal entries from local storage
    const manualEntries = await dataService.getCashEntries();

    // Merge and sort oldest → newest (for running balance calculation)
    const all = [...cashSaleEntries, ...(manualEntries || [])]
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Compute cumulative running balance
    let running = 0;
    const withBalance = all.map(entry => {
      running += entry.type === TYPE_IN ? entry.amount : -entry.amount;
      return { ...entry, balance: running };
    });

    // Reverse so newest is at top for display
    setEntries([...withBalance].reverse());
  };

  const resolveDate = (entry) => {
    const raw = entry.date;
    if (!raw) return null;
    if (typeof raw === 'object' && raw.seconds) return new Date(raw.seconds * 1000);
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  };

  const toMidnight = (d) => { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; };

  const applyFilters = () => {
    let filtered = [...entries];

    if (appliedTypeFilter !== 'all')
      filtered = filtered.filter(e => e.type === appliedTypeFilter);

    const today    = toMidnight(new Date());
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    if (appliedDateFilter === 'today')
      filtered = filtered.filter(e => { const d = resolveDate(e); return d && d >= today && d < tomorrow; });

    if (appliedDateFilter === 'single' && appliedSelectedDate) {
      const s = toMidnight(new Date(appliedSelectedDate)), e = new Date(s); e.setDate(e.getDate() + 1);
      filtered = filtered.filter(entry => { const d = resolveDate(entry); return d && d >= s && d < e; });
    }

    if (appliedDateFilter === 'range' && appliedStartDate && appliedEndDate) {
      const s = toMidnight(new Date(appliedStartDate));
      const e = new Date(toMidnight(new Date(appliedEndDate))); e.setDate(e.getDate() + 1);
      filtered = filtered.filter(entry => { const d = resolveDate(entry); return d && d >= s && d < e; });
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

  // ── Add manual entry ──────────────────────────────────────────────────────
  const handleSaveEntry = async () => {
    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount <= 0) { alert('Please enter a valid amount.'); return; }
    if (!newNote.trim()) { alert('Please enter a description.'); return; }

    setIsProcessing(true);
    try {
      await dataService.addCashEntry({
        type: newType,
        amount,
        note: newNote.trim(),
        date: new Date().toISOString(),
        source: 'manual',
      });
      setShowAddModal(false);
      setNewAmount('');
      setNewNote('');
      setNewType(TYPE_IN);
      await loadEntries();
    } catch (err) {
      console.error('Error saving cash entry:', err);
      alert('Failed to save entry. Please try again.');
    } finally {
      setIsProcessing(false);
    }
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
    const typeMap = { all: 'All Entries', in: 'Cash In', out: 'Cash Out' };
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
    if (!d) return { date: 'N/A', time: 'N/A' };
    return {
      date: d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    };
  };

  const totalRecords = filteredEntries.length;
  // Net balance = sum of filtered entries with their signed amounts
  const netBalance = filteredEntries.reduce(
    (sum, e) => sum + (e.type === TYPE_IN ? e.amount : -e.amount), 0
  );
  const btnLabel = !showFilters ? 'Filter Entries' : showApply ? 'Apply Filter' : 'Close Filter';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="cj-record">

      {/* ── Filter panel ── */}
      {showFilters && (
        <div className="cj-filters-section">
          <div className="cj-filter-group">
            <label>Entry Type</label>
            <div className="cj-filter-buttons">
              {[['all', 'All Entries'], [TYPE_IN, 'Cash In'], [TYPE_OUT, 'Cash Out']].map(([val, lbl]) => (
                <button key={val} className={`cj-filter-btn${typeFilter === val ? ' active' : ''}`}
                  onClick={() => setTypeFilter(val)}>{lbl}</button>
              ))}
            </div>
          </div>
          <div className="cj-filter-group">
            <label>Date Filter</label>
            <div className="cj-filter-buttons">
              {[['today', 'Today'], ['single', 'Single Date'], ['range', 'Date Range']].map(([val, lbl]) => (
                <button key={val} className={`cj-filter-btn${dateFilter === val ? ' active' : ''}`}
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
                  <input type="date" value={endDate} min={startDate || undefined} max={getTodayStr()}
                    disabled={!startDate} onChange={e => setEndDate(e.target.value)}
                    className={`cj-date-input${!startDate ? ' cj-date-input-disabled' : ''}`} />
                </div>
              </div>
              {!startDate && <span className="cj-date-range-hint">Select a "From" date first</span>}
            </div>
          )}
        </div>
      )}

      {/* ── Sticky bar ── */}
      <div className="cj-sticky-bar">
        <div className="cj-top-row">
          <button className="cj-filter-action-btn" onClick={handleFilterButtonClick}>{btnLabel}</button>
          <button className="cj-add-btn" onClick={() => setShowAddModal(true)}>+ Add Entry</button>
        </div>
        <h3 className="cj-table-title">{getTableTitle()}</h3>
        <div className="cj-stats-boxes">
          <div className="cj-stat-box cj-stat-purple">
            <div className="cj-stat-label">Total Records</div>
            <div className="cj-stat-value">{totalRecords}</div>
          </div>
          <div className={`cj-stat-box ${netBalance >= 0 ? 'cj-stat-green' : 'cj-stat-red'}`}>
            <div className="cj-stat-label">Net Balance</div>
            <div className="cj-stat-value">{netBalance < 0 ? '-' : ''}${Math.abs(netBalance).toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="cj-table-wrapper">
        <table className="cj-table">
          <thead className="cj-thead">
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Description</th>
              <th className="cj-col-right">Amount</th>
              <th className="cj-col-center">Type</th>
              <th className="cj-col-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.length === 0 ? (
              <tr><td colSpan="6" className="cj-empty-cell">No entries found</td></tr>
            ) : (
              filteredEntries.map(entry => {
                const { date, time } = formatDateTime(entry);
                return (
                  <tr key={entry.id} className="cj-row">
                    <td>{date}</td>
                    <td>{time}</td>
                    <td className="cj-note-cell">{entry.note || '—'}</td>
                    <td className={`cj-col-right cj-amount ${entry.type === TYPE_IN ? 'cj-in' : 'cj-out'}`}>
                      {entry.type === TYPE_IN ? '+' : '-'}${entry.amount.toFixed(2)}
                    </td>
                    <td className="cj-col-center">
                      <span className={`cj-type-badge cj-badge-${entry.type}`}>
                        {entry.type === TYPE_IN ? 'IN' : 'OUT'}
                      </span>
                    </td>
                    <td className={`cj-col-right cj-balance ${entry.balance < 0 ? 'cj-balance-neg' : ''}`}>
                      {entry.balance < 0 ? '-' : ''}${Math.abs(entry.balance).toFixed(2)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Add Entry modal ── */}
      {showAddModal && (
        <div className="cj-modal-overlay">
          <div className="cj-modal-content">
            <h2 className="cj-modal-title">Add Cash Entry</h2>

            <div className="cj-modal-field">
              <label>Type</label>
              <div className="cj-modal-type-btns">
                <button
                  className={`cj-modal-type-btn${newType === TYPE_IN ? ' active-in' : ''}`}
                  onClick={() => setNewType(TYPE_IN)}>Cash In</button>
                <button
                  className={`cj-modal-type-btn${newType === TYPE_OUT ? ' active-out' : ''}`}
                  onClick={() => setNewType(TYPE_OUT)}>Cash Out</button>
              </div>
            </div>

            <div className="cj-modal-field">
              <label>Amount</label>
              <input
                type="number"
                className="cj-modal-input"
                placeholder="0.00"
                value={newAmount}
                onChange={e => setNewAmount(e.target.value)}
                min="0.01"
                step="0.01"
              />
            </div>

            <div className="cj-modal-field">
              <label>Description / Note</label>
              <input
                type="text"
                className="cj-modal-input"
                placeholder="e.g. Opening balance, Expense…"
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
              />
            </div>

            <div className="cj-modal-buttons">
              <button className="cj-modal-cancel" onClick={() => { setShowAddModal(false); setNewAmount(''); setNewNote(''); setNewType(TYPE_IN); }}>
                Cancel
              </button>
              <button className="cj-modal-save" onClick={handleSaveEntry} disabled={isProcessing}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default CashJournal;
