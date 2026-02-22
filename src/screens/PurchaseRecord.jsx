import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera } from '@capacitor/camera';
import dataService from '../services/dataService';
import { useCurrency } from '../hooks/useCurrency';
import PdfTableButton from '../components/PdfTableButton';
import './PurchaseRecord.css';

// ── Shared 2-hour edit window helper ──────────────────────────────────────
function isWithin2Hours(entry) {
  const ts = entry.createdAt || entry.date;
  if (!ts) return false;
  return (new Date() - new Date(ts)) / (1000 * 60 * 60) <= 2;
}

// ─────────────────────────────────────────────────────────────
// PackSize child modal
// ─────────────────────────────────────────────────────────────
function PackSizeModal({ productName, onSave, onClose }) {
  const [units, setUnits] = useState('');
  const [size, setSize] = useState('');
  return (
    <div className="pr-modal-overlay" style={{zIndex:3000}}>
      <div className="pr-modal-content" style={{maxWidth:'320px'}}>
        <div className="pr-modal-header">
          <h2>Content of [{productName}] carton</h2>
          <button className="pr-modal-close" onClick={onClose}><X size={20}/></button>
        </div>
        <div className="pr-modal-body">
          <div className="pr-field">
            <input type="number" className="pr-input" placeholder="Units" value={units}
              onChange={e => setUnits(e.target.value)} min="1" />
          </div>
          <div className="pr-field">
            <input type="text" className="pr-input" placeholder="Size (e.g. 300g or 250ml)" value={size}
              onChange={e => setSize(e.target.value)} />
          </div>
        </div>
        <div className="pr-modal-footer">
          <button className="pr-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="pr-btn-save" onClick={() => {
            if (!units) { alert('Please enter units.'); return; }
            onSave(`${units}×${size || '?'}`);
          }}>OK</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Add Purchase Modal — now with payment type and creditor link
