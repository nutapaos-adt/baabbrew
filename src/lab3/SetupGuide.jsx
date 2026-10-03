export default function SetupGuide() {
  return (
    <div className="max-w-2xl rounded-xl bg-white p-6 ring-1 ring-stone-200">
      <h1 className="text-2xl font-bold">ยังไม่ได้เชื่อม Firebase</h1>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-stone-700">
        <li>ทำ Lab 3.1 ตาม <code className="rounded bg-stone-100 px-1">LAB3_GUIDE.md</code> ให้เสร็จ</li>
        <li>คัดลอก <code className="rounded bg-stone-100 px-1">.env.example</code> เป็น <code className="rounded bg-stone-100 px-1">.env</code> แล้วใส่ค่า web config</li>
        <li>หยุด <code className="rounded bg-stone-100 px-1">npm run dev</code> ด้วย Ctrl+C แล้วรันใหม่ (Vite อ่าน .env ตอนเริ่มเท่านั้น)</li>
      </ol>
      <p className="mt-5 text-sm text-stone-500">
        สร้าง Firebase project ไม่ได้ (เช่น บัญชีองค์กรถูกจำกัด)? แจ้งผู้สอนเพื่อรับ checkpoint ที่มีโหมดสาธิต
        ซึ่งใช้ทำ Lab 3.2 ได้โดยไม่ต้องมี Firebase
      </p>
    </div>
  );
}
