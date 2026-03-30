import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Settings, ArrowLeft, Save, Store, MapPin, Receipt, FileText, Phone, QrCode } from 'lucide-react';
import { supabase } from '../supabase';

export default function SettingsScreen() {
  const [form, setForm] = useState({ 
    id: 1, 
    store_name: '', 
    store_address: '', 
    store_phone: '',      // 🌟 เพิ่มเบอร์โทร
    promptpay_no: '',     // 🌟 เพิ่มพร้อมเพย์
    tax_id: '', 
    receipt_footer: '' 
  });
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = async () => {
    const { data } = await supabase.from('settings').select('*').eq('id', 1).single();
    if (data) setForm(data);
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const { error } = await supabase.from('settings').update({
      store_name: form.store_name,
      store_address: form.store_address,
      store_phone: form.store_phone,
      promptpay_no: form.promptpay_no,
      tax_id: form.tax_id,
      receipt_footer: form.receipt_footer
    }).eq('id', 1);

    setIsSaving(false);
    if (!error) alert('✅ บันทึกการตั้งค่าร้านค้าสำเร็จ!\n\nข้อมูลใหม่จะถูกใช้งานในการรับชำระเงินและพิมพ์ใบเสร็จบิลถัดไปครับ');
    else alert('❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล');
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border-t-4 border-purple-500">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 p-3 rounded-xl"><Settings className="text-purple-600" size={32} /></div>
            <div><h1 className="text-2xl font-black text-gray-800">ตั้งค่าระบบร้านค้า</h1><p className="text-gray-500">จัดการข้อมูลพื้นฐาน และช่องทางรับชำระเงิน</p></div>
          </div>
          <Link to="/admin" className="flex items-center gap-2 bg-gray-800 text-white px-5 py-3 rounded-xl font-bold hover:bg-gray-700 shadow-sm"><ArrowLeft size={20} /> กลับหลังบ้าน</Link>
        </div>

        {/* Form ตั้งค่า */}
        <div className="bg-white p-8 rounded-2xl shadow-sm">
          <form onSubmit={handleSaveSettings} className="space-y-8">
            
            {/* หมวด 1: ข้อมูลร้าน */}
            <div>
              <h2 className="text-lg font-black text-gray-800 mb-4 border-b-2 border-gray-100 pb-2">1. ข้อมูลร้านค้า (แสดงบนใบเสร็จ)</h2>
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="text-gray-700 font-bold mb-2 flex items-center gap-2"><Store size={20} className="text-purple-500"/> ชื่อร้านค้า / สาขา</label>
                  <input type="text" value={form.store_name || ''} onChange={e => setForm({...form, store_name: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl p-4 text-xl font-bold outline-none focus:border-purple-500" required />
                </div>
                
                <div className="col-span-2">
                  <label className="text-gray-700 font-bold mb-2 flex items-center gap-2"><MapPin size={20} className="text-purple-500"/> ที่อยู่ร้าน</label>
                  <textarea value={form.store_address || ''} onChange={e => setForm({...form, store_address: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl p-4 font-medium outline-none focus:border-purple-500" rows={2} />
                </div>

                <div>
                  <label className="text-gray-700 font-bold mb-2 flex items-center gap-2"><Phone size={20} className="text-purple-500"/> เบอร์โทรศัพท์ติดต่อ</label>
                  <input type="text" value={form.store_phone || ''} onChange={e => setForm({...form, store_phone: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl p-4 font-medium outline-none focus:border-purple-500" placeholder="เช่น 089-111-2222" />
                </div>

                <div>
                  <label className="text-gray-700 font-bold mb-2 flex items-center gap-2"><FileText size={20} className="text-purple-500"/> เลขประจำตัวผู้เสียภาษี</label>
                  <input type="text" value={form.tax_id || ''} onChange={e => setForm({...form, tax_id: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl p-4 font-medium outline-none focus:border-purple-500" />
                </div>
              </div>
            </div>

            {/* หมวด 2: การชำระเงินและใบเสร็จ */}
            <div>
              <h2 className="text-lg font-black text-gray-800 mb-4 border-b-2 border-gray-100 pb-2">2. การชำระเงิน & ใบเสร็จ</h2>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-gray-700 font-bold mb-2 flex items-center gap-2"><QrCode size={20} className="text-indigo-500"/> เบอร์พร้อมเพย์ (รับเงินเข้า)</label>
                  <input type="text" value={form.promptpay_no || ''} onChange={e => setForm({...form, promptpay_no: e.target.value})} className="w-full border-2 border-indigo-200 bg-indigo-50 rounded-xl p-4 text-xl font-bold outline-none focus:border-indigo-500" placeholder="ใส่เบอร์มือถือ หรือ เลขบัตร ปชช." required />
                </div>
                
                <div>
                  <label className="text-gray-700 font-bold mb-2 flex items-center gap-2"><Receipt size={20} className="text-purple-500"/> ข้อความลงท้ายใบเสร็จ</label>
                  <input type="text" value={form.receipt_footer || ''} onChange={e => setForm({...form, receipt_footer: e.target.value})} className="w-full border-2 border-gray-200 rounded-xl p-4 text-xl font-medium outline-none focus:border-purple-500" placeholder="เช่น ขอบคุณที่ใช้บริการ" />
                </div>
              </div>
            </div>

            <button type="submit" disabled={isSaving} className="w-full bg-purple-600 text-white text-2xl font-bold py-5 rounded-xl mt-8 hover:bg-purple-700 active:scale-95 transition-all shadow-lg shadow-purple-200 flex justify-center items-center gap-2">
              <Save size={28} /> {isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าทั้งหมด'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}