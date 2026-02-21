import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import SalesRegister from './screens/SalesRegister';
import SalesJournal from './screens/SalesJournal';
import CashJournal from './screens/CashJournal';
import Debtors from './screens/Debtors';
import Inventory from './screens/Inventory';
import Settings from './screens/Settings';
import Login from './components/Login';
import dataService from './services/dataService';
import './App.css';

// ── Apply dark/light mode immediately on load (before React renders) ──────────
// Reads from localStorage so the theme is set even before Settings mounts.
// Settings.jsx keeps this in sync whenever the user toggles the switch.
(function applyInitialTheme() {
  const dark = localStorage.getItem('ks_darkMode') === 'true';
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();

const PAGES = [
  { name: 'SALES REGISTER', component: SalesRegister },
  { name: 'SALES RECORD',   component: SalesJournal  },
  { name: 'CASH RECORD',    component: CashJournal   },
  { name: 'DEBTORS',        component: Debtors       },
  { name: 'INVENTORY',      component: Inventory     },
  { name: 'SETTINGS',       component: Settings      },
];

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // ── Auth ──────────────────────────────────────────────────────────────────
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

  // ── Online / Offline indicator ────────────────────────────────────────────
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

  const handlePrevPage = () => {
    setCurrentPageIndex((prev) => (prev === 0 ? PAGES.length - 1 : prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPageIndex((prev) => (prev === PAGES.length - 1 ? 0 : prev + 1));
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
        <button onClick={handlePrevPage} className="nav-arrow" aria-label="Previous page">
          <ChevronLeft size={24} />
        </button>
        <h2 className="page-title">{PAGES[currentPageIndex].name}</h2>
        <button onClick={handleNextPage} className="nav-arrow" aria-label="Next page">
          <ChevronRight size={24} />
        </button>
      </div>

      <main className="app-main">
        <CurrentPageComponent />
      </main>
    </div>
  );
}

export default App;
