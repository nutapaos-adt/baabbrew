import { describe, it, expect, beforeAll } from "vitest";
import { monthIndex, computeCohorts } from "./cohort.js";

const sale = (customer_id, date) => ({ customer_id, date, order_id: customer_id + date, revenue: 100 });

describe("monthIndex", () => {
  it("นับเดือนข้ามปี", () => {
    expect(monthIndex("2025-11", "2026-02")).toBe(3);
    expect(monthIndex("2026-01", "2026-01")).toBe(0);
  });
});

describe("computeCohorts · ตัวอย่างคำนวณมือ", () => {
  // A, B เริ่ม ก.ค. · A กลับมา ส.ค. · B กลับมา ก.ย. · C เริ่ม ส.ค. แล้วไม่กลับมา
  const rows = [
    sale("A", "2026-07-03"), sale("A", "2026-08-15"),
    sale("B", "2026-07-20"), sale("B", "2026-09-02"), sale("B", "2026-09-10"),
    sale("C", "2026-08-01"),
    sale("", "2026-07-05"),
  ];
  let r;
  beforeAll(() => { r = computeCohorts(rows, "2026-09-20"); });
  it("แบ่ง cohort ตามเดือนแรกที่ซื้อ", () => {
    expect(r.cohorts.map((c) => [c.cohort, c.size])).toEqual([["2026-07", 2], ["2026-08", 1]]);
  });
  it("retention: เดือน 0 = 100% และนับลูกค้าซ้ำในเดือนเดียวกันครั้งเดียว", () => {
    expect(r.cohorts[0].retention).toEqual([1, 0.5, 0.5]);
    expect(r.cohorts[1].retention).toEqual([1, 0]);
  });
  it("บอกว่าเดือนสุดท้ายข้อมูลไม่ครบ (ก.ย. มีแค่ 20 วัน)", () => {
    expect(r.lastMonth).toBe("2026-09");
    expect(r.lastMonthPartial).toBe(true);
    expect(r.daysInLastMonth).toBe(20);
  });
  it("เดือนครบพอดีไม่ถือว่าไม่ครบ", () => {
    expect(computeCohorts(rows, "2026-09-30").lastMonthPartial).toBe(false);
  });
});
