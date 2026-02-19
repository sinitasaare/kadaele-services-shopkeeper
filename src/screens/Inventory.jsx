import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import dataService from '../services/dataService';
import './Inventory.css';

function Inventory() {
  const [goods, setGoods] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState(null);
  const searchBarRef = useRef(null);

  useEffect(() => { loadGoods(); }, []);

  const loadGoods = async () => {
    setLoading(true);
    try {
      // getGoods() pulls from Firebase when online and caches to localforage.
      // When offline it falls back to the localforage cache automatically.
      const data = await dataService.getGoods();
      const sorted = (data || []).sort((a, b) =>
        (a.name || '').localeCompare(b.name || '')
      );
      setGoods(sorted);
      setLastSynced(new Date());
    } catch (err) {
      console.error('Error loading goods:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = goods.filter(g =>
    (g.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (g.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStockStatus = (qty) => {
    if (qty === undefined || qty === null) return null;
    if (qty <= 0)  return { label: 'Out of Stock', cls: 'out-of-stock' };
    if (qty <= 5)  return { label: 'Low Stock',    cls: 'low-stock'    };
    return           { label: 'In Stock',       cls: 'in-stock'     };
  };

  return (
    <div className="inventory">

      {/* ── Sticky search bar ── */}
      <div className="inv-sticky-bar" ref={searchBarRef}>
        <div className="inv-search-box">
          <Search size={16} className="inv-search-icon" />
          <input
            type="text"
            className="inv-search-input"
            placeholder="Search by name or category…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="inv-search-clear" onClick={() => setSearchTerm('')}>×</button>
          )}
        </div>
        <div className="inv-meta-row">
          <span className="inv-count">{filtered.length} item{filtered.length !== 1 ? 's' : ''}</span>
          {lastSynced && (
            <span className="inv-sync-label">
              Synced {lastSynced.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
            </span>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="inv-table-wrapper">
        {loading ? (
          <div className="inv-empty">Loading inventory…</div>
        ) : filtered.length === 0 ? (
          <div className="inv-empty">
            {searchTerm ? `No items matching "${searchTerm}"` : 'No goods found. Go online to sync from Firebase.'}
          </div>
        ) : (
          <table className="inv-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th className="inv-col-right">Price</th>
                <th className="inv-col-center">Stock</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(good => {
                const status = getStockStatus(good.stock_quantity);
                return (
                  <tr key={good.id}>
                    <td className="inv-name-cell">{good.name || '—'}</td>
                    <td className="inv-cat-cell">{good.category || '—'}</td>
                    <td className="inv-col-right">${parseFloat(good.price || 0).toFixed(2)}</td>
                    <td className="inv-col-center">{good.stock_quantity ?? '—'}</td>
                    <td>
                      {status ? (
                        <span className={`inv-badge ${status.cls}`}>{status.label}</span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}

export default Inventory;
