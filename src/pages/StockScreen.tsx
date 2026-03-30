import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  PackagePlus, ArrowLeft, Save, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, History, Settings2,
  ShoppingBag, Box, ChevronDown, RefreshCw
} from 'lucide-react';
import { supabase } from '../supabase';

type Tab = 'restock' | 'minsetting' | 'logs';

export default function StockScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('restock');
  const [products, setProducts] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ฟอร์มรับสินค้าเข้า
  const [restockForm, setRestockForm] = useState({
    product_id: '',
    qty: '',
    cost_price: '',
    note: ''
  });

  // ฟอร์มตั้งค่าสต็อกขั้นต่ำ (แก้แบบ inline ทั้งตาราง)
  const [settingRows, setSettingRows] = useState<any[]>([]);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const fetchAll = async () => {
    const { data: pData } = await supabase.from('products').select('*').order('name');
    if (pData) {
      setProducts(pData);
      setSettingRows(pData.map(p => ({
        id: p.id,
        name: p.name,
        cost_price: p.cost_price ?? 0,
        min_stock: p.min_stock ?? 5,
        stock_qty: p.stock_qty,
        price: p.price
      })));
    }
    const { data: lData } = await supabase
      .from('stock_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (lData) setLogs(lData);
  };

  useEffect(() => { fetchAll(); }, []);

  // ---- สถิติด่วน ----
  const lowStockProducts = products.filter(p => p.stock_qty > 0 && p.stock_qty <= (p.min_stock ?? 5));
  const outOfStockProducts = products.filter(p => p.stock_qty <= 0);
  const totalValue = products.reduce((sum, p) => sum + (Number(p.cost_price ?? 0) * p.stock_qty), 0);

  // ---- รับสินค้าเข้า ----
  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockForm.product_id || !restockForm.qty) return alert('กรุณาเลือกสินค้าและระบุจำนวน');
    const qty = Number(restockForm.qty);
    if (qty <= 0) return alert('จำนวนต้องมากกว่า 0');

    setIsLoading(true);
    try {
      // ดึงสต็อกปัจจุบันสด
      const { data: fresh, error: fetchErr } = await supabase
        .from('products')
        .select('stock_qty, name, cost_price')
        .eq('id', Number(restockForm.product_id))
        .single();

      if (fetchErr || !fresh) throw new Error('ไม่พบสินค้า');

      const qtyBefore = fresh.stock_qty;
      const qtyAfter = qtyBefore + qty;

      // อัปเดตสต็อก + ราคาทุน (ถ้ากรอก)
      const updatePayload: any = { stock_qty: qtyAfter };
      if (restockForm.cost_price) updatePayload.cost_price = Number(restockForm.cost_price);

      await supabase.from('products').update(updatePayload).eq('id', Number(restockForm.product_id));

      // บันทึก stock log
      await supabase.from('stock_logs').insert([{
        product_id: Number(restockForm.product_id),
        product_name: fresh.name,
        type: 'restock',
        qty_change: qty,
        qty_before: qtyBefore,
        qty_after: qtyAfter,
        note: restockForm.note || null,
        created_by: 'admin'
      }]);

      alert(`✅ รับสินค้าเข้าสำเร็จ!\n${fresh.name}: ${qtyBefore} → ${qtyAfter} ชิ้น`);
      setRestockForm({ product_id: '', qty: '', cost_price: '', note: '' });
      fetchAll();
    } catch (err: any) {
      alert('❌ เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ---- บันทึกตั้งค่าสต็อกขั้นต่ำ + ราคาทุน ----
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      for (const row of settingRows) {
        await supabase.from('products').update({
          cost_price: Number(row.cost_price),
          min_stock: Number(row.min_stock)
        }).eq('id', row.id);
      }
      alert('✅ บันทึกการตั้งค่าสำเร็จ!');
      fetchAll();
    } catch {
      alert('❌ เกิดข้อผิดพลาด');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const updateSettingRow = (id: number, field: string, value: string) => {
    setSettingRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  // ---- type badge ----
  const typeBadge = (type: string) => {
    const map: any = {
      restock:     { label: 'รับสินค้าเข้า', color: 'bg-green-100 text-green-700' },
      sale:        { label: 'ขายออก',         color: 'bg-blue-100 text-blue-700' },
      void:        { label: 'โมฆะบิล',        color: 'bg-red-100 text-red-700' },
      manual_edit: { label: 'แก้ด้วยมือ',    color: 'bg-yellow-100 text-yellow-700' }
    };
    const t = map[type] ?? { label: type, color: 'bg-gray-100 text-gray-600' };
    return <span className={`px-2 py-1 rounded-lg text-xs font-bold ${t.color}`}>{t.label}</span>;
  };

  const selectedProduct = products.find(p => p.id === Number(restockForm.product_id));

  return (
    <div className="min-h-screen bg-gray-100 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border-t-4 border-teal-500">
          <div className="flex items-center gap-3">
            <div className="bg-teal-100 p-3 rounded-xl"><Box className="text-teal-600" size={32} /></div>
            <div>
              <h1 className="text-2xl font-black text-gray-800">ระบบจัดการสต็อก</h1>
              <p className="text-gray-500">รับสินค้าเข้า · แจ้งเตือน · ประวัติการเคลื่อนไหว</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={fetchAll} className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-xl font-bold hover:bg-gray-200">
              <RefreshCw size={18} /> รีโหลด
            </button>
            <Link to="/admin" className="flex items-center gap-2 bg-gray-800 text-white px-5 py-3 rounded-xl font-bold hover:bg-gray-700">
              <ArrowLeft size={20} /> กลับหลังบ้าน
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-blue-500">
            <p className="text-gray-500 text-sm font-bold mb-1">สินค้าทั้งหมด</p>
            <p className="text-4xl font-black text-blue-600">{products.length}</p>
            <p className="text-gray-400 text-xs mt-1">รายการ</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-orange-500">
            <p className="text-gray-500 text-sm font-bold mb-1 flex items-center gap-1"><AlertTriangle size={14}/> สต็อกใกล้หมด</p>
            <p className="text-4xl font-black text-orange-500">{lowStockProducts.length}</p>
            <p className="text-gray-400 text-xs mt-1">รายการ</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-red-500">
            <p className="text-gray-500 text-sm font-bold mb-1 flex items-center gap-1"><TrendingDown size={14}/> สต็อกหมด</p>
            <p className="text-4xl font-black text-red-500">{outOfStockProducts.length}</p>
            <p className="text-gray-400 text-xs mt-1">รายการ</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-green-500">
            <p className="text-gray-500 text-sm font-bold mb-1 flex items-center gap-1"><TrendingUp size={14}/> มูลค่าสต็อก</p>
            <p className="text-3xl font-black text-green-600">฿{totalValue.toLocaleString()}</p>
            <p className="text-gray-400 text-xs mt-1">ราคาทุนรวม</p>
          </div>
        </div>

        {/* แจ้งเตือนสต็อกใกล้หมด */}
        {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
          <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-5">
            <h3 className="font-black text-orange-700 mb-3 flex items-center gap-2">
              <AlertTriangle size={20} /> รายการที่ต้องสั่งซื้อ
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {outOfStockProducts.map(p => (
                <div key={p.id} className="bg-red-100 text-red-700 px-4 py-2 rounded-xl flex justify-between font-bold">
                  <span>{p.name}</span>
                  <span className="text-red-500">หมดแล้ว!</span>
                </div>
              ))}
              {lowStockProducts.map(p => (
                <div key={p.id} className="bg-orange-100 text-orange-700 px-4 py-2 rounded-xl flex justify-between font-bold">
                  <span>{p.name}</span>
                  <span>เหลือ {p.stock_qty} / ขั้นต่ำ {p.min_stock}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex border-b">
            {[
              { key: 'restock',    icon: <PackagePlus size={18}/>, label: 'รับสินค้าเข้า' },
              { key: 'minsetting', icon: <Settings2 size={18}/>,   label: 'ตั้งค่าสต็อกขั้นต่ำ' },
              { key: 'logs',       icon: <History size={18}/>,     label: 'ประวัติการเคลื่อนไหว' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as Tab)}
                className={`flex-1 flex items-center justify-center gap-2 py-4 font-bold transition-all
                  ${activeTab === tab.key
                    ? 'bg-teal-50 text-teal-700 border-b-4 border-teal-500'
                    : 'text-gray-500 hover:bg-gray-50'}`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Tab: รับสินค้าเข้า */}
          {activeTab === 'restock' && (
            <div className="p-8 grid grid-cols-2 gap-8">
              <form onSubmit={handleRestock} className="space-y-5">
                <h2 className="text-xl font-black text-gray-800">รับสินค้าเข้าคลัง</h2>

                <div>
                  <label className="text-sm font-bold text-gray-600 mb-2 block">เลือกสินค้า *</label>
                  <select
                    value={restockForm.product_id}
                    onChange={e => setRestockForm({ ...restockForm, product_id: e.target.value })}
                    className="w-full border-2 border-gray-200 rounded-xl p-3 font-bold outline-none focus:border-teal-500 bg-white"
                    required
                  >
                    <option value="">-- เลือกสินค้า --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (สต็อกปัจจุบัน: {p.stock_qty})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-bold text-gray-600 mb-2 block">จำนวนที่รับเข้า *</label>
                    <input
                      type="number" min="1"
                      placeholder="0"
                      value={restockForm.qty}
                      onChange={e => setRestockForm({ ...restockForm, qty: e.target.value })}
                      className="w-full border-2 border-gray-200 rounded-xl p-3 text-2xl font-black text-teal-600 text-center outline-none focus:border-teal-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-600 mb-2 block">ราคาทุนต่อชิ้น (บาท)</label>
                    <input
                      type="number" min="0"
                      placeholder={selectedProduct ? `เดิม: ฿${selectedProduct.cost_price ?? 0}` : '0'}
                      value={restockForm.cost_price}
                      onChange={e => setRestockForm({ ...restockForm, cost_price: e.target.value })}
                      className="w-full border-2 border-gray-200 rounded-xl p-3 font-bold outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-600 mb-2 block">หมายเหตุ</label>
                  <input
                    type="text"
                    placeholder="เช่น ล็อตใหม่ เดือน มีนาคม"
                    value={restockForm.note}
                    onChange={e => setRestockForm({ ...restockForm, note: e.target.value })}
                    className="w-full border-2 border-gray-200 rounded-xl p-3 font-medium outline-none focus:border-teal-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-teal-600 text-white py-4 rounded-xl font-black text-xl hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                >
                  <PackagePlus size={24} />
                  {isLoading ? 'กำลังบันทึก...' : 'รับสินค้าเข้าคลัง'}
                </button>
              </form>

              {/* Preview */}
              <div className="bg-gray-50 rounded-2xl p-6 flex flex-col justify-center">
                {selectedProduct ? (
                  <div className="space-y-4">
                    <h3 className="text-lg font-black text-gray-700">ตัวอย่างผลลัพธ์</h3>
                    <div className="bg-white rounded-xl p-5 border-2 border-gray-200 space-y-3">
                      <p className="font-black text-xl text-gray-800">{selectedProduct.name}</p>
                      <div className="flex justify-between">
                        <span className="text-gray-500">สต็อกปัจจุบัน</span>
                        <span className="font-bold">{selectedProduct.stock_qty} ชิ้น</span>
                      </div>
                      <div className="flex justify-between text-teal-600">
                        <span className="font-bold">รับเข้า</span>
                        <span className="font-black">+ {restockForm.qty || 0} ชิ้น</span>
                      </div>
                      <div className="border-t pt-3 flex justify-between text-green-600">
                        <span className="font-bold">สต็อกหลังรับ</span>
                        <span className="font-black text-2xl">
                          {selectedProduct.stock_qty + Number(restockForm.qty || 0)} ชิ้น
                        </span>
                      </div>
                      {restockForm.cost_price && (
                        <div className="bg-green-50 rounded-lg p-3 text-sm text-green-700 font-bold">
                          💰 มูลค่าล็อตนี้: ฿{(Number(restockForm.cost_price) * Number(restockForm.qty || 0)).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-400">
                    <ShoppingBag size={64} className="mx-auto mb-4 opacity-30" />
                    <p className="font-bold">เลือกสินค้าเพื่อดูตัวอย่าง</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab: ตั้งค่าสต็อกขั้นต่ำ */}
          {activeTab === 'minsetting' && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h2 className="text-xl font-black text-gray-800">ตั้งค่าสต็อกขั้นต่ำและราคาทุน</h2>
                  <p className="text-gray-500 text-sm">ระบบจะแจ้งเตือนเมื่อสต็อกต่ำกว่าค่าที่ตั้งไว้</p>
                </div>
                <button
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="bg-teal-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-teal-700 disabled:opacity-50"
                >
                  <Save size={20} />
                  {isSavingSettings ? 'กำลังบันทึก...' : 'บันทึกทั้งหมด'}
                </button>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="p-4 font-bold text-gray-600">ชื่อสินค้า</th>
                      <th className="p-4 font-bold text-gray-600 text-center">ราคาขาย</th>
                      <th className="p-4 font-bold text-gray-600 text-center">สต็อกปัจจุบัน</th>
                      <th className="p-4 font-bold text-gray-600 text-center">ราคาทุน (บาท)</th>
                      <th className="p-4 font-bold text-gray-600 text-center">สต็อกขั้นต่ำ</th>
                      <th className="p-4 font-bold text-gray-600 text-center">กำไร/ชิ้น</th>
                      <th className="p-4 font-bold text-gray-600 text-center">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settingRows.map(row => {
                      const isOut = row.stock_qty <= 0;
                      const isLow = row.stock_qty > 0 && row.stock_qty <= Number(row.min_stock);
                      const profit = Number(row.price) - Number(row.cost_price);
                      const margin = row.cost_price > 0 ? ((profit / Number(row.price)) * 100).toFixed(0) : '-';
                      return (
                        <tr key={row.id} className={`border-b ${isOut ? 'bg-red-50' : isLow ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
                          <td className="p-4 font-bold">{row.name}</td>
                          <td className="p-4 text-center text-gray-600">฿{row.price}</td>
                          <td className={`p-4 text-center font-black ${isOut ? 'text-red-600' : isLow ? 'text-orange-600' : 'text-gray-800'}`}>
                            {row.stock_qty}
                          </td>
                          <td className="p-4 text-center">
                            <input
                              type="number" min="0"
                              value={row.cost_price}
                              onChange={e => updateSettingRow(row.id, 'cost_price', e.target.value)}
                              className="w-24 text-center border-2 rounded-lg p-1 font-bold outline-none focus:border-teal-500"
                            />
                          </td>
                          <td className="p-4 text-center">
                            <input
                              type="number" min="0"
                              value={row.min_stock}
                              onChange={e => updateSettingRow(row.id, 'min_stock', e.target.value)}
                              className="w-20 text-center border-2 rounded-lg p-1 font-bold outline-none focus:border-teal-500"
                            />
                          </td>
                          <td className="p-4 text-center">
                            {row.cost_price > 0 ? (
                              <span className={`font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ฿{profit.toFixed(0)} ({margin}%)
                              </span>
                            ) : <span className="text-gray-400">-</span>}
                          </td>
                          <td className="p-4 text-center">
                            {isOut
                              ? <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-black">หมดแล้ว</span>
                              : isLow
                              ? <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-black">ใกล้หมด</span>
                              : <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-black">ปกติ</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab: ประวัติการเคลื่อนไหว */}
          {activeTab === 'logs' && (
            <div className="p-6">
              <h2 className="text-xl font-black text-gray-800 mb-5">ประวัติการเคลื่อนไหวสต็อก</h2>
              {logs.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                  <History size={64} className="mx-auto mb-4 opacity-30" />
                  <p className="font-bold">ยังไม่มีประวัติ</p>
                </div>
              ) : (
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="p-4 font-bold text-gray-600">วันที่/เวลา</th>
                        <th className="p-4 font-bold text-gray-600">สินค้า</th>
                        <th className="p-4 font-bold text-gray-600 text-center">ประเภท</th>
                        <th className="p-4 font-bold text-gray-600 text-center">จำนวนเปลี่ยน</th>
                        <th className="p-4 font-bold text-gray-600 text-center">ก่อน → หลัง</th>
                        <th className="p-4 font-bold text-gray-600">หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map(log => (
                        <tr key={log.id} className="border-b hover:bg-gray-50">
                          <td className="p-4 text-sm text-gray-500">
                            {new Date(log.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="p-4 font-bold">{log.product_name}</td>
                          <td className="p-4 text-center">{typeBadge(log.type)}</td>
                          <td className={`p-4 text-center font-black text-xl ${log.qty_change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {log.qty_change > 0 ? `+${log.qty_change}` : log.qty_change}
                          </td>
                          <td className="p-4 text-center text-gray-600 font-medium">
                            {log.qty_before} → <span className="font-bold text-gray-800">{log.qty_after}</span>
                          </td>
                          <td className="p-4 text-sm text-gray-500">{log.note || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}