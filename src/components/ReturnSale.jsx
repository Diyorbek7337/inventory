import React, { useState } from 'react';
import { X, Search, RotateCcw, Package, AlertTriangle, CheckCircle } from 'lucide-react';
import { collection, query, where, getDocs, doc, runTransaction, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';

/**
 * ReturnSale — sotilgan mahsulotni qaytarish modali.
 * Sotuv raqami (saleId) yoki mijoz ismi bo'yicha qidiradi.
 * Qaytarilgan miqdor omborga qaytariladi, "qaytarish" tranzaksiyasi yaratiladi.
 */
const ReturnSale = ({ isOpen, onClose, currentUser, onUpdateProduct, onAddTransaction }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundSales, setFoundSales] = useState([]); // grouped by saleId
  const [selectedSale, setSelectedSale] = useState(null);
  const [returnQtys, setReturnQtys] = useState({}); // { productId_size: qty }
  const [returnReason, setReturnReason] = useState('');
  const [processing, setProcessing] = useState(false);

  if (!isOpen) return null;

  // ─── Sotuv qidirish ──────────────────────────────────────────────────────────
  const searchSales = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setFoundSales([]);
    setSelectedSale(null);

    try {
      let txDocs = [];

      // saleId bo'yicha qidirish
      const byId = query(
        collection(db, 'transactions'),
        where('companyId', '==', currentUser.companyId),
        where('type', '==', 'chiqim'),
        where('saleId', '==', searchQuery.trim())
      );
      const idSnap = await getDocs(byId);
      txDocs = idSnap.docs;

      // Topilmasa, mijoz ismi bo'yicha qidirish
      if (txDocs.length === 0) {
        const byCustomer = query(
          collection(db, 'transactions'),
          where('companyId', '==', currentUser.companyId),
          where('type', '==', 'chiqim'),
          where('customerName', '>=', searchQuery.trim()),
          where('customerName', '<=', searchQuery.trim() + '\uf8ff')
        );
        const custSnap = await getDocs(byCustomer);
        txDocs = custSnap.docs;
      }

      if (txDocs.length === 0) {
        toast.warning('Sotuv topilmadi!');
        setSearching(false);
        return;
      }

      // saleId bo'yicha guruhlash
      const grouped = {};
      txDocs.forEach(d => {
        const data = { id: d.id, ...d.data() };
        const sid = data.saleId || d.id;
        if (!grouped[sid]) {
          grouped[sid] = {
            saleId: sid,
            customerName: data.customerName,
            customerPhone: data.customerPhone,
            date: data.date?.toDate ? data.date.toDate() : new Date(data.date),
            paymentType: data.paymentType,
            items: [],
          };
        }
        grouped[sid].items.push(data);
      });

      setFoundSales(Object.values(grouped));
    } catch (err) {
      console.error('Qidirishda xatolik:', err);
      toast.error('Qidirishda xatolik yuz berdi!');
    }
    setSearching(false);
  };

  // ─── Sotuvni tanlash ─────────────────────────────────────────────────────────
  const selectSale = (sale) => {
    setSelectedSale(sale);
    // Har bir item uchun max qaytarish miqdorini standart 0 qilamiz
    const initial = {};
    sale.items.forEach(item => {
      const key = `${item.productId}_${item.size || ''}_${item.color || ''}`;
      initial[key] = 0;
    });
    setReturnQtys(initial);
  };

  // ─── Qaytarishni amalga oshirish ─────────────────────────────────────────────
  const processReturn = async () => {
    if (!selectedSale) return;

    const itemsToReturn = selectedSale.items.filter(item => {
      const key = `${item.productId}_${item.size || ''}_${item.color || ''}`;
      return (returnQtys[key] || 0) > 0;
    });

    if (itemsToReturn.length === 0) {
      toast.warning('Qaytarish uchun miqdor kiriting!');
      return;
    }

    setProcessing(true);
    const loadingToast = toast.loading('Qaytarilmoqda...');

    try {
      for (const item of itemsToReturn) {
        const key = `${item.productId}_${item.size || ''}_${item.color || ''}`;
        const qty = returnQtys[key] || 0;
        if (qty <= 0 || qty > item.quantity) continue;

        const productRef = doc(db, 'products', item.productId);

        // Omborga qaytarish (atomik)
        const updatedProduct = await runTransaction(db, async (tx) => {
          const snap = await tx.get(productRef);
          if (!snap.exists()) throw new Error(`Mahsulot topilmadi: ${item.productName}`);
          const current = snap.data();

          let newData;
          if (item.size && current.hasSizes) {
            const curQty = current.sizes?.[item.size] ?? 0;
            const newSizes = { ...current.sizes, [item.size]: curQty + qty };
            const newQuantity = Object.values(newSizes).reduce((s, v) => s + (Number(v) || 0), 0);
            newData = { sizes: newSizes, quantity: newQuantity };
          } else {
            newData = { quantity: current.quantity + qty };
          }

          tx.update(productRef, newData);
          return { ...current, id: item.productId, ...newData };
        });

        onUpdateProduct(updatedProduct);

        // Qaytarish tranzaksiyasi
        const returnTx = {
          saleId: item.saleId,
          returnedFrom: item.id,
          productId: item.productId,
          productName: item.productName,
          type: 'qaytarish',
          quantity: qty,
          size: item.size || null,
          color: item.color || null,
          costPrice: item.costPrice || 0,
          sellingPrice: item.sellingPrice || item.price || 0,
          price: item.sellingPrice || item.price || 0,
          totalAmount: qty * (item.sellingPrice || item.price || 0),
          customerName: item.customerName || '',
          customerPhone: item.customerPhone || '',
          reason: returnReason.trim() || 'Sabab ko\'rsatilmagan',
          companyId: currentUser.companyId,
          createdBy: currentUser.id,
          date: new Date(),
        };

        const ref = await addDoc(collection(db, 'transactions'), returnTx);
        onAddTransaction({ id: ref.id, ...returnTx });
      }

      toast.update(loadingToast, {
        render: '✅ Qaytarish amalga oshirildi!',
        type: 'success',
        isLoading: false,
        autoClose: 3000,
      });

      // Tozalash
      setSelectedSale(null);
      setFoundSales([]);
      setSearchQuery('');
      setReturnReason('');
      onClose();
    } catch (err) {
      console.error('Qaytarishda xatolik:', err);
      toast.update(loadingToast, {
        render: `❌ ${err.message || 'Xatolik yuz berdi!'}`,
        type: 'error',
        isLoading: false,
        autoClose: 4000,
      });
    }
    setProcessing(false);
  };

  const formatDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleString('uz-UZ', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const totalReturnAmount = selectedSale
    ? selectedSale.items.reduce((sum, item) => {
        const key = `${item.productId}_${item.size || ''}_${item.color || ''}`;
        const qty = returnQtys[key] || 0;
        return sum + qty * (item.sellingPrice || item.price || 0);
      }, 0)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-rose-600 to-rose-700 rounded-t-2xl">
          <h3 className="flex items-center gap-3 text-xl font-bold text-white">
            <RotateCcw className="w-6 h-6" />
            Mahsulot qaytarish
          </h3>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/20 text-white hover:bg-white/30 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Qidiruv */}
          {!selectedSale && (
            <div>
              <p className="text-sm font-semibold text-slate-600 mb-2">
                Sotuv raqami yoki mijoz ismi bilan qidiring
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="SALE-1234567890 yoki Mijoz ismi..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchSales()}
                    className="w-full pl-9 pr-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none"
                  />
                </div>
                <button
                  onClick={searchSales}
                  disabled={searching}
                  className="px-5 py-2.5 bg-rose-600 text-white rounded-xl hover:bg-rose-700 disabled:opacity-50 font-semibold transition-all active:scale-95"
                >
                  {searching ? '...' : 'Qidirish'}
                </button>
              </div>
            </div>
          )}

          {/* Topilgan sotuvlar */}
          {!selectedSale && foundSales.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-600">{foundSales.length} ta sotuv topildi:</p>
              {foundSales.map(sale => (
                <button
                  key={sale.saleId}
                  onClick={() => selectSale(sale)}
                  className="w-full text-left p-4 border-2 border-slate-200 rounded-xl hover:border-rose-400 hover:bg-rose-50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{sale.saleId}</p>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {sale.customerName} • {sale.items.length} ta mahsulot
                      </p>
                    </div>
                    <p className="text-xs text-slate-400">{formatDate(sale.date)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Tanlangan sotuv — qaytarish detallari */}
          {selectedSale && (
            <div className="space-y-4">
              {/* Sotuv ma'lumoti */}
              <div className="flex items-center justify-between p-3 bg-rose-50 border border-rose-200 rounded-xl">
                <div>
                  <p className="font-bold text-rose-800 text-sm">{selectedSale.saleId}</p>
                  <p className="text-rose-600 text-xs">{selectedSale.customerName} • {formatDate(selectedSale.date)}</p>
                </div>
                <button
                  onClick={() => { setSelectedSale(null); setReturnQtys({}); }}
                  className="text-xs text-rose-500 hover:text-rose-700 underline"
                >
                  O'zgartirish
                </button>
              </div>

              {/* Qaytariladigan mahsulotlar */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-700">Qaytarish miqdorini kiriting:</p>
                {selectedSale.items.map(item => {
                  const key = `${item.productId}_${item.size || ''}_${item.color || ''}`;
                  const maxQty = item.quantity;
                  const returnQty = returnQtys[key] || 0;
                  return (
                    <div key={key} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <Package className="w-8 h-8 text-slate-300 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{item.productName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {item.size && <span className="px-1.5 py-0.5 text-xs bg-violet-100 text-violet-700 rounded font-bold">{item.size}</span>}
                          {item.color && <span className="px-1.5 py-0.5 text-xs bg-pink-100 text-pink-700 rounded font-bold">{item.color}</span>}
                          <span className="text-xs text-slate-500">Sotilgan: {maxQty} ta</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setReturnQtys(p => ({ ...p, [key]: Math.max(0, (p[key] || 0) - 1) }))}
                          className="w-8 h-8 flex items-center justify-center bg-slate-200 rounded-lg hover:bg-slate-300 font-bold text-lg leading-none"
                        >−</button>
                        <input
                          type="number"
                          min={0}
                          max={maxQty}
                          value={returnQty}
                          onChange={e => setReturnQtys(p => ({ ...p, [key]: Math.min(maxQty, Math.max(0, parseInt(e.target.value) || 0)) }))}
                          className="w-12 h-8 text-center border-2 border-slate-200 rounded-lg text-sm font-bold"
                        />
                        <button
                          onClick={() => setReturnQtys(p => ({ ...p, [key]: Math.min(maxQty, (p[key] || 0) + 1) }))}
                          className="w-8 h-8 flex items-center justify-center bg-slate-200 rounded-lg hover:bg-slate-300 font-bold text-lg leading-none"
                        >+</button>
                        <button
                          onClick={() => setReturnQtys(p => ({ ...p, [key]: maxQty }))}
                          className="px-2 py-1 text-xs bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 font-medium ml-1"
                        >Hammasi</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sabab */}
              <div>
                <label className="text-sm font-semibold text-slate-600 mb-1.5 block">
                  Qaytarish sababi
                </label>
                <input
                  type="text"
                  placeholder="Masalan: Nuqsonli mahsulot, o'lcham mos emas..."
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:border-rose-500 outline-none"
                />
              </div>

              {/* Jami qaytarish summasi */}
              {totalReturnAmount > 0 && (
                <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="font-bold text-amber-800">
                      Qaytarish summasi: {totalReturnAmount.toLocaleString()} so'm
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Mahsulot omborga qaytariladi. Pul qaytarishni qo'lda amalga oshiring.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {selectedSale && (
          <div className="px-6 py-4 border-t border-slate-200 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 border-2 border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-all"
            >
              Bekor qilish
            </button>
            <button
              onClick={processReturn}
              disabled={processing || totalReturnAmount === 0}
              className="flex-1 py-3 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              {processing ? 'Qaytarilmoqda...' : 'Qaytarishni tasdiqlash'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReturnSale;
