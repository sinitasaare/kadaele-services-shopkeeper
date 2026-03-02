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

// ── Add Operational Assets Modal ─────────────────────────────────────────────
// Opens when user clicks BEING FOR and the PAID TO name is a known supplier.
// Mirrors the Admin app's AssetFormModal exactly, but supports multiple items
// per submission and pre-populates supplierName from the selected PAID TO name.
// Each item saved is written individually to the operational_assets collection.
function AddOperationalAssetsModal({ initialSupplierName, initialSupplierId, suppliersList, onSave, onClose }) {
  const { fmt } = useCurrency();

  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  // Supplier search state (the supplier name field has a live dropdown)
  const [supplierSearch, setSupplierSearch]   = useState(initialSupplierName || '');
  const [showSupplierDrop, setShowSupplierDrop] = useState(false);
  const [resolvedSupplierId, setResolvedSupplierId] = useState(initialSupplierId || null);

  // Shared fields across all items in this submission
  const [paymentType, setPaymentType] = useState('cash');
  const [invoiceRef, setInvoiceRef]   = useState('');
  const [date, setDate]               = useState(todayStr());
  const [saving, setSaving]           = useState(false);

  // Each item row: { id, name, qty, costPrice }
  const nextId = useRef(2);
  const [items, setItems] = useState([{ id: 1, name: '', qty: '', costPrice: '' }]);

  const [cashBalance, setCashBalance] = useState(null);

  useEffect(() => {
    dataService.getCashEntries().then(entries => {
      const bal = (entries || []).reduce((sum, e) =>
        sum + (e.type === 'in' ? (e.amount || 0) : -(e.amount || 0)), 0);
      setCashBalance(bal);
    });
  }, []);

  const filteredSuppliers = (() => {
    const q = supplierSearch.toLowerCase();
    return suppliersList.filter(s =>
      (s.name || s.customerName || '').toLowerCase().includes(q)
    );
  })();

  const updateItem = (id, field, val) =>
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: val } : it));

  const addItem = () => {
    setItems(prev => [...prev, { id: nextId.current++, name: '', qty: '', costPrice: '' }]);
  };

  const removeItem = (id) => setItems(prev => prev.filter(it => it.id !== id));

  const grandTotal = items.reduce((sum, it) =>
    sum + (parseFloat(it.qty) || 0) * (parseFloat(it.costPrice) || 0), 0);

  const lastItemComplete = () => {
    const last = items[items.length - 1];
    return last && last.name.trim() && parseFloat(last.qty) > 0 && parseFloat(last.costPrice) >= 0;
  };

  const handleSave = async () => {
    const supplierName = supplierSearch.trim();
    if (!supplierName) { alert('Please enter or select a supplier name.'); return; }
    if (!invoiceRef.trim()) { alert('Please enter a Ref / invoice number.'); return; }
    if (!date) { alert('Please select a date.'); return; }

    const validItems = items.filter(it => it.name.trim() && parseFloat(it.qty) > 0);
    if (validItems.length === 0) { alert('Please add at least one item with a name and quantity.'); return; }

    for (const it of validItems) {
      if (!it.name.trim()) { alert('All items must have a name.'); return; }
      if (!(parseFloat(it.qty) > 0)) { alert('All items must have a quantity greater than 0.'); return; }
      if (parseFloat(it.costPrice) < 0) { alert('Cost price cannot be negative.'); return; }
    }

    if (paymentType === 'cash' && cashBalance !== null && grandTotal > cashBalance) {
      alert(`Total (${fmt(grandTotal)}) exceeds your current Cash Balance (${fmt(cashBalance)}). Reduce amount or switch to Credit.`);
      return;
    }

    setSaving(true);
    try {
      const dateISO = new Date(date + 'T12:00:00').toISOString();
      const savedItems = [];

      for (const it of validItems) {
        const qty       = parseFloat(it.qty) || 0;
        const costPrice = parseFloat(it.costPrice) || 0;
        const subtotal  = qty * costPrice;

        await dataService.addOperationalAsset({
          name: it.name.trim(),
          qty,
          costPrice,
          subtotal,
          supplierName,
          supplierId: resolvedSupplierId || null,
          invoiceRef: invoiceRef.trim(),
          paymentType,
          date: dateISO,
          source: 'purchase',
        });

        savedItems.push({ name: it.name.trim(), qty, costPrice, subtotal });
      }

      onSave({
        supplierName,
        supplierId: resolvedSupplierId || null,
        paymentType,
        total: grandTotal,
        invoiceRef: invoiceRef.trim(),
        itemsSummary: savedItems.map(i => i.name).join(', '),
        items: savedItems,
      });
    } catch (e) {
      console.error(e);
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        background: 'var(--surface, white)', color: 'var(--text-primary, #111)',
        borderRadius: '14px', width: '100%', maxWidth: '480px',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 12px 48px rgba(0,0,0,0.3)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px', borderBottom: '1px solid var(--border, #e5e7eb)',
          flexShrink: 0,
        }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>🔧 Add Operational Assets</h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary, #6b7280)', padding: '4px', borderRadius: '4px',
            display: 'flex', alignItems: 'center',
          }}><X size={20}/></button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Supplier Name with dropdown */}
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px', color: 'var(--text-primary, #374151)' }}>
              Supplier Name *
            </label>
            <input
              style={{
                width: '100%', padding: '10px 12px', border: '2px solid var(--border, #e5e7eb)',
                borderRadius: '8px', fontSize: '14px', background: 'var(--surface, white)',
                color: 'var(--text-primary, #111)', boxSizing: 'border-box',
              }}
              value={supplierSearch}
              placeholder="Search or type supplier name…"
              onChange={e => {
                setSupplierSearch(e.target.value);
                setShowSupplierDrop(true);
                setResolvedSupplierId(null);
              }}
              onFocus={() => setShowSupplierDrop(true)}
              onBlur={() => setTimeout(() => setShowSupplierDrop(false), 180)}
            />
            {showSupplierDrop && filteredSuppliers.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 500,
                background: 'var(--surface, white)', border: '1px solid var(--border, #e5e7eb)',
                borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                maxHeight: '160px', overflowY: 'auto',
              }}>
                {filteredSuppliers.map(s => {
                  const n = s.name || s.customerName || '';
                  return (
                    <button key={s.id}
                      onMouseDown={() => {
                        setSupplierSearch(n);
                        setResolvedSupplierId(s.id);
                        setShowSupplierDrop(false);
                      }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '10px 14px', background: 'none', border: 'none',
                        cursor: 'pointer', fontSize: '14px', color: 'var(--text-primary, #111)',
                      }}
                    >{n}</button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payment Type */}
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px', color: 'var(--text-primary, #374151)' }}>
              Payment Type
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[['cash', '💵 Cash'], ['credit', '📋 Credit']].map(([pt, lbl]) => (
                <button key={pt} type="button"
                  onClick={() => setPaymentType(pt)}
                  style={{
                    flex: 1, padding: '9px', borderRadius: '8px', border: '2px solid',
                    borderColor: paymentType === pt ? (pt === 'cash' ? '#16a34a' : '#4f46e5') : 'var(--border, #d1d5db)',
                    background: paymentType === pt ? (pt === 'cash' ? '#f0fdf4' : '#eef2ff') : 'var(--surface, white)',
                    fontWeight: paymentType === pt ? 700 : 400,
                    cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary, #111)',
                  }}>{lbl}</button>
              ))}
            </div>
            <p style={{ fontSize: '11px', marginTop: '4px', color: paymentType === 'credit' ? '#4f46e5' : '#6b7280' }}>
              {paymentType === 'cash'
                ? 'Cash paid now — a Cash OUT entry will be recorded.'
                : 'Items received, pay later — no immediate cash deducted.'}
            </p>
          </div>

          {/* Invoice / Ref */}
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px', color: 'var(--text-primary, #374151)' }}>
              Invoice / Ref *
            </label>
            <input
              style={{
                width: '100%', padding: '10px 12px', border: '2px solid var(--border, #e5e7eb)',
                borderRadius: '8px', fontSize: '14px', background: 'var(--surface, white)',
                color: 'var(--text-primary, #111)', boxSizing: 'border-box',
              }}
              value={invoiceRef}
              placeholder="Receipt or invoice number…"
              onChange={e => setInvoiceRef(e.target.value)}
            />
          </div>

          {/* Date */}
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px', color: 'var(--text-primary, #374151)' }}>
              Date *
            </label>
            <input
              type="date"
              style={{
                width: '100%', padding: '10px 12px', border: '2px solid var(--border, #e5e7eb)',
                borderRadius: '8px', fontSize: '14px', background: 'var(--surface, white)',
                color: 'var(--text-primary, #111)', boxSizing: 'border-box',
              }}
              value={date}
              max={todayStr()}
              onChange={e => setDate(e.target.value)}
            />
          </div>

          {/* Items */}
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '8px', color: 'var(--text-primary, #374151)' }}>
              Items *
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {items.map((it, idx) => {
                const subtotal = (parseFloat(it.qty) || 0) * (parseFloat(it.costPrice) || 0);
                return (
                  <div key={it.id} style={{
                    border: '1.5px solid var(--border, #e5e7eb)', borderRadius: '10px',
                    padding: '12px', background: 'var(--background, #f9fafb)',
                    display: 'flex', flexDirection: 'column', gap: '10px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#667eea' }}>Item {idx + 1}</span>
                      {items.length > 1 && (
                        <button onClick={() => removeItem(it.id)} style={{
                          background: '#fee2e2', border: 'none', borderRadius: '6px',
                          padding: '4px 8px', cursor: 'pointer', color: '#dc2626',
                          display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px',
                        }}>
                          <Trash2 size={12}/> Remove
                        </button>
                      )}
                    </div>

                    {/* Asset Name */}
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #6b7280)', marginBottom: '4px' }}>
                        Asset Name *
                      </label>
                      <input
                        style={{
                          width: '100%', padding: '8px 10px', border: '1.5px solid var(--border, #e5e7eb)',
                          borderRadius: '7px', fontSize: '13px', background: 'var(--surface, white)',
                          color: 'var(--text-primary, #111)', boxSizing: 'border-box',
                        }}
                        value={it.name}
                        placeholder="e.g. Generator, Office Chair…"
                        onChange={e => updateItem(it.id, 'name', e.target.value)}
                      />
                    </div>

                    {/* Qty + Cost side by side */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #6b7280)', marginBottom: '4px' }}>
                          Quantity *
                        </label>
                        <input type="number" min="0" step="1"
                          style={{
                            width: '100%', padding: '8px 10px', border: '1.5px solid var(--border, #e5e7eb)',
                            borderRadius: '7px', fontSize: '13px', background: 'var(--surface, white)',
                            color: 'var(--text-primary, #111)', boxSizing: 'border-box',
                          }}
                          value={it.qty}
                          placeholder="0"
                          onChange={e => updateItem(it.id, 'qty', e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #6b7280)', marginBottom: '4px' }}>
                          Unit Cost
                        </label>
                        <input type="number" min="0" step="0.01"
                          style={{
                            width: '100%', padding: '8px 10px', border: '1.5px solid var(--border, #e5e7eb)',
                            borderRadius: '7px', fontSize: '13px', background: 'var(--surface, white)',
                            color: 'var(--text-primary, #111)', boxSizing: 'border-box',
                          }}
                          value={it.costPrice}
                          placeholder="0.00"
                          onChange={e => updateItem(it.id, 'costPrice', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Subtotal preview */}
                    {(parseFloat(it.qty) > 0 || parseFloat(it.costPrice) > 0) && (
                      <div style={{
                        padding: '6px 10px', background: '#f0f4ff',
                        border: '1px solid #c7d2fe', borderRadius: '7px',
                        fontSize: '12px', color: '#4338ca', fontWeight: 600,
                      }}>
                        Subtotal: {fmt(subtotal)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add another item button */}
            <button
              onClick={addItem}
              disabled={!lastItemComplete()}
              style={{
                marginTop: '10px', width: '100%', padding: '10px',
                border: '1.5px dashed var(--border, #d1d5db)', borderRadius: '8px',
                background: lastItemComplete() ? 'var(--surface, white)' : 'var(--background, #f9fafb)',
                color: lastItemComplete() ? '#667eea' : '#9ca3af',
                cursor: lastItemComplete() ? 'pointer' : 'not-allowed',
                fontSize: '13px', fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
            >
              <Plus size={14}/> Add Another Item
            </button>
          </div>

          {/* Grand total */}
          {grandTotal > 0 && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 14px', background: '#f0f4ff',
              border: '1.5px solid #c7d2fe', borderRadius: '10px',
            }}>
              <span style={{ fontWeight: 700, fontSize: '14px', color: '#4338ca' }}>Grand Total</span>
              <span style={{ fontWeight: 800, fontSize: '15px', color: '#3730a3' }}>{fmt(grandTotal)}</span>
            </div>
          )}

          {/* Cash balance warning */}
          {paymentType === 'cash' && cashBalance !== null && grandTotal > cashBalance && grandTotal > 0 && (
            <div style={{
              background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px',
              padding: '10px 12px', fontSize: '12px', color: '#b91c1c',
            }}>
              ⚠️ Total ({fmt(grandTotal)}) exceeds Cash Balance ({fmt(cashBalance)}).
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: '10px', padding: '16px 20px',
          borderTop: '1px solid var(--border, #e5e7eb)', flexShrink: 0,
        }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '12px', borderRadius: '8px',
            border: '1.5px solid var(--border, #e5e7eb)',
            background: 'var(--surface, white)', color: 'var(--text-primary, #111)',
            cursor: 'pointer', fontWeight: 600, fontSize: '14px',
          }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{
            flex: 1, padding: '12px', borderRadius: '8px', border: 'none',
            background: saving ? '#9ca3af' : '#f59e0b', color: 'white',
            cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '14px',
          }}>
            {saving ? 'Saving…' : 'Save Assets'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create New Customer Advanced Order Modal ──────────────────────────────────
function CreateNewCustomerAdvanceOrderModal({ onSave, onClose }) {
  const { fmt } = useCurrency();

  // Tabs
  const [activeTab, setActiveTab] = useState('details');

  // Customer Details tab
  const [fullName, setFullName]   = useState('');
  const [gender, setGender]       = useState('');
  const [phone, setPhone]         = useState('');
  const [whatsapp, setWhatsapp]   = useState('');
  const [email, setEmail]         = useState('');
  const [address, setAddress]     = useState('');

  // Advance Order tab
  const [invoiceRef, setInvoiceRef] = useState('');
  const [date, setDate]             = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  // Rows: { id, qty, productName, productSearch, showDrop, dropTop, dropLeft, dropWidth, sellingPrice }
  const nextId = useRef(2);
  const [rows, setRows] = useState([{
    id: 1, qty: '', productName: '', productSearch: '', showDrop: false,
    dropTop: 0, dropLeft: 0, dropWidth: 180, sellingPrice: '',
  }]);
  const [goods, setGoods] = useState([]);
  const [saving, setSaving] = useState(false);
  const [detailsError, setDetailsError] = useState('');

  useEffect(() => {
    dataService.getGoods().then(d => setGoods(d || []));
    const unsub = dataService.onGoodsChange?.(g => setGoods(g || []));
    return () => unsub?.();
  }, []);

  const updateRow = (id, field, val) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));

  const addRow = () => setRows(prev => [...prev, {
    id: nextId.current++, qty: '', productName: '', productSearch: '',
    showDrop: false, dropTop: 0, dropLeft: 0, dropWidth: 180, sellingPrice: '',
  }]);

  const removeRow = id => setRows(prev => prev.filter(r => r.id !== id));

  const descResults = (search) => {
    if (!search.trim()) return [];
    const t = search.toLowerCase();
    const tier1 = [], tier2 = [], tier3 = [];
    for (const g of goods) {
      const name = (g.name || '').toLowerCase();
      const words = name.split(/\s+/);
      if (words[0]?.startsWith(t)) tier1.push(g);
      else if (words[1]?.startsWith(t)) tier2.push(g);
      else if (name.includes(t)) tier3.push(g);
    }
    return [...tier1, ...tier2, ...tier3].slice(0, 8);
  };

  const grandTotal = rows.reduce((sum, r) =>
    sum + (parseFloat(r.qty) || 0) * (parseFloat(r.sellingPrice) || 0), 0);

  const lastRowComplete = () => {
    const last = rows[rows.length - 1];
    return last && last.productName.trim() && parseFloat(last.qty) > 0;
  };

  const validateDetails = () => {
    if (!fullName.trim()) return 'Full Name is required.';
    if (!gender) return 'Gender is required.';
    if (!phone.trim()) return 'Phone number is required.';
    if (!whatsapp.trim() && !email.trim()) return 'At least WhatsApp or Email is required.';
    if (email.trim() && !email.includes('@')) return 'Email must contain "@".';
    if (!address.trim()) return 'Address is required.';
    return '';
  };

  const handleNextToOrder = () => {
    const err = validateDetails();
    if (err) { setDetailsError(err); return; }
    setDetailsError('');
    setActiveTab('order');
  };

  const handleSave = async () => {
    const err = validateDetails();
    if (err) { setActiveTab('details'); setDetailsError(err); return; }
    if (!invoiceRef.trim()) { alert('Please enter an Invoice / Ref number.'); return; }
    if (!date) { alert('Please select a date.'); return; }
    const validRows = rows.filter(r => r.productName.trim() && parseFloat(r.qty) > 0);
    if (validRows.length === 0) { alert('Please add at least one product with a quantity.'); return; }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const orderItems = validRows.map(r => ({
        name: r.productName.trim(),
        qty: parseFloat(r.qty) || 0,
        sellingPrice: parseFloat(r.sellingPrice) || 0,
        subtotal: (parseFloat(r.qty) || 0) * (parseFloat(r.sellingPrice) || 0),
      }));

      const newOrder = await dataService.addAdvanceOrder({
        name: fullName.trim(),
        customerName: fullName.trim(),
        gender,
        phone: phone.trim(),
        whatsapp: whatsapp.trim(),
        email: email.trim(),
        address: address.trim(),
        invoiceRef: invoiceRef.trim(),
        orderDate: date,
        items: orderItems,
        totalDue: grandTotal,
        balance: grandTotal,
        totalPaid: 0,
        deposits: [],
        saleIds: [],
        purchaseIds: [],
        updatedAt: now,
      });

      onSave(newOrder);
    } catch (e) {
      console.error(e);
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = {
    width: '100%', padding: '10px 12px',
    border: '2px solid var(--border, #e5e7eb)', borderRadius: '8px',
    fontSize: '14px', background: 'var(--surface, white)',
    color: 'var(--text-primary, #111)', boxSizing: 'border-box',
  };
  const labelStyle = {
    display: 'block', fontWeight: 600, fontSize: '13px',
    marginBottom: '6px', color: 'var(--text-primary, #374151)',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        background: 'var(--surface, white)', color: 'var(--text-primary, #111)',
        borderRadius: '14px', width: '100%', maxWidth: '480px',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 12px 48px rgba(0,0,0,0.3)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px', borderBottom: '1px solid var(--border, #e5e7eb)', flexShrink: 0,
        }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>🛒 New Customer Advance Order</h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary, #6b7280)', padding: '4px', borderRadius: '4px',
            display: 'flex', alignItems: 'center',
          }}><X size={20}/></button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--border, #e5e7eb)', flexShrink: 0,
        }}>
          {[['details', '👤 Customer Details'], ['order', '📋 Advance Order']].map(([key, lbl]) => (
            <button key={key}
              onClick={() => {
                if (key === 'order') handleNextToOrder();
                else setActiveTab(key);
              }}
              style={{
                flex: 1, padding: '12px', background: 'none', border: 'none',
                borderBottom: activeTab === key ? '3px solid #667eea' : '3px solid transparent',
                fontWeight: activeTab === key ? 700 : 500, fontSize: '13px',
                color: activeTab === key ? '#667eea' : 'var(--text-secondary, #6b7280)',
                cursor: 'pointer',
              }}>{lbl}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* ── Customer Details Tab ── */}
          {activeTab === 'details' && (
            <>
              {detailsError && (
                <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#b91c1c' }}>
                  {detailsError}
                </div>
              )}
              <div>
                <label style={labelStyle}>Full Name *</label>
                <input style={fieldStyle} value={fullName} placeholder="Enter full name"
                  onChange={e => setFullName(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Gender *</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {['Male', 'Female'].map(g => (
                    <label key={g} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
                      <input type="radio" name="cao-gender" checked={gender === g} onChange={() => setGender(g)} />
                      {g}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Phone *</label>
                <input style={fieldStyle} type="tel" value={phone} placeholder="Phone number"
                  onChange={e => setPhone(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>WhatsApp <span style={{ fontWeight: 400, color: '#9ca3af' }}>(at least WhatsApp or Email required)</span></label>
                <input style={fieldStyle} type="tel" value={whatsapp} placeholder="WhatsApp number"
                  onChange={e => setWhatsapp(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input style={fieldStyle} type="email" value={email} placeholder="Email address"
                  onChange={e => setEmail(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Address *</label>
                <textarea style={{ ...fieldStyle, resize: 'none' }} rows={2} value={address} placeholder="Enter address"
                  onChange={e => setAddress(e.target.value)} />
              </div>
            </>
          )}

          {/* ── Advance Order Tab ── */}
          {activeTab === 'order' && (
            <>
              {/* Name of Customer (read-only display) */}
              <div>
                <label style={labelStyle}>Name of Customer</label>
                <div style={{ ...fieldStyle, background: 'var(--background, #f9fafb)', color: '#6b7280', border: '2px solid var(--border, #e5e7eb)' }}>
                  {fullName || <em style={{ color: '#9ca3af' }}>Fill in Customer Details first</em>}
                </div>
              </div>

              {/* Invoice / Ref */}
              <div>
                <label style={labelStyle}>Invoice / Ref *</label>
                <input style={fieldStyle} value={invoiceRef} placeholder="Receipt or order reference number…"
                  onChange={e => setInvoiceRef(e.target.value)} />
              </div>

              {/* Date */}
              <div>
                <label style={labelStyle}>Date *</label>
                <input type="date" style={fieldStyle} value={date} max={todayStr()}
                  onChange={e => setDate(e.target.value)} />
              </div>

              {/* Product rows table */}
              <div>
                <label style={labelStyle}>Products Ordered *</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {rows.map((row, idx) => {
                    const results = descResults(row.productSearch);
                    const subtotal = (parseFloat(row.qty) || 0) * (parseFloat(row.sellingPrice) || 0);
                    return (
                      <div key={row.id} style={{
                        border: '1.5px solid var(--border, #e5e7eb)', borderRadius: '10px',
                        padding: '12px', background: 'var(--background, #f9fafb)',
                        display: 'flex', flexDirection: 'column', gap: '10px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#667eea' }}>Item {idx + 1}</span>
                          {rows.length > 1 && (
                            <button onClick={() => removeRow(row.id)} style={{
                              background: '#fee2e2', border: 'none', borderRadius: '6px',
                              padding: '4px 8px', cursor: 'pointer', color: '#dc2626',
                              display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px',
                            }}>
                              <Trash2 size={12}/> Remove
                            </button>
                          )}
                        </div>

                        {/* Product Name — inventory search */}
                        <div style={{ position: 'relative' }}>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #6b7280)', marginBottom: '4px' }}>
                            Product Name *
                          </label>
                          <input
                            style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--border, #e5e7eb)', borderRadius: '7px', fontSize: '13px', background: 'var(--surface, white)', color: 'var(--text-primary, #111)', boxSizing: 'border-box' }}
                            value={row.productSearch !== undefined ? row.productSearch : row.productName}
                            placeholder="Search inventory…"
                            onChange={e => {
                              updateRow(row.id, 'productSearch', e.target.value);
                              updateRow(row.id, 'showDrop', true);
                            }}
                            onFocus={e => {
                              const input = e.target;
                              updateRow(row.id, 'showDrop', true);
                              const reposition = () => {
                                const rect = input.getBoundingClientRect();
                                updateRow(row.id, 'dropTop', rect.bottom + 2);
                                updateRow(row.id, 'dropLeft', rect.left);
                                updateRow(row.id, 'dropWidth', rect.width);
                              };
                              setTimeout(reposition, 100);
                              input._scrollHandler = reposition;
                              window.addEventListener('scroll', reposition, true);
                            }}
                            onBlur={e => {
                              const input = e.target;
                              if (input._scrollHandler) {
                                window.removeEventListener('scroll', input._scrollHandler, true);
                                input._scrollHandler = null;
                              }
                              setTimeout(() => {
                                setRows(prev => prev.map(r => r.id === row.id
                                  ? { ...r, showDrop: false, productSearch: r.productName || r.productSearch }
                                  : r));
                              }, 180);
                            }}
                          />
                          {row.showDrop && results.length > 0 && (
                            <div style={{
                              position: 'fixed', top: row.dropTop, left: row.dropLeft,
                              width: row.dropWidth, zIndex: 6000,
                              background: 'var(--surface, white)', border: '1px solid var(--border, #e5e7eb)',
                              borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                              maxHeight: '160px', overflowY: 'auto',
                            }}>
                              {results.map(g => (
                                <div key={g.id}
                                  onMouseDown={() => {
                                    const nameWithSize = g.size ? `${g.name} (${g.size})` : (g.name || '');
                                    updateRow(row.id, 'productName', nameWithSize);
                                    updateRow(row.id, 'productSearch', nameWithSize);
                                    updateRow(row.id, 'sellingPrice', String(g.price || g.sellingPrice || ''));
                                    updateRow(row.id, 'showDrop', false);
                                  }}
                                  style={{
                                    padding: '9px 14px', cursor: 'pointer', fontSize: '13px',
                                    color: 'var(--text-primary, #111)',
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'var(--background, #f9fafb)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                  {g.name}
                                  {g.size ? <span style={{ color: '#6b7280', fontSize: '0.85em', marginLeft: 4 }}>{g.size}</span> : null}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Qty + Selling Price */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #6b7280)', marginBottom: '4px' }}>Quantity *</label>
                            <input type="number" min="0" step="1"
                              style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--border, #e5e7eb)', borderRadius: '7px', fontSize: '13px', background: 'var(--surface, white)', color: 'var(--text-primary, #111)', boxSizing: 'border-box' }}
                              value={row.qty} placeholder="0"
                              onChange={e => updateRow(row.id, 'qty', e.target.value)} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #6b7280)', marginBottom: '4px' }}>Selling Price</label>
                            <input type="number" min="0" step="0.01"
                              style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--border, #e5e7eb)', borderRadius: '7px', fontSize: '13px', background: 'var(--surface, white)', color: 'var(--text-primary, #111)', boxSizing: 'border-box' }}
                              value={row.sellingPrice} placeholder="0.00"
                              onChange={e => updateRow(row.id, 'sellingPrice', e.target.value)} />
                          </div>
                        </div>

                        {/* Subtotal preview */}
                        {subtotal > 0 && (
                          <div style={{
                            padding: '6px 10px', background: '#f0f4ff',
                            border: '1px solid #c7d2fe', borderRadius: '7px',
                            fontSize: '12px', color: '#4338ca', fontWeight: 600,
                          }}>
                            Subtotal: {fmt(subtotal)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add another row */}
                <button
                  onClick={addRow}
                  disabled={!lastRowComplete()}
                  style={{
                    marginTop: '10px', width: '100%', padding: '10px',
                    border: '1.5px dashed var(--border, #d1d5db)', borderRadius: '8px',
                    background: lastRowComplete() ? 'var(--surface, white)' : 'var(--background, #f9fafb)',
                    color: lastRowComplete() ? '#667eea' : '#9ca3af',
                    cursor: lastRowComplete() ? 'pointer' : 'not-allowed',
                    fontSize: '13px', fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  }}
                >
                  <Plus size={14}/> Add Another Product
                </button>
              </div>

              {/* Grand total */}
              {grandTotal > 0 && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: '#f0f4ff',
                  border: '1.5px solid #c7d2fe', borderRadius: '10px',
                }}>
                  <span style={{ fontWeight: 700, fontSize: '14px', color: '#4338ca' }}>Order Total</span>
                  <span style={{ fontWeight: 800, fontSize: '15px', color: '#3730a3' }}>{fmt(grandTotal)}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: '10px', padding: '16px 20px',
          borderTop: '1px solid var(--border, #e5e7eb)', flexShrink: 0,
        }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '12px', borderRadius: '8px',
            border: '1.5px solid var(--border, #e5e7eb)',
            background: 'var(--surface, white)', color: 'var(--text-primary, #111)',
            cursor: 'pointer', fontWeight: 600, fontSize: '14px',
          }}>Cancel</button>
          {activeTab === 'details' ? (
            <button onClick={handleNextToOrder} style={{
              flex: 1, padding: '12px', borderRadius: '8px', border: 'none',
              background: '#667eea', color: 'white',
              cursor: 'pointer', fontWeight: 700, fontSize: '14px',
            }}>Next: Advance Order →</button>
          ) : (
            <button onClick={handleSave} disabled={saving} style={{
              flex: 1, padding: '12px', borderRadius: '8px', border: 'none',
              background: saving ? '#9ca3af' : '#f59e0b', color: 'white',
              cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '14px',
            }}>
              {saving ? 'Saving…' : 'Save Advance Order'}
            </button>
          )}
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
  const [usersList, setUsersList]              = useState([]);
  const [landlordInfo, setLandlordInfo]        = useState(null); // { name, monthlyRent }
  const [refNumber, setRefNumber]              = useState('');
  // Others-mode sub-dropdown (Advance Orders List vs Create New)
  const [showOthersSubDrop, setShowOthersSubDrop] = useState(false);
  const [advanceOrdersList, setAdvanceOrdersList]  = useState([]);
  const [showCreateAdvanceModal, setShowCreateAdvanceModal] = useState(false);
  const [selectedAdvanceOrder, setSelectedAdvanceOrder] = useState(null); // stores matched order {name, invoiceRef}
  const [advanceOrderCardData, setAdvanceOrderCardData] = useState(null); // full advance order record to show in card
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

  // ── Any dropdown currently open? ──────────────────────────────────────────
  const anyDropOpen = showNameDrop || showSearchDrop || showOthersSubDrop || showCashInReasonDrop || showBeingForDrop;

  // ── Close all dropdowns when clicking outside any dropdown field ──────────
  const closeAllDropdowns = () => {
    setShowNameDrop(false);
    setShowSearchDrop(false);
    setShowOthersSubDrop(false);
    setShowCashInReasonDrop(false);
    setShowBeingForDrop(false);
  };

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
    setShowOthersSubDrop(false); setShowCreateAdvanceModal(false);
    setSelectedAdvanceOrder(null);
  };
  const openAddModal = async () => {
    resetAddModal();
    setShowAddModal(true);
    // Pre-load creditors, suppliers, advance orders, users, and landlord for dropdowns
    const [creds, supps, advOrders, users, landlord] = await Promise.all([
      dataService.getCreditors(),
      dataService.getSuppliers(),
      dataService.getAdvanceOrders(),
      dataService.getUsers(),
      dataService.getLandlord(),
    ]);
    setCreditorsList(creds || []);
    setSuppliersList(supps || []);
    setAdvanceOrdersList(advOrders || []);
    setUsersList((users || []).filter(u => u.id !== '__landlord__'));
    setLandlordInfo(landlord || null);
  };
  const closeAddModal = () => { setShowAddModal(false); resetAddModal(); };

  const handleNameSelect = (name) => {
    setShowNameDrop(false);
    // Reset being-for and expenses when name changes
    setBeingForKey(''); setExpensesResult(null);
    setOtherReasonText(''); setShowOtherReasonInput(false);
    setSelectedAdvanceOrder(null);
    setAdvanceOrderCardData(null);
    if (name === 'Others') {
      setIsOthersMode(true);
      setPersonName('');
      setPersonSearch('');
    } else {
      setIsOthersMode(false);
      setPersonName(name);
      setPersonSearch('');
      // Auto-set Being For if this name matches an advance order
      if (newType === TYPE_IN && advanceOrdersList.length > 0) {
        const match = advanceOrdersList.find(o =>
          (o.name || o.customerName || '').toLowerCase() === name.toLowerCase()
        );
        if (match) {
          setSelectedAdvanceOrder({ name: match.name || match.customerName, invoiceRef: match.invoiceRef || match.id });
          setCashInReasonKey('__advance_order__');
          // Show the customer's advance order card
          setAdvanceOrderCardData(match);
        }
      }
    }
  };

  const getResolvedName = () => {
    // For Cash Out, personSearch holds the typed/selected supplier name
    // For Cash In Others mode, personSearch holds the typed creditor name
    if (isOthersMode) return personSearch.trim() || personName.trim();
    if (personName.trim()) return personName.trim();
    return personSearch.trim();
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

  // Called when AddOperationalAssetsModal saves.
  // The modal only writes operational_assets records directly.
  // For cash purchases we must also create the cash OUT entry here.
  const handleExpensesSaved = async (result) => {
    setExpensesResult(result);
    setShowExpensesModal(false);

    const supplierName = result.supplierName || getResolvedName();
    const note = `Paid ${supplierName} for ref: ${result.invoiceRef}`;

    if (result.paymentType === 'cash') {
      try {
        const now = new Date();
        await dataService.addCashEntry({
          type: TYPE_OUT,
          amount: result.total,
          note,
          date: now.toISOString(),
          source: 'purchase',
          business_date: now.toISOString().slice(0, 10),
          invoiceRef: result.invoiceRef,
        });
      } catch (e) { console.error('Error creating cash entry for asset purchase:', e); }
      setNewAmount(String(result.total));
    } else {
      setNewAmount('0');
    }

    if (result.invoiceRef) setRefNumber(result.invoiceRef);
    setBeingForKey('__supplier_purchase__');
    // Update personName/personSearch so the parent modal reflects the (possibly changed) supplier
    if (!isOthersMode) {
      setPersonName(result.supplierName || getResolvedName());
    } else {
      setPersonSearch(result.supplierName || getResolvedName());
    }
  };

  const buildNote = () => {
    const name = getResolvedName();
    if (newType === TYPE_IN) {
      // Advance order customer
      if (cashInReasonKey === '__advance_order__' && selectedAdvanceOrder) {
        return `Advance Order by ${selectedAdvanceOrder.name} (${selectedAdvanceOrder.invoiceRef || '—'}).`;
      }
      const reasonObj = CASH_IN_REASONS.find(r => r.key === cashInReasonKey);
      const phrase = reasonObj?.phrase || '';
      if (name && phrase) return `From ${name} ${phrase}.`;
      if (name) return `From ${name}.`;
      return '';
    } else {
      // Cash Out with supplier purchase
      if (beingForKey === '__supplier_purchase__' && expensesResult) {
        const supplierName = expensesResult.supplierName || name;
        return `Paid ${supplierName} for ref: ${expensesResult.invoiceRef}`;
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

    // Supplier purchase — assets + cash entry already saved, just need to confirm close
    if (newType === TYPE_OUT && beingForKey === '__supplier_purchase__' && expensesResult) {
      return true;
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

    // ── Supplier purchase (assets + cash entry already saved by handleExpensesSaved) ──
    if (newType === TYPE_OUT && beingForKey === '__supplier_purchase__' && expensesResult) {
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
          {/* Transparent overlay — blocks all interaction when any dropdown is open */}
          {anyDropOpen && (
            <div
              style={{ position:'fixed', inset:0, zIndex:200 }}
              onPointerDown={() => closeAllDropdowns()}
            />
          )}
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

            {/* ── Cash In fields ── */}
            {newType === TYPE_IN && (
              <>
                {/* Cash From */}
                <div className="cj-modal-field" style={{ position:'relative' }} data-dropdown-field>
                  <label>Cash From</label>
                  {isOthersMode ? (
                    <>
                      <input
                        className="cj-modal-input"
                        value={personSearch}
                        onChange={e => { setPersonSearch(e.target.value); setShowSearchDrop(true); setShowOthersSubDrop(false); }}
                        onFocus={() => { setShowOthersSubDrop(true); setShowSearchDrop(false); }}
                        onBlur={() => setTimeout(() => { setShowSearchDrop(false); setShowOthersSubDrop(false); }, 220)}
                        placeholder="Search creditors or create a new creditor…"
                        autoFocus
                      />
                      {/* Sub-dropdown: shown when field is focused and not typing */}
                      {showOthersSubDrop && !personSearch && (
                        <div className="cj-desc-dropdown" style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:400 }}>
                          {/* Option 1: Advance Orders List */}
                          <div
                            className="cj-desc-dropdown-item"
                            style={{ fontWeight: 600, color: '#667eea' }}
                            onMouseDown={e => {
                              e.preventDefault();
                              setShowOthersSubDrop(false);
                              setShowSearchDrop(true);
                            }}
                          >
                            📋 Advance Orders List
                          </div>
                          {/* Option 2: Create New */}
                          <div
                            className="cj-desc-dropdown-item"
                            style={{ fontWeight: 600, color: '#f59e0b' }}
                            onMouseDown={e => {
                              e.preventDefault();
                              setShowOthersSubDrop(false);
                              setShowCreateAdvanceModal(true);
                            }}
                          >
                            ➕ Create New Customer Advanced Order
                          </div>
                        </div>
                      )}
                      {/* Advance orders search dropdown (after typing or selecting Advance Orders List) */}
                      {showSearchDrop && (() => {
                        const q = personSearch.toLowerCase();
                        const matches = q
                          ? advanceOrdersList.filter(o => (o.name || o.customerName || '').toLowerCase().includes(q))
                          : advanceOrdersList;
                        return matches.length > 0 ? (
                          <div className="cj-desc-dropdown" style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:400 }}>
                            {matches.map(o => {
                              const n = o.name || o.customerName || '';
                              return (
                                <button key={o.id} className="cj-desc-dropdown-item"
                                  onMouseDown={() => {
                                    setPersonSearch(n);
                                    setShowSearchDrop(false);
                                    // Auto-set Being For to advance order
                                    setSelectedAdvanceOrder({ name: n, invoiceRef: o.invoiceRef || o.id });
                                    setCashInReasonKey('__advance_order__');
                                  }}>
                                  {n}{o.invoiceRef ? <span style={{ fontSize:'11px', color:'#9ca3af', marginLeft:'6px' }}>({o.invoiceRef})</span> : null}
                                </button>
                              );
                            })}
                            {/* Also show creditors below advance orders if typing */}
                            {q && filteredOthersList.filter(c => !(advanceOrdersList.some(o => (o.name||o.customerName||'').toLowerCase() === (c.name||c.customerName||'').toLowerCase()))).map(c => {
                              const n = c.name || c.customerName;
                              return (
                                <button key={c.id} className="cj-desc-dropdown-item"
                                  onMouseDown={() => { setPersonSearch(n); setShowSearchDrop(false); }}>
                                  {n}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          q && filteredOthersList.length > 0 ? (
                            <div className="cj-desc-dropdown" style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:400 }}>
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
                          ) : null
                        );
                      })()}
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
                      {/* Firebase users */}
                      {usersList.length > 0
                        ? usersList.map(u => {
                            const n = u.fullName || u.username || '';
                            return (
                              <button key={u.id} className="cj-desc-dropdown-item" onMouseDown={() => handleNameSelect(n)}>
                                {n}
                                {u.role ? <span style={{ fontSize:'11px', color:'#9ca3af', marginLeft:'6px' }}>({u.role})</span> : null}
                              </button>
                            );
                          })
                        : <div className="cj-desc-dropdown-item" style={{ color:'#9ca3af', fontStyle:'italic', pointerEvents:'none' }}>No users found…</div>
                      }
                      {/* Landlord */}
                      {landlordInfo && (
                        <button
                          className="cj-desc-dropdown-item"
                          onMouseDown={() => handleNameSelect(landlordInfo.name || landlordInfo.fullName)}
                          style={{ color:'#92400e' }}
                        >
                          🏠 {landlordInfo.name || landlordInfo.fullName}
                          <span style={{ fontSize:'11px', color:'#9ca3af', marginLeft:'6px' }}>(Landlord)</span>
                        </button>
                      )}
                      {/* Advance Orders List */}
                      <div
                        className="cj-desc-dropdown-item"
                        style={{ fontWeight:600, color:'#667eea', borderTop:'1px solid var(--border, #e5e7eb)', marginTop:'2px', paddingTop:'8px' }}
                        onMouseDown={e => {
                          e.preventDefault();
                          setIsOthersMode(true);
                          setPersonName('');
                          setPersonSearch('');
                          setShowNameDrop(false);
                          setTimeout(() => setShowSearchDrop(true), 50);
                        }}
                      >
                        📋 Advance Orders List
                      </div>
                      {/* Create New Advance Order */}
                      <div
                        className="cj-desc-dropdown-item"
                        style={{ fontWeight:600, color:'#f59e0b' }}
                        onMouseDown={e => {
                          e.preventDefault();
                          setShowNameDrop(false);
                          setIsOthersMode(true);
                          setPersonName('');
                          setPersonSearch('');
                          setShowCreateAdvanceModal(true);
                        }}
                      >
                        ➕ Create New Customer Advanced Order
                      </div>
                    </div>
                  )}
                </div>

                {/* Being For (reason dropdown) */}
                <div className="cj-modal-field" style={{ position:'relative' }} data-dropdown-field>
                  <label>Being For</label>
                  <button
                    className={`cj-desc-trigger${cashInReasonKey ? ' has-value' : ''}`}
                    onClick={() => setShowCashInReasonDrop(o => !o)}
                  >
                    <span className="cj-desc-trigger-text">
                      {cashInReasonKey === '__advance_order__' && selectedAdvanceOrder
                        ? `Advance Order (${selectedAdvanceOrder.invoiceRef || '—'})`
                        : cashInReasonKey
                          ? CASH_IN_REASONS.find(r => r.key === cashInReasonKey)?.label
                          : 'Select reason…'}
                    </span>
                    <span className="cj-desc-chevron">{showCashInReasonDrop ? '▲' : '▼'}</span>
                  </button>
                  {showCashInReasonDrop && (
                    <div className="cj-desc-dropdown" style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:300 }}>
                      {CASH_IN_REASONS.map(r => (
                        <button key={r.key} className={`cj-desc-dropdown-item${cashInReasonKey === r.key ? ' selected' : ''}`}
                          onMouseDown={() => { setCashInReasonKey(r.key); setShowCashInReasonDrop(false); setSelectedAdvanceOrder(null); }}>
                          {r.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Amount */}
                <div className="cj-modal-field">
                  <label>Amount</label>
                  <input type="number" className="cj-modal-input" placeholder="0.00"
                    value={newAmount} onChange={e => setNewAmount(e.target.value)} min="0.01" step="0.01"
                  />
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
                {/* Paid To — users + Suppliers List + Add Operational Assets */}
                <div className="cj-modal-field" style={{ position:'relative' }} data-dropdown-field>
                  <label>Paid To</label>
                  {isOthersMode ? (
                    <>
                      <input
                        className="cj-modal-input"
                        value={personSearch}
                        onChange={e => {
                          setPersonSearch(e.target.value);
                          setShowSearchDrop(true);
                          setBeingForKey(''); setExpensesResult(null);
                        }}
                        onFocus={() => setShowOthersSubDrop(true)}
                        onBlur={() => setTimeout(() => { setShowSearchDrop(false); setShowOthersSubDrop(false); }, 220)}
                        placeholder="Search suppliers…"
                        autoFocus
                      />
                      {/* Sub-dropdown when focused and not typing */}
                      {showOthersSubDrop && !personSearch && (
                        <div className="cj-desc-dropdown" style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:400 }}>
                          <div
                            className="cj-desc-dropdown-item"
                            style={{ fontWeight:600, color:'#667eea' }}
                            onMouseDown={e => {
                              e.preventDefault();
                              setShowOthersSubDrop(false);
                              setShowSearchDrop(true);
                            }}
                          >
                            📦 Suppliers List
                          </div>
                          <div
                            className="cj-desc-dropdown-item"
                            style={{ fontWeight:600, color:'#f59e0b' }}
                            onMouseDown={e => {
                              e.preventDefault();
                              setShowOthersSubDrop(false);
                              // Open operational assets modal directly
                              const name = personSearch.trim() || personName.trim();
                              setPersonName(name);
                              setShowExpensesModal(true);
                            }}
                          >
                            🔧 Add Operational Assets
                          </div>
                        </div>
                      )}
                      {/* Suppliers search dropdown */}
                      {showSearchDrop && (() => {
                        const q = personSearch.toLowerCase();
                        const matches = q
                          ? suppliersList.filter(s => (s.name || s.customerName || '').toLowerCase().includes(q))
                          : suppliersList;
                        return matches.length > 0 ? (
                          <div className="cj-desc-dropdown" style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:400 }}>
                            {matches.map(s => {
                              const n = s.name || s.customerName || '';
                              return (
                                <button key={s.id} className="cj-desc-dropdown-item"
                                  onMouseDown={() => {
                                    setPersonSearch(n);
                                    setPersonName(n);
                                    setShowSearchDrop(false);
                                    setBeingForKey(''); setExpensesResult(null);
                                  }}>
                                  {n}
                                </button>
                              );
                            })}
                          </div>
                        ) : null;
                      })()}
                      <button style={{ marginTop:'4px', fontSize:'11px', color:'#667eea', background:'none', border:'none', cursor:'pointer', padding:0 }}
                        onClick={() => { setIsOthersMode(false); setPersonName(''); setPersonSearch(''); setBeingForKey(''); setExpensesResult(null); }}>
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
                      {/* Firebase users */}
                      {usersList.length > 0
                        ? usersList.map(u => {
                            const n = u.fullName || u.username || '';
                            return (
                              <button key={u.id} className="cj-desc-dropdown-item" onMouseDown={() => {
                                setPersonName(n); setPersonSearch('');
                                setIsOthersMode(false); setShowNameDrop(false);
                                setBeingForKey(''); setExpensesResult(null);
                              }}>
                                {n}
                                {u.role ? <span style={{ fontSize:'11px', color:'#9ca3af', marginLeft:'6px' }}>({u.role})</span> : null}
                              </button>
                            );
                          })
                        : <div className="cj-desc-dropdown-item" style={{ color:'#9ca3af', fontStyle:'italic', pointerEvents:'none' }}>No users found…</div>
                      }
                      {/* Landlord */}
                      {landlordInfo && (
                        <button
                          className="cj-desc-dropdown-item"
                          style={{ color:'#92400e' }}
                          onMouseDown={() => {
                            const n = landlordInfo.name || landlordInfo.fullName;
                            setPersonName(n); setPersonSearch('');
                            setIsOthersMode(false); setShowNameDrop(false);
                            setBeingForKey(''); setExpensesResult(null);
                          }}
                        >
                          🏠 {landlordInfo.name || landlordInfo.fullName}
                          <span style={{ fontSize:'11px', color:'#9ca3af', marginLeft:'6px' }}>(Landlord)</span>
                        </button>
                      )}
                      {/* Suppliers List */}
                      <div
                        className="cj-desc-dropdown-item"
                        style={{ fontWeight:600, color:'#667eea', borderTop:'1px solid var(--border, #e5e7eb)', marginTop:'2px', paddingTop:'8px' }}
                        onMouseDown={e => {
                          e.preventDefault();
                          setIsOthersMode(true);
                          setPersonName('');
                          setPersonSearch('');
                          setShowNameDrop(false);
                          setTimeout(() => setShowSearchDrop(true), 50);
                        }}
                      >
                        📦 Suppliers List
                      </div>
                      {/* Add Operational Assets */}
                      <div
                        className="cj-desc-dropdown-item"
                        style={{ fontWeight:600, color:'#f59e0b' }}
                        onMouseDown={e => {
                          e.preventDefault();
                          setShowNameDrop(false);
                          setIsOthersMode(true);
                          setPersonName('');
                          setPersonSearch('');
                          setShowExpensesModal(true);
                        }}
                      >
                        🔧 Add Operational Assets
                      </div>
                    </div>
                  )}
                </div>

                {/* Being For */}
                <div className="cj-modal-field" style={{ position:'relative' }} data-dropdown-field>
                  <label>Being For</label>
                  {beingForKey === '__supplier_purchase__' && expensesResult ? (
                    /* Supplier purchase already saved — show ref-based summary */
                    <div style={{padding:'8px 12px',background:expensesResult.paymentType==='cash'?'#f0fdf4':'#eff6ff',
                      border:`1.5px solid ${expensesResult.paymentType==='cash'?'#16a34a':'#3b82f6'}`,
                      borderRadius:'8px',fontSize:'13px',color:expensesResult.paymentType==='cash'?'#166534':'#1e40af'}}>
                      <div style={{fontWeight:700,marginBottom:'2px'}}>
                        {expensesResult.paymentType === 'cash' ? '✓ Cash Purchase' : '✓ Credit Purchase'} — Ref: {expensesResult.invoiceRef}
                      </div>
                      <div style={{fontSize:'12px',opacity:0.85,marginTop:'2px'}}>
                        Paid {expensesResult.supplierName} for ref: {expensesResult.invoiceRef}
                      </div>
                    </div>
                  ) : (
                    <button
                      className={`cj-desc-trigger${beingForKey ? ' has-value' : ''}`}
                      onClick={handleBeingForClick}
                    >
                      <span className="cj-desc-trigger-text">
                        {(() => {
                          const name = getResolvedName();
                          if (name && isKnownSupplier(name, suppliersList)) return '🔧 Tap to add operational assets…';
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

                {/* Amount — hide for supplier purchases since it's auto-set from the assets modal */}
                {!(beingForKey === '__supplier_purchase__' && expensesResult) && (
                  <div className="cj-modal-field">
                    <label>Amount</label>
                    <input type="number" className="cj-modal-input" placeholder="0.00"
                      value={newAmount} onChange={e => setNewAmount(e.target.value)} min="0.01" step="0.01"
                      readOnly={!!expensesResult}
                    />
                    <div style={{ fontSize:'12px', color:'#6b7280', marginTop:'4px' }}>
                      Current cash balance: {fmt(Math.max(0, currentBalance))}
                    </div>
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

      {/* ── Add Operational Assets Modal (supplier purchase from Cash Out) ── */}
      {showExpensesModal && (() => {
        const name = getResolvedName();
        const sup = getSupplierRecord(name, suppliersList);
        return (
          <AddOperationalAssetsModal
            initialSupplierName={name}
            initialSupplierId={sup?.id || null}
            suppliersList={suppliersList}
            onSave={handleExpensesSaved}
            onClose={() => setShowExpensesModal(false)}
          />
        );
      })()}

      {/* ── Create New Customer Advanced Order Modal ── */}
      {showCreateAdvanceModal && (
        <CreateNewCustomerAdvanceOrderModal
          onSave={(newOrder) => {
            // Put the new customer's name into the Cash From field
            const name = newOrder.name || newOrder.customerName || '';
            setPersonSearch(name);
            setShowCreateAdvanceModal(false);
            // Also reload advance orders list
            dataService.getAdvanceOrders().then(orders => setAdvanceOrdersList(orders || []));
          }}
          onClose={() => setShowCreateAdvanceModal(false)}
        />
      )}

      {/* ── Advance Order Card — shown when CASH FROM name matches a customer ── */}
      {advanceOrderCardData && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:3500, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
          <div style={{ background:'var(--surface, white)', color:'var(--text-primary, #111)', borderRadius:'14px', width:'100%', maxWidth:'400px', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 12px 48px rgba(0,0,0,0.3)' }}>
            {/* Header */}
            <div style={{ background:'linear-gradient(135deg,#667eea,#764ba2)', color:'white', padding:'16px 20px', borderRadius:'14px 14px 0 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:'11px', fontWeight:600, opacity:0.8, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'2px' }}>Advance Order</div>
                <div style={{ fontSize:'17px', fontWeight:800 }}>{advanceOrderCardData.customerName || advanceOrderCardData.name}</div>
              </div>
              <button
                onClick={() => setAdvanceOrderCardData(null)}
                style={{ background:'rgba(255,255,255,0.2)', border:'none', color:'white', width:'32px', height:'32px', borderRadius:'50%', cursor:'pointer', fontSize:'16px', display:'flex', alignItems:'center', justifyContent:'center' }}
              >✕</button>
            </div>

            {/* Body */}
            <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:'10px' }}>
              {/* Ref + Date */}
              <div style={{ display:'flex', gap:'10px' }}>
                {advanceOrderCardData.invoiceRef && (
                  <div style={{ flex:1, background:'#f3f4f6', borderRadius:'8px', padding:'10px 12px' }}>
                    <div style={{ fontSize:'10px', color:'#6b7280', fontWeight:700, textTransform:'uppercase', marginBottom:'2px' }}>Ref</div>
                    <div style={{ fontSize:'13px', fontWeight:700 }}>{advanceOrderCardData.invoiceRef}</div>
                  </div>
                )}
                {advanceOrderCardData.orderDate && (
                  <div style={{ flex:1, background:'#f3f4f6', borderRadius:'8px', padding:'10px 12px' }}>
                    <div style={{ fontSize:'10px', color:'#6b7280', fontWeight:700, textTransform:'uppercase', marginBottom:'2px' }}>Order Date</div>
                    <div style={{ fontSize:'13px', fontWeight:700 }}>{new Date(advanceOrderCardData.orderDate).toLocaleDateString('en-GB')}</div>
                  </div>
                )}
              </div>

              {/* Total Due + Balance */}
              <div style={{ display:'flex', gap:'10px' }}>
                <div style={{ flex:1, background:'#fef3c7', border:'1px solid #fcd34d', borderRadius:'8px', padding:'10px 12px' }}>
                  <div style={{ fontSize:'10px', color:'#92400e', fontWeight:700, textTransform:'uppercase', marginBottom:'2px' }}>Total Due</div>
                  <div style={{ fontSize:'15px', fontWeight:800, color:'#92400e' }}>{fmt(advanceOrderCardData.totalDue || 0)}</div>
                </div>
                <div style={{ flex:1, background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:'8px', padding:'10px 12px' }}>
                  <div style={{ fontSize:'10px', color:'#991b1b', fontWeight:700, textTransform:'uppercase', marginBottom:'2px' }}>Balance Owed</div>
                  <div style={{ fontSize:'15px', fontWeight:800, color:'#991b1b' }}>{fmt(advanceOrderCardData.balance || advanceOrderCardData.totalDue || 0)}</div>
                </div>
              </div>

              {/* Items table */}
              {advanceOrderCardData.items && advanceOrderCardData.items.length > 0 && (
                <div>
                  <div style={{ fontSize:'11px', fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>Items Ordered</div>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                    <thead>
                      <tr style={{ background:'#f3f4f6' }}>
                        <th style={{ padding:'6px 8px', textAlign:'left', fontSize:'11px', color:'#6b7280', fontWeight:700, textTransform:'uppercase' }}>Product</th>
                        <th style={{ padding:'6px 8px', textAlign:'center', fontSize:'11px', color:'#6b7280', fontWeight:700, textTransform:'uppercase', width:'50px' }}>Qty</th>
                        <th style={{ padding:'6px 8px', textAlign:'right', fontSize:'11px', color:'#6b7280', fontWeight:700, textTransform:'uppercase', width:'70px' }}>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {advanceOrderCardData.items.map((item, i) => (
                        <tr key={i} style={{ borderBottom:'1px solid #f3f4f6' }}>
                          <td style={{ padding:'6px 8px' }}>{item.name || 'N/A'}</td>
                          <td style={{ padding:'6px 8px', textAlign:'center' }}>{item.qty || item.quantity || 0}</td>
                          <td style={{ padding:'6px 8px', textAlign:'right' }}>{fmt(item.sellingPrice || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Phone */}
              {(advanceOrderCardData.phone || advanceOrderCardData.customerPhone) && (
                <div style={{ fontSize:'13px', color:'#6b7280' }}>
                  📞 {advanceOrderCardData.phone || advanceOrderCardData.customerPhone}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border, #e5e7eb)' }}>
              <button
                onClick={() => setAdvanceOrderCardData(null)}
                style={{ width:'100%', padding:'11px', borderRadius:'8px', border:'none', background:'#667eea', color:'white', fontWeight:700, fontSize:'14px', cursor:'pointer' }}
              >
                ✓ Got it — Continue Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CashRecord;
