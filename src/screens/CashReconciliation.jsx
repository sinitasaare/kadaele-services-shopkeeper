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

function SessionBlock({ label, session, isLastSession, isOpen, onReopen, reopening }) {
  // session shape:
  //   For session 1 (root record): opened_by_name, opened_at_client, opening_float,
  //                                expected_cash, counted_cash, closed_by_name, closed_at_client
  //   For sessions 2+ (close_sessions[]): reopened_by_name, reopened_at, reopen_float,
  //                                       expected_cash, counted_cash, closed_by_name, closed_at

  const openedBy  = session.opened_by_name  || session.reopened_by_name || '—';
  const openedAt  = session.opened_at_client || session.reopened_at     || null;
  const float_    = session.opening_float    ?? session.reopen_float     ?? null;
  const expected  = session.expected_cash    ?? null;
  const counted   = session.counted_cash     ?? null;
  const closedBy  = session.closed_by_name   || null;
  const closedAt  = session.closed_at_client || session.closed_at        || null;

  return (
    <div className="cr-session-block">
      {label && (
        <div className="cr-session-label">
          <span className="cr-session-label-text">{label}</span>
        </div>
      )}

      <div className="cr-summary-row">
        <span className="cr-summary-label">Opened by</span>
        <span className="cr-summary-value">{openedBy}</span>
      </div>
      <div className="cr-summary-row">
        <span className="cr-summary-label">Opened at</span>
        <span className="cr-summary-value">{formatTime(openedAt)}</span>
      </div>
      <div className="cr-summary-row">
        <span className="cr-summary-label">Opening Float</span>
        <span className="cr-summary-value">{float_ !== null ? fmt(float_) : '—'}</span>
      </div>
      <div className="cr-summary-row">
        <span className="cr-summary-label">Expected Cash in drawer</span>
        <span className="cr-summary-value expected">{expected !== null ? fmt(expected) : '—'}</span>
      </div>
      <div className="cr-summary-row">
        <span className="cr-summary-label">Counted Cash in drawer</span>
        <span className="cr-summary-value">
          {counted !== null && counted !== undefined ? fmt(counted) : '—'}
        </span>
      </div>
      <div className="cr-summary-row">
        <span className="cr-summary-label">Closed by</span>
        <span className="cr-summary-value">{closedBy || '—'}</span>
      </div>
      <div className="cr-summary-row" style={{ borderBottom: 'none' }}>
        <span className="cr-summary-label">Closed at</span>
        <span className="cr-summary-value">{closedAt ? formatTime(closedAt) : '—'}</span>
      </div>

      {/* Re-Open Shop — only on the last session block when day is closed */}
      {isLastSession && isOpen === false && (
        <button
          className="cr-btn-reopen"
          onClick={onReopen}
          disabled={reopening}
        >
          {reopening ? 'Reopening…' : '🔓 Re-Open Shop'}
        </button>
      )}
    </div>
  );
}

