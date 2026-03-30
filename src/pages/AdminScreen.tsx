import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  PackagePlus, ArrowLeft, Save, Box, Edit, Trash2, 
  History, BarChart3, Download, Undo2, Printer, 
  Lock, Settings, AlertTriangle, Warehouse
} from 'lucide-react';
import { supabase } from '../supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import Barcode from 'react-barcode';

export default function AdminScreen() {
  const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN ?? '9999';

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('isAdminAuth') === 'true';
  });
  const [pin, setPin] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [form, setForm] = useState({ barcode: '', name: '', price: '', stock_qty: '', cost_price: '', min_stock: '5' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingOldStock, setEditingOldStock] = useState<number>(0); // เก็บสต็อกเดิมก่อนแก้
  const [isSaving, setIsSaving] = useState(false);
  const [printBarcodeProduct, setPrintBarcodeProduct] = useState<any>(null);

  const pinInputRef = useRef<HTMLInputElement>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      setIsAuthenticated(true);
      sessionStorage.setItem('isAdminAuth', 'true'); // 🌟 สั่งให้เบราว์เซอร์จดจำไว้
    } else {
      alert('❌ รหัสผ่านไม่ถูกต้อง!');
      setPin('');
      pinInputRef.current?.focus();
    }
  };

  const fetchData = async () => {
    const { data: pData } = await supabase.from('products').select('*').order('id', { ascending: false });
    if (pData) setProducts(pData);
    const { data: sData } = await supabase.from('sales').select('*').order('created_at', { ascending: false });
    if (sData) setSales(sData);
  };

  useEffect(() => { if (isAuthenticated) fetchData(); }, [isAuthenticated]);

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.barcode || !form.name || !form.price || !form.stock_qty) {
      alert('กรุณากรอกข้อมูลให้ครบครับ'); return;
    }
    setIsSaving(true);

    if (editingId) {
      const newStock = Number(form.stock_qty);
      const { error } = await supabase.from('products').update({
        barcode: form.barcode, name: form.name,
        price: Number(form.price), stock_qty: newStock,
        cost_price: Number(form.cost_price || 0),
        min_stock: Number(form.min_stock || 5)
      }).eq('id', editingId);

      if (!error) {
        // ✅ log การแก้สต็อกด้วยมือ (ถ้าสต็อกเปลี่ยน)
        if (newStock !== editingOldStock) {
          await supabase.from('stock_logs').insert([{
            product_id: editingId,
            product_name: form.name,
            type: 'manual_edit',
            qty_change: newStock - editingOldStock,
            qty_before: editingOldStock,
            qty_after: newStock,
            note: 'แก้ไขผ่านหลังบ้าน',
            created_by: 'admin'
          }]);
        }
        alert('✅ อัปเดตสำเร็จ!'); resetForm(); fetchData();
      }
    } else {
      const { error } = await supabase.from('products').insert([{
        barcode: form.barcode, name: form.name,
        price: Number(form.price), stock_qty: Number(form.stock_qty),
        cost_price: Number(form.cost_price || 0),
        min_stock: Number(form.min_stock || 5)
      }]);
      if (!error) { alert('✅ เพิ่มสำเร็จ!'); resetForm(); fetchData(); }
      else alert('❌ บาร์โค้ดอาจซ้ำกัน');
    }
    setIsSaving(false);
  };

  const handleEditClick = (product: any) => {
    setEditingId(product.id);
    setEditingOldStock(product.stock_qty); // เก็บสต็อกเดิมไว้เปรียบเทียบ
    setForm({
      barcode: product.barcode, name: product.name,
      price: product.price, stock_qty: product.stock_qty,
      cost_price: product.cost_price ?? 0,
      min_stock: product.min_stock ?? 5
    });
  };

  const handleDeleteClick = async (id: number, name: string) => {
    if (confirm(`ลบ "${name}" ใช่หรือไม่?`)) {
      await supabase.from('products').delete().eq('id', id);
      fetchData();
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setEditingOldStock(0);
    setForm({ barcode: '', name: '', price: '', stock_qty: '', cost_price: '', min_stock: '5' });
  };

  // ✅ void บิล — ดึงสต็อกสดจาก DB + log การเคลื่อนไหว
  const handleVoidBill = async (bill: any) => {
    if (!confirm(`ยกเลิกบิล #${bill.id} และคืนสต็อกใช่หรือไม่?`)) return;
    try {
      for (const item of bill.items) {
        const { data: freshProduct, error: fetchError } = await supabase
          .from('products').select('stock_qty, name').eq('id', item.id).single();
        if (fetchError || !freshProduct) { console.warn(`ไม่พบสินค้า id=${item.id}`); continue; }

        const newQty = freshProduct.stock_qty + item.qty;
        await supabase.from('products').update({ stock_qty: newQty }).eq('id', item.id);

        // log การคืนสต็อก
        await supabase.from('stock_logs').insert([{
          product_id: item.id,
          product_name: freshProduct.name,
          type: 'void',
          qty_change: item.qty,
          qty_before: freshProduct.stock_qty,
          qty_after: newQty,
          note: `ยกเลิกบิล #${bill.id}`,
          created_by: 'admin'
        }]);
      }
      await supabase.from('sales').delete().eq('id', bill.id);
      alert('✅ ยกเลิกบิลสำเร็จ'); fetchData();
    } catch (e) { alert('❌ ผิดพลาด'); }
  };

  const handleExportExcel = () => {
    const data = sales.map(s => ({
      "เลขบิล": s.id, "วันที่": new Date(s.created_at).toLocaleString('th-TH'),
      "ยอดรวม": s.total_amount, "รายการ": s.items.map((i:any)=>`${i.name}(x${i.qty})`).join(', ')
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales");
    XLSX.writeFile(wb, `Sales_Report_${new Date().toLocaleDateString()}.xlsx`);
  };

  const triggerPrintBarcode = (product: any) => {
    setPrintBarcodeProduct(product);
    setTimeout(() => { window.print(); }, 500);
  };

  const totalSalesAmount = sales.reduce((sum, s) => sum + Number(s.total_amount), 0);
  const pCount: any = {};
  sales.forEach(s => s.items.forEach((i:any) => pCount[i.name] = (pCount[i.name] || 0) + i.qty));
  const chartData = Object.keys(pCount).map(k => ({ name: k, qty: pCount[k] })).sort((a,b)=>b.qty-a.qty).slice(0,5);

  // ✅ นับสินค้าที่ต้องดูแล
  const lowStockCount = products.filter(p => p.stock_qty > 0 && p.stock_qty <= (p.min_stock ?? 5)).length;
  const outStockCount = products.filter(p => p.stock_qty <= 0).length;
  const alertCount = lowStockCount + outStockCount;

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 font-sans">
        <div className="bg-white p-10 rounded-3xl shadow-2xl w-[400px] text-center">
          <Lock size={48} className="mx-auto text-orange-500 mb-4"/>
          <h2 className="text-2xl font-black mb-6">Manager Login</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <input ref={pinInputRef} type="password" maxLength={4} value={pin} onChange={e=>setPin(e.target.value)} autoFocus className="w-full text-center text-3xl font-black p-4 border-2 rounded-xl" placeholder="••••" />
            <button className="w-full bg-orange-600 text-white py-4 rounded-xl font-bold hover:bg-orange-700">ยืนยันรหัสผ่าน</button>
            <Link to="/" className="block text-gray-400 mt-4 font-bold hover:text-gray-600">← กลับไปหน้าร้าน</Link>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="print:hidden flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border-t-4 border-orange-500">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-3 rounded-xl"><PackagePlus className="text-orange-600" /></div>
            <div>
              <h1 className="text-2xl font-black">ระบบจัดการหลังบ้าน</h1>
              <p className="text-gray-500">น.เจริญการช่าง | บิว POS</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* ✅ ปุ่มจัดการสต็อกพร้อม badge แจ้งเตือน */}
            <Link to="/stock" className="relative flex items-center gap-2 bg-teal-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-teal-700 shadow-sm">
              <Warehouse size={20} /> จัดการสต็อก
              {alertCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center">
                  {alertCount}
                </span>
              )}
            </Link>
            <Link to="/settings" className="flex items-center gap-2 bg-purple-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-purple-700 shadow-sm"><Settings size={20} /> ตั้งค่าร้านค้า</Link>
            <button onClick={handleExportExcel} className="bg-green-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-green-700 flex items-center gap-2"><Download size={20}/> Export Excel</button>
            <button 
    onClick={() => {
      setIsAuthenticated(false);
      sessionStorage.removeItem('isAdminAuth'); // 🌟 ล้างความจำเมื่อกดล็อกระบบ
    }} 
    className="bg-red-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-red-700 flex items-center gap-2"
  >
    <Lock size={20}/> ล็อกระบบ
  </button>
            <Link to="/dashboard" className="flex items-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-blue-700"><BarChart3 size={20} /> Dashboard</Link>
            <Link to="/" className="bg-gray-800 text-white px-5 py-3 rounded-xl font-bold hover:bg-gray-700 flex items-center gap-2"><ArrowLeft size={20}/> กลับหน้าร้าน</Link>
          </div>
        </div>

        {/* ✅ แถบแจ้งเตือนสต็อก */}
        {alertCount > 0 && (
          <div className="print:hidden bg-orange-50 border-2 border-orange-300 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3 text-orange-700 font-bold">
              <AlertTriangle size={24} className="text-orange-500" />
              <span>มีสินค้า <strong>{outStockCount} รายการหมด</strong> และ <strong>{lowStockCount} รายการใกล้หมด</strong> — ควรสั่งซื้อเพิ่ม</span>
            </div>
            <Link to="/stock" className="bg-orange-500 text-white px-4 py-2 rounded-xl font-bold hover:bg-orange-600 text-sm">
              ดูรายละเอียด →
            </Link>
          </div>
        )}

        {/* Stats + Chart */}
        <div className="print:hidden grid grid-cols-3 gap-6">
          <div className="col-span-1 bg-white p-6 rounded-2xl shadow-sm border-l-8 border-green-500">
            <h2 className="text-gray-500 font-bold mb-2 flex items-center gap-2"><BarChart3 /> ยอดขายรวม</h2>
            <div className="text-5xl font-black text-green-600">฿{totalSalesAmount.toLocaleString()}</div>
          </div>
          <div className="col-span-2 bg-white p-6 rounded-2xl shadow-sm h-[200px]">
            <h2 className="font-bold mb-4">🏆 Top 5 สินค้าขายดี</h2>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} tick={{fontSize:12}} />
                <Tooltip />
                <Bar dataKey="qty" fill="#f97316" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="print:hidden grid grid-cols-3 gap-6">
          {/* Form เพิ่ม/แก้สินค้า */}
          <div className="col-span-1 bg-white p-6 rounded-2xl shadow-sm h-fit">
            <h2 className="text-xl font-bold mb-4 border-b pb-2">{editingId ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h2>
            <form onSubmit={handleSaveProduct} className="space-y-3">
              <input type="text" placeholder="บาร์โค้ด" value={form.barcode} onChange={e=>setForm({...form, barcode: e.target.value})} className="w-full border-2 p-3 rounded-xl outline-none focus:border-orange-500" disabled={!!editingId} />
              <input type="text" placeholder="ชื่อสินค้า" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} className="w-full border-2 p-3 rounded-xl outline-none focus:border-orange-500" />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" placeholder="ราคาขาย" value={form.price} onChange={e=>setForm({...form, price: e.target.value})} className="w-full border-2 p-3 rounded-xl outline-none focus:border-orange-500" />
                <input type="number" placeholder="สต็อก" value={form.stock_qty} onChange={e=>setForm({...form, stock_qty: e.target.value})} className="w-full border-2 p-3 rounded-xl outline-none focus:border-orange-500" />
              </div>
              {/* ✅ ฟิลด์ใหม่: ราคาทุน + สต็อกขั้นต่ำ */}
              <div className="grid grid-cols-2 gap-2">
                <input type="number" placeholder="ราคาทุน" value={form.cost_price} onChange={e=>setForm({...form, cost_price: e.target.value})} className="w-full border-2 p-3 rounded-xl outline-none focus:border-teal-500" />
                <input type="number" placeholder="สต็อกขั้นต่ำ" value={form.min_stock} onChange={e=>setForm({...form, min_stock: e.target.value})} className="w-full border-2 p-3 rounded-xl outline-none focus:border-teal-500" />
              </div>
              <p className="text-xs text-gray-400 px-1">ราคาทุน ใช้คำนวณกำไร | สต็อกขั้นต่ำ ใช้แจ้งเตือน</p>
              <button className={`w-full text-white py-4 rounded-xl font-bold ${editingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}>
                {editingId ? '💾 บันทึกการแก้ไข' : '➕ เพิ่มสินค้า'}
              </button>
              {editingId && (
                <button type="button" onClick={resetForm} className="w-full border-2 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-50">
                  ยกเลิก
                </button>
              )}
            </form>
          </div>

          <div className="col-span-2 space-y-6">
            {/* ตารางสินค้า */}
            <div className="bg-white p-6 rounded-2xl shadow-sm h-[430px] flex flex-col">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Box className="text-orange-500"/> คลังสินค้า ({products.length})
                {alertCount > 0 && (
                  <span className="ml-auto flex items-center gap-1 text-orange-600 text-sm font-bold bg-orange-50 px-3 py-1 rounded-full">
                    <AlertTriangle size={14} /> {alertCount} รายการต้องดูแล
                  </span>
                )}
              </h2>
              <div className="overflow-y-auto flex-1 border rounded-lg">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 sticky top-0 shadow-sm">
                    <tr>
                      <th className="p-3">บาร์โค้ด</th>
                      <th className="p-3">ชื่อ</th>
                      <th className="p-3 text-center">ราคา</th>
                      <th className="p-3 text-center">ทุน</th>
                      <th className="p-3 text-center">สต็อก</th>
                      <th className="p-3 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => {
                      const isOut = p.stock_qty <= 0;
                      const isLow = p.stock_qty > 0 && p.stock_qty <= (p.min_stock ?? 5);
                      return (
                        <tr key={p.id} className={`border-b ${isOut ? 'bg-red-50' : isLow ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
                          <td className="p-3 font-mono text-sm">{p.barcode}</td>
                          <td className="p-3 font-bold">
                            {p.name}
                            {isOut && <span className="ml-2 text-xs bg-red-200 text-red-700 px-2 py-0.5 rounded-full font-black">หมด</span>}
                            {isLow && <span className="ml-2 text-xs bg-orange-200 text-orange-700 px-2 py-0.5 rounded-full font-black">ใกล้หมด</span>}
                          </td>
                          <td className="p-3 text-center">฿{p.price}</td>
                          <td className="p-3 text-center text-gray-500 text-sm">฿{p.cost_price ?? '-'}</td>
                          <td className={`p-3 text-center font-black ${isOut ? 'text-red-600' : isLow ? 'text-orange-600' : 'text-gray-800'}`}>
                            {p.stock_qty}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex justify-center gap-1">
                              <button onClick={()=>triggerPrintBarcode(p)} className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100"><Printer size={16}/></button>
                              <button onClick={()=>handleEditClick(p)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><Edit size={16}/></button>
                              <button onClick={()=>handleDeleteClick(p.id, p.name)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Trash2 size={16}/></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ประวัติยอดขาย */}
            <div className="bg-white p-6 rounded-2xl shadow-sm h-[400px] flex flex-col">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><History className="text-green-500"/> ประวัติยอดขาย</h2>
              <div className="overflow-y-auto flex-1 space-y-3">
                {sales.map(s=>(
                  <div key={s.id} className="bg-gray-50 p-4 rounded-xl flex justify-between items-center border">
                    <div>
                      <div className="font-bold text-lg">บิล #{s.id} <span className="text-xs font-normal text-gray-400">{new Date(s.created_at).toLocaleString('th-TH')}</span></div>
                      <div className="text-xs text-gray-500">{s.items.length} รายการ</div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <div className="text-xl font-black text-green-600">฿{s.total_amount}</div>
                      <button onClick={()=>handleVoidBill(s)} className="bg-red-100 text-red-600 px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-1"><Undo2 size={16}/> โมฆะ</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {printBarcodeProduct && (
        <div className="hidden print:flex flex-col items-center justify-center w-full h-screen bg-white">
          <div className="border-2 border-black p-6 rounded-xl text-center">
            <h3 className="text-xl font-bold mb-2">{printBarcodeProduct.name}</h3>
            <Barcode value={printBarcodeProduct.barcode} width={2} height={80} fontSize={18} />
            <div className="text-4xl font-black mt-4">฿{printBarcodeProduct.price}</div>
          </div>
        </div>
      )}
    </div>
  );
}