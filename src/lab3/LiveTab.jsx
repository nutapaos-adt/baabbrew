// Lab 3.2 · Dashboard ยอดขายแบบ real-time จาก Firestore (Prompt 3.2B)
// ฟัง collection "sales" ด้วย onSnapshot ข้อมูลใหม่จะขึ้นเองโดยไม่ต้องรีเฟรช
// สูตรคำนวณทั้งหมดใช้จาก ../lib/metrics.js ตัวเดียวกับหน้า CSV ไม่เขียนสูตรใหม่
// Lab 3.3: ต้องล็อกอินด้วย Google ก่อน จึงจะเริ่มฟังข้อมูล (Prompt 3.3A)
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, query, where, orderBy, onSnapshot, getDocs } from "firebase/firestore";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
} from "recharts";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { db, auth, googleProvider } from "./firebase.js";
import { todayBangkok, addDays } from "./time.js";
import { BRANCHES } from "./saleModel.js";
import {
  prepareRows, computeKpis, dailyRevenue, revenueByBranch, fmtBaht, fmtBaht2, fmtNum,
} from "../lib/metrics.js";
import KpiCard from "../components/KpiCard.jsx";
import SaleForm from "./SaleForm.jsx";

const MAIN = "#7a4a2e";
const GRID = "#e7e5e4";
const tick = { fill: "#57534e", fontSize: 12 };
const HIGHLIGHT_MS = 4000;
const RECENT_COUNT = 8;

const RANGES = [
  { id: "today", label: "วันนี้", days: 1 },
  { id: "7d", label: "7 วัน", days: 7 },
  { id: "30d", label: "30 วัน", days: 30 },
];

/** ช่วงวันที่ตามเวลาไทย: N วันรวมวันนี้ */
function rangeDates(rangeId) {
  const today = todayBangkok();
  const days = RANGES.find((r) => r.id === rangeId).days;
  return { start: addDays(today, -(days - 1)), end: today };
}

/** แปล error ของ Firestore เป็นภาษาไทย */
function thaiError(err) {
  switch (err?.code) {
    case "permission-denied":
      return "ไม่มีสิทธิ์อ่านข้อมูลยอดขาย (ถูกปฏิเสธโดย Security Rules) ตรวจว่าล็อกอินแล้ว หรือ rules อนุญาตให้อ่าน";
    case "failed-precondition":
      return "คำค้นนี้ต้องใช้ดัชนี (index) ที่ยังไม่ได้สร้าง ดูลิงก์สร้างดัชนีใน Console ของเบราว์เซอร์ (F12)";
    case "unavailable":
      return "เชื่อมต่อ Firestore ไม่ได้ ตรวจอินเทอร์เน็ต ระบบจะลองเชื่อมต่อใหม่เอง";
    case "resource-exhausted":
      return "ใช้โควตาฟรีของวันนี้หมดแล้ว รอรีเซ็ต หรือเลือกช่วงวันที่สั้นลง";
    case "unauthenticated":
      return "ยังไม่ได้เข้าสู่ระบบ";
    default:
      return `เกิดข้อผิดพลาด: ${err?.message ?? String(err)}`;
  }
}

const thaiShortDate = (ymd) =>
  new Date(ymd + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short" });

/* ------------------------------------------------------------------ */
/** ฟังยอดขายในช่วงวันที่แบบ real-time พร้อมนับเอกสารที่อ่านและจำเอกสารใหม่ */
function useLiveSales(start, end) {
  const [state, setState] = useState({ status: "loading", docs: [], error: null });
  const [newIds, setNewIds] = useState(() => new Set());
  const [reads, setReads] = useState(0);

  useEffect(() => {
    setState({ status: "loading", docs: [], error: null });
    let isFirst = true; // snapshot แรกคือข้อมูลเดิมทั้งหมด ไม่นับเป็น "เพิ่งเข้ามา"
    const timers = [];

    const q = query(
      collection(db, "sales"),
      where("date", ">=", start),
      where("date", "<=", end),
      orderBy("date")
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const changes = snap.docChanges();
        // จำนวนเอกสารที่ Firestore ส่งมาในรอบนี้ = จำนวนที่ถูกคิดโควตาอ่าน
        setReads((n) => n + changes.length);

        if (!isFirst) {
          const added = changes.filter((c) => c.type === "added").map((c) => c.doc.id);
          if (added.length > 0) {
            setNewIds((prev) => new Set([...prev, ...added]));
            timers.push(setTimeout(() => {
              setNewIds((prev) => {
                const next = new Set(prev);
                added.forEach((id) => next.delete(id));
                return next;
              });
            }, HIGHLIGHT_MS));
          }
        }
        isFirst = false;

        setState({
          status: "ready",
          docs: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
          error: null,
        });
      },
      (err) => setState({ status: "error", docs: [], error: thaiError(err) })
    );

    // สำคัญ: เลิกฟังเมื่อเปลี่ยนช่วงวันที่หรือออกจากหน้า ไม่งั้น listener ค้างและอ่านเอกสารซ้ำ
    return () => {
      unsubscribe();
      timers.forEach(clearTimeout);
    };
  }, [start, end]);

  return { ...state, newIds, reads };
}

