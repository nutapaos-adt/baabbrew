// รวม logic การคำนวณทั้งหมดของ Dashboard บ้านบรู
// ทุกฟังก์ชันรับ "rows" ที่ผ่าน prepareRows() แล้ว

// แปลงค่าจาก CSV เป็นตัวเลข รองรับค่าที่มีจุลภาค เช่น "1,250"
// ค่าว่างหรืออ่านไม่ได้จะกลายเป็น 0 เพื่อไม่ให้ยอดรวมกลายเป็น NaN
export function toNumber(value) {
  if (value === null || value === undefined) return 0
  const n = Number(String(value).replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : 0
}

// ดึงวันที่ (YYYY-MM-DD) จาก datetime เช่น "2025-04-01T18:48:40+07:00" → "2025-04-01"
// ใช้การตัดสตริงแทน new Date() เพราะค่าในไฟล์เป็นเวลาไทยอยู่แล้ว
// ถ้าแปลงผ่าน Date เบราว์เซอร์ที่ตั้งเขตเวลาอื่นอาจเลื่อนบิลช่วงดึกไปเป็นอีกวัน
export function toDateKey(datetime) {
  const match = String(datetime ?? '').trim().match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}

// ทำความสะอาดข้อมูลดิบจาก PapaParse ครั้งเดียว แล้วคำนวณยอดขายต่อแถว
// ยอดขายต่อแถว = qty × unit_price
// แถวที่ไม่มี order_id หรือวันที่อ่านไม่ได้จะถูกตัดทิ้ง
export function prepareRows(rawRows) {
  return rawRows
    .map((r) => {
      const qty = toNumber(r.qty)
      const unitPrice = toNumber(r.unit_price)
      return {
        orderId: String(r.order_id ?? '').trim(),
        date: toDateKey(r.datetime),
        branch: String(r.branch ?? '').trim() || 'ไม่ระบุสาขา',
        customerId: String(r.customer_id ?? '').trim(),
        amount: qty * unitPrice,
      }
    })
    .filter((r) => r.orderId && r.date)
}

// KPI ทั้ง 4 ตัว คำนวณพร้อมกันในการวนข้อมูลรอบเดียว
// - ยอดขายรวม = ผลรวม amount ทุกแถว
// - จำนวนบิล = จำนวน order_id ที่ไม่ซ้ำ (บิลเดียวมีหลายแถว)
// - ยอดเฉลี่ยต่อบิล = ยอดขายรวม ÷ จำนวนบิล
// - ลูกค้าสมาชิก = จำนวน customer_id ที่ไม่ซ้ำ ไม่นับค่าว่าง (ลูกค้าทั่วไป)
export function computeKpis(rows) {
  const orderIds = new Set()
  const memberIds = new Set()
  let total = 0

  for (const row of rows) {
    total += row.amount
    orderIds.add(row.orderId)
    if (row.customerId !== '') {
      memberIds.add(row.customerId)
    }
  }

  const orders = orderIds.size
  return {
    totalSales: total,
    orders,
    avgOrderValue: orders === 0 ? 0 : total / orders,
    members: memberIds.size,
  }
}

// บวกวันให้ date key แบบ UTC เพื่อไม่ให้เขตเวลาของเครื่องมีผล
function addDays(dateKey, days) {
  const d = new Date(`${dateKey}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ยอดขายรายวัน: รวม amount ตามวันที่ เรียงจากเก่าไปใหม่
// วันที่ไม่มียอดขายในช่วงข้อมูลจะเติมเป็น 0 เพื่อให้กราฟเส้นไม่ลากข้ามวันที่หายไป
export function dailySales(rows) {
  const byDate = new Map()
  for (const r of rows) {
    byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.amount)
  }
  if (byDate.size === 0) return []

  const dates = [...byDate.keys()].sort()
  const last = dates[dates.length - 1]
  const result = []
  for (let d = dates[0]; d <= last; d = addDays(d, 1)) {
    result.push({ date: d, sales: byDate.get(d) ?? 0 })
  }
  return result
}

// ค่าเฉลี่ยเคลื่อนที่ย้อนหลัง (trailing moving average)
// แต่ละวัน = ค่าเฉลี่ยยอดขายของวันนั้นกับ (window - 1) วันก่อนหน้า
// ใช้ผลรวมแบบเลื่อนหน้าต่าง: บวกวันใหม่เข้า ลบวันที่หลุดออก จึงไม่ต้องบวกใหม่ทุกวัน
// วันแรก ๆ ที่ข้อมูลยังไม่ครบหน้าต่างจะเป็น null (กราฟจะไม่วาดช่วงนั้น)
export function withMovingAverage(daily, window = 7, key = 'ma7') {
  let sum = 0
  return daily.map((day, i) => {
    sum += day.sales
    if (i >= window) sum -= daily[i - window].sales
    return { ...day, [key]: i >= window - 1 ? sum / window : null }
  })
}

// ยอดขายแยกสาขา: รวม amount ตามสาขา เรียงจากมากไปน้อย
export function salesByBranch(rows) {
  const byBranch = new Map()
  for (const r of rows) {
    byBranch.set(r.branch, (byBranch.get(r.branch) ?? 0) + r.amount)
  }
  return [...byBranch.entries()]
    .map(([branch, sales]) => ({ branch, sales }))
    .sort((a, b) => b.sales - a.sales)
}

// ช่วงวันที่ของข้อมูล ใช้แสดงบนหัว Dashboard
export function dateRange(rows) {
  if (rows.length === 0) return null
  const dates = rows.map((r) => r.date).sort()
  return { from: dates[0], to: dates[dates.length - 1] }
}

// คำนวณทุกอย่างที่ Dashboard ต้องใช้ในครั้งเดียว
export function buildDashboard(rawRows) {
  const rows = prepareRows(rawRows)
  return {
    rowCount: rows.length,
    range: dateRange(rows),
    kpis: computeKpis(rows),
    daily: withMovingAverage(dailySales(rows), 7),
    branches: salesByBranch(rows),
  }
}

// ---------- การจัดรูปแบบตัวเลขและวันที่ ----------

// เงินบาท มีจุลภาค เช่น 12345.6 → "฿12,346" (หรือกำหนดทศนิยมได้)
export function formatBaht(value, decimals = 0) {
  return `฿${value.toLocaleString('th-TH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

// จำนวนนับ มีจุลภาค เช่น 1234 → "1,234"
export function formatCount(value) {
  return value.toLocaleString('th-TH')
}

// วันที่ภาษาไทย เช่น "2025-04-01" → "1 เม.ย." หรือ "1 เม.ย. 2568"
export function formatThaiDate(dateKey, withYear = false) {
  const d = new Date(`${dateKey}T00:00:00Z`)
  return d.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    ...(withYear && { year: 'numeric' }),
    timeZone: 'UTC',
  })
}

// วันที่ภาษาไทยแบบย่อพร้อมปี พ.ศ. 2 หลัก เช่น "2025-04-01" → "1 เม.ย. 68"
export function formatThaiDateShort(dateKey) {
  const d = new Date(`${dateKey}T00:00:00Z`)
  return d.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  })
}
