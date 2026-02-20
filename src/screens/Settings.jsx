import React, { useState, useEffect, useRef } from 'react';
import {
  Globe, Moon, Sun, DollarSign, Bell,
  ClipboardList, Wallet, ChevronDown, ChevronUp, X, Check,
  CreditCard
} from 'lucide-react';
import dataService from '../services/dataService';
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
    currency: 'Currency Symbol',
    notifications: 'Notification Preferences',
    notifDebtReminder: 'Debt reminder',
    notifDebtReminderDesc: 'Remind debtor a day before due date of debt repayment',
    notifLowStock: 'Low stock alert',
    notifLowStockDesc: 'Notify when a product reaches 5 items in stock',
    notifDailySales: 'Daily sales milestone',
    notifDailySalesDesc: 'Notify when daily sales reaches an increment of $500',
    forgottenEntries: 'Enter Forgotten Records',
    forgottenSale: 'Forgotten Cash Sale',
    forgottenSaleDesc: 'Record a past cash sale with a manual date',
    forgottenCredit: 'Forgotten Credit Sale',
    forgottenCreditDesc: 'Record a past credit sale with a manual date',
    forgottenCash: 'Forgotten Cash Entry',
    forgottenCashDesc: 'Record a past cash in/out with a manual date',
    save: 'Save',
    cancel: 'Cancel',
    saved: 'Settings saved!',
    currencies: ['$ — Dollar', '£ — Pound', '€ — Euro', 'A$ — Aust. Dollar', 'KES — Kenyan Shilling', '¥ — Yen / Yuan', 'AUD — Aust. Dollar'],
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
    recordCash: 'Record Entry',
    itemName: 'Item Name',
    price: 'Price',
    qty: 'Qty',
    remove: 'Remove',
    searchItem: 'Search item…',
    debtorName: 'Debtor Name',
    repayDate: 'Repayment Date',
    selectDebtor: 'Select debtor…',
  },
  ki: {
    title: 'Rongorongo',
    language: 'Te Taetae',
    appearance: 'Aonteaba ma Karaoan',
    darkMode: 'Rotinaki',
    lightMode: 'Karaoan',
    currency: 'Te Mwakuri n Amwarake',
    notifications: 'Rongorongo ni Kaungaaki',
    notifDebtReminder: 'Kaungaaki n Otinaomata',
    notifDebtReminderDesc: 'Kaungaaki te aomata i mwain bong ni uota',
    notifLowStock: 'Kaungaaki ni Bwai',
    notifLowStockDesc: 'Kaungaaki ngkana 5 te bwai i nanon te ruu',
    notifDailySales: 'Kaungaaki ni Boraoi',
    notifDailySalesDesc: 'Kaungaaki ngkana e roko $500 ni boraoi',
    forgottenEntries: 'Katinanikaki ni Boraoi',
    forgottenSale: 'Boraoi ae Makuri (Amwarake)',
    forgottenSaleDesc: 'Katikui boraoi are e nakoraoi ma bong ni makuri',
    forgottenCredit: 'Boraoi ae Makuri (Otinaomata)',
    forgottenCreditDesc: 'Katikui boraoi n otinaomata are e nakoraoi',
    forgottenCash: 'Katinanikaki n Amwarake',
    forgottenCashDesc: 'Katikui amwarake are e nakoraoi ma bong ni makuri',
    save: 'Katikui',
    cancel: 'Tabekuna',
    saved: 'A katikuaki!',
    currencies: ['$ — Taara', '£ — Baun', '€ — Euro', 'A$ — Taara n Aotaretia', 'KES — Kenya', '¥ — Yen', 'AUD — Taara n Aotaretia'],
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
    recordCash: 'Katikui Katibu',
    itemName: 'Aran te Bwai',
    price: 'Uaia',
    qty: 'Ootan',
    remove: 'Kabwaia',
    searchItem: 'Ukoukoa bwai…',
    debtorName: 'Aran te Aomata',
    repayDate: 'Bong ni Uota',
    selectDebtor: 'Rinea te aomata…',
  },
  zh: {
    title: '设置',
    language: '语言',
    appearance: '外观与显示',
    darkMode: '深色模式',
    lightMode: '浅色模式',
    currency: '货币符号',
    notifications: '通知偏好',
    notifDebtReminder: '债务提醒',
    notifDebtReminderDesc: '在还款到期日前一天提醒债务人',
    notifLowStock: '库存不足提醒',
    notifLowStockDesc: '当商品库存达到5件时通知',
    notifDailySales: '每日销售里程碑',
    notifDailySalesDesc: '当日销售额每增加500美元时通知',
    forgottenEntries: '补录遗漏记录',
    forgottenSale: '遗漏现金销售',
    forgottenSaleDesc: '手动输入日期记录过去的现金销售',
    forgottenCredit: '遗漏赊账销售',
    forgottenCreditDesc: '手动输入日期记录过去的赊账销售',
    forgottenCash: '遗漏现金记录',
    forgottenCashDesc: '手动输入日期记录过去的现金收支',
    save: '保存',
    cancel: '取消',
    saved: '设置已保存！',
    currencies: ['$ — 美元', '£ — 英镑', '€ — 欧元', 'A$ — 澳元', 'KES — 肯尼亚先令', '¥ — 日元/人民币', 'AUD — 澳大利亚元'],
    saleDate: '销售日期',
    cashDate: '记录日期',
    addItem: '添加商品',
    items: '商品',
    total: '合计',
    paymentType: '支付方式',
    cash: '现金',
    credit: '赊账',
    description: '描述',
    amount: '金额',
    type: '类型',
    cashIn: '现金收入',
    cashOut: '现金支出',
    recordSale: '记录销售',
    recordCash: '记录现金',
    itemName: '商品名称',
    price: '价格',
    qty: '数量',
    remove: '删除',
    searchItem: '搜索商品…',
    debtorName: '债务人姓名',
    repayDate: '还款日期',
    selectDebtor: '选择债务人…',
  },
};

