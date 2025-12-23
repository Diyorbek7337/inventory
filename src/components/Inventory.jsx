import React, { useState, useEffect, useRef } from 'react';
import { 
  Package, Search, Scan, Check, X, AlertTriangle, 
  Camera, Save, FileText, Download, RefreshCw,
  ChevronDown, ChevronUp, Calculator, ClipboardList
} from 'lucide-react';
import { collection, addDoc, updateDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';
import BarcodeScanner from './BarcodeScanner';

const Inventory = ({ products, onUpdateProduct, currentUser }) => {
  const [activeTab, setActiveTab] = useState('count'); // count, history, report
  const [searchTerm, setSearchTerm] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [inventoryItems, setInventoryItems] = useState({});
  const [inventoryHistory, setInventoryHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [currentInventory, setCurrentInventory] = useState(null);
  const searchInputRef = useRef(null);

  // Inventarizatsiya tarixini yuklash
  useEffect(() => {
    loadInventoryHistory();
  }, [currentUser.companyId]);

  const loadInventoryHistory = async () => {
    try {
      const q = query(
        collection(db, 'inventories'),
        where('companyId', '==', currentUser.companyId)
      );
      const snapshot = await getDocs(q);
      const history = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate() || new Date()
      }));
      setInventoryHistory(history.sort((a, b) => b.date - a.date));
    } catch (error) {
      console.error('Tarix yuklanmadi:', error);
    }
  };

  // Yangi inventarizatsiya boshlash
  const startNewInventory = () => {
    const newInventory = {
      startedAt: new Date(),
      status: 'in_progress',
      items: {}
    };
    setCurrentInventory(newInventory);
    setInventoryItems({});
    toast.info('Yangi inventarizatsiya boshlandi!');
  };

  // Barcode scan
  const handleBarcodeScan = (barcode) => {
    const product = products.find(p => p.barcode === barcode);
    if (product) {
      addToCount(product);
      toast.success(`${product.name} topildi!`);
    } else {
      toast.warning(`Barcode: ${barcode} - topilmadi!`);
    }
    searchInputRef.current?.focus();
  };

  // Mahsulotni sanashga qo'shish
  const addToCount = (product) => {
    setInventoryItems(prev => ({
      ...prev,
      [product.id]: {
        ...product,
        systemQty: product.quantity, // Sistemadagi son
        actualQty: prev[product.id]?.actualQty ?? '', // Haqiqiy son
        counted: true
      }
    }));
  };

  // Haqiqiy sonni kiritish
  const updateActualQty = (productId, value) => {
    setInventoryItems(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        actualQty: value === '' ? '' : parseInt(value) || 0
      }
    }));
  };

  // Farqni hisoblash
  const getDifference = (item) => {
    if (item.actualQty === '') return null;
    return item.actualQty - item.systemQty;
  };

  // Barcha mahsulotlarni qo'shish
  const addAllProducts = () => {
    const items = {};
    products.forEach(p => {
      items[p.id] = {
        ...p,
        systemQty: p.quantity,
        actualQty: '',
        counted: false
      };
    });
    setInventoryItems(items);
    toast.info(`${products.length} ta mahsulot qo'shildi`);
  };

  // Inventarizatsiyani saqlash
  const saveInventory = async () => {
    const countedItems = Object.values(inventoryItems).filter(
      item => item.actualQty !== ''
    );

    if (countedItems.length === 0) {
      toast.warning('Kamida bitta mahsulot sanalishi kerak!');
      return;
    }

    setSaving(true);
    const loadingToast = toast.loading('Saqlanmoqda...');

    try {
      // Inventarizatsiya hisoboti
      const report = {
        companyId: currentUser.companyId,
        createdBy: currentUser.id,
        createdByName: currentUser.name,
        date: new Date(),
        status: 'completed',
        totalProducts: countedItems.length,
        totalSystemQty: countedItems.reduce((sum, i) => sum + i.systemQty, 0),
        totalActualQty: countedItems.reduce((sum, i) => sum + i.actualQty, 0),
        items: countedItems.map(item => ({
          productId: item.id,
          productName: item.name,
          barcode: item.barcode,
          systemQty: item.systemQty,
          actualQty: item.actualQty,
          difference: item.actualQty - item.systemQty
        })),
        discrepancies: countedItems.filter(i => i.actualQty !== i.systemQty).length
      };

      // Hisobotni saqlash
      await addDoc(collection(db, 'inventories'), report);

      // Mahsulotlar sonini yangilash (ixtiyoriy)
      const shouldUpdate = window.confirm(
        'Mahsulotlar sonini yangilashni xohlaysizmi?\n\n' +
        'HA - Sistemadagi sonlar haqiqiy songacha o\'zgaradi\n' +
        'YO\'Q - Faqat hisobot saqlanadi'
      );

      if (shouldUpdate) {
        for (const item of countedItems) {
          if (item.actualQty !== item.systemQty) {
            await updateDoc(doc(db, 'products', item.id), {
              quantity: item.actualQty,
              lastInventoryDate: new Date(),
              lastInventoryDiff: item.actualQty - item.systemQty
            });
            onUpdateProduct({ ...item, quantity: item.actualQty });
          }
        }
        toast.success('Mahsulotlar soni yangilandi!');
      }

      // Tozalash
      setInventoryItems({});
      setCurrentInventory(null);
      loadInventoryHistory();

      toast.update(loadingToast, {
        render: '✅ Inventarizatsiya saqlandi!',
        type: 'success',
        isLoading: false,
        autoClose: 3000
      });

    } catch (error) {
      console.error('Saqlash xatosi:', error);
      toast.update(loadingToast, {
        render: '❌ Xatolik yuz berdi!',
        type: 'error',
        isLoading: false,
        autoClose: 3000
      });
    }
    setSaving(false);
  };

  // Hisobotni yuklab olish
  const downloadReport = (inventory) => {
    const BOM = '\uFEFF';
    const headers = ['Mahsulot', 'Barcode', 'Sistemada', 'Haqiqiy', 'Farq'];
    const rows = inventory.items.map(item => [
      item.productName,
      item.barcode || '',
      item.systemQty,
      item.actualQty,
      item.difference
    ]);

    const csv = BOM + [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventarizatsiya_${inventory.date.toLocaleDateString('uz-UZ').replace(/\./g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtrlangan mahsulotlar
  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.barcode?.includes(searchTerm)
  );

  // Statistikalar
  const countedCount = Object.values(inventoryItems).filter(i => i.actualQty !== '').length;
  const discrepancyCount = Object.values(inventoryItems).filter(i => {
    const diff = getDifference(i);
    return diff !== null && diff !== 0;
  }).length;

  const totalSystemQty = Object.values(inventoryItems).reduce((sum, i) => sum + i.systemQty, 0);
  const totalActualQty = Object.values(inventoryItems)
    .filter(i => i.actualQty !== '')
    .reduce((sum, i) => sum + i.actualQty, 0);

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inventarizatsiya</h1>
          <p className="text-slate-500">Ombor tekshiruvi va hisoboti</p>
        </div>

        {!currentInventory ? (
          <button
            onClick={startNewInventory}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/25"
          >
            <ClipboardList className="w-5 h-5" />
            Yangi inventarizatsiya
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (window.confirm('Inventarizatsiyani bekor qilasizmi?')) {
                  setCurrentInventory(null);
                  setInventoryItems({});
                }
              }}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300"
            >
              Bekor qilish
            </button>
            <button
              onClick={saveInventory}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              Saqlash
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: 'count', label: 'Sanash', icon: Calculator },
          { id: 'history', label: 'Tarix', icon: FileText }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Count Tab */}
      {activeTab === 'count' && (
        <>
          {!currentInventory ? (
            <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-100">
              <ClipboardList className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                Inventarizatsiya boshlang
              </h3>
              <p className="text-slate-500 mb-6">
                "Yangi inventarizatsiya" tugmasini bosing va ombordagi mahsulotlarni sanang
              </p>
              <button
                onClick={startNewInventory}
                className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600"
              >
                Boshlash
              </button>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <p className="text-slate-500 text-sm">Sanash kerak</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {Object.keys(inventoryItems).length}
                  </p>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <p className="text-slate-500 text-sm">Sanalgan</p>
                  <p className="text-2xl font-bold text-emerald-600">{countedCount}</p>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <p className="text-slate-500 text-sm">Farq bor</p>
                  <p className="text-2xl font-bold text-rose-600">{discrepancyCount}</p>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <p className="text-slate-500 text-sm">Sistemada / Haqiqiy</p>
                  <p className="text-lg font-bold text-slate-800">
                    {totalSystemQty} / {totalActualQty}
                  </p>
                </div>
              </div>

              {/* Search & Actions */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                <div className="flex flex-col lg:flex-row gap-4">
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
                            setSearchTerm('');
                          }
                        }
                      }}
                      className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={() => setShowScanner(true)}
                    className="px-4 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                  <button
                    onClick={addAllProducts}
                    className="px-4 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 whitespace-nowrap"
                  >
                    Barchasini qo'shish
                  </button>
                </div>
              </div>

              {/* Products to count */}
              {searchTerm && filteredProducts.length > 0 && Object.keys(inventoryItems).length === 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="p-4 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-800">Topilgan mahsulotlar</h3>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                    {filteredProducts.slice(0, 10).map(product => (
                      <div 
                        key={product.id}
                        className="p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer"
                        onClick={() => {
                          addToCount(product);
                          setSearchTerm('');
                        }}
                      >
                        <div>
                          <p className="font-medium text-slate-800">{product.name}</p>
                          <p className="text-sm text-slate-500">
                            {product.barcode} • Sistemada: {product.quantity}
                          </p>
                        </div>
                        <button className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                          <Check className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Inventory Items */}
              <div className="space-y-3">
                {Object.values(inventoryItems).map(item => {
                  const diff = getDifference(item);
                  const hasDiff = diff !== null && diff !== 0;

                  return (
                    <div 
                      key={item.id}
                      className={`bg-white rounded-2xl p-4 lg:p-6 shadow-sm border ${
                        hasDiff ? 'border-rose-200 bg-rose-50/50' : 'border-slate-100'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-800 truncate">{item.name}</h3>
                          <p className="text-sm text-slate-500">
                            {item.barcode} • {item.category}
                          </p>
                        </div>

                        {/* System Qty */}
                        <div className="text-center px-4">
                          <p className="text-sm text-slate-500">Sistemada</p>
                          <p className="text-xl font-bold text-slate-800">{item.systemQty}</p>
                        </div>

                        {/* Actual Qty Input */}
                        <div className="flex items-center gap-3">
                          <div className="text-center">
                            <p className="text-sm text-slate-500 mb-1">Haqiqiy</p>
                            <input
                              type="number"
                              value={item.actualQty}
                              onChange={(e) => updateActualQty(item.id, e.target.value)}
                              placeholder="0"
                              className={`w-24 px-3 py-2 text-xl font-bold text-center border-2 rounded-xl focus:ring-2 focus:ring-emerald-500 ${
                                hasDiff ? 'border-rose-300 bg-rose-50' : 'border-slate-200'
                              }`}
                            />
                          </div>

                          {/* Difference */}
                          {diff !== null && (
                            <div className={`text-center px-4 py-2 rounded-xl ${
                              diff > 0 ? 'bg-emerald-100 text-emerald-700' :
                              diff < 0 ? 'bg-rose-100 text-rose-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              <p className="text-sm">Farq</p>
                              <p className="text-lg font-bold">
                                {diff > 0 ? '+' : ''}{diff}
                              </p>
                            </div>
                          )}

                          {/* Remove */}
                          <button
                            onClick={() => {
                              const newItems = { ...inventoryItems };
                              delete newItems[item.id];
                              setInventoryItems(newItems);
                            }}
                            className="p-2 text-slate-400 hover:text-rose-500"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {Object.keys(inventoryItems).length === 0 && (
                  <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-300">
                    <Scan className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500">
                      Barcode skanerlang yoki mahsulot qidiring
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {inventoryHistory.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-100">
              <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <h3 className="text-xl font-bold text-slate-800 mb-2">Tarix bo'sh</h3>
              <p className="text-slate-500">Hali inventarizatsiya o'tkazilmagan</p>
            </div>
          ) : (
            inventoryHistory.map(inv => (
              <div 
                key={inv.id}
                className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-slate-800">
                        {inv.date.toLocaleDateString('uz-UZ')}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        inv.discrepancies > 0 
                          ? 'bg-rose-100 text-rose-700' 
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {inv.discrepancies > 0 ? `${inv.discrepancies} ta farq` : 'Farq yo\'q'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">
                      {inv.createdByName} • {inv.totalProducts} ta mahsulot
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-sm text-slate-500">Sistemada</p>
                      <p className="font-bold text-slate-800">{inv.totalSystemQty}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-slate-500">Haqiqiy</p>
                      <p className="font-bold text-slate-800">{inv.totalActualQty}</p>
                    </div>
                    <button
                      onClick={() => downloadReport(inv)}
                      className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
                      title="Yuklab olish"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <BarcodeScanner
          onScan={(barcode) => {
            handleBarcodeScan(barcode);
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
};

export default Inventory;
