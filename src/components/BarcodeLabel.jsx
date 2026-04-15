import React, { useState, useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { X, Printer, RefreshCw, Copy, Check } from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';

// Barcha mavjud barcode larni yig'ish
const collectAllBarcodes = (allProducts, excludeId) =>
  new Set(
    allProducts
      .filter(p => p.id !== excludeId)
      .flatMap(p => [p.barcode, ...(p.additionalBarcodes || [])])
      .filter(Boolean)
  );

// Noyob barcode yaratish — mavjudlari bilan taqqoslaydi
const generateUniqueBarcode = (existingSet) => {
  let code;
  let attempts = 0;
  do {
    const ts = Date.now().toString().slice(-7);
    const rand = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
    code = ts + rand;
    attempts++;
  } while (existingSet.has(code) && attempts < 100);
  return code;
};

const BarcodeLabel = ({ product, allProducts = [], onClose, onBarcodeUpdate }) => {
  const existingBarcodes = collectAllBarcodes(allProducts, product.id);
  const [barcode, setBarcode] = useState(
    product.barcode || generateUniqueBarcode(existingBarcodes)
  );
  const [count, setCount]     = useState(1);   // nechta label chiqarish
  const [copied, setCopied]   = useState(false);
  const [saving, setSaving]   = useState(false);
  const svgRef = useRef(null);

  // SVG ni render qilish
  useEffect(() => {
    if (!svgRef.current || !barcode) return;
    try {
      JsBarcode(svgRef.current, barcode, {
        format:      'CODE128',
        width:       2,
        height:      60,
        displayValue: true,
        fontSize:    13,
        margin:      8,
        background:  '#ffffff',
        lineColor:   '#000000',
      });
    } catch {
      toast.error('Barcode xato — faqat harf va raqam kiriting');
    }
  }, [barcode]);

  // Yangi noyob barcode yaratish
  const regenerate = () => setBarcode(generateUniqueBarcode(existingBarcodes));

  // Barcode nusxalash
  const copyBarcode = () => {
    navigator.clipboard.writeText(barcode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Kiritilgan barcodeни tekshirish
  const isDuplicate = (code) => existingBarcodes.has(code.trim());

  // Firestore ga saqlash
  const saveBarcode = async () => {
    if (!barcode.trim()) return;
    if (isDuplicate(barcode)) {
      toast.error('Bu barcode boshqa mahsulotda allaqachon mavjud!');
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'products', product.id), { barcode: barcode.trim() });
      onBarcodeUpdate({ ...product, barcode: barcode.trim() });
      toast.success('Barcode saqlandi!');
    } catch {
      toast.error('Saqlashda xato');
    }
    setSaving(false);
  };

  // Print
  const handlePrint = async () => {
    // Avval saqlab qo'yamiz (agar hali saqlanmagan bo'lsa)
    if (barcode !== product.barcode) {
      await saveBarcode();
    }

    // SVG ni string ga o'girish
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBase64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));

    // Label HTML ni yaratish
    const labels = Array(count).fill(null).map(() => `
      <div class="label">
        <p class="pname">${product.name}</p>
        ${product.sellingPrice ? `<p class="price">${Number(product.sellingPrice).toLocaleString()} so'm</p>` : ''}
        <img src="${svgBase64}" alt="barcode" />
      </div>
    `).join('');

    const win = window.open('', '_blank', 'width=600,height=500');
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Barcode — ${product.name}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; background: #fff; }
          .page {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            padding: 6px;
          }
          .label {
            border: 1px dashed #ccc;
            border-radius: 4px;
            padding: 6px 8px;
            width: 200px;
            text-align: center;
            page-break-inside: avoid;
          }
          .pname {
            font-size: 11px;
            font-weight: bold;
            margin-bottom: 2px;
            word-break: break-word;
          }
          .price {
            font-size: 13px;
            font-weight: 800;
            color: #1a7a3f;
            margin-bottom: 2px;
          }
          img { width: 100%; height: auto; display: block; }
          @media print {
            body { margin: 0; }
            .page { padding: 4px; gap: 4px; }
          }
        </style>
      </head>
      <body>
        <div class="page">${labels}</div>
        <script>
          window.onload = () => { window.print(); window.close(); }
        <\/script>
      </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Printer className="w-5 h-5 text-indigo-500" />
              Barcode yaratish
            </h2>
            <p className="text-sm text-slate-500 mt-0.5 truncate max-w-xs">{product.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-xl">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">

          {/* Barcode preview */}
          <div className="flex justify-center bg-white border border-slate-200 rounded-2xl p-4">
            <svg ref={svgRef} />
          </div>

          {/* Barcode qiymatini o'zgartirish */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
              Barcode raqami
            </label>
            {isDuplicate(barcode) && (
              <p className="text-xs text-rose-600 font-medium mb-1.5">
                ⚠️ Bu barcode boshqa mahsulotda mavjud — yangi yarating yoki o'zgartiring
              </p>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value.trim())}
                className={`flex-1 px-3 py-2.5 border rounded-xl text-sm font-mono focus:ring-2 focus:border-transparent ${
                  isDuplicate(barcode)
                    ? 'border-rose-400 focus:ring-rose-500 bg-rose-50'
                    : 'border-slate-200 focus:ring-indigo-500'
                }`}
                placeholder="Barcode kiriting"
              />
              <button
                onClick={regenerate}
                title="Yangi barcode yaratish"
                className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
              >
                <RefreshCw className="w-4 h-4 text-slate-600" />
              </button>
              <button
                onClick={copyBarcode}
                title="Nusxalash"
                className={`p-2.5 rounded-xl transition-all ${copied ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Nechta chiqarish */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
              Nechta label chiqarish
            </label>
            <div className="flex items-center gap-3">
              {[1, 2, 4, 6, 10, 20].map(n => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    count === n
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {n}
                </button>
              ))}
              <input
                type="number"
                value={count}
                min={1} max={200}
                onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-center"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-200 flex gap-3">
          <button
            onClick={saveBarcode}
            disabled={saving || barcode === product.barcode || isDuplicate(barcode)}
            className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-40 transition-all text-sm"
          >
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
          <button
            onClick={handlePrint}
            disabled={!barcode || isDuplicate(barcode)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-all text-sm"
          >
            <Printer className="w-4 h-4" />
            Chiqarish ({count} ta)
          </button>
        </div>
      </div>
    </div>
  );
};

export default BarcodeLabel;
