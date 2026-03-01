import React, { useState, useEffect, useRef } from 'react';
import { Edit2, X, Plus, Trash2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import dataService from '../services/dataService';
import { useCurrency } from '../hooks/useCurrency';
import PdfTableButton from '../components/PdfTableButton';
import './CashRecord.css';
import './PurchaseRecord.css';

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

// ── Dropdown constants ──────────────────────────────────────────────────────
const CASH_FROM_NAMES = ['Riti', 'Kamwatie', 'Tikanboi', 'Baikite', 'Landlord', 'Others'];
const PAID_TO_NAMES   = ['Riti', 'Kamwatie', 'Tikanboi', 'Baikite', 'Landlord', 'Others'];

const CASH_IN_REASONS = [
  { key: 'float',        label: 'Float (change money)',           phrase: 'for float (change money)' },
  { key: 'purchases',    label: 'Purchases (money to buy stock)', phrase: 'to purchase stock' },
  { key: 'safe_keeping', label: 'Safe Keeping',                   phrase: 'for safe keeping' },
];

const PAID_TO_REASONS = [
  { key: 'advance',      label: 'Cash Advance',      phrase: 'for cash advance' },
  { key: 'electricity',  label: 'Electricity bill',   phrase: 'to pay electricity bill' },
  { key: 'rent',         label: 'Land Rental',        phrase: 'to pay land rental' },
  { key: 'other',        label: 'Other reason…',      phrase: '' },
];

// Helper: check if a PAID TO name is a known supplier (loaded at runtime)
function isKnownSupplier(name, suppliersList) {
  if (!name) return false;
  const low = name.toLowerCase().trim();
  return suppliersList.some(s =>
    (s.name || s.customerName || '').toLowerCase().trim() === low
  );
}

function getSupplierRecord(name, suppliersList) {
  if (!name) return null;
  const low = name.toLowerCase().trim();
  return suppliersList.find(s =>
    (s.name || s.customerName || '').toLowerCase().trim() === low
  ) || null;
}

// ── Operational Expenses Modal (mini-purchase modal) ────────────────────────
// Opens when a supplier is selected in PAID TO and user clicks BEING FOR.
// Similar to AddPurchaseModal but title = "Operational Expenses bought at [supplier]"
// and PackSize unit field is editable (not locked).
function OperationalExpensesModal({ supplierName, supplierId, onSave, onClose }) {
  const { fmt } = useCurrency();
  const [paymentType, setPaymentType] = useState('cash');
  const [dueDate, setDueDate]         = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [rows, setRows] = useState([{
    id: 1, qty: '', description: '', descSearch: '', showDescDrop: false,
    costPrice: '', packUnit: '', packSize: '',
  }]);
  const [goods, setGoods]           = useState([]);
  const [invoiceRef, setInvoiceRef] = useState('');
  const [notes, setNotes]           = useState('');
  const [receiptPhoto, setReceiptPhoto] = useState(null);
  const [saving, setSaving]         = useState(false);
  const [fieldError, setFieldError] = useState(null);
  const [cashBalance, setCashBalance] = useState(null);
  const nextId = useRef(2);

  useEffect(() => {
    dataService.getGoods().then(d => setGoods(d || []));
    dataService.getCashEntries().then(entries => {
      const bal = (entries || []).reduce((sum, e) =>
        sum + (e.type === 'in' ? (e.amount || 0) : -(e.amount || 0)), 0);
      setCashBalance(bal);
    });
    const unsub = dataService.onGoodsChange(g => setGoods(g || []));
    return () => unsub();
  }, []);

  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  const addRow = () => setRows(prev => [...prev, {
    id: nextId.current++, qty: '', description: '', descSearch: '',
    showDescDrop: false, costPrice: '', packUnit: '', packSize: '',
  }]);
  const removeRow = (id) => setRows(prev => prev.filter(r => r.id !== id));
  const updateRow = (id, field, val) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));

  const descResults = (search) => {
    if (!search.trim()) return [];
    const t = search.toLowerCase();
    const tier1 = [], tier2 = [], tier3 = [];
    for (const g of goods) {
      const name = (g.name || '').toLowerCase();
      const words = name.split(/\s+/);
      if (words[0]?.startsWith(t)) tier1.push(g);
      else if (words[1]?.startsWith(t)) tier2.push(g);
      else if (words[2]?.startsWith(t)) tier3.push(g);
    }
    return [...tier1, ...tier2, ...tier3].slice(0, 12);
  };

  const itemTotal = rows.reduce((sum, r) =>
    sum + (parseFloat(r.qty)||0) * (parseFloat(r.costPrice)||0), 0);

  const takePhoto = async () => {
    if (!Capacitor.isNativePlatform()) {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*'; input.capture = 'camera';
      input.onchange = e => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = ev => setReceiptPhoto(ev.target.result);
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      try {
        const { Camera } = await import('@capacitor/camera');
        const image = await Camera.getPhoto({ quality: 70, allowEditing: false, resultType: 'dataUrl' });
        setReceiptPhoto(image.dataUrl);
      } catch { /* ignore */ }
    }
  };

  const handleSave = async () => {
    if (!invoiceRef.trim()) { alert('Please enter a Ref / invoice number.'); return; }
    if (!purchaseDate) { alert('Please select a purchase date.'); return; }
    for (const r of rows) {
      if (!r.description?.trim()) {
        setFieldError({ rowId: r.id, field: 'description', message: 'Select an item first' });
        return;
      }
      if (!parseFloat(r.qty) > 0 && !r.qty) {
        setFieldError({ rowId: r.id, field: 'qty', message: 'Enter a quantity' });
        return;
      }
      if (!parseFloat(r.costPrice) > 0 && !r.costPrice) {
        setFieldError({ rowId: r.id, field: 'costPrice', message: 'Enter a cost' });
        return;
      }
    }
    setFieldError(null);
    const validRows = rows.filter(r => r.description.trim() && parseFloat(r.qty) > 0);
    if (validRows.length === 0) { alert('Please add at least one item.'); return; }

    const total = validRows.reduce((s, r) =>
      s + (parseFloat(r.qty)||0) * (parseFloat(r.costPrice)||0), 0);

    if (paymentType === 'cash' && cashBalance !== null && total > cashBalance) {
      alert(`Total (${fmt(total)}) exceeds Cash Balance (${fmt(cashBalance)}). Reduce amount or use Credit.`);
      return;
    }

    setSaving(true);
    try {
      const items = validRows.map(r => ({
        qty: parseFloat(r.qty),
        description: r.description.trim(),
        costPrice: parseFloat(r.costPrice) || 0,
        subtotal: (parseFloat(r.qty)||0) * (parseFloat(r.costPrice)||0),
        packUnit: r.packUnit || '',
        packSize: r.packSize || '',
        packDisplay: r.packUnit ? `${r.packUnit}\u00d7${r.packSize||'?'}` : '',
        stockToAdd: (parseFloat(r.qty)||0) * (parseFloat(r.packUnit)||0),
      }));

      await dataService.addPurchase({
        supplierName, supplierId: supplierId || null,
        paymentType, creditorId: paymentType === 'credit' ? supplierId : null,
        dueDate: paymentType === 'credit' ? dueDate : null,
        date: new Date(purchaseDate + 'T12:00:00').toISOString(),
        items, total,
        notes: notes.trim(), invoiceRef: invoiceRef.trim(),
        receiptPhoto: receiptPhoto || null,
      });

      // Build summary for description
      const itemNames = items.map(i => i.description).join(', ');
      onSave({
        paymentType,
        total,
        invoiceRef: invoiceRef.trim(),
        itemsSummary: itemNames,
      });
    } catch (e) {
      console.error(e);
      alert('Failed to save. Please try again.');
    } finally { setSaving(false); }
  };

  return (
    <div className="pr-modal-overlay" style={{ zIndex: 4000 }}>
      <div className="pr-modal-content">
        <div className="pr-modal-header">
          <h2 style={{ fontSize: '15px' }}>Operational Expenses bought at {supplierName}</h2>
          <button className="pr-modal-close" onClick={onClose}><X size={20}/></button>
        </div>
        <div className="pr-modal-body">

          {/* Payment Type */}
          <div className="pr-field">
            <label>Payment Type *</label>
            <div className="pr-pay-type-row">
              {[['cash','💵 Cash Paid'],['credit','📋 Buy on Credit']].map(([pt, lbl]) => (
                <button key={pt} type="button"
                  className={`pr-pay-type-btn${paymentType===pt?(pt==='cash'?' pr-pay-cash-active':' pr-pay-credit-active'):''}`}
                  onClick={() => setPaymentType(pt)}
                >{lbl}</button>
              ))}
            </div>
            <p style={{fontSize:'11px',marginTop:'4px',color:paymentType==='credit'?'#4f46e5':'#6b7280'}}>
              {paymentType==='cash'
                ? 'Cash paid now — a Cash OUT entry will be recorded.'
                : 'Goods received, pay later — creditor balance updated.'}
            </p>
          </div>

          {paymentType === 'credit' && (
            <div className="pr-date-inline">
              <label className="pr-date-inline-label">Due Date</label>
              <input type="date" className="pr-date-inline-input"
                value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          )}

          <div className="pr-date-inline">
            <label className="pr-date-inline-label">Purchase Date *</label>
            <input type="date" className="pr-date-inline-input"
              value={purchaseDate} max={getTodayStr()}
              onChange={e => setPurchaseDate(e.target.value)} />
          </div>

          {/* Items table */}
          <div className="pr-field">
            <label>Items Purchased *</label>
            <div className="pr-items-table-wrapper">
              <table className="pr-items-tbl">
                <thead>
                  <tr>
                    <th className="pr-ith pr-ith-qty">QTY</th>
                    <th className="pr-ith pr-ith-desc">DESCRIPTION</th>
                    <th className="pr-ith pr-ith-pack">PACKSIZE</th>
                    <th className="pr-ith pr-ith-cost">COST</th>
                    <th className="pr-ith" style={{width:'24px'}}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const results = descResults(row.descSearch);
                    return (
                      <tr key={row.id}>
                        <td className="pr-itd pr-itd-qty">
                          <input type="number" className="pr-it-input pr-it-qty"
                            placeholder="0" min="0" step="1" value={row.qty}
                            onChange={e => { updateRow(row.id, 'qty', e.target.value); setFieldError(null); }} />
                        </td>
                        <td className="pr-itd pr-itd-desc" style={{position:'relative'}}>
                          <input type="text" className="pr-it-input pr-it-desc"
                            placeholder="Search inventory…"
                            value={row.descSearch !== undefined ? row.descSearch : row.description}
                            onChange={e => {
                              updateRow(row.id, 'descSearch', e.target.value);
                              updateRow(row.id, 'showDescDrop', true);
                            }}
                            onFocus={() => updateRow(row.id, 'showDescDrop', true)}
                            onBlur={() => setTimeout(() => updateRow(row.id, 'showDescDrop', false), 180)}
                          />
                          {row.showDescDrop && results.length > 0 && (
                            <div className="pr-desc-drop" style={{position:'absolute',top:'100%',left:0,right:0,zIndex:1000,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'6px',maxHeight:'140px',overflowY:'auto',boxShadow:'0 4px 12px rgba(0,0,0,0.15)'}}>
                              {results.map(g => (
                                <div key={g.id} className="pr-desc-drop-item"
                                  onMouseDown={() => {
                                    updateRow(row.id, 'description', g.name || '');
                                    updateRow(row.id, 'descSearch', g.name || '');
                                    updateRow(row.id, 'packSize', g.size || '');
                                    updateRow(row.id, 'showDescDrop', false);
                                  }}>
                                  {g.name}{g.size ? <span style={{color:'#6b7280',fontSize:'0.85em',marginLeft:4}}>{g.size}</span> : null}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        {fieldError?.rowId === row.id && (
                          <td style={{padding:0,position:'relative',border:'none'}}>
                            <div style={{position:'absolute',top:'50%',left:'4px',transform:'translateY(-50%)',background:'#ef4444',color:'white',fontSize:'11px',fontWeight:600,padding:'4px 8px',borderRadius:'6px',whiteSpace:'nowrap',zIndex:2000}}>
                              ← {fieldError.message}
                            </div>
                          </td>
                        )}
                        <td className="pr-itd pr-itd-pack">
                          <div className="pr-pack-pair">
                            <input type="text" className="pr-it-input pr-it-pack-unit"
                              placeholder="unit" value={row.packUnit}
                              disabled={!row.description}
                              onChange={e => { updateRow(row.id, 'packUnit', e.target.value); setFieldError(null); }} />
                            <span className="pr-pack-x">&times;</span>
                            <input type="text" className="pr-it-input pr-it-pack-size"
                              placeholder="size" value={row.packSize}
                              disabled={!row.description}
                              onChange={e => updateRow(row.id, 'packSize', e.target.value)} />
                          </div>
                        </td>
                        <td className="pr-itd pr-itd-cost">
                          <input type="number" className="pr-it-input pr-it-cost"
                            placeholder="0.00" min="0" step="0.01" value={row.costPrice}
                            disabled={!row.description}
                            onChange={e => { updateRow(row.id, 'costPrice', e.target.value); setFieldError(null); }} />
                        </td>
                        <td className="pr-itd pr-itd-del">
                          {rows.length > 1 && (
                            <button className="pr-item-remove" onClick={() => removeRow(row.id)}>
                              <Trash2 size={14}/>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {(() => {
              const last = rows[rows.length - 1];
              const ok = last?.description?.trim() && parseFloat(last.qty) > 0 && parseFloat(last.costPrice) > 0;
              return (
                <button className={"pr-add-row-btn" + (ok ? "" : " pr-add-row-btn-disabled")}
                  onClick={addRow} disabled={!ok}>
                  <Plus size={14}/> Add Item
                </button>
              );
            })()}
          </div>

          <div className="pr-total-row">
            <span>Total Cost</span>
            <span className="pr-total-val">{fmt(itemTotal)}</span>
          </div>
          {paymentType === 'cash' && cashBalance !== null && itemTotal > cashBalance && itemTotal > 0 && (
            <div style={{background:'#fee2e2',border:'1px solid #fca5a5',borderRadius:'6px',padding:'8px 12px',fontSize:'12px',color:'#b91c1c',marginTop:'4px'}}>
              ⚠️ Total exceeds Cash Balance ({fmt(cashBalance)}).
            </div>
          )}

          <div className="pr-ref-inline">
            <label className="pr-ref-label">Ref *</label>
            <input type="text" className="pr-ref-input" placeholder="Invoice / receipt number…"
              value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)} />
          </div>

          <div className="pr-field">
            <label>Notes <span style={{fontWeight:400,color:'#9ca3af'}}>(optional)</span></label>
            <textarea className="pr-input" rows={2} placeholder="Additional notes…"
              value={notes} onChange={e => setNotes(e.target.value)}
              style={{resize:'vertical',minHeight:'48px'}} />
          </div>

          <div style={{display:'flex',gap:'8px',marginTop:'4px'}}>
            <button type="button" onClick={takePhoto}
              style={{flex:1,padding:'8px',background:'var(--surface)',border:'1.5px dashed var(--border)',borderRadius:'8px',cursor:'pointer',fontSize:'13px',color:'var(--text-secondary)'}}>
              📸 {receiptPhoto ? 'Retake Photo' : 'Receipt Photo'}
            </button>
          </div>
          {receiptPhoto && (
            <div style={{marginTop:'6px',textAlign:'center'}}>
              <img src={receiptPhoto} alt="receipt" style={{maxWidth:'100%',maxHeight:'120px',borderRadius:'6px',border:'1px solid var(--border)'}} />
            </div>
          )}
        </div>
        <div className="pr-modal-footer">
          <button className="pr-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="pr-btn-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Purchase'}
          </button>
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
  const [isProcessing, setIsProcessing]   = useState(false);
  // Inline fields (shared)
  const [personName, setPersonName]           = useState('');
  const [isOthersMode, setIsOthersMode]       = useState(false);
  const [personSearch, setPersonSearch]        = useState('');
  const [showNameDrop, setShowNameDrop]        = useState(false);
  const [showSearchDrop, setShowSearchDrop]    = useState(false);
  const [creditorsList, setCreditorsList]      = useState([]);
  const [suppliersList, setSuppliersList]      = useState([]);
  const [refNumber, setRefNumber]              = useState('');
  // Cash In specific
  const [cashInReasonKey, setCashInReasonKey]  = useState('');
  const [showCashInReasonDrop, setShowCashInReasonDrop] = useState(false);
  // Cash Out specific
  const [beingForKey, setBeingForKey]          = useState('');
  const [showBeingForDrop, setShowBeingForDrop] = useState(false);
  const [otherReasonText, setOtherReasonText]  = useState('');
  const [showOtherReasonInput, setShowOtherReasonInput] = useState(false);
  // Operational Expenses modal (supplier purchase from Cash Out)
  const [showExpensesModal, setShowExpensesModal] = useState(false);
  const [expensesResult, setExpensesResult]       = useState(null); // {paymentType, total, invoiceRef, itemsSummary}

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
    setNewAmount(''); setNewType(TYPE_IN);
    setPersonName(''); setIsOthersMode(false); setPersonSearch('');
    setShowNameDrop(false); setShowSearchDrop(false);
    setRefNumber('');
    setCashInReasonKey(''); setShowCashInReasonDrop(false);
    setBeingForKey(''); setShowBeingForDrop(false);
    setOtherReasonText(''); setShowOtherReasonInput(false);
    setShowExpensesModal(false); setExpensesResult(null);
  };
  const openAddModal = async () => {
    resetAddModal();
    setShowAddModal(true);
    // Pre-load creditors and suppliers for "Others" dropdowns
    const [creds, supps] = await Promise.all([
      dataService.getCreditors(),
      dataService.getSuppliers(),
    ]);
    setCreditorsList(creds || []);
    setSuppliersList(supps || []);
  };
  const closeAddModal = () => { setShowAddModal(false); resetAddModal(); };

  const handleNameSelect = (name) => {
    setShowNameDrop(false);
    // Reset being-for and expenses when name changes
    setBeingForKey(''); setExpensesResult(null);
    setOtherReasonText(''); setShowOtherReasonInput(false);
    if (name === 'Others') {
      setIsOthersMode(true);
      setPersonName('');
      setPersonSearch('');
    } else {
      setIsOthersMode(false);
      setPersonName(name);
      setPersonSearch('');
    }
  };

  const getResolvedName = () => {
    if (isOthersMode) return personSearch.trim() || personName.trim();
    return personName.trim();
  };

  const filteredOthersList = (() => {
    const list = newType === TYPE_IN ? creditorsList : suppliersList;
    const q = personSearch.toLowerCase();
    return list.filter(item => {
      const n = (item.name || item.customerName || '').toLowerCase();
      return n.includes(q);
    });
  })();

  const handleBeingForSelect = (key) => {
    setShowBeingForDrop(false);
    setBeingForKey(key);
    if (key === 'other') {
      setShowOtherReasonInput(true);
      setOtherReasonText('');
    } else {
      setShowOtherReasonInput(false);
      setOtherReasonText('');
    }
  };

  // When BEING FOR is clicked and paid-to is a supplier → open expenses modal
  const handleBeingForClick = () => {
    const name = getResolvedName();
    if (name && isKnownSupplier(name, suppliersList)) {
      // Open the operational expenses modal instead of the dropdown
      setShowExpensesModal(true);
    } else {
      setShowBeingForDrop(o => !o);
    }
  };

  // Called when OperationalExpensesModal saves
  // addPurchase() already created the purchase record + cash entry (cash) or creditor (credit)
  const handleExpensesSaved = async (result) => {
    setExpensesResult(result);
    setShowExpensesModal(false);
    const name = getResolvedName();
    const items = result.itemsSummary || 'items';

    // Update the auto-created cash entry's note to our format
    if (result.paymentType === 'cash') {
      try {
        const allEntries = await dataService.getCashEntries() || [];
        // Find the most recent purchase-source entry with matching invoiceRef
        const match = [...allEntries].reverse().find(e =>
          e.source === 'purchase' && e.invoiceRef === result.invoiceRef
        );
        if (match) {
          await dataService.updateCashEntry(match.id, {
            note: `Paid ${name} for ${items}.`
          });
        }
      } catch (e) { console.error('Error updating purchase cash entry note:', e); }
      // Auto-fill amount from the purchase total
      setNewAmount(String(result.total));
    } else {
      // Credit — no cash entry, set amount to 0 (informational)
      setNewAmount('0');
    }
    if (result.invoiceRef) setRefNumber(result.invoiceRef);
    setBeingForKey('__supplier_purchase__');
  };

  const buildNote = () => {
    const name = getResolvedName();
    if (newType === TYPE_IN) {
      // Cash In: "From [name] [reason phrase]."
      const reasonObj = CASH_IN_REASONS.find(r => r.key === cashInReasonKey);
      const phrase = reasonObj?.phrase || '';
      if (name && phrase) return `From ${name} ${phrase}.`;
      if (name) return `From ${name}.`;
      return '';
    } else {
      // Cash Out with supplier purchase
      if (beingForKey === '__supplier_purchase__' && expensesResult) {
        const items = expensesResult.itemsSummary || 'items';
        if (expensesResult.paymentType === 'cash') {
          return `Paid ${name} for ${items}.`;
        } else {
          return `Owed ${name} for ${items}.`;
        }
      }
      // Cash Out with regular reason
      const phrase = beingForKey === 'other'
        ? (otherReasonText.trim() ? `for ${otherReasonText.trim()}` : '')
        : (PAID_TO_REASONS.find(r => r.key === beingForKey)?.phrase || '');
      if (name && phrase) return `Paid ${name} ${phrase}.`;
      if (name) return `Paid ${name}.`;
      return '';
    }
  };

  const canSave = () => {
    const name = getResolvedName();
    if (!name) return false;

    // Supplier purchase — purchase is already saved, just need to close
    if (newType === TYPE_OUT && beingForKey === '__supplier_purchase__' && expensesResult) {
      return true; // allow close even for credit (amount=0)
    }

    const amt = parseFloat(newAmount);
    if (isNaN(amt) || amt <= 0) return false;
    if (newType === TYPE_IN) {
      if (!cashInReasonKey) return false;
    }
    if (newType === TYPE_OUT) {
      if (!beingForKey) return false;
      if (beingForKey === 'other' && !otherReasonText.trim()) return false;
    }
    return true;
  };

  const handleSaveEntry = async () => {
    const name = getResolvedName();
    if (!name) { alert(`Please enter who the cash is ${newType === TYPE_IN ? 'from' : 'paid to'}.`); return; }

    // ── Supplier purchase (already saved by OperationalExpensesModal) ──
    if (newType === TYPE_OUT && beingForKey === '__supplier_purchase__' && expensesResult) {
      // Purchase + cash entry (or creditor) already created by addPurchase.
      // Just close and reload.
      closeAddModal();
      await loadEntries();
      return;
    }

    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount <= 0) { alert('Please enter a valid amount.'); return; }
    if (newType === TYPE_IN && !cashInReasonKey) { alert('Please select a reason.'); return; }
    if (newType === TYPE_OUT && !beingForKey) { alert('Please select a reason.'); return; }
    if (newType === TYPE_OUT && beingForKey === 'other' && !otherReasonText.trim()) { alert('Please enter the reason.'); return; }

    const note = buildNote();
    if (!note) { alert('Could not build description. Please fill all fields.'); return; }

    setIsProcessing(true);
    try {
      const _now = new Date();
      await dataService.addCashEntry({
        type: newType, amount, note,
        date: _now.toISOString(),
        source: 'manual',
        business_date: _now.toISOString().slice(0, 10),
        ...(refNumber.trim() ? { invoiceRef: refNumber.trim() } : {}),
      });

      // If Cash In "Others" with a new name, create a creditor stub
      if (newType === TYPE_IN && isOthersMode && name) {
        const existing = creditorsList.find(c =>
          (c.name || c.customerName || '').toLowerCase() === name.toLowerCase()
        );
        if (!existing) {
          try {
            const creditors = await dataService.getCreditors() || [];
            const newCreditor = {
              id: Date.now(),
              name: name,
              customerName: name,
              phone: '', customerPhone: '', whatsapp: '', email: '', address: '', gender: '',
              repaymentDate: '',
              totalDue: 0, totalPaid: 0, balance: 0,
              deposits: [], purchaseIds: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            creditors.push(newCreditor);
            await dataService.setCreditors(creditors);
          } catch (e) { console.error('Error creating creditor stub:', e); }
        }
      }

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
                  onClick={() => {
                    setPersonName(''); setIsOthersMode(false); setPersonSearch('');
                    setShowNameDrop(false); setShowSearchDrop(false); setRefNumber('');
                    setCashInReasonKey(''); setShowCashInReasonDrop(false);
                    setBeingForKey(''); setShowBeingForDrop(false);
                    setOtherReasonText(''); setShowOtherReasonInput(false);
                    setExpensesResult(null); setShowExpensesModal(false);
                    setNewType(TYPE_IN);
                  }}>
                  Cash In
                </button>
                <button
                  className={`cj-modal-type-btn${newType === TYPE_OUT ? ' active-out' : ''}`}
                  onClick={() => {
                    setPersonName(''); setIsOthersMode(false); setPersonSearch('');
                    setShowNameDrop(false); setShowSearchDrop(false); setRefNumber('');
                    setCashInReasonKey(''); setShowCashInReasonDrop(false);
                    setBeingForKey(''); setShowBeingForDrop(false);
                    setOtherReasonText(''); setShowOtherReasonInput(false);
                    setExpensesResult(null); setShowExpensesModal(false);
                    setNewType(TYPE_OUT);
                  }}>
                  Cash Out
                </button>
              </div>
            </div>

            {/* Amount — always first */}
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

            {/* ── Cash In fields ── */}
            {newType === TYPE_IN && (
              <>
                {/* Cash From */}
                <div className="cj-modal-field" style={{ position:'relative' }}>
                  <label>Cash From</label>
                  {isOthersMode ? (
                    <>
                      <input
                        className="cj-modal-input"
                        value={personSearch}
                        onChange={e => { setPersonSearch(e.target.value); setShowSearchDrop(true); }}
                        onFocus={() => setShowSearchDrop(true)}
                        onBlur={() => setTimeout(() => setShowSearchDrop(false), 200)}
                        placeholder="Search creditors or type name…"
                        autoFocus
                      />
                      {showSearchDrop && filteredOthersList.length > 0 && (
                        <div className="cj-desc-dropdown" style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:300 }}>
                          {filteredOthersList.map(c => {
                            const n = c.name || c.customerName;
                            return (
                              <button key={c.id} className="cj-desc-dropdown-item"
                                onMouseDown={() => { setPersonSearch(n); setShowSearchDrop(false); }}>
                                {n}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <button style={{ marginTop:'4px', fontSize:'11px', color:'#667eea', background:'none', border:'none', cursor:'pointer', padding:0 }}
                        onClick={() => { setIsOthersMode(false); setPersonName(''); setPersonSearch(''); }}>
                        ← Back to list
                      </button>
                    </>
                  ) : (
                    <button
                      className={`cj-desc-trigger${personName ? ' has-value' : ''}`}
                      onClick={() => setShowNameDrop(o => !o)}
                    >
                      <span className="cj-desc-trigger-text">{personName || 'Select name…'}</span>
                      <span className="cj-desc-chevron">{showNameDrop ? '▲' : '▼'}</span>
                    </button>
                  )}
                  {showNameDrop && !isOthersMode && (
                    <div className="cj-desc-dropdown" style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:300 }}>
                      {CASH_FROM_NAMES.map(n => (
                        <button key={n} className="cj-desc-dropdown-item" onMouseDown={() => handleNameSelect(n)}>{n}</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Being For (reason dropdown) */}
                <div className="cj-modal-field" style={{ position:'relative' }}>
                  <label>Being For</label>
                  <button
                    className={`cj-desc-trigger${cashInReasonKey ? ' has-value' : ''}`}
                    onClick={() => setShowCashInReasonDrop(o => !o)}
                  >
                    <span className="cj-desc-trigger-text">
                      {cashInReasonKey
                        ? CASH_IN_REASONS.find(r => r.key === cashInReasonKey)?.label
                        : 'Select reason…'}
                    </span>
                    <span className="cj-desc-chevron">{showCashInReasonDrop ? '▲' : '▼'}</span>
                  </button>
                  {showCashInReasonDrop && (
                    <div className="cj-desc-dropdown" style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:300 }}>
                      {CASH_IN_REASONS.map(r => (
                        <button key={r.key} className={`cj-desc-dropdown-item${cashInReasonKey === r.key ? ' selected' : ''}`}
                          onMouseDown={() => { setCashInReasonKey(r.key); setShowCashInReasonDrop(false); }}>
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
              </>
            )}

            {/* ── Cash Out fields ── */}
            {newType === TYPE_OUT && (
              <>
                {/* Paid To */}
                <div className="cj-modal-field" style={{ position:'relative' }}>
                  <label>Paid To</label>
                  {isOthersMode ? (
                    <>
                      <input
                        className="cj-modal-input"
                        value={personSearch}
                        onChange={e => { setPersonSearch(e.target.value); setShowSearchDrop(true); }}
                        onFocus={() => setShowSearchDrop(true)}
                        onBlur={() => setTimeout(() => setShowSearchDrop(false), 200)}
                        placeholder="Search from Suppliers list…"
                        autoFocus
                      />
                      {showSearchDrop && filteredOthersList.length > 0 && (
                        <div className="cj-desc-dropdown" style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:300 }}>
                          {filteredOthersList.map(s => {
                            const n = s.name || s.customerName;
                            return (
                              <button key={s.id} className="cj-desc-dropdown-item"
                                onMouseDown={() => { setPersonSearch(n); setShowSearchDrop(false); }}>
                                {n}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <button style={{ marginTop:'4px', fontSize:'11px', color:'#667eea', background:'none', border:'none', cursor:'pointer', padding:0 }}
                        onClick={() => { setIsOthersMode(false); setPersonName(''); setPersonSearch(''); }}>
                        ← Back to list
                      </button>
                    </>
                  ) : (
                    <button
                      className={`cj-desc-trigger${personName ? ' has-value' : ''}`}
                      onClick={() => setShowNameDrop(o => !o)}
                    >
                      <span className="cj-desc-trigger-text">{personName || 'Select name…'}</span>
                      <span className="cj-desc-chevron">{showNameDrop ? '▲' : '▼'}</span>
                    </button>
                  )}
                  {showNameDrop && !isOthersMode && (
                    <div className="cj-desc-dropdown" style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:300 }}>
                      {PAID_TO_NAMES.map(n => (
                        <button key={n} className="cj-desc-dropdown-item" onMouseDown={() => handleNameSelect(n)}>{n}</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Being For */}
                <div className="cj-modal-field" style={{ position:'relative' }}>
                  <label>Being For</label>
                  {beingForKey === '__supplier_purchase__' && expensesResult ? (
                    /* Supplier purchase already saved — show summary */
                    <div style={{padding:'8px 12px',background:expensesResult.paymentType==='cash'?'#f0fdf4':'#eff6ff',
                      border:`1.5px solid ${expensesResult.paymentType==='cash'?'#16a34a':'#3b82f6'}`,
                      borderRadius:'8px',fontSize:'13px',color:expensesResult.paymentType==='cash'?'#166534':'#1e40af'}}>
                      <div style={{fontWeight:600,marginBottom:'2px'}}>
                        {expensesResult.paymentType === 'cash' ? '✓ Cash Purchase' : '✓ Credit Purchase'} — Ref: {expensesResult.invoiceRef}
                      </div>
                      <div style={{fontSize:'12px',opacity:0.85}}>{expensesResult.itemsSummary}</div>
                    </div>
                  ) : (
                    <button
                      className={`cj-desc-trigger${beingForKey ? ' has-value' : ''}`}
                      onClick={handleBeingForClick}
                    >
                      <span className="cj-desc-trigger-text">
                        {(() => {
                          const name = getResolvedName();
                          if (name && isKnownSupplier(name, suppliersList)) return 'Tap to add purchase…';
                          if (beingForKey === 'other' && otherReasonText) return otherReasonText;
                          if (beingForKey) return PAID_TO_REASONS.find(r => r.key === beingForKey)?.label;
                          return 'Select reason…';
                        })()}
                      </span>
                      <span className="cj-desc-chevron">{showBeingForDrop ? '▲' : '▼'}</span>
                    </button>
                  )}
                  {showBeingForDrop && (
                    <div className="cj-desc-dropdown" style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:300 }}>
                      {PAID_TO_REASONS.map(r => (
                        <button key={r.key} className={`cj-desc-dropdown-item${beingForKey === r.key ? ' selected' : ''}`}
                          onMouseDown={() => handleBeingForSelect(r.key)}>
                          {r.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Other reason text input (shown inline when "Other reason" is selected) */}
                {showOtherReasonInput && (
                  <div className="cj-modal-field">
                    <label>Reason for payment</label>
                    <input className="cj-modal-input" value={otherReasonText}
                      onChange={e => setOtherReasonText(e.target.value)}
                      placeholder="Describe the reason…" autoFocus />
                  </div>
                )}

                {/* Ref Number */}
                <div className="cj-modal-field">
                  <label>Reference Number <span style={{ fontWeight:400, color:'#9ca3af' }}>(optional)</span></label>
                  <input className="cj-modal-input" value={refNumber} onChange={e => setRefNumber(e.target.value)}
                    placeholder="Invoice / receipt ref…" />
                </div>
              </>
            )}

            <div className="cj-modal-buttons">
              <button className="cj-modal-cancel" onClick={closeAddModal}>Cancel</button>
              <button className="cj-modal-save" onClick={handleSaveEntry}
                disabled={isProcessing || !canSave()}>
                {isProcessing ? 'Saving…' : 'Save'}
              </button>
            </div>
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

      {/* ── Operational Expenses Modal (supplier purchase from Cash Out) ── */}
      {showExpensesModal && (() => {
        const name = getResolvedName();
        const sup = getSupplierRecord(name, suppliersList);
        return (
          <OperationalExpensesModal
            supplierName={name}
            supplierId={sup?.id || null}
            onSave={handleExpensesSaved}
            onClose={() => setShowExpensesModal(false)}
          />
        );
      })()}
    </div>
  );
}

export default CashRecord;
