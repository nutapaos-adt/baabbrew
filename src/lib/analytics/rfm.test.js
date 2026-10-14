import { describe, it, expect, beforeAll } from "vitest";
import { percentileScores, segmentOf, computeRfm } from "./rfm.js";

const sale = (customer_id, date, order_id, revenue) => ({ customer_id, date, order_id, revenue });

describe("percentileScores", () => {
  it("10 ค่าไม่ซ้ำ ได้คะแนน 1–5 กลุ่มละ 2 ค่า", () => {
    expect(percentileScores([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });
  it("ค่าที่เท่ากันต้องได้คะแนนเท่ากัน (ไม่สุ่มแบ่ง)", () => {
    const s = percentileScores([1, 1, 1, 1, 1, 1, 7, 8, 9, 10]);
    expect(new Set(s.slice(0, 6)).size).toBe(1);
    expect(s).toEqual([1, 1, 1, 1, 1, 1, 4, 4, 5, 5]);
  });
  it("ลำดับผลลัพธ์ตรงกับลำดับข้อมูลเข้า", () => {
    expect(percentileScores([10, 1, 5, 3, 8])).toEqual([5, 1, 3, 2, 4]);
  });
});

describe("segmentOf", () => {
  it.each([
    [5, 5, "Champions"], [4, 4, "Champions"], [3, 5, "Loyal"], [5, 1, "New"], [4, 2, "New"],
    [2, 5, "At Risk"], [1, 3, "At Risk"], [1, 1, "Lost"], [2, 2, "Lost"], [3, 3, "Need Attention"], [4, 3, "Need Attention"],
  ])("r=%i f=%i → %s", (r, f, seg) => expect(segmentOf(r, f)).toBe(seg));
});

describe("computeRfm", () => {
  const rows = [
    sale("C1", "2026-09-01", "O1", 100), sale("C1", "2026-09-01", "O1", 50), // บิลเดียว 2 แถว
    sale("C1", "2026-09-20", "O2", 80),
    sale("C2", "2026-06-10", "O3", 300),
    sale("", "2026-09-20", "O4", 999), // walk-in ไม่นับ
  ];
  let customers, segments, c1;
  beforeAll(() => {
    ({ customers, segments } = computeRfm(rows, "2026-09-20"));
    c1 = customers.find((c) => c.id === "C1");
  });
  it("R = จำนวนวันจากครั้งล่าสุดถึง asOf, F = จำนวนบิล (ไม่ใช่จำนวนแถว), M = ยอดรวม", () => {
    expect(c1).toMatchObject({ R: 0, F: 2, M: 230 });
    expect(customers.find((c) => c.id === "C2")).toMatchObject({ R: 102, F: 1, M: 300 });
  });
  it("ไม่นับลูกค้า walk-in", () => expect(customers).toHaveLength(2));
  it("สรุปกลุ่มครบ 6 กลุ่ม และสัดส่วนรวมกันได้ 1", () => {
    expect(segments.map((s) => s.segment)).toEqual(["Champions", "Loyal", "New", "Need Attention", "At Risk", "Lost"]);
    expect(segments.reduce((a, s) => a + s.revenueShare, 0)).toBeCloseTo(1);
    expect(segments.reduce((a, s) => a + s.customers, 0)).toBe(2);
  });
});
