import { and, desc, eq } from "drizzle-orm";
import { Router } from "express";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { db, businessTripsTable, businessTripBillsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";

// ── Helpers ───────────────────────────────────────────────────────────────────

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// DD.MM.YY format for spreadsheet (matches reference format)
function fmtSheetDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const mon = String(d.getMonth() + 1).padStart(2, "0");
    const yr = String(d.getFullYear()).slice(-2);
    return `${day}.${mon}.${yr}`;
  } catch { return dateStr; }
}

function nameFromEmail(email: string): string {
  return email.split("@")[0] ?? email;
}

// ── Scan bill image with Gemini Vision ────────────────────────────────────────

router.post("/business/scan", requireAuth, async (req, res) => {
  const { imageData, mimeType } = req.body as {
    imageData?: string;
    mimeType?: string;
  };

  if (!imageData) {
    res.status(400).json({ error: "imageData is required" });
    return;
  }
  if (!GEMINI_API_KEY) {
    res.status(500).json({ error: "Gemini API key not configured" });
    return;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType ?? "image/jpeg",
                    data: imageData,
                  },
                },
                {
                  text: `Analyze this bill/receipt image and extract the following details in JSON format only (no markdown, no explanation):
{
  "vendor": "Name of the shop/restaurant/service provider",
  "amount": 0.00,
  "date": "YYYY-MM-DD",
  "category": "One of: Food, Transport, Accommodation, Activities, Utilities, Groceries, Entertainment, Shopping, Healthcare, Other",
  "notes": "Any relevant notes like GST number, invoice number, or items purchased (max 100 chars)"
}
If a field cannot be determined, use empty string for text fields or 0 for amount. For date, use today's date if not visible. Always return valid JSON only.`,
                },
              ],
            },
          ],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      req.log.error({ err }, "Gemini API error");
      res.status(500).json({ error: "AI scanning failed" });
      return;
    }

    const data = await response.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(text) as Record<string, unknown>; } catch {}

    res.json({
      vendor: String(parsed.vendor ?? ""),
      amount: Number(parsed.amount ?? 0),
      date: String(parsed.date ?? new Date().toISOString().split("T")[0]),
      category: String(parsed.category ?? "Other"),
      notes: String(parsed.notes ?? ""),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to scan bill");
    res.status(500).json({ error: "Failed to scan bill" });
  }
});

// ── Trips CRUD ────────────────────────────────────────────────────────────────

