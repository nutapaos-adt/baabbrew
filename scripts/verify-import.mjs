// Lab 3.1 · ตรวจว่าข้อมูลใน Firestore ตรงกับที่นำเข้า
// ใช้ aggregation query (count/sum) จึงเสียโควตาอ่านน้อยมาก ไม่ต้องดึงเอกสารทั้งหมด
import fs from "node:fs";

if (!fs.existsSync("import-summary.json")) {
  console.error("❌ ไม่พบ import-summary.json ให้รัน npm run seed ก่อน");
  process.exit(1);
}
const expected = JSON.parse(fs.readFileSync("import-summary.json", "utf8"));
const { initializeApp, cert } = await import("firebase-admin/app");
const { getFirestore, AggregateField } = await import("firebase-admin/firestore");
initializeApp({ credential: cert(JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT, "utf8"))) });
const db = getFirestore();

const baht = (n) => "฿" + Math.round(n).toLocaleString("th-TH");
const q = db.collection("sales").where("source", "==", "import");
const snap = await q.aggregate({ n: AggregateField.count(), total: AggregateField.sum("revenue") }).get();
const { n, total } = snap.data();

let ok = true;
const rep = (pass, msg) => { ok &&= pass; console.log((pass ? "✅ " : "❌ ") + msg); };
rep(n === expected.docs, `จำนวนเอกสาร: Firestore ${n.toLocaleString()} · ที่นำเข้า ${expected.docs.toLocaleString()}`);
rep(Math.round(total) === Math.round(expected.revenue), `ยอดขายรวม: Firestore ${baht(total)} · ที่นำเข้า ${baht(expected.revenue)}`);

for (const [branch, rev] of Object.entries(expected.byBranch)) {
  const b = await q.where("branch", "==", branch).aggregate({ total: AggregateField.sum("revenue") }).get();
  rep(Math.round(b.data().total) === Math.round(rev), `${branch}: ${baht(b.data().total)}`);
}
const products = (await db.collection("products").count().get()).data().count;
rep(products === 40, `เมนูใน products: ${products}`);
console.log(ok
  ? `\n🎉 ข้อมูลครบ ช่วงวันที่ ${expected.start} ถึง ${expected.end} ไปทำ Lab 3.2 ได้`
  : "\nยังไม่ตรง ถ้าเคยนำเข้าหลายครั้งด้วย --days ต่างกัน ให้ลบ collection sales ใน console แล้วนำเข้าใหม่");