const LANG_NAMES = { en: 'English', ki: 'Kiribati', zh: '中文' };
const CURRENCY_SYMBOLS = ['$', '£', '€', 'A$', 'KES', '¥', 'AUD'];

// ─────────────────────────────────────────────────────────────
// Forgotten Sale Modal
// ─────────────────────────────────────────────────────────────
function ForgottenSaleModal({ t, onClose, onSaved }) {
  const [goods, setGoods]           = useState([]);
  const [debtors, setDebtors]       = useState([]);
  const [saleDate, setSaleDate]     = useState('');
  const [payType, setPayType]       = useState('cash');
  const [cart, setCart]             = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [debtorId, setDebtorId]     = useState('');
  const [repayDate, setRepayDate]   = useState('');
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    dataService.getGoods().then(g => setGoods(g || []));
    dataService.getDebtors().then(d => setDebtors(d || []));
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
    if (!saleDate) { alert('Please enter the sale date.'); return; }
    if (cart.length === 0) { alert('Please add at least one item.'); return; }
    if (payType === 'credit' && !debtorId) { alert('Please select a debtor.'); return; }
    if (payType === 'credit' && !repayDate) { alert('Please enter a repayment date.'); return; }
    setSaving(true);
    try {
      const debtor = debtors.find(d => d.id === debtorId);
      await dataService.addSale({
        items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.qty, subtotal: i.price * i.qty })),
        total,
        paymentType: payType,
        customerName: debtor?.name || debtor?.customerName || '',
        customerPhone: debtor?.phone || '',
        debtorId: payType === 'credit' ? debtorId : null,
        repaymentDate: payType === 'credit' ? repayDate : '',
        isDebt: payType === 'credit',
        manualDate: saleDate,
        date: new Date(saleDate).toISOString(),
      });
      onSaved();
    } catch (e) { console.error(e); alert('Failed to save. Please try again.'); }
    finally { setSaving(false); }
  };

  const todayStr = () => {
    const d = new Date(); 
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  return (
    <div className="st-modal-overlay">
      <div className="st-modal">
        <div className="st-modal-header">
          <h3>{t.forgottenSale}</h3>
          <button className="st-modal-close" onClick={onClose}><X size={20}/></button>
        </div>
        <div className="st-modal-body">

          {/* Date */}
          <div className="st-field">
            <label>{t.saleDate} *</label>
            <input type="date" max={todayStr()} value={saleDate}
              onChange={e => setSaleDate(e.target.value)} className="st-input" />
          </div>

          {/* Payment type */}
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

          {/* Debtor (credit only) */}
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
                  <div key={g.id} className="st-search-item"
                    onMouseDown={() => addToCart(g)}>
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
                <span>{t.items}</span><span>{t.qty}</span>
                <span>{t.price}</span><span></span>
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
            {saving ? '…' : t.recordSale}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Forgotten Cash Entry Modal
// ─────────────────────────────────────────────────────────────
function ForgottenCashModal({ t, onClose, onSaved }) {
  const [cashDate, setCashDate]       = useState('');
  const [cashType, setCashType]       = useState('in');
  const [amount, setAmount]           = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving]           = useState(false);

  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  const handleSave = async () => {
    if (!cashDate) { alert('Please enter the entry date.'); return; }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { alert('Please enter a valid amount.'); return; }
    if (!description.trim()) { alert('Please enter a description.'); return; }
    setSaving(true);
    try {
      await dataService.addCashEntry({
        type: cashType, amount: amt, note: description.trim(),
        date: new Date(cashDate).toISOString(), source: 'manual_backdated',
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
            <input type="date" max={todayStr()} value={cashDate}
              onChange={e => setCashDate(e.target.value)} className="st-input" />
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
// Forgotten Credit Sale Modal
// ─────────────────────────────────────────────────────────────
function ForgottenCreditModal({ t, onClose, onSaved }) {
  const [goods, setGoods]           = useState([]);
  const [debtors, setDebtors]       = useState([]);
  const [saleDate, setSaleDate]     = useState('');
  const [cart, setCart]             = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [debtorId, setDebtorId]     = useState('');
  const [repayDate, setRepayDate]   = useState('');
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    dataService.getGoods().then(g => setGoods(g || []));
    dataService.getDebtors().then(d => setDebtors(d || []));
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

  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  const handleSave = async () => {
    if (!saleDate) { alert('Please enter the sale date.'); return; }
    if (cart.length === 0) { alert('Please add at least one item.'); return; }
    if (!debtorId) { alert('Please select a debtor.'); return; }
    if (!repayDate) { alert('Please enter a repayment date.'); return; }
    setSaving(true);
    try {
      const debtor = debtors.find(d => d.id === debtorId);
      await dataService.addSale({
        items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.qty, subtotal: i.price * i.qty })),
        total,
        paymentType: 'credit',
        customerName: debtor?.name || debtor?.customerName || '',
        customerPhone: debtor?.phone || '',
        debtorId: debtorId,
        repaymentDate: repayDate,
        isDebt: true,
        manualDate: saleDate,
        date: new Date(saleDate).toISOString(),
      });
      onSaved();
    } catch (e) { console.error(e); alert('Failed to save. Please try again.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="st-modal-overlay">
      <div className="st-modal">
        <div className="st-modal-header">
          <h3>{t.forgottenCredit}</h3>
          <button className="st-modal-close" onClick={onClose}><X size={20}/></button>
        </div>
        <div className="st-modal-body">
          <div className="st-field">
            <label>{t.saleDate} *</label>
            <input type="date" max={todayStr()} value={saleDate}
              onChange={e => setSaleDate(e.target.value)} className="st-input" />
          </div>

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
                  <div key={g.id} className="st-search-item"
                    onMouseDown={() => addToCart(g)}>
                    <span>{g.name}</span>
                    <span className="st-search-price">${(g.price||0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <div className="st-cart">
              <div className="st-cart-header">
                <span>{t.items}</span><span>{t.qty}</span>
                <span>{t.price}</span><span></span>
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
            {saving ? '…' : t.recordSale}
          </button>
        </div>
      </div>
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
  const [lang, setLang]             = useState(() => localStorage.getItem('ks_lang') || 'en');
  const [darkMode, setDarkMode]     = useState(() => localStorage.getItem('ks_dark') === 'true');
  const [currency, setCurrency]     = useState(() => localStorage.getItem('ks_currency') || '$');
  const [notifDebtReminder, setNotifDebtReminder] = useState(() => localStorage.getItem('ks_notif_debt_reminder') !== 'false');
  const [notifLowStock, setNotifLowStock]         = useState(() => localStorage.getItem('ks_notif_low_stock') !== 'false');
  const [notifDailySales, setNotifDailySales]     = useState(() => localStorage.getItem('ks_notif_daily_sales') !== 'false');
  const [showSavedMsg, setShowSavedMsg] = useState(false);
  const [showForgotSale, setShowForgotSale]     = useState(false);
  const [showForgotCredit, setShowForgotCredit] = useState(false);
  const [showForgotCash, setShowForgotCash]     = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);

  const t = T[lang] || T.en;

  // Apply dark mode to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const handleSave = () => {
    localStorage.setItem('ks_lang', lang);
    localStorage.setItem('ks_dark', darkMode);
    localStorage.setItem('ks_currency', currency);
    localStorage.setItem('ks_notif_debt_reminder', notifDebtReminder);
    localStorage.setItem('ks_notif_low_stock', notifLowStock);
    localStorage.setItem('ks_notif_daily_sales', notifDailySales);
    setShowSavedMsg(true);
    setTimeout(() => setShowSavedMsg(false), 2500);
    if (onSettingsChange) onSettingsChange({ lang, darkMode, currency });
  };

  const selectedCurrencyLabel = CURRENCY_SYMBOLS.indexOf(currency) >= 0
    ? t.currencies[CURRENCY_SYMBOLS.indexOf(currency)]
    : currency;

  return (
    <div className="st-screen">

      {/* Saved toast */}
      {showSavedMsg && (
        <div className="st-toast">
          <Check size={16}/> {t.saved}
        </div>
      )}

      {/* ── Language ── */}
      <Section icon={<Globe size={18}/>} title={t.language}>
        <div className="st-lang-row">
          {Object.entries(LANG_NAMES).map(([code, name]) => (
            <button key={code}
              className={`st-lang-btn${lang === code ? ' st-lang-active' : ''}`}
              onClick={() => setLang(code)}>
              {name}
            </button>
          ))}
        </div>
      </Section>

      {/* ── Appearance ── */}
      <Section icon={darkMode ? <Moon size={18}/> : <Sun size={18}/>} title={t.appearance}>
        <div className="st-toggle-row">
          <button className={`st-toggle-btn${!darkMode ? ' st-active' : ''}`}
            onClick={() => setDarkMode(false)}>
            <Sun size={14}/> {t.lightMode}
          </button>
          <button className={`st-toggle-btn${darkMode ? ' st-active' : ''}`}
            onClick={() => setDarkMode(true)}>
            <Moon size={14}/> {t.darkMode}
          </button>
        </div>
      </Section>

      {/* ── Currency ── */}
      <Section icon={<DollarSign size={18}/>} title={t.currency}>
        <div className="st-currency-wrapper">
          <button className="st-currency-trigger" onClick={() => setCurrencyOpen(o => !o)}>
            <span className="st-currency-symbol">{currency}</span>
            <span className="st-currency-label">{selectedCurrencyLabel}</span>
            {currencyOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
          </button>
          {currencyOpen && (
            <div className="st-currency-dropdown">
              {CURRENCY_SYMBOLS.map((sym, i) => (
                <button key={sym} className={`st-currency-option${currency===sym?' st-currency-selected':''}`}
                  onClick={() => { setCurrency(sym); setCurrencyOpen(false); }}>
                  <span className="st-currency-sym">{sym}</span>
                  <span>{t.currencies[i]}</span>
                  {currency === sym && <Check size={14} className="st-currency-check"/>}
                </button>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* ── Notifications ── */}
      <Section icon={<Bell size={18}/>} title={t.notifications}>
        <div className="st-notif-row" onClick={() => setNotifDebtReminder(v => !v)}>
          <div className="st-notif-text">
            <span className="st-notif-label">{t.notifDebtReminder}</span>
            <span className="st-notif-desc">{t.notifDebtReminderDesc}</span>
          </div>
          <div className={`st-switch${notifDebtReminder ? ' st-switch-on' : ''}`}>
            <div className="st-switch-thumb"/>
          </div>
        </div>
        <div className="st-notif-row" onClick={() => setNotifLowStock(v => !v)}>
          <div className="st-notif-text">
            <span className="st-notif-label">{t.notifLowStock}</span>
            <span className="st-notif-desc">{t.notifLowStockDesc}</span>
          </div>
          <div className={`st-switch${notifLowStock ? ' st-switch-on' : ''}`}>
            <div className="st-switch-thumb"/>
          </div>
        </div>
        <div className="st-notif-row" onClick={() => setNotifDailySales(v => !v)}>
          <div className="st-notif-text">
            <span className="st-notif-label">{t.notifDailySales}</span>
            <span className="st-notif-desc">{t.notifDailySalesDesc}</span>
          </div>
          <div className={`st-switch${notifDailySales ? ' st-switch-on' : ''}`}>
            <div className="st-switch-thumb"/>
          </div>
        </div>
      </Section>

      {/* ── Forgotten Entries ── */}
      <Section icon={<ClipboardList size={18}/>} title={t.forgottenEntries}>
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
            <span className="st-notif-label">{t.forgottenCredit}</span>
            <span className="st-notif-desc">{t.forgottenCreditDesc}</span>
          </div>
          <button className="st-forgotten-btn st-forgotten-credit"
            onClick={() => setShowForgotCredit(true)}>
            <CreditCard size={16}/> {t.forgottenCredit}
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

      {/* Save button */}
      <div className="st-save-row">
        <button className="st-save-btn" onClick={handleSave}>
          <Check size={18}/> {t.save}
        </button>
      </div>

      {/* Modals */}
      {showForgotSale && (
        <ForgottenSaleModal t={t}
          onClose={() => setShowForgotSale(false)}
          onSaved={() => { setShowForgotSale(false); setShowSavedMsg(true); setTimeout(() => setShowSavedMsg(false), 2500); }}
        />
      )}
      {showForgotCredit && (
        <ForgottenCreditModal t={t}
          onClose={() => setShowForgotCredit(false)}
          onSaved={() => { setShowForgotCredit(false); setShowSavedMsg(true); setTimeout(() => setShowSavedMsg(false), 2500); }}
        />
      )}
      {showForgotCash && (
        <ForgottenCashModal t={t}
          onClose={() => setShowForgotCash(false)}
          onSaved={() => { setShowForgotCash(false); setShowSavedMsg(true); setTimeout(() => setShowSavedMsg(false), 2500); }}
        />
      )}

    </div>
  );
}

export default Settings;

