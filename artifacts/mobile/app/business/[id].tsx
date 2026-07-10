import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CATEGORY_LIST, getCategoryColor, getCategoryIcon } from "@/components/CategoryBadge";
import { DatePickerField } from "@/components/DatePickerField";
import { useMockAuth } from "@/context/MockAuthContext";
import { useColors } from "@/hooks/useColors";

import { API_BASE } from "@/constants/api";

interface Bill {
  id: string;
  vendor: string;
  amount: number;
  date: string;
  category: string;
  notes: string;
  expenseBy: string;
  createdAt: string;
}

interface TripDetail {
  id: string;
  name: string;
  destination: string;
  purpose: string;
  startDate: string;
  endDate: string;
  bills: Bill[];
}

function formatAmount(n: number): string {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(s: string): string {
  if (!s) return "";
  try {
    return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch { return s; }
}

function AddBillModal({
  visible,
  onClose,
  onSaved,
  tripId,
  token,
  defaultExpenseBy,
  editingBill,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: (bill: Bill) => void;
  tripId: string;
  token: string;
  defaultExpenseBy: string;
  editingBill?: Bill | null;
}) {
  const colors = useColors();
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [dateStr, setDateStr] = useState(() => new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState("Food");
  const [notes, setNotes] = useState("");
  const [expenseBy, setExpenseBy] = useState(defaultExpenseBy);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  React.useEffect(() => {
    if (visible) {
      if (editingBill) {
        setVendor(editingBill.vendor || "");
        setAmount(String(editingBill.amount));
        const d = editingBill.date.split("T")[0];
        setDateStr(d.length === 10 ? d : new Date().toISOString().split("T")[0]);
        setCategory(editingBill.category || "Food");
        setNotes(editingBill.notes || "");
        setExpenseBy(editingBill.expenseBy || defaultExpenseBy);
        setError("");
      } else {
        setVendor(""); setAmount(""); setDateStr(new Date().toISOString().split("T")[0]);
        setCategory("Food"); setNotes(""); setExpenseBy(defaultExpenseBy); setError("");
      }
    }
  }, [visible, editingBill]);

  React.useEffect(() => {
    if (defaultExpenseBy && !expenseBy && !editingBill) setExpenseBy(defaultExpenseBy);
  }, [defaultExpenseBy]);

  const reset = () => {
    setVendor(""); setAmount(""); setDateStr(new Date().toISOString().split("T")[0]);
    setCategory("Food"); setNotes(""); setExpenseBy(defaultExpenseBy);
    setSaving(false); setError("");
  };

  const handleClose = () => { if (saving) return; reset(); onClose(); };

  const handleSave = async () => {
    if (!vendor.trim()) { setError("Please enter a vendor name."); return; }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) { setError("Please enter a valid amount."); return; }
    setSaving(true); setError("");
    try {
      const url = editingBill
        ? `${API_BASE}/business/bills/${editingBill.id}`
        : `${API_BASE}/business/trips/${tripId}/bills`;
      const method = editingBill ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          vendor: vendor.trim(), amount: parsedAmount,
          date: new Date(dateStr).toISOString(), category, notes: notes.trim(),
          expenseBy: expenseBy.trim(),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const bill = await res.json() as Bill;
      onSaved(bill);
      reset();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <ScrollView
          style={[s.modalCard, { backgroundColor: colors.card }]}
          contentContainerStyle={{ paddingBottom: Platform.OS === "ios" ? 44 : 28 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.modalHandle} />
          <Text style={[s.modalTitle, { color: colors.foreground }]}>{editingBill ? "Edit Bill" : "Add Bill"}</Text>

          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Vendor / Description *</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
            placeholder="e.g. Taj Hotel, IndiGo Airlines"
            placeholderTextColor={colors.mutedForeground}
            value={vendor} onChangeText={(t) => { setError(""); setVendor(t); }}
            editable={!saving} autoCapitalize="words"
          />

          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Amount (₹) *</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
            placeholder="0.00" placeholderTextColor={colors.mutedForeground}
            value={amount} onChangeText={(t) => { setError(""); setAmount(t); }}
            keyboardType="decimal-pad" editable={!saving}
          />

          <DatePickerField
            label="Date"
            value={dateStr}
            onChange={setDateStr}
            disabled={saving}
            colors={colors}
          />

          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            <View style={s.catChipRow}>
              {CATEGORY_LIST.map((cat) => {
                const selected = category === cat;
                return (
                  <Pressable
                    key={cat}
                    style={[s.catChip, {
                      backgroundColor: selected ? getCategoryColor(cat) + "25" : colors.background,
                      borderColor: selected ? getCategoryColor(cat) : colors.border,
                    }]}
                    onPress={() => setCategory(cat)}
                    disabled={saving}
                  >
                    <Text style={{ fontSize: 13 }}>{getCategoryIcon(cat)}</Text>
                    <Text style={[s.catChipText, { color: selected ? getCategoryColor(cat) : colors.mutedForeground }]}>
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Expense By</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
            placeholder="Who paid for this"
            placeholderTextColor={colors.mutedForeground}
            value={expenseBy} onChangeText={(t) => { setError(""); setExpenseBy(t); }}
            editable={!saving} autoCapitalize="words"
          />

          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Notes</Text>
          <TextInput
            style={[s.input, s.notesInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
            placeholder="Invoice no., GST details, items…"
            placeholderTextColor={colors.mutedForeground}
            value={notes} onChangeText={setNotes}
            multiline editable={!saving}
            numberOfLines={3}
          />

          {!!error && <Text style={s.errorText}>{error}</Text>}

          <View style={s.modalActions}>
            <Pressable style={[s.actionBtn, s.cancelBtn, { borderColor: colors.border }]} onPress={handleClose} disabled={saving}>
              <Text style={[s.actionBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
            <Pressable style={[s.actionBtn, s.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[s.actionBtnText, { color: "#fff" }]}>{editingBill ? "Update" : "Save Bill"}</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function TripDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, userEmail } = useMockAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddBill, setShowAddBill] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [exporting, setExporting] = useState(false);
  const [profileName, setProfileName] = useState("");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      const [tripRes, profileRes] = await Promise.all([
        fetch(`${API_BASE}/business/trips/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/me`,                   { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (tripRes.ok) setTrip(await tripRes.json() as TripDetail);
      if (profileRes.ok) {
        const p = await profileRes.json() as { name?: string; email?: string };
        setProfileName(p.name?.trim() || (userEmail.split("@")[0] ?? ""));
      }
    } catch {} finally { setLoading(false); }
  }, [token, id]);

  useEffect(() => { load(); }, [load]);

  const handleDeleteBill = async (billId: string) => {
    if (!trip) return;
    setTrip({ ...trip, bills: trip.bills.filter((b) => b.id !== billId) });
    await fetch(`${API_BASE}/business/bills/${billId}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
  };

  const esc = (str: string) =>
    str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const handleGenerateReport = async () => {
    if (!trip || trip.bills.length === 0) return;
    setExporting(true);

    try {
      const totalAmount = trip.bills.reduce((sum, b) => sum + b.amount, 0);
      const filename = `${trip.name.replace(/[^a-zA-Z0-9]/g, "_")}_report`;

      const generatedOn = new Date().toLocaleDateString("en-IN", {
        day: "numeric", month: "long", year: "numeric",
      });


      const tdBase = (extra = "") =>
        `style="padding:10px 12px;vertical-align:top;border:1px solid #E5EAF0;${extra}"`;
      const tdAlt = (extra = "") =>
        `style="padding:10px 12px;vertical-align:top;border:1px solid #E5EAF0;background:#F8FAFC;${extra}"`;

      const billRows = trip.bills.map((bill, i) => {
        const td = i % 2 === 1 ? tdAlt : tdBase;
        return `
        <tr>
          <td ${td("text-align:center;color:#9CA3AF;font-size:11px;")}>${i + 1}</td>
          <td ${td("font-weight:600;color:#111827;")}>${esc(bill.vendor || "Unnamed")}</td>
          <td ${td("white-space:nowrap;color:#6B7280;")}>${formatDate(bill.date)}</td>
          <td ${td("color:#374151;")}>${esc(bill.category)}</td>
          <td ${td("text-align:right;font-weight:700;color:#1E3A5F;white-space:nowrap;")}>₹${bill.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          <td ${td("color:#6B7280;")}>${esc(bill.expenseBy || "—")}</td>
          <td ${td("color:#9CA3AF;font-size:11.5px;word-break:break-word;line-height:1.5;")}>${esc(bill.notes || "—")}</td>
        </tr>`;
      }).join("");

      const isWeb = Platform.OS === "web";
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(trip.name)} — Expense Report</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after {
    box-sizing: border-box; margin: 0; padding: 0;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: #F4F6F9;
    color: #1A1A2E;
    -webkit-font-smoothing: antialiased;
    font-size: 13px;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* Download bar */
  .dl-bar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 999;
    background: #1E3A5F;
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 28px;
  }
  .dl-bar-title { font-size: 13px; font-weight: 500; color: rgba(255,255,255,.75); }
  .dl-btn {
    background: rgba(255,255,255,.15); color: #fff; border: 1px solid rgba(255,255,255,.3);
    padding: 7px 20px; border-radius: 4px;
    font-size: 13px; font-weight: 600; font-family: inherit;
    cursor: pointer; transition: background .15s;
  }
  .dl-btn:hover { background: rgba(255,255,255,.25); }
  .dl-btn:disabled { opacity: .5; cursor: not-allowed; }
  .spacer { height: 52px; }

  /* Page */
  #report {
    max-width: 860px; margin: 24px auto 48px;
    background: #fff;
    border: 1px solid #D1D9E0;
    box-shadow: 0 2px 8px rgba(0,0,0,.06);
  }

  /* Header band */
  .report-header {
    background: #1E3A5F;
    padding: 32px 40px 28px;
    color: #fff;
  }
  .report-logo {
    font-size: 10px; font-weight: 700; letter-spacing: 2px;
    text-transform: uppercase; color: rgba(255,255,255,.5);
    margin-bottom: 16px;
  }
  .report-title {
    font-size: 24px; font-weight: 700; color: #fff;
    margin-bottom: 10px; letter-spacing: -.2px;
  }
  .report-meta {
    display: flex; flex-wrap: wrap; gap: 4px 24px;
    margin-bottom: 24px;
  }
  .report-meta-item { font-size: 12px; color: rgba(255,255,255,.6); }

  .summary-row {
    display: flex; border-top: 1px solid rgba(255,255,255,.15);
    padding-top: 18px; gap: 40px;
  }
  .summary-item .lbl {
    font-size: 10px; font-weight: 600; letter-spacing: 1px;
    text-transform: uppercase; color: rgba(255,255,255,.45);
    margin-bottom: 4px;
  }
  .summary-item .val { font-size: 20px; font-weight: 700; color: #fff; }

  /* Body */
  .body { padding: 28px 40px; }

  /* Section header */
  .section-head {
    font-size: 10px; font-weight: 700; letter-spacing: 1.5px;
    text-transform: uppercase; color: #1E3A5F;
    border-bottom: 2px solid #1E3A5F;
    padding-bottom: 6px; margin-bottom: 0;
  }

  /* Tables — shared */
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-bottom: 28px; }
  thead th {
    background: #F0F3F7;
    color: #374151; font-weight: 600; font-size: 11px;
    letter-spacing: .3px; text-align: left;
    padding: 9px 12px;
    border: 1px solid #D1D9E0;
  }
  thead th.r { text-align: right; }
  thead th.c { text-align: center; }
  tbody td {
    padding: 10px 12px; vertical-align: top;
    border: 1px solid #E5EAF0;
    color: #374151;
  }
  tr.alt td { background: #F8FAFC; }

  /* Category summary table columns */
  td.c { text-align: center; color: #6B7280; }
  td.r { text-align: right; font-weight: 600; color: #1E3A5F; }

  /* Expense table columns */
  td.sr { text-align: center; color: #9CA3AF; font-size: 11px; width: 32px; }
  td.vendor { font-weight: 600; color: #111827; }
  td.date { white-space: nowrap; color: #6B7280; }
  td.cat-cell { color: #374151; }
  td.amount { text-align: right; font-weight: 700; color: #1E3A5F; white-space: nowrap; }
  td.by { color: #6B7280; }
  td.notes { color: #9CA3AF; font-size: 11.5px; max-width: 150px; word-break: break-word; overflow-wrap: break-word; line-height: 1.5; }

  /* Grand total row */
  .total-row td {
    background: #EEF2F7;
    border: 1px solid #D1D9E0;
    font-weight: 700; font-size: 13px;
  }
  .total-row td.amount { font-size: 14px; color: #1E3A5F; }

  /* Divider between sections */
  .gap { height: 20px; }

  /* Footer */
  .report-footer {
    border-top: 1px solid #D1D9E0;
    padding: 14px 40px;
    background: #F8FAFC;
    display: flex; align-items: center; justify-content: space-between;
  }
  .report-footer span { font-size: 11px; color: #9CA3AF; }

  @media print {
    .dl-bar, .spacer { display: none; }
    body { background: #fff; }
    #report { margin: 0; border: none; box-shadow: none; }
  }
</style>
</head>
<body>

${isWeb ? `<div class="dl-bar">
  <span class="dl-bar-title">${esc(trip.name)} — Expense Report</span>
  <button class="dl-btn" id="dlBtn" onclick="downloadImg()">Download</button>
</div>
<div class="spacer"></div>` : ""}

<div id="report">
  <div class="report-header" style="background:#1E3A5F;color:#fff;padding:32px 40px 28px;">
    <div class="report-logo" style="color:rgba(255,255,255,.5);">Qontri &mdash; Business Expense Report</div>
    <div class="report-title" style="color:#fff;">${esc(trip.name)}</div>
    <div class="report-meta">
      ${trip.destination ? `<span class="report-meta-item">Location: ${esc(trip.destination)}</span>` : ""}
      ${trip.purpose ? `<span class="report-meta-item">Purpose: ${esc(trip.purpose)}</span>` : ""}
      <span class="report-meta-item">Period: ${formatDate(trip.startDate)}${trip.endDate ? ` &ndash; ${formatDate(trip.endDate)}` : ""}</span>
    </div>
    <div class="summary-row" style="border-top:1px solid rgba(255,255,255,.15);padding-top:18px;display:flex;gap:40px;">
      <div class="summary-item">
        <div class="lbl" style="color:rgba(255,255,255,.45);">Total Bills</div>
        <div class="val" style="color:#fff;font-size:20px;font-weight:700;">${trip.bills.length}</div>
      </div>
      <div class="summary-item">
        <div class="lbl" style="color:rgba(255,255,255,.45);">Total Amount</div>
        <div class="val" style="color:#fff;font-size:20px;font-weight:700;">&#8377;${totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
      </div>
      <div class="summary-item">
        <div class="lbl" style="color:rgba(255,255,255,.45);">Generated On</div>
        <div class="val" style="color:#fff;font-size:14px;font-weight:500;">${generatedOn}</div>
      </div>
    </div>
  </div>

  <div class="body">
    <div class="section-head">Expense Details</div>
    <table>
      <thead>
        <tr>
          <th class="c" style="background:#F0F3F7;border:1px solid #D1D9E0;padding:9px 12px;font-weight:600;font-size:11px;text-align:center;">#</th>
          <th style="background:#F0F3F7;border:1px solid #D1D9E0;padding:9px 12px;font-weight:600;font-size:11px;">Vendor / Description</th>
          <th style="background:#F0F3F7;border:1px solid #D1D9E0;padding:9px 12px;font-weight:600;font-size:11px;">Date</th>
          <th style="background:#F0F3F7;border:1px solid #D1D9E0;padding:9px 12px;font-weight:600;font-size:11px;">Category</th>
          <th class="r" style="background:#F0F3F7;border:1px solid #D1D9E0;padding:9px 12px;font-weight:600;font-size:11px;text-align:right;">Amount (&#8377;)</th>
          <th style="background:#F0F3F7;border:1px solid #D1D9E0;padding:9px 12px;font-weight:600;font-size:11px;">Paid By</th>
          <th style="background:#F0F3F7;border:1px solid #D1D9E0;padding:9px 12px;font-weight:600;font-size:11px;">Notes</th>
        </tr>
      </thead>
      <tbody>${billRows}</tbody>
      <tr class="total-row">
        <td colspan="4" style="background:#EEF2F7;border:1px solid #D1D9E0;padding:10px 12px;text-align:right;padding-right:12px;color:#374151;font-weight:700;">Grand Total</td>
        <td class="amount r" style="background:#EEF2F7;border:1px solid #D1D9E0;padding:10px 12px;text-align:right;font-weight:700;font-size:14px;color:#1E3A5F;">&#8377;${totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
        <td colspan="2" style="background:#EEF2F7;border:1px solid #D1D9E0;"></td>
      </tr>
    </table>
  </div>

  <div class="report-footer">
    <span>Generated on ${generatedOn}</span>
    <span>Powered by Qontri</span>
  </div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<script>
async function downloadImg() {
  const btn = document.getElementById('dlBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Generating…';
  try {
    const canvas = await html2canvas(document.getElementById('report'), {
      scale: 2, useCORS: true, allowTaint: true, logging: false,
      windowWidth: 960, scrollX: 0, scrollY: 0
    });
    const a = document.createElement('a');
    a.download = '${filename}.png';
    a.href = canvas.toDataURL('image/png');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch(e) {
    alert('Could not generate image. Try screenshotting the page instead.');
  } finally {
    btn.disabled = false;
    btn.textContent = '⬇ Download';
  }
}
</script>
</body>
</html>`;

      if (Platform.OS === "web") {
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        const Print = await import("expo-print");
        const Sharing = await import("expo-sharing");
        const { uri } = await Print.printToFileAsync({ html, base64: false });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Save / Share Report", UTI: "com.adobe.pdf" });
        }
      }
    } catch {
      Alert.alert("Error", "Could not generate the report. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const total = trip?.bills.reduce((sum, b) => sum + b.amount, 0) ?? 0;

  if (loading) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#4A90D9" />
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={[s.centered, { backgroundColor: colors.background }]}>
        <Text style={[s.errorText, { color: colors.foreground }]}>Trip not found.</Text>
        <Pressable onPress={() => router.back()}><Text style={{ color: "#4A90D9", marginTop: 8 }}>Go back</Text></Pressable>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={[s.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={["#0A1628", "#0F2040", "#1E3A5F"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[s.hero, { paddingTop: topPad + 8 }]}
        >
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </Pressable>

          <Text style={s.heroTitle} numberOfLines={2}>{trip.name}</Text>
          <View style={s.heroMeta}>
            {!!trip.destination && <Text style={s.heroMetaText}>📍 {trip.destination}</Text>}
            {!!trip.purpose && <Text style={s.heroMetaText}>💼 {trip.purpose}</Text>}
            <Text style={s.heroMetaText}>
              📅 {formatDate(trip.startDate)}{trip.endDate ? ` – ${formatDate(trip.endDate)}` : ""}
            </Text>
          </View>

          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={s.statValue}>{trip.bills.length}</Text>
              <Text style={s.statLabel}>Bills</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statValue}>
                ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </Text>
              <Text style={s.statLabel}>Total</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Download Report */}
        <View style={s.exportRow}>
          <Pressable
            style={[s.exportBtn, trip.bills.length === 0 && { opacity: 0.45 }]}
            onPress={handleGenerateReport}
            disabled={exporting || trip.bills.length === 0}
          >
            {exporting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Feather name="download" size={16} color="#fff" />}
            <Text style={s.exportBtnText}>
              {exporting ? "Generating…" : "Download Report"}
            </Text>
          </Pressable>
        </View>

        {/* Add Bill */}
        <View style={s.addBillWrap}>
          <Pressable style={s.addBillBtn} onPress={() => setShowAddBill(true)}>
            <Feather name="plus" size={18} color="#4A90D9" />
            <Text style={s.addBillBtnText}>Add Bill</Text>
          </Pressable>
        </View>

        {/* Bills list */}
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {trip.bills.length === 0 ? (
            <View style={[s.emptyWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={s.emptyEmoji}>🧾</Text>
              <Text style={[s.emptyTitle, { color: colors.foreground }]}>No bills yet</Text>
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                Tap "Add Bill" above to log your first expense.
              </Text>
            </View>
          ) : (
            trip.bills.map((bill, i) => (
              <View key={bill.id} style={[s.billCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[s.billIcon, { backgroundColor: getCategoryColor(bill.category) + "20" }]}>
                  <Text style={{ fontSize: 20 }}>{getCategoryIcon(bill.category)}</Text>
                </View>
                <View style={s.billInfo}>
                  <Text style={[s.billVendor, { color: colors.foreground }]} numberOfLines={1}>
                    {bill.vendor || "Unnamed bill"}
                  </Text>
                  <Text style={[s.billMeta, { color: colors.mutedForeground }]}>
                    {formatDate(bill.date)} · {bill.category}
                    {bill.expenseBy ? ` · ${bill.expenseBy}` : ""}
                  </Text>
                  {!!bill.notes && (
                    <Text style={[s.billNotes, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {bill.notes}
                    </Text>
                  )}
                </View>
                <View style={s.billRight}>
                  <Text style={[s.billAmount, { color: "#1E3A5F" }]}>
                    {formatAmount(bill.amount)}
                  </Text>
                  <Text style={[s.billIndex, { color: colors.mutedForeground }]}>#{i + 1}</Text>
                </View>
                <Pressable
                  style={s.billEditBtn}
                  onPress={() => { setEditingBill(bill); setShowAddBill(true); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="edit-2" size={13} color="#4A90D9" />
                </Pressable>
                <Pressable
                  style={s.billDeleteBtn}
                  onPress={() => handleDeleteBill(bill.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="trash-2" size={13} color={colors.mutedForeground} />
                </Pressable>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <AddBillModal
        visible={showAddBill}
        onClose={() => { setShowAddBill(false); setEditingBill(null); }}
        onSaved={(bill) => {
          if (editingBill) {
            setTrip((t) => t ? { ...t, bills: t.bills.map((b) => b.id === bill.id ? bill : b) } : t);
          } else {
            setTrip((t) => t ? { ...t, bills: [bill, ...t.bills] } : t);
          }
          setEditingBill(null);
          setShowAddBill(false);
        }}
        tripId={trip.id}
        token={token}
        defaultExpenseBy={profileName}
        editingBill={editingBill}
      />
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: { paddingHorizontal: 20, paddingBottom: 24 },
  backBtn: { marginBottom: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#FFFFFF", marginBottom: 10 },
  heroMeta: { gap: 4, marginBottom: 16 },
  heroMetaText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)" },
  statsRow: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#FFFFFF", marginBottom: 2 },
  statLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.5 },
  statDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.15)" },
  exportRow: { paddingHorizontal: 16, paddingTop: 14 },
  exportBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#1E3A5F", borderRadius: 14, paddingVertical: 13, shadowColor: "#1E3A5F", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  exportBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#fff" },
  addBillWrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 },
  addBillBtn: { borderWidth: 1.5, borderColor: "#4A90D9", borderRadius: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "rgba(74,144,217,0.07)" },
  addBillBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#4A90D9" },
  emptyWrap: { borderRadius: 18, borderWidth: 1, padding: 28, alignItems: "center", gap: 8 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19 },
  billCard: { borderRadius: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", padding: 12, gap: 10 },
  billIcon: { width: 48, height: 48, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  billInfo: { flex: 1 },
  billVendor: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  billMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 2 },
  billNotes: { fontSize: 11, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  billRight: { alignItems: "flex-end", gap: 2 },
  billAmount: { fontSize: 14, fontFamily: "Inter_700Bold" },
  billIndex: { fontSize: 10, fontFamily: "Inter_400Regular" },
  billEditBtn: { padding: 4, marginRight: 2 },
  billDeleteBtn: { padding: 4 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalCard: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: "92%" },
  modalHandle: { width: 40, height: 4, backgroundColor: "#334155", borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 20 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 14 },
  notesInput: { height: 80, textAlignVertical: "top" },
  catChipRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  catChip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1.5, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 12 },
  catChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  errorText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#EF4444", marginBottom: 12 },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 8 },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cancelBtn: { borderWidth: 1.5 },
  saveBtn: { backgroundColor: "#4A90D9", shadowColor: "#4A90D9", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  actionBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
});
