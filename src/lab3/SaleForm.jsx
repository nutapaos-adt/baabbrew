// Lab 3.2 · ฟอร์มบันทึกยอดขาย (Prompt 3.2C)
// ตรวจด้วย validateSaleForm และสร้างเอกสารด้วย buildSale จาก ./saleModel.js
// ราคาไม่ได้มาจากฟอร์ม แต่มาจากเมนูใน Firestore เสมอ
import { useMemo, useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";
import { BRANCHES, PAYMENTS, MAX_QTY, validateSaleForm, buildSale } from "./saleModel.js";
import { fmtBaht } from "../lib/metrics.js";

const EMPTY = { branch: "", product_id: "", qty: "1", payment_method: "", customer_id: "" };

const inputClass = (hasError) =>
  `mt-1 w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 focus:outline-none focus:ring-2 ${
    hasError ? "ring-red-400 focus:ring-red-500" : "ring-stone-300 focus:ring-stone-500"
  }`;

function Field({ label, optional, error, children }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-stone-700">
        {label} {optional && <span className="font-normal text-stone-400">(ไม่บังคับ)</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

/** แปล error ตอนบันทึกเป็นภาษาไทย */
function saveErrorText(err) {
  if (err?.code === "permission-denied") return "ถูกปฏิเสธโดย Security Rules";
  if (err?.code === "unavailable") return "เชื่อมต่อ Firestore ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่";
  if (err?.code === "resource-exhausted") return "ใช้โควตาฟรีของวันนี้หมดแล้ว";
  return `บันทึกไม่สำเร็จ: ${err?.message ?? String(err)}`;
}

/**
 * props
 * - products: เมนูจาก collection "products" (null = กำลังโหลด)
 * - productsError: ข้อความเมื่อโหลดเมนูไม่ได้
 * - uid: ผู้บันทึก ("anonymous" จนกว่าจะทำ Lab 3.3)
 */
export default function SaleForm({ products, productsError, uid = "anonymous" }) {
  const [form, setForm] = useState(EMPTY);
  const [touched, setTouched] = useState(false); // แสดง error หลังกดบันทึกครั้งแรก
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null); // { ok: boolean, text: string }

  const list = products ?? [];
  const errors = useMemo(() => validateSaleForm(form, list), [form, list]);
  const product = list.find((p) => p.product_id === form.product_id);
  const qty = Number(form.qty);
  const total = product && !errors.qty ? qty * Number(product.price) : null;

  // จัดเมนูเป็นกลุ่มตามหมวด
  const groups = useMemo(() => {
    const map = new Map();
    for (const p of list) {
      const key = p.category || "อื่น ๆ";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    }
    return [...map.entries()];
  }, [list]);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setResult(null);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    setResult(null);
    if (Object.keys(errors).length > 0) return;

    const sale = buildSale(form, product, { uid });
    console.log("เอกสารที่จะบันทึก (sale.data):", sale.data); // ใช้เทียบกับ Security Rules ถ้าถูกปฏิเสธ
    setSaving(true);
    try {
      await setDoc(doc(db, "sales", sale.id), { ...sale.data, created_at: serverTimestamp() });
      setResult({
        ok: true,
        text: `บันทึกแล้ว ${product.product_name} × ${qty} = ${fmtBaht(sale.data.revenue)} (${sale.data.order_id})`,
      });
      // เก็บสาขาและวิธีชำระเงินไว้ เพราะพนักงานมักบันทึกต่อเนื่องที่สาขาเดิม
      setForm((f) => ({ ...EMPTY, branch: f.branch, payment_method: f.payment_method }));
      setTouched(false);
    } catch (err) {
      setResult({ ok: false, text: saveErrorText(err) });
    } finally {
      setSaving(false);
    }
  }

  const show = (field) => (touched ? errors[field] : undefined);

  return (
    <section className="rounded-xl bg-white p-5 ring-1 ring-stone-200">
      <h2 className="text-lg font-semibold">บันทึกยอดขาย</h2>
      <p className="mb-4 text-xs text-stone-500">รายการใหม่จะขึ้นใน Dashboard ทันที</p>

      {productsError && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{productsError}</p>}

      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        <Field label="สาขา" error={show("branch")}>
          <select value={form.branch} onChange={set("branch")} className={inputClass(show("branch"))}>
            <option value="">เลือกสาขา</option>
            {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </Field>

        <Field label="เมนู" error={show("product_id")}>
          <select value={form.product_id} onChange={set("product_id")} disabled={!products}
                  className={inputClass(show("product_id"))}>
            <option value="">{products ? "เลือกเมนู" : "กำลังโหลดเมนู…"}</option>
            {groups.map(([category, items]) => (
              <optgroup key={category} label={category}>
                {items.map((p) => (
                  <option key={p.product_id} value={p.product_id}>
                    {p.product_name} · {fmtBaht(Number(p.price))}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="จำนวน" error={show("qty")}>
            <input type="number" inputMode="numeric" min={1} max={MAX_QTY} step={1}
                   value={form.qty} onChange={set("qty")} className={inputClass(show("qty"))} />
          </Field>
          <Field label="วิธีชำระเงิน" error={show("payment_method")}>
            <select value={form.payment_method} onChange={set("payment_method")}
                    className={inputClass(show("payment_method"))}>
              <option value="">เลือก</option>
              {PAYMENTS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
        </div>

        <Field label="รหัสสมาชิก" optional error={show("customer_id")}>
          <input type="text" placeholder="เช่น C01234" value={form.customer_id} onChange={set("customer_id")}
                 className={inputClass(show("customer_id"))} />
        </Field>

        <div className="flex items-baseline justify-between rounded-lg bg-stone-50 px-3 py-2">
          <span className="text-sm text-stone-600">ยอดรวม</span>
          <span className="text-xl font-semibold tabular-nums">{total === null ? "–" : fmtBaht(total)}</span>
        </div>

        <button type="submit" disabled={saving || !products}
                className="w-full rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? "กำลังบันทึก…" : "บันทึกยอดขาย"}
        </button>

        {result && (
          <p role="status"
             className={`rounded-lg p-3 text-sm ${result.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
            {result.ok ? "✅ " : "❌ "}{result.text}
          </p>
        )}
      </form>
    </section>
  );
}
