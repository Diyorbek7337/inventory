import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Eye, EyeOff, Loader, Trash2, Plus, FileText, CheckCircle } from 'lucide-react';
import { toast } from 'react-toastify';

// ============================================================
// Google Vision API orqali rasmdan mahsulot ma'lumotlarini
// o'qib olish. Bosma harf, qo'lyozma va o'zbek tili qo'llab-quvvatlanadi.
// ============================================================

const VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate';

// Matndan mahsulot ma'lumotlarini ajratib olish
function parseProductsFromText(text) {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 1);

  const items = [];
  let i = 0;

  // Narx aniqlaydigan pattern: 4+ raqamli son (so'm hisobi)
  const priceRegex = /\b(\d[\d\s',.]{2,})\b/g;
  // Miqdor aniqlaydigan pattern: 1-4 raqamli son + birlik
  const qtyUnitRegex = /\b(\d{1,4})\s*(dona|ta|пк|pcs|шт|kg|кг|litr|л|меtr|quti|pachka|box)?\b/i;

  // ---- Helper: sonlarni ajratib olish ----
  function extractNumbers(line) {
    const cleaned = line.replace(/[^\d\s',.]/g, ' ');
    const matches = cleaned.match(/\d[\d',.]*\d|\d/g) || [];
    return matches.map(m => parseFloat(m.replace(/[',\s]/g, '')));
  }

  // ---- Helper: matn qismini ajratib olish (sonlar va belgilardan tozalash) ----
  function extractName(line) {
    return line
      .replace(/^\d+[.):\-\s]+/, '') // Boshi: "1. " yoki "1) "
      .replace(/\d[\d\s',.]*\d|\b\d\b/g, '') // Sonlarni olib tashlash
      .replace(/\b(dona|ta|pcs|шт|kg|кг|litr|л|so[''`]?m|sum|uzs|сум|narx|miqdor|qty|сони)\b/gi, '')
      .replace(/[-|;:,]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ---- Pattern 1: key-value format ----
  // "Mahsulot: Coca Cola", "Soni: 50", "Narxi: 5000"
  const kvPattern = /^(mahsulot|tovar|nomi?|name|сони?|miqdor|qty|narx[i]?|price|sum[ma]?)[:\s]+(.+)/i;
  let kvBuffer = {};

  function flushKvBuffer() {
    if (kvBuffer.name) {
      items.push({
        id: Date.now() + Math.random(),
        name: kvBuffer.name,
        quantity: kvBuffer.qty || 1,
        sellingPrice: kvBuffer.price || '',
        costPrice: '',
        category: '',
        unit: 'dona',
        barcode: '',
        minStock: '5',
        packSize: '1',
        expirationDate: '',
        color: '',
      });
    }
    kvBuffer = {};
  }

  while (i < lines.length) {
    const line = lines[i];

    // Key-value tekshirish
    const kvMatch = line.match(kvPattern);
    if (kvMatch) {
      const key = kvMatch[1].toLowerCase();
      const val = kvMatch[2].trim();
      if (/mahsulot|tovar|nom/i.test(key)) {
        if (kvBuffer.name) flushKvBuffer();
        kvBuffer.name = val;
      } else if (/soni?|miqdor|qty/i.test(key)) {
        kvBuffer.qty = parseFloat(val) || 1;
      } else if (/narx|price|sum/i.test(key)) {
        kvBuffer.price = parseFloat(val.replace(/['\s,]/g, '')) || '';
      }
      i++;
      continue;
    }

    // KV buffer yig'ilgan bo'lsa, saqlash
    if (kvBuffer.name && !kvMatch) {
      flushKvBuffer();
    }

    const nums = extractNumbers(line);
    const name = extractName(line);

    // ---- Pattern 2: Bir qatorda nomi + miqdor + narx ----
    if (nums.length >= 2 && name.length >= 2) {
      // Eng katta son - narx, kichigi - miqdor
      const sorted = [...nums].sort((a, b) => a - b);
      const price = sorted[sorted.length - 1]; // max
      // Miqdor: 4 raqamdan kichik bo'lgan birinchi son (narxdan farqli)
      const qty = sorted.find(n => n !== price && n < 10000) || 1;

      items.push({
        id: Date.now() + Math.random(),
        name,
        quantity: qty,
        sellingPrice: price >= 100 ? price : '',
        costPrice: '',
        category: '',
        unit: 'dona',
        barcode: '',
        minStock: '5',
        packSize: '1',
        expirationDate: '',
        color: '',
      });
      i++;
      continue;
    }

    // ---- Pattern 3: Faqat matn qatori (keyingi qatorda sonlar) ----
    if (name.length >= 2 && nums.length === 0) {
      const nextLine = lines[i + 1] || '';
      const nextNums = extractNumbers(nextLine);

      if (nextNums.length >= 1) {
        const sorted = [...nextNums].sort((a, b) => a - b);
        const price = sorted[sorted.length - 1];
        const qty = sorted.find(n => n !== price && n < 10000) || 1;

        items.push({
          id: Date.now() + Math.random(),
          name,
          quantity: nextNums.length >= 2 ? qty : 1,
          sellingPrice: price >= 100 ? price : '',
          costPrice: '',
          category: '',
          unit: 'dona',
          barcode: '',
          minStock: '5',
          packSize: '1',
          expirationDate: '',
          color: '',
        });
        i += 2; // Keyingi qatorni ham o'tkazamiz
        continue;
      }

      // Faqat nomi bor
      if (name.length > 2 && !/^(jami|total|итого|sana|date|raqam|№|#|\d)/i.test(name)) {
        items.push({
          id: Date.now() + Math.random(),
          name,
          quantity: 1,
          sellingPrice: '',
          costPrice: '',
          category: '',
          unit: 'dona',
          barcode: '',
          minStock: '5',
          packSize: '1',
          expirationDate: '',
          color: '',
        });
      }
    }

    i++;
  }

  // Qolgan KV buffer
  flushKvBuffer();

  // Filtr: juda qisqa nomlar va takrorlarni olib tashlash
  const seen = new Set();
  return items.filter(item => {
    const key = item.name.toLowerCase().slice(0, 20);
    if (seen.has(key) || item.name.length < 2) return false;
    seen.add(key);
    return true;
  });
}

// ============================================================
// Asosiy komponent
// ============================================================
const VisionImport = ({ onClose, onImport, categories, isAdmin }) => {
  const [imageBase64, setImageBase64] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rawText, setRawText] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [items, setItems] = useState([]);

  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  const apiKey = import.meta.env.VITE_GOOGLE_VISION_API_KEY;

  // Rasmni yuklash
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.split(',')[1]);
      setItems([]);
      setRawText('');
    };
    reader.readAsDataURL(file);
  };

  // Google Vision API ga murojaat
  const runOCR = async () => {
    if (!imageBase64) {
      toast.warning('Avval rasm tanlang!');
      return;
    }
    if (!apiKey) {
      toast.error('Google Vision API kaliti topilmadi! .env faylida VITE_GOOGLE_VISION_API_KEY ni kiriting.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${VISION_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: imageBase64 },
              features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
              imageContext: {
                // O'zbek, rus va ingliz tillarini qo'llab-quvvatlash
                languageHints: ['uz', 'ru', 'en'],
              },
            },
          ],
        }),
      });

      const data = await res.json();

      if (data.error) {
        toast.error('API xatosi: ' + data.error.message);
        return;
      }

      const text = data.responses?.[0]?.fullTextAnnotation?.text || '';
      if (!text) {
        toast.warning('Rasmda o\'qiladigan matn topilmadi.');
        return;
      }

      setRawText(text);
      const parsed = parseProductsFromText(text);
      setItems(parsed);

      if (parsed.length > 0) {
        toast.success(`${parsed.length} ta mahsulot aniqlandi!`);
      } else {
        toast.info('Mahsulotlar avtomatik aniqlanmadi. Qo\'lda kiriting yoki xom matnni tekshiring.');
        // Hech narsa aniqlanmasa ham bitta bo'sh qator qo'yamiz
        addEmptyRow();
      }
    } catch (err) {
      console.error('Vision API:', err);
      toast.error('Tarmoq xatosi yuz berdi. Internet aloqasini tekshiring.');
    }
    setLoading(false);
  };

  // Qo'lda bo'sh qator qo'shish
  const addEmptyRow = () => {
    setItems(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        name: '',
        quantity: 1,
        sellingPrice: '',
        costPrice: '',
        category: '',
        unit: 'dona',
        barcode: '',
        minStock: '5',
        packSize: '1',
        expirationDate: '',
        color: '',
      },
    ]);
  };

  const updateItem = (id, field, value) =>
    setItems(prev => prev.map(it => (it.id === id ? { ...it, [field]: value } : it)));

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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[93vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Camera className="w-5 h-5 text-cyan-600" />
              Rasm orqali tovar kiritish
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Bosma harf, qo'lyozma yoki o'zbek tilidagi hisob-faktura / ro'yxat
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* 1. Rasm tanlash */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <p className="text-sm font-semibold text-slate-600 mb-3">1-qadam: Rasmni yuklang</p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-95 transition-all text-sm font-medium"
              >
                <Upload className="w-4 h-4" />
                Fayldan yuklash
              </button>
              <button
                onClick={() => cameraRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 active:scale-95 transition-all text-sm font-medium"
              >
                <Camera className="w-4 h-4" />
                Kamera
              </button>
              {imageBase64 && (
                <button
                  onClick={runOCR}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-60 active:scale-95 transition-all text-sm font-medium ml-auto"
                >
                  {loading
                    ? <Loader className="w-4 h-4 animate-spin" />
                    : <Eye className="w-4 h-4" />}
                  {loading ? 'O\'qilmoqda...' : 'Matnni o\'qish (OCR)'}
                </button>
              )}
            </div>

            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />

            {imagePreview && (
              <img
                src={imagePreview}
                alt="Yuklangan rasm"
                className="mt-4 max-h-52 w-full object-contain rounded-xl border border-slate-200 bg-slate-100"
              />
            )}

            {!imagePreview && (
              <div className="mt-4 py-10 flex flex-col items-center text-slate-300 border-2 border-dashed border-slate-200 rounded-xl">
                <Camera className="w-12 h-12 mb-2" />
                <p className="text-sm">Rasm yuklang yoki kamera orqali oling</p>
                <p className="text-xs mt-1">Hisob-faktura · Ro'yxat · Qo'l yozuvi</p>
              </div>
            )}
          </div>

          {/* Xom matn */}
          {rawText && (
            <div>
              <button
                onClick={() => setShowRaw(v => !v)}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
              >
                <FileText className="w-4 h-4" />
                {showRaw ? 'Xom matnni yashirish' : 'O\'qilgan xom matnni ko\'rish'}
              </button>
              {showRaw && (
                <pre className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono whitespace-pre-wrap max-h-40 overflow-y-auto text-slate-700">
                  {rawText}
                </pre>
              )}
            </div>
          )}

          {/* 2. Mahsulotlar jadvali */}
          {items.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-slate-700">
                  2-qadam: Ma'lumotlarni tekshiring va to'ldiring
                  <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                    {items.length} ta qator
                  </span>
                </p>
                <button
                  onClick={addEmptyRow}
                  className="flex items-center gap-1 text-sm px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Qo'shish
                </button>
              </div>

              {/* Ustunlar sarlavhasi */}
              <div className="hidden sm:grid grid-cols-12 gap-2 px-2 mb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                <div className="col-span-4">Mahsulot nomi *</div>
                <div className="col-span-2">Miqdor</div>
                <div className="col-span-2">Sotuv narxi *</div>
                {isAdmin && <div className="col-span-2">Tannarx</div>}
                <div className={isAdmin ? 'col-span-1' : 'col-span-3'}>Kategoriya</div>
                <div className="col-span-1"></div>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`grid grid-cols-12 gap-2 items-center p-2 rounded-xl border transition-colors ${
                      item.name && item.sellingPrice
                        ? 'border-emerald-200 bg-emerald-50/40'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    {/* Nomi */}
                    <input
                      type="text"
                      placeholder="Mahsulot nomi *"
                      value={item.name}
                      onChange={e => updateItem(item.id, 'name', e.target.value)}
                      className="col-span-12 sm:col-span-4 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
                    />

                    {/* Miqdor */}
                    <input
                      type="number"
                      placeholder="Miqdor"
                      value={item.quantity}
                      onChange={e => updateItem(item.id, 'quantity', e.target.value)}
                      className="col-span-5 sm:col-span-2 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
                    />

                    {/* Sotuv narxi */}
                    <input
                      type="number"
                      placeholder="Narx *"
                      value={item.sellingPrice}
                      onChange={e => updateItem(item.id, 'sellingPrice', e.target.value)}
                      className="col-span-5 sm:col-span-2 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
                    />

                    {/* Tannarx (faqat admin) */}
                    {isAdmin && (
                      <input
                        type="number"
                        placeholder="Tannarx"
                        value={item.costPrice}
                        onChange={e => updateItem(item.id, 'costPrice', e.target.value)}
                        className="col-span-5 sm:col-span-2 px-3 py-2 border border-amber-200 bg-amber-50 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      />
                    )}

                    {/* Kategoriya */}
                    <select
                      value={item.category}
                      onChange={e => updateItem(item.id, 'category', e.target.value)}
                      className={`${isAdmin ? 'col-span-5 sm:col-span-1' : 'col-span-5 sm:col-span-3'} px-2 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 bg-white`}
                    >
                      <option value="">Kategoriya</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>

                    {/* O'chirish */}
                    <button
                      onClick={() => removeItem(item.id)}
                      className="col-span-2 sm:col-span-1 flex justify-center p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-200 shrink-0 flex gap-3">
          {items.length > 0 ? (
            <>
              <button
                onClick={handleConfirm}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50"
                disabled={validCount === 0}
              >
                <CheckCircle className="w-5 h-5" />
                Kirimga qo'shish ({validCount} ta mahsulot)
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors"
              >
                Bekor
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors"
            >
              Yopish
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VisionImport;
