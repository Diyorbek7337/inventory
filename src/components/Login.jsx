import React, { useState } from 'react';
import { 
  User, Lock, Building2, Phone, ChevronRight, Eye, EyeOff,
  Store, Pill, Shirt, Smartphone, Car, Utensils, Gift, MoreHorizontal,
  ShoppingBag, Hammer, Leaf, Baby, BookOpen, Dumbbell, Shield
} from 'lucide-react';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';
import AuthService from '../utils/authService';
import { checkPasswordStrength } from '../utils/passwordUtils';

const Login = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(null);

  // Login
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Registration
  const [companyName, setCompanyName] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [storeType, setStoreType] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Do'kon turlari va kategoriyalari
  const storeTypes = [
    {
      id: 'electronics',
      name: 'Elektronika',
      icon: Smartphone,
      color: 'blue',
      categories: ['Telefonlar', 'Noutbuklar', 'Planshetlar', 'Aksessuarlar', 'Quloqchinlar', 'Zaryadka', 'Kabellar', 'Qo\'riqlash kameralari', 'Smart soatlar', 'Boshqa']
    },
    {
      id: 'grocery',
      name: 'Oziq-ovqat',
      icon: Utensils,
      color: 'emerald',
      categories: ['Ichimliklar', 'Sut mahsulotlari', 'Non mahsulotlari', 'Go\'sht', 'Sabzavotlar', 'Mevalar', 'Konservalar', 'Yog\'lar', 'Shirinliklar', 'Boshqa']
    },
    {
      id: 'clothing',
      name: 'Kiyim-kechak',
      icon: Shirt,
      color: 'violet',
      categories: ['Erkaklar kiyimi', 'Ayollar kiyimi', 'Bolalar kiyimi', 'Poyabzal', 'Sumkalar', 'Aksessuarlar', 'Sport kiyimi', 'Ichki kiyim', 'Bosh kiyimlar', 'Boshqa']
    },
    {
      id: 'pharmacy',
      name: 'Apteka',
      icon: Pill,
      color: 'rose',
      categories: ['Dorilar', 'Vitaminlar', 'Tibbiy jihozlar', 'Gigiyena', 'Bog\'lovchi materiallar', 'Bolalar uchun', 'Kosmetika', 'Optika', 'Ortopediya', 'Boshqa']
    },
    {
      id: 'auto',
      name: 'Avto zapchastlar',
      icon: Car,
      color: 'amber',
      categories: ['Dvigatel qismlari', 'Tormoz tizimi', 'Yoritish', 'Akkumulyatorlar', 'Moylar', 'Filtrlar', 'Shinalar', 'Disklar', 'Avto kimyo', 'Boshqa']
    },
    {
      id: 'construction',
      name: 'Qurilish mollari',
      icon: Hammer,
      color: 'orange',
      categories: ['Sement', 'G\'isht', 'Yog\'och', 'Metall', 'Bo\'yoqlar', 'Santexnika', 'Elektrika', 'Plitka', 'Izolyatsiya', 'Boshqa']
    },
    {
      id: 'cosmetics',
      name: 'Kosmetika',
      icon: Gift,
      color: 'pink',
      categories: ['Yuz pardozi', 'Soch mahsulotlari', 'Parfyumeriya', 'Tana parvarishi', 'Tirnoq uchun', 'Erkaklar uchun', 'Bolalar uchun', 'Aksessuarlar', 'Organik', 'Boshqa']
    },
    {
      id: 'household',
      name: 'Uy-ro\'zg\'or',
      icon: ShoppingBag,
      color: 'cyan',
      categories: ['Idish-tovoq', 'Maishiy texnika', 'Mebel', 'Dekor', 'Tozalash vositalari', 'To\'qimachilik', 'Bog\' uchun', 'Yoritish', 'Saqlash jihozlari', 'Boshqa']
    },
    {
      id: 'agriculture',
      name: 'Qishloq xo\'jaligi',
      icon: Leaf,
      color: 'lime',
      categories: ['Urug\'lar', 'O\'g\'itlar', 'Pestitsidlar', 'Asboblar', 'Sug\'orish', 'Issiqxona', 'Chorvachilik', 'Parrandachilik', 'Texnika', 'Boshqa']
    },
    {
      id: 'kids',
      name: 'Bolalar mollari',
      icon: Baby,
      color: 'sky',
      categories: ['O\'yinchoqlar', 'Bolalar kiyimi', 'Ovqatlanish', 'Gigiyena', 'Mebel', 'Transport', 'Maktab uchun', 'Sport', 'Kitoblar', 'Boshqa']
    },
    {
      id: 'books',
      name: 'Kitob/Kantselyariya',
      icon: BookOpen,
      color: 'indigo',
      categories: ['Kitoblar', 'Daftarlar', 'Yozuv qurollari', 'O\'quv qurollari', 'Ofis jihozlari', 'San\'at mollari', 'Sovg\'alar', 'Sumkalar', 'Sport jihozlari', 'Boshqa']
    },
    {
      id: 'sports',
      name: 'Sport mollari',
      icon: Dumbbell,
      color: 'red',
      categories: ['Kiyim', 'Poyabzal', 'Trenajerlar', 'Og\'irliklar', 'Yoga', 'Velosiped', 'Futbol', 'Suzish', 'Turizm', 'Boshqa']
    },
    {
      id: 'other',
      name: 'Boshqa',
      icon: MoreHorizontal,
      color: 'slate',
      categories: ['Kategoriya 1', 'Kategoriya 2', 'Kategoriya 3', 'Kategoriya 4', 'Kategoriya 5', 'Boshqa']
    }
  ];

  // Login
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Login va parolni kiriting!');
      return;
    }

    setLoading(true);
    
    const result = await AuthService.login(username, password);
    
    if (result.success) {
      toast.success('Xush kelibsiz!');
      onLogin(result.user);
    } else {
      toast.error(result.error);
    }
    
    setLoading(false);
  };

  // Registration
  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (!adminName || !adminUsername || !adminPassword) {
      toast.error('Barcha maydonlarni to\'ldiring!');
      return;
    }

    // Parol kuchliligini tekshirish
    const strength = checkPasswordStrength(adminPassword);
    if (!strength.isValid) {
      toast.error(strength.message);
      return;
    }

    setLoading(true);

    // Trial muddat (14 kun)
    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 14);

    const companyData = {
      name: companyName,
      phone: companyPhone,
      storeType: storeType,
      plan: null, // Trial
      trialEnds: trialEnds,
      maxUsers: 2,
      maxProducts: 50,
      isActive: true,
      isDeleted: false
    };

    const adminData = {
      name: adminName,
      username: adminUsername,
      password: adminPassword
    };

    const result = await AuthService.registerCompany(companyData, adminData);

    if (result.success) {
      // Kategoriyalar qo'shish
      const selectedStore = storeTypes.find(s => s.id === storeType);
      if (selectedStore) {
        for (const category of selectedStore.categories) {
          await addDoc(collection(db, 'categories'), {
            name: category,
            companyId: result.company.id,
            createdAt: new Date()
          });
        }
      }

      toast.success('🎉 Ro\'yxatdan o\'tdingiz! 14 kunlik sinov davri boshlandi.');
      onLogin(result.user);
    } else {
      toast.error(result.error);
    }

    setLoading(false);
  };

  // Parol o'zgarganda kuchlilikni tekshirish
  const handlePasswordChange = (value) => {
    setAdminPassword(value);
    if (value.length > 0) {
      setPasswordStrength(checkPasswordStrength(value));
    } else {
      setPasswordStrength(null);
    }
  };

  const goBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      setIsRegister(false);
    }
  };

  const getColorClasses = (color, isSelected) => {
    const colors = {
      blue: isSelected ? 'bg-blue-500 text-white border-blue-500' : 'bg-blue-50 text-blue-600 border-blue-200 hover:border-blue-400',
      emerald: isSelected ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:border-emerald-400',
      violet: isSelected ? 'bg-violet-500 text-white border-violet-500' : 'bg-violet-50 text-violet-600 border-violet-200 hover:border-violet-400',
      rose: isSelected ? 'bg-rose-500 text-white border-rose-500' : 'bg-rose-50 text-rose-600 border-rose-200 hover:border-rose-400',
      amber: isSelected ? 'bg-amber-500 text-white border-amber-500' : 'bg-amber-50 text-amber-600 border-amber-200 hover:border-amber-400',
      orange: isSelected ? 'bg-orange-500 text-white border-orange-500' : 'bg-orange-50 text-orange-600 border-orange-200 hover:border-orange-400',
      pink: isSelected ? 'bg-pink-500 text-white border-pink-500' : 'bg-pink-50 text-pink-600 border-pink-200 hover:border-pink-400',
      cyan: isSelected ? 'bg-cyan-500 text-white border-cyan-500' : 'bg-cyan-50 text-cyan-600 border-cyan-200 hover:border-cyan-400',
      lime: isSelected ? 'bg-lime-500 text-white border-lime-500' : 'bg-lime-50 text-lime-600 border-lime-200 hover:border-lime-400',
      sky: isSelected ? 'bg-sky-500 text-white border-sky-500' : 'bg-sky-50 text-sky-600 border-sky-200 hover:border-sky-400',
      indigo: isSelected ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:border-indigo-400',
      red: isSelected ? 'bg-red-500 text-white border-red-500' : 'bg-red-50 text-red-600 border-red-200 hover:border-red-400',
      slate: isSelected ? 'bg-slate-500 text-white border-slate-500' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-400',
    };
    return colors[color] || colors.slate;
  };

  const getStrengthColor = (score) => {
    if (score <= 2) return 'bg-rose-500';
    if (score <= 4) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shadow-2xl ring-4 ring-white/10">
            <Store className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">CRM Pro</h1>
          <p className="text-emerald-100 mt-2">Do'kon boshqaruv tizimi</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Login */}
          {!isRegister && (
            <form onSubmit={handleLogin} className="p-8">
              <h2 className="text-2xl font-bold text-slate-800 mb-6">Kirish</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">Login</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Login kiriting"
                      className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">Parol</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Parol kiriting"
                      className="w-full pl-12 pr-12 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-semibold hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/25 active:scale-[0.98]"
              >
                {loading ? 'Kirilmoqda...' : 'Kirish'}
              </button>

              <div className="mt-6 text-center">
                <p className="text-slate-500">
                  Hisobingiz yo'qmi?{' '}
                  <button
                    type="button"
                    onClick={() => { setIsRegister(true); setStep(1); }}
                    className="text-emerald-600 font-semibold hover:underline"
                  >
                    Ro'yxatdan o'tish
                  </button>
                </p>
              </div>

              {/* Xavfsizlik belgisi */}
              <div className="mt-6 flex items-center justify-center gap-2 text-slate-400 text-sm">
                <Shield className="w-4 h-4" />
                <span>256-bit shifrlash bilan himoyalangan</span>
              </div>
            </form>
          )}

          {/* Registration Step 1: Company Info */}
          {isRegister && step === 1 && (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <button onClick={goBack} className="p-2 hover:bg-slate-100 rounded-lg">
                  <ChevronRight className="w-5 h-5 text-slate-400 rotate-180" />
                </button>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Do'kon ma'lumotlari</h2>
                  <p className="text-sm text-slate-500">1-qadam: Kompaniya haqida</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">Do'kon nomi *</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Misol: Texno Market"
                      className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">Telefon raqami</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="tel"
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      placeholder="+998 90 123 45 67"
                      className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  if (!companyName.trim()) {
                    toast.error('Do\'kon nomini kiriting!');
                    return;
                  }
                  setStep(2);
                }}
                className="w-full mt-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
              >
                Davom etish
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Registration Step 2: Store Type */}
          {isRegister && step === 2 && (
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <button onClick={goBack} className="p-2 hover:bg-slate-100 rounded-lg">
                  <ChevronRight className="w-5 h-5 text-slate-400 rotate-180" />
                </button>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Faoliyat turini tanlang</h2>
                  <p className="text-sm text-slate-500">2-qadam: Do'kon turi</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-2">
                {storeTypes.map((store) => (
                  <button
                    key={store.id}
                    onClick={() => setStoreType(store.id)}
                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${getColorClasses(store.color, storeType === store.id)}`}
                  >
                    <store.icon className="w-8 h-8" />
                    <span className="text-xs font-medium text-center leading-tight">{store.name}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  if (!storeType) {
                    toast.error('Faoliyat turini tanlang!');
                    return;
                  }
                  setStep(3);
                }}
                disabled={!storeType}
                className="w-full mt-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-semibold hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
              >
                Davom etish
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Registration Step 3: Admin Info */}
          {isRegister && step === 3 && (
            <form onSubmit={handleRegister} className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <button type="button" onClick={goBack} className="p-2 hover:bg-slate-100 rounded-lg">
                  <ChevronRight className="w-5 h-5 text-slate-400 rotate-180" />
                </button>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Admin ma'lumotlari</h2>
                  <p className="text-sm text-slate-500">3-qadam: Hisob yaratish</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">Ismingiz *</label>
                  <input
                    type="text"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="To'liq ism"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">Login *</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                      placeholder="admin"
                      className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">Parol *</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={adminPassword}
                      onChange={(e) => handlePasswordChange(e.target.value)}
                      placeholder="Kuchli parol kiriting"
                      className="w-full pl-12 pr-12 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  
                  {/* Password Strength Indicator */}
                  {passwordStrength && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div 
                            key={i}
                            className={`h-1 flex-1 rounded-full ${
                              i <= passwordStrength.score 
                                ? getStrengthColor(passwordStrength.score)
                                : 'bg-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                      <p className={`text-xs ${
                        passwordStrength.score <= 2 ? 'text-rose-500' :
                        passwordStrength.score <= 4 ? 'text-amber-500' :
                        'text-emerald-500'
                      }`}>
                        {passwordStrength.message}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Summary */}
              <div className="mt-6 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                <p className="text-sm text-emerald-800 font-medium">Tanlangan:</p>
                <p className="text-emerald-600">📍 {companyName}</p>
                <p className="text-emerald-600">🏪 {storeTypes.find(s => s.id === storeType)?.name}</p>
                <p className="text-xs text-emerald-500 mt-2">✨ 14 kunlik bepul trial</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-semibold hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/25"
              >
                {loading ? 'Yaratilmoqda...' : 'Hisob yaratish'}
              </button>

              <p className="text-center text-slate-500 text-sm mt-4">
                Hisobingiz bormi?{' '}
                <button
                  type="button"
                  onClick={() => { setIsRegister(false); setStep(1); }}
                  className="text-emerald-600 font-semibold hover:underline"
                >
                  Kirish
                </button>
              </p>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-emerald-200 text-sm mt-6">
          © 2024 CRM Pro. Barcha huquqlar himoyalangan.
        </p>
      </div>
    </div>
  );
};

export default Login;
