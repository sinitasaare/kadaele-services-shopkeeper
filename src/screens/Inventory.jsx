import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, ZoomIn } from 'lucide-react';
import dataService from '../services/dataService';
import { useCurrency } from '../hooks/useCurrency';
import './Inventory.css';

function Portal({ children }) {
  return createPortal(children, document.body);
}

function filterAndSort(goods, term) {
  if (!term) return goods;
  const q = term.toLowerCase().trim();
  if (!q) return goods;
  const tier1 = [];
  const tier2 = [];
  for (const g of goods) {
    const name = (g.name || '').toLowerCase();
    const words = name.split(/\s+/);
    if (name.startsWith(q)) {
      tier1.push(g);
    } else if (words.length >= 2 && words[1].startsWith(q)) {
      tier2.push(g);
    }
  }
  const alpha = (a, b) => (a.name || '').localeCompare(b.name || '');
  return [...tier1.sort(alpha), ...tier2.sort(alpha)];
}

function Inventory() {
  const { fmt } = useCurrency();
  const [goods, setGoods] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);

  useEffect(() => { loadGoods(); }, []);

  const loadGoods = async () => {
    setLoading(true);
    try {
      const data = await dataService.getGoods();
      const sorted = (data || [])
        .filter(g => (g.name || '').trim() !== '')
        .slice()
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setGoods(sorted);
      setLastSynced(new Date());
    } catch (err) {
      console.error('Error loading goods:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = filterAndSort(goods, searchTerm);

  const getStockStatus = (qty) => {
    if (qty === undefined || qty === null) return null;
    if (qty <= 0)  return { label: 'Out of Stock', cls: 'out-of-stock' };
    if (qty <= 5)  return { label: 'Low Stock',    cls: 'low-stock'    };
    return               { label: 'In Stock',       cls: 'in-stock'     };
  };

  const getBarcodeImageUrl = (good) =>
    good.barcodeImage || good.barcode_image || good.barcodeUrl || good.barcode_url || null;

  return (
    <div className="inventory">
      {lightboxSrc && (
        <Portal>
          <div className="inv-lightbox" onClick={() => setLightboxSrc(null)}>
            <button className="inv-lightbox-close" onClick={() => setLightboxSrc(null)}><X size={28} /></button>
            <img src={lightboxSrc} alt="Barcode" className="inv-lightbox-img" onClick={e => e.stopPropagation()} />
          </div>
        </Portal>
      )}

      <div className="inv-sticky-bar">
        <div className="inv-toolbar">
          <div className="inv-search-box">
            <Search size={16} className="inv-search-icon" />
            <input
              type="text"
              className="inv-search-input"
              placeholder="Search Product"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                className="inv-search-clear"
                onPointerDown={e => { e.preventDefault(); e.stopPropagation(); setSearchTerm(''); }}
                onClick={() => setSearchTerm('')}
              >×</button>
            )}
          </div>
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

      <div className="inv-scroll-body">
        {loading ? (
          <div className="inv-empty">Loading inventory…</div>
        ) : filtered.length === 0 ? (
          <div className="inv-empty">
            {searchTerm ? `No items matching "${searchTerm}"` : 'No goods found. Go online to sync from Firebase.'}
          </div>
        ) : (
          <div className="inv-table-wrapper">
            <table className="inv-table">
              <thead className="inv-thead">
                <tr>
                  <th className="inv-col-frozen inv-col-num">#</th>
                  <th className="inv-col-frozen inv-col-name">PRODUCT NAME</th>
                  <th className="inv-col-size">SIZE</th>
                  <th>CATEGORY</th>
                  <th className="inv-col-right">PRICE</th>
                  <th className="inv-col-center">STOCK</th>
                  <th>STATUS</th>
                  <th className="inv-col-center">BARCODE</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((good, idx) => {
                  const status = getStockStatus(good.stock_quantity);
                  const barcodeImgUrl = getBarcodeImageUrl(good);
                  return (
                    <tr key={good.id} className="inv-data-row">
                      <td className="inv-col-frozen inv-col-num inv-num-cell">{idx + 1}</td>
                      <td className="inv-col-frozen inv-col-name inv-name-cell">
                        <span className="inv-cell-value">{good.name ?? ''}</span>
                      </td>
                      <td className="inv-size-cell">
                        <span className="inv-cell-value">{good.size ?? ''}</span>
                      </td>
                      <td className="inv-cat-cell">{good.category || '—'}</td>
                      <td className="inv-col-right">
                        <span className="inv-cell-value">{fmt(parseFloat(good.price || 0))}</span>
                      </td>
                      <td className="inv-col-center">
                        <span className="inv-cell-value">{good.stock_quantity ?? ''}</span>
                      </td>
                      <td>
                        {status ? <span className={`inv-badge ${status.cls}`}>{status.label}</span> : '—'}
                      </td>
                      <td className="inv-col-center">
                        {barcodeImgUrl ? (
                          <button className="inv-barcode-thumb-btn"
                            onClick={() => setLightboxSrc(barcodeImgUrl)} title="View barcode image">
                            <ZoomIn size={18} strokeWidth={1.8} />
                          </button>
                        ) : <span className="inv-barcode-none">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Inventory;
