// ⚠️ กราฟในไฟล์นี้ “ตั้งใจทำให้แย่” เพื่อใช้ฝึกวิจารณ์ใน Lab 2.2 ห้ามแก้ไฟล์นี้
// ให้สร้างกราฟที่ซ่อมแล้วใน FixedCharts.jsx แทน จะได้เทียบกันแบบซ้าย-ขวา
import { useMemo } from "react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
} from "recharts";
import { revenueByProduct, monthlyRevenue, branchPerformance } from "./lab2Metrics.js";
import { dailyRevenue } from "../lib/metrics.js";

const rainbow = (i, n) => `hsl(${Math.round((i * 360) / n)}, 85%, 55%)`;

/** กราฟ 1: สัดส่วนยอดขายทุกเมนูใน pie ชิ้นเดียว */
export function BadChart1({ rows, products }) {
  const data = useMemo(() => revenueByProduct(rows, products), [rows, products]);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="revenue" nameKey="name" outerRadius="70%"
             label={({ percent }) => `${(percent * 100).toFixed(1)}%`} labelLine isAnimationActive={false}>
          {data.map((d, i) => <Cell key={d.id} fill={rainbow(i, data.length)} />)}
        </Pie>
        <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 9 }} />
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** กราฟ 2: ยอดขายแยกสาขา แกน Y เริ่มที่ 500,000 สีรุ้ง เรียงตามตัวอักษร */
export function BadChart2({ rows }) {
  const data = useMemo(
    () => branchPerformance(rows).sort((a, b) => a.branch.localeCompare(b.branch, "th")),
    [rows]
  );
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="branch" />
        <YAxis domain={[500000, 1300000]} allowDataOverflow />
        <Tooltip />
        <Bar dataKey="revenue" isAnimationActive={false}>
          {data.map((d, i) => <Cell key={d.branch} fill={rainbow(i, data.length)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** กราฟ 3: ยอดขายรายวัน 538 จุด มีจุดทุกวัน เส้นหนา วันที่แบบ ISO เบียดกัน */
export function BadChart3({ rows }) {
  const data = useMemo(() => dailyRevenue(rows), [rows]);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid />
        <XAxis dataKey="date" interval={0} angle={-90} textAnchor="end" height={70} tick={{ fontSize: 6 }} />
        <YAxis />
        <Tooltip />
        <Line dataKey="revenue" stroke="#e11d48" strokeWidth={3} dot={{ r: 3 }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** กราฟ 4: ยอดขายรายเดือน ไม่บอกว่าเดือนสุดท้ายมีข้อมูลไม่ครบ */
export function BadChart4({ rows }) {
  const data = useMemo(() => monthlyRevenue(rows), [rows]);
  const last = data[data.length - 1];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
        <YAxis />
        <Tooltip />
        <Bar dataKey="revenue" isAnimationActive={false}>
          {data.map((d) => <Cell key={d.month} fill={d === last ? "#dc2626" : "#64748b"} />)}
          <LabelList dataKey="revenue" position="top"
                     content={({ x, y, width, index }) => index === data.length - 1 ? (
                       <text x={x + width / 2} y={y - 8} textAnchor="middle" fill="#dc2626" fontSize={12} fontWeight={700}>ยอดตก! ⚠️</text>
                     ) : null} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** กราฟ 5: จัดอันดับผลงานสาขาด้วยยอดรวม โดยไม่คำนึงว่าแต่ละสาขาเปิดขายกี่วัน */
export function BadChart5({ rows }) {
  const data = useMemo(() => branchPerformance(rows).sort((a, b) => a.revenue - b.revenue), [rows]);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 90 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="branch" width={90} />
        <Bar dataKey="revenue" isAnimationActive={false}>
          {data.map((d, i) => <Cell key={d.branch} fill={i === 0 ? "#dc2626" : "#94a3b8"} />)}
          <LabelList dataKey="branch" position="right"
                     content={({ x, y, width, height, index }) => index === 0 ? (
                       <text x={x + width + 8} y={y + height / 2 + 5} fill="#dc2626" fontSize={13} fontWeight={700}>แย่ที่สุด 👎</text>
                     ) : null} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
