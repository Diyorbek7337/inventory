import React, { useState, useEffect } from 'react';
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  Tag, Ticket, MessageSquare, Gift, Plus, X, Edit2, Trash2,
  Search, CheckCircle, XCircle, Clock, Calendar, Percent,
  ChevronDown, AlertCircle, Copy, Check
} from 'lucide-react';
import { toast } from 'react-toastify';

// ─── Yordamchi ────────────────────────────────────────────────────────────────
const formatDate = (d) => {
  if (!d) return '-';
  const date = d.seconds ? new Date(d.seconds * 1000) : new Date(d);
  return date.toLocaleDateString('uz-UZ');
};

const getPromoStatus = (start, end) => {
  const now = new Date();
  const s = start ? (start.seconds ? new Date(start.seconds * 1000) : new Date(start)) : null;
  const e = end   ? (end.seconds   ? new Date(end.seconds * 1000)   : new Date(end))   : null;
  if (!s || !e) return 'inactive';
  if (now < s) return 'scheduled';
  if (now > e) return 'ended';
  return 'active';
};

const statusBadge = {
  active:    { label: 'Faol',           bg: 'bg-emerald-100', text: 'text-emerald-700' },
  inactive:  { label: "Faol bo'lmagan", bg: 'bg-slate-100',   text: 'text-slate-600'   },
  scheduled: { label: 'Rejalashtirilgan', bg: 'bg-blue-100',  text: 'text-blue-700'    },
  ended:     { label: 'Tugagan',         bg: 'bg-rose-100',   text: 'text-rose-600'    },
};

const TABS = [
  { id: 'aksiyalar',  label: 'Aksiyalar',       icon: Tag },
  { id: 'promo',      label: 'Promokodlar',      icon: Ticket },
  { id: 'sms',        label: 'SMS tarqatish',    icon: MessageSquare },
  { id: 'gifts',      label: "Sovg'a kartalari", icon: Gift },
];

