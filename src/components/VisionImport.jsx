import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Eye, Loader, Trash2, Plus, FileText, CheckCircle, Sparkles } from 'lucide-react';
import { toast } from 'react-toastify';

// ============================================================
// Google Gemini Vision API orqali rasmdan mahsulot o'qish.
// BEPUL: aistudio.google.com dan API kaliti oling (billing shart emas).
// Kuniga 1500 so'rov bepul.
// ============================================================

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const PROMPT = `Bu rasmda tovar/mahsulot ro'yxati, hisob-faktura yoki qo'lda yozilgan ro'yxat bor.
Rasmdan barcha mahsulotlarni aniqla. Matn o'zbek, rus yoki ingliz tilida bo'lishi mumkin.

Faqat quyidagi JSON formatida javob ber, boshqa hech narsa yozma:
[
  {"name": "mahsulot nomi", "quantity": 10, "price": 5000},
  {"name": "boshqa mahsulot", "quantity": 5, "price": 12000}
]

Qoidalar:
- name: mahsulot to'liq nomi (qanday yozilgan bo'lsa shunday)
- quantity: miqdori (butun son; aniq ko'rinmasa 1 qo'y)
- price: narxi faqat raqam (aniq ko'rinmasa null qo'y)
- Jami, sana, raqam (1. 2. 3.) kabi satrlarni qo'shma
- Faqat JSON massivi, boshqa hech narsa yozma`;

