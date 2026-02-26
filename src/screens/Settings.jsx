import React, { useState, useEffect, useRef } from 'react';
import {
  Globe, Moon, Sun, Bell,
  ClipboardList, Wallet, X, Check, Plus, Trash2,
} from 'lucide-react';
import dataService from '../services/dataService';
import {
  scheduleCreditorReminders,
  cancelCreditorReminders,
  scheduleDebtReminders,
  cancelDebtReminders,
} from '../services/notificationService';
import { useCurrency } from '../hooks/useCurrency';
import UnrecordedSalesPage from './UnrecordedSalesPage';
import './Settings.css';

// ─────────────────────────────────────────────────────────────
// Translations
// ─────────────────────────────────────────────────────────────
const T = {
  en: {
    title: 'Settings',
    language: 'Language',
    appearance: 'Appearance & Display',
    darkMode: 'Dark Mode',
    lightMode: 'Light Mode',
    notifications: 'Notification Preferences',
    notifDebtReminder: 'Debt reminder',
    notifDebtReminderDesc: 'Remind debtor a day before due date of debt repayment',
    notifLowStock: 'Low stock alert',
    notifLowStockDesc: 'Notify when a product reaches 5 items in stock',
    notifDailySales: 'Daily sales milestone',
    notifDailySalesDesc: 'Notify when daily sales reaches an increment of $500',
    notifCreditorOwed: 'Creditor payment reminder',
    notifCreditorOwedDesc: 'Ring alarm at 8:30 AM, 12:00 PM and 4:30 PM reminding you of outstanding amounts owed to creditors',
    forgottenEntries: 'Enter Forgotten Records',
    forgottenEntriesNote: 'Records before the business uses this system, if need be, can be entered here.',
    forgottenSale: 'Unrecorded Sales',
    forgottenSaleDesc: 'Record past sales (cash or credit) with a manual date',
    forgottenCash: 'Unrecorded Cash Entry',
    forgottenCashDesc: 'Record a past cash in/out with a manual date',
    cancel: 'Cancel',
    saleDate: 'Sale Date',
    cashDate: 'Entry Date',
    addItem: 'Add Item',
    items: 'Products',
    total: 'Total',
    paymentType: 'Payment Type',
    cash: 'Cash',
    credit: 'Credit',
    description: 'Description',
    amount: 'Amount',
    type: 'Type',
    cashIn: 'Cash In',
    cashOut: 'Cash Out',
    recordSale: 'Record Sale',
    recordCredit: 'Record Credit',
    recordCash: 'Record Entry',
    qty: 'Qty',
    searchItem: 'Search item…',
    debtorName: 'Debtor Name',
    repayDate: 'Repayment Date',
    selectDebtor: 'Select debtor…',
    systemStartHint: 'Only dates before this system was first used are selectable.',
  },
};

const LANG_NAMES = { en: 'English', ki: 'Kiribati' };
const KIRIBATI_COMING_SOON = 'This language setting is still under development and will be available online soon.';

// ── Helpers ────────────────────────────────────────────────────────────────
const dateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const yesterdayStr = () => {
  const d = new Date(); d.setDate(d.getDate() - 1); return dateStr(d);
};

const getSystemStartDate = async () => {
  const stored = localStorage.getItem('ks_system_start_date');
  if (stored) return stored;
  try {
    const [sales, entries] = await Promise.all([
      dataService.getSales(),
      dataService.getCashEntries(),
    ]);
    const allDates = [
      ...(sales || []).map(s => s.date || s.createdAt),
      ...(entries || []).map(e => e.date || e.createdAt),
    ].filter(Boolean).map(d => new Date(d).getTime()).filter(t => !isNaN(t));
    if (allDates.length === 0) return yesterdayStr();
    const earliest = new Date(Math.min(...allDates));
    const result = dateStr(earliest);
    localStorage.setItem('ks_system_start_date', result);
    return result;
  } catch { return yesterdayStr(); }
};

