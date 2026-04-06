import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart, Trash2, ScanLine, Banknote, UserRound,
  Plus, Minus, X, CheckCircle2, PackagePlus, Printer,
  ListRestart, QrCode, Tag, LogIn, LogOut, Calculator, Star
} from 'lucide-react';
import { supabase } from '../supabase';
import { QRCodeSVG } from 'qrcode.react';
import generatePayload from 'promptpay-qr';

export default function POSScreen() {
  const [shift, setShift] = useState<{ cashier: string; startCash: number; startTime: Date } | null>(null);
  const [shiftForm, setShiftForm] = useState({ cashier: '', startCash: '' });
  const [shiftStats, setShiftStats] = useState({ cashSales: 0, promptpaySales: 0, bills: 0 });
  const [closeShiftModal, setCloseShiftModal] = useState(false);

  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [dbMembers, setDbMembers] = useState<any[]>([]);
  const [storeSettings, setStoreSettings] = useState({
    store_name: 'กำลังโหลดข้อมูล...', store_address: '', tax_id: '',
    receipt_footer: '*** ขอบคุณที่ใช้บริการ ***'
  });

  const [cartItems, setCartItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentModal, setPaymentModal] = useState(false);
  const [qrModal, setQrModal] = useState(false);
  const [heldBillsModal, setHeldBillsModal] = useState(false);
  const [memberModal, setMemberModal] = useState(false);
  const [discountModal, setDiscountModal] = useState(false);
  const [redeemModal, setRedeemModal] = useState(false);

  const [cashReceived, setCashReceived] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastBill, setLastBill] = useState<any>(null);
  const [heldBills, setHeldBills] = useState<any[]>([]);
  const [currentMember, setCurrentMember] = useState<any>(null);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [pointsUsed, setPointsUsed] = useState<number>(0);
  const [memberSearch, setMemberSearch] = useState('');
  const [redeemInput, setRedeemInput] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    const { data: p } = await supabase.from('products').select('*');
    if (p) setDbProducts(p);
    
    const { data: m } = await supabase.from('members').select('*');
    if (m) setDbMembers(m);
    
    // 🌟 ดึงข้อมูลตั้งค่าร้านค้า
    const { data: s } = await supabase.from('settings').select('*').eq('id', 1).single();
    if (s) setStoreSettings(s);
  };

  useEffect(() => { fetchData(); }, []);

  const handleScanBarcode = (e?: React.KeyboardEvent) => {
    if (e && e.key !== 'Enter') return;
    if (!searchQuery.trim()) return;
    const product = dbProducts.find(p => p.barcode === searchQuery || p.name.includes(searchQuery));
    if (product) {
      if (product.stock_qty <= 0) alert('❌ สินค้านี้สต็อกหมดแล้วครับ!');
      else {
        const existingItem = cartItems.find(item => item.id === product.id);
        if (existingItem && existingItem.qty >= product.stock_qty) alert('❌ ไม่สามารถหยิบเกินจำนวนสต็อกได้ครับ!');
        else if (existingItem) setCartItems(cartItems.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
        else setCartItems([...cartItems, { ...product, qty: 1 }]);
      }
    } else alert('❌ ไม่พบสินค้านี้ในระบบ');
    setSearchQuery(''); searchInputRef.current?.focus();
  };

  const updateQty = (id: number, delta: number) => {
    setCartItems(cartItems.map(item => {
      if (item.id === id) {
        const productInfo = dbProducts.find(p => p.id === id);
        const newQty = item.qty + delta;
        if (delta > 0 && productInfo && newQty > productInfo.stock_qty) { alert('❌ สินค้าในสต็อกไม่พอครับ!'); return item; }
        return newQty > 0 ? { ...item, qty: newQty } : item;
      }
      return item;
    }));
  };

  const removeItem = (id: number) => setCartItems(cartItems.filter(item => item.id !== id));
  const handleNumpad = (num: string) => { setSearchQuery(prev => prev + num); searchInputRef.current?.focus(); };
  const handleNumpadClear = () => setSearchQuery(prev => prev.slice(0, -1));

  const totalQty = cartItems.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = cartItems.reduce((sum, item) => sum + Number(item.price) * item.qty, 0);
  const netTotalPrice = Math.max(0, totalPrice - discountAmount - pointsUsed);
  const change = Number(cashReceived) - netTotalPrice;

  const handleSearchMember = () => {
    const found = dbMembers.find(m => m.phone === memberSearch);
    if (found) { setCurrentMember(found); setMemberModal(false); setMemberSearch(''); }
    else alert('❌ ไม่พบเบอร์โทรสมาชิกนี้ในระบบ');
  };

  const handleRegisterMember = async () => {
    if (!memberSearch || memberSearch.length < 10) return alert('กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลักครับ');
    const name = prompt('กรุณากรอกชื่อลูกค้า:');
    if (!name) return;
    const { data: newMember, error } = await supabase
      .from('members').insert([{ phone: memberSearch, name, points: 0 }]).select().single();
    if (error || !newMember) alert('❌ เบอร์นี้เป็นสมาชิกอยู่แล้ว หรือเกิดข้อผิดพลาด');
    else { fetchData(); setCurrentMember(newMember); setMemberModal(false); setMemberSearch(''); alert('✅ สมัครสมาชิกสำเร็จ!'); }
  };

  const handleRedeemPoints = () => {
    const pts = Number(redeemInput);
    if (!currentMember) return;
    if (pts <= 0) return alert('กรุณากรอกจำนวนแต้มที่ต้องการใช้');
    if (pts > currentMember.points) return alert('❌ แต้มไม่พอ! มีแต้ม ' + currentMember.points + ' แต้ม');
    if (pts > totalPrice - discountAmount) return alert('❌ ไม่สามารถใช้แต้มเกินยอดบิลได้');
    setPointsUsed(pts); setRedeemModal(false); setRedeemInput('');
  };

  const handleHoldBill = () => {
    if (cartItems.length === 0) return alert('ตะกร้าว่างเปล่า');
    setHeldBills([...heldBills, { id: Date.now(), time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }), items: [...cartItems], total: totalPrice, member: currentMember, discount: discountAmount, pointsUsed }]);
    resetCart(); alert('⏸️ พักบิลเรียบร้อยแล้ว');
  };

  const handleRecallBill = (bill: any) => {
    if (cartItems.length > 0 && !confirm('ตะกร้าปัจจุบันจะถูกแทนที่ ต้องการทำต่อหรือไม่?')) return;
    setCartItems(bill.items); setCurrentMember(bill.member); setDiscountAmount(bill.discount); setPointsUsed(bill.pointsUsed || 0);
    setHeldBills(heldBills.filter(b => b.id !== bill.id)); setHeldBillsModal(false);
  };

  const resetCart = () => { setCartItems([]); setCurrentMember(null); setDiscountAmount(0); setPointsUsed(0); setSearchQuery(''); searchInputRef.current?.focus(); };

  const confirmCheckout = async (paymentMethod: 'CASH' | 'PROMPTPAY') => {
    if (paymentMethod === 'CASH' && Number(cashReceived) < netTotalPrice) { alert('❌ รับเงินมาไม่ครบครับ!'); return; }
    setIsProcessing(true);
    try {
      for (const item of cartItems) {
        const { data: fp } = await supabase.from('products').select('stock_qty, name').eq('id', item.id).single();
        if (!fp) continue;
        const qtyAfter = fp.stock_qty - item.qty;
        await supabase.from('products').update({ stock_qty: qtyAfter }).eq('id', item.id);
        await supabase.from('stock_logs').insert([{ product_id: item.id, product_name: fp.name, type: 'sale', qty_change: -item.qty, qty_before: fp.stock_qty, qty_after: qtyAfter, created_by: shift?.cashier ?? 'cashier' }]);
      }
      const earnedPoints = currentMember ? Math.floor(netTotalPrice / 10) : 0;
      if (currentMember) {
        await supabase.from('members').update({ points: Math.max(0, currentMember.points - pointsUsed + earnedPoints) }).eq('id', currentMember.id);
      }
      const { data, error } = await supabase.from('sales').insert([{
        total_amount: netTotalPrice,
        cash_received: paymentMethod === 'PROMPTPAY' ? netTotalPrice : Number(cashReceived),
        change_amount: paymentMethod === 'PROMPTPAY' ? 0 : change,
        items: cartItems,
        cashier_name: shift?.cashier ?? 'ไม่ระบุ',
        payment_method: paymentMethod,
        points_used: pointsUsed
      }]).select();
      if (error) throw error;
      setShiftStats(prev => ({ ...prev, bills: prev.bills + 1, cashSales: paymentMethod === 'CASH' ? prev.cashSales + netTotalPrice : prev.cashSales, promptpaySales: paymentMethod === 'PROMPTPAY' ? prev.promptpaySales + netTotalPrice : prev.promptpaySales }));
      setLastBill({ id: data[0].id, date: new Date().toLocaleString('th-TH'), items: [...cartItems], subTotal: totalPrice, discount: discountAmount, pointsUsed, total: netTotalPrice, cash: paymentMethod === 'PROMPTPAY' ? netTotalPrice : Number(cashReceived), change: paymentMethod === 'PROMPTPAY' ? 0 : change, method: paymentMethod, member: currentMember, earnedPoints });
      resetCart(); setPaymentModal(false); setQrModal(false); setCashReceived('');
      fetchData();
      setTimeout(() => { window.print(); }, 500);
    } catch { alert('❌ เกิดข้อผิดพลาดในการบันทึกข้อมูลครับ'); }
    finally { setIsProcessing(false); }
  };

  useEffect(() => {
    if (!paymentModal && !qrModal && !heldBillsModal && !memberModal && !discountModal && !redeemModal && shift)
      searchInputRef.current?.focus();
  }, [paymentModal, qrModal, heldBillsModal, memberModal, discountModal, redeemModal, cartItems, shift]);

  if (!shift) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 font-sans bg-cover bg-center" style={{backgroundImage:"url('https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=2000&auto=format&fit=crop')"}}>
        <div className="absolute inset-0 bg-blue-900/80 backdrop-blur-sm"/>
        <div className="relative z-10 bg-white p-10 rounded-3xl shadow-2xl w-[500px] text-center">
          <div className="bg-blue-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6"><LogIn size={48} className="text-blue-600"/></div>
          <h1 className="text-4xl font-black text-gray-800 mb-2">{storeSettings.store_name || 'EZ-POS'}</h1>
          <p className="text-gray-500 mb-8 text-lg">{storeSettings.store_address || 'น.เจริญการช่าง'}</p>
          <div className="space-y-5 text-left">
            <div><label className="block text-gray-700 font-bold mb-2 text-sm uppercase tracking-wider">ชื่อแคชเชียร์</label><input type="text" value={shiftForm.cashier} onChange={e => setShiftForm({...shiftForm, cashier: e.target.value})} className="w-full text-xl font-bold p-4 border-2 border-gray-200 rounded-xl outline-none focus:border-blue-500 bg-gray-50"/></div>
            <div><label className="block text-gray-700 font-bold mb-2 text-sm uppercase tracking-wider">เงินทอนตั้งต้น (บาท)</label><input type="number" value={shiftForm.startCash} onChange={e => setShiftForm({...shiftForm, startCash: e.target.value})} className="w-full text-3xl font-black p-4 border-2 border-gray-200 rounded-xl outline-none focus:border-blue-500 bg-green-50 text-green-700 text-center"/></div>
            <button onClick={() => setShift({ cashier: shiftForm.cashier, startCash: Number(shiftForm.startCash), startTime: new Date() })} className="w-full bg-blue-600 text-white text-xl font-bold py-5 rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-200">เข้าสู่ระบบ / เปิดกะ</button>
          </div>
        </div>
      </div>
    );
  }

  const maxRedeemable = Math.min(currentMember?.points ?? 0, Math.floor(totalPrice - discountAmount));

  return (
    <>
      <div className="print:hidden flex h-screen bg-gray-100 font-sans relative">
        <div className="w-2/3 bg-white flex flex-col border-r shadow-sm">
          <div className="bg-blue-800 text-white p-4 flex justify-between items-center shadow-md z-10">
            <div className="flex items-center gap-3 text-2xl font-black"><ShoppingCart size={32}/><span>{storeSettings.store_name || 'EZ-POS'} <span className="text-blue-300 text-lg font-medium">| {storeSettings.store_address}</span></span></div>
            <div className="flex items-center gap-4">
              <Link to="/admin" className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-lg text-sm font-bold"><PackagePlus size={18}/> หลังบ้าน</Link>
              <div className="flex items-center gap-2 bg-blue-900 p-1 rounded-full border border-blue-600">
                <div className="flex items-center gap-2 px-3 py-1 text-sm font-medium"><UserRound size={18} className="text-blue-300"/> {shift.cashier}</div>
                <button onClick={() => setCloseShiftModal(true)} className="bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-1"><LogOut size={16}/> ปิดกะ</button>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
            {cartItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400"><ShoppingCart size={80} className="mb-4 opacity-50"/><p className="text-2xl font-bold">ยังไม่มีสินค้าในตะกร้า</p></div>
            ) : (
              <table className="w-full text-left border-collapse bg-white rounded-xl shadow-sm overflow-hidden">
                <thead className="bg-gray-200/80 text-gray-700 text-sm uppercase"><tr><th className="p-4 text-center">ลำดับ</th><th className="p-4">รายการสินค้า</th><th className="p-4 text-center">จำนวน</th><th className="p-4 text-right">ราคา</th><th className="p-4 text-right">รวม</th><th className="p-4 text-center">ลบ</th></tr></thead>
                <tbody>
                  {cartItems.map((item, index) => {
                    const dbProduct = dbProducts.find(p => p.id === item.id);
                    const isLow = dbProduct && (dbProduct.stock_qty - item.qty) <= (dbProduct.min_stock ?? 5);
                    return (
                      <tr key={item.id} className="border-b hover:bg-blue-50/50">
                        <td className="p-4 text-center text-gray-500">{index + 1}</td>
                        <td className="p-4"><div className="font-bold text-gray-800 text-lg">{item.name}</div>{isLow && <div className="text-xs text-orange-500 font-bold mt-1">เหลือ {dbProduct.stock_qty - item.qty} ชิ้น!</div>}</td>
                        <td className="p-4"><div className="flex items-center justify-center gap-2 bg-gray-100 p-1 rounded-lg"><button onClick={() => updateQty(item.id, -1)} className="p-1 bg-white text-red-500 rounded"><Minus size={18}/></button><span className="w-8 text-center font-bold">{item.qty}</span><button onClick={() => updateQty(item.id, 1)} className="p-1 bg-white text-green-500 rounded"><Plus size={18}/></button></div></td>
                        <td className="p-4 text-right">฿{Number(item.price).toFixed(2)}</td>
                        <td className="p-4 text-right font-black text-blue-700">฿{(Number(item.price) * item.qty).toFixed(2)}</td>
                        <td className="p-4 text-center"><button onClick={() => removeItem(item.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={24}/></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div className="bg-white p-6 border-t-2 border-gray-100 flex justify-between items-end">
            <div><p className="text-gray-500 mb-1">รายการทั้งหมด</p><p className="text-3xl font-black text-gray-800">{totalQty} <span className="text-lg font-normal">ชิ้น</span></p></div>
            <div className="text-right flex flex-col items-end gap-1">
              {discountAmount > 0 && <div className="text-red-500 font-bold text-sm flex items-center gap-1"><Tag size={14}/> ส่วนลด: -฿{discountAmount.toLocaleString()}</div>}
              {pointsUsed > 0 && <div className="text-orange-500 font-bold text-sm flex items-center gap-1"><Star size={14}/> แต้ม {pointsUsed} แต้ม: -฿{pointsUsed.toLocaleString()}</div>}
              <div className="flex items-baseline gap-4"><span className="text-gray-500 text-lg font-bold">ยอดสุทธิ</span><span className="text-6xl font-black text-blue-700 tracking-tighter">฿{netTotalPrice.toLocaleString()}</span></div>
            </div>
          </div>
        </div>

        <div className="w-1/3 bg-gray-100 p-5 flex flex-col gap-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm flex items-center gap-3 border-2 border-blue-100 focus-within:border-blue-500">
            <ScanLine className="text-blue-500" size={28}/>
            <input ref={searchInputRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={handleScanBarcode} placeholder="สแกนรหัส..." className="w-full text-2xl font-bold outline-none bg-transparent text-gray-700"/>
          </div>

          {currentMember && (
            <div className="bg-gradient-to-r from-orange-400 to-orange-500 text-white p-3 rounded-2xl flex flex-col gap-2 px-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 font-bold"><UserRound size={18}/> {currentMember.name}</div>
                <div className="flex items-center gap-2">
                  <div className="bg-white text-orange-600 px-3 py-1 rounded-lg text-sm font-black">{currentMember.points} แต้ม</div>
                  <button onClick={() => setCurrentMember(null)} className="text-white hover:text-orange-200"><X size={18}/></button>
                </div>
              </div>
              {currentMember.points > 0 && cartItems.length > 0 && (
                <button onClick={() => { setRedeemInput(pointsUsed > 0 ? String(pointsUsed) : ''); setRedeemModal(true); }} className="bg-white/20 hover:bg-white/30 text-white text-sm font-bold py-2 rounded-xl flex items-center justify-center gap-2">
                  <Star size={16}/>
                  {pointsUsed > 0 ? `ใช้แต้มแล้ว ${pointsUsed} แต้ม (-฿${pointsUsed}) — แก้ไข` : `ใช้แต้มแลกส่วนลด (มี ${currentMember.points} แต้ม)`}
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setMemberModal(true)} disabled={!!currentMember} className="bg-orange-100 text-orange-700 py-3 rounded-2xl font-bold text-lg hover:bg-orange-200 disabled:opacity-50 flex items-center justify-center gap-2"><UserRound size={20}/> สมาชิก</button>
            <button onClick={() => setDiscountModal(true)} className="bg-pink-100 text-pink-700 py-3 rounded-2xl font-bold text-lg hover:bg-pink-200 flex items-center justify-center gap-2"><Tag size={20}/> ส่วนลด</button>
            <button onClick={() => setHeldBillsModal(true)} className="bg-yellow-100 text-yellow-700 py-3 rounded-2xl font-bold text-lg hover:bg-yellow-200 flex items-center justify-center gap-2"><ListRestart size={20}/> บิลพัก ({heldBills.length})</button>
            <button onClick={() => { if(confirm('ต้องการยกเลิกบิลนี้ใช่หรือไม่?')) resetCart(); }} className="bg-red-100 text-red-700 py-3 rounded-2xl font-bold text-lg hover:bg-red-200 flex items-center justify-center gap-2"><Trash2 size={20}/> ทิ้งบิล</button>
          </div>

          <div className="flex-1 grid grid-cols-3 gap-3">
            {['7','8','9','4','5','6','1','2','3'].map(num => (<button key={num} onClick={() => handleNumpad(num)} className="bg-white text-4xl font-bold text-gray-700 rounded-2xl shadow-sm hover:bg-blue-50 border border-gray-100">{num}</button>))}
            <button onClick={() => handleNumpad('0')} className="bg-white text-4xl font-bold text-gray-700 rounded-2xl shadow-sm hover:bg-blue-50 col-span-2 border border-gray-100">0</button>
            <button onClick={handleNumpadClear} className="bg-gray-300 text-2xl font-bold text-gray-700 rounded-2xl shadow-sm hover:bg-gray-400">ลบ</button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button disabled={cartItems.length === 0} onClick={() => setQrModal(true)} className="bg-indigo-600 text-white py-5 rounded-2xl font-bold text-2xl flex flex-col justify-center items-center gap-2 shadow-lg hover:bg-indigo-700 disabled:opacity-50"><QrCode size={32}/> สแกนจ่าย</button>
            <button disabled={cartItems.length === 0} onClick={() => setPaymentModal(true)} className="bg-green-500 text-white py-5 rounded-2xl font-bold text-2xl flex flex-col justify-center items-center gap-2 shadow-lg hover:bg-green-600 disabled:opacity-50"><Banknote size={32}/> รับเงินสด</button>
          </div>
        </div>

        {closeShiftModal && (<div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"><div className="bg-white w-[500px] rounded-3xl shadow-2xl overflow-hidden"><div className="bg-red-500 text-white p-6 flex justify-between items-center"><h2 className="text-2xl font-black flex items-center gap-2"><LogOut size={28}/> สรุปยอดปิดกะ</h2><button onClick={() => setCloseShiftModal(false)} className="hover:bg-white/20 p-2 rounded-full"><X size={24}/></button></div><div className="p-8"><div className="text-center mb-4"><p className="text-xl font-black">{shift.cashier}</p></div><div className="bg-gray-50 border-2 border-gray-100 rounded-2xl p-6 space-y-4 mb-6"><div className="flex justify-between text-gray-600"><span>เงินทอนเริ่มต้น:</span><span className="font-bold">฿{shift.startCash.toLocaleString()}</span></div><div className="flex justify-between text-gray-600"><span>ยอดเงินสด:</span><span className="font-bold text-green-600">+ ฿{shiftStats.cashSales.toLocaleString()}</span></div><div className="flex justify-between text-gray-600 border-b-2 border-dashed border-gray-200 pb-4"><span>ยอดโอน QR:</span><span className="font-bold text-indigo-600">+ ฿{shiftStats.promptpaySales.toLocaleString()}</span></div><div className="flex justify-between pt-2"><span className="font-bold flex items-center gap-2"><Calculator size={20}/> เงินสดที่ต้องมี:</span><span className="font-black text-3xl text-red-600">฿{(shift.startCash + shiftStats.cashSales).toLocaleString()}</span></div></div><button onClick={() => { setShift(null); setCloseShiftModal(false); setShiftStats({ cashSales: 0, promptpaySales: 0, bills: 0 }); }} className="w-full bg-gray-800 text-white text-xl font-bold py-4 rounded-xl hover:bg-black">ยืนยันปิดกะ</button></div></div></div>)}
        {memberModal && (<div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50"><div className="bg-white w-[400px] rounded-3xl p-6"><div className="flex justify-between mb-6"><h2 className="text-2xl font-black text-orange-600">ค้นหาสมาชิก</h2><button onClick={() => setMemberModal(false)}><X/></button></div><input type="text" autoFocus value={memberSearch} onChange={e=>setMemberSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSearchMember()} className="w-full border-2 p-3 rounded-xl mb-4 text-xl font-bold" placeholder="เบอร์โทรศัพท์ 10 หลัก"/><button onClick={handleSearchMember} className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold text-lg mb-3">ค้นหาสมาชิก</button><button onClick={handleRegisterMember} className="w-full border-2 border-orange-400 text-orange-600 py-3 rounded-xl font-bold text-lg hover:bg-orange-50">+ สมัครสมาชิกใหม่</button></div></div>)}
        {discountModal && (<div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50"><div className="bg-white w-[400px] rounded-3xl p-6"><div className="flex justify-between mb-6"><h2 className="text-2xl font-black text-pink-600">ใส่ส่วนลดท้ายบิล</h2><button onClick={() => setDiscountModal(false)}><X/></button></div><input type="number" autoFocus placeholder="ยอดส่วนลด (บาท)" onKeyDown={e => { if(e.key==='Enter'){setDiscountAmount(Number((e.target as HTMLInputElement).value));setDiscountModal(false);}}} className="w-full border-2 p-4 rounded-xl text-3xl font-bold text-center text-pink-600"/></div></div>)}
        {heldBillsModal && (<div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50"><div className="bg-white w-[500px] rounded-3xl p-6 max-h-[80vh] flex flex-col"><div className="flex justify-between mb-6"><h2 className="text-2xl font-black text-yellow-600">บิลที่พักไว้</h2><button onClick={() => setHeldBillsModal(false)}><X/></button></div><div className="overflow-y-auto flex-1 space-y-3">{heldBills.length===0?<p className="text-center text-gray-400 py-10">ไม่มีบิลพัก</p>:heldBills.map(bill=>(<div key={bill.id} className="border-2 border-gray-100 rounded-xl p-4 flex justify-between items-center"><div><p className="font-bold">{bill.items.length} รายการ | ฿{bill.total.toLocaleString()}</p><p className="text-sm text-gray-400">{bill.time}</p></div><button onClick={()=>handleRecallBill(bill)} className="bg-yellow-500 text-white px-4 py-2 rounded-lg font-bold">เรียกคืน</button></div>))}</div><button onClick={handleHoldBill} disabled={cartItems.length===0} className="mt-4 w-full border-2 border-yellow-500 text-yellow-600 py-3 rounded-xl font-bold hover:bg-yellow-50 disabled:opacity-50">⏸️ พักบิลปัจจุบัน</button></div></div>)}

        {redeemModal && currentMember && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-white w-[420px] rounded-3xl p-6">
              <div className="flex justify-between mb-2"><h2 className="text-2xl font-black text-orange-600 flex items-center gap-2"><Star size={24}/> ใช้แต้มแลกส่วนลด</h2><button onClick={() => setRedeemModal(false)}><X/></button></div>
              <p className="text-gray-500 mb-4 text-sm">1 แต้ม = ลด ฿1 | แต้มที่มี: <span className="font-black text-orange-600">{currentMember.points} แต้ม</span></p>
              <div className="bg-orange-50 rounded-2xl p-4 mb-4 flex justify-between"><span className="text-gray-600 font-bold">ยอดบิลหลังส่วนลด</span><span className="font-black">฿{(totalPrice - discountAmount).toLocaleString()}</span></div>
              <input type="number" autoFocus placeholder={`กรอกจำนวนแต้ม (สูงสุด ${maxRedeemable})`} value={redeemInput} onChange={e => setRedeemInput(e.target.value)} max={maxRedeemable} min={0} className="w-full border-2 p-4 rounded-xl text-3xl font-bold text-center text-orange-600 outline-none focus:border-orange-500 mb-2"/>
              <p className="text-center text-gray-500 text-sm mb-4">= ลด ฿{Number(redeemInput||0).toLocaleString()}</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[10,50,100].filter(v=>v<=maxRedeemable).map(v=>(<button key={v} onClick={()=>setRedeemInput(String(v))} className="bg-orange-100 text-orange-700 py-2 rounded-xl font-bold hover:bg-orange-200">{v} แต้ม</button>))}
                <button onClick={()=>setRedeemInput(String(maxRedeemable))} className="bg-orange-500 text-white py-2 rounded-xl font-bold hover:bg-orange-600 col-span-3">ใช้ทั้งหมด {maxRedeemable} แต้ม</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {pointsUsed > 0 && <button onClick={()=>{setPointsUsed(0);setRedeemModal(false);setRedeemInput('');}} className="border-2 border-gray-300 text-gray-600 py-3 rounded-xl font-bold">ยกเลิกการใช้แต้ม</button>}
                <button onClick={handleRedeemPoints} className={`bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 ${pointsUsed>0?'':'col-span-2'}`}>ยืนยันใช้แต้ม</button>
              </div>
            </div>
          </div>
        )}

        {paymentModal && (<div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"><div className="bg-white w-[500px] rounded-3xl shadow-2xl overflow-hidden"><div className="bg-green-500 text-white p-6 flex justify-between items-center"><h2 className="text-3xl font-black flex items-center gap-2"><Banknote size={36}/> รับชำระเงินสด</h2><button onClick={()=>setPaymentModal(false)} className="hover:bg-white/20 p-2 rounded-full"><X size={28}/></button></div><div className="p-8 space-y-6"><div className="flex justify-between items-center text-xl"><span className="text-gray-500">ยอดที่ต้องชำระ:</span><span className="text-4xl font-black">฿{netTotalPrice.toLocaleString()}</span></div><input type="number" autoFocus value={cashReceived} onChange={e=>setCashReceived(e.target.value)} className="w-full text-5xl font-black text-green-600 p-4 border-2 border-green-200 rounded-xl outline-none focus:border-green-500 bg-green-50" placeholder="0.00"/><div className="grid grid-cols-4 gap-2">{[100,500,1000,netTotalPrice].map(amount=>(<button key={amount} onClick={()=>setCashReceived(amount.toString())} className="bg-gray-100 py-3 rounded-lg font-bold hover:bg-gray-200">{amount===netTotalPrice?'พอดี':`฿${amount}`}</button>))}</div>{Number(cashReceived)>=netTotalPrice&&(<div className="pt-4 border-t-2 border-dashed flex justify-between items-center"><span className="text-gray-500 text-xl">เงินทอน:</span><span className="text-5xl font-black text-orange-500">฿{change.toLocaleString()}</span></div>)}<button onClick={()=>confirmCheckout('CASH')} disabled={isProcessing} className="w-full bg-blue-600 text-white text-2xl font-bold py-5 rounded-xl hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center gap-2 shadow-lg">{isProcessing?'กำลังประมวลผล...':<><Printer size={32}/> พิมพ์ใบเสร็จ</>}</button></div></div></div>)}
        {qrModal && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white w-[450px] rounded-3xl shadow-2xl overflow-hidden flex flex-col items-center pb-8">
              <div className="bg-indigo-600 text-white p-6 flex justify-between items-center w-full mb-6">
                <h2 className="text-2xl font-black flex items-center gap-2"><QrCode size={28}/> Thai QR Payment</h2>
                <button onClick={()=>setQrModal(false)} className="hover:bg-white/20 p-2 rounded-full"><X size={24}/></button>
              </div>
              <p className="text-5xl font-black text-indigo-600 mb-6">฿{netTotalPrice.toLocaleString()}</p>
              
              {/* 🌟 จุดที่แก้ไข: เปลี่ยนเบอร์ตรงนี้ครับ 🌟 */}
              <div className="bg-white p-4 rounded-2xl shadow-md border-4 border-indigo-100 mb-6">
                <QRCodeSVG 
                  value={generatePayload(storeSettings.promptpay_no || "0658254057", { amount: netTotalPrice })} 
                  size={200} 
                  level={"M"}
                />
              </div>

              <button onClick={()=>confirmCheckout('PROMPTPAY')} disabled={isProcessing} className="w-4/5 bg-green-500 text-white text-xl font-bold py-4 rounded-xl hover:bg-green-600 disabled:opacity-50 flex justify-center items-center gap-2">
                {isProcessing ? 'กำลังตรวจสอบ...' : <><CheckCircle2 size={28}/> ยืนยันรับเงินโอน</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 🌟 พิมพ์สลิป (เฉพาะตอนสั่งพิมพ์) 🌟 */}
      {lastBill && (
        <div className="hidden print:block text-black bg-white p-4 mx-auto" style={{ width: '80mm', fontFamily: 'monospace' }}>
          
          {/* ส่วนหัวใบเสร็จ ดึงจากตั้งค่า */}
          <div className="text-center mb-3">
            <h1 className="text-2xl font-black mb-1">{storeSettings.store_name || 'EZ-POS'}</h1>
            {storeSettings.store_address && <p className="text-sm">{storeSettings.store_address}</p>}
            {storeSettings.tax_id && <p className="text-xs mt-1 font-bold">TAX ID: {storeSettings.tax_id}</p>}
          </div>
          
          {/* วันที่และเลขบิล */}
          <div className="text-xs text-center border-b border-black pb-2 mb-2">
            วันที่: {lastBill.date} | บิล: #{lastBill.id.toString().padStart(6, '0')}
          </div>
          
          {/* รายการสินค้า */}
          <table className="w-full text-sm mb-2">
            <tbody className="align-top">
              {lastBill.items.map((item: any) => (
                <tr key={item.id}>
                  <td className="py-1">
                    <div className="font-bold">{item.name}</div>
                    <div className="text-xs text-gray-600">{item.qty} x {Number(item.price).toFixed(2)}</div>
                  </td>
                  <td className="py-1 text-right font-bold">{(item.qty * Number(item.price)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* สรุปยอดเงิน */}
          <div className="border-t border-dashed border-black pt-2 text-sm">
            <div className="flex justify-between"><span>รวมเป็นเงิน:</span><span>{lastBill.subTotal.toFixed(2)}</span></div>
            {lastBill.discount > 0 && <div className="flex justify-between text-red-600 font-bold"><span>ส่วนลด:</span><span>-{lastBill.discount.toFixed(2)}</span></div>}
            {lastBill.pointsUsed > 0 && <div className="flex justify-between text-orange-600 font-bold"><span>ใช้แต้ม {lastBill.pointsUsed} แต้ม:</span><span>-{lastBill.pointsUsed.toFixed(2)}</span></div>}
            
            <div className="flex justify-between font-black text-lg mt-1 border-t border-black pt-1"><span>ยอดสุทธิ:</span><span>{lastBill.total.toFixed(2)}</span></div>
            
            {lastBill.method === 'PROMPTPAY' ? (
              <div className="flex justify-between mt-2"><span>ชำระผ่าน:</span><span>เงินโอน/QR</span></div>
            ) : (
              <>
                <div className="flex justify-between mt-2"><span>รับเงินสด:</span><span>{lastBill.cash.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>เงินทอน:</span><span>{lastBill.change.toFixed(2)}</span></div>
              </>
            )}
          </div>
          
          {/* ข้อมูลสมาชิกท้ายบิล */}
          {lastBill.member && (
            <div className="border-t border-dashed border-black mt-3 pt-2 text-xs text-center">
              <p className="font-bold">สมาชิก: {lastBill.member.name}</p>
              {lastBill.pointsUsed > 0 && <p>ใช้แต้ม: -{lastBill.pointsUsed} แต้ม</p>}
              <p>ได้รับแต้มเพิ่ม: +{lastBill.earnedPoints} แต้ม</p>
              {/* คำนวณแต้มคงเหลือ */}
              <p>แต้มคงเหลือ: {Math.max(0, lastBill.member.points - lastBill.pointsUsed + lastBill.earnedPoints)} แต้ม</p>
            </div>
          )}
          
          {/* ส่วนท้ายใบเสร็จ ดึงจากตั้งค่า */}
          <div className="text-center text-xs mt-4">
            <p className="font-bold">{storeSettings.receipt_footer || '*** ขอบคุณที่ใช้บริการ ***'}</p>
            <p className="mt-1 text-gray-500">Cashier: {shift?.cashier}</p>
          </div>
        </div>
      )}
    </>
  );
}