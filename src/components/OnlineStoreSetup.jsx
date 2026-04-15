import { useState, useEffect, useRef } from 'react';
import {
  Globe, Save, Eye, Copy, Check, X,
  Send, MapPin, Clock, Phone, Truck, CreditCard,
  Banknote, AlertCircle, ExternalLink, ImageIcon, Store,
  CheckCircle, ToggleLeft, ToggleRight
} from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';

const PROD_BASE = 'https://inventory-f1315.web.app';

const OnlineStoreSetup = ({ currentUser, companyData }) => {
  const companyId = currentUser?.companyId;

  const [settings, setSettings] = useState({
    slug: '',
    isActive: false,
    name: companyData?.name || '',
    description: '',
    phone: companyData?.phone || '',
    address: '',
    workHours: '09:00 - 18:00',
    logo: '',
    banner: '',
    telegramBotToken: '',
    telegramChatId: '',
    deliveryEnabled: false,
    deliveryBaseCost: 15000,
    deliveryFreeFrom: 300000,
    paymentCash: true,
    paymentCard: false,
    paymentOnline: false,
    minOrderAmount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [slugError, setSlugError] = useState('');
  const [logoPreview, setLogoPreview] = useState('');
  const [bannerPreview, setBannerPreview] = useState('');
  const logoRef = useRef(null);
  const bannerRef = useRef(null);

  useEffect(() => {
    loadSettings();
  }, [companyId]);

  const loadSettings = async () => {
    if (!companyId) { setLoading(false); return; }
    try {
      const snap = await getDoc(doc(db, 'onlineStores', companyId));
      if (snap.exists()) {
        const data = snap.data();
        setSettings(prev => ({ ...prev, ...data }));
        if (data.logo)   setLogoPreview(data.logo);
        if (data.banner) setBannerPreview(data.banner);
      } else {
        // Default slug: company name dan yasash
        const defaultSlug = (companyData?.name || '')
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
          .slice(0, 30) || 'mening-dokonim';
        setSettings(prev => ({
          ...prev,
          slug: defaultSlug,
          name: companyData?.name || prev.name,
          phone: companyData?.phone || prev.phone,
        }));
      }
    } catch (e) {
      toast.error('Sozlamalar yuklanmadi');
    }
    setLoading(false);
  };

  // Rasmni base64 ga aylantirish (400px max)
  const compressToBase64 = (file) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxSize = 400;
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });

  const handleLogoSelect = async (file) => {
    if (!file) return;
    try {
      const dataUrl = await compressToBase64(file);
      setLogoPreview(dataUrl);
      setSettings(prev => ({ ...prev, logo: dataUrl }));
      toast.success('Logo tayyor (saqlash tugmasini bosing)');
    } catch { toast.error('Logo yuklanmadi'); }
  };

  const handleBannerSelect = async (file) => {
    if (!file) return;
    try {
      const dataUrl = await compressToBase64(file);
      setBannerPreview(dataUrl);
      setSettings(prev => ({ ...prev, banner: dataUrl }));
      toast.success('Banner tayyor (saqlash tugmasini bosing)');
    } catch { toast.error('Banner yuklanmadi'); }
  };

  const validateSlug = (slug) => {
    if (!slug) return 'Slug kiritish majburiy';
    if (!/^[a-z0-9-]+$/.test(slug)) return 'Faqat a-z, 0-9 va - belgilari';
    if (slug.length < 3) return 'Kamida 3 belgi';
    return '';
  };

  const handleSlugChange = (val) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSettings(prev => ({ ...prev, slug: clean }));
    setSlugError(validateSlug(clean));
  };

  const handleSave = async () => {
    const err = validateSlug(settings.slug);
    if (err) { setSlugError(err); return; }
    if (!settings.name.trim()) {
      toast.error("Do'kon nomini kiriting!");
      return;
    }
    setSaving(true);
    try {
      await setDoc(doc(db, 'onlineStores', companyId), {
        ...settings,
        companyId,
        updatedAt: new Date(),
      });
      toast.success('Sozlamalar saqlandi!');
    } catch (e) {
      console.error(e);
      toast.error('Saqlashda xatolik!');
    }
    setSaving(false);
  };

  const storeUrl = `${PROD_BASE}/shop/${settings.slug}`;

  const copyLink = () => {
    navigator.clipboard.writeText(storeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-500" />
            Online Do'kon Sozlamalari
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Mijozlar bu sahifaga kirib buyurtma beradi</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 font-medium text-sm"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </div>

      {/* Status banner */}
      {settings.isActive ? (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-bold text-sm">Do'kon FAOL</p>
              <p className="text-xs">Mijozlar buyurtma bera oladi</p>
            </div>
          </div>
          <a href={storeUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600">
            Ko'rish <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      ) : (
        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div>
            <p className="font-bold text-sm text-amber-800">Do'kon NOFAOL</p>
            <p className="text-xs text-amber-700">Quyidagi toggle'ni yoqib, "Saqlash" tugmasini bosing</p>
          </div>
        </div>
      )}

      {/* URL + faollashtirish */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800">Do'kon manzili (URL)</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">
              {settings.isActive ? '🟢 Faol' : '🔴 Nofaol'}
            </span>
            <button
              onClick={() => setSettings(prev => ({ ...prev, isActive: !prev.isActive }))}
              className={`relative w-12 h-6 rounded-full transition-all ${settings.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${settings.isActive ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-0 border border-slate-200 rounded-xl overflow-hidden">
              <span className="px-3 py-2.5 bg-slate-50 text-slate-400 text-xs whitespace-nowrap border-r border-slate-200">
                .web.app/shop/
              </span>
              <input
                type="text"
                value={settings.slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="sizning-dokon"
                className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
              />
            </div>
            {slugError && <p className="text-xs text-rose-500 mt-1">{slugError}</p>}
          </div>
          <button onClick={copyLink}
            className="px-3 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
            title="Nusxa olish">
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-500" />}
          </button>
          <a href={storeUrl} target="_blank" rel="noreferrer"
            className="px-3 py-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
            title="Do'konni ko'rish">
            <ExternalLink className="w-4 h-4 text-slate-500" />
          </a>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-500 font-mono break-all">
          {storeUrl}
        </div>
      </div>

      {/* Asosiy ma'lumotlar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <Store className="w-4 h-4 text-slate-500" />
          Do'kon ma'lumotlari
        </h3>

        {/* Logo + Banner */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Logo</label>
            {logoPreview ? (
              <div className="relative h-20 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                <img src={logoPreview} alt="logo" className="w-full h-full object-contain" />
                <button
                  onClick={() => { setLogoPreview(''); setSettings(prev => ({ ...prev, logo: '' })); }}
                  className="absolute top-1 right-1 p-1 bg-rose-500 text-white rounded-lg">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button onClick={() => logoRef.current?.click()}
                className="w-full h-20 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-emerald-400 hover:text-emerald-500 transition-all text-xs">
                <ImageIcon className="w-5 h-5" />
                Logo yuklash
              </button>
            )}
            <input ref={logoRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => handleLogoSelect(e.target.files[0])} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Banner rasm</label>
            {bannerPreview ? (
              <div className="relative h-20 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                <img src={bannerPreview} alt="banner" className="w-full h-full object-cover" />
                <button
                  onClick={() => { setBannerPreview(''); setSettings(prev => ({ ...prev, banner: '' })); }}
                  className="absolute top-1 right-1 p-1 bg-rose-500 text-white rounded-lg">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button onClick={() => bannerRef.current?.click()}
                className="w-full h-20 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-emerald-400 hover:text-emerald-500 transition-all text-xs">
                <ImageIcon className="w-5 h-5" />
                Banner yuklash
              </button>
            )}
            <input ref={bannerRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => handleBannerSelect(e.target.files[0])} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Do'kon nomi *</label>
          <input type="text" value={settings.name}
            onChange={(e) => setSettings(p => ({ ...p, name: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Tavsif</label>
          <textarea rows={2} value={settings.description}
            onChange={(e) => setSettings(p => ({ ...p, description: e.target.value }))}
            placeholder="Do'kon haqida qisqacha..."
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              <Phone className="w-3 h-3 inline mr-1" />Telefon
            </label>
            <input type="tel" value={settings.phone}
              onChange={(e) => setSettings(p => ({ ...p, phone: e.target.value }))}
              placeholder="+998 90 123 45 67"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              <Clock className="w-3 h-3 inline mr-1" />Ish vaqti
            </label>
            <input type="text" value={settings.workHours}
              onChange={(e) => setSettings(p => ({ ...p, workHours: e.target.value }))}
              placeholder="09:00 - 18:00"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            <MapPin className="w-3 h-3 inline mr-1" />Manzil
          </label>
          <input type="text" value={settings.address}
            onChange={(e) => setSettings(p => ({ ...p, address: e.target.value }))}
            placeholder="Shahar, ko'cha, uy..."
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm" />
        </div>
      </div>

      {/* Telegram */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <Send className="w-4 h-4 text-blue-500" />
          Telegram xabarnomasi
        </h3>
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 flex gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            Har yangi buyurtmada guruhingizga xabar keladi.
            Bot yarating: <strong>@BotFather</strong> → /newbot → token oling.
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Bot Token</label>
          <input type="text" value={settings.telegramBotToken}
            onChange={(e) => setSettings(p => ({ ...p, telegramBotToken: e.target.value }))}
            placeholder="1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Guruh Chat ID</label>
          <input type="text" value={settings.telegramChatId}
            onChange={(e) => setSettings(p => ({ ...p, telegramChatId: e.target.value }))}
            placeholder="-1001234567890"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono" />
        </div>
      </div>

      {/* Yetkazib berish */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Truck className="w-4 h-4 text-amber-500" />
            Yetkazib berish
          </h3>
          <button
            onClick={() => setSettings(p => ({ ...p, deliveryEnabled: !p.deliveryEnabled }))}
            className={`relative w-12 h-6 rounded-full transition-all ${settings.deliveryEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${settings.deliveryEnabled ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
        {settings.deliveryEnabled && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Yetkazish narxi (so'm)</label>
              <input type="number" value={settings.deliveryBaseCost}
                onChange={(e) => setSettings(p => ({ ...p, deliveryBaseCost: +e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Bepul yetkazishdan (so'm)</label>
              <input type="number" value={settings.deliveryFreeFrom}
                onChange={(e) => setSettings(p => ({ ...p, deliveryFreeFrom: +e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm" />
            </div>
          </div>
        )}
      </div>

      {/* To'lov usullari */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-violet-500" />
          To'lov usullari
        </h3>
        <div className="space-y-2">
          {[
            { key: 'paymentCash', icon: Banknote, label: 'Naqd (yetkazishda)' },
            { key: 'paymentCard', icon: CreditCard, label: 'Karta (yetkazishda)' },
          ].map(({ key, icon: Icon, label }) => (
            <label key={key} className="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Icon className="w-4 h-4 text-slate-400" />
                {label}
              </div>
              <input type="checkbox" checked={settings[key]}
                onChange={(e) => setSettings(p => ({ ...p, [key]: e.target.checked }))}
                className="w-4 h-4 accent-emerald-500" />
            </label>
          ))}
        </div>
      </div>

      {/* Mahsulotlarni ko'rsatish eslatmasi */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800">
        <p className="font-bold mb-1">📦 Mahsulotlarni online do'konga qo'shish:</p>
        <p>Mahsulotlar ro'yxatida har bir mahsulotni tahrirlang → <strong>"Online do'konda ko'rsatish"</strong> checkbox'ini yoqing.</p>
      </div>

      {/* Saqlash */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Save className="w-5 h-5" />
        {saving ? 'Saqlanmoqda...' : 'Sozlamalarni saqlash'}
      </button>
    </div>
  );
};

export default OnlineStoreSetup;
