# Prompt สำหรับ Lab 3

ทุก prompt ใช้ในโปรเจกต์นี้ (Cursor, Claude Code หรือคัดลอกไปใช้กับ AI อื่นพร้อมแนบไฟล์ที่เกี่ยวข้อง)
หลักเดิมจาก Lab 1–2 ยังใช้อยู่: **ห้ามแก้ไฟล์ test** และตรวจผลเองทุกครั้ง

---

## Prompt 3.1 · ตัวแปลงข้อมูลสำหรับนำเข้า

```
ในไฟล์ scripts/seedTransform.mjs มีฟังก์ชันที่ยังว่าง 5 ตัว:
selectLastDays, computeShift, shiftDateTime, toSaleDoc, summarize
สิ่งที่แต่ละฟังก์ชันต้องทำอยู่ใน comment เหนือฟังก์ชัน และมี test ใน scripts/seedTransform.test.mjs

ช่วยเขียนให้ผ่าน test ทุกข้อ
- ห้ามแก้ไฟล์ test
- คำนวณวันที่ด้วย addDays และ daysBetween จาก src/lab3/time.js
  ห้ามใช้ new Date(...).toISOString() กับวันที่ไทย เพราะจะกลายเป็นเวลา UTC
- อธิบายสั้น ๆ ว่าทำไม customer_id ว่างต้องเป็น null
  และทำไม document id ต้องเป็น order_id-product_id
```

ตรวจ: `npm test` ส่วน seedTransform ต้องเขียวทั้งหมด แล้วรัน `npm run seed:dry`

---

## Prompt 3.2A · ตรรกะของฟอร์ม

```
ในไฟล์ src/lab3/saleModel.js มีฟังก์ชันที่ยังว่าง 3 ตัว: validateSaleForm, makeOrderId, buildSale
สิ่งที่ต้องทำอยู่ใน comment และมี test ใน src/lab3/saleModel.test.js
ช่วยเขียนให้ผ่าน test ทุกข้อ ห้ามแก้ไฟล์ test
ใช้ nowBangkokISO จาก ./time.js สำหรับเวลาไทย
```

---

## Prompt 3.2B · Dashboard แบบ real-time

```
แทนที่ src/lab3/LiveTab.jsx ด้วย Dashboard ยอดขายแบบ real-time จาก Firestore
- ใช้ db จาก ./firebase.js
- ฟัง collection "sales" ด้วย onSnapshot: where("date", ">=", start), where("date", "<=", end), orderBy("date")
  และต้อง return ฟังก์ชัน unsubscribe ใน cleanup ของ useEffect
- ปุ่มช่วงเวลา วันนี้ / 7 วัน / 30 วัน (ค่าเริ่มต้น 7 วัน)
  คำนวณวันที่ด้วย todayBangkok และ addDays จาก ./time.js
- ตัวเลือกสาขา กรองฝั่งเบราว์เซอร์ (ไม่ต้องเพิ่ม where)
- ใช้ prepareRows, computeKpis, dailyRevenue, revenueByBranch จาก ../lib/metrics.js
  และ KpiCard จาก ../components/KpiCard.jsx ห้ามเขียนสูตรคำนวณใหม่
- ช่วง "วันนี้" แสดงกราฟแท่งรายชั่วโมง ช่วงอื่นแสดงกราฟเส้นรายวัน
- ตาราง "รายการล่าสุด" 8 รายการ เรียงตาม datetime ล่าสุดก่อน
  ไฮไลต์แถวที่เพิ่งเข้ามาใหม่ 4 วินาที (docChanges() ที่ type = "added" หลัง snapshot แรก)
- แสดงจำนวนเอกสารที่อ่านไปแล้ว (รวม docChanges().length ของทุก snapshot)
- แสดงข้อความภาษาไทยเมื่อ error เช่น permission-denied
```

ตรวจ (ทำ **ก่อน** บันทึกยอดขายจากฟอร์ม): เลือก **30 วัน** แล้วเทียบยอดขายรวมและยอดแยกสาขากับผลของ
`npm run seed:dry -- --days=29` ต้องตรงกันทุกบาท (ใช้ 29 วัน เพราะวันนี้ยังไม่มีข้อมูลที่นำเข้า ข้อมูลนำเข้าจบที่เมื่อวาน)
ถ้าไม่ตรง ส่งตัวเลขทั้งสองฝั่งให้ AI แล้วขอให้หาสาเหตุก่อนแก้

---