// ─────────────────────────────────────────────────────────────
function AddPurchaseModal({ onSave, onClose }) {
  const { fmt } = useCurrency();
  const [supplierId, setSupplierId]     = useState(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [suppliers, setSuppliers]       = useState([]);
  const [showSupplierDrop, setShowSupplierDrop] = useState(false);
  const selectedSupplier = suppliers.find(s => s.id === supplierId);
  const supplierName = selectedSupplier ? (selectedSupplier.name || selectedSupplier.customerName || '') : '';

  const [paymentType, setPaymentType]   = useState('cash');
  const [creditors, setCreditors]       = useState([]);
  const [creditorId, setCreditorId]     = useState(null);
  const [creditorName, setCreditorName] = useState('');
  const [showCreditorDrop, setShowCreditorDrop] = useState(false);

  const [purchaseDate, setPurchaseDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [rows, setRows] = useState([{ id: 1, qty: '', description: '', costPrice: '', packSize: '' }]);
  const [packSizeRowId, setPackSizeRowId] = useState(null);
  const [notes, setNotes] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [receiptPhoto, setReceiptPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const nextId = React.useRef(2);

  useEffect(() => {
    dataService.getSuppliers().then(data => setSuppliers(data || []));
    dataService.getCreditors().then(data => setCreditors(data || []));
  }, []);

  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  const addRow = () => setRows(prev => [...prev, { id: nextId.current++, qty: '', description: '', costPrice: '', packSize: '' }]);
  const removeRow = (id) => setRows(prev => prev.filter(r => r.id !== id));
  const updateRow = (id, field, val) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));

  const itemTotal = rows.reduce((sum, r) => sum + (parseFloat(r.qty)||0) * (parseFloat(r.costPrice)||0), 0);

  const filteredSuppliers = suppliers.filter(s =>
    (s.name||s.customerName||'').toLowerCase().startsWith(supplierSearch.toLowerCase()) ||
    (s.name||s.customerName||'').toLowerCase().includes(supplierSearch.toLowerCase())
  ).sort((a, b) => (a.name||a.customerName||'').localeCompare(b.name||b.customerName||''));

  const takePhoto = async () => {
    if (!Capacitor.isNativePlatform()) {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*'; input.capture = 'camera';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => setReceiptPhoto(ev.target.result);
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      try {
        const image = await CapCamera.getPhoto({ quality: 70, allowEditing: false, resultType: 'dataUrl' });
        setReceiptPhoto(image.dataUrl);
      } catch { alert('Could not capture photo.'); }
    }
  };

  const handleSave = async () => {
    if (!supplierId) { alert('Please select a supplier from the list.'); return; }
    if (!purchaseDate) { alert('Please select a purchase date.'); return; }
    if (paymentType === 'credit' && !creditorId) {
      alert('For credit purchases, please select the creditor (who you owe payment to).'); return;
    }
    const validRows = rows.filter(r => r.description.trim() && parseFloat(r.qty) > 0);
    if (validRows.length === 0) { alert('Please add at least one item with a description and quantity.'); return; }

    setSaving(true);
    try {
      const items = validRows.map(r => ({
        qty: parseFloat(r.qty),
        description: r.description.trim(),
        costPrice: parseFloat(r.costPrice) || 0,
        subtotal: (parseFloat(r.qty)||0) * (parseFloat(r.costPrice)||0),
        packSize: r.packSize || '',
      }));
      const total = items.reduce((s, i) => s + i.subtotal, 0);

      await dataService.addPurchase({
        supplierName: supplierName,
        supplierId: supplierId || null,
        paymentType,
        creditorId: paymentType === 'credit' ? creditorId : null,
        date: new Date(purchaseDate + 'T12:00:00').toISOString(),
        items,
        total,
        notes: notes.trim(),
        invoiceRef: invoiceRef.trim(),
        receiptPhoto: receiptPhoto || null,
      });
      onSave();
    } catch (e) {
      console.error(e);
      alert('Failed to save purchase. Please try again.');
    } finally { setSaving(false); }
  };

  return (
    <div className="pr-modal-overlay">
      <div className="pr-modal-content">
        <div className="pr-modal-header">
          <h2>Add Purchase</h2>
          <button className="pr-modal-close" onClick={onClose}><X size={20}/></button>
        </div>

        <div className="pr-modal-body">

          {/* Supplier — search-only dropdown */}
          <div className="pr-field">
            <label>Supplier Name *</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="pr-input"
                placeholder="Search a supplier"
                value={supplierSearch}
                onChange={e => { setSupplierSearch(e.target.value); setSupplierId(null); setShowSupplierDrop(true); }}
                onFocus={() => setShowSupplierDrop(true)}
                onBlur={() => setTimeout(() => setShowSupplierDrop(false), 180)}
              />
              {supplierId && (
                <div style={{marginTop:'4px',padding:'6px 10px',background:'#f0fdf4',border:'1.5px solid #16a34a',borderRadius:'6px',fontSize:'13px',color:'#166534',fontWeight:600}}>
                  ✓ {supplierName}
                </div>
              )}
              {showSupplierDrop && (
                <div style={{
                  position:'absolute', top:'100%', left:0, right:0, zIndex:1000,
                  background:'white', border:'1px solid #ccc', borderRadius:'6px',
                  maxHeight:'160px', overflowY:'auto', boxShadow:'0 4px 12px rgba(0,0,0,0.15)'
                }}>
                  {filteredSuppliers.length === 0 ? (
                    <div style={{padding:'10px 12px',color:'#9ca3af',fontSize:'13px'}}>No suppliers found</div>
                  ) : filteredSuppliers.map(s => (
                    <div key={s.id}
                      onMouseDown={() => { setSupplierId(s.id); setSupplierSearch(''); setShowSupplierDrop(false); }}
                      style={{ padding:'10px 12px', cursor:'pointer', borderBottom:'1px solid #eee', fontSize:'14px' }}
                    >
                      {s.name || s.customerName}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {suppliers.length === 0 && (
              <p style={{fontSize:'12px',color:'#c00',marginTop:'4px'}}>No suppliers registered. Add one in the Suppliers section first.</p>
            )}
          </div>

          {/* Payment Type */}
          <div className="pr-field">
            <label>Payment Type *</label>
            <div style={{ display:'flex', gap:'8px' }}>
              {[['cash','💵 Cash Paid'],['credit','📋 Buy on Credit']].map(([pt, lbl]) => (
                <button key={pt}
                  type="button"
                  onClick={() => setPaymentType(pt)}
                  style={{
                    flex:1, padding:'9px', borderRadius:'8px', border:'2px solid',
                    borderColor: paymentType === pt ? (pt === 'cash' ? '#16a34a' : '#dc2626') : '#d1d5db',
                    background: paymentType === pt ? (pt === 'cash' ? '#f0fdf4' : '#fff5f5') : 'white',
                    fontWeight: paymentType === pt ? 700 : 400,
                    color: paymentType === pt ? (pt === 'cash' ? '#16a34a' : '#dc2626') : '#6b7280',
                    cursor:'pointer', fontSize:'13px',
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>
            <p style={{ fontSize:'11px', marginTop:'4px', color: paymentType === 'credit' ? '#dc2626' : '#6b7280' }}>
              {paymentType === 'cash'
                ? 'Cash paid now — a Cash OUT entry will be recorded.'
                : 'Goods received, pay later — no cash out now. Creditor balance updated.'}
            </p>
          </div>

          {/* Creditor — only for credit purchases */}
          {paymentType === 'credit' && (
            <div className="pr-field">
              <label>Creditor (who you will pay) *</label>
              <div style={{ position:'relative' }}>
                <div
                  onClick={() => setShowCreditorDrop(d => !d)}
                  style={{
                    width:'100%', padding:'8px 36px 8px 10px',
                    border:`1.5px solid ${creditorId ? '#dc2626' : '#ccc'}`,
                    borderRadius:'6px', minHeight:'36px',
                    background: creditorId ? '#fff5f5' : 'white',
                    cursor:'pointer', userSelect:'none', boxSizing:'border-box',
                    fontSize:'14px', color: creditorName ? '#1f2937' : '#9ca3af',
                    display:'flex', alignItems:'center',
                  }}
                >
                  {creditorName || (creditors.length === 0 ? 'No creditors registered yet' : 'Tap to select creditor…')}
                </div>
                <span style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', color:'#9ca3af', fontSize:'12px', pointerEvents:'none' }}>▼</span>
                {showCreditorDrop && creditors.length > 0 && (
                  <div style={{
                    position:'absolute', top:'100%', left:0, right:0, zIndex:1000,
                    background:'white', border:'1px solid #ccc', borderRadius:'6px',
                    maxHeight:'160px', overflowY:'auto', boxShadow:'0 4px 12px rgba(0,0,0,0.15)'
                  }}>
                    {creditors.map(c => (
                      <div key={c.id}
                        onMouseDown={() => { setCreditorId(c.id); setCreditorName(c.name||c.customerName); setShowCreditorDrop(false); }}
                        style={{ padding:'10px 12px', cursor:'pointer', borderBottom:'1px solid #eee', fontSize:'14px' }}
                      >
                        <div style={{ fontWeight:600 }}>{c.name||c.customerName}</div>
                        <div style={{ fontSize:'11px', color:'#888' }}>Current balance: {fmt(c.balance||0)}</div>
                      </div>
                    ))}
                  </div>
                )}
                {showCreditorDrop && (
                  <div style={{ position:'fixed', inset:0, zIndex:999 }} onClick={() => setShowCreditorDrop(false)} />
                )}
              </div>
              {creditors.length === 0 && (
                <p style={{ fontSize:'12px', color:'#c00', marginTop:'4px' }}>
                  No creditors registered. Add one in the Creditors section first.
                </p>
              )}
            </div>
          )}

          {/* Date */}
          <div className="pr-field">
            <label>Purchase Date *</label>
            <input type="date" className="pr-input" value={purchaseDate}
              max={getTodayStr()} onChange={e => setPurchaseDate(e.target.value)} />
          </div>

          {/* Items */}
          <div className="pr-field">
            <label>Items Purchased *</label>
            <div className="pr-items-header pr-items-header-v2">
              <span>Qty</span>
              <span>Description</span>
              <span>Pack Size</span>
              <span>Cost</span>
              <span>Subtotal</span>
              <span></span>
            </div>
            {rows.map(row => (
              <div key={row.id} className="pr-item-row pr-item-row-v2">
                <input type="number" className="pr-item-input pr-item-qty"
                  placeholder="0" value={row.qty} min="0" step="1"
                  onChange={e => updateRow(row.id, 'qty', e.target.value)} />
                <input type="text" className="pr-item-input pr-item-desc"
                  placeholder="Item name…" value={row.description}
                  onChange={e => updateRow(row.id, 'description', e.target.value)} />
                <button
                  type="button"
                  className="pr-packsize-btn"
                  disabled={!row.description.trim()}
                  title={!row.description.trim() ? 'Enter product name first' : 'Set pack size'}
                  onClick={() => row.description.trim() && setPackSizeRowId(row.id)}
                  style={{
                    opacity: row.description.trim() ? 1 : 0.4,
                    cursor: row.description.trim() ? 'pointer' : 'not-allowed',
                    fontSize: '11px', padding: '4px 6px',
                    background: row.packSize ? '#e0f2fe' : '#f3f4f6',
                    border: '1px solid #d1d5db', borderRadius: '4px',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    maxWidth: '70px',
                  }}
                >
                  {row.packSize || 'Set…'}
                </button>
                <input type="number" className="pr-item-input pr-item-cost"
                  placeholder="0.00" value={row.costPrice} min="0" step="0.01"
                  onChange={e => updateRow(row.id, 'costPrice', e.target.value)} />
                <span className="pr-item-subtotal">
                  {fmt((parseFloat(row.qty)||0)*(parseFloat(row.costPrice)||0))}
                </span>
                {rows.length > 1 && (
                  <button className="pr-item-remove" onClick={() => removeRow(row.id)}>
                    <Trash2 size={14}/>
                  </button>
                )}
              </div>
            ))}
            <button className="pr-add-row-btn" onClick={addRow}>
              <Plus size={14}/> Add Next Product
            </button>
          </div>

          {/* Total */}
          <div className="pr-total-row">
            <span>Total Cost</span>
            <span className="pr-total-val">{fmt(itemTotal)}</span>
          </div>

          {/* Invoice / Reference */}
          <div className="pr-field">
            <label>Invoice / Reference Number (optional)</label>
            <input type="text" className="pr-input"
              placeholder="Invoice number, receipt ref…"
              value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)} />
          </div>

          {/* Notes */}
          <div className="pr-field">
            <label>Notes (optional)</label>
            <input type="text" className="pr-input"
              placeholder="Extra notes…"
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {/* Receipt Photo */}
          <div className="pr-field">
            <label>Receipt / Invoice Photo (optional)</label>
            <button type="button" className="pr-photo-btn" onClick={takePhoto}>
              {receiptPhoto ? '📷 Retake Photo' : '📷 Take Photo'}
            </button>
            {receiptPhoto && (
              <img src={receiptPhoto} alt="Receipt" className="pr-photo-preview" />
            )}
          </div>

        </div>

        <div className="pr-modal-footer">
          <button className="pr-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="pr-btn-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Purchase'}
          </button>
        </div>
      </div>

      {/* PackSize child modal */}
      {packSizeRowId !== null && (() => {
        const row = rows.find(r => r.id === packSizeRowId);
        return row ? (
          <PackSizeModal
            productName={row.description}
            onSave={(ps) => { updateRow(packSizeRowId, 'packSize', ps); setPackSizeRowId(null); }}
            onClose={() => setPackSizeRowId(null)}
          />
        ) : null;
      })()}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Purchase Detail / Edit modal
// ─────────────────────────────────────────────────────────────
function PurchaseDetailModal({ purchase, onClose, onSaved }) {
  const { fmt } = useCurrency();
  const editable = isWithin2Hours(purchase);
  const [supplierName, setSupplierName] = useState(purchase.supplierName || '');
  const [notes, setNotes] = useState(purchase.notes || '');
  const [invoiceRef, setInvoiceRef] = useState(purchase.invoiceRef || '');
  const [paymentType, setPaymentType] = useState(purchase.paymentType || purchase.payment_type || 'cash');
  const [rows, setRows] = useState((purchase.items || []).map((it, i) => ({ id: i + 1, ...it })));
  const nextId = React.useRef((purchase.items || []).length + 1);
  const [saving, setSaving] = useState(false);

  if (!purchase) return null;
  const d = new Date(purchase.date || purchase.createdAt || 0);
  const dateStr = d.toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' });
  const timeStr = d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12: true });

  const updateRow = (id, field, val) => setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  const removeRow = (id) => setRows(prev => prev.filter(r => r.id !== id));
  const addRow = () => { setRows(prev => [...prev, { id: nextId.current++, qty: '', description: '', costPrice: '', packSize: '' }]); };
  const itemTotal = rows.reduce((sum, r) => sum + (parseFloat(r.qty)||0) * (parseFloat(r.costPrice)||0), 0);

  const handleSave = async () => {
    if (!supplierName.trim()) { alert('Supplier name is required.'); return; }
    setSaving(true);
    try {
      const items = rows.filter(r => r.description?.trim()).map(r => ({
        qty: parseFloat(r.qty) || 0,
        description: r.description?.trim() || '',
        costPrice: parseFloat(r.costPrice) || 0,
        packSize: r.packSize || '',
        subtotal: (parseFloat(r.qty)||0) * (parseFloat(r.costPrice)||0),
      }));
      await dataService.updatePurchase(purchase.id, {
        supplierName: supplierName.trim(),
        notes: notes.trim(),
        invoiceRef: invoiceRef.trim(),
        paymentType,
        payment_type: paymentType,
        items,
        total: itemTotal,
      });
      onSaved();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="pr-modal-overlay">
      <div className="pr-modal-content">
        <div className="pr-modal-header">
          <h2>{editable ? '✏️ Edit Purchase' : 'Purchase Details'}</h2>
          <button className="pr-modal-close" onClick={onClose}><X size={20}/></button>
        </div>
        <div className="pr-modal-body">
          <div className="pr-detail-row"><span>Date</span><span>{dateStr}</span></div>
          <div className="pr-detail-row"><span>Time</span><span>{timeStr}</span></div>

          <div className="pr-field" style={{ marginTop:'10px' }}>
            <label>Supplier</label>
            {editable
              ? <input className="pr-input" value={supplierName} onChange={e => setSupplierName(e.target.value)} />
              : <div style={{ padding:'8px 0', fontWeight:600 }}>{purchase.supplierName || '—'}</div>}
          </div>

          <div className="pr-field">
            <label>Payment Type</label>
            {editable ? (
              <div style={{ display:'flex', gap:'8px' }}>
                {[['cash','💵 Cash'],['credit','📋 Credit']].map(([pt, lbl]) => (
                  <button key={pt} type="button" onClick={() => setPaymentType(pt)} style={{
                    flex:1, padding:'7px', borderRadius:'7px', border:'2px solid',
                    borderColor: paymentType===pt ? (pt==='cash'?'#16a34a':'#dc2626') : '#d1d5db',
                    background: paymentType===pt ? (pt==='cash'?'#f0fdf4':'#fff5f5') : 'white',
                    fontWeight: paymentType===pt ? 700 : 400, cursor:'pointer', fontSize:'13px',
                  }}>{lbl}</button>
                ))}
              </div>
            ) : (
              <div style={{ fontWeight:700, textTransform:'uppercase', color: paymentType==='cash'?'#16a34a':'#dc2626' }}>{paymentType}</div>
            )}
          </div>

          <div className="pr-field">
            <label>Items</label>
            {editable ? (
              <>
                <div className="pr-items-header pr-items-header-v2">
                  <span>Qty</span><span>Description</span><span>Pack</span><span>Cost</span><span>Sub</span><span></span>
                </div>
                {rows.map(row => (
                  <div key={row.id} className="pr-item-row pr-item-row-v2">
                    <input type="number" className="pr-item-input pr-item-qty" placeholder="0" value={row.qty||''} min="0"
                      onChange={e => updateRow(row.id,'qty',e.target.value)} />
                    <input type="text" className="pr-item-input pr-item-desc" placeholder="Item name…" value={row.description||''}
                      onChange={e => updateRow(row.id,'description',e.target.value)} />
                    <input type="text" className="pr-item-input" placeholder="Pack" value={row.packSize||''} style={{ width:'56px' }}
                      onChange={e => updateRow(row.id,'packSize',e.target.value)} />
                    <input type="number" className="pr-item-input pr-item-cost" placeholder="0.00" value={row.costPrice||''} min="0" step="0.01"
                      onChange={e => updateRow(row.id,'costPrice',e.target.value)} />
                    <span className="pr-item-subtotal">{fmt((parseFloat(row.qty)||0)*(parseFloat(row.costPrice)||0))}</span>
                    {rows.length > 1 && <button className="pr-item-remove" onClick={() => removeRow(row.id)}><Trash2 size={14}/></button>}
                  </div>
                ))}
                <button className="pr-add-row-btn" onClick={addRow}><Plus size={14}/> Add Item</button>
                <div className="pr-total-row"><span>Total</span><span className="pr-total-val">{fmt(itemTotal)}</span></div>
              </>
            ) : (
              <>
                {(purchase.items || []).map((item, i) => (
                  <div key={i} className="pr-detail-item-row">
                    <span className="pr-di-qty">{item.qty}×</span>
                    <span className="pr-di-desc">{item.description}</span>
                    <span className="pr-di-price">{fmt(item.costPrice||0)}</span>
                    <span className="pr-di-sub">{fmt(item.subtotal||0)}</span>
                  </div>
                ))}
                <div className="pr-detail-total"><span>Total Cost</span><span>{fmt(purchase.total||0)}</span></div>
              </>
            )}
          </div>

          <div className="pr-field">
            <label>Invoice / Reference</label>
            {editable
              ? <input className="pr-input" value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)} placeholder="Invoice ref…" />
              : <div style={{ padding:'4px 0' }}>{purchase.invoiceRef || '—'}</div>}
          </div>

          <div className="pr-field">
            <label>Notes</label>
            {editable
              ? <input className="pr-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes…" />
              : <div style={{ padding:'4px 0' }}>{purchase.notes || '—'}</div>}
          </div>

          {purchase.receiptPhoto && (
            <div className="pr-field">
              <label>Receipt Photo</label>
              <img src={purchase.receiptPhoto} alt="Receipt" className="pr-photo-preview" />
            </div>
          )}
        </div>
        <div className="pr-modal-footer">
          {editable ? (
            <>
              <button className="pr-btn-cancel" onClick={onClose}>Cancel</button>
              <button className="pr-btn-save" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </>
          ) : (
            <button className="pr-btn-save" onClick={onClose}>Close</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main PurchaseRecord screen
// ─────────────────────────────────────────────────────────────
function PurchaseRecord() {
  const { fmt } = useCurrency();
  const [purchases, setPurchases]       = useState([]);
  const [filtered, setFiltered]         = useState([]);
  const [showFilters, setShowFilters]   = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewPurchase, setViewPurchase] = useState(null);

  const [paymentFilter, setPaymentFilter] = useState('all');
  const [dateFilter, setDateFilter]     = useState('today');
  const [selectedDate, setSelectedDate] = useState('');
  const [startDate, setStartDate]       = useState('');
  const [endDate, setEndDate]           = useState('');

  const [appliedPaymentFilter, setAppliedPaymentFilter] = useState('all');
  const [appliedDateFilter, setAppliedDateFilter]       = useState('today');
  const [appliedSelectedDate, setAppliedSelectedDate]   = useState('');
  const [appliedStartDate, setAppliedStartDate]         = useState('');
  const [appliedEndDate, setAppliedEndDate]             = useState('');

  useEffect(() => { loadPurchases(); }, []);
  useEffect(() => {
    const handleVisibility = () => { if (!document.hidden) loadPurchases(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { applyFilters(); },
    [purchases, appliedPaymentFilter, appliedDateFilter, appliedSelectedDate, appliedStartDate, appliedEndDate]);

  const loadPurchases = async () => {
    const data = await dataService.getPurchases();
    const sorted = (data || []).sort((a, b) =>
      new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
    setPurchases(sorted);
  };

  const resolveDate = (p) => {
    const raw = p.date || p.createdAt;
    if (!raw) return null;
    if (typeof raw === 'object' && raw.seconds) return new Date(raw.seconds * 1000);
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  };

  const toMidnight = (d) => { const c = new Date(d); c.setHours(0,0,0,0); return c; };

  const applyFilters = () => {
    let f = [...purchases];
    if (appliedPaymentFilter !== 'all')
      f = f.filter(p => (p.paymentType || p.payment_type || 'cash') === appliedPaymentFilter);
    const today    = toMidnight(new Date());
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    if (appliedDateFilter === 'today')
      f = f.filter(p => { const d = resolveDate(p); return d && d >= today && d < tomorrow; });
    if (appliedDateFilter === 'single' && appliedSelectedDate) {
      const s = toMidnight(new Date(appliedSelectedDate)), e2 = new Date(s); e2.setDate(e2.getDate() + 1);
      f = f.filter(p => { const d = resolveDate(p); return d && d >= s && d < e2; });
    }
    if (appliedDateFilter === 'range' && appliedStartDate && appliedEndDate) {
      const s = toMidnight(new Date(appliedStartDate));
      const e2 = new Date(toMidnight(new Date(appliedEndDate))); e2.setDate(e2.getDate() + 1);
      f = f.filter(p => { const d = resolveDate(p); return d && d >= s && d < e2; });
    }
    setFiltered(f);
  };

  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const formatDisplayDate = (ds) =>
    new Date(ds).toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' });
  const isYesterday = (ds) => {
    if (!ds) return false;
    const y = new Date(); y.setDate(y.getDate()-1);
    return toMidnight(new Date(ds)).getTime() === toMidnight(y).getTime();
  };
  const getTableTitle = () => {
    if (appliedDateFilter === 'today') return 'Purchases Today';
    if (appliedDateFilter === 'single' && appliedSelectedDate) {
      if (isYesterday(appliedSelectedDate)) return 'Purchases Yesterday';
      return `Purchases on ${formatDisplayDate(appliedSelectedDate)}`;
    }
    if (appliedDateFilter === 'range' && appliedStartDate && appliedEndDate)
      return `Purchases from ${formatDisplayDate(appliedStartDate)} to ${formatDisplayDate(appliedEndDate)}`;
    return 'Purchases Today';
  };
  const formatDateTime = (p) => {
    const d = resolveDate(p);
    if (!d) return { date: 'N/A', time: 'N/A' };
    return {
      date: d.toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12: true }),
    };
  };

  const isFilterComplete = () => {
    if (dateFilter === 'today')  return true;
    if (dateFilter === 'single') return !!selectedDate;
    if (dateFilter === 'range')  return !!(startDate && endDate);
    return false;
  };
  const hasChanged = () =>
    paymentFilter !== appliedPaymentFilter || dateFilter !== appliedDateFilter ||
    selectedDate !== appliedSelectedDate || startDate !== appliedStartDate || endDate !== appliedEndDate;
  const showApply = isFilterComplete() && hasChanged();

  const handleClose = () => {
    setPaymentFilter(appliedPaymentFilter); setDateFilter(appliedDateFilter);
    setSelectedDate(appliedSelectedDate); setStartDate(appliedStartDate); setEndDate(appliedEndDate);
    setShowFilters(false);
  };
  const handleApply = () => {
    setAppliedPaymentFilter(paymentFilter); setAppliedDateFilter(dateFilter);
    setAppliedSelectedDate(selectedDate); setAppliedStartDate(startDate); setAppliedEndDate(endDate);
    setShowFilters(false);
  };
  const handleFilterButtonClick = () => {
    if (!showFilters) setShowFilters(true);
    else if (showApply) handleApply();
    else handleClose();
  };

  const cashTotal   = filtered.filter(p => (p.paymentType||p.payment_type||'cash') === 'cash').reduce((s,p) => s+(p.total||0), 0);
  const creditTotal = filtered.filter(p => (p.paymentType||p.payment_type) === 'credit').reduce((s,p) => s+(p.total||0), 0);
  const btnLabel = !showFilters ? 'Filter Purchases' : showApply ? 'Apply Filter' : 'Close Filter';

  return (
    <div className="pr-record">
      <div className="pr-sticky-bar">
        {showFilters && (
          <div className="pr-filters-section">
            <div className="pr-filter-group">
              <label>Payment Type</label>
              <div className="pr-filter-buttons">
                {[['all','All Purchases'],['cash','Cash Only'],['credit','Credit Only']].map(([val,lbl]) => (
                  <button key={val} className={`pr-filter-btn${paymentFilter===val?' active':''}`}
                    onClick={() => setPaymentFilter(val)}>{lbl}</button>
                ))}
              </div>
            </div>
            <div className="pr-filter-group">
              <label>Date Filter</label>
              <div className="pr-filter-buttons">
                {[['today','Today'],['single','Single Date'],['range','Date Range']].map(([val,lbl]) => (
                  <button key={val} className={`pr-filter-btn${dateFilter===val?' active':''}`}
                    onClick={() => { setDateFilter(val); setSelectedDate(''); setStartDate(''); setEndDate(''); }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            {dateFilter === 'single' && (
              <div className="pr-filter-group">
                <label>Select Date</label>
                <input type="date" value={selectedDate} max={getTodayStr()}
                  onChange={e => setSelectedDate(e.target.value)} className="pr-date-input" />
              </div>
            )}
            {dateFilter === 'range' && (
              <div className="pr-filter-group">
                <label>Date Range</label>
                <div className="pr-date-range-inputs">
                  <div className="pr-date-range-field">
                    <label className="pr-date-range-label">From:</label>
                    <input type="date" value={startDate} max={getTodayStr()}
                      onChange={e => { setStartDate(e.target.value); if (endDate && endDate < e.target.value) setEndDate(''); }}
                      className="pr-date-input" />
                  </div>
                  <div className="pr-date-range-field">
                    <label className="pr-date-range-label">To:</label>
                    <input type="date" value={endDate} min={startDate||undefined} max={getTodayStr()}
                      disabled={!startDate} onChange={e => setEndDate(e.target.value)}
                      className={`pr-date-input${!startDate?' pr-date-input-disabled':''}`} />
                  </div>
                </div>
                {!startDate && <span className="pr-date-range-hint">Select a "From" date first</span>}
              </div>
            )}
          </div>
        )}

        <div className="pr-top-row">
          <button
            className={`pr-filter-action-btn${!showFilters ? ' prfab-open' : showApply ? ' prfab-apply' : ' prfab-close'}`}
            onClick={handleFilterButtonClick}>{btnLabel}</button>
          {!showFilters && (
            <button className="pr-add-btn" onClick={() => setShowAddModal(true)}>+ Add Purchase</button>
          )}
        </div>

        <h3 className="pr-table-title">{getTableTitle()}</h3>

        <div className="pr-stats-boxes">
          <div className="pr-stat-box pr-stat-purple">
            <div className="pr-stat-label">Total Records</div>
            <div className="pr-stat-value">{filtered.length}</div>
          </div>
          <div className="pr-stat-box pr-stat-red">
            <div className="pr-stat-label">Cash Paid</div>
            <div className="pr-stat-value">{fmt(cashTotal)}</div>
          </div>
          <div className="pr-stat-box" style={{ background:'#fff5f5' }}>
            <div className="pr-stat-label" style={{ color:'#dc2626' }}>On Credit</div>
            <div className="pr-stat-value" style={{ color:'#dc2626' }}>{fmt(creditTotal)}</div>
          </div>
        </div>
      </div>

      <div className="pr-scroll-body">
        <div className="pr-table-wrapper" style={{position:'relative'}}>
          <PdfTableButton
            title="Purchase Record"
            columns={[
              {header:'Date',key:'date'},{header:'Time',key:'time'},{header:'Supplier',key:'supplier'},
              {header:'Items',key:'items'},{header:'Pay',key:'pay'},
              {header:'Total',key:'total'},{header:'Ref',key:'ref'}
            ]}
            rows={filtered.map(p => {
              const rawTs = p.date || p.timestamp || p.createdAt;
              const d = rawTs ? (rawTs.seconds ? new Date(rawTs.seconds*1000) : new Date(rawTs)) : null;
              return {
                date: d ? d.toLocaleDateString('en-GB') : 'N/A',
                time: d ? d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true}) : 'N/A',
                supplier: p.supplierName || '—',
                items: (p.items||[]).map(i=>i.description||i.name||'').join(', ') || '—',
                pay: p.paymentType || 'cash',
                total: fmt(p.total||0),
                ref: p.invoiceRef || p.notes || '—',
              };
            })}
            summary={[
              {label:'Cash Total', value: fmt(cashTotal)},
              {label:'Credit Total', value: fmt(creditTotal)},
              {label:'Grand Total', value: fmt(cashTotal + creditTotal)},
            ]}
          />
          <table className="pr-table">
            <thead className="pr-thead">
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Supplier</th>
                <th>QTY</th>
                <th>PACKSIZE</th>
                <th>Items</th>
                <th>Pay</th>
                <th className="pr-col-right">Total</th>
                <th>Ref</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="9" className="pr-empty-cell">No purchases found</td></tr>
              ) : (
                filtered.map(p => {
                  const { date, time } = formatDateTime(p);
                  const items = p.items || [];
                  const payType = p.paymentType || p.payment_type || 'cash';

                  if (items.length === 0) {
                    return (
                      <tr key={p.id} className="pr-row" style={{ cursor: isWithin2Hours(p) ? 'pointer' : 'default' }} onClick={() => setViewPurchase(p)}>
                        <td rowSpan="1">{date}</td>
                        <td rowSpan="1">{time}</td>
                        <td rowSpan="1" className="pr-supplier-cell">{p.supplierName || '—'}</td>
                        <td>—</td>
                        <td>—</td>
                        <td>—</td>
                        <td rowSpan="1">
                          <span style={{fontSize:'11px',fontWeight:700,padding:'2px 6px',borderRadius:'4px',textTransform:'uppercase',
                            background:payType==='cash'?'#dcfce7':'#fee2e2',color:payType==='cash'?'#16a34a':'#dc2626'}}>
                            {payType}
                          </span>
                        </td>
                        <td rowSpan="1" className="pr-col-right pr-total-cell">{fmt(p.total||0)}</td>
                        <td rowSpan="1" className="pr-notes-cell">{p.invoiceRef || p.notes || '—'}</td>
                      </tr>
                    );
                  }

                  return items.map((item, idx) => (
                    <tr key={`${p.id}-${idx}`} className="pr-row" style={{ cursor: isWithin2Hours(p) ? 'pointer' : 'default' }} onClick={() => setViewPurchase(p)}>
                      {idx === 0 && <td rowSpan={items.length} className="pr-merged-cell">{date}</td>}
                      {idx === 0 && <td rowSpan={items.length} className="pr-merged-cell">{time}</td>}
                      {idx === 0 && <td rowSpan={items.length} className="pr-merged-cell pr-supplier-cell">{p.supplierName || '—'}</td>}
                      <td className="pr-subrow-cell">{item.qty || '—'}</td>
                      <td className="pr-subrow-cell">{item.packSize || '—'}</td>
                      <td className="pr-subrow-cell pr-items-cell">{item.description || '—'}</td>
                      {idx === 0 && (
                        <td rowSpan={items.length} className="pr-merged-cell">
                          <span style={{fontSize:'11px',fontWeight:700,padding:'2px 6px',borderRadius:'4px',textTransform:'uppercase',
                            background:payType==='cash'?'#dcfce7':'#fee2e2',color:payType==='cash'?'#16a34a':'#dc2626'}}>
                            {payType}
                          </span>
                        </td>
                      )}
                      {idx === 0 && <td rowSpan={items.length} className="pr-merged-cell pr-col-right pr-total-cell">{fmt(p.total||0)}</td>}
                      {idx === 0 && <td rowSpan={items.length} className="pr-merged-cell pr-notes-cell">{p.invoiceRef || p.notes || '—'}</td>}
                    </tr>
                  ));
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <AddPurchaseModal
          onSave={async () => { setShowAddModal(false); await loadPurchases(); }}
          onClose={() => setShowAddModal(false)}
        />
      )}
      {viewPurchase && (
        <PurchaseDetailModal
          purchase={viewPurchase}
          onClose={() => setViewPurchase(null)}
          onSaved={async () => { setViewPurchase(null); await loadPurchases(); }}
        />
      )}
    </div>
  );
}

export default PurchaseRecord;
