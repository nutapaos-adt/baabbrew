// ตัวอย่างที่ทำเสร็จแล้ว: อ่านเทียบกับ abc.test.js เพื่อดูว่า test อธิบายสิ่งที่ฟังก์ชันต้องทำอย่างไร
// Lab 4.2 · Pareto / ABC ของเมนู
// A = เมนูที่รวมกันได้ 80% แรกของยอดขาย, B = ถึง 95%, C = ที่เหลือ
// เมนูอยู่กลุ่มไหนดูจาก "ยอดสะสมก่อนหน้าเมนูนั้น" เพื่อให้เมนูที่ข้ามเส้น 80% ยังอยู่กลุ่ม A

export function computeAbc(rows, products = []) {
  const name = Object.fromEntries(products.map((p) => [p.product_id, p.product_name]));
  const cat = Object.fromEntries(products.map((p) => [p.product_id, p.category]));
  const by = new Map();
  for (const x of rows) by.set(x.product_id, (by.get(x.product_id) ?? 0) + x.revenue);
  const total = [...by.values()].reduce((a, b) => a + b, 0);
  let cum = 0;
  return [...by.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id, revenue], i) => {
      const before = cum;
      cum += revenue;
      return {
        rank: i + 1, product_id: id, name: name[id] ?? id, category: cat[id] ?? "",
        revenue, share: revenue / total, cumShare: cum / total,
        cls: before / total < 0.8 - 1e-9 ? "A" : before / total < 0.95 - 1e-9 ? "B" : "C",
      };
    });
}
