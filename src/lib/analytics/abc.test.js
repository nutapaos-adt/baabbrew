import { describe, it, expect } from "vitest";
import { computeAbc } from "./abc.js";

const s = (product_id, revenue) => ({ product_id, revenue });

describe("computeAbc", () => {
  const items = computeAbc(
    [s("P1", 500), s("P2", 250), s("P2", 50), s("P3", 100), s("P4", 60), s("P5", 40)],
    [{ product_id: "P1", product_name: "ลาเต้เย็น", category: "กาแฟ" }]
  );
  it("รวมยอดต่อเมนูและเรียงมากไปน้อย", () => {
    expect(items.map((i) => [i.product_id, i.revenue])).toEqual([["P1", 500], ["P2", 300], ["P3", 100], ["P4", 60], ["P5", 40]]);
    expect(items[0].name).toBe("ลาเต้เย็น");
  });
  it("สัดส่วนสะสม", () => {
    expect(items.map((i) => i.cumShare)).toEqual([0.5, 0.8, 0.9, 0.96, 1]);
  });
  it("เมนูที่ทำให้ยอดสะสมข้าม 80% ยังเป็น A · ข้าม 95% ยังเป็น B", () => {
    expect(items.map((i) => i.cls)).toEqual(["A", "A", "B", "B", "C"]);
  });
});
