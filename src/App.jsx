import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from 'recharts'
import {
  prepareRows,
  getFilterOptions,
  defaultFilters,
  DATE_PRESETS,
  presetRange,
  activePreset,
  countActiveFilters,
  buildDashboard,
  formatBaht,
  formatCount,
  formatThaiDate,
  formatThaiDateShort,
} from './lib/dashboardMetrics'
// ฟังก์ชันของอาจารย์สำหรับ Lab 2.2 (rows มี revenue, date, hour)
import { prepareRows as prepareLabRows } from './lib/metrics.js'
import Lab2Page from './lab2/Lab2Page.jsx'
// Lab 3: Firestore แบบ real-time และทดสอบ Security Rules
import LiveTab from './lab3/LiveTab.jsx'
import RulesTester from './lab3/RulesTester.jsx'
import SetupGuide from './lab3/SetupGuide.jsx'
import { isConfigured } from './lab3/firebase.js'

const CSV_URL = `${import.meta.env.BASE_URL}sales.csv`

const PRODUCTS_URL = `${import.meta.env.BASE_URL}products.csv`

const parseCsv = (text) =>
  Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() }).data

// โหลด sales.csv (จำเป็น) และ products.csv (ไม่บังคับ ใช้แสดงชื่อเมนูใน Lab 2.2)
async function loadSales() {
  const res = await fetch(CSV_URL)
  const text = await res.text()
  // ถ้าไม่มีไฟล์ Vite จะส่งหน้า index.html กลับมาแทน จึงต้องเช็กตรงนี้
  if (!res.ok || text.trimStart().startsWith('<')) {
    throw new Error('ไม่พบไฟล์ public/sales.csv ตรวจชื่อไฟล์และตำแหน่งอีกครั้ง')
  }
  const raw = parseCsv(text)

  let products = []
  try {
    const pRes = await fetch(PRODUCTS_URL)
    const pText = await pRes.text()
    if (pRes.ok && !pText.trimStart().startsWith('<')) products = parseCsv(pText)
  } catch {
    // ไม่มี products.csv ก็ยังใช้งานได้ กราฟจะแสดงรหัสสินค้าแทนชื่อ
  }

  return {
    rows: prepareRows(raw), // สำหรับ Dashboard
    labRows: prepareLabRows(raw), // สำหรับ Lab 2.2 ตามรูปแบบของอาจารย์
    products,
  }
}

