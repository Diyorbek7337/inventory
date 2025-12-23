import React, { useState, useEffect } from 'react';
import { 
  Building2, Phone, Mail, MapPin, Save, 
  CreditCard, Users, Package, BarChart3, Calendar,
  CheckCircle, AlertTriangle, Crown, Zap, Rocket, X,
  Clock, Send, Copy, MessageCircle, Smartphone
} from 'lucide-react';
import { doc, getDoc, updateDoc, addDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';

// Tarif cheklovlari - GLOBAL EXPORT
export const PLAN_LIMITS = {
  trial: { maxUsers: 2, maxProducts: 50, name: 'Sinov (Trial)', price: 0, duration: 14 },
  starter: { maxUsers: 5, maxProducts: 500, name: 'Boshlang\'ich', price: 99000 },
  basic: { maxUsers: 10, maxProducts: 2000, name: 'Asosiy', price: 149000 },
  pro: { maxUsers: 999, maxProducts: 99999, name: 'Professional', price: 249000 }
};

const CompanySettings = ({ currentUser, onPlanChange }) => {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [selectedDuration, setSelectedDuration] = useState(1);
  const [showPaymentInfoModal, setShowPaymentInfoModal] = useState(false);
  const [lastRequestData, setLastRequestData] = useState(null);

  // To'lov ma'lumotlari
  const paymentInfo = {
    cardNumber: '4073 4200 7540 1111',
    cardHolder: 'ABDIQAYUMOV DIYORBEK',
    phone: '+998 90 377 73 37',
    telegram: '@diyorbek7337'
  };
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    website: ''
  });

  const durations = [
    { months: 1, label: '1 oy', discount: 0 },
    { months: 3, label: '3 oy', discount: 5 },
    { months: 6, label: '6 oy', discount: 10 },
    { months: 12, label: '1 yil', discount: 15 }
  ];

  useEffect(() => {
    loadCompanyData();
    loadPendingRequest();
  }, [currentUser?.companyId]);

  const loadCompanyData = async () => {
    if (!currentUser?.companyId) return;
    try {
      const companyDoc = await getDoc(doc(db, 'companies', currentUser.companyId));
      if (companyDoc.exists()) {
        const data = companyDoc.data();
        setCompany(data);
        setFormData({
          name: data.name || '',
          phone: data.phone || '',
          email: data.email || '',
          address: data.address || '',
          website: data.website || ''
        });
      }
    } catch (error) {
      console.error('Kompaniya ma\'lumotlarini yuklashda xato:', error);
      toast.error('Ma\'lumotlar yuklanmadi!');
    }
    setLoading(false);
  };

  // Kutilayotgan so'rovni yuklash
  const loadPendingRequest = async () => {
    if (!currentUser?.companyId) return;
    try {
      const q = query(
        collection(db, 'paymentRequests'),
        where('companyId', '==', currentUser.companyId),
        where('status', '==', 'pending')
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setPendingRequest({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      }
    } catch (error) {
      console.error('So\'rov yuklanmadi:', error);
    }
  };

  const saveCompanyData = async () => {
    if (!formData.name.trim()) {
      toast.error('Kompaniya nomini kiriting!');
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, 'companies', currentUser.companyId), {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        address: formData.address.trim(),
        website: formData.website.trim(),
        updatedAt: new Date()
      });
      setCompany(prev => ({ ...prev, ...formData }));
      toast.success('Ma\'lumotlar saqlandi!');
    } catch (error) {
      console.error('Saqlashda xato:', error);
      toast.error('Xatolik yuz berdi!');
    }
    setSaving(false);
  };

  // Tarif tanlash - so'rov yaratish
  const handleSelectPlan = (plan) => {
    const currentPlan = company?.plan || 'trial';
    if (plan.id === currentPlan && currentPlan !== 'trial') {
      toast.info('Bu sizning joriy tarifingiz');
      return;
    }
    if (pendingRequest) {
      toast.warning('Sizda kutilayotgan to\'lov so\'rovi mavjud!');
      return;
    }
    setSelectedPlan(plan);
    setSelectedDuration(1);
    setShowPaymentModal(true);
  };

  // To'lov so'rovini yuborish
  const submitPaymentRequest = async () => {
    if (!selectedPlan) return;
    
    setSaving(true);
    const loadingToast = toast.loading('So\'rov yuborilmoqda...');

    try {
      const duration = durations.find(d => d.months === selectedDuration);
      const basePrice = selectedPlan.price * selectedDuration;
      const discount = basePrice * (duration.discount / 100);
      const totalAmount = basePrice - discount;

      const requestData = {
        companyId: currentUser.companyId,
        companyName: company?.name || 'Noma\'lum',
        requestedPlan: selectedPlan.id,
        planName: selectedPlan.name,
        duration: selectedDuration,
        durationLabel: duration.label,
        basePrice: basePrice,
        discount: discount,
        discountPercent: duration.discount,
        totalAmount: totalAmount,
        status: 'pending', // pending, approved, rejected
        requestedBy: currentUser.name || currentUser.username,
        requestedAt: new Date(),
        note: ''
      };

      await addDoc(collection(db, 'paymentRequests'), requestData);

      setPendingRequest(requestData);
      setLastRequestData(requestData);

      toast.update(loadingToast, {
        render: '✅ So\'rov yuborildi!',
        type: 'success',
        isLoading: false,
        autoClose: 2000
      });

      // To'lov modalni yopib, to'lov ma'lumotlari modalini ochish
      setShowPaymentModal(false);
      setSelectedPlan(null);
      setShowPaymentInfoModal(true);
    } catch (error) {
      console.error('So\'rov yuborishda xato:', error);
      toast.update(loadingToast, {
        render: '❌ Xatolik yuz berdi!',
        type: 'error',
        isLoading: false,
        autoClose: 3000
      });
    }
    setSaving(false);
  };

  // Trial muddati tugaganmi?
  const isTrialExpired = () => {
    if (company?.plan !== 'trial') return false;
    if (!company?.trialEndsAt) return false;
    const endDate = company.trialEndsAt.seconds 
      ? new Date(company.trialEndsAt.seconds * 1000) 
      : new Date(company.trialEndsAt);
    return new Date() > endDate;
  };

  // Qolgan kunlar
  const getRemainingDays = () => {
    if (!company?.subscriptionEnd && !company?.trialEndsAt) return null;
    const endDate = company.subscriptionEnd 
      ? (company.subscriptionEnd.seconds ? new Date(company.subscriptionEnd.seconds * 1000) : new Date(company.subscriptionEnd))
      : (company.trialEndsAt.seconds ? new Date(company.trialEndsAt.seconds * 1000) : new Date(company.trialEndsAt));
    const now = new Date();
    const diff = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const plans = [
    {
      id: 'starter',
      name: 'Boshlang\'ich',
      price: 99000,
      icon: Zap,
      color: 'blue',
      features: [
        { text: '5 ta foydalanuvchi', included: true },
        { text: '500 ta mahsulot', included: true },
        { text: 'To\'liq statistika', included: true },
        { text: 'Barcode skanerlash', included: true },
        { text: 'Telegram xabarnoma', included: false },
        { text: 'API kirish', included: false }
      ]
    },
    {
      id: 'basic',
      name: 'Asosiy',
      price: 149000,
      icon: Crown,
      color: 'emerald',
      popular: true,
      features: [
        { text: '10 ta foydalanuvchi', included: true },
        { text: '2000 ta mahsulot', included: true },
        { text: 'To\'liq statistika', included: true },
        { text: 'Barcode skanerlash', included: true },
        { text: 'Telegram xabarnoma', included: true },
        { text: 'API kirish', included: false }
      ]
    },
    {
      id: 'pro',
      name: 'Professional',
      price: 249000,
      icon: Rocket,
      color: 'violet',
      features: [
        { text: 'Cheksiz foydalanuvchi', included: true },
        { text: 'Cheksiz mahsulot', included: true },
        { text: 'To\'liq statistika', included: true },
        { text: 'Barcode skanerlash', included: true },
        { text: 'Telegram xabarnoma', included: true },
        { text: 'API kirish', included: true }
      ]
    }
  ];

  const currentPlan = company?.plan || 'trial';
  const currentLimits = PLAN_LIMITS[currentPlan] || PLAN_LIMITS.trial;
  const remainingDays = getRemainingDays();
  const trialExpired = isTrialExpired();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-4 rounded-full border-emerald-500 border-t-transparent animate-spin"></div>
          <p className="text-slate-600">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Kompaniya sozlamalari</h2>
        <p className="mt-1 text-slate-500">Kompaniya ma'lumotlari va tarif rejasi</p>
      </div>

      {/* Trial Expired Warning */}
      {trialExpired && (
        <div className="flex items-center gap-3 p-4 mb-6 border bg-rose-50 border-rose-200 rounded-xl">
          <AlertTriangle className="w-6 h-6 text-rose-500" />
          <div>
            <p className="font-semibold text-rose-800">Sinov muddati tugadi!</p>
            <p className="text-sm text-rose-600">Davom etish uchun tarif tanlang va to'lov qiling.</p>
          </div>
        </div>
      )}

      {/* Pending Request Warning */}
      {pendingRequest && (
        <div className="p-4 mb-6 border bg-amber-50 border-amber-200 rounded-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Clock className="flex-shrink-0 w-6 h-6 text-amber-500" />
            <div className="flex-1">
              <p className="font-semibold text-amber-800">To'lov so'rovi kutilmoqda</p>
              <p className="text-sm text-amber-600">
                {pendingRequest.planName} - {pendingRequest.durationLabel} - {pendingRequest.totalAmount?.toLocaleString()} so'm
              </p>
              <p className="mt-1 text-xs text-amber-500">
                Admin tasdiqlaganidan so'ng tarif faollashadi
              </p>
            </div>
            <button
              onClick={() => {
                setLastRequestData(pendingRequest);
                setShowPaymentInfoModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-amber-500 rounded-xl hover:bg-amber-600"
            >
              <CreditCard className="w-4 h-4" />
              To'lov ma'lumotlari
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 pb-2 mb-6 overflow-x-auto">
        {[
          { id: 'general', label: 'Umumiy', icon: Building2 },
          { id: 'subscription', label: 'Tarif', icon: CreditCard },
          { id: 'stats', label: 'Statistika', icon: BarChart3 }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/25'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* General Tab */}
      {activeTab === 'general' && (
        <div className="p-6 bg-white shadow-lg rounded-2xl shadow-slate-200/50">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block mb-2 text-sm font-semibold text-slate-700">
                <Building2 className="inline w-4 h-4 mr-2" />
                Kompaniya nomi *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Kompaniya nomi"
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-semibold text-slate-700">
                <Phone className="inline w-4 h-4 mr-2" />
                Telefon
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="+998 90 123 45 67"
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-semibold text-slate-700">
                <Mail className="inline w-4 h-4 mr-2" />
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="info@company.uz"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block mb-2 text-sm font-semibold text-slate-700">
                <MapPin className="inline w-4 h-4 mr-2" />
                Manzil
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Toshkent sh., Chilonzor tumani"
              />
            </div>
          </div>

          <button
            onClick={saveCompanyData}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 mt-6 font-semibold text-white transition-all bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      )}

      {/* Subscription Tab */}
      {activeTab === 'subscription' && (
        <div className="space-y-6">
          {/* Current Plan */}
          <div className={`rounded-2xl p-6 text-white ${
            currentPlan === 'trial' 
              ? (trialExpired ? 'bg-gradient-to-r from-rose-500 to-rose-600' : 'bg-gradient-to-r from-amber-500 to-amber-600')
              : 'bg-gradient-to-r from-emerald-500 to-emerald-600'
          }`}>
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <p className="text-sm text-white/80">Joriy tarif</p>
                <h3 className="mt-1 text-2xl font-bold">{currentLimits.name}</h3>
                <p className="mt-2 text-white/80">
                  {currentLimits.maxUsers} foydalanuvchi, {currentLimits.maxProducts} mahsulot
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-white/80">
                  {currentPlan === 'trial' ? 'Sinov tugashi' : 'Amal qilish muddati'}
                </p>
                <p className="mt-1 text-xl font-bold">
                  {remainingDays !== null ? (
                    remainingDays > 0 
                      ? `${remainingDays} kun qoldi` 
                      : 'Muddati tugagan'
                  ) : 'Belgilanmagan'}
                </p>
              </div>
            </div>
          </div>

          {/* Available Plans */}
          <h3 className="text-lg font-bold text-slate-800">Mavjud tariflar</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map(plan => {
              const Icon = plan.icon;
              const isCurrentPlan = currentPlan === plan.id;
              
              return (
                <div
                  key={plan.id}
                  className={`relative bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6 border-2 transition-all ${
                    isCurrentPlan 
                      ? 'border-emerald-500 ring-2 ring-emerald-100' 
                      : 'border-transparent hover:border-slate-200'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute px-4 py-1 text-xs font-bold text-white -translate-x-1/2 rounded-full -top-3 left-1/2 bg-amber-500">
                      Mashhur
                    </div>
                  )}

                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                    plan.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                    plan.color === 'emerald' ? 'bg-emerald-100 text-emerald-600' :
                    'bg-violet-100 text-violet-600'
                  }`}>
                    <Icon className="w-6 h-6" />
                  </div>

                  <h4 className="text-xl font-bold text-slate-800">{plan.name}</h4>
                  <div className="mt-2 mb-4">
                    <span className="text-3xl font-bold text-slate-800">
                      {plan.price.toLocaleString()}
                    </span>
                    <span className="text-slate-500"> so'm/oy</span>
                  </div>

                  <ul className="mb-6 space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        {feature.included ? (
                          <CheckCircle className="flex-shrink-0 w-5 h-5 text-emerald-500" />
                        ) : (
                          <div className="flex-shrink-0 w-5 h-5 border-2 rounded-full border-slate-300" />
                        )}
                        <span className={feature.included ? 'text-slate-700' : 'text-slate-400'}>
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSelectPlan(plan)}
                    disabled={isCurrentPlan || !!pendingRequest}
                    className={`w-full py-3 rounded-xl font-semibold transition-all active:scale-[0.98] ${
                      isCurrentPlan
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : pendingRequest
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : plan.color === 'emerald'
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : plan.color === 'violet'
                              ? 'bg-violet-600 text-white hover:bg-violet-700'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isCurrentPlan ? 'Joriy tarif' : pendingRequest ? 'So\'rov yuborilgan' : 'Tanlash'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Payment Info */}
          <div className="p-6 border bg-slate-50 rounded-2xl border-slate-200">
            <h4 className="mb-3 font-bold text-slate-800">💳 To'lov usullari</h4>
            <div className="grid gap-4 text-sm md:grid-cols-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
                  <span className="font-bold text-blue-600">P</span>
                </div>
                <div>
                  <p className="font-semibold">Payme</p>
                  <p className="text-slate-500">Onlayn to'lov</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-cyan-100">
                  <span className="font-bold text-cyan-600">C</span>
                </div>
                <div>
                  <p className="font-semibold">Click</p>
                  <p className="text-slate-500">Onlayn to'lov</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-100">
                  <span className="font-bold text-emerald-600">₸</span>
                </div>
                <div>
                  <p className="font-semibold">Bank o'tkazmasi</p>
                  <p className="text-slate-500">Hisob raqamga</p>
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-500">
              To'lovni amalga oshirgandan so'ng, admin tomonidan tasdiqlanadi va tarif faollashadi.
            </p>
          </div>
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="p-6 bg-white shadow-lg rounded-2xl shadow-slate-200/50">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-100 rounded-xl">
                <Users className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Foydalanuvchilar</p>
                <p className="text-2xl font-bold text-slate-800">
                  {company?.currentUsers || 1} / {currentLimits.maxUsers}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 bg-white shadow-lg rounded-2xl shadow-slate-200/50">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Mahsulotlar</p>
                <p className="text-2xl font-bold text-slate-800">
                  {company?.currentProducts || 0} / {currentLimits.maxProducts}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 bg-white shadow-lg rounded-2xl shadow-slate-200/50">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-violet-100 rounded-xl">
                <Calendar className="w-6 h-6 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">A'zo bo'lgan</p>
                <p className="text-2xl font-bold text-slate-800">
                  {company?.createdAt 
                    ? new Date(company.createdAt.seconds ? company.createdAt.seconds * 1000 : company.createdAt).toLocaleDateString('uz-UZ')
                    : '-'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 bg-white shadow-lg rounded-2xl shadow-slate-200/50">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-xl">
                <CreditCard className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Tarif</p>
                <p className="text-2xl font-bold text-slate-800">{currentLimits.name}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Request Modal */}
      {showPaymentModal && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-800">To'lov so'rovi</h3>
              <button 
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedPlan(null);
                }}
                className="p-2 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Plan Info */}
            <div className="p-4 mb-6 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <selectedPlan.icon className={`w-8 h-8 ${
                  selectedPlan.color === 'blue' ? 'text-blue-600' :
                  selectedPlan.color === 'emerald' ? 'text-emerald-600' :
                  'text-violet-600'
                }`} />
                <div>
                  <h4 className="text-lg font-bold">{selectedPlan.name}</h4>
                  <p className="text-slate-500">{selectedPlan.price.toLocaleString()} so'm/oy</p>
                </div>
              </div>
            </div>

            {/* Duration Selection */}
            <div className="mb-6">
              <label className="block mb-3 text-sm font-semibold text-slate-700">
                Muddat tanlang:
              </label>
              <div className="grid grid-cols-2 gap-3">
                {durations.map(d => {
                  const basePrice = selectedPlan.price * d.months;
                  const discountAmount = basePrice * (d.discount / 100);
                  const finalPrice = basePrice - discountAmount;
                  
                  return (
                    <button
                      key={d.months}
                      onClick={() => setSelectedDuration(d.months)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        selectedDuration === d.months
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-bold">{d.label}</span>
                        {d.discount > 0 && (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-600 text-xs font-bold rounded-full">
                            -{d.discount}%
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-lg font-bold text-slate-800">
                        {finalPrice.toLocaleString()} so'm
                      </p>
                      {d.discount > 0 && (
                        <p className="text-xs line-through text-slate-400">
                          {basePrice.toLocaleString()} so'm
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Summary */}
            <div className="p-4 mb-6 border bg-emerald-50 border-emerald-200 rounded-xl">
              <h4 className="mb-2 font-bold text-emerald-800">Xulosa</h4>
              {(() => {
                const duration = durations.find(d => d.months === selectedDuration);
                const basePrice = selectedPlan.price * selectedDuration;
                const discountAmount = basePrice * (duration.discount / 100);
                const finalPrice = basePrice - discountAmount;
                
                return (
                  <>
                    <div className="flex justify-between mb-1 text-sm">
                      <span className="text-slate-600">Tarif:</span>
                      <span className="font-semibold">{selectedPlan.name}</span>
                    </div>
                    <div className="flex justify-between mb-1 text-sm">
                      <span className="text-slate-600">Muddat:</span>
                      <span className="font-semibold">{duration.label}</span>
                    </div>
                    {duration.discount > 0 && (
                      <div className="flex justify-between mb-1 text-sm">
                        <span className="text-slate-600">Chegirma:</span>
                        <span className="font-semibold text-rose-600">-{discountAmount.toLocaleString()} so'm</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 mt-2 text-lg font-bold border-t border-emerald-200">
                      <span className="text-emerald-800">Jami:</span>
                      <span className="text-emerald-600">{finalPrice.toLocaleString()} so'm</span>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Info */}
            <div className="p-4 mb-6 border border-blue-200 bg-blue-50 rounded-xl">
              <p className="text-sm text-blue-800">
                <AlertTriangle className="inline w-4 h-4 mr-1" />
                So'rov yuborganingizdan so'ng, to'lovni amalga oshiring. Admin to'lovni tekshirib, tarifni faollashtiradi.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedPlan(null);
                }}
                className="flex-1 py-3 font-semibold bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200"
              >
                Bekor qilish
              </button>
              <button
                onClick={submitPaymentRequest}
                disabled={saving}
                className="flex items-center justify-center flex-1 gap-2 py-3 font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
                {saving ? 'Yuborilmoqda...' : 'So\'rov yuborish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Info Modal - To'lov ma'lumotlari */}
      {showPaymentInfoModal && lastRequestData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-800">💳 To'lov qilish</h3>
              <button 
                onClick={() => setShowPaymentInfoModal(false)}
                className="p-2 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success Message */}
            <div className="p-4 mb-6 border bg-emerald-50 border-emerald-200 rounded-xl">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
                <div>
                  <p className="font-bold text-emerald-800">So'rov yuborildi!</p>
                  <p className="text-sm text-emerald-600">Endi quyidagi kartaga to'lov qiling</p>
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div className="p-4 mb-6 bg-slate-50 rounded-xl">
              <h4 className="mb-3 font-semibold text-slate-700">Buyurtma:</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tarif:</span>
                  <span className="font-semibold">{lastRequestData.planName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Muddat:</span>
                  <span className="font-semibold">{lastRequestData.durationLabel}</span>
                </div>
                <div className="flex justify-between pt-2 text-lg font-bold border-t border-slate-200">
                  <span className="text-slate-700">To'lov summasi:</span>
                  <span className="text-emerald-600">{lastRequestData.totalAmount?.toLocaleString()} so'm</span>
                </div>
              </div>
            </div>

            {/* Card Info */}
            <div className="p-6 mb-6 text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-6 h-6" />
                <span className="font-semibold">Karta raqami</span>
              </div>
              <div className="flex items-center justify-between">
                <p className="font-mono text-2xl tracking-wider">{paymentInfo.cardNumber}</p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(paymentInfo.cardNumber.replace(/\s/g, ''));
                    toast.success('Karta raqami nusxalandi!');
                  }}
                  className="p-2 transition-colors rounded-lg bg-white/20 hover:bg-white/30"
                  title="Nusxalash"
                >
                  <Copy className="w-5 h-5" />
                </button>
              </div>
              <p className="mt-2 text-blue-100">{paymentInfo.cardHolder}</p>
            </div>

            {/* Contact Info */}
            <div className="mb-6 space-y-3">
              <h4 className="font-semibold text-slate-700">Bog'lanish:</h4>
              
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <div className="p-2 rounded-lg bg-emerald-100">
                  <Phone className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-500">Telefon</p>
                  <p className="font-semibold">{paymentInfo.phone}</p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(paymentInfo.phone);
                    toast.success('Telefon nusxalandi!');
                  }}
                  className="p-2 rounded-lg hover:bg-slate-200"
                >
                  <Copy className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <MessageCircle className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-500">Telegram</p>
                  <p className="font-semibold">{paymentInfo.telegram}</p>
                </div>
                <a
                  href={`https://t.me/${paymentInfo.telegram.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 text-sm text-white bg-blue-500 rounded-lg hover:bg-blue-600"
                >
                  Yozish
                </a>
              </div>
            </div>

            {/* Instructions */}
            <div className="p-4 mb-6 border bg-amber-50 border-amber-200 rounded-xl">
              <h4 className="mb-2 font-semibold text-amber-800">📋 Yo'riqnoma:</h4>
              <ol className="space-y-2 text-sm text-amber-700">
                <li>1. Yuqoridagi karta raqamiga <strong>{lastRequestData.totalAmount?.toLocaleString()} so'm</strong> o'tkazing</li>
                <li>2. To'lov chekini Telegram orqali yuboring</li>
                <li>3. Admin tekshirib, tarifingizni faollashtiradi</li>
                <li>4. Faollashtirilganda xabar olasiz</li>
              </ol>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowPaymentInfoModal(false)}
                className="flex-1 py-3 font-semibold bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200"
              >
                Yopish
              </button>
              <a
                href={`https://t.me/${paymentInfo.telegram.replace('@', '')}?text=Salom! Men "${lastRequestData.planName}" tarifiga ${lastRequestData.totalAmount?.toLocaleString()} so'm to'lov qildim. Kompaniya: ${company?.name || ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center flex-1 gap-2 py-3 font-semibold text-white bg-blue-500 rounded-xl hover:bg-blue-600"
              >
                <MessageCircle className="w-5 h-5" />
                Chek yuborish
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanySettings;
