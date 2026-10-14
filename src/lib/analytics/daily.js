// ยอดรวมรายวันแยกสาขา: ข้อมูลกลางที่ใช้ทำ Forecast และ Anomaly (Lab 4.4–4.5)
import { addDays } from "../../lab3/time.js";

/** รวมแถวยอดขายเป็น [{ date, branch, revenue, bills }] เรียงตามวันที่ */
export function dailyByBranch(rows) {
  const map = new Map();
  for (const x of rows) {
    const k = `${x.date}|${x.branch}`;
    const c = map.get(k) ?? { date: x.date, branch: x.branch, revenue: 0, orders: new Set() };
    c.revenue += x.revenue;
    c.orders.add(x.order_id);
    map.set(k, c);
  }
  return [...map.values()]
    .map((c) => ({ date: c.date, branch: c.branch, revenue: c.revenue, bills: c.orders.size }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.branch.localeCompare(b.branch));
}

/**
 * อนุกรมเวลาต่อเนื่อง [{ date, revenue }] ของสาขาเดียว หรือทุกสาขา (branch = null)
 * เริ่มจากวันแรกที่มีข้อมูลของสาขานั้น ถึง end · วันที่ไม่มียอดขายเติม 0 (ร้านเปิดแต่ขายไม่ได้)
 */
export function toSeries(daily, branch = null, end = null) {
  const sums = new Map();
  for (const d of daily) {
    if (branch && d.branch !== branch) continue;
    sums.set(d.date, (sums.get(d.date) ?? 0) + d.revenue);
  }
  if (!sums.size) return [];
  const dates = [...sums.keys()].sort();
  const last = end ?? dates[dates.length - 1];
  const out = [];
  for (let d = dates[0]; d <= last; d = addDays(d, 1)) out.push({ date: d, revenue: sums.get(d) ?? 0 });
  return out;
}