// ─────────────────────────────────────────────────────────────
// Dropup component — opens ABOVE the trigger button
// ─────────────────────────────────────────────────────────────
function Dropup({ options, value, onSelect, placeholder = 'Please select description' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => o.key === value);

  return (
    <div className="st-dropup-wrapper" ref={ref}>
      {open && (
        <div className="st-dropup-list">
          <div className="st-dropup-placeholder">{placeholder}</div>
          {options.map(opt => (
            <div
              key={opt.key}
              className={`st-dropup-item${value === opt.key ? ' st-dropup-selected' : ''}`}
              onMouseDown={() => { onSelect(opt.key); setOpen(false); }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        className={`st-dropup-trigger${open ? ' st-dropup-open' : ''}${value ? ' st-dropup-has-value' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className={value ? '' : 'st-dropup-placeholder-text'}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="st-dropup-arrow">{open ? '▲' : '▼'}</span>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Purchase Cargo child modal — full-screen catalogue
// ─────────────────────────────────────────────────────────────
function PurchaseCargoModal({ onConfirm, onCancel }) {
  const [rows, setRows] = useState([{ id: 1, qty: '', description: '', costPrice: '' }]);
  const nextId = useRef(2);

  const addRow = () => {
    setRows(prev => [...prev, { id: nextId.current++, qty: '', description: '', costPrice: '' }]);
  };
  const removeRow = (id) => setRows(prev => prev.filter(r => r.id !== id));
  const updateRow = (id, field, val) => setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));

  const total = rows.reduce((sum, r) => {
    const q = parseFloat(r.qty) || 0;
    const c = parseFloat(r.costPrice) || 0;
    return sum + q * c;
  }, 0);

  const handleConfirm = () => {
    const valid = rows.filter(r => r.description.trim() && parseFloat(r.qty) > 0 && parseFloat(r.costPrice) >= 0);
    if (valid.length === 0) { alert('Please add at least one item with description and quantity.'); return; }
    onConfirm(valid.map(r => ({
      qty: parseFloat(r.qty),
      description: r.description.trim(),
      costPrice: parseFloat(r.costPrice) || 0,
      subtotal: (parseFloat(r.qty) || 0) * (parseFloat(r.costPrice) || 0),
    })), total);
  };

  return (
    <div className="st-cargo-overlay">
      <div className="st-cargo-modal">
        <div className="st-cargo-header">
          <h3>Purchase Details</h3>
          <button className="st-modal-close" onClick={onCancel}><X size={20}/></button>
        </div>
        <div className="st-cargo-body">
          <div className="st-cargo-col-headers">
            <span>Qty</span>
            <span>Item Description</span>
            <span>Cost Price ($)</span>
            <span>Subtotal</span>
            <span></span>
          </div>
          {rows.map(row => (
            <div key={row.id} className="st-cargo-row">
              <input
                type="number" className="st-cargo-input st-cargo-qty" placeholder="0"
                value={row.qty} min="0" step="1"
                onChange={e => updateRow(row.id, 'qty', e.target.value)}
              />
              <input
                type="text" className="st-cargo-input st-cargo-desc" placeholder="Item name…"
                value={row.description}
                onChange={e => updateRow(row.id, 'description', e.target.value)}
              />
              <input
                type="number" className="st-cargo-input st-cargo-cost" placeholder="0.00"
                value={row.costPrice} min="0" step="0.01"
                onChange={e => updateRow(row.id, 'costPrice', e.target.value)}
              />
              <span className="st-cargo-subtotal">
                ${((parseFloat(row.qty)||0)*(parseFloat(row.costPrice)||0)).toFixed(2)}
              </span>
              {rows.length > 1 && (
                <button className="st-cargo-remove" onClick={() => removeRow(row.id)}>
                  <Trash2 size={14}/>
                </button>
              )}
            </div>
          ))}
          <button className="st-cargo-add-row" onClick={addRow}>
            <Plus size={15}/> Add Next Product
          </button>
        </div>
        <div className="st-cargo-footer">
          <div className="st-cargo-total">
            Total Cost: <strong>{fmt(total)}</strong>
          </div>
          <div className="st-cargo-actions">
            <button className="st-btn-cancel" onClick={onCancel}>Cancel</button>
            <button className="st-btn-save" onClick={handleConfirm}>Confirm Items</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Unrecorded Sales Modal
// ─────────────────────────────────────────────────────────────
function ForgottenSaleModal({ t, onClose, onSaved }) {
  const [goods, setGoods]         = useState([]);
  const [debtors, setDebtors]     = useState([]);
  const [saleDate, setSaleDate]   = useState('');
  const [payType, setPayType]     = useState('cash');
  const [cart, setCart]           = useState([]);
  const [qtyInputs, setQtyInputs] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [debtorId, setDebtorId]   = useState('');
  const [repayDate, setRepayDate] = useState('');
  const [saving, setSaving]       = useState(false);
  const [maxDate]                 = useState('2026-02-22');

  useEffect(() => {
    dataService.getGoods().then(g => setGoods(g || []));
    dataService.getDebtors().then(d => setDebtors(d || []));

    // Subscribe to real-time goods changes from Firebase listener
    const unsubscribe = dataService.onGoodsChange((updatedGoods) => {
      setGoods(updatedGoods || []);
    });
    return () => unsubscribe();
  }, []);

  // Repayment date: min = saleDate, max = saleDate + 14 days
  const repayMin = saleDate || '';
  const repayMax = (() => {
    if (!saleDate) return '';
    const d = new Date(saleDate + 'T12:00:00');
    d.setDate(d.getDate() + 14);
    return dateStr(d);
  })();

  const smartSearch = (term) => {
    if (!term.trim()) return [];
    const t2 = term.toLowerCase();
    return goods.filter(g => {
      const w = (g.name || '').toLowerCase().split(/\s+/);
      return w[0]?.startsWith(t2) || (w[1] && w[1].startsWith(t2)) || (w[2] && w[2].startsWith(t2));
    }).slice(0, 8);
  };
  const searchResults = smartSearch(searchTerm);

  const addToCart = (good) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === good.id);
      if (ex) {
        const newQty = ex.qty + 1;
        setQtyInputs(q => ({ ...q, [good.id]: String(newQty) }));
        return prev.map(i => i.id === good.id ? { ...i, qty: newQty } : i);
      }
      setQtyInputs(q => ({ ...q, [good.id]: '1' }));
      return [...prev, { ...good, qty: 1 }];
    });
    setSearchTerm(''); setShowSearch(false);
  };

  const handleQtyChange = (id, raw) => {
    setQtyInputs(q => ({ ...q, [id]: raw }));
    const q = parseInt(raw, 10);
    if (!isNaN(q) && q >= 1) setCart(prev => prev.map(i => i.id === id ? { ...i, qty: q } : i));
  };

  const handleQtyBlur = (id) => {
    const raw = qtyInputs[id];
    const q = parseInt(raw, 10);
    if (isNaN(q) || q < 1) {
      setQtyInputs(inp => ({ ...inp, [id]: '1' }));
      setCart(prev => prev.map(i => i.id === id ? { ...i, qty: 1 } : i));
    }
  };

  const removeItem = (id) => {
    setCart(prev => prev.filter(i => i.id !== id));
    setQtyInputs(q => { const n = { ...q }; delete n[id]; return n; });
  };
  const total = cart.reduce((s, i) => s + (i.price || 0) * i.qty, 0);

  const handleSave = async () => {
    if (!saleDate) { alert('Please select a sale date.'); return; }
    if (cart.length === 0) { alert('Please add at least one item.'); return; }
    if (payType === 'credit' && !debtorId) { alert('Please select a debtor.'); return; }
    if (payType === 'credit' && !repayDate) { alert('Please enter a repayment date.'); return; }
    setSaving(true);
    try {
      const debtor = debtors.find(d => d.id === debtorId);
      const localNoonDate = new Date(saleDate + 'T12:00:00');
      await dataService.addSale({
        items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.qty, subtotal: i.price * i.qty })),
        total,
        paymentType: payType,
        customerName: debtor?.name || debtor?.customerName || '',
        customerPhone: debtor?.phone || '',
        debtorId: payType === 'credit' ? debtorId : null,
        repaymentDate: payType === 'credit' ? repayDate : '',
        isDebt: payType === 'credit',
        date: localNoonDate.toISOString(),
        isUnrecorded: true,
      });
      onSaved();
    } catch (e) { console.error(e); alert('Failed to save. Please try again.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="st-modal-overlay">
      <div className="st-modal">
        <div className="st-modal-header">
          <h3>{t.forgottenSale}</h3>
          <button className="st-modal-close" onClick={onClose}><X size={20}/></button>
        </div>
        <div className="st-modal-body">

          <div className="st-field">
            <label>{t.saleDate} *</label>
            <input type="date" max={maxDate} value={saleDate}
              onChange={e => { setSaleDate(e.target.value); setRepayDate(''); }} className="st-input" />
            <span className="st-field-hint">{t.systemStartHint}</span>
          </div>

          <div className="st-field">
            <label>{t.paymentType}</label>
            <div className="st-toggle-row">
              {['cash','credit'].map(p => (
                <button key={p} className={`st-toggle-btn${payType===p?' st-active':''}`}
                  onClick={() => setPayType(p)}>
                  {p === 'cash' ? t.cash : t.credit}
                </button>
              ))}
            </div>
          </div>

          {payType === 'credit' && (
            <>
              <div className="st-field">
                <label>{t.debtorName} *</label>
                <select className="st-input" value={debtorId} onChange={e => setDebtorId(e.target.value)}>
                  <option value="">{t.selectDebtor}</option>
                  {debtors.map(d => (
                    <option key={d.id} value={d.id}>{d.name || d.customerName}</option>
                  ))}
                </select>
              </div>
              <div className="st-field">
                <label>{t.repayDate} *</label>
                <input
                  type="date"
                  className="st-input"
                  value={repayDate}
                  min={repayMin}
                  max={repayMax}
                  disabled={!saleDate}
                  onChange={e => setRepayDate(e.target.value)}
                />
                {!saleDate && <span className="st-field-hint">Select a sale date first to enable repayment date.</span>}
                {saleDate && <span className="st-field-hint">Date range: {saleDate} to {repayMax} (sale date + 14 days)</span>}
              </div>
            </>
          )}

          <div className="st-field" style={{ position: 'relative' }}>
            <label>{t.addItem}</label>
            <input type="text" className="st-input" placeholder={t.searchItem}
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setShowSearch(true); }}
              onFocus={() => setShowSearch(true)}
              onBlur={() => setTimeout(() => setShowSearch(false), 200)} />
            {showSearch && searchResults.length > 0 && (
              <div className="st-search-dropdown">
                {searchResults.map(g => (
                  <div key={g.id} className="st-search-item" onMouseDown={() => addToCart(g)}>
                    <span>{g.name}</span>
                    <span className="st-search-price">{fmt((g.price||0))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <div className="st-cart">
              <div className="st-cart-header">
                <span>{t.items}</span><span>{t.qty}</span><span>Selling Price</span><span></span>
              </div>
              {cart.map(item => (
                <div key={item.id} className="st-cart-row">
                  <span className="st-cart-name">{item.name}</span>
                  <input
                    type="number" className="st-cart-qty"
                    value={qtyInputs[item.id] ?? String(item.qty)} min="1"
                    onChange={e => handleQtyChange(item.id, e.target.value)}
                    onBlur={() => handleQtyBlur(item.id)}
                    onFocus={e => e.target.select()}
                  />
                  <span className="st-cart-price">{fmt((item.price * item.qty))}</span>
                  <button className="st-cart-remove" onClick={() => removeItem(item.id)}>
                    <X size={14}/>
                  </button>
                </div>
              ))}
              <div className="st-cart-total">
                <span>{t.total}</span>
                <span className="st-cart-total-val">{fmt(total)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="st-modal-footer">
          <button className="st-btn-cancel" onClick={onClose}>{t.cancel}</button>
          <button className="st-btn-save" onClick={handleSave} disabled={saving}>
            {saving ? '…' : payType === 'credit' ? t.recordCredit : t.recordSale}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Unrecorded Cash Entry Modal
// Enhanced with From/Paid To fields, dropup descriptions,
// and Purchase Cargo child modal
// ─────────────────────────────────────────────────────────────
function ForgottenCashModal({ t, onClose, onSaved }) {
  const [cashDate, setCashDate]     = useState('');
  const [cashType, setCashType]     = useState('in');
  const [amount, setAmount]         = useState('');
  const [fromName, setFromName]     = useState('');   // Cash IN: lender name
  const [paidTo, setPaidTo]         = useState('');   // Cash OUT: receiver name
  const [descKey, setDescKey]       = useState('');   // selected dropup key
  const [cargoItems, setCargoItems] = useState([]);   // filled from PurchaseCargoModal
  const [cargoTotal, setCargoTotal] = useState(0);
  const [showCargo, setShowCargo]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [maxDate]                   = useState('2026-02-22');

  // Reset per-type fields when type changes
  const switchType = (type) => {
    setCashType(type);
    setDescKey('');
    setFromName('');
    setPaidTo('');
    setCargoItems([]);
    setCargoTotal(0);
    setAmount('');
  };

  // Cash IN description options
  const IN_OPTIONS = [
    { key: 'float',   label: 'Float'   },
    { key: 'capital', label: 'Capital' },
  ];

  // Cash OUT description options
  const OUT_OPTIONS = [
    { key: 'withdrawal', label: 'Withdrawal for personal use' },
    { key: 'cargo',      label: 'Purchases cargo'             },
    { key: 'bill',       label: 'Pay bill'                    },
  ];

  // Build the note string that will appear in CASH RECORD Description column
  const buildNote = () => {
    if (cashType === 'in') {
      const name = fromName.trim() || 'Lender';
      if (descKey === 'float')   return `From ${name} for additional FLOAT`;
      if (descKey === 'capital') return `From ${name} - additional capital contribution`;
    } else {
      const name = paidTo.trim() || 'Receiver';
      if (descKey === 'withdrawal') return `Paid to ${name} for personal withdrawal`;
      if (descKey === 'bill')       return `Paid to ${name} - bills`;
      if (descKey === 'cargo') {
        if (cargoItems.length > 0) return `Paid to ${name} to purchase cargo`;
        return ''; // not complete until cargo confirmed
      }
    }
    return '';
  };

  const note = buildNote();

  // When cargo option is selected, open the cargo child modal
  const handleDescSelect = (key) => {
    setDescKey(key);
    setCargoItems([]);
    setCargoTotal(0);
    if (key === 'cargo') setShowCargo(true);
  };

  const handleCargoConfirm = (items, total) => {
    setCargoItems(items);
    setCargoTotal(total);
    setAmount(total.toFixed(2));
    setShowCargo(false);
  };

  const handleSave = async () => {
    if (!cashDate) { alert('Please select an entry date.'); return; }
    const amt = descKey === 'cargo' ? cargoTotal : parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { alert('Please enter a valid amount.'); return; }
    if (!note) { alert('Please complete all description fields.'); return; }
    if (cashType === 'in' && !fromName.trim()) { alert('Please enter the lender\'s name.'); return; }
    if (cashType === 'out' && descKey !== 'cargo' && !paidTo.trim()) { alert('Please enter the receiver\'s name.'); return; }
    if (cashType === 'out' && descKey === 'cargo' && cargoItems.length === 0) { alert('Please add cargo items.'); return; }

    setSaving(true);
    try {
      const localNoonDate = new Date(cashDate + 'T12:00:00');

      if (cashType === 'out' && descKey === 'cargo') {
        // Save as a full Purchase record (which auto-creates Cash OUT)
        await dataService.addPurchase({
          supplierName: paidTo.trim() || 'Supplier',
          date: localNoonDate.toISOString(),
          items: cargoItems,
          total: cargoTotal,
          notes: note,
          isUnrecorded: true,
        });
      } else {
        await dataService.addCashEntry({
          type: cashType,
          amount: amt,
          note,
          date: localNoonDate.toISOString(),
          source: 'manual_backdated',
          isUnrecorded: true,
        });
      }
      onSaved();
    } catch (e) { console.error(e); alert('Failed to save. Please try again.'); }
    finally { setSaving(false); }
  };

  const cargoAmountDisplay = cargoItems.length > 0
    ? `${fmt(cargoTotal)} (${cargoItems.length} item${cargoItems.length !== 1 ? 's' : ''})`
    : null;

  return (
    <div className="st-modal-overlay">
      <div className="st-modal st-modal-sm">
        <div className="st-modal-header">
          <h3>{t.forgottenCash}</h3>
          <button className="st-modal-close" onClick={onClose}><X size={20}/></button>
        </div>
        <div className="st-modal-body">

          {/* Date */}
          <div className="st-field">
            <label>{t.cashDate} *</label>
            <input type="date" max={maxDate} value={cashDate}
              onChange={e => setCashDate(e.target.value)} className="st-input" />
            <span className="st-field-hint">{t.systemStartHint}</span>
          </div>

          {/* Type toggle */}
          <div className="st-field">
            <label>{t.type}</label>
            <div className="st-toggle-row">
              {['in','out'].map(tp => (
                <button key={tp} className={`st-toggle-btn${cashType===tp?' st-active':''}`}
                  onClick={() => switchType(tp)}>
                  {tp === 'in' ? t.cashIn : t.cashOut}
                </button>
              ))}
            </div>
          </div>

          {/* Amount — hidden for cargo (auto-set from cargo total) */}
          {!(cashType === 'out' && descKey === 'cargo') && (
            <div className="st-field">
              <label>{t.amount} *</label>
              <input type="number" className="st-input" placeholder="0.00"
                value={amount} onChange={e => setAmount(e.target.value)} min="0.01" step="0.01" />
            </div>
          )}

          {/* Cash IN: From field */}
          {cashType === 'in' && (
            <div className="st-field">
              <label>From: *</label>
              <input type="text" className="st-input"
                placeholder="Please enter name of lender"
                value={fromName} onChange={e => setFromName(e.target.value)} />
            </div>
          )}

          {/* Cash OUT: Paid to field */}
          {cashType === 'out' && (
            <div className="st-field">
              <label>Paid to: *</label>
              <input type="text" className="st-input"
                placeholder="Name of receiver/supplier"
                value={paidTo} onChange={e => setPaidTo(e.target.value)} />
            </div>
          )}

          {/* Description dropup */}
          <div className="st-field">
            <label>{t.description} *</label>
            <Dropup
              options={cashType === 'in' ? IN_OPTIONS : OUT_OPTIONS}
              value={descKey}
              onSelect={handleDescSelect}
            />
          </div>

          {/* Cargo summary if cargo was selected and confirmed */}
          {cashType === 'out' && descKey === 'cargo' && cargoAmountDisplay && (
            <div className="st-cargo-summary">
              <span>📦 {cargoAmountDisplay}</span>
              <button className="st-cargo-edit-btn" onClick={() => setShowCargo(true)}>Edit Items</button>
            </div>
          )}

          {/* Note preview */}
          {note && (
            <div className="st-note-preview">
              <span className="st-note-preview-label">Will appear as:</span>
              <span className="st-note-preview-text">"{note}"</span>
            </div>
          )}

        </div>

        <div className="st-modal-footer">
          <button className="st-btn-cancel" onClick={onClose}>{t.cancel}</button>
          <button className="st-btn-save" onClick={handleSave} disabled={saving}>
            {saving ? '…' : t.recordCash}
          </button>
        </div>

        {/* Purchase Cargo child modal */}
        {showCargo && (
          <PurchaseCargoModal
            onConfirm={handleCargoConfirm}
            onCancel={() => { setShowCargo(false); if (cargoItems.length === 0) setDescKey(''); }}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Android-style Setting Row
// ─────────────────────────────────────────────────────────────
function SettingRow({ label, desc, children }) {
  return (
    <div className="st-android-row">
      <div className="st-android-text">
        <span className="st-android-label">{label}</span>
        {desc && <span className="st-android-desc">{desc}</span>}
      </div>
      <div className="st-android-control">{children}</div>
    </div>
  );
}

function Section({ icon, title, children }) {
  return (
    <div className="st-section">
      <div className="st-section-header">
        {icon}
        <h3 className="st-section-title">{title}</h3>
      </div>
      <div className="st-section-body">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Settings component
// ─────────────────────────────────────────────────────────────
function Settings({ onSettingsChange }) {
  const { fmt } = useCurrency();
  const [lang, setLang]         = useState(() => localStorage.getItem('ks_lang') || 'en');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ks_darkMode') === 'true');
  const [notifDebtReminder, setNotifDebtReminder] = useState(false);
  const [notifLowStock, setNotifLowStock]         = useState(false);
  const [notifDailySales, setNotifDailySales]     = useState(false);
  const [notifCreditorOwed, setNotifCreditorOwed] = useState(false);
  const [loaded, setLoaded]     = useState(false);
  const [showForgotSale, setShowForgotSale] = useState(false);
  const [showForgotCash, setShowForgotCash] = useState(false);
  const [savedToast, setSavedToast]         = useState('');
  const [kiNotice, setKiNotice] = useState(false);

  const t = T[lang] || T.en;

  useEffect(() => {
    dataService.getSettings().then(s => {
      setLang(s.lang || 'en');
      setDarkMode(!!s.darkMode);
      setNotifDebtReminder(!!s.notifDebtReminder);
      setNotifLowStock(!!s.notifLowStock);
      setNotifDailySales(!!s.notifDailySales);
      setNotifCreditorOwed(!!s.notifCreditorOwed);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const autoSave = async (updates) => {
    const current = await dataService.getSettings();
    const merged = { ...current, ...updates };
    await dataService.saveSettings(merged);
    if (onSettingsChange) onSettingsChange(merged);
  };

  const handleLang = (code) => {
    if (code === 'ki') {
      setKiNotice(true);
      setTimeout(() => setKiNotice(false), 5000);
      return;
    }
    setLang(code);
    autoSave({ lang: code });
  };

  const handleDarkMode = (val) => { setDarkMode(val); autoSave({ darkMode: val }); };
  const handleToggle = (key, setter, current) => {
    const next = !current;
    setter(next);
    autoSave({ [key]: next });
    if (key === 'notifCreditorOwed') {
      if (next) scheduleCreditorReminders();
      else cancelCreditorReminders();
    }
    if (key === 'notifDebtReminder') {
      if (next) scheduleDebtReminders();
      else cancelDebtReminders();
    }
  };

  const flashSaved = (msg = 'Saved!') => {
    setSavedToast(msg);
    setTimeout(() => setSavedToast(''), 2000);
  };

  if (!loaded) {
    return (
      <div className="st-screen" style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
        <div style={{ color:'#888', fontSize:'14px' }}>Loading settings…</div>
      </div>
    );
  }

  return (
    <div className="st-screen">
      {savedToast && <div className="st-toast"><Check size={16}/> {savedToast}</div>}

      <Section icon={<Globe size={18}/>} title={t.language}>
        {Object.entries(LANG_NAMES).map(([code, name]) => (
          <SettingRow key={code} label={name}>
            <div className={`st-android-radio${lang === code ? ' st-radio-on' : ''}`}
              onClick={() => handleLang(code)}>
              <div className="st-radio-dot"/>
            </div>
          </SettingRow>
        ))}
        {kiNotice && <div className="st-ki-notice">ℹ️ {KIRIBATI_COMING_SOON}</div>}
      </Section>

      <Section icon={darkMode ? <Moon size={18}/> : <Sun size={18}/>} title={t.appearance}>
        <SettingRow
          label={darkMode ? t.darkMode : t.lightMode}
          desc={darkMode ? 'Dark background, light text' : 'Light background, dark text'}
        >
          <div className={`st-switch${darkMode ? ' st-switch-on' : ''}`}
            onClick={() => handleDarkMode(!darkMode)}>
            <div className="st-switch-thumb"/>
          </div>
        </SettingRow>
      </Section>

      <Section icon={<Bell size={18}/>} title={t.notifications}>
        {[
          { key: 'notifDebtReminder', val: notifDebtReminder, set: setNotifDebtReminder, label: t.notifDebtReminder, desc: t.notifDebtReminderDesc },
          { key: 'notifLowStock',     val: notifLowStock,     set: setNotifLowStock,     label: t.notifLowStock,     desc: t.notifLowStockDesc    },
          { key: 'notifDailySales',   val: notifDailySales,   set: setNotifDailySales,   label: t.notifDailySales,   desc: t.notifDailySalesDesc  },
          { key: 'notifCreditorOwed', val: notifCreditorOwed, set: setNotifCreditorOwed, label: t.notifCreditorOwed, desc: t.notifCreditorOwedDesc },
        ].map(({ key, val, set, label, desc }) => (
          <SettingRow key={key} label={label} desc={desc}>
            <div className={`st-switch${val ? ' st-switch-on' : ''}`}
              onClick={() => handleToggle(key, set, val)}>
              <div className="st-switch-thumb"/>
            </div>
          </SettingRow>
        ))}
      </Section>

      <Section icon={<ClipboardList size={18}/>} title={t.forgottenEntries}>
        <p className="st-forgotten-note">{t.forgottenEntriesNote}</p>

        <div className="st-forgotten-row">
          <div className="st-forgotten-info">
            <span className="st-notif-label">{t.forgottenSale}</span>
            <span className="st-notif-desc">{t.forgottenSaleDesc}</span>
          </div>
          <button className="st-forgotten-btn st-forgotten-sale"
            onClick={() => setShowForgotSale(true)}>
            <ClipboardList size={16}/> {t.forgottenSale}
          </button>
        </div>

        <div className="st-forgotten-row" style={{ marginTop: 12 }}>
          <div className="st-forgotten-info">
            <span className="st-notif-label">{t.forgottenCash}</span>
            <span className="st-notif-desc">{t.forgottenCashDesc}</span>
          </div>
          <button className="st-forgotten-btn st-forgotten-cash"
            onClick={() => setShowForgotCash(true)}>
            <Wallet size={16}/> {t.forgottenCash}
          </button>
        </div>
      </Section>

      {showForgotSale && (
        <div style={{position:'fixed',inset:0,zIndex:2000,background:'#f0fdfa',display:'flex',flexDirection:'column'}}>
          <UnrecordedSalesPage
            onClose={() => setShowForgotSale(false)}
            onSaved={() => { setShowForgotSale(false); flashSaved('Entry saved!'); }}
          />
        </div>
      )}
      {showForgotCash && (
        <ForgottenCashModal t={t}
          onClose={() => setShowForgotCash(false)}
          onSaved={() => { setShowForgotCash(false); flashSaved('Entry saved!'); }}
        />
      )}
    </div>
  );
}

export default Settings;
