import { describe, it, expect, beforeAll } from "vitest";
import { validateSaleForm, buildSale, makeOrderId } from "./saleModel.js";

const products = [{ product_id: "P004", product_name: "ลาเต้เย็น", price: 75 }];
const form = (o = {}) => ({ branch: "สีลม", product_id: "P004", qty: "2", payment_method: "QR พร้อมเพย์", customer_id: "", ...o });
const opts = { uid: "user-123", now: new Date("2026-09-26T20:30:05Z"), rand: () => 0.5 };

describe("validateSaleForm", () => {
  it("ฟอร์มถูกต้องไม่มี error", () => {
    expect(validateSaleForm(form(), products)).toEqual({});
  });
  it("จำนวนต้องเป็นจำนวนเต็ม 1–20", () => {
    for (const qty of ["0", "-1", "1.5", "21", "", "abc"]) expect(validateSaleForm(form({ qty }), products)).toHaveProperty("qty");
  });
  it("สาขาและเมนูต้องมีอยู่จริง", () => {
    expect(validateSaleForm(form({ branch: "Siam" }), products)).toHaveProperty("branch");
    expect(validateSaleForm(form({ product_id: "P999" }), products)).toHaveProperty("product_id");
  });
  it("รหัสสมาชิกว่างได้ ถ้าใส่ต้องเป็น C + 5 หลัก (ตัวพิมพ์เล็กก็รับ)", () => {
    expect(validateSaleForm(form({ customer_id: " c01234 " }), products)).toEqual({});
    expect(validateSaleForm(form({ customer_id: "1234" }), products)).toHaveProperty("customer_id");
  });
});

describe("buildSale", () => {
  let id, data;
  beforeAll(() => ({ id, data } = buildSale(form({ customer_id: "c01234" }), products[0], opts)));
  it("ใช้เวลาไทย: 20:30 UTC ของวันที่ 26 = 03:30 วันที่ 27", () => {
    expect(data.datetime).toBe("2026-09-27T03:30:05+07:00");
    expect(data.date).toBe("2026-09-27");
    expect(data.hour).toBe(3);
  });
  it("ราคามาจากเมนู และ revenue = qty × ราคา เป็นตัวเลข", () => {
    expect(data.unit_price).toBe(75);
    expect(data.qty).toBe(2);
    expect(data.revenue).toBe(150);
  });
  it("โครงสร้างเหมือนข้อมูลที่ import (Lab 3.1) + ข้อมูลผู้บันทึก", () => {
    expect(Object.keys(data).sort()).toEqual([
      "branch", "channel", "created_by", "customer_id", "date", "datetime", "hour", "order_id",
      "payment_method", "product_id", "qty", "revenue", "source", "unit_price",
    ]);
    expect(data.source).toBe("web");
    expect(data.created_by).toBe("user-123");
    expect(data.customer_id).toBe("C01234");
    expect(id).toBe(`${data.order_id}-P004`);
  });
  it("ไม่ใส่รหัสสมาชิกต้องเป็น null", () => {
    expect(buildSale(form(), products[0], opts).data.customer_id).toBeNull();
  });
  it("ช่องทางคำนวณจากวิธีชำระเงิน", () => {
    expect(data.channel).toBe("หน้าร้าน");
    expect(buildSale(form({ payment_method: "Grab" }), products[0], opts).data.channel).toBe("เดลิเวอรี");
  });
});

describe("makeOrderId", () => {
  it("เลขบิลใช้วันเวลาไทย และไม่ชนกับเลขบิลเดิม (ORD…)", () => {
    expect(makeOrderId(opts.now, () => 0.5)).toMatch(/^WEB-20260927-033005-[0-9A-Z]{4}$/);
  });
});
