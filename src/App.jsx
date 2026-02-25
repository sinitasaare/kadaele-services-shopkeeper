import React, { useState, useEffect } from 'react';
import { HelpCircle, Menu, X, LogOut } from 'lucide-react';
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
      <h3>Sales and Checkout - How to Use</h3>
      <p><strong>This is your main point-of-sale screen for recording customer sales.</strong></p>
      
      <h4>Adding Items to Cart</h4>
      <ol>
        <li>Type in the search box at the bottom to find products</li>
        <li>Tap on a product from the search results</li>
        <li>Enter the quantity you want to sell</li>
        <li>Tap "Add to Cart" - the item appears in the table above</li>
      </ol>
      
      <h4>Adjusting Quantities</h4>
      <ul>
        <li>Tap the quantity field in the cart table to change it</li>
        <li>Tap the × button to remove an item completely</li>
      </ul>
      
      <h4>Completing a Sale</h4>
      <p><strong>Pay with Cash:</strong> Records the sale immediately. Cash goes into your Cash Journal automatically.</p>
      <p><strong>Buy on Credit:</strong> Opens a form to record customer details and repayment date. This creates a Debtor record.</p>
      
      <h4>Tips</h4>
      <ul>
        <li>The total updates automatically as you add or change items</li>
        <li>Search is instant - no need to press enter</li>
        <li>All sales are saved locally and sync to the cloud when online</li>
      </ul>
    `
  },
  { 
    name: 'SALES RECORD',     
    component: SalesRecord,
    helpContent: `
      <h3>Sales Record - How to Use</h3>
      <p><strong>View and filter all your sales transactions.</strong></p>
      
      <h4>Filtering Sales</h4>
      <ol>
        <li>Tap "Filter Sales" button at the top</li>
        <li>Choose <strong>Payment Type</strong>: All Sales, Cash Only, or Credit Only</li>
        <li>Choose <strong>Date Filter</strong>: Today, Single Date, or Date Range</li>
        <li>Tap "Apply Filter" to see results</li>
      </ol>
      
      <h4>Understanding the Table</h4>
      <ul>
        <li><strong>Date & Time:</strong> When the sale was recorded</li>
        <li><strong>Qty:</strong> Total quantity of items sold</li>
        <li><strong>Items:</strong> Names of all products in the sale</li>
        <li><strong>Total:</strong> Final amount paid by customer</li>
        <li><strong>Pay/Type:</strong> CASH or CREDIT badge</li>
        <li><strong>Customer:</strong> Name (for credit sales only)</li>
      </ul>
      
      <h4>Stats Boxes</h4>
      <p>The colored boxes show: <strong>Total Records</strong> (number of sales) and <strong>Grand Total</strong> (sum of all filtered sales).</p>
      
      <h4>Tips</h4>
      <ul>
        <li>Table header stays visible when you scroll</li>
        <li>Newest sales appear at the top</li>
        <li>Filter by date range to generate reports for specific periods</li>
      </ul>
    `
  },
  { 
    name: 'CASH RECORD',      
    component: CashRecord,
    helpContent: `
      <h3>Cash Journal - How to Use</h3>
      <p><strong>Track all cash coming in and going out of your business.</strong></p>
      
      <h4>Adding Cash Entries</h4>
      <ol>
        <li>Tap "+ Add Entry" button</li>
        <li>Choose <strong>Cash IN</strong> (money received) or <strong>Cash OUT</strong> (money spent)</li>
        <li>Enter the amount</li>
        <li>Add a note describing the transaction</li>
        <li>Tap "Save Entry"</li>
      </ol>
      
      <h4>Automatic Entries</h4>
      <p>Cash sales from Sales Register automatically create Cash IN entries. Shop purchases automatically create Cash OUT entries.</p>
      
      <h4>Understanding the Balance</h4>
      <ul>
        <li><strong>Opening Balance:</strong> What you started the day/period with</li>
        <li><strong>Total IN:</strong> All money received</li>
        <li><strong>Total OUT:</strong> All money spent</li>
        <li><strong>Closing Balance:</strong> Opening + IN - OUT</li>
      </ul>
      
      <h4>Filtering</h4>
      <p>Use the date filters to view cash flow for specific dates or date ranges.</p>
      
      <h4>Tips</h4>
      <ul>
        <li>Tap any row to view full details</li>
        <li>Green amounts are Cash IN, red amounts are Cash OUT</li>
        <li>Keep notes detailed to track where money goes</li>
      </ul>
    `
  },
  { 
    name: 'PURCHASE RECORD',  
    component: PurchaseRecord,
    helpContent: `
      <h3>Purchase Record - How to Use</h3>
      <p><strong>Record purchases you make from suppliers to restock your shop.</strong></p>
      
      <h4>Adding a Purchase</h4>
      <ol>
        <li>Tap "+ Add Purchase" button</li>
        <li>Enter <strong>Supplier Name</strong></li>
        <li>Select <strong>Purchase Date</strong></li>
        <li>Add items:
          <ul>
            <li>Enter quantity, description, and cost price</li>
            <li>Tap "+ Add Next Product" for more items</li>
          </ul>
        </li>
        <li>Optionally add notes and take a photo of the receipt</li>
        <li>Tap "Save Purchase"</li>
      </ol>
      
      <h4>Filtering Purchases</h4>
      <p>Use the filter button to view purchases by:</p>
      <ul>
        <li><strong>Payment Type:</strong> All, Cash, or Credit</li>
        <li><strong>Date:</strong> Today, Single Date, or Date Range</li>
      </ul>
      
      <h4>Understanding the Table</h4>
      <ul>
        <li><strong>Supplier:</strong> Who you bought from</li>
        <li><strong>Items:</strong> Quick summary of purchased goods</li>
        <li><strong>Total:</strong> Amount spent</li>
        <li><strong>Notes:</strong> Invoice numbers or references</li>
      </ul>
      
      <h4>Tips</h4>
      <ul>
        <li>Tap any row to view full purchase details</li>
        <li>Photo receipts for record-keeping</li>
        <li>Purchases automatically create Cash OUT entries</li>
      </ul>
    `
  },
  { 
    name: 'DEBTORS',          
    component: Debtors,
    helpContent: `
      <h3>Debtors – How to Use</h3>
      <p><strong>Keep track of customers who take goods on credit and manage what they owe you.</strong></p>

      <h4>Adding a Debtor</h4>
      <p>Tap <strong>+ Add Debtor</strong> and fill in their name, phone, WhatsApp or email, and address. For example, if John Banda buys rice on credit, add him here so you can track his debt separately from other customers.</p>

      <h4>Viewing a Debtor's Profile</h4>
      <p>Tap any debtor card to open their profile. You'll see two tabs:</p>
      <ul>
        <li><strong>Details</strong> – their contact info. Tap the pencil icon to edit it.</li>
        <li><strong>Debt History</strong> – every sale and deposit listed in order, with a running balance so you always know exactly what they owe.</li>
      </ul>

      <h4>How Debts Are Added</h4>
      <p>When you record a credit sale in the Sales Register, the amount is automatically added to that customer's debt. For example: John buys K500 of maize flour on credit → his balance goes up by K500.</p>

      <h4>Recording a Deposit (Payment)</h4>
      <p>When the debtor pays you back, open their profile → <strong>Debt History</strong> tab → tap <strong>Deposit</strong>. Enter the amount they paid. For example: John pays K200 → his balance drops from K500 to K300. You can also take a photo of the receipt as proof.</p>
      <p><em>Note: Deposits can be edited within 30 minutes of recording. After that, they are locked.</em></p>

      <h4>Sending a Payment Reminder (Notify)</h4>
      <p>Tap <strong>Notify</strong> in the Debt History tab to send a polite reminder message to the debtor. Choose WhatsApp, Email, or SMS. The message is pre-written with their name and balance — you just pick the channel and send. For example: John's due date is tomorrow → tap Notify → WhatsApp → the message opens in WhatsApp ready to send.</p>

      <h4>Sharing a PDF Statement</h4>
      <p>Tap the <strong>PDF</strong> button (between Notify and Deposit) to generate a full statement of the debtor's debt history as a PDF file. The share sheet opens so you can send it directly — via WhatsApp, email, Bluetooth, or any other app on your phone. For example: John asks for proof of what he owes → tap PDF → share via WhatsApp → he receives the document instantly.</p>

      <h4>Sorting and Searching</h4>
      <p>Use the search bar to find a debtor by name. Use the sort button (↕) to order by highest balance, due date, or most recently updated. For example: sort by <em>Balance: High to Low</em> to see who owes you the most at a glance.</p>

      <h4>Editing Sales Entries</h4>
      <p>If you made a mistake when recording a credit sale, open the Debt History tab. Within 2 hours of the sale, a pencil icon appears on that row — tap it to correct the item name, quantity, or price. After 2 hours the entry is locked.</p>

      <h4>Setting a Repayment Due Date</h4>
      <p>When adding or editing a debtor, you can record an agreed repayment date. The Notify message will automatically say "your debt is due tomorrow" or "your debt is X days overdue" based on that date.</p>
    `
  },
  { 
    name: 'CREDITORS',          
    component: Creditors,
    helpContent: `
      <h3>Creditors - How to Use</h3>
      <p><strong>Manage people or companies you owe money to.</strong></p>
      
      <h4>Adding a New Creditor</h4>
      <ol>
        <li>Tap "+ Add Creditor" button</li>
        <li>Fill in required fields: Full Name, Gender, Phone, WhatsApp/Email, Address</li>
        <li>Tap "Save"</li>
      </ol>
      
      <h4>Recording Payments Made</h4>
      <ol>
        <li>Open creditor profile → "Debt History" tab</li>
        <li>Tap "Deposit" → Enter payment amount</li>
        <li>Take receipt photo (optional) → Tap "Confirm Payment"</li>
      </ol>
      
      <h4>Use Cases</h4>
      <ul>
        <li>Track money owed to suppliers for goods bought on credit</li>
        <li>Manage loans or money borrowed from individuals</li>
        <li>Keep records of business debts and repayment schedules</li>
      </ul>
    `
  },
  { 
    name: 'SUPPLIERS',          
    component: Suppliers,
    helpContent: `
      <h3>Suppliers - How to Use</h3>
      <p><strong>Maintain a directory of your suppliers and vendors.</strong></p>
      
      <h4>Adding a New Supplier</h4>
      <ol>
        <li>Tap "+ Add Supplier" button</li>
        <li>Fill in: Company/Person Name, Gender, Phone, WhatsApp/Email, Address</li>
        <li>Tap "Save"</li>
      </ol>
      
      <h4>Managing Supplier Information</h4>
      <ul>
        <li>Tap any supplier card to view full contact details</li>
        <li>Use the pencil icon to edit information</li>
        <li>Track purchase history and payment records</li>
      </ul>
      
      <h4>Tips</h4>
      <ul>
        <li>Keep supplier contacts organized in one place</li>
        <li>Quick access to WhatsApp/Email for reordering</li>
        <li>View purchase history to track which suppliers you buy from most</li>
      </ul>
    `
  },
  { 
    name: 'INVENTORY',        
    component: Inventory,
    helpContent: `
      <h3>Inventory - How to Use</h3>
      <p><strong>View all products in your shop and their current stock levels.</strong></p>
      
      <h4>Searching Products</h4>
      <p>Type in the search box at the top to instantly filter products by name.</p>
      
      <h4>Understanding the Table</h4>
      <ul>
        <li><strong>Item Name:</strong> Product name</li>
        <li><strong>Price:</strong> Selling price</li>
        <li><strong>Category:</strong> Product category</li>
        <li><strong>Quantity:</strong> Current stock level</li>
        <li><strong>Status:</strong> Color-coded badges:
          <ul>
            <li><span style="color: #2e7d32;">🟢 In Stock:</span> 10+ items</li>
            <li><span style="color: #f57c00;">🟡 Low Stock:</span> 1-9 items</li>
            <li><span style="color: #c62828;">🔴 Out of Stock:</span> 0 items</li>
          </ul>
        </li>
      </ul>
      
      <h4>Managing Inventory</h4>
      <p><em>Note: To add new products or update stock levels, go to <strong>Settings</strong> screen.</em></p>
      
      <h4>Tips</h4>
      <ul>
        <li>Table header stays visible when scrolling</li>
        <li>Watch for low stock warnings to reorder in time</li>
        <li>Stock is automatically deducted when sales are made</li>
      </ul>
    `
  },
  { 
    name: 'SETTINGS',         
    component: Settings,
    helpContent: `
      <h3>Settings - How to Use</h3>
      <p><strong>Manage your inventory, view system info, and customize the app.</strong></p>
      
      <h4>Managing Products</h4>
      <p>The <strong>Manage Inventory</strong> section lets you:</p>
      <ul>
        <li>Add new products to your shop</li>
        <li>Edit existing product details (name, price, category)</li>
        <li>Update stock quantities</li>
        <li>Delete products no longer sold</li>
      </ul>
      
      <h4>Dark Mode</h4>
      <p>Toggle the switch to switch between light and dark themes. Your preference is saved automatically.</p>
      
      <h4>Database Operations</h4>
      <p><strong>Sync from Server:</strong> Download latest data from cloud to your device</p>
      <p><strong>Push to Server:</strong> Upload all local data to the cloud</p>
      <p><em>Note: These operations require an internet connection.</em></p>
      
      <h4>App Information</h4>
      <p>View app version, last sync time, and connection status.</p>
      
      <h4>Tips</h4>
      <ul>
        <li>Sync regularly to keep data backed up</li>
        <li>Use categories to organize products</li>
        <li>Update stock levels after receiving new shipments</li>
        <li>Dark mode can reduce eye strain in low light</li>
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
        <button onClick={() => setShowMenuModal(true)} className="nav-icon-btn" aria-label="Menu">
          <Menu size={24} />
        </button>
      </div>

      <main className="app-main">
        <CurrentPageComponent />
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
