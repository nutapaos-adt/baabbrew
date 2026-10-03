import { describe, it, expect } from "vitest";
import { selectLastDays, computeShift, shiftDateTime, toSaleDoc, summarize } from "./seedTransform.mjs";

const row = (o = {}) => ({
  order_id: "ORD0034791", datetime: "2026-09-20T16:05:09+07:00", branch: "สยาม", product_id: "P004",
  qty: "2", unit_price: "75", customer_id: "", payment_method: "QR พร้อมเพย์", channel: "หน้าร้าน", ...o,
});

describe("toSaleDoc", () => {
  it("แปลงชนิดข้อมูลและคำนวณ revenue", () => {
    const { id, data } = toSaleDoc(row());
    expect(id).toBe("ORD0034791-P004");
    expect(data.qty).toBe(2);
    expect(data.unit_price).toBe(75);
    expect(data.revenue).toBe(150);
    expect(typeof data.qty).toBe("number");
  });
  it("แยก date และ hour จาก datetime ตามเวลาไทย ไม่แปลงเป็น UTC", () => {
    const { data } = toSaleDoc(row({ datetime: "2026-09-20T01:30:00+07:00" }));
    expect(data.date).toBe("2026-09-20");
    expect(data.hour).toBe(1);
  });
  it("customer_id ว่างต้องเป็น null ไม่ใช่สตริงว่าง", () => {
    expect(toSaleDoc(row()).data.customer_id).toBeNull();
    expect(toSaleDoc(row({ customer_id: "C01234" })).data.customer_id).toBe("C01234");
  });
  it("ติดป้าย source = import", () => {
    expect(toSaleDoc(row()).data.source).toBe("import");
  });
  it("ปฏิเสธข้อมูลที่ไม่ผ่านการทำความสะอาด (ตรวจว่าใช้ไฟล์จาก Lab 2.1)", () => {
    expect(() => toSaleDoc(row())).not.toThrow(); // แถวที่ถูกต้องต้องผ่าน
    expect(() => toSaleDoc(row({ qty: "0" }))).toThrow();
    expect(() => toSaleDoc(row({ unit_price: "65.00 บาท" }))).toThrow();
    expect(() => toSaleDoc(row({ branch: "Siam" }))).toThrow();
    expect(() => toSaleDoc(row({ datetime: "2569-09-20T16:05:09+07:00" }))).toThrow(); // ปี พ.ศ.
    expect(() => toSaleDoc(row({ datetime: "20/09/2026 16:05" }))).toThrow();
  });
  it("เลื่อนวันที่แล้วเวลาและ timezone คงเดิม", () => {
    const { data } = toSaleDoc(row(), 6);
    expect(data.datetime).toBe("2026-09-26T16:05:09+07:00");
    expect(data.date).toBe("2026-09-26");
    expect(data.hour).toBe(16);
  });
});

describe("การเลือกช่วงและเลื่อนวันที่", () => {
  it("เลือก N วันล่าสุด นับรวมวันสุดท้าย", () => {
    const rows = ["2026-09-18", "2026-09-19", "2026-09-20", "2026-09-10"].map((d) => row({ datetime: `${d}T10:00:00+07:00` }));
    const r = selectLastDays(rows, 3);
    expect(r.start).toBe("2026-09-18");
    expect(r.end).toBe("2026-09-20");
    expect(r.rows).toHaveLength(3);
  });
  it("เลื่อนให้วันล่าสุดของข้อมูลเป็นเมื่อวาน", () => {
    expect(computeShift("2026-09-20", "2026-09-27")).toBe(6);
    expect(computeShift("2026-09-20", "2026-10-03")).toBe(12);
    expect(computeShift("2026-09-20", "2026-09-20")).toBe(0); // ไม่เลื่อนถอยหลัง
  });
  it("เลื่อนข้ามเดือน", () => {
    expect(shiftDateTime("2026-09-28T23:59:59+07:00", 5)).toBe("2026-10-03T23:59:59+07:00");
  });
});

describe("summarize", () => {
  it("นับบิลจาก order_id ไม่ใช่จำนวนเอกสาร", () => {
    const docs = [row(), row({ product_id: "P028", qty: "1", unit_price: "65" }), row({ order_id: "ORD1", branch: "สีลม" })].map((r) => toSaleDoc(r));
    const s = summarize(docs);
    expect(s.docs).toBe(3);
    expect(s.bills).toBe(2);
    expect(s.revenue).toBe(150 + 65 + 150);
    expect(s.byBranch["สีลม"]).toBe(150);
  });
});
