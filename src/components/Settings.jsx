import React, { useState, useEffect } from 'react';
import {
  User, Building2, Receipt, Crown, ChevronRight, Save, X,
  Eye, EyeOff, Sun, Moon, Globe, Lock, Clock, MapPin,
  FileText, Key, Store, CreditCard, Printer, Phone, Mail,
  AlertCircle, Check, Zap, Rocket, Plus, Trash2
} from 'lucide-react';
import { doc, getDoc, updateDoc, getDocs, addDoc, collection, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';
import authService from '../utils/authService';
import { useTheme } from '../ThemeContext';
import CompanySettings from './CompanySettings';
import OnlineStoreSetup from './OnlineStoreSetup';

// ─── Avatar tanlovlari ────────────────────────────────────────────────────────
const AVATARS = [
  { id: 'none',   emoji: '⛔', bg: '#94a3b8' },
  { id: 'boss',   emoji: '👑', bg: '#f59e0b' },
  { id: 'cool',   emoji: '😎', bg: '#3b82f6' },
  { id: 'star',   emoji: '⭐', bg: '#8b5cf6' },
  { id: 'fire',   emoji: '🔥', bg: '#ef4444' },
  { id: 'rocket', emoji: '🚀', bg: '#06b6d4' },
  { id: 'gem',    emoji: '💎', bg: '#10b981' },
  { id: 'lion',   emoji: '🦁', bg: '#d97706' },
  { id: 'eagle',  emoji: '🦅', bg: '#6366f1' },
  { id: 'wolf',   emoji: '🐺', bg: '#64748b' },
  { id: 'dragon', emoji: '🐉', bg: '#dc2626' },
  { id: 'ninja',  emoji: '🥷', bg: '#0f172a' },
];

const TIMEZONES = [
  { value: 'Asia/Tashkent', label: '(UTC+05:00) Toshkent' },
  { value: 'Asia/Almaty',   label: '(UTC+06:00) Olmaota' },
  { value: 'Europe/Moscow', label: '(UTC+03:00) Moskva' },
  { value: 'Asia/Dubai',    label: '(UTC+04:00) Dubai' },
];

const REGIONS = [
  "O'zbekiston", "Qozog'iston", "Rossiya", "Tojikiston", "Qirg'iziston"
];

// ─── Receipt HTML generator (shared) ─────────────────────────────────────────
export const generateReceiptHTML = ({ sale, companyData, receiptSettings }) => {
  const saleDate = sale.date instanceof Date ? sale.date : new Date(sale.date);
  const settings = receiptSettings || {};
  const showBarcode = settings.showBarcode !== false;
  const showWorkHours = settings.showWorkHours !== false;
  const footerText = settings.footerText || "Xaridingiz uchun rahmat!\nYana keling!";
  const workStart = companyData?.workStart || '09:00';
  const workEnd   = companyData?.workEnd   || '18:00';

  const itemsHTML = sale.items.map((item, idx) => {
    const price = item.sellingPrice || item.price || 0;
    const total = item.totalAmount || item.quantity * price || 0;
    const color = item.color ? ` [${item.color}]` : '';
    const size  = item.size  ? ` [${item.size}]`  : '';
    return `
      <div class="item-row">
        <div class="item-name">${idx + 1}. ${item.productName}${color}${size}</div>
        <div class="item-price">
          <span>${item.quantity} × ${price.toLocaleString()}</span>
          <span class="bold">${total.toLocaleString()}</span>
        </div>
      </div>`;
  }).join('');

  const barcodeLines = showBarcode ? generateBarcodeLines(sale.saleId || 'XXXXXXXX') : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Chek #${sale.saleId?.slice(-8)}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Courier New',monospace; width:80mm; margin:0 auto; padding:4mm; font-size:11px; color:#111; }
    .center { text-align:center; }
    .company-name { font-size:17px; font-weight:bold; margin-bottom:2px; }
    .divider { border-top:1px dashed #666; margin:6px 0; }
    .row { display:flex; justify-content:space-between; margin:2px 0; }
    .bold { font-weight:bold; }
    .big { font-size:14px; }
    .item-row { margin:4px 0; }
    .item-name { font-weight:600; font-size:10.5px; }
    .item-price { display:flex; justify-content:space-between; padding-left:10px; color:#444; font-size:10px; margin-top:1px; }
    .total-section { margin:4px 0; }
    .grand { font-size:14px; font-weight:bold; border-top:1px solid #222; padding-top:4px; margin-top:4px; }
    .barcode-container { display:flex; justify-content:center; margin:8px 0 4px; }
    .barcode { display:flex; align-items:flex-end; height:28px; gap:0.5px; }
    .bar { background:#111; width:1.5px; }
    .footer-text { text-align:center; font-size:10px; color:#555; white-space:pre-line; }
    .badge { font-size:9px; color:#888; text-align:center; margin-top:2px; }
    @media print { body { width:80mm; } }
  </style>
</head>
<body>
  <div class="center">
    <div class="company-name">${companyData?.name || "Do'kon"}</div>
    ${companyData?.phone ? `<div>${companyData.phone}</div>` : ''}
    ${companyData?.address ? `<div style="font-size:10px;color:#555">${companyData.address}</div>` : ''}
  </div>

  <div class="divider"></div>

  <div class="row"><span>Sotuv:</span><span class="bold">#${sale.saleId?.slice(-8) || 'N/A'}</span></div>
  <div class="row"><span>Sana:</span><span>${saleDate.toLocaleDateString('uz-UZ')} ${saleDate.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</span></div>
  ${showWorkHours ? `<div class="row"><span>Ish vaqti:</span><span>${workStart} – ${workEnd}</span></div>` : ''}
  ${sale.items[0]?.createdBy ? `<div class="row"><span>Sotuvchi:</span><span>${sale.items[0].createdBy}</span></div>` : ''}
  ${sale.customerName && sale.customerName !== 'Naqd mijoz' ? `<div class="row"><span>Mijoz:</span><span>${sale.customerName}</span></div>` : ''}
  ${sale.customerPhone ? `<div class="row"><span>Tel:</span><span>${sale.customerPhone}</span></div>` : ''}
  ${companyData?.inn ? `<div class="row"><span>INN:</span><span>${companyData.inn}</span></div>` : ''}
  ${companyData?.legalName ? `<div class="row"><span>Yuridik nom:</span><span style="font-size:9px">${companyData.legalName}</span></div>` : ''}

  <div class="divider"></div>

  ${itemsHTML}

  <div class="divider"></div>

  <div class="total-section">
    <div class="row"><span>Mahsulotlar soni:</span><span>${sale.items.length} birlik</span></div>
    <div class="row"><span>Oraliq jami:</span><span>${sale.totalAmount.toLocaleString()} so'm</span></div>
    ${sale.discount > 0 ? `
    <div class="row"><span>Chegirma:</span><span>-${sale.discount.toLocaleString()} so'm</span></div>
    <div class="row"><span>Chegirma %:</span><span>${Math.round(sale.discount / sale.totalAmount * 100)}%</span></div>
    ` : ''}
    <div class="row grand"><span>JAMI:</span><span>${sale.totalAmount.toLocaleString()} so'm</span></div>
    <div class="row" style="margin-top:3px"><span>To'lov:</span><span>${sale.paymentType === 'naqd' ? 'Naqd' : sale.paymentType === 'karta' ? 'Karta' : 'Qarz'}</span></div>
    ${sale.debt > 0 ? `<div class="row" style="color:#c00"><span>Qarz:</span><span class="bold">${sale.debt.toLocaleString()} so'm</span></div>` : ''}
  </div>

  ${showBarcode ? `
  <div class="divider"></div>
  <div class="barcode-container">
    <div class="barcode">${barcodeLines}</div>
  </div>
  <div class="center" style="font-size:9px;color:#666">${sale.saleId?.slice(-12) || ''}</div>
  ` : ''}

  <div class="divider"></div>
  <div class="footer-text">${footerText}</div>
  <div class="badge">CRM Pro boshqaruv tizimi</div>

  <script>window.onload=function(){window.print();setTimeout(function(){window.close();},600);}</script>
</body>
</html>`;
};

// Pseudo-barcode generator from saleId
function generateBarcodeLines(saleId) {
  const str = (saleId || '').replace(/[^a-z0-9]/gi, '');
  let heights = [20, 28, 16, 24, 20, 28, 16, 20, 24, 16, 28, 20, 24, 16, 28, 20, 24, 16, 20, 28];
  for (let i = 0; i < str.length && i < heights.length; i++) {
    heights[i] = 12 + (str.charCodeAt(i) % 18);
  }
  return heights.map(h => `<div class="bar" style="height:${h}px"></div>`).join('');
}

// ─── Profile Panel ────────────────────────────────────────────────────────────
const ProfilePanel = ({ currentUser, onUserUpdate }) => {
  const { isDark, toggleTheme } = useTheme();
  const [name, setName]           = useState(currentUser?.name || '');
  const [phone, setPhone]         = useState(currentUser?.phone || '');
  const [avatar, setAvatar]       = useState(currentUser?.avatar || 'none');
  const [saving, setSaving]       = useState(false);
  // Password change
  const [showPwForm, setShowPwForm] = useState(false);
  const [oldPw, setOldPw]         = useState('');
  const [newPw, setNewPw]         = useState('');
  const [showOld, setShowOld]     = useState(false);
  const [showNew, setShowNew]     = useState(false);
  const [pwSaving, setPwSaving]   = useState(false);

  const saveProfile = async () => {
    if (!name.trim()) return toast.error('Ism kiriting!');
    setSaving(true);
    try {
      const updates = { name: name.trim(), phone: phone.trim(), avatar };
      await updateDoc(doc(db, 'users', currentUser.id), updates);
      onUserUpdate?.(updates);
      toast.success('Profil saqlandi!');
    } catch { toast.error('Xatolik!'); }
    setSaving(false);
  };

  const changePassword = async () => {
    if (!oldPw || !newPw) return toast.error('Parollarni kiriting!');
    if (newPw.length < 6) return toast.error('Yangi parol kamida 6 belgi!');
    setPwSaving(true);
    const result = await authService.changePassword(oldPw, newPw);
    if (result.success) {
      toast.success('Parol o\'zgartirildi!');
      setShowPwForm(false);
      setOldPw(''); setNewPw('');
    } else {
      toast.error(result.error || 'Xatolik!');
    }
    setPwSaving(false);
  };

  const currentAvatar = AVATARS.find(a => a.id === avatar) || AVATARS[0];

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Asosiy */}
      <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h3 className="text-base font-bold text-slate-800 mb-4">Asosiy</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">To'liq ism *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm"
              placeholder="Ism Familiya" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Login</label>
            <input value={currentUser?.username || ''} disabled
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-400 font-mono" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Telefon</label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm"
              placeholder="+998 90 123 45 67" />
          </div>
        </div>
      </section>

      {/* Rasm - Avatar */}
      <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h3 className="text-base font-bold text-slate-800 mb-4">Rasm</h3>
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          {/* Current avatar */}
          <div className="flex-shrink-0 text-center">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl shadow-sm"
              style={{ background: currentAvatar.bg }}>
              {currentAvatar.emoji}
            </div>
            <p className="text-xs text-slate-400 mt-2">Joriy avatar</p>
          </div>
          {/* Avatar grid */}
          <div>
            <p className="text-sm text-slate-600 mb-3">Avatarni tanlang:</p>
            <div className="flex flex-wrap gap-2">
              {AVATARS.map(av => (
                <button key={av.id} onClick={() => setAvatar(av.id)}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-all ${
                    avatar === av.id ? 'ring-3 ring-emerald-500 ring-offset-2 scale-110' : 'hover:scale-105 opacity-80 hover:opacity-100'
                  }`}
                  style={{ background: av.bg }}>
                  {av.emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Interfeys */}
      <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h3 className="text-base font-bold text-slate-800 mb-4">Interfeys</h3>
        <div className="space-y-4">
          {/* Theme */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
            <div className="flex items-center gap-3">
              {isDark ? <Moon className="w-5 h-5 text-amber-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
              <div>
                <p className="text-sm font-medium text-slate-800">Interfeys mavzusi</p>
                <p className="text-xs text-slate-500">{isDark ? 'Tungi rejim' : 'Kunduzgi rejim'}</p>
              </div>
            </div>
            <button onClick={toggleTheme}
              className={`relative w-12 h-6 rounded-full transition-colors ${isDark ? 'bg-amber-500' : 'bg-slate-300'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isDark ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>
          {/* Language */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-slate-800">Interfeys tili</p>
                <p className="text-xs text-slate-500">O'zbek tili</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold">UZ</span>
          </div>
        </div>
      </section>

      {/* Xavfsizlik */}
      <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h3 className="text-base font-bold text-slate-800 mb-4">Xavfsizlik</h3>
        {!showPwForm ? (
          <button onClick={() => setShowPwForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-sm font-medium">
            <Lock className="w-4 h-4" />
            Parolni o'zgartirish
          </button>
        ) : (
          <div className="space-y-3 max-w-sm">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Joriy parol</label>
              <div className="relative">
                <input type={showOld ? 'text' : 'password'} value={oldPw} onChange={e => setOldPw(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm pr-10"
                  placeholder="Joriy parol" />
                <button onClick={() => setShowOld(!showOld)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Yangi parol</label>
              <div className="relative">
                <input type={showNew ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm pr-10"
                  placeholder="Kamida 6 belgi" />
                <button onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowPwForm(false); setOldPw(''); setNewPw(''); }}
                className="flex-1 px-3 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50">
                Bekor
              </button>
              <button onClick={changePassword} disabled={pwSaving}
                className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                {pwSaving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Save button */}
      <div className="flex justify-end">
        <button onClick={saveProfile} disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-semibold disabled:opacity-50">
          <Save className="w-4 h-4" />
          {saving ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </div>
    </div>
  );
};

// ─── Company Panel ────────────────────────────────────────────────────────────
const CompanyPanel = ({ currentUser }) => {
  const [subTab, setSubTab] = useState('asosiy');
  const [company, setCompany] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', address: '', website: '',
    region: "O'zbekiston", timezone: 'Asia/Tashkent',
    legalName: '', inn: '', legalAddress: '', bankAccount: '',
    workStart: '09:00', workEnd: '18:00',
  });
  const [shops, setShops] = useState([]);
  const [showShopModal, setShowShopModal] = useState(false);
  const [shopForm, setShopForm] = useState({ name: '', address: '', phone: '' });

  const SUB_TABS = [
    { id: 'asosiy', label: 'Asosiy' },
    { id: 'mintaqa', label: 'Mintaqa' },
    { id: 'rekvizitlar', label: 'Rekvizitlar' },
    { id: 'ishvaqti', label: 'Ish vaqti' },
    { id: 'dokonlar', label: "Do'konlar" },
    { id: 'kassalar', label: 'Kassalar' },
  ];

  useEffect(() => {
    if (!currentUser?.companyId) return;
    getDoc(doc(db, 'companies', currentUser.companyId)).then(snap => {
      if (snap.exists()) {
        const d = snap.data();
        setCompany(d);
        setForm(prev => ({
          ...prev,
          name:        d.name        || '',
          phone:       d.phone       || '',
          email:       d.email       || '',
          address:     d.address     || '',
          website:     d.website     || '',
          region:      d.region      || "O'zbekiston",
          timezone:    d.timezone    || 'Asia/Tashkent',
          legalName:   d.legalName   || '',
          inn:         d.inn         || '',
          legalAddress:d.legalAddress|| '',
          bankAccount: d.bankAccount || '',
          workStart:   d.workStart   || '09:00',
          workEnd:     d.workEnd     || '18:00',
        }));
      }
    });
    // Load shops
    getDocs(query(collection(db, 'shops'), where('companyId', '==', currentUser.companyId), where('isDeleted', '==', false)))
      .then(snap => setShops(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [currentUser?.companyId]);

  const save = async () => {
    if (!form.name.trim()) return toast.error('Kompaniya nomini kiriting!');
    setSaving(true);
    try {
      await updateDoc(doc(db, 'companies', currentUser.companyId), {
        name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim(),
        address: form.address.trim(), website: form.website.trim(),
        region: form.region, timezone: form.timezone,
        legalName: form.legalName.trim(), inn: form.inn.trim(),
        legalAddress: form.legalAddress.trim(), bankAccount: form.bankAccount.trim(),
        workStart: form.workStart, workEnd: form.workEnd,
        updatedAt: new Date(),
      });
      toast.success('Saqlandi!');
    } catch { toast.error('Xatolik!'); }
    setSaving(false);
  };

  const addShop = async () => {
    if (!shopForm.name.trim()) return toast.error('Do\'kon nomini kiriting!');
    try {
      const ref = await addDoc(collection(db, 'shops'), {
        ...shopForm, companyId: currentUser.companyId, isDeleted: false, createdAt: new Date()
      });
      setShops(prev => [...prev, { id: ref.id, ...shopForm }]);
      setShopForm({ name: '', address: '', phone: '' });
      setShowShopModal(false);
      toast.success('Do\'kon qo\'shildi!');
    } catch { toast.error('Xatolik!'); }
  };

  const removeShop = async (id) => {
    if (!window.confirm('O\'chirishni tasdiqlaysizmi?')) return;
    try {
      await updateDoc(doc(db, 'shops', id), { isDeleted: true });
      setShops(prev => prev.filter(s => s.id !== id));
      toast.success('O\'chirildi!');
    } catch { toast.error('Xatolik!'); }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-1.5 bg-white rounded-2xl p-2 shadow-sm border border-slate-100">
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
              subTab === t.id ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}>{t.label}</button>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        {/* Asosiy */}
        {subTab === 'asosiy' && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-800 mb-4">Kompaniya ma'lumotlari</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Kompaniya nomi *</label>
                <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Telefon</label>
                <input value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm"
                  placeholder="+998 71 123 45 67" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Elektron pochta</label>
                <input value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))}
                  type="email"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm"
                  placeholder="info@company.uz" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Manzil</label>
                <input value={form.address} onChange={e => setForm(p => ({...p, address: e.target.value}))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm"
                  placeholder="Toshkent, Chilonzor tumani..." />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Veb-sayt</label>
                <input value={form.website} onChange={e => setForm(p => ({...p, website: e.target.value}))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm"
                  placeholder="https://company.uz" />
              </div>
            </div>
          </div>
        )}

        {/* Mintaqa */}
        {subTab === 'mintaqa' && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-800 mb-4">Mintaqa sozlamalari</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Mintaqa (mamlakat)</label>
              <select value={form.region} onChange={e => setForm(p => ({...p, region: e.target.value}))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white text-sm">
                {REGIONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Vaqt mintaqasi</label>
              <select value={form.timezone} onChange={e => setForm(p => ({...p, timezone: e.target.value}))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white text-sm">
                {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Rekvizitlar */}
        {subTab === 'rekvizitlar' && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-800 mb-4">Yuridik rekvizitlar</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Kompaniyaning yuridik nomi</label>
              <input value={form.legalName} onChange={e => setForm(p => ({...p, legalName: e.target.value}))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm"
                placeholder="MChJ, YK, AJ..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">INN (soliq raqami)</label>
              <input value={form.inn} onChange={e => setForm(p => ({...p, inn: e.target.value}))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm"
                placeholder="123456789" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Yuridik manzil</label>
              <textarea value={form.legalAddress} onChange={e => setForm(p => ({...p, legalAddress: e.target.value}))}
                rows={2} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm resize-none"
                placeholder="Shahar, tuman, ko'cha, uy" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Bank hisob raqami</label>
              <input value={form.bankAccount} onChange={e => setForm(p => ({...p, bankAccount: e.target.value}))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm font-mono"
                placeholder="2020 8000 0000 0000 0000" />
            </div>
          </div>
        )}

        {/* Ish vaqti */}
        {subTab === 'ishvaqti' && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-800 mb-4">Ish vaqti</h3>
            <p className="text-sm text-slate-500">Bu vaqt cheklarda ko'rsatiladi.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Ochilish vaqti</label>
                <input type="time" value={form.workStart} onChange={e => setForm(p => ({...p, workStart: e.target.value}))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Yopilish vaqti</label>
                <input type="time" value={form.workEnd} onChange={e => setForm(p => ({...p, workEnd: e.target.value}))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm" />
              </div>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4 flex items-center gap-3">
              <Clock className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <p className="text-emerald-800 text-sm">
                Ish vaqti: <strong>{form.workStart} – {form.workEnd}</strong>
              </p>
            </div>
          </div>
        )}

        {/* Do'konlar */}
        {subTab === 'dokonlar' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-800">Do'konlar ro'yxati</h3>
              <button onClick={() => setShowShopModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700">
                <Plus className="w-4 h-4" />
                Yangi do'kon
              </button>
            </div>
            {shops.length === 0 ? (
              <div className="text-center py-12">
                <Store className="w-12 h-12 mx-auto text-slate-200 mb-3" />
                <p className="text-slate-500 font-medium">Do'konlar yo'q</p>
                <p className="text-slate-400 text-xs mt-1">Yangi do'kon qo'shing</p>
              </div>
            ) : (
              <div className="space-y-2">
                {shops.map(shop => (
                  <div key={shop.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{shop.name}</p>
                      {shop.address && <p className="text-slate-500 text-xs mt-0.5">{shop.address}</p>}
                      {shop.phone && <p className="text-slate-400 text-xs">{shop.phone}</p>}
                    </div>
                    <button onClick={() => removeShop(shop.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {showShopModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                  <h4 className="font-bold text-slate-800">Yangi do'kon</h4>
                  <input value={shopForm.name} onChange={e => setShopForm(p => ({...p, name: e.target.value}))}
                    placeholder="Do'kon nomi *"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
                  <input value={shopForm.address} onChange={e => setShopForm(p => ({...p, address: e.target.value}))}
                    placeholder="Manzil"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
                  <input value={shopForm.phone} onChange={e => setShopForm(p => ({...p, phone: e.target.value}))}
                    placeholder="Telefon"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500" />
                  <div className="flex gap-2">
                    <button onClick={() => setShowShopModal(false)} className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm">Bekor</button>
                    <button onClick={addShop} className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium">Qo'shish</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Kassalar */}
        {subTab === 'kassalar' && (
          <div>
            <h3 className="text-base font-bold text-slate-800 mb-4">Kassalar ro'yxati</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-blue-800 font-medium text-sm">Kassalar boshqaruvi</p>
                <p className="text-blue-600 text-xs mt-1">Kassalar Foydalanuvchilar bo'limida kassir roli orqali boshqariladi. Har bir kassir — alohida kassa.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {subTab !== 'dokonlar' && subTab !== 'kassalar' && (
        <div className="flex justify-end">
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-semibold disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Cheklar Panel ────────────────────────────────────────────────────────────
const CheklarPanel = ({ currentUser, companyData }) => {
  const [settings, setSettings] = useState({
    showBarcode: true,
    showWorkHours: true,
    footerText: "Xaridingiz uchun rahmat!\nYana keling!",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentUser?.companyId) return;
    getDoc(doc(db, 'companies', currentUser.companyId)).then(snap => {
      if (snap.exists() && snap.data().receiptSettings) {
        setSettings(snap.data().receiptSettings);
      }
    });
  }, [currentUser?.companyId]);

  const save = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'companies', currentUser.companyId), { receiptSettings: settings });
      toast.success('Chek sozlamalari saqlandi!');
    } catch { toast.error('Xatolik!'); }
    setSaving(false);
  };

  // Namuna sotuv
  const sampleSale = {
    saleId: 'SAMPLE12345678',
    date: new Date(),
    customerName: 'Ali Valiyev',
    customerPhone: '+998 90 123 45 67',
    paymentType: 'naqd',
    discount: 5000,
    debt: 0,
    items: [
      { productName: 'Mahsulot nomi / Brend', quantity: 1, sellingPrice: 100000, totalAmount: 100000, createdBy: 'Sotuvchi' },
    ],
    totalAmount: 95000,
  };

  const printPreview = () => {
    const html = generateReceiptHTML({ sale: sampleSale, companyData, receiptSettings: settings });
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Settings */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h3 className="text-base font-bold text-slate-800 mb-4">Chek sozlamalari</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
            <div>
              <p className="text-sm font-medium text-slate-800">Barkod ko'rsatish</p>
              <p className="text-xs text-slate-500">Chek pastida barkod bo'ladi</p>
            </div>
            <button onClick={() => setSettings(p => ({...p, showBarcode: !p.showBarcode}))}
              className={`relative w-12 h-6 rounded-full transition-colors ${settings.showBarcode ? 'bg-emerald-500' : 'bg-slate-300'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.showBarcode ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
            <div>
              <p className="text-sm font-medium text-slate-800">Ish vaqtini ko'rsatish</p>
              <p className="text-xs text-slate-500">Chekda do'kon ish vaqti bo'ladi</p>
            </div>
            <button onClick={() => setSettings(p => ({...p, showWorkHours: !p.showWorkHours}))}
              className={`relative w-12 h-6 rounded-full transition-colors ${settings.showWorkHours ? 'bg-emerald-500' : 'bg-slate-300'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings.showWorkHours ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Chek pastki matni</label>
            <textarea value={settings.footerText} onChange={e => setSettings(p => ({...p, footerText: e.target.value}))}
              rows={3} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm resize-none"
              placeholder="Xaridingiz uchun rahmat!" />
          </div>
        </div>
      </div>

      {/* Receipt Preview */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-800">Chek namunasi</h3>
          <button onClick={printPreview}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-white rounded-xl text-sm hover:bg-slate-700">
            <Printer className="w-4 h-4" />
            Ko'rish
          </button>
        </div>

        {/* Visual preview */}
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-4 font-mono text-xs mx-auto max-w-[280px] shadow-sm">
          <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-3">
            <p className="font-bold text-sm">{companyData?.name || "Do'kon nomi"}</p>
            {companyData?.phone && <p className="text-slate-500">{companyData.phone}</p>}
            {companyData?.address && <p className="text-slate-400 text-[10px]">{companyData.address}</p>}
          </div>
          <div className="space-y-1 text-[10px] mb-3">
            <div className="flex justify-between"><span>Sotuv:</span><span className="font-bold">#SAMPLE12</span></div>
            <div className="flex justify-between"><span>Sana:</span><span>{new Date().toLocaleDateString('uz-UZ')}</span></div>
            {settings.showWorkHours && (
              <div className="flex justify-between"><span>Ish vaqti:</span><span>{companyData?.workStart||'09:00'} – {companyData?.workEnd||'18:00'}</span></div>
            )}
            <div className="flex justify-between"><span>Sotuvchi:</span><span>-</span></div>
            <div className="flex justify-between"><span>Mijoz:</span><span>Ali Valiyev</span></div>
          </div>
          <div className="border-t border-b border-dashed border-slate-300 py-2 mb-3">
            <div className="font-semibold">1. Mahsulot nomi</div>
            <div className="flex justify-between text-slate-500 pl-2"><span>1 × 100 000</span><span className="font-bold text-slate-700">100 000</span></div>
          </div>
          <div className="space-y-1 text-[10px] mb-3">
            <div className="flex justify-between"><span>Chegirma:</span><span>-5 000</span></div>
            <div className="flex justify-between font-bold text-sm"><span>JAMI:</span><span>95 000 so'm</span></div>
            <div className="flex justify-between"><span>To'lov:</span><span>Naqd</span></div>
          </div>
          {settings.showBarcode && (
            <div className="flex justify-center gap-0.5 my-2">
              {[18,12,24,16,20,28,14,20,18,24,16,28,20,14,24].map((h, i) => (
                <div key={i} className="bg-slate-800" style={{ width: '2px', height: `${h}px` }} />
              ))}
            </div>
          )}
          <div className="border-t border-dashed border-slate-300 pt-2 text-center text-[10px] text-slate-500 whitespace-pre-line">
            {settings.footerText}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-semibold disabled:opacity-50">
          <Save className="w-4 h-4" />
          {saving ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </div>
    </div>
  );
};

// ─── Main Settings ────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'profil',      label: 'Profil',         icon: User },
  { id: 'kompaniya',   label: 'Kompaniya',      icon: Building2 },
  { id: 'onlinedokon', label: "Online Do'kon",  icon: Globe },
  { id: 'cheklar',     label: 'Cheklar',        icon: Receipt },
  { id: 'tarif',       label: 'Tarif',          icon: Crown },
];

const Settings = ({ currentUser, companyData, onPlanChange, onUserUpdate }) => {
  const [activeNav, setActiveNav] = useState('profil');

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Left Nav */}
      <aside className="w-56 bg-white dark:bg-slate-800 border-r border-slate-100 dark:border-slate-700 flex-shrink-0 hidden sm:block">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-bold text-slate-800 dark:text-white">Sozlamalar</h2>
        </div>
        <nav className="p-3 space-y-1">
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => setActiveNav(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeNav === item.id
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}>
              <item.icon className="w-4 h-4" />
              {item.label}
              {activeNav === item.id && <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
            </button>
          ))}
        </nav>
      </aside>

      {/* Mobile top nav */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex">
        {NAV_ITEMS.map(item => (
          <button key={item.id} onClick={() => setActiveNav(item.id)}
            className={`flex-1 py-3 flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
              activeNav === item.id ? 'text-emerald-600' : 'text-slate-400'
            }`}>
            <item.icon className="w-5 h-5" />
            {item.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="flex-1 p-4 lg:p-8 pb-20 sm:pb-8 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            {activeNav === 'onlinedokon'
              ? "Online Do'kon sozlamalari"
              : `${NAV_ITEMS.find(n => n.id === activeNav)?.label} sozlamalari`}
          </h1>
        </div>

        {activeNav === 'profil'      && <ProfilePanel currentUser={currentUser} onUserUpdate={onUserUpdate} />}
        {activeNav === 'kompaniya'   && <CompanyPanel currentUser={currentUser} />}
        {activeNav === 'onlinedokon' && <OnlineStoreSetup currentUser={currentUser} companyData={companyData} />}
        {activeNav === 'cheklar'     && <CheklarPanel currentUser={currentUser} companyData={companyData} />}
        {activeNav === 'tarif'       && (
          <CompanySettings
            currentUser={currentUser}
            companyData={companyData}
            onPlanChange={onPlanChange}
          />
        )}
      </main>
    </div>
  );
};

export default Settings;
