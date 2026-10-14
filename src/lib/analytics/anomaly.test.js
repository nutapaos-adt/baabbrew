import { describe, it, expect, beforeAll } from "vitest";
import { median, scoreAnomalies, topAnomalies } from "./anomaly.js";
import { addDays } from "../../lab3/time.js";

const days = (n, f) => Array.from({ length: n }, (_, i) => f(addDays("2026-01-05", i), i));
const dow = (d) => new Date(d + "T00:00:00Z").getUTCDay();
// สาขาออฟฟิศ: จ–ศ 2,000 ส–อา 400 · วันที่ 60 ไฟดับเหลือ 150
const office = days(70, (date, i) => ({ date, branch: "สีลม", revenue: i === 60 ? 150 : dow(date) % 6 === 0 ? 400 : 2000 }));

describe("median", () => {
  it("คี่และคู่", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe("scoreAnomalies", () => {
  let all;
  beforeAll(() => { all = scoreAnomalies(office); });
  it("วันไฟดับอยู่อันดับ 1 และคาดหวังจากวันเดียวกันของสัปดาห์", () => {
    expect(all[0].date).toBe(addDays("2026-01-05", 60));
    expect(all[0].expected).toBe(2000);
    expect(all[0].change).toBeCloseTo(150 / 2000 - 1);
  });
  it("เสาร์-อาทิตย์ที่ขายน้อยตามปกติ ไม่ถือว่าผิดปกติ", () => {
    const weekend = all.filter((a) => dow(a.date) % 6 === 0);
    expect(Math.max(...weekend.map((a) => Math.abs(a.score)))).toBeCloseTo(0);
  });
  it("ต้องมีข้อมูลย้อนหลังอย่างน้อย 4 สัปดาห์ จึงจะให้คะแนน", () => {
    expect(all.every((a) => a.date >= addDays("2026-01-05", 28))).toBe(true);
  });
  it("วันหยุดติดป้าย และ topAnomalies ไม่นำมาจัดอันดับ", () => {
    const h = { [addDays("2026-01-05", 60)]: "วันหยุดสมมติ" };
    expect(scoreAnomalies(office, h)[0].holiday).toBe("วันหยุดสมมติ");
    expect(topAnomalies(office, h, 3).some((a) => a.holiday)).toBe(false);
  });
});
