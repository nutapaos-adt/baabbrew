# Lab 3 · คู่มือทีละขั้น

คาบ 3 · เสาร์ 27 ก.ย. 2026 · 13.00–16.00

**สิ่งที่ต่อมาจาก Lab ก่อนหน้า**
- `public/sales.csv` คือ `sales_clean.csv` จาก Lab 2.1 (ถ้าใช้ของตัวเอง ให้วางทับไฟล์นี้)
- `src/lib/metrics.js` จาก Lab 1 ใช้คำนวณ KPI ในหน้าสดได้ทันที ไม่ต้องเขียนสูตรใหม่
- แท็บ “ภาพรวม” และ “Lab 2.2” ยังอยู่ครบ

**วิธีตรวจงานของ Lab นี้** เหมือน `check()` / `validate()` ใน Lab 2.1: มี test (`npm test`), สคริปต์ตรวจข้อมูล (`npm run verify-import`) และแท็บ “ทดสอบ Rules” ได้เขียวครบเมื่อไรคือเสร็จ

---

## Lab 3.1 · สร้าง Firebase project และนำข้อมูลเข้า (45 นาที)

### A. สร้างโปรเจกต์ (15 นาที)

1. เปิด https://console.firebase.google.com → **Create a project** ตั้งชื่อ `baanbrew-ชื่อเล่น` ปิด Google Analytics (ไม่จำเป็น)
2. เมนูซ้าย **Build → Firestore Database → Create database**
   - ถ้าถาม edition เลือก **Standard**
   - Location เลือก **asia-southeast1 (Singapore)** เปลี่ยนภายหลังไม่ได้
   - เลือก **Start in test mode** (เปิดให้ทุกคนเขียนได้ชั่วคราว เราจะปิดใน Lab 3.3)
3. ⚙️ **Project settings → General → Your apps** กดไอคอน `</>` เพิ่ม Web app ชื่อ `dashboard` (ยังไม่ต้องติ๊ก Hosting) แล้วคัดลอกค่าใน `firebaseConfig`
4. คัดลอก `.env.example` เป็น `.env` แล้วใส่ `apiKey`, `authDomain`, `projectId`, `appId`
5. ⚙️ **Project settings → Service accounts → Generate new private key** บันทึกไฟล์เป็น `secrets/service-account.json`

> ⚠️ ไฟล์ key มีสิทธิ์ทำทุกอย่างกับฐานข้อมูล ห้าม commit ห้ามส่งในแชต ห้ามวางใน AI · โฟลเดอร์ `secrets/` อยู่ใน `.gitignore` แล้ว และ `npm run seed` จะไม่ยอมทำงานถ้า key อยู่นอกโฟลเดอร์นี้

### B. เขียนตัวแปลงข้อมูลด้วย AI (15 นาที)

```bash
npm install
npm test
```
จะเห็น test ของ `seedTransform` ไม่ผ่าน ใช้ **Prompt 3.1** จนเขียวทั้งหมด (test ของ `saleModel` ยังแดงได้ ทำใน Lab 3.2)

### C. นำเข้าและตรวจ (15 นาที)

```bash
npm run seed:dry        # ดูผลก่อน ยังไม่เขียนจริง
npm run seed            # นำเข้า 90 วันล่าสุด (~9,700 เอกสาร)
npm run verify-import   # ตรวจว่าใน Firestore ตรงกับที่นำเข้า
npm run dev
```

อ่านผลของ `seed:dry` ให้เข้าใจก่อนรันจริง:
- **เลื่อนวันที่:** ข้อมูลเดิมจบที่ 20 ก.ย. สคริปต์เลื่อนวันที่ทั้งหมดให้วันล่าสุดกลายเป็น “เมื่อวาน” เพื่อให้หน้า “สด” มีข้อมูลเหมือนร้านที่เปิดอยู่จริง
- **จำนวนเอกสาร:** ใช้โควตาเขียนฟรีรายวันไปประมาณครึ่งหนึ่ง รันซ้ำได้ (document id เดิมจะเขียนทับ ไม่เกิดข้อมูลซ้ำ) แต่ใช้โควตาเพิ่มทุกครั้ง

