// ฟังก์ชันคำนวณทั้งหมดของ Dashboard อยู่ที่นี่ แยกจาก UI เพื่อให้ตรวจสอบง่าย
// หลักการ: 1 แถวใน sales.csv = 1 รายการสินค้าในบิล, ยอดขาย = qty × unit_price

/** แปลงแถวดิบจาก CSV เป็นตัวเลขและเพิ่มคอลัมน์ที่ใช้บ่อย */
export function prepareRows(rows) {
  return rows
    .filter((r) => r.order_id)
    .map((r) => {
      const qty = Number(r.qty);
      const unitPrice = Number(r.unit_price);
      return {
        ...r,
        qty,
        unitPrice,
        revenue: qty * unitPrice,
        // ใช้ 10 ตัวอักษรแรกของ ISO string (เวลาไทย) เป็นวันที่
        // ห้ามใช้ new Date(...).toISOString() เพราะจะแปลงเป็น UTC และวันเลื่อน
        date: r.datetime.slice(0, 10),
        hour: Number(r.datetime.slice(11, 13)),
      };
    });
}

/** KPI 4 ตัวบนสุดของ Dashboard */
export function computeKpis(rows) {
  const revenue = rows.reduce((sum, r) => sum + r.revenue, 0);
  const bills = new Set(rows.map((r) => r.order_id)).size; // นับบิล ไม่ใช่นับแถว
  // customer_id ว่าง = walk-in ไม่นับเป็นลูกค้า
  const customers = new Set(rows.map((r) => r.customer_id).filter(Boolean)).size;
  return {
    revenue,
    bills,
    avgPerBill: bills ? revenue / bills : 0,
    customers,
  };
}

/** ยอดขายรวมรายวัน เรียงตามวันที่ */
export function dailyRevenue(rows) {
  const map = new Map();
  for (const r of rows) map.set(r.date, (map.get(r.date) ?? 0) + r.revenue);
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date, revenue }));
}

/** ค่าเฉลี่ยเคลื่อนที่ ใช้ทำเส้นแนวโน้มให้อ่านง่ายขึ้น */
export function withMovingAverage(series, key = "revenue", window = 7) {
  return series.map((d, i) => {
    const slice = series.slice(Math.max(0, i - window + 1), i + 1);
    const avg = slice.reduce((s, x) => s + x[key], 0) / slice.length;
    return { ...d, ma: i >= window - 1 ? avg : null };
  });
}

/** ยอดขายแยกสาขา เรียงจากมากไปน้อย */
export function revenueByBranch(rows) {
  const map = new Map();
  for (const r of rows) {
    const cur = map.get(r.branch) ?? { branch: r.branch, revenue: 0, bills: new Set() };
    cur.revenue += r.revenue;
    cur.bills.add(r.order_id);
    map.set(r.branch, cur);
  }
  return [...map.values()]
    .map((b) => ({ branch: b.branch, revenue: b.revenue, bills: b.bills.size }))
    .sort((a, b) => b.revenue - a.revenue);
}

export const fmtBaht = (n) =>
  "฿" + n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
export const fmtBaht2 = (n) =>
  "฿" + n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtNum = (n) => n.toLocaleString("th-TH");
export const fmtShortBaht = (n) =>
  n >= 1_000_000 ? `฿${(n / 1_000_000).toFixed(1)} ล.` : n >= 1000 ? `฿${(n / 1000).toFixed(0)}k` : `฿${n}`;
