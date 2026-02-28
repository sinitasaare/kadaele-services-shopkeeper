import React, { useState, useEffect } from 'react';
import { HelpCircle, Menu, X, LogOut, Lock, Unlock } from 'lucide-react';
import { App as CapApp } from '@capacitor/app';
import Checkout from './screens/Checkout';
import SalesRecord from './screens/SalesRecord';
import CashRecord from './screens/CashRecord';
import PurchaseRecord from './screens/PurchaseRecord';
import Debtors from './screens/Debtors';
import Creditors from './screens/Creditors';
import Suppliers from './screens/Suppliers';
import Inventory from './screens/Inventory';
import Settings from './screens/Settings';
import CashReconciliation from './screens/CashReconciliation';
import Login from './components/Login';
import dataService from './services/dataService';
import './App.css';

// ── Apply dark/light mode immediately on load (before React renders) ──────────
(function applyInitialTheme() {
  const dark = localStorage.getItem('ks_darkMode') === 'true';
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();

const PAGES = [
  { 
    name: 'CHECKOUT',   
    component: Checkout,
    helpContent: `
      <h3>Checkout – How to Use</h3>
      <p><strong>This is your main point-of-sale screen for recording every customer sale.</strong></p>

      <h4>Adding Products to Cart</h4>
      <p>Type a product name in the search box at the bottom. Tap a result to open the quantity modal. Enter how many units you are selling and tap <strong>Add to Cart</strong>. The product appears in the cart table above. Tap the × button on any row to remove it.</p>

      <h4>Barcode Scanner</h4>
      <p>Tap the barcode icon next to the search box to open the camera scanner. Point it at a product barcode — if the product exists in Inventory it is added to the cart instantly with a beep. If no match is found the scanner shows the unrecognised barcode so you can search manually.</p>

      <h4>Pay with Cash</h4>
      <p>Tap <strong>Pay with Cash</strong>. A confirmation modal shows the total. Optionally tap <strong>Change Calculator</strong> to enter the amount the customer hands you and see the change due. Tap <strong>Confirm</strong> to save the sale. A Cash IN entry is automatically created in Cash Record.</p>

      <h4>Buy on Credit</h4>
      <p>Tap <strong>Buy on Credit</strong> to sell to a debtor. Select an existing debtor from the dropdown. Set the repayment due date — if the debtor already has an existing due date it will be locked to that date. If a debtor's debt is <strong>overdue</strong>, a red blocking warning appears and you cannot add more credit until their balance is cleared.</p>

      <h4>Out of Stock Warning</h4>
      <p>If a product has zero stock the Add to Cart button is disabled and a warning is shown.</p>

      <h4>Tips</h4>
      <ul>
        <li>The cart total updates automatically as you add or remove products</li>
        <li>Search is instant — no need to press Enter</li>
        <li>All sales are saved locally and synced to the cloud when online</li>
      </ul>
    `
  },
  { 
    name: 'SALES RECORD',     
    component: SalesRecord,
    helpContent: `
      <h3>Sales Record – How to Use</h3>
      <p><strong>View, filter, and manage all your recorded sales transactions.</strong></p>

      <h4>Filtering Sales</h4>
      <p>Tap <strong>Filter Sales</strong> at the top. Choose a <strong>Payment Type</strong> (All, Cash Only, or Credit Only) and a <strong>Date Filter</strong> (Today, Single Date, or Date Range). Tap <strong>Apply Filter</strong> to update the table.</p>

      <h4>Understanding the Table</h4>
      <ul>
        <li><strong>Date & Time:</strong> When the sale was recorded. Sales added via Forgotten Entries show "UNRECORDED" in the Time column.</li>
        <li><strong>QTY:</strong> Total quantity of products sold in that transaction</li>
        <li><strong>Products:</strong> Names of all products in the sale</li>
        <li><strong>Selling Price:</strong> Unit selling price</li>
        <li><strong>Total:</strong> Final amount for the transaction</li>
        <li><strong>Pay/Type:</strong> CASH or CREDIT badge</li>
        <li><strong>Customer:</strong> Customer name (credit sales only)</li>
      </ul>

      <h4>Editing a Sale</h4>
      <p>Within <strong>30 minutes</strong> of recording a sale, a pencil ✏️ icon appears on that row. Tap it to edit the product name, quantity, or price. After 30 minutes the entry is locked.</p>

      <h4>Summary Boxes</h4>
      <p>The summary at the top shows <strong>Total Records</strong> (count of sales in current filter) and <strong>Grand Total</strong> (sum of all filtered sale amounts).</p>

      <h4>Tips</h4>
      <ul>
        <li>Table header stays fixed when you scroll</li>
        <li>Newest sales appear at the top</li>
        <li>Use a date range filter to review sales for any period</li>
      </ul>
    `
  },
  { 
    name: 'CASH RECORD',      
    component: CashRecord,
    helpContent: `
      <h3>Cash Record – How to Use</h3>
      <p><strong>Track every dollar coming in and going out of your business.</strong></p>

      <h4>Opening Balance</h4>
      <p>The first time you open Cash Record you will be asked to set your <strong>Opening Balance</strong> — the cash you already have on hand before any transactions. You can update it any time by tapping the balance amount at the top.</p>

      <h4>Adding a Cash Entry</h4>
      <p>Tap <strong>+ Add Entry</strong>. Choose <strong>Cash IN</strong> (money received) or <strong>Cash OUT</strong> (money spent). Select a description from the dropdown or type your own note. Enter the amount and tap <strong>Save Entry</strong>. For Cash IN you can also record who the money came from. For Cash OUT you can record who was paid.</p>

      <h4>Automatic Entries</h4>
      <p>These are created automatically — you do not need to add them manually:</p>
      <ul>
        <li>Cash sales (not credit sales) from the <strong>CHECKOUT</strong> section automatically create Cash IN entries</li>
        <li>Shop purchases from the <strong>PURCHASE RECORD</strong> section automatically create Cash OUT entries in this section</li>
        <li>Every <strong>cash purchase</strong> in Purchase Record creates a Cash OUT entry</li>
        <li>Every <strong>debtor deposit</strong> (repayment received) creates a Cash IN entry</li>
      </ul>

      <h4>Editing an Entry</h4>
      <p>Within <strong>30 minutes</strong> of adding an entry, tap the row to open an edit modal where you can change the type, amount, or note. You can also delete the entry from this modal. After 30 minutes entries are locked.</p>

      <h4>Filtering</h4>
      <p>Use the filter tabs to view <strong>All Entries</strong>, <strong>Cash In</strong> only, or <strong>Cash Out</strong> only. Apply a date filter (Today, Single Date, or Date Range) to review cash flow for any period.</p>

      <h4>Understanding the Summary</h4>
      <ul>
        <li><strong>Opening Balance:</strong> Starting amount for the period</li>
        <li><strong>Total IN:</strong> All money received in the filtered period</li>
        <li><strong>Total OUT:</strong> All money spent in the filtered period</li>
        <li><strong>Closing Balance:</strong> Opening + IN − OUT</li>
      </ul>

      <h4>Tips</h4>
      <ul>
        <li>Green rows and + amounts are Cash IN; red rows and − amounts are Cash OUT</li>
        <li>Keep descriptions detailed so you can trace every transaction later</li>
      </ul>
    `
  },
  { 
    name: 'PURCHASE RECORD',  
    component: PurchaseRecord,
    helpContent: `
      <h3>Purchase Record – How to Use</h3>
      <p><strong>Record every stock purchase you make from suppliers to restock your shop.</strong></p>

      <h4>Adding a Purchase</h4>
      <p>Tap <strong>+ Add Purchase</strong>. Search for and select a supplier, then choose the purchase date. In the Products table, enter the <strong>QTY</strong>, search and select the <strong>Product</strong>, enter the <strong>pack unit × pack size</strong>, and enter the <strong>Cost Price</strong> set by the supplier. The <strong>Total Cost</strong> is calculated automatically as the sum of (Qty × Unit × Cost Price) for all rows. Tap <strong>+ Add New Product</strong> to add more lines. Optionally add notes (e.g. invoice number) and take a photo of the receipt. Choose <strong>Cash Paid</strong> or <strong>Buy on Credit</strong>, then tap <strong>Save Purchase</strong>.</p>

      <h4>Cash vs Credit Purchases</h4>
      <ul>
        <li><strong>Cash Paid:</strong> A Cash OUT entry is automatically created in Cash Record</li>
        <li><strong>Buy on Credit:</strong> The amount is added to that supplier's balance in Creditors</li>
      </ul>

      <h4>Editing a Purchase</h4>
      <p>Within <strong>30 minutes</strong> of saving, tap any purchase row to open the details view. A pencil ✏️ icon appears — tap it to edit products, quantities, cost prices, or notes. After 30 minutes the record is locked.</p>

      <h4>Filtering Purchases</h4>
      <p>Use the filter button to view by <strong>Payment Type</strong> (All, Cash, or Credit) and <strong>Date</strong> (Today, Single Date, or Date Range).</p>

      <h4>Understanding the Table</h4>
      <ul>
        <li><strong>Supplier:</strong> Who you bought from</li>
        <li><strong>Products:</strong> Summary of goods purchased</li>
        <li><strong>Total:</strong> Total cost of the purchase</li>
        <li><strong>Notes:</strong> Invoice number or reference</li>
      </ul>

      <h4>Tips</h4>
      <ul>
        <li>Tap any row to view full purchase details</li>
        <li>Always photograph the supplier receipt as proof</li>
        <li>Stock levels in Inventory update automatically when a purchase is saved</li>
      </ul>
    `
  },
  { 
    name: 'DEBTORS',          
    component: Debtors,
    helpContent: `
      <h3>Debtors – How to Use</h3>
      <p><strong>Track customers who take goods on credit and manage everything they owe you.</strong></p>

      <h4>Adding a Debtor</h4>
      <p>Tap <strong>+ Add Debtor</strong> and fill in their full name, phone, WhatsApp or email, address, and an agreed repayment due date. Once saved they appear as a card on the main list.</p>

      <h4>How Debts Are Added Automatically</h4>
      <p>When you complete a <strong>Buy on Credit</strong> sale in Checkout, the total is automatically added to that customer's running balance here in Debtors. You do not need to enter it manually.</p>

      <h4>Viewing a Debtor's Profile</h4>
      <p>Tap any debtor card to open their profile. Two tabs are available:</p>
      <ul>
        <li><strong>Details</strong> – contact information. Tap the pencil ✏️ icon to edit name, phone, WhatsApp, email, address, or due date.</li>
        <li><strong>Debt History</strong> – a full table of every credit sale and deposit in date order, with a running balance column so you always know exactly what they owe.</li>
      </ul>

      <h4>Recording a Deposit (Repayment)</h4>
      <p>When the debtor pays you back, open their profile → <strong>Debt History</strong> tab → tap <strong>Deposit</strong>. Enter the amount paid and optionally take a photo of the receipt as proof. The running balance updates immediately. Deposits can be edited within <strong>30 minutes</strong> of recording — after that they are locked.</p>

      <h4>Editing a Credit Sale Entry</h4>
      <p>Within <strong>2 hours</strong> of a credit sale being recorded, a pencil ✏️ icon appears on that row in the Debt History tab. Tap it to correct the product name, quantity, or price. After 2 hours the entry is locked.</p>

      <h4>Sending a Payment Reminder (Notify)</h4>
      <p>In the Debt History tab, tap <strong>Notify</strong>. A pre-written reminder message is prepared with the debtor's name, outstanding balance, and due date status. Choose to send via <strong>WhatsApp</strong>, <strong>Email</strong>, or <strong>SMS</strong> — the chosen app opens with the message ready to send.</p>

      <h4>Generating a PDF Statement</h4>
      <p>Tap the <strong>PDF</strong> button in the Debt History tab to generate a full A4 debt statement with the Kadaele Services letterhead, all transactions, and the current balance. The share sheet opens so you can send it via WhatsApp, email, or any other app.</p>

      <h4>Sorting and Searching</h4>
      <p>Use the search bar to find a debtor by name. Tap the sort button (↕) to order the list by <em>Balance: High to Low</em>, <em>Due Date</em>, or <em>Most Recently Updated</em>.</p>

      <h4>Overdue Warning in Checkout</h4>
      <p>If a debtor's repayment due date has passed and they still have an outstanding balance, a red blocking warning appears in Checkout when you try to sell to them on credit again. The sale is blocked until their balance is cleared.</p>
    `
  },
  { 
    name: 'CREDITORS',          
    component: Creditors,
    helpContent: `
      <h3>Creditors – How to Use</h3>
      <p><strong>Track suppliers or individuals that your business owes money to.</strong></p>

      <h4>How Creditors Are Created</h4>
      <p>Creditor records are created automatically when you save a <strong>Buy on Credit</strong> purchase in Purchase Record and link it to a supplier. The purchase amount is added to that supplier's outstanding balance here in Creditors. You do not need to create them manually.</p>

      <h4>Viewing a Creditor's Profile</h4>
      <p>Tap any creditor card to open their profile. Two tabs are available:</p>
      <ul>
        <li><strong>Details</strong> – contact information. Tap the pencil ✏️ icon to edit their details.</li>
        <li><strong>Debt History</strong> – a full table of every credit purchase and payment made, with a running balance showing exactly how much you still owe them.</li>
      </ul>

      <h4>Recording a Payment to a Creditor</h4>
      <p>Open the creditor profile → <strong>Debt History</strong> tab → tap <strong>Deposit</strong>. Enter the amount you are paying them and optionally take a photo of the receipt. The running balance updates immediately. Payments can be edited within <strong>30 minutes</strong> of recording — after that they are locked.</p>

      <h4>Editing a Purchase Entry</h4>
      <p>Within <strong>2 hours</strong> of a credit purchase being recorded, a pencil ✏️ icon appears on that row in the Debt History tab. Tap it to correct product details, quantity, or cost price. After 2 hours the entry is locked.</p>

      <h4>Sending a Reminder (Notify)</h4>
      <p>Tap <strong>Notify</strong> in the Debt History tab to generate a message showing what you owe this creditor. Send it to yourself via WhatsApp, Email, or SMS as a personal payment reminder.</p>

      <h4>Generating a PDF Statement</h4>
      <p>Tap the <strong>PDF</strong> button to generate a full A4 statement of the purchase and payment history with this creditor. Share it via WhatsApp or email for your own records or to confirm balances with the creditor.</p>

      <h4>Sorting and Searching</h4>
      <p>Use the search bar to find a creditor by name. Tap the sort button (↕) to order by <em>Balance: High to Low</em>, <em>Due Date</em>, or <em>Most Recently Updated</em>.</p>
    `
  },
  { 
    name: 'SUPPLIERS',          
    component: Suppliers,
    helpContent: `
      <h3>Suppliers – How to Use</h3>
      <p><strong>Maintain a directory of all the suppliers and vendors you buy stock from.</strong></p>

      <h4>Adding a New Supplier</h4>
      <p>Tap <strong>+ Add Supplier</strong>. Fill in their full name, gender, phone number, WhatsApp or email (at least one required), and address. Tap <strong>Save</strong>. The supplier is now available to select when recording purchases in Purchase Record.</p>

      <h4>Viewing a Supplier's Profile</h4>
      <p>Tap any supplier card to open their full profile. Two tabs are available:</p>
      <ul>
        <li><strong>Details</strong> – contact information. Tap the pencil ✏️ icon to update their details.</li>
        <li><strong>Purchase History</strong> – a record of all purchases made from this supplier, with amounts and dates.</li>
      </ul>

      <h4>Contacting a Supplier</h4>
      <p>From the supplier's Details tab you can quickly reach them via WhatsApp or email directly from the app to place reorders or follow up on deliveries.</p>

      <h4>Sorting and Searching</h4>
      <p>Use the search bar to find a supplier by name. Tap the sort button (↕) to order by <em>Balance: High to Low</em>, <em>Due Date</em>, or <em>Most Recently Updated</em>.</p>

      <h4>Tips</h4>
      <ul>
        <li>Always add a supplier before recording a purchase — Purchase Record requires a supplier to be selected</li>
        <li>Keep WhatsApp numbers up to date for quick reorder messages</li>
        <li>View purchase history to see which suppliers you rely on most</li>
      </ul>
    `
  },
  { 
    name: 'INVENTORY',        
    component: Inventory,
    helpContent: `
      <h3>Inventory – How to Use</h3>
      <p><strong>View all products in your shop and monitor their current stock levels in real time.</strong></p>

      <h4>Searching Products</h4>
      <p>Type in the search box at the top to instantly filter products by name. The result count updates as you type.</p>

      <h4>Understanding the Table</h4>
      <ul>
        <li><strong>Product Name:</strong> The name as it appears in Checkout searches</li>
        <li><strong>Selling Price:</strong> The price charged to customers</li>
        <li><strong>Category:</strong> Product category for organisation</li>
        <li><strong>Quantity:</strong> Current stock level on hand</li>
        <li><strong>Status:</strong> Colour-coded stock badge:
          <ul>
            <li>🟢 <strong>In Stock</strong> — more than 5 units remaining</li>
            <li>🟡 <strong>Low Stock</strong> — 1 to 5 units remaining</li>
            <li>🔴 <strong>Out of Stock</strong> — 0 units</li>
          </ul>
        </li>
        <li><strong>Barcode:</strong> Tap the barcode thumbnail to view the full barcode image</li>
      </ul>

      <h4>How Stock Levels Change</h4>
      <ul>
        <li>Stock is <strong>automatically deducted</strong> every time a sale is completed in Checkout</li>
        <li>Stock is <strong>automatically increased</strong> when a purchase is saved in Purchase Record</li>
        <li>To add new products or manually adjust stock, go to <strong>Settings</strong></li>
      </ul>

      <h4>Tips</h4>
      <ul>
        <li>Table header stays fixed when you scroll down</li>
        <li>Check this screen regularly and reorder when you see 🟡 Low Stock warnings</li>
        <li>Products are sorted alphabetically for easy browsing</li>
      </ul>
    `
  },
  {
    name: 'CASH RECONCILIATION',
    component: CashReconciliation,
    helpContent: `
      <h3>Cash Reconciliation – How to Use</h3>
      <p><strong>Open and close each business day and reconcile the cash drawer.</strong></p>

      <h4>Opening the Day</h4>
      <p>At the start of each shift, go to the <strong>Today</strong> tab and enter the <strong>Opening Float</strong> — the cash already in the drawer before any sales. Tap <strong>Open Day</strong>. The app records who opened the day automatically based on the logged-in account.</p>

      <h4>Live Cash Summary</h4>
      <p>Once the day is open, the summary updates automatically as sales, purchases, and debtor payments are recorded throughout the day:</p>
      <ul>
        <li><strong>Opening Float:</strong> Starting cash entered at open</li>
        <li><strong>Cash In today:</strong> All cash sales + debtor repayments received</li>
        <li><strong>Cash Out today:</strong> All cash purchases and payments made</li>
        <li><strong>Expected Cash Now:</strong> Float + In − Out (what should be in the drawer)</li>
      </ul>

      <h4>Closing the Day</h4>
      <p>At end of shift, count the physical cash in the drawer and enter the amount in <strong>Counted Cash</strong>. If the counted amount differs from expected, <strong>Notes are required</strong>. Tap <strong>Close Day</strong> — the record is then locked.</p>

      <h4>Difference Indicators</h4>
      <ul>
        <li>✅ <strong>Balanced</strong> — counted matches expected exactly</li>
        <li>⚠️ <strong>Short</strong> — cash missing from drawer</li>
        <li>⚠️ <strong>Over</strong> — extra cash in drawer</li>
      </ul>

      <h4>Records Tab</h4>
      <p>View all past daily reconciliation records. Tap any record to see the full breakdown including who opened and closed, float, expected, counted, and difference.</p>

      <h4>Tips</h4>
      <ul>
        <li>Always open the day before recording any sales for accurate reconciliation</li>
        <li>Works fully offline — records sync to the cloud when internet returns</li>
        <li>The Admin app uses this data to report daily expected vs counted cash</li>
      </ul>
    `
  },

  { 
    name: 'SETTINGS',         
    component: Settings,
    helpContent: `
      <h3>Settings – How to Use</h3>
      <p><strong>Manage your products, notifications, forgotten entries, and app preferences.</strong></p>

      <h4>Appearance</h4>
      <p>Toggle <strong>Dark Mode / Light Mode</strong> to switch the app theme. Your preference is saved automatically and applies across the whole app.</p>

      <h4>Notifications</h4>
      <ul>
        <li><strong>Low Stock Alert:</strong> Sends a notification when any product drops to 5 units or fewer in stock.</li>
        <li><strong>Creditor Payment Reminder:</strong> Rings an alarm at 8:30 AM, 12:00 PM, and 4:30 PM reminding you of any outstanding amounts your business owes to creditors.</li>
      </ul>

      <h4>Forgotten Entries</h4>
      <p>Use these when you forgot to record something on the day it happened:</p>
      <ul>
        <li><strong>Record Forgotten Sale:</strong> Record a past cash or credit sale with a manual back-date. Choose the products, quantities, payment type, and the actual date the sale occurred. The sale will appear in Sales Record with the correct date.</li>
        <li><strong>Record Forgotten Cash Entry:</strong> Record a past Cash IN or Cash OUT entry with a manual back-date. Useful for cash transactions you forgot to enter on the day.</li>
      </ul>

      <h4>Managing Products (Inventory)</h4>
      <p>The Manage Inventory section lets you:</p>
      <ul>
        <li>Add new products with name, selling price, category, stock quantity, and barcode image</li>
        <li>Edit existing product details</li>
        <li>Update stock quantities manually</li>
        <li>Delete products no longer sold</li>
      </ul>
      <p><em>Products added here are immediately available in Checkout searches and Inventory.</em></p>

      <h4>Tips</h4>
      <ul>
        <li>Use categories to keep your product list organised</li>
        <li>Enable the Creditor Reminder so you never forget to pay a supplier on time</li>
        <li>Use Forgotten Entries sparingly — always try to record sales and cash on the day they happen</li>
      </ul>
    `
  },
];

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false); // drives the unlock animation

  useEffect(() => {
    const checkAuth = async () => {
      const user = await dataService.checkPersistedLogin();
      if (user) {
        setCurrentUser(user);
        setUserEmail(user.email);
      }
      setIsCheckingAuth(false);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    const goOnline  = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // ── Hardware back button: confirm before exiting ───────────────────────
  useEffect(() => {
    let listener;
    const setup = async () => {
      try {
        listener = await CapApp.addListener('backButton', ({ canGoBack }) => {
          // If a modal/overlay is open (any element with overlay class), let browser handle it
          const overlay = document.querySelector('.d-overlay, .sr-modal-overlay, .pr-modal-overlay, .st-modal-overlay, .modal-overlay');
          if (overlay) return; // let the existing modal close handlers deal with it
          // Otherwise confirm app exit
          const confirmed = window.confirm('Close Kadaele Shopkeeper?');
          if (confirmed) CapApp.exitApp();
        });
      } catch (_) { /* not native — ignore */ }
    };
    setup();
    return () => { listener?.remove?.(); };
  }, []);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setUserEmail(user.email);
  };

  const handleLogout = async () => {
    await dataService.logout();
    setCurrentUser(null);
    setUserEmail('');
    window.location.reload();
  };

  const handleLockToggle = () => {
    if (isUnlocked) {
      // Lock immediately
      setIsUnlocked(false);
    } else {
      // Play unlock animation then unlock
      setIsUnlocking(true);
      setTimeout(() => {
        setIsUnlocking(false);
        setIsUnlocked(true);
      }, 600);
    }
  };

  const navigateToPage = (index) => {
    setCurrentPageIndex(index);
    setShowMenuModal(false);
  };

  if (isCheckingAuth) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{ color: 'white', fontSize: '18px' }}>Loading...</div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const CurrentPageComponent = PAGES[currentPageIndex].component;
  const currentHelpContent = PAGES[currentPageIndex].helpContent;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <img src="/kadaele-logo.png" alt="Kadaele Logo" className="header-logo" />
          <div className="header-text">
            <h1 className="header-title">Shopkeeper</h1>
            <span className="header-user">{userEmail.split('@')[0]}</span>
          </div>
        </div>
        <div className="header-right">
          <span className="online-indicator">
            <span className={`online-dot${isOnline ? '' : ' offline-dot'}`}></span>
            {isOnline ? 'Online' : 'Offline'}
          </span>
          <button onClick={handleLogout} className="logout-btn" title="Logout">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="page-navigation">
        <button onClick={() => setShowHelpModal(true)} className="nav-icon-btn" aria-label="Help">
          <HelpCircle size={24} />
        </button>
        <h2 className="page-title">{PAGES[currentPageIndex].name}</h2>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <button
            className={`nav-icon-btn lock-btn${isUnlocking ? ' lock-btn-unlocking' : ''}${isUnlocked ? ' lock-btn-unlocked' : ''}`}
            onClick={handleLockToggle}
            aria-label={isUnlocked ? 'Lock store' : 'Unlock store'}
            title={isUnlocked ? 'Tap to lock' : 'Tap to unlock entries'}
          >
            {isUnlocked ? <Unlock size={20} /> : <Lock size={20} />}
          </button>
          <button onClick={() => setShowMenuModal(true)} className="nav-icon-btn" aria-label="Menu">
            <Menu size={24} />
          </button>
        </div>
      </div>

      <main className="app-main">
        <CurrentPageComponent
          isUnlocked={isUnlocked}
        />
      </main>

      {showHelpModal && (
        <div className="modal-overlay" onClick={() => setShowHelpModal(false)}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Help</h2>
              <button className="modal-close-btn" onClick={() => setShowHelpModal(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body help-content" dangerouslySetInnerHTML={{ __html: currentHelpContent }} />
          </div>
        </div>
      )}

      {showMenuModal && (
        <div className="modal-overlay" onClick={() => setShowMenuModal(false)}>
          <div className="menu-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Navigate</h2>
              <button className="modal-close-btn" onClick={() => setShowMenuModal(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div className="menu-list">
                {PAGES.map((page, index) => (
                  <button
                    key={index}
                    className={`menu-item${currentPageIndex === index ? ' active' : ''}`}
                    onClick={() => navigateToPage(index)}
                  >
                    {page.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
