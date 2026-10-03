// Lab 3.2 · ตรวจฟอร์มและสร้างเอกสารยอดขายใหม่
// ใช้ AI เขียนฟังก์ชันในไฟล์นี้ (Prompt 3.2A) จนกว่า npm test จะผ่านทุกข้อ
// เอกสารที่ได้ต้องมีโครงสร้างเดียวกับข้อมูลที่ import ใน Lab 3.1 เพื่อให้ metrics.js จาก Lab 1 ใช้ต่อได้
import { nowBangkokISO } from "./time.js";

export const BRANCHES = ["สยาม", "สีลม", "อารีย์", "บางนา", "มหาวิทยาลัย"];
export const PAYMENTS = ["QR พร้อมเพย์", "บัตรเครดิต", "เงินสด", "LINE MAN", "Grab"];
export const MAX_QTY = 20;

const CUSTOMER_RE = /^C\d{5}$/;
const ID_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DELIVERY_PAYMENTS = ["LINE MAN", "Grab"];

const text = (v) => String(v ?? "").trim();
/** รหัสสมาชิกแบบมาตรฐาน: ตัดช่องว่าง + ตัวพิมพ์ใหญ่ ("ว่าง" คืนเป็นสตริงว่าง) */
const normalizeCustomer = (v) => text(v).toUpperCase();

/**
 * ตรวจฟอร์ม { branch, product_id, qty, payment_method, customer_id } (ค่าเป็นข้อความจาก input)
 * คืน {} ถ้าถูกต้อง หรือ { ชื่อฟิลด์: ข้อความภาษาไทย } ถ้าผิด
 */
export function validateSaleForm(form, products) {
  const errors = {};

  if (!BRANCHES.includes(text(form.branch))) {
    errors.branch = "กรุณาเลือกสาขา";
  }

  const productIds = (products ?? []).map((p) => p.product_id);
  if (!productIds.includes(text(form.product_id))) {
    errors.product_id = "กรุณาเลือกเมนูจากรายการ";
  }

  // ต้องเป็นตัวเลขล้วน (ไม่รับ 1.5, -1, ค่าว่าง) แล้วจึงตรวจช่วง 1–20
  const qtyText = text(form.qty);
  const qty = Number(qtyText);
  if (!/^\d+$/.test(qtyText) || qty < 1 || qty > MAX_QTY) {
    errors.qty = `จำนวนต้องเป็นจำนวนเต็ม 1–${MAX_QTY}`;
  }

  if (!PAYMENTS.includes(text(form.payment_method))) {
    errors.payment_method = "กรุณาเลือกวิธีชำระเงิน";
  }

  // ไม่บังคับ แต่ถ้าใส่ต้องเป็น C ตามด้วยเลข 5 หลัก (รับตัวพิมพ์เล็กได้ เช่น c01234)
  const customer = normalizeCustomer(form.customer_id);
  if (customer !== "" && !CUSTOMER_RE.test(customer)) {
    errors.customer_id = "รหัสสมาชิกต้องเป็น C ตามด้วยตัวเลข 5 หลัก เช่น C01234";
  }

  return errors;
}

/** เลขบิลจากเวลาไทย รูปแบบ WEB-YYYYMMDD-HHMMSS-XXXX (XXXX = ตัวเลข/อักษรพิมพ์ใหญ่สุ่ม 4 ตัว) */
export function makeOrderId(now = new Date(), rand = Math.random) {
  const iso = nowBangkokISO(now); // เช่น 2026-09-27T03:30:05+07:00
  const ymd = iso.slice(0, 10).replaceAll("-", "");
  const hms = iso.slice(11, 19).replaceAll(":", "");
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += ID_CHARS[Math.floor(rand() * ID_CHARS.length)];
  // ขึ้นต้นด้วย WEB- จึงไม่ชนกับเลขบิลที่ import มา (ORD…)
  return `WEB-${ymd}-${hms}-${suffix}`;
}

/**
 * สร้าง { id, data } จากฟอร์มที่ผ่านการตรวจแล้ว
 * - ราคามาจาก product.price เสมอ · revenue = qty × ราคา · ตัวเลขทุกตัวเป็น number
 * - datetime/date/hour เป็นเวลาไทย (ใช้ nowBangkokISO)
 * - channel = "เดลิเวอรี" ถ้าจ่ายด้วย LINE MAN หรือ Grab ไม่งั้น "หน้าร้าน"
 * - source = "web", created_by = uid · ยังไม่ต้องใส่ created_at (ใส่ตอนบันทึกด้วย serverTimestamp())
 */
export function buildSale(form, product, { uid, now = new Date(), rand = Math.random }) {
  const datetime = nowBangkokISO(now);
  const orderId = makeOrderId(now, rand);
  const qty = Number(text(form.qty));
  // ราคามาจากเมนูเสมอ ไม่รับราคาจากฟอร์ม กันการแก้ราคาเองจากหน้าเว็บ
  const unitPrice = Number(product.price);
  const paymentMethod = text(form.payment_method);
  const customer = normalizeCustomer(form.customer_id);

  return {
    // รูปแบบ id เดียวกับข้อมูลที่ import (order_id-product_id)
    id: `${orderId}-${product.product_id}`,
    data: {
      order_id: orderId,
      datetime,
      date: datetime.slice(0, 10),
      hour: Number(datetime.slice(11, 13)),
      branch: text(form.branch),
      product_id: product.product_id,
      qty,
      unit_price: unitPrice,
      revenue: qty * unitPrice,
      customer_id: customer === "" ? null : customer,
      payment_method: paymentMethod,
      channel: DELIVERY_PAYMENTS.includes(paymentMethod) ? "เดลิเวอรี" : "หน้าร้าน",
      source: "web",
      created_by: uid,
    },
  };
}
