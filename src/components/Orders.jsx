import { useState, useEffect } from 'react';
import {
  collection, query, where, onSnapshot, doc, updateDoc, orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';
import {
  ShoppingBag, Clock, CheckCircle, XCircle, Truck, Eye,
  Phone, MapPin, Package, ChevronDown, RefreshCw, Filter
} from 'lucide-react';

const STATUS_OPTIONS = [
  { id: 'yangi',       label: 'Yangi',          color: 'bg-blue-100 text-blue-700',   icon: Clock },
  { id: 'tasdiqlandi', label: 'Tasdiqlandi',     color: 'bg-amber-100 text-amber-700', icon: CheckCircle },
  { id: 'yetkazilmoqda', label: 'Yetkazilmoqda', color: 'bg-purple-100 text-purple-700', icon: Truck },
  { id: 'yetkazildi',  label: 'Yetkazildi',      color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  { id: 'bekor',       label: 'Bekor qilindi',   color: 'bg-rose-100 text-rose-700',   icon: XCircle },
];

const statusConfig = (id) => STATUS_OPTIONS.find(s => s.id === id) || STATUS_OPTIONS[0];

const PAYMENT_LABELS = {
  naqd: 'Naqd',
  karta: 'Karta',
  online: 'Online',
};

const DELIVERY_LABELS = {
  olib_ketish: 'Olib ketish',
  yetkazib_berish: "Yetkazib berish",
};

// ─── Order Detail Modal ───────────────────────────────────────────────────────
const OrderModal = ({ order, onClose, onStatusChange }) => {
  const [status, setStatus] = useState(order.status);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (status === order.status) return onClose();
    setSaving(true);
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status,
        updatedAt: new Date(),
      });
      onStatusChange(order.id, status);
      toast.success('Status yangilandi!');
      onClose();
    } catch {
      toast.error('Xatolik yuz berdi!');
    }
    setSaving(false);
  };

  const cfg = statusConfig(status);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Buyurtma #{order.orderNumber}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {order.createdAt?.toDate?.()?.toLocaleString('uz-UZ') || '—'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl">
            <XCircle className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Customer info */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Mijoz ma'lumotlari</h3>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="font-medium">{order.customerName || '—'}</span>
            </div>
            {order.customerPhone && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <a href={`tel:${order.customerPhone}`} className="text-emerald-600 hover:underline">
                  {order.customerPhone}
                </a>
              </div>
            )}
            {order.address && (
              <div className="flex items-start gap-2 text-sm text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                <span>{order.address}</span>
              </div>
            )}
          </div>

          {/* Delivery & payment */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-400 mb-1">Yetkazish</p>
              <p className="text-sm font-semibold text-slate-700">
                {DELIVERY_LABELS[order.deliveryType] || order.deliveryType || '—'}
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-400 mb-1">To'lov</p>
              <p className="text-sm font-semibold text-slate-700">
                {PAYMENT_LABELS[order.paymentType] || order.paymentType || '—'}
              </p>
            </div>
          </div>

          {/* Items */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Mahsulotlar</h3>
            <div className="space-y-2">
              {(order.items || []).map((item, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {item.imageUrl
                      ? <img src={item.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                      : <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package className="w-4 h-4 text-slate-400" />
                        </div>
                    }
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                      <p className="text-xs text-slate-400">{item.qty} × {Number(item.price).toLocaleString()} so'm</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-slate-800 ml-2 flex-shrink-0">
                    {(item.qty * item.price).toLocaleString()} so'm
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between bg-emerald-50 rounded-xl p-4">
            <span className="font-semibold text-slate-700">Jami summa</span>
            <span className="text-xl font-bold text-emerald-700">
              {Number(order.totalAmount).toLocaleString()} so'm
            </span>
          </div>

          {/* Note */}
          {order.note && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs font-medium text-amber-700 mb-1">Izoh:</p>
              <p className="text-sm text-amber-800">{order.note}</p>
            </div>
          )}

          {/* Status change */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Holat o'zgartirish</label>
            <div className="relative">
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm appearance-none bg-white pr-10"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-slate-600 font-medium hover:bg-slate-50">
              Yopish
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-50">
              {saving ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Orders Component ────────────────────────────────────────────────────
const Orders = ({ currentUser }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    if (!currentUser?.companyId) return;

    const q = query(
      collection(db, 'orders'),
      where('companyId', '==', currentUser.companyId),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error('Orders load error:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [currentUser?.companyId]);

  const handleStatusChange = (orderId, newStatus) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
  };

  const filtered = filterStatus === 'all'
    ? orders
    : orders.filter(o => o.status === filterStatus);

  const counts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s.id] = orders.filter(o => o.status === s.id).length;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-emerald-600" />
            Online Buyurtmalar
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Jami: {orders.length} ta buyurtma
          </p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-6">
        <button
          onClick={() => setFilterStatus('all')}
          className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            filterStatus === 'all'
              ? 'bg-slate-800 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Barchasi ({orders.length})
        </button>
        {STATUS_OPTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setFilterStatus(s.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filterStatus === s.id
                ? 'bg-slate-800 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {s.label} {counts[s.id] > 0 && `(${counts[s.id]})`}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Buyurtmalar yo'q</p>
          <p className="text-sm mt-1">
            {filterStatus === 'all'
              ? "Hali hech kim buyurtma bermagan"
              : "Bu holatda buyurtmalar yo'q"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const cfg = statusConfig(order.status);
            const StatusIcon = cfg.icon;
            return (
              <div key={order.id}
                className="bg-white rounded-2xl border border-slate-100 p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedOrder(order)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800">#{order.orderNumber}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                      {order.deliveryType === 'yetkazib_berish' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                          <Truck className="w-3 h-3" />
                          Yetkazish
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex items-center gap-4 text-sm text-slate-500 flex-wrap">
                      <span className="font-medium text-slate-700">{order.customerName}</span>
                      {order.customerPhone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" />
                          {order.customerPhone}
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 text-xs text-slate-400">
                      {order.items?.length || 0} ta mahsulot · {' '}
                      {PAYMENT_LABELS[order.paymentType] || order.paymentType} · {' '}
                      {order.createdAt?.toDate?.()?.toLocaleString('uz-UZ') || '—'}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-slate-800 text-lg">
                      {Number(order.totalAmount).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-400">so'm</p>
                    <button className="mt-2 p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-500">
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {selectedOrder && (
        <OrderModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
};

export default Orders;
