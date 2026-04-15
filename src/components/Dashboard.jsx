import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Package, ShoppingCart,
  ArrowUpRight, Eye, EyeOff,
  ChevronLeft, ChevronRight, BarChart3, PieChart as PieIcon,
  AlertTriangle, Users, Activity, Zap, Target, Clock,
  CreditCard, Wallet, RefreshCw
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, BarChart, Bar, CartesianGrid, Legend
} from 'recharts';

const Dashboard = ({ products = [], transactions = [], isAdmin = false, companyData = null }) => {
  const [showProfit, setShowProfit] = useState(false);
  const [filterType, setFilterType] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dateRange, setDateRange] = useState({ start: new Date(), end: new Date() });
  const [activeChart, setActiveChart] = useState('area');

  useEffect(() => {
    const now = new Date();
    let start, end;
    switch (filterType) {
      case 'daily':
        start = new Date(selectedDate); start.setHours(0, 0, 0, 0);
        end = new Date(selectedDate); end.setHours(23, 59, 59, 999);
        break;
      case 'weekly':
        start = new Date(selectedDate);
        start.setDate(start.getDate() - start.getDay()); start.setHours(0, 0, 0, 0);
        end = new Date(start); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999);
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
        start = new Date(); end = new Date();
    }
    setDateRange({ start, end });
  }, [filterType, selectedDate]);

  const navigateDate = (dir) => {
    const d = new Date(selectedDate);
    if (filterType === 'daily') d.setDate(d.getDate() + dir);
    else if (filterType === 'weekly') d.setDate(d.getDate() + dir * 7);
    else if (filterType === 'monthly') d.setMonth(d.getMonth() + dir);
    else d.setFullYear(d.getFullYear() + dir);
    setSelectedDate(d);
  };

  const filtered = transactions.filter(t => {
    const date = t.date instanceof Date ? t.date : new Date(t.date);
    return date >= dateRange.start && date <= dateRange.end;
  });

  // ---- Statistika ----
  const sales = filtered.filter(t => t.type === 'chiqim').reduce((s, t) => s + (t.totalAmount || 0), 0);
  const cost = filtered.filter(t => t.type === 'chiqim').reduce((s, t) => s + (t.quantity * (t.costPrice || 0)), 0);
  const income = filtered.filter(t => t.type === 'kirim').reduce((s, t) => s + (t.quantity * (t.costPrice || t.price || 0)), 0);
  const debt = filtered.filter(t => t.type === 'chiqim' && t.debt > 0).reduce((s, t) => s + (t.debt || 0), 0);
  const soldCount = filtered.filter(t => t.type === 'chiqim').reduce((s, t) => s + t.quantity, 0);
  const txCount = filtered.filter(t => t.type === 'chiqim').length;
  const profit = sales - cost;
  const profitMargin = sales > 0 ? ((profit / sales) * 100).toFixed(1) : 0;
  const cashSales = filtered.filter(t => t.type === 'chiqim' && t.paymentType !== 'qarz').reduce((s, t) => s + (t.paidAmount || t.totalAmount || 0), 0);

  // Ombor
  const inventoryValue = products.reduce((s, p) => s + p.quantity * (p.costPrice || p.price || 0), 0);
  const inventoryRetail = products.reduce((s, p) => s + p.quantity * (p.sellingPrice || p.price || 0), 0);
  const lowStock = products.filter(p => p.quantity > 0 && p.quantity < (p.minStock || 5)).length;
  const outOfStock = products.filter(p => p.quantity === 0).length;

  // Avvalgi davr solishtirish
  const getPrevRange = () => {
    const diff = dateRange.end - dateRange.start;
    return { start: new Date(dateRange.start - diff - 1), end: new Date(dateRange.start - 1) };
  };
  const prev = getPrevRange();
  const prevSales = transactions.filter(t => {
    const d = t.date instanceof Date ? t.date : new Date(t.date);
    return d >= prev.start && d <= prev.end && t.type === 'chiqim';
  }).reduce((s, t) => s + (t.totalAmount || 0), 0);
  const salesChange = prevSales > 0 ? (((sales - prevSales) / prevSales) * 100).toFixed(1) : null;

  // ---- Chart ma'lumotlari ----
  const getChartData = () => {
    if (filterType === 'daily') {
      return Array.from({ length: 24 }, (_, h) => {
        const txs = filtered.filter(t => {
          const d = t.date instanceof Date ? t.date : new Date(t.date);
          return d.getHours() === h && t.type === 'chiqim';
        });
        return {
          name: `${h}:00`,
          sotish: txs.reduce((s, t) => s + (t.totalAmount || 0), 0),
          foyda: txs.reduce((s, t) => s + ((t.totalAmount || 0) - t.quantity * (t.costPrice || 0)), 0),
          miqdor: txs.reduce((s, t) => s + t.quantity, 0),
        };
      });
    }
    if (filterType === 'weekly') {
      const days = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
      return Array.from({ length: 7 }, (_, d) => {
        const ds = new Date(dateRange.start); ds.setDate(ds.getDate() + d);
        const de = new Date(ds); de.setHours(23, 59, 59, 999);
        const txs = transactions.filter(t => {
          const date = t.date instanceof Date ? t.date : new Date(t.date);
          return date >= ds && date <= de && t.type === 'chiqim';
        });
        return {
          name: days[ds.getDay()],
          sotish: txs.reduce((s, t) => s + (t.totalAmount || 0), 0),
          foyda: txs.reduce((s, t) => s + ((t.totalAmount || 0) - t.quantity * (t.costPrice || 0)), 0),
          miqdor: txs.reduce((s, t) => s + t.quantity, 0),
        };
      });
    }
    if (filterType === 'monthly') {
      const weeks = Math.ceil(dateRange.end.getDate() / 7);
      return Array.from({ length: weeks }, (_, w) => {
        const ws = new Date(dateRange.start); ws.setDate(ws.getDate() + w * 7);
        const we = new Date(ws); we.setDate(we.getDate() + 6); if (we > dateRange.end) we.setTime(dateRange.end.getTime());
        const txs = transactions.filter(t => {
          const d = t.date instanceof Date ? t.date : new Date(t.date);
          return d >= ws && d <= we && t.type === 'chiqim';
        });
        return {
          name: `${w + 1}-hafta`,
          sotish: txs.reduce((s, t) => s + (t.totalAmount || 0), 0),
          foyda: txs.reduce((s, t) => s + ((t.totalAmount || 0) - t.quantity * (t.costPrice || 0)), 0),
          miqdor: txs.reduce((s, t) => s + t.quantity, 0),
        };
      });
    }
    const months = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
    return months.map((name, m) => {
      const ms = new Date(selectedDate.getFullYear(), m, 1);
      const me = new Date(selectedDate.getFullYear(), m + 1, 0, 23, 59, 59, 999);
      const txs = transactions.filter(t => {
        const d = t.date instanceof Date ? t.date : new Date(t.date);
        return d >= ms && d <= me && t.type === 'chiqim';
      });
      return {
        name,
        sotish: txs.reduce((s, t) => s + (t.totalAmount || 0), 0),
        foyda: txs.reduce((s, t) => s + ((t.totalAmount || 0) - t.quantity * (t.costPrice || 0)), 0),
        miqdor: txs.reduce((s, t) => s + t.quantity, 0),
      };
    });
  };

  const getTopProducts = () => {
    const map = {};
    filtered.filter(t => t.type === 'chiqim').forEach(t => {
      if (!map[t.productName]) map[t.productName] = { qty: 0, amount: 0 };
      map[t.productName].qty += t.quantity;
      map[t.productName].amount += (t.totalAmount || t.quantity * (t.price || 0));
    });
    return Object.entries(map).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.amount - a.amount).slice(0, 5);
  };

  const getCategoryData = () => {
    const map = {};
    filtered.filter(t => t.type === 'chiqim').forEach(t => {
      const product = products.find(p => p.id === t.productId);
      const cat = product?.category || 'Boshqa';
      if (!map[cat]) map[cat] = 0;
      map[cat] += (t.totalAmount || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  };

  const getRecentTransactions = () => {
    return [...filtered]
      .filter(t => t.type === 'chiqim')
      .sort((a, b) => {
        const da = a.date instanceof Date ? a.date : new Date(a.date);
        const db = b.date instanceof Date ? b.date : new Date(b.date);
        return db - da;
      })
      .slice(0, 5);
  };

  const fmt = (v) => {
    if (v >= 1000000000) return `${(v / 1000000000).toFixed(1)} mlrd`;
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)} mln`;
    if (v >= 1000) return `${(v / 1000).toFixed(0)} ming`;
    return v?.toLocaleString() || '0';
  };

  const getDateLabel = () => {
    switch (filterType) {
      case 'daily': return selectedDate.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' });
      case 'weekly': return `${dateRange.start.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' })} – ${dateRange.end.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      case 'monthly': return selectedDate.toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' });
      case 'yearly': return selectedDate.getFullYear().toString();
      default: return '';
    }
  };

  const chartData = getChartData();
  const topProducts = getTopProducts();
  const categoryData = getCategoryData();
  const recentTx = getRecentTransactions();
  const pieColors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];

  // Plan badge
  const planColors = { trial: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300', starter: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', basic: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', pro: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' };
  const planLabel = { trial: 'Sinov', starter: 'Starter', basic: 'Asosiy', pro: 'Professional' };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-3 text-sm">
        <p className="font-semibold text-slate-700 dark:text-slate-200 mb-2">{label}</p>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-slate-600 dark:text-slate-400">{p.name}:</span>
            <span className="font-semibold text-slate-800 dark:text-white">{fmt(p.value)} so'm</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen">

      {/* ---- HEADER ---- */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                {companyData?.name || 'Dashboard'}
              </h1>
              {companyData?.plan && (
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${planColors[companyData.plan] || planColors.trial}`}>
                  {planLabel[companyData.plan] || companyData.plan}
                </span>
              )}
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm flex items-center gap-1.5 mt-0.5">
              <Activity className="w-3.5 h-3.5 text-emerald-500" />
              Savdo ko'rsatkichlari • {new Date().toLocaleDateString('uz-UZ', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtr */}
          <div className="flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 shadow-sm">
            {[{ type: 'daily', label: 'Kun' }, { type: 'weekly', label: 'Hafta' }, { type: 'monthly', label: 'Oy' }, { type: 'yearly', label: 'Yil' }].map(f => (
              <button
                key={f.type}
                onClick={() => setFilterType(f.type)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  filterType === f.type
                    ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Sana navigatsiya */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1 shadow-sm">
            <button onClick={() => navigateDate(-1)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            </button>
            <span className="px-2 text-sm font-medium text-slate-700 dark:text-slate-200 min-w-[130px] text-center">{getDateLabel()}</span>
            <button
              onClick={() => navigateDate(1)}
              disabled={filterType === 'daily' && selectedDate.toDateString() === new Date().toDateString()}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            </button>
          </div>

          <input
            type="date"
            value={selectedDate.toISOString().split('T')[0]}
            max={new Date().toISOString().split('T')[0]}
            onChange={e => setSelectedDate(new Date(e.target.value))}
            className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 shadow-sm"
          />

          {isAdmin && (
            <button
              onClick={() => setShowProfit(!showProfit)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl font-medium text-sm transition-all shadow-sm border ${
                showProfit
                  ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {showProfit ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="hidden sm:inline">Foyda</span>
            </button>
          )}
        </div>
      </div>

      {/* ---- KPI CARDS ---- */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sotish */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/20 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full" />
          <div className="absolute -right-2 bottom-0 w-16 h-16 bg-white/5 rounded-full" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                <ShoppingCart className="w-5 h-5" />
              </div>
              {salesChange !== null && (
                <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${parseFloat(salesChange) >= 0 ? 'bg-white/20' : 'bg-red-500/30'}`}>
                  {parseFloat(salesChange) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(salesChange)}%
                </div>
              )}
            </div>
            <p className="text-emerald-100 text-xs font-medium uppercase tracking-wide">Sotish</p>
            <p className="text-2xl font-bold mt-1 leading-tight">{fmt(sales)}</p>
            <p className="text-emerald-200 text-xs mt-1">{txCount} ta savdo · {soldCount} ta mahsulot</p>
          </div>
        </div>

        {/* Naqd */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-500/20 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                <CreditCard className="w-5 h-5" />
              </div>
            </div>
            <p className="text-blue-100 text-xs font-medium uppercase tracking-wide">Naqd tushum</p>
            <p className="text-2xl font-bold mt-1 leading-tight">{fmt(cashSales)}</p>
            <p className="text-blue-200 text-xs mt-1">Sotishdan {sales > 0 ? ((cashSales / sales) * 100).toFixed(0) : 0}%</p>
          </div>
        </div>

        {/* Qarz */}
        <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-2xl p-5 text-white shadow-lg shadow-rose-500/20 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
            <p className="text-rose-100 text-xs font-medium uppercase tracking-wide">Qarzlar</p>
            <p className="text-2xl font-bold mt-1 leading-tight">{fmt(debt)}</p>
            <p className="text-rose-200 text-xs mt-1">Sotishdan {sales > 0 ? ((debt / sales) * 100).toFixed(0) : 0}%</p>
          </div>
        </div>

        {/* Ombor */}
        <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl p-5 text-white shadow-lg shadow-violet-500/20 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                <Package className="w-5 h-5" />
              </div>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{products.length} ta</span>
            </div>
            <p className="text-violet-100 text-xs font-medium uppercase tracking-wide">Ombor qiymati</p>
            <p className="text-2xl font-bold mt-1 leading-tight">{fmt(isAdmin && showProfit ? inventoryValue : inventoryRetail)}</p>
            <p className="text-violet-200 text-xs mt-1">{isAdmin && showProfit ? 'Tannarx bo\'yicha' : 'Sotuv narxi bo\'yicha'}</p>
          </div>
        </div>
      </div>

      {/* Admin foyda kartalar */}
      {isAdmin && showProfit && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Sof foyda</span>
            </div>
            <p className={`text-xl font-bold ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>{fmt(profit)}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Marja: {profitMargin}%</p>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg">
                <Target className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Tannarx</span>
            </div>
            <p className="text-xl font-bold text-slate-700 dark:text-slate-200">{fmt(cost)}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Sotilgan mahsulotlar</p>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Kirim (xarid)</span>
            </div>
            <p className="text-xl font-bold text-slate-700 dark:text-slate-200">{fmt(income)}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Ombor to'ldirish</p>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">O'rtacha chek</span>
            </div>
            <p className="text-xl font-bold text-slate-700 dark:text-slate-200">{fmt(txCount > 0 ? Math.round(sales / txCount) : 0)}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Har bir savdo</p>
          </div>
        </div>
      )}

      {/* Ogohlantirishlar */}
      {(lowStock > 0 || outOfStock > 0) && (
        <div className="flex flex-wrap gap-3">
          {lowStock > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-amber-700 dark:text-amber-300 font-medium">{lowStock} ta mahsulot kam qoldi</span>
            </div>
          )}
          {outOfStock > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700 rounded-xl text-sm">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <span className="text-rose-700 dark:text-rose-300 font-medium">{outOfStock} ta mahsulot tugadi</span>
            </div>
          )}
        </div>
      )}

      {/* ---- GRAFIK VA TOP MAHSULOTLAR ---- */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Sotish grafigi */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-500" />
              Sotish dinamikasi
            </h3>
            <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
              {[{ id: 'area', label: 'Area' }, { id: 'bar', label: 'Bar' }].map(c => (
                <button
                  key={c.id}
                  onClick={() => setActiveChart(c.id)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${activeChart === c.id ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              {activeChart === 'area' ? (
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:stroke-slate-700" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={fmt} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="sotish" stroke="#10b981" strokeWidth={2} fill="url(#gSales)" name="Sotish" />
                  {isAdmin && showProfit && (
                    <Area type="monotone" dataKey="foyda" stroke="#f59e0b" strokeWidth={2} fill="url(#gProfit)" name="Foyda" />
                  )}
                </AreaChart>
              ) : (
                <BarChart data={chartData} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:stroke-slate-700" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={fmt} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="sotish" fill="#10b981" radius={[4, 4, 0, 0]} name="Sotish" />
                  {isAdmin && showProfit && <Bar dataKey="foyda" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Foyda" />}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top mahsulotlar */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="text-base font-bold text-slate-800 dark:text-white mb-5 flex items-center gap-2">
            <PieIcon className="w-5 h-5 text-violet-500" />
            Top mahsulotlar
          </h3>
          {topProducts.length === 0 ? (
            <div className="h-[260px] flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-2">
              <BarChart3 className="w-12 h-12 opacity-30" />
              <p className="text-sm">Bu davrda sotish yo'q</p>
            </div>
          ) : (
            <>
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie data={topProducts} dataKey="amount" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3}>
                      {topProducts.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                    </Pie>
                    <Tooltip formatter={v => `${fmt(v)} so'm`} />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2.5 mt-4">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: pieColors[i] }} />
                    <span className="text-sm text-slate-600 dark:text-slate-400 flex-1 truncate">{p.name}</span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-white">{fmt(p.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ---- KATEGORIYA VA SO'NGGI SOTUVLAR ---- */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Kategoriya bo'yicha sotish */}
        {categoryData.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
            <h3 className="text-base font-bold text-slate-800 dark:text-white mb-5 flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-500" />
              Kategoriya bo'yicha
            </h3>
            <div className="space-y-3">
              {categoryData.map((cat, i) => {
                const max = categoryData[0].value;
                const pct = max > 0 ? ((cat.value / max) * 100).toFixed(0) : 0;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600 dark:text-slate-400 font-medium truncate max-w-[200px]">{cat.name}</span>
                      <span className="text-slate-800 dark:text-white font-semibold ml-2 shrink-0">{fmt(cat.value)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: pieColors[i % pieColors.length] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* So'nggi sotuvlar */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="text-base font-bold text-slate-800 dark:text-white mb-5 flex items-center gap-2">
            <Clock className="w-5 h-5 text-rose-500" />
            So'nggi sotuvlar
          </h3>
          {recentTx.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-500 gap-2">
              <ShoppingCart className="w-10 h-10 opacity-30" />
              <p className="text-sm">Bu davrda sotuv yo'q</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentTx.map((t, i) => {
                const d = t.date instanceof Date ? t.date : new Date(t.date);
                return (
                  <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      t.paymentType === 'qarz' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {t.productName?.[0]?.toUpperCase() || 'M'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{t.productName || 'Mahsulot'}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {t.quantity} dona · {d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                        {t.customerName && ` · ${t.customerName}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${t.paymentType === 'qarz' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {fmt(t.totalAmount || 0)}
                      </p>
                      {t.paymentType === 'qarz' && <p className="text-xs text-rose-400">Qarz</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Ombor holati */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Jami mahsulot', value: products.length, sub: 'ta tur', color: 'slate', icon: Package },
          { label: 'Kam qoldi', value: lowStock, sub: 'ta mahsulot', color: 'amber', icon: AlertTriangle },
          { label: 'Tugagan', value: outOfStock, sub: 'ta mahsulot', color: 'rose', icon: AlertTriangle },
          { label: 'Ombor (sotuv)', value: fmt(inventoryRetail), sub: "so'm", color: 'violet', icon: Zap },
        ].map((item, i) => {
          const colorMap = {
            slate: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
            amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
            rose: 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300',
            violet: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300',
          };
          const Icon = item.icon;
          return (
            <div key={i} className={`rounded-2xl p-4 border ${colorMap[item.color]} border-transparent shadow-sm`}>
              <Icon className="w-5 h-5 mb-2 opacity-70" />
              <p className="text-2xl font-bold">{item.value}</p>
              <p className="text-xs font-medium opacity-70 mt-0.5">{item.label}</p>
              <p className="text-xs opacity-50">{item.sub}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard;
