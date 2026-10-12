import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { MAIN_ORGANIZATIONS } from "./mainOrgs";

/**
 * Helper to generate a text/unicode data bar for visual representation in Excel cells
 */
function generateUnicodeBar(pct, barLength = 10) {
  if (pct === undefined || pct === null || isNaN(pct)) return "—";
  const clamped = Math.max(0, Math.min(100, Number(pct)));
  const filledChars = Math.round((clamped / 100) * barLength);
  const emptyChars = barLength - filledChars;
  const bar = "█".repeat(filledChars) + "░".repeat(emptyChars);
  return `${bar} ${clamped.toFixed(1).replace(".", ",")}%`;
}

/**
 * Format percent with Ukrainian locale
 */
function formatPct(val) {
  if (val === undefined || val === null || isNaN(val)) return "0,0%";
  return `${Number(val).toFixed(1).replace(".", ",")}%`;
}

/**
 * Format date string to DD.MM.YYYY
 */
function formatDateUA(d) {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    const day = String(dt.getDate()).padStart(2, "0");
    const month = String(dt.getMonth() + 1).padStart(2, "0");
    const year = dt.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return String(d);
  }
}

/**
 * Draw a clean modern bar chart onto an offscreen canvas and return a base64 PNG string
 */
function drawBarChartImage({
  title,
  subtitle,
  items = [], // { label, value, max, color, subText }
  width = 820,
  height = 360,
  valueSuffix = "",
}) {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    const scale = 2; // 2x for sharp retina graphics
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.scale(scale, scale);

    // Dark sleek background matching UI theme
    ctx.fillStyle = "#0B132B";
    ctx.fillRect(0, 0, width, height);

    // Subtle container border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

    // Header badge / title
    ctx.fillStyle = "#6366F1";
    ctx.beginPath();
    ctx.roundRect(20, 18, 4, 20, 2);
    ctx.fill();

    ctx.font = "bold 15px sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(title, 32, 33);

    if (subtitle) {
      ctx.font = "11px sans-serif";
      ctx.fillStyle = "#94A3B8";
      ctx.fillText(subtitle, 32, 50);
    }

    const startY = subtitle ? 66 : 52;
    const availableHeight = height - startY - 20;
    const maxItems = Math.min(items.length, 10);
    if (maxItems === 0) return null;

    const itemHeight = Math.max(24, Math.min(34, availableHeight / Math.max(maxItems, 1)));
    const barAreaX = 230;
    const barAreaWidth = width - barAreaX - 120;

    const maxValue = Math.max(...items.slice(0, maxItems).map(it => it.max || it.value || 1), 1);

    for (let i = 0; i < maxItems; i++) {
      const it = items[i];
      const y = startY + i * itemHeight;

      // Label
      ctx.font = "11px sans-serif";
      ctx.fillStyle = "#E2E8F0";
      const labelText = it.label.length > 28 ? it.label.slice(0, 27) + "…" : it.label;
      ctx.fillText(labelText, 20, y + itemHeight * 0.65);

      // Bar background
      const barY = y + 5;
      const barH = itemHeight - 10;
      ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
      ctx.beginPath();
      ctx.roundRect(barAreaX, barY, barAreaWidth, barH, 4);
      ctx.fill();

      // Bar fill
      const val = it.value || 0;
      const barW = Math.max(4, Math.min(barAreaWidth, (val / maxValue) * barAreaWidth));
      ctx.fillStyle = it.color || "#4F46E5";
      ctx.beginPath();
      ctx.roundRect(barAreaX, barY, barW, barH, 4);
      ctx.fill();

      // Value text
      ctx.font = "bold 11px monospace";
      ctx.fillStyle = "#F8FAFC";
      const valText = it.subText || `${Number(val).toLocaleString("uk-UA")}${valueSuffix}`;
      ctx.fillText(valText, barAreaX + barAreaWidth + 10, y + itemHeight * 0.65);
    }

    return canvas.toDataURL("image/png").split(",")[1];
  } catch (err) {
    console.warn("Chart render failed:", err);
    return null;
  }
}

/**
 * Build Applied Filters Summary text and key-value list
 */
function getAppliedFiltersData(filters = {}) {
  const items = [];

  // 1. Period
  let periodText = "Всі дати (без обмеження)";
  if (filters.period?.preset === "today") {
    periodText = "Сьогодні";
  } else if (filters.period?.preset === "week") {
    periodText = "Поточний тиждень";
  } else if (filters.period?.preset === "month") {
    periodText = "Поточний місяць";
  } else if (filters.period?.startDate || filters.period?.endDate) {
    const s = filters.period.startDate ? formatDateUA(filters.period.startDate) : "—";
    const e = filters.period.endDate ? formatDateUA(filters.period.endDate) : "—";
    periodText = `${s} — ${e}`;
  }
  items.push({ label: "Період", value: periodText });

  // 2. Main Organizations
  const mainOrgsSelected = filters.mainOrgs || [];
  let mainOrgsText = "Всі (5 із 5)";
  if (mainOrgsSelected.length < MAIN_ORGANIZATIONS.length) {
    if (mainOrgsSelected.length === 0) {
      mainOrgsText = "Жодної не обрано (вимкнено всі)";
    } else {
      const names = MAIN_ORGANIZATIONS
        .filter(m => mainOrgsSelected.includes(m.code))
        .map(m => m.name);
      mainOrgsText = names.join(", ");
    }
  }
  items.push({ label: "Основні організації", value: mainOrgsText });

  // 3. Managers
  items.push({
    label: "Менеджери",
    value: filters.managers?.length ? filters.managers.join(", ") : "Всі менеджери",
  });

  // 4. Orgs
  items.push({
    label: "Організації",
    value: filters.orgs?.length ? (filters.orgs.length > 4 ? `${filters.orgs.length} обрано` : filters.orgs.join(", ")) : "Всі організації",
  });

  // 5. Points
  items.push({
    label: "Торгові точки",
    value: filters.points?.length ? (filters.points.length > 4 ? `${filters.points.length} обрано` : filters.points.join(", ")) : "Всі торгові точки",
  });

  // 6. Oblasts
  items.push({
    label: "Області",
    value: filters.oblasts?.length ? filters.oblasts.join(", ") : "Всі області",
  });

  // 7. Cities
  items.push({
    label: "Міста",
    value: filters.cities?.length ? (filters.cities.length > 4 ? `${filters.cities.length} обрано` : filters.cities.join(", ")) : "Всі міста",
  });

  // 8. Manufacturers
  items.push({
    label: "Виробники",
    value: filters.manufacturers?.length ? filters.manufacturers.join(", ") : "Всі виробники",
  });

  // 9. Categories
  items.push({
    label: "Категорії ТТ",
    value: filters.categories?.length ? filters.categories.join(", ") : "Всі категорії (A, B, C, D)",
  });

  // 10. TT Types
  items.push({
    label: "Типи ТТ",
    value: filters.ttTypes?.length ? filters.ttTypes.join(", ") : "Всі типи точок",
  });

  // 11. Presence
  let presenceText = "Всі (без фільтра співпраці)";
  if (filters.presence === "yes") presenceText = "Тільки ті, що співпрацюють з ЮНП";
  if (filters.presence === "no") presenceText = "Тільки ті, що НЕ співпрацюють з ЮНП";
  items.push({ label: "Співпраця з ЮНП", value: presenceText });

  return items;
}

/**
 * Styling helpers for worksheet
 */
const BORDER_THIN = {
  top: { style: "thin", color: { argb: "FFCBD5E1" } },
  left: { style: "thin", color: { argb: "FFCBD5E1" } },
  bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
  right: { style: "thin", color: { argb: "FFCBD5E1" } },
};

const BORDER_DOUBLE_BOTTOM = {
  top: { style: "thin", color: { argb: "FF94A3B8" } },
  left: { style: "thin", color: { argb: "FFCBD5E1" } },
  bottom: { style: "double", color: { argb: "FF475569" } },
  right: { style: "thin", color: { argb: "FFCBD5E1" } },
};

