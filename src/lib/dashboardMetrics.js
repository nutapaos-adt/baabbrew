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
        channel: String(r.channel ?? '').trim() || 'ไม่ระบุ',
        payment: String(r.payment_method ?? '').trim() || 'ไม่ระบุ',
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
export function addDays(dateKey, days) {
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

// ---------- ตัวกรอง ----------

// ตัวเลือกของตัวกรองแต่ละตัว ดึงจากข้อมูลจริง
// สาขาเรียงตามยอดขายจากมากไปน้อย ช่องทางและวิธีชำระเงินเรียงตามตัวอักษร
export function getFilterOptions(rows) {
  const channels = new Set()
  const payments = new Set()
  let minDate = null
  let maxDate = null
  for (const r of rows) {
    channels.add(r.channel)
    payments.add(r.payment)
    if (minDate === null || r.date < minDate) minDate = r.date
    if (maxDate === null || r.date > maxDate) maxDate = r.date
  }
  const byThai = (a, b) => a.localeCompare(b, 'th')
  return {
    branches: salesByBranch(rows).map((b) => b.branch),
    channels: [...channels].sort(byThai),
    payments: [...payments].sort(byThai),
    minDate,
    maxDate,
  }
}

// ค่าเริ่มต้นของตัวกรอง: ทุกวันที่ ทุกสาขา ทุกช่องทาง ทุกวิธีชำระเงิน
// branches เป็น array ว่าง = ไม่กรอง (เลือกทุกสาขา)
export function defaultFilters(options) {
  return {
    from: options.minDate,
    to: options.maxDate,
    branches: [],
    channel: 'all',
    payment: 'all',
  }
}

// ช่วงวันที่สำเร็จรูป นับย้อนจาก "วันสุดท้ายของข้อมูล" ไม่ใช่วันนี้
// เพราะข้อมูลอาจจบก่อนวันปัจจุบัน ถ้านับจากวันนี้ 30 วันล่าสุดอาจไม่มีข้อมูลเลย
export const DATE_PRESETS = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: '30d', label: '30 วันล่าสุด' },
  { id: '90d', label: '90 วันล่าสุด' },
  { id: 'ytd', label: 'ปีล่าสุด' },
]

export function presetRange(presetId, options) {
  const { minDate, maxDate } = options
  const clamp = (d) => (d < minDate ? minDate : d)
  switch (presetId) {
    case '30d':
      return { from: clamp(addDays(maxDate, -29)), to: maxDate }
    case '90d':
      return { from: clamp(addDays(maxDate, -89)), to: maxDate }
    case 'ytd':
      // ตั้งแต่ 1 ม.ค. ของปีที่ข้อมูลจบ ถึงวันสุดท้าย
      return { from: clamp(`${maxDate.slice(0, 4)}-01-01`), to: maxDate }
    default:
      return { from: minDate, to: maxDate }
  }
}

// ตรวจว่าช่วงวันที่ปัจจุบันตรงกับ preset ไหน (ใช้ไฮไลต์ปุ่ม)
export function activePreset(filters, options) {
  const match = DATE_PRESETS.find(({ id }) => {
    const r = presetRange(id, options)
    return r.from === filters.from && r.to === filters.to
  })
  return match ? match.id : null
}

// แถวนี้ผ่านตัวกรองที่ไม่เกี่ยวกับวันที่ (สาขา ช่องทาง วิธีชำระเงิน) หรือไม่
function matchesNonDate(row, f) {
  if (f.branches.length > 0 && !f.branches.includes(row.branch)) return false
  if (f.channel !== 'all' && row.channel !== f.channel) return false
  if (f.payment !== 'all' && row.payment !== f.payment) return false
  return true
}

// นับว่าใช้ตัวกรองอยู่กี่ตัว (ใช้แสดงบนปุ่มล้างตัวกรอง)
export function countActiveFilters(f, options) {
  let n = 0
  if (f.from !== options.minDate || f.to !== options.maxDate) n++
  if (f.branches.length > 0) n++
  if (f.channel !== 'all') n++
  if (f.payment !== 'all') n++
  return n
}

// คำนวณทุกอย่างที่ Dashboard ต้องใช้ ตามตัวกรองที่เลือก
// เส้นเฉลี่ย 7 วันคำนวณจากข้อมูล "ก่อนตัดช่วงวันที่" แล้วค่อยตัดทีหลัง
// ทำให้วันแรกของช่วงที่เลือกมีค่าเฉลี่ยทันที โดยใช้ 6 วันก่อนหน้าที่อยู่นอกช่วง
export function buildDashboard(rows, filters) {
  const base = rows.filter((r) => matchesNonDate(r, filters))
  const selected = base.filter(
    (r) => r.date >= filters.from && r.date <= filters.to
  )
  const daily = withMovingAverage(dailySales(base), 7).filter(
    (d) => d.date >= filters.from && d.date <= filters.to
  )
  return {
    rowCount: selected.length,
    kpis: computeKpis(selected),
    daily,
    branches: salesByBranch(selected),
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