function DetailModal({ record, onClose, onReopen, onStoreStatusChange }) {
  const [reopening, setReopening] = useState(false);
  if (!record) return null;

  // close_sessions[] holds sessions 2, 3, 4 … (each archived when day was re-opened)
  // The root record always represents the current / last active session.
  const closeSessions = Array.isArray(record.close_sessions) ? record.close_sessions : [];
  // Total sessions: 1 (root) + number of times day was re-opened
  const totalSessions = 1 + closeSessions.length;
  const hasMultipleSessions = totalSessions > 1;

  // Build ordered session list:
  // closeSessions[0] = session 2 (was first re-open), closeSessions[1] = session 3, etc.
  // Root record = LAST session (currently active / most recent)
  // We display them in chronological order:
  //   Session 1 = root record's ORIGINAL open (before any re-opens)
  //   Session 2 = closeSessions[0]
  //   …
  //   Session N = root record (current)

  // For the "first" session we use root record's opened_by / opened_at / opening_float.
  // After a re-open the root record gets reopened_by_name/reopened_at for the new session,
  // but the original open fields are preserved on the root record.

  // Build an array of session data objects in display order:
  const sessions = [];

  if (!hasMultipleSessions) {
    // Only one session — no label header
    sessions.push({ data: record, label: null, isRoot: true });
  } else {
    // Multiple sessions — label each one
    // Session 1: the original open, using root record's original open fields
    sessions.push({
      data: {
        opened_by_name:  record.opened_by_name,
        opened_at_client: record.opened_at_client,
        opening_float:   record.opening_float,
        // Session 1's expected/counted/closed come from closeSessions[0] (archived when first re-opened)
        expected_cash:   closeSessions[0]?.expected_cash   ?? record.expected_cash,
        counted_cash:    closeSessions[0]?.counted_cash    ?? null,
        closed_by_name:  closeSessions[0]?.closed_by_name  || null,
        closed_at_client: closeSessions[0]?.closed_at      || null,
      },
      label: 'First Session',
      isRoot: false,
    });

    // Sessions 2 … N-1: from closeSessions[1] onward
    const ordinals = ['Second','Third','Fourth','Fifth','Sixth','Seventh','Eighth','Ninth','Tenth'];
    for (let i = 1; i < closeSessions.length; i++) {
      const sess = closeSessions[i];
      sessions.push({
        data: {
          reopened_by_name: closeSessions[i-1]?.reopened_by_name || null,
          reopened_at:      closeSessions[i-1]?.reopened_at      || null,
          reopen_float:     sess.reopen_float,
          expected_cash:    sess.expected_cash,
          counted_cash:     sess.counted_cash,
          closed_by_name:   sess.closed_by_name,
          closed_at:        sess.closed_at,
        },
        label: `${ordinals[i] || `#${i+1}`} Session`,
        isRoot: false,
      });
    }

    // Last session: current root record (re-opened, now active or just closed again)
    const lastCloseSession = closeSessions[closeSessions.length - 1];
    sessions.push({
      data: {
        reopened_by_name: lastCloseSession?.reopened_by_name || record.reopened_by_name || null,
        reopened_at:      lastCloseSession?.reopened_at      || record.reopened_at      || null,
        reopen_float:     record.opening_float, // after re-open, root opening_float is updated
        expected_cash:    record.expected_cash,
        counted_cash:     record.counted_cash,
        closed_by_name:   record.closed_by_name,
        closed_at_client: record.closed_at_client,
      },
      label: `${ordinals[closeSessions.length] || `#${closeSessions.length+1}`} Session`,
      isRoot: true,
    });
  }

  const handleReopen = async () => {
    if (!window.confirm('Re-open this day? A new session will begin and the day will be marked as open again.')) return;
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

  const isDayClosed = record.status === 'closed';

  return (
    <div className="cr-overlay" onClick={onClose}>
      <div className="cr-detail-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="cr-detail-header">
          <span className="cr-detail-title">{formatDateLabel(record.business_date)}</span>
          <button className="cr-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Day Summary card */}
        <div className="cr-card" style={{ gap: 10 }}>
          <p className="cr-card-title">Day Summary</p>
          <div className="cr-summary-row" style={{ borderBottom: 'none' }}>
            <span className="cr-summary-label">Status</span>
            <span className={`cr-record-status ${record.status}`}>{record.status}</span>
          </div>
        </div>

        {/* Session blocks */}
        {sessions.map((sess, idx) => (
          <SessionBlock
            key={idx}
            label={sess.label}
            session={sess.data}
            isLastSession={idx === sessions.length - 1}
            isOpen={!isDayClosed}
            onReopen={handleReopen}
            reopening={reopening}
          />
        ))}

        {/* Unlock events — audit trail */}
        {Array.isArray(record.unlock_events) && record.unlock_events.length > 0 && (
          <div className="cr-card" style={{ gap: 8 }}>
            <p className="cr-card-title">🔓 Checkout Unlocks ({record.unlock_events.length})</p>
            {record.unlock_events.map((ev, i) => (
              <div key={i} className="cr-summary-row" style={{ fontSize: '12px' }}>
                <span className="cr-summary-label">{ev.name || 'Staff'}</span>
                <span className="cr-summary-value">{formatTime(ev.at)}</span>
              </div>
            ))}
          </div>
        )}

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
