export function LoginCard({ onSignIn, error }) {
  return (
    <div className="mx-auto max-w-md rounded-xl bg-white p-8 text-center ring-1 ring-stone-200">
      <h2 className="text-xl font-semibold">ต้องเข้าสู่ระบบก่อน</h2>
      <p className="mt-2 text-stone-600">ข้อมูลยอดขายสดเปิดให้เฉพาะพนักงานที่ล็อกอินแล้ว</p>
      <button onClick={onSignIn} className="mt-5 rounded-lg bg-stone-900 px-5 py-2.5 font-medium text-white hover:bg-stone-700">
        เข้าสู่ระบบด้วย Google
      </button>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}

export function UserChip({ user, onSignOut }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {user.photoURL && <img src={user.photoURL} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />}
      <span className="text-stone-700">{user.displayName ?? user.email}</span>
      <button onClick={onSignOut} className="rounded-md px-2 py-1 text-stone-500 hover:bg-stone-200">ออกจากระบบ</button>
    </div>
  );
}

export function authErrorText(e) {
  const code = e?.code ?? "";
  if (code === "auth/popup-closed-by-user") return "ปิดหน้าต่างล็อกอินก่อนเสร็จ ลองใหม่อีกครั้ง";
  if (code === "auth/unauthorized-domain") return "โดเมนนี้ยังไม่ได้รับอนุญาต เพิ่มใน Authentication → Settings → Authorized domains";
  if (code === "auth/operation-not-allowed") return "ยังไม่ได้เปิด Google sign-in ใน Authentication → Sign-in method";
  if (code === "auth/popup-blocked") return "เบราว์เซอร์บล็อก popup อนุญาต popup สำหรับเว็บนี้แล้วลองใหม่";
  return e?.message ?? String(e);
}
