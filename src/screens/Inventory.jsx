import React, { useState, useEffect, useRef } from 'react';
import { Search, Package, AlertTriangle, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import dataService from '../services/dataService';
import './Inventory.css';

function Inventory() {
  const [goods, setGoods] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredItems, setFilteredItems] = useState([]);

  const fileInputRef = useRef(null);

  useEffect(() => {
    applyFilters();
  }, [goods, inventory, searchTerm]);

  const applyFilters = () => {
    const combined = goods.map(good => {
      const inventoryItem = inventory.find(inv => inv.itemId === good.id);
      return {
        ...good,
        stockLevel: inventoryItem?.stockLevel || 0,
        lastUpdated: inventoryItem?.lastUpdated || null,
      };
    });

    let filtered = combined;
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredItems(filtered);
  };

  const getStockStatus = (stockLevel) => {
    if (stockLevel === 0) {
      return { label: 'Out of Stock', className: 'out-of-stock', icon: <AlertTriangle size={16} /> };
    } else if (stockLevel < 10) {
      return { label: 'Low Stock', className: 'low-stock', icon: <AlertTriangle size={16} /> };
    } else {
      return { label: 'In Stock', className: 'in-stock', icon: <TrendingUp size={16} /> };
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      setGoods(data.goods || []);
      setInventory(data.inventory || []);
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import database. Please check the file format.');
    }
  };

  const handleExportClick = async () => {
    const data = {
      goods,
      inventory,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-database-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="inventory">
      {/* Screen Header - will be sticky under app-header */}
      <div className="inventory-header">
        <div>
          <h2 className="screen-title">Inventory</h2>
          <p className="screen-subtitle">View current stock levels (Read-only)</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-import" onClick={handleImportClick}>
            Import Database
          </button>
          <button className="btn btn-export" onClick={handleExportClick}>
            Export Database
          </button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        accept=".json"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Content card with search + table */}
      {filteredItems.length === 0 ? (
        <div className="card empty-state">
          <Package size={64} />
          <h3>No items found</h3>
          <p>Import a database to see items here.</p>
        </div>
      ) : (
        <div className="content-card">
          {/* Search bar - inside scrollable content */}
          <div className="search-section">
            <div className="search-box">
              <Search size={18} />
              <input
                type="text"
                className="input-field"
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Table container */}
          <div className="table-wrapper">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock Level</th>
                    <th>Status</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => {
                    const status = getStockStatus(item.stockLevel);
                    return (
                      <tr key={item.id}>
                        <td className="item-name">{item.name}</td>
                        <td>{item.category || 'General'}</td>
                        <td className="item-price">${item.price.toFixed(2)}</td>
                        <td className="stock-level">
                          <span className={`stock-badge ${status.className}`}>
                            {item.stockLevel} units
                          </span>
                        </td>
                        <td>
                          <span className={`status-badge ${status.className}`}>
                            {status.icon}
                            {status.label}
                          </span>
                        </td>
                        <td className="last-updated">
                          {item.lastUpdated
                            ? format(new Date(item.lastUpdated), 'MMM dd, yyyy')
                            : 'Never'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Inventory;