// โหมดสาธิต (?demo): คำนวณผลวิเคราะห์ในเบราว์เซอร์จาก CSV ด้วยฟังก์ชันชุดเดียวกับ pipeline
// แต่ละส่วนคำนวณแยกกัน ส่วนที่ยังทำไม่เสร็จ (ยังเป็น "ยังไม่ได้ทำ") จะไม่ทำให้ส่วนอื่นพัง
import { shiftRows, shiftHolidays, weeklyShift } from "../lib/analytics/build.js";
import { computeRfm } from "../lib/analytics/rfm.js";
import { computeCohorts } from "../lib/analytics/cohort.js";
import { computeAbc } from "../lib/analytics/abc.js";
import { dailyByBranch } from "../lib/analytics/daily.js";
import { todayBangkok } from "../lab3/time.js";

const safe = (f) => { try { return f(); } catch (e) { return { error: e.message }; } };

export function buildDemoAnalytics(csvRows, products, holidaysRaw) {
  const end = csvRows.reduce((m, r) => (r.date > m ? r.date : m), "");
  const shift = weeklyShift(end, todayBangkok());
  const rows = shiftRows(csvRows, shift);
  const asOf = rows.reduce((m, r) => (r.date > m ? r.date : m), "");
  const holidays = shiftHolidays(holidaysRaw, shift);
  return {
    reads: 0,
    meta: { asOf, shift, rows: rows.length, holidays, builtAt: null, builtBy: "demo", alerts: [] },
    daily: safe(() => ({ rows: dailyByBranch(rows) })),
    rfm: safe(() => { const r = computeRfm(rows, asOf); return { asOf, segments: r.segments, customers: r.customers }; }),
    cohort: safe(() => computeCohorts(rows, asOf)),
    abc: safe(() => ({ items: computeAbc(rows, products) })),
  };
}
