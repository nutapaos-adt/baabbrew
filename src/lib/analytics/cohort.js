// Lab 4.2 · ใช้ Claude Code เขียนฟังก์ชันที่ยังว่าง (Prompt 4.2A ใน PROMPTS_LAB4.md) จนกว่า npm test จะผ่าน · ห้ามแก้ไฟล์ test
// Lab 4.2 · Cohort retention รายเดือน
// cohort = เดือนแรกที่ลูกค้าสมาชิกซื้อ · retention[k] = สัดส่วนลูกค้าใน cohort ที่กลับมาซื้อในเดือนที่ k (k=0 คือเดือนแรก = 100%)

/** จำนวนเดือนจาก a ถึง b เช่น monthIndex("2025-11", "2026-02") = 3 */
export function monthIndex(a, b) {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

/** จำนวนวันในเดือน "YYYY-MM" (วันที่ 0 ของเดือนถัดไป = วันสุดท้ายของเดือนนี้ คิดแบบ UTC จึงไม่เพี้ยนตามเขตเวลา) */
function daysInMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * @param rows  แถวยอดขาย (ไม่นับ customer_id ว่าง)
 * @param asOf  วันสุดท้ายของข้อมูล YYYY-MM-DD ใช้บอกว่าเดือนสุดท้ายข้อมูลไม่ครบหรือไม่
 * @returns {{ cohorts: {cohort, size, retention: number[]}[], lastMonth, lastMonthPartial, daysInLastMonth }}
 *   retention ยาวเท่าจำนวนเดือนที่สังเกตได้ของ cohort นั้น (ถึง lastMonth)
 */
export function computeCohorts(rows, asOf) {
  // 1) เดือนที่ลูกค้าแต่ละคนมาซื้อ (Set จึงนับซ้ำในเดือนเดียวกันครั้งเดียว)
  const monthsByCustomer = new Map();
  for (const row of rows) {
    const id = String(row.customer_id ?? "").trim();
    if (!id) continue; // walk-in ติดตามการกลับมาไม่ได้
    const ym = row.date.slice(0, 7);
    if (!monthsByCustomer.has(id)) monthsByCustomer.set(id, new Set());
    monthsByCustomer.get(id).add(ym);
  }

  const lastMonth = asOf.slice(0, 7);

  // 2) จัดลูกค้าเข้า cohort ตามเดือนแรกที่ซื้อ แล้วนับว่าเดือนที่ k หลังจากนั้นกลับมากี่คน
  const cohortMap = new Map(); // cohort → { size, active: number[] }
  for (const months of monthsByCustomer.values()) {
    const first = [...months].sort()[0];
    const span = monthIndex(first, lastMonth) + 1; // จำนวนเดือนที่สังเกตได้
    if (!cohortMap.has(first)) cohortMap.set(first, { size: 0, active: new Array(span).fill(0) });
    const c = cohortMap.get(first);
    c.size += 1;
    for (const ym of months) {
      const k = monthIndex(first, ym);
      if (k >= 0 && k < span) c.active[k] += 1;
    }
  }

  const cohorts = [...cohortMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cohort, { size, active }]) => ({
      cohort,
      size,
      retention: active.map((n) => n / size),
    }));

  // 3) เดือนสุดท้ายข้อมูลครบเดือนหรือยัง (ช่องขวาล่างของ heatmap จะต่ำเพราะเหตุนี้)
  const daysInLastMonth = Number(asOf.slice(8, 10));
  return {
    cohorts,
    lastMonth,
    lastMonthPartial: daysInLastMonth < daysInMonth(lastMonth),
    daysInLastMonth,
  };
}
