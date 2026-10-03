// Lab 3.1 · แปลงแถวจาก sales.csv (ผลลัพธ์ Lab 2.1) เป็นเอกสาร Firestore
// ใช้ AI เขียนฟังก์ชันในไฟล์นี้ (Prompt 3.1 ใน PROMPTS_LAB3.md) จนกว่า npm test จะผ่านทุกข้อ
// scripts/seed.mjs เรียกใช้ฟังก์ชันเหล่านี้ ไม่ต้องแก้ seed.mjs
import { addDays, daysBetween } from "../src/lab3/time.js";

export const BRANCHES = ["สยาม", "สีลม", "อารีย์", "บางนา", "มหาวิทยาลัย"];

// รูปแบบที่ข้อมูลหลังทำความสะอาด (Lab 2.1) ต้องเป็น: ปี ค.ศ. 20YY และเวลาไทย +07:00
const DATETIME_RE = /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+07:00$/;
const POSITIVE_INT_RE = /^\d+$/;
const POSITIVE_NUMBER_RE = /^\d+(\.\d+)?$/;

/**
 * เลือกเฉพาะ N วันล่าสุดของข้อมูล นับจากวันล่าสุดในไฟล์ (ไม่ใช่วันนี้) รวมวันสุดท้ายด้วย
 * @returns {{ rows: object[], start: string, end: string }}  start/end เป็น YYYY-MM-DD
 */
export function selectLastDays(rows, days) {
  if (rows.length === 0) return { rows: [], start: null, end: null };
  // วันที่ = 10 ตัวอักษรแรกของ datetime (เวลาไทย) เทียบเป็นสตริงได้เพราะเป็น YYYY-MM-DD
  const dateOf = (r) => String(r.datetime).slice(0, 10);
  const end = rows.reduce((max, r) => (dateOf(r) > max ? dateOf(r) : max), dateOf(rows[0]));
  // N วันรวมวันสุดท้าย เช่น 3 วันที่จบ 20 ก.ย. = 18, 19, 20
  const start = addDays(end, -(days - 1));
  return {
    rows: rows.filter((r) => dateOf(r) >= start && dateOf(r) <= end),
    start,
    end,
  };
}

/** จำนวนวันที่ต้องเลื่อน ให้วันล่าสุดของข้อมูลกลายเป็น "เมื่อวาน" ของ today · ห้ามติดลบ */
export function computeShift(lastDataDate, today) {
  const yesterday = addDays(today, -1);
  return Math.max(0, daysBetween(lastDataDate, yesterday));
}

/** เลื่อนวันที่ใน datetime ("2026-09-20T16:05:09+07:00") ไป days วัน โดยคงเวลาและ +07:00 */
export function shiftDateTime(iso, days) {
  // แยกส่วนวันที่ออกมาบวกวัน แล้วต่อส่วนเวลาเดิมกลับ ไม่ผ่าน new Date() จึงไม่กลายเป็น UTC
  return addDays(iso.slice(0, 10), days) + iso.slice(10);
}

/**
 * แปลง 1 แถว CSV (ทุกค่าเป็นข้อความ) เป็น { id, data }
 * id = order_id + "-" + product_id
 * data มีฟิลด์: order_id, datetime, date, hour, branch, product_id, qty, unit_price, revenue,
 *               customer_id (ว่าง = null), payment_method, channel, source = "import"
 * ต้อง throw Error ถ้าข้อมูลยังไม่สะอาด: qty ไม่ใช่จำนวนเต็มบวก, ราคาไม่ใช่ตัวเลขบวก,
 * สาขาไม่อยู่ใน BRANCHES, datetime ไม่ใช่ 20YY-MM-DDTHH:MM:SS+07:00
 */
export function toSaleDoc(row, shiftDays = 0) {
  const text = (v) => String(v ?? "").trim();
  const orderId = text(row.order_id);
  const productId = text(row.product_id);
  const rawDatetime = text(row.datetime);
  const ref = `${orderId || "(ไม่มี order_id)"}-${productId || "?"}`;

  if (!orderId || !productId) {
    throw new Error(`แถว ${ref}: order_id หรือ product_id ว่าง`);
  }
  if (!DATETIME_RE.test(rawDatetime)) {
    throw new Error(`แถว ${ref}: datetime "${rawDatetime}" ไม่ใช่รูปแบบ 20YY-MM-DDTHH:MM:SS+07:00`);
  }
  if (!POSITIVE_INT_RE.test(text(row.qty)) || Number(row.qty) <= 0) {
    throw new Error(`แถว ${ref}: qty "${row.qty}" ไม่ใช่จำนวนเต็มบวก`);
  }
  if (!POSITIVE_NUMBER_RE.test(text(row.unit_price)) || Number(row.unit_price) <= 0) {
    throw new Error(`แถว ${ref}: unit_price "${row.unit_price}" ไม่ใช่ตัวเลขบวก`);
  }
  const branch = text(row.branch);
  if (!BRANCHES.includes(branch)) {
    throw new Error(`แถว ${ref}: สาขา "${row.branch}" ไม่อยู่ใน ${BRANCHES.join(", ")}`);
  }

  const qty = Number(row.qty);
  const unitPrice = Number(row.unit_price);
  const datetime = shiftDays ? shiftDateTime(rawDatetime, shiftDays) : rawDatetime;
  const customerId = text(row.customer_id);

  return {
    // order_id อย่างเดียวซ้ำได้ เพราะ 1 บิลมีหลายสินค้า จึงต่อด้วย product_id
    id: `${orderId}-${productId}`,
    data: {
      order_id: orderId,
      datetime,
      date: datetime.slice(0, 10),
      hour: Number(datetime.slice(11, 13)),
      branch,
      product_id: productId,
      qty,
      unit_price: unitPrice,
      revenue: qty * unitPrice,
      // ไม่มีรหัสสมาชิก = null (ไม่มีค่า) ไม่ใช่ "" เพื่อให้ query และ Security Rules แยกได้ชัด
      customer_id: customerId === "" ? null : customerId,
      payment_method: text(row.payment_method),
      channel: text(row.channel),
      source: "import",
    },
  };
}

/** สรุป: { docs, bills (นับ order_id ไม่ซ้ำ), revenue, byBranch: {สาขา: ยอด}, start, end } */
export function summarize(docs) {
  const bills = new Set();
  const byBranch = {};
  let revenue = 0;
  let start = null;
  let end = null;
  for (const { data } of docs) {
    bills.add(data.order_id);
    revenue += data.revenue;
    byBranch[data.branch] = (byBranch[data.branch] ?? 0) + data.revenue;
    if (start === null || data.date < start) start = data.date;
    if (end === null || data.date > end) end = data.date;
  }
  return { docs: docs.length, bills: bills.size, revenue, byBranch, start, end };
}
