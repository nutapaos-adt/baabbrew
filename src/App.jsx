import { useEffect, useState } from 'react'
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
  buildDashboard,
  formatBaht,
  formatCount,
  formatThaiDate,
  formatThaiDateShort,
} from './lib/metrics'

const CSV_URL = `${import.meta.env.BASE_URL}sales.csv`

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

// โหลดและแปลงไฟล์ CSV จากโฟลเดอร์ public
async function loadSales() {
  const res = await fetch(CSV_URL)
  const text = await res.text()
  // ถ้าไม่มีไฟล์ Vite จะส่งหน้า index.html กลับมาแทน จึงต้องเช็กตรงนี้
  if (!res.ok || text.trimStart().startsWith('<')) {
    throw new Error('ไม่พบไฟล์ public/sales.csv ตรวจชื่อไฟล์และตำแหน่งอีกครั้ง')
  }
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })
  return buildDashboard(parsed.data)
}

function Kpi({ label, value, note }) {
  return (
    <div className="min-w-0 bg-white px-4 py-4 sm:px-6 sm:py-5">
      <p className="text-xs text-bean sm:text-sm">{label}</p>
      <p className="mt-1 truncate text-xl font-semibold tabular-nums tracking-tight sm:text-3xl">
        {value}
      </p>
      {note && <p className="mt-1 text-[11px] leading-snug text-roast/60 sm:text-xs">{note}</p>}
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

const axisTick = { fill: '#3b2418', fillOpacity: 0.65, fontSize: 12 }
const tooltipStyle = { borderRadius: 6, borderColor: '#d9d6cf' }

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
  return (
    <ResponsiveContainer width="100%" height={small ? 240 : 300}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#d9d6cf" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatThaiDateShort}
          tick={axisTick}
          tickLine={false}
          axisLine={{ stroke: '#d9d6cf' }}
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
          stroke="#7a4a2e"
          strokeOpacity={0.25}
          strokeWidth={1}
          dot={false}
          activeDot={{ r: 3, fill: '#7a4a2e', fillOpacity: 0.5, stroke: 'none' }}
          isAnimationActive={false}
        />
        {/* เส้นเฉลี่ย 7 วัน: หนาและเข้ม เป็นเส้นหลักที่ใช้อ่านแนวโน้ม */}
        <Line
          type="monotone"
          dataKey="ma7"
          stroke="#7a4a2e"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, fill: '#c98a45', stroke: '#7a4a2e' }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

function BranchChart({ data, small }) {
  // ความสูงเพิ่มตามจำนวนสาขา แท่งจะได้ไม่เบียดกัน
  const height = Math.max(200, data.length * 48)
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
          cursor={{ fill: '#f2f3ef' }}
          contentStyle={tooltipStyle}
        />
        <Bar dataKey="sales" fill="#c98a45" radius={[0, 4, 4, 0]} barSize={22}>
          <LabelList
            dataKey="sales"
            position="right"
            formatter={(v) => formatBaht(v)}
            style={{ fill: '#3b2418', fontSize: 12 }}
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

export default function App() {
  const [state, setState] = useState({ status: 'loading' })
  const small = useIsSmallScreen()

  useEffect(() => {
    loadSales()
      .then((data) => setState({ status: 'ready', data }))
      .catch((err) => setState({ status: 'error', message: err.message }))
  }, [])

  if (state.status === 'loading') {
    return <CenteredMessage title="กำลังโหลดข้อมูลยอดขาย…" />
  }
  if (state.status === 'error') {
    return <CenteredMessage title="โหลดข้อมูลไม่สำเร็จ" detail={state.message} />
  }

  const { kpis, daily, branches, range, rowCount } = state.data

  if (rowCount === 0) {
    return (
      <CenteredMessage
        title="ไฟล์ sales.csv ยังไม่มีข้อมูลที่ใช้ได้"
        detail="ตรวจว่าแถวแรกเป็นชื่อคอลัมน์ และแต่ละแถวมี order_id กับ datetime"
      />
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-8 lg:py-12">
      <header className="mb-6 flex sm:mb-8 flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">บ้านบรู</h1>
          <p className="mt-1 text-bean">สรุปยอดขาย</p>
        </div>
        {range && (
          <p className="text-sm text-roast/70">
            {formatThaiDate(range.from, true)} ถึง {formatThaiDate(range.to, true)}
            , {formatCount(branches.length)} สาขา
          </p>
        )}
      </header>

      {/* gap-px + พื้นสีเส้น ทำให้เกิดเส้นคั่นระหว่าง KPI ทุกขนาดจอ */}
      <section className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-rule bg-rule sm:mb-6 lg:grid-cols-4">
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
          <DailyChart data={daily} small={small} />
        </Panel>
        <Panel title="ยอดขายแยกสาขา">
          <BranchChart data={branches} small={small} />
        </Panel>
      </div>
    </main>
  )
}
