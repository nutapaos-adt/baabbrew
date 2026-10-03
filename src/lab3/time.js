// เวลาไทยที่ถูกต้องเสมอ ไม่ว่าเครื่องผู้ใช้จะตั้ง timezone อะไร
// บทเรียนต่อจาก Lab 1: new Date().toISOString() ให้เวลา UTC ซึ่งช้ากว่าไทย 7 ชั่วโมง
// ตี 1 ของไทยจึงกลายเป็น "เมื่อวาน" ถ้าใช้ toISOString()

const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
  hourCycle: "h23",
});

/** เวลาไทยในรูปแบบเดียวกับ sales.csv เช่น 2026-09-27T14:05:09+07:00 */
export function nowBangkokISO(date = new Date()) {
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+07:00`;
}

/** วันที่วันนี้ตามเวลาไทย เช่น 2026-09-27 */
export const todayBangkok = (date = new Date()) => nowBangkokISO(date).slice(0, 10);

/** บวก/ลบวันจากวันที่ YYYY-MM-DD (คำนวณแบบ UTC จึงไม่เพี้ยนเพราะ timezone) */
export function addDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** จำนวนวันจาก a ถึง b (b − a) */
export function daysBetween(a, b) {
  const t = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(b) - t(a)) / 86_400_000);
}
