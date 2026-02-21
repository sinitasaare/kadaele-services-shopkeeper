import React, { useState, useEffect } from 'react';
import {
  Globe, Moon, Sun, Bell,
  ClipboardList, Wallet, X, Check,
} from 'lucide-react';
import dataService from '../services/dataService';
import './Settings.css';

// ─────────────────────────────────────────────────────────────
// Translations (English + Kiribati only)
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
    items: 'Items',
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
  ki: {
    title: 'Rongorongo',
    language: 'Te Taetae',
    appearance: 'Aonteaba ma Karaoan',
    darkMode: 'Rotinaki',
    lightMode: 'Karaoan',
    notifications: 'Rongorongo ni Kaungaaki',
    notifDebtReminder: 'Kaungaaki n Otinaomata',
    notifDebtReminderDesc: 'Kaungaaki te aomata i mwain bong ni uota',
    notifLowStock: 'Kaungaaki ni Bwai',
    notifLowStockDesc: 'Kaungaaki ngkana 5 te bwai i nanon te ruu',
    notifDailySales: 'Kaungaaki ni Boraoi',
    notifDailySalesDesc: 'Kaungaaki ngkana e roko $500 ni boraoi',
    forgottenEntries: 'Katinanikaki ni Boraoi',
    forgottenEntriesNote: 'Katinanikaki ni Boraoi ao e kona n reke ikai.',
    forgottenSale: 'Boraoi ae Makuri (Akawa)',
    forgottenSaleDesc: 'Katikui boraoi are e nakoraoi ma bong ni makuri',
    forgottenCash: 'Katinanikaki n Amwarake',
    forgottenCashDesc: 'Katikui amwarake are e nakoraoi ma bong ni makuri',
    cancel: 'Tabekuna',
    saleDate: 'Bong ni Boraoi',
    cashDate: 'Bong ni Katibu',
    addItem: 'Kamanoia Bwai',
    items: 'Bwai',
    total: 'Katoa',
    paymentType: 'Mwakuri ni Uota',
    cash: 'Amwarake',
    credit: 'Otinaomata',
    description: 'Rongorongo',
    amount: 'Tataro',
    type: 'Mwakuri',
    cashIn: 'Amwarake Roko',
    cashOut: 'Amwarake Nako',
    recordSale: 'Katikui Boraoi',
    recordCredit: 'Katikui Otinaomata',
    recordCash: 'Katikui Katibu',
    qty: 'Ootan',
    searchItem: 'Ukoukoa bwai…',
    debtorName: 'Aran te Aomata',
    repayDate: 'Bong ni Uota',
    selectDebtor: 'Rinea te aomata…',
    systemStartHint: 'Bong ni mwakuri n am taibora naba.',
  },
};

const LANG_NAMES = { en: 'English', ki: 'Kiribati' };

// ── Helpers ────────────────────────────────────────────────────────────────
const dateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

// Gets yesterday's date string (the latest selectable date for forgotten records)
const yesterdayStr = () => {
  const d = new Date(); d.setDate(d.getDate() - 1); return dateStr(d);
};

// Gets the system start date from localforage (the date the app was first used).
// First use = the date the earliest sale or cash entry was recorded.
// Falls back to yesterday if no records exist.
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
    ]
      .filter(Boolean)
      .map(d => new Date(d).getTime())
      .filter(t => !isNaN(t));

    if (allDates.length === 0) return yesterdayStr();

    const earliest = new Date(Math.min(...allDates));
    const result = dateStr(earliest);
    localStorage.setItem('ks_system_start_date', result);
    return result;
  } catch {
    return yesterdayStr();
  }
};