router.get("/business/trips", requireAuth, async (req, res) => {
  const email = req.user!.email;
  try {
    const trips = await db
      .select()
      .from(businessTripsTable)
      .where(eq(businessTripsTable.userEmail, email))
      .orderBy(desc(businessTripsTable.createdAt));

    const tripIds = trips.map((t) => t.id);
    const allBills = tripIds.length > 0
      ? await db
          .select({
            id: businessTripBillsTable.id,
            tripId: businessTripBillsTable.tripId,
            amount: businessTripBillsTable.amount,
          })
          .from(businessTripBillsTable)
          .where(eq(businessTripBillsTable.userEmail, email))
      : [];

    const billMap = new Map<string, { count: number; total: number }>();
    for (const b of allBills) {
      const existing = billMap.get(b.tripId) ?? { count: 0, total: 0 };
      billMap.set(b.tripId, { count: existing.count + 1, total: existing.total + b.amount });
    }

    res.json(trips.map((t) => ({
      ...t,
      billCount: billMap.get(t.id)?.count ?? 0,
      totalAmount: billMap.get(t.id)?.total ?? 0,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch business trips");
    res.status(500).json({ error: "Failed to fetch business trips" });
  }
});

router.post("/business/trips", requireAuth, async (req, res) => {
  const email = req.user!.email;
  const { name, destination, purpose, startDate, endDate } = req.body as {
    name?: string;
    destination?: string;
    purpose?: string;
    startDate?: string;
    endDate?: string;
  };

  if (!name?.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  if (!startDate) {
    res.status(400).json({ error: "startDate is required" });
    return;
  }

  const id = newId("btrip");
  try {
    await db.insert(businessTripsTable).values({
      id,
      userEmail: email,
      name: name.trim(),
      destination: destination?.trim() ?? "",
      purpose: purpose?.trim() ?? "",
      startDate,
      endDate: endDate ?? "",
    });
    const rows = await db.select().from(businessTripsTable).where(eq(businessTripsTable.id, id)).limit(1);
    res.status(201).json({ ...rows[0], billCount: 0, totalAmount: 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to create business trip");
    res.status(500).json({ error: "Failed to create business trip" });
  }
});

router.get("/business/trips/:id", requireAuth, async (req, res) => {
  const email = req.user!.email;
  const id = req.params["id"] as string;

  try {
    const trips = await db
      .select()
      .from(businessTripsTable)
      .where(and(eq(businessTripsTable.id, id), eq(businessTripsTable.userEmail, email)))
      .limit(1);

    if (trips.length === 0) {
      res.status(404).json({ error: "Trip not found" });
      return;
    }

    const bills = await db
      .select()
      .from(businessTripBillsTable)
      .where(eq(businessTripBillsTable.tripId, id))
      .orderBy(desc(businessTripBillsTable.date));

    res.json({ ...trips[0], bills });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch business trip");
    res.status(500).json({ error: "Failed to fetch business trip" });
  }
});

router.delete("/business/trips/:id", requireAuth, async (req, res) => {
  const email = req.user!.email;
  const id = req.params["id"] as string;

  try {
    await db
      .delete(businessTripsTable)
      .where(and(eq(businessTripsTable.id, id), eq(businessTripsTable.userEmail, email)));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete business trip");
    res.status(500).json({ error: "Failed to delete business trip" });
  }
});

// ── Bills CRUD ────────────────────────────────────────────────────────────────

router.post("/business/trips/:id/bills", requireAuth, async (req, res) => {
  const email = req.user!.email;
  const tripId = req.params["id"] as string;

  const trips = await db
    .select({ id: businessTripsTable.id })
    .from(businessTripsTable)
    .where(and(eq(businessTripsTable.id, tripId), eq(businessTripsTable.userEmail, email)))
    .limit(1);

  if (trips.length === 0) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  const { vendor, amount, date, category, notes, expenseBy, imageData, imageMimeType } = req.body as {
    vendor?: string;
    amount?: number;
    date?: string;
    category?: string;
    notes?: string;
    expenseBy?: string;
    imageData?: string;
    imageMimeType?: string;
  };

  const billId = newId("bbill");
  try {
    await db.insert(businessTripBillsTable).values({
      id: billId,
      tripId,
      userEmail: email,
      vendor: vendor?.trim() ?? "",
      amount: Number(amount ?? 0),
      date: date ?? new Date().toISOString().split("T")[0],
      category: category ?? "Other",
      notes: notes?.trim() ?? "",
      expenseBy: expenseBy?.trim() ?? "",
      imageData: imageData ?? null,
      imageMimeType: imageMimeType ?? "image/jpeg",
    });
    const rows = await db
      .select()
      .from(businessTripBillsTable)
      .where(eq(businessTripBillsTable.id, billId))
      .limit(1);
    res.status(201).json(rows[0]);
  } catch (err) {
    req.log.error({ err }, "Failed to add bill");
    res.status(500).json({ error: "Failed to add bill" });
  }
});

router.put("/business/bills/:id", requireAuth, async (req, res) => {
  const email = req.user!.email;
  const id = req.params["id"] as string;
  const { vendor, amount, date, category, notes, expenseBy, imageData, imageMimeType } = req.body as {
    vendor?: string; amount?: number; date?: string; category?: string;
    notes?: string; expenseBy?: string; imageData?: string | null; imageMimeType?: string;
  };

  try {
    const rows = await db.select().from(businessTripBillsTable)
      .where(and(eq(businessTripBillsTable.id, id), eq(businessTripBillsTable.userEmail, email))).limit(1);
    if (rows.length === 0) { res.status(404).json({ error: "Bill not found" }); return; }

    const existing = rows[0];
    await db.update(businessTripBillsTable).set({
      vendor:       vendor?.trim()      ?? existing.vendor,
      amount:       typeof amount === "number" ? amount : existing.amount,
      date:         date                ?? existing.date,
      category:     category            ?? existing.category,
      notes:        notes?.trim()       ?? existing.notes,
      expenseBy:    expenseBy?.trim()   ?? existing.expenseBy,
      imageData:    imageData !== undefined ? imageData : existing.imageData,
      imageMimeType: imageMimeType      ?? existing.imageMimeType,
    }).where(and(eq(businessTripBillsTable.id, id), eq(businessTripBillsTable.userEmail, email)));

    const updated = await db.select().from(businessTripBillsTable).where(eq(businessTripBillsTable.id, id)).limit(1);
    res.json(updated[0]);
  } catch (err) {
    req.log.error({ err }, "Failed to update bill");
    res.status(500).json({ error: "Failed to update bill" });
  }
});

router.delete("/business/bills/:id", requireAuth, async (req, res) => {
  const email = req.user!.email;
  const id = req.params["id"] as string;

  try {
    await db
      .delete(businessTripBillsTable)
      .where(and(eq(businessTripBillsTable.id, id), eq(businessTripBillsTable.userEmail, email)));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete bill");
    res.status(500).json({ error: "Failed to delete bill" });
  }
});

// ── Export: Excel ─────────────────────────────────────────────────────────────

router.get("/business/trips/:id/export/excel", requireAuth, async (req, res) => {
  const email = req.user!.email;
  const id = req.params["id"] as string;

  try {
    const trips = await db
      .select()
      .from(businessTripsTable)
      .where(and(eq(businessTripsTable.id, id), eq(businessTripsTable.userEmail, email)))
      .limit(1);

    if (trips.length === 0) { res.status(404).json({ error: "Trip not found" }); return; }
    const trip = trips[0];

    const bills = await db
      .select()
      .from(businessTripBillsTable)
      .where(eq(businessTripBillsTable.tripId, id))
      .orderBy(businessTripBillsTable.date);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Qontri";
    workbook.created = new Date();
    const sheet = workbook.addWorksheet("Expense Report");

    // ── Title rows ────────────────────────────────────────────────────────────
    sheet.mergeCells("A1:G1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = trip.name;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 26;

    sheet.mergeCells("A2:G2");
    const subCell = sheet.getCell("A2");
    subCell.value = [
      trip.destination ? `Destination: ${trip.destination}` : "",
      trip.purpose     ? `Purpose: ${trip.purpose}` : "",
      `Dates: ${formatDate(trip.startDate)}${trip.endDate ? ` - ${formatDate(trip.endDate)}` : ""}`,
    ].filter(Boolean).join("   |   ");
    subCell.font = { size: 9, color: { argb: "FF64748B" } };
    subCell.alignment = { horizontal: "center" };

    sheet.addRow([]);

    // ── Column widths  (A–G = 7 columns) ─────────────────────────────────────
    sheet.columns = [
      { key: "sr",        width: 6  },   // A  Sr
      { key: "desc",      width: 30 },   // B  Description
      { key: "amount",    width: 13 },   // C  Amount
      { key: "expBy",     width: 18 },   // D  Expense By
      { key: "category",  width: 16 },   // E  Category
      { key: "date",      width: 14 },   // F  Date
      { key: "notes",     width: 36 },   // G  Notes
    ];

    // ── Header row ────────────────────────────────────────────────────────────
    const hdr = sheet.addRow(["Sr", "Description", "Amount", "Expense By", "Category", "Date", "Notes"]);
    hdr.height = 20;
    hdr.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });

    // ── Data rows ─────────────────────────────────────────────────────────────
    let total = 0;
    bills.forEach((bill, i) => {
      const row = sheet.addRow([
        i + 1,
        bill.vendor || bill.category,
        bill.amount,
        bill.expenseBy || nameFromEmail(email),
        bill.category,
        fmtSheetDate(bill.date),
        bill.notes || "",
      ]);
      total += bill.amount;
      row.height = 18;
      if (i % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
        });
      }
      row.eachCell((cell, col) => {
        cell.alignment = { vertical: "middle", horizontal: col === 3 ? "right" : "left" };
        cell.border = { top: { style: "hair" }, bottom: { style: "hair" }, left: { style: "thin" }, right: { style: "thin" } };
      });
      row.getCell(3).numFmt = "#,##0.00";
    });

    // ── Total row ─────────────────────────────────────────────────────────────
    sheet.addRow([]);
    const totalRow = sheet.addRow(["", "TOTAL", total, "", "", "", ""]);
    totalRow.height = 20;
    totalRow.getCell(2).font = { bold: true };
    totalRow.getCell(2).alignment = { horizontal: "right", vertical: "middle" };
    totalRow.getCell(3).font = { bold: true, color: { argb: "FF1E3A5F" } };
    totalRow.getCell(3).numFmt = "#,##0.00";
    totalRow.getCell(3).alignment = { horizontal: "right", vertical: "middle" };
    totalRow.eachCell((cell) => {
      cell.border = { top: { style: "medium" }, bottom: { style: "medium" }, left: { style: "thin" }, right: { style: "thin" } };
    });

    const safeFilename = trip.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}_expense_report.xlsx"`);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    req.log.error({ err }, "Failed to export Excel");
    res.status(500).json({ error: "Failed to export Excel" });
  }
});

// ── Export: PDF ───────────────────────────────────────────────────────────────

router.get("/business/trips/:id/export/pdf", requireAuth, async (req, res) => {
  const email = req.user!.email;
  const id = req.params["id"] as string;

  try {
    const trips = await db
      .select()
      .from(businessTripsTable)
      .where(and(eq(businessTripsTable.id, id), eq(businessTripsTable.userEmail, email)))
      .limit(1);

    if (trips.length === 0) { res.status(404).json({ error: "Trip not found" }); return; }
    const trip = trips[0];

    const bills = await db
      .select()
      .from(businessTripBillsTable)
      .where(eq(businessTripBillsTable.tripId, id))
      .orderBy(businessTripBillsTable.date);

    const safeFilename = trip.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}_expense_report.pdf"`);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

    const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
    doc.pipe(res);

    const NAVY  = "#1E3A5F";
    const GRAY  = "#64748B";
    const LIGHT = "#F8FAFC";
    const BLACK = "#000000";
    const pageW = doc.page.width - 80;
    const startX = 40;
    const total = bills.reduce((s, b) => s + b.amount, 0);

    // ── Title (no emoji — PDFKit cannot render them) ──────────────────────────
    doc.fontSize(18).font("Helvetica-Bold").fillColor(NAVY)
      .text(trip.name, startX, 28, { width: pageW, align: "center" });
    const subParts = [
      trip.destination ? trip.destination : "",
      trip.purpose     ? trip.purpose : "",
      `${formatDate(trip.startDate)}${trip.endDate ? ` - ${formatDate(trip.endDate)}` : ""}`,
    ].filter(Boolean).join("  |  ");
    doc.fontSize(9).font("Helvetica").fillColor(GRAY)
      .text(subParts, startX, 50, { width: pageW, align: "center" });

    // Columns: Sr | Description | Amount | Expense By | Category | Date | Notes
    let y = 72;
    const ROW_H = 22;
    const cols = {
      sr:   30,
      desc: 140,
      amt:  65,
      by:   80,
      cat:  70,
      date: 68,
      note: pageW - 30 - 140 - 65 - 80 - 70 - 68,
    };

    const cell = (
      txt: string, cx: number, cy: number, cw: number,
      opts: { bold?: boolean; align?: "left"|"right"|"center"; color?: string } = {}
    ) => {
      doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica")
         .fontSize(8).fillColor(opts.color ?? BLACK)
         .text(txt, cx + 4, cy + 7, { width: cw - 8, align: opts.align ?? "left", lineBreak: false });
    };

    const vLines = (cy: number, h: number) => {
      let cx2 = startX;
      for (const w of [cols.sr, cols.desc, cols.amt, cols.by, cols.cat, cols.date]) {
        cx2 += w;
        doc.moveTo(cx2, cy).lineTo(cx2, cy + h).strokeColor("#CCCCCC").lineWidth(0.5).stroke();
      }
    };

    // Header row
    doc.rect(startX, y, pageW, ROW_H).fill(NAVY);
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(8);
    let cx = startX;
    for (const [lbl, w] of [
      ["Sr", cols.sr], ["Description", cols.desc], ["Amount", cols.amt],
      ["Expense By", cols.by], ["Category", cols.cat], ["Date", cols.date], ["Notes", cols.note],
    ] as [string, number][]) {
      doc.text(lbl, cx + 4, y + 7, { width: w - 8, align: "center", lineBreak: false });
      cx += w;
    }
    y += ROW_H;

    // Data rows
    bills.forEach((bill, i) => {
      if (y > doc.page.height - 70) { doc.addPage(); y = 40; }
      if (i % 2 === 0) doc.rect(startX, y, pageW, ROW_H).fill(LIGHT);
      doc.rect(startX, y, pageW, ROW_H).strokeColor("#DDDDDD").lineWidth(0.5).stroke();
      vLines(y, ROW_H);

      const expBy = bill.expenseBy || nameFromEmail(email);
      let rx = startX;
      cell(String(i + 1),                rx, y, cols.sr,   { align: "center" }); rx += cols.sr;
      cell(bill.vendor || bill.category, rx, y, cols.desc);                       rx += cols.desc;
      cell(`Rs.${bill.amount.toLocaleString("en-IN")}`, rx, y, cols.amt, { align: "right" }); rx += cols.amt;
      cell(expBy,                        rx, y, cols.by,   { align: "center" }); rx += cols.by;
      cell(bill.category,                rx, y, cols.cat,  { align: "center" }); rx += cols.cat;
      cell(fmtSheetDate(bill.date),      rx, y, cols.date, { align: "center" }); rx += cols.date;
      cell(bill.notes || "",             rx, y, cols.note);
      y += ROW_H;
    });

    // Total row
    if (y > doc.page.height - 40) { doc.addPage(); y = 40; }
    doc.rect(startX, y, pageW, ROW_H).fill(NAVY);
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(8);
    let tx = startX + cols.sr;
    doc.text("TOTAL", tx + 4, y + 7, { width: cols.desc - 8, align: "right", lineBreak: false });
    tx += cols.desc;
    doc.text(`Rs.${total.toLocaleString("en-IN")}`, tx + 4, y + 7, { width: cols.amt - 8, align: "right", lineBreak: false });
    y += ROW_H;

    // ── Scanned bill copies referenced by Sr No ───────────────────────────────
    const billsWithImages = bills
      .map((b, i) => ({ bill: b, srNo: i + 1 }))
      .filter(({ bill }) => !!bill.imageData);

    if (billsWithImages.length > 0) {
      y += 20;
      if (y > doc.page.height - 200) { doc.addPage(); y = 40; }
      doc.fontSize(12).font("Helvetica-Bold").fillColor(NAVY)
        .text("Scanned Bill Copies", startX, y);
      y += 18;

      for (const { bill, srNo } of billsWithImages) {
        if (y > doc.page.height - 240) { doc.addPage(); y = 40; }
        doc.fillColor(GRAY).fontSize(9).font("Helvetica-Bold")
          .text(
            `Sr. ${srNo} - ${bill.vendor || bill.category} - ${formatDate(bill.date)} - Rs.${bill.amount.toLocaleString("en-IN")}`,
            startX, y,
          );
        y += 14;
        try {
          const imgBuf = Buffer.from(bill.imageData!, "base64");
          doc.image(imgBuf, startX, y, { fit: [pageW, 220], align: "center" });
          y += 228;
        } catch {
          doc.fillColor(GRAY).fontSize(8).text("[Image could not be rendered]", startX, y);
          y += 18;
        }
        doc.moveTo(startX, y).lineTo(startX + pageW, y).strokeColor("#E2E8F0").lineWidth(0.5).stroke();
        y += 12;
      }
    }

    // Footer
    doc.fontSize(7).fillColor(GRAY).font("Helvetica")
      .text(
        `Generated by Qontri  |  ${new Date().toLocaleDateString("en-IN")}  |  ${email}`,
        startX, doc.page.height - 28, { align: "center", width: pageW },
      );

    doc.end();
  } catch (err) {
    req.log.error({ err }, "Failed to export PDF");
    if (!res.headersSent) res.status(500).json({ error: "Failed to export PDF" });
  }
});

export default router;
