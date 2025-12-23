import React, { useState } from 'react';
import { Calendar, TrendingUp, Users, DollarSign, Percent, Eye, EyeOff } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Statistics = ({ products, transactions, isAdmin }) => {
  const [periodFilter, setPeriodFilter] = useState('oy');
  const [showProfit, setShowProfit] = useState(false);

  const getFilteredTransactions = () => {
    const now = new Date();
    let startDate = new Date();

    switch (periodFilter) {
      case 'bugun':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'hafta':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'oy':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'yil':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        break;
    }

    return transactions.filter(t => new Date(t.date) >= startDate);
  };

  const getStatistics = () => {
    const filtered = getFilteredTransactions();
    
    const income = filtered
      .filter(t => t.type === 'kirim')
      .reduce((sum, t) => sum + (t.quantity * (t.sellingPrice || t.price)), 0);

    const outcome = filtered
      .filter(t => t.type === 'chiqim')
      .reduce((sum, t) => sum + (t.paidAmount || (t.quantity * (t.sellingPrice || t.price))), 0);

    const debt = filtered
      .filter(t => t.type === 'chiqim')
      .reduce((sum, t) => sum + (t.debt || 0), 0);

    // Sof foyda - admin uchun
    const profit = filtered
      .filter(t => t.type === 'chiqim')
      .reduce((sum, t) => {
        const costPrice = t.costPrice || 0;
        const sellingPrice = t.sellingPrice || t.price || 0;
        return sum + ((sellingPrice - costPrice) * t.quantity);
      }, 0);

    const uniqueCustomers = new Set(
      filtered.filter(t => t.type === 'chiqim' && t.customerName && t.customerName !== 'Naqd')
        .map(t => t.customerName)
    ).size;

    return { income, outcome, debt, profit, uniqueCustomers };
  };

  const getCategoryData = () => {
    const categoryStats = {};
    
    getFilteredTransactions()
      .filter(t => t.type === 'chiqim')
      .forEach(t => {
        const product = products.find(p => p.id === t.productId);
        const category = product?.category || t.category || 'Boshqa';
        
        if (!categoryStats[category]) {
          categoryStats[category] = { revenue: 0, profit: 0 };
        }
        
        const revenue = t.quantity * (t.sellingPrice || t.price);
        const profit = (t.sellingPrice || t.price - (t.costPrice || 0)) * t.quantity;
        
        categoryStats[category].revenue += revenue;
        categoryStats[category].profit += profit;
      });

    return Object.entries(categoryStats).map(([name, data]) => ({
      name,
      value: data.revenue / 1000000,
      profit: data.profit / 1000000
    }));
  };

  const getMonthlyData = () => {
    const monthlyStats = {};

    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = (`0${date.getMonth() + 1}`).slice(-2);
      const year = date.getFullYear();
      const monthKey = `${month}.${year}`;
      monthlyStats[monthKey] = { income: 0, outcome: 0, profit: 0 };
    }

    transactions.forEach(t => {
      const date = new Date(t.date);
      const month = (`0${date.getMonth() + 1}`).slice(-2);
      const year = date.getFullYear();
      const monthKey = `${month}.${year}`;

      if (monthlyStats[monthKey]) {
        if (t.type === 'kirim') {
          monthlyStats[monthKey].income += t.quantity * (t.sellingPrice || t.price);
        } else {
          monthlyStats[monthKey].outcome += t.paidAmount || (t.quantity * (t.sellingPrice || t.price));
          
          const costPrice = t.costPrice || 0;
          const sellingPrice = t.sellingPrice || t.price || 0;
          monthlyStats[monthKey].profit += (sellingPrice - costPrice) * t.quantity;
        }
      }
    });

    return Object.entries(monthlyStats).map(([month, data]) => ({
      month,
      kirim: data.income / 1000000,
      savdo: data.outcome / 1000000,
      foyda: data.profit / 1000000
    }));
  };

  const getDebtors = () => {
    const debtors = {};

    transactions
      .filter(t => t.type === 'chiqim' && t.debt > 0)
      .forEach(t => {
        if (!debtors[t.customerName]) {
          debtors[t.customerName] = 0;
        }
        debtors[t.customerName] += t.debt;
      });

    return Object.entries(debtors)
      .map(([name, debt]) => ({ name, debt }))
      .sort((a, b) => b.debt - a.debt)
      .slice(0, 10);
  };

  const stats = getStatistics();
  const categoryData = getCategoryData();
  const monthlyData = getMonthlyData();
  const debtors = getDebtors();

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const formatSum = (value) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)} mln`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)} ming`;
    return value.toLocaleString();
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Davr tanlash */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 lg:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-600" />
            <h3 className="text-lg font-bold text-slate-800">Davr tanlang:</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'bugun', label: 'Bugun' },
              { key: 'hafta', label: 'Hafta' },
              { key: 'oy', label: 'Oy' },
              { key: 'yil', label: 'Yil' }
            ].map(period => (
              <button
                key={period.key}
                onClick={() => setPeriodFilter(period.key)}
                className={`px-4 py-2 rounded-xl font-medium transition-all ${
                  periodFilter === period.key
                    ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {period.label}
              </button>
            ))}
            {isAdmin && (
              <button
                onClick={() => setShowProfit(!showProfit)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                  showProfit 
                    ? 'bg-amber-100 text-amber-700 border border-amber-300' 
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {showProfit ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span>Foyda</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Statistika kartalari */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-4 lg:p-6 text-white shadow-lg shadow-emerald-500/25">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-emerald-100 text-xs lg:text-sm font-medium">Kirim</p>
              <p className="text-xl lg:text-3xl font-bold mt-1">{formatSum(stats.income)}</p>
            </div>
            <TrendingUp className="w-8 h-8 lg:w-10 lg:h-10 text-emerald-200" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 lg:p-6 text-white shadow-lg shadow-blue-500/25">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-blue-100 text-xs lg:text-sm font-medium">Savdo</p>
              <p className="text-xl lg:text-3xl font-bold mt-1">{formatSum(stats.outcome)}</p>
            </div>
            <DollarSign className="w-8 h-8 lg:w-10 lg:h-10 text-blue-200" />
          </div>
        </div>

        {/* Foyda - faqat admin */}
        {isAdmin ? (
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-4 lg:p-6 text-white shadow-lg shadow-amber-500/25">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-amber-100 text-xs lg:text-sm font-medium">Sof Foyda</p>
                <p className="text-xl lg:text-3xl font-bold mt-1">{formatSum(stats.profit)}</p>
                <p className="text-amber-200 text-xs mt-1">
                  {stats.outcome > 0 ? ((stats.profit / stats.outcome) * 100).toFixed(1) : 0}% margin
                </p>
              </div>
              <Percent className="w-8 h-8 lg:w-10 lg:h-10 text-amber-200" />
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-4 lg:p-6 text-white shadow-lg shadow-violet-500/25">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-violet-100 text-xs lg:text-sm font-medium">Mijozlar</p>
                <p className="text-xl lg:text-3xl font-bold mt-1">{stats.uniqueCustomers}</p>
              </div>
              <Users className="w-8 h-8 lg:w-10 lg:h-10 text-violet-200" />
            </div>
          </div>
        )}

        <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-2xl p-4 lg:p-6 text-white shadow-lg shadow-rose-500/25">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-rose-100 text-xs lg:text-sm font-medium">Qarz</p>
              <p className="text-xl lg:text-3xl font-bold mt-1">{formatSum(stats.debt)}</p>
            </div>
            <Users className="w-8 h-8 lg:w-10 lg:h-10 text-rose-200" />
          </div>
        </div>
      </div>

      {/* Grafiklar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Oylik statistika */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 lg:p-6">
          <h3 className="mb-4 text-lg font-bold text-slate-800">12 oylik statistika (mln so'm)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" angle={-45} textAnchor="end" height={80} fontSize={11} stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                  formatter={(value) => [`${value.toFixed(2)} mln`, '']}
                />
                <Legend />
                <Bar dataKey="savdo" fill="#3b82f6" name="Savdo" radius={[4, 4, 0, 0]} />
                {isAdmin && showProfit && (
                  <Bar dataKey="foyda" fill="#f59e0b" name="Foyda" radius={[4, 4, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Kategoriya bo'yicha */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 lg:p-6">
          <h3 className="mb-4 text-lg font-bold text-slate-800">Kategoriya bo'yicha savdo</h3>
          {categoryData.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-slate-500">
              Ma'lumot mavjud emas
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value.toFixed(1)}M`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                    formatter={(value, name, props) => {
                      if (isAdmin && showProfit) {
                        return [`${value.toFixed(2)} mln (foyda: ${props.payload.profit.toFixed(2)} mln)`, name];
                      }
                      return [`${value.toFixed(2)} mln`, name];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Admin uchun qo'shimcha foyda analizi */}
      {isAdmin && (
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="text-amber-400">👑</span> Foyda analizi
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-slate-300 text-sm">Gross Revenue</p>
              <p className="text-xl font-bold mt-1">{formatSum(stats.outcome + stats.debt)}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-slate-300 text-sm">Kirim xarajati</p>
              <p className="text-xl font-bold mt-1 text-rose-400">
                {formatSum(getFilteredTransactions()
                  .filter(t => t.type === 'chiqim')
                  .reduce((sum, t) => sum + ((t.costPrice || 0) * t.quantity), 0)
                )}
              </p>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-slate-300 text-sm">Sof Foyda</p>
              <p className="text-xl font-bold mt-1 text-emerald-400">{formatSum(stats.profit)}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-slate-300 text-sm">Profit Margin</p>
              <p className="text-xl font-bold mt-1 text-amber-400">
                {stats.outcome > 0 ? ((stats.profit / stats.outcome) * 100).toFixed(1) : 0}%
              </p>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-slate-300 text-sm">O'rtacha chek</p>
              <p className="text-xl font-bold mt-1">
                {formatSum(
                  getFilteredTransactions().filter(t => t.type === 'chiqim').length > 0
                    ? stats.outcome / getFilteredTransactions().filter(t => t.type === 'chiqim').length
                    : 0
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Qarzdorlar ro'yxati */}
      {debtors.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 lg:p-6">
          <h3 className="mb-4 text-lg font-bold text-slate-800">Qarzdorlar ro'yxati</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-left text-slate-500 uppercase">#</th>
                  <th className="px-6 py-3 text-xs font-semibold text-left text-slate-500 uppercase">Mijoz</th>
                  <th className="px-6 py-3 text-xs font-semibold text-left text-slate-500 uppercase">Qarz</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {debtors.map((debtor, index) => (
                  <tr key={index} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-slate-500">{index + 1}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-800">{debtor.name}</td>
                    <td className="px-6 py-4 text-sm font-bold text-rose-600">
                      {debtor.debt.toLocaleString()} so'm
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Statistics;
