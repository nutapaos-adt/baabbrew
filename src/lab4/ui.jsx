import { LoginCard, UserChip, authErrorText } from "../lab3/AuthBar.jsx";
import { useState } from "react";

export const INK = "#44403c";
export const MUTED = "#a8a29e";
export const GREEN = ["#E6F2EC", "#BFDECD", "#8FC4A8", "#5BA582", "#2F7D5B", "#1F5A40"]; // ไล่สีเดียว อ่อน→เข้ม
export const MAIN = GREEN[4];
export const pct = (x, d = 0) => (x * 100).toFixed(d) + "%";
export const thaiDay = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
export const thaiMonth = (ym) => new Date(ym + "-01T00:00:00").toLocaleDateString("th-TH", { month: "short", year: "2-digit" });

export function Card({ title, sub, children, right }) {
  return (
    <section className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {sub && <p className="text-sm text-stone-500">{sub}</p>}
        </div>
        {right}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** แสดงแทนส่วนที่ยังคำนวณไม่ได้ เช่น ฟังก์ชันยังเป็น "ยังไม่ได้ทำ" */
export function Pending({ lab, error }) {
  return (
    <div className="rounded-lg border-2 border-dashed border-stone-300 p-6 text-center text-stone-500">
      <div className="font-medium">รอ {lab}</div>
      <div className="mt-1 text-sm">{error}</div>
    </div>
  );
}

export function Insight({ children }) {
  return <p className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-700">💡 {children}</p>;
}

/** ส่วนหัวร่วม: ล็อกอิน, ความสดของข้อมูล, จำนวนเอกสารที่อ่าน */
export function AnalyticsShell({ source, state, title, children }) {
  const { user, data, error } = state;
  const [authError, setAuthError] = useState(null);
  if (user === undefined) return <p className="text-stone-500">กำลังตรวจสอบการเข้าสู่ระบบ…</p>;
  if (!user) return <LoginCard onSignIn={() => source.signIn().catch((e) => setAuthError(authErrorText(e)))} error={authError} />;
  const m = data?.meta;
  return (
    <div>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "#6B3E26" }}>{title}</h1>
          {m && (
            <p className="mt-1 text-sm text-stone-500">
              ข้อมูลถึง {thaiDay(m.asOf)} · {m.rows?.toLocaleString()} รายการ ·{" "}
              {m.builtBy === "demo" ? <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">โหมดสาธิต คำนวณในเบราว์เซอร์</span>
                : <>อัปเดต {m.builtAt ? new Date(m.builtAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "–"} โดย {m.builtBy === "github-actions" ? "GitHub Actions" : "เครื่องผู้สอน/ผู้เรียน"} · อ่าน {data.reads} เอกสาร</>}
            </p>
          )}
        </div>
        <UserChip user={user} onSignOut={() => source.signOut()} />
      </header>
      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!data && !error && <p className="text-stone-500">กำลังโหลดผลวิเคราะห์…</p>}
      {data && children(data)}
    </div>
  );
}
