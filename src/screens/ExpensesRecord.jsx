import { APP_NAME } from '../utils/appConfig';
import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useValidation, ValidationNote, errorBorder } from '../utils/validation.jsx';
import dataService from '../services/dataService';
import { useCurrency } from '../hooks/useCurrency';
import './ExpensesRecord.css';

// ── Category definitions ───────────────────────────────────────────────────────
const SYSTEM_FEE_CAT = `${APP_NAME} System's weekly fee`;
const CATEGORY_GROUPS = [
  {
    group: 'Operating',
    items: ['Utilities', 'Rent', 'Fuel', 'Internet', 'Maintenance', 'Supplies', 'Wages', SYSTEM_FEE_CAT],
  },
  {
    group: 'Owner',
    items: ['Owner Drawings'],
  },
  {
    group: 'Community',
    items: ['Donations', 'Community Support'],
  },
];

// Categories where the Paid To field shows specific pre-filled suggestions
const CATEGORY_PAYEE_MODE = {
  'Owner Drawings':     'owner',
  'Wages':              'wages',
  'Rent':               'landlord',
  'Donations':          'donation',
  'Community Support':  'community',
};
CATEGORY_PAYEE_MODE[SYSTEM_FEE_CAT] = 'system_fee';
const ALL_CATEGORIES = CATEGORY_GROUPS.flatMap(g => g.items); // eslint-disable-line no-unused-vars
const QUICK_CATS = ['Utilities', 'Wages', 'Owner Drawings'];

// Which category opens which supplier modal when 🛒 Supplier is tapped
const SERVICE_CATS    = ['Utilities', 'Maintenance', 'Internet'];
const CONSUMABLE_CATS = ['Fuel', 'Supplies', 'Food'];

const PAYMENT_METHODS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'mpaisa',        label: 'MPAiSA' },
  { value: 'check',         label: 'Cheque' },
];

function methodBadgeClass(m) {
  if (m === 'cash')          return 'er-method-badge er-method-cash';
  if (m === 'bank_transfer') return 'er-method-badge er-method-bank';
  if (m === 'mpaisa')        return 'er-method-badge er-method-mobile';
  if (m === 'mobile_money')  return 'er-method-badge er-method-mobile'; // legacy
  if (m === 'check')         return 'er-method-badge er-method-check';
  return 'er-method-badge er-method-other';
}
function methodLabel(m) {
  if (m === 'mobile_money') return 'MPAiSA';
  return PAYMENT_METHODS.find(p => p.value === m)?.label || m || 'Cash';
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Build description string from expense fields ──────────────────────────────
function buildExpenseDescription(category, payee, note, gender) {
  if (category === 'Wages') {
    const pronoun = (gender || '').toLowerCase() === 'female' ? 'her' : 'his';
    return `Paid ${payee || '—'} ${pronoun} wages`;
  }
  if (category === SYSTEM_FEE_CAT) return 'Paid Sinita POS System for weekly fee';
  if (category === 'Owner Drawings') return `${payee || '—'} withdraws cash`;
  if (category === 'Donations') return `Donated CASH to ${payee || '—'}`;
  if (category === 'Community Support') return `Contribution to support ${payee || '—'}`;
  return `Paid ${payee || note || '—'} for ${category || 'expense'}`;
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
        <input className="er-cat-search" placeholder="Search category…" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        <div className="er-cat-list">
          {filtered.map(g => (
            <div key={g.group}>
              <div className="er-cat-group-label">{g.group}</div>
              {g.items.map(item => (
                <button key={item} className={`er-cat-item${selected === item ? ' selected' : ''}`} onClick={() => { onSelect(item); onClose(); }}>{item}</button>
              ))}
            </div>
          ))}
        </div>
        {selected && <button className="er-cat-clear" onClick={() => { onSelect(''); onClose(); }}>✕ Clear Category Filter</button>}
      </div>
    </div>
  );
}

