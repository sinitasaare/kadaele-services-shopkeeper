import React, { useState, useEffect, useRef } from 'react';
import { X, DollarSign, Calendar, Camera, Phone, Mail, MapPin, Edit2, MessageSquare, ArrowUpDown, FileText } from 'lucide-react';
import dataService from '../services/dataService';
import { useCurrency } from '../hooks/useCurrency';
import kadaeleLogo from '../assets/kadaeleLogo.js';
import './Debtors.css';

// ── Shared 30-minute edit window helper ──────────────────────────────────
function isWithin30Mins(entry) {
  const ts = entry.createdAt || entry.date || entry.timestamp;
  if (!ts) return false;
  return (new Date() - new Date(ts)) / (1000 * 60) <= 30;
}
function isDepositEditable(dep) {
  const ts = dep.createdAt || dep.date;
  if (!ts) return false;
  return (new Date() - new Date(ts)) / (1000 * 60) <= 30;
}

// ── Sale Edit Modal ────────────────────────────────────────────────────────
function SaleEditModal({ sale, onSave, onClose, onDeleted, fmt }) {
  const [customerName, setCustomerName] = useState(sale.customer_name || sale.customerName || '');
  const [items, setItems] = useState((sale.items || []).map(i => ({ ...i })));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const updateItem = (idx, field, val) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));

  const total = items.reduce((sum, it) => {
    const qty = parseFloat(it.quantity ?? it.qty ?? 0);
    const price = parseFloat(it.price ?? 0);
    return sum + qty * price;
  }, 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedItems = items.map(it => ({
        ...it,
        quantity: parseFloat(it.quantity ?? it.qty ?? 0),
        qty: parseFloat(it.quantity ?? it.qty ?? 0),
        subtotal: parseFloat(it.quantity ?? it.qty ?? 0) * parseFloat(it.price ?? 0),
      }));
      await dataService.updateSale(sale.id, {
        items: updatedItems,
        total_amount: total,
        total,
        customer_name: customerName,
        customerName,
      });
      onSave();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this sale record? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await dataService.deleteSale(sale.id);
      onDeleted();
    } catch (e) { alert(e.message); }
    finally { setDeleting(false); }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:5000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', overflowY:'auto' }}>
      <div style={{ background:'white', borderRadius:'12px', padding:'20px', width:'100%', maxWidth:'420px', maxHeight:'90vh', overflowY:'auto' }}>
        <h3 style={{ margin:'0 0 16px', color:'#1a1a2e', fontSize:'16px' }}>✏️ Edit Sale Entry</h3>

        <div style={{ marginBottom:'12px' }}>
          <label style={{ display:'block', fontWeight:600, fontSize:'13px', marginBottom:'4px' }}>Customer Name</label>
          <input value={customerName} onChange={e => setCustomerName(e.target.value)}
            style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #d1d5db', borderRadius:'6px', fontSize:'14px', boxSizing:'border-box' }} />
        </div>

        <div style={{ marginBottom:'12px' }}>
          <label style={{ display:'block', fontWeight:600, fontSize:'13px', marginBottom:'6px' }}>Products</label>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px', minWidth:'280px' }}>
              <thead>
                <tr style={{ background:'#f3f4f6' }}>
                  <th style={{ padding:'6px 8px', textAlign:'left', fontWeight:600, fontSize:'11px', color:'#6b7280', textTransform:'uppercase' }}>Product Name</th>
                  <th style={{ padding:'6px 8px', textAlign:'center', fontWeight:600, fontSize:'11px', color:'#6b7280', textTransform:'uppercase', width:'60px' }}>Qty</th>
                  <th style={{ padding:'6px 8px', textAlign:'right', fontWeight:600, fontSize:'11px', color:'#6b7280', textTransform:'uppercase', width:'70px' }}>Selling Price</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx}>
                    <td style={{ padding:'4px 8px' }}>
                      <input value={it.name || ''} onChange={e => updateItem(idx, 'name', e.target.value)} placeholder="Item name"
                        style={{ width:'100%', padding:'5px 6px', border:'1.5px solid #d1d5db', borderRadius:'5px', fontSize:'13px', boxSizing:'border-box' }} />
                    </td>
                    <td style={{ padding:'4px 8px' }}>
                      <input type="number" value={it.quantity ?? it.qty ?? ''} onChange={e => updateItem(idx, 'quantity', e.target.value)} placeholder="0"
                        style={{ width:'100%', padding:'5px 6px', border:'1.5px solid #d1d5db', borderRadius:'5px', fontSize:'13px', textAlign:'center', boxSizing:'border-box' }} />
                    </td>
                    <td style={{ padding:'4px 8px' }}>
                      <input type="number" value={it.price ?? ''} onChange={e => updateItem(idx, 'price', e.target.value)} placeholder="0.00"
                        style={{ width:'100%', padding:'5px 6px', border:'1.5px solid #d1d5db', borderRadius:'5px', fontSize:'13px', textAlign:'right', boxSizing:'border-box' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ textAlign:'right', fontWeight:700, fontSize:'15px', marginBottom:'16px', color:'#667eea' }}>
          Total: {fmt(total)}
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

