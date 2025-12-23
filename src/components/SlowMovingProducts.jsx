import React, { useState, useMemo } from 'react';
import { 
  Package, AlertTriangle, TrendingDown, Clock, Calendar,
  Search, Filter, ChevronDown, Eye, BarChart3, Percent,
  ArrowDown, ShoppingCart, Tag, ShoppingBag, Bell, Truck
} from 'lucide-react';

const SlowMovingProducts = ({ products, transactions, isAdmin }) => {
  const [activeTab, setActiveTab] = useState('order'); // order, slow, overstock, expiring
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Kategoriyalar
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean));
    return ['all', ...Array.from(cats)];
  }, [products]);

  // 30 kundan oshgan mahsulotlar (maslahat berish uchun)
  const isOlderThan30Days = (createdAt) => {
    if (!createdAt) return true; // Agar sana yo'q bo'lsa, default true
    const created = createdAt instanceof Date ? createdAt : 
                    createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    const daysSinceCreated = Math.floor((new Date() - created) / (1000 * 60 * 60 * 24));
    return daysSinceCreated >= 30;
  };

  // Mahsulot qachon qo'shilganini hisoblash
  const getDaysSinceCreated = (createdAt) => {
    if (!createdAt) return null;
    const created = createdAt instanceof Date ? createdAt : 
                    createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    return Math.floor((new Date() - created) / (1000 * 60 * 60 * 24));
  };

  // Mahsulot sotish statistikasi
  const productStats = useMemo(() => {
    const stats = {};
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Har bir mahsulot uchun
    products.forEach(product => {
      const productTransactions = transactions.filter(t => 
        t.productId === product.id && t.type === 'chiqim'
      );

      // So'nggi 30 kunda sotish
      const last30Days = productTransactions.filter(t => {
        const date = t.date instanceof Date ? t.date : new Date(t.date);
        return date >= thirtyDaysAgo;
      });

      // 30-60 kun orasida sotish
      const prev30Days = productTransactions.filter(t => {
        const date = t.date instanceof Date ? t.date : new Date(t.date);
        return date >= sixtyDaysAgo && date < thirtyDaysAgo;
      });

      const soldLast30 = last30Days.reduce((sum, t) => sum + t.quantity, 0);
      const soldPrev30 = prev30Days.reduce((sum, t) => sum + t.quantity, 0);

      // Oxirgi sotish sanasi
      const lastSale = productTransactions.length > 0 
        ? new Date(Math.max(...productTransactions.map(t => {
            const date = t.date instanceof Date ? t.date : new Date(t.date);
            return date.getTime();
          })))
        : null;

      // Oxirgi kirim sanasi
      const incomeTransactions = transactions.filter(t => 
        t.productId === product.id && t.type === 'kirim'
      );
      const lastIncome = incomeTransactions.length > 0
        ? new Date(Math.max(...incomeTransactions.map(t => {
            const date = t.date instanceof Date ? t.date : new Date(t.date);
            return date.getTime();
          })))
        : null;

      // Kunlik o'rtacha sotish
      const dailyAvg = soldLast30 / 30;
      
      // Qancha kunga yetadi
      const daysOfStock = dailyAvg > 0 ? Math.floor(product.quantity / dailyAvg) : 999;

      // O'sish/pasayish foizi
      const growthPercent = soldPrev30 > 0 
        ? ((soldLast30 - soldPrev30) / soldPrev30 * 100).toFixed(1)
        : soldLast30 > 0 ? 100 : 0;

      // Mahsulot qachon qo'shilgani
      const daysSinceCreated = getDaysSinceCreated(product.createdAt);
      const canShowAdvice = isOlderThan30Days(product.createdAt);

      stats[product.id] = {
        ...product,
        soldLast30,
        soldPrev30,
        lastSale,
        lastIncome,
        dailyAvg,
        daysOfStock,
        growthPercent: parseFloat(growthPercent),
        totalValue: product.quantity * (product.costPrice || product.price || 0),
        retailValue: product.quantity * (product.sellingPrice || product.price || 0),
        daysSinceCreated,
        canShowAdvice
      };
    });

    return stats;
  }, [products, transactions]);

  // Zakaz qilish kerak (kam qolgan yoki tugagan)
  const needToOrder = useMemo(() => {
    return Object.values(productStats)
      .filter(p => {
        const minStock = p.minStock || 5;
        return p.quantity <= minStock;
      })
      .sort((a, b) => a.quantity - b.quantity);
  }, [productStats]);

  // Sekin sotilayotgan mahsulotlar (30 kunda 5 tadan kam sotilgan, faqat 30+ kunlik mahsulotlar)
  const slowMoving = useMemo(() => {
    return Object.values(productStats)
      .filter(p => p.quantity > 0 && p.soldLast30 < 5 && p.canShowAdvice)
      .sort((a, b) => a.soldLast30 - b.soldLast30);
  }, [productStats]);

  // Ortiqcha zaxira (90+ kunga yetadi, faqat 30+ kunlik mahsulotlar)
  const overstock = useMemo(() => {
    return Object.values(productStats)
      .filter(p => p.quantity > 0 && p.daysOfStock > 90 && p.canShowAdvice)
      .sort((a, b) => b.daysOfStock - a.daysOfStock);
  }, [productStats]);

  // Srogi yaqinlashayotgan
  const expiringSoon = useMemo(() => {
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    return Object.values(productStats)
      .filter(p => {
        const expiry = p.expirationDate || p.expiryDate;
        if (!expiry) return false;
        const expiryDate = expiry instanceof Date ? expiry : new Date(expiry);
        return expiryDate <= thirtyDaysLater && p.quantity > 0;
      })
      .sort((a, b) => {
        const dateA = new Date(a.expirationDate || a.expiryDate);
        const dateB = new Date(b.expirationDate || b.expiryDate);
        return dateA - dateB;
      });
  }, [productStats]);

  // Filtrlash
  const getFilteredProducts = (list) => {
    return list.filter(p => {
      const matchesSearch = !searchTerm || 
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.barcode?.includes(searchTerm);
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  };

  const currentList = activeTab === 'order' ? needToOrder :
                       activeTab === 'slow' ? slowMoving : 
                       activeTab === 'overstock' ? overstock : 
                       expiringSoon;
  
  const filteredList = getFilteredProducts(currentList);

  // Statistikalar
  const totalSlowValue = slowMoving.reduce((sum, p) => sum + p.totalValue, 0);
  const totalOverstockValue = overstock.reduce((sum, p) => sum + p.totalValue, 0);
  const totalOrderValue = needToOrder.reduce((sum, p) => sum + p.retailValue, 0);

  const formatSum = (value) => {
    if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)} mlrd`;
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)} mln`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)} ming`;
    return value.toLocaleString();
  };

  const getDaysAgo = (date) => {
    if (!date) return 'Hech qachon';
    const days = Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Bugun';
    if (days === 1) return 'Kecha';
    return `${days} kun oldin`;
  };

  // Zakaz uchun tavsiya miqdori
  const getRecommendedOrder = (product) => {
    const dailyAvg = product.dailyAvg || 0;
    const minStock = product.minStock || 5;
    // 30 kunlik zaxira + minimal qoldiq
    const recommended = Math.ceil(dailyAvg * 30) + minStock - product.quantity;
    return Math.max(recommended, minStock);
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Ombor tahlili</h1>
          <p className="text-slate-500">Zakaz, sekin sotilayotgan va muammoli mahsulotlar</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Zakaz kerak */}
        <div 
          onClick={() => setActiveTab('order')}
          className={`cursor-pointer transition-all ${activeTab === 'order' ? 'ring-2 ring-emerald-400 scale-105' : 'hover:scale-102'} bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/25`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Truck className="w-6 h-6" />
            </div>
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
              {needToOrder.length} ta
            </span>
          </div>
          <p className="text-emerald-100 text-sm">Zakaz kerak</p>
          <p className="text-xl font-bold mt-1">{formatSum(totalOrderValue)}</p>
        </div>

        <div 
          onClick={() => setActiveTab('slow')}
          className={`cursor-pointer transition-all ${activeTab === 'slow' ? 'ring-2 ring-amber-400 scale-105' : 'hover:scale-102'} bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-5 text-white shadow-lg shadow-amber-500/25`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <TrendingDown className="w-6 h-6" />
            </div>
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
              {slowMoving.length} ta
            </span>
          </div>
          <p className="text-amber-100 text-sm">Sekin sotilmoqda</p>
          <p className="text-xl font-bold mt-1">{formatSum(totalSlowValue)}</p>
        </div>

        <div 
          onClick={() => setActiveTab('overstock')}
          className={`cursor-pointer transition-all ${activeTab === 'overstock' ? 'ring-2 ring-violet-400 scale-105' : 'hover:scale-102'} bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl p-5 text-white shadow-lg shadow-violet-500/25`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Package className="w-6 h-6" />
            </div>
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
              {overstock.length} ta
            </span>
          </div>
          <p className="text-violet-100 text-sm">Ortiqcha zaxira</p>
          <p className="text-xl font-bold mt-1">{formatSum(totalOverstockValue)}</p>
        </div>

        <div 
          onClick={() => setActiveTab('expiring')}
          className={`cursor-pointer transition-all ${activeTab === 'expiring' ? 'ring-2 ring-rose-400 scale-105' : 'hover:scale-102'} bg-gradient-to-br from-rose-500 to-rose-600 rounded-2xl p-5 text-white shadow-lg shadow-rose-500/25`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
              {expiringSoon.length} ta
            </span>
          </div>
          <p className="text-rose-100 text-sm">Srogi yaqin</p>
          <p className="text-xl font-bold mt-1">30 kun ichida</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { id: 'order', label: 'Zakaz kerak', count: needToOrder.length, icon: Truck, color: 'emerald' },
          { id: 'slow', label: 'Sekin sotilmoqda', count: slowMoving.length, icon: TrendingDown, color: 'amber' },
          { id: 'overstock', label: 'Ortiqcha zaxira', count: overstock.length, icon: Package, color: 'violet' },
          { id: 'expiring', label: 'Srogi yaqin', count: expiringSoon.length, icon: Clock, color: 'rose' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? tab.color === 'emerald' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25' :
                  tab.color === 'amber' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25' :
                  tab.color === 'violet' ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/25' :
                  'bg-rose-500 text-white shadow-lg shadow-rose-500/25'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            {tab.label}
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              activeTab === tab.id ? 'bg-white/20' : 'bg-slate-100'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* 30 kun qoidasi haqida eslatma */}
      {(activeTab === 'slow' || activeTab === 'overstock') && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <Bell className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-blue-800 font-medium">30 kun qoidasi</p>
            <p className="text-blue-600 text-sm">
              Maslahatlar faqat 30 kundan oshgan mahsulotlar uchun beriladi. 
              Yangi qo'shilgan mahsulotlar bu ro'yxatda ko'rinmaydi.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Mahsulot qidirish..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white min-w-[150px]"
          >
            <option value="all">Barcha kategoriyalar</option>
            {categories.filter(c => c !== 'all').map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Products List */}
      <div className="space-y-3">
        {filteredList.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-100">
            <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-xl font-bold text-slate-800 mb-2">
              {activeTab === 'order' ? 'Zakaz kerak mahsulot yo\'q 🎉' :
               activeTab === 'slow' ? 'Sekin sotilayotgan mahsulot yo\'q' :
               activeTab === 'overstock' ? 'Ortiqcha zaxira yo\'q' :
               'Srogi yaqinlashgan mahsulot yo\'q'}
            </h3>
            <p className="text-slate-500">Bu yaxshi xabar! 🎉</p>
          </div>
        ) : (
          filteredList.map((product, idx) => (
            <div 
              key={product.id}
              className={`bg-white rounded-2xl p-4 lg:p-6 shadow-sm border transition-all hover:shadow-md ${
                activeTab === 'order' && product.quantity === 0 
                  ? 'border-rose-200 bg-rose-50/50' 
                  : 'border-slate-100'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Product info */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    activeTab === 'order' ? (product.quantity === 0 ? 'bg-rose-100' : 'bg-emerald-100') :
                    activeTab === 'slow' ? 'bg-amber-100' :
                    activeTab === 'overstock' ? 'bg-violet-100' :
                    'bg-rose-100'
                  }`}>
                    <Package className={`w-6 h-6 ${
                      activeTab === 'order' ? (product.quantity === 0 ? 'text-rose-600' : 'text-emerald-600') :
                      activeTab === 'slow' ? 'text-amber-600' :
                      activeTab === 'overstock' ? 'text-violet-600' :
                      'text-rose-600'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 truncate">{product.name}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {product.category && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs">
                          {product.category}
                        </span>
                      )}
                      {product.barcode && (
                        <span className="text-xs text-slate-400">{product.barcode}</span>
                      )}
                      {product.daysSinceCreated !== null && (
                        <span className="text-xs text-slate-400">
                          ({product.daysSinceCreated} kun oldin qo'shilgan)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats - different for each tab */}
                {activeTab === 'order' ? (
                  // Zakaz kerak tab uchun
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                    <div className="text-center lg:text-right">
                      <p className={`text-2xl font-bold ${product.quantity === 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                        {product.quantity}
                      </p>
                      <p className="text-xs text-slate-500">Omborda</p>
                    </div>
                    
                    <div className="text-center lg:text-right">
                      <p className="text-lg font-bold text-slate-600">{product.minStock || 5}</p>
                      <p className="text-xs text-slate-500">Min. qoldiq</p>
                    </div>

                    <div className="text-center lg:text-right">
                      <p className="text-lg font-bold text-blue-600">{product.dailyAvg?.toFixed(1) || 0}</p>
                      <p className="text-xs text-slate-500">Kunlik sotish</p>
                    </div>

                    <div className="text-center lg:text-right bg-emerald-50 rounded-xl py-2 px-3">
                      <p className="text-xl font-bold text-emerald-600">
                        {getRecommendedOrder(product)}
                      </p>
                      <p className="text-xs text-emerald-700 font-medium">Tavsiya: zakaz</p>
                    </div>
                  </div>
                ) : (
                  // Boshqa tablar uchun
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                    <div className="text-center lg:text-right">
                      <p className="text-2xl font-bold text-slate-800">{product.quantity}</p>
                      <p className="text-xs text-slate-500">Omborda</p>
                    </div>
                    
                    <div className="text-center lg:text-right">
                      <p className="text-2xl font-bold text-amber-600">{product.soldLast30}</p>
                      <p className="text-xs text-slate-500">30 kunda sotildi</p>
                    </div>

                    <div className="text-center lg:text-right">
                      <div className="flex items-center justify-center lg:justify-end gap-1">
                        <p className={`text-lg font-bold ${
                          product.growthPercent > 0 ? 'text-emerald-600' : 
                          product.growthPercent < 0 ? 'text-rose-600' : 'text-slate-600'
                        }`}>
                          {product.growthPercent > 0 ? '+' : ''}{product.growthPercent}%
                        </p>
                        {product.growthPercent !== 0 && (
                          <ArrowDown className={`w-4 h-4 ${
                            product.growthPercent > 0 ? 'text-emerald-600 rotate-180' : 'text-rose-600'
                          }`} />
                        )}
                      </div>
                      <p className="text-xs text-slate-500">O'zgarish</p>
                    </div>

                    <div className="text-center lg:text-right">
                      <p className={`text-lg font-bold ${
                        product.daysOfStock > 180 ? 'text-rose-600' :
                        product.daysOfStock > 90 ? 'text-amber-600' :
                        'text-emerald-600'
                      }`}>
                        {product.daysOfStock > 365 ? '365+' : product.daysOfStock} kun
                      </p>
                      <p className="text-xs text-slate-500">Yetadi</p>
                    </div>
                  </div>
                )}

                {/* Value */}
                {isAdmin && (
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-800">
                      {formatSum(product.totalValue)}
                    </p>
                    <p className="text-xs text-slate-500">Tannarx</p>
                  </div>
                )}
              </div>

              {/* Additional info */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <ShoppingCart className="w-4 h-4" />
                  Oxirgi sotish: {getDaysAgo(product.lastSale)}
                </span>
                <span className="flex items-center gap-1">
                  <Package className="w-4 h-4" />
                  Oxirgi kirim: {getDaysAgo(product.lastIncome)}
                </span>
                <span className="flex items-center gap-1">
                  <Tag className="w-4 h-4" />
                  Kunlik o'rtacha: {product.dailyAvg.toFixed(1)} ta
                </span>
              </div>

              {/* Recommendations */}
              {activeTab === 'slow' && product.soldLast30 < 2 && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <p className="text-amber-700 text-sm">
                    💡 <strong>Tavsiya:</strong> Bu mahsulotga chegirma qo'ying yoki aksiya e'lon qiling. 
                    {product.daysOfStock > 180 && ' Yetkazib beruvchiga qaytarishni ko\'rib chiqing.'}
                  </p>
                </div>
              )}

              {activeTab === 'overstock' && (
                <div className="mt-3 p-3 bg-violet-50 border border-violet-100 rounded-xl">
                  <p className="text-violet-700 text-sm">
                    💡 <strong>Tavsiya:</strong> Keyingi buyurtmada kam oling. 
                    {product.daysOfStock > 180 ? ' Chegirma bilan sotishni boshlang.' : ' Hozirgi zaxira yetarli.'}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SlowMovingProducts;
