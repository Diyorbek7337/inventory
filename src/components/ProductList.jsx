import React, { useState, useMemo } from 'react';
import { Search, Trash2, Edit, Package, FolderPlus, Camera, Scan, Eye, EyeOff, ArrowUpDown, ArrowUp, ArrowDown, Filter, AlertTriangle, Calendar } from 'lucide-react';
import { deleteDoc, doc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';
import BarcodeScanner from './BarcodeScanner';

const ProductList = ({ products, categories, onDeleteProduct, onUpdateProduct, onAddCategory, onDeleteCategory, isAdmin, currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showCostPrices, setShowCostPrices] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Sorting state
  const [sortField, setSortField] = useState('name'); // name, quantity, price, totalValue, expiration
  const [sortOrder, setSortOrder] = useState('asc'); // asc, desc
  
  // Stock filter
  const [stockFilter, setStockFilter] = useState('all'); // all, low, out, expiring

  const allCategories = ['Barchasi', ...categories.map(c => c.name)];

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    let result = products.filter(p => {
      const matchesSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           p.barcode?.includes(searchTerm) ||
                           p.additionalBarcodes?.some(b => b.includes(searchTerm));
      const matchesCategory = !categoryFilter || categoryFilter === 'Barchasi' || p.category === categoryFilter;
      
      // Stock filter
      let matchesStock = true;
      if (stockFilter === 'low') {
        matchesStock = p.quantity <= (p.minStock || 5) && p.quantity > 0;
      } else if (stockFilter === 'out') {
        matchesStock = p.quantity <= 0;
      } else if (stockFilter === 'expiring') {
        if (p.expirationDate) {
          const expDate = new Date(p.expirationDate);
          const daysLeft = Math.ceil((expDate - new Date()) / (1000 * 60 * 60 * 24));
          matchesStock = daysLeft <= 30 && daysLeft > 0;
        } else {
          matchesStock = false;
        }
      }
      
      return matchesSearch && matchesCategory && matchesStock;
    });
    
    // Sorting
    result.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortField) {
        case 'name':
          aVal = a.name?.toLowerCase() || '';
          bVal = b.name?.toLowerCase() || '';
          break;
        case 'quantity':
          aVal = a.quantity || 0;
          bVal = b.quantity || 0;
          break;
        case 'price':
          aVal = a.sellingPrice || a.price || 0;
          bVal = b.sellingPrice || b.price || 0;
          break;
        case 'totalValue':
          aVal = (a.quantity || 0) * (a.sellingPrice || a.price || 0);
          bVal = (b.quantity || 0) * (b.sellingPrice || b.price || 0);
          break;
        case 'expiration':
          aVal = a.expirationDate ? new Date(a.expirationDate).getTime() : Infinity;
          bVal = b.expirationDate ? new Date(b.expirationDate).getTime() : Infinity;
          break;
        default:
          aVal = a.name?.toLowerCase() || '';
          bVal = b.name?.toLowerCase() || '';
      }
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });
    
    return result;
  }, [products, searchTerm, categoryFilter, stockFilter, sortField, sortOrder]);

  // Statistics
  const stats = useMemo(() => {
    const lowStock = products.filter(p => p.quantity <= (p.minStock || 5) && p.quantity > 0).length;
    const outOfStock = products.filter(p => p.quantity <= 0).length;
    const expiringSoon = products.filter(p => {
      if (!p.expirationDate) return false;
      const daysLeft = Math.ceil((new Date(p.expirationDate) - new Date()) / (1000 * 60 * 60 * 24));
      return daysLeft <= 30 && daysLeft > 0;
    }).length;
    
    return { lowStock, outOfStock, expiringSoon };
  }, [products]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 text-slate-300" />;
    return sortOrder === 'asc' 
      ? <ArrowUp className="w-4 h-4 text-emerald-500" />
      : <ArrowDown className="w-4 h-4 text-emerald-500" />;
  };

  // Check if product is expiring soon
  const getExpirationStatus = (expirationDate) => {
    if (!expirationDate) return null;
    const daysLeft = Math.ceil((new Date(expirationDate) - new Date()) / (1000 * 60 * 60 * 24));
    
    if (daysLeft < 0) return { status: 'expired', text: 'Muddati o\'tgan!', color: 'bg-rose-100 text-rose-700' };
    if (daysLeft <= 7) return { status: 'critical', text: `${daysLeft} kun qoldi`, color: 'bg-rose-100 text-rose-700' };
    if (daysLeft <= 30) return { status: 'warning', text: `${daysLeft} kun qoldi`, color: 'bg-amber-100 text-amber-700' };
    return { status: 'ok', text: new Date(expirationDate).toLocaleDateString('uz-UZ'), color: 'bg-slate-100 text-slate-600' };
  };

  const handleBarcodeScan = (barcode) => {
    setSearchTerm(barcode);
    const product = products.find(p => p.barcode === barcode);
    if (product) {
      toast.success(`${product.name} topildi!`);
      setTimeout(() => {
        const element = document.getElementById(`product-${product.id}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-2', 'ring-emerald-500');
          setTimeout(() => element.classList.remove('ring-2', 'ring-emerald-500'), 2000);
        }
      }, 100);
    } else {
      toast.warning(`Barcode: ${barcode} - Mahsulot topilmadi!`);
    }
  };

  const deleteProduct = async (id) => {
    if (window.confirm('Mahsulotni o\'chirmoqchimisiz?')) {
      try {
        await deleteDoc(doc(db, 'products', id));
        onDeleteProduct(id);
        toast.success('Mahsulot o\'chirildi!');
      } catch (error) {
        console.error('Xato:', error);
        toast.error('Xatolik yuz berdi!');
      }
    }
  };

  const saveEdit = async () => {
    if (!editingProduct.name || !editingProduct.sellingPrice) {
      toast.error('Majburiy maydonlarni to\'ldiring!');
      return;
    }

    setSaving(true);

    try {
      const updatedData = {
        name: editingProduct.name,
        category: editingProduct.category,
        costPrice: parseFloat(editingProduct.costPrice) || 0,
        sellingPrice: parseFloat(editingProduct.sellingPrice),
        price: parseFloat(editingProduct.sellingPrice),
        barcode: editingProduct.barcode,
        quantity: parseInt(editingProduct.quantity)
      };

      await updateDoc(doc(db, 'products', editingProduct.id), updatedData);
      onUpdateProduct({ ...editingProduct, ...updatedData });
      setEditingProduct(null);
      toast.success('Mahsulot yangilandi!');
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
      setShowAddCategory(false);
      toast.success('Kategoriya qo\'shildi!');
    } catch (error) {
      console.error('Xato:', error);
      toast.error('Xatolik yuz berdi!');
    }
    setSaving(false);
  };

  const removeCategoryHandler = async (categoryId) => {
    const categoryName = categories.find(c => c.id === categoryId)?.name;
    const hasProducts = products.some(p => p.category === categoryName);

    if (hasProducts) {
      toast.error('Bu kategoriyada mahsulotlar mavjud! Avval mahsulotlarni o\'zgartiring.');
      return;
    }

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

  const totalValue = products.reduce((sum, p) => sum + (p.quantity * (p.sellingPrice || p.price || 0)), 0);
  const totalCost = products.reduce((sum, p) => sum + (p.quantity * (p.costPrice || 0)), 0);

  // Foyda foizi hisoblash
  const calculateProfitPercent = (costPrice, sellingPrice) => {
    if (!costPrice || !sellingPrice) return 0;
    return (((sellingPrice - costPrice) / costPrice) * 100).toFixed(1);
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Mahsulotlar ro'yxati</h2>
          <p className="mt-1 text-sm text-slate-600">
            Jami qiymat: <span className="font-bold text-emerald-600">{(totalValue / 1000000).toFixed(2)} mln</span>
            {isAdmin && showCostPrices && (
              <span className="ml-4 text-amber-600">
                Tannarx: <span className="font-bold">{(totalCost / 1000000).toFixed(2)} mln</span>
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick stats */}
          <div className="flex gap-2">
            {stats.lowStock > 0 && (
              <button 
                onClick={() => setStockFilter(stockFilter === 'low' ? 'all' : 'low')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  stockFilter === 'low' ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700'
                }`}
              >
                ⚠️ {stats.lowStock} kam
              </button>
            )}
            {stats.outOfStock > 0 && (
              <button 
                onClick={() => setStockFilter(stockFilter === 'out' ? 'all' : 'out')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  stockFilter === 'out' ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-700'
                }`}
              >
                ❌ {stats.outOfStock} tugagan
              </button>
            )}
            {stats.expiringSoon > 0 && (
              <button 
                onClick={() => setStockFilter(stockFilter === 'expiring' ? 'all' : 'expiring')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  stockFilter === 'expiring' ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-700'
                }`}
              >
                📅 {stats.expiringSoon} muddati yaqin
              </button>
            )}
          </div>
          
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
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
              showFilters 
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' 
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filter</span>
          </button>
          <button
            onClick={() => setShowAddCategory(!showAddCategory)}
            className="flex items-center gap-2 px-4 py-2 text-white bg-violet-600 rounded-xl hover:bg-violet-700 active:scale-95 transition-all"
          >
            <FolderPlus className="w-5 h-5" />
            <span className="hidden sm:inline">Kategoriya</span>
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Saralash</label>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                <option value="name">Nomi (A-Z)</option>
                <option value="quantity">Miqdori</option>
                <option value="price">Narxi</option>
                <option value="totalValue">Jami qiymati</option>
                <option value="expiration">Muddat</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Tartib</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                <option value="asc">Kamdan ko'pga ⬆️</option>
                <option value="desc">Ko'pdan kamga ⬇️</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Qoldiq holati</label>
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                <option value="all">Barchasi</option>
                <option value="low">⚠️ Kam qolganlar</option>
                <option value="out">❌ Tugaganlar</option>
                <option value="expiring">📅 Muddati yaqinlar</option>
              </select>
            </div>
            <button
              onClick={() => {
                setSortField('name');
                setSortOrder('asc');
                setStockFilter('all');
                setCategoryFilter('');
              }}
              className="px-3 py-2 text-sm text-slate-600 hover:text-slate-800"
            >
              Tozalash
            </button>
          </div>
        </div>
      )}

      {/* Kategoriya qo'shish */}
      {showAddCategory && (
        <div className="p-4 mb-6 border border-violet-200 rounded-2xl bg-violet-50">
          <h3 className="mb-3 font-bold text-violet-900">Kategoriya boshqaruvi</h3>
          <div className="flex gap-4 mb-4">
            <input
              type="text"
              placeholder="Yangi kategoriya nomi"
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
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => {
              const count = products.filter(p => p.category === cat.name).length;
              return (
                <div key={cat.id} className="flex items-center gap-2 px-3 py-2 bg-white border border-violet-200 rounded-lg">
                  <span className="text-sm font-medium">{cat.name}</span>
                  <span className="text-xs text-slate-500">({count})</span>
                  <button
                    onClick={() => removeCategoryHandler(cat.id)}
                    className="ml-2 text-rose-500 hover:text-rose-700"
                    title={count > 0 ? "Bu kategoriyada mahsulotlar bor" : "O'chirish"}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filtrlar */}
      <div className="p-4 mb-6 bg-white rounded-2xl shadow-sm border border-slate-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Scan className="absolute w-5 h-5 text-slate-400 left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Barcode yoki qidiruv..."
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
              className="flex items-center gap-2 px-4 py-2.5 text-white bg-cyan-600 rounded-xl hover:bg-cyan-700"
            >
              <Camera className="w-5 h-5" />
            </button>
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            {allCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Mahsulotlar - Mobile cards */}
      <div className="lg:hidden space-y-3">
        {filteredProducts.length === 0 ? (
          <div className="py-12 text-center text-slate-500 bg-white rounded-2xl">
            <Package className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p>Mahsulot topilmadi</p>
          </div>
        ) : (
          filteredProducts.map((product, index) => (
            <div
              key={product.id}
              id={`product-${product.id}`}
              className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 truncate">{product.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-md text-xs font-medium">
                      {product.category}
                    </span>
                    {product.barcode && <span className="text-xs text-slate-400 font-mono">{product.barcode}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditingProduct(product)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteProduct(product.id)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {isAdmin && showCostPrices && (
                  <div className="p-2 bg-amber-50 rounded-lg">
                    <p className="text-amber-600 text-xs">Tannarx</p>
                    <p className="font-bold text-amber-700">{(product.costPrice || 0).toLocaleString()}</p>
                  </div>
                )}
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <p className="text-emerald-600 text-xs">Sotuv narxi</p>
                  <p className="font-bold text-emerald-700">{(product.sellingPrice || product.price || 0).toLocaleString()}</p>
                </div>
                {isAdmin && showCostPrices && product.costPrice && (
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <p className="text-slate-600 text-xs">Foyda</p>
                    <p className="font-bold text-slate-700">{calculateProfitPercent(product.costPrice, product.sellingPrice || product.price)}%</p>
                  </div>
                )}
                <div className={`p-2 rounded-lg ${
                  product.quantity === 0 ? 'bg-rose-50' : product.quantity < 10 ? 'bg-amber-50' : 'bg-slate-50'
                }`}>
                  <p className={`text-xs ${
                    product.quantity === 0 ? 'text-rose-600' : product.quantity < 10 ? 'text-amber-600' : 'text-slate-600'
                  }`}>Miqdor</p>
                  <p className={`font-bold ${
                    product.quantity === 0 ? 'text-rose-700' : product.quantity < 10 ? 'text-amber-700' : 'text-slate-700'
                  }`}>{product.quantity}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Mahsulotlar - Desktop table */}
      <div className="hidden lg:block overflow-hidden bg-white rounded-2xl shadow-sm border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-left text-slate-500 uppercase">#</th>
                <th className="px-6 py-4 text-xs font-semibold text-left text-slate-500 uppercase">Mahsulot</th>
                <th className="px-6 py-4 text-xs font-semibold text-left text-slate-500 uppercase">Kategoriya</th>
                <th className="px-6 py-4 text-xs font-semibold text-left text-slate-500 uppercase">Barcode</th>
                {isAdmin && showCostPrices && (
                  <th className="px-6 py-4 text-xs font-semibold text-left text-amber-600 uppercase bg-amber-50">Tannarx</th>
                )}
                <th className="px-6 py-4 text-xs font-semibold text-left text-slate-500 uppercase">Sotuv narxi</th>
                {isAdmin && showCostPrices && (
                  <th className="px-6 py-4 text-xs font-semibold text-left text-amber-600 uppercase bg-amber-50">Foyda %</th>
                )}
                <th className="px-6 py-4 text-xs font-semibold text-left text-slate-500 uppercase">Miqdor</th>
                <th className="px-6 py-4 text-xs font-semibold text-left text-slate-500 uppercase">Jami qiymat</th>
                <th className="px-6 py-4 text-xs font-semibold text-left text-slate-500 uppercase">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin && showCostPrices ? 10 : 8} className="px-6 py-12 text-center text-slate-500">
                    <Package className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                    <p>Mahsulot topilmadi</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product, index) => (
                  <tr 
                    key={product.id} 
                    id={`product-${product.id}`}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm text-slate-500">{index + 1}</td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-800">{product.name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-violet-100 text-violet-700 rounded-lg text-xs font-medium">
                        {product.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-slate-500">
                      {product.barcode || <span className="italic text-slate-400">—</span>}
                    </td>
                    {isAdmin && showCostPrices && (
                      <td className="px-6 py-4 text-sm font-medium text-amber-700 bg-amber-50/50">
                        {(product.costPrice || 0).toLocaleString()}
                      </td>
                    )}
                    <td className="px-6 py-4 text-sm font-medium text-slate-800">
                      {(product.sellingPrice || product.price || 0).toLocaleString()}
                    </td>
                    {isAdmin && showCostPrices && (
                      <td className="px-6 py-4 bg-amber-50/50">
                        <span className={`text-sm font-bold ${
                          calculateProfitPercent(product.costPrice, product.sellingPrice || product.price) > 20 
                            ? 'text-emerald-600' 
                            : 'text-amber-600'
                        }`}>
                          {calculateProfitPercent(product.costPrice, product.sellingPrice || product.price)}%
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        product.quantity === 0 ? 'bg-rose-100 text-rose-700' :
                        product.quantity < 10 ? 'bg-amber-100 text-amber-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {product.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-800">
                      {((product.quantity || 0) * (product.sellingPrice || product.price || 0)).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingProduct(product)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteProduct(product.id)}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tahrirlash modali */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 bg-white rounded-2xl shadow-2xl">
            <h3 className="mb-4 text-xl font-bold text-slate-800">Mahsulotni tahrirlash</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block mb-2 text-sm font-medium text-slate-700">Nomi *</label>
                <input
                  type="text"
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-slate-700">Kategoriya</label>
                <select
                  value={editingProduct.category}
                  onChange={(e) => setEditingProduct({...editingProduct, category: e.target.value})}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {isAdmin && (
                <div>
                  <label className="block mb-2 text-sm font-medium text-amber-700">Tannarx (kelish narxi)</label>
                  <input
                    type="number"
                    value={editingProduct.costPrice}
                    onChange={(e) => setEditingProduct({...editingProduct, costPrice: e.target.value})}
                    className="w-full px-4 py-2.5 border border-amber-200 bg-amber-50 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
              )}

              <div>
                <label className="block mb-2 text-sm font-medium text-slate-700">Sotuv narxi *</label>
                <input
                  type="number"
                  value={editingProduct.sellingPrice || editingProduct.price}
                  onChange={(e) => setEditingProduct({...editingProduct, sellingPrice: e.target.value, price: e.target.value})}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-slate-700">Barcode</label>
                <input
                  type="text"
                  value={editingProduct.barcode}
                  onChange={(e) => setEditingProduct({...editingProduct, barcode: e.target.value})}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-slate-700">Miqdor</label>
                <input
                  type="number"
                  value={editingProduct.quantity}
                  onChange={(e) => setEditingProduct({...editingProduct, quantity: e.target.value})}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div className="p-3 text-sm text-amber-800 border border-amber-200 rounded-xl bg-amber-50">
                ⚠️ Miqdorni o'zgartirish tavsiya etilmaydi. Kirim/Chiqim orqali boshqaring.
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingProduct(null)}
                className="flex-1 px-4 py-2.5 text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 font-medium"
              >
                Bekor qilish
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 px-4 py-2.5 text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 font-medium"
              >
                {saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showScanner && (
        <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setShowScanner(false)} />
      )}
    </div>
  );
};

export default ProductList;
