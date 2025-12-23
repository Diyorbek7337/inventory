import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Package, DollarSign, ShoppingCart,
  ArrowUpRight, ArrowDownRight, Calendar, Eye, EyeOff,
  ChevronLeft, ChevronRight, BarChart3, PieChart, Clock
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell } from 'recharts';

const Dashboard = ({ products = [], transactions = [], isAdmin = false, companyData = null }) => {
  const [showProfit, setShowProfit] = useState(false);
  const [filterType, setFilterType] = useState('daily'); // daily, weekly, monthly, yearly
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dateRange, setDateRange] = useState({ start: new Date(), end: new Date() });

  // Sana bo'yicha filter
  useEffect(() => {
    const now = new Date();
    let start, end;

    switch (filterType) {
      case 'daily':
        start = new Date(selectedDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(selectedDate);
        end.setHours(23, 59, 59, 999);
        break;
      case 'weekly':
        start = new Date(selectedDate);
        start.setDate(start.getDate() - start.getDay()); // Dushanba
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case 'monthly':
        start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case 'yearly':
        start = new Date(selectedDate.getFullYear(), 0, 1);
        end = new Date(selectedDate.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      default:
        start = new Date();
        end = new Date();
    }

    setDateRange({ start, end });
  }, [filterType, selectedDate]);

  // Navigatsiya
  const navigateDate = (direction) => {
    const newDate = new Date(selectedDate);
    switch (filterType) {
      case 'daily':
        newDate.setDate(newDate.getDate() + direction);
        break;
      case 'weekly':
        newDate.setDate(newDate.getDate() + (direction * 7));
        break;
      case 'monthly':
        newDate.setMonth(newDate.getMonth() + direction);
        break;
      case 'yearly':
        newDate.setFullYear(newDate.getFullYear() + direction);
        break;
    }
    setSelectedDate(newDate);
  };

  // Filterlangan tranzaksiyalar
  const filteredTransactions = transactions.filter(t => {
    const date = t.date instanceof Date ? t.date : new Date(t.date);
    return date >= dateRange.start && date <= dateRange.end;
  });

  // Statistikalar
  const stats = {
    // Kirim (ombor to'ldirish)
    income: filteredTransactions
      .filter(t => t.type === 'kirim')
      .reduce((sum, t) => sum + (t.quantity * (t.costPrice || t.price || 0)), 0),
    
    // Sotish
    sales: filteredTransactions
      .filter(t => t.type === 'chiqim')
      .reduce((sum, t) => sum + (t.totalAmount || t.quantity * t.price || 0), 0),
    
    // Tannarx
    cost: filteredTransactions
      .filter(t => t.type === 'chiqim')
      .reduce((sum, t) => sum + (t.quantity * (t.costPrice || 0)), 0),
    
    // Qarz
    debt: filteredTransactions
      .filter(t => t.type === 'chiqim' && t.debt > 0)
      .reduce((sum, t) => sum + (t.debt || 0), 0),
    
    // Sotilgan mahsulotlar soni
    soldCount: filteredTransactions
      .filter(t => t.type === 'chiqim')
      .reduce((sum, t) => sum + t.quantity, 0),
    
    // Tranzaksiyalar soni
    transactionCount: filteredTransactions.filter(t => t.type === 'chiqim').length
  };

  stats.profit = stats.sales - stats.cost;
  stats.profitMargin = stats.sales > 0 ? ((stats.profit / stats.sales) * 100).toFixed(1) : 0;

  // Ombor qiymati
  const inventoryValue = products.reduce((sum, p) => 
    sum + (p.quantity * (p.costPrice || p.price || 0)), 0
  );
  const inventoryRetail = products.reduce((sum, p) => 
    sum + (p.quantity * (p.sellingPrice || p.price || 0)), 0
  );

  // Kam qolgan mahsulotlar
  const lowStock = products.filter(p => p.quantity > 0 && p.quantity < 5).length;
  const outOfStock = products.filter(p => p.quantity === 0).length;

  // Chart ma'lumotlari
  const getChartData = () => {
    const data = [];
    
    if (filterType === 'daily') {
      // Soatlik
      for (let h = 0; h < 24; h++) {
        const hourTransactions = filteredTransactions.filter(t => {
          const date = t.date instanceof Date ? t.date : new Date(t.date);
          return date.getHours() === h && t.type === 'chiqim';
        });
        data.push({
          name: `${h}:00`,
          sotish: hourTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0),
          foyda: hourTransactions.reduce((sum, t) => sum + ((t.totalAmount || 0) - (t.quantity * (t.costPrice || 0))), 0)
        });
      }
    } else if (filterType === 'weekly') {
      // Kunlik
      const days = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
      for (let d = 0; d < 7; d++) {
        const dayStart = new Date(dateRange.start);
        dayStart.setDate(dayStart.getDate() + d);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);
        
        const dayTransactions = transactions.filter(t => {
          const date = t.date instanceof Date ? t.date : new Date(t.date);
          return date >= dayStart && date <= dayEnd && t.type === 'chiqim';
        });
        
        data.push({
          name: days[(dayStart.getDay())],
          sotish: dayTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0),
          foyda: dayTransactions.reduce((sum, t) => sum + ((t.totalAmount || 0) - (t.quantity * (t.costPrice || 0))), 0)
        });
      }
    } else if (filterType === 'monthly') {
      // Haftalik
      const weeksInMonth = Math.ceil((dateRange.end.getDate()) / 7);
      for (let w = 0; w < weeksInMonth; w++) {
        const weekStart = new Date(dateRange.start);
        weekStart.setDate(weekStart.getDate() + (w * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        if (weekEnd > dateRange.end) weekEnd.setTime(dateRange.end.getTime());
        
        const weekTransactions = transactions.filter(t => {
          const date = t.date instanceof Date ? t.date : new Date(t.date);
          return date >= weekStart && date <= weekEnd && t.type === 'chiqim';
        });
        
        data.push({
          name: `${w + 1}-hafta`,
          sotish: weekTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0),
          foyda: weekTransactions.reduce((sum, t) => sum + ((t.totalAmount || 0) - (t.quantity * (t.costPrice || 0))), 0)
        });
      }
    } else {
      // Oylik
      const months = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
      for (let m = 0; m < 12; m++) {
        const monthStart = new Date(selectedDate.getFullYear(), m, 1);
        const monthEnd = new Date(selectedDate.getFullYear(), m + 1, 0, 23, 59, 59, 999);
        
        const monthTransactions = transactions.filter(t => {
          const date = t.date instanceof Date ? t.date : new Date(t.date);
          return date >= monthStart && date <= monthEnd && t.type === 'chiqim';
        });
        
        data.push({
          name: months[m],
          sotish: monthTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0),
          foyda: monthTransactions.reduce((sum, t) => sum + ((t.totalAmount || 0) - (t.quantity * (t.costPrice || 0))), 0)
        });
      }
    }
    
    return data;
  };

  // Top mahsulotlar
  const getTopProducts = () => {
    const productSales = {};
    filteredTransactions
      .filter(t => t.type === 'chiqim')
      .forEach(t => {
        if (!productSales[t.productName]) {
          productSales[t.productName] = { quantity: 0, amount: 0 };
        }
        productSales[t.productName].quantity += t.quantity;
        productSales[t.productName].amount += (t.totalAmount || t.quantity * t.price || 0);
      });
    
    return Object.entries(productSales)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  };

  const formatSum = (value) => {
    if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)} mlrd`;
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)} mln`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)} ming`;
    return value.toLocaleString();
  };

  const getDateLabel = () => {
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    switch (filterType) {
      case 'daily':
        return selectedDate.toLocaleDateString('uz-UZ', options);
      case 'weekly':
        return `${dateRange.start.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' })} - ${dateRange.end.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      case 'monthly':
        return selectedDate.toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' });
      case 'yearly':
        return selectedDate.getFullYear().toString();
      default:
        return '';
    }
  };

  const chartData = getChartData();
  const topProducts = getTopProducts();
  const pieColors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {companyData?.name || 'Dashboard'}
          </h1>
          <p className="text-slate-500">Savdo statistikasi</p>
        </div>

        {/* Filter va Sana */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Filter tugmalari */}
          <div className="flex bg-slate-100 rounded-xl p-1">
            {[
              { type: 'daily', label: 'Kunlik' },
              { type: 'weekly', label: 'Haftalik' },
              { type: 'monthly', label: 'Oylik' },
              { type: 'yearly', label: 'Yillik' }
            ].map(f => (
              <button
                key={f.type}
                onClick={() => setFilterType(f.type)}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  filterType === f.type
                    ? 'bg-white text-emerald-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Sana navigatsiya */}
          <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-1">
            <button
              onClick={() => navigateDate(-1)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div className="px-3 py-1 min-w-[140px] text-center">
              <span className="text-sm font-medium text-slate-700">{getDateLabel()}</span>
            </div>
            <button
              onClick={() => navigateDate(1)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              disabled={filterType === 'daily' && selectedDate.toDateString() === new Date().toDateString()}
            >
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          {/* Sana tanlash */}
          <input
            type="date"
            value={selectedDate.toISOString().split('T')[0]}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
          />

          {/* Admin: Foydani ko'rsatish */}
          {isAdmin && (
            <button
              onClick={() => setShowProfit(!showProfit)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                showProfit
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {showProfit ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="hidden sm:inline">Foyda</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sotish */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/25">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
              {stats.transactionCount} ta savdo
            </span>
          </div>
          <p className="text-emerald-100 text-sm">Sotish</p>
          <p className="text-2xl font-bold mt-1">{formatSum(stats.sales)}</p>
        </div>

        {/* Foyda (Admin uchun) */}
        {isAdmin && showProfit && (
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-5 text-white shadow-lg shadow-amber-500/25">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <TrendingUp className="w-6 h-6" />
              </div>
              <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                {stats.profitMargin}%
              </span>
            </div>
            <p className="text-amber-100 text-sm">Sof foyda</p>
            <p className="text-2xl font-bold mt-1">{formatSum(stats.profit)}</p>
          </div>
        )}

        {/* Qarz */}
        <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-2xl p-5 text-white shadow-lg shadow-rose-500/25">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
          </div>
          <p className="text-rose-100 text-sm">Qarzlar</p>
          <p className="text-2xl font-bold mt-1">{formatSum(stats.debt)}</p>
        </div>

        {/* Ombor */}
        <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl p-5 text-white shadow-lg shadow-violet-500/25">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Package className="w-6 h-6" />
            </div>
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
              {products.length} ta
            </span>
          </div>
          <p className="text-violet-100 text-sm">Ombor qiymati</p>
          <p className="text-2xl font-bold mt-1">{formatSum(isAdmin && showProfit ? inventoryValue : inventoryRetail)}</p>
        </div>

        {/* Tannarx (faqat admin uchun) */}
        {isAdmin && showProfit && (
          <div className="bg-gradient-to-br from-slate-600 to-slate-700 rounded-2xl p-5 text-white shadow-lg shadow-slate-500/25">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>
            <p className="text-slate-300 text-sm">Tannarx</p>
            <p className="text-2xl font-bold mt-1">{formatSum(stats.cost)}</p>
          </div>
        )}
      </div>

      {/* Ogohlantirish */}
      {(lowStock > 0 || outOfStock > 0) && (
        <div className="flex flex-wrap gap-3">
          {lowStock > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl">
              <span className="text-amber-600">⚠️</span>
              <span className="text-amber-700 text-sm font-medium">
                {lowStock} ta mahsulot kam qoldi
              </span>
            </div>
          )}
          {outOfStock > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-rose-50 border border-rose-200 rounded-xl">
              <span className="text-rose-600">🚫</span>
              <span className="text-rose-700 text-sm font-medium">
                {outOfStock} ta mahsulot tugadi
              </span>
            </div>
          )}
        </div>
      )}

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Sotish grafigi */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-500" />
            Sotish dinamikasi
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSotish" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  {isAdmin && showProfit && (
                    <linearGradient id="colorFoyda" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  )}
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={formatSum} />
                <Tooltip 
                  formatter={(value) => formatSum(value)}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="sotish" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorSotish)" 
                  name="Sotish"
                />
                {isAdmin && showProfit && (
                  <Area 
                    type="monotone" 
                    dataKey="foyda" 
                    stroke="#f59e0b" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorFoyda)" 
                    name="Foyda"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top mahsulotlar */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-violet-500" />
            Top mahsulotlar
          </h3>
          {topProducts.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-slate-400">
              Bu davrda sotish yo'q
            </div>
          ) : (
            <>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={topProducts}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {topProducts.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatSum(value)} />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-4">
                {topProducts.map((product, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: pieColors[idx] }}
                      />
                      <span className="text-slate-600 truncate max-w-[120px]">{product.name}</span>
                    </div>
                    <span className="font-medium text-slate-800">{formatSum(product.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
