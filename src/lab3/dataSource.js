// ชั้นข้อมูลของหน้า "สด" · มี 2 แบบที่ใช้ API เดียวกัน
//   firestoreSource  ใช้ Firestore จริง (onSnapshot = real-time)
//   demoSource       จำลองในหน่วยความจำ สำหรับคนที่ยังสร้าง Firebase ไม่ได้ (เปิดด้วย ?demo)
import {
  collection, query, where, orderBy, onSnapshot, getDocs, getDoc, doc, setDoc, serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { db, auth, googleProvider } from "./firebase.js";
import { selectLastDays, computeShift, toSaleDoc } from "../../scripts/seedTransform.mjs";
import { todayBangkok } from "./time.js";
import { buildDemoAnalytics } from "../lab4/demoAnalytics.js";

const ANALYTICS_DOCS = ["meta", "daily", "rfm", "cohort", "abc"];

export const firestoreSource = {
  mode: "firebase",
  onAuth: (cb) => onAuthStateChanged(auth, cb),
  signIn: () => signInWithPopup(auth, googleProvider),
  signOut: () => signOut(auth),

  async loadProducts() {
    const snap = await getDocs(collection(db, "products"));
    return snap.docs.map((d) => d.data()).sort((a, b) => a.product_id.localeCompare(b.product_id));
  },

  /** ฟังยอดขายช่วงวันที่ start–end · คืนฟังก์ชันเลิกฟัง (ต้องเรียกใน cleanup ของ useEffect) */
  subscribeSales({ start, end }, onData, onError) {
    const q = query(collection(db, "sales"), where("date", ">=", start), where("date", "<=", end), orderBy("date"));
    let first = true;
    return onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
      const changes = snap.docChanges();
      const added = first ? [] : changes.filter((c) => c.type === "added").map((c) => c.doc.id);
      if (changes.length) first = false;
      onData(
        snap.docs.map((d) => ({ id: d.id, ...d.data(), _pending: d.metadata.hasPendingWrites })),
        { received: snap.metadata.fromCache ? 0 : changes.length, added, fromCache: snap.metadata.fromCache }
      );
    }, onError);
  },

  addSale: ({ id, data }) => setDoc(doc(db, "sales", id), { ...data, created_at: serverTimestamp() }),

  /** Lab 4 · อ่านผลวิเคราะห์ที่ pipeline สร้างไว้ 5 เอกสาร (5 reads แทนยอดขายดิบหลายหมื่นเอกสาร) */
  async loadAnalytics() {
    const snaps = await Promise.all(ANALYTICS_DOCS.map((k) => getDoc(doc(db, "analytics", k))));
    if (!snaps[0].exists()) {
      const e = new Error("ยังไม่มีผลวิเคราะห์ใน Firestore รัน npm run analytics ก่อน");
      e.code = "not-built";
      throw e;
    }
    const out = { reads: snaps.length };
    snaps.forEach((s, i) => {
      out[ANALYTICS_DOCS[i]] = s.exists() ? s.data() : { error: `ไม่พบเอกสาร analytics/${ANALYTICS_DOCS[i]}` };
    });
    const built = out.meta.builtAt?.toDate?.();
    out.meta = { ...out.meta, builtAt: built ? built.toISOString() : null };
    return out;
  },
};

// ---------------- โหมดสาธิต ----------------
export function createDemoSource(csvRows, productRows, holidays = {}) {
  const { rows, end } = selectLastDays(csvRows, 90);
  const shift = computeShift(end, todayBangkok());
  const docs = new Map(rows.map((r) => toSaleDoc(r, shift)).map((d) => [d.id, d.data]));
  const listeners = new Set();
  const user = { uid: "demo-user", displayName: "ผู้ใช้สาธิต", email: "demo@example.com" };
  let authCb = null;
  let signedIn = true;

  const emitAll = (added = [], pendingId = null) => {
    for (const l of listeners) {
      const list = [...docs].filter(([, d]) => d.date >= l.start && d.date <= l.end)
        .map(([id, d]) => ({ id, ...d, _pending: id === pendingId }));
      l.onData(list, { received: added.length, added, fromCache: false });
    }
  };

  return {
    mode: "demo",
    onAuth: (cb) => { authCb = cb; cb(signedIn ? user : null); return () => { authCb = null; }; },
    signIn: async () => { signedIn = true; authCb?.(user); },
    signOut: async () => { signedIn = false; authCb?.(null); },
    loadAnalytics: async () => buildDemoAnalytics(csvRows, productRows, holidays),
    loadProducts: async () => productRows.map((p) => ({ ...p, price: Number(p.price), cost: Number(p.cost) })),
    subscribeSales({ start, end }, onData) {
      const l = { start, end, onData };
      listeners.add(l);
      const list = [...docs].filter(([, d]) => d.date >= start && d.date <= end).map(([id, d]) => ({ id, ...d, _pending: false }));
      setTimeout(() => onData(list, { received: list.length, added: [], fromCache: false }), 150);
      return () => listeners.delete(l);
    },
    addSale: ({ id, data }) => new Promise((resolve) => {
      docs.set(id, { ...data, created_at: new Date() });
      emitAll([id], id);                                   // แสดงทันทีแบบ "กำลังบันทึก"
      setTimeout(() => { emitAll([]); resolve(); }, 600);  // จำลองเซิร์ฟเวอร์ตอบกลับ
    }),
  };
}