✅ **จุดตรวจ 3.1:** `verify-import` ขึ้น 🎉 และแท็บ **สด · Firestore** แสดง “พบเมนู 40 รายการ”

---

## Lab 3.2 · Dashboard แบบ real-time + ฟอร์มบันทึกยอดขาย (50 นาที)

1. **Prompt 3.2A** → `npm test` ต้องเขียวทั้งหมด
2. **Prompt 3.2B** → แท็บสดกลายเป็น Dashboard แล้วทำขั้นตรวจท้าย prompt (เทียบกับ `seed:dry -- --days=29`)
3. **Prompt 3.2C** → ฟอร์มบันทึกยอดขาย
4. **ทดสอบ real-time:** เปิดเว็บ 2 หน้าต่างวางข้างกัน บันทึกยอดขายในหน้าหนึ่ง อีกหน้าต้องขยับเองโดยไม่ต้องรีเฟรช
   - ลองเปิดบนมือถือ: รัน `npm run dev -- --host` แล้วเปิด URL ที่ขึ้นว่า Network (มือถือกับโน้ตบุ๊กต้องอยู่ Wi-Fi เดียวกัน)

**คำถามชวนคิด**
- เลือก “7 วัน” แล้วดูกราฟรายวัน จุดสุดท้าย (วันนี้) ดิ่งลง แปลว่ายอดขายวันนี้แย่ไหม? นึกถึงกราฟ 4 ใน Lab 2.2
- ดูตัวนับ “อ่านเอกสารไปแล้ว” ตอนเปลี่ยนจาก 7 วันเป็น 30 วัน ถ้าพนักงาน 20 คนเปิดหน้านี้วันละ 10 ครั้ง จะเกินโควตาไหม
- ตอน `npm run dev` ตัวนับอาจขึ้นเป็น 2 เท่า เพราะ React StrictMode ตั้งใจเรียก useEffect ซ้ำเพื่อจับบั๊ก cleanup ถ้าไม่มี `return unsubscribe` จะเกิดอะไร

✅ **จุดตรวจ 3.2:** `npm test` เขียวทั้งหมด (24 ข้อ) · ยอดขาย 30 วันตรงกับ `seed:dry -- --days=29` · บันทึกแล้วอีกหน้าต่างขยับเอง

---

## Lab 3.3 · Login, Security Rules และขึ้นเว็บ (30 นาที)

### A. เปิดล็อกอินด้วย Google

1. Firebase console → **Build → Authentication → Get started → Sign-in method → Google → Enable** เลือกอีเมล support แล้ว Save
2. **Prompt 3.3A** → แท็บสดต้องให้ล็อกอินก่อน

### B. โจมตีฐานข้อมูลของตัวเอง (ก่อนมี rules)

เปิดแท็บ **ทดสอบ Rules** กดเริ่มทดสอบ ตอนนี้ยังเป็น test mode จะเห็น ❌ เกือบทุกข้อ แปลว่าใครก็ตามที่มี web config (ซึ่งอยู่ในหน้าเว็บให้ทุกคนเห็น) แก้ราคา ใส่ยอดขายติดลบ หรือปลอมตัวเป็นคนอื่นได้

### C. เขียนและ deploy Security Rules

1. **Prompt 3.3B** เขียน `firestore.rules`
2. Deploy (เลือก 1 วิธี)
   - **CLI:** 
     ```bash
     npx firebase-tools login
     npx firebase-tools use --add          # เลือกโปรเจกต์ ตั้ง alias ว่า default
     npx firebase-tools deploy --only firestore:rules
     ```
   - **Console:** Firestore Database → แท็บ Rules → วางเนื้อหา `firestore.rules` → Publish
