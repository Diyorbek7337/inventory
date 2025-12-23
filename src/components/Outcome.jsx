import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, User, ShoppingCart, Minus, Plus, Trash2, 
  CreditCard, Banknote, Clock, Check, X, Camera, 
  Scan, Package, Calculator, Percent, Box
} from 'lucide-react';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';
import BarcodeScanner from './BarcodeScanner';

const Outcome = ({ products, onUpdateProduct, onAddTransaction, currentUser, isAdmin }) => {
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
  const searchInputRef = useRef(null);

  // Barcode scan uchun auto-focus
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Mahsulotlar filtrlash
  const filteredProducts = products.filter(p =>
    (p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.barcode?.includes(searchTerm) ||
    p.additionalBarcodes?.some(b => b.includes(searchTerm))) &&
    p.quantity > 0
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

  // Savatga qo'shish (pachka yoki dona)
  const addToCart = (product, sellType = 'dona') => {
    const packSize = product.packSize || 1;
    const quantityToAdd = sellType === 'pachka' ? packSize : 1;
    
    const existing = selectedItems.find(item => item.id === product.id && item.sellType === sellType);
    
    if (existing) {
      const newQty = existing.quantity + quantityToAdd;
      if (newQty <= product.quantity) {
        setSelectedItems(selectedItems.map(item =>
          (item.id === product.id && item.sellType === sellType) 
            ? { ...item, quantity: newQty } 
            : item
        ));
      } else {
        toast.warning(`Omborda faqat ${product.quantity} ta bor!`);
      }
    } else {
      // Narxni hisoblash
      const unitPrice = product.sellingPrice || product.price;
      const packPrice = unitPrice * packSize;
      
      setSelectedItems([...selectedItems, { 
        ...product, 
        quantity: quantityToAdd,
        sellType: sellType,
        packSize: packSize,
        unitPrice: sellType === 'pachka' ? packPrice : unitPrice,
        originalUnitPrice: unitPrice
      }]);
    }
  };

  // Miqdorni o'zgartirish
  const updateQuantity = (id, sellType, newQuantity) => {
    const product = products.find(p => p.id === id);
    if (newQuantity <= 0) {
      setSelectedItems(selectedItems.filter(item => !(item.id === id && item.sellType === sellType)));
    } else if (newQuantity <= product.quantity) {
      setSelectedItems(selectedItems.map(item =>
        (item.id === id && item.sellType === sellType) ? { ...item, quantity: newQuantity } : item
      ));
    } else {
      toast.warning(`Omborda faqat ${product.quantity} ta bor!`);
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
    const newUnitPrice = newSellType === 'pachka' 
      ? (item.originalUnitPrice * packSize) 
      : item.originalUnitPrice;
    
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

  // Narxni o'zgartirish (chegirma berish)
  const updatePrice = (id, newPrice) => {
    setSelectedItems(selectedItems.map(item =>
      item.id === id ? { ...item, unitPrice: parseFloat(newPrice) || 0 } : item
    ));
  };

  // Hisob-kitoblar
  const subtotal = selectedItems.reduce((sum, item) => 
    sum + (item.quantity * (item.originalUnitPrice || item.unitPrice)), 0
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
        const product = products.find(p => p.id === item.id);
        const newQuantity = product.quantity - item.quantity;

        // Ombor yangilash
        await updateDoc(doc(db, 'products', item.id), {
          quantity: newQuantity
        });
        onUpdateProduct({ ...product, quantity: newQuantity });

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
          totalAmount: item.quantity * item.unitPrice,
          paidAmount: paymentType === 'qarz' ? paid : item.quantity * item.unitPrice,
          debt: paymentType === 'qarz' ? (item.quantity * item.unitPrice) * (remaining / totalAmount) : 0,
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

      searchInputRef.current?.focus();
    } catch (error) {
      console.error('Xato:', error);
      toast.update(loadingToast, {
        render: '❌ Xatolik yuz berdi!',
        type: 'error',
        isLoading: false,
        autoClose: 3000
      });
    }
    setSaving(false);
  };

  // Tez to'lov tugmalari
  const quickPayments = [1000, 5000, 10000, 50000, 100000];

  return (
    <div className="h-[calc(100vh-64px)] lg:h-screen flex flex-col bg-slate-100">
      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* LEFT SIDE - To'lov va Savatcha */}
        <div className="lg:w-[400px] xl:w-[450px] flex flex-col border-r border-slate-200 bg-white order-2 lg:order-1">
          
          {/* To'lov turi */}
          <div className="p-4 border-b border-slate-200">
            <div className="grid grid-cols-3 gap-2">
              {[
                { type: 'naqd', label: 'Naqd', icon: Banknote, color: 'emerald' },
                { type: 'karta', label: 'Karta', icon: CreditCard, color: 'blue' },
                { type: 'qarz', label: 'Qarz', icon: Clock, color: 'rose' }
              ].map(({ type, label, icon: Icon, color }) => (
                <button
                  key={type}
                  onClick={() => {
                    setPaymentType(type);
                    if (type !== 'qarz') {
                      setPaidAmount(totalAmount.toString());
                    } else {
                      setPaidAmount('0');
                    }
                  }}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl font-medium transition-all active:scale-95 ${
                    paymentType === type
                      ? type === 'naqd' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25' :
                        type === 'karta' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25' :
                        'bg-rose-500 text-white shadow-lg shadow-rose-500/25'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Mijoz ma'lumotlari (qarz uchun) */}
          {paymentType === 'qarz' && (
            <div className="p-4 bg-rose-50 border-b border-rose-100 space-y-3">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-400" />
                <input
                  type="text"
                  placeholder="Mijoz ismi *"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border-2 border-rose-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                />
              </div>
              <input
                type="tel"
                placeholder="Telefon raqami"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-rose-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
              />
            </div>
          )}

          {/* Savatcha */}
          <div className="flex-1 overflow-y-auto p-4">
            {selectedItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <ShoppingCart className="w-16 h-16 mb-4 opacity-50" />
                <p className="font-medium">Savatcha bo'sh</p>
                <p className="text-sm">Mahsulot qo'shing</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedItems.map(item => (
                  <div key={`${item.id}-${item.sellType}`} className="p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate">{item.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-sm text-slate-500">
                            {item.unitPrice.toLocaleString()} × {item.quantity}
                          </p>
                          {/* Pachka/Dona ko'rsatkichi */}
                          {item.packSize > 1 && (
                            <span className={`px-1.5 py-0.5 text-xs rounded font-medium ${
                              item.sellType === 'pachka' 
                                ? 'bg-violet-100 text-violet-700' 
                                : 'bg-slate-200 text-slate-600'
                            }`}>
                              {item.sellType === 'pachka' ? `${item.packSize}li pachka` : 'dona'}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedItems(selectedItems.filter(i => 
                          !(i.id === item.id && i.sellType === item.sellType)
                        ))}
                        className="p-1 text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between gap-2">
                      {/* Pachka/Dona almashtirish */}
                      {item.packSize > 1 && (
                        <button
                          onClick={() => toggleSellType(item.id, item.sellType)}
                          className={`px-2 py-1 text-xs rounded-lg font-medium transition-all ${
                            item.sellType === 'pachka'
                              ? 'bg-violet-500 text-white'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                        >
                          <Box className="w-3 h-3 inline mr-1" />
                          {item.sellType === 'pachka' ? 'Pachka' : 'Dona'}
                        </button>
                      )}
                      
                      {/* Miqdor */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQuantity(item.id, item.sellType, item.quantity - (item.sellType === 'pachka' ? item.packSize : 1))}
                          className="w-8 h-8 flex items-center justify-center bg-slate-200 rounded-lg hover:bg-slate-300 active:scale-95"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.id, item.sellType, parseInt(e.target.value) || 0)}
                          className="w-12 h-8 text-center border rounded-lg text-sm"
                        />
                        <button
                          onClick={() => updateQuantity(item.id, item.sellType, item.quantity + (item.sellType === 'pachka' ? item.packSize : 1))}
                          className="w-8 h-8 flex items-center justify-center bg-slate-200 rounded-lg hover:bg-slate-300 active:scale-95"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {/* Summa */}
                      <p className="font-bold text-slate-800">
                        {(item.quantity * (item.originalUnitPrice || item.unitPrice)).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Hisob-kitob */}
          <div className="p-4 border-t border-slate-200 bg-slate-50">
            {/* Chegirma */}
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  placeholder="Chegirma"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border rounded-xl text-sm"
                />
              </div>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value)}
                className="px-3 py-2 border rounded-xl text-sm bg-white"
              >
                <option value="percent">%</option>
                <option value="fixed">so'm</option>
              </select>
            </div>

            {/* To'lov summasi */}
            {paymentType === 'qarz' && (
              <div className="mb-3">
                <label className="text-xs text-slate-500 mb-1 block">Oldindan to'lov</label>
                <input
                  type="number"
                  placeholder="0"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl text-lg font-bold"
                />
                <div className="flex gap-1 mt-2 overflow-x-auto">
                  {quickPayments.map(amount => (
                    <button
                      key={amount}
                      onClick={() => setPaidAmount((paid + amount).toString())}
                      className="px-2 py-1 bg-slate-200 rounded-lg text-xs font-medium hover:bg-slate-300 whitespace-nowrap"
                    >
                      +{amount >= 1000 ? `${amount/1000}k` : amount}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Summalar */}
            <div className="space-y-1 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-slate-500">Jami:</span>
                <span className="font-medium">{subtotal.toLocaleString()}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Chegirma:</span>
                  <span>-{discountAmount.toLocaleString()}</span>
                </div>
              )}
              {paymentType === 'qarz' && paid > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>To'landi:</span>
                  <span>{paid.toLocaleString()}</span>
                </div>
              )}
              {paymentType === 'qarz' && remaining > 0 && (
                <div className="flex justify-between text-rose-600 font-bold">
                  <span>Qarz:</span>
                  <span>{remaining.toLocaleString()}</span>
                </div>
              )}
              {isAdmin && totalProfit > 0 && (
                <div className="flex justify-between text-amber-600 pt-1 border-t border-dashed">
                  <span>Foyda:</span>
                  <span>+{totalProfit.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Jami va Sotish */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-xs text-slate-500">Jami to'lov</p>
                <p className="text-2xl font-bold text-slate-800">{totalAmount.toLocaleString()}</p>
              </div>
              <button
                onClick={handleSubmit}
                disabled={selectedItems.length === 0 || saving}
                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all shadow-lg shadow-emerald-500/25"
              >
                {saving ? '...' : 'Sotish'}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE - Barcode va Mahsulotlar */}
        <div className="flex-1 flex flex-col overflow-hidden order-1 lg:order-2">
          
          {/* Barcode input */}
          <div className="p-4 bg-white border-b border-slate-200">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Scan className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Barcode skanerlang yoki mahsulot qidiring..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && searchTerm) {
                      const product = products.find(p => p.barcode === searchTerm);
                      if (product) {
                        handleBarcodeScan(searchTerm);
                      }
                    }
                  }}
                  className="w-full pl-12 pr-4 py-3 border-2 border-slate-200 rounded-xl text-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  autoComplete="off"
                />
              </div>
              <button
                onClick={() => setShowScanner(true)}
                className="px-4 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 active:scale-95 transition-all"
              >
                <Camera className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Mahsulotlar ro'yhati */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Package className="w-16 h-16 mb-4 opacity-50" />
                <p className="font-medium">Mahsulot topilmadi</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredProducts.map(product => {
                  const inCart = selectedItems.find(i => i.id === product.id);
                  const hasPackSize = (product.packSize || 1) > 1;
                  
                  return (
                    <div
                      key={product.id}
                      className={`relative p-3 bg-white rounded-xl border-2 text-left transition-all ${
                        inCart 
                          ? 'border-emerald-500 ring-2 ring-emerald-100' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {inCart && (
                        <span className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                          {selectedItems.filter(i => i.id === product.id).reduce((sum, i) => sum + i.quantity, 0)}
                        </span>
                      )}
                      <p className="font-medium text-slate-800 text-sm truncate mb-1">
                        {product.name}
                      </p>
                      <p className="text-lg font-bold text-emerald-600">
                        {(product.sellingPrice || product.price)?.toLocaleString()}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <p className={`text-xs ${
                          product.quantity < 5 ? 'text-rose-500' : 'text-slate-400'
                        }`}>
                          Qoldi: {product.quantity}
                        </p>
                        {hasPackSize && (
                          <span className="text-xs text-violet-600 font-medium">
                            {product.packSize}li
                          </span>
                        )}
                      </div>
                      
                      {/* Sotish tugmalari */}
                      <div className="flex gap-1 mt-2">
                        <button
                          onClick={() => addToCart(product, 'dona')}
                          className="flex-1 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-lg hover:bg-emerald-200 active:scale-95 transition-all"
                        >
                          +1 dona
                        </button>
                        {hasPackSize && (
                          <button
                            onClick={() => addToCart(product, 'pachka')}
                            className="flex-1 py-1.5 bg-violet-100 text-violet-700 text-xs font-medium rounded-lg hover:bg-violet-200 active:scale-95 transition-all"
                          >
                            +1 pachka
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
    </div>
  );
};

export default Outcome;
