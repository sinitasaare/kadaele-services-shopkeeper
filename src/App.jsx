import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import CashRegister from './screens/CashRegister';
import SalesRecord from './screens/SalesRecord';
import Debtors from './screens/Debtors';
import Inventory from './screens/Inventory';
import Login from './components/Login';
import dataService from './services/dataService';
import './App.css';

const PAGES = [
  { name: 'SALES RECORD', component: CashRegister },
  { name: 'Sales Record', component: SalesRecord },
  { name: 'Debtors', component: Debtors },
  { name: 'Inventory', component: Inventory },
];

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  useEffect(() => {
    // Check if user is already logged in
    const user = dataService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      setUserEmail(user.email);
    }
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
            <span className="online-dot"></span>
            Online
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
