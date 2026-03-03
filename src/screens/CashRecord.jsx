
import React, { useEffect, useState, useMemo } from "react";
import * as dataService from "../services/dataService";

const DEBTORS_PAGE_INDEX   = 6;
const PURCHASE_PAGE_INDEX  = 4;
const EXPENSES_PAGE_INDEX  = 3;

export default function CashRecord({ onNavigate }) {
  const [cashEntries, setCashEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  const [form, setForm] = useState({
    type: "in",
    amount: "",
    partyType: "owner",
    partyName: "",
    reason: "",
    note: "",
    ref: ""
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const entries = await dataService.getAll("cash_entries");
    setCashEntries(entries || []);
    setLoading(false);
  }

  const filteredEntries = useMemo(() => {
    return cashEntries.filter(entry => {
      if (typeFilter !== "all" && entry.type !== typeFilter) return false;
      if (sourceFilter !== "all" && entry.source !== sourceFilter) return false;
      return true;
    });
  }, [cashEntries, typeFilter, sourceFilter]);

  function getSourceLabel(source) {
    switch (source) {
      case "sale": return "Sale";
      case "purchase": return "Purchase";
      case "expense": return "Expense";
      case "debt_payment": return "Debt Payment";
      case "manual": return "Manual";
      default: return source;
    }
  }

  function getBadgeStyle(source) {
    const colors = {
      sale: "#4caf50",
      purchase: "#f44336",
      expense: "#ff9800",
      debt_payment: "#2196f3",
      manual: "#9c27b0"
    };
    return {
      backgroundColor: colors[source] || "#777",
      color: "#fff",
      padding: "2px 6px",
      borderRadius: 4,
      fontSize: 12
    };
  }

  function getReasons(type) {
    if (type === "in") {
      return [
        "Opening Float Added",
        "Owner Cash Injection",
        "Bank Withdrawal",
        "Safe/Box Transfer In",
        "Cash Advance Returned",
        "Correction: Cash Over",
        "Other"
      ];
    }
    return [
      "Float Reduced",
      "Bank Deposit",
      "Safe/Box Transfer Out",
      "Owner Withdrawal",
      "Correction: Cash Short",
      "Other"
    ];
  }

  async function handleSave() {
    if (!form.amount || !form.reason) {
      alert("Amount and reason are required.");
      return;
    }

    if (form.reason === "Other" && !form.note) {
      alert("Note required when reason is Other.");
      return;
    }

    await dataService.addCashEntryManual({
      ...form,
      amount: Number(form.amount)
    });

    setShowModal(false);
    setForm({
      type: "in",
      amount: "",
      partyType: "owner",
      partyName: "",
      reason: "",
      note: "",
      ref: ""
    });

    await load();
  }

  function handleEntryRowClick(entry) {
    if (!onNavigate) return;
    // debt_payment entries → navigate to Debtors (read-only there)
    if (entry.source === "debt_payment") {
      onNavigate(DEBTORS_PAGE_INDEX);
    }
    // purchase entries → navigate to Purchase Record (read-only there)
    if (entry.source === "purchase") {
      onNavigate(PURCHASE_PAGE_INDEX);
    }
    // expense entries → navigate to Expenses Record (read-only there)
    if (entry.source === "expense") {
      onNavigate(EXPENSES_PAGE_INDEX);
    }
  }

  function isLinkedReadOnly(entry) {
    return entry.source === "debt_payment" || entry.source === "purchase" || entry.source === "expense";
  }

  function linkedLabel(entry) {
    if (entry.source === "debt_payment") return "View Debtor →";
    if (entry.source === "purchase")     return "View Purchase →";
    if (entry.source === "expense")      return "View Expense →";
    return null;
  }

  function linkedRowStyle(entry) {
    if (entry.source === "debt_payment") return { cursor: "pointer", background: "#e8f4fd" };
    if (entry.source === "purchase")     return { cursor: "pointer", background: "#fff7ed" };
    if (entry.source === "expense")      return { cursor: "pointer", background: "#f0fdf4" };
    return {};
  }

  function linkedRowTitle(entry) {
    if (entry.source === "debt_payment") return "Tap to view in Debtors screen";
    if (entry.source === "purchase")     return "Tap to view in Purchase Record";
    if (entry.source === "expense")      return "Tap to view in Expenses Record";
    return undefined;
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Cash Record</h2>

      <div style={{ marginBottom: 10 }}>
        <label>Type Filter: </label>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="in">IN</option>
          <option value="out">OUT</option>
        </select>

        <label style={{ marginLeft: 15 }}>Source Filter: </label>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="sale">Sale</option>
          <option value="purchase">Purchase</option>
          <option value="expense">Expense</option>
          <option value="debt_payment">Debt Payment</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      <button onClick={() => setShowModal(true)}>
        + Manual Cash Entry
      </button>

      <table width="100%" border="1" cellPadding="6" style={{ marginTop: 15 }}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Source</th>
            <th>Note</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredEntries.map((entry) => {
            const readOnly = isLinkedReadOnly(entry);
            const label    = linkedLabel(entry);
            return (
              <tr key={entry.id}
                style={linkedRowStyle(entry)}
                title={linkedRowTitle(entry)}
                onClick={readOnly ? () => handleEntryRowClick(entry) : undefined}
              >
                <td>{new Date(entry.createdAt).toLocaleString()}</td>
                <td>{entry.type}</td>
                <td>{entry.amount}</td>
                <td>
                  <span style={getBadgeStyle(entry.source)}>
                    {getSourceLabel(entry.source)}
                  </span>
                </td>
                <td>{entry.note || ""}</td>
                <td>
                  {label ? (
                    <span
                      style={{ color: "#2196f3", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
                      onClick={(e) => { e.stopPropagation(); handleEntryRowClick(entry); }}
                    >
                      {label}
                    </span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {showModal && (
        <div style={modalStyle}>
          <div style={modalContentStyle}>
            <h3>Manual Cash Entry</h3>

            <label>Type</label>
            <select value={form.type} onChange={(e) => setForm({...form, type: e.target.value, reason: ""})}>
              <option value="in">IN</option>
              <option value="out">OUT</option>
            </select>

            <label>Amount</label>
            <input type="number" value={form.amount}
              onChange={(e) => setForm({...form, amount: e.target.value})} />

            <label>Party Type</label>
            <select value={form.partyType}
              onChange={(e) => setForm({...form, partyType: e.target.value})}>
              <option value="owner">Owner</option>
              <option value="staff">Staff</option>
              <option value="bank">Bank</option>
              <option value="customer_unlinked">Customer (Unlinked)</option>
              <option value="other">Other</option>
            </select>

            {(form.partyType !== "owner" && form.partyType !== "bank") && (
              <>
                <label>Party Name</label>
                <input value={form.partyName}
                  onChange={(e) => setForm({...form, partyName: e.target.value})} />
              </>
            )}

            <label>Reason</label>
            <select value={form.reason}
              onChange={(e) => setForm({...form, reason: e.target.value})}>
              <option value="">Select reason</option>
              {getReasons(form.type).map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            <label>Note</label>
            <input value={form.note}
              onChange={(e) => setForm({...form, note: e.target.value})} />

            <label>Reference (optional)</label>
            <input value={form.ref}
              onChange={(e) => setForm({...form, ref: e.target.value})} />

            <div style={{ marginTop: 15 }}>
              <button onClick={handleSave}>Save</button>
              <button onClick={() => setShowModal(false)} style={{ marginLeft: 10 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const modalStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.4)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center"
};

const modalContentStyle = {
  backgroundColor: "#fff",
  padding: 20,
  width: 350,
  display: "flex",
  flexDirection: "column",
  gap: 8
};
