// ตรวจกับข้อมูลจริงของบ้านบรู (public/sales.csv = ผลจาก Lab 2.1)
// ถ้า test ชุดอื่นผ่านแต่ชุดนี้ไม่ผ่าน แปลว่าสูตรถูกในกรณีเล็ก แต่ยังพลาดกับข้อมูลจริง
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import Papa from "papaparse";
import { prepareRows } from "../metrics.js";
import { buildAnalytics } from "./build.js";
import { toSeries } from "./daily.js";
import { backtest } from "./forecast.js";
import { topAnomalies } from "./anomaly.js";

const csv = (f) => Papa.parse(fs.readFileSync(f, "utf8").replace(/^﻿/, ""), { header: true, skipEmptyLines: true }).data;
let a, hol;
beforeAll(() => {
  hol = Object.fromEntries(csv("public/thai_holidays.csv").map((h) => [h.date, h.holiday]));
  a = buildAnalytics({ rows: prepareRows(csv("public/sales.csv")), products: csv("public/products.csv"), holidays: hol });
});

describe("ข้อมูลจริง · เช้า (Lab 4.1–4.2)", () => {
  it("RFM: สมาชิก 2,507 คน · Champions 455 คน ทำยอด 39%", () => {
    expect(a.meta.members).toBe(2507);
    const ch = a.rfm.segments.find((s) => s.segment === "Champions");
    expect(ch.customers).toBe(455);
    expect(Math.round(ch.revenueShare * 100)).toBe(39);
    expect(a.rfm.segments.find((s) => s.segment === "At Risk").customers).toBe(521);
  });
  it("Cohort: เม.ย. 68 มี 73 คน กลับมาเดือนถัดไป 81%", () => {
    const c = a.cohort.cohorts[0];
    expect([c.cohort, c.size, Math.round(c.retention[1] * 100)]).toEqual(["2025-04", 73, 81]);
  });
  it("ABC: เมนูกลุ่ม A 25 รายการ", () => {
    expect(a.abc.items.filter((i) => i.cls === "A")).toHaveLength(25);
  });
});

describe("ข้อมูลจริง · บ่าย (Lab 4.4–4.5)", () => {
  it("Forecast สีลม: seasonal ผิดพลาดน้อยกว่า flat เกินครึ่ง", () => {
    const bt = backtest(toSeries(a.daily.rows, "สีลม"));
    expect(bt.mapeSeasonal).toBeLessThan(30);
    expect(bt.mapeFlat).toBeGreaterThan(70);
  });
  it("Anomaly: 3 อันดับแรกคือ 3 เหตุการณ์ที่ร้านรายงานไว้", () => {
    const top = topAnomalies(a.daily.rows, hol, 3).map((x) => `${x.date} ${x.branch}`);
    expect(top).toEqual(["2026-02-14 สยาม", "2026-05-20 บางนา", "2025-08-22 สีลม"]);
  });
});
