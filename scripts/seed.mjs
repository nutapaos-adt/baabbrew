// Lab 3.1 · นำข้อมูลยอดขายเข้า Firestore
//
//   npm run seed:dry              ดูผลก่อน ไม่เขียนจริง ไม่ต้องมี key
//   npm run seed                  นำเข้า 90 วันล่าสุด (เลื่อนวันที่ให้วันล่าสุด = เมื่อวาน)
//   npm run seed -- --days=30     นำเข้า 30 วันล่าสุด
//   npm run seed -- --no-shift    ไม่เลื่อนวันที่
//
// ต้องมีใน .env:  FIREBASE_SERVICE_ACCOUNT=./secrets/service-account.json
import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { selectLastDays, computeShift, toSaleDoc, summarize } from "./seedTransform.mjs";
import { todayBangkok } from "../src/lab3/time.js";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? true]; })
);
const DAYS = Number(args.days ?? 90);
const FILE = args.file ?? "public/sales.csv";
const DRY = Boolean(args["dry-run"]);
const SHIFT = !args["no-shift"];
const WRITE_LIMIT = 18_000; // เผื่อจากโควตาฟรีรายวันของ Firestore (ตรวจตัวเลขล่าสุดในหน้า pricing)

const baht = (n) => "฿" + Math.round(n).toLocaleString("th-TH");
const readCsv = (f) => Papa.parse(fs.readFileSync(f, "utf8").replace(/^\uFEFF/, ""), { header: true, skipEmptyLines: true }).data;

// ---------- เตรียมข้อมูล ----------
const all = readCsv(FILE);
const badDate = all.find((r) => !/^20\d\d-\d\d-\d\dT/.test(r.datetime ?? ""));
if (badDate) {
  console.error(`❌ พบวันที่ที่ยังไม่ได้ทำความสะอาด เช่น ${badDate.order_id} "${badDate.datetime}"`);
  console.error(`   ให้ใช้ sales_clean.csv จาก Lab 2.1 วางทับ public/sales.csv ก่อน`);
  process.exit(1);
}
const { rows, start, end } = selectLastDays(all, DAYS);
const shift = SHIFT ? computeShift(end, todayBangkok()) : 0;
let docs;
try {
  docs = rows.map((r) => toSaleDoc(r, shift));
} catch (e) {
  console.error(`❌ ${e.message}\n   ตรวจว่า ${FILE} คือไฟล์ที่ทำความสะอาดแล้วจาก Lab 2.1`);
  process.exit(1);
}
const ids = new Set(docs.map((d) => d.id));
if (ids.size !== docs.length) {
  console.error(`❌ document id ซ้ำ ${docs.length - ids.size} รายการ ตรวจว่าไม่มีแถวซ้ำในไฟล์`);
  process.exit(1);
}
const products = readCsv("public/products.csv");
const branches = readCsv("public/branches.csv");
const s = summarize(docs);

console.log(`ไฟล์: ${FILE} (${all.length.toLocaleString()} แถว)`);
console.log(`ช่วงข้อมูลเดิม: ${start} ถึง ${end} (${DAYS} วัน)`);
console.log(shift ? `เลื่อนวันที่ +${shift} วัน → ${s.start} ถึง ${s.end}` : "ไม่เลื่อนวันที่");
console.log(`จะเขียน: sales ${s.docs.toLocaleString()} + products ${products.length} + branches ${branches.length} เอกสาร`);
console.log(`บิล ${s.bills.toLocaleString()} · ยอดขาย ${baht(s.revenue)}`);
for (const [b, v] of Object.entries(s.byBranch).sort((a, b) => b[1] - a[1])) console.log(`  ${b.padEnd(12)} ${baht(v)}`);

if (DRY) {
  console.log("\nตัวอย่างเอกสาร:", JSON.stringify(docs[docs.length - 1], null, 2));
  console.log("\n(dry-run: ยังไม่ได้เขียนลง Firestore)");
  process.exit(0);
}

const totalWrites = s.docs + products.length + branches.length;
if (totalWrites > WRITE_LIMIT && !args.force) {
  console.error(`\n❌ จะเขียน ${totalWrites.toLocaleString()} ครั้ง ใกล้หรือเกินโควตาฟรีรายวัน ลด --days หรือใช้ --force ถ้าแน่ใจ`);
  process.exit(1);
}

// ---------- ตรวจ key ก่อนเชื่อมต่อ ----------
const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!keyPath || !fs.existsSync(keyPath)) {
  console.error("\n❌ ไม่พบ service account key ตั้งค่า FIREBASE_SERVICE_ACCOUNT ใน .env ให้ชี้ไปที่ไฟล์ JSON");
  process.exit(1);
}
const rel = path.relative(process.cwd(), path.resolve(keyPath));
if (!rel.startsWith("secrets" + path.sep)) {
  console.error(`\n❌ key อยู่ที่ ${rel} ให้ย้ายไปไว้ในโฟลเดอร์ secrets/ ซึ่งถูกกันไม่ให้ขึ้น GitHub`);
  process.exit(1);
}
const gitignore = fs.existsSync(".gitignore") ? fs.readFileSync(".gitignore", "utf8") : "";
if (!gitignore.split(/\r?\n/).some((l) => ["secrets", "secrets/", "/secrets", "/secrets/"].includes(l.trim()))) {
  console.error("\n❌ .gitignore ยังไม่มีบรรทัด secrets/ key อาจหลุดขึ้น GitHub หยุดไว้ก่อน");
  process.exit(1);
}

const { initializeApp, cert } = await import("firebase-admin/app");
const { getFirestore } = await import("firebase-admin/firestore");
const key = JSON.parse(fs.readFileSync(keyPath, "utf8"));
initializeApp({ credential: cert(key) });
const db = getFirestore();
console.log(`\nเชื่อมต่อโปรเจกต์: ${key.project_id}`);

async function writeAll(collection, items) {
  for (let i = 0; i < items.length; i += 500) {
    const batch = db.batch();
    for (const { id, data } of items.slice(i, i + 500)) batch.set(db.collection(collection).doc(id), data);
    await batch.commit();
    process.stdout.write(`\r  ${collection}: ${Math.min(i + 500, items.length).toLocaleString()} / ${items.length.toLocaleString()}`);
  }
  process.stdout.write("\n");
}

await writeAll("products", products.map((p) => ({
  id: p.product_id,
  data: { product_id: p.product_id, product_name: p.product_name, category: p.category, price: Number(p.price), cost: Number(p.cost) },
})));
await writeAll("branches", branches.map((b) => ({
  id: b.branch_id,
  data: { branch_id: b.branch_id, branch: b.branch, branch_type: b.branch_type, lat: Number(b.lat), lng: Number(b.lng), opened_date: b.opened_date },
})));
await writeAll("sales", docs);

fs.writeFileSync("import-summary.json", JSON.stringify({ ...s, shift, file: FILE, importedAt: new Date().toISOString() }, null, 2));
console.log("✅ นำเข้าเสร็จ บันทึกสรุปไว้ที่ import-summary.json แล้วรัน npm run verify-import");
