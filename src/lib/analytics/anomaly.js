// Lab 4.5 · ใช้ Claude Code เขียนฟังก์ชันที่ยังว่าง (Prompt 4.5A ใน PROMPTS_LAB4.md) จนกว่า npm test จะผ่าน · ห้ามแก้ไฟล์ test
// Lab 4.5 · หาวันที่ยอดขายผิดปกติ
// เทียบกับ "ค่ากลางของวันเดียวกันของสัปดาห์ใน 8 สัปดาห์ก่อน" ไม่ใช่ค่าเฉลี่ย 28 วัน
// เพราะสาขาออฟฟิศกับห้างขายวันธรรมดาและเสาร์-อาทิตย์ต่างกันมาก
import { addDays } from "../../lab3/time.js";
import { toSeries } from "./daily.js";

export const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};

/**
 * คะแนนความผิดปกติ = ln((จริง + SMOOTH) / (คาดหวัง + SMOOTH))
 * SMOOTH กันไม่ให้วันยอดน้อย ๆ (เช่น 50 บาท เทียบ 100 บาท) ดูผิดปกติเกินจริง
 * @param daily    [{ date, branch, revenue }] จาก dailyByBranch()
 * @param holidays { "YYYY-MM-DD": "ชื่อวันหยุด" } วันหยุดจะไม่ถูกจัดอันดับ แต่ติดป้ายไว้
 * @returns ทุกวันที่คำนวณได้ เรียงจากผิดปกติมากไปน้อย:
 *   { date, branch, actual, expected, change (สัดส่วน เช่น -0.9 = ต่ำกว่าปกติ 90%), score, holiday }
 */
export function scoreAnomalies(daily, holidays = {}, { weeks = 8, minWeeks = 4, smooth = 1000 } = {}) {
  const branches = [...new Set(daily.map((d) => d.branch))];
  const out = [];

  for (const branch of branches) {
    // อนุกรมต่อเนื่องของสาขานี้ (วันที่ไม่มียอดเป็น 0) จึงหาวันเดียวกันของสัปดาห์ก่อน ๆ ได้ตรง
    const series = toSeries(daily, branch);
    const revenueOn = new Map(series.map((s) => [s.date, s.revenue]));

    for (const { date, revenue: actual } of series) {
      // วันเดียวกันของสัปดาห์ ย้อนหลัง 1..weeks สัปดาห์ (เฉพาะที่มีข้อมูล)
      const history = [];
      for (let k = 1; k <= weeks; k++) {
        const v = revenueOn.get(addDays(date, -7 * k));
        if (v !== undefined) history.push(v);
      }
      if (history.length < minWeeks) continue; // ประวัติน้อยเกินไป ยังตัดสินไม่ได้

      // ค่ากลาง ไม่ใช่ค่าเฉลี่ย: วันผิดปกติในอดีตจะไม่ดึงค่าคาดหวังเพี้ยน
      const expected = median(history);
      out.push({
        date,
        branch,
        actual,
        expected,
        change: expected > 0 ? actual / expected - 1 : null,
        score: Math.log((actual + smooth) / (expected + smooth)),
        holiday: holidays[date] ?? null,
      });
    }
  }

  return out.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
}

/** อันดับวันผิดปกติที่ควรตรวจสอบ (ไม่รวมวันหยุด) */
export function topAnomalies(daily, holidays = {}, n = 15, opts) {
  return scoreAnomalies(daily, holidays, opts).filter((a) => !a.holiday).slice(0, n);
}
