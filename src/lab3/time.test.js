import { describe, it, expect } from "vitest";
import { nowBangkokISO, todayBangkok, addDays, daysBetween } from "./time.js";

describe("เวลาไทย", () => {
  it("ตี 3 ครึ่งของไทย = 20:30 UTC ของเมื่อวาน ต้องได้วันที่ของไทย", () => {
    const d = new Date("2026-09-26T20:30:00Z");
    expect(nowBangkokISO(d)).toBe("2026-09-27T03:30:00+07:00");
    expect(todayBangkok(d)).toBe("2026-09-27");
  });
  it("เที่ยงคืนตรงต้องเป็น 00 ไม่ใช่ 24", () => {
    expect(nowBangkokISO(new Date("2026-09-26T17:00:00Z"))).toBe("2026-09-27T00:00:00+07:00");
  });
  it("บวกวันข้ามเดือนและข้ามปี", () => {
    expect(addDays("2026-09-20", 7)).toBe("2026-09-27");
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("นับจำนวนวัน", () => {
    expect(daysBetween("2026-09-20", "2026-09-26")).toBe(6);
    expect(daysBetween("2026-09-26", "2026-09-20")).toBe(-6);
  });
});