function Debtors() {
  const { fmt } = useCurrency();
  const [debtors, setDebtors]           = useState([]);
  const [searchTerm, setSearchTerm]     = useState('');
  const [selectedDebtor, setSelectedDebtor] = useState(null);
  const [debtorSales, setDebtorSales]   = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [editSale, setEditSale] = useState(null);
  const [paymentPhoto, setPaymentPhoto] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [showAddDebtorModal, setShowAddDebtorModal] = useState(false);
  const [newDebtor, setNewDebtor]       = useState({ fullName:'', gender:'', phone:'', whatsapp:'', email:'', address:'' });
  const [isEditMode, setIsEditMode]     = useState(false);
  const [editedDebtor, setEditedDebtor] = useState(null);
  const [activeTab, setActiveTab]       = useState('details');
  const [sortOrder, setSortOrder]       = useState(null);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef                     = useRef(null);
  const historyRef                      = useRef(null);  // ref for debt history section → PDF
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [enlargedPhoto, setEnlargedPhoto] = useState(null);
  const [editDepositModal, setEditDepositModal] = useState(null); // { debtorId, deposit }
  const [editDepositAmount, setEditDepositAmount] = useState('');
  const [editDepositReceipt, setEditDepositReceipt] = useState('');
  const [savingDeposit, setSavingDeposit] = useState(false);
  const [pdfSharing, setPdfSharing] = useState(false);


  useEffect(() => { loadDebtors(); }, []);

  // Close sort menu when clicking outside
  useEffect(() => {
    const handler = (e) => { if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) setShowSortMenu(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadDebtors = async () => {
    try {
      setLoading(true);
      const data = await dataService.getDebtors();
      setDebtors(data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // ── Smart search ──────────────────────────────────────────────────────────
  const smartSearch = (items, term) => {
    if (!term.trim()) return items;
    const t = term.toLowerCase();
    const firstMatches = [], secondMatches = [];
    for (const d of items) {
      const words = (d.name || d.customerName || '').toLowerCase().split(/\s+/);
      if (words[0] && words[0].startsWith(t)) firstMatches.push(d);
      else if (words.length > 1 && words[1] && words[1].startsWith(t)) secondMatches.push(d);
    }
    const sortBy2nd = (arr, wi) => [...arr].sort((a, b) => {
      const wa = ((a.name||a.customerName||'').toLowerCase().split(/\s+/)[wi]||'');
      const wb = ((b.name||b.customerName||'').toLowerCase().split(/\s+/)[wi]||'');
      return (wa[1]||'').localeCompare(wb[1]||'');
    });
    return [...sortBy2nd(firstMatches, 0), ...sortBy2nd(secondMatches, 1)];
  };

  // ── Sort ──────────────────────────────────────────────────────────────────
  const SORT_OPTIONS = [
    { key: 'balance_desc', label: 'Balance: High to Low' },
    { key: 'balance_asc',  label: 'Balance: Low to High' },
    { key: 'modified_desc', label: 'Recently Modified' },
    { key: 'modified_asc',  label: 'Oldest Modified' },
    { key: 'due_asc',  label: 'Due Date: Soonest First' },
    { key: 'due_desc', label: 'Due Date: Latest First' },
  ];

  const applySortAndSearch = (items) => {
    let result = smartSearch(items, searchTerm);
    if (!sortOrder) return result;
    return [...result].sort((a, b) => {
      const balA = a.balance || a.totalDue || 0;
      const balB = b.balance || b.totalDue || 0;
      const modA = new Date(a.updatedAt || a.lastSale || a.createdAt || 0);
      const modB = new Date(b.updatedAt || b.lastSale || b.createdAt || 0);
      const dueA = a.repaymentDate ? new Date(a.repaymentDate) : new Date('9999-12-31');
      const dueB = b.repaymentDate ? new Date(b.repaymentDate) : new Date('9999-12-31');
      switch (sortOrder) {
        case 'balance_desc': return balB - balA;
        case 'balance_asc':  return balA - balB;
        case 'modified_desc': return modB - modA;
        case 'modified_asc':  return modA - modB;
        case 'due_asc':  return dueA - dueB;
        case 'due_desc': return dueB - dueA;
        default: return 0;
      }
    });
  };

  const filteredDebtors = applySortAndSearch(debtors);

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
    if (newDebtor.email && !newDebtor.email.includes('@')) { alert('Email address must contain "@"'); return; }
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
    if (editedDebtor.email && !editedDebtor.email.includes('@')) { alert('Email address must contain "@"'); return; }
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

  // ── Build smart notification message based on due date status ──────────────
  const buildNotifyMessage = () => {
    const debtor  = selectedDebtor;
    const name    = debtor.name || debtor.customerName || 'Valued Customer';
    const gender  = debtor.gender || '';
    const prefix  = gender === 'Male' ? 'Mr.' : gender === 'Female' ? 'Ms.' : '';
    const salutation = prefix ? `${prefix} ${name}` : name;
    const balance = historyRows.length > 0
      ? historyRows[0].runningBalance
      : (debtor.balance || debtor.totalDue || 0);
    const balanceStr = `${fmt(Math.abs(balance))}`;

    const repaymentDate = debtor.repaymentDate || '';
    const today  = new Date(); today.setHours(0,0,0,0);
    const dueDate = repaymentDate ? new Date(repaymentDate) : null;
    if (dueDate) dueDate.setHours(0,0,0,0);

    const daysDiff = dueDate ? Math.round((dueDate - today) / (1000 * 60 * 60 * 24)) : null;

    // Format due date as readable string e.g. "15 March 2026"
    const dueDateStr = dueDate
      ? dueDate.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
      : 'the agreed date';

    let subject, body;

    if (daysDiff === null || daysDiff > 0) {
      // ── Due date is still to come ──────────────────────────────────────────
      let duePhrasing;
      if (daysDiff === 1) {
        duePhrasing = 'tomorrow is the due date of your debt';
      } else if (daysDiff !== null) {
        duePhrasing = `you have ${daysDiff} day${daysDiff !== 1 ? 's' : ''} before your debt is due`;
      } else {
        duePhrasing = `the due date is ${dueDateStr}`;
      }
      const dueDateDisplay = daysDiff === 1 ? 'tomorrow' : dueDateStr;

      subject = 'Friendly Reminder: Outstanding Debt Due ' + (daysDiff === 1 ? 'Tomorrow' : `on ${dueDateStr}`);
      body =
`Dear ${salutation},

This is a polite reminder from Kadaele Services. You have an outstanding balance of ${balanceStr}.

We kindly remind you that ${duePhrasing}, as you had promised to pay by. We appreciate if you could settle it not later than ${dueDateDisplay}.

If you would like a detailed report of your debt history in PDF, please let us know and we will send it to you.

Thank you for your attention and prompt payment.

Best regards,
Kadaele Services`;

    } else {
      // ── Due date has passed ────────────────────────────────────────────────
      const daysOverdue = Math.abs(daysDiff);
      subject = `Polite Reminder: Overdue Debt of ${balanceStr}`;
      body =
`Dear ${salutation},

This is a polite reminder from Kadaele Services. You have an outstanding balance of ${balanceStr}.

We kindly remind you that the due date was ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} ago, as you had promised to pay by.

We appreciate if you could settle it as soon as possible.

If you would like a detailed report of your debt history in PDF, please let us know and we will send it to you.

Thank you for your attention and prompt payment.

Best regards,
Kadaele Services`;
    }

    return { subject, body };
  };

  // ── Generate A4 PDF of the debt statement ────────────────────────────────
  // Uses jsPDF + jspdf-autotable (both loaded via CDN in index.html).
  // Draws: Kadaele logo, debtor info, full Debt History table, outstanding total.
  const generateA4PDF = async () => {
    try {
      const { jsPDF } = window.jspdf;
      if (!jsPDF) throw new Error('jsPDF not loaded');

      const pageW  = 210;
      const pageH  = 297;
      const margin = 12;
      const pdf    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // ── 1 & 2. Purple header bar + Kadaele logo on top ────────────────
      let logoLoaded = false;
      pdf.setFillColor(102, 126, 234);
      pdf.rect(0, 0, pageW, 26, 'F');
      try {
        if (kadaeleLogo) {
          pdf.addImage(kadaeleLogo, 'PNG', margin, 2, 22, 22);
          logoLoaded = true;
        }
      } catch (_) { /* logo optional — continue without it */ }

      if (!logoLoaded) {
        // Fallback text logo
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(13);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Kadaele Services', margin, 12);
      }

      // Company name + contact left, DEBT STATEMENT centre, date right
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Kadaele Services', logoLoaded ? margin + 26 : margin, 11);
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Ph: 73057613  |  ritiamti102016@gmail.com', logoLoaded ? margin + 26 : margin, 17);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text('DEBT STATEMENT', pageW / 2, 11, { align: 'center' });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
      pdf.text(`Generated: ${today}`, pageW - margin, 22, { align: 'right' });

      // ── 3. Debtor info block ──────────────────────────────────────────────
      let y = 34;
      const debtor     = selectedDebtor;
      const debtorName = debtor.name || debtor.customerName || 'N/A';
      const gender     = debtor.gender || '';
      const prefix     = gender === 'Male' ? 'Mr.' : gender === 'Female' ? 'Ms.' : '';
      const balance    = historyRows.length > 0
        ? historyRows[0].runningBalance
        : (debtor.balance || debtor.totalDue || 0);

      pdf.setTextColor(20, 20, 20);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${prefix ? prefix + ' ' : ''}${debtorName}`, margin, y);

      y += 5;
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(70, 70, 70);
      const infoLines = [];
      if (debtor.phone || debtor.customerPhone) infoLines.push(`Phone: ${debtor.phone || debtor.customerPhone}`);
      if (debtor.whatsapp)     infoLines.push(`WhatsApp: ${debtor.whatsapp}`);
      if (debtor.email)        infoLines.push(`Email: ${debtor.email}`);
      if (debtor.address)      infoLines.push(`Address: ${debtor.address}`);
      if (debtor.repaymentDate) infoLines.push(`Due Date: ${debtor.repaymentDate}`);
      infoLines.forEach(line => { pdf.text(line, margin, y); y += 4.5; });

      // Outstanding balance box (right side)
      const boxX = pageW - margin - 52;
      const boxY = 30;
      const isOwed = balance > 0;
      pdf.setFillColor(isOwed ? 254 : 220, isOwed ? 226 : 252, isOwed ? 226 : 231);
      pdf.roundedRect(boxX, boxY, 52, 20, 2, 2, 'F');
      pdf.setFontSize(6.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(isOwed ? 153 : 3, isOwed ? 27 : 105, isOwed ? 27 : 81);
      pdf.text('OUTSTANDING BALANCE', boxX + 26, boxY + 6, { align: 'center' });
      pdf.setFontSize(13);
      pdf.setFont('helvetica', 'bold');
      pdf.text(fmt(Math.abs(balance)), boxX + 26, boxY + 15, { align: 'center' });

      // Divider
      y = Math.max(y, boxY + 24) + 3;
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, y, pageW - margin, y);
      y += 4;

      // ── 4. Section title ──────────────────────────────────────────────────
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(50, 50, 50);
      pdf.text('Debt History', margin, y);
      y += 3;

      // ── 5. Build table rows from historyRows ──────────────────────────────
      const tableHead = [[{ content: 'Date', styles: { halign: 'center' } }, { content: 'Time', styles: { halign: 'center' } }, { content: 'Ref', styles: { halign: 'center' } }, { content: 'Item', styles: { halign: 'left' } }, { content: 'Qty', styles: { halign: 'center' } }, { content: 'Price', styles: { halign: 'center' } }, { content: 'Subtotal', styles: { halign: 'center' } }, { content: 'Debit', styles: { halign: 'center' } }, { content: 'Credit', styles: { halign: 'center' } }, { content: 'Balance', styles: { halign: 'center' } }]];
      const tableBody = [];

      historyRows.forEach(row => {
        if (row.kind === 'deposit') {
          const dep = row.deposit;
          const dDate = dep.date ? (dep.date.seconds ? new Date(dep.date.seconds*1000) : new Date(dep.date)) : null;
          const dDateStr = dDate ? dDate.toLocaleDateString('en-GB') : 'N/A';
          const dTimeStr = dep.isUnrecorded ? 'UNRECORDED' : (dDate ? dDate.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true}) : 'N/A');
          tableBody.push([
            dDateStr, dTimeStr,
            dep.receiptNumber || dep.invoiceRef || '—',
            { content: 'Deposited Cash to repay Debt', colSpan: 4, styles: { fillColor: [237,233,254], fontStyle:'italic', halign:'center', textColor:[88,28,135] } },
            '—',
            fmt(parseFloat(dep.amount)),
            fmt(Math.abs(row.runningBalance)),
          ]);
        } else {
          const sale  = row.sale;
          const items = sale.items && sale.items.length > 0 ? sale.items : [null];
          const rawTs = sale.date || sale.timestamp || sale.createdAt;
          const sDate = rawTs ? (rawTs.seconds ? new Date(rawTs.seconds*1000) : new Date(rawTs)) : null;
          const sDateStr = sDate ? sDate.toLocaleDateString('en-GB') : 'N/A';
          const sTimeStr = sale.isUnrecorded ? 'UNRECORDED' : (sDate ? sDate.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true}) : 'N/A');

          items.forEach((item, idx) => {
            if (idx === 0) {
              tableBody.push([
                sDateStr, sTimeStr,
                sale.invoiceRef || sale.notes || '—',
                item ? (item.name || 'N/A') : 'N/A',
                item ? String(item.quantity ?? item.qty ?? 0) : '—',
                item ? fmt(item.price || 0) : '—',
                item ? fmt(item.subtotal || (item.price||0)*(item.quantity||item.qty||0)) : '—',
                fmt(sale.total || sale.total_amount || 0),
                '—',
                fmt(Math.abs(row.runningBalance)),
              ]);
            } else {
              tableBody.push([
                '', '', '',
                item ? (item.name || 'N/A') : 'N/A',
                item ? String(item.quantity ?? item.qty ?? 0) : '—',
                item ? fmt(item.price || 0) : '—',
                item ? fmt(item.subtotal || (item.price||0)*(item.quantity||item.qty||0)) : '—',
                '', '', '',
              ]);
            }
          });
        }
      });

      if (tableBody.length === 0) {
        tableBody.push([{ content: 'No history yet', colSpan: 10, styles: { halign: 'center', textColor: [150,150,150] } }]);
      }

      // ── 6. Draw table via autoTable ───────────────────────────────────────
      pdf.autoTable({
        startY: y,
        head:   tableHead,
        body:   tableBody,
        margin: { left: margin, right: margin },
        styles: {
          fontSize: 7,
          cellPadding: 2,
          overflow: 'linebreak',
          valign: 'middle',
        },
        headStyles: {
          fillColor: [102, 126, 234],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize:  7,
          halign: 'center',
        },
        alternateRowStyles: { fillColor: [248, 248, 252] },
        columnStyles: {
          0: { cellWidth: 20, halign: 'center' },  // Date
          1: { cellWidth: 18, halign: 'center' },  // Time
          2: { cellWidth: 14, halign: 'center' },  // Ref
          3: { cellWidth: 36, halign: 'left'   },  // Item
          4: { cellWidth: 10, halign: 'center' },  // Qty
          5: { cellWidth: 18, halign: 'center' },  // Price
          6: { cellWidth: 20, halign: 'center' },  // Subtotal
          7: { cellWidth: 18, halign: 'center' },  // Debit
          8: { cellWidth: 18, halign: 'center' },  // Credit
          9: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },  // Balance
        },
        didParseCell: (data) => {
          // Highlight deposit rows with a light purple tint
          if (data.row.raw?.[3]?.content?.includes?.('Deposited')) {
            data.cell.styles.fillColor = [237, 233, 254];
          }
        },
      });

      // ── 8. Footer ─────────────────────────────────────────────────────────
      pdf.setFontSize(6.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(160, 160, 160);
      pdf.text('Kadaele Services — Confidential Debt Statement', pageW / 2, pageH - 6, { align: 'center' });

      return pdf;
    } catch (err) {
      console.error('PDF generation error:', err);
      return null;
    }
  };

  // ── Save PDF and return a Blob URL or Capacitor URI ───────────────────────
  const savePDFAndGetURI = async (pdf, debtorName) => {
    const fileName = `statement_${debtorName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
    const pdfBlob  = pdf.output('blob');

    // On native Android, write to cache directory via Capacitor Filesystem
    const isNative = window.Capacitor?.isNativePlatform?.();
    if (isNative) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const reader = new FileReader();
        const base64 = await new Promise((res, rej) => {
          reader.onload  = () => res(reader.result.split(',')[1]);
          reader.onerror = rej;
          reader.readAsDataURL(pdfBlob);
        });
        await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
        const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
        return { uri, fileName, blob: pdfBlob };
      } catch (err) {
        console.error('Capacitor Filesystem error:', err);
      }
    }

    // On web: create an object URL so we can trigger a download
    const blobUrl = URL.createObjectURL(pdfBlob);
    return { uri: blobUrl, fileName, blob: pdfBlob, isWeb: true };
  };

  // ── Share PDF via native Share Sheet ─────────────────────────────────────
  const handleSharePDF = async () => {
    if (!selectedDebtor) return;
    const debtorName = selectedDebtor.name || selectedDebtor.customerName || 'debtor';
    setPdfSharing(true);
    try {
      const pdf = await generateA4PDF();
      if (!pdf) throw new Error('PDF generation failed');
      const fileName = `statement_${debtorName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
      const isNative = window.Capacitor?.isNativePlatform?.();
      if (isNative) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        const base64 = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload  = () => res(reader.result.split(',')[1]);
          reader.onerror = rej;
          reader.readAsDataURL(pdf.output('blob'));
        });
        await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
        const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
        await Share.share({
          title: `${debtorName} – Debt Statement`,
          text: `Debt statement for ${debtorName}`,
          url: uri,
          dialogTitle: `Share statement with ${debtorName}`,
        });
      } else {
        // Web fallback: download PDF
        const blob = pdf.output('blob');
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl; link.download = fileName;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      }
    } catch (err) {
      console.error('PDF share error:', err);
      alert('Failed to generate or share PDF. Please try again.');
    } finally {
      setPdfSharing(false);
    }
  };

  const handleNotify = async (method) => {
    const debtor = selectedDebtor;
    const { subject, body } = buildNotifyMessage();
    const debtorName = debtor.name || debtor.customerName || 'debtor';

    // Close notify modal right away
    setShowNotifyModal(false);

    if (method === 'whatsapp') {
      const phone = debtor.whatsapp || debtor.phone || debtor.customerPhone;
      if (!phone) { alert('No WhatsApp number available'); return; }
      const clean = phone.replace(/\D/g, '');
      const waUrl = `https://wa.me/${clean}?text=${encodeURIComponent(body)}`;
      window.open(waUrl, '_blank');

    } else if (method === 'email') {
      const email = debtor.email;
      if (!email) { alert('No email address available'); return; }
      window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    } else if (method === 'sms') {
      const phone = debtor.phone || debtor.customerPhone;
      if (!phone) { alert('No phone number available'); return; }
      const sep = /iphone|ipad|ipod/i.test(navigator.userAgent) ? '&' : '?';
      window.location.href = `sms:${phone}${sep}body=${encodeURIComponent(body)}`;
    }
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
    if (!receiptNumber.trim()) { alert('Please enter a Receipt Number'); return; }
    try {
      await dataService.recordPayment(selectedDebtor.id, parseFloat(paymentAmount), [], paymentPhoto || null, receiptNumber.trim());
      alert(`Payment of ${fmt(parseFloat(paymentAmount))} recorded`);
      await loadDebtors();
      const updated = (await dataService.getDebtors()).find(d => d.id === selectedDebtor.id);
      if (updated) {
        setSelectedDebtor(updated);
        // Refresh debt history to show new deposit row
        const allSales = await dataService.getSales();
        setDebtorSales(allSales.filter(s => updated.saleIds?.includes(s.id) || updated.purchaseIds?.includes(s.id)));
      }
      setShowPaymentModal(false); setPaymentAmount(''); setPaymentPhoto(null); setReceiptNumber('');
    } catch (e) { console.error(e); alert('Failed to record payment'); }
  };

  const formatDate = (ts) => {
    if (!ts) return 'N/A';
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return isNaN(d) ? 'Invalid' : d.toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' });
  };
  // formatTime: pass the full sale/deposit object so we can check isUnrecorded
  const formatTime = (ts, record) => {
    if (record?.isUnrecorded) return 'UNRECORDED';
    if (!ts) return 'N/A';
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return isNaN(d) ? 'Invalid' : d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true });
  };

  // ── Build merged history rows: interleave sales + deposit rows, then compute
  //    running balance after each event. Sorted oldest → newest.
  const handleSaveDepositEdit = async () => {
    if (!editDepositModal) return;
    const amount = parseFloat(editDepositAmount);
    if (!amount || amount <= 0) { alert('Enter a valid amount.'); return; }
    setSavingDeposit(true);
    try {
      const debtors = await dataService.getDebtors();
      const debtor = debtors.find(d => d.id === editDepositModal.debtorId);
      if (!debtor) throw new Error('Debtor not found');
      const dep = debtor.deposits?.find(d => d.id === editDepositModal.deposit.id);
      if (!dep) throw new Error('Deposit not found');
      const oldAmount = parseFloat(dep.amount) || 0;
      const diff = amount - oldAmount;
      dep.amount = amount;
      if (editDepositReceipt.trim()) dep.receiptNumber = editDepositReceipt.trim();
      debtor.totalPaid = (debtor.totalPaid || 0) + diff;
      debtor.balance = (debtor.totalDue || 0) - debtor.totalPaid;
      if (debtor.balance < 0) debtor.balance = 0;
      await dataService.setDebtors(debtors);
      setSelectedDebtor({...debtor});
      setEditDepositModal(null); setEditDepositReceipt('');
      await loadDebtors();
    } catch(e) { alert(e.message); }
    finally { setSavingDeposit(false); }
  };

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
        <div className="d-sort-wrapper" ref={sortMenuRef}>
          <button className={`d-sort-btn${sortOrder ? ' d-sort-active' : ''}`} onClick={() => setShowSortMenu(v => !v)} title="Sort">
            <ArrowUpDown size={16} />
          </button>
          {showSortMenu && (
            <div className="d-sort-menu">
              {SORT_OPTIONS.map(opt => (
                <button key={opt.key}
                  className={`d-sort-option${sortOrder === opt.key ? ' d-sort-option-active' : ''}`}
                  onClick={() => { setSortOrder(sortOrder === opt.key ? null : opt.key); setShowSortMenu(false); }}>
                  {opt.label}
                </button>
              ))}
              {sortOrder && (
                <button className="d-sort-option d-sort-clear" onClick={() => { setSortOrder(null); setShowSortMenu(false); }}>
                  ✕ Clear Sort
                </button>
              )}
            </div>
          )}
        </div>
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
              <div className="d-card-balance">{fmt((debtor.balance || debtor.totalDue || 0))}</div>
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
                      <span className="d-debt-amount">{fmt((historyRows.length > 0 ? historyRows[0].runningBalance : (selectedDebtor.balance || selectedDebtor.totalDue || 0)))}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Debt History tab ── */}
            {activeTab === 'history' && (
              <div className="d-history-wrapper" ref={historyRef} style={{position:'relative'}}>
                <div className="d-history-actions">
                  <button className="d-notify-btn" onClick={() => setShowNotifyModal(true)}>
                    <MessageSquare size={16} /> Notify
                  </button>

                  <button
                    className="d-pdf-btn"
                    onClick={handleSharePDF}
                    disabled={pdfSharing}
                    title="Generate & share PDF statement"
                  >
                    <FileText size={16} /> {pdfSharing ? 'Generating…' : 'PDF'}
                  </button>

                  <button className="d-deposit-btn" onClick={() => setShowPaymentModal(true)}>
                    <DollarSign size={16} /> Deposit
                  </button>
                </div>

                {/* ── Edit Deposit Modal ── */}
                {editDepositModal && (
                  <div className="d-overlay" style={{zIndex:4000}} onClick={() => { setEditDepositModal(null); setEditDepositReceipt(''); }}>
                    <div className="d-modal d-modal-sm" onClick={e => e.stopPropagation()} style={{maxWidth:'320px'}}>
                      <div className="d-modal-header">
                        <h2 className="d-modal-title">Edit Deposit</h2>
                        <button className="d-close-btn" onClick={() => { setEditDepositModal(null); setEditDepositReceipt(''); }}><X size={22}/></button>
                      </div>
                      <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:'12px'}}>
                        <label style={{fontWeight:600,fontSize:'13px'}}>Deposit Amount</label>
                        <input type="number" min="0.01" step="0.01"
                          value={editDepositAmount}
                          onChange={e => setEditDepositAmount(e.target.value)}
                          style={{padding:'10px',border:'1.5px solid #ccc',borderRadius:'8px',fontSize:'14px'}} />
                        <label style={{fontWeight:600,fontSize:'13px'}}>Receipt Number</label>
                        <input type="text"
                          value={editDepositReceipt}
                          onChange={e => setEditDepositReceipt(e.target.value)}
                          placeholder="Receipt number…"
                          style={{padding:'10px',border:'1.5px solid #ccc',borderRadius:'8px',fontSize:'14px'}} />
                      </div>
                      <div className="d-form-actions" style={{padding:'0 20px 20px',display:'flex',gap:'10px'}}>
                        <button className="d-btn-cancel" onClick={() => { setEditDepositModal(null); setEditDepositReceipt(''); }}>Cancel</button>
                        <button className="d-btn-save" onClick={handleSaveDepositEdit} disabled={savingDeposit}>
                          {savingDeposit ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="d-history-scroll">
                  <table className="d-history-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Ref</th>
                        <th>Image</th>
                        <th>QTY</th>
                        <th>PRODUCT</th>
                        <th>Selling Price</th>
                        <th>Subtotal</th>
                        <th>Debit</th>
                        <th>Credit</th>
                        <th>Balance</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyRows.length === 0 ? (
                        <tr><td colSpan="12" className="d-empty-cell">No history yet</td></tr>
                      ) : (
                        historyRows.map((row, rowIdx) => {
                          if (row.kind === 'deposit') {
                            // ── Deposit row ─────────────────────────────────
                            const dep = row.deposit;
                            return (
                              <tr key={`dep-${dep.id}`} className="d-deposit-row">
                                <td className="d-merged">{formatDate(dep.date)}</td>
                                <td className="d-merged">{formatTime(dep.date, dep)}</td>
                                <td className="d-merged">{dep.receiptNumber || dep.invoiceRef || '—'}</td>
                                <td className="d-merged">—</td>
                                {/* Merged grey cell spanning item/qty/price/subtotal/sale-total */}
                                <td colSpan="5" className="d-deposit-merged-cell">
                                  D&nbsp;e&nbsp;p&nbsp;o&nbsp;s&nbsp;i&nbsp;t&nbsp;e&nbsp;d&nbsp;&nbsp;&nbsp;
                                  C&nbsp;a&nbsp;s&nbsp;h&nbsp;&nbsp;&nbsp;t&nbsp;o&nbsp;&nbsp;&nbsp;
                                  r&nbsp;e&nbsp;p&nbsp;a&nbsp;y&nbsp;&nbsp;&nbsp;
                                  D&nbsp;e&nbsp;b&nbsp;t
                                </td>
                                <td className="d-deposited-amount">{fmt(parseFloat(dep.amount))}</td>
                                <td className={`d-balance-cell ${row.runningBalance < 0 ? 'd-balance-neg' : ''}`}>
                                  {fmt(Math.abs(row.runningBalance))}
                                </td>
                                <td className="d-merged" style={{textAlign:'center'}}>
                                  {isDepositEditable(dep) && (
                                    <button
                                      onClick={() => { setEditDepositModal({debtorId:selectedDebtor.id, deposit:dep}); setEditDepositAmount(String(dep.amount)); setEditDepositReceipt(dep.receiptNumber || ''); }}
                                      style={{background:'none',border:'none',cursor:'pointer',color:'#22c55e',padding:'4px',borderRadius:'4px',display:'inline-flex',alignItems:'center',fontSize:'16px'}}
                                      title="Edit deposit">✔</button>
                                  )}
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
                              {idx === 0 && <td rowSpan={rowSpan} className="d-merged">{formatTime(rawTs, sale)}</td>}
                              {idx === 0 && <td rowSpan={rowSpan} className="d-merged">{sale.invoiceRef || sale.notes || '—'}</td>}
                              {idx === 0 && (
                                <td rowSpan={rowSpan} className="d-merged d-img-cell">
                                  {sale.photoUrl ? (
                                    <img
                                      src={sale.photoUrl}
                                      alt="Credit book"
                                      className="d-hist-thumb"
                                      onClick={() => setEnlargedPhoto(sale.photoUrl)}
                                      title="Click to enlarge"
                                    />
                                  ) : '—'}
                                </td>
                              )}
                              <td className="d-qty">{item ? (item.quantity || item.qty || 0) : '—'}</td>
                              <td>{item ? (item.name || 'N/A') : 'N/A'}</td>
                              <td>{item ? fmt(item.price || 0) : '0.00'}</td>
                              <td>{item ? fmt(item.subtotal || (item.price||0)*(item.quantity||item.qty||0)) : '0.00'}</td>
                              {idx === 0 && <td rowSpan={rowSpan} className="d-merged d-sale-total">{fmt((sale.total || sale.total_amount || 0))}</td>}
                              {idx === 0 && <td rowSpan={rowSpan} className="d-merged">—</td>}
                              {idx === 0 && (
                                <td rowSpan={rowSpan} className={`d-merged d-balance-cell ${row.runningBalance < 0 ? 'd-balance-neg' : ''}`}>
                                  {fmt(Math.abs(row.runningBalance))}
                                </td>
                              )}
                              {idx === 0 && (
                                <td rowSpan={rowSpan} className="d-merged" style={{ textAlign:'center' }}>
                                  {isWithin30Mins(sale) ? (
                                    <button onClick={() => setEditSale(sale)}
                                      style={{ background:'none', border:'none', cursor:'pointer', color:'#22c55e', padding:'4px', borderRadius:'4px', display:'inline-flex', alignItems:'center', fontSize:'16px' }}
                                      title="Edit sale">✔</button>
                                  ) : null}
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
              <div className="d-form-group">
                <label>Receipt Number *</label>
                <input type="text" value={receiptNumber} placeholder="Enter receipt number"
                  onChange={e => setReceiptNumber(e.target.value)} className="d-payment-input" />
              </div>
              <button className="d-camera-btn" onClick={handleTakePhoto}>
                <Camera size={18} /> {paymentPhoto ? 'Retake Photo' : 'Take Receipt Photo'}
              </button>
              {paymentPhoto && <img className="d-photo-preview" src={paymentPhoto} alt="Receipt" />}
              <div className="d-form-actions">
                <button className="d-btn-cancel" onClick={() => { setShowPaymentModal(false); setReceiptNumber(''); }}>Cancel</button>
                <button className="d-btn-save" onClick={handleRecordPayment}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Notify Modal ── */}
      {showNotifyModal && (
        <div className="d-overlay" onClick={() => setShowNotifyModal(false)}>
          <div className="d-modal d-modal-sm d-notify-modal" onClick={e => e.stopPropagation()}>
            <div className="d-modal-header" style={{ flexShrink: 0 }}>
              <h2 className="d-modal-title">Notify via</h2>
              <button className="d-close-btn" onClick={() => setShowNotifyModal(false)}><X size={22} /></button>
            </div>
            <div className="d-notify-options" style={{ flexShrink: 0 }}>
              <button className="d-notify-opt d-notify-wa"  onClick={() => handleNotify('whatsapp')}>
                <MessageSquare size={20}/> WhatsApp
              </button>
              <button className="d-notify-opt d-notify-em"  onClick={() => handleNotify('email')}>
                <Mail size={20}/> Email
              </button>
              <button className="d-notify-opt d-notify-sms" onClick={() => handleNotify('sms')}>
                <Phone size={20}/> SMS
              </button>
            </div>
            <div className="d-notify-preview d-notify-preview-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <p className="d-notify-preview-label">Message Preview</p>
              <pre className="d-notify-preview-text" style={{whiteSpace:'pre-wrap',fontFamily:'inherit',fontSize:'inherit',margin:0}}>
                {selectedDebtor ? buildNotifyMessage().body : ''}
              </pre>
            </div>
          </div>
        </div>
      )}
      {/* ── Enlarged Photo Modal ── */}
      {enlargedPhoto && (
        <div className="d-overlay" onClick={() => setEnlargedPhoto(null)} style={{zIndex:5000}}>
          <div style={{maxWidth:'95vw',maxHeight:'90vh',display:'flex',flexDirection:'column',alignItems:'center',gap:'12px'}}>
            <img src={enlargedPhoto} alt="Credit book" style={{maxWidth:'100%',maxHeight:'80vh',borderRadius:'8px',objectFit:'contain'}} />
            <button onClick={() => setEnlargedPhoto(null)} style={{padding:'10px 24px',background:'white',border:'none',borderRadius:'8px',fontWeight:700,cursor:'pointer',fontSize:'15px'}}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Edit Sale Modal (2-hour window) ── */}
      {editSale && (
        <SaleEditModal
          sale={editSale}
          fmt={fmt}
          onSave={async () => {
            setEditSale(null);
            const sales = await dataService.getSales();
            setDebtorSales(sales.filter(s => (s.customer_name||s.customerName) === (selectedDebtor?.name||selectedDebtor?.customerName)));
          }}
          onDeleted={async () => {
            setEditSale(null);
            const sales = await dataService.getSales();
            setDebtorSales(sales.filter(s => (s.customer_name||s.customerName) === (selectedDebtor?.name||selectedDebtor?.customerName)));
          }}
          onClose={() => setEditSale(null)}
        />
      )}
    </div>
  );
}

export default Debtors;