// ─────────────────────────────────────────────────────────────
// Unrecorded Sales Modal
// Only dates BEFORE system start date are selectable.
// Cash view → 'Record Sale' button; Credit view → 'Record Credit' button.
// ─────────────────────────────────────────────────────────────
function ForgottenSaleModal({ t, onClose, onSaved }) {
  const [goods, setGoods]         = useState([]);
  const [debtors, setDebtors]     = useState([]);
  const [saleDate, setSaleDate]   = useState('');
  const [payType, setPayType]     = useState('cash');
  const [cart, setCart]           = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [debtorId, setDebtorId]   = useState('');
  const [repayDate, setRepayDate] = useState('');
  const [saving, setSaving]       = useState(false);
  const [maxDate, setMaxDate]     = useState(yesterdayStr()); // latest selectable date

  useEffect(() => {
    dataService.getGoods().then(g => setGoods(g || []));
    dataService.getDebtors().then(d => setDebtors(d || []));
    // Compute system start date → yesterday before that is the max selectable
    getSystemStartDate().then(startDate => {
      // Max date is one day BEFORE the system start date
      const d = new Date(startDate);
      d.setDate(d.getDate() - 1);
      setMaxDate(dateStr(d));
    });
  }, []);

  const smartSearch = (term) => {
    if (!term.trim()) return [];
    const t2 = term.toLowerCase();
    return goods.filter(g => {
      const w = (g.name || '').toLowerCase().split(/\s+/);
      return w[0]?.startsWith(t2) || (w[1] && w[1].startsWith(t2));
    }).slice(0, 8);
  };
  const searchResults = smartSearch(searchTerm);

  const addToCart = (good) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === good.id);
      return ex ? prev.map(i => i.id === good.id ? { ...i, qty: i.qty + 1 } : i)
                : [...prev, { ...good, qty: 1 }];
    });
    setSearchTerm(''); setShowSearch(false);
  };
  const updateQty = (id, qty) => {
    const q = parseInt(qty, 10);
    if (isNaN(q) || q < 1) return;
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: q } : i));
  };
  const removeItem = (id) => setCart(prev => prev.filter(i => i.id !== id));
  const total = cart.reduce((s, i) => s + (i.price || 0) * i.qty, 0);

  const handleSave = async () => {
    if (!saleDate) { alert('Please select a sale date.'); return; }
    if (cart.length === 0) { alert('Please add at least one item.'); return; }
    if (payType === 'credit' && !debtorId) { alert('Please select a debtor.'); return; }
    if (payType === 'credit' && !repayDate) { alert('Please enter a repayment date.'); return; }
    setSaving(true);
    try {
      const debtor = debtors.find(d => d.id === debtorId);

      // For cash sales: store in sales record + auto-adds FORGOTTEN cash entry via addSale
      // For credit sales: store in sales record + updates debtor record
      await dataService.addSale({
        items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.qty, subtotal: i.price * i.qty })),
        total,
        paymentType: payType,
        customerName: debtor?.name || debtor?.customerName || '',
        customerPhone: debtor?.phone || '',
        debtorId: payType === 'credit' ? debtorId : null,
        repaymentDate: payType === 'credit' ? repayDate : '',
        isDebt: payType === 'credit',
        date: new Date(saleDate).toISOString(),
        isUnrecorded: true,  // ← TIME column shows 'FORGOTTEN' in tables
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

          {/* Date — only before system start date */}
          <div className="st-field">
            <label>{t.saleDate} *</label>
            <input type="date" max={maxDate} value={saleDate}
              onChange={e => setSaleDate(e.target.value)} className="st-input" />
            <span className="st-field-hint">{t.systemStartHint}</span>
          </div>

          {/* Payment type toggle */}
          <div className="st-field">
            <label>{t.paymentType}</label>
            <div className="st-toggle-row">
              {['cash','credit'].map(p => (
                <button key={p} className={`st-toggle-btn${payType===p?' st-active':''}`}
                  onClick={() => { setPayType(p); }}>
                  {p === 'cash' ? t.cash : t.credit}
                </button>
              ))}
            </div>
          </div>

          {/* Debtor fields (credit only) */}
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
                <input type="date" className="st-input" value={repayDate}
                  onChange={e => setRepayDate(e.target.value)} />
              </div>
            </>
          )}

          {/* Item search */}
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
                    <span className="st-search-price">${(g.price||0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart */}
          {cart.length > 0 && (
            <div className="st-cart">
              <div className="st-cart-header">
                <span>{t.items}</span><span>{t.qty}</span><span>Price</span><span></span>
              </div>
              {cart.map(item => (
                <div key={item.id} className="st-cart-row">
                  <span className="st-cart-name">{item.name}</span>
                  <input type="number" className="st-cart-qty" value={item.qty} min="1"
                    onChange={e => updateQty(item.id, e.target.value)} />
                  <span className="st-cart-price">${(item.price * item.qty).toFixed(2)}</span>
                  <button className="st-cart-remove" onClick={() => removeItem(item.id)}>
                    <X size={14}/>
                  </button>
                </div>
              ))}
              <div className="st-cart-total">
                <span>{t.total}</span>
                <span className="st-cart-total-val">${total.toFixed(2)}</span>
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
// Only dates BEFORE system start date are selectable.
// ─────────────────────────────────────────────────────────────
function ForgottenCashModal({ t, onClose, onSaved }) {
  const [cashDate, setCashDate]       = useState('');
  const [cashType, setCashType]       = useState('in');
  const [amount, setAmount]           = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving]           = useState(false);
  const [maxDate, setMaxDate]         = useState(yesterdayStr());

  useEffect(() => {
    getSystemStartDate().then(startDate => {
      const d = new Date(startDate);
      d.setDate(d.getDate() - 1);
      setMaxDate(dateStr(d));
    });
  }, []);

  const handleSave = async () => {
    if (!cashDate) { alert('Please select an entry date.'); return; }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { alert('Please enter a valid amount.'); return; }
    if (!description.trim()) { alert('Please enter a description.'); return; }
    setSaving(true);
    try {
      await dataService.addCashEntry({
        type: cashType,
        amount: amt,
        note: description.trim(),
        date: new Date(cashDate).toISOString(),
        source: 'manual_backdated',
        isUnrecorded: true,  // ← TIME column shows 'FORGOTTEN' in Cash Record
      });
      onSaved();
    } catch (e) { console.error(e); alert('Failed to save. Please try again.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="st-modal-overlay">
      <div className="st-modal st-modal-sm">
        <div className="st-modal-header">
          <h3>{t.forgottenCash}</h3>
          <button className="st-modal-close" onClick={onClose}><X size={20}/></button>
        </div>
        <div className="st-modal-body">
          <div className="st-field">
            <label>{t.cashDate} *</label>
            <input type="date" max={maxDate} value={cashDate}
              onChange={e => setCashDate(e.target.value)} className="st-input" />
            <span className="st-field-hint">{t.systemStartHint}</span>
          </div>
          <div className="st-field">
            <label>{t.type}</label>
            <div className="st-toggle-row">
              {['in','out'].map(tp => (
                <button key={tp} className={`st-toggle-btn${cashType===tp?' st-active':''}`}
                  onClick={() => setCashType(tp)}>
                  {tp === 'in' ? t.cashIn : t.cashOut}
                </button>
              ))}
            </div>
          </div>
          <div className="st-field">
            <label>{t.amount} *</label>
            <input type="number" className="st-input" placeholder="0.00"
              value={amount} onChange={e => setAmount(e.target.value)} min="0.01" step="0.01" />
          </div>
          <div className="st-field">
            <label>{t.description} *</label>
            <input type="text" className="st-input"
              placeholder={cashType === 'in' ? 'e.g. Cash from supplier' : 'e.g. Paid for supplies'}
              value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </div>
        <div className="st-modal-footer">
          <button className="st-btn-cancel" onClick={onClose}>{t.cancel}</button>
          <button className="st-btn-save" onClick={handleSave} disabled={saving}>
            {saving ? '…' : t.recordCash}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Android-style Setting Row (for Language + Appearance)
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

// ─────────────────────────────────────────────────────────────
// Section wrapper
// ─────────────────────────────────────────────────────────────
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
  const [lang, setLang]         = useState(() => localStorage.getItem('ks_lang') || 'en');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('ks_darkMode') === 'true');
  const [notifDebtReminder, setNotifDebtReminder] = useState(true);
  const [notifLowStock, setNotifLowStock]         = useState(true);
  const [notifDailySales, setNotifDailySales]     = useState(true);
  const [loaded, setLoaded]     = useState(false);
  const [showForgotSale, setShowForgotSale] = useState(false);
  const [showForgotCash, setShowForgotCash] = useState(false);
  const [savedToast, setSavedToast]         = useState('');  // flash message

  const t = T[lang] || T.en;

  // Load settings from localforage on mount
  useEffect(() => {
    dataService.getSettings().then(s => {
      setLang(s.lang || 'en');
      setDarkMode(!!s.darkMode);
      setNotifDebtReminder(s.notifDebtReminder !== false);
      setNotifLowStock(s.notifLowStock !== false);
      setNotifDailySales(s.notifDailySales !== false);
      setLoaded(true);
    });
  }, []);

  // Apply dark mode immediately when it changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Auto-save any setting change to localforage (NOT to Firebase)
  const autoSave = async (updates) => {
    const current = await dataService.getSettings();
    const merged = { ...current, ...updates };
    await dataService.saveSettings(merged);
    if (onSettingsChange) onSettingsChange(merged);
  };

  const handleLang = (code) => {
    setLang(code);
    autoSave({ lang: code });
  };

  const handleDarkMode = (val) => {
    setDarkMode(val);
    autoSave({ darkMode: val });
  };

  const handleToggle = (key, setter, current) => {
    const next = !current;
    setter(next);
    autoSave({ [key]: next });
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

      {/* Auto-save toast */}
      {savedToast && (
        <div className="st-toast"><Check size={16}/> {savedToast}</div>
      )}

      {/* ── Language — Android-style list ── */}
      <Section icon={<Globe size={18}/>} title={t.language}>
        {Object.entries(LANG_NAMES).map(([code, name]) => (
          <SettingRow key={code} label={name}>
            <div
              className={`st-android-radio${lang === code ? ' st-radio-on' : ''}`}
              onClick={() => handleLang(code)}
            >
              <div className="st-radio-dot"/>
            </div>
          </SettingRow>
        ))}
      </Section>

      {/* ── Appearance — Android-style toggle ── */}
      <Section icon={darkMode ? <Moon size={18}/> : <Sun size={18}/>} title={t.appearance}>
        <SettingRow
          label={darkMode ? t.darkMode : t.lightMode}
          desc={darkMode ? 'Dark background, light text' : 'Light background, dark text'}
        >
          <div
            className={`st-switch${darkMode ? ' st-switch-on' : ''}`}
            onClick={() => handleDarkMode(!darkMode)}
          >
            <div className="st-switch-thumb"/>
          </div>
        </SettingRow>
      </Section>

      {/* ── Notifications ── */}
      <Section icon={<Bell size={18}/>} title={t.notifications}>
        {[
          { key: 'notifDebtReminder', val: notifDebtReminder, set: setNotifDebtReminder, label: t.notifDebtReminder, desc: t.notifDebtReminderDesc },
          { key: 'notifLowStock',     val: notifLowStock,     set: setNotifLowStock,     label: t.notifLowStock,     desc: t.notifLowStockDesc    },
          { key: 'notifDailySales',   val: notifDailySales,   set: setNotifDailySales,   label: t.notifDailySales,   desc: t.notifDailySalesDesc  },
        ].map(({ key, val, set, label, desc }) => (
          <SettingRow key={key} label={label} desc={desc}>
            <div
              className={`st-switch${val ? ' st-switch-on' : ''}`}
              onClick={() => handleToggle(key, set, val)}
            >
              <div className="st-switch-thumb"/>
            </div>
          </SettingRow>
        ))}
      </Section>

      {/* ── Forgotten Entries — saves to forage + Firebase ── */}
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

      {/* Modals */}
      {showForgotSale && (
        <ForgottenSaleModal t={t}
          onClose={() => setShowForgotSale(false)}
          onSaved={() => { setShowForgotSale(false); flashSaved('Entry saved!'); }}
        />
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
