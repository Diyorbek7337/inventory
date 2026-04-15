import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './firebase';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ThemeProvider } from './ThemeContext';

// Public catalog (no auth required)
import PublicCatalog from './components/PublicCatalog';

// Komponentlar
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Income from './components/Income';
import Outcome from './components/Outcome';
import ProductList from './components/ProductList';
import Statistics from './components/Statistics';
import Users from './components/Users';
import Sales from './components/Sales';
import CompanySettings from './components/CompanySettings';
import Debtors from './components/Debtors';
import SlowMovingProducts from './components/SlowMovingProducts';
import Inventory from './components/Inventory';
import Backup from './components/Backup';
import Marketing from './components/Marketing';
import Settings from './components/Settings';
import Orders from './components/Orders';
import SuperAdminLogin from './components/SuperAdminLogin';
import SuperAdminDashboard from './components/SuperAdminDashboard';

// Services
import AuthService from './utils/authService';

function AppInner() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [showSuperAdmin, setShowSuperAdmin] = useState(false);
  const [superAdminLoggedIn, setSuperAdminLoggedIn] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    const saved = localStorage.getItem('bannerDismissedUntil');
    return saved ? new Date() < new Date(saved) : false;
  });

  // Ma'lumotlar
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [companyData, setCompanyData] = useState(null);

  // Session timeout
  const SESSION_TIMEOUT = 30 * 60 * 1000;

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Internet qayta ulandi!');
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Internet uzildi. Offline rejimda ishlayapsiz.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Super Admin keyboard shortcut: Ctrl+Shift+S
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        setShowSuperAdmin(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Firebase Auth — session boshqaruvi
  // onAuthStateChanged: sahifa yangilanganda, boshqa tabda ham sessiya saqlanadi
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userSnap.exists()) {
            const userData = userSnap.data();
            // Bloklangan yoki o'chirilgan foydalanuvchi
            if (userData.isDeleted || !userData.isActive) {
              await AuthService.logout();
              setCurrentUser(null);
            } else {
              setCurrentUser({ id: firebaseUser.uid, ...userData });
            }
          } else {
            // Firestore da hujjat yo'q (registratsiya jarayonida bo'lishi mumkin)
            // logout() chaqirmaymiz — faqat currentUser ni tozalaymiz
            setCurrentUser(null);
          }
        } catch {
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Faollik kuzatish
  useEffect(() => {
    if (!currentUser) return;

    let timeout;
    const resetTimer = () => {
      clearTimeout(timeout);
      localStorage.setItem('loginTime', Date.now().toString());
      timeout = setTimeout(() => {
        toast.warning('Sessiya tugadi. Qayta kiring.');
        handleLogout();
      }, SESSION_TIMEOUT);
    };

    const events = ['mousemove', 'keypress', 'click', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      events.forEach(event => window.removeEventListener(event, resetTimer));
      clearTimeout(timeout);
    };
  }, [currentUser]);

  // Ma'lumotlarni yuklash
  useEffect(() => {
    if (currentUser?.companyId) {
      loadData();
    }
  }, [currentUser]);

  // Kompaniya ma'lumotlarini real-time listener bilan yuklash
  useEffect(() => {
    if (!currentUser?.companyId) return;

    const unsub = onSnapshot(
      doc(db, 'companies', currentUser.companyId),
      (snap) => {
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() };
          setCompanyData(data);
          // Agar obuna yangilangan bo'lsa bannerni avtomatik yashirish
          setBannerDismissed(false);
          localStorage.removeItem('bannerDismissedUntil');
        }
      },
      (error) => console.error('Kompaniya ma\'lumotlari yuklanmadi:', error)
    );

    return () => unsub();
  }, [currentUser?.companyId]);

  const loadCompanyData = async () => {
    try {
      const companyDoc = await getDoc(doc(db, 'companies', currentUser.companyId));
      if (companyDoc.exists()) {
        setCompanyData({ id: companyDoc.id, ...companyDoc.data() });
      }
    } catch (error) {
      console.error('Kompaniya ma\'lumotlari yuklanmadi:', error);
    }
  };

  const loadData = async () => {
    try {
      // Mahsulotlar
      const productsQuery = query(
        collection(db, 'products'),
        where('companyId', '==', currentUser.companyId)
      );
      const productsSnap = await getDocs(productsQuery);
      setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Tranzaksiyalar
      const transQuery = query(
        collection(db, 'transactions'),
        where('companyId', '==', currentUser.companyId)
      );
      const transSnap = await getDocs(transQuery);
      setTransactions(transSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate() || new Date()
      })));

      // Kategoriyalar
      const catQuery = query(
        collection(db, 'categories'),
        where('companyId', '==', currentUser.companyId)
      );
      const catSnap = await getDocs(catQuery);
      setCategories(catSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

    } catch (error) {
      console.error('Ma\'lumotlar yuklanmadi:', error);
      if (isOnline) {
        toast.error('Ma\'lumotlar yuklanmadi!');
      }
    }
  };

  const handleLogin = (userData) => {
    // onAuthStateChanged setCurrentUser ni o'zi chaqiradi,
    // lekin activeMenu ni bu yerda belgilaymiz (tezroq UI o'tishi uchun)
    setCurrentUser(userData);
    const userRole = userData?.role || 'sotuvchi';
    if (userRole === 'sotuvchi') setActiveMenu('outcome');
    else setActiveMenu('dashboard');
  };

  const handleLogout = async () => {
    await AuthService.logout(); // Firebase signOut + localStorage tozalash
    setCurrentUser(null);
    setProducts([]);
    setTransactions([]);
    setCategories([]);
    setCompanyData(null);
    setActiveMenu('dashboard');
  };

  // Tarif cheklovlari
  const getPlanLimits = () => {
    const plan = companyData?.plan || 'trial';
    const limits = {
      trial: { maxUsers: 2, maxProducts: 50 },
      starter: { maxUsers: 5, maxProducts: 500 },
      basic: { maxUsers: 10, maxProducts: 2000 },
      pro: { maxUsers: 999, maxProducts: 99999 }
    };
    return companyData?.maxProducts 
      ? { maxUsers: companyData.maxUsers, maxProducts: companyData.maxProducts }
      : limits[plan] || limits.trial;
  };

  // Trial yoki obuna muddati tugaganmi?
  const isSubscriptionExpired = () => {
    if (!companyData) return false;

    // Faol emas deb belgilangan kompaniyalar
    if (companyData.isActive === false) return true;

    // Trial tekshirish
    if (companyData.plan === 'trial') {
      if (!companyData.trialEndsAt) return false;
      const endDate = companyData.trialEndsAt.seconds
        ? new Date(companyData.trialEndsAt.seconds * 1000)
        : new Date(companyData.trialEndsAt);
      return new Date() > endDate;
    }

    // To'langan tarif — faqat subscriptionEnd aniq belgilangan va o'tib ketgan bo'lsa
    if (companyData.subscriptionEnd) {
      const endDate = companyData.subscriptionEnd.seconds
        ? new Date(companyData.subscriptionEnd.seconds * 1000)
        : new Date(companyData.subscriptionEnd);
      return new Date() > endDate;
    }

    // subscriptionEnd yo'q = admin hali belgilamagan yoki cheksiz → expired emas
    return false;
  };

  // Mahsulot limitini tekshirish
  const canAddProduct = () => {
    const limits = getPlanLimits();
    return products.length < limits.maxProducts;
  };

  // Mahsulot qo'shish/yangilash
  const handleAddProduct = (product) => {
    const limits = getPlanLimits();
    if (products.length >= limits.maxProducts) {
      toast.error(`Tarif limiti: ${limits.maxProducts} ta mahsulot. Tarifni yangilang!`);
      return false;
    }
    setProducts(prev => [...prev, product]);
    // Kompaniya statistikasini yangilash
    setCompanyData(prev => prev ? { ...prev, currentProducts: (prev.currentProducts || 0) + 1 } : prev);
    return true;
  };

  // Tarif o'zgarganda
  const handlePlanChange = (newPlanData) => {
    setCompanyData(prev => ({
      ...prev,
      ...newPlanData
    }));
    toast.success('Tarif yangilandi!');
  };

  const handleUpdateProduct = (updatedProduct) => {
    setProducts(prev => prev.map(p => 
      p.id === updatedProduct.id ? updatedProduct : p
    ));
  };

  const handleDeleteProduct = (productId) => {
    setProducts(prev => prev.filter(p => p.id !== productId));
  };

  // Tranzaksiya qo'shish/yangilash
  const handleAddTransaction = (transaction) => {
    setTransactions(prev => [...prev, transaction]);
  };

  const handleUpdateTransaction = (updatedTrans) => {
    setTransactions(prev => prev.map(t => 
      t.id === updatedTrans.id ? updatedTrans : t
    ));
  };

  // Kategoriya qo'shish/o'chirish
  const handleAddCategory = (category) => {
    setCategories(prev => [...prev, category]);
  };

  const handleDeleteCategory = (categoryId) => {
    setCategories(prev => prev.filter(c => c.id !== categoryId));
  };

  const role      = currentUser?.role || 'sotuvchi';
  const isAdmin   = role === 'admin';
  const isMenejer = role === 'menejer';
  const isKassir  = role === 'kassir';
  // Menejer ham ko'p bo'limlarni ko'ra oladi (tannarxdan tashqari)
  const isManager = isAdmin || isMenejer;

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-600 dark:text-slate-400">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    // Super Admin Dashboard
    if (superAdminLoggedIn) {
      return (
        <>
          <ToastContainer position="top-center" autoClose={3000} theme="dark" />
          <SuperAdminDashboard 
            onBack={() => {
              setSuperAdminLoggedIn(false);
              setShowSuperAdmin(false);
            }} 
          />
        </>
      );
    }

    // Super Admin Login
    if (showSuperAdmin) {
      return (
        <>
          <ToastContainer position="top-center" autoClose={3000} theme="dark" />
          <SuperAdminLogin 
            onLogin={() => setSuperAdminLoggedIn(true)}
            onBack={() => setShowSuperAdmin(false)}
          />
        </>
      );
    }

    // Normal Login with hidden Super Admin access
    return (
      <>
        <ToastContainer position="top-center" autoClose={3000} theme="dark" />
        <Login onLogin={handleLogin} />
        {/* Super Admin kirish uchun yashirin tugma */}
        <button
          onClick={() => {
            const clicks = parseInt(localStorage.getItem('superAdminClicks') || '0') + 1;
            localStorage.setItem('superAdminClicks', clicks.toString());
            if (clicks >= 5) {
              setShowSuperAdmin(true);
              localStorage.removeItem('superAdminClicks');
            }
          }}
          className="fixed bottom-4 left-4 w-12 h-12 opacity-0 hover:opacity-10"
          title=""
        />
      </>
    );
  }

  // Main App
  const renderContent = () => {
    // Kassir: outcome, sales, debtors
    if (isKassir) {
      if (activeMenu === 'sales') {
        return (
          <Sales
            transactions={transactions}
            isAdmin={isAdmin}
            companyData={companyData}
          />
        );
      }
      if (activeMenu === 'debtors') {
        return (
          <Debtors
            transactions={transactions}
            onUpdateTransaction={handleUpdateTransaction}
            currentUser={currentUser}
          />
        );
      }
      // Default: outcome
      return (
        <Outcome
          products={products}
          onUpdateProduct={handleUpdateProduct}
          onAddTransaction={handleAddTransaction}
          currentUser={currentUser}
          isAdmin={isAdmin}
          companyData={companyData}
        />
      );
    }

    // Sotuvchi faqat outcome ko'radi
    if (!isManager && !isKassir && activeMenu !== 'outcome') {
      return (
        <Outcome
          products={products}
          onUpdateProduct={handleUpdateProduct}
          onAddTransaction={handleAddTransaction}
          currentUser={currentUser}
          isAdmin={isAdmin}
          companyData={companyData}
        />
      );
    }

    switch (activeMenu) {
      case 'dashboard':
        return (
          <Dashboard
            products={products}
            transactions={transactions}
            isAdmin={isAdmin}
            companyData={companyData}
          />
        );
      case 'income':
        return isManager ? (
          <Income
            products={products}
            categories={categories}
            onAddProduct={handleAddProduct}
            onUpdateProduct={handleUpdateProduct}
            onAddTransaction={handleAddTransaction}
            onAddCategory={handleAddCategory}
            onDeleteCategory={handleDeleteCategory}
            currentUser={currentUser}
            isAdmin={isAdmin}
            companyData={companyData}
          />
        ) : null;
      case 'outcome':
        return (
          <Outcome
            products={products}
            onUpdateProduct={handleUpdateProduct}
            onAddTransaction={handleAddTransaction}
            currentUser={currentUser}
            isAdmin={isAdmin}
            companyData={companyData}
          />
        );
      case 'products':
        return isManager ? (
          <ProductList
            products={products}
            categories={categories}
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
            isAdmin={isAdmin}
          />
        ) : null;
      case 'sales':
        return isManager ? (
          <Sales
            transactions={transactions}
            isAdmin={isAdmin}
            companyData={companyData}
          />
        ) : null;
      case 'debtors':
        return isManager ? (
          <Debtors
            transactions={transactions}
            onUpdateTransaction={handleUpdateTransaction}
            currentUser={currentUser}
          />
        ) : null;
      case 'marketing':
        return isManager ? (
          <Marketing currentUser={currentUser} />
        ) : null;
      case 'statistics':
        return isManager ? (
          <Statistics
            products={products}
            transactions={transactions}
            isAdmin={isAdmin}
          />
        ) : null;
      case 'inventory':
        return isAdmin ? (
          <SlowMovingProducts
            products={products}
            transactions={transactions}
            isAdmin={isAdmin}
          />
        ) : null;
      case 'stockcount':
        return isAdmin ? (
          <Inventory
            products={products}
            onUpdateProduct={handleUpdateProduct}
            currentUser={currentUser}
          />
        ) : null;
      case 'backup':
        return isAdmin ? (
          <Backup
            currentUser={currentUser}
            products={products}
            transactions={transactions}
          />
        ) : null;
      case 'users':
        return isAdmin ? (
          <Users
            currentUser={currentUser}
            companyData={companyData}
          />
        ) : null;
      case 'orders':
        return isManager ? (
          <Orders currentUser={currentUser} />
        ) : null;
      case 'settings':
        return isAdmin ? (
          <Settings
            currentUser={currentUser}
            companyData={companyData}
            onPlanChange={handlePlanChange}
            onUserUpdate={(updates) => setCurrentUser(prev => ({ ...prev, ...updates }))}
          />
        ) : null;
      default:
        return (
          <Dashboard products={products} transactions={transactions} isAdmin={isAdmin} />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex">
      <ToastContainer
        position="top-center"
        autoClose={3000}
        theme="colored"
        toastClassName="rounded-xl"
      />
      
      {/* Offline Banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white text-center py-2 z-50 text-sm font-medium">
          📴 Offline rejim - Internet yo'q
        </div>
      )}

      {/* Subscription Expired Banner */}
      {isSubscriptionExpired() && isOnline && !bannerDismissed && (
        <div className="fixed top-0 left-0 right-0 bg-rose-500 text-white text-center py-2.5 z-50">
          <div className="flex items-center justify-center gap-2 flex-wrap px-4">
            <span className="font-semibold text-sm">
              ⚠️ {companyData?.plan === 'trial' ? 'Sinov muddati tugadi!' : 'Obuna muddati tugadi!'}
            </span>
            <button
              onClick={() => setActiveMenu('settings')}
              className="px-3 py-1 bg-white text-rose-600 rounded-lg font-semibold text-sm hover:bg-rose-50"
            >
              Tarifni yangilash
            </button>
            <button
              onClick={async () => {
                await loadCompanyData();
                toast.info('Obuna ma\'lumotlari yangilandi');
              }}
              className="px-3 py-1 bg-rose-400 text-white rounded-lg font-semibold text-sm hover:bg-rose-300"
            >
              🔄 Yangilash
            </button>
            <button
              onClick={() => {
                setBannerDismissed(true);
                // 24 soat yashirish
                const until = new Date(Date.now() + 24 * 60 * 60 * 1000);
                localStorage.setItem('bannerDismissedUntil', until.toISOString());
              }}
              className="px-3 py-1 bg-rose-700 text-white rounded-lg font-semibold text-sm hover:bg-rose-600"
              title="Bannerni yashirish"
            >
              ✕ Yashirish
            </button>
          </div>
        </div>
      )}
      
      <Sidebar 
        activeMenu={activeMenu}
        setActiveMenu={setActiveMenu}
        onLogout={handleLogout}
        currentUser={currentUser}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
      />

      <main className={`flex-1 min-h-screen lg:ml-0 overflow-y-auto bg-slate-50 dark:bg-slate-900 ${!isOnline ? 'pt-10' : ''}`}>
        {renderContent()}
      </main>
    </div>
  );
}

// ─── Public shop routing (/shop/:slug) ───────────────────────────────────────
function getPublicSlug() {
  const path = window.location.pathname;
  const match = path.match(/^\/shop\/([^/]+)/);
  return match ? match[1] : null;
}

function App() {
  const slug = getPublicSlug();
  if (slug) {
    return <PublicCatalog slug={slug} />;
  }
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}

export default App;