/**
 * Render Applied Filters Box into worksheet
 */
function renderFiltersBox(ws, startRow, filterItems) {
  // Title row
  const titleRow = ws.getRow(startRow);
  titleRow.height = 24;
  const titleCell = ws.getCell(`B${startRow}`);
  titleCell.value = "ЗАСТОСОВАНІ ФІЛЬТРИ";
  titleCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF312E81" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.mergeCells(`B${startRow}:J${startRow}`);
  
  for (let c = 2; c <= 10; c++) {
    ws.getRow(startRow).getCell(c).border = BORDER_THIN;
  }

  // 2 columns of filters
  let curRow = startRow + 1;
  const half = Math.ceil(filterItems.length / 2);
  const col1 = filterItems.slice(0, half);
  const col2 = filterItems.slice(half);

  for (let i = 0; i < half; i++) {
    const r = ws.getRow(curRow);
    r.height = 20;

    // Left filter
    const f1 = col1[i];
    if (f1) {
      ws.getCell(`B${curRow}`).value = f1.label;
      ws.getCell(`B${curRow}`).font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF475569" } };
      ws.getCell(`B${curRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      ws.getCell(`B${curRow}`).alignment = { vertical: "middle", horizontal: "left" };
      ws.getCell(`B${curRow}`).border = BORDER_THIN;

      ws.getCell(`C${curRow}`).value = f1.value;
      ws.getCell(`C${curRow}`).font = { name: "Calibri", size: 9, color: { argb: "FF1E293B" } };
      ws.getCell(`C${curRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
      ws.getCell(`C${curRow}`).alignment = { vertical: "middle", horizontal: "left" };
      ws.mergeCells(`C${curRow}:E${curRow}`);
      for (let c = 3; c <= 5; c++) ws.getCell(curRow, c).border = BORDER_THIN;
    }

    // Right filter
    const f2 = col2[i];
    if (f2) {
      ws.getCell(`F${curRow}`).value = f2.label;
      ws.getCell(`F${curRow}`).font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF475569" } };
      ws.getCell(`F${curRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      ws.getCell(`F${curRow}`).alignment = { vertical: "middle", horizontal: "left" };
      ws.mergeCells(`F${curRow}:G${curRow}`);
      for (let c = 6; c <= 7; c++) ws.getCell(curRow, c).border = BORDER_THIN;

      ws.getCell(`H${curRow}`).value = f2.value;
      ws.getCell(`H${curRow}`).font = { name: "Calibri", size: 9, color: { argb: "FF1E293B" } };
      ws.getCell(`H${curRow}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
      ws.getCell(`H${curRow}`).alignment = { vertical: "middle", horizontal: "left" };
      ws.mergeCells(`H${curRow}:J${curRow}`);
      for (let c = 8; c <= 10; c++) ws.getCell(curRow, c).border = BORDER_THIN;
    }

    curRow++;
  }

  return curRow;
}

/**
 * Render 5 KPI Tiles side-by-side matching UI design
 */
function renderKpiCards(ws, startRow, cards = []) {
  // Tile column layout: 5 tiles across B..K (each 2 columns)
  // Tile 1: B-C
  // Tile 2: D-E
  // Tile 3: F-G
  // Tile 4: H-I
  // Tile 5: J-K

  const tileCols = [
    { start: 2, end: 3, colStart: "B", colEnd: "C", headerFill: "FF312E81", headerText: "FFFFFFFF", bodyFill: "FFEEF2FF", border: "FFC7D2FE", accent: "FF4F46E5" },
    { start: 4, end: 5, colStart: "D", colEnd: "E", headerFill: "FF065F46", headerText: "FFFFFFFF", bodyFill: "FFECFDF5", border: "FFA7F3D0", accent: "FF10B981" },
    { start: 6, end: 7, colStart: "F", colEnd: "G", headerFill: "FF155E75", headerText: "FFFFFFFF", bodyFill: "FFECFEFF", border: "FFA5F3FC", accent: "FF06B6D4" },
    { start: 8, end: 9, colStart: "H", colEnd: "I", headerFill: "FF92400E", headerText: "FFFFFFFF", bodyFill: "FFFFFBEB", border: "FFFDE68A", accent: "FFF59E0B" },
    { start: 10, end: 11, colStart: "J", colEnd: "K", headerFill: "FF5B21B6", headerText: "FFFFFFFF", bodyFill: "FFF5F3FF", border: "FFDDD6FE", accent: "FF8B5CF6" },
  ];

  const row1 = startRow;     // Header (Title)
  const row2 = startRow + 1; // Big main value
  const row3 = startRow + 2; // Main label
  const row4 = startRow + 3; // Sub metric 1
  const row5 = startRow + 4; // Sub metric 2 (or padding)

  ws.getRow(row1).height = 22;
  ws.getRow(row2).height = 34;
  ws.getRow(row3).height = 18;
  ws.getRow(row4).height = 20;
  ws.getRow(row5).height = 20;

  cards.forEach((card, idx) => {
    if (idx >= tileCols.length) return;
    const style = tileCols[idx];
    const borderStyle = {
      top: { style: "thin", color: { argb: style.border } },
      left: { style: "thin", color: { argb: style.border } },
      bottom: { style: "thin", color: { argb: style.border } },
      right: { style: "thin", color: { argb: style.border } },
    };

    // Row 1: Title
    ws.mergeCells(`${style.colStart}${row1}:${style.colEnd}${row1}`);
    const c1 = ws.getCell(`${style.colStart}${row1}`);
    c1.value = card.title.toUpperCase();
    c1.font = { name: "Calibri", size: 10, bold: true, color: { argb: style.headerText } };
    c1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: style.headerFill } };
    c1.alignment = { vertical: "middle", horizontal: "center" };
    c1.border = borderStyle;

    // Row 2: Big Main Value
    ws.mergeCells(`${style.colStart}${row2}:${style.colEnd}${row2}`);
    const c2 = ws.getCell(`${style.colStart}${row2}`);
    c2.value = card.mainValue;
    c2.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FF0F172A" } };
    c2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: style.bodyFill } };
    c2.alignment = { vertical: "middle", horizontal: "center" };
    c2.border = borderStyle;

    // Row 3: Main Label
    ws.mergeCells(`${style.colStart}${row3}:${style.colEnd}${row3}`);
    const c3 = ws.getCell(`${style.colStart}${row3}`);
    c3.value = card.mainLabel;
    c3.font = { name: "Calibri", size: 8.5, color: { argb: "FF64748B" } };
    c3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: style.bodyFill } };
    c3.alignment = { vertical: "middle", horizontal: "center" };
    c3.border = borderStyle;

    // Row 4: Metric 1
    ws.mergeCells(`${style.colStart}${row4}:${style.colEnd}${row4}`);
    const c4 = ws.getCell(`${style.colStart}${row4}`);
    const m1 = card.metrics?.[0];
    c4.value = m1 ? `${m1.label}: ${m1.value}` : "";
    c4.font = { name: "Calibri", size: 8.5, bold: true, color: { argb: "FF334155" } };
    c4.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
    c4.alignment = { vertical: "middle", horizontal: "center" };
    c4.border = borderStyle;

    // Row 5: Metric 2
    ws.mergeCells(`${style.colStart}${row5}:${style.colEnd}${row5}`);
    const c5 = ws.getCell(`${style.colStart}${row5}`);
    const m2 = card.metrics?.[1];
    c5.value = m2 ? `${m2.label}: ${m2.value}` : "—";
    c5.font = { name: "Calibri", size: 8.5, color: m2?.highlight ? { argb: "FF059669" } : m2?.alert ? { argb: "FFE11D48" } : { argb: "FF64748B" } };
    c5.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
    c5.alignment = { vertical: "middle", horizontal: "center" };
    c5.border = borderStyle;
  });

  return startRow + 5;
}

/**
 * Render section header banner
 */
