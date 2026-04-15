import { useState, useEffect, useMemo } from 'react';
import {
  ShoppingCart, Search, Plus, Minus, Trash2, X,
  Phone, MapPin, Clock, Package, ChevronRight,
  Check, Truck, Banknote, CreditCard, Store, AlertCircle
} from 'lucide-react';
import {
  collection, query, where, getDocs,
  doc, getDoc, addDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';

// Telegram ga xabar yuborish
const sendTelegramMessage = async (token, chatId, text) => {
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch { /* skip */ }
};

// Buyurtma raqami generatsiya
const genOrderNumber = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}${pad(d.getMonth()+1)}-${Math.floor(1000 + Math.random() * 9000)}`;
};

const PublicCatalog = ({ slug }) => {
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [showOrder, setShowOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Order form
  const [form, setForm] = useState({
    name: '', phone: '', address: '', note: '',
    paymentType: 'naqd', deliveryType: 'pickup',
  });

  useEffect(() => {
    loadStore();
  }, [slug]);

  const loadStore = async () => {
    setLoading(true);
    try {
      // Online do'konni slug bo'yicha qidirish
      const storesQuery = query(
        collection(db, 'onlineStores'),
        where('slug', '==', slug)
      );
      const storeSnap = await getDocs(storesQuery);

      if (storeSnap.empty) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const storeData = { id: storeSnap.docs[0].id, ...storeSnap.docs[0].data() };

      if (!storeData.isActive) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setStore(storeData);

      // Mahsulotlarni yuklash (faqat showOnline: true va miqdori > 0)
      const productsQuery = query(
        collection(db, 'products'),
        where('companyId', '==', storeData.companyId),
        where('showOnline', '==', true)
      );
      const productsSnap = await getDocs(productsQuery);
      const prods = productsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => p.quantity > 0);
      setProducts(prods);
    } catch (e) {
      console.error('PublicCatalog error:', e);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  // Kategoriyalar
  const categories = useMemo(() =>
    [...new Set(products.filter(p => p.category).map(p => p.category))].sort(),
    [products]
  );

  // Filtrlangan mahsulotlar
  const filteredProducts = useMemo(() =>
    products.filter(p => {
      const matchSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = !selectedCategory || p.category === selectedCategory;
      return matchSearch && matchCat;
    }),
    [products, searchTerm, selectedCategory]
  );

  // Savat operatsiyalari
  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        if (existing.qty >= product.quantity) {
          toast.warning(`Omborda faqat ${product.quantity} ta bor!`);
          return prev;
        }
        return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...product, qty: 1 }];
    });
    toast.success(`${product.name} savatga qo'shildi`, { autoClose: 1000 });
  };

  const updateQty = (id, newQty) => {
    if (newQty <= 0) {
      setCart(prev => prev.filter(i => i.id !== id));
    } else {
      const product = products.find(p => p.id === id);
      if (product && newQty > product.quantity) {
        toast.warning(`Omborda faqat ${product.quantity} ta bor!`);
        return;
      }
      setCart(prev => prev.map(i => i.id === id ? { ...i, qty: newQty } : i));
    }
  };

  const cartTotal = cart.reduce((sum, i) => sum + i.qty * (i.sellingPrice || i.price || 0), 0);
  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);
  const deliveryCost = store?.deliveryEnabled && form.deliveryType === 'delivery'
    ? (cartTotal >= (store.deliveryFreeFrom || 0) ? 0 : (store.deliveryBaseCost || 0))
    : 0;
  const grandTotal = cartTotal + deliveryCost;

  const submitOrder = async () => {
    if (!form.name.trim()) { toast.error('Ismingizni kiriting!'); return; }
    if (!form.phone.trim()) { toast.error('Telefon raqamingizni kiriting!'); return; }
    if (form.deliveryType === 'delivery' && !form.address.trim()) {
      toast.error('Yetkazib berish uchun manzil kiriting!');
      return;
    }
    if (cart.length === 0) { toast.error('Savat bo\'sh!'); return; }

    setSubmitting(true);
    try {
      const orderNumber = genOrderNumber();
      const orderData = {
        companyId: store.companyId,
        orderNumber,
        status: 'yangi',
        customer: {
          name: form.name.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
        },
        items: cart.map(i => ({
          productId: i.id,
          name: i.name,
          image: i.imageUrl || '',
          qty: i.qty,
          price: i.sellingPrice || i.price || 0,
          total: i.qty * (i.sellingPrice || i.price || 0),
        })),
        subtotal: cartTotal,
        deliveryCost,
        totalAmount: grandTotal,
        paymentType: form.paymentType,
        deliveryType: form.deliveryType,
        note: form.note.trim(),
        source: 'online',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await addDoc(collection(db, 'orders'), orderData);

      // Telegram xabarnomasi
      if (store.telegramBotToken && store.telegramChatId) {
        const itemsText = cart.map(i =>
          `• ${i.name} × ${i.qty} — ${(i.qty * (i.sellingPrice || i.price || 0)).toLocaleString()} so'm`
        ).join('\n');

        const msg = [
          `🛒 <b>YANGI BUYURTMA #${orderNumber}</b>`,
          `━━━━━━━━━━━━━━━━━`,
          `👤 ${form.name} | 📞 ${form.phone}`,
          form.deliveryType === 'delivery' ? `📍 ${form.address}` : `🏪 O'zidan oladi`,
          ``,
          `📦 Mahsulotlar:`,
          itemsText,
          ``,
          deliveryCost > 0 ? `🚚 Yetkazish: ${deliveryCost.toLocaleString()} so'm` : '',
          `💰 <b>Jami: ${grandTotal.toLocaleString()} so'm</b>`,
          `💳 To'lov: ${form.paymentType === 'naqd' ? 'Naqd' : 'Karta'}`,
          form.note ? `📝 Izoh: ${form.note}` : '',
        ].filter(Boolean).join('\n');

        await sendTelegramMessage(store.telegramBotToken, store.telegramChatId, msg);
      }

      setOrderSuccess({ orderNumber, total: grandTotal });
      setCart([]);
      setShowOrder(false);
      setShowCart(false);
    } catch (e) {
      console.error(e);
      toast.error('Buyurtmada xatolik! Qaytadan urinib ko\'ring.');
    }
    setSubmitting(false);
  };

  // ─── LOADING ─────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{borderWidth: 3}} />
        <p className="text-slate-500">Yuklanmoqda...</p>
      </div>
    </div>
  );

  // ─── NOT FOUND ───────────────────────────────────────────────────
  if (notFound) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <Store className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-slate-700 mb-2">Do'kon topilmadi</h1>
        <p className="text-slate-500">Bu manzilda do'kon mavjud emas yoki vaqtincha nofaol.</p>
      </div>
    </div>
  );

  // ─── ORDER SUCCESS ───────────────────────────────────────────────
  if (orderSuccess) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="w-10 h-10 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Buyurtma qabul qilindi!</h2>
        <p className="text-slate-500 mb-4">Buyurtma raqami: <strong>#{orderSuccess.orderNumber}</strong></p>
        <p className="text-2xl font-bold text-emerald-600 mb-6">
          {orderSuccess.total.toLocaleString()} so'm
        </p>
        <p className="text-sm text-slate-500 mb-6">
          Tez orada siz bilan bog'lanamiz. Telefon raqamingizni faol ushlab turing.
        </p>
        {store.phone && (
          <a href={`tel:${store.phone}`}
            className="flex items-center justify-center gap-2 w-full py-3 border-2 border-emerald-500 text-emerald-600 rounded-2xl font-semibold hover:bg-emerald-50 mb-3">
            <Phone className="w-4 h-4" />
            {store.phone}
          </a>
        )}
        <button
          onClick={() => setOrderSuccess(null)}
          className="w-full py-3 bg-emerald-500 text-white rounded-2xl font-semibold hover:bg-emerald-600"
        >
          Yana buyurtma berish
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ─── HEADER ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          {store.logo ? (
            <img src={store.logo} alt={store.name} className="w-10 h-10 object-contain rounded-xl" />
          ) : (
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
              <Store className="w-5 h-5 text-white" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-slate-800 truncate">{store.name}</h1>
            {store.workHours && (
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />{store.workHours}
              </p>
            )}
          </div>
          {/* Savat */}
          <button
            onClick={() => setShowCart(true)}
            className="relative flex items-center gap-2 px-3 py-2 bg-emerald-500 text-white rounded-xl font-medium text-sm"
          >
            <ShoppingCart className="w-4 h-4" />
            <span className="hidden sm:inline">Savat</span>
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 bg-rose-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ─── BANNER ─────────────────────────────────────────────── */}
      {store.banner && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <img src={store.banner} alt="banner"
            className="w-full h-40 sm:h-56 object-cover rounded-2xl" />
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-4">

        {/* Do'kon info */}
        {(store.address || store.phone) && (
          <div className="flex flex-wrap gap-3 mb-4 text-sm text-slate-500">
            {store.phone && (
              <a href={`tel:${store.phone}`} className="flex items-center gap-1 hover:text-emerald-600">
                <Phone className="w-3.5 h-3.5" />{store.phone}
              </a>
            )}
            {store.address && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />{store.address}
              </span>
            )}
          </div>
        )}

        {/* ─── QIDIRUV ──────────────────────────────────────────── */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Mahsulot qidirish..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>

        {/* ─── KATEGORIYALAR ────────────────────────────────────── */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            <button
              onClick={() => setSelectedCategory('')}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${!selectedCategory ? 'bg-emerald-500 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-emerald-300'}`}
            >
              Barchasi
            </button>
            {categories.map(cat => (
              <button key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? '' : cat)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${selectedCategory === cat ? 'bg-emerald-500 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-emerald-300'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* ─── MAHSULOTLAR ──────────────────────────────────────── */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Mahsulot topilmadi</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredProducts.map(product => {
              const inCart = cart.find(i => i.id === product.id);
              const price = product.sellingPrice || product.price || 0;

              return (
                <div key={product.id}
                  className={`bg-white rounded-2xl overflow-hidden shadow-sm transition-all ${inCart ? 'ring-2 ring-emerald-400' : 'hover:shadow-md'}`}
                >
                  {/* Rasm */}
                  <div className="relative h-36 bg-slate-100">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name}
                        className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-10 h-10 text-slate-300" />
                      </div>
                    )}
                    {inCart && (
                      <span className="absolute top-2 right-2 min-w-[24px] h-6 px-1.5 bg-emerald-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow">
                        {inCart.qty}
                      </span>
                    )}
                    {product.quantity <= 5 && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 bg-rose-500 text-white text-[10px] font-bold rounded-full">
                        {product.quantity} ta qoldi
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <p className="font-semibold text-slate-800 text-sm line-clamp-2 mb-1">{product.name}</p>
                    {product.description && (
                      <p className="text-xs text-slate-400 line-clamp-1 mb-2">{product.description}</p>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-slate-900 text-base">{price.toLocaleString()} <span className="text-xs font-normal text-slate-400">so'm</span></p>
                      {inCart ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateQty(product.id, inCart.qty - 1)}
                            className="w-7 h-7 flex items-center justify-center bg-slate-100 rounded-lg hover:bg-slate-200 active:scale-95">
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center text-sm font-bold">{inCart.qty}</span>
                          <button onClick={() => updateQty(product.id, inCart.qty + 1)}
                            className="w-7 h-7 flex items-center justify-center bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 active:scale-95">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => addToCart(product)}
                          className="w-8 h-8 flex items-center justify-center bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 active:scale-95 flex-shrink-0">
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── QALQIB CHIQUVCHI SAVAT TUGMASI ──────────────────────── */}
      {cartCount > 0 && !showCart && !showOrder && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center z-30 px-4">
          <button
            onClick={() => setShowCart(true)}
            className="flex items-center gap-3 px-6 py-3.5 bg-emerald-500 text-white rounded-2xl shadow-2xl shadow-emerald-500/40 font-bold text-base active:scale-95 transition-all"
          >
            <ShoppingCart className="w-5 h-5" />
            <span>Savat — {cartTotal.toLocaleString()} so'm</span>
            <span className="px-2 py-0.5 bg-white/20 rounded-lg text-sm">{cartCount} ta</span>
          </button>
        </div>
      )}

      {/* ─── SAVAT DRAWER ────────────────────────────────────────── */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Savat ({cartCount} ta)
            </h2>
            <button onClick={() => setShowCart(false)} className="p-2 hover:bg-slate-100 rounded-xl">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {cart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-center">
                <div>
                  <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Savat bo'sh</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map(item => {
                  const price = item.sellingPrice || item.price || 0;
                  return (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name}
                          className="w-14 h-14 object-cover rounded-xl flex-shrink-0" />
                      ) : (
                        <div className="w-14 h-14 bg-slate-200 rounded-xl flex-shrink-0 flex items-center justify-center">
                          <Package className="w-6 h-6 text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 text-sm truncate">{item.name}</p>
                        <p className="text-sm text-slate-500">{price.toLocaleString()} so'm × {item.qty}</p>
                        <p className="font-bold text-slate-900 text-sm">{(price * item.qty).toLocaleString()} so'm</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => updateQty(item.id, item.qty - 1)}
                          className="w-8 h-8 flex items-center justify-center bg-slate-200 rounded-xl hover:bg-slate-300 active:scale-95">
                          {item.qty === 1 ? <Trash2 className="w-3.5 h-3.5 text-rose-500" /> : <Minus className="w-3.5 h-3.5" />}
                        </button>
                        <span className="w-8 text-center font-bold text-sm">{item.qty}</span>
                        <button onClick={() => updateQty(item.id, item.qty + 1)}
                          className="w-8 h-8 flex items-center justify-center bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 active:scale-95">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {cart.length > 0 && (
            <div className="px-4 py-4 border-t border-slate-200 bg-white">
              <div className="flex justify-between text-lg font-bold text-slate-800 mb-3">
                <span>Jami:</span>
                <span>{cartTotal.toLocaleString()} so'm</span>
              </div>
              <button
                onClick={() => { setShowCart(false); setShowOrder(true); }}
                className="w-full py-3.5 bg-emerald-500 text-white rounded-2xl font-bold text-base hover:bg-emerald-600 active:scale-[0.99] flex items-center justify-center gap-2"
              >
                Buyurtma berish
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── BUYURTMA FORMASI ─────────────────────────────────────── */}
      {showOrder && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
            <button onClick={() => { setShowOrder(false); setShowCart(true); }}
              className="p-2 hover:bg-slate-100 rounded-xl">
              <ChevronRight className="w-5 h-5 text-slate-500 rotate-180" />
            </button>
            <h2 className="font-bold text-slate-800 text-lg">Buyurtma rasmiylashtirish</h2>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {/* Ma'lumotlar */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ismingiz *</label>
                <input type="text" value={form.name}
                  onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="To'liq ism"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Telefon *</label>
                <input type="tel" value={form.phone}
                  onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+998 90 123 45 67"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>

            {/* Olish usuli */}
            {store.deliveryEnabled && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Olish usuli</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { val: 'pickup', icon: Store, label: 'O\'zim olaman' },
                    { val: 'delivery', icon: Truck, label: 'Yetkazib bering' },
                  ].map(({ val, icon: Icon, label }) => (
                    <button key={val}
                      onClick={() => setForm(p => ({ ...p, deliveryType: val }))}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all ${form.deliveryType === val ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600'}`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
                {form.deliveryType === 'delivery' && (
                  <div className="mt-2">
                    <input type="text" value={form.address}
                      onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))}
                      placeholder="Yetkazib berish manzili *"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
                    {store.deliveryBaseCost > 0 && cartTotal < store.deliveryFreeFrom && (
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        Yetkazish: {store.deliveryBaseCost.toLocaleString()} so'm •
                        {(store.deliveryFreeFrom - cartTotal).toLocaleString()} so'mdan ko'p buyurtmada bepul
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* To'lov */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">To'lov usuli</label>
              <div className="space-y-2">
                {store.paymentCash && (
                  <label className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${form.paymentType === 'naqd' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
                    <input type="radio" name="payment" value="naqd" checked={form.paymentType === 'naqd'}
                      onChange={() => setForm(p => ({ ...p, paymentType: 'naqd' }))}
                      className="accent-emerald-500" />
                    <Banknote className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium">Naqd pul</span>
                  </label>
                )}
                {store.paymentCard && (
                  <label className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${form.paymentType === 'karta' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>
                    <input type="radio" name="payment" value="karta" checked={form.paymentType === 'karta'}
                      onChange={() => setForm(p => ({ ...p, paymentType: 'karta' }))}
                      className="accent-emerald-500" />
                    <CreditCard className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium">Karta</span>
                  </label>
                )}
              </div>
            </div>

            {/* Izoh */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Izoh (ixtiyoriy)</label>
              <textarea value={form.note}
                onChange={(e) => setForm(p => ({ ...p, note: e.target.value }))}
                rows={2} placeholder="Qo'shimcha ma'lumot..."
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-emerald-500" />
            </div>

            {/* Buyurtma xulosasi */}
            <div className="p-4 bg-slate-50 rounded-2xl space-y-2 text-sm">
              <p className="font-semibold text-slate-800 mb-3">Buyurtma xulosasi</p>
              {cart.map(i => (
                <div key={i.id} className="flex justify-between text-slate-600">
                  <span>{i.name} × {i.qty}</span>
                  <span>{((i.sellingPrice || i.price || 0) * i.qty).toLocaleString()} so'm</span>
                </div>
              ))}
              {deliveryCost > 0 && (
                <div className="flex justify-between text-slate-600 border-t border-slate-200 pt-2">
                  <span>Yetkazib berish</span>
                  <span>{deliveryCost.toLocaleString()} so'm</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-slate-900 text-base border-t border-slate-200 pt-2">
                <span>Jami to'lov</span>
                <span>{grandTotal.toLocaleString()} so'm</span>
              </div>
            </div>
          </div>

          <div className="px-4 py-4 border-t border-slate-200">
            <button
              onClick={submitOrder}
              disabled={submitting}
              className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold text-base hover:bg-emerald-600 disabled:opacity-50 active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Buyurtmani tasdiqlash — {grandTotal.toLocaleString()} so'm
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicCatalog;
