// Lab 2.2 · กราฟที่ซ่อมแล้ว
// แต่ละกราฟรับ props { rows, products } เหมือน BadChart เลขเดียวกัน
// ใช้สีหลักสีเดียว (MAIN) ถ้าต้องแยกความหมาย ใช้สีเดียวกันแต่อ่อนลง แทนการเพิ่มสีใหม่
import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
} from "recharts";
import {
  revenueByProduct, monthlyRevenue, daysInMonth, branchPerformance, thaiMonth,
} from "./lab2Metrics.js";
import { dailyRevenue, withMovingAverage, fmtBaht, fmtNum } from "../lib/metrics.js";

const MAIN = "#6b3f26";
const GRID = "#e4d6c2";
const tick = { fill: "#6f533c", fontSize: 12 };
const tooltipStyle = { borderRadius: 8, borderColor: GRID, fontSize: 13 };

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const shortName = (s, max = 18) => (s.length > max ? s.slice(0, max - 1) + "…" : s);

/** โครงร่วม: ข้อความสรุป 1 บรรทัดด้านบน แล้วกราฟเต็มพื้นที่ที่เหลือ */
function ChartFrame({ summary, children }) {
  return (
    <div className="flex h-full flex-col">
      <p className="mb-2 text-sm font-medium leading-snug text-stone-800">{summary}</p>
      {children && (
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/** กราฟ 1: เมนูไหนทำเงินมากที่สุด → แท่งแนวนอนเรียงมากไปน้อย 10 อันดับแรก */
export function FixedChart1({ rows, products }) {
  const all = useMemo(() => revenueByProduct(rows, products), [rows, products]);
  const top = all.slice(0, 10);
  if (top.length === 0) return <ChartFrame summary="ไม่มีข้อมูล" />;

  const topShare = top.reduce((s, d) => s + d.share, 0);
  const summary =
    `${top[0].name} ทำเงินสูงสุด ${fmtBaht(top[0].revenue)} (${pct(top[0].share)})` +
    ` · ${top.length} อันดับแรกรวม ${pct(topShare)} จาก ${fmtNum(all.length)} เมนู`;

  return (
    <ChartFrame summary={summary}>
      <BarChart data={top} layout="vertical" margin={{ top: 0, right: 72, left: 0, bottom: 0 }}>
        <XAxis type="number" hide domain={[0, "dataMax"]} />
        <YAxis type="category" dataKey="name" width={136} tick={tick} tickLine={false}
               axisLine={false} interval={0} tickFormatter={(s) => shortName(s)} />
        <Tooltip cursor={{ fill: "#f4eadc" }} contentStyle={tooltipStyle}
                 formatter={(v, _k, item) => [`${fmtBaht(v)} (${pct(item.payload.share)})`, "ยอดขาย"]} />
        <Bar dataKey="revenue" fill={MAIN} radius={[0, 3, 3, 0]} isAnimationActive={false}>
          <LabelList dataKey="revenue" position="right" formatter={fmtBaht}
                     style={{ fill: "#3e2d21", fontSize: 11 }} />
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------ */
/** กราฟ 2: สาขาขายต่างกันแค่ไหน → แกนเริ่มที่ 0 เรียงมากไปน้อย สีเดียว */
export function FixedChart2({ rows }) {
  const data = useMemo(
    () => branchPerformance(rows).sort((a, b) => b.revenue - a.revenue),
    [rows]
  );
  if (data.length === 0) return <ChartFrame summary="ไม่มีข้อมูล" />;

  const hi = data[0];
  const lo = data[data.length - 1];
  const summary =
    `${hi.branch} ขายได้สูงสุด ${fmtBaht(hi.revenue)} เป็น ${(hi.revenue / lo.revenue).toFixed(1)} เท่า` +
    `ของ${lo.branch} (${fmtBaht(lo.revenue)}) ซึ่งต่ำสุด`;

  return (
    <ChartFrame summary={summary}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 90, left: 0, bottom: 0 }}>
        {/* แกนตัวเลขเริ่มที่ 0 เสมอ ความยาวแท่งจึงเป็นสัดส่วนกับยอดจริง */}
        <XAxis type="number" hide domain={[0, "dataMax"]} />
        <YAxis type="category" dataKey="branch" width={96} tick={tick} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: "#f4eadc" }} contentStyle={tooltipStyle}
                 formatter={(v) => [fmtBaht(v), "ยอดขาย"]} />
        <Bar dataKey="revenue" fill={MAIN} radius={[0, 3, 3, 0]} barSize={28} isAnimationActive={false}>
          <LabelList dataKey="revenue" position="right" formatter={fmtBaht}
                     style={{ fill: "#3e2d21", fontSize: 12 }} />
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------ */
/** กราฟ 3: ยอดขายโตขึ้นหรือลดลง → เส้นเฉลี่ย 30 วันเป็นเส้นหลัก เส้นรายวันจางเป็นพื้นหลัง */
const TREND_WINDOW = 30;
const COMPARE_DAYS = 90;

export function FixedChart3({ rows }) {
  const data = useMemo(
    () => withMovingAverage(dailyRevenue(rows), "revenue", TREND_WINDOW),
    [rows]
  );

  // ป้ายแกน X: วันแรกของทุกไตรมาส (ม.ค. เม.ย. ก.ค. ต.ค.) ที่มีในข้อมูล จะได้ไม่เบียด
  const ticks = useMemo(() => {
    const seen = new Set();
    return data
      .map((d) => d.date)
      .filter((date) => {
        const ym = date.slice(0, 7);
        const month = Number(date.slice(5, 7));
        if (seen.has(ym) || (month - 1) % 3 !== 0) return false;
        seen.add(ym);
        return true;
      });
  }, [data]);

  if (data.length === 0) return <ChartFrame summary="ไม่มีข้อมูล" />;

  // เทียบยอดเฉลี่ยต่อวันช่วงแรกกับช่วงล่าสุด (ถ้าข้อมูลสั้นกว่า 2 เท่าของช่วง ใช้ครึ่งหนึ่ง)
  const n = Math.min(COMPARE_DAYS, Math.floor(data.length / 2)) || 1;
  const avg = (arr) => arr.reduce((s, d) => s + d.revenue, 0) / arr.length;
  const first = avg(data.slice(0, n));
  const last = avg(data.slice(-n));
  const change = (last - first) / first;
  const summary =
    `ยอดเฉลี่ยต่อวัน ${fmtNum(n)} วันล่าสุด ${fmtBaht(last)} ${change >= 0 ? "โตขึ้น" : "ลดลง"} ` +
    `${pct(Math.abs(change))} จาก ${fmtNum(n)} วันแรก (${fmtBaht(first)})`;

  return (
    <ChartFrame summary={summary}>
      <LineChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" ticks={ticks} tickFormatter={(d) => thaiMonth(d.slice(0, 7))}
               tick={tick} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tickFormatter={fmtBaht} tick={tick} tickLine={false} axisLine={false} width={72} />
        <Tooltip contentStyle={tooltipStyle}
                 labelFormatter={(d) => new Date(d + "T00:00:00").toLocaleDateString("th-TH", { dateStyle: "medium" })}
                 formatter={(v, key) => [v == null ? "-" : fmtBaht(v),
                   key === "ma" ? `เฉลี่ย ${TREND_WINDOW} วัน` : "ยอดขายรายวัน"]} />
        {/* รายวัน: บางและจาง ให้เห็นความผันผวนโดยไม่แย่งสายตา */}
        <Line dataKey="revenue" stroke={MAIN} strokeOpacity={0.2} strokeWidth={1}
              dot={false} activeDot={false} isAnimationActive={false} />
        {/* เส้นหลักที่ใช้ตอบคำถามเรื่องแนวโน้ม */}
        <Line dataKey="ma" stroke={MAIN} strokeWidth={2.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------ */
/** กราฟ 4: เดือนล่าสุดยอดตกจริงไหม → เทียบยอดเฉลี่ยต่อวัน และบอกเดือนที่ข้อมูลไม่ครบ */
export function FixedChart4({ rows }) {
  const data = useMemo(
    () => monthlyRevenue(rows).map((m) => {
      const total = daysInMonth(m.month);
      return { ...m, totalDays: total, partial: m.days < total };
    }),
    [rows]
  );
  if (data.length === 0) return <ChartFrame summary="ไม่มีข้อมูล" />;

  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  let summary = `${thaiMonth(last.month)} เฉลี่ย ${fmtBaht(last.perDay)}/วัน`;
  if (prev) {
    const change = (last.perDay - prev.perDay) / prev.perDay;
    summary += ` ${change >= 0 ? "สูงกว่า" : "ต่ำกว่า"} ${thaiMonth(prev.month)} ${pct(Math.abs(change))}`;
  }
  if (last.partial) {
    summary +=
      ` · ข้อมูล ${fmtNum(last.days)}/${fmtNum(last.totalDays)} วัน` +
      ` คาดทั้งเดือน ≈ ${fmtBaht(last.perDay * last.totalDays)}`;
  }

  return (
    <ChartFrame summary={summary}>
      <BarChart data={data} margin={{ top: 20, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="month" tickFormatter={thaiMonth} tick={{ ...tick, fontSize: 11 }}
               tickLine={false} axisLine={{ stroke: GRID }} minTickGap={8} />
        <YAxis tickFormatter={fmtBaht} tick={tick} tickLine={false} axisLine={false} width={68} />
        <Tooltip cursor={{ fill: "#f4eadc" }} contentStyle={tooltipStyle} labelFormatter={thaiMonth}
                 formatter={(v, _k, item) => [
                   `${fmtBaht(v)}/วัน (ยอดรวม ${fmtBaht(item.payload.revenue)}, ${item.payload.days}/${item.payload.totalDays} วัน)`,
                   "เฉลี่ยต่อวัน",
                 ]} />
        <Bar dataKey="perDay" fill={MAIN} radius={[3, 3, 0, 0]} isAnimationActive={false}>
          {/* เดือนที่ข้อมูลไม่ครบ: สีเดียวกันแต่อ่อนลง พร้อมป้ายจำนวนวัน */}
          {data.map((d) => <Cell key={d.month} fillOpacity={d.partial ? 0.35 : 1} />)}
          <LabelList dataKey="perDay"
                     content={({ x, y, width, index }) => {
                       const d = data[index];
                       return d?.partial ? (
                         <text x={x + width / 2} y={y - 6} textAnchor="middle" fill="#6f533c" fontSize={11}>
                           {d.days}/{d.totalDays} วัน
                         </text>
                       ) : null;
                     }} />
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------ */
/** กราฟ 5: ผลงานสาขาแบบยุติธรรม → ยอดเฉลี่ยต่อวันที่เปิดขาย ไม่ใช่ยอดรวม */
export function FixedChart5({ rows }) {
  const data = useMemo(() => {
    const perf = branchPerformance(rows);
    const byTotal = [...perf].sort((a, b) => b.revenue - a.revenue).map((b) => b.branch);
    return perf
      .sort((a, b) => b.perDay - a.perDay)
      .map((b, i) => ({
        ...b,
        rank: i + 1,
        totalRank: byTotal.indexOf(b.branch) + 1,
        label: `${b.branch} (${fmtNum(b.days)} วัน)`,
      }));
  }, [rows]);
  if (data.length === 0) return <ChartFrame summary="ไม่มีข้อมูล" />;

  // สาขาที่อันดับขยับขึ้นมากที่สุดเมื่อเปลี่ยนจากยอดรวมเป็นยอดต่อวัน
  const moved = [...data].sort((a, b) => (b.totalRank - b.rank) - (a.totalRank - a.rank))[0];
  const minDays = Math.min(...data.map((d) => d.days));
  const maxDays = Math.max(...data.map((d) => d.days));
  let summary = `ต่อวันที่เปิดขาย ${data[0].branch} สูงสุด ${fmtBaht(data[0].perDay)}/วัน`;
  if (moved.totalRank !== moved.rank) {
    summary +=
      ` · ${moved.branch} ยอดรวมอันดับ ${moved.totalRank} แต่ต่อวันอันดับ ${moved.rank}` +
      ` (เปิดมา ${fmtNum(moved.days)} วัน)`;
  } else if (minDays !== maxDays) {
    summary += ` · สาขาเปิดขายมา ${fmtNum(minDays)}–${fmtNum(maxDays)} วัน`;
  }

  return (
    <ChartFrame summary={summary}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 96, left: 0, bottom: 0 }}>
        <XAxis type="number" hide domain={[0, "dataMax"]} />
        <YAxis type="category" dataKey="label" width={172} tick={tick} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: "#f4eadc" }} contentStyle={tooltipStyle}
                 formatter={(v, _k, item) => [
                   `${fmtBaht(v)}/วัน (ยอดรวม ${fmtBaht(item.payload.revenue)})`, "ยอดเฉลี่ยต่อวัน",
                 ]} />
        <Bar dataKey="perDay" fill={MAIN} radius={[0, 3, 3, 0]} barSize={26} isAnimationActive={false}>
          <LabelList dataKey="perDay" position="right" formatter={(v) => `${fmtBaht(v)}/วัน`}
                     style={{ fill: "#3e2d21", fontSize: 12 }} />
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}
