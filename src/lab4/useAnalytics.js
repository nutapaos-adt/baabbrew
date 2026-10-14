import { useEffect, useState } from "react";

/** สถานะล็อกอิน + โหลดผลวิเคราะห์ครั้งเดียว (ไม่ใช้ onSnapshot เพราะข้อมูลเปลี่ยนวันละครั้ง) */
export function useAnalytics(source) {
  const [user, setUser] = useState(undefined);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => source.onAuth(setUser), [source]);
  useEffect(() => {
    if (!user) return;
    setError(null);
    source.loadAnalytics().then(setData).catch((e) => setError(
      e.code === "permission-denied"
        ? "อ่านผลวิเคราะห์ไม่ได้: Security Rules ยังไม่เปิดให้อ่าน collection analytics (ดู Lab 4.2 ขั้น rules)"
        : e.message
    ));
  }, [source, user]);
  return { user, data, error };
}