3. กลับไปแท็บทดสอบ Rules กดทดสอบอีกครั้ง ต้องได้ ✅ ครบ 10 ข้อ
4. **บันทึกยอดขายจากฟอร์มต้องยังใช้ได้** (rules ที่ปิดทุกอย่างก็ได้ ✅ ครบ แต่ใช้งานไม่ได้ ถือว่ายังไม่ผ่าน)
5. ออกจากระบบ แล้วทดสอบ Rules อีกรอบ (ชุดไม่ล็อกอิน 2 ข้อ) ต้องได้ ✅

### D. ขึ้นเว็บ

**Firebase Hosting** (แนะนำ ใช้โดเมนที่ Firebase อนุญาตให้ล็อกอินอยู่แล้ว)
```bash
npm run build
npx firebase-tools deploy --only hosting
```
เปิด URL ที่ได้ (`https://ชื่อโปรเจกต์.web.app`) ล็อกอิน แล้วลองบันทึกยอดขาย

**Vercel** (ทางเลือก) import repo จาก GitHub ใส่ค่า `VITE_FIREBASE_*` ใน Settings → Environment Variables แล้วเพิ่มโดเมน `xxx.vercel.app` ใน Firebase **Authentication → Settings → Authorized domains** ไม่งั้นจะล็อกอินไม่ได้

### E. คำถามด้านความปลอดภัย (ลองเอง)

เปิด `https://ชื่อโปรเจกต์.web.app/sales.csv` โดย **ไม่ล็อกอิน** ได้ไฟล์อะไร?
ล็อกอินป้องกันแค่ข้อมูลใน Firestore ไม่ได้ป้องกันไฟล์ใน `public/` ที่ถูก deploy ไปด้วย ในงานจริงข้อมูลแบบนี้ห้ามอยู่ใน `public/` (ในคอร์สนี้ใช้ได้เพราะเป็นข้อมูลสมมติ)

✅ **จุดตรวจ 3.3:** ทดสอบ Rules ✅ ครบทั้งสองชุด · ฟอร์มยังบันทึกได้ · เปิดเว็บจริงจากมือถือและล็อกอินได้

---

## แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุและวิธีแก้ |
|---|---|
| แท็บสดขึ้น “ยังไม่ได้เชื่อม Firebase” ทั้งที่ใส่ .env แล้ว | หยุด `npm run dev` แล้วรันใหม่ Vite อ่าน .env ตอนเริ่มเท่านั้น |
| `npm run seed` บอก `--env-file` ไม่รู้จัก | Node.js เก่ากว่า 20.6 ให้อัปเดตเป็นรุ่น LTS |
| seed บอกพบวันที่ที่ยังไม่ได้ทำความสะอาด | `public/sales.csv` ยังเป็นไฟล์ดิบ ใช้ `sales_clean.csv` จาก Lab 2.1 |
| `auth/unauthorized-domain` | เพิ่มโดเมนเว็บใน Authentication → Settings → Authorized domains |
| `auth/operation-not-allowed` | ยังไม่ได้เปิด Google ใน Authentication → Sign-in method |
| ฟอร์มขึ้น “ถูกปฏิเสธโดย Security Rules” | ใช้ prompt แก้ปัญหาท้าย `PROMPTS_LAB3.md` เทียบเอกสารกับ rules ทีละข้อ |
| `resource-exhausted` / quota exceeded | ใช้โควตาฟรีวันนี้หมด รอรีเซ็ต (ตามเวลาแปซิฟิก) หรือเลือกช่วงวันที่สั้นลง |
| มือถือเปิดผ่าน `--host` (192.168.x.x) แล้วล็อกอินไม่ได้ | Firebase อนุญาตเฉพาะ localhost ตั้งแต่แรก ให้ทดสอบบนมือถือด้วย URL `.web.app` หลัง deploy แทน |
| `firebase-tools login` ไม่เปิดเบราว์เซอร์ | ใช้ `npx firebase-tools login --no-localhost` แล้วทำตามลิงก์ |
