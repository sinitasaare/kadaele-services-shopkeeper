import React, { useState, useEffect, useRef } from 'react';
import { X, DollarSign, Calendar, Camera, Phone, Mail, MapPin, Edit2, MessageSquare, ArrowUpDown } from 'lucide-react';
import dataService from '../services/dataService';
import html2canvas from 'html2canvas';
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
  const [sortOrder, setSortOrder]       = useState(null);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef                     = useRef(null);
  const historyRef                      = useRef(null);  // ref for debt history section → PDF
  const [pdfGenerating, setPdfGenerating] = useState(false);

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
    const balanceStr = `$${Math.abs(balance).toFixed(2)}`;

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

Please find attached a PDF of the statement with full details of your debt for your reference.

We kindly remind you that ${duePhrasing}, as you had promised to pay by. We appreciate if you could settle it not later than ${dueDateDisplay}.

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

Please find attached a PDF of the statement with full details of your debt for your reference.

We kindly remind you that the due date was ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} ago, as you had promised to pay by.

We appreciate if you could settle it as soon as possible. Thank you for your attention and prompt payment.

Best regards,
Kadaele Services`;
    }

    return { subject, body };
  };

  // ── Generate A4 PDF of the debt statement ────────────────────────────────
  // Uses jsPDF (loaded from CDN via index.html) + html2canvas.
  // The PDF is A4 portrait, with the business logo at the top, debtor info,
  // then the full debt history table rendered at full width.
  const generateA4PDF = async () => {
    const el = historyRef.current;
    if (!el) return null;

    try {
      // 1. Capture the history section as a high-res canvas
      const canvas = await html2canvas(el, {
        backgroundColor: '#ffffff',
        scale: 3,          // high DPI so text is sharp in the PDF
        useCORS: true,
        logging: false,
        // Expand to full scrollWidth so the wide table is not clipped
        windowWidth: el.scrollWidth,
        width: el.scrollWidth,
      });

      const { jsPDF } = window.jspdf;
      if (!jsPDF) throw new Error('jsPDF not loaded');

      // A4 dimensions in mm
      const pageW = 210;
      const pageH = 297;
      const margin = 12;
      const contentW = pageW - margin * 2;

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // ── Header: purple bar with business name ──────────────────────────
      pdf.setFillColor(102, 126, 234);          // brand purple
      pdf.rect(0, 0, pageW, 22, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Kadaele Services', margin, 10);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Debt Statement', margin, 16);

      // Date generated (right side of header)
      const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
      pdf.setFontSize(8);
      pdf.text(`Generated: ${today}`, pageW - margin, 14, { align: 'right' });

      // ── Debtor info block ──────────────────────────────────────────────
      let y = 30;
      const debtor = selectedDebtor;
      const debtorName = debtor.name || debtor.customerName || 'N/A';
      const gender  = debtor.gender || '';
      const prefix  = gender === 'Male' ? 'Mr.' : gender === 'Female' ? 'Ms.' : '';
      const balance = historyRows.length > 0
        ? historyRows[0].runningBalance
        : (debtor.balance || debtor.totalDue || 0);

      pdf.setTextColor(30, 30, 30);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${prefix ? prefix + ' ' : ''}${debtorName}`, margin, y);

      y += 6;
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(80, 80, 80);
      if (debtor.phone || debtor.customerPhone) pdf.text(`Phone: ${debtor.phone || debtor.customerPhone}`, margin, y); y += 5;
      if (debtor.whatsapp) { pdf.text(`WhatsApp: ${debtor.whatsapp}`, margin, y); y += 5; }
      if (debtor.email)    { pdf.text(`Email: ${debtor.email}`, margin, y); y += 5; }
      if (debtor.repaymentDate) { pdf.text(`Due Date: ${debtor.repaymentDate}`, margin, y); y += 5; }

      // Outstanding balance box
      pdf.setFillColor(balance > 0 ? 255 : 220, balance > 0 ? 235 : 252, balance > 0 ? 220 : 231);
      pdf.roundedRect(pageW - margin - 55, 28, 55, 18, 2, 2, 'F');
      pdf.setTextColor(balance > 0 ? 22 : 3, balance > 0 ? 101 : 105, balance > 0 ? 52 : 81);
      pdf.setFontSize(7);
      pdf.text('OUTSTANDING BALANCE', pageW - margin - 27.5, 34, { align: 'center' });
      pdf.setFontSize(13);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`$${Math.abs(balance).toFixed(2)}`, pageW - margin - 27.5, 42, { align: 'center' });

      // Divider
      y = Math.max(y, 50) + 4;
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, y, pageW - margin, y);
      y += 5;

      // ── Debt History table (rendered via html2canvas → image) ─────────
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(50, 50, 50);
      pdf.text('Debt History', margin, y);
      y += 4;

      // Convert canvas to PNG data URL and embed as image
      const imgData  = canvas.toDataURL('image/png');
      const imgW     = contentW;
      const imgH     = (canvas.height / canvas.width) * imgW;

      // If the table is taller than what fits on one page, scale it
      const maxH = pageH - y - margin;
      const finalH = imgH > maxH ? maxH : imgH;

      pdf.addImage(imgData, 'PNG', margin, y, imgW, finalH);

      // ── Footer ────────────────────────────────────────────────────────
      const footerY = pageH - 8;
      pdf.setFontSize(7);
      pdf.setTextColor(150, 150, 150);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Kadaele Services — Confidential Debt Statement', pageW / 2, footerY, { align: 'center' });

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

  const handleNotify = async (method) => {
    const debtor = selectedDebtor;
    const { subject, body } = buildNotifyMessage();
    const debtorName = debtor.name || debtor.customerName || 'debtor';

    // ── Step 1: Generate A4 PDF ───────────────────────────────────────────
    setPdfGenerating(true);
    let pdfInfo = null;
    try {
      const pdf = await generateA4PDF();
      if (pdf) {
        pdfInfo = await savePDFAndGetURI(pdf, debtorName);
        // On web, also trigger a download so the user has the PDF to attach manually
        if (pdfInfo?.isWeb) {
          const link = document.createElement('a');
          link.href = pdfInfo.uri;
          link.download = pdfInfo.fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          // Don't revoke immediately — let the download complete
          setTimeout(() => URL.revokeObjectURL(pdfInfo.uri), 10000);
        }
      }
    } catch (err) {
      console.error('PDF error:', err);
    } finally {
      setPdfGenerating(false);
    }

    // ── Step 2: Open messaging app (with PDF attached if native) ──────────
    const isNative = window.Capacitor?.isNativePlatform?.();

    if (method === 'whatsapp') {
      const phone = debtor.whatsapp || debtor.phone || debtor.customerPhone;
      if (!phone) { alert('No WhatsApp number available'); return; }
      if (isNative && pdfInfo?.uri) {
        try {
          const { Share } = await import('@capacitor/share');
          await Share.share({ title: subject, text: body, url: pdfInfo.uri, dialogTitle: `Send to ${debtorName}` });
          setShowNotifyModal(false);
          return;
        } catch (err) { console.error('Share error:', err); }
      }
      window.open(`https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(body)}`, '_blank');

    } else if (method === 'email') {
      if (!debtor.email) { alert('No email available'); return; }
      if (isNative && pdfInfo?.uri) {
        try {
          const { Share } = await import('@capacitor/share');
          await Share.share({ title: subject, text: body, url: pdfInfo.uri, dialogTitle: `Email to ${debtorName}` });
          setShowNotifyModal(false);
          return;
        } catch (err) { console.error('Share error:', err); }
      }
      window.location.href = `mailto:${debtor.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    } else if (method === 'sms') {
      const phone = debtor.phone || debtor.customerPhone;
      if (!phone) { alert('No phone number available'); return; }
      window.location.href = `sms:${phone}?body=${encodeURIComponent(body)}`;
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
  // formatTime: pass the full sale/deposit object so we can check isUnrecorded
  const formatTime = (ts, record) => {
    if (record?.isUnrecorded) return 'FORGOTTEN';
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
                      <span className="d-debt-amount">${(historyRows.length > 0 ? historyRows[0].runningBalance : (selectedDebtor.balance || selectedDebtor.totalDue || 0)).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Debt History tab ── */}
            {activeTab === 'history' && (
              <div className="d-history-wrapper" ref={historyRef}>
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
                                <td className="d-merged">{formatTime(dep.date, dep)}</td>
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
                              {idx === 0 && <td rowSpan={rowSpan} className="d-merged">{formatTime(rawTs, sale)}</td>}
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
        <div className="d-overlay" onClick={() => !pdfGenerating && setShowNotifyModal(false)}>
          <div className="d-modal d-modal-sm d-notify-modal" onClick={e => e.stopPropagation()}>
            <div className="d-modal-header" style={{ flexShrink: 0 }}>
              <h2 className="d-modal-title">Notify via</h2>
              <button className="d-close-btn" onClick={() => !pdfGenerating && setShowNotifyModal(false)}><X size={22} /></button>
            </div>
            {pdfGenerating && (
              <div style={{ padding: '10px 16px', background: '#fef3c7', borderRadius: '8px', margin: '0 16px 8px',
                fontSize: '13px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>⏳</span>
                Generating statement image, please wait…
              </div>
            )}
            <div className="d-notify-options" style={{ flexShrink: 0 }}>
              <button className="d-notify-opt d-notify-wa"  onClick={() => handleNotify('whatsapp')} disabled={pdfGenerating}>
                <MessageSquare size={20}/> {pdfGenerating ? '…' : 'WhatsApp'}
              </button>
              <button className="d-notify-opt d-notify-em"  onClick={() => handleNotify('email')} disabled={pdfGenerating}>
                <Mail size={20}/> {pdfGenerating ? '…' : 'Email'}
              </button>
              <button className="d-notify-opt d-notify-sms" onClick={() => handleNotify('sms')} disabled={pdfGenerating}>
                <Phone size={20}/> {pdfGenerating ? '…' : 'SMS'}
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
    </div>
  );
}

export default Debtors;