## Prompt 3.2C · ฟอร์มบันทึกยอดขาย

```
สร้าง src/lab3/SaleForm.jsx ฟอร์มบันทึกยอดขาย แล้ววางไว้คอลัมน์ขวาของ LiveTab
- โหลดเมนูจาก collection "products" ด้วย getDocs ครั้งเดียว ส่งเป็น props
- ช่อง: สาขา, เมนู (แสดงราคา), จำนวน, วิธีชำระเงิน, รหัสสมาชิก (ไม่บังคับ)
- ตรวจด้วย validateSaleForm และสร้างเอกสารด้วย buildSale จาก ./saleModel.js
  แสดง error ใต้แต่ละช่อง
- บันทึกด้วย setDoc(doc(db, "sales", id), { ...data, created_at: serverTimestamp() })
- uid ตอนนี้ใช้ "anonymous" ไปก่อน (Lab 3.3 จะเปลี่ยนเป็นผู้ใช้ที่ล็อกอิน)
- แสดงยอดรวมก่อนกดบันทึก, ปุ่มกดไม่ได้ระหว่างบันทึก, ข้อความสำเร็จหรือผิดพลาด
- ถ้า error.code เป็น permission-denied ให้แสดง "ถูกปฏิเสธโดย Security Rules"
```

---

## Prompt 3.3A · ล็อกอินด้วย Google

```
เพิ่มการล็อกอินด้วย Google ให้แท็บสด (LiveTab)
- ใช้ auth และ googleProvider จาก ./firebase.js กับ onAuthStateChanged, signInWithPopup, signOut
- ระหว่างตรวจสถานะให้แสดง "กำลังตรวจสอบการเข้าสู่ระบบ…"
- ถ้ายังไม่ล็อกอิน แสดงการ์ดปุ่ม "เข้าสู่ระบบด้วย Google" แทน Dashboard และห้ามเริ่ม onSnapshot
- แสดงรูป ชื่อผู้ใช้ และปุ่มออกจากระบบมุมขวาบน
- ส่ง user.uid ให้ SaleForm แทน "anonymous"
- แปล error ที่พบบ่อยเป็นภาษาไทย: auth/unauthorized-domain, auth/operation-not-allowed,
  auth/popup-blocked, auth/popup-closed-by-user
```

---

## Prompt 3.3B · Security Rules

```
เขียน firestore.rules ใหม่ทั้งไฟล์ (rules_version = '2') ตามเงื่อนไขนี้
- products และ branches: อ่านได้เมื่อล็อกอิน เขียนไม่ได้
- sales: อ่านได้เมื่อล็อกอิน แก้ไขและลบไม่ได้
- sales สร้างได้เมื่อล็อกอิน และข้อมูลต้องตรงกับที่ buildSale() ใน src/lab3/saleModel.js สร้าง
  บวก created_at:
  * ฟิลด์ครบและไม่มีฟิลด์เกิน (hasAll / hasOnly)
  * source == "web" และ created_by == request.auth.uid
  * created_at == request.time
  * branch อยู่ใน 5 สาขา, payment_method อยู่ใน 5 แบบ
  * qty เป็น int 1–20, hour เป็น int 0–23
  * unit_price ตรงกับ price ใน products/{product_id} (ใช้ get())
  * revenue == qty * unit_price
  * date เป็น YYYY-MM-DD, datetime เป็น YYYY-MM-DDTHH:MM:SS+07:00
  * customer_id เป็น null หรือ C ตามด้วยเลข 5 หลัก
อธิบายแต่ละเงื่อนไขเป็นภาษาไทยใน comment
```

**ถ้าแท็บทดสอบ Rules ยังมี ❌** คัดลอกชื่อข้อที่ไม่ผ่านไปให้ AI:
```
แท็บทดสอบ Rules รายงานว่าการโจมตี "[ชื่อข้อ]" ยังผ่านได้ (rules ที่ควรกันไว้: [คอลัมน์กลาง])
ดู firestore.rules แล้วบอกว่าเงื่อนไขไหนหายไปหรือผิด ก่อนแก้
```

**ถ้าฟอร์มบันทึกไม่ได้หลัง deploy rules** (permission-denied):
```
ฟอร์มบันทึกยอดขายถูกปฏิเสธโดย Security Rules
นี่คือเอกสารที่ buildSale() สร้าง: [วางผลจาก console.log(sale.data)]
ช่วยเทียบกับ firestore.rules ทีละเงื่อนไขว่าข้อไหนไม่ผ่าน
```
