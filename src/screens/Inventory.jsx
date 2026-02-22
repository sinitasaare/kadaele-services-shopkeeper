import React, { useState, useEffect } from 'react';
import { Search, Barcode, X, Edit2, Camera, Upload } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera } from '@capacitor/camera';
import dataService from '../services/dataService';
import { useCurrency } from '../hooks/useCurrency';
import PdfTableButton from '../components/PdfTableButton';
import ImageViewer from '../components/ImageViewer';
import './Inventory.css';

function Inventory() {
  const { fmt } = useCurrency();
  const [goods, setGoods] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState(null);
  const [selectedGood, setSelectedGood] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedGood, setEditedGood] = useState(null);
  const [viewImg, setViewImg] = useState(null);
  const [saving, setSaving] = useState(false);

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

  const getBarcodeImageUrl = (good) =>
    good.barcodeImage || good.barcode_image || good.barcodeUrl || good.barcode_url || null;

  const openProductModal = (good) => {
    setSelectedGood(good);
    setEditedGood({...good});
    setIsEditing(false);
  };

  const closeProductModal = () => {
    setSelectedGood(null);
    setEditedGood(null);
    setIsEditing(false);
  };

  const startEditing = () => {
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setEditedGood({...selectedGood});
    setIsEditing(false);
  };

  const handleBarcodeCapture = async () => {
    if (!Capacitor.isNativePlatform()) {
      // Web: use file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            setEditedGood(prev => ({
              ...prev,
              barcodeImage: ev.target.result
            }));
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      // Mobile: use camera
      try {
        const image = await CapCamera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: 'dataUrl'
        });
        setEditedGood(prev => ({
          ...prev,
          barcodeImage: image.dataUrl
        }));
      } catch (error) {
        console.error('Camera error:', error);
        alert('Failed to capture barcode image');
      }
    }
  };

  const handleGalleryPick = async () => {
    if (!Capacitor.isNativePlatform()) {
      // Web: use file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            setEditedGood(prev => ({
              ...prev,
              barcodeImage: ev.target.result
            }));
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      // Mobile: pick from gallery
      try {
        const image = await CapCamera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: 'dataUrl',
          source: 'PHOTOS'
        });
        setEditedGood(prev => ({
          ...prev,
          barcodeImage: image.dataUrl
        }));
      } catch (error) {
        console.error('Gallery error:', error);
        alert('Failed to load image from gallery');
      }
    }
  };

  const saveChanges = async () => {
    if (!editedGood.name || !editedGood.name.trim()) {
      alert('Product name is required');
      return;
    }

    if (!editedGood.price || parseFloat(editedGood.price) < 0) {
      alert('Please enter a valid price');
      return;
    }

    setSaving(true);
    try {
      await dataService.updateGood(editedGood.id, {
        name: editedGood.name.trim(),
        price: parseFloat(editedGood.price),
        category: editedGood.category || '',
        barcode: editedGood.barcode || '',
        barcodeImage: editedGood.barcodeImage || null,
        stock_quantity: parseInt(editedGood.stock_quantity) || 0
      });

      await loadGoods();
      setSelectedGood(editedGood);
      setIsEditing(false);
      alert('Product updated successfully!');
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
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
          <div className="inv-table-wrapper" style={{position:'relative'}}>
          <PdfTableButton
            title="Inventory"
            columns={[
              {header:'#',key:'num'},{header:'Product Name',key:'name'},{header:'Category',key:'cat'},
              {header:'Price',key:'price'},{header:'Stock',key:'stock'},{header:'Status',key:'status'}
            ]}
            rows={filtered.map((g,i) => {
              const s = getStockStatus(g.stock_quantity);
              return { num:String(i+1), name:g.name||'—', cat:g.category||'—',
                price:fmt(g.price||0), stock:String(g.stock_quantity??'—'), status: s ? s.label : '—' };
            })}
            summary={[{label:'Total Items', value:String(filtered.length)}]}
          />
          <table className="inv-table">
            <thead className="inv-thead">
              <tr>
                <th className="inv-col-num inv-frozen-1">#</th>
                <th className="inv-frozen-2">PRODUCT NAME</th>
                <th>Category</th>
                <th className="inv-col-right">Price</th>
                <th className="inv-col-center">Stock</th>
                <th>Status</th>
                <th className="inv-col-center">Barcode</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((good, idx) => {
                const status = getStockStatus(good.stock_quantity);
                const hasBarcode = good.barcode || getBarcodeImageUrl(good);
                return (
                  <tr 
                    key={good.id} 
                    className="inv-row-clickable"
                    onClick={() => openProductModal(good)}
                  >
                    <td className="inv-col-num inv-num-cell inv-frozen-1">{idx + 1}</td>
                    <td className="inv-name-cell inv-frozen-2">{good.name || '—'}</td>
                    <td className="inv-cat-cell">{good.category || '—'}</td>
                    <td className="inv-col-right">{fmt(parseFloat(good.price || 0))}</td>
                    <td className="inv-col-center">{good.stock_quantity ?? '—'}</td>
                    <td>
                      {status ? (
                        <span className={`inv-badge ${status.cls}`}>{status.label}</span>
                      ) : '—'}
                    </td>
                    <td className="inv-col-center">
                      {hasBarcode ? (
                        <Barcode size={20} strokeWidth={1.5} className="inv-barcode-indicator" />
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

      {/* ── Product Detail Modal ── */}
      {selectedGood && (
        <div className="inv-modal-overlay" onClick={closeProductModal}>
          <div className="inv-modal-content" onClick={e => e.stopPropagation()}>
            <div className="inv-modal-header">
              <h2>{selectedGood.name}</h2>
              <div className="inv-modal-actions">
                <button className="inv-modal-close" onClick={closeProductModal}>
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="inv-modal-body">
              {/* Read-only view — inventory values are locked */}
              <div className="inv-view-details">
                  <div className="inv-detail-row">
                    <span className="inv-detail-label">Product Name:</span>
                    <span className="inv-detail-value">{selectedGood.name || '—'}</span>
                  </div>
                  <div className="inv-detail-row">
                    <span className="inv-detail-label">Price:</span>
                    <span className="inv-detail-value inv-detail-price">
                      {fmt(parseFloat(selectedGood.price || 0))}
                    </span>
                  </div>
                  <div className="inv-detail-row">
                    <span className="inv-detail-label">Category:</span>
                    <span className="inv-detail-value">{selectedGood.category || '—'}</span>
                  </div>
                  <div className="inv-detail-row">
                    <span className="inv-detail-label">Stock Quantity:</span>
                    <span className="inv-detail-value">{selectedGood.stock_quantity ?? '—'}</span>
                  </div>
                  <div className="inv-detail-row">
                    <span className="inv-detail-label">Status:</span>
                    <span className="inv-detail-value">
                      {(() => {
                        const status = getStockStatus(selectedGood.stock_quantity);
                        return status ? (
                          <span className={`inv-badge ${status.cls}`}>{status.label}</span>
                        ) : '—';
                      })()}
                    </span>
                  </div>
                  <div className="inv-detail-row">
                    <span className="inv-detail-label">Barcode:</span>
                    <span className="inv-detail-value">{selectedGood.barcode || '—'}</span>
                  </div>
                  {getBarcodeImageUrl(selectedGood) && (
                    <div className="inv-detail-barcode-image">
                      <span className="inv-detail-label">Barcode Image:</span>
                      <img 
                        src={getBarcodeImageUrl(selectedGood)} 
                        alt="Product Barcode" 
                        className="inv-detail-barcode-img"
                        onClick={() => setViewImg(getBarcodeImageUrl(selectedGood))}
                        style={{ cursor: 'zoom-in' }}
                        title="Tap to view full screen"
                      />
                    </div>
                  )}
                </div>
            </div>
          </div>
        </div>
      )}

      {viewImg && <ImageViewer src={viewImg} onClose={() => setViewImg(null)} alt="Product image" />}

    </div>
  );
}

export default Inventory;
