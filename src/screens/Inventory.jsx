import React, { useState, useEffect } from 'react';
import { Search, Package, AlertTriangle, TrendingUp } from 'lucide-react';
import dataService from '../services/dataService';
import './Inventory.css';

function Inventory() {
  const [goods, setGoods] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredItems, setFilteredItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [goods, searchTerm]);

  const loadData = async () => {
    try {
      setLoading(true);
      const loadedGoods = await dataService.getGoods();
      console.log('📦 Loaded goods:', loadedGoods.length);
      
      // Sort by ID in ascending order
      const sortedGoods = (loadedGoods || []).sort((a, b) => {
        const idA = parseInt(a.id) || 0;
        const idB = parseInt(b.id) || 0;
        return idA - idB;
      });
      
      setGoods(sortedGoods);
    } catch (error) {
      console.error('Error loading goods:', error);
      setGoods([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = goods;
    if (searchTerm) {
      filtered = goods.filter(item =>
        item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.id?.toString().includes(searchTerm)
      );
    }
    setFilteredItems(filtered);
  };

  const getStockStatus = (stockLevel) => {
    const level = stockLevel || 0;
    if (level === 0) {
      return { label: 'Out of Stock', className: 'out-of-stock', icon: <AlertTriangle size={16} /> };
    } else if (level < 10) {
      return { label: 'Low Stock', className: 'low-stock', icon: <AlertTriangle size={16} /> };
    }
    return { label: 'In Stock', className: 'in-stock', icon: <TrendingUp size={16} /> };
  };

  if (loading) {
    return (
      <div className="inventory">
          <div className="card empty-state">
            <Package size={64} />
            <h3>Loading inventory...</h3>
          </div>
      </div>
    );
  }

  return (
    <div className="inventory">
      {/* FIXED HEADER */}
      <div className="sticky-header">
        <div className="inventory-header">
          <div>
            <h2 className="screen-title">Inventory</h2>
            <p className="screen-subtitle">View current stock levels ({goods.length} items)</p>
          </div>
        </div>
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className="inventory-scrollable-content">
        {filteredItems.length === 0 && !searchTerm ? (
          <div className="card empty-state">
            <Package size={64} />
            <h3>No items found</h3>
            <p>Products will sync from cloud automatically.</p>
            <button onClick={loadData} style={{marginTop: '20px', padding: '10px 20px', cursor: 'pointer'}}>
              Retry Sync
            </button>
          </div>
        ) : (
          <div className="content-card">
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

            <div className="table-wrapper">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Item Name</th>
                      <th>Price</th>
                      <th>Stock</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => {
                      const status = getStockStatus(item.stock_quantity);
                      return (
                        <tr key={item.id}>
                          <td>{item.id || 'N/A'}</td>
                          <td>{item.name || 'Unknown'}</td>
                          <td>${(item.price || 0).toFixed(2)}</td>
                          <td>{item.stock_quantity || 0}</td>
                          <td>
                            <span className={`status-badge ${status.className}`}>
                              {status.icon}
                              {status.label}
                            </span>
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
    </div>
  );
}

export default Inventory;
