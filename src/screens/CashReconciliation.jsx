import React, { useState, useEffect, useCallback } from 'react';
import dataService from '../services/dataService';
import { auth } from '../services/firebaseConfig';
import './CashReconciliation.css';

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmt(amount) {
  const sym = dataService.getCurrencySymbol?.() || '$';
  return `${sym}${(parseFloat(amount) || 0).toFixed(2)}`;
}

function formatDateLabel(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday:'short', year:'numeric', month:'short', day:'numeric' });
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString(undefined, { hour:'2-digit', minute:'2-digit' });
}

// ── Detail Modal ─────────────────────────────────────────────────────────────

function DetailModal({ record, onClose, onReopen, onStoreStatusChange }) {
  const [reopening, setReopening] = useState(false);
  if (!record) return null;

  const diff = (record.counted_cash ?? null) !== null
    ? record.counted_cash - record.expected_cash
    : null;

  const closeSessions = Array.isArray(record.close_sessions) ? record.close_sessions : [];

  const handleReopen = async () => {
    if (!window.confirm('Re-open this day? The close record will be cleared and the day will be marked as open again.')) return;
    setReopening(true);
    try {
      await dataService.reopenDay(record.business_date);
      if (onStoreStatusChange) onStoreStatusChange(true);
      onReopen();
      onClose();
    } catch (e) {
      alert('Failed to re-open day: ' + e.message);
    } finally { setReopening(false); }
  };

  return (
    <div className="cr-overlay" onClick={onClose}>
      <div className="cr-detail-modal" onClick={e => e.stopPropagation()}>
        <div className="cr-detail-header">
          <span className="cr-detail-title">{formatDateLabel(record.business_date)}</span>
          <button className="cr-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="cr-card" style={{ gap:10 }}>
          <p className="cr-card-title">Day Summary</p>
          <div className="cr-summary-row">
            <span className="cr-summary-label">Status</span>
            <span className={`cr-record-status ${record.status}`}>{record.status}</span>
          </div>
          <div className="cr-summary-row">
            <span className="cr-summary-label">Opening Float</span>
            <span className="cr-summary-value">{fmt(record.opening_float)}</span>
          </div>
          <div className="cr-summary-row">
            <span className="cr-summary-label">Expected Cash</span>
            <span className="cr-summary-value expected">{fmt(record.expected_cash)}</span>
          </div>
          {record.counted_cash !== null && record.counted_cash !== undefined && (
            <div className="cr-summary-row">
              <span className="cr-summary-label">Counted Cash</span>
              <span className="cr-summary-value">{fmt(record.counted_cash)}</span>
            </div>
          )}
          {diff !== null && (
            <div className="cr-summary-row">
              <span className="cr-summary-label">Difference</span>
              <span className={`cr-summary-value ${diff === 0 ? 'diff-zero' : diff < 0 ? 'diff-neg' : 'diff-pos'}`}>
                {diff >= 0 ? '+' : ''}{fmt(diff)}
                {diff === 0 && ' ✅ Balanced'}
                {diff < 0 && ' ⚠️ Short'}
                {diff > 0 && ' ⚠️ Surplus'}
              </span>
            </div>
          )}

          {/* ── Re-opening sessions (2nd, 3rd, …) ── */}
          {closeSessions.map((sess, idx) => {
            const sessionNum = idx + 2; // 1st close = original, 2nd close = index 0, etc.
            const ordinals = ['Second', 'Third', 'Fourth', 'Fifth'];
            const ordinal = ordinals[idx] || `#${sessionNum}`;
            const sessDiff = (sess.counted_cash ?? null) !== null
              ? sess.counted_cash - sess.expected_cash
              : null;
            return (
              <React.Fragment key={idx}>
                <hr style={{ border:'none', borderTop:'1px solid var(--border,#e5e7eb)', margin:'10px 0 6px' }} />
                <p style={{ fontSize:'12px', fontWeight:700, color:'#4f46e5', margin:'2px 0 6px' }}>
                  🔄 {ordinal} Session
                </p>
                <div className="cr-summary-row">
                  <span className="cr-summary-label">
                    {idx === 0 ? 'Re-opening Float' : `${ordinal} re-opening Float`}
                  </span>
                  <span className="cr-summary-value">{fmt(sess.reopen_float)}</span>
                </div>
                <div className="cr-summary-row">
                  <span className="cr-summary-label">
                    {idx === 0 ? 'Expected Cash after re-opening' : `Expected Cash after ${ordinal.toLowerCase()} re-opening`}
                  </span>
                  <span className="cr-summary-value expected">{fmt(sess.expected_cash)}</span>
                </div>
                {sess.counted_cash !== null && sess.counted_cash !== undefined && (
                  <div className="cr-summary-row">
                    <span className="cr-summary-label">
                      {idx === 0 ? 'Counted Cash before second opening is closed' : `Counted Cash before ${ordinal.toLowerCase()} opening is closed`}
                    </span>
                    <span className="cr-summary-value">{fmt(sess.counted_cash)}</span>
                  </div>
                )}
                {sessDiff !== null && (
                  <div className="cr-summary-row">
                    <span className="cr-summary-label">
                      {idx === 0 ? 'Difference' : `Difference of ${ordinal.toLowerCase()} opening`}
                    </span>
                    <span className={`cr-summary-value ${sessDiff === 0 ? 'diff-zero' : sessDiff < 0 ? 'diff-neg' : 'diff-pos'}`}>
                      {sessDiff >= 0 ? '+' : ''}{fmt(sessDiff)}
                      {sessDiff === 0 && ' ✅ Balanced'}
                      {sessDiff < 0 && ' ⚠️ Short'}
                      {sessDiff > 0 && ' ⚠️ Surplus'}
                    </span>
                  </div>
                )}
                {sess.notes ? (
                  <div className="cr-summary-row">
                    <span className="cr-summary-label">Notes</span>
                    <span className="cr-summary-value" style={{ textAlign:'right', maxWidth:'60%' }}>{sess.notes}</span>
                  </div>
                ) : null}
              </React.Fragment>
            );
          })}

          {record.notes ? (
            <div className="cr-summary-row">
              <span className="cr-summary-label">Notes</span>
              <span className="cr-summary-value" style={{ textAlign:'right', maxWidth:'60%' }}>{record.notes}</span>
            </div>
          ) : null}
        </div>

        <div className="cr-card" style={{ gap:10 }}>
          <p className="cr-card-title">Staff</p>
          <div className="cr-summary-row">
            <span className="cr-summary-label">Opened by</span>
            <span className="cr-summary-value">{record.opened_by_name || '—'}</span>
          </div>
          <div className="cr-summary-row">
            <span className="cr-summary-label">Opened at</span>
            <span className="cr-summary-value">{formatTime(record.opened_at_client)}</span>
          </div>
          {record.closed_by_name && (
            <>
              <div className="cr-summary-row">
                <span className="cr-summary-label">Closed by</span>
                <span className="cr-summary-value">{record.closed_by_name}</span>
              </div>
              <div className="cr-summary-row">
                <span className="cr-summary-label">Closed at</span>
                <span className="cr-summary-value">{formatTime(record.closed_at_client)}</span>
              </div>
            </>
          )}
          {record.reopened_by_name && (
            <>
              <div className="cr-summary-row">
                <span className="cr-summary-label">Reopened by</span>
                <span className="cr-summary-value">{record.reopened_by_name}</span>
              </div>
              <div className="cr-summary-row">
                <span className="cr-summary-label">Reopened at</span>
                <span className="cr-summary-value">{formatTime(record.reopened_at)}</span>
              </div>
            </>
          )}

          {/* Unlock events — shown when any unlock was recorded */}
          {Array.isArray(record.unlock_events) && record.unlock_events.length > 0 && (
            <>
              <hr style={{ border:'none', borderTop:'1px solid var(--border,#e5e7eb)', margin:'8px 0' }} />
              <p style={{ fontSize:'12px', fontWeight:700, color:'#4f46e5', margin:'4px 0 6px' }}>
                🔓 Checkout Unlocks ({record.unlock_events.length})
              </p>
              {record.unlock_events.map((ev, i) => (
                <div key={i} className="cr-summary-row" style={{ fontSize:'12px' }}>
                  <span className="cr-summary-label">{ev.name || 'Staff'}</span>
                  <span className="cr-summary-value">{formatTime(ev.at)}</span>
                </div>
              ))}
            </>
          )}

          {/* Re-open button — only shown if day is closed */}
          {record.status === 'closed' && (
            <div style={{ marginTop:'8px' }}>
              <button
                onClick={handleReopen}
                disabled={reopening}
                style={{
                  width:'100%', padding:'10px', borderRadius:'8px', border:'none',
                  background:'#4f46e5', color:'white', cursor:'pointer', fontWeight:700, fontSize:'14px'
                }}
              >
                {reopening ? 'Reopening…' : '🔓 Re-Open Day'}
              </button>
              <p style={{ fontSize:'11px', color:'#6b7280', textAlign:'center', marginTop:'6px' }}>
                This will revert the close and allow new entries.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

function CashReconciliation({ onStoreStatusChange }) {
  const [activeTab, setActiveTab]       = useState('today');
  const [loading, setLoading]           = useState(true);
  const [todayRecord, setTodayRecord]   = useState(null);
  const [records, setRecords]           = useState([]);
  const [liveSummary, setLiveSummary]   = useState(null);
  const [detailRecord, setDetailRecord] = useState(null);

  // Open Day form
  const [openingFloat, setOpeningFloat] = useState('');
  const [openingSaving, setOpeningSaving] = useState(false);

  // Close Day form
  const [countedCash, setCountedCash]   = useState('');
  const [closeNotes, setCloseNotes]     = useState('');
  const [closeSaving, setCloseSaving]   = useState(false);

  const today = todayStr();

  // ── Load data ────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const allRecs = await dataService.getDailyCashRecords();
      const rec = (allRecs || []).find(r => r.business_date === today) || null;
      setTodayRecord(rec);
      setRecords((allRecs || []).sort((a, b) => b.business_date.localeCompare(a.business_date)));
      const summary = await dataService.calculateExpectedCash(today);
      setLiveSummary(summary);
    } catch (e) {
      console.error('CashReconciliation loadData error:', e);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      if (user) {
        dataService._dailyCashFetched = false;
        loadData();
      }
    });
    return () => unsub();
  }, [loadData]);

  // ── Open Day ─────────────────────────────────────────────────────────────

  const handleOpenDay = async () => {
    const float = parseFloat(openingFloat);
    if (isNaN(float) || float < 0) { alert('Please enter a valid opening float (0 or more).'); return; }
    setOpeningSaving(true);
    try {
      await dataService.openDay({ opening_float: float });
      setOpeningFloat('');
      if (onStoreStatusChange) onStoreStatusChange(true);
      await loadData();
    } catch (e) {
      alert('Failed to open day: ' + e.message);
    } finally { setOpeningSaving(false); }
  };

  // ── Close Day ────────────────────────────────────────────────────────────

  const handleCloseDay = async () => {
    const counted = parseFloat(countedCash);
    if (isNaN(counted) || counted < 0) { alert('Please enter the counted cash amount.'); return; }

    const summary = await dataService.calculateExpectedCash(today);
    const diff = counted - summary.expected;

    // Notes required if not balanced
    if (diff !== 0 && !closeNotes.trim()) {
      alert(diff < 0
        ? 'Notes are required when cash is SHORT. Please explain why.'
        : 'Notes are required when cash is SURPLUS. Please explain why.');
      return;
    }
    setCloseSaving(true);
    try {
      await dataService.closeDay({ counted_cash: counted, notes: closeNotes.trim() });
      setCountedCash('');
      setCloseNotes('');
      if (onStoreStatusChange) onStoreStatusChange(false);
      await loadData();
    } catch (e) {
      alert('Failed to close day: ' + e.message);
    } finally { setCloseSaving(false); }
  };

  // ── Render helpers ───────────────────────────────────────────────────────

  const renderStatusBanner = () => {
    if (!todayRecord) {
      return (
        <div className="cr-status-banner none">
          <span className="cr-status-dot" />
          Day not started — tap Open Day to begin
        </div>
      );
    }
    if (todayRecord.status === 'open') {
      return (
        <div className="cr-status-banner open">
          <span className="cr-status-dot" />
          Day is OPEN — opened by {todayRecord.opened_by_name || 'staff'} at {formatTime(todayRecord.opened_at_client)}
        </div>
      );
    }
    return (
      <div className="cr-status-banner closed">
        <span className="cr-status-dot" />
        Day CLOSED — closed by {todayRecord.closed_by_name || 'staff'} at {formatTime(todayRecord.closed_at_client)}
      </div>
    );
  };

  const renderTodayTab = () => {
    if (loading) return <div className="cr-loading">Loading…</div>;

    // ── No open day ──
    if (!todayRecord) {
      return (
        <>
          {renderStatusBanner()}
          <div className="cr-card">
            <p className="cr-card-title">Open Day</p>
            <div className="cr-field">
              <label className="cr-label">Opening Float ($)</label>
              <input
                type="number"
                className="cr-input"
                placeholder="0.00"
                min="0"
                step="0.01"
                value={openingFloat}
                onChange={e => setOpeningFloat(e.target.value)}
              />
            </div>
            <button
              className="cr-btn cr-btn-open"
              onClick={handleOpenDay}
              disabled={openingSaving || openingFloat === ''}
            >
              {openingSaving ? 'Opening…' : '✅ Open Day'}
            </button>
          </div>
        </>
      );
    }

    // ── Day is closed ──
    if (todayRecord.status === 'closed') {
      const diff = todayRecord.counted_cash - todayRecord.expected_cash;
      return (
        <>
          {renderStatusBanner()}
          <div className="cr-card">
            <p className="cr-card-title">Today's Summary</p>
            <div className="cr-summary-row">
              <span className="cr-summary-label">Opening Float</span>
              <span className="cr-summary-value">{fmt(todayRecord.opening_float)}</span>
            </div>
            <div className="cr-summary-row">
              <span className="cr-summary-label">Cash In (sales + payments)</span>
              <span className="cr-summary-value in">+{fmt(liveSummary?.sum_in || 0)}</span>
            </div>
            <div className="cr-summary-row">
              <span className="cr-summary-label">Cash Out (purchases + expenses)</span>
              <span className="cr-summary-value out">-{fmt(liveSummary?.sum_out || 0)}</span>
            </div>
            <hr className="cr-divider" />
            <div className="cr-summary-row">
              <span className="cr-summary-label">Expected Cash</span>
              <span className="cr-summary-value expected">{fmt(todayRecord.expected_cash)}</span>
            </div>
            <div className="cr-summary-row">
              <span className="cr-summary-label">Counted Cash</span>
              <span className="cr-summary-value">{fmt(todayRecord.counted_cash)}</span>
            </div>
            <div className="cr-summary-row">
              <span className="cr-summary-label">Difference</span>
              <span className={`cr-summary-value ${diff === 0 ? 'diff-zero' : diff < 0 ? 'diff-neg' : 'diff-pos'}`}>
                {diff >= 0 ? '+' : ''}{fmt(diff)}
                {diff < 0 && ' ⚠️ Short'}
                {diff > 0 && ' ⚠️ Surplus'}
                {diff === 0 && ' ✅ Balanced'}
              </span>
            </div>
            {todayRecord.notes ? (
              <div className="cr-summary-row">
                <span className="cr-summary-label">Notes</span>
                <span className="cr-summary-value" style={{ textAlign:'right', maxWidth:'65%', fontSize:13 }}>{todayRecord.notes}</span>
              </div>
            ) : null}
          </div>
          <div className="cr-closed-msg">
            <span className="cr-closed-icon">🔒</span>
            <span className="cr-closed-title">Day Closed</span>
            <span className="cr-closed-sub">This day's record is locked. View it in the Records tab.</span>
          </div>
        </>
      );
    }

    // ── Day is open — show live summary + close day form ──
    const expected = liveSummary?.expected ?? todayRecord.opening_float;
    const countedVal = parseFloat(countedCash) || 0;
    const previewDiff = countedCash !== '' ? countedVal - expected : null;

    // Determine note placeholder based on preview diff
    const notesPlaceholder = previewDiff === null
      ? 'Notes (optional)…'
      : previewDiff < 0
        ? 'Reason why balance is SHORT…'
        : previewDiff > 0
          ? 'Reason why balance is SURPLUS…'
          : 'Notes (optional)…';

    // Show notes only when reconciliation is "over" or "under" (not balanced, not empty)
    const showNotes = previewDiff !== null && previewDiff !== 0;

    return (
      <>
        {renderStatusBanner()}

        {/* Live cash summary */}
        <div className="cr-card">
          <p className="cr-card-title">Live Cash Summary</p>
          <div className="cr-summary-row">
            <span className="cr-summary-label">Opening Float</span>
            <span className="cr-summary-value">{fmt(todayRecord.opening_float)}</span>
          </div>
          <div className="cr-summary-row">
            <span className="cr-summary-label">Cash In today</span>
            <span className="cr-summary-value in">+{fmt(liveSummary?.sum_in || 0)}</span>
          </div>
          <div className="cr-summary-row">
            <span className="cr-summary-label">Cash Out today</span>
            <span className="cr-summary-value out">-{fmt(liveSummary?.sum_out || 0)}</span>
          </div>
          <hr className="cr-divider" />
          <div className="cr-summary-row">
            <span className="cr-summary-label">Expected Cash Now</span>
            <span className="cr-summary-value expected">{fmt(expected)}</span>
          </div>
        </div>

        {/* Close Day form */}
        <div className="cr-card">
          <p className="cr-card-title">Close Day</p>
          <div className="cr-field">
            <label className="cr-label">Counted Cash ($)</label>
            <input
              type="number"
              className="cr-input"
              placeholder="Enter amount in cash drawer"
              min="0"
              step="0.01"
              value={countedCash}
              onChange={e => { setCountedCash(e.target.value); setCloseNotes(''); }}
            />
          </div>

          {previewDiff !== null && (
            <div className={`cr-status-banner ${previewDiff === 0 ? 'open' : 'none'}`} style={{ fontSize:13 }}>
              <span className="cr-status-dot" />
              Difference: {previewDiff >= 0 ? '+' : ''}{fmt(previewDiff)}
              {previewDiff === 0 && ' ✅ Balanced'}
              {previewDiff < 0 && ' ⚠️ Short — notes required'}
              {previewDiff > 0 && ' ⚠️ Surplus — notes required'}
            </div>
          )}

          {/* Notes field — hidden until imbalance detected */}
          {showNotes && (
            <div className="cr-field">
              <label className="cr-label">
                Notes <span style={{ color:'#dc2626' }}>(required)</span>
              </label>
              <textarea
                className="cr-input cr-textarea"
                placeholder={notesPlaceholder}
                value={closeNotes}
                onChange={e => setCloseNotes(e.target.value)}
              />
            </div>
          )}

          <button
            className="cr-btn cr-btn-close"
            onClick={handleCloseDay}
            disabled={closeSaving || countedCash === ''}
          >
            {closeSaving ? 'Closing…' : '🔒 Close Day'}
          </button>
        </div>
      </>
    );
  };

  const renderRecordsTab = () => {
    if (loading) return <div className="cr-loading">Loading…</div>;
    if (records.length === 0) return <div className="cr-empty">No daily records yet.</div>;

    return (
      <div className="cr-records-list">
        {records.map(rec => {
          const diff = rec.status === 'closed' && rec.counted_cash !== null
            ? rec.counted_cash - rec.expected_cash
            : null;
          return (
            <div key={rec.id} className="cr-record-row" onClick={() => setDetailRecord(rec)}>
              <span className={`cr-record-dot ${rec.status}`} />
              <div className="cr-record-info">
                <div className="cr-record-date">{formatDateLabel(rec.business_date)}</div>
                <div className="cr-record-meta">
                  Opened by {rec.opened_by_name || '—'}
                  {rec.closed_by_name ? ` · Closed by ${rec.closed_by_name}` : ''}
                  {rec.reopened_by_name ? ` · Reopened by ${rec.reopened_by_name}` : ''}
                  {Array.isArray(rec.unlock_events) && rec.unlock_events.length > 0
                    ? ` · 🔓 ${rec.unlock_events.length} unlock${rec.unlock_events.length > 1 ? 's' : ''}`
                    : ''}
                </div>
              </div>
              <div className="cr-record-right">
                <span className={`cr-record-status ${rec.status}`}>{rec.status}</span>
                {diff !== null && (
                  <div className={`cr-record-diff ${diff === 0 ? 'zero' : diff < 0 ? 'neg' : 'pos'}`}>
                    {diff >= 0 ? '+' : ''}{fmt(diff)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="cr-screen">
      {/* Tab bar */}
      <div className="cr-tabs">
        <button
          className={`cr-tab ${activeTab === 'today' ? 'active' : ''}`}
          onClick={() => setActiveTab('today')}
        >
          Today — {today}
        </button>
        <button
          className={`cr-tab ${activeTab === 'records' ? 'active' : ''}`}
          onClick={() => setActiveTab('records')}
        >
          Records
        </button>
      </div>

      {/* Body */}
      <div className="cr-body">
        {activeTab === 'today' ? renderTodayTab() : renderRecordsTab()}
      </div>

      {/* Detail modal */}
      {detailRecord && (
        <DetailModal
          record={detailRecord}
          onClose={() => setDetailRecord(null)}
          onReopen={() => { loadData(); }}
          onStoreStatusChange={onStoreStatusChange}
        />
      )}
    </div>
  );
}

export default CashReconciliation;
