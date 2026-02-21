import React, { useState, useEffect } from 'react';
import { Search, Barcode } from 'lucide-react';
import dataService from '../services/dataService';
import './Inventory.css';

function Inventory() {
  const [goods, setGoods] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState(null);

  // Barcode image viewer
  const [viewingBarcode, setViewingBarcode] = useState(null); // { name, barcode, imageUrl }

  useEffect(() => { loadGoods(); }, []);

  const loadGoods = async () => {
    setLoading(true);
    try {
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
    (g.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (g.barcode || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStockStatus = (qty) => {
    if (qty === undefined || qty === null) return null;
    if (qty <= 0)  return { label: 'Out of Stock', cls: 'out-of-stock' };
    if (qty <= 5)  return { label: 'Low Stock',    cls: 'low-stock'    };
    return           { label: 'In Stock',       cls: 'in-stock'     };
  };

  // A good has a barcode if it has a `barcode` string (the code value)
  // and/or a `barcodeImage` / `barcode_image` URL (photo from Firebase).
  const getBarcodeImageUrl = (good) =>
    good.barcodeImage || good.barcode_image || good.barcodeUrl || good.barcode_url || null;

  const openBarcodeViewer = (good) => {
    const imgUrl = getBarcodeImageUrl(good);
    if (!imgUrl && !good.barcode) return; // nothing to show
    setViewingBarcode({
      name:     good.name || 'Product',
      barcode:  good.barcode || null,
      imageUrl: imgUrl,
    });
  };

  return (
    <div className="inventory">

      {/* ── Sticky search bar ── */}
      <div className="inv-sticky-bar">
        <div className="inv-search-box">
          <Search size={16} className="inv-search-icon" />
          <input
            type="text"
            className="inv-search-input"
            placeholder="Search name, category or barcode…"
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
                <th className="inv-col-num">#</th>
                <th>PRODUCT NAME</th>
                <th>Category</th>
                <th className="inv-col-right">Price</th>
                <th className="inv-col-center">Stock</th>
                <th>Status</th>
                <th className="inv-col-center">Barcode</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((good, idx) => {
                const status   = getStockStatus(good.stock_quantity);
                const hasBarcode = good.barcode || getBarcodeImageUrl(good);
                return (
                  <tr key={good.id}>
                    <td className="inv-col-num inv-num-cell">{idx + 1}</td>
                    <td className="inv-name-cell">{good.name || '—'}</td>
                    <td className="inv-cat-cell">{good.category || '—'}</td>
                    <td className="inv-col-right">${parseFloat(good.price || 0).toFixed(2)}</td>
                    <td className="inv-col-center">{good.stock_quantity ?? '—'}</td>
                    <td>
                      {status ? (
                        <span className={`inv-badge ${status.cls}`}>{status.label}</span>
                      ) : '—'}
                    </td>
                    <td className="inv-col-center">
                      {hasBarcode ? (
                        <button
                          className="inv-barcode-icon-btn"
                          onClick={() => openBarcodeViewer(good)}
                          title="View barcode"
                          aria-label={`View barcode for ${good.name}`}
                        >
                          <Barcode size={20} strokeWidth={1.5} />
                        </button>
                      ) : (
                        <span className="inv-barcode-none">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* ── Barcode Image Viewer Modal ── */}
      {viewingBarcode && (
        <div
          className="inv-barcode-overlay"
          onClick={() => setViewingBarcode(null)}
        >
          <div className="inv-barcode-modal" onClick={e => e.stopPropagation()}>
            <div className="inv-barcode-modal-header">
              <span className="inv-barcode-modal-title">{viewingBarcode.name}</span>
              <button className="inv-barcode-modal-close" onClick={() => setViewingBarcode(null)}>×</button>
            </div>
            {viewingBarcode.imageUrl ? (
              <img
                src={viewingBarcode.imageUrl}
                alt={`Barcode for ${viewingBarcode.name}`}
                className="inv-barcode-modal-img"
              />
            ) : (
              <div className="inv-barcode-modal-text-only">
                <Barcode size={48} strokeWidth={1} color="#667eea" />
                <p className="inv-barcode-modal-code">{viewingBarcode.barcode}</p>
                <p className="inv-barcode-modal-note">No barcode image saved.<br/>Barcode number shown above.</p>
              </div>
            )}
            {viewingBarcode.barcode && (
              <p className="inv-barcode-modal-code-below">{viewingBarcode.barcode}</p>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default Inventory;
