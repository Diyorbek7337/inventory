import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle, Trash2, Plus, Download, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';

// Excel/CSV orqali mahsulot kiritish komponenti
const ExcelImport = ({ onClose, onImport, categories, isAdmin }) => {
  const [items, setItems] = useState([]);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  // Namuna faylni yuklab olish
  const downloadTemplate = () => {
    const headers = ['name', 'quantity', 'sellingPrice', 'costPrice', 'category', 'barcode', 'unit', 'minStock'];
    const example = [
      ['Mahsulot 1', 10, 15000, 10000, 'Umumiy', '1234567890', 'dona', 5],
      ['Mahsulot 2', 5, 25000, 18000, 'Elektronika', '9876543210', 'dona', 3],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...example]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mahsulotlar');

    // Ustun kengligini sozlash
    ws['!cols'] = [
      { wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 12 },
      { wch: 15 }, { wch: 14 }, { wch: 8 }, { wch: 10 }
    ];

    XLSX.writeFile(wb, 'mahsulot_namuna.xlsx');
    toast.success('Namuna fayl yuklandi!');
  };

  // Excel/CSV faylni o'qish
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (rows.length === 0) {
          toast.warning('Fayl bo\'sh yoki noto\'g\'ri format!');
          setLoading(false);
          return;
        }

        // Maydon nomlarini normallashtirish
        const normalize = (key) => {
          const map = {
            'nomi': 'name', 'mahsulot nomi': 'name', 'nom': 'name',
            'miqdor': 'quantity', 'son': 'quantity',
            'sotuv narxi': 'sellingPrice', 'narxi': 'sellingPrice', 'narx': 'sellingPrice',
            'tannarx': 'costPrice', 'kelish narxi': 'costPrice',
            'kategoriya': 'category',
            'birlik': 'unit',
            'minimal qoldiq': 'minStock', 'min qoldiq': 'minStock',
          };
          const lower = String(key).toLowerCase().trim();
          return map[lower] || lower;
        };

        const parsed = rows.map((row, idx) => {
          const normalized = {};
          Object.entries(row).forEach(([k, v]) => {
            normalized[normalize(k)] = v;
          });
          return {
            id: Date.now() + idx,
            name: String(normalized.name || '').trim(),
            quantity: parseInt(normalized.quantity) || 1,
            sellingPrice: String(normalized.sellingPrice || normalized.narx || '').replace(/[^\d.]/g, ''),
            costPrice: String(normalized.costPrice || '').replace(/[^\d.]/g, ''),
            category: String(normalized.category || '').trim(),
            barcode: String(normalized.barcode || '').trim(),
            unit: String(normalized.unit || 'dona').trim(),
            minStock: String(parseInt(normalized.minStock) || 5),
            packSize: '1',
            expirationDate: '',
            color: '',
          };
        }).filter(row => row.name.length > 0);

        if (parsed.length === 0) {
          toast.warning('Mahsulot topilmadi. "name" ustuni borligini tekshiring.');
        } else {
          toast.success(`${parsed.length} ta mahsulot o'qildi!`);
        }
        setItems(parsed);
      } catch (err) {
        console.error('Excel o\'qish xatosi:', err);
        toast.error('Fayl o\'qishda xato. Excel yoki CSV formatini tekshiring.');
      }
      setLoading(false);
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const addEmptyRow = () => {
    setItems(prev => [...prev, {
      id: Date.now() + Math.random(),
      name: '', quantity: 1, sellingPrice: '', costPrice: '',
      category: '', barcode: '', unit: 'dona', minStock: '5',
      packSize: '1', expirationDate: '', color: '',
    }]);
  };

  const updateItem = (id, field, value) =>
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));

  const removeItem = (id) =>
    setItems(prev => prev.filter(it => it.id !== id));

  const validCount = items.filter(it => it.name.trim() && it.sellingPrice).length;

  const handleConfirm = () => {
    if (validCount === 0) {
      toast.warning('Kamida 1 ta mahsulot nomi va sotuv narxini kiriting!');
      return;
    }
    onImport(items.filter(it => it.name.trim() && it.sellingPrice));
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[93vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
              Excel orqali tovar kiritish
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              .xlsx · .xls · .csv fayl formatlarini qo'llab-quvvatlaydi
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* Yuklash qismi */}
          <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-200 dark:border-slate-600">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">
              1-qadam: Faylni yuklang
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 active:scale-95 transition-all text-sm font-medium disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                Fayl tanlash (.xlsx / .csv)
              </button>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Namuna faylni yuklab olish
              </button>
              {fileName && (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl text-sm text-emerald-700 dark:text-emerald-300">
                  <FileSpreadsheet className="w-4 h-4" />
                  {fileName}
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />

            {/* Ko'rsatma */}
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl">
              <div className="flex gap-2 text-sm text-blue-800 dark:text-blue-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">Fayl formati:</p>
                  <p>Birinchi qator ustun sarlavhalari bo'lishi kerak: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">name</code>, <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">quantity</code>, <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">sellingPrice</code></p>
                  <p className="mt-1">Ixtiyoriy: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">costPrice</code>, <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">category</code>, <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">barcode</code>, <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">unit</code></p>
                </div>
              </div>
            </div>
          </div>

          {/* Mahsulotlar jadvali */}
          {items.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  2-qadam: Ma'lumotlarni tekshiring
                  <span className="ml-2 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs rounded-full">
                    {items.length} ta qator
                  </span>
                </p>
                <button
                  onClick={addEmptyRow}
                  className="flex items-center gap-1 text-sm px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-slate-700 dark:text-slate-300 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Qo'shish
                </button>
              </div>

              <div className="hidden sm:grid grid-cols-12 gap-2 px-2 mb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                <div className="col-span-4">Mahsulot nomi *</div>
                <div className="col-span-2">Miqdor</div>
                <div className="col-span-2">Narx (so'm) *</div>
                {isAdmin && <div className="col-span-2">Tannarx</div>}
                <div className={isAdmin ? 'col-span-1' : 'col-span-3'}>Kategoriya</div>
                <div className="col-span-1"></div>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {items.map(item => (
                  <div
                    key={item.id}
                    className={`grid grid-cols-12 gap-2 items-center p-2 rounded-xl border transition-colors ${
                      item.name && item.sellingPrice
                        ? 'border-emerald-200 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-900/10'
                        : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/50'
                    }`}
                  >
                    <input
                      type="text"
                      placeholder="Mahsulot nomi *"
                      value={item.name}
                      onChange={e => updateItem(item.id, 'name', e.target.value)}
                      className="col-span-12 sm:col-span-4 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-slate-700 dark:text-white"
                    />
                    <input
                      type="number"
                      placeholder="Miqdor"
                      value={item.quantity}
                      onChange={e => updateItem(item.id, 'quantity', e.target.value)}
                      className="col-span-5 sm:col-span-2 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-slate-700 dark:text-white"
                    />
                    <input
                      type="number"
                      placeholder="Narx *"
                      value={item.sellingPrice}
                      onChange={e => updateItem(item.id, 'sellingPrice', e.target.value)}
                      className="col-span-5 sm:col-span-2 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-slate-700 dark:text-white"
                    />
                    {isAdmin && (
                      <input
                        type="number"
                        placeholder="Tannarx"
                        value={item.costPrice}
                        onChange={e => updateItem(item.id, 'costPrice', e.target.value)}
                        className="col-span-5 sm:col-span-2 px-3 py-2 border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent dark:text-white"
                      />
                    )}
                    <select
                      value={item.category}
                      onChange={e => updateItem(item.id, 'category', e.target.value)}
                      className={`${isAdmin ? 'col-span-5 sm:col-span-1' : 'col-span-5 sm:col-span-3'} px-2 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-700 dark:text-white`}
                    >
                      <option value="">Kategoriya</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="col-span-2 sm:col-span-1 flex justify-center p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {items.length === 0 && !loading && (
            <div
              className="py-16 flex flex-col items-center text-slate-300 dark:text-slate-600 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <FileSpreadsheet className="w-16 h-16 mb-3" />
              <p className="text-sm font-medium text-slate-400 dark:text-slate-500">Excel yoki CSV faylni tanlang</p>
              <p className="text-xs mt-1 text-slate-300 dark:text-slate-600">.xlsx · .xls · .csv</p>
            </div>
          )}

          {loading && (
            <div className="py-12 flex items-center justify-center gap-3 text-emerald-600">
              <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">Fayl o'qilmoqda...</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-200 dark:border-slate-700 shrink-0 flex gap-3">
          {items.length > 0 ? (
            <>
              <button
                onClick={handleConfirm}
                disabled={validCount === 0}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <CheckCircle className="w-5 h-5" />
                Kirimga qo'shish ({validCount} ta mahsulot)
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Bekor
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-6 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Yopish
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExcelImport;
