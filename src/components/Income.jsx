import React, { useState, useEffect } from 'react';
import { PackagePlus, Search, FolderPlus, Trash2, Camera, Scan, Eye, EyeOff, Calendar, Package, Hash, AlertTriangle } from 'lucide-react';
import { collection, addDoc, updateDoc, doc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';
import BarcodeScanner from './BarcodeScanner';

const Income = ({ products, categories, onAddProduct, onUpdateProduct, onAddTransaction, onAddCategory, onDeleteCategory, currentUser, isAdmin, companyData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showCostPrices, setShowCostPrices] = useState(false);
  const [barcodeHistory, setBarcodeHistory] = useState([]);
  const [foundBarcodeProduct, setFoundBarcodeProduct] = useState(null);
  const [newProduct, setNewProduct] = useState({
    name: '',
    category: '',
    costPrice: '',
    sellingPrice: '',
    barcode: '',
    additionalBarcodes: [],
    quantity: '',
    packSize: '1', // Pachkada nechta
    unit: 'dona', // dona, pachka, kg, litr
    expirationDate: '', // Amal qilish muddati
    color: '',
    minStock: '5' // Minimal qoldiq (ogohlantirish uchun)
  });
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [newBarcode, setNewBarcode] = useState('');

  // Barcode tarixini yuklash
  useEffect(() => {
    loadBarcodeHistory();
  }, [currentUser?.companyId]);

  const loadBarcodeHistory = async () => {
    if (!currentUser?.companyId) return;
    try {
      const q = query(
        collection(db, 'barcodes'),
        where('companyId', '==', currentUser.companyId)
      );
      const snapshot = await getDocs(q);
      setBarcodeHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Barcode tarixi yuklanmadi:', error);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.barcode?.includes(searchTerm) ||
    p.additionalBarcodes?.some(b => b.includes(searchTerm))
  );

  const handleBarcodeScan = async (barcode) => {
    setSearchTerm(barcode);
    
    // Avval mavjud mahsulotlardan qidirish
    const product = products.find(p => 
      p.barcode === barcode || p.additionalBarcodes?.includes(barcode)
    );
    
    if (product) {
      addToCart(product);
      toast.success(`${product.name} topildi va savatga qo'shildi!`);
      return;
    }
    
    // Barcode tarixidan qidirish (tugagan mahsulotlar)
    const historyItem = barcodeHistory.find(h => 
      h.barcode === barcode || h.additionalBarcodes?.includes(barcode)
    );
    
    if (historyItem) {
      // Oldingi mahsulot ma'lumotlarini formga yuklash
      setFoundBarcodeProduct(historyItem);
      setNewProduct({
        ...newProduct,
        name: historyItem.productName || '',
        category: historyItem.category || '',
        packSize: historyItem.packSize || '1',
        unit: historyItem.unit || 'dona',
        barcode: barcode,
        costPrice: '',
        sellingPrice: '',
        quantity: '',
        expirationDate: '',
        color: ''
      });
      setShowAddProduct(true);
      toast.info(`"${historyItem.productName}" - oldingi ma'lumotlar yuklandi!`);
      return;
    }
    
    // Yangi mahsulot
    setNewProduct({ ...newProduct, barcode });
    setShowAddProduct(true);
    toast.warning(`Barcode: ${barcode} - Yangi mahsulot qo'shing!`);
  };

  const addToCart = (product) => {
    const existing = selectedItems.find(item => item.id === product.id);
    if (existing) {
      setSelectedItems(selectedItems.map(item =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setSelectedItems([...selectedItems, { ...product, quantity: 1 }]);
    }
  };

  const updateQuantity = (id, quantity) => {
    if (quantity <= 0) {
      setSelectedItems(selectedItems.filter(item => item.id !== id));
    } else {
      setSelectedItems(selectedItems.map(item =>
        item.id === id ? { ...item, quantity } : item
      ));
    }
  };

  const handleSubmit = async () => {
    if (selectedItems.length === 0) {
      toast.warning('Mahsulot tanlang!');
      return;
    }

    setSaving(true);

    try {
      for (const item of selectedItems) {
        const product = products.find(p => p.id === item.id);
        const newQuantity = product.quantity + item.quantity;

        await updateDoc(doc(db, 'products', item.id), { quantity: newQuantity });
        onUpdateProduct({ ...product, quantity: newQuantity });

        const transactionData = {
          productId: item.id,
          productName: item.name,
          type: 'kirim',
          quantity: item.quantity,
          costPrice: item.costPrice || 0,
          sellingPrice: item.sellingPrice || item.price,
          price: item.sellingPrice || item.price,
          companyId: currentUser.companyId,
          createdBy: currentUser.id,
          date: new Date()
        };

        const docRef = await addDoc(collection(db, 'transactions'), transactionData);
        onAddTransaction({ id: docRef.id, ...transactionData });
      }

      setSelectedItems([]);
      toast.success('Kirim muvaffaqiyatli qilindi!');
    } catch (error) {
      console.error('Xato:', error);
      toast.error('Xatolik yuz berdi!');
    }
    setSaving(false);
  };

  // Tarif limitini tekshirish
  const checkProductLimit = () => {
    const maxProducts = companyData?.maxProducts || 50; // Trial default: 50
    if (products.length >= maxProducts) {
      toast.error(
        <div>
          <strong>Tarif limiti!</strong>
          <p>Siz {maxProducts} ta mahsulot qo'sha olasiz.</p>
          <p>Tarifni yangilang!</p>
        </div>
      );
      return false;
    }
    return true;
  };

  const addNewProduct = async () => {
    if (!newProduct.name || !newProduct.category || !newProduct.sellingPrice) {
      toast.error('Majburiy maydonlarni to\'ldiring!');
      return;
    }

    // Tarif limitini tekshirish
    if (!checkProductLimit()) {
      return;
    }

    setSaving(true);

    try {
      const productData = {
        name: newProduct.name,
        category: newProduct.category,
        costPrice: parseFloat(newProduct.costPrice) || 0,
        sellingPrice: parseFloat(newProduct.sellingPrice),
        price: parseFloat(newProduct.sellingPrice),
        barcode: newProduct.barcode,
        additionalBarcodes: newProduct.additionalBarcodes || [],
        quantity: parseInt(newProduct.quantity) || 0,
        packSize: parseInt(newProduct.packSize) || 1,
        unit: newProduct.unit || 'dona',
        expirationDate: newProduct.expirationDate || null,
        color: newProduct.color || '',
        minStock: parseInt(newProduct.minStock) || 5,
        companyId: currentUser.companyId,
        createdAt: new Date()
      };

      const docRef = await addDoc(collection(db, 'products'), productData);
      onAddProduct({ id: docRef.id, ...productData });

      // Barcode tarixiga saqlash (keyinchalik eslab qolish uchun)
      if (newProduct.barcode) {
        await addDoc(collection(db, 'barcodes'), {
          barcode: newProduct.barcode,
          additionalBarcodes: newProduct.additionalBarcodes || [],
          productName: newProduct.name,
          category: newProduct.category,
          packSize: parseInt(newProduct.packSize) || 1,
          unit: newProduct.unit || 'dona',
          companyId: currentUser.companyId,
          createdAt: new Date()
        });
        loadBarcodeHistory(); // Tarixni yangilash
      }

      setNewProduct({ 
        name: '', category: '', costPrice: '', sellingPrice: '', 
        barcode: '', additionalBarcodes: [], quantity: '', 
        packSize: '1', unit: 'dona', expirationDate: '', color: '', minStock: '5' 
      });
      setFoundBarcodeProduct(null);
      setShowAddProduct(false);
      toast.success('Mahsulot qo\'shildi!');
    } catch (error) {
      console.error('Xato:', error);
      toast.error('Xatolik yuz berdi!');
    }
    setSaving(false);
  };

  const addNewCategory = async () => {
    if (!newCategory.trim()) {
      toast.error('Kategoriya nomini kiriting!');
      return;
    }

    if (categories.some(c => c.name.toLowerCase() === newCategory.trim().toLowerCase())) {
      toast.error('Bu kategoriya allaqachon mavjud!');
      return;
    }

    setSaving(true);
    try {
      const categoryData = {
        name: newCategory.trim(),
        companyId: currentUser.companyId,
        createdAt: new Date()
      };

      const docRef = await addDoc(collection(db, 'categories'), categoryData);
      onAddCategory({ id: docRef.id, ...categoryData });

      setNewCategory('');
      toast.success('Kategoriya qo\'shildi!');
    } catch (error) {
      console.error('Xato:', error);
      toast.error('Xatolik yuz berdi!');
    }
    setSaving(false);
  };

  const removeCategoryHandler = async (categoryId) => {
    if (window.confirm('Kategoriyani o\'chirmoqchimisiz?')) {
      try {
        await deleteDoc(doc(db, 'categories', categoryId));
        onDeleteCategory(categoryId);
        toast.success('Kategoriya o\'chirildi!');
      } catch (error) {
        console.error('Xato:', error);
        toast.error('Xatolik yuz berdi!');
      }
    }
  };

  // Foyda hisoblash
  const calculateProfit = (costPrice, sellingPrice) => {
    if (!costPrice || !sellingPrice) return { amount: 0, percent: 0 };
    const amount = sellingPrice - costPrice;
    const percent = ((amount / costPrice) * 100).toFixed(1);
    return { amount, percent };
  };

  const totalAmount = selectedItems.reduce((sum, item) => sum + (item.quantity * (item.sellingPrice || item.price)), 0);

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Kirim qilish</h2>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowCostPrices(!showCostPrices)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                showCostPrices 
                  ? 'bg-amber-100 text-amber-700 border border-amber-300' 
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              {showCostPrices ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="hidden sm:inline">Tannarx</span>
            </button>
          )}
          <button
            onClick={() => setShowAddCategory(!showAddCategory)}
            className="flex items-center gap-2 px-4 py-2 text-white bg-violet-600 rounded-xl hover:bg-violet-700 active:scale-95 transition-all"
          >
            <FolderPlus className="w-5 h-5" />
            <span className="hidden sm:inline">Kategoriya</span>
          </button>
          <button
            onClick={() => setShowAddProduct(!showAddProduct)}
            className="flex items-center gap-2 px-4 py-2 text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 active:scale-95 transition-all"
          >
            <PackagePlus className="w-5 h-5" />
            <span className="hidden sm:inline">Mahsulot</span>
          </button>
        </div>
      </div>

      {/* Kategoriya qo'shish */}
      {showAddCategory && (
        <div className="p-4 mb-6 border border-violet-200 rounded-2xl bg-violet-50">
          <h3 className="mb-3 font-bold text-violet-900">Yangi kategoriya</h3>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Kategoriya nomi"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addNewCategory()}
              className="flex-1 px-4 py-2 border border-violet-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
            <button
              onClick={addNewCategory}
              disabled={saving}
              className="px-6 py-2 text-white bg-violet-600 rounded-xl hover:bg-violet-700 disabled:opacity-50"
            >
              Qo'shish
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-violet-200 rounded-lg">
                <span className="text-sm font-medium">{cat.name}</span>
                <button onClick={() => removeCategoryHandler(cat.id)} className="text-rose-500 hover:text-rose-700">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mahsulot qo'shish */}
      {showAddProduct && (
        <div className="p-4 mb-6 border border-emerald-200 rounded-2xl bg-emerald-50">
          <h3 className="mb-4 font-bold text-emerald-900 flex items-center gap-2">
            <PackagePlus className="w-5 h-5" />
            {foundBarcodeProduct ? `"${foundBarcodeProduct.productName}" qayta qo'shish` : 'Yangi mahsulot qo\'shish'}
          </h3>
          
          {foundBarcodeProduct && (
            <div className="mb-4 p-3 bg-blue-100 border border-blue-300 rounded-xl">
              <p className="text-sm text-blue-800">
                ℹ️ Bu barcode avval "{foundBarcodeProduct.productName}" uchun ishlatilgan. Ma'lumotlar avtomatik yuklandi.
              </p>
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Asosiy ma'lumotlar */}
            <input
              type="text"
              placeholder="Mahsulot nomi *"
              value={newProduct.name}
              onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
              className="px-4 py-2.5 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <select
              value={newProduct.category}
              onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
              className="px-4 py-2.5 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="">Kategoriya *</option>
              {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
            </select>
            
            {/* Barcode */}
            <div className="relative">
              <input
                type="text"
                placeholder="Barcode"
                value={newProduct.barcode}
                onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value })}
                className="w-full px-4 py-2.5 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            
            {/* Narxlar */}
            {isAdmin && (
              <input
                type="number"
                placeholder="Tannarx (kelish narxi)"
                value={newProduct.costPrice}
                onChange={(e) => setNewProduct({ ...newProduct, costPrice: e.target.value })}
                className="px-4 py-2.5 border border-amber-200 bg-amber-50 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            )}
            <input
              type="number"
              placeholder="Sotuv narxi *"
              value={newProduct.sellingPrice}
              onChange={(e) => setNewProduct({ ...newProduct, sellingPrice: e.target.value })}
              className="px-4 py-2.5 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            
            {/* Miqdor va birlik */}
            <input
              type="number"
              placeholder="Boshlang'ich miqdor"
              value={newProduct.quantity}
              onChange={(e) => setNewProduct({ ...newProduct, quantity: e.target.value })}
              className="px-4 py-2.5 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            
            {/* Pachka/dona */}
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Pachkada"
                value={newProduct.packSize}
                onChange={(e) => setNewProduct({ ...newProduct, packSize: e.target.value })}
                className="w-24 px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                title="Pachkada nechta dona"
              />
              <select
                value={newProduct.unit}
                onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
              >
                <option value="dona">Dona</option>
                <option value="pachka">Pachka</option>
                <option value="kg">Kilogram</option>
                <option value="litr">Litr</option>
                <option value="metr">Metr</option>
                <option value="quti">Quti</option>
              </select>
            </div>
            
            {/* Amal qilish muddati */}
            <div className="relative">
              <label className="absolute -top-2 left-3 px-1 bg-emerald-50 text-xs text-slate-500">Amal qilish muddati</label>
              <input
                type="date"
                value={newProduct.expirationDate}
                onChange={(e) => setNewProduct({ ...newProduct, expirationDate: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            
            {/* Rang */}
            <input
              type="text"
              placeholder="Rang (ixtiyoriy)"
              value={newProduct.color}
              onChange={(e) => setNewProduct({ ...newProduct, color: e.target.value })}
              className="px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            
            {/* Minimal qoldiq */}
            <div className="relative">
              <label className="absolute -top-2 left-3 px-1 bg-emerald-50 text-xs text-slate-500">Min. qoldiq (ogohlantirish)</label>
              <input
                type="number"
                value={newProduct.minStock}
                onChange={(e) => setNewProduct({ ...newProduct, minStock: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {/* Qo'shimcha barcode */}
          <div className="mt-4 p-3 bg-slate-100 rounded-xl">
            <p className="text-sm text-slate-600 mb-2 flex items-center gap-1">
              <Hash className="w-4 h-4" />
              Qo'shimcha barcode (agar boshqa barcode ham bo'lsa)
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Qo'shimcha barcode"
                value={newBarcode}
                onChange={(e) => setNewBarcode(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  if (newBarcode && !newProduct.additionalBarcodes.includes(newBarcode)) {
                    setNewProduct({
                      ...newProduct,
                      additionalBarcodes: [...newProduct.additionalBarcodes, newBarcode]
                    });
                    setNewBarcode('');
                  }
                }}
                className="px-3 py-2 bg-slate-600 text-white rounded-lg text-sm hover:bg-slate-700"
              >
                Qo'shish
              </button>
            </div>
            {newProduct.additionalBarcodes?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {newProduct.additionalBarcodes.map((bc, idx) => (
                  <span key={idx} className="px-2 py-1 bg-white rounded text-xs flex items-center gap-1">
                    {bc}
                    <button 
                      onClick={() => setNewProduct({
                        ...newProduct,
                        additionalBarcodes: newProduct.additionalBarcodes.filter((_, i) => i !== idx)
                      })}
                      className="text-rose-500 hover:text-rose-700"
                    >×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
          
          {/* Foyda hisoblash preview */}
          {isAdmin && newProduct.costPrice && newProduct.sellingPrice && (
            <div className="mt-4 p-3 bg-amber-100 border border-amber-300 rounded-xl">
              <p className="text-sm text-amber-800">
                <span className="font-medium">Foyda: </span>
                {calculateProfit(parseFloat(newProduct.costPrice), parseFloat(newProduct.sellingPrice)).amount.toLocaleString()} so'm 
                <span className="ml-2 text-amber-600">
                  ({calculateProfit(parseFloat(newProduct.costPrice), parseFloat(newProduct.sellingPrice)).percent}%)
                </span>
              </p>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <button
              onClick={addNewProduct}
              disabled={saving}
              className="px-6 py-2.5 text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 active:scale-95 transition-all"
            >
              {saving ? 'Saqlanmoqda...' : 'Qo\'shish'}
            </button>
            <button
              onClick={() => {
                setShowAddProduct(false);
                setFoundBarcodeProduct(null);
                setNewProduct({ 
                  name: '', category: '', costPrice: '', sellingPrice: '', 
                  barcode: '', additionalBarcodes: [], quantity: '', 
                  packSize: '1', unit: 'dona', expirationDate: '', color: '', minStock: '5' 
                });
              }}
              className="px-6 py-2.5 text-slate-600 bg-slate-200 rounded-xl hover:bg-slate-300"
            >
              Bekor qilish
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mahsulotlar ro'yxati */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 lg:p-6">
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Scan className="absolute w-5 h-5 text-slate-400 left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Barcode yoki mahsulot qidirish..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && searchTerm) {
                    const product = products.find(p => p.barcode === searchTerm);
                    if (product) handleBarcodeScan(searchTerm);
                  }
                }}
                className="w-full py-2.5 pl-10 pr-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowScanner(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-white bg-cyan-600 rounded-xl hover:bg-cyan-700 active:scale-95 transition-all"
            >
              <Camera className="w-5 h-5" />
              <span className="hidden sm:inline">Kamera</span>
            </button>
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[400px]">
            {filteredProducts.length === 0 ? (
              <p className="py-8 text-center text-slate-500">Mahsulot topilmadi</p>
            ) : (
              filteredProducts.map(product => (
                <div
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="flex items-center justify-between p-4 border border-slate-100 rounded-xl cursor-pointer hover:bg-emerald-50 hover:border-emerald-200 transition-all active:scale-[0.99]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{product.name}</p>
                    <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                      <span className="px-2 py-0.5 bg-slate-100 rounded-md text-xs">{product.category}</span>
                      {product.barcode && <span className="font-mono text-xs">{product.barcode}</span>}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-bold text-slate-800">{(product.sellingPrice || product.price)?.toLocaleString()} so'm</p>
                    {isAdmin && showCostPrices && product.costPrice && (
                      <p className="text-xs text-amber-600">Tannarx: {product.costPrice.toLocaleString()}</p>
                    )}
                    <p className="text-sm text-slate-500">Omborda: {product.quantity}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Savat */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 lg:p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Tanlangan mahsulotlar</h3>
          
          <div className="space-y-2 overflow-y-auto max-h-64 mb-4">
            {selectedItems.length === 0 ? (
              <p className="py-8 text-sm text-center text-slate-500">Bo'sh</p>
            ) : (
              selectedItems.map(item => (
                <div key={item.id} className="p-3 border border-slate-100 rounded-xl">
                  <p className="text-sm font-medium text-slate-800 truncate mb-2">{item.name}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-lg hover:bg-slate-200 active:scale-95"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 0)}
                        className="w-14 px-2 py-1 text-center border border-slate-200 rounded-lg"
                      />
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-lg hover:bg-slate-200 active:scale-95"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-sm font-bold text-slate-800">
                      {(item.quantity * (item.sellingPrice || item.price)).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-4 space-y-2 border-t border-slate-200">
            <div className="flex justify-between text-lg font-bold">
              <span>Jami:</span>
              <span className="text-emerald-600">{totalAmount.toLocaleString()} so'm</span>
            </div>
            <button
              onClick={handleSubmit}
              disabled={selectedItems.length === 0 || saving}
              className="w-full py-3 font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
            >
              {saving ? 'Saqlanmoqda...' : 'Kirim qilish'}
            </button>
          </div>
        </div>
      </div>

      {showScanner && (
        <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setShowScanner(false)} />
      )}
    </div>
  );
};

export default Income;
