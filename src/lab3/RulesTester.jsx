// Lab 3.3 · ทดสอบ Security Rules ด้วยการ "โจมตี" ฐานข้อมูลของตัวเอง
// ทุกการโจมตีควรถูกปฏิเสธ (permission-denied) ถ้าผ่านได้แปลว่า rules ยังมีช่องโหว่
// ออกแบบให้ไม่ทำลายข้อมูลจริง: เอกสารที่หลุดเข้าไปจะมีวันที่ปี 2000 (อยู่นอกทุกช่วงใน Dashboard)
// และการแก้/ลบจะทำกับเอกสารที่ไม่มีอยู่จริง
import { useEffect, useState } from "react";
import { doc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, limit, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "./firebase.js";

const base = (uid) => ({
  order_id: "RULES-TEST", datetime: "2000-01-01T00:00:00+07:00", date: "2000-01-01", hour: 0,
  branch: "สยาม", product_id: "P004", qty: 1, unit_price: 75, revenue: 75, customer_id: null,
  payment_method: "เงินสด", channel: "หน้าร้าน", source: "web", created_by: uid, created_at: serverTimestamp(),
});
const newId = (n) => `RULES-TEST-${n}-${Date.now()}`;

const SIGNED_IN = [
  { name: "จำนวนติดลบ", why: "qty ต้องเป็น 1–20", run: (u) => setDoc(doc(db, "sales", newId(1)), { ...base(u), qty: -5, revenue: -375 }) },
  { name: "ราคาไม่ตรงกับเมนู (ลาเต้เย็น ฿1)", why: "unit_price ต้องเท่ากับราคาใน products", run: (u) => setDoc(doc(db, "sales", newId(2)), { ...base(u), unit_price: 1, revenue: 1 }) },
  { name: "ยอดรวมไม่เท่ากับ จำนวน × ราคา", why: "revenue ต้องคำนวณถูก", run: (u) => setDoc(doc(db, "sales", newId(3)), { ...base(u), revenue: 999999 }) },
  { name: "ปลอมตัวเป็นผู้ใช้อื่น", why: "created_by ต้องเป็น uid ของคนที่ล็อกอิน", run: () => setDoc(doc(db, "sales", newId(4)), base("someone-else")) },
  { name: "สาขาที่ไม่มีอยู่จริง", why: "branch ต้องเป็น 5 สาขา", run: (u) => setDoc(doc(db, "sales", newId(5)), { ...base(u), branch: "สาขาปลอม" }) },
  { name: "แอบเพิ่มฟิลด์ส่วนลด", why: "ห้ามมีฟิลด์นอกเหนือจากที่กำหนด (hasOnly)", run: (u) => setDoc(doc(db, "sales", newId(6)), { ...base(u), discount: 100 }) },
  { name: "ใส่เวลาเอง ไม่ใช้เวลาเซิร์ฟเวอร์", why: "created_at ต้องเป็น request.time", run: (u) => setDoc(doc(db, "sales", newId(7)), { ...base(u), created_at: new Date("2000-01-01") }) },
  { name: "แก้ไขยอดขายที่บันทึกแล้ว", why: "update ต้องถูกปิด", run: () => updateDoc(doc(db, "sales", "rules-test-no-such-doc"), { qty: 999 }), notFoundMeansOpen: true },
  { name: "ลบยอดขาย", why: "delete ต้องถูกปิด", run: () => deleteDoc(doc(db, "sales", "rules-test-no-such-doc")) },
  { name: "แก้ราคาเมนูจากหน้าเว็บ", why: "products เขียนได้เฉพาะ admin script", run: () => updateDoc(doc(db, "products", "rules-test-no-such-product"), { price: 1 }), notFoundMeansOpen: true },
];
const SIGNED_OUT = [
  { name: "อ่านยอดขายโดยไม่ล็อกอิน", why: "ต้องล็อกอินก่อนอ่าน", run: () => getDocs(query(collection(db, "sales"), limit(1))) },
  { name: "บันทึกยอดขายโดยไม่ล็อกอิน", why: "ต้องล็อกอินก่อนเขียน", run: () => setDoc(doc(db, "sales", newId(0)), base("no-login")) },
];

const withTimeout = (p, ms = 10000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej({ code: "timeout" }), ms))]);

