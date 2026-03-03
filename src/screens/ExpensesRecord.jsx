import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useValidation, ValidationNote, errorBorder } from '../utils/validation.jsx';
import dataService from '../services/dataService';
import { useCurrency } from '../hooks/useCurrency';
import './ExpensesRecord.css';

// ── Category definitions ───────────────────────────────────────────────────────
const CATEGORY_GROUPS = [
  {
    group: 'Operating Expenses',
    items: [
      'Utilities',
      'Rent',
      'Transport/Fuel',
      'Maintenance/Repairs',
      'Shop Supplies',
      'Marketing/Advertising',
      'Fees/Licenses',
      'Security',
      'Communication',
      'Wages',
    ],
  },
  {
    group: 'Owner & Community',
    items: ['Owner Withdrawal/Drawings', 'Donation/Church/Community Support'],
  },
  {
    group: 'Bank & Loan',
    items: ['Bank Charges', 'Loan Repayment', 'Interest'],
  },
  {
    group: 'Adjustments',
    items: ['Cash Shortage', 'Cash Over (Correction)', 'Damaged Money Replaced', 'Other Adjustment'],
  },
  {
    group: 'Other',
    items: ['Other'],
  },
];
const ALL_CATEGORIES = CATEGORY_GROUPS.flatMap(g => g.items);
const QUICK_CATS = ['Utilities', 'Wages'];

const PAYMENT_METHODS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'mobile_money',  label: 'Mobile Money' },
  { value: 'check',         label: 'Check' },
  { value: 'other',         label: 'Other' },
];