function renderSectionHeader(ws, row, title, subtitle) {
  ws.getRow(row).height = 24;
  const cell = ws.getCell(`B${row}`);
  cell.value = title.toUpperCase();
  cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.mergeCells(`B${row}:J${row}`);

  for (let c = 2; c <= 10; c++) {
    ws.getCell(row, c).border = BORDER_THIN;
  }

  if (subtitle) {
    ws.getRow(row + 1).height = 18;
    const subCell = ws.getCell(`B${row + 1}`);
    subCell.value = subtitle;
    subCell.font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF64748B" } };
    subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    subCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.mergeCells(`B${row + 1}:J${row + 1}`);
    for (let c = 2; c <= 10; c++) {
      ws.getCell(row + 1, c).border = BORDER_THIN;
    }
    return row + 2;
  }

  return row + 1;
}

/**
 * Set column widths for a worksheet
 */
function setSheetColumnWidths(ws, widths = []) {
  widths.forEach((w, idx) => {
    ws.getColumn(idx + 1).width = w;
  });
}

/**
 * EXPORT SHORT REPORT ("Коротко")
 * Generates an Excel workbook with TWO rich sheets:
 * 1. "Ключова аналітика"
 * 2. "Аналіз по моделях"
 */
export async function exportShortReport({
  data,
  latestFilteredVisits = [],
  keyStats = [],
  filters = {},
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Passport Region Analytics";
  wb.created = new Date();

  const filterSummary = getAppliedFiltersData(filters);
  const nowFormatted = new Date().toLocaleString("uk-UA");

  // =========================================================================
  // SHEET 1: КЛЮЧОВА АНАЛІТИКА
  // =========================================================================
  const ws1 = wb.addWorksheet("Ключова аналітика", {
    views: [{ showGridLines: true }],
  });

  setSheetColumnWidths(ws1, [
    4,   // A: margin
    28,  // B: Title / Name / Col 1
    14,  // C: Col 2
    16,  // D: Col 3
    16,  // E: Col 4
    16,  // F: Col 5
    16,  // G: Col 6
    18,  // H: Col 7
    24,  // I: Col 8 / Bar
    26,  // J: Col 9
    18,  // K: Col 10
    16,  // L: Col 11
    16,  // M: Col 12
    16,  // N: Col 13
    16   // O: Col 14
  ]);

  // Title Banner
  ws1.getRow(2).height = 32;
  const hCell = ws1.getCell("B2");
  hCell.value = "ЗВІТ: КЛЮЧОВА АНАЛІТИКА";
  hCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  hCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF312E81" } };
  hCell.alignment = { vertical: "middle", horizontal: "center" };
  ws1.mergeCells("B2:K2");

  ws1.getRow(3).height = 18;
  const subCell1 = ws1.getCell("B3");
  subCell1.value = `Сформовано: ${nowFormatted} | Джерело: Паспорт Регіону`;
  subCell1.font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF64748B" } };
  subCell1.alignment = { vertical: "middle", horizontal: "center" };
  ws1.mergeCells("B3:K3");

  // Applied Filters Box
  let curRow1 = renderFiltersBox(ws1, 5, filterSummary);
  curRow1 += 1;

  // 5 KPI Stats Tiles (Matching screen)
  curRow1 = renderKpiCards(ws1, curRow1, keyStats);
  curRow1 += 2;

  // -------------------------------------------------------------------------
  // 1. СТРУКТУРА РИНКУ ЗА ВИРОБНИКАМИ
  // -------------------------------------------------------------------------
  curRow1 = renderSectionHeader(
    ws1,
    curRow1,
    "1. Структура ринку за виробниками",
    "Аналіз присутності, продажів (ПП) та викладки спальних місць (КВ) у торгових точках"
  );

  // Compute table data for manufacturers
  const totalUniqueTTs = latestFilteredVisits.length;
  const totalMarketPotential = latestFilteredVisits.reduce((acc, v) => acc + (v.totalPP || 0), 0);
  const totalMarketKV = latestFilteredVisits.reduce((acc, v) => acc + (v.totalKV || 0), 0);

  const mfgMap = new Map();
  latestFilteredVisits.forEach(v => {
    (v.visitManufacturers || []).forEach(vm => {
      const name = (vm.name || "").trim();
      if (!name) return;
      if (!mfgMap.has(name)) {
        mfgMap.set(name, { name, visits: [], sales: 0, places: 0 });
      }
      const entry = mfgMap.get(name);
      entry.visits.push(v);
      entry.sales += (vm.pp || 0);
      entry.places += (vm.kv || 0);
    });
  });

  const mfgRows = Array.from(mfgMap.values()).map(m => {
    const ttCount = new Set(m.visits.map(v => v.ttKey || `${v.org}:::${v.point}`)).size || m.visits.length;
    const pointsTotalPotential = m.visits.reduce((acc, v) => acc + (v.totalPP || 0), 0);
    const salesSharePct = totalMarketPotential > 0 ? (m.sales / totalMarketPotential) * 100 : 0;
    const ttSharePct = totalUniqueTTs > 0 ? (ttCount / totalUniqueTTs) * 100 : 0;
    const placesSharePct = totalMarketKV > 0 ? (m.places / totalMarketKV) * 100 : 0;
    const isHighfoam = m.name.toLowerCase() === "highfoam";

    return {
      name: m.name,
      isHighfoam,
      ttCount,
      ttSharePct,
      sales: m.sales,
      salesSharePct,
      places: m.places,
      placesSharePct,
      pointsTotalPotential,
    };
  }).sort((a, b) => b.sales - a.sales);

  // Embedded Chart: Market Structure
  const mfgChartBase64 = drawBarChartImage({
    title: "СТРУКТУРА РИНКУ: ТОП ВИРОБНИКИ (ПРОДАЖІ ТА ЧАСТКА)",
    subtitle: "Розподіл щомісячних продажів (ПП, шт/міс) серед ключових виробників",
    items: mfgRows.slice(0, 8).map(m => ({
      label: m.name,
      value: m.sales,
      max: mfgRows[0]?.sales || 1,
      color: m.isHighfoam ? "#4F46E5" : "#0EA5E9",
      subText: `${m.sales.toLocaleString("uk-UA")} шт (${m.salesSharePct.toFixed(1)}%)`,
    })),
    width: 820,
    height: 320,
  });

  if (mfgChartBase64) {
    try {
      const imgId = wb.addImage({ base64: mfgChartBase64, extension: "png" });
      ws1.addImage(imgId, {
        tl: { col: 1, row: curRow1 - 1 },
        ext: { width: 680, height: 260 },
      });
      curRow1 += 14; // advance rows to clear the image
    } catch (e) {
      console.warn("Failed to insert mfg chart:", e);
    }
  }

  // Table Headers
  const mfgHeaders = [
    "Виробник",
    "Кількість ТТ",
    "Частка ТТ",
    "Продажі (ПП, шт)",
    "Частка продажів",
    "Спальні місця (КВ)",
    "Частка місць",
    "Заг. потенціал ТТ",
    "Графічна частка ринку"
  ];

  const mfgHeaderRow = ws1.getRow(curRow1);
  mfgHeaderRow.height = 24;
  mfgHeaders.forEach((h, idx) => {
    const colIdx = idx + 2;
    const c = mfgHeaderRow.getCell(colIdx);
    c.value = h;
    c.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
    c.alignment = { vertical: "middle", horizontal: idx === 0 ? "left" : "center", wrapText: true };
    c.border = BORDER_THIN;
  });
  curRow1++;

  // Table Rows
  mfgRows.forEach(r => {
    const row = ws1.getRow(curRow1);
    row.height = 20;

    const rowFill = r.isHighfoam 
      ? { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } }
      : curRow1 % 2 === 0
      ? { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } }
      : { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };

    const fontStyle = r.isHighfoam 
      ? { name: "Calibri", size: 9.5, bold: true, color: { argb: "FF312E81" } }
      : { name: "Calibri", size: 9, color: { argb: "FF1E293B" } };

    const cells = [
      { col: 2, val: r.name, align: "left" },
      { col: 3, val: r.ttCount, align: "right", numFmt: "#,##0" },
      { col: 4, val: r.ttSharePct / 100, align: "right", numFmt: "0.0%" },
      { col: 5, val: r.sales, align: "right", numFmt: "#,##0" },
      { col: 6, val: r.salesSharePct / 100, align: "right", numFmt: "0.0%" },
      { col: 7, val: r.places, align: "right", numFmt: "#,##0" },
      { col: 8, val: r.placesSharePct / 100, align: "right", numFmt: "0.0%" },
      { col: 9, val: r.pointsTotalPotential, align: "right", numFmt: "#,##0" },
      { col: 10, val: generateUnicodeBar(r.salesSharePct, 8), align: "left" },
    ];

    cells.forEach(c => {
      const cell = row.getCell(c.col);
      cell.value = c.val;
      cell.font = fontStyle;
      cell.fill = rowFill;
      cell.alignment = { vertical: "middle", horizontal: c.align };
      if (c.numFmt) cell.numFmt = c.numFmt;
      cell.border = BORDER_THIN;
    });

    curRow1++;
  });

  // Totals Row
  const totalSalesMfg = mfgRows.reduce((a, b) => a + b.sales, 0);
  const totalPlacesMfg = mfgRows.reduce((a, b) => a + b.places, 0);
  const mfgTotalRow = ws1.getRow(curRow1);
  mfgTotalRow.height = 22;

  const mfgTotals = [
    { col: 2, val: "РАЗОМ", align: "left" },
    { col: 3, val: totalUniqueTTs, align: "right", numFmt: "#,##0" },
    { col: 4, val: 1, align: "right", numFmt: "0.0%" },
    { col: 5, val: totalSalesMfg, align: "right", numFmt: "#,##0" },
    { col: 6, val: 1, align: "right", numFmt: "0.0%" },
    { col: 7, val: totalPlacesMfg, align: "right", numFmt: "#,##0" },
    { col: 8, val: 1, align: "right", numFmt: "0.0%" },
    { col: 9, val: totalMarketPotential, align: "right", numFmt: "#,##0" },
    { col: 10, val: "100,0%", align: "center" },
  ];

  mfgTotals.forEach(t => {
    const c = mfgTotalRow.getCell(t.col);
    c.value = t.val;
    c.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: "FF0F172A" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    c.alignment = { vertical: "middle", horizontal: t.align };
    if (t.numFmt) c.numFmt = t.numFmt;
    c.border = BORDER_DOUBLE_BOTTOM;
  });
  curRow1 += 3;

  // -------------------------------------------------------------------------
  // 2. РЕЗУЛЬТАТИ ЗА МЕНЕДЖЕРАМИ
  // -------------------------------------------------------------------------
  curRow1 = renderSectionHeader(
    ws1,
    curRow1,
    "2. Результати за менеджерами",
    "Ефективність співробітників, частка ЮНП та потенціал росту в закріплених точках"
  );

  const managerMap = new Map();
  latestFilteredVisits.forEach(v => {
    const mName = (v.agent || "Невідомий").trim();
    if (!managerMap.has(mName)) {
      managerMap.set(mName, { name: mName, visits: [] });
    }
    managerMap.get(mName).visits.push(v);
  });

  const managerRows = Array.from(managerMap.values()).map(m => {
    const ttCount = m.visits.length;
    const potential = m.visits.reduce((acc, v) => acc + (v.totalPP || 0), 0);
    const sales = m.visits.reduce((acc, v) => acc + (v.highfoamPP || 0), 0);
    const sharePct = potential > 0 ? (sales / potential) * 100 : 0;
    const growthPotential = Math.max(0, potential - sales);
    const withoutUs = m.visits.filter(v => !v.isCooperating).length;

    return {
      name: m.name,
      ttCount,
      potential,
      sales,
      sharePct,
      growthPotential,
      withoutUs,
    };
  }).sort((a, b) => b.sales - a.sales);

  // Embedded Chart: Manager Results
  const mgrChartBase64 = drawBarChartImage({
    title: "ПРОДАЖІ ТА ПОТЕНЦІАЛ ЗА МЕНЕДЖЕРАМИ",
    subtitle: "Обсяги продажів ЮНП (Highfoam) порівняно із загальним потенціалом",
    items: managerRows.slice(0, 8).map(m => ({
      label: m.name,
      value: m.sales,
      max: managerRows[0]?.sales || 1,
      color: "#10B981",
      subText: `${m.sales.toLocaleString("uk-UA")} шт (${m.sharePct.toFixed(1)}%)`,
    })),
    width: 820,
    height: 320,
  });

  if (mgrChartBase64) {
    try {
      const imgId = wb.addImage({ base64: mgrChartBase64, extension: "png" });
      ws1.addImage(imgId, {
        tl: { col: 1, row: curRow1 - 1 },
        ext: { width: 680, height: 260 },
      });
      curRow1 += 14;
    } catch (e) {
      console.warn("Failed to insert manager chart:", e);
    }
  }

  // Manager Table Headers
  const mgrHeaders = [
    "Менеджер",
    "Кількість ТТ",
    "Загальний потенціал",
    "Продажі ЮНП",
    "Частка ЮНП, %",
    "Потенціал зростання",
    "Без присутності ЮНП",
    "Візуалізація частки"
  ];

  const mgrHeaderRow = ws1.getRow(curRow1);
  mgrHeaderRow.height = 24;
  mgrHeaders.forEach((h, idx) => {
    const colIdx = idx + 2;
    const c = mgrHeaderRow.getCell(colIdx);
    c.value = h;
    c.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
    c.alignment = { vertical: "middle", horizontal: idx === 0 ? "left" : "center", wrapText: true };
    c.border = BORDER_THIN;
  });
  curRow1++;

  managerRows.forEach(r => {
    const row = ws1.getRow(curRow1);
    row.height = 20;
    const rowFill = curRow1 % 2 === 0
      ? { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } }
      : { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };

    const cells = [
      { col: 2, val: r.name, align: "left" },
      { col: 3, val: r.ttCount, align: "right", numFmt: "#,##0" },
      { col: 4, val: r.potential, align: "right", numFmt: "#,##0" },
      { col: 5, val: r.sales, align: "right", numFmt: "#,##0" },
      { col: 6, val: r.sharePct / 100, align: "right", numFmt: "0.0%" },
      { col: 7, val: r.growthPotential, align: "right", numFmt: "#,##0" },
      { col: 8, val: r.withoutUs, align: "right", numFmt: "#,##0" },
      { col: 9, val: generateUnicodeBar(r.sharePct, 8), align: "left" },
    ];

    cells.forEach(c => {
      const cell = row.getCell(c.col);
      cell.value = c.val;
      cell.font = { name: "Calibri", size: 9, color: { argb: "FF1E293B" } };
      cell.fill = rowFill;
      cell.alignment = { vertical: "middle", horizontal: c.align };
      if (c.numFmt) cell.numFmt = c.numFmt;
      cell.border = BORDER_THIN;
    });

    curRow1++;
  });

  // Manager Totals Row
  const totalMgrTT = managerRows.reduce((a, b) => a + b.ttCount, 0);
  const totalMgrPot = managerRows.reduce((a, b) => a + b.potential, 0);
  const totalMgrSales = managerRows.reduce((a, b) => a + b.sales, 0);
  const totalMgrGrowth = Math.max(0, totalMgrPot - totalMgrSales);
  const totalMgrWithout = managerRows.reduce((a, b) => a + b.withoutUs, 0);
  const totalMgrShare = totalMgrPot > 0 ? totalMgrSales / totalMgrPot : 0;

  const mgrTotalRow = ws1.getRow(curRow1);
  mgrTotalRow.height = 22;

  const mgrTotals = [
    { col: 2, val: "РАЗОМ", align: "left" },
    { col: 3, val: totalMgrTT, align: "right", numFmt: "#,##0" },
    { col: 4, val: totalMgrPot, align: "right", numFmt: "#,##0" },
    { col: 5, val: totalMgrSales, align: "right", numFmt: "#,##0" },
    { col: 6, val: totalMgrShare, align: "right", numFmt: "0.0%" },
    { col: 7, val: totalMgrGrowth, align: "right", numFmt: "#,##0" },
    { col: 8, val: totalMgrWithout, align: "right", numFmt: "#,##0" },
    { col: 9, val: generateUnicodeBar(totalMgrShare * 100, 8), align: "left" },
  ];

  mgrTotals.forEach(t => {
    const c = mgrTotalRow.getCell(t.col);
    c.value = t.val;
    c.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: "FF0F172A" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    c.alignment = { vertical: "middle", horizontal: t.align };
    if (t.numFmt) c.numFmt = t.numFmt;
    c.border = BORDER_DOUBLE_BOTTOM;
  });
  curRow1 += 3;

  // -------------------------------------------------------------------------
  // 3. РЕГІОНИ ЗА ПОТЕНЦІАЛОМ
  // -------------------------------------------------------------------------
  curRow1 = renderSectionHeader(
    ws1,
    curRow1,
    "3. Регіони за потенціалом",
    "Розподіл місткості ринку та частки ЮНП за областями України"
  );

  const regionMap = new Map();
  latestFilteredVisits.forEach(v => {
    const reg = (v.oblast || "Не вказано").trim();
    if (!regionMap.has(reg)) {
      regionMap.set(reg, { name: reg, visits: [] });
    }
    regionMap.get(reg).visits.push(v);
  });

  const regionRows = Array.from(regionMap.values()).map(r => {
    const ttCount = r.visits.length;
    const potential = r.visits.reduce((acc, v) => acc + (v.totalPP || 0), 0);
    const sales = r.visits.reduce((acc, v) => acc + (v.highfoamPP || 0), 0);
    const sharePct = potential > 0 ? (sales / potential) * 100 : 0;
    const growthPotential = Math.max(0, potential - sales);
    const withoutUs = r.visits.filter(v => !v.isCooperating).length;

    return {
      name: r.name,
      ttCount,
      potential,
      sales,
      sharePct,
      growthPotential,
      withoutUs,
    };
  }).sort((a, b) => b.potential - a.potential);

  // Region Table Headers
  const regHeaders = [
    "Область",
    "Кількість ТТ",
    "Загальний потенціал",
    "Продажі ЮНП",
    "Частка ЮНП, %",
    "Потенціал зростання",
    "Без присутності ЮНП",
    "Візуалізація частки"
  ];

  const regHeaderRow = ws1.getRow(curRow1);
  regHeaderRow.height = 24;
  regHeaders.forEach((h, idx) => {
    const colIdx = idx + 2;
    const c = regHeaderRow.getCell(colIdx);
    c.value = h;
    c.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
    c.alignment = { vertical: "middle", horizontal: idx === 0 ? "left" : "center", wrapText: true };
    c.border = BORDER_THIN;
  });
  curRow1++;

  regionRows.forEach(r => {
    const row = ws1.getRow(curRow1);
    row.height = 20;
    const rowFill = curRow1 % 2 === 0
      ? { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } }
      : { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };

    const cells = [
      { col: 2, val: r.name, align: "left" },
      { col: 3, val: r.ttCount, align: "right", numFmt: "#,##0" },
      { col: 4, val: r.potential, align: "right", numFmt: "#,##0" },
      { col: 5, val: r.sales, align: "right", numFmt: "#,##0" },
      { col: 6, val: r.sharePct / 100, align: "right", numFmt: "0.0%" },
      { col: 7, val: r.growthPotential, align: "right", numFmt: "#,##0" },
      { col: 8, val: r.withoutUs, align: "right", numFmt: "#,##0" },
      { col: 9, val: generateUnicodeBar(r.sharePct, 8), align: "left" },
    ];

    cells.forEach(c => {
      const cell = row.getCell(c.col);
      cell.value = c.val;
      cell.font = { name: "Calibri", size: 9, color: { argb: "FF1E293B" } };
      cell.fill = rowFill;
      cell.alignment = { vertical: "middle", horizontal: c.align };
      if (c.numFmt) cell.numFmt = c.numFmt;
      cell.border = BORDER_THIN;
    });

    curRow1++;
  });

  // Region Totals Row
  const totalRegTT = regionRows.reduce((a, b) => a + b.ttCount, 0);
  const totalRegPot = regionRows.reduce((a, b) => a + b.potential, 0);
  const totalRegSales = regionRows.reduce((a, b) => a + b.sales, 0);
  const totalRegGrowth = Math.max(0, totalRegPot - totalRegSales);
  const totalRegWithout = regionRows.reduce((a, b) => a + b.withoutUs, 0);
  const totalRegShare = totalRegPot > 0 ? totalRegSales / totalRegPot : 0;

  const regTotalRow = ws1.getRow(curRow1);
  regTotalRow.height = 22;

  const regTotals = [
    { col: 2, val: "РАЗОМ", align: "left" },
    { col: 3, val: totalRegTT, align: "right", numFmt: "#,##0" },
    { col: 4, val: totalRegPot, align: "right", numFmt: "#,##0" },
    { col: 5, val: totalRegSales, align: "right", numFmt: "#,##0" },
    { col: 6, val: totalRegShare, align: "right", numFmt: "0.0%" },
    { col: 7, val: totalRegGrowth, align: "right", numFmt: "#,##0" },
    { col: 8, val: totalRegWithout, align: "right", numFmt: "#,##0" },
    { col: 9, val: generateUnicodeBar(totalRegShare * 100, 8), align: "left" },
  ];

  regTotals.forEach(t => {
    const c = regTotalRow.getCell(t.col);
    c.value = t.val;
    c.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: "FF0F172A" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    c.alignment = { vertical: "middle", horizontal: t.align };
    if (t.numFmt) c.numFmt = t.numFmt;
    c.border = BORDER_DOUBLE_BOTTOM;
  });
  curRow1 += 3;

  // -------------------------------------------------------------------------
  // 4. НАЙБІЛЬШІ ТОЧКИ ЗРОСТАННЯ ЗА КЛІЄНТАМИ (потенціал зростання ≥ 20)
  // -------------------------------------------------------------------------
  curRow1 = renderSectionHeader(
    ws1,
    curRow1,
    "4. Найбільші точки зростання за клієнтами (потенціал зростання ≥ 20)",
    "Міста з найбільшим вільним потенціалом заміщення продукції конкурентів на продукцію ЮНП"
  );

  // Group visits by City (and Oblast)
  const cityMap = new Map();
  latestFilteredVisits.forEach(v => {
    const cityName = (v.city || "Невідомо").trim();
    const oblastName = (v.oblast || "Не вказано").trim();
    const key = `${cityName.toLowerCase()}:::${oblastName.toLowerCase()}`;
    if (!cityMap.has(key)) {
      cityMap.set(key, { city: cityName, oblast: oblastName, visits: [] });
    }
    cityMap.get(key).visits.push(v);
  });

  const growthRows = [];
  cityMap.forEach(({ city, oblast, visits }) => {
    const potential = visits.reduce((acc, v) => acc + (v.totalPP || 0), 0);
    const sales = visits.reduce((acc, v) => acc + (v.highfoamPP || 0), 0);
    const growthPotential = Math.max(0, potential - sales);
    if (growthPotential < 20) return;

    const managers = Array.from(new Set(visits.map(v => (v.agent || "").trim()).filter(Boolean)));
    const managerDisplay = managers.length > 0 ? managers.join(", ") : "—";
    const ttCount = new Set(visits.map(v => v.ttKey || `${v.org}:::${v.point}`)).size || visits.length;

    const otherMfMap = new Map();
    visits.forEach(v => {
      (v.visitManufacturers || []).forEach(vm => {
        const mName = (vm.name || "").trim();
        if (mName && mName.toLowerCase() !== "highfoam" && mName.toLowerCase() !== "юнп") {
          otherMfMap.set(mName, (otherMfMap.get(mName) || 0) + (vm.pp || 1));
        }
      });
    });

    const otherSuppliersList = Array.from(otherMfMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(e => e[0]);

    growthRows.push({
      city: city.startsWith("м.") ? city : `м. ${city}`,
      oblast: oblast !== "Не вказано" ? oblast : "—",
      manager: managerDisplay,
      ttCount,
      potential,
      sales,
      sharePct: potential > 0 ? (sales / potential) * 100 : 0,
      growthPotential,
      otherSuppliers: otherSuppliersList.length > 0 ? otherSuppliersList.join(", ") : "—",
    });
  });

  growthRows.sort((a, b) => b.growthPotential - a.growthPotential);

  // Growth Table Headers (Including 'Кількість ТТ' column after 'Менеджер')
  const growthHeaders = [
    "Місто",
    "Область",
    "Менеджер",
    "Кількість ТТ",
    "Потенціал",
    "Продажі ЮНП",
    "Частка ЮНП, %",
    "Потенціал зростання",
    "Інші постачальники"
  ];

  const growthHeaderRow = ws1.getRow(curRow1);
  growthHeaderRow.height = 24;
  growthHeaders.forEach((h, idx) => {
    const colIdx = idx + 2;
    const c = growthHeaderRow.getCell(colIdx);
    c.value = h;
    c.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
    c.alignment = { vertical: "middle", horizontal: idx < 3 || idx === 8 ? "left" : "center", wrapText: true };
    c.border = BORDER_THIN;
  });
  curRow1++;

  growthRows.forEach(r => {
    const row = ws1.getRow(curRow1);
    row.height = 20;
    const rowFill = curRow1 % 2 === 0
      ? { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } }
      : { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };

    const cells = [
      { col: 2, val: r.city, align: "left" },
      { col: 3, val: r.oblast, align: "left" },
      { col: 4, val: r.manager, align: "left" },
      { col: 5, val: r.ttCount, align: "center", numFmt: "#,##0" },
      { col: 6, val: r.potential, align: "right", numFmt: "#,##0" },
      { col: 7, val: r.sales, align: "right", numFmt: "#,##0" },
      { col: 8, val: r.sharePct / 100, align: "right", numFmt: "0.0%" },
      { col: 9, val: r.growthPotential, align: "right", numFmt: "#,##0" },
      { col: 10, val: r.otherSuppliers, align: "left" },
    ];

    cells.forEach(c => {
      const cell = row.getCell(c.col);
      cell.value = c.val;
      cell.font = { name: "Calibri", size: 9, color: { argb: "FF1E293B" } };
      cell.fill = rowFill;
      cell.alignment = { vertical: "middle", horizontal: c.align };
      if (c.numFmt) cell.numFmt = c.numFmt;
      cell.border = BORDER_THIN;
    });

    curRow1++;
  });

  // Growth Totals Row
  const totalGrowthTT = growthRows.reduce((a, b) => a + b.ttCount, 0);
  const totalGrowthPot = growthRows.reduce((a, b) => a + b.potential, 0);
  const totalGrowthSales = growthRows.reduce((a, b) => a + b.sales, 0);
  const totalGrowthSum = growthRows.reduce((a, b) => a + b.growthPotential, 0);
  const totalGrowthShare = totalGrowthPot > 0 ? totalGrowthSales / totalGrowthPot : 0;

  const growthTotalRow = ws1.getRow(curRow1);
  growthTotalRow.height = 22;

  const growthTotals = [
    { col: 2, val: "РАЗОМ", align: "left" },
    { col: 3, val: "", align: "left" },
    { col: 4, val: "", align: "left" },
    { col: 5, val: totalGrowthTT, align: "center", numFmt: "#,##0" },
    { col: 6, val: totalGrowthPot, align: "right", numFmt: "#,##0" },
    { col: 7, val: totalGrowthSales, align: "right", numFmt: "#,##0" },
    { col: 8, val: totalGrowthShare, align: "right", numFmt: "0.0%" },
    { col: 9, val: totalGrowthSum, align: "right", numFmt: "#,##0" },
    { col: 10, val: "", align: "left" },
  ];

  growthTotals.forEach(t => {
    const c = growthTotalRow.getCell(t.col);
    c.value = t.val;
    c.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: "FF0F172A" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    c.alignment = { vertical: "middle", horizontal: t.align };
    if (t.numFmt) c.numFmt = t.numFmt;
    c.border = BORDER_DOUBLE_BOTTOM;
  });
  curRow1 += 3;

  // -------------------------------------------------------------------------
  // 5. РЕЗЮМЕ ТОРГОВИХ ТОЧОК
  // -------------------------------------------------------------------------
  curRow1 = renderSectionHeader(
    ws1,
    curRow1,
    "5. Торгові точки (Реєстр торгових точок)",
    "Детальний перелік унікальних торгових точок, їх параметри та показники присутності"
  );

  const ttHeaders = [
    "№",
    "Торгова точка",
    "Організація",
    "Місто",
    "Область",
    "Адреса",
    "Тип ТТ",
    "Категорія",
    "Менеджер",
    "Присутність ЮНП",
    "Потенціал (PP)",
    "Продажі ЮНП",
    "Спальні місця (КВ)",
    "Дата візиту"
  ];

  const ttHeaderRow = ws1.getRow(curRow1);
  ttHeaderRow.height = 24;
  ttHeaders.forEach((h, idx) => {
    const colIdx = idx + 2;
    const c = ttHeaderRow.getCell(colIdx);
    c.value = h;
    c.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.border = BORDER_THIN;
  });
  curRow1++;

  latestFilteredVisits.forEach((v, idx) => {
    const row = ws1.getRow(curRow1);
    row.height = 19;
    const rowFill = curRow1 % 2 === 0
      ? { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } }
      : { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };

    const cells = [
      { col: 2, val: idx + 1, align: "center" },
      { col: 3, val: v.point || "Невідома ТТ", align: "left" },
      { col: 4, val: v.org || "Без організації", align: "left" },
      { col: 5, val: v.city || "Невідомо", align: "left" },
      { col: 6, val: v.oblast || "Не вказано", align: "left" },
      { col: 7, val: v.address || "—", align: "left" },
      { col: 8, val: v.ttType || "—", align: "center" },
      { col: 9, val: v.category || "—", align: "center" },
      { col: 10, val: v.agent || "—", align: "left" },
      { col: 11, val: v.isCooperating ? "Так" : "Ні", align: "center" },
      { col: 12, val: v.totalPP || 0, align: "right", numFmt: "#,##0" },
      { col: 13, val: v.highfoamPP || 0, align: "right", numFmt: "#,##0" },
      { col: 14, val: v.totalKV || 0, align: "right", numFmt: "#,##0" },
      { col: 15, val: formatDateUA(v.visited_at || v.date), align: "center" },
    ];

    cells.forEach(c => {
      const cell = row.getCell(c.col);
      cell.value = c.val;
      cell.font = { name: "Calibri", size: 8.5, color: { argb: "FF1E293B" } };
      cell.fill = rowFill;
      cell.alignment = { vertical: "middle", horizontal: c.align };
      if (c.numFmt) cell.numFmt = c.numFmt;
      cell.border = BORDER_THIN;
    });

    curRow1++;
  });


  // =========================================================================
  // SHEET 2: АНАЛІЗ ПО МОДЕЛЯХ
  // =========================================================================
  const ws2 = wb.addWorksheet("Аналіз по моделях", {
    views: [{ showGridLines: true }],
  });

  setSheetColumnWidths(ws2, [
    4,   // A: margin
    8,   // B: №
    30,  // C: Модель
    18,  // D: Заг к-ть точок (без фільтрів)
    18,  // E: К-ть точок (за фільтром)
    18,  // F: Заг ЮНП (за фільтром)
    16,  // G: % покриття
    24,  // H: Графічна шкала
    16,  // I: Факт продажі
    22,  // J: ТТ
    22,  // K: Орг
    18,  // L: Місто
    18,  // M: Менеджер
    28,  // N: Моделі на ТТ
    16   // O: Всього моделей
  ]);

  // Title Banner Sheet 2
  ws2.getRow(2).height = 32;
  const hCell2 = ws2.getCell("B2");
  hCell2.value = "ЗВІТ: АНАЛІЗ ПО МОДЕЛЯХ";
  hCell2.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  hCell2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4338CA" } };
  hCell2.alignment = { vertical: "middle", horizontal: "center" };
  ws2.mergeCells("B2:I2");

  ws2.getRow(3).height = 18;
  const subCell2 = ws2.getCell("B3");
  subCell2.value = `Highfoam & Privat Label | Сформовано: ${nowFormatted}`;
  subCell2.font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF64748B" } };
  subCell2.alignment = { vertical: "middle", horizontal: "center" };
  ws2.mergeCells("B3:I3");

  // Applied Filters Box Sheet 2
  let curRow2 = renderFiltersBox(ws2, 5, filterSummary);
  curRow2 += 1;

  // Process models data for Sheet 2
  const allVisits = data?.raw || [];
  const allUniquePoints = [];
  const seenKeys = new Set();
  allVisits.forEach(v => {
    const key = v.ttKey || `${(v.org || "").toLowerCase()}:::${(v.point || "").toLowerCase()}:::${(v.address || "").toLowerCase()}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      allUniquePoints.push(v);
    }
  });

  const unpPointsInFilterCount = latestFilteredVisits.filter(
    p => p.isCooperating === true || (p.highfoamPP || 0) > 0
  ).length;

  const allBrandsList = data?.allBrands || [];
  const processedModels = allBrandsList.map(b => {
    const modelName = b.name;
    const isPm = b.is_pm === true || modelName.toLowerCase().startsWith("privat");
    const isHighfoam = !isPm;

    const totalPoints = allUniquePoints.filter(p => {
      if (p.brandPresence && p.brandPresence[modelName] !== undefined) {
        return p.brandPresence[modelName] === true;
      }
      return (p.visit_brands || []).some(vb => vb.brand?.name === modelName);
    }).length;

    const filteredPoints = latestFilteredVisits.filter(p => {
      if (p.brandPresence && p.brandPresence[modelName] !== undefined) {
        return p.brandPresence[modelName] === true;
      }
      return (p.visit_brands || []).some(vb => vb.brand?.name === modelName);
    }).length;

    const coveragePct = unpPointsInFilterCount > 0 ? (filteredPoints / unpPointsInFilterCount) * 100 : 0;

    return {
      name: modelName,
      isHighfoam,
      isPm,
      totalPoints,
      filteredPoints,
      unpPoints: unpPointsInFilterCount,
      coveragePct,
      actualSales: "—",
    };
  });

  const highfoamModels = processedModels.filter(m => m.isHighfoam).sort((a, b) => b.totalPoints - a.totalPoints);
  const privatModels = processedModels.filter(m => m.isPm).sort((a, b) => b.totalPoints - a.totalPoints);

  // Model KPI Cards
  const hfActiveCount = highfoamModels.filter(m => m.filteredPoints > 0).length;
  const pmActiveCount = privatModels.filter(m => m.filteredPoints > 0).length;
  const totalModelsOnPoints = latestFilteredVisits.reduce((acc, p) => {
    let count = 0;
    processedModels.forEach(m => {
      if (p.brandPresence?.[m.name] || (p.visit_brands || []).some(vb => vb.brand?.name === m.name)) {
        count++;
      }
    });
    return acc + count;
  }, 0);
  const avgModelsPerPoint = unpPointsInFilterCount > 0 ? (totalModelsOnPoints / unpPointsInFilterCount).toFixed(1) : "0,0";

  const modelKpiCards = [
    {
      title: "Моделі Highfoam",
      mainValue: `${highfoamModels.length}`,
      mainLabel: "Моделей у довіднику",
      metrics: [
        { label: "Представлені в ТТ", value: `${hfActiveCount} моделей` },
        { label: "Частка активних", value: formatPct(highfoamModels.length > 0 ? (hfActiveCount / highfoamModels.length) * 100 : 0) }
      ]
    },
    {
      title: "Моделі Privat",
      mainValue: `${privatModels.length}`,
      mainLabel: "Private Label у довіднику",
      metrics: [
        { label: "Представлені в ТТ", value: `${pmActiveCount} моделей` },
        { label: "Частка активних", value: formatPct(privatModels.length > 0 ? (pmActiveCount / privatModels.length) * 100 : 0) }
      ]
    },
    {
      title: "Унікальних ТТ",
      mainValue: `${latestFilteredVisits.length}`,
      mainLabel: "Торгових точок у вибірці",
      metrics: [
        { label: "Точок з ЮНП", value: `${unpPointsInFilterCount} ТТ` },
        { label: "Охоплення ЮНП", value: formatPct(latestFilteredVisits.length > 0 ? (unpPointsInFilterCount / latestFilteredVisits.length) * 100 : 0) }
      ]
    },
    {
      title: "Базові точки ЮНП",
      mainValue: `${unpPointsInFilterCount}`,
      mainLabel: "Точок для розрахунку покриття",
      metrics: [
        { label: "Без присутності ЮНП", value: `${latestFilteredVisits.length - unpPointsInFilterCount} ТТ` },
        { label: "Базова база", value: "100%" }
      ]
    },
    {
      title: "Середня викладка",
      mainValue: `${avgModelsPerPoint}`,
      mainLabel: "Моделей на одну точку ЮНП",
      metrics: [
        { label: "Всього моделей на точках", value: `${totalModelsOnPoints} шт` },
        { label: "Статус викладки", value: "Оптимально", highlight: true }
      ]
    }
  ];

  curRow2 = renderKpiCards(ws2, curRow2, modelKpiCards);
  curRow2 += 2;

  // -------------------------------------------------------------------------
  // 1. МОДЕЛІ HIGHFOAM
  // -------------------------------------------------------------------------
  curRow2 = renderSectionHeader(
    ws2,
    curRow2,
    "1. Моделі Highfoam",
    "Представленість лінійки моделей бренду Highfoam у торгових точках"
  );

  // Embedded Chart: Top Highfoam Models
  const hfChartBase64 = drawBarChartImage({
    title: "ТОП МОДЕЛІ HIGHFOAM ЗА ПРЕДСТАВЛЕНІСТЮ (ТОРГОВІ ТОЧКИ)",
    subtitle: "Кількість торгових точок, де виставлена модель",
    items: highfoamModels.slice(0, 8).map(m => ({
      label: m.name,
      value: m.filteredPoints,
      max: highfoamModels[0]?.filteredPoints || 1,
      color: "#6366F1",
      subText: `${m.filteredPoints} ТТ (${m.coveragePct.toFixed(1)}%)`,
    })),
    width: 820,
    height: 320,
  });

  if (hfChartBase64) {
    try {
      const imgId = wb.addImage({ base64: hfChartBase64, extension: "png" });
      ws2.addImage(imgId, {
        tl: { col: 1, row: curRow2 - 1 },
        ext: { width: 680, height: 260 },
      });
      curRow2 += 14;
    } catch (e) {
      console.warn("Failed to insert hf chart:", e);
    }
  }

  const modelTableHeaders = [
    "№",
    "Модель",
    "Заг. к-ть точок (без фільтрів)",
    "К-ть точок (за фільтром)",
    "Заг. к-ть точок ЮНП (фільтр)",
    "% покриття точок ЮНП",
    "Графічна шкала покриття",
    "Фактичні продажі"
  ];

  const hfHeaderRow = ws2.getRow(curRow2);
  hfHeaderRow.height = 24;
  modelTableHeaders.forEach((h, idx) => {
    const colIdx = idx + 2;
    const c = hfHeaderRow.getCell(colIdx);
    c.value = h;
    c.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF312E81" } };
    c.alignment = { vertical: "middle", horizontal: idx === 1 ? "left" : "center", wrapText: true };
    c.border = BORDER_THIN;
  });
  curRow2++;

  highfoamModels.forEach((m, idx) => {
    const row = ws2.getRow(curRow2);
    row.height = 20;
    const rowFill = curRow2 % 2 === 0
      ? { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } }
      : { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };

    const cells = [
      { col: 2, val: idx + 1, align: "center" },
      { col: 3, val: m.name, align: "left" },
      { col: 4, val: m.totalPoints, align: "right", numFmt: "#,##0" },
      { col: 5, val: m.filteredPoints, align: "right", numFmt: "#,##0" },
      { col: 6, val: m.unpPoints, align: "right", numFmt: "#,##0" },
      { col: 7, val: m.coveragePct / 100, align: "right", numFmt: "0.0%" },
      { col: 8, val: generateUnicodeBar(m.coveragePct, 8), align: "left" },
      { col: 9, val: m.actualSales, align: "center" },
    ];

    cells.forEach(c => {
      const cell = row.getCell(c.col);
      cell.value = c.val;
      cell.font = { name: "Calibri", size: 9, color: { argb: "FF1E293B" } };
      cell.fill = rowFill;
      cell.alignment = { vertical: "middle", horizontal: c.align };
      if (c.numFmt) cell.numFmt = c.numFmt;
      cell.border = BORDER_THIN;
    });

    curRow2++;
  });
  curRow2 += 3;

  // -------------------------------------------------------------------------
  // 2. МОДЕЛІ PRIVAT (PRIVATE LABEL)
  // -------------------------------------------------------------------------
  curRow2 = renderSectionHeader(
    ws2,
    curRow2,
    "2. Моделі Privat (Private Label)",
    "Представленість моделей власної марки торгових мереж"
  );

  // Embedded Chart: Top Privat Models
  const pmChartBase64 = drawBarChartImage({
    title: "ТОП МОДЕЛІ PRIVAT ЗА ПРЕДСТАВЛЕНІСТЮ (ТОРГОВІ ТОЧКИ)",
    subtitle: "Кількість торгових точок, де виставлена модель Private Label",
    items: privatModels.slice(0, 8).map(m => ({
      label: m.name,
      value: m.filteredPoints,
      max: privatModels[0]?.filteredPoints || 1,
      color: "#A855F7",
      subText: `${m.filteredPoints} ТТ (${m.coveragePct.toFixed(1)}%)`,
    })),
    width: 820,
    height: 320,
  });

  if (pmChartBase64) {
    try {
      const imgId = wb.addImage({ base64: pmChartBase64, extension: "png" });
      ws2.addImage(imgId, {
        tl: { col: 1, row: curRow2 - 1 },
        ext: { width: 680, height: 260 },
      });
      curRow2 += 14;
    } catch (e) {
      console.warn("Failed to insert privat chart:", e);
    }
  }

  const pmHeaderRow = ws2.getRow(curRow2);
  pmHeaderRow.height = 24;
  modelTableHeaders.forEach((h, idx) => {
    const colIdx = idx + 2;
    const c = pmHeaderRow.getCell(colIdx);
    c.value = h;
    c.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF581C87" } };
    c.alignment = { vertical: "middle", horizontal: idx === 1 ? "left" : "center", wrapText: true };
    c.border = BORDER_THIN;
  });
  curRow2++;

  privatModels.forEach((m, idx) => {
    const row = ws2.getRow(curRow2);
    row.height = 20;
    const rowFill = curRow2 % 2 === 0
      ? { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } }
      : { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };

    const cells = [
      { col: 2, val: idx + 1, align: "center" },
      { col: 3, val: m.name, align: "left" },
      { col: 4, val: m.totalPoints, align: "right", numFmt: "#,##0" },
      { col: 5, val: m.filteredPoints, align: "right", numFmt: "#,##0" },
      { col: 6, val: m.unpPoints, align: "right", numFmt: "#,##0" },
      { col: 7, val: m.coveragePct / 100, align: "right", numFmt: "0.0%" },
      { col: 8, val: generateUnicodeBar(m.coveragePct, 8), align: "left" },
      { col: 9, val: m.actualSales, align: "center" },
    ];

    cells.forEach(c => {
      const cell = row.getCell(c.col);
      cell.value = c.val;
      cell.font = { name: "Calibri", size: 9, color: { argb: "FF1E293B" } };
      cell.fill = rowFill;
      cell.alignment = { vertical: "middle", horizontal: c.align };
      if (c.numFmt) cell.numFmt = c.numFmt;
      cell.border = BORDER_THIN;
    });

    curRow2++;
  });
  curRow2 += 3;

  // -------------------------------------------------------------------------
  // 3. МАТРИЦЯ ПРЕДСТАВЛЕНОСТІ МОДЕЛЕЙ ЗА ТОРГОВИМИ ТОЧКАМИ
  // -------------------------------------------------------------------------
  curRow2 = renderSectionHeader(
    ws2,
    curRow2,
    "3. Торгові точки та наявність моделей",
    "Список торгових точок із детальним переліком представлених моделей Highfoam та Privat"
  );

  const pointModelHeaders = [
    "№",
    "Торгова точка",
    "Організація",
    "Місто",
    "Адреса",
    "Менеджер",
    "Присутність ЮНП",
    "К-ть моделей Highfoam",
    "Моделі Highfoam",
    "К-ть моделей Privat",
    "Моделі Privat",
    "Всього моделей"
  ];

  const pointModelHeaderRow = ws2.getRow(curRow2);
  pointModelHeaderRow.height = 24;
  pointModelHeaders.forEach((h, idx) => {
    const colIdx = idx + 2;
    const c = pointModelHeaderRow.getCell(colIdx);
    c.value = h;
    c.font = { name: "Calibri", size: 9.5, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.border = BORDER_THIN;
  });
  curRow2++;

  latestFilteredVisits.forEach((p, idx) => {
    const presentHf = [];
    const presentPm = [];

    highfoamModels.forEach(m => {
      if (p.brandPresence?.[m.name] || (p.visit_brands || []).some(vb => vb.brand?.name === m.name)) {
        presentHf.push(m.name);
      }
    });

    privatModels.forEach(m => {
      if (p.brandPresence?.[m.name] || (p.visit_brands || []).some(vb => vb.brand?.name === m.name)) {
        presentPm.push(m.name);
      }
    });

    const row = ws2.getRow(curRow2);
    row.height = 20;
    const rowFill = curRow2 % 2 === 0
      ? { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } }
      : { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };

    const cells = [
      { col: 2, val: idx + 1, align: "center" },
      { col: 3, val: p.point || "Невідома ТТ", align: "left" },
      { col: 4, val: p.org || "Без організації", align: "left" },
      { col: 5, val: p.city || "Невідомо", align: "left" },
      { col: 6, val: p.address || "—", align: "left" },
      { col: 7, val: p.agent || "—", align: "left" },
      { col: 8, val: p.isCooperating ? "Так" : "Ні", align: "center" },
      { col: 9, val: presentHf.length, align: "right", numFmt: "#,##0" },
      { col: 10, val: presentHf.length > 0 ? presentHf.join(", ") : "—", align: "left" },
      { col: 11, val: presentPm.length, align: "right", numFmt: "#,##0" },
      { col: 12, val: presentPm.length > 0 ? presentPm.join(", ") : "—", align: "left" },
      { col: 13, val: presentHf.length + presentPm.length, align: "right", numFmt: "#,##0" },
    ];

    cells.forEach(c => {
      const cell = row.getCell(c.col);
      cell.value = c.val;
      cell.font = { name: "Calibri", size: 8.5, color: { argb: "FF1E293B" } };
      cell.fill = rowFill;
      cell.alignment = { vertical: "middle", horizontal: c.align };
      if (c.numFmt) cell.numFmt = c.numFmt;
      cell.border = BORDER_THIN;
    });

    curRow2++;
  });

  // =========================================================================
  // SAVE AND DOWNLOAD
  // =========================================================================
  const dateStr = new Date().toISOString().split("T")[0];
  const filename = `Короткий_звіт_аналітика_${dateStr}.xlsx`;
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, filename);
}
