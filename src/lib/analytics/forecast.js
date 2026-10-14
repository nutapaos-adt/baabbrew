// Lab 4.4 · ใช้ Claude Code เขียนฟังก์ชันที่ยังว่าง (Prompt 4.4A ใน PROMPTS_LAB4.md) จนกว่า npm test จะผ่าน · ห้ามแก้ไฟล์ test
// Lab 4.4 · พยากรณ์ยอดขายแบบอธิบายได้ และวัดความแม่นด้วยการย้อนทดสอบ (backtest)
import { addDays } from "../../lab3/time.js";

const dow = (ymd) => new Date(ymd + "T00:00:00Z").getUTCDay(); // 0 = อาทิตย์

/** ค่าเฉลี่ยยอดขายวันเดียวกันของสัปดาห์ K ครั้งล่าสุด (ฤดูกาลรายสัปดาห์) */
export function seasonalForecast(series, horizon, K = 8) {
  // แยกยอดตามวันในสัปดาห์ (0–6) ตามลำดับเวลา
  const byDow = Array.from({ length: 7 }, () => []);
  for (const s of series) byDow[dow(s.date)].push(s.revenue);
  // ค่าเฉลี่ยของวันเดียวกันในสัปดาห์ K ครั้งล่าสุด
  const avgOf = (d) => {
    const recent = byDow[d].slice(-K);
    return recent.length ? recent.reduce((a, v) => a + v, 0) / recent.length : 0;
  };
  const last = series[series.length - 1].date;
  return Array.from({ length: horizon }, (_, i) => {
    const date = addDays(last, i + 1);
    return { date, forecast: avgOf(dow(date)) };
  });
}

/** ค่าเฉลี่ย K วันล่าสุด เส้นตรง (ตัวเปรียบเทียบที่ไม่สนวันในสัปดาห์) */
export function flatForecast(series, horizon, K = 28) {
  const recent = series.slice(-K);
  const avg = recent.reduce((a, s) => a + s.revenue, 0) / recent.length;
  const last = series[series.length - 1].date;
  return Array.from({ length: horizon }, (_, i) => ({ date: addDays(last, i + 1), forecast: avg }));
}

/** Mean Absolute Percentage Error (%) · ข้ามวันที่ยอดจริงเป็น 0 เพราะหารไม่ได้ */
export function mape(actual, forecast) {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] === 0) continue; // หารด้วย 0 ไม่ได้
    sum += Math.abs(actual[i] - forecast[i]) / actual[i];
    n += 1;
  }
  return n ? (sum / n) * 100 : 0;
}

/**
 * ย้อนทดสอบ: ซ่อน horizon วันสุดท้าย พยากรณ์จากข้อมูลก่อนหน้า แล้วเทียบกับของจริง
 * band = ±1.28 × ส่วนเบี่ยงเบนมาตรฐานของ % ความคลาดเคลื่อน (ช่วงประมาณ 80%)
 */
export function backtest(series, horizon = 28, K = 8) {
  // แบ่งข้อมูล: ช่วงฝึก (ก่อนหน้า) กับช่วงทดสอบ (horizon วันสุดท้ายที่ซ่อนไว้)
  const train = series.slice(0, -horizon);
  const actualRows = series.slice(-horizon);
  const seasonal = seasonalForecast(train, horizon, K);
  const flat = flatForecast(train, horizon);

  const actual = actualRows.map((s) => s.revenue);
  const test = actualRows.map((s, i) => ({
    date: s.date,
    actual: s.revenue,
    forecast: seasonal[i].forecast,
    flat: flat[i].forecast,
  }));

  // ช่วงคาดการณ์: กระจายตัวของ % ความคลาดเคลื่อนเทียบกับค่าพยากรณ์ (ข้ามวันที่พยากรณ์เป็น 0)
  const errors = test.filter((t) => t.forecast > 0).map((t) => (t.actual - t.forecast) / t.forecast);
  const mean = errors.length ? errors.reduce((a, e) => a + e, 0) / errors.length : 0;
  const sd = errors.length
    ? Math.sqrt(errors.reduce((a, e) => a + (e - mean) ** 2, 0) / errors.length)
    : 0;

  return {
    test,
    mapeSeasonal: mape(actual, seasonal.map((f) => f.forecast)),
    mapeFlat: mape(actual, flat.map((f) => f.forecast)),
    band: 1.28 * sd,
  };
}