// ============================================================
const VisionImport = ({ onClose, onImport, categories, isAdmin }) => {
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [imageMime, setImageMime] = useState('image/jpeg');
  const [loading, setLoading] = useState(false);
  const [rawResponse, setRawResponse] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [items, setItems] = useState([]);
  // Rasmda yozilgan narx qaysi maydon uchun: 'cost' | 'selling'
  const [priceField, setPriceField] = useState('cost');
  // Foiz ustama
  const [markupPercent, setMarkupPercent] = useState('');

  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  // ---- Rasmni yuklash ----
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageMime(file.type || 'image/jpeg');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.split(',')[1]);
      setItems([]);
      setRawResponse('');
    };
    reader.readAsDataURL(file);
  };

  // ---- Gemini API ga so'rov ----
  const runOCR = async () => {
    if (!imageBase64) {
      toast.warning('Avval rasm tanlang!');
      return;
    }
    if (!apiKey) {
      toast.error(
        'Gemini API kaliti topilmadi! .env faylida VITE_GEMINI_API_KEY ni kiriting. ' +
        'Bepul kalit: aistudio.google.com'
      );
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: PROMPT },
                { inline_data: { mime_type: imageMime, data: imageBase64 } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
          },
        }),
      });

      const data = await res.json();

      if (data.error) {
        const msg = data.error.message || '';
        console.error('Gemini API xato:', data.error);
        // Model topilmasa — konsolda to'liq xatoni ko'rsatish
        toast.error('Gemini xatosi: ' + msg, { autoClose: 8000 });
        setLoading(false);
        return;
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      setRawResponse(text);

      // Markdown code fence larni olib tashlash, keyin JSON massivini topish
      const cleaned = text.replace(/```[a-z]*\n?/gi, '').trim();
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (!match) {
        toast.warning('Mahsulotlar aniqlanmadi. Rasmni aniqroq olib qayta urining.');
        addEmptyRow();
        setLoading(false);
        return;
      }

      let parsed = [];
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        toast.error('Javob formati xato. Qayta urining.');
        setLoading(false);
        return;
      }

      const priceVal = (it) =>
        it.price != null ? String(it.price).replace(/[^\d]/g, '') : '';

      const mapped = parsed
        .filter((it) => it.name && String(it.name).trim().length > 1)
        .map((it, idx) => ({
          id: Date.now() + idx,
          name: String(it.name).trim(),
          quantity: parseInt(it.quantity) || 1,
          sellingPrice: priceField === 'selling' ? priceVal(it) : '',
          costPrice:    priceField === 'cost'    ? priceVal(it) : '',
          category: '',
          unit: 'dona',
          barcode: '',
          minStock: '5',
          packSize: '1',
          expirationDate: '',
          color: '',
        }));

      setItems(mapped);

      if (mapped.length > 0) {
        toast.success(`${mapped.length} ta mahsulot aniqlandi!`);
      } else {
        toast.info('Mahsulotlar topilmadi. Qo\'lda kiriting.');
        addEmptyRow();
      }
    } catch (err) {
      console.error('Gemini xato:', err);
      toast.error('Tarmoq xatosi. Internet aloqasini tekshiring.');
    }

    setLoading(false);
  };

  const addEmptyRow = () => {
    setItems((prev) => [
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
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)));

  const removeItem = (id) =>
    setItems((prev) => prev.filter((it) => it.id !== id));

  // Barcha mahsulotlarga foiz ustama qo'llash
  const applyMarkup = () => {
    const pct = parseFloat(markupPercent);
    if (!pct || pct <= 0) { toast.warning('Foiz kiriting!'); return; }
    setItems((prev) => prev.map((it) => {
      const cost = parseFloat(it.costPrice);
      if (!cost) return it;
      const selling = Math.round(cost * (1 + pct / 100));
      return { ...it, sellingPrice: String(selling) };
    }));
    toast.success(`${pct}% ustama qo'llandi!`);
  };

  const validCount = items.filter((it) => it.name.trim() && it.sellingPrice).length;

  const handleConfirm = () => {
    if (validCount === 0) {
      toast.warning('Kamida 1 ta mahsulot nomi va sotuv narxini kiriting!');
      return;
    }
    onImport(items.filter((it) => it.name.trim() && it.sellingPrice));
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[93vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              AI orqali tovar kiritish
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Bosma harf · Qo'lyozma · O'zbek / rus / ingliz — Gemini AI tahlil qiladi
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* API kaliti yo'q bo'lganda ko'rsatma */}
          {!apiKey && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800">
              <p className="font-semibold mb-1">API kaliti kerak (bepul)</p>
              <ol className="list-decimal ml-4 space-y-1">
                <li>
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-blue-600"
                  >
                    aistudio.google.com/apikey
                  </a>{' '}
                  ga kiring (Google akkaunt bilan)
                </li>
                <li>"Create API key" tugmasini bosing</li>
                <li>
                  Kalitni <code className="bg-amber-100 px-1 rounded">.env</code> fayliga qo'shing:
                  <br />
                  <code className="bg-amber-100 px-2 py-0.5 rounded block mt-1 font-mono text-xs">
                    VITE_GEMINI_API_KEY=kalitingiz_shu_yerga
                  </code>
                </li>
                <li>Serverni qayta ishga tushiring (<code className="bg-amber-100 px-1 rounded">npm run dev</code>)</li>
              </ol>
            </div>
          )}

          {/* Narx turi tanlash */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl">
            <p className="text-xs font-semibold text-amber-700 mb-2">
              Rasmda yozilgan narx qaysi tur?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPriceField('cost')}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                  priceField === 'cost'
                    ? 'bg-amber-500 text-white shadow'
                    : 'bg-white text-amber-700 border border-amber-300 hover:bg-amber-100'
                }`}
              >
                Tannarx (kelish narxi)
              </button>
              <button
                onClick={() => setPriceField('selling')}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                  priceField === 'selling'
                    ? 'bg-emerald-500 text-white shadow'
                    : 'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
                }`}
              >
                Sotuv narxi
              </button>
            </div>
          </div>

          {/* 1-qadam: Rasm */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <p className="text-sm font-semibold text-slate-600 mb-3">
              1-qadam: Rasmni yuklang
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-95 transition-all text-sm font-medium disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                Fayldan yuklash
              </button>
              <button
                onClick={() => cameraRef.current?.click()}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 active:scale-95 transition-all text-sm font-medium disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                Kamera
              </button>
              {imageBase64 && !loading && (
                <button
                  onClick={runOCR}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 active:scale-95 transition-all text-sm font-medium ml-auto"
                >
                  <Sparkles className="w-4 h-4" />
                  AI bilan o'qish
                </button>
              )}
              {loading && (
                <div className="ml-auto flex items-center gap-2 text-sm text-indigo-600 font-medium">
                  <Loader className="w-4 h-4 animate-spin" />
                  AI tahlil qilmoqda...
                </div>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFile}
              className="hidden"
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFile}
              className="hidden"
            />

            {imagePreview ? (
              <img
                src={imagePreview}
                alt="Yuklangan rasm"
                className="mt-4 max-h-52 w-full object-contain rounded-xl border border-slate-200 bg-slate-100"
              />
            ) : (
              <div className="mt-4 py-10 flex flex-col items-center text-slate-300 border-2 border-dashed border-slate-200 rounded-xl">
                <Camera className="w-12 h-12 mb-2" />
                <p className="text-sm">Rasm yuklang yoki kamera orqali oling</p>
                <p className="text-xs mt-1">Hisob-faktura · Ro'yxat · Qo'l yozuvi</p>
              </div>
            )}
          </div>

          {/* AI javobi (xom) */}
          {rawResponse && (
            <div>
              <button
                onClick={() => setShowRaw((v) => !v)}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
              >
                <FileText className="w-4 h-4" />
                {showRaw ? 'AI javobini yashirish' : 'AI xom javobini ko\'rish'}
              </button>
              {showRaw && (
                <pre className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono whitespace-pre-wrap max-h-40 overflow-y-auto text-slate-700">
                  {rawResponse}
                </pre>
              )}
            </div>
          )}

          {/* 2-qadam: Mahsulotlar jadvali */}
          {items.length > 0 && (
            <div>
              {/* Foiz ustama */}
              {items.some(it => it.costPrice) && (
                <div className="mb-3 p-3 bg-violet-50 border border-violet-200 rounded-2xl">
                  <p className="text-xs font-semibold text-violet-700 mb-2">
                    Tannarxdan sotuv narxini hisoblash
                  </p>
                  <div className="flex gap-2 items-center flex-wrap">
                    {[10, 20, 30, 50].map(pct => (
                      <button
                        key={pct}
                        onClick={() => { setMarkupPercent(String(pct)); }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                          markupPercent === String(pct)
                            ? 'bg-violet-600 text-white'
                            : 'bg-white border border-violet-200 text-violet-700 hover:bg-violet-100'
                        }`}
                      >
                        +{pct}%
                      </button>
                    ))}
                    <div className="flex items-center gap-1 bg-white border border-violet-200 rounded-lg overflow-hidden">
                      <input
                        type="number"
                        placeholder="O'z foizim"
                        value={markupPercent}
                        onChange={(e) => setMarkupPercent(e.target.value)}
                        className="w-24 px-3 py-1.5 text-sm outline-none"
                        min="1" max="999"
                      />
                      <span className="pr-2 text-violet-500 font-bold">%</span>
                    </div>
                    <button
                      onClick={applyMarkup}
                      disabled={!markupPercent}
                      className="px-4 py-1.5 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:opacity-40 transition-all"
                    >
                      Qo'llash
                    </button>
                  </div>
                  {markupPercent && items.some(it => it.costPrice) && (
                    <p className="text-xs text-violet-500 mt-1.5">
                      Misol: tannarx 25 000 → sotuv {Math.round(25000 * (1 + parseFloat(markupPercent || 0) / 100)).toLocaleString()} so'm
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-slate-700">
                  2-qadam: Ma'lumotlarni tekshiring
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

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`p-2 rounded-xl border transition-colors space-y-2 ${
                      item.name && item.sellingPrice
                        ? 'border-emerald-200 bg-emerald-50/40'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    {/* 1-qator: nom + miqdor + narxlar + o'chirish */}
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Mahsulot nomi *"
                        value={item.name}
                        onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                        className="col-span-12 sm:col-span-4 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
                      />
                      <input
                        type="number"
                        placeholder="Miqdor"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                        className="col-span-4 sm:col-span-2 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
                      />
                      <input
                        type="number"
                        placeholder="Sotuv narx *"
                        value={item.sellingPrice}
                        onChange={(e) => updateItem(item.id, 'sellingPrice', e.target.value)}
                        className="col-span-4 sm:col-span-2 px-3 py-2 border border-emerald-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
                      />
                      {isAdmin && (
                        <input
                          type="number"
                          placeholder="Tannarx"
                          value={item.costPrice}
                          onChange={(e) => updateItem(item.id, 'costPrice', e.target.value)}
                          className="col-span-4 sm:col-span-2 px-3 py-2 border border-amber-200 bg-amber-50 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        />
                      )}
                      <button
                        onClick={() => removeItem(item.id)}
                        className="col-span-2 sm:col-span-1 flex justify-center p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-auto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* 2-qator: barcode + kategoriya */}
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Barcode (ixtiyoriy)"
                        value={item.barcode}
                        onChange={(e) => updateItem(item.id, 'barcode', e.target.value)}
                        className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-400 focus:border-transparent bg-white font-mono"
                      />
                      <select
                        value={item.category}
                        onChange={(e) => updateItem(item.id, 'category', e.target.value)}
                        className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 bg-white"
                      >
                        <option value="">Kategoriya</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.name}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
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
                disabled={validCount === 0}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50"
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
