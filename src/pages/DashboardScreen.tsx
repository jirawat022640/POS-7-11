import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, TrendingUp, TrendingDown, BarChart3,
  Users, ShoppingBag, Wallet, RefreshCw, Calendar,
  Award, UserRound, Receipt
} from 'lucide-react';
import { supabase } from '../supabase';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';

type Period = 'today' | 'week' | 'month';

export default function DashboardScreen() {
  const [period, setPeriod] = useState<Period>('today');
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = async () => {
    setIsLoading(true);
    const { data: sData } = await supabase.from('sales').select('*').order('created_at', { ascending: true });
    const { data: pData } = await supabase.from('products').select('*');
    const { data: mData } = await supabase.from('members').select('*');
    if (sData) setSales(sData);
    if (pData) setProducts(pData);
    if (mData) setMembers(mData);
    setIsLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // ---- กรองช่วงเวลา ----
  const now = new Date();
  const filteredSales = sales.filter(s => {
    const d = new Date(s.created_at);
    if (period === 'today') {
      return d.toDateString() === now.toDateString();
    } else if (period === 'week') {
      const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 6);
      return d >= weekAgo;
    } else {
      const monthAgo = new Date(now); monthAgo.setDate(now.getDate() - 29);
      return d >= monthAgo;
    }
  });

  // ---- KPI หลัก ----
  const totalRevenue = filteredSales.reduce((sum, s) => sum + Number(s.total_amount), 0);
  const totalBills = filteredSales.length;
  const avgBillValue = totalBills > 0 ? totalRevenue / totalBills : 0;

  // คำนวณกำไรขั้นต้น (revenue - ต้นทุน)
  const totalCost = filteredSales.reduce((sum, s) => {
    return sum + s.items.reduce((iSum: number, item: any) => {
      const product = products.find(p => p.id === item.id);
      const cost = product?.cost_price ?? 0;
      return iSum + cost * item.qty;
    }, 0);
  }, 0);
  const grossProfit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0';

  // ---- กราฟยอดขายตามวัน ----
  const salesByDay = (() => {
    const map: Record<string, { revenue: number; profit: number; bills: number }> = {};
    const days = period === 'today' ? 1 : period === 'week' ? 7 : 30;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      const key = d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' });
      map[key] = { revenue: 0, profit: 0, bills: 0 };
    }
    filteredSales.forEach(s => {
      const key = new Date(s.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' });
      if (map[key]) {
        map[key].revenue += Number(s.total_amount);
        map[key].bills += 1;
        const cost = s.items.reduce((sum: number, item: any) => {
          const p = products.find(pr => pr.id === item.id);
          return sum + (p?.cost_price ?? 0) * item.qty;
        }, 0);
        map[key].profit += Number(s.total_amount) - cost;
      }
    });
    return Object.entries(map).map(([date, val]) => ({ date, ...val }));
  })();

  // ---- Top สินค้า ----
  const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
  filteredSales.forEach(s => {
    s.items.forEach((item: any) => {
      if (!productSales[item.id]) productSales[item.id] = { name: item.name, qty: 0, revenue: 0 };
      productSales[item.id].qty += item.qty;
      productSales[item.id].revenue += item.qty * Number(item.price);
    });
  });
  const topProducts = Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // ---- รายงานตามพนักงาน ----
  const staffReport: Record<string, { name: string; bills: number; revenue: number; cashSales: number; qrSales: number }> = {};
  filteredSales.forEach(s => {
    const name = s.cashier_name || 'ไม่ระบุ';
    if (!staffReport[name]) staffReport[name] = { name, bills: 0, revenue: 0, cashSales: 0, qrSales: 0 };
    staffReport[name].bills += 1;
    staffReport[name].revenue += Number(s.total_amount);
    if (s.payment_method === 'PROMPTPAY') staffReport[name].qrSales += Number(s.total_amount);
    else staffReport[name].cashSales += Number(s.total_amount);
  });
  const staffList = Object.values(staffReport).sort((a, b) => b.revenue - a.revenue);

  // ---- ช่องทางชำระ ----
  const cashTotal = filteredSales.filter(s => s.payment_method !== 'PROMPTPAY').reduce((sum, s) => sum + Number(s.total_amount), 0);
  const qrTotal = filteredSales.filter(s => s.payment_method === 'PROMPTPAY').reduce((sum, s) => sum + Number(s.total_amount), 0);

  const periodLabel = { today: 'วันนี้', week: '7 วันที่ผ่านมา', month: '30 วันที่ผ่านมา' };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="text-center text-gray-500">
          <RefreshCw size={48} className="mx-auto mb-4 animate-spin text-blue-500" />
          <p className="font-bold text-lg">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border-t-4 border-blue-600">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-3 rounded-xl"><BarChart3 className="text-blue-600" size={32} /></div>
            <div>
              <h1 className="text-2xl font-black text-gray-800">Dashboard รายงาน</h1>
              <p className="text-gray-500">ภาพรวมธุรกิจสำหรับเจ้าของ</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchAll} className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-xl font-bold hover:bg-gray-200">
              <RefreshCw size={18} /> รีโหลด
            </button>
            <Link to="/admin" className="flex items-center gap-2 bg-gray-800 text-white px-5 py-3 rounded-xl font-bold hover:bg-gray-700">
              <ArrowLeft size={20} /> กลับหลังบ้าน
            </Link>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex gap-3">
          {(['today', 'week', 'month'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
                period === p
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                  : 'bg-white text-gray-600 hover:bg-gray-50 shadow-sm'
              }`}
            >
              <Calendar size={18} /> {periodLabel[p]}
            </button>
          ))}
          <div className="ml-auto bg-white px-5 py-3 rounded-xl font-bold text-gray-500 shadow-sm flex items-center gap-2">
            <Receipt size={18} /> {filteredSales.length} บิล ใน{periodLabel[period]}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-500 font-bold text-sm">ยอดขายรวม</p>
              <div className="bg-blue-100 p-2 rounded-lg"><Wallet className="text-blue-600" size={20}/></div>
            </div>
            <p className="text-4xl font-black text-blue-600">฿{totalRevenue.toLocaleString()}</p>
            <p className="text-gray-400 text-xs mt-2">{periodLabel[period]}</p>
          </div>

          <div className={`bg-white p-6 rounded-2xl shadow-sm border-l-4 ${grossProfit >= 0 ? 'border-green-500' : 'border-red-500'}`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-500 font-bold text-sm">กำไรขั้นต้น</p>
              <div className={`p-2 rounded-lg ${grossProfit >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                {grossProfit >= 0 ? <TrendingUp className="text-green-600" size={20}/> : <TrendingDown className="text-red-600" size={20}/>}
              </div>
            </div>
            <p className={`text-4xl font-black ${grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ฿{grossProfit.toLocaleString()}
            </p>
            <p className="text-gray-400 text-xs mt-2">Margin {profitMargin}%{totalCost === 0 && ' (ยังไม่มีราคาทุน)'}</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-500 font-bold text-sm">เฉลี่ยต่อบิล</p>
              <div className="bg-orange-100 p-2 rounded-lg"><ShoppingBag className="text-orange-600" size={20}/></div>
            </div>
            <p className="text-4xl font-black text-orange-600">฿{avgBillValue.toFixed(0)}</p>
            <p className="text-gray-400 text-xs mt-2">จาก {totalBills} บิล</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-500 font-bold text-sm">สมาชิกทั้งหมด</p>
              <div className="bg-purple-100 p-2 rounded-lg"><Users className="text-purple-600" size={20}/></div>
            </div>
            <p className="text-4xl font-black text-purple-600">{members.length}</p>
            <p className="text-gray-400 text-xs mt-2">คน</p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-3 gap-6">
          {/* กราฟยอดขาย */}
          <div className="col-span-2 bg-white p-6 rounded-2xl shadow-sm">
            <h2 className="font-black text-gray-800 mb-5 flex items-center gap-2">
              <TrendingUp size={20} className="text-blue-500" /> ยอดขาย vs กำไร ({periodLabel[period]})
            </h2>
            <ResponsiveContainer width="100%" height={260}>
              {period === 'today' ? (
                <BarChart data={salesByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => `฿${Number(v).toLocaleString()}`} />
                  <Legend />
                  <Bar dataKey="revenue" name="ยอดขาย" fill="#3b82f6" radius={[4,4,0,0]} />
                  <Bar dataKey="profit" name="กำไร" fill="#22c55e" radius={[4,4,0,0]} />
                </BarChart>
              ) : (
                <LineChart data={salesByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={period === 'month' ? 4 : 0} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => `฿${Number(v).toLocaleString()}`} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" name="ยอดขาย" stroke="#3b82f6" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="profit" name="กำไร" stroke="#22c55e" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* ช่องทางชำระ */}
          <div className="bg-white p-6 rounded-2xl shadow-sm">
            <h2 className="font-black text-gray-800 mb-5">💳 ช่องทางชำระเงิน</h2>
            <div className="space-y-4">
              <div className="bg-green-50 rounded-2xl p-5">
                <p className="text-gray-500 font-bold text-sm mb-1">เงินสด</p>
                <p className="text-3xl font-black text-green-600">฿{cashTotal.toLocaleString()}</p>
                <p className="text-gray-400 text-xs mt-1">
                  {totalRevenue > 0 ? ((cashTotal / totalRevenue) * 100).toFixed(0) : 0}% ของยอดรวม
                </p>
                {/* Progress bar */}
                <div className="mt-3 h-2 bg-gray-200 rounded-full">
                  <div className="h-2 bg-green-500 rounded-full" style={{ width: totalRevenue > 0 ? `${(cashTotal / totalRevenue) * 100}%` : '0%' }} />
                </div>
              </div>
              <div className="bg-indigo-50 rounded-2xl p-5">
                <p className="text-gray-500 font-bold text-sm mb-1">QR / โอนเงิน</p>
                <p className="text-3xl font-black text-indigo-600">฿{qrTotal.toLocaleString()}</p>
                <p className="text-gray-400 text-xs mt-1">
                  {totalRevenue > 0 ? ((qrTotal / totalRevenue) * 100).toFixed(0) : 0}% ของยอดรวม
                </p>
                <div className="mt-3 h-2 bg-gray-200 rounded-full">
                  <div className="h-2 bg-indigo-500 rounded-full" style={{ width: totalRevenue > 0 ? `${(qrTotal / totalRevenue) * 100}%` : '0%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-2 gap-6">
          {/* Top สินค้า */}
          <div className="bg-white p-6 rounded-2xl shadow-sm">
            <h2 className="font-black text-gray-800 mb-5 flex items-center gap-2">
              <Award size={20} className="text-orange-500" /> Top 5 สินค้าขายดี
            </h2>
            {topProducts.length === 0 ? (
              <p className="text-center text-gray-400 py-10">ยังไม่มีข้อมูล</p>
            ) : (
              <div className="space-y-3">
                {topProducts.map((p, i) => {
                  const maxRevenue = topProducts[0].revenue;
                  return (
                    <div key={p.name}>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center text-white ${i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-400' : 'bg-gray-200 text-gray-600'}`}>
                            {i + 1}
                          </span>
                          <span className="font-bold text-gray-800">{p.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-green-600">฿{p.revenue.toLocaleString()}</span>
                          <span className="text-gray-400 text-xs ml-2">({p.qty} ชิ้น)</span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full">
                        <div className="h-2 bg-orange-400 rounded-full transition-all" style={{ width: `${(p.revenue / maxRevenue) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* รายงานพนักงาน */}
          <div className="bg-white p-6 rounded-2xl shadow-sm">
            <h2 className="font-black text-gray-800 mb-5 flex items-center gap-2">
              <UserRound size={20} className="text-blue-500" /> ยอดขายแยกตามพนักงาน
            </h2>
            {staffList.length === 0 ? (
              <p className="text-center text-gray-400 py-10">ยังไม่มีข้อมูล</p>
            ) : (
              <div className="space-y-3">
                {staffList.map((staff, i) => (
                  <div key={staff.name} className={`p-4 rounded-xl border-2 ${i === 0 ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        {i === 0 && <Award size={16} className="text-yellow-500" />}
                        <span className="font-black text-gray-800">{staff.name}</span>
                      </div>
                      <span className="font-black text-blue-600 text-xl">฿{staff.revenue.toLocaleString()}</span>
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      <span>{staff.bills} บิล</span>
                      <span>เงินสด ฿{staff.cashSales.toLocaleString()}</span>
                      <span>QR ฿{staff.qrSales.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}