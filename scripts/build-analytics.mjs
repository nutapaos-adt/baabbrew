// Lab 4 · Pre-aggregation pipeline
// อ่านยอดขายดิบ (ประวัติ 18 เดือนจาก public/sales.csv ซึ่งจำลองเป็นไฟล์ที่ส่งออกจาก POS)
// คำนวณ RFM, Cohort, ABC, ยอดรายวัน แล้วเขียนเป็นเอกสารสรุป 5 ชิ้นใน collection "analytics"
// Dashboard จึงอ่านแค่ 5 เอกสาร แทน 53,000 เอกสาร
//
//   npm run analytics:dry        คำนวณและแสดงผล ไม่เขียน ไม่ต้องมี key
//   npm run analytics            เขียนลง Firestore (ใช้ key เดียวกับ npm run seed)
//   ใน GitHub Actions ใช้ secret FIREBASE_SERVICE_ACCOUNT_JSON (ดู .github/workflows/analytics.yml)
import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { prepareRows } from "../src/lib/metrics.js";
import { buildAnalytics, shiftRows, shiftHolidays, weeklyShift } from "../src/lib/analytics/build.js";
import { topAnomalies } from "../src/lib/analytics/anomaly.js";
import { todayBangkok } from "../src/lab3/time.js";

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? true]; }));
const DRY = Boolean(args["dry-run"]);
const baht = (n) => "฿" + Math.round(n).toLocaleString("th-TH");
const csv = (f) => Papa.parse(fs.readFileSync(f, "utf8").replace(/^﻿/, ""), { header: true, skipEmptyLines: true }).data;
const today = todayBangkok();

// ---------- 1. ประวัติจาก CSV ----------
const raw = csv("public/sales.csv");
const bad = raw.find((r) => !/^20\d\d-\d\d-\d\dT/.test(r.datetime ?? ""));
if (bad) { console.error(`❌ public/sales.csv ยังไม่สะอาด เช่น ${bad.order_id} "${bad.datetime}" ใช้ไฟล์จาก Lab 2.1`); process.exit(1); }
const history = prepareRows(raw);
const products = csv("public/products.csv");
const holidaysRaw = fs.existsSync("public/thai_holidays.csv")
  ? Object.fromEntries(csv("public/thai_holidays.csv").map((h) => [h.date, h.holiday])) : {};

// ---------- 2. เชื่อม Firestore (ถ้าไม่ใช่ dry-run) ----------
let db = null;
if (!DRY) {
  let key;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    key = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);           // GitHub Actions secret
  } else {
    const p = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!p || !fs.existsSync(p)) { console.error("❌ ไม่พบ key ตั้ง FIREBASE_SERVICE_ACCOUNT ใน .env (ไฟล์ใน secrets/)"); process.exit(1); }
    if (!path.relative(process.cwd(), path.resolve(p)).startsWith("secrets" + path.sep)) {
      console.error("❌ key ต้องอยู่ในโฟลเดอร์ secrets/ เท่านั้น"); process.exit(1);
    }
    key = JSON.parse(fs.readFileSync(p, "utf8"));
  }
  const { initializeApp, cert } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  initializeApp({ credential: cert(key) });
  db = getFirestore();
  console.log(`เชื่อมต่อโปรเจกต์ ${key.project_id}`);
}

// ---------- 3. เลื่อนประวัติให้จบใกล้วันนี้ (เลื่อนทีละสัปดาห์ วันในสัปดาห์จึงไม่เพี้ยน) ----------
// ในงานจริงขั้นนี้คือ "ดึงข้อมูลจาก POS" · ในคอร์สเราจำลองด้วยประวัติ 18 เดือนที่เลื่อนวันที่
const csvEnd = history.reduce((m, r) => (r.date > m ? r.date : m), "");
const shift = args.shift !== undefined ? Number(args.shift) : weeklyShift(csvEnd, today);
const rows = shiftRows(history, shift);
const holidays = shiftHolidays(holidaysRaw, shift);
const docs = buildAnalytics({ rows, products, holidays, shift });

console.log(`เลื่อนวันที่ +${shift} วัน (${shift / 7} สัปดาห์) · ข้อมูลถึง ${docs.meta.asOf}`);
console.log(`ยอดขายดิบ ${rows.length.toLocaleString()} แถว · ${docs.meta.bills.toLocaleString()} บิล · ${baht(docs.meta.revenue)}`);
console.log("\nRFM");
for (const s of docs.rfm.segments) console.log(`  ${s.segment.padEnd(15)} ${String(s.customers).padStart(4)} คน  ยอด ${(s.revenueShare * 100).toFixed(0).padStart(3)}%`);
const A = docs.abc.items.filter((i) => i.cls === "A");
console.log(`\nABC: A ${A.length} เมนู = ${(A.reduce((s, i) => s + i.share, 0) * 100).toFixed(1)}% ของยอดขาย`);

const latest = docs.meta.asOf;
let alerts = [];
try {
  alerts = topAnomalies(docs.daily.rows, holidays, 15).filter((a) => a.date === latest);
} catch (e) {
  console.log(`\n(ข้ามการแจ้งเตือนวันผิดปกติ: ${e.message})`);
}
console.log(alerts.length
  ? `\n🚨 ยอดวันล่าสุดผิดปกติ: ${alerts.map((a) => `${a.branch} ${baht(a.actual)} (ปกติ ${baht(a.expected)})`).join(", ")}`
  : `\nวันล่าสุด (${latest}) ไม่มีสาขาใดติดอันดับผิดปกติ`);

console.log("\nขนาดเอกสาร (Firestore จำกัด 1 MiB ต่อเอกสาร)");
for (const [k, v] of Object.entries(docs)) {
  const kb = Buffer.byteLength(JSON.stringify(v)) / 1024;
  console.log(`  analytics/${k.padEnd(7)} ${kb.toFixed(0).padStart(4)} KB`);
  if (kb > 900) { console.error(`❌ analytics/${k} ใหญ่เกินไป`); process.exit(1); }
}

if (DRY) { console.log("\n(dry-run: ยังไม่ได้เขียนลง Firestore)"); process.exit(0); }

const { FieldValue } = await import("firebase-admin/firestore");
const batch = db.batch();
for (const [k, v] of Object.entries(docs)) batch.set(db.doc(`analytics/${k}`), v);
batch.set(db.doc("analytics/meta"), {
  builtAt: FieldValue.serverTimestamp(),
  builtBy: process.env.GITHUB_ACTIONS ? "github-actions" : "local",
  alerts: alerts.map(({ date, branch, actual, expected }) => ({ date, branch, actual, expected })),
}, { merge: true });
await batch.commit();
console.log(`\n✅ เขียน 5 เอกสารใน analytics/ แล้ว (ใช้โควตาเขียน 5 ครั้ง)`);
