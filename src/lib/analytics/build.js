// Pre-aggregation: แปลงยอดขายดิบหลายหมื่นแถว เป็นเอกสารสรุป 5 ชิ้น
// ใช้ทั้งใน scripts/build-analytics.mjs (เขียนลง Firestore) และโหมดสาธิตในเบราว์เซอร์
import { addDays, daysBetween } from "../../lab3/time.js";
import { computeRfm } from "./rfm.js";
import { computeCohorts } from "./cohort.js";
import { computeAbc } from "./abc.js";
import { dailyByBranch } from "./daily.js";

/**
 * จำนวนวันที่เลื่อนประวัติให้ "เหมือนเป็นข้อมูลล่าสุด" โดยเลื่อนเป็นสัปดาห์เต็มเท่านั้น
 * เพื่อให้วันในสัปดาห์ไม่เพี้ยน (สีลมต้องยังเงียบวันเสาร์-อาทิตย์) · ข้อมูลจะจบภายใน 7 วันก่อนวันนี้
 */
export function weeklyShift(lastDataDate, today) {
  const d = daysBetween(lastDataDate, addDays(today, -1));
  return d > 0 ? d - (d % 7) : 0;
}

/** เลื่อนวันที่ของแถวที่ผ่าน prepareRows() แล้ว (ให้ตรงกับข้อมูลที่ seed ไว้ใน Firestore) */
export function shiftRows(rows, days) {
  if (!days) return rows;
  return rows.map((r) => {
    const date = addDays(r.date, days);
    return { ...r, date, datetime: date + r.datetime.slice(10) };
  });
}

export function shiftHolidays(holidays, days) {
  return Object.fromEntries(Object.entries(holidays).map(([d, name]) => [addDays(d, days), name]));
}

/**
 * @returns {{ meta, daily, rfm, cohort, abc }} แต่ละคีย์คือ 1 เอกสารใน collection "analytics"
 */
export function buildAnalytics({ rows, products, holidays = {}, shift = 0 }) {
  const asOf = rows.reduce((m, r) => (r.date > m ? r.date : m), "");
  const rfm = computeRfm(rows, asOf);
  return {
    meta: {
      asOf, shift, rows: rows.length,
      bills: new Set(rows.map((r) => r.order_id)).size,
      revenue: rows.reduce((s, r) => s + r.revenue, 0),
      members: rfm.customers.length,
      holidays,
    },
    daily: { rows: dailyByBranch(rows) },
    rfm: {
      asOf,
      segments: rfm.segments,
      customers: rfm.customers.map(({ id, R, F, M, r, f, m, segment }) => ({ id, R, F, M, r, f, m, segment })),
    },
    cohort: computeCohorts(rows, asOf),
    abc: { items: computeAbc(rows, products) },
  };
}