export default function RulesTester() {
  const [user, setUser] = useState(undefined);
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(false);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const tests = user ? SIGNED_IN : SIGNED_OUT;

  async function runAll() {
    setRunning(true);
    setResults({});
    for (const t of tests) {
      let r;
      try {
        await withTimeout(t.run(user?.uid));
        r = { blocked: false, detail: "ผ่านได้" };
      } catch (e) {
        if (e.code === "permission-denied") r = { blocked: true, detail: "permission-denied" };
        else if (e.code === "not-found" && t.notFoundMeansOpen) r = { blocked: false, detail: "rules อนุญาต (เอกสารทดสอบไม่มีจริงจึงไม่มีอะไรถูกแก้)" };
        else r = { blocked: null, detail: e.code ?? e.message };
      }
      setResults((s) => ({ ...s, [t.name]: r }));
    }
    setRunning(false);
  }

  const done = Object.keys(results).length === tests.length && !running;
  const passed = Object.values(results).filter((r) => r.blocked).length;

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold">Lab 3.3 · ทดสอบ Security Rules</h1>
      <p className="mt-2 text-stone-600">
        กดปุ่มเพื่อลองโจมตีฐานข้อมูลของตัวเอง ทุกข้อควรได้ ✅ ถูกบล็อก
        ทำ 2 รอบ: <b>ก่อน</b> deploy rules (โหมดทดสอบ จะเห็น ❌ เกือบทั้งหมด) และ <b>หลัง</b> deploy
      </p>
      <p className="mt-2 text-sm text-stone-500">
        {user ? `ทดสอบในฐานะ ${user.displayName ?? user.email} · ออกจากระบบแล้วกลับมาหน้านี้เพื่อทดสอบกรณีไม่ล็อกอิน`
              : "ทดสอบในฐานะผู้ที่ยังไม่ล็อกอิน · ล็อกอินที่แท็บ \"สด\" แล้วกลับมาเพื่อทดสอบชุดที่เหลือ"}
      </p>
      <button onClick={runAll} disabled={running || user === undefined}
              className="mt-4 rounded-lg bg-stone-900 px-5 py-2.5 font-medium text-white disabled:opacity-60">
        {running ? "กำลังทดสอบ…" : `เริ่มทดสอบ ${tests.length} ข้อ`}
      </button>

      <table className="mt-5 w-full rounded-xl bg-white text-sm ring-1 ring-stone-200">
        <thead className="text-left text-stone-500">
          <tr><th className="p-3 font-medium">การโจมตี</th><th className="p-3 font-medium">rules ที่ควรกันไว้</th><th className="p-3 font-medium">ผล</th></tr>
        </thead>
        <tbody>
          {tests.map((t) => {
            const r = results[t.name];
            return (
              <tr key={t.name} className="border-t border-stone-100 align-top">
                <td className="p-3">{t.name}</td>
                <td className="p-3 text-stone-500">{t.why}</td>
                <td className="p-3 whitespace-nowrap">
                  {!r ? "–" : r.blocked === true ? <span className="text-emerald-700">✅ ถูกบล็อก</span>
                    : r.blocked === false ? <span className="font-medium text-red-700">❌ ผ่านได้ อันตราย!</span>
                    : <span className="text-amber-700">⚠️ {r.detail}</span>}
                  {r && r.blocked === false && <div className="text-xs text-stone-400">{r.detail}</div>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {done && (
        <p className={`mt-4 font-medium ${passed === tests.length ? "text-emerald-700" : "text-red-700"}`}>
          {passed === tests.length ? `🎉 บล็อกได้ครบ ${passed}/${tests.length} ข้อ` : `บล็อกได้ ${passed}/${tests.length} ข้อ ตรวจ firestore.rules แล้ว deploy ใหม่`}
        </p>
      )}
      <p className="mt-4 text-xs text-stone-500">
        ถ้ารอบแรก (โหมดทดสอบ) มีเอกสารหลุดเข้าไป จะมี order_id = RULES-TEST และวันที่ 1 ม.ค. 2000 ลบได้ใน Firebase console
      </p>
    </div>
  );
}