/** โหลดเมนูครั้งเดียว (getDocs) ใช้ทั้งในฟอร์มและแสดงชื่อเมนูในตาราง */
function useProducts() {
  const [state, setState] = useState({ products: null, error: null });
  useEffect(() => {
    let active = true;
    getDocs(collection(db, "products"))
      .then((snap) => {
        if (!active) return;
        const products = snap.docs.map((d) => d.data())
          .sort((a, b) => a.product_id.localeCompare(b.product_id));
        setState({ products, error: null });
      })
      .catch((err) => active && setState({ products: [], error: `โหลดเมนูไม่ได้ · ${thaiError(err)}` }));
    return () => { active = false; };
  }, []);
  return state;
}

/* ------------------------------------------------------------------ */
function Segmented({ value, onChange }) {
  return (
    <div className="inline-flex rounded-lg bg-white p-1 ring-1 ring-stone-200">
      {RANGES.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onChange(r.id)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === r.id ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

function Panel({ title, note, children, className = "" }) {
  return (
    <section className={`min-w-0 rounded-xl bg-white p-5 ring-1 ring-stone-200 ${className}`}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {note && <span className="text-xs text-stone-500">{note}</span>}
      </div>
      {children}
    </section>
  );
}

/** กราฟแท่งรายชั่วโมง (ช่วง "วันนี้") */
function HourlyChart({ rows }) {
  const data = useMemo(() => {
    const byHour = new Map();
    for (const r of rows) byHour.set(r.hour, (byHour.get(r.hour) ?? 0) + r.revenue);
    const hours = [...byHour.keys()];
    // แสดงตั้งแต่ชั่วโมงแรกถึงชั่วโมงล่าสุดที่มีขาย ช่องที่ไม่มีขายเป็น 0 จะได้เห็นช่วงเงียบ
    const from = hours.length ? Math.min(...hours) : 7;
    const to = hours.length ? Math.max(...hours) : 20;
    return Array.from({ length: to - from + 1 }, (_, i) => ({
      hour: from + i, revenue: byHour.get(from + i) ?? 0,
    }));
  }, [rows]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="hour" tickFormatter={(h) => `${String(h).padStart(2, "0")}:00`}
               tick={tick} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tickFormatter={fmtBaht} tick={tick} tickLine={false} axisLine={false} width={72} />
        <Tooltip formatter={(v) => [fmtBaht(v), "ยอดขาย"]}
                 labelFormatter={(h) => `${String(h).padStart(2, "0")}:00–${String(h).padStart(2, "0")}:59 น.`} />
        <Bar dataKey="revenue" fill={MAIN} radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** กราฟเส้นรายวัน (ช่วง 7 / 30 วัน) */
function DailyChart({ rows, start, end }) {
  const data = useMemo(() => {
    const byDate = new Map(dailyRevenue(rows).map((d) => [d.date, d.revenue]));
    // เติมทุกวันในช่วง วันที่ไม่มีขายเป็น 0 รวมถึงวันนี้ที่ยังขายไม่จบวัน
    const out = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push({ date: d, revenue: byDate.get(d) ?? 0 });
    return out;
  }, [rows, start, end]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={thaiShortDate} tick={tick} tickLine={false}
               axisLine={{ stroke: GRID }} minTickGap={24} />
        <YAxis tickFormatter={fmtBaht} tick={tick} tickLine={false} axisLine={false} width={72} />
        <Tooltip formatter={(v) => [fmtBaht(v), "ยอดขาย"]}
                 labelFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString("th-TH", { dateStyle: "medium" })} />
        <Line dataKey="revenue" stroke={MAIN} strokeWidth={2.5} dot={{ r: 3, fill: MAIN }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function BranchBars({ rows }) {
  const data = useMemo(() => revenueByBranch(rows), [rows]);
  if (data.length === 0) return <p className="text-sm text-stone-500">ยังไม่มียอดขาย</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 84, left: 0, bottom: 0 }}>
        <XAxis type="number" hide domain={[0, "dataMax"]} />
        <YAxis type="category" dataKey="branch" width={90} tick={tick} tickLine={false} axisLine={false} />
        <Tooltip formatter={(v) => [fmtBaht(v), "ยอดขาย"]} cursor={{ fill: "#f5f5f4" }} />
        <Bar dataKey="revenue" fill={MAIN} radius={[0, 3, 3, 0]} barSize={22} isAnimationActive={false}>
          <LabelList dataKey="revenue" position="right" formatter={fmtBaht} style={{ fill: "#44403c", fontSize: 12 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function RecentTable({ docs, newIds, productNames }) {
  const recent = useMemo(
    () => [...docs].sort((a, b) => b.datetime.localeCompare(a.datetime)).slice(0, RECENT_COUNT),
    [docs]
  );
  if (recent.length === 0) return <p className="text-sm text-stone-500">ยังไม่มีรายการในช่วงนี้</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-left text-stone-500">
            <th className="py-2 pr-3 font-medium">เวลา</th>
            <th className="py-2 pr-3 font-medium">สาขา</th>
            <th className="py-2 pr-3 font-medium">เมนู</th>
            <th className="py-2 pr-3 text-right font-medium">จำนวน</th>
            <th className="py-2 pr-3 text-right font-medium">ยอด</th>
            <th className="py-2 font-medium">ชำระ</th>
          </tr>
        </thead>
        <tbody>
          {recent.map((d) => (
            <tr key={d.id}
                className={`border-b border-stone-100 transition-colors duration-700 ${newIds.has(d.id) ? "bg-amber-100" : ""}`}>
              <td className="py-2 pr-3 tabular-nums">
                {thaiShortDate(d.date)} {d.datetime.slice(11, 16)}
                {newIds.has(d.id) && <span className="ml-2 rounded bg-amber-500 px-1.5 text-xs text-white">ใหม่</span>}
              </td>
              <td className="py-2 pr-3">{d.branch}</td>
              <td className="py-2 pr-3">{productNames[d.product_id] ?? d.product_id}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{fmtNum(d.qty)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{fmtBaht(d.revenue)}</td>
              <td className="py-2">{d.payment_method}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function LiveDashboard({ user }) {
  const [range, setRange] = useState("7d");
  const [branch, setBranch] = useState("all");
  const { start, end } = useMemo(() => rangeDates(range), [range]);
  const live = useLiveSales(start, end);
  const { products, error: productsError } = useProducts();
  const productNames = useMemo(
    () => Object.fromEntries((products ?? []).map((p) => [p.product_id, p.product_name])),
    [products]
  );

  // กรองสาขาฝั่งเบราว์เซอร์ ไม่เพิ่ม where จะได้ไม่ต้องสร้างดัชนีเพิ่มและไม่อ่านซ้ำเมื่อสลับสาขา
  const docs = useMemo(
    () => (branch === "all" ? live.docs : live.docs.filter((d) => d.branch === branch)),
    [live.docs, branch]
  );
  const rows = useMemo(() => prepareRows(docs), [docs]);
  const kpis = useMemo(() => computeKpis(rows), [rows]);

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
            ยอดขายสด
            <span className="relative flex h-2.5 w-2.5" title="อัปเดตอัตโนมัติ">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
          </h1>
          <p className="text-sm text-stone-500">
            {start === end ? thaiShortDate(start) : `${thaiShortDate(start)} – ${thaiShortDate(end)}`} · อัปเดตเองเมื่อมีรายการใหม่
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <UserChip user={user} />
          <p className="text-xs text-stone-500" title="รวมจำนวนเอกสารที่ Firestore ส่งมาทุกครั้ง (นับเป็นโควตาอ่าน)">
            อ่านเอกสารไปแล้ว <span className="font-semibold tabular-nums text-stone-800">{fmtNum(live.reads)}</span> ครั้ง
          </p>
        </div>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <Segmented value={range} onChange={setRange} />
            <select value={branch} onChange={(e) => setBranch(e.target.value)}
                    className="rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-stone-200">
              <option value="all">ทุกสาขา</option>
              {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {live.status === "error" && (
            <div className="mb-5 rounded-xl bg-red-50 p-4 text-red-800 ring-1 ring-red-200">{live.error}</div>
          )}
          {live.status === "loading" && <p className="mb-5 text-stone-500">กำลังโหลดยอดขาย…</p>}

          {live.status === "ready" && (
            <>
              <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                <KpiCard label="ยอดขายรวม" value={fmtBaht(kpis.revenue)} />
                <KpiCard label="จำนวนบิล" value={fmtNum(kpis.bills)} />
                <KpiCard label="ยอดเฉลี่ยต่อบิล" value={fmtBaht2(kpis.avgPerBill)} />
                <KpiCard label="ลูกค้าสมาชิก" value={fmtNum(kpis.customers)} note="ไม่นับลูกค้า walk-in" />
              </section>

              <div className="mt-5 grid gap-5">
                <Panel title={range === "today" ? "ยอดขายรายชั่วโมง" : "ยอดขายรายวัน"}
                       note={range === "today" ? "วันนี้ยังไม่จบ ชั่วโมงหลังจากนี้ยังไม่มีข้อมูล" : "วันนี้ยังไม่จบวัน ยอดจึงต่ำกว่าวันอื่น"}>
                  <div className="h-72">
                    {range === "today"
                      ? <HourlyChart rows={rows} />
                      : <DailyChart rows={rows} start={start} end={end} />}
                  </div>
                </Panel>
                <Panel title="ยอดขายแยกสาขา">
                  <BranchBars rows={rows} />
                </Panel>
              </div>

              <Panel title="รายการล่าสุด" note={`${RECENT_COUNT} รายการ เรียงจากล่าสุด`} className="mt-5">
                <RecentTable docs={docs} newIds={live.newIds} productNames={productNames} />
              </Panel>
            </>
          )}
        </div>

        {/* คอลัมน์ขวา: ฟอร์มบันทึกยอดขาย (ติดหน้าจอเมื่อเลื่อน) */}
        <div className="lg:sticky lg:top-4">
          <SaleForm products={products} productsError={productsError} uid={user.uid} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lab 3.3A · ล็อกอินด้วย Google                                       */

/** แปล error ของ Firebase Auth ที่พบบ่อยเป็นภาษาไทย */
function thaiAuthError(err) {
  switch (err?.code) {
    case "auth/unauthorized-domain":
      return "โดเมนนี้ยังไม่ได้รับอนุญาต เพิ่มโดเมนใน Firebase → Authentication → Settings → Authorized domains";
    case "auth/operation-not-allowed":
      return "ยังไม่ได้เปิดการล็อกอินด้วย Google ใน Firebase → Authentication → Sign-in method";
    case "auth/popup-blocked":
      return "เบราว์เซอร์บล็อกหน้าต่างล็อกอิน อนุญาตป๊อปอัปสำหรับเว็บนี้แล้วลองใหม่";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "ปิดหน้าต่างล็อกอินก่อนเสร็จ ลองกดเข้าสู่ระบบอีกครั้ง";
    case "auth/network-request-failed":
      return "เชื่อมต่ออินเทอร์เน็ตไม่ได้ ลองใหม่อีกครั้ง";
    default:
      return `เข้าสู่ระบบไม่สำเร็จ: ${err?.message ?? String(err)}`;
  }
}

/** รูป ชื่อ และปุ่มออกจากระบบ (มุมขวาบน) */
function UserChip({ user }) {
  const name = user.displayName ?? user.email ?? "ผู้ใช้";
  return (
    <div className="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 ring-1 ring-stone-200">
      {user.photoURL ? (
        <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-7 w-7 rounded-full" />
      ) : (
        <span className="grid h-7 w-7 place-items-center rounded-full bg-stone-200 text-xs font-semibold">
          {name.slice(0, 1)}
        </span>
      )}
      <span className="max-w-[10rem] truncate text-sm font-medium">{name}</span>
      <button type="button" onClick={() => signOut(auth)}
              className="ml-1 text-xs text-stone-500 underline-offset-2 hover:text-stone-900 hover:underline">
        ออกจากระบบ
      </button>
    </div>
  );
}

function SignInCard() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSignIn() {
    setBusy(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(thaiAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-6 max-w-md rounded-xl bg-white p-8 text-center ring-1 ring-stone-200">
      <h1 className="text-2xl font-bold">ยอดขายสด</h1>
      <p className="mt-2 text-sm text-stone-600">
        ข้อมูลยอดขายสำหรับพนักงานบ้านบรูเท่านั้น กรุณาเข้าสู่ระบบก่อน
      </p>
      <button type="button" onClick={handleSignIn} disabled={busy}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-60">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
          <path fill="#fff" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4z" />
          <path fill="#fff" opacity=".8" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" />
          <path fill="#fff" opacity=".6" d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9z" />
          <path fill="#fff" opacity=".9" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6z" />
        </svg>
        {busy ? "กำลังเปิดหน้าต่างล็อกอิน…" : "เข้าสู่ระบบด้วย Google"}
      </button>
      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-left text-sm text-red-700">{error}</p>}
    </div>
  );
}

/** ตรวจสถานะล็อกอินก่อน · ยังไม่ล็อกอิน = ไม่แสดง Dashboard และไม่เริ่ม onSnapshot */
export default function LiveTab() {
  // undefined = กำลังตรวจ, null = ยังไม่ล็อกอิน, object = ผู้ใช้ที่ล็อกอินแล้ว
  const [user, setUser] = useState(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  if (user === undefined) {
    return <p className="py-10 text-center text-stone-500">กำลังตรวจสอบการเข้าสู่ระบบ…</p>;
  }
  if (user === null) return <SignInCard />;
  // key ทำให้ Dashboard เริ่มใหม่ทั้งหมดเมื่อเปลี่ยนบัญชี
  return <LiveDashboard key={user.uid} user={user} />;
}