// ใช้ปรับขนาดกราฟตามความกว้างจอ (Recharts ใช้คลาส Tailwind ตรง ๆ ไม่ได้)
function useIsSmallScreen(query = '(max-width: 639px)') {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  )
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e) => setMatches(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

// ---------- ตัวกรอง ----------

function FieldLabel({ children }) {
  return <p className="mb-1.5 text-xs font-medium text-bean">{children}</p>
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
        active
          ? 'border-roast bg-roast text-white'
          : 'border-rule bg-white text-roast hover:border-bean'
      }`}
    >
      {children}
    </button>
  )
}

function Select({ value, onChange, options, allLabel }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-rule bg-white px-3 py-1.5 text-sm focus:border-bean focus:outline-none"
    >
      <option value="all">{allLabel}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}

const dateInputClass =
  'min-w-0 flex-1 rounded-md border border-rule bg-white px-2 py-1.5 text-sm focus:border-bean focus:outline-none'

function FilterBar({ filters, setFilters, options }) {
  const [open, setOpen] = useState(false)
  const active = countActiveFilters(filters, options)
  const preset = activePreset(filters, options)
  const update = (patch) => setFilters((f) => ({ ...f, ...patch }))

  // เลือก/ยกเลิกสาขาทีละสาขา ถ้ายกเลิกจนไม่เหลือ = กลับไปทุกสาขา
  const toggleBranch = (b) =>
    setFilters((f) => ({
      ...f,
      branches: f.branches.includes(b)
        ? f.branches.filter((x) => x !== b)
        : [...f.branches, b],
    }))

  // กันไม่ให้วันเริ่มอยู่หลังวันสิ้นสุด
  const setFrom = (from) =>
    from && update({ from, to: from > filters.to ? from : filters.to })
  const setTo = (to) =>
    to && update({ to, from: to < filters.from ? to : filters.from })

  return (
    <section className="mb-4 rounded-lg border border-rule bg-white p-4 sm:mb-6 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-base font-semibold sm:pointer-events-none"
          aria-expanded={open}
        >
          ตัวกรอง
          {active > 0 && (
            <span className="rounded-full bg-crema px-2 text-xs font-medium text-white">
              {active}
            </span>
          )}
          <span className="text-sm text-bean sm:hidden">{open ? '▲' : '▼'}</span>
        </button>
        {active > 0 && (
          <button
            type="button"
            onClick={() => setFilters(defaultFilters(options))}
            className="text-sm text-bean underline-offset-2 hover:underline"
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>

      <div className={`${open ? 'grid' : 'hidden'} mt-4 gap-5 sm:grid lg:grid-cols-12`}>
        <div className="lg:col-span-5">
          <FieldLabel>ช่วงวันที่</FieldLabel>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {DATE_PRESETS.map((p) => (
              <Chip
                key={p.id}
                active={preset === p.id}
                onClick={() => update(presetRange(p.id, options))}
              >
                {p.label}
              </Chip>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              aria-label="วันที่เริ่ม"
              value={filters.from}
              min={options.minDate}
              max={options.maxDate}
              onChange={(e) => setFrom(e.target.value)}
              className={dateInputClass}
            />
            <span className="text-sm text-roast/60">ถึง</span>
            <input
              type="date"
              aria-label="วันที่สิ้นสุด"
              value={filters.to}
              min={options.minDate}
              max={options.maxDate}
              onChange={(e) => setTo(e.target.value)}
              className={dateInputClass}
            />
          </div>
        </div>

        <div className="lg:col-span-4">
          <FieldLabel>สาขา</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            <Chip
              active={filters.branches.length === 0}
              onClick={() => update({ branches: [] })}
            >
              ทุกสาขา
            </Chip>
            {options.branches.map((b) => (
              <Chip
                key={b}
                active={filters.branches.includes(b)}
                onClick={() => toggleBranch(b)}
              >
                {b}
              </Chip>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:col-span-3 lg:grid-cols-1">
          <div>
            <FieldLabel>ช่องทางขาย</FieldLabel>
            <Select
              value={filters.channel}
              onChange={(channel) => update({ channel })}
              options={options.channels}
              allLabel="ทุกช่องทาง"
            />
          </div>
          <div>
            <FieldLabel>วิธีชำระเงิน</FieldLabel>
            <Select
              value={filters.payment}
              onChange={(payment) => update({ payment })}
              options={options.payments}
              allLabel="ทุกวิธี"
            />
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------- KPI และกราฟ ----------

function Kpi({ label, value, note }) {
  return (
    <div className="min-w-0 bg-white px-4 py-4 sm:px-6 sm:py-5">
      <p className="text-xs text-bean sm:text-sm">{label}</p>
      <p className="mt-1 truncate text-xl font-semibold tabular-nums tracking-tight sm:text-3xl">
        {value}
      </p>
      {note && (
        <p className="mt-1 text-[11px] leading-snug text-roast/60 sm:text-xs">
          {note}
        </p>
      )}
    </div>
  )
}

function Panel({ title, aside, children, className = '' }) {
  return (
    <section
      className={`min-w-0 rounded-lg border border-rule bg-white p-4 sm:p-6 ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

function EmptyChart({ height }) {
  return (
    <div
      className="grid place-items-center rounded-md bg-paper text-sm text-roast/60"
      style={{ height }}
    >
      ไม่มีข้อมูลตามตัวกรองที่เลือก
    </div>
  )
}

const axisTick = { fill: '#2a1b14', fillOpacity: 0.65, fontSize: 12 }
const tooltipStyle = { borderRadius: 6, borderColor: '#e4d6c2' }
const SERIES_NAMES = { sales: 'ยอดขายรายวัน', ma7: 'เฉลี่ย 7 วัน' }

// คำอธิบายเส้นแบบง่าย ใช้แทน Legend ของ Recharts เพื่อจัดวางให้เข้ากับหัวกราฟ
function DailyLegend() {
  return (
    <div className="flex gap-4 text-xs text-roast/70">
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 rounded bg-bean/30" />
        {SERIES_NAMES.sales}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-[3px] w-4 rounded bg-bean" />
        {SERIES_NAMES.ma7}
      </span>
    </div>
  )
}

function DailyChart({ data, small }) {
  const height = small ? 240 : 300
  if (data.length === 0) return <EmptyChart height={height} />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#e4d6c2" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatThaiDateShort}
          tick={axisTick}
          tickLine={false}
          axisLine={{ stroke: '#e4d6c2' }}
          minTickGap={small ? 24 : 40}
        />
        <YAxis
          tickFormatter={(v) => formatBaht(v)}
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          width={small ? 64 : 80}
        />
        <Tooltip
          formatter={(v, key) => [
            v == null ? 'ยังไม่ครบ 7 วัน' : formatBaht(v),
            SERIES_NAMES[key],
          ]}
          labelFormatter={(d) => formatThaiDate(d, true)}
          contentStyle={tooltipStyle}
        />
        {/* เส้นรายวัน: บางและจาง เป็นพื้นหลังให้เห็นความผันผวน */}
        <Line
          type="linear"
          dataKey="sales"
          stroke="#6b3f26"
          strokeOpacity={0.25}
          strokeWidth={1}
          dot={data.length <= 31 ? { r: 2, fill: '#6b3f26', fillOpacity: 0.3, stroke: 'none' } : false}
          activeDot={{ r: 3, fill: '#6b3f26', fillOpacity: 0.5, stroke: 'none' }}
          isAnimationActive={false}
        />
        {/* เส้นเฉลี่ย 7 วัน: หนาและเข้ม เป็นเส้นหลักที่ใช้อ่านแนวโน้ม */}
        <Line
          type="monotone"
          dataKey="ma7"
          stroke="#6b3f26"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, fill: '#c8873a', stroke: '#6b3f26' }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function BranchChart({ data, small }) {
  // ความสูงเพิ่มตามจำนวนสาขา แท่งจะได้ไม่เบียดกัน
  const height = Math.max(200, data.length * 48)
  if (data.length === 0) return <EmptyChart height={200} />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: small ? 70 : 76, left: 0, bottom: 0 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="branch"
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          width={small ? 80 : 96}
        />
        <Tooltip
          formatter={(v) => [formatBaht(v), 'ยอดขาย']}
          cursor={{ fill: '#f4eadc' }}
          contentStyle={tooltipStyle}
        />
        <Bar dataKey="sales" fill="#c8873a" radius={[0, 4, 4, 0]} barSize={22}>
          <LabelList
            dataKey="sales"
            position="right"
            formatter={(v) => formatBaht(v)}
            style={{ fill: '#2a1b14', fontSize: 12 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function CenteredMessage({ title, detail }) {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="max-w-md rounded-lg border border-rule bg-white p-6 text-center">
        <p className="font-semibold">{title}</p>
        {detail && <p className="mt-2 text-sm text-roast/70">{detail}</p>}
      </div>
    </main>
  )
}

// ---------- หน้าหลัก ----------

function Dashboard({ rows }) {
  const small = useIsSmallScreen()
  const options = useMemo(() => getFilterOptions(rows), [rows])
  const [filters, setFilters] = useState(() => defaultFilters(options))
  // คำนวณใหม่เฉพาะเมื่อตัวกรองเปลี่ยน
  const { kpis, daily, branches, rowCount } = useMemo(
    () => buildDashboard(rows, filters),
    [rows, filters]
  )

  return (
    <main className="mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-8 lg:py-12">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-2 sm:mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl">สรุปยอดขาย</h1>
          <p className="mt-1 text-bean">ทุกสาขาของบ้านบรู จากข้อมูลที่ทำความสะอาดแล้ว</p>
        </div>
        <p className="text-sm text-roast/70">
          {formatThaiDate(filters.from, true)} ถึง {formatThaiDate(filters.to, true)}
          , {formatCount(filters.branches.length || options.branches.length)} สาขา
        </p>
      </header>

      <FilterBar filters={filters} setFilters={setFilters} options={options} />

      {/* gap-px + พื้นสีเส้น ทำให้เกิดเส้นคั่นระหว่าง KPI ทุกขนาดจอ */}
      <section
        className={`mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-rule bg-rule sm:mb-6 lg:grid-cols-4 ${
          rowCount === 0 ? 'opacity-60' : ''
        }`}
      >
        <Kpi label="ยอดขายรวม" value={formatBaht(kpis.totalSales)} />
        <Kpi label="จำนวนบิล" value={formatCount(kpis.orders)} />
        <Kpi label="ยอดเฉลี่ยต่อบิล" value={formatBaht(kpis.avgOrderValue, 2)} />
        <Kpi
          label="ลูกค้าสมาชิก"
          value={formatCount(kpis.members)}
          note="นับเฉพาะรหัสสมาชิกที่ไม่ซ้ำ"
        />
      </section>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <Panel title="ยอดขายรายวัน" aside={<DailyLegend />} className="lg:col-span-2">
          <DailyChart data={rowCount === 0 ? [] : daily} small={small} />
        </Panel>
        <Panel title="ยอดขายแยกสาขา">
          <BranchChart data={branches} small={small} />
        </Panel>
      </div>
    </main>
  )
}

// แท็บทั้งหมด เลือกจาก hash ใน URL เช่น #lab2, #live
const PAGES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'lab2', label: 'Lab 2.2' },
  { id: 'live', label: 'สด · Firestore' },
  { id: 'rules', label: 'ทดสอบ Rules' },
]

function useHashPage() {
  const read = () =>
    PAGES.find((p) => '#' + p.id === window.location.hash)?.id ?? 'dashboard'
  const [page, setPage] = useState(read)
  useEffect(() => {
    const onHash = () => setPage(read())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return page
}

/** โลโก้เมล็ดกาแฟ */
function BeanMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="h-8 w-8 shrink-0">
      <circle cx="16" cy="16" r="16" fill="#c8873a" />
      <ellipse cx="16" cy="16" rx="7.2" ry="10" transform="rotate(28 16 16)" fill="#2a1b14" />
      <path d="M12.6 8.6c3.2 2.4 3.6 5 2.2 7.6s-1.2 5.2 2.4 7.4" fill="none" stroke="#c8873a"
            strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/** แถบเมนูด้านบน สีเอสเปรสโซ เหมือนป้ายเมนูหน้าร้าน */
function NavTabs({ page }) {
  return (
    <div className="sticky top-0 z-20 bg-espresso text-foam shadow-[0_1px_0_rgba(0,0,0,0.25)]">
      <nav className="mx-auto flex max-w-6xl items-center gap-4 px-3 py-2.5 sm:px-6">
        <a href="#" className="flex shrink-0 items-center gap-2.5 rounded-full pr-2">
          <BeanMark />
          <span className="font-display text-xl leading-none">บ้านบรู</span>
        </a>
        <div className="-mr-3 flex min-w-0 gap-1 overflow-x-auto pr-3 sm:mr-0 sm:pr-0">
          {PAGES.map((p) => (
            <a
              key={p.id}
              href={p.id === 'dashboard' ? '#' : '#' + p.id}
              aria-current={page === p.id ? 'page' : undefined}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                page === p.id
                  ? 'bg-crema text-espresso'
                  : 'text-foam/75 hover:bg-white/10 hover:text-foam'
              }`}
            >
              {p.label}
            </a>
          ))}
        </div>
      </nav>
    </div>
  )
}

export default function App() {
  const [state, setState] = useState({ status: 'loading' })
  const page = useHashPage()

  useEffect(() => {
    loadSales()
      .then((data) => setState({ status: 'ready', ...data }))
      .catch((err) => setState({ status: 'error', message: err.message }))
  }, [])

  if (state.status === 'loading') {
    return <CenteredMessage title="กำลังโหลดข้อมูลยอดขาย…" />
  }
  if (state.status === 'error') {
    return <CenteredMessage title="โหลดข้อมูลไม่สำเร็จ" detail={state.message} />
  }
  if (state.rows.length === 0) {
    return (
      <CenteredMessage
        title="ไฟล์ sales.csv ยังไม่มีข้อมูลที่ใช้ได้"
        detail="ตรวจว่าแถวแรกเป็นชื่อคอลัมน์ และแต่ละแถวมี order_id กับ datetime"
      />
    )
  }

  return (
    <>
      <NavTabs page={page} />
      {page === 'dashboard' && <Dashboard rows={state.rows} />}
      {page !== 'dashboard' && (
        <main className="mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-8">
          {page === 'lab2' && <Lab2Page rows={state.labRows} products={state.products} />}
          {/* ยังไม่ได้ตั้งค่า .env จะแสดงวิธีเชื่อม Firebase แทน */}
          {page === 'live' && (isConfigured ? <LiveTab /> : <SetupGuide />)}
          {page === 'rules' && (isConfigured ? <RulesTester /> : <SetupGuide />)}
        </main>
      )}
    </>
  )
}
