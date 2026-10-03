// Lab 3.2 · Dashboard แบบ real-time (สร้างด้วย Prompt 3.2B และ 3.2C ใน PROMPTS_LAB3.md)
// ตอนนี้เป็นหน้าทดสอบการเชื่อมต่อจาก Lab 3.1 เท่านั้น
import { useEffect, useState } from "react";
import { collection, getCountFromServer } from "firebase/firestore";
import { db, projectId } from "./firebase.js";

export default function LiveTab() {
  const [state, setState] = useState({ status: "checking" });

  useEffect(() => {
    getCountFromServer(collection(db, "products"))
      .then((s) => setState({ status: "ok", count: s.data().count }))
      .catch((e) => setState({ status: "error", message: e.code === "permission-denied"
        ? "Security Rules ไม่อนุญาตให้อ่าน (ตอนนี้ควรเป็นโหมดทดสอบ)"
        : e.message }));
  }, []);

  return (
    <div className="max-w-2xl rounded-xl bg-white p-6 ring-1 ring-stone-200">
      <h1 className="text-2xl font-bold">ยอดขายสด · ยังไม่ได้สร้าง</h1>
      <p className="mt-3">
        {state.status === "checking" && "กำลังตรวจการเชื่อมต่อ…"}
        {state.status === "ok" && (state.count === 40
          ? `✅ เชื่อมต่อ Firestore โปรเจกต์ ${projectId} ได้ พบเมนู ${state.count} รายการ พร้อมทำ Lab 3.2`
          : `⚠️ เชื่อมต่อได้ แต่พบเมนู ${state.count} รายการ (ควรเป็น 40) รัน npm run seed แล้วหรือยัง`)}
        {state.status === "error" && <span className="text-red-700">❌ {state.message}</span>}
      </p>
      <p className="mt-4 text-sm text-stone-500">ขั้นต่อไป: ใช้ Prompt 3.2A–3.2C ใน PROMPTS_LAB3.md แทนที่ไฟล์นี้ด้วย Dashboard แบบ real-time</p>
    </div>
  );
}
