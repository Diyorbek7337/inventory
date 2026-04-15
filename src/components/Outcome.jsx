import { useState, useEffect, useRef } from 'react';
import {
  User, ShoppingCart, Minus, Plus, Trash2,
  CreditCard, Banknote, Clock, X, Camera,
  Scan, Package, Percent,
  Printer, RotateCcw
} from 'lucide-react';
import { collection, addDoc, doc, runTransaction, getDocs, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';
import BarcodeScanner from './BarcodeScanner';
import ReturnSale from './ReturnSale';
import { qzPrintReceipt } from '../utils/qzPrint';
import "../style/style.css";

const Outcome = ({ products, onUpdateProduct, onAddTransaction, currentUser, isAdmin, companyData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentType, setPaymentType] = useState('naqd'); // naqd, karta, qarz
  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState('percent'); // percent, fixed
  const [saving, setSaving] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [sizePickerProduct, setSizePickerProduct] = useState(null);
  const [colorPickerProduct, setColorPickerProduct] = useState(null);
  const [autoPrint, setAutoPrint] = useState(() =>
    localStorage.getItem('autoPrint') !== 'false'
  );
  const [draftSales, setDraftSales] = useState([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const searchInputRef = useRef(null);

  // Kategoriyalar (mahsulotlardan olinadi)
  const categories = [...new Set(products.filter(p => p.category).map(p => p.category))].sort();

  // ─── Kechiktirilgan sotuvlarni yuklash ───────────────────────────────────────
  useEffect(() => {
    loadDrafts();
  }, [currentUser?.companyId]);

  const loadDrafts = async () => {
    if (!currentUser?.companyId) return;
    try {
      const q = query(
        collection(db, 'draftSales'),
        where('companyId', '==', currentUser.companyId)
      );
      const snap = await getDocs(q);
      setDraftSales(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { /* offline bo'lsa skip */ }
  };

  const saveDraft = async () => {
    if (selectedItems.length === 0) {
      toast.warning('Savat bo\'sh!');
      return;
    }
    try {
      await addDoc(collection(db, 'draftSales'), {
        items: selectedItems,
        customerName,
        customerPhone,
        paymentType,
        discount,
        discountType,
        paidAmount,
        companyId: currentUser.companyId,
        createdBy: currentUser.id,
        savedAt: new Date(),
      });
      setSelectedItems([]);
      setCustomerName('');
      setCustomerPhone('');
      setPaidAmount('');
      setDiscount('');
      toast.success('Sotuv kechiktirildi!');
      loadDrafts();
    } catch {
      toast.error('Kechiktirishda xatolik!');
    }
  };

  const restoreDraft = async (draft) => {
    setSelectedItems(draft.items || []);
    setCustomerName(draft.customerName || '');
    setCustomerPhone(draft.customerPhone || '');
    setPaymentType(draft.paymentType || 'naqd');
    setDiscount(draft.discount || '');
    setDiscountType(draft.discountType || 'percent');
    setPaidAmount(draft.paidAmount || '');
    await deleteDraft(draft.id);
    setShowDrafts(false);
    toast.success('Sotuv tiklandi!');
  };

  const deleteDraft = async (draftId) => {
    try {
      await deleteDoc(doc(db, 'draftSales', draftId));
      setDraftSales(prev => prev.filter(d => d.id !== draftId));
    } catch {
      toast.error('O\'chirishda xatolik!');
    }
  };

  // Browser print fallback (dialog bilan)
  const browserPrintFallback = (items, opts) => {
    const { subtotal, discountAmount, totalAmount, paid, remaining, paymentType, customerName, customerPhone, saleId } = opts;
    const storeName = companyData?.name || 'Do\'kon';
    const cashier = currentUser?.name || currentUser?.email || '';
    const now = new Date();
    const dateStr = now.toLocaleDateString('uz-UZ');
    const timeStr = now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
    const payLabels = { naqd: 'Naqd pul', karta: 'Karta', qarz: 'Qarz' };
    const change = paymentType !== 'qarz' && paid > totalAmount ? paid - totalAmount : 0;

    const rows = items.map(item => {
      const total = item.quantity * item.unitPrice;
      const sizePart = item.size ? ` [${item.size}]` : (item.color ? ` [${item.color}]` : '');
      return `<tr>
        <td style="padding:2px 0;font-size:11px">${item.name}${sizePart}</td>
        <td style="text-align:center;white-space:nowrap;font-size:11px">${item.quantity} × ${item.unitPrice.toLocaleString()}</td>
        <td style="text-align:right;white-space:nowrap;font-size:11px">${total.toLocaleString()}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  body { font-family:'Courier New',monospace; font-size:12px; width:74mm; }
  .c { text-align:center; } .b { font-weight:bold; } .lg { font-size:15px; }
  .hr { border-top:1px dashed #000; margin:4px 0; }
  table { width:100%; border-collapse:collapse; }
  .sm { color:#444; font-size:10px; }
</style></head><body>
<div class="c b lg">${storeName}</div>
<div class="c sm">${dateStr} ${timeStr}</div>
${cashier ? `<div class="c sm">Kassir: ${cashier}</div>` : ''}
${saleId ? `<div class="c sm">#${saleId}</div>` : ''}
<div class="hr"></div>
<table><tbody>${rows}</tbody></table>
<div class="hr"></div>
<table>
${discountAmount > 0 ? `<tr><td class="sm">Jami:</td><td style="text-align:right">${subtotal.toLocaleString()} so'm</td></tr>
<tr><td class="sm">Chegirma:</td><td style="text-align:right">-${discountAmount.toLocaleString()} so'm</td></tr>` : ''}
<tr class="b"><td>TO'LOV:</td><td style="text-align:right;font-size:14px">${totalAmount.toLocaleString()} so'm</td></tr>
<tr><td class="sm">To'lov turi:</td><td style="text-align:right">${payLabels[paymentType] || paymentType}</td></tr>
${paymentType === 'qarz' ? `
<tr><td class="sm">To'landi:</td><td style="text-align:right">${paid.toLocaleString()} so'm</td></tr>
<tr class="b"><td style="color:red">Qarz:</td><td style="text-align:right;color:red">${remaining.toLocaleString()} so'm</td></tr>
${customerName ? `<tr><td class="sm">Mijoz:</td><td style="text-align:right">${customerName}</td></tr>` : ''}
${customerPhone ? `<tr><td class="sm">Tel:</td><td style="text-align:right">${customerPhone}</td></tr>` : ''}
` : change > 0 ? `
<tr><td class="sm">Berildi:</td><td style="text-align:right">${paid.toLocaleString()} so'm</td></tr>
<tr class="b"><td>Qaytim:</td><td style="text-align:right">${change.toLocaleString()} so'm</td></tr>` : ''}
</table>
<div class="hr"></div>
<div class="c b">Xarid uchun rahmat!</div>
<div class="c sm">Yana tashrif buyuring</div>
<br/><br/>
</body></html>`;

    const win = window.open('', '_blank', 'width=380,height=550');
    if (!win) { toast.warning('Pop-up bloklangan. Brauzer sozlamalaridan ruxsat bering.'); return; }
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); win.close(); };
  };

  // Chek chiqarish: QZ Tray (dialog yo'q) → muvaffaqiyatsiz bo'lsa browser print
  const printReceipt = async (items, opts) => {
    const storeName = companyData?.name || 'Do\'kon';
    const cashier = currentUser?.name || currentUser?.email || '';

    await qzPrintReceipt({
      printerName: localStorage.getItem('printerName') || null,
      paperWidth: localStorage.getItem('paperWidth') || '80mm',
      receiptOpts: {
        storeName,
        cashier,
        saleId: opts.saleId,
        items,
        subtotal: opts.subtotal,
        discountAmount: opts.discountAmount,
        totalAmount: opts.totalAmount,
        paid: opts.paid,
        remaining: opts.remaining,
        paymentType: opts.paymentType,
        customerName: opts.customerName,
        customerPhone: opts.customerPhone,
      },
      fallback: () => browserPrintFallback(items, opts),
    });
  };

  // Barcode scan uchun auto-focus
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Mahsulotlar filtrlash (qidiruv + kategoriya)
  const filteredProducts = products.filter(p =>
    (p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.barcode?.includes(searchTerm) ||
    p.additionalBarcodes?.some(b => b.includes(searchTerm))) &&
    p.quantity > 0 &&
    (!selectedCategory || p.category === selectedCategory)
  );

  // Barcode scan
  const handleBarcodeScan = (barcode) => {
    setSearchTerm('');
    const product = products.find(p => 
      p.barcode === barcode || p.additionalBarcodes?.includes(barcode)
    );
    if (product) {
      if (product.quantity > 0) {
        addToCart(product);
        toast.success(`${product.name} qo'shildi`);
      } else {
        toast.error(`${product.name} - omborda yo'q!`);
      }
    } else {
      toast.warning(`Barcode: ${barcode} - topilmadi!`);
    }
    searchInputRef.current?.focus();
  };

  // Savatga qo'shish (pachka yoki dona, razmer va rang bilan)
  const addToCart = (product, sellType = 'dona', size = null, color = null) => {
    // Razmerli mahsulot — razmer tanlash kerak
    if (product.hasSizes && !size) {
      setSizePickerProduct(product);
      return;
    }
    // Rangli mahsulot — rang tanlash kerak
    if (product.hasColors && product.colors?.length > 0 && !color) {
      setColorPickerProduct(product);
      return;
    }

    const packSize = product.packSize || 1;
    const quantityToAdd = sellType === 'pachka' ? packSize : 1;
    const stockQty = size ? (product.sizes?.[size] || 0) : product.quantity;

    const existing = selectedItems.find(i =>
      i.id === product.id && i.sellType === sellType && i.size === size && i.color === color
    );

    if (existing) {
      const newQty = existing.quantity + quantityToAdd;
      if (newQty <= stockQty) {
        setSelectedItems(selectedItems.map(i =>
          (i.id === product.id && i.sellType === sellType && i.size === size && i.color === color)
            ? { ...i, quantity: newQty }
            : i
        ));
      } else {
        toast.warning(`Omborda${size ? ` (${size})` : ''} faqat ${stockQty} ta bor!`);
      }
    } else {
      if (stockQty <= 0) {
        toast.error(`${product.name}${size ? ` — ${size}` : ''} omborda yo'q!`);
        return;
      }
      const unitPrice = product.sellingPrice || product.price;
      const packPrice = unitPrice * packSize;
      setSelectedItems([...selectedItems, {
        ...product,
        quantity: quantityToAdd,
        sellType,
        size,
        color,
        packSize,
        unitPrice: sellType === 'pachka' ? packPrice : unitPrice,
      }]);
    }
  };

  // Miqdorni o'zgartirish
  const updateQuantity = (id, sellType, size, newQuantity, color = null) => {
    const product = products.find(p => p.id === id);
    const stockQty = size ? (product.sizes?.[size] || 0) : product.quantity;
    if (newQuantity <= 0) {
      setSelectedItems(selectedItems.filter(i => !(i.id === id && i.sellType === sellType && i.size === size && i.color === color)));
    } else if (newQuantity <= stockQty) {
      setSelectedItems(selectedItems.map(i =>
        (i.id === id && i.sellType === sellType && i.size === size && i.color === color) ? { ...i, quantity: newQuantity } : i
      ));
    } else {
      toast.warning(`Omborda${size ? ` (${size})` : ''} faqat ${stockQty} ta bor!`);
    }
  };

  // Sotish turini o'zgartirish (pachka <-> dona)
  const toggleSellType = (id, currentSellType) => {
    const item = selectedItems.find(i => i.id === id && i.sellType === currentSellType);
    if (!item) return;
    
    const product = products.find(p => p.id === id);
    const packSize = product.packSize || 1;
    
    if (packSize === 1) {
      toast.info('Bu mahsulot faqat donada sotiladi');
      return;
    }
    
    const newSellType = currentSellType === 'dona' ? 'pachka' : 'dona';
    const baseUnitPrice = item.sellingPrice || item.price || 0;
    const newUnitPrice = newSellType === 'pachka'
      ? baseUnitPrice * packSize
      : baseUnitPrice;
    
    // Miqdorni qayta hisoblash
    let newQuantity;
    if (newSellType === 'pachka') {
      newQuantity = Math.floor(item.quantity / packSize) * packSize || packSize;
    } else {
      newQuantity = item.quantity;
    }
    
    setSelectedItems(selectedItems.map(i =>
      (i.id === id && i.sellType === currentSellType) 
        ? { ...i, sellType: newSellType, unitPrice: newUnitPrice, quantity: newQuantity }
        : i
    ));
  };

  // Hisob-kitoblar (har doim joriy unitPrice ishlatiladi)
  const subtotal = selectedItems.reduce((sum, item) =>
    sum + (item.quantity * item.unitPrice), 0
  );
  
  const discountAmount = discountType === 'percent' 
    ? (subtotal * (parseFloat(discount) || 0) / 100)
    : (parseFloat(discount) || 0);
  
  const totalAmount = subtotal - discountAmount;
  const paid = parseFloat(paidAmount) || 0;
  const remaining = totalAmount - paid;

  // Profit hisoblash (admin uchun)
  const totalCost = selectedItems.reduce((sum, item) => 
    sum + (item.quantity * (item.costPrice || 0)), 0
  );
  const totalProfit = totalAmount - totalCost;

  // Sotish
  const handleSubmit = async () => {
    if (selectedItems.length === 0) {
      toast.warning('Mahsulot tanlang!');
      return;
    }

    // Narxi 0 bo'lgan mahsulotlar tekshiruvi
    const zeroPriceItems = selectedItems.filter(i => !i.unitPrice || i.unitPrice <= 0);
    if (zeroPriceItems.length > 0) {
      toast.error(`Narxi 0 bo'lgan mahsulot: "${zeroPriceItems[0].name}". Narxni belgilang!`);
      return;
    }

    if (paymentType === 'qarz' && !customerName.trim()) {
      toast.error('Qarz uchun mijoz ismini kiriting!');
      return;
    }

    if (paymentType !== 'qarz' && paid < totalAmount) {
      toast.error('To\'lov yetarli emas!');
      return;
    }

    setSaving(true);
    const loadingToast = toast.loading('Sotilmoqda...');

    try {
      const saleId = `SALE-${Date.now()}`;
      const saleDate = new Date();

      for (const item of selectedItems) {
        const productRef = doc(db, 'products', item.id);

        // Atomik tranzaksiya — bir vaqtda 2 ta sotuvchi bir mahsulotni sotsa ham minus chiqmaydi
        let updatedProduct;
        try {
          updatedProduct = await runTransaction(db, async (tx) => {
            const snap = await tx.get(productRef);
            if (!snap.exists()) throw new Error(`"${item.name}" topilmadi!`);
            const current = snap.data();

            let newData;
            if (item.size && current.hasSizes) {
              const curQty = current.sizes?.[item.size] ?? 0;
              if (curQty < item.quantity)
                throw new Error(`"${item.name}" (${item.size}) omborda faqat ${curQty} ta qolgan!`);
              const newSizes = { ...current.sizes, [item.size]: curQty - item.quantity };
              const newQuantity = Object.values(newSizes).reduce((s, v) => s + (Number(v) || 0), 0);
              newData = { sizes: newSizes, quantity: newQuantity };
            } else {
              if (current.quantity < item.quantity)
                throw new Error(`"${item.name}" omborda faqat ${current.quantity} ta qolgan!`);
              newData = { quantity: current.quantity - item.quantity };
            }

            tx.update(productRef, newData);
            return { ...current, id: item.id, ...newData };
          });
        } catch (txErr) {
          // Ombor yetarli emas — foydalanuvchiga xabar berib to'xtatamiz
          throw txErr;
        }
        onUpdateProduct(updatedProduct);

        // Bu mahsulotning umumiy sotuvdagi ulushi (nisbati)
        const itemTotal = item.quantity * item.unitPrice;
        const itemShare = totalAmount > 0 ? itemTotal / totalAmount : 0;

        // paidAmount va debt ni proporsional taqsimlash
        const itemPaid = paymentType === 'qarz'
          ? Math.round(paid * itemShare)
          : itemTotal;
        const itemDebt = paymentType === 'qarz'
          ? Math.round(remaining * itemShare)
          : 0;

        // Tranzaksiya yozish
        const transactionData = {
          saleId,
          productId: item.id,
          productName: item.name,
          type: 'chiqim',
          quantity: item.quantity,
          costPrice: item.costPrice || 0,
          sellingPrice: item.unitPrice,
          price: item.unitPrice,
          totalAmount: itemTotal,
          paidAmount: itemPaid,
          debt: itemDebt,
          customerName: customerName.trim() || 'Naqd mijoz',
          customerPhone: customerPhone.trim(),
          paymentType,
          discount: discountAmount,
          companyId: currentUser.companyId,
          createdBy: currentUser.id,
          date: saleDate
        };

        const docRef = await addDoc(collection(db, 'transactions'), transactionData);
        onAddTransaction({ id: docRef.id, ...transactionData, date: saleDate });
      }

      // Tozalash
      setSelectedItems([]);
      setCustomerName('');
      setCustomerPhone('');
      setPaidAmount('');
      setDiscount('');
      setPaymentType('naqd');

      toast.update(loadingToast, {
        render: `✅ Sotildi! ${paymentType === 'qarz' ? `Qarz: ${remaining.toLocaleString()} so'm` : ''}`,
        type: 'success',
        isLoading: false,
        autoClose: 3000
      });

      // Chek chiqarish
      if (autoPrint) {
        printReceipt(selectedItems, {
          subtotal, discountAmount, totalAmount, paid, remaining,
          paymentType, customerName, customerPhone, saleId
        });
      }

      searchInputRef.current?.focus();
    } catch (error) {
      console.error('Xato:', error);
      toast.update(loadingToast, {
        render: `❌ ${error.message || 'Xatolik yuz berdi!'}`,
        type: 'error',
        isLoading: false,
        autoClose: 5000
      });
    }
    setSaving(false);
  };

  // Tez to'lov tugmalari
  const quickPayments = [5000, 10000, 20000, 50000, 100000];

  return (
    <div className="h-[calc(100vh-64px)] lg:h-screen flex flex-col bg-slate-100">

      {/* ─── TOP TOOLBAR ──────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-3 py-2 bg-white border-b border-slate-200 flex items-center gap-2 shadow-sm">
        {/* Qidiruv / Barcode */}
        <div className="relative flex-1">
          <Scan className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Mahsulot nomi yoki barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchTerm) {
                const product = products.find(p => p.barcode === searchTerm);
                if (product) handleBarcodeScan(searchTerm);
              }
            }}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50"
            autoComplete="off"
          />
        </div>

        {/* Kamera */}
        <button
          onClick={() => setShowScanner(true)}
          className="p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 active:scale-95 transition-all"
          title="Kamera bilan skanerlash"
        >
          <Camera className="w-5 h-5" />
        </button>

        {/* Chek toggle */}
        <button
          onClick={() => {
            const next = !autoPrint;
            setAutoPrint(next);
            localStorage.setItem('autoPrint', next.toString());
            toast.info(next ? '🖨️ Chek yoqildi' : '🖨️ Chek o\'chirildi', { autoClose: 1500 });
          }}
          className={`p-2 rounded-xl transition-all active:scale-95 border ${
            autoPrint
              ? 'bg-blue-500 text-white border-blue-500'
              : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
          }`}
          title={autoPrint ? 'Chek yoqiq — o\'chirish uchun bosing' : 'Chek o\'chiq — yoqish uchun bosing'}
        >
          <Printer className="w-5 h-5" />
        </button>

        {/* Qaytarish */}
        <button
          onClick={() => setShowReturn(true)}
          className="p-2 border border-rose-200 text-rose-500 rounded-xl hover:bg-rose-50 active:scale-95 transition-all"
          title="Sotilgan mahsulotni qaytarish"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        {/* Kechiktirish / Kechiktirilganlar */}
        <button
          onClick={selectedItems.length > 0 ? saveDraft : () => setShowDrafts(true)}
          className="relative p-2 border border-amber-200 text-amber-500 rounded-xl hover:bg-amber-50 active:scale-95 transition-all"
          title={selectedItems.length > 0 ? 'Sotuvni keyinga qoldirish' : 'Kechiktirilgan sotuvlar'}
        >
          <Clock className="w-5 h-5" />
          {draftSales.length > 0 && (
            <span
              onClick={e => { e.stopPropagation(); setShowDrafts(true); }}
              className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center cursor-pointer"
            >
              {draftSales.length}
            </span>
          )}
        </button>
      </div>

      {/* ─── MAIN CONTENT ─────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ══ CHAP — Kategoriya + Mahsulotlar ══ */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Kategoriya filtri */}
          {categories.length > 0 && (
            <div className="flex-shrink-0 bg-white border-b border-slate-200 px-3 py-2 overflow-x-auto">
              <div className="flex gap-1.5 min-w-max">
                <button
                  onClick={() => setSelectedCategory('')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                    selectedCategory === ''
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Barchasi
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(selectedCategory === cat ? '' : cat)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                      selectedCategory === cat
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mahsulotlar grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Package className="w-16 h-16 mb-4 opacity-30" />
                <p className="font-semibold text-slate-500">Mahsulot topilmadi</p>
                <p className="text-sm mt-1">Boshqa nom yoki barcode kiriting</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredProducts.map(product => {
                  const cartItems = selectedItems.filter(i => i.id === product.id);
                  const inCart = cartItems.length > 0;
                  const cartQty = cartItems.reduce((sum, i) => sum + i.quantity, 0);
                  const hasPackSize = (product.packSize || 1) > 1;
                  const packSz = product.packSize || 1;
                  const price = product.sellingPrice || product.price;
                  const stockPachka = hasPackSize ? Math.floor(product.quantity / packSz) : 0;
                  const lowStock = product.quantity > 0 && product.quantity < (hasPackSize ? packSz : 5);

                  return (
                    <div
                      key={product.id}
                      className={`relative flex flex-col rounded-2xl overflow-hidden transition-all duration-150 ${
                        inCart ? 'ring-2 ring-emerald-400 shadow-xl' : 'shadow-md hover:shadow-xl'
                      }`}
                    >
                      {/* Yuqori — qoramtir sarlavha */}
                      <div className={`relative px-3 pt-3 pb-2 min-h-[4.5rem] flex flex-col justify-between ${
                        inCart ? 'bg-emerald-700' : 'bg-slate-800'
                      }`}>
                        {product.imageUrl && (
                          <img src={product.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />
                        )}
                        {inCart && (
                          <span className="absolute top-2 right-2 min-w-[22px] h-[22px] px-1 bg-white text-emerald-700 text-xs font-black rounded-full flex items-center justify-center">
                            {cartQty}
                          </span>
                        )}
                        <p className="relative font-bold text-white text-sm leading-snug line-clamp-2 pr-7">
                          {product.name}
                        </p>
                        {hasPackSize ? (
                          <div className="relative self-start mt-1 flex flex-col gap-0.5">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold self-start ${
                              lowStock ? 'bg-rose-500 text-white' : 'bg-white/20 text-white'
                            }`}>
                              📦 {stockPachka} pachka
                            </span>
                            <span className="px-2 py-0.5 bg-white/10 rounded-full text-[10px] text-white/70 self-start">
                              {product.quantity} dona
                            </span>
                          </div>
                        ) : (
                          <span className={`relative self-start mt-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            lowStock ? 'bg-rose-500 text-white' : 'bg-white/20 text-white'
                          }`}>
                            {product.quantity} ta
                          </span>
                        )}
                      </div>

                      {/* Pastki — narx va tugmalar */}
                      <div className="bg-white px-3 pt-2 pb-3 flex flex-col flex-1">
                        <p className="text-xl font-black text-slate-900 leading-none">{price?.toLocaleString()}</p>
                        <p className="text-[11px] text-slate-400 mb-3">so'm</p>

                        {product.hasSizes && product.sizes ? (
                          <div className="flex flex-wrap gap-1 mt-auto">
                            {Object.entries(product.sizes)
                              .sort(([a], [b]) => {
                                const order = ['XS','S','M','L','XL','XXL','XXXL'];
                                const ai = order.indexOf(a), bi = order.indexOf(b);
                                if (ai !== -1 && bi !== -1) return ai - bi;
                                return a.localeCompare(b, undefined, { numeric: true });
                              })
                              .map(([size, qty]) => (
                                <button
                                  key={size}
                                  disabled={qty <= 0}
                                  onClick={() => addToCart(product, 'dona', size)}
                                  className={`flex-1 min-w-[36px] py-1.5 text-xs font-bold rounded-xl transition-all active:scale-95 ${
                                    qty > 0 ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                  }`}
                                >
                                  {size}
                                  {qty > 0 && <span className="block text-[10px] font-normal opacity-75">{qty}</span>}
                                </button>
                              ))}
                          </div>
                        ) : product.hasColors && product.colors?.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-auto">
                            {product.colors.map(color => (
                              <button
                                key={color}
                                onClick={() => addToCart(product, 'dona', null, color)}
                                className="flex-1 min-w-[40px] py-1.5 text-xs font-bold rounded-xl bg-pink-600 text-white hover:bg-pink-700 active:scale-95 transition-all"
                              >
                                {color}
                              </button>
                            ))}
                          </div>
                        ) : hasPackSize ? (
                          /* Pachkali mahsulot — 2 ta tugma: Dona va Pachka */
                          <div className="flex flex-col gap-1.5 mt-auto">
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => addToCart(product, 'dona')}
                                className="flex-1 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 active:scale-95 transition-all"
                              >
                                + Dona
                              </button>
                              <button
                                onClick={() => addToCart(product, 'pachka')}
                                className="flex-1 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl hover:bg-violet-700 active:scale-95 transition-all"
                                title={`1 pachka = ${packSz} dona`}
                              >
                                📦 {packSz}li
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-1.5 mt-auto">
                            <button
                              onClick={() => addToCart(product, 'dona')}
                              className="flex-1 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 active:scale-95 transition-all"
                            >
                              + Qo'sh
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ══ O'NG — Savat ══ */}
        <div className="w-72 xl:w-80 flex-shrink-0 flex flex-col bg-white border-l border-slate-200 shadow-xl">

          {/* Mijoz (faqat qarz rejimida) */}
          {paymentType === 'qarz' && (
            <div className="flex-shrink-0 p-3 bg-rose-50 border-b border-rose-100 space-y-2">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Mijoz ismi *"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border-2 border-rose-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-400 focus:border-rose-400"
                />
              </div>
              <input
                type="tel"
                placeholder="Telefon (ixtiyoriy)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-3 py-2 border-2 border-rose-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-400 focus:border-rose-400"
              />
            </div>
          )}

          {/* Savatcha sarlavhasi */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-slate-100">
            <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
              <ShoppingCart className="w-4 h-4" />
              Savat
              {selectedItems.length > 0 && (
                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                  {selectedItems.length}
                </span>
              )}
            </div>
            {selectedItems.length > 0 && (
              <button
                onClick={() => setSelectedItems([])}
                className="text-xs text-slate-400 hover:text-rose-500 transition-colors"
              >
                Tozalash
              </button>
            )}
          </div>

          {/* Savat elementlari */}
          <div className="flex-1 overflow-y-auto">
            {selectedItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 px-4">
                <ShoppingCart className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-sm font-medium text-slate-400">Savat bo'sh</p>
                <p className="text-xs text-slate-300 mt-1 text-center">Chap tomondagi mahsulotni bosing</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {selectedItems.map(item => (
                  <div key={`${item.id}-${item.sellType}-${item.size}-${item.color}`} className="p-3">
                    {/* Nomi + o'chirish */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-sm truncate">{item.name}</p>
                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                          {item.size && (
                            <span className="px-1.5 py-0.5 text-[11px] rounded-md font-bold bg-violet-100 text-violet-700">{item.size}</span>
                          )}
                          {item.color && (
                            <span className="px-1.5 py-0.5 text-[11px] rounded-md font-bold bg-pink-100 text-pink-700">{item.color}</span>
                          )}
                          {item.packSize > 1 && (
                            <span className={`px-1.5 py-0.5 text-[11px] rounded-md font-medium ${
                              item.sellType === 'pachka' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {item.sellType === 'pachka' ? `${item.packSize}li pachka` : 'dona'}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedItems(selectedItems.filter(i =>
                          !(i.id === item.id && i.sellType === item.sellType && i.size === item.size && i.color === item.color)
                        ))}
                        className="p-1 text-slate-300 hover:text-rose-500 transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Miqdor + narx */}
                    <div className="flex items-center justify-between gap-2">
                      {/* Pachka/Dona toggle */}
                      {item.packSize > 1 && !item.size && (
                        <button
                          onClick={() => toggleSellType(item.id, item.sellType)}
                          className={`px-2 py-1 text-[11px] rounded-lg font-medium transition-all ${
                            item.sellType === 'pachka' ? 'bg-violet-500 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                        >
                          {item.sellType === 'pachka'
                            ? `📦 ${item.packSize}li pachka`
                            : '🔹 Donali'}
                        </button>
                      )}

                      {/* Miqdor boshqaruvi */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQuantity(item.id, item.sellType, item.size, item.quantity - 1, item.color)}
                          className="w-7 h-7 flex items-center justify-center bg-slate-100 rounded-lg hover:bg-slate-200 active:scale-95 transition-all"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.id, item.sellType, item.size, parseInt(e.target.value) || 0, item.color)}
                          className="w-10 h-7 text-center border border-slate-200 rounded-lg text-sm font-bold"
                        />
                        <button
                          onClick={() => updateQuantity(item.id, item.sellType, item.size, item.quantity + 1, item.color)}
                          className="w-7 h-7 flex items-center justify-center bg-slate-100 rounded-lg hover:bg-slate-200 active:scale-95 transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Narx */}
                      <div className="flex flex-col items-end gap-0.5">
                        {item.freePrice ? (
                          <input
                            type="number"
                            value={item.unitPrice}
                            onChange={e => setSelectedItems(prev => prev.map(i =>
                              (i.id === item.id && i.sellType === item.sellType && i.size === item.size && i.color === item.color)
                                ? { ...i, unitPrice: parseFloat(e.target.value) || 0 }
                                : i
                            ))}
                            className="w-20 h-7 text-right border-2 border-amber-400 rounded-lg text-sm font-bold px-1.5"
                          />
                        ) : (
                          <p className="font-bold text-slate-800 text-sm">
                            {(item.quantity * item.unitPrice).toLocaleString()}
                          </p>
                        )}
                        <button
                          onClick={() => setSelectedItems(prev => prev.map(i =>
                            (i.id === item.id && i.sellType === item.sellType && i.size === item.size && i.color === item.color)
                              ? { ...i, freePrice: !i.freePrice }
                              : i
                          ))}
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-all ${
                            item.freePrice ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-400 hover:text-amber-600'
                          }`}
                        >
                          {item.freePrice ? 'Erkin ✓' : 'Narx ✏️'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─── Pastki panel ─────────────────────────────────────────── */}
          <div className="flex-shrink-0 border-t border-slate-200 bg-slate-50 p-3 space-y-3">

            {/* Chegirma */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="number"
                  placeholder="Chegirma"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-full pl-8 pr-2 py-2 border border-slate-200 rounded-xl text-sm bg-white"
                />
              </div>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value)}
                className="px-2 py-2 border border-slate-200 rounded-xl text-sm bg-white"
              >
                <option value="percent">%</option>
                <option value="fixed">so'm</option>
              </select>
            </div>

            {/* Qarz uchun oldindan to'lov */}
            {paymentType === 'qarz' && (
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Oldindan to'lov</label>
                <input
                  type="number"
                  placeholder="0"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-rose-200 rounded-xl text-base font-bold bg-white"
                />
                <div className="flex gap-1 mt-1.5 overflow-x-auto">
                  {quickPayments.map(amount => (
                    <button
                      key={amount}
                      onClick={() => setPaidAmount((paid + amount).toString())}
                      className="flex-shrink-0 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-100 whitespace-nowrap"
                    >
                      +{amount >= 1000 ? `${amount/1000}k` : amount}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Summalar */}
            <div className="space-y-1 text-sm">
              {discountAmount > 0 && (
                <>
                  <div className="flex justify-between text-slate-500">
                    <span>Jami:</span>
                    <span>{subtotal.toLocaleString()} so'm</span>
                  </div>
                  <div className="flex justify-between text-emerald-600">
                    <span>Chegirma:</span>
                    <span>−{discountAmount.toLocaleString()} so'm</span>
                  </div>
                </>
              )}
              {paymentType === 'qarz' && paid > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>To'landi:</span>
                  <span>{paid.toLocaleString()} so'm</span>
                </div>
              )}
              {paymentType === 'qarz' && remaining > 0 && (
                <div className="flex justify-between text-rose-600 font-bold">
                  <span>Qarz:</span>
                  <span>{remaining.toLocaleString()} so'm</span>
                </div>
              )}
              {isAdmin && totalProfit > 0 && (
                <div className="flex justify-between text-amber-500 border-t border-dashed border-slate-200 pt-1">
                  <span>Foyda:</span>
                  <span>+{totalProfit.toLocaleString()} so'm</span>
                </div>
              )}
            </div>

            {/* To'lov turi */}
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { type: 'naqd', label: 'Naqd', icon: Banknote },
                { type: 'karta', label: 'Karta', icon: CreditCard },
                { type: 'qarz', label: 'Qarz', icon: Clock },
              ].map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  onClick={() => {
                    setPaymentType(type);
                    if (type !== 'qarz') setPaidAmount(totalAmount.toString());
                    else setPaidAmount('0');
                  }}
                  className={`flex flex-col items-center gap-0.5 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                    paymentType === type
                      ? type === 'naqd' ? 'bg-emerald-500 text-white shadow'
                        : type === 'karta' ? 'bg-blue-500 text-white shadow'
                        : 'bg-rose-500 text-white shadow'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* SOTISH tugmasi */}
            <button
              onClick={handleSubmit}
              disabled={selectedItems.length === 0 || saving}
              className={`w-full py-3.5 rounded-2xl font-bold text-base transition-all active:scale-[0.99] shadow-lg disabled:opacity-40 disabled:cursor-not-allowed ${
                selectedItems.length > 0 && !saving
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/30'
                  : 'bg-slate-200 text-slate-400'
              }`}
            >
              {saving
                ? 'Sotilmoqda...'
                : selectedItems.length === 0
                  ? 'Mahsulot tanlang'
                  : `SOTISH — ${totalAmount.toLocaleString()} so'm`
              }
            </button>
          </div>
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Razmer tanlash Modal */}
      {sizePickerProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <p className="font-bold text-slate-800">{sizePickerProduct.name}</p>
                <p className="text-sm text-slate-500">Razmer tanlang</p>
              </div>
              <button onClick={() => setSizePickerProduct(null)} className="p-1.5 hover:bg-slate-100 rounded-xl">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(sizePickerProduct.sizes || {})
                  .sort(([a], [b]) => {
                    const order = ['XS','S','M','L','XL','XXL','XXXL'];
                    const ai = order.indexOf(a); const bi = order.indexOf(b);
                    if (ai !== -1 && bi !== -1) return ai - bi;
                    return a.localeCompare(b, undefined, { numeric: true });
                  })
                  .map(([size, qty]) => (
                    <button
                      key={size}
                      disabled={qty <= 0}
                      onClick={() => {
                        addToCart(sizePickerProduct, 'dona', size);
                        setSizePickerProduct(null);
                      }}
                      className={`flex flex-col items-center py-3 rounded-xl border-2 font-bold transition-all active:scale-95 ${
                        qty > 0
                          ? 'border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100'
                          : 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                      }`}
                    >
                      <span className="text-lg">{size}</span>
                      <span className={`text-xs mt-0.5 ${qty > 0 ? 'text-violet-400' : 'text-slate-300'}`}>
                        {qty > 0 ? `${qty} ta` : 'tugagan'}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rang tanlash Modal */}
      {colorPickerProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <p className="font-bold text-slate-800">{colorPickerProduct.name}</p>
                <p className="text-sm text-slate-500">Rangni tanlang</p>
              </div>
              <button onClick={() => setColorPickerProduct(null)} className="p-1.5 hover:bg-slate-100 rounded-xl">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                {(colorPickerProduct.colors || []).map(color => (
                  <button
                    key={color}
                    onClick={() => {
                      addToCart(colorPickerProduct, 'dona', null, color);
                      setColorPickerProduct(null);
                    }}
                    className="px-4 py-3 rounded-xl border-2 border-pink-300 bg-pink-50 text-pink-700 font-semibold hover:bg-pink-100 active:scale-95 transition-all text-sm"
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Qaytarish modali */}
      <ReturnSale
        isOpen={showReturn}
        onClose={() => setShowReturn(false)}
        currentUser={currentUser}
        onUpdateProduct={onUpdateProduct}
        onAddTransaction={onAddTransaction}
      />

      {/* Kechiktirilgan sotuvlar modali */}
      {showDrafts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-amber-500 to-amber-600 rounded-t-2xl">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Kechiktirilgan sotuvlar
              </h3>
              <button onClick={() => setShowDrafts(false)} className="p-1.5 rounded-xl bg-white/20 text-white hover:bg-white/30">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
              {draftSales.length === 0 ? (
                <p className="text-center text-slate-400 py-8">Kechiktirilgan sotuv yo'q</p>
              ) : (
                draftSales.map(draft => {
                  const savedAt = draft.savedAt?.toDate ? draft.savedAt.toDate() : new Date();
                  return (
                    <div key={draft.id} className="flex items-center gap-3 p-3 border border-amber-200 rounded-xl bg-amber-50">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-sm">
                          {draft.customerName || 'Naqd mijoz'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {draft.items?.length} ta mahsulot •{' '}
                          {savedAt.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <button
                        onClick={() => restoreDraft(draft)}
                        className="px-3 py-1.5 bg-amber-500 text-white text-sm font-semibold rounded-lg hover:bg-amber-600 active:scale-95"
                      >
                        Davom etish
                      </button>
                      <button
                        onClick={() => deleteDraft(draft.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Outcome;
