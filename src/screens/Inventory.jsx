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
  const tier3 = [];
  for (const g of goods) {
    const name = (g.name || '').toLowerCase();
    const words = name.split(/\s+/);
    if (name.startsWith(q)) {
      tier1.push(g);
    } else if (words.length >= 2 && words[1].startsWith(q)) {
      tier2.push(g);
    } else if (words.length >= 3 && words[2].startsWith(q)) {
      tier3.push(g);
    }
  }
  const alpha = (a, b) => (a.name || '').localeCompare(b.name || '');
  return [...tier1.sort(alpha), ...tier2.sort(alpha), ...tier3.sort(alpha)];
}

function filterAssets(assets, term) {
  if (!term) return assets;
  const q = term.toLowerCase().trim();
  if (!q) return assets;
  return assets.filter(a => (a.name || '').toLowerCase().includes(q));
}

function Inventory() {
  const { fmt } = useCurrency();

  // View tab: 'goods' | 'assets'
  const [activeTab, setActiveTab] = useState('goods');

  // Goods state
  const [goods, setGoods] = useState([]);
  const [goodsLoading, setGoodsLoading] = useState(true);
  const [goodsLastSynced, setGoodsLastSynced] = useState(null);

  // Operational Assets state
  const [assets, setAssets] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsLastSynced, setAssetsLastSynced] = useState(null);

  // Shared
  const [searchTerm, setSearchTerm] = useState('');
  const [lightboxSrc, setLightboxSrc] = useState(null);

  // ── Load goods ──────────────────────────────────────────────────────────
  useEffect(() => { loadGoods(); }, []);

  useEffect(() => {
    const unsubscribe = dataService.onGoodsChange((updatedGoods) => {
      const sorted = (updatedGoods || [])
        .filter(g => (g.name || '').trim() !== '')
        .slice()
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setGoods(sorted);
      setGoodsLastSynced(new Date());
    });
    return () => unsubscribe();
  }, []);

  const loadGoods = async () => {
    setGoodsLoading(true);
    try {
      const data = await dataService.getGoods();
      const sorted = (data || [])
        .filter(g => (g.name || '').trim() !== '')
        .slice()
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setGoods(sorted);
      setGoodsLastSynced(new Date());
    } catch (err) {
      console.error('Error loading goods:', err);
    } finally {
      setGoodsLoading(false);
    }
  };

  // ── Load operational assets when tab is switched ─────────────────────────
  useEffect(() => {
    if (activeTab === 'assets') {
      loadAssets();
    }
  }, [activeTab]);

  const loadAssets = async () => {
    setAssetsLoading(true);
    try {
      const data = await dataService.getOperationalAssets();
      setAssets(data || []);
      setAssetsLastSynced(new Date());
    } catch (err) {
      console.error('Error loading operational assets:', err);
    } finally {
      setAssetsLoading(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getStockStatus = (qty) => {
    if (qty === undefined || qty === null) return null;
    if (qty <= 0)  return { label: 'Out of Stock', cls: 'out-of-stock' };
    if (qty <= 5)  return { label: 'Low Stock',    cls: 'low-stock'    };
    return               { label: 'In Stock',       cls: 'in-stock'     };
  };

  const getBarcodeImageUrl = (good) =>
    good.barcodeImage || good.barcode_image || good.barcodeUrl || good.barcode_url || null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const filteredGoods = filterAndSort(goods, searchTerm);
  const filteredAssets = filterAssets(assets, searchTerm);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchTerm('');
  };

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
        {/* Tab toggle */}
        <div className="inv-tab-row">
          <button
            className={`inv-tab-btn${activeTab === 'goods' ? ' inv-tab-btn-active' : ''}`}
            onClick={() => handleTabChange('goods')}
          >
            📦 Goods
          </button>
          <button
            className={`inv-tab-btn${activeTab === 'assets' ? ' inv-tab-btn-active inv-tab-btn-active-assets' : ''}`}
            onClick={() => handleTabChange('assets')}
          >
            🔧 Operational Assets
          </button>
        </div>

        <div className="inv-toolbar">
          <div className="inv-search-box">
            <Search size={16} className="inv-search-icon" />
            <input
              type="text"
              className="inv-search-input"
              placeholder={activeTab === 'goods' ? 'Search Product' : 'Search Asset'}
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
          {activeTab === 'goods' ? (
            <>
              <span className="inv-count">{filteredGoods.length} item{filteredGoods.length !== 1 ? 's' : ''}</span>
              {goodsLastSynced && (
                <span className="inv-sync-label">
                  Synced {goodsLastSynced.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </span>
              )}
            </>
          ) : (
            <>
              <span className="inv-count">{filteredAssets.length} item{filteredAssets.length !== 1 ? 's' : ''}</span>
              {assetsLastSynced && (
                <span className="inv-sync-label">
                  Synced {assetsLastSynced.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <div className="inv-scroll-body">
        {/* ── GOODS VIEW ── */}
        {activeTab === 'goods' && (
          goodsLoading ? (
            <div className="inv-empty">Loading inventory…</div>
          ) : filteredGoods.length === 0 ? (
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
                  {filteredGoods.map((good, idx) => {
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
          )
        )}

        {/* ── OPERATIONAL ASSETS VIEW ── */}
        {activeTab === 'assets' && (
          assetsLoading ? (
            <div className="inv-empty">Loading operational assets…</div>
          ) : filteredAssets.length === 0 ? (
            <div className="inv-empty">
              {searchTerm
                ? `No assets matching "${searchTerm}"`
                : 'No operational assets yet. Assets are recorded when you purchase from a supplier in Add Cash Entry.'}
            </div>
          ) : (
            <div className="inv-table-wrapper">
              <table className="inv-table">
                <thead className="inv-thead">
                  <tr>
                    <th className="inv-col-frozen inv-col-num">#</th>
                    <th className="inv-col-frozen inv-col-name">ASSET NAME</th>
                    <th className="inv-col-center">QTY</th>
                    <th className="inv-col-right">UNIT COST</th>
                    <th className="inv-col-right">SUBTOTAL</th>
                    <th>SUPPLIER</th>
                    <th>REF</th>
                    <th className="inv-col-center">PAYMENT</th>
                    <th>DATE</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.map((asset, idx) => (
                    <tr key={asset.id} className="inv-data-row">
                      <td className="inv-col-frozen inv-col-num inv-num-cell">{idx + 1}</td>
                      <td className="inv-col-frozen inv-col-name inv-name-cell">
                        <span className="inv-cell-value">{asset.name || '—'}</span>
                      </td>
                      <td className="inv-col-center">
                        <span className="inv-cell-value">{asset.qty ?? '—'}</span>
                      </td>
                      <td className="inv-col-right">
                        <span className="inv-cell-value">{fmt(parseFloat(asset.costPrice || 0))}</span>
                      </td>
                      <td className="inv-col-right">
                        <span className="inv-cell-value">{fmt(parseFloat(asset.subtotal || 0))}</span>
                      </td>
                      <td className="inv-cat-cell">{asset.supplierName || '—'}</td>
                      <td className="inv-cat-cell">{asset.invoiceRef || '—'}</td>
                      <td className="inv-col-center">
                        <span className={`inv-badge ${asset.paymentType === 'cash' ? 'in-stock' : 'low-stock'}`}>
                          {asset.paymentType === 'cash' ? 'Cash' : 'Credit'}
                        </span>
                      </td>
                      <td className="inv-cat-cell">{formatDate(asset.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default Inventory;
