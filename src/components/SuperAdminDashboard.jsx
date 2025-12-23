import React, { useState, useEffect } from 'react';
import { 
  Building2, Users, Package, DollarSign, TrendingUp, 
  Crown, Search, Filter, RefreshCw, Eye, Ban, Check,
  ChevronDown, BarChart3, PieChart, AlertTriangle, Clock,
  ArrowLeft, Settings, Zap, Star, Shield, Calendar, X,
  CreditCard, CheckCircle, XCircle, Send
} from 'lucide-react';
import { collection, getDocs, updateDoc, doc, query, where, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';

const SuperAdminDashboard = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState('requests');
  const [companies, setCompanies] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [paymentRequests, setPaymentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [activationDuration, setActivationDuration] = useState(1);

  // Tariflar
  const plans = {
    trial: { name: 'Sinov (Trial)', price: 0, maxUsers: 2, maxProducts: 50, duration: '14 kun' },
    starter: { name: 'Boshlang\'ich', price: 99000, maxUsers: 5, maxProducts: 500 },
    basic: { name: 'Asosiy', price: 149000, maxUsers: 10, maxProducts: 2000 },
    pro: { name: 'Professional', price: 249000, maxUsers: 999, maxProducts: 99999 }
  };

  const durations = [
    { months: 1, label: '1 oy' },
    { months: 3, label: '3 oy' },
    { months: 6, label: '6 oy' },
    { months: 12, label: '1 yil' }
  ];

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Kompaniyalar
      const companiesSnap = await getDocs(collection(db, 'companies'));
      const companiesData = companiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCompanies(companiesData);

      // Foydalanuvchilar
      const usersSnap = await getDocs(collection(db, 'users'));
      setAllUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Mahsulotlar
      const productsSnap = await getDocs(collection(db, 'products'));
      setAllProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Tranzaksiyalar
      const transSnap = await getDocs(collection(db, 'transactions'));
      setAllTransactions(transSnap.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        date: doc.data().date?.toDate() || new Date()
      })));

      // To'lov so'rovlari
      const requestsSnap = await getDocs(collection(db, 'paymentRequests'));
      const requestsData = requestsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPaymentRequests(requestsData);

    } catch (error) {
      console.error('Ma\'lumotlar yuklanmadi:', error);
      toast.error('Ma\'lumotlar yuklanmadi!');
    }
    setLoading(false);
  };

  // Statistikalar
  const stats = {
    totalCompanies: companies.length,
    activeCompanies: companies.filter(c => c.isActive !== false).length,
    trialCompanies: companies.filter(c => !c.plan || c.plan === 'trial').length,
    starterCompanies: companies.filter(c => c.plan === 'starter').length,
    basicCompanies: companies.filter(c => c.plan === 'basic').length,
    proCompanies: companies.filter(c => c.plan === 'pro').length,
    totalUsers: allUsers.length,
    totalProducts: allProducts.length,
    pendingRequests: paymentRequests.filter(r => r.status === 'pending').length,
    // MRR hisoblash
    mrr: companies.reduce((sum, c) => {
      if (c.plan === 'starter') return sum + 99000;
      if (c.plan === 'basic') return sum + 149000;
      if (c.plan === 'pro') return sum + 249000;
      return sum;
    }, 0),
    potentialMrr: companies.filter(c => !c.plan || c.plan === 'trial').length * 99000
  };

  // Kompaniya statistikasi
  const getCompanyStats = (companyId) => {
    const users = allUsers.filter(u => u.companyId === companyId);
    const products = allProducts.filter(p => p.companyId === companyId);
    const transactions = allTransactions.filter(t => t.companyId === companyId);
    const revenue = transactions
      .filter(t => t.type === 'chiqim')
      .reduce((sum, t) => sum + (t.totalAmount || t.quantity * t.price || 0), 0);

    return { users: users.length, products: products.length, transactions: transactions.length, revenue };
  };

  // So'rovni tasdiqlash
  const approveRequest = async () => {
    if (!selectedRequest) return;
    
    try {
      const planData = plans[selectedRequest.requestedPlan];
      const subscriptionEnd = new Date();
      subscriptionEnd.setMonth(subscriptionEnd.getMonth() + activationDuration);

      // Kompaniyani yangilash
      await updateDoc(doc(db, 'companies', selectedRequest.companyId), {
        plan: selectedRequest.requestedPlan,
        planName: planData.name,
        maxUsers: planData.maxUsers,
        maxProducts: planData.maxProducts,
        subscriptionEnd: subscriptionEnd,
        subscriptionStarted: new Date(),
        trialEndsAt: null, // Trial tugadi
        lastPaymentAmount: selectedRequest.totalAmount,
        lastPaymentDate: new Date(),
        updatedAt: new Date()
      });

      // So'rovni yangilash
      await updateDoc(doc(db, 'paymentRequests', selectedRequest.id), {
        status: 'approved',
        approvedAt: new Date(),
        approvedDuration: activationDuration,
        subscriptionEnd: subscriptionEnd
      });

      // State yangilash
      setCompanies(prev => prev.map(c => 
        c.id === selectedRequest.companyId 
          ? { ...c, plan: selectedRequest.requestedPlan, maxUsers: planData.maxUsers, maxProducts: planData.maxProducts, subscriptionEnd }
          : c
      ));
      setPaymentRequests(prev => prev.map(r => 
        r.id === selectedRequest.id ? { ...r, status: 'approved' } : r
      ));

      toast.success(`✅ ${selectedRequest.companyName} uchun ${planData.name} tarifi ${activationDuration} oyga faollashtirildi!`);
      setShowActivateModal(false);
      setSelectedRequest(null);
    } catch (error) {
      console.error('Tasdiqlashda xato:', error);
      toast.error('Xatolik yuz berdi!');
    }
  };

  // So'rovni rad etish
  const rejectRequest = async (request) => {
    if (!window.confirm(`${request.companyName} so'rovini rad etmoqchimisiz?`)) return;
    
    try {
      await updateDoc(doc(db, 'paymentRequests', request.id), {
        status: 'rejected',
        rejectedAt: new Date()
      });

      setPaymentRequests(prev => prev.map(r => 
        r.id === request.id ? { ...r, status: 'rejected' } : r
      ));

      toast.success('So\'rov rad etildi');
    } catch (error) {
      console.error('Rad etishda xato:', error);
      toast.error('Xatolik yuz berdi!');
    }
  };

  // Tarifni to'g'ridan-to'g'ri o'zgartirish (admin uchun)
  const updateCompanyPlan = async (companyId, newPlan, duration = 1) => {
    try {
      const planData = plans[newPlan];
      const subscriptionEnd = new Date();
      subscriptionEnd.setMonth(subscriptionEnd.getMonth() + duration);

      await updateDoc(doc(db, 'companies', companyId), {
        plan: newPlan,
        planName: planData.name,
        maxUsers: planData.maxUsers,
        maxProducts: planData.maxProducts,
        subscriptionEnd: subscriptionEnd,
        subscriptionStarted: new Date(),
        trialEndsAt: null,
        updatedAt: new Date()
      });
      
      setCompanies(prev => prev.map(c => 
        c.id === companyId 
          ? { ...c, plan: newPlan, maxUsers: planData.maxUsers, maxProducts: planData.maxProducts, subscriptionEnd }
          : c
      ));
      
      toast.success(`Tarif ${planData.name} ga o'zgartirildi!`);
    } catch (error) {
      console.error('Tarif o\'zgartirilmadi:', error);
      toast.error('Xatolik yuz berdi!');
    }
  };

  // Kompaniyani bloklash/aktivlashtirish
  const toggleCompanyStatus = async (companyId, currentStatus) => {
    try {
      const newStatus = currentStatus === false ? true : false;
      await updateDoc(doc(db, 'companies', companyId), {
        isActive: newStatus
      });
      
      setCompanies(prev => prev.map(c => 
        c.id === companyId ? { ...c, isActive: newStatus } : c
      ));
      
      toast.success(newStatus ? 'Kompaniya aktivlashtirildi!' : 'Kompaniya bloklandi!');
    } catch (error) {
      console.error('Status o\'zgartirilmadi:', error);
      toast.error('Xatolik yuz berdi!');
    }
  };

  // Filtrlangan kompaniyalar
  const filteredCompanies = companies.filter(c => {
    const matchesSearch = !searchTerm || 
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone?.includes(searchTerm);
    const matchesPlan = filterPlan === 'all' || 
      (filterPlan === 'trial' && (!c.plan || c.plan === 'trial')) ||
      c.plan === filterPlan;
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && c.isActive !== false) ||
      (filterStatus === 'blocked' && c.isActive === false);
    return matchesSearch && matchesPlan && matchesStatus;
  });

  const formatSum = (value) => {
    if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)} mlrd`;
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)} mln`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)} ming`;
    return value?.toLocaleString() || '0';
  };

  const getPlanBadge = (plan) => {
    switch (plan) {
      case 'starter':
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">Boshlang'ich</span>;
      case 'basic':
        return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">Asosiy</span>;
      case 'pro':
        return <span className="px-2 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-semibold">Professional</span>;
      default:
        return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">Trial</span>;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">Tasdiqlangan</span>;
      case 'rejected':
        return <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-semibold">Rad etilgan</span>;
      default:
        return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">Kutilmoqda</span>;
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    const d = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
    return d.toLocaleDateString('uz-UZ');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Shield className="w-6 h-6 text-emerald-500" />
                Super Admin Dashboard
              </h1>
              <p className="text-slate-400 text-sm">Barcha kompaniyalar va to'lovlar</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Pending Requests Badge */}
            {stats.pendingRequests > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 border border-amber-500/50 rounded-xl">
                <Clock className="w-5 h-5 text-amber-400" />
                <span className="text-amber-400 font-semibold">{stats.pendingRequests} ta so'rov kutmoqda</span>
              </div>
            )}
            <button
              onClick={loadAllData}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <RefreshCw className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 py-4 border-b border-slate-700">
        <div className="flex gap-2 overflow-x-auto">
          {[
            { id: 'requests', label: 'To\'lov so\'rovlari', icon: CreditCard, badge: stats.pendingRequests },
            { id: 'overview', label: 'Umumiy ko\'rinish', icon: BarChart3 },
            { id: 'companies', label: 'Kompaniyalar', icon: Building2 },
            { id: 'pricing', label: 'Tariflar', icon: DollarSign }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
              {tab.badge > 0 && (
                <span className="px-2 py-0.5 bg-amber-500 text-white text-xs rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* Payment Requests Tab */}
        {activeTab === 'requests' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">To'lov so'rovlari</h2>
            
            {/* Pending Requests */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-amber-400 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Kutilayotgan so'rovlar ({paymentRequests.filter(r => r.status === 'pending').length})
              </h3>
              
              {paymentRequests.filter(r => r.status === 'pending').length === 0 ? (
                <div className="bg-slate-800 rounded-xl p-8 text-center">
                  <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                  <p className="text-slate-400">Hozircha kutilayotgan so'rov yo'q</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {paymentRequests.filter(r => r.status === 'pending').map(request => (
                    <div key={request.id} className="bg-slate-800 rounded-xl p-6 border border-amber-500/30">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-white font-bold text-lg">{request.companyName}</h4>
                            {getStatusBadge(request.status)}
                          </div>
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-slate-500">Tanlangan tarif</p>
                              <p className="text-white font-semibold">{request.planName}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Muddat</p>
                              <p className="text-white font-semibold">{request.durationLabel}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Summa</p>
                              <p className="text-emerald-400 font-bold">{request.totalAmount?.toLocaleString()} so'm</p>
                            </div>
                            <div>
                              <p className="text-slate-500">So'rov sanasi</p>
                              <p className="text-white">{formatDate(request.requestedAt)}</p>
                            </div>
                          </div>
                          {request.discountPercent > 0 && (
                            <p className="text-rose-400 text-sm mt-2">
                              Chegirma: {request.discountPercent}% (-{request.discount?.toLocaleString()} so'm)
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedRequest(request);
                              setActivationDuration(request.duration || 1);
                              setShowActivateModal(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
                          >
                            <CheckCircle className="w-5 h-5" />
                            Tasdiqlash
                          </button>
                          <button
                            onClick={() => rejectRequest(request)}
                            className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors"
                          >
                            <XCircle className="w-5 h-5" />
                            Rad etish
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Approved/Rejected History */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-400">Tarix</h3>
              <div className="bg-slate-800 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-slate-300 font-semibold">Kompaniya</th>
                      <th className="px-4 py-3 text-left text-slate-300 font-semibold">Tarif</th>
                      <th className="px-4 py-3 text-left text-slate-300 font-semibold">Summa</th>
                      <th className="px-4 py-3 text-left text-slate-300 font-semibold">Status</th>
                      <th className="px-4 py-3 text-left text-slate-300 font-semibold">Sana</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentRequests.filter(r => r.status !== 'pending').slice(0, 10).map(request => (
                      <tr key={request.id} className="border-t border-slate-700">
                        <td className="px-4 py-3 text-white">{request.companyName}</td>
                        <td className="px-4 py-3 text-white">{request.planName}</td>
                        <td className="px-4 py-3 text-emerald-400">{request.totalAmount?.toLocaleString()}</td>
                        <td className="px-4 py-3">{getStatusBadge(request.status)}</td>
                        <td className="px-4 py-3 text-slate-400">{formatDate(request.approvedAt || request.rejectedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Stats Cards */}
            <div className="lg:col-span-2 grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-800 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-blue-500/20 rounded-xl">
                    <Building2 className="w-6 h-6 text-blue-400" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-white">{stats.totalCompanies}</p>
                <p className="text-slate-400 text-sm">Jami kompaniyalar</p>
              </div>

              <div className="bg-slate-800 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-emerald-500/20 rounded-xl">
                    <Users className="w-6 h-6 text-emerald-400" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-white">{stats.totalUsers}</p>
                <p className="text-slate-400 text-sm">Jami foydalanuvchilar</p>
              </div>

              <div className="bg-slate-800 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-violet-500/20 rounded-xl">
                    <Package className="w-6 h-6 text-violet-400" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-white">{stats.totalProducts}</p>
                <p className="text-slate-400 text-sm">Jami mahsulotlar</p>
              </div>

              <div className="bg-slate-800 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-amber-500/20 rounded-xl">
                    <DollarSign className="w-6 h-6 text-amber-400" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-white">{formatSum(stats.mrr)}</p>
                <p className="text-slate-400 text-sm">Oylik daromad (MRR)</p>
              </div>
            </div>

            {/* Plan Distribution */}
            <div className="bg-slate-800 rounded-2xl p-6">
              <h3 className="text-white font-bold mb-4">Tariflar bo'yicha</h3>
              <div className="space-y-3">
                {[
                  { label: 'Trial', count: stats.trialCompanies, color: 'amber' },
                  { label: 'Boshlang\'ich', count: stats.starterCompanies, color: 'blue' },
                  { label: 'Asosiy', count: stats.basicCompanies, color: 'emerald' },
                  { label: 'Professional', count: stats.proCompanies, color: 'violet' }
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-4">
                    <span className="text-slate-400 w-28">{item.label}</span>
                    <div className="flex-1 h-3 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-${item.color}-500 rounded-full`}
                        style={{ width: `${stats.totalCompanies > 0 ? (item.count / stats.totalCompanies * 100) : 0}%` }}
                      />
                    </div>
                    <span className="text-white font-bold w-8 text-right">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Companies Tab */}
        {activeTab === 'companies' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Kompaniya qidirish..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <select
                value={filterPlan}
                onChange={(e) => setFilterPlan(e.target.value)}
                className="px-4 py-3 bg-slate-800 border border-slate-700 text-white rounded-xl"
              >
                <option value="all">Barcha tariflar</option>
                <option value="trial">Trial</option>
                <option value="starter">Boshlang'ich</option>
                <option value="basic">Asosiy</option>
                <option value="pro">Professional</option>
              </select>
            </div>

            {/* Companies List */}
            <div className="space-y-4">
              {filteredCompanies.map(company => {
                const companyStats = getCompanyStats(company.id);
                const isBlocked = company.isActive === false;
                
                return (
                  <div 
                    key={company.id} 
                    className={`bg-slate-800 rounded-xl p-6 border ${
                      isBlocked ? 'border-rose-500/50' : 'border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-white font-bold">{company.name}</h4>
                          {getPlanBadge(company.plan)}
                          {isBlocked && (
                            <span className="px-2 py-1 bg-rose-500/20 text-rose-400 rounded-full text-xs">
                              Bloklangan
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
                          <div>
                            <p className="text-slate-500">Foydalanuvchilar</p>
                            <p className="text-white">{companyStats.users} / {company.maxUsers || 2}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Mahsulotlar</p>
                            <p className="text-white">{companyStats.products} / {company.maxProducts || 50}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Obuna tugashi</p>
                            <p className={`${
                              company.plan === 'trial' 
                                ? 'text-amber-400' 
                                : 'text-white'
                            }`}>
                              {company.subscriptionEnd 
                                ? formatDate(company.subscriptionEnd)
                                : company.trialEndsAt 
                                  ? formatDate(company.trialEndsAt)
                                  : '-'}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500">Sotuvlar</p>
                            <p className="text-emerald-400">{formatSum(companyStats.revenue)}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Ro'yxatdan</p>
                            <p className="text-white">{formatDate(company.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <select
                          value={company.plan || 'trial'}
                          onChange={(e) => {
                            const duration = window.prompt('Necha oyga faollashtirish? (1, 3, 6, 12)', '1');
                            if (duration && [1, 3, 6, 12].includes(parseInt(duration))) {
                              updateCompanyPlan(company.id, e.target.value, parseInt(duration));
                            }
                          }}
                          className="px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg text-sm"
                        >
                          <option value="trial">Trial</option>
                          <option value="starter">Boshlang'ich</option>
                          <option value="basic">Asosiy</option>
                          <option value="pro">Professional</option>
                        </select>

                        <button
                          onClick={() => toggleCompanyStatus(company.id, company.isActive)}
                          className={`p-2 rounded-lg transition-colors ${
                            isBlocked
                              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                          }`}
                          title={isBlocked ? 'Aktivlashtirish' : 'Bloklash'}
                        >
                          {isBlocked ? <Check className="w-5 h-5" /> : <Ban className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pricing Tab */}
        {activeTab === 'pricing' && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Trial */}
              <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-amber-500/20 rounded-xl">
                    <Clock className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold">Trial</h3>
                    <p className="text-amber-400 text-sm">14 kunlik sinov</p>
                  </div>
                </div>
                <p className="text-3xl font-bold text-white mb-4">Bepul</p>
                <ul className="space-y-2 text-slate-300 text-sm">
                  <li>✓ 2 ta foydalanuvchi</li>
                  <li>✓ 50 ta mahsulot</li>
                  <li>✓ Asosiy funksiyalar</li>
                </ul>
                <div className="mt-4 p-3 bg-slate-700 rounded-lg">
                  <p className="text-slate-400 text-xs">Hozirda: <span className="text-white font-bold">{stats.trialCompanies}</span> ta</p>
                </div>
              </div>

              {/* Starter */}
              <div className="bg-slate-800 rounded-2xl p-6 border border-blue-500/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-blue-500/20 rounded-xl">
                    <Zap className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold">Boshlang'ich</h3>
                    <p className="text-blue-400 text-sm">Kichik do'konlar</p>
                  </div>
                </div>
                <p className="text-3xl font-bold text-white mb-4">99,000 <span className="text-lg text-slate-400">so'm/oy</span></p>
                <ul className="space-y-2 text-slate-300 text-sm">
                  <li>✓ 5 ta foydalanuvchi</li>
                  <li>✓ 500 ta mahsulot</li>
                  <li>✓ Barcha funksiyalar</li>
                </ul>
                <div className="mt-4 p-3 bg-slate-700 rounded-lg">
                  <p className="text-slate-400 text-xs">Hozirda: <span className="text-white font-bold">{stats.starterCompanies}</span> ta</p>
                  <p className="text-blue-400 text-xs">Daromad: {formatSum(stats.starterCompanies * 99000)}</p>
                </div>
              </div>

              {/* Basic */}
              <div className="bg-slate-800 rounded-2xl p-6 border border-emerald-500/50 relative overflow-hidden">
                <div className="absolute top-3 right-3 px-2 py-1 bg-emerald-500 text-white text-xs font-bold rounded">
                  MASHHUR
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-emerald-500/20 rounded-xl">
                    <Star className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold">Asosiy</h3>
                    <p className="text-emerald-400 text-sm">O'rta do'konlar</p>
                  </div>
                </div>
                <p className="text-3xl font-bold text-white mb-4">149,000 <span className="text-lg text-slate-400">so'm/oy</span></p>
                <ul className="space-y-2 text-slate-300 text-sm">
                  <li>✓ 10 ta foydalanuvchi</li>
                  <li>✓ 2000 ta mahsulot</li>
                  <li>✓ Telegram xabarnoma</li>
                </ul>
                <div className="mt-4 p-3 bg-slate-700 rounded-lg">
                  <p className="text-slate-400 text-xs">Hozirda: <span className="text-white font-bold">{stats.basicCompanies}</span> ta</p>
                  <p className="text-emerald-400 text-xs">Daromad: {formatSum(stats.basicCompanies * 149000)}</p>
                </div>
              </div>

              {/* Pro */}
              <div className="bg-gradient-to-br from-violet-900 to-slate-800 rounded-2xl p-6 border border-violet-500/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-violet-500/20 rounded-xl">
                    <Shield className="w-6 h-6 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold">Professional</h3>
                    <p className="text-violet-400 text-sm">Katta biznes</p>
                  </div>
                </div>
                <p className="text-3xl font-bold text-white mb-4">249,000 <span className="text-lg text-slate-400">so'm/oy</span></p>
                <ul className="space-y-2 text-slate-300 text-sm">
                  <li>✓ Cheksiz foydalanuvchi</li>
                  <li>✓ Cheksiz mahsulot</li>
                  <li>✓ API kirish</li>
                </ul>
                <div className="mt-4 p-3 bg-slate-700/50 rounded-lg">
                  <p className="text-slate-400 text-xs">Hozirda: <span className="text-white font-bold">{stats.proCompanies}</span> ta</p>
                  <p className="text-violet-400 text-xs">Daromad: {formatSum(stats.proCompanies * 249000)}</p>
                </div>
              </div>
            </div>

            {/* Revenue Summary */}
            <div className="bg-slate-800 rounded-2xl p-6">
              <h3 className="text-white font-bold mb-4">💰 Daromad statistikasi</h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="p-4 bg-slate-700 rounded-xl">
                  <p className="text-slate-400">Oylik daromad (MRR)</p>
                  <p className="text-3xl font-bold text-emerald-400">{formatSum(stats.mrr)}</p>
                </div>
                <div className="p-4 bg-slate-700 rounded-xl">
                  <p className="text-slate-400">Yillik daromad (ARR)</p>
                  <p className="text-3xl font-bold text-emerald-400">{formatSum(stats.mrr * 12)}</p>
                </div>
                <div className="p-4 bg-slate-700 rounded-xl">
                  <p className="text-slate-400">Potensial (Trial → Starter)</p>
                  <p className="text-3xl font-bold text-amber-400">+{formatSum(stats.potentialMrr)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Activation Modal */}
      {showActivateModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Tarifni faollashtirish</h3>
              <button 
                onClick={() => {
                  setShowActivateModal(false);
                  setSelectedRequest(null);
                }}
                className="p-2 hover:bg-slate-700 rounded-full"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-700 rounded-xl p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-slate-400">Kompaniya:</span>
                  <span className="text-white font-semibold">{selectedRequest.companyName}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-slate-400">Tarif:</span>
                  <span className="text-white font-semibold">{selectedRequest.planName}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-slate-400">So'ralgan muddat:</span>
                  <span className="text-white font-semibold">{selectedRequest.durationLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">To'lov:</span>
                  <span className="text-emerald-400 font-bold">{selectedRequest.totalAmount?.toLocaleString()} so'm</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-3">
                  Faollashtirish muddati:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {durations.map(d => (
                    <button
                      key={d.months}
                      onClick={() => setActivationDuration(d.months)}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        activationDuration === d.months
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                          : 'border-slate-600 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-emerald-500/20 border border-emerald-500/50 rounded-xl p-4">
                <p className="text-emerald-400 text-sm">
                  <CheckCircle className="w-4 h-4 inline mr-1" />
                  Tarif {activationDuration} oyga faollashtiriladi
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowActivateModal(false);
                  setSelectedRequest(null);
                }}
                className="flex-1 py-3 bg-slate-700 text-slate-300 font-semibold rounded-xl hover:bg-slate-600"
              >
                Bekor qilish
              </button>
              <button
                onClick={approveRequest}
                className="flex-1 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Tasdiqlash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