// ─── Aksiyalar ────────────────────────────────────────────────────────────────
const Aksiyalar = ({ currentUser }) => {
  const companyId = currentUser?.companyId;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '', description: '',
    discountType: 'percent', discountValue: '',
    startDate: '', endDate: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'promotions'), where('companyId', '==', companyId), where('isDeleted', '==', false));
      const snap = await getDocs(q);
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast.error('Yuklanmadi');
    }
    setLoading(false);
  };

  useEffect(() => { if (companyId) load(); }, [companyId]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', description: '', discountType: 'percent', discountValue: '', startDate: '', endDate: '' });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    const toInput = (d) => {
      if (!d) return '';
      const date = d.seconds ? new Date(d.seconds * 1000) : new Date(d);
      return date.toISOString().slice(0, 10);
    };
    setForm({
      name: item.name || '',
      description: item.description || '',
      discountType: item.discountType || 'percent',
      discountValue: item.discountValue || '',
      startDate: toInput(item.startDate),
      endDate: toInput(item.endDate),
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error('Nom kiritng!');
    if (!form.discountValue || isNaN(form.discountValue)) return toast.error('Chegirma miqdorini kiriting!');
    if (!form.startDate || !form.endDate) return toast.error('Sanalarni kiriting!');
    if (new Date(form.startDate) > new Date(form.endDate)) return toast.error('Boshlanish sanasi tugash sanasidan oldin bo\'lishi kerak!');

    const data = {
      name: form.name.trim(),
      description: form.description.trim(),
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      startDate: new Date(form.startDate),
      endDate: new Date(form.endDate),
      companyId,
      isDeleted: false,
    };

    try {
      if (editing) {
        await updateDoc(doc(db, 'promotions', editing.id), data);
        toast.success('Yangilandi!');
      } else {
        await addDoc(collection(db, 'promotions'), { ...data, createdAt: new Date() });
        toast.success('Aksiya qo\'shildi!');
      }
      setShowModal(false);
      load();
    } catch (e) {
      toast.error('Xatolik!');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('O\'chirishni tasdiqlaysizmi?')) return;
    try {
      await updateDoc(doc(db, 'promotions', id), { isDeleted: true });
      toast.success('O\'chirildi!');
      load();
    } catch { toast.error('Xatolik!'); }
  };

  const filtered = items.filter(item => {
    const status = getPromoStatus(item.startDate, item.endDate);
    if (filterTab === 'active' && status !== 'active') return false;
    if (filterTab === 'inactive' && status !== 'inactive') return false;
    if (filterTab === 'scheduled' && status !== 'scheduled') return false;
    if (search && !item.name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const tabCounts = {
    all: items.length,
    active: items.filter(i => getPromoStatus(i.startDate, i.endDate) === 'active').length,
    inactive: items.filter(i => getPromoStatus(i.startDate, i.endDate) === 'inactive').length,
    scheduled: items.filter(i => getPromoStatus(i.startDate, i.endDate) === 'scheduled').length,
  };

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { id: 'all', label: 'Barchasi' },
          { id: 'active', label: 'Faollar' },
          { id: 'inactive', label: "Faol bo'lmaganlar" },
          { id: 'scheduled', label: 'Rejalashtirilganlar' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setFilterTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filterTab === t.id ? 'bg-violet-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label} ({tabCounts[t.id]})
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ID, do'kon, nom..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
          />
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors text-sm font-semibold"
        >
          <Plus className="w-4 h-4" />
          Yangi aksiya
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Nom</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Chegirma</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Boshlanish</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Tugash</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Tavsif</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400">Yuklanmoqda...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <Tag className="w-12 h-12 mx-auto text-slate-200 mb-3" />
                    <p className="text-slate-500 font-medium">Aksiyalar topilmadi</p>
                    <p className="text-slate-400 text-xs mt-1">Biz aksiyalar topmadik</p>
                  </td>
                </tr>
              ) : filtered.map(item => {
                const status = getPromoStatus(item.startDate, item.endDate);
                const badge = statusBadge[status] || statusBadge.inactive;
                return (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-violet-700 font-semibold">
                        {item.discountValue}{item.discountType === 'percent' ? '%' : " so'm"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(item.startDate)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(item.endDate)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-[160px] truncate">{item.description || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(item)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => remove(item.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">{editing ? 'Aksiyani tahrirlash' : 'Yangi aksiya'}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Aksiya nomi *</label>
                <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-sm" placeholder="Masalan: Yozgi aksiya" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Chegirma turi</label>
                  <select value={form.discountType} onChange={e => setForm(p => ({...p, discountType: e.target.value}))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 bg-white text-sm">
                    <option value="percent">Foiz (%)</option>
                    <option value="fixed">Miqdor (so'm)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Chegirma miqdori *</label>
                  <input value={form.discountValue} onChange={e => setForm(p => ({...p, discountValue: e.target.value}))}
                    type="number" min="0"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-sm"
                    placeholder={form.discountType === 'percent' ? '10' : '5000'} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Boshlanish sanasi *</label>
                  <input type="date" value={form.startDate} onChange={e => setForm(p => ({...p, startDate: e.target.value}))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tugash sanasi *</label>
                  <input type="date" value={form.endDate} onChange={e => setForm(p => ({...p, endDate: e.target.value}))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tavsif</label>
                <textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-sm resize-none"
                  placeholder="Aksiya haqida qisqacha..." />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-sm font-medium">
                Bekor qilish
              </button>
              <button onClick={save} className="flex-1 px-4 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 text-sm font-semibold">
                {editing ? 'Saqlash' : 'Qo\'shish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Promokodlar ───────────────────────────────────────────────────────────────
const Promokodlar = ({ currentUser }) => {
  const companyId = currentUser?.companyId;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [form, setForm] = useState({
    code: '', discountType: 'percent', discountValue: '', maxUsage: '', expiresDate: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'promoCodes'), where('companyId', '==', companyId), where('isDeleted', '==', false));
      const snap = await getDocs(q);
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { toast.error('Yuklanmadi'); }
    setLoading(false);
  };

  useEffect(() => { if (companyId) load(); }, [companyId]);

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    setForm(p => ({ ...p, code }));
  };

  const copyCode = (code, id) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ code: '', discountType: 'percent', discountValue: '', maxUsage: '', expiresDate: '' });
    generateCode();
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    const toInput = (d) => {
      if (!d) return '';
      const date = d.seconds ? new Date(d.seconds * 1000) : new Date(d);
      return date.toISOString().slice(0, 10);
    };
    setForm({
      code: item.code || '',
      discountType: item.discountType || 'percent',
      discountValue: item.discountValue || '',
      maxUsage: item.maxUsage || '',
      expiresDate: toInput(item.expiresAt),
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.code.trim()) return toast.error('Kod kiriting!');
    if (!form.discountValue || isNaN(form.discountValue)) return toast.error('Chegirma miqdori kiriting!');
    const data = {
      code: form.code.toUpperCase().trim(),
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      maxUsage: form.maxUsage ? Number(form.maxUsage) : null,
      expiresAt: form.expiresDate ? new Date(form.expiresDate) : null,
      companyId,
      isDeleted: false,
    };
    try {
      if (editing) {
        await updateDoc(doc(db, 'promoCodes', editing.id), data);
        toast.success('Yangilandi!');
      } else {
        // Duplikat tekshirish
        const existing = items.find(i => i.code === data.code);
        if (existing) return toast.error('Bu kod allaqachon mavjud!');
        await addDoc(collection(db, 'promoCodes'), { ...data, usedCount: 0, createdAt: new Date() });
        toast.success('Promokod qo\'shildi!');
      }
      setShowModal(false);
      load();
    } catch { toast.error('Xatolik!'); }
  };

  const remove = async (id) => {
    if (!window.confirm('O\'chirishni tasdiqlaysizmi?')) return;
    try {
      await updateDoc(doc(db, 'promoCodes', id), { isDeleted: true });
      toast.success('O\'chirildi!');
      load();
    } catch { toast.error('Xatolik!'); }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors text-sm font-semibold">
          <Plus className="w-4 h-4" />
          Yangi promokod
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Kod</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Chegirma</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Foydalanish</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Muddati</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400">Yuklanmoqda...</td></tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <Ticket className="w-12 h-12 mx-auto text-slate-200 mb-3" />
                    <p className="text-slate-500 font-medium">Promokodlar yo'q</p>
                    <p className="text-slate-400 text-xs mt-1">Yangi promokod qo'shing</p>
                  </td>
                </tr>
              ) : items.map(item => {
                const expired = item.expiresAt && (item.expiresAt.seconds ? new Date(item.expiresAt.seconds * 1000) : new Date(item.expiresAt)) < new Date();
                const exhausted = item.maxUsage && item.usedCount >= item.maxUsage;
                const isActive = !expired && !exhausted;
                return (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg text-sm">{item.code}</span>
                        <button onClick={() => copyCode(item.code, item.id)} className="p-1 text-slate-400 hover:text-violet-600 rounded">
                          {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-violet-700">
                      {item.discountValue}{item.discountType === 'percent' ? '%' : " so'm"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.usedCount || 0} / {item.maxUsage || '∞'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(item.expiresAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
                        {expired ? 'Muddati o\'tgan' : exhausted ? 'Tugagan' : 'Faol'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(item)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => remove(item.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">{editing ? 'Promokod tahrirlash' : 'Yangi promokod'}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Kod *</label>
                <div className="flex gap-2">
                  <input value={form.code} onChange={e => setForm(p => ({...p, code: e.target.value.toUpperCase()}))}
                    className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 text-sm font-mono"
                    placeholder="SUMMER10" />
                  <button onClick={generateCode} className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 text-sm font-medium">
                    Auto
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Turi</label>
                  <select value={form.discountType} onChange={e => setForm(p => ({...p, discountType: e.target.value}))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 bg-white text-sm">
                    <option value="percent">Foiz (%)</option>
                    <option value="fixed">Miqdor (so'm)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Miqdor *</label>
                  <input value={form.discountValue} onChange={e => setForm(p => ({...p, discountValue: e.target.value}))}
                    type="number" min="0"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 text-sm"
                    placeholder={form.discountType === 'percent' ? '10' : '5000'} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max foydalanish</label>
                  <input value={form.maxUsage} onChange={e => setForm(p => ({...p, maxUsage: e.target.value}))}
                    type="number" min="1"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 text-sm"
                    placeholder="Cheksiz" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Muddat</label>
                  <input type="date" value={form.expiresDate} onChange={e => setForm(p => ({...p, expiresDate: e.target.value}))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 text-sm" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-sm font-medium">
                Bekor qilish
              </button>
              <button onClick={save} className="flex-1 px-4 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 text-sm font-semibold">
                {editing ? 'Saqlash' : 'Qo\'shish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── SMS Tarqatish ────────────────────────────────────────────────────────────
const SmsTarqatish = ({ currentUser }) => {
  const companyId = currentUser?.companyId;
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', message: '' });

  const load = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'smsTemplates'), where('companyId', '==', companyId), where('isDeleted', '==', false));
      const snap = await getDocs(q);
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { toast.error('Yuklanmadi'); }
    setLoading(false);
  };

  useEffect(() => { if (companyId) load(); }, [companyId]);

  const save = async () => {
    if (!form.name.trim()) return toast.error('Shablon nomini kiriting!');
    if (!form.message.trim()) return toast.error('Xabar matnini kiriting!');
    const data = { name: form.name.trim(), message: form.message.trim(), companyId, isDeleted: false };
    try {
      if (editing) {
        await updateDoc(doc(db, 'smsTemplates', editing.id), data);
        toast.success('Yangilandi!');
      } else {
        await addDoc(collection(db, 'smsTemplates'), { ...data, createdAt: new Date() });
        toast.success('Shablon saqlandi!');
      }
      setShowModal(false);
      load();
    } catch { toast.error('Xatolik!'); }
  };

  const remove = async (id) => {
    if (!window.confirm('O\'chirishni tasdiqlaysizmi?')) return;
    try {
      await updateDoc(doc(db, 'smsTemplates', id), { isDeleted: true });
      toast.success('O\'chirildi!'); load();
    } catch { toast.error('Xatolik!'); }
  };

  const VARIABLES = ['{mijoz_ismi}', '{summa}', '{sana}', '{kompaniya_nomi}'];

  return (
    <div className="max-w-3xl">
      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 flex gap-3">
        <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-blue-800 font-medium text-sm">SMS xizmatini ulash</p>
          <p className="text-blue-600 text-xs mt-1">SMS jo'natish uchun Eskiz, Play Mobile yoki boshqa SMS gateway bilan integratsiya kerak. Hozircha shablonlarni saqlash mumkin.</p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-slate-800">SMS shablonlari</h3>
        <button onClick={() => { setEditing(null); setForm({ name: '', message: '' }); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 text-sm font-semibold">
          <Plus className="w-4 h-4" />
          Yangi shablon
        </button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-slate-400">Yuklanmoqda...</div>
        ) : templates.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
            <MessageSquare className="w-12 h-12 mx-auto text-slate-200 mb-3" />
            <p className="text-slate-500 font-medium">Shablonlar yo'q</p>
            <p className="text-slate-400 text-xs mt-1">SMS shablonlari yarating</p>
          </div>
        ) : templates.map(t => (
          <div key={t.id} className="bg-white rounded-2xl p-4 border border-slate-100 flex gap-4 items-start">
            <div className="p-2 bg-violet-100 rounded-xl flex-shrink-0">
              <MessageSquare className="w-5 h-5 text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800 text-sm">{t.name}</p>
              <p className="text-slate-500 text-sm mt-1 line-clamp-2">{t.message}</p>
              <p className="text-slate-400 text-xs mt-1">{t.message.length} belgi</p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => { setEditing(t); setForm({ name: t.name, message: t.message }); setShowModal(true); }}
                className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={() => remove(t.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">{editing ? 'Shalon tahrirlash' : 'Yangi shablon'}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Shablon nomi *</label>
                <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 text-sm"
                  placeholder="Masalan: Aksiya xabari" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Xabar matni *</label>
                <textarea value={form.message} onChange={e => setForm(p => ({...p, message: e.target.value}))}
                  rows={4}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 text-sm resize-none"
                  placeholder="SMS xabar matni..." />
                <p className="text-slate-400 text-xs mt-1">{form.message.length} belgi (1 SMS = 160 belgi)</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-2">O'zgaruvchilar (bosib qo'shing):</p>
                <div className="flex flex-wrap gap-2">
                  {VARIABLES.map(v => (
                    <button key={v} onClick={() => setForm(p => ({...p, message: p.message + v}))}
                      className="px-2 py-1 bg-violet-50 text-violet-700 rounded-lg text-xs font-mono hover:bg-violet-100">
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-sm font-medium">
                Bekor qilish
              </button>
              <button onClick={save} className="flex-1 px-4 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 text-sm font-semibold">
                {editing ? 'Saqlash' : 'Qo\'shish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Sovg'a Kartalari ─────────────────────────────────────────────────────────
const SovgaKartalari = ({ currentUser }) => {
  const companyId = currentUser?.companyId;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [form, setForm] = useState({ amount: '', expiresDate: '' });

  const load = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'giftCards'), where('companyId', '==', companyId), where('isDeleted', '==', false));
      const snap = await getDocs(q);
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { toast.error('Yuklanmadi'); }
    setLoading(false);
  };

  useEffect(() => { if (companyId) load(); }, [companyId]);

  const generateCardCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    let code = 'GC-';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    code += '-';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const save = async () => {
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) return toast.error('Summa kiriting!');
    const data = {
      code: generateCardCode(),
      amount: Number(form.amount),
      balance: Number(form.amount),
      expiresAt: form.expiresDate ? new Date(form.expiresDate) : null,
      isActive: true,
      companyId,
      isDeleted: false,
      createdAt: new Date(),
    };
    try {
      await addDoc(collection(db, 'giftCards'), data);
      toast.success('Sovg\'a kartasi yaratildi!');
      setShowModal(false);
      load();
    } catch { toast.error('Xatolik!'); }
  };

  const deactivate = async (id) => {
    try {
      await updateDoc(doc(db, 'giftCards', id), { isActive: false });
      toast.success('Karta o\'chirildi!');
      load();
    } catch { toast.error('Xatolik!'); }
  };

  const copyCode = (code, id) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const totalBalance = items.filter(i => i.isActive).reduce((s, i) => s + (i.balance || 0), 0);

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <p className="text-slate-500 text-xs mb-1">Jami kartalar</p>
          <p className="text-2xl font-bold text-slate-800">{items.length} ta</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <p className="text-slate-500 text-xs mb-1">Faol kartalar</p>
          <p className="text-2xl font-bold text-emerald-600">{items.filter(i => i.isActive).length} ta</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <p className="text-slate-500 text-xs mb-1">Jami balans</p>
          <p className="text-2xl font-bold text-violet-600">{totalBalance.toLocaleString()} so'm</p>
        </div>
      </div>

      <div className="flex justify-end mb-4">
        <button onClick={() => { setForm({ amount: '', expiresDate: '' }); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 text-sm font-semibold">
          <Plus className="w-4 h-4" />
          Yangi karta
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Kod</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Nominal</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Balans</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Muddati</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400">Yuklanmoqda...</td></tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <Gift className="w-12 h-12 mx-auto text-slate-200 mb-3" />
                    <p className="text-slate-500 font-medium">Sovg'a kartalari yo'q</p>
                    <p className="text-slate-400 text-xs mt-1">Yangi karta yarating</p>
                  </td>
                </tr>
              ) : items.map(item => {
                const expired = item.expiresAt && (item.expiresAt.seconds ? new Date(item.expiresAt.seconds * 1000) : new Date(item.expiresAt)) < new Date();
                const isActive = item.isActive && !expired;
                const usedPercent = item.amount > 0 ? Math.round(((item.amount - (item.balance || 0)) / item.amount) * 100) : 0;
                return (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-800 bg-violet-50 px-2 py-0.5 rounded-lg text-sm">{item.code}</span>
                        <button onClick={() => copyCode(item.code, item.id)} className="p-1 text-slate-400 hover:text-violet-600 rounded">
                          {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.amount?.toLocaleString()} so'm</td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-semibold text-slate-800">{(item.balance || 0).toLocaleString()} so'm</span>
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1">
                          <div className="h-full bg-violet-500 rounded-full" style={{ width: `${100 - usedPercent}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(item.expiresAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
                        {expired ? 'Muddati o\'tgan' : item.isActive ? 'Faol' : 'Bloklangan'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isActive && (
                        <button onClick={() => deactivate(item.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg" title="Bloklash">
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Yangi sovg'a kartasi</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Summa (so'm) *</label>
                <input value={form.amount} onChange={e => setForm(p => ({...p, amount: e.target.value}))}
                  type="number" min="1000"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 text-sm"
                  placeholder="50000" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Muddati (ixtiyoriy)</label>
                <input type="date" value={form.expiresDate} onChange={e => setForm(p => ({...p, expiresDate: e.target.value}))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 text-sm" />
              </div>
              <p className="text-xs text-slate-500 bg-violet-50 rounded-xl p-3">
                Karta kodi avtomatik yaratiladi. Mijozga kod beriladi va sotuvda ishlatiladi.
              </p>
            </div>
            <div className="flex gap-3 p-6 border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-sm font-medium">
                Bekor qilish
              </button>
              <button onClick={save} className="flex-1 px-4 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 text-sm font-semibold">
                Yaratish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Marketing Component ─────────────────────────────────────────────────
const Marketing = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState('aksiyalar');

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Marketing</h1>
        <p className="text-slate-500">Aksiyalar, promokodlar va mijozlarga xabarlar</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 bg-white rounded-2xl p-2 shadow-sm border border-slate-100">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'aksiyalar' && <Aksiyalar currentUser={currentUser} />}
      {activeTab === 'promo'     && <Promokodlar currentUser={currentUser} />}
      {activeTab === 'sms'       && <SmsTarqatish currentUser={currentUser} />}
      {activeTab === 'gifts'     && <SovgaKartalari currentUser={currentUser} />}
    </div>
  );
};

export default Marketing;
