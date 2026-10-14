import { describe, it, expect, beforeAll } from "vitest";
import { seasonalForecast, flatForecast, mape, backtest } from "./forecast.js";
import { toSeries } from "./daily.js";
import { addDays } from "../../lab3/time.js";

// ร้านจำลอง: วันธรรมดาขาย 1,000 เสาร์-อาทิตย์ขาย 200 (แบบสาขาออฟฟิศ) เริ่มวันจันทร์ 5 ม.ค. 2026
const office = Array.from({ length: 70 }, (_, i) => {
  const date = addDays("2026-01-05", i);
  const dow = new Date(date + "T00:00:00Z").getUTCDay();
  return { date, revenue: dow === 0 || dow === 6 ? 200 : 1000 };
});

describe("toSeries", () => {
  it("เติมวันที่ไม่มียอดเป็น 0 และรวมทุกสาขา", () => {
    const daily = [
      { date: "2026-01-01", branch: "สยาม", revenue: 10 }, { date: "2026-01-01", branch: "สีลม", revenue: 5 },
      { date: "2026-01-03", branch: "สยาม", revenue: 7 },
    ];
    expect(toSeries(daily)).toEqual([{ date: "2026-01-01", revenue: 15 }, { date: "2026-01-02", revenue: 0 }, { date: "2026-01-03", revenue: 7 }]);
    expect(toSeries(daily, "สีลม")).toEqual([{ date: "2026-01-01", revenue: 5 }]);
  });
});

describe("seasonalForecast", () => {
  let f;
  beforeAll(() => { f = seasonalForecast(office, 7); });
  it("พยากรณ์ 7 วันถัดไปต่อจากวันสุดท้าย", () => {
    expect(f[0].date).toBe(addDays(office.at(-1).date, 1));
    expect(f).toHaveLength(7);
  });
  it("เคารพวันในสัปดาห์: เสาร์-อาทิตย์ 200 วันธรรมดา 1,000", () => {
    for (const x of f) {
      const dow = new Date(x.date + "T00:00:00Z").getUTCDay();
      expect(x.forecast).toBe(dow === 0 || dow === 6 ? 200 : 1000);
    }
  });
  it("flatForecast ไม่สนวันในสัปดาห์ จึงได้ค่าเดียวทุกวัน", () => {
    expect(new Set(flatForecast(office, 7).map((x) => x.forecast)).size).toBe(1);
  });
});

describe("mape และ backtest", () => {
  it("MAPE เป็นเปอร์เซ็นต์ และข้ามวันที่ยอดจริงเป็น 0", () => {
    expect(mape([100, 200, 0], [110, 180, 50])).toBeCloseTo(10);
  });
  it("สาขาแบบออฟฟิศ: seasonal แม่นกว่า flat มาก", () => {
    const bt = backtest(office, 28);
    expect(bt.mapeSeasonal).toBeCloseTo(0);
    expect(bt.mapeFlat).toBeGreaterThan(20);
    expect(bt.test).toHaveLength(28);
  });
});

import { weeklyShift } from "./build.js";
describe("weeklyShift", () => {
  it("เลื่อนเป็นสัปดาห์เต็ม วันในสัปดาห์จึงไม่เพี้ยน", () => {
    expect(weeklyShift("2026-09-20", "2026-10-10")).toBe(14); // ห่างจากเมื่อวาน 19 วัน → 14
    expect(weeklyShift("2026-09-20", "2026-09-28")).toBe(7);
    expect(weeklyShift("2026-09-20", "2026-09-21")).toBe(0);
  });
});
