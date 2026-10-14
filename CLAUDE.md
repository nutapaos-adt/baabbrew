# บ้านบรู Dashboard · กติกาของโปรเจกต์

Claude Code อ่านไฟล์นี้อัตโนมัติทุกครั้งที่เริ่ม session

## ภาษาและวิธีทำงาน
- ตอบและเขียน comment เป็นภาษาไทย ชื่อตัวแปรเป็นภาษาอังกฤษ
- ก่อนแก้ไฟล์มากกว่า 1 ไฟล์ ให้สรุปแผนสั้น ๆ ก่อน
- เขียนโค้ดเสร็จแล้วรัน `npm test` และรายงานผลทุกครั้ง

## ห้ามทำ
- ห้ามแก้ไฟล์ `*.test.js` / `*.test.mjs` เพื่อให้ test ผ่าน ถ้าคิดว่า test ผิด ให้อธิบายและหยุดรอ
- ห้ามอ่าน แสดง หรือ commit ไฟล์ใน `secrets/` และ `.env`
- ห้าม `git push --force` และห้าม commit ตรงเข้า `main` ให้ทำงานบน branch แล้วเปิด Pull Request

## โครงสร้างที่ต้องใช้ซ้ำ ไม่เขียนใหม่
- สูตร KPI: `src/lib/metrics.js` (prepareRows, computeKpis, …)
- วันที่และเวลาไทย: `src/lab3/time.js` (todayBangkok, addDays, daysBetween) ห้ามใช้ `new Date().toISOString()` กับวันที่ไทย
- ฟังก์ชันวิเคราะห์: `src/lib/analytics/` ต้องเป็น pure function ไม่เรียก Firestore เอง
- หน้าเว็บอ่านผลวิเคราะห์จาก collection `analytics` เท่านั้น ห้ามอ่านยอดขายดิบทั้งหมดจาก `sales` (โควตาอ่านฟรี 50,000 ครั้ง/วัน)

## คำสั่ง
- `npm run dev` · `npm test` · `npm run build`
- `npm run analytics:dry` คำนวณผลวิเคราะห์โดยไม่เขียน · `npm run analytics` เขียนลง Firestore
- เปิดโหมดสาธิต (ไม่ต้องมี Firebase): `http://localhost:5173/?demo`
