import React, { useState, useMemo } from 'react';
import { 
  Search, Phone, User, Calendar, DollarSign, Check, 
  AlertTriangle, Clock, ChevronDown, ChevronUp, Filter,
  TrendingDown, Users, Receipt, Plus, X
} from 'lucide-react';
import { collection, addDoc, updateDoc, doc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';

const Debtors = ({ transactions, onUpdateTransaction, currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('debt'); // debt, date, name
  const [filterStatus, setFilterStatus] = useState('all'); // all, overdue, recent
  const [expandedDebtor, setExpandedDebtor] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedDebtor, setSelectedDebtor] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [loading, setLoading] = useState(false);

  // Qarzdorlarni guruhlash
  const debtors = useMemo(() => {
    const debtorMap = {};

    transactions
      .filter(t => t.type === 'chiqim' && t.debt > 0 && t.companyId === currentUser.companyId)
      .forEach(t => {
        const key = t.customerName?.toLowerCase() || 'noma\'lum';
        if (!debtorMap[key]) {
          debtorMap[key] = {
            name: t.customerName || 'Noma\'lum',
            phone: t.customerPhone || '',
            totalDebt: 0,
            paidAmount: 0,
            transactions: [],
            lastDate: null,
            firstDate: null
          };
        }
        
        debtorMap[key].totalDebt += t.debt;
        debtorMap[key].paidAmount += (t.paidAmount || 0);
        debtorMap[key].transactions.push(t);
        
        const transDate = t.date instanceof Date ? t.date : new Date(t.date);
        if (!debtorMap[key].lastDate || transDate > debtorMap[key].lastDate) {
          debtorMap[key].lastDate = transDate;
        }
        if (!debtorMap[key].firstDate || transDate < debtorMap[key].firstDate) {
          debtorMap[key].firstDate = transDate;
        }
        if (t.customerPhone && !debtorMap[key].phone) {
          debtorMap[key].phone = t.customerPhone;
        }
      });

    return Object.values(debtorMap);
  }, [transactions, currentUser.companyId]);

  // Filtrlash va saralash
  const filteredDebtors = useMemo(() => {
    let result = debtors.filter(d => {
      const matchesSearch = !searchTerm || 
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.phone.includes(searchTerm);
      
      if (!matchesSearch) return false;

      if (filterStatus === 'overdue') {
        const daysSinceFirst = (new Date() - d.firstDate) / (1000 * 60 * 60 * 24);
        return daysSinceFirst > 30;
      }
      if (filterStatus === 'recent') {
        const daysSinceLast = (new Date() - d.lastDate) / (1000 * 60 * 60 * 24);
        return daysSinceLast <= 7;
      }
      return true;
    });

    // Saralash
    switch (sortBy) {
      case 'debt':
        result.sort((a, b) => b.totalDebt - a.totalDebt);
        break;
      case 'date':
        result.sort((a, b) => b.lastDate - a.lastDate);
        break;
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return result;
  }, [debtors, searchTerm, filterStatus, sortBy]);

  // Statistikalar
  const stats = useMemo(() => {
    const total = debtors.reduce((sum, d) => sum + d.totalDebt, 0);
    const overdue = debtors.filter(d => {
      const days = (new Date() - d.firstDate) / (1000 * 60 * 60 * 24);
      return days > 30;
    }).reduce((sum, d) => sum + d.totalDebt, 0);
    
    return {
      totalDebt: total,
      overdueDebt: overdue,
      debtorCount: debtors.length,
      overdueCount: debtors.filter(d => {
        const days = (new Date() - d.firstDate) / (1000 * 60 * 60 * 24);
        return days > 30;
      }).length
    };
  }, [debtors]);

  // To'lov qilish
  const handlePayment = async () => {
    if (!selectedDebtor || !payAmount) return;

    const amount = parseFloat(payAmount);
    if (amount <= 0 || amount > selectedDebtor.totalDebt) {
      toast.error('Noto\'g\'ri summa!');
      return;
    }

    setLoading(true);
    try {
      // Eng eski qarzdan boshlab to'lash
      let remaining = amount;
      const sortedTrans = [...selectedDebtor.transactions].sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : new Date(a.date);
        const dateB = b.date instanceof Date ? b.date : new Date(b.date);
        return dateA - dateB;
      });

      for (const trans of sortedTrans) {
        if (remaining <= 0) break;
        if (trans.debt <= 0) continue;

        const payForThis = Math.min(remaining, trans.debt);
        const newDebt = trans.debt - payForThis;
        const newPaid = (trans.paidAmount || 0) + payForThis;

        await updateDoc(doc(db, 'transactions', trans.id), {
          debt: newDebt,
          paidAmount: newPaid
        });

        onUpdateTransaction({
          ...trans,
          debt: newDebt,
          paidAmount: newPaid
        });

        remaining -= payForThis;
      }

      toast.success(`${amount.toLocaleString()} so'm to'lov qabul qilindi!`);
      setShowPayModal(false);
      setSelectedDebtor(null);
      setPayAmount('');
    } catch (error) {
      console.error('To\'lov xatosi:', error);
      toast.error('Xatolik yuz berdi!');
    }
    setLoading(false);
  };

  const formatSum = (value) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)} mln`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)} ming`;
    return value.toLocaleString();
  };

  const getDaysAgo = (date) => {
    const days = Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Bugun';
    if (days === 1) return 'Kecha';
    return `${days} kun oldin`;
  };

  const getDebtStatus = (debtor) => {
    const days = (new Date() - debtor.firstDate) / (1000 * 60 * 60 * 24);
    if (days > 30) return { status: 'overdue', color: 'rose', label: 'Muddati o\'tgan' };
    if (days > 14) return { status: 'warning', color: 'amber', label: 'Ogohlantirish' };
    return { status: 'normal', color: 'emerald', label: 'Normal' };
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Qarzdorlar</h1>
          <p className="text-slate-500">Mijozlar qarzi boshqaruvi</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-2xl p-5 text-white shadow-lg shadow-rose-500/25">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
          <p className="text-rose-100 text-sm">Jami qarz</p>
          <p className="text-2xl font-bold mt-1">{formatSum(stats.totalDebt)}</p>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-5 text-white shadow-lg shadow-amber-500/25">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
          <p className="text-amber-100 text-sm">Muddati o'tgan</p>
          <p className="text-2xl font-bold mt-1">{formatSum(stats.overdueDebt)}</p>
        </div>

        <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl p-5 text-white shadow-lg shadow-violet-500/25">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <p className="text-violet-100 text-sm">Jami qarzdorlar</p>
          <p className="text-2xl font-bold mt-1">{stats.debtorCount}</p>
        </div>

        <div className="bg-gradient-to-br from-slate-600 to-slate-700 rounded-2xl p-5 text-white shadow-lg shadow-slate-500/25">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
          </div>
          <p className="text-slate-300 text-sm">Kechiktirilgan</p>
          <p className="text-2xl font-bold mt-1">{stats.overdueCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Qarzdor qidirish..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {/* Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="all">Barchasi</option>
            <option value="overdue">Muddati o'tgan (30+ kun)</option>
            <option value="recent">So'nggi 7 kun</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="debt">Qarz bo'yicha</option>
            <option value="date">Sana bo'yicha</option>
            <option value="name">Ism bo'yicha</option>
          </select>
        </div>
      </div>

      {/* Debtors List */}
      <div className="space-y-4">
        {filteredDebtors.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-100">
            <Users className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-xl font-bold text-slate-800 mb-2">Qarzdor topilmadi</h3>
            <p className="text-slate-500">Hozircha qarzdorlar yo'q</p>
          </div>
        ) : (
          filteredDebtors.map((debtor, idx) => {
            const status = getDebtStatus(debtor);
            const isExpanded = expandedDebtor === idx;

            return (
              <div 
                key={idx}
                className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all ${
                  status.status === 'overdue' ? 'border-rose-200' : 'border-slate-100'
                }`}
              >
                {/* Main row */}
                <div 
                  className="p-4 lg:p-6 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedDebtor(isExpanded ? null : idx)}
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className={`w-12 h-12 rounded-xl bg-${status.color}-100 flex items-center justify-center`}>
                      <User className={`w-6 h-6 text-${status.color}-600`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-800 truncate">{debtor.name}</h3>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full bg-${status.color}-100 text-${status.color}-700`}>
                          {status.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                        {debtor.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {debtor.phone}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Receipt className="w-3 h-3" />
                          {debtor.transactions.length} ta savdo
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {getDaysAgo(debtor.lastDate)}
                        </span>
                      </div>
                    </div>

                    {/* Debt amount */}
                    <div className="text-right">
                      <p className={`text-xl font-bold text-${status.color}-600`}>
                        {debtor.totalDebt.toLocaleString()}
                      </p>
                      <p className="text-sm text-slate-500">so'm qarz</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDebtor(debtor);
                          setShowPayModal(true);
                        }}
                        className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors active:scale-95"
                      >
                        To'lov
                      </button>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-4 lg:p-6 bg-slate-50">
                    <h4 className="font-semibold text-slate-700 mb-3">Savdolar tarixi:</h4>
                    <div className="space-y-2">
                      {debtor.transactions
                        .sort((a, b) => {
                          const dateA = a.date instanceof Date ? a.date : new Date(a.date);
                          const dateB = b.date instanceof Date ? b.date : new Date(b.date);
                          return dateB - dateA;
                        })
                        .map((t, tIdx) => {
                          const transDate = t.date instanceof Date ? t.date : new Date(t.date);
                          return (
                            <div key={tIdx} className="flex items-center justify-between p-3 bg-white rounded-xl">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                                  <Receipt className="w-5 h-5 text-slate-500" />
                                </div>
                                <div>
                                  <p className="font-medium text-slate-800">{t.productName}</p>
                                  <p className="text-sm text-slate-500">
                                    {transDate.toLocaleDateString('uz-UZ')} • {t.quantity} dona
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-slate-800">
                                  {(t.totalAmount || t.quantity * t.price || 0).toLocaleString()}
                                </p>
                                <p className={`text-sm ${t.debt > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                  {t.debt > 0 ? `Qarz: ${t.debt.toLocaleString()}` : 'To\'langan'}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Payment Modal */}
      {showPayModal && selectedDebtor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-800">To'lov qabul qilish</h3>
                <button
                  onClick={() => {
                    setShowPayModal(false);
                    setSelectedDebtor(null);
                    setPayAmount('');
                  }}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Debtor info */}
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center">
                    <User className="w-6 h-6 text-rose-600" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{selectedDebtor.name}</p>
                    <p className="text-rose-600 font-semibold">
                      Qarz: {selectedDebtor.totalDebt.toLocaleString()} so'm
                    </p>
                  </div>
                </div>
              </div>

              {/* Amount input */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  To'lov summasi
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="Summa kiriting"
                    className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl text-lg font-bold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    autoFocus
                  />
                </div>
              </div>

              {/* Quick amounts */}
              <div className="flex flex-wrap gap-2">
                {[50000, 100000, 200000, 500000].map(amount => (
                  <button
                    key={amount}
                    onClick={() => setPayAmount(amount.toString())}
                    className="px-3 py-2 bg-slate-100 rounded-lg text-sm font-medium hover:bg-slate-200"
                  >
                    {amount >= 1000000 ? `${amount/1000000} mln` : `${amount/1000}k`}
                  </button>
                ))}
                <button
                  onClick={() => setPayAmount(selectedDebtor.totalDebt.toString())}
                  className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200"
                >
                  To'liq to'lash
                </button>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => {
                  setShowPayModal(false);
                  setSelectedDebtor(null);
                  setPayAmount('');
                }}
                className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200"
              >
                Bekor qilish
              </button>
              <button
                onClick={handlePayment}
                disabled={loading || !payAmount || parseFloat(payAmount) <= 0}
                className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saqlanmoqda...' : 'Qabul qilish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Debtors;
