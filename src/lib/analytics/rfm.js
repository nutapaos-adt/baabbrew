// Lab 4.1 · ใช้ Claude Code เขียนฟังก์ชันที่ยังว่าง (Prompt 4.1A ใน PROMPTS_LAB4.md) จนกว่า npm test จะผ่าน · ห้ามแก้ไฟล์ test
// Lab 4.1 · RFM: แบ่งกลุ่มลูกค้าสมาชิกด้วย Recency, Frequency, Monetary
// rows = ผลจาก prepareRows() (มี order_id, date, revenue, customer_id)
import { daysBetween } from "../../lab3/time.js";

/**
 * คะแนน 1–5 ตามตำแหน่งเปอร์เซ็นไทล์ (ค่ามาก = คะแนนสูง)
 * ค่าที่เท่ากันต้องได้คะแนนเท่ากันเสมอ: score = 1 + floor(5 × จำนวนค่าที่ "น้อยกว่า" / n)
 */
export function percentileScores(values) {
  const n = values.length;
  if (n === 0) return [];
  // เรียงค่าครั้งเดียว แล้วหา "จำนวนค่าที่น้อยกว่า" ด้วย binary search (เร็วแม้มีลูกค้าหลายพันคน)
  const sorted = [...values].sort((a, b) => a - b);
  const countLess = (v) => {
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] < v) lo = mid + 1;
      else hi = mid;
    }
    return lo; // ตำแหน่งแรกที่ไม่น้อยกว่า v = จำนวนค่าที่น้อยกว่า v
  };
  // ค่าที่เท่ากันมี "จำนวนค่าที่น้อยกว่า" เท่ากัน จึงได้คะแนนเท่ากันเสมอ
  return values.map((v) => 1 + Math.floor((5 * countLess(v)) / n));
}

/** กติกาตั้งชื่อกลุ่ม ตรวจจากบนลงล่าง ข้อแรกที่ตรงคือคำตอบ */
export function segmentOf(r, f) {
  if (r >= 4 && f >= 4) return "Champions";
  if (r >= 3 && f >= 4) return "Loyal";
  if (r >= 4 && f <= 2) return "New";
  if (r <= 2 && f >= 3) return "At Risk";
  if (r <= 2) return "Lost";
  return "Need Attention";
}

export const SEGMENTS = [
  { id: "Champions", th: "ลูกค้าชั้นยอด", action: "ให้สิทธิพิเศษ ชวนลองเมนูใหม่ก่อนใคร" },
  { id: "Loyal", th: "ลูกค้าประจำ", action: "สะสมแต้ม/ขยับขึ้นเป็นชั้นยอด" },
  { id: "New", th: "ลูกค้าใหม่", action: "คูปองครั้งที่ 2 ภายใน 14 วัน" },
  { id: "Need Attention", th: "ต้องดูแล", action: "โปรฯ ตามเมนูที่เคยซื้อ" },
  { id: "At Risk", th: "เสี่ยงหาย", action: "ดึงกลับด่วน: เคยซื้อบ่อยแต่หายไปนาน" },
  { id: "Lost", th: "หายไปแล้ว", action: "ใช้งบน้อย ส่งข้อความครั้งเดียว" },
];

/**
 * @param rows   แถวยอดขาย (ไม่นับแถวที่ customer_id ว่าง)
 * @param asOf   วันที่วิเคราะห์ YYYY-MM-DD (ใช้วันล่าสุดของข้อมูล ไม่ใช่วันนี้)
 * @returns {{ customers: object[], segments: object[], asOf: string }}
 *   customers: { id, R (วันที่ไม่ได้มา), F (จำนวนบิล), M (ยอดซื้อรวม), r, f, m, segment }
 *   segments:  { segment, customers, revenue, revenueShare, customerShare } เรียงตาม SEGMENTS
 */
export function computeRfm(rows, asOf) {
  // 1) รวมข้อมูลต่อลูกค้าสมาชิก: วันล่าสุดที่มา, บิลที่ไม่ซ้ำ, ยอดซื้อรวม
  const byCustomer = new Map();
  for (const row of rows) {
    const id = String(row.customer_id ?? "").trim();
    if (!id) continue; // walk-in ไม่มีรหัสสมาชิก ติดตามรายคนไม่ได้
    let c = byCustomer.get(id);
    if (!c) {
      c = { id, last: row.date, orders: new Set(), M: 0 };
      byCustomer.set(id, c);
    }
    if (row.date > c.last) c.last = row.date;
    c.orders.add(row.order_id); // นับบิล ไม่ใช่นับแถว (1 บิลมีหลายสินค้า)
    c.M += row.revenue;
  }

  // 2) R F M ดิบ
  const list = [...byCustomer.values()].map((c) => ({
    id: c.id,
    R: daysBetween(c.last, asOf), // ไม่ได้มากี่วัน นับถึงวันสุดท้ายของข้อมูล
    F: c.orders.size,
    M: c.M,
  }));

  // 3) คะแนน 1–5 · R ยิ่งน้อยยิ่งดี จึงให้คะแนนจากค่าติดลบ
  const r = percentileScores(list.map((c) => -c.R));
  const f = percentileScores(list.map((c) => c.F));
  const m = percentileScores(list.map((c) => c.M));
  const customers = list
    .map((c, i) => ({ ...c, r: r[i], f: f[i], m: m[i], segment: segmentOf(r[i], f[i]) }))
    .sort((a, b) => b.M - a.M);

  // 4) สรุปต่อกลุ่ม เรียงตาม SEGMENTS
  const totalRevenue = customers.reduce((sum, c) => sum + c.M, 0);
  const totalCustomers = customers.length;
  const segments = SEGMENTS.map(({ id }) => {
    const members = customers.filter((c) => c.segment === id);
    const revenue = members.reduce((sum, c) => sum + c.M, 0);
    return {
      segment: id,
      customers: members.length,
      revenue,
      revenueShare: totalRevenue ? revenue / totalRevenue : 0,
      customerShare: totalCustomers ? members.length / totalCustomers : 0,
    };
  });

  return { customers, segments, asOf };
}
