import React, { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, Camera, Phone, Mail, MapPin, Edit2, MessageSquare } from 'lucide-react';
import dataService from '../services/dataService';
import './Debtors.css';

function Debtors() {
  const [debtors, setDebtors]           = useState([]);
  const [searchTerm, setSearchTerm]     = useState('');
  const [selectedDebtor, setSelectedDebtor] = useState(null);
  const [debtorSales, setDebtorSales]   = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentPhoto, setPaymentPhoto] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [showAddDebtorModal, setShowAddDebtorModal] = useState(false);
  const [newDebtor, setNewDebtor]       = useState({ fullName:'', gender:'', phone:'', whatsapp:'', email:'', address:'' });
  const [isEditMode, setIsEditMode]     = useState(false);
  const [editedDebtor, setEditedDebtor] = useState(null);
  const [activeTab, setActiveTab]       = useState('details');

  useEffect(() => { loadDebtors(); }, []);

  const loadDebtors = async () => {
    try {
      setLoading(true);
      const data = await dataService.getDebtors();
      setDebtors(data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const filteredDebtors = debtors.filter(d =>
    (d.name || d.customerName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDebtorClick = async (debtor) => {
    setSelectedDebtor(debtor);
    setEditedDebtor({...debtor});
    setIsEditMode(false);
    setActiveTab('details');
    try {
      const allSales = await dataService.getSales();
      setDebtorSales(allSales.filter(s => debtor.saleIds?.includes(s.id) || debtor.purchaseIds?.includes(s.id)));
    } catch (e) { setDebtorSales([]); }
  };

  const closeDebtorModal = () => {
    setSelectedDebtor(null); setDebtorSales([]);
    setIsEditMode(false); setEditedDebtor(null); setActiveTab('details');
  };

  const openAddDebtorModal = () => {
    setShowAddDebtorModal(true);
    setNewDebtor({ fullName:'', gender:'', phone:'', whatsapp:'', email:'', address:'' });
  };
  const closeAddDebtorModal = () => {
    setShowAddDebtorModal(false);
    setNewDebtor({ fullName:'', gender:'', phone:'', whatsapp:'', email:'', address:'' });
  };

  const handleAddDebtor = async (e) => {
    e.preventDefault();
    if (!newDebtor.fullName || !newDebtor.gender || !newDebtor.phone) { alert('Full Name, Gender and Phone are required'); return; }
    if (!newDebtor.whatsapp && !newDebtor.email) { alert('Please provide at least WhatsApp or Email'); return; }
    if (!newDebtor.address) { alert('Please provide an address'); return; }
    try {
      const debtorData = {
        id: dataService.generateId(), customerName: newDebtor.fullName, name: newDebtor.fullName,
        phone: newDebtor.phone, customerPhone: newDebtor.phone, gender: newDebtor.gender,
        whatsapp: newDebtor.whatsapp, email: newDebtor.email, address: newDebtor.address,
        totalDue: 0, totalPaid: 0, balance: 0, purchaseIds: [], deposits: [],
        createdAt: new Date().toISOString(), lastSale: null
      };
      const current = await dataService.getDebtors();
      current.push(debtorData);
      await dataService.setDebtors(current);
      alert('Debtor added successfully!');
      closeAddDebtorModal();
      await loadDebtors();
    } catch (e) { console.error(e); alert('Failed to add debtor.'); }
  };

  const enableEditMode  = () => setIsEditMode(true);
  const cancelEditMode  = () => { setIsEditMode(false); setEditedDebtor({...selectedDebtor}); };

  const saveDebtorEdits = async () => {
    if (!editedDebtor.name || !editedDebtor.gender || !editedDebtor.phone) { alert('Full Name, Gender and Phone are required'); return; }
    if (!editedDebtor.whatsapp && !editedDebtor.email) { alert('Please provide at least WhatsApp or Email'); return; }
    if (!editedDebtor.address) { alert('Please provide an address'); return; }
    try {
      const current = await dataService.getDebtors();
      const idx = current.findIndex(d => d.id === editedDebtor.id);
      if (idx !== -1) {
        current[idx] = { ...current[idx], name: editedDebtor.name, customerName: editedDebtor.name,
          phone: editedDebtor.phone, customerPhone: editedDebtor.phone, gender: editedDebtor.gender,
          whatsapp: editedDebtor.whatsapp, email: editedDebtor.email, address: editedDebtor.address };
        await dataService.setDebtors(current);
        setSelectedDebtor(current[idx]); setIsEditMode(false);
        await loadDebtors(); alert('Debtor updated!');
      }
    } catch (e) { console.error(e); alert('Failed to update debtor.'); }
  };

  const handleNotify = (method) => {
    const debtor  = selectedDebtor;
    const balance = debtor.balance || debtor.totalDue || 0;
    const message = `Hello ${debtor.name || debtor.customerName}, this is a reminder that you have an outstanding balance of $${balance.toFixed(2)} with Kadaele Services. Please make payment at your earliest convenience. Thank you!`;
    if (method === 'whatsapp') {
      const phone = debtor.whatsapp || debtor.phone || debtor.customerPhone;
      if (!phone) { alert('No WhatsApp number available'); return; }
      window.open(`https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(message)}`, '_blank');
    } else if (method === 'email') {
      if (!debtor.email) { alert('No email available'); return; }
      window.location.href = `mailto:${debtor.email}?subject=${encodeURIComponent('Payment Reminder - Kadaele Services')}&body=${encodeURIComponent(message)}`;
    } else if (method === 'sms') {
      const phone = debtor.phone || debtor.customerPhone;
      if (!phone) { alert('No phone number available'); return; }
      window.location.href = `sms:${phone}?body=${encodeURIComponent(message)}`;
    }
    setShowNotifyModal(false);
  };

  const handleTakePhoto = async () => {
    try {
      const { Camera } = await import('@capacitor/camera');
      const { CameraResultType, CameraSource } = await import('@capacitor/camera');
      const image = await Camera.getPhoto({ quality:90, allowEditing:false, resultType:CameraResultType.DataUrl, source:CameraSource.Camera });
      setPaymentPhoto(image.dataUrl);
    } catch (e) { console.error(e); alert('Failed to take photo'); }
  };

  const handleRecordPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) { alert('Please enter a valid payment amount'); return; }
    try {
      await dataService.recordPayment(selectedDebtor.id, parseFloat(paymentAmount), [], paymentPhoto || null);
      alert(`Payment of $${parseFloat(paymentAmount).toFixed(2)} recorded`);
      await loadDebtors();
      const updated = (await dataService.getDebtors()).find(d => d.id === selectedDebtor.id);
      if (updated) {
        setSelectedDebtor(updated);
        // Refresh debt history to show new deposit row
        const allSales = await dataService.getSales();
        setDebtorSales(allSales.filter(s => updated.saleIds?.includes(s.id) || updated.purchaseIds?.includes(s.id)));
      }
      setShowPaymentModal(false); setPaymentAmount(''); setPaymentPhoto(null);
    } catch (e) { console.error(e); alert('Failed to record payment'); }
  };

  const formatDate = (ts) => {
    if (!ts) return 'N/A';
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return isNaN(d) ? 'Invalid' : d.toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' });
  };
  const formatTime = (ts) => {
    if (!ts) return 'N/A';
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return isNaN(d) ? 'Invalid' : d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true });
  };

  // ── Build merged history rows: interleave sales + deposit rows, then compute
  //    running balance after each event. Sorted oldest → newest.
  const buildHistoryRows = () => {
    if (!selectedDebtor) return [];

    // Sales events
    const saleEvents = debtorSales.map(sale => ({
      kind: 'sale',
      date: new Date(sale.date || sale.timestamp || sale.createdAt || 0),
      sale,
    }));

    // Deposit events
    const depositEvents = (selectedDebtor.deposits || []).map(dep => ({
      kind: 'deposit',
      date: new Date(dep.date || 0),
      deposit: dep,
    }));

    const all = [...saleEvents, ...depositEvents].sort((a, b) => a.date - b.date);

    // Compute running balance after each event
    let balance = 0;
    return all.map(event => {
      if (event.kind === 'sale') {
        balance += parseFloat(event.sale.total || event.sale.total_amount || 0);
      } else {
        balance -= parseFloat(event.deposit.amount || 0);
      }
      return { ...event, runningBalance: balance };
    }).reverse(); // newest first for display
  };

  if (loading) return <div className="d-screen"><div className="d-loading">Loading debtors...</div></div>;

  const historyRows = selectedDebtor ? buildHistoryRows() : [];

  return (
    <div className="d-screen">

      {/* ── Header ── */}
      <div className="d-header">
        <input type="text" className="d-search" placeholder="Search debtor name…"
          value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        <button className="d-add-btn" onClick={openAddDebtorModal}>+ Add Debtor</button>
      </div>

      {/* ── Debtor cards ── */}
      <div className="d-grid">
        {filteredDebtors.length === 0 ? (
          <div className="d-empty">
            {searchTerm ? 'No debtors match your search.' : 'No debtors yet. Click "+ Add Debtor" to get started.'}
          </div>
        ) : (
          filteredDebtors.map(debtor => (
            <div key={debtor.id} className="d-card" onClick={() => handleDebtorClick(debtor)}>
              <div className="d-card-name">{debtor.name || debtor.customerName}</div>
              <div className="d-card-balance">${(debtor.balance || debtor.totalDue || 0).toFixed(2)}</div>
            </div>
          ))
        )}
      </div>

      {/* ── Debtor detail modal ── */}
      {selectedDebtor && (
        <div className="d-overlay" onClick={closeDebtorModal}>
          <div className="d-modal" onClick={e => e.stopPropagation()}>

            <div className="d-modal-header">
              <h2 className="d-modal-title">{selectedDebtor.name || selectedDebtor.customerName}</h2>
              <div className="d-modal-actions">
                {activeTab === 'details' && !isEditMode && (
                  <button className="d-edit-btn" onClick={enableEditMode} title="Edit"><Edit2 size={18} /></button>
                )}
                <button className="d-close-btn" onClick={closeDebtorModal}><X size={22} /></button>
              </div>
            </div>

            <div className="d-tabs">
              <button className={`d-tab${activeTab==='details'?' d-tab-active':''}`} onClick={() => setActiveTab('details')}>Details</button>
              <button className={`d-tab${activeTab==='history'?' d-tab-active':''}`} onClick={() => setActiveTab('history')}>Debt History</button>
            </div>

            {/* ── Details tab ── */}
            {activeTab === 'details' && (
              <div className="d-tab-body">
                {isEditMode ? (
                  <div className="d-edit-form">
                    {[['Full Name *','text',editedDebtor?.name||'','name'],['Phone *','tel',editedDebtor?.phone||'','phone'],
                      ['WhatsApp','tel',editedDebtor?.whatsapp||'','whatsapp'],['Email','email',editedDebtor?.email||'','email']].map(([lbl,type,val,field]) => (
                      <div className="d-form-group" key={field}>
                        <label>{lbl}</label>
                        <input type={type} value={val} onChange={e => setEditedDebtor({...editedDebtor,[field]:e.target.value})} />
                      </div>
                    ))}
                    <div className="d-form-group">
                      <label>Gender *</label>
                      <div className="d-gender">
                        {['Male','Female'].map(g => (
                          <label key={g} className="d-gender-option">
                            <input type="radio" name="edit-gender" checked={editedDebtor?.gender===g} onChange={() => setEditedDebtor({...editedDebtor,gender:g})} />{g}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="d-form-group">
                      <label>Address *</label>
                      <textarea rows="2" value={editedDebtor?.address||''} onChange={e => setEditedDebtor({...editedDebtor,address:e.target.value})} />
                    </div>
                    <div className="d-form-actions">
                      <button className="d-btn-cancel" onClick={cancelEditMode}>Cancel</button>
                      <button className="d-btn-save" onClick={saveDebtorEdits}>Save</button>
                    </div>
                  </div>
                ) : (
                  <div className="d-details-view">
                    {[
                      ['Name', selectedDebtor.name || selectedDebtor.customerName],
                      ['Gender', selectedDebtor.gender],
                      ['Phone', selectedDebtor.phone || selectedDebtor.customerPhone],
                      ['WhatsApp', selectedDebtor.whatsapp],
                      ['Email', selectedDebtor.email],
                      ['Address', selectedDebtor.address],
                    ].map(([lbl, val]) => (
                      <div className="d-detail-row" key={lbl}>
                        <span className="d-detail-label">{lbl}</span>
                        <span className="d-detail-value">{val || 'N/A'}</span>
                      </div>
                    ))}
                    <div className="d-debt-summary">
                      <span className="d-detail-label">Outstanding Balance</span>
                      <span className="d-debt-amount">${(selectedDebtor.balance || selectedDebtor.totalDue || 0).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Debt History tab ── */}
            {activeTab === 'history' && (
              <div className="d-history-wrapper">
                <div className="d-history-actions">
                  <button className="d-notify-btn" onClick={() => setShowNotifyModal(true)}>
                    <MessageSquare size={16} /> Notify
                  </button>
                  <button className="d-deposit-btn" onClick={() => setShowPaymentModal(true)}>
                    <DollarSign size={16} /> Deposit
                  </button>
                </div>

                <div className="d-history-scroll">
                  <table className="d-history-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Subtotal</th>
                        <th>Sale Total</th>
                        <th>Deposited</th>
                        <th>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyRows.length === 0 ? (
                        <tr><td colSpan="9" className="d-empty-cell">No history yet</td></tr>
                      ) : (
                        historyRows.map((row, rowIdx) => {
                          if (row.kind === 'deposit') {
                            // ── Deposit row ─────────────────────────────────
                            const dep = row.deposit;
                            return (
                              <tr key={`dep-${dep.id}`} className="d-deposit-row">
                                <td className="d-merged">{formatDate(dep.date)}</td>
                                <td className="d-merged">{formatTime(dep.date)}</td>
                                {/* Merged grey cell spanning item/qty/price/subtotal/sale-total */}
                                <td colSpan="5" className="d-deposit-merged-cell">
                                  D&nbsp;e&nbsp;p&nbsp;o&nbsp;s&nbsp;i&nbsp;t&nbsp;e&nbsp;d&nbsp;&nbsp;&nbsp;
                                  C&nbsp;a&nbsp;s&nbsp;h&nbsp;&nbsp;&nbsp;t&nbsp;o&nbsp;&nbsp;&nbsp;
                                  r&nbsp;e&nbsp;p&nbsp;a&nbsp;y&nbsp;&nbsp;&nbsp;
                                  D&nbsp;e&nbsp;b&nbsp;t
                                </td>
                                <td className="d-deposited-amount">${parseFloat(dep.amount).toFixed(2)}</td>
                                <td className={`d-balance-cell ${row.runningBalance < 0 ? 'd-balance-neg' : ''}`}>
                                  ${Math.abs(row.runningBalance).toFixed(2)}
                                </td>
                              </tr>
                            );
                          }

                          // ── Sale row(s) ──────────────────────────────────
                          const sale = row.sale;
                          const items = sale.items && sale.items.length > 0 ? sale.items : [null];
                          const rowSpan = items.length;
                          const rawTs = sale.date || sale.timestamp || sale.createdAt;

                          return items.map((item, idx) => (
                            <tr key={`${sale.id}-${idx}`} className={idx > 0 ? 'd-hist-cont' : 'd-hist-first'}>
                              {idx === 0 && <td rowSpan={rowSpan} className="d-merged">{formatDate(rawTs)}</td>}
                              {idx === 0 && <td rowSpan={rowSpan} className="d-merged">{formatTime(rawTs)}</td>}
                              <td>{item ? (item.name || 'N/A') : 'N/A'}</td>
                              <td className="d-qty">{item ? (item.quantity || item.qty || 0) : '—'}</td>
                              <td>${item ? (item.price || 0).toFixed(2) : '0.00'}</td>
                              <td>${item ? (item.subtotal || (item.price||0)*(item.quantity||item.qty||0)).toFixed(2) : '0.00'}</td>
                              {idx === 0 && <td rowSpan={rowSpan} className="d-merged d-sale-total">${(sale.total || sale.total_amount || 0).toFixed(2)}</td>}
                              {idx === 0 && <td rowSpan={rowSpan} className="d-merged">—</td>}
                              {idx === 0 && (
                                <td rowSpan={rowSpan} className={`d-merged d-balance-cell ${row.runningBalance < 0 ? 'd-balance-neg' : ''}`}>
                                  ${Math.abs(row.runningBalance).toFixed(2)}
                                </td>
                              )}
                            </tr>
                          ));
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Add Debtor Modal ── */}
      {showAddDebtorModal && (
        <div className="d-overlay" onClick={closeAddDebtorModal}>
          <div className="d-modal d-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="d-modal-header">
              <h2 className="d-modal-title">Add New Debtor</h2>
              <button className="d-close-btn" onClick={closeAddDebtorModal}><X size={22} /></button>
            </div>
            <form className="d-add-form" onSubmit={handleAddDebtor}>
              {[['Full Name *','text','fullName','Enter full name'],['Phone *','tel','phone','Phone number'],
                ['WhatsApp','tel','whatsapp','WhatsApp number (optional)'],['Email','email','email','Email (optional)']].map(([lbl,type,field,ph]) => (
                <div className="d-form-group" key={field}>
                  <label>{lbl}</label>
                  <input type={type} value={newDebtor[field]} placeholder={ph}
                    onChange={e => setNewDebtor({...newDebtor,[field]:e.target.value})} />
                </div>
              ))}
              <div className="d-form-group">
                <label>Gender *</label>
                <div className="d-gender">
                  {['Male','Female'].map(g => (
                    <label key={g} className="d-gender-option">
                      <input type="radio" name="new-gender" checked={newDebtor.gender===g} onChange={() => setNewDebtor({...newDebtor,gender:g})} />{g}
                    </label>
                  ))}
                </div>
              </div>
              <div className="d-form-group">
                <label>Address *</label>
                <textarea rows="2" value={newDebtor.address} placeholder="Enter address"
                  onChange={e => setNewDebtor({...newDebtor,address:e.target.value})} />
              </div>
              <p className="d-form-note">* Required · At least WhatsApp or Email required</p>
              <div className="d-form-actions">
                <button type="button" className="d-btn-cancel" onClick={closeAddDebtorModal}>Cancel</button>
                <button type="submit" className="d-btn-save">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Payment / Deposit Modal ── */}
      {showPaymentModal && (
        <div className="d-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="d-modal d-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="d-modal-header">
              <h2 className="d-modal-title">Record Deposit</h2>
              <button className="d-close-btn" onClick={() => setShowPaymentModal(false)}><X size={22} /></button>
            </div>
            <div className="d-payment-form">
              <div className="d-form-group">
                <label>Deposit Amount</label>
                <input type="number" step="0.01" value={paymentAmount} placeholder="0.00"
                  onChange={e => setPaymentAmount(e.target.value)} className="d-payment-input" />
              </div>
              <button className="d-camera-btn" onClick={handleTakePhoto}>
                <Camera size={18} /> {paymentPhoto ? 'Retake Photo' : 'Take Receipt Photo'}
              </button>
              {paymentPhoto && <img className="d-photo-preview" src={paymentPhoto} alt="Receipt" />}
              <div className="d-form-actions">
                <button className="d-btn-cancel" onClick={() => setShowPaymentModal(false)}>Cancel</button>
                <button className="d-btn-save" onClick={handleRecordPayment}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Notify Modal ── */}
      {showNotifyModal && (
        <div className="d-overlay" onClick={() => setShowNotifyModal(false)}>
          <div className="d-modal d-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="d-modal-header">
              <h2 className="d-modal-title">Notify via</h2>
              <button className="d-close-btn" onClick={() => setShowNotifyModal(false)}><X size={22} /></button>
            </div>
            <div className="d-notify-options">
              <button className="d-notify-opt d-notify-wa"  onClick={() => handleNotify('whatsapp')}><MessageSquare size={20}/> WhatsApp</button>
              <button className="d-notify-opt d-notify-em"  onClick={() => handleNotify('email')}><Mail size={20}/> Email</button>
              <button className="d-notify-opt d-notify-sms" onClick={() => handleNotify('sms')}><Phone size={20}/> SMS</button>
            </div>
            <div className="d-notify-preview">
              <p className="d-notify-preview-label">Message Preview</p>
              <p className="d-notify-preview-text">
                Hello {selectedDebtor?.name || selectedDebtor?.customerName}, this is a reminder that you have an outstanding balance of ${(selectedDebtor?.balance || selectedDebtor?.totalDue || 0).toFixed(2)} with Kadaele Services. Please make payment at your earliest convenience. Thank you!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Debtors;