// ── Shared modal shell styles ─────────────────────────────────────────────────
const modalShell  = { position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:5000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' };
const modalBox    = { background:'var(--surface, white)', color:'var(--text-primary, #111)', borderRadius:'14px', width:'100%', maxWidth:'480px', maxHeight:'92vh', display:'flex', flexDirection:'column', boxShadow:'0 12px 48px rgba(0,0,0,0.3)', overflow:'hidden' };
const modalHeader = { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 20px', borderBottom:'1px solid var(--border, #e5e7eb)', flexShrink:0 };
const modalBody   = { overflowY:'auto', padding:'20px', flex:1, display:'flex', flexDirection:'column', gap:'16px' };
const modalFooter = { display:'flex', gap:'10px', padding:'16px 20px', borderTop:'1px solid var(--border, #e5e7eb)', flexShrink:0 };
const ls = { display:'block', fontWeight:600, fontSize:'13px', marginBottom:'6px', color:'var(--text-primary, #374151)' };
const fs = { width:'100%', padding:'10px 12px', border:'1.5px solid var(--border, #e5e7eb)', borderRadius:'8px', fontSize:'14px', background:'var(--surface, white)', color:'var(--text-primary, #111)', boxSizing:'border-box' };
const btnCancel = { flex:1, padding:'12px', borderRadius:'8px', border:'1.5px solid var(--border, #e5e7eb)', background:'var(--surface, white)', color:'var(--text-primary, #111)', cursor:'pointer', fontWeight:600, fontSize:'14px' };

// ── Receipt Reminder logic — fires 2 hours after an expense is saved ──────────
function scheduleReceiptReminder(expenseId, category, payee) {
  // Respect the setting — default ON if not set
  const enabled = localStorage.getItem('ks_receipt_reminders') !== 'false';
  if (!enabled) return;
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  const key = `receipt_reminder_${expenseId}`;
  if (localStorage.getItem(key)) return; // already scheduled
  localStorage.setItem(key, 'pending');
  setTimeout(() => {
    const stillEnabled = localStorage.getItem('ks_receipt_reminders') !== 'false';
    const stillPending = localStorage.getItem(key) === 'pending';
    if (!stillPending || !stillEnabled) return;
    const desc = buildExpenseDescription(category, payee, '', '');
    alert(`📎 Reminder: Please attach a receipt or invoice ref for:\n"${desc}"\n\nOpen Expenses Record to add it.`);
    localStorage.setItem(key, 'done');
  }, TWO_HOURS);
}

// ── Purchase Consumable Supplies Modal (#2) — Fuel, Supplies, Food ─────────────
function PurchaseConsumablesModal({ category, onSave, onClose }) {
  const { fmt } = useCurrency();
  const { fieldErrors, showError, clearFieldError } = useValidation();
  const [date, setDate]             = useState(todayStr());
  const [supplierName, setSupplierName] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [note, setNote]             = useState('');
  const [saving, setSaving]         = useState(false);
  const nextId = useRef(2);
  const [items, setItems] = useState([{ id: 1, name: '', qty: '', unitCost: '' }]);

  const updateItem = (id, field, val) => setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: val } : it));
  const addItem    = () => setItems(prev => [...prev, { id: nextId.current++, name: '', qty: '', unitCost: '' }]);
  const removeItem = id => setItems(prev => prev.filter(it => it.id !== id));
  const grandTotal = items.reduce((s, it) => s + (parseFloat(it.qty)||0) * (parseFloat(it.unitCost)||0), 0);
  const lastOk = () => { const l = items[items.length-1]; return l && l.name.trim() && parseFloat(l.qty) > 0; };

  const handleSave = async () => {
    if (!supplierName.trim()) return showError('cs_supplier', 'Enter supplier / shop name');
    if (!date) return showError('cs_date', 'Date is required');
    const valid = items.filter(it => it.name.trim() && parseFloat(it.qty) > 0);
    if (valid.length === 0) return showError('cs_items', 'Add at least one item');
    setSaving(true);
    try {
      const dateISO = new Date(date + 'T12:00:00').toISOString();
      const itemsSummary = valid.map(i => i.name).join(', ');
      const total = valid.reduce((s, it) => s + (parseFloat(it.qty)||0)*(parseFloat(it.unitCost)||0), 0);
      if (total > 0) {
        await dataService.addCashEntry({ type: 'out', amount: total, note: `Paid ${supplierName.trim()} for ${category}: ${itemsSummary}`, date: dateISO, source: 'expense', business_date: date, invoiceRef: invoiceRef.trim() });
      }
      const result = { supplierName: supplierName.trim(), payee: supplierName.trim(), total, amount: total, invoiceRef: invoiceRef.trim(), note: note.trim(), itemsSummary, items: valid };
      scheduleReceiptReminder(`cs_${Date.now()}`, category, supplierName.trim());
      onSave(result);
    } catch (e) { console.error(e); showError('cs_items', 'Failed to save. Try again.'); }
    finally { setSaving(false); }
  };

  return (
    <div style={modalShell}>
      <div style={modalBox}>
        <div style={modalHeader}>
          <h2 style={{ margin:0, fontSize:'16px', fontWeight:700 }}>🛍️ Purchase Consumable Supplies</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-secondary,#6b7280)', padding:'4px' }}><X size={20}/></button>
        </div>
        <div style={modalBody}>
          <div style={{ padding:'8px 12px', background:'#fef9c3', border:'1px solid #fde047', borderRadius:'8px', fontSize:'12px', color:'#713f12' }}>
            📦 Category: <strong>{category}</strong> · Cash only · Items consumed in operations
          </div>
          <div><label style={ls}>Supplier / Shop Name *</label>
            <input data-field="cs_supplier" style={{ ...fs, ...errorBorder('cs_supplier', fieldErrors) }} value={supplierName} placeholder="e.g. Island Petroleum, City Store…" onChange={e => { setSupplierName(e.target.value); clearFieldError('cs_supplier'); }} />
            <ValidationNote field="cs_supplier" errors={fieldErrors} />
          </div>
          <div><label style={ls}>Invoice / Receipt Ref <span style={{ fontWeight:400, color:'#9ca3af' }}>(optional)</span></label>
            <input style={fs} value={invoiceRef} placeholder="Receipt or ref number…" onChange={e => setInvoiceRef(e.target.value)} />
          </div>
          <div><label style={ls}>Date *</label>
            <input type="date" data-field="cs_date" style={{ ...fs, ...errorBorder('cs_date', fieldErrors) }} value={date} max={todayStr()} onChange={e => { setDate(e.target.value); clearFieldError('cs_date'); }} />
            <ValidationNote field="cs_date" errors={fieldErrors} />
          </div>
          <div>
            <label style={{ ...ls, marginBottom:'8px' }}>Items Purchased *</label>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }} data-field="cs_items">
              {items.map((it, idx) => {
                const sub = (parseFloat(it.qty)||0) * (parseFloat(it.unitCost)||0);
                return (
                  <div key={it.id} style={{ border:'1.5px solid var(--border,#e5e7eb)', borderRadius:'10px', padding:'12px', background:'var(--background,#f9fafb)', display:'flex', flexDirection:'column', gap:'8px' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span style={{ fontSize:'12px', fontWeight:700, color:'#f59e0b' }}>Item {idx+1}</span>
                      {items.length > 1 && <button onClick={() => removeItem(it.id)} style={{ background:'#fee2e2', border:'none', borderRadius:'6px', padding:'4px 8px', cursor:'pointer', color:'#dc2626', fontSize:'12px', display:'flex', alignItems:'center', gap:'4px' }}><Trash2 size={12}/> Remove</button>}
                    </div>
                    <div><label style={{ fontSize:'12px', fontWeight:600, color:'var(--text-secondary,#6b7280)', display:'block', marginBottom:'3px' }}>Item Name *</label>
                      <input style={{ width:'100%', padding:'8px 10px', border:'1.5px solid var(--border,#e5e7eb)', borderRadius:'7px', fontSize:'13px', background:'var(--surface,white)', color:'var(--text-primary,#111)', boxSizing:'border-box' }} value={it.name} placeholder={category === 'Fuel' ? 'e.g. Petrol, Diesel…' : 'e.g. Stationery, Food items…'} onChange={e => updateItem(it.id, 'name', e.target.value)} /></div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                      <div><label style={{ fontSize:'12px', fontWeight:600, color:'var(--text-secondary,#6b7280)', display:'block', marginBottom:'3px' }}>Qty / Units *</label>
                        <input type="number" min="0" step="0.01" style={{ width:'100%', padding:'8px 10px', border:'1.5px solid var(--border,#e5e7eb)', borderRadius:'7px', fontSize:'13px', background:'var(--surface,white)', color:'var(--text-primary,#111)', boxSizing:'border-box' }} value={it.qty} placeholder="0" onChange={e => updateItem(it.id, 'qty', e.target.value)} /></div>
                      <div><label style={{ fontSize:'12px', fontWeight:600, color:'var(--text-secondary,#6b7280)', display:'block', marginBottom:'3px' }}>Unit Cost</label>
                        <input type="number" min="0" step="0.01" style={{ width:'100%', padding:'8px 10px', border:'1.5px solid var(--border,#e5e7eb)', borderRadius:'7px', fontSize:'13px', background:'var(--surface,white)', color:'var(--text-primary,#111)', boxSizing:'border-box' }} value={it.unitCost} placeholder="0.00" onChange={e => updateItem(it.id, 'unitCost', e.target.value)} /></div>
                    </div>
                    {sub > 0 && <div style={{ padding:'5px 10px', background:'#fef9c3', border:'1px solid #fde047', borderRadius:'6px', fontSize:'12px', color:'#713f12', fontWeight:600 }}>Subtotal: {sub.toFixed(2)}</div>}
                  </div>
                );
              })}
            </div>
            <ValidationNote field="cs_items" errors={fieldErrors} />
            <button onClick={addItem} disabled={!lastOk()} style={{ marginTop:'10px', width:'100%', padding:'10px', border:'1.5px dashed var(--border,#d1d5db)', borderRadius:'8px', background:lastOk()?'var(--surface,white)':'var(--background,#f9fafb)', color:lastOk()?'#f59e0b':'#9ca3af', cursor:lastOk()?'pointer':'not-allowed', fontSize:'13px', fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}><Plus size={14}/> Add Another Item</button>
          </div>
          {grandTotal > 0 && (
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'#fef9c3', border:'1.5px solid #fde047', borderRadius:'10px' }}>
              <span style={{ fontWeight:700, fontSize:'14px', color:'#713f12' }}>Total Amount</span>
              <span style={{ fontWeight:800, fontSize:'15px', color:'#713f12' }}>{fmt(grandTotal)}</span>
            </div>
          )}
          <div><label style={ls}>Note <span style={{ fontWeight:400, color:'#9ca3af' }}>(optional)</span></label>
            <textarea style={{ ...fs, minHeight:'60px', resize:'vertical' }} value={note} placeholder="Any additional details…" onChange={e => setNote(e.target.value)} />
          </div>
          <p style={{ fontSize:'11px', color:'#667eea', margin:0, fontStyle:'italic' }}>💵 Cash only — a Cash OUT entry will be recorded automatically.</p>
        </div>
        <div style={modalFooter}>
          <button style={btnCancel} onClick={onClose}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex:1, padding:'12px', borderRadius:'8px', border:'none', background:saving?'#9ca3af':'#f59e0b', color:'white', cursor:saving?'not-allowed':'pointer', fontWeight:700, fontSize:'14px' }}>{saving ? 'Saving…' : 'Save Purchase'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Purchase Operational Services Modal (#3) — Utilities, Maintenance, Internet ─
function PurchaseServicesModal({ category, onSave, onClose }) {
  const { fmt } = useCurrency();
  const { fieldErrors, showError, clearFieldError } = useValidation();
  const [date, setDate]               = useState(todayStr());
  const [providerName, setProviderName] = useState('');
  const [invoiceRef, setInvoiceRef]   = useState('');
  const [amount, setAmount]           = useState('');
  const [billingPeriod, setBillingPeriod] = useState('');
  const [note, setNote]               = useState('');
  const [saving, setSaving]           = useState(false);

  const handleSave = async () => {
    if (!providerName.trim()) return showError('svc_provider', 'Provider name is required');
    if (!date) return showError('svc_date', 'Date is required');
    if (!amount || parseFloat(amount) <= 0) return showError('svc_amount', 'Enter the amount paid');
    setSaving(true);
    try {
      const dateISO = new Date(date + 'T12:00:00').toISOString();
      const total = parseFloat(amount);
      const noteStr = [billingPeriod ? `Period: ${billingPeriod}` : '', note].filter(Boolean).join(' · ');
      await dataService.addCashEntry({ type: 'out', amount: total, note: `Paid ${providerName.trim()} for ${category}${billingPeriod ? ` (${billingPeriod})` : ''}`, date: dateISO, source: 'expense', business_date: date, invoiceRef: invoiceRef.trim() });
      const result = { supplierName: providerName.trim(), payee: providerName.trim(), total, amount: total, invoiceRef: invoiceRef.trim(), note: noteStr };
      scheduleReceiptReminder(`svc_${Date.now()}`, category, providerName.trim());
      onSave(result);
    } catch (e) { console.error(e); showError('svc_amount', 'Failed to save. Try again.'); }
    finally { setSaving(false); }
  };

  const serviceIcon = category === 'Utilities' ? '💡' : category === 'Internet' ? '📶' : '🔧';

  return (
    <div style={modalShell}>
      <div style={modalBox}>
        <div style={modalHeader}>
          <h2 style={{ margin:0, fontSize:'16px', fontWeight:700 }}>{serviceIcon} Purchase Operational Services</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-secondary,#6b7280)', padding:'4px' }}><X size={20}/></button>
        </div>
        <div style={modalBody}>
          <div style={{ padding:'8px 12px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'8px', fontSize:'12px', color:'#1e40af' }}>
            {serviceIcon} Category: <strong>{category}</strong> · Service payments (bills, maintenance, internet, etc.)
          </div>
          <div><label style={ls}>Provider / Company Name *</label>
            <input data-field="svc_provider" style={{ ...fs, ...errorBorder('svc_provider', fieldErrors) }} value={providerName} placeholder={category === 'Utilities' ? 'e.g. SIEA, SIWA…' : category === 'Internet' ? 'e.g. Our Telekom, BeMobile…' : 'e.g. Repair Service, Contractor…'} onChange={e => { setProviderName(e.target.value); clearFieldError('svc_provider'); }} />
            <ValidationNote field="svc_provider" errors={fieldErrors} />
          </div>
          <div><label style={ls}>Amount Paid *</label>
            <input type="number" data-field="svc_amount" style={{ ...fs, ...errorBorder('svc_amount', fieldErrors) }} value={amount} placeholder="0.00" min="0" step="0.01" onChange={e => { setAmount(e.target.value); clearFieldError('svc_amount'); }} />
            <ValidationNote field="svc_amount" errors={fieldErrors} />
          </div>
          <div><label style={ls}>Invoice / Receipt Ref <span style={{ fontWeight:400, color:'#9ca3af' }}>(optional)</span></label>
            <input style={fs} value={invoiceRef} placeholder="Bill number or receipt ref…" onChange={e => setInvoiceRef(e.target.value)} />
          </div>
          <div><label style={ls}>Billing Period <span style={{ fontWeight:400, color:'#9ca3af' }}>(optional)</span></label>
            <input style={fs} value={billingPeriod} placeholder="e.g. March 2026, Week 10…" onChange={e => setBillingPeriod(e.target.value)} />
          </div>
          <div><label style={ls}>Date Paid *</label>
            <input type="date" data-field="svc_date" style={{ ...fs, ...errorBorder('svc_date', fieldErrors) }} value={date} max={todayStr()} onChange={e => { setDate(e.target.value); clearFieldError('svc_date'); }} />
            <ValidationNote field="svc_date" errors={fieldErrors} />
          </div>
          <div><label style={ls}>Note <span style={{ fontWeight:400, color:'#9ca3af' }}>(optional)</span></label>
            <textarea style={{ ...fs, minHeight:'60px', resize:'vertical' }} value={note} placeholder="Any additional details…" onChange={e => setNote(e.target.value)} />
          </div>
          <p style={{ fontSize:'11px', color:'#667eea', margin:0, fontStyle:'italic' }}>💵 Cash only — a Cash OUT entry will be recorded automatically.</p>
        </div>
        <div style={modalFooter}>
          <button style={btnCancel} onClick={onClose}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex:1, padding:'12px', borderRadius:'8px', border:'none', background:saving?'#9ca3af':'#3b82f6', color:'white', cursor:saving?'not-allowed':'pointer', fontWeight:700, fontSize:'14px' }}>{saving ? 'Saving…' : 'Save Payment'}</button>
        </div>
      </div>
    </div>
  );
}

// ── New Supplier Modal (Purchase Durable Assets — #1) ─────────────────────────
function NewSupplierModal({ onSave, onClose, suppliersList = [] }) {
  const { fmt } = useCurrency();
  const { fieldErrors, showError, clearFieldError } = useValidation();
  const [activeTab, setActiveTab] = useState('details');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [detailsError, setDetailsError] = useState('');
  const detailsErrorRef = useRef(null);
  const nsFieldRefs = { fullName: useRef(null), phone: useRef(null), whatsapp: useRef(null), address: useRef(null) };
  const [paymentType, setPaymentType] = useState('cash');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [comments, setComments]     = useState('');
  const [date, setDate] = useState(todayStr);
  const nextId = useRef(2);
  const [items, setItems] = useState([{ id: 1, name: '', qty: '', costPrice: '' }]);
  const [saving, setSaving] = useState(false);

  const updateItem = (id, field, val) => setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: val } : it));
  const addItem = () => setItems(prev => [...prev, { id: nextId.current++, name: '', qty: '', costPrice: '' }]);
  const removeItem = id => setItems(prev => prev.filter(it => it.id !== id));
  const grandTotal = items.reduce((sum, it) => sum + (parseFloat(it.qty) || 0) * (parseFloat(it.costPrice) || 0), 0);
  const lastItemComplete = () => { const last = items[items.length - 1]; return last && last.name.trim() && parseFloat(last.qty) > 0; };

  const validateDetails = () => {
    if (!fullName.trim()) { showError('ns_fullName', 'Enter the Supplier Name'); return { msg: 'Supplier Name is required.', field: 'fullName' }; }
    if (!phone.trim())    { showError('ns_phone', 'Enter the Phone');            return { msg: 'Phone is required.',           field: 'phone' }; }
    if (!whatsapp.trim() && !email.trim()) return { msg: 'At least WhatsApp or Email is required.', field: 'whatsapp' };
    if (email.trim() && !email.includes('@')) return { msg: 'Email must contain "@".', field: 'whatsapp' };
    if (!address.trim())  { showError('ns_address', 'Enter the Address');        return { msg: 'Address is required.',         field: 'address' }; }
    return null;
  };
  const nsScrollToField = (fieldKey) => {
    setTimeout(() => {
      const ref = nsFieldRefs[fieldKey];
      if (ref?.current) ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      else detailsErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };
  const handleNextToPurchase = () => {
    const err = validateDetails();
    if (err) { setDetailsError(err.msg); nsScrollToField(err.field); return; }
    setDetailsError(''); setActiveTab('purchase');
  };

  const handleSave = async () => {
    const err = validateDetails();
    if (err) { setActiveTab('details'); setDetailsError(err.msg); nsScrollToField(err.field); return; }
    if (!invoiceRef.trim()) return showError('ns_invoiceRef', 'Enter the Invoice / Ref');
    if (!date) return showError('ns_date', 'Enter the Date');
    const validItems = items.filter(it => it.name.trim() && parseFloat(it.qty) > 0);
    if (validItems.length === 0) return showError('ns_items', 'Add at least one item');
    setSaving(true);
    try {
      const dateISO = new Date(date + 'T12:00:00').toISOString();
      const supplierName = fullName.trim();
      const supplierData = {
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        customerName: supplierName, name: supplierName,
        phone: phone.trim(), customerPhone: phone.trim(), gender: '',
        whatsapp: whatsapp.trim(), email: email.trim(), address: address.trim(),
        totalDue: 0, totalPaid: 0, balance: 0, purchaseIds: [], deposits: [],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastSale: null,
      };
      const current = await dataService.getSuppliers() || [];
      current.push(supplierData);
      await dataService.setSuppliers(current);
      const supplierId = supplierData.id;
      const savedItems = [];
      for (const it of validItems) {
        const qty = parseFloat(it.qty)||0, costPrice = parseFloat(it.costPrice)||0, subtotal = qty*costPrice;
        await dataService.addOperationalAsset({ name: it.name.trim(), qty, costPrice, subtotal, supplierName, supplierId, invoiceRef: invoiceRef.trim(), paymentType, date: dateISO, source: 'purchase' });
        savedItems.push({ name: it.name.trim(), qty, costPrice, subtotal });
      }
      const total = savedItems.reduce((s, it) => s + it.subtotal, 0);
      if (paymentType === 'cash' && total > 0) {
        await dataService.addCashEntry({ type: 'out', amount: total, note: `Paid ${supplierName} for ref: ${invoiceRef.trim()}`, date: dateISO, source: 'purchase', business_date: date, invoiceRef: invoiceRef.trim() });
      }
      scheduleReceiptReminder(`ns_${Date.now()}`, 'Supplier Purchase', supplierName);
      onSave({ supplierName, supplierId, paymentType, total, invoiceRef: invoiceRef.trim(), itemsSummary: savedItems.map(i => i.name).join(', '), items: savedItems });
    } catch (e) { console.error(e); showError('ns_items', 'Failed to save. Please try again.'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:5000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:'var(--surface, white)', color:'var(--text-primary, #111)', borderRadius:'14px', width:'100%', maxWidth:'480px', maxHeight:'92vh', display:'flex', flexDirection:'column', boxShadow:'0 12px 48px rgba(0,0,0,0.3)', overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 20px', borderBottom:'1px solid var(--border, #e5e7eb)', flexShrink:0 }}>
          <h2 style={{ margin:0, fontSize:'16px', fontWeight:700 }}>🏭 New Supplier + Purchase</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-secondary, #6b7280)', padding:'4px' }}><X size={20}/></button>
        </div>
        <div style={{ display:'flex', borderBottom:'1px solid var(--border, #e5e7eb)', flexShrink:0 }}>
          {[['details','Supplier Details'],['purchase','Purchase']].map(([tab,lbl]) => (
            <button key={tab} onClick={() => { if (tab==='purchase') { const e=validateDetails(); if (e) { setDetailsError(e.msg); nsScrollToField(e.field); return; } setDetailsError(''); } setActiveTab(tab); }}
              style={{ flex:1, padding:'12px', border:'none', background:'none', fontSize:'13px', fontWeight:activeTab===tab?700:400, color:activeTab===tab?'#667eea':'var(--text-secondary, #6b7280)', borderBottom:activeTab===tab?'2px solid #667eea':'2px solid transparent', cursor:'pointer' }}>
              {lbl}
            </button>
          ))}
        </div>
        <div style={{ overflowY:'auto', padding:'20px', flex:1, display:'flex', flexDirection:'column', gap:'16px' }}>
          {detailsError && activeTab==='details' && (
            <div ref={detailsErrorRef} style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:'8px', padding:'10px 12px', fontSize:'13px', color:'#b91c1c' }}>{detailsError}</div>
          )}
          {activeTab==='details' && (<>
            <div>
              <label style={ls}>Supplier Name *</label>
              <input ref={nsFieldRefs.fullName} data-field="ns_fullName" style={{ ...fs, ...errorBorder('ns_fullName', fieldErrors) }} value={fullName} placeholder="Enter supplier name" onChange={e => { setFullName(e.target.value); clearFieldError('ns_fullName'); }} />
              <ValidationNote field="ns_fullName" errors={fieldErrors} />
            </div>
            <div ref={nsFieldRefs.phone}><label style={ls}>Phone *</label><input data-field="ns_phone" style={{ ...fs, ...errorBorder('ns_phone', fieldErrors) }} value={phone} placeholder="Phone number" onChange={e => { setPhone(e.target.value); clearFieldError('ns_phone'); }} /><ValidationNote field="ns_phone" errors={fieldErrors} /></div>
            <div ref={nsFieldRefs.whatsapp}><label style={ls}>WhatsApp</label><input style={fs} value={whatsapp} placeholder="WhatsApp number" onChange={e => setWhatsapp(e.target.value)} /></div>
            <div><label style={ls}>Email</label><input style={fs} value={email} placeholder="email@example.com" onChange={e => setEmail(e.target.value)} /></div>
            <div ref={nsFieldRefs.address}><label style={ls}>Address *</label><input data-field="ns_address" style={{ ...fs, ...errorBorder('ns_address', fieldErrors) }} value={address} placeholder="Supplier address" onChange={e => { setAddress(e.target.value); clearFieldError('ns_address'); }} /><ValidationNote field="ns_address" errors={fieldErrors} /></div>
          </>)}
          {activeTab==='purchase' && (<>
            <div><label style={ls}>Payment Type</label>
              <div style={{ display:'flex', gap:'8px' }}>
                {[['cash','💵 Cash'],['credit','📋 Credit']].map(([pt,lbl]) => (
                  <button key={pt} onClick={() => setPaymentType(pt)} style={{ flex:1, padding:'9px', borderRadius:'8px', border:'2px solid', borderColor:paymentType===pt?(pt==='cash'?'#16a34a':'#4f46e5'):'var(--border, #d1d5db)', background:paymentType===pt?(pt==='cash'?'#f0fdf4':'#eef2ff'):'var(--surface, white)', fontWeight:paymentType===pt?700:400, cursor:'pointer', fontSize:'13px', color:'var(--text-primary, #111)' }}>{lbl}</button>
                ))}
              </div>
            </div>
            <div><label style={ls}>Invoice / Ref *</label><input data-field="ns_invoiceRef" style={{ ...fs, ...errorBorder('ns_invoiceRef', fieldErrors) }} value={invoiceRef} placeholder="Receipt or invoice number…" onChange={e => { setInvoiceRef(e.target.value); clearFieldError('ns_invoiceRef'); }} /><ValidationNote field="ns_invoiceRef" errors={fieldErrors} /></div>
            <div><label style={ls}>Date *</label><input type="date" data-field="ns_date" style={{ ...fs, ...errorBorder('ns_date', fieldErrors) }} value={date} max={todayStr()} onChange={e => { setDate(e.target.value); clearFieldError('ns_date'); }} /><ValidationNote field="ns_date" errors={fieldErrors} /></div>
            <div>
              <label style={{ display:'block', fontWeight:600, fontSize:'13px', marginBottom:'8px', color:'var(--text-primary, #374151)' }}>Items *</label>
              <div data-field="ns_items" style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                {items.map((it,idx) => { const sub=(parseFloat(it.qty)||0)*(parseFloat(it.costPrice)||0); return (
                  <div key={it.id} style={{ border:'1.5px solid var(--border, #e5e7eb)', borderRadius:'10px', padding:'12px', background:'var(--background, #f9fafb)', display:'flex', flexDirection:'column', gap:'10px' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span style={{ fontSize:'12px', fontWeight:700, color:'#667eea' }}>Item {idx+1}</span>
                      {items.length>1 && <button onClick={() => removeItem(it.id)} style={{ background:'#fee2e2', border:'none', borderRadius:'6px', padding:'4px 8px', cursor:'pointer', color:'#dc2626', display:'flex', alignItems:'center', gap:'4px', fontSize:'12px' }}><Trash2 size={12}/> Remove</button>}
                    </div>
                    <div><label style={{ display:'block', fontSize:'12px', fontWeight:600, color:'var(--text-secondary, #6b7280)', marginBottom:'4px' }}>Asset Name *</label>
                      <input style={{ width:'100%', padding:'8px 10px', border:'1.5px solid var(--border, #e5e7eb)', borderRadius:'7px', fontSize:'13px', background:'var(--surface, white)', color:'var(--text-primary, #111)', boxSizing:'border-box' }} value={it.name} placeholder="e.g. Generator, Office Chair…" onChange={e => updateItem(it.id,'name',e.target.value)} /></div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                      <div><label style={{ display:'block', fontSize:'12px', fontWeight:600, color:'var(--text-secondary, #6b7280)', marginBottom:'4px' }}>Quantity *</label>
                        <input type="number" min="0" step="1" style={{ width:'100%', padding:'8px 10px', border:'1.5px solid var(--border, #e5e7eb)', borderRadius:'7px', fontSize:'13px', background:'var(--surface, white)', color:'var(--text-primary, #111)', boxSizing:'border-box' }} value={it.qty} placeholder="0" onChange={e => updateItem(it.id,'qty',e.target.value)} /></div>
                      <div><label style={{ display:'block', fontSize:'12px', fontWeight:600, color:'var(--text-secondary, #6b7280)', marginBottom:'4px' }}>Unit Cost</label>
                        <input type="number" min="0" step="0.01" style={{ width:'100%', padding:'8px 10px', border:'1.5px solid var(--border, #e5e7eb)', borderRadius:'7px', fontSize:'13px', background:'var(--surface, white)', color:'var(--text-primary, #111)', boxSizing:'border-box' }} value={it.costPrice} placeholder="0.00" onChange={e => updateItem(it.id,'costPrice',e.target.value)} /></div>
                    </div>
                    {sub>0 && <div style={{ padding:'6px 10px', background:'#f0f4ff', border:'1px solid #c7d2fe', borderRadius:'7px', fontSize:'12px', color:'#4338ca', fontWeight:600 }}>Subtotal: {sub.toFixed(2)}</div>}
                  </div>
                ); })}
              </div>
              <ValidationNote field="ns_items" errors={fieldErrors} />
              <button onClick={addItem} disabled={!lastItemComplete()} style={{ marginTop:'10px', width:'100%', padding:'10px', border:'1.5px dashed var(--border, #d1d5db)', borderRadius:'8px', background:lastItemComplete()?'var(--surface, white)':'var(--background, #f9fafb)', color:lastItemComplete()?'#667eea':'#9ca3af', cursor:lastItemComplete()?'pointer':'not-allowed', fontSize:'13px', fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}><Plus size={14}/> Add Another Item</button>
            </div>
            {grandTotal>0 && <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'#f0f4ff', border:'1.5px solid #c7d2fe', borderRadius:'10px' }}><span style={{ fontWeight:700, fontSize:'14px', color:'#4338ca' }}>Grand Total</span><span style={{ fontWeight:800, fontSize:'15px', color:'#3730a3' }}>{grandTotal.toFixed(2)}</span></div>}
          </>)}
        </div>
        <div style={{ display:'flex', gap:'10px', padding:'16px 20px', borderTop:'1px solid var(--border, #e5e7eb)', flexShrink:0 }}>
          <button onClick={onClose} style={btnCancel}>Cancel</button>
          {activeTab==='details'
            ? <button onClick={handleNextToPurchase} style={{ flex:1, padding:'12px', borderRadius:'8px', border:'none', background:'#667eea', color:'white', cursor:'pointer', fontWeight:700, fontSize:'14px' }}>Next: Purchase →</button>
            : <button onClick={handleSave} disabled={saving} style={{ flex:1, padding:'12px', borderRadius:'8px', border:'none', background:saving?'#9ca3af':'#f59e0b', color:'white', cursor:saving?'not-allowed':'pointer', fontWeight:700, fontSize:'14px' }}>{saving?'Saving…':'Save Purchase'}</button>
          }
        </div>
      </div>
    </div>
  );
}

// ── Add Operational Assets Modal ──────────────────────────────────────────────
function AddOperationalAssetsModal({ initialSupplierName, initialSupplierId, suppliersList, onSave, onClose, onNewSupplier }) {
  const { fmt } = useCurrency();
  const { fieldErrors, showError, clearFieldError } = useValidation();
  const [supplierSearch, setSupplierSearch] = useState(initialSupplierName || '');
  const [showSupplierDrop, setShowSupplierDrop] = useState(false);
  const [resolvedSupplierId, setResolvedSupplierId] = useState(initialSupplierId || null);
  const [paymentType, setPaymentType] = useState('cash');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [comments, setComments]     = useState('');
  const [date, setDate] = useState(todayStr);
  const [saving, setSaving] = useState(false);
  const nextId = useRef(2);
  const [items, setItems] = useState([{ id:1, name:'', qty:'', costPrice:'' }]);
  const [cashBalance, setCashBalance] = useState(null);

  useEffect(() => {
    dataService.getCashEntries().then(entries => {
      const bal = (entries||[]).reduce((sum,e) => sum + (e.type==='in'?(e.amount||0):-(e.amount||0)), 0);
      setCashBalance(bal);
    });
  }, []);

  const filteredSuppliers = suppliersList.filter(s =>
    (s.name||s.customerName||'').toLowerCase().includes(supplierSearch.toLowerCase())
  );
  const updateItem = (id,field,val) => setItems(prev => prev.map(it => it.id===id?{...it,[field]:val}:it));
  const addItem = () => setItems(prev => [...prev, { id:nextId.current++, name:'', qty:'', costPrice:'' }]);
  const removeItem = id => setItems(prev => prev.filter(it => it.id!==id));
  const grandTotal = items.reduce((sum,it) => sum+(parseFloat(it.qty)||0)*(parseFloat(it.costPrice)||0), 0);
  const lastItemComplete = () => { const last=items[items.length-1]; return last && last.name.trim() && parseFloat(last.qty)>0; };

  const handleSave = async () => {
    const supplierName = supplierSearch.trim();
    if (!supplierName) return showError('oa_supplier','Enter the Supplier Name');
    if (!invoiceRef.trim()) return showError('oa_ref','Enter the Invoice / Ref');
    if (!date) return showError('oa_date','Enter the Date');
    const validItems = items.filter(it => it.name.trim() && parseFloat(it.qty)>0);
    if (validItems.length===0) return showError('oa_items','Add at least one item');
    if (paymentType==='cash' && cashBalance!==null && grandTotal>cashBalance)
      return showError('oa_items',`Total exceeds Cash Balance. Reduce amount or switch to Credit.`);
    setSaving(true);
    try {
      const dateISO = new Date(date+'T12:00:00').toISOString();
      const savedItems = [];
      for (const it of validItems) {
        const qty=parseFloat(it.qty)||0, costPrice=parseFloat(it.costPrice)||0, subtotal=qty*costPrice;
        await dataService.addOperationalAsset({ name:it.name.trim(), qty, costPrice, subtotal, supplierName, supplierId:resolvedSupplierId||null, invoiceRef:invoiceRef.trim(), paymentType, comments:comments.trim(), date:dateISO, source:'purchase' });
        savedItems.push({ name:it.name.trim(), qty, costPrice, subtotal });
      }
      if (paymentType==='cash' && grandTotal>0) {
        await dataService.addCashEntry({ type:'out', amount:grandTotal, note:`Paid ${supplierName} for ref: ${invoiceRef.trim()}`, date:dateISO, source:'purchase', business_date:date, invoiceRef:invoiceRef.trim() });
      }
      scheduleReceiptReminder(`oa_${Date.now()}`, 'Supplier Purchase', supplierName);
      onSave({ supplierName, supplierId:resolvedSupplierId||null, paymentType, total:grandTotal, invoiceRef:invoiceRef.trim(), itemsSummary:savedItems.map(i=>i.name).join(', '), items:savedItems });
    } catch (e) { console.error(e); showError('oa_items','Failed to save. Please try again.'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:4500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:'var(--surface, white)', color:'var(--text-primary, #111)', borderRadius:'14px', width:'100%', maxWidth:'480px', maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'0 12px 48px rgba(0,0,0,0.3)', overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 20px', borderBottom:'1px solid var(--border, #e5e7eb)', flexShrink:0 }}>
          <h2 style={{ margin:0, fontSize:'16px', fontWeight:700 }}>🛒 Purchase Durable Assets</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-secondary, #6b7280)', padding:'4px' }}><X size={20}/></button>
        </div>
        <div style={{ overflowY:'auto', padding:'20px', flex:1, display:'flex', flexDirection:'column', gap:'16px' }}>
          <div style={{ position:'relative' }}>
            <label style={ls}>Supplier Name *</label>
            <div style={{ display:'flex', gap:'8px', alignItems:'flex-start' }}>
              <div style={{ flex:1, position:'relative' }}>
                <input data-field="oa_supplier" style={{ width:'100%', padding:'10px 12px', border:'2px solid var(--border, #e5e7eb)', borderRadius:'8px', fontSize:'14px', background:'var(--surface, white)', color:'var(--text-primary, #111)', boxSizing:'border-box', ...errorBorder('oa_supplier',fieldErrors) }}
                  value={supplierSearch} placeholder="Search existing suppliers"
                  onChange={e => { setSupplierSearch(e.target.value); setShowSupplierDrop(true); setResolvedSupplierId(null); clearFieldError('oa_supplier'); }}
                  onFocus={() => setShowSupplierDrop(true)} onBlur={() => setTimeout(() => setShowSupplierDrop(false),180)} />
                {showSupplierDrop && filteredSuppliers.length>0 && (
                  <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:500, background:'var(--surface, white)', border:'1px solid var(--border, #e5e7eb)', borderRadius:'8px', boxShadow:'0 4px 16px rgba(0,0,0,0.12)', maxHeight:'160px', overflowY:'auto' }}>
                    {filteredSuppliers.map(s => { const n=s.name||s.customerName||''; return (
                      <button key={s.id} onMouseDown={() => { setSupplierSearch(n); setResolvedSupplierId(s.id); setShowSupplierDrop(false); }}
                        style={{ display:'block', width:'100%', textAlign:'left', padding:'10px 14px', background:'none', border:'none', cursor:'pointer', fontSize:'14px', color:'var(--text-primary, #111)' }}>{n}</button>
                    ); })}
                  </div>
                )}
              </div>
              {onNewSupplier && (
                <button onClick={onNewSupplier} style={{ padding:'10px 12px', borderRadius:'8px', fontSize:'12px', fontWeight:600, border:'2px solid #667eea', background:'#eef2ff', color:'#667eea', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>+ New Supplier</button>
              )}
            </div>
            <ValidationNote field="oa_supplier" errors={fieldErrors} />
          </div>
          <div>
            <label style={ls}>Payment Type</label>
            <div style={{ display:'flex', gap:'8px' }}>
              {[['cash','💵 Cash'],['credit','📋 Credit']].map(([pt,lbl]) => (
                <button key={pt} onClick={() => setPaymentType(pt)} style={{ flex:1, padding:'9px', borderRadius:'8px', border:'2px solid', borderColor:paymentType===pt?(pt==='cash'?'#16a34a':'#4f46e5'):'var(--border, #d1d5db)', background:paymentType===pt?(pt==='cash'?'#f0fdf4':'#eef2ff'):'var(--surface, white)', fontWeight:paymentType===pt?700:400, cursor:'pointer', fontSize:'13px', color:'var(--text-primary, #111)' }}>{lbl}</button>
              ))}
            </div>
            <p style={{ fontSize:'11px', marginTop:'4px', color:paymentType==='credit'?'#4f46e5':'#6b7280' }}>
              {paymentType==='cash'?'Cash paid now — a Cash OUT entry will be recorded.':'Items received, pay later — no immediate cash deducted.'}
            </p>
          </div>
          <div>
            <label style={ls}>Invoice / Ref *</label>
            <input style={{ width:'100%', padding:'10px 12px', border:'2px solid var(--border, #e5e7eb)', borderRadius:'8px', fontSize:'14px', background:'var(--surface, white)', color:'var(--text-primary, #111)', boxSizing:'border-box' }} value={invoiceRef} placeholder="Receipt or invoice number…" onChange={e => setInvoiceRef(e.target.value)} />
          </div>
          <div>
            <label style={ls}>Comments <span style={{ fontWeight:400, color:'#9ca3af' }}>(optional)</span></label>
            <textarea style={{ width:'100%', padding:'10px 12px', border:'2px solid var(--border, #e5e7eb)', borderRadius:'8px', fontSize:'14px', background:'var(--surface, white)', color:'var(--text-primary, #111)', boxSizing:'border-box', minHeight:'70px', resize:'vertical' }} value={comments} placeholder="Any additional notes or comments…" onChange={e => setComments(e.target.value)} />
          </div>
          <div>
            <label style={ls}>Date *</label>
            <input type="date" style={{ width:'100%', padding:'10px 12px', border:'2px solid var(--border, #e5e7eb)', borderRadius:'8px', fontSize:'14px', background:'var(--surface, white)', color:'var(--text-primary, #111)', boxSizing:'border-box' }} value={date} max={todayStr()} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label style={ls}>Items *</label>
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {items.map((it,idx) => { const sub=(parseFloat(it.qty)||0)*(parseFloat(it.costPrice)||0); return (
                <div key={it.id} style={{ border:'1.5px solid var(--border, #e5e7eb)', borderRadius:'10px', padding:'12px', background:'var(--background, #f9fafb)', display:'flex', flexDirection:'column', gap:'10px' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span style={{ fontSize:'12px', fontWeight:700, color:'#667eea' }}>Item {idx+1}</span>
                    {items.length>1 && <button onClick={() => removeItem(it.id)} style={{ background:'#fee2e2', border:'none', borderRadius:'6px', padding:'4px 8px', cursor:'pointer', color:'#dc2626', display:'flex', alignItems:'center', gap:'4px', fontSize:'12px' }}><Trash2 size={12}/> Remove</button>}
                  </div>
                  <div><label style={{ display:'block', fontSize:'12px', fontWeight:600, color:'var(--text-secondary, #6b7280)', marginBottom:'4px' }}>Asset Name *</label>
                    <input style={{ width:'100%', padding:'8px 10px', border:'1.5px solid var(--border, #e5e7eb)', borderRadius:'7px', fontSize:'13px', background:'var(--surface, white)', color:'var(--text-primary, #111)', boxSizing:'border-box' }} value={it.name} placeholder="e.g. Generator, Office Chair…" onChange={e => updateItem(it.id,'name',e.target.value)} /></div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                    <div><label style={{ display:'block', fontSize:'12px', fontWeight:600, color:'var(--text-secondary, #6b7280)', marginBottom:'4px' }}>Quantity *</label>
                      <input type="number" min="0" step="1" style={{ width:'100%', padding:'8px 10px', border:'1.5px solid var(--border, #e5e7eb)', borderRadius:'7px', fontSize:'13px', background:'var(--surface, white)', color:'var(--text-primary, #111)', boxSizing:'border-box' }} value={it.qty} placeholder="0" onChange={e => updateItem(it.id,'qty',e.target.value)} /></div>
                    <div><label style={{ display:'block', fontSize:'12px', fontWeight:600, color:'var(--text-secondary, #6b7280)', marginBottom:'4px' }}>Unit Cost</label>
                      <input type="number" min="0" step="0.01" style={{ width:'100%', padding:'8px 10px', border:'1.5px solid var(--border, #e5e7eb)', borderRadius:'7px', fontSize:'13px', background:'var(--surface, white)', color:'var(--text-primary, #111)', boxSizing:'border-box' }} value={it.costPrice} placeholder="0.00" onChange={e => updateItem(it.id,'costPrice',e.target.value)} /></div>
                  </div>
                  {sub>0 && <div style={{ padding:'6px 10px', background:'#f0f4ff', border:'1px solid #c7d2fe', borderRadius:'7px', fontSize:'12px', color:'#4338ca', fontWeight:600 }}>Subtotal: {sub.toFixed(2)}</div>}
                  <ValidationNote field={`oa_qty_${it.id}`} errors={fieldErrors} />
                </div>
              ); })}
            </div>
            <ValidationNote field="oa_items" errors={fieldErrors} />
            <button onClick={addItem} disabled={!lastItemComplete()} style={{ marginTop:'10px', width:'100%', padding:'10px', border:'1.5px dashed var(--border, #d1d5db)', borderRadius:'8px', background:lastItemComplete()?'var(--surface, white)':'var(--background, #f9fafb)', color:lastItemComplete()?'#667eea':'#9ca3af', cursor:lastItemComplete()?'pointer':'not-allowed', fontSize:'13px', fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}><Plus size={14}/> Add Another Item</button>
          </div>
          {grandTotal>0 && (
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'#f0f4ff', border:'1.5px solid #c7d2fe', borderRadius:'10px' }}>
              <span style={{ fontWeight:700, fontSize:'14px', color:'#4338ca' }}>Grand Total</span>
              <span style={{ fontWeight:800, fontSize:'15px', color:'#3730a3' }}>{fmt(grandTotal)}</span>
            </div>
          )}
          {paymentType==='cash' && cashBalance!==null && grandTotal>cashBalance && grandTotal>0 && (
            <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:'8px', padding:'10px 12px', fontSize:'12px', color:'#b91c1c' }}>
              ⚠️ Total ({fmt(grandTotal)}) exceeds Cash Balance ({fmt(cashBalance)}).
            </div>
          )}
        </div>
        <div style={{ display:'flex', gap:'10px', padding:'16px 20px', borderTop:'1px solid var(--border, #e5e7eb)', flexShrink:0 }}>
          <button onClick={onClose} style={btnCancel}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex:1, padding:'12px', borderRadius:'8px', border:'none', background:saving?'#9ca3af':'#f59e0b', color:'white', cursor:saving?'not-allowed':'pointer', fontWeight:700, fontSize:'14px' }}>{saving?'Saving…':'Save Assets'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Group / Organisation child modal ─────────────────────────────────────────
function GroupOrgModal({ mode, onConfirm, onClose }) {
  const label = mode === 'community' ? 'Community Name' : 'Church, Group, NGO or Cause';
  const placeholder = mode === 'community' ? 'e.g. Honiara Village' : 'e.g. Red Cross, Church of Melanesia…';
  const [name, setName] = useState('');
  return (
    <div className="er-cat-modal-overlay" onClick={onClose} style={{ zIndex: 2100 }}>
      <div className="er-cat-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 340 }}>
        <div className="er-modal-header" style={{ borderRadius: '20px 20px 0 0' }}>
          <h2>{mode === 'community' ? '🏘️ Community' : '🤝 Group / Organisation'}</h2>
          <button className="er-modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <div style={{ padding: '20px 20px 10px' }}>
          <label className="er-label">{label} *</label>
          <input
            className="er-input"
            style={{ marginTop: 6 }}
            placeholder={placeholder}
            value={name}
            autoFocus
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onConfirm(name.trim()); }}
          />
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '10px 20px 20px' }}>
          <button className="er-btn-cancel" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="er-btn-save" onClick={() => { if (name.trim()) onConfirm(name.trim()); }}
            style={{ flex: 1 }} disabled={!name.trim()}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ── Paid To smart dropdown ────────────────────────────────────────────────────
function PaidToField({ category, value, onChange, onSupplierClick, fieldErrors, clearFieldError, users }) {
  const [open, setOpen] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupModalMode, setGroupModalMode] = useState('donation');
  const wrapRef = useRef(null);

  const payeeMode = CATEGORY_PAYEE_MODE[category] || 'supplier';

  const owner    = users.find(u => ['shop owner','owner'].includes((u.role||'').toLowerCase()));
  const manager  = users.find(u => ['shop manager','manager'].includes((u.role||'').toLowerCase()));
  const staff    = users.filter(u => ['shopkeeper','staff'].includes((u.role||'').toLowerCase()));
  const landlord = users.find(u => u.id === '__landlord__' || (u.role||'').toLowerCase() === 'landlord');

  const displayName = u => u?.fullName || u?.name || u?.displayName || u?.email?.split('@')[0] || '—';

  let suggestions = [];
  if (payeeMode === 'owner' && owner) {
    suggestions = [{ label: displayName(owner), value: displayName(owner), icon: '👤' }];
  } else if (payeeMode === 'wages') {
    if (manager) suggestions.push({ label: displayName(manager), value: displayName(manager), icon: '🧑‍💼' });
    staff.forEach(s => suggestions.push({ label: displayName(s), value: displayName(s), icon: '👷' }));
  } else if (payeeMode === 'landlord' && landlord) {
    suggestions = [{ label: displayName(landlord), value: displayName(landlord), icon: '🏠' }];
  } else if (payeeMode === 'donation') {
    suggestions = [{ label: 'Group or Organisation', value: '__group__', icon: '🤝', isAction: true }];
  } else if (payeeMode === 'community') {
    suggestions = [{ label: 'Community', value: '__community__', icon: '🏘️', isAction: true }];
  } else if (payeeMode === 'system_fee') {
    suggestions = [{ label: 'Sinita POS Systems (SPOSH)', value: 'Sinita POS Systems (SPOSH)', icon: '💻' }];
  } else {
    // Determine which supplier modal label to show
    const modalLabel = SERVICE_CATS.includes(category) ? '🔧 Service Provider' :
                       CONSUMABLE_CATS.includes(category) ? '🛍️ Supplier' : '🛒 Supplier';
    suggestions = [{ label: modalLabel, value: '__supplier__', icon: '🛒', isAction: true }];
  }

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (item) => {
    setOpen(false);
    if (item.value === '__supplier__')  { onSupplierClick(); return; }
    if (item.value === '__group__')     { setGroupModalMode('donation');  setShowGroupModal(true); return; }
    if (item.value === '__community__') { setGroupModalMode('community'); setShowGroupModal(true); return; }
    onChange(item.value);
    clearFieldError('ex_payee');
  };

  const handleGroupConfirm = (name) => {
    setShowGroupModal(false);
    onChange(name);
    clearFieldError('ex_payee');
  };

  return (
    <div className="er-field" ref={wrapRef} style={{ position: 'relative' }}>
      <label className="er-label">Paid To *</label>
      <input
        type="text"
        className="er-input"
        data-field="ex_payee"
        style={errorBorder('ex_payee', fieldErrors)}
        placeholder="Who was paid?"
        value={value}
        onChange={e => { onChange(e.target.value); clearFieldError('ex_payee'); }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      <ValidationNote field="ex_payee" errors={fieldErrors} />

      {open && suggestions.length > 0 && (
        <div className="er-payee-dropdown">
          {suggestions.map((item, i) => (
            <button
              key={i}
              className={`er-payee-option${item.isAction ? ' er-payee-action' : ''}`}
              onMouseDown={e => { e.preventDefault(); handleSelect(item); }}
            >
              <span className="er-payee-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {showGroupModal && (
        <GroupOrgModal
          mode={groupModalMode}
          onConfirm={handleGroupConfirm}
          onClose={() => setShowGroupModal(false)}
        />
      )}
    </div>
  );
}


// ── Edit Receipt Ref Modal — editable for 1 hour after save ──────────────────
function EditRefModal({ expense, onSaved, onClose }) {
  const [invoiceRef, setInvoiceRef] = useState(expense.invoiceRef || expense.note || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await dataService.updateExpense(expense.id, { invoiceRef: invoiceRef.trim(), note: invoiceRef.trim() });
      // Mark reminder as done
      localStorage.setItem(`receipt_reminder_${expense.id}`, 'done');
      onSaved();
    } catch (e) { alert('Failed to save.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="er-modal-overlay" style={{ zIndex: 4000 }}>
      <div className="er-modal-content" style={{ maxHeight: '60vh' }}>
        <div className="er-modal-header">
          <h2>📎 Add Receipt / Ref</h2>
          <button className="er-modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="er-modal-body">
          <p style={{ fontSize:'13px', color:'var(--text-secondary,#6b7280)', margin:0 }}>
            {buildExpenseDescription(expense.category, expense.payee, expense.note, expense.gender)}
          </p>
          <div className="er-field">
            <label className="er-label">Invoice / Receipt Ref *</label>
            <input className="er-input" placeholder="Receipt or invoice number…"
              value={invoiceRef} autoFocus
              onChange={e => setInvoiceRef(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && invoiceRef.trim()) handleSave(); }}
            />
          </div>
        </div>
        <div className="er-modal-footer">
          <button className="er-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="er-btn-save" onClick={handleSave} disabled={saving || !invoiceRef.trim()}>{saving ? 'Saving…' : 'Save Ref'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Add Expense Modal ──────────────────────────────────────────────────────────
function AddExpenseModal({ onSave, onClose }) {
  const { fmt } = useCurrency();
  const { fieldErrors, showError, clearFieldError } = useValidation();

  const [date, setDate]                         = useState(todayStr());
  const [category, setCategory]                 = useState('');
  const [amount, setAmount]                     = useState('');
  const paymentMethod                           = 'cash'; // always cash
  const [payee, setPayee]                       = useState('');
  const [note, setNote]                         = useState('');
  const [saving, setSaving]                     = useState(false);
  const [showCatModal, setShowCatModal]         = useState(false);
  const [showAssetsModal, setShowAssetsModal]   = useState(false);
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false);
  const [showConsumablesModal, setShowConsumablesModal] = useState(false);
  const [showServicesModal, setShowServicesModal] = useState(false);
  const [suppliersList, setSuppliersList]       = useState([]);
  const [assetsResult, setAssetsResult]         = useState(null);
  const [users, setUsers]                       = useState([]);

  useEffect(() => {
    dataService.getSuppliers().then(s => setSuppliersList(s || []));
    dataService.getUsers().then(async (us) => {
      const landlord = await dataService.getLandlord();
      setUsers(landlord ? [...us, landlord] : us);
    });
  }, []);

  useEffect(() => { setPayee(''); setAssetsResult(null); }, [category]);

  const isSupplierPurchase = category === 'Supplier Purchase';

  const handleSave = async () => {
    if (!date)     return showError('ex_date',   'Date is required');
    if (!category) return showError('ex_cat',    'Category is required');

    if (isSupplierPurchase) {
      if (!assetsResult) return showError('ex_cat', 'Please complete the supplier purchase form');
      try {
        const now = new Date().toISOString();
        await dataService.addExpense({
          date, amount: assetsResult.total,
          category: 'Supplier Purchase',
          paymentMethod: assetsResult.paymentType || 'cash',
          payee: assetsResult.supplierName,
          note: `Ref: ${assetsResult.invoiceRef} — ${assetsResult.itemsSummary || ''}`,
          createdAt: now, updatedAt: now,
          _skipCashEntry: true,
        });
        onSave();
      } catch (e) { console.error(e); showError('ex_cat', 'Failed to save. Please try again.'); }
      return;
    }

    if (!amount || parseFloat(amount) <= 0) return showError('ex_amount', 'Enter a valid amount');
    if (!payee.trim()) return showError('ex_payee', 'Paid To is required');

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const payeeUser = users.find(u => (u.fullName||u.name||'').toLowerCase() === payee.trim().toLowerCase());
      const payeeGender = payeeUser?.gender || '';
      await dataService.addExpense({ date, amount: parseFloat(amount), category, paymentMethod, payee: payee.trim(), note: note.trim(), gender: payeeGender, createdAt: now, updatedAt: now });
      onSave();
    } catch (e) { console.error(e); showError('ex_date', 'Failed to save. Please try again.'); }
    finally { setSaving(false); }
  };

  const handleAssetsResult = (result) => {
    setAssetsResult(result);
    setShowAssetsModal(false);
    setPayee(result.supplierName || result.payee || '');
    setAmount(String(result.total || result.amount || ''));
    setNote(result.note || `Ref: ${result.invoiceRef || ''}`);
  };

  const handleSupplierModalResult = (result) => {
    setShowConsumablesModal(false);
    setShowServicesModal(false);
    setAssetsResult(result);
    setPayee(result.supplierName || result.payee || '');
    setAmount(String(result.total || result.amount || ''));
    setNote(result.note || '');
    // Save directly — these modals handle their own cash entries
    const saveIt = async () => {
      try {
        const now = new Date().toISOString();
        await dataService.addExpense({
          date, amount: parseFloat(result.total || result.amount || 0),
          category,
          paymentMethod: 'cash',
          payee: result.supplierName || result.payee || '',
          note: result.note || '',
          createdAt: now, updatedAt: now,
          _skipCashEntry: true,
        });
        onSave();
      } catch (e) { console.error(e); }
    };
    saveIt();
  };

  return (
    <div className="er-modal-overlay">
      <div className="er-modal-content">
        <div className="er-modal-header">
          <h2>💸 Add Expense</h2>
          <button className="er-modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="er-modal-body">

          <div className="er-field">
            <label className="er-label">Date *</label>
            <input type="date" className="er-input" data-field="ex_date"
              style={errorBorder('ex_date', fieldErrors)} value={date} max={todayStr()}
              onChange={e => { setDate(e.target.value); clearFieldError('ex_date'); }} />
            <ValidationNote field="ex_date" errors={fieldErrors} />
          </div>

          <div className="er-field">
            <label className="er-label">Category *</label>
            <button data-field="ex_cat"
              style={{ width: '100%', ...errorBorder('ex_cat', fieldErrors), textAlign: 'left', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid var(--border,#e5e7eb)', background: 'var(--surface,white)', fontSize: '14px', cursor: 'pointer', color: category ? 'var(--text-primary,#111)' : '#9ca3af' }}
              onClick={() => { setShowCatModal(true); clearFieldError('ex_cat'); }}>
              {category || 'Select category…'}
            </button>
            <ValidationNote field="ex_cat" errors={fieldErrors} />
          </div>

          {isSupplierPurchase && assetsResult && (
            <div style={{ padding: '10px 14px', background: (assetsResult.paymentType||'cash') === 'cash' ? '#f0fdf4' : '#eff6ff', border: `1.5px solid ${(assetsResult.paymentType||'cash') === 'cash' ? '#16a34a' : '#3b82f6'}`, borderRadius: '8px', fontSize: '13px', color: (assetsResult.paymentType||'cash') === 'cash' ? '#166534' : '#1e40af' }}>
              <div style={{ fontWeight: 700, marginBottom: '2px' }}>{(assetsResult.paymentType||'cash') === 'cash' ? '✓ Cash Purchase' : '✓ Credit Purchase'} — Ref: {assetsResult.invoiceRef}</div>
              <div style={{ fontSize: '12px', opacity: 0.85 }}>{assetsResult.supplierName} · {fmt(assetsResult.total)}</div>
              <button onClick={() => setShowAssetsModal(true)} style={{ marginTop: '6px', fontSize: '11px', color: '#667eea', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>Edit / Change</button>
            </div>
          )}
          {isSupplierPurchase && !assetsResult && (
            <div style={{ padding: '10px 14px', background: '#fef3c7', border: '1.5px solid #f59e0b', borderRadius: '8px', fontSize: '13px', color: '#92400e' }}>
              ⚠️ Tap <strong>🛒 Supplier</strong> in the Paid To field to complete the purchase form.
            </div>
          )}

          {!isSupplierPurchase && (<>
            <div className="er-field">
              <label className="er-label">Amount *</label>
              <input type="number" className="er-input" data-field="ex_amount"
                style={errorBorder('ex_amount', fieldErrors)} placeholder="0.00" min="0" step="0.01"
                value={amount} onChange={e => { setAmount(e.target.value); clearFieldError('ex_amount'); }} />
              <ValidationNote field="ex_amount" errors={fieldErrors} />
            </div>

            <div className="er-field">
              <span style={{ fontSize:'12px', color:'var(--text-secondary,#6b7280)', fontStyle:'italic' }}>💵 Cash payment</span>
            </div>

            <PaidToField
              category={category}
              value={payee}
              onChange={setPayee}
              onSupplierClick={() => {
                setAssetsResult(null);
                clearFieldError('ex_cat');
                if (SERVICE_CATS.includes(category)) {
                  setShowServicesModal(true);
                } else if (CONSUMABLE_CATS.includes(category)) {
                  setShowConsumablesModal(true);
                } else {
                  setCategory('Supplier Purchase');
                  setShowAssetsModal(true);
                }
              }}
              fieldErrors={fieldErrors}
              clearFieldError={clearFieldError}
              users={users}
            />

            <div className="er-field">
              <label className="er-label">Note (optional)</label>
              <textarea className="er-input er-textarea" data-field="ex_note"
                style={errorBorder('ex_note', fieldErrors)} placeholder="Description or reason…"
                value={note} onChange={e => { setNote(e.target.value); clearFieldError('ex_note'); }} />
              <ValidationNote field="ex_note" errors={fieldErrors} />
            </div>
            <p style={{ fontSize: '12px', color: '#667eea', margin: '4px 0 0', fontStyle: 'italic' }}>
              💰 A Cash OUT entry will be created automatically in Cash at Shop.
            </p>
            {category === 'Owner Drawings' && (
              <p style={{ fontSize: '12px', color: '#8b5cf6', margin: '4px 0 0', fontStyle: 'italic' }}>
                📤 This will also be recorded in Withdrawals.
              </p>
            )}
          </>)}

        </div>
        <div className="er-modal-footer">
          <button className="er-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="er-btn-save" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Expense'}</button>
        </div>
      </div>

      {showCatModal && (
        <CategoryModal selected={category} onSelect={cat => { setCategory(cat); clearFieldError('ex_cat'); setAssetsResult(null); }} onClose={() => setShowCatModal(false)} />
      )}
      {showAssetsModal && (
        <AddOperationalAssetsModal
          initialSupplierName={payee} initialSupplierId={null} suppliersList={suppliersList}
          onSave={handleAssetsResult}
          onClose={() => { setShowAssetsModal(false); if (!assetsResult) setCategory(''); }}
          onNewSupplier={() => { setShowAssetsModal(false); setShowNewSupplierModal(true); }}
        />
      )}
      {showNewSupplierModal && (
        <NewSupplierModal suppliersList={suppliersList}
          onSave={result => { setShowNewSupplierModal(false); handleAssetsResult(result); dataService.getSuppliers().then(s => setSuppliersList(s || [])); }}
          onClose={() => { setShowNewSupplierModal(false); setShowAssetsModal(true); }}
        />
      )}
      {showConsumablesModal && (
        <PurchaseConsumablesModal
          category={category}
          onSave={handleSupplierModalResult}
          onClose={() => setShowConsumablesModal(false)}
        />
      )}
      {showServicesModal && (
        <PurchaseServicesModal
          category={category}
          onSave={handleSupplierModalResult}
          onClose={() => setShowServicesModal(false)}
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
    catch (e) { alert(e.message); } finally { setDeleting(false); }
  };

  const handleSave = async () => {
    if (!date)   { alert('Date is required'); return; }
    if (!category) { alert('Category is required'); return; }
    if (!amount || parseFloat(amount)<=0) { alert('Enter a valid amount'); return; }
    if (category==='Other' && !note.trim()) { alert('Note is required when category is "Other"'); return; }
    setSaving(true);
    try {
      await dataService.updateExpense(expense.id, { date, category, amount:parseFloat(amount), paymentMethod, payee:payee.trim(), note:note.trim() });
      onSaved();
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };

  const d = new Date(expense.date || expense.createdAt || 0);
  const dateStr = d.toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' });

  return (
    <div className="er-modal-overlay">
      <div className="er-modal-content">
        <div className="er-modal-header">
          <h2>{editable ? '✏️ Edit Expense' : 'Expense Details'}</h2>
          <button className="er-modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="er-modal-body">
          {!editable ? (<>
            <div className="er-detail-row"><span>Date</span><span>{dateStr}</span></div>
            <div className="er-detail-row"><span>Category</span><span>{expense.category}</span></div>
            <div className="er-detail-row"><span>Description</span><span>{buildExpenseDescription(expense.category, expense.payee, expense.note, expense.gender)}</span></div>
            <div className="er-detail-row"><span>Amount</span><span className="er-detail-amount">{fmt(expense.amount||0)}</span></div>
            <div className="er-detail-row"><span>Method</span><span><span className={methodBadgeClass(expense.paymentMethod)}>{methodLabel(expense.paymentMethod)}</span></span></div>
            {expense.payee && <div className="er-detail-row"><span>Paid To</span><span>{expense.payee}</span></div>}
            {expense.note && <div className="er-detail-row"><span>Note</span><span>{expense.note}</span></div>}
          </>) : (<>
            <div className="er-field"><label className="er-label">Date *</label><input type="date" className="er-input" value={date} max={todayStr()} onChange={e => setDate(e.target.value)} /></div>
            <div className="er-field"><label className="er-label">Category *</label>
              <button style={{ textAlign:'left', padding:'10px 12px', borderRadius:'8px', border:'1.5px solid var(--border,#e5e7eb)', background:'var(--surface,white)', fontSize:'14px', cursor:'pointer', color:category?'var(--text-primary,#111)':'#9ca3af' }} onClick={() => setShowCatModal(true)}>{category || 'Select category…'}</button>
            </div>
            <div className="er-field"><label className="er-label">Amount *</label><input type="number" className="er-input" placeholder="0.00" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></div>
            <div className="er-field"><label className="er-label">Payment Method</label>
              <select className="er-input er-select" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="er-field"><label className="er-label">Paid To</label><input type="text" className="er-input" placeholder="Who was paid?" value={payee} onChange={e => setPayee(e.target.value)} /></div>
            <div className="er-field"><label className="er-label">Note {category==='Other'?'*':'(optional)'}</label><textarea className="er-input er-textarea" placeholder="Description…" value={note} onChange={e => setNote(e.target.value)} /></div>
          </>)}
        </div>
        <div className="er-modal-footer" style={{ flexDirection:'column', gap:'8px' }}>
          {editable ? (<>
            <div style={{ display:'flex', gap:'10px', width:'100%' }}>
              <button className="er-btn-cancel" onClick={onClose}>Cancel</button>
              <button className="er-btn-save" onClick={handleSave} disabled={saving}>{saving?'Saving…':'Update'}</button>
            </div>
            <button className="er-btn-delete" onClick={handleDelete} disabled={deleting}>{deleting?'Deleting…':'Delete Expense'}</button>
          </>) : (
            <button className="er-btn-save" onClick={onClose}>Close</button>
          )}
        </div>
      </div>
      {showCatModal && <CategoryModal selected={category} onSelect={setCategory} onClose={() => setShowCatModal(false)} />}
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
  const [editRefExpense, setEditRefExpense] = useState(null);

  const [catFilter, setCatFilter]         = useState('all');
  const [dateFilter, setDateFilter]       = useState('today');
  const [selectedDate, setSelectedDate]   = useState('');
  const [startDate, setStartDate]         = useState('');
  const [endDate, setEndDate]             = useState('');
  const [appliedCat, setAppliedCat]       = useState('all');
  const [appliedDate, setAppliedDate]     = useState('today');
  const [appliedSelDate, setAppliedSelDate] = useState('');
  const [appliedStart, setAppliedStart]   = useState('');
  const [appliedEnd, setAppliedEnd]       = useState('');
  const [payFilter, setPayFilter]         = useState('all');
  const [appliedPay, setAppliedPay]       = useState('all');

  useEffect(() => { loadExpenses(); }, []);
  useEffect(() => {
    const handleVisibility = () => { if (!document.hidden) loadExpenses(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);
  useEffect(() => { applyFilters(); }, // eslint-disable-line react-hooks/exhaustive-deps
    [expenses, appliedCat, appliedDate, appliedSelDate, appliedStart, appliedEnd, appliedPay]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadExpenses = async () => {
    const data = await dataService.getExpenses();
    const sorted = (data||[]).sort((a,b) => new Date(b.date||b.createdAt||0) - new Date(a.date||a.createdAt||0));
    setExpenses(sorted);
  };

  const resolveDate = (e) => {
    const raw = e.date || e.createdAt;
    if (!raw) return null;
    if (typeof raw==='object' && raw.seconds) return new Date(raw.seconds*1000);
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  };
  const toMidnight = d => { const c=new Date(d); c.setHours(0,0,0,0); return c; };

  const applyFilters = () => {
    let f = [...expenses];
    if (appliedCat!=='all') f = f.filter(e => e.category===appliedCat);
    if (appliedPay==='cash')     f = f.filter(e => (e.paymentMethod||'cash')==='cash');
    if (appliedPay==='non_cash') f = f.filter(e => (e.paymentMethod||'cash')!=='cash');
    const today=toMidnight(new Date()), tomorrow=new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
    if (appliedDate==='today')      f = f.filter(e => { const d=resolveDate(e); return d && d>=today && d<tomorrow; });
    if (appliedDate==='single' && appliedSelDate) {
      const s=toMidnight(new Date(appliedSelDate)), e2=new Date(s); e2.setDate(e2.getDate()+1);
      f = f.filter(e => { const d=resolveDate(e); return d && d>=s && d<e2; });
    }
    if (appliedDate==='range' && appliedStart && appliedEnd) {
      const s=toMidnight(new Date(appliedStart)), e2=new Date(toMidnight(new Date(appliedEnd))); e2.setDate(e2.getDate()+1);
      f = f.filter(e => { const d=resolveDate(e); return d && d>=s && d<e2; });
    }
    setFiltered(f);
  };

  const handleApplyFilters = () => {
    setAppliedCat(catFilter); setAppliedDate(dateFilter); setAppliedSelDate(selectedDate);
    setAppliedStart(startDate); setAppliedEnd(endDate); setAppliedPay(payFilter);
    setShowFilters(false);
  };

  const formatDisplayDate = ds => new Date(ds).toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' });
  const isYesterday = ds => { if (!ds) return false; const y=new Date(); y.setDate(y.getDate()-1); return toMidnight(new Date(ds)).getTime()===toMidnight(y).getTime(); };
  const getTableTitle = () => {
    if (appliedDate==='today') return 'Expenses Today';
    if (appliedDate==='single' && appliedSelDate) { if (isYesterday(appliedSelDate)) return 'Expenses Yesterday'; return `Expenses on ${formatDisplayDate(appliedSelDate)}`; }
    if (appliedDate==='range' && appliedStart && appliedEnd) return `Expenses from ${formatDisplayDate(appliedStart)} to ${formatDisplayDate(appliedEnd)}`;
    return 'Expenses Today';
  };
  const formatDate = e => { const d=resolveDate(e); if (!d) return 'N/A'; return d.toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' }); };

  const totalRecords = filtered.length;
  const cashSpent    = filtered.filter(e=>(e.paymentMethod||'cash')==='cash').reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
  const onCredit     = filtered.filter(e=>(e.paymentMethod||'cash')==='credit').reduce((s,e)=>s+(parseFloat(e.amount)||0),0);

  return (
    <div className="er-record">
      <div className="er-sticky-bar">
        <div className="er-top-row">
          <button className="er-filter-action-btn er-filter-toggle-btn" onClick={() => setShowFilters(v=>!v)}>{showFilters?'Close Filter ▲':'Filter ▼'}</button>
          <button className="er-filter-action-btn er-add-btn" onClick={() => setShowAddModal(true)}>
            <Plus size={14} style={{ marginRight:4, verticalAlign:'middle' }} />Add Expense
          </button>
        </div>

        {showFilters && (
          <div className="filter-modal-overlay" onClick={() => setShowFilters(false)}>
            <div className="filter-modal-sheet" onClick={e => e.stopPropagation()}>
              <div className="filter-modal-handle"/>
              <div className="filter-modal-title">Filter Expenses</div>
            <div className="er-filter-group">
              <label>CATEGORY FILTER</label>
              <div className="er-filter-buttons">
                <button className={`er-filter-btn${catFilter==='all'?' active':''}`} onClick={() => setCatFilter('all')}>All Expenses</button>
                {catFilter !== 'all' && (
                  <button className="er-filter-btn er-filter-btn-cat-active" onClick={() => setShowMoreCats(true)}>{catFilter}</button>
                )}
                <button className={`er-filter-btn er-filter-btn-more${catFilter!=='all'?' has-selection':''}`} onClick={() => setShowMoreCats(true)}>More…</button>
              </div>
            </div>
            <div className="er-filter-group">
              <label>DATE FILTER</label>
              <div className="er-filter-buttons">
                {[['today','Today'],['single','Single Date'],['range','Date Range']].map(([val,lbl]) => (
                  <button key={val} className={`er-filter-btn${dateFilter===val?' active':''}`} onClick={() => setDateFilter(val)}>{lbl}</button>
                ))}
              </div>
              {dateFilter==='single' && <input type="date" className="er-date-input" value={selectedDate} max={todayStr()} onChange={e => setSelectedDate(e.target.value)} />}
              {dateFilter==='range' && (
                <div className="er-date-range-inputs">
                  <div className="er-date-range-field"><span className="er-date-range-label">From</span><input type="date" className="er-date-input" value={startDate} max={todayStr()} onChange={e => setStartDate(e.target.value)} /></div>
                  <div className="er-date-range-field"><span className="er-date-range-label">To</span><input type="date" className="er-date-input" value={endDate} max={todayStr()} onChange={e => setEndDate(e.target.value)} /></div>
                </div>
              )}
            </div>
            <div className="er-filter-group">
              <label>PAYMENT METHOD</label>
              <div className="er-filter-buttons">
                {[['all','All'],['cash','Cash'],['non_cash','Non-Cash']].map(([val,lbl]) => (
                  <button key={val} className={`er-filter-btn${payFilter===val?' active':''}`} onClick={() => setPayFilter(val)}>{lbl}</button>
                ))}
              </div>
            </div>
              <div className="filter-modal-actions">
                <button className="filter-modal-cancel" onClick={() => setShowFilters(false)}>Cancel</button>
                <button className="filter-modal-apply" onClick={handleApplyFilters}>Apply Filter</button>
              </div>
            </div>
          </div>
        )}

        <h3 className="er-section-title">{getTableTitle()}</h3>
        <div className="er-summary-cards">
          <div className="er-summary-card"><div className="er-summary-label">Total Records</div><div className="er-summary-value">{totalRecords}</div></div>
          <div className="er-summary-card"><div className="er-summary-label">Cash Spent</div><div className="er-summary-value cash">{fmt(cashSpent)}</div></div>
          <div className="er-summary-card"><div className="er-summary-label">On Credit</div><div className="er-summary-value credit">{fmt(onCredit)}</div></div>
        </div>
      </div>

      <div className="er-table-section">
        <div className="er-table-section-inner">
        {filtered.length===0 ? (
          <div className="er-empty">No expenses found for this filter.</div>
        ) : (
          <div className="er-table-wrap">
            <table className="er-table">
              <thead>
                <tr><th>Date</th><th>DESCRIPTION</th><th className="right">Amount</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id} onClick={() => setViewExpense(e)}>
                    <td style={{ whiteSpace:'nowrap', fontSize:'12px' }}>{formatDate(e)}</td>
                    <td className="er-td-cat">{buildExpenseDescription(e.category, e.payee, e.note, e.gender)}</td>
                    <td className="er-td-amount">{fmt(e.amount||0)}</td>
                    <td style={{ textAlign:'center', padding:'6px 4px' }}>
                      {(() => {
                        const ONE_HOUR = 60 * 60 * 1000;
                        const saved = new Date(e.createdAt || e.date || 0);
                        const withinHour = (new Date() - saved) <= ONE_HOUR;
                        const hasRef = !!(e.invoiceRef && e.invoiceRef.trim());
                        const isSupplierType = ['Utilities','Maintenance','Internet','Fuel','Supplies','Food','Supplier Purchase'].includes(e.category);
                        if (withinHour && !hasRef && isSupplierType) {
                          return <button onClick={ev => { ev.stopPropagation(); setEditRefExpense(e); }}
                            style={{ background:'#fef3c7', border:'1px solid #f59e0b', borderRadius:'6px', padding:'3px 7px', fontSize:'11px', cursor:'pointer', color:'#92400e', fontWeight:700 }}>📎 Ref</button>;
                        }
                        if (hasRef) return <span style={{ fontSize:'10px', color:'#16a34a' }}>✓</span>;
                        return null;
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && <AddExpenseModal onSave={() => { setShowAddModal(false); loadExpenses(); }} onClose={() => setShowAddModal(false)} />}
      {viewExpense && <ExpenseDetailModal expense={viewExpense} onClose={() => setViewExpense(null)} onSaved={() => { setViewExpense(null); loadExpenses(); }} onDeleted={() => { setViewExpense(null); loadExpenses(); }} />}
      {showMoreCats && <CategoryModal selected={catFilter} onSelect={cat => setCatFilter(cat||'all')} onClose={() => setShowMoreCats(false)} />}
      {editRefExpense && <EditRefModal expense={editRefExpense} onSaved={() => { setEditRefExpense(null); loadExpenses(); }} onClose={() => setEditRefExpense(null)} />}
    </div>
  );
}

export default ExpensesRecord;