function methodBadgeClass(m) {
  if (m === 'cash')          return 'er-method-badge er-method-cash';
  if (m === 'bank_transfer') return 'er-method-badge er-method-bank';
  if (m === 'mobile_money')  return 'er-method-badge er-method-mobile';
  if (m === 'check')         return 'er-method-badge er-method-check';
  return 'er-method-badge er-method-other';
}
function methodLabel(m) {
  return PAYMENT_METHODS.find(p => p.value === m)?.label || m || 'Cash';
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Category picker modal ──────────────────────────────────────────────────────
function CategoryModal({ selected, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const filtered = search.trim()
    ? CATEGORY_GROUPS.map(g => ({ ...g, items: g.items.filter(i => i.toLowerCase().includes(search.toLowerCase())) })).filter(g => g.items.length > 0)
    : CATEGORY_GROUPS;

  return (
    <div className="er-cat-modal-overlay" onClick={onClose}>
      <div className="er-cat-modal" onClick={e => e.stopPropagation()}>
        <div className="er-modal-header" style={{ borderRadius: '20px 20px 0 0' }}>
          <h2>Select Category</h2>
          <button className="er-modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <input
          className="er-cat-search"
          placeholder="Search category…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
        <div className="er-cat-list">
          {filtered.map(g => (
            <div key={g.group}>
              <div className="er-cat-group-label">{g.group}</div>
              {g.items.map(item => (
                <button
                  key={item}
                  className={`er-cat-item${selected === item ? ' selected' : ''}`}
                  onClick={() => { onSelect(item); onClose(); }}
                >
                  {item}
                </button>
              ))}
            </div>
          ))}
        </div>
        {selected && (
          <button className="er-cat-clear" onClick={() => { onSelect(''); onClose(); }}>
            ✕ Clear Category Filter
          </button>
        )}
      </div>
    </div>
  );
}

// ── Add Expense Modal ──────────────────────────────────────────────────────────
function AddExpenseModal({ onSave, onClose }) {
  const { fmt } = useCurrency();
  const { fieldErrors, showError, clearFieldError } = useValidation();

  const [date, setDate]                   = useState(todayStr());
  const [category, setCategory]           = useState('');
  const [amount, setAmount]               = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [payee, setPayee]                 = useState('');
  const [note, setNote]                   = useState('');
  const [saving, setSaving]               = useState(false);
  const [showCatModal, setShowCatModal]   = useState(false);

  const handleSave = async () => {
    if (!date)              return showError('ex_date',   'Date is required');
    if (!category)          return showError('ex_cat',    'Category is required');
    if (!amount || parseFloat(amount) <= 0) return showError('ex_amount', 'Enter a valid amount');
    if (category === 'Other' && !note.trim()) return showError('ex_note', 'Note is required when category is "Other"');

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const expense = {
        date,
        amount: parseFloat(amount),
        category,
        paymentMethod,
        payee: payee.trim(),
        note: note.trim(),
        createdAt: now,
        updatedAt: now,
      };
      await dataService.addExpense(expense);
      onSave();
    } catch (e) {
      console.error(e);
      showError('ex_date', 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="er-modal-overlay">
      <div className="er-modal-content">
        <div className="er-modal-header">
          <h2>💸 Add Expense</h2>
          <button className="er-modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="er-modal-body">

          {/* Date */}
          <div className="er-field">
            <label className="er-label">Date *</label>
            <input type="date" className="er-input" data-field="ex_date"
              style={errorBorder('ex_date', fieldErrors)}
              value={date} max={todayStr()}
              onChange={e => { setDate(e.target.value); clearFieldError('ex_date'); }} />
            <ValidationNote field="ex_date" errors={fieldErrors} />
          </div>

          {/* Category */}
          <div className="er-field">
            <label className="er-label">Category *</label>
            <button
              data-field="ex_cat"
              style={{ ...errorBorder('ex_cat', fieldErrors), textAlign: 'left', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid var(--border,#e5e7eb)', background: 'var(--surface,white)', fontSize: '14px', cursor: 'pointer', color: category ? 'var(--text-primary,#111)' : '#9ca3af' }}
              onClick={() => { setShowCatModal(true); clearFieldError('ex_cat'); }}
            >
              {category || 'Select category…'}
            </button>
            <ValidationNote field="ex_cat" errors={fieldErrors} />
          </div>

          {/* Amount */}
          <div className="er-field">
            <label className="er-label">Amount *</label>
            <input type="number" className="er-input" data-field="ex_amount"
              style={errorBorder('ex_amount', fieldErrors)}
              placeholder="0.00" min="0" step="0.01"
              value={amount}
              onChange={e => { setAmount(e.target.value); clearFieldError('ex_amount'); }} />
            <ValidationNote field="ex_amount" errors={fieldErrors} />
          </div>

          {/* Payment Method */}
          <div className="er-field">
            <label className="er-label">Payment Method</label>
            <select className="er-input er-select" value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}>
              {PAYMENT_METHODS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Payee */}
          <div className="er-field">
            <label className="er-label">Payee (optional)</label>
            <input type="text" className="er-input"
              placeholder="Who was paid?"
              value={payee} onChange={e => setPayee(e.target.value)} />
          </div>

          {/* Note */}
          <div className="er-field">
            <label className="er-label">Note {category === 'Other' ? '*' : '(optional)'}</label>
            <textarea className="er-input er-textarea" data-field="ex_note"
              style={errorBorder('ex_note', fieldErrors)}
              placeholder="Description or reason…"
              value={note}
              onChange={e => { setNote(e.target.value); clearFieldError('ex_note'); }} />
            <ValidationNote field="ex_note" errors={fieldErrors} />
          </div>

        </div>
        <div className="er-modal-footer">
          <button className="er-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="er-btn-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Expense'}
          </button>
        </div>
      </div>
      {showCatModal && (
        <CategoryModal
          selected={category}
          onSelect={cat => { setCategory(cat); clearFieldError('ex_cat'); }}
          onClose={() => setShowCatModal(false)}
        />
      )}
    </div>
  );
}

// ── Expense Detail / Edit Modal ────────────────────────────────────────────────
function ExpenseDetailModal({ expense, onClose, onSaved, onDeleted }) {
  const { fmt } = useCurrency();
  const editable = (() => {
    const ts = expense.createdAt || expense.date;
    if (!ts) return false;
    return (new Date() - new Date(ts)) / (1000 * 60) <= 30;
  })();

  const [date, setDate]                   = useState(expense.date || todayStr());
  const [category, setCategory]           = useState(expense.category || '');
  const [amount, setAmount]               = useState(String(expense.amount || ''));
  const [paymentMethod, setPaymentMethod] = useState(expense.paymentMethod || 'cash');
  const [payee, setPayee]                 = useState(expense.payee || '');
  const [note, setNote]                   = useState(expense.note || '');
  const [saving, setSaving]               = useState(false);
  const [deleting, setDeleting]           = useState(false);
  const [showCatModal, setShowCatModal]   = useState(false);

  const handleDelete = async () => {
    if (!window.confirm('Delete this expense? This cannot be undone.')) return;
    setDeleting(true);
    try { await dataService.deleteExpense(expense.id); onDeleted(); }
    catch (e) { alert(e.message); }
    finally { setDeleting(false); }
  };

  const handleSave = async () => {
    if (!date)            { alert('Date is required'); return; }
    if (!category)        { alert('Category is required'); return; }
    if (!amount || parseFloat(amount) <= 0) { alert('Enter a valid amount'); return; }
    if (category === 'Other' && !note.trim()) { alert('Note is required when category is "Other"'); return; }
    setSaving(true);
    try {
      await dataService.updateExpense(expense.id, {
        date, category, amount: parseFloat(amount), paymentMethod, payee: payee.trim(), note: note.trim(),
      });
      onSaved();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const d = new Date(expense.date || expense.createdAt || 0);
  const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="er-modal-overlay">
      <div className="er-modal-content">
        <div className="er-modal-header">
          <h2>{editable ? '✏️ Edit Expense' : 'Expense Details'}</h2>
          <button className="er-modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="er-modal-body">
          {!editable ? (
            <>
              <div className="er-detail-row"><span>Date</span><span>{dateStr}</span></div>
              <div className="er-detail-row"><span>Category</span><span>{expense.category}</span></div>
              <div className="er-detail-row"><span>Amount</span><span className="er-detail-amount">{fmt(expense.amount || 0)}</span></div>
              <div className="er-detail-row"><span>Method</span><span><span className={methodBadgeClass(expense.paymentMethod)}>{methodLabel(expense.paymentMethod)}</span></span></div>
              {expense.payee && <div className="er-detail-row"><span>Payee</span><span>{expense.payee}</span></div>}
              {expense.note && <div className="er-detail-row"><span>Note</span><span>{expense.note}</span></div>}
            </>
          ) : (
            <>
              <div className="er-field">
                <label className="er-label">Date *</label>
                <input type="date" className="er-input" value={date} max={todayStr()} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="er-field">
                <label className="er-label">Category *</label>
                <button
                  style={{ textAlign: 'left', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid var(--border,#e5e7eb)', background: 'var(--surface,white)', fontSize: '14px', cursor: 'pointer', color: category ? 'var(--text-primary,#111)' : '#9ca3af' }}
                  onClick={() => setShowCatModal(true)}
                >
                  {category || 'Select category…'}
                </button>
              </div>
              <div className="er-field">
                <label className="er-label">Amount *</label>
                <input type="number" className="er-input" placeholder="0.00" min="0" step="0.01"
                  value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              <div className="er-field">
                <label className="er-label">Payment Method</label>
                <select className="er-input er-select" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="er-field">
                <label className="er-label">Payee</label>
                <input type="text" className="er-input" placeholder="Who was paid?" value={payee} onChange={e => setPayee(e.target.value)} />
              </div>
              <div className="er-field">
                <label className="er-label">Note {category === 'Other' ? '*' : '(optional)'}</label>
                <textarea className="er-input er-textarea" placeholder="Description…" value={note} onChange={e => setNote(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <div className="er-modal-footer" style={{ flexDirection: 'column', gap: '8px' }}>
          {editable ? (
            <>
              <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                <button className="er-btn-cancel" onClick={onClose}>Cancel</button>
                <button className="er-btn-save" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Update'}
                </button>
              </div>
              <button className="er-btn-delete" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete Expense'}
              </button>
            </>
          ) : (
            <button className="er-btn-save" onClick={onClose}>Close</button>
          )}
        </div>
      </div>
      {showCatModal && (
        <CategoryModal selected={category} onSelect={setCategory} onClose={() => setShowCatModal(false)} />
      )}
    </div>
  );
}

// ── Main ExpensesRecord Screen ─────────────────────────────────────────────────
function ExpensesRecord() {
  const { fmt } = useCurrency();

  const [expenses, setExpenses]           = useState([]);
  const [filtered, setFiltered]           = useState([]);
  const [showFilters, setShowFilters]     = useState(false);
  const [showAddModal, setShowAddModal]   = useState(false);
  const [viewExpense, setViewExpense]     = useState(null);
  const [showMoreCats, setShowMoreCats]   = useState(false);

  // Filter state (pending, not yet applied)
  const [catFilter, setCatFilter]         = useState('all');
  const [dateFilter, setDateFilter]       = useState('today');
  const [selectedDate, setSelectedDate]   = useState('');
  const [startDate, setStartDate]         = useState('');
  const [endDate, setEndDate]             = useState('');

  // Applied filter state
  const [appliedCat, setAppliedCat]       = useState('all');
  const [appliedDate, setAppliedDate]     = useState('today');
  const [appliedSelDate, setAppliedSelDate] = useState('');
  const [appliedStart, setAppliedStart]   = useState('');
  const [appliedEnd, setAppliedEnd]       = useState('');

  useEffect(() => { loadExpenses(); }, []);
  useEffect(() => {
    const handleVisibility = () => { if (!document.hidden) loadExpenses(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { applyFilters(); }, [expenses, appliedCat, appliedDate, appliedSelDate, appliedStart, appliedEnd]);

  const loadExpenses = async () => {
    const data = await dataService.getExpenses();
    const sorted = (data || []).sort((a, b) =>
      new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
    setExpenses(sorted);
  };

  const resolveDate = (e) => {
    const raw = e.date || e.createdAt;
    if (!raw) return null;
    if (typeof raw === 'object' && raw.seconds) return new Date(raw.seconds * 1000);
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  };
  const toMidnight = (d) => { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; };

  const applyFilters = () => {
    let f = [...expenses];
    if (appliedCat !== 'all') f = f.filter(e => e.category === appliedCat);
    const today = toMidnight(new Date());
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    if (appliedDate === 'today')
      f = f.filter(e => { const d = resolveDate(e); return d && d >= today && d < tomorrow; });
    if (appliedDate === 'single' && appliedSelDate) {
      const s = toMidnight(new Date(appliedSelDate)), e2 = new Date(s); e2.setDate(e2.getDate() + 1);
      f = f.filter(e => { const d = resolveDate(e); return d && d >= s && d < e2; });
    }
    if (appliedDate === 'range' && appliedStart && appliedEnd) {
      const s = toMidnight(new Date(appliedStart));
      const e2 = new Date(toMidnight(new Date(appliedEnd))); e2.setDate(e2.getDate() + 1);
      f = f.filter(e => { const d = resolveDate(e); return d && d >= s && d < e2; });
    }
    setFiltered(f);
  };

  const handleApplyFilters = () => {
    setAppliedCat(catFilter);
    setAppliedDate(dateFilter);
    setAppliedSelDate(selectedDate);
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
    setShowFilters(false);
  };

  const formatDisplayDate = (ds) =>
    new Date(ds).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const isYesterday = (ds) => {
    if (!ds) return false;
    const y = new Date(); y.setDate(y.getDate() - 1);
    return toMidnight(new Date(ds)).getTime() === toMidnight(y).getTime();
  };
  const getTableTitle = () => {
    if (appliedDate === 'today') return 'Expenses Today';
    if (appliedDate === 'single' && appliedSelDate) {
      if (isYesterday(appliedSelDate)) return 'Expenses Yesterday';
      return `Expenses on ${formatDisplayDate(appliedSelDate)}`;
    }
    if (appliedDate === 'range' && appliedStart && appliedEnd)
      return `Expenses from ${formatDisplayDate(appliedStart)} to ${formatDisplayDate(appliedEnd)}`;
    return 'Expenses Today';
  };
  const formatDate = (e) => {
    const d = resolveDate(e);
    if (!d) return 'N/A';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Summary
  const totalRecords = filtered.length;
  const cashSpent    = filtered.filter(e => (e.paymentMethod || 'cash') === 'cash').reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const nonCash      = filtered.filter(e => (e.paymentMethod || 'cash') !== 'cash').reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  // Quick cat filter buttons
  const isMoreActive = appliedCat !== 'all' && !QUICK_CATS.includes(appliedCat);

  return (
    <div className="er-record">

      {/* ── Sticky top bar ── */}
      <div className="er-sticky-bar">
        <div className="er-top-row">
          <button className="er-filter-action-btn er-filter-toggle-btn"
            onClick={() => setShowFilters(v => !v)}>
            {showFilters ? 'Close Filter ▲' : 'Filter ▼'}
          </button>
          <button className="er-filter-action-btn er-add-btn"
            onClick={() => setShowAddModal(true)}>
            <Plus size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            Add Expense
          </button>
        </div>

        {/* ── Filter panel ── */}
        {showFilters && (
          <div className="er-filters-section">

            {/* Category filter */}
            <div className="er-filter-group">
              <label>CATEGORY FILTER</label>
              <div className="er-filter-buttons">
                <button
                  className={`er-filter-btn${catFilter === 'all' ? ' active' : ''}`}
                  onClick={() => setCatFilter('all')}>
                  All Expenses
                </button>
                {QUICK_CATS.map(cat => (
                  <button key={cat}
                    className={`er-filter-btn${catFilter === cat ? ' active' : ''}`}
                    onClick={() => setCatFilter(cat)}>
                    {cat}
                  </button>
                ))}
                <button
                  className={`er-filter-btn${!['all', ...QUICK_CATS].includes(catFilter) ? ' more-active' : ''}`}
                  onClick={() => setShowMoreCats(true)}>
                  {!['all', ...QUICK_CATS].includes(catFilter) ? catFilter : 'More…'}
                </button>
              </div>
            </div>

            {/* Date filter */}
            <div className="er-filter-group">
              <label>DATE FILTER</label>
              <div className="er-filter-buttons">
                {[['today', 'Today'], ['single', 'Single Date'], ['range', 'Date Range']].map(([val, lbl]) => (
                  <button key={val}
                    className={`er-filter-btn${dateFilter === val ? ' active' : ''}`}
                    onClick={() => setDateFilter(val)}>
                    {lbl}
                  </button>
                ))}
              </div>
              {dateFilter === 'single' && (
                <input type="date" className="er-date-input"
                  value={selectedDate} max={todayStr()}
                  onChange={e => setSelectedDate(e.target.value)} />
              )}
              {dateFilter === 'range' && (
                <div className="er-date-range-inputs">
                  <div className="er-date-range-field">
                    <span className="er-date-range-label">From</span>
                    <input type="date" className="er-date-input" value={startDate} max={todayStr()} onChange={e => setStartDate(e.target.value)} />
                  </div>
                  <div className="er-date-range-field">
                    <span className="er-date-range-label">To</span>
                    <input type="date" className="er-date-input" value={endDate} max={todayStr()} onChange={e => setEndDate(e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            <button className="er-filter-action-btn er-add-btn" style={{ alignSelf: 'flex-end' }}
              onClick={handleApplyFilters}>
              Apply Filters
            </button>
          </div>
        )}

        {/* ── Summary cards ── */}
        <div className="er-summary-cards">
          <div className="er-summary-card">
            <div className="er-summary-label">Total Records</div>
            <div className="er-summary-value">{totalRecords}</div>
          </div>
          <div className="er-summary-card">
            <div className="er-summary-label">Cash Spent</div>
            <div className="er-summary-value cash">{fmt(cashSpent)}</div>
          </div>
          <div className="er-summary-card">
            <div className="er-summary-label">Non-Cash</div>
            <div className="er-summary-value noncash">{fmt(nonCash)}</div>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="er-table-section">
        <div className="er-table-title">{getTableTitle()}</div>
        {filtered.length === 0 ? (
          <div className="er-empty">No expenses found for this filter.</div>
        ) : (
          <div className="er-table-wrap">
            <table className="er-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th className="right">Amount</th>
                  <th>Note / Payee</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id} onClick={() => setViewExpense(e)}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '12px' }}>{formatDate(e)}</td>
                    <td className="er-td-cat">
                      <div>{e.category}</div>
                      <span className={methodBadgeClass(e.paymentMethod)}>{methodLabel(e.paymentMethod)}</span>
                    </td>
                    <td className="er-td-amount">{fmt(e.amount || 0)}</td>
                    <td className="er-td-note">{e.note || e.payee || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showAddModal && (
        <AddExpenseModal
          onSave={() => { setShowAddModal(false); loadExpenses(); }}
          onClose={() => setShowAddModal(false)}
        />
      )}
      {viewExpense && (
        <ExpenseDetailModal
          expense={viewExpense}
          onClose={() => setViewExpense(null)}
          onSaved={() => { setViewExpense(null); loadExpenses(); }}
          onDeleted={() => { setViewExpense(null); loadExpenses(); }}
        />
      )}
      {showMoreCats && (
        <CategoryModal
          selected={catFilter}
          onSelect={cat => setCatFilter(cat || 'all')}
          onClose={() => setShowMoreCats(false)}
        />
      )}
    </div>
  );
}

export default ExpensesRecord;
