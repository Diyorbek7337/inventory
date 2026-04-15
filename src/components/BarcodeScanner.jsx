import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, Scan, Keyboard, Usb, AlertCircle, CheckCircle, ImageIcon, RefreshCw } from 'lucide-react';

// ─── Uch xil rejim ───────────────────────────────────────────────────────────
// 1. "hardware" — USB/Bluetooth skaner (klaviatura input) [default]
// 2. "camera"   — kamera orqali live scanning
// 3. "manual"   — qo'lda kiritish

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.QR_CODE,
];

// iOS/Safari detection
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const BarcodeScanner = ({ onScan, onClose }) => {
  const [mode, setMode]             = useState('hardware');
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [lastScanned, setLastScanned] = useState('');
  const [hwBuffer, setHwBuffer]     = useState('');
  const [scanStatus, setScanStatus] = useState(''); // 'scanning' | 'success' | ''

  const html5ScanRef  = useRef(null);
  const manualRef     = useRef(null);
  const hwBufferRef   = useRef('');
  const hwLastTimeRef = useRef(0);
  const photoInputRef = useRef(null);
  const [processingPhoto, setProcessingPhoto] = useState(false);

  // ─── Scan muvaffaqiyatli ─────────────────────────────────────────────────
  const handleSuccess = useCallback((code) => {
    const trimmed = code?.trim();
    if (!trimmed || trimmed === lastScanned) return;
    setLastScanned(trimmed);
    setScanStatus('success');
    try { navigator.vibrate?.(80); } catch (_) {}
    setTimeout(() => {
      onScan(trimmed);
      onClose();
    }, 200);
  }, [lastScanned, onScan, onClose]);

  // ─── Hardware (USB / Bluetooth) scanner ──────────────────────────────────
  useEffect(() => {
    if (mode !== 'hardware') return;
    const onKeyDown = (e) => {
      const now = Date.now();
      const gap = now - hwLastTimeRef.current;
      hwLastTimeRef.current = now;
      if (gap > 150) hwBufferRef.current = '';

      if (e.key === 'Enter' || e.key === 'Tab') {
        const code = hwBufferRef.current.trim();
        if (code.length >= 4) handleSuccess(code);
        hwBufferRef.current = '';
        e.preventDefault();
      } else if (e.key.length === 1) {
        hwBufferRef.current += e.key;
        setHwBuffer(hwBufferRef.current);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, handleSuccess]);

  // ─── Kamera to'xtatish ───────────────────────────────────────────────────
  const stopCamera = useCallback(async () => {
    if (html5ScanRef.current) {
      try {
        const state = html5ScanRef.current.getState();
        if (state === 2) await html5ScanRef.current.stop(); // SCANNING
      } catch (_) {}
      html5ScanRef.current = null;
    }
    setCameraReady(false);
  }, []);

  // ─── html5-qrcode live kamera (barcha qurilmalar) ────────────────────────
  const startCamera = useCallback(async () => {
    setCameraError('');
    setScanStatus('scanning');

    // DOM element tayyor bo'lishini kutish
    await new Promise(r => setTimeout(r, 100));

    const el = document.getElementById('h5q-region');
    if (!el) {
      setCameraError('Kamera bloki topilmadi. Iltimos sahifani yangilang.');
      return;
    }

    try {
      const scanner = new Html5Qrcode('h5q-region', { verbose: false });
      html5ScanRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: isIOS
            ? { width: 250, height: 100 }
            : { width: 280, height: 120 },
          formatsToSupport: SUPPORTED_FORMATS,
          aspectRatio: isIOS ? 1.0 : 1.333,
        },
        (code) => handleSuccess(code),
        () => {} // frame error — silent
      );
      setCameraReady(true);
      setScanStatus('scanning');
    } catch (err) {
      const msg = String(err);
      if (msg.includes('NotAllowed') || msg.includes('Permission') || msg.includes('denied')) {
        setCameraError('Kamera ruxsati berilmagan.\n' +
          (isIOS
            ? 'Sozlamalar → Safari → Kamera → "So\'rash" yoki "Ruxsat" tanlang.'
            : 'Brauzer URL satridagi 🔒 → Kamera → Ruxsat bering.'));
      } else if (msg.includes('NotFound') || msg.includes('not found')) {
        setCameraError('Kamera topilmadi.');
      } else if (msg.includes('https') || msg.includes('secure')) {
        setCameraError('Kamera faqat HTTPS saytlarda ishlaydi.');
      } else {
        setCameraError('Kamera ochilmadi: ' + msg.split('\n')[0]);
      }
      setScanStatus('');
    }
  }, [handleSuccess]);

  useEffect(() => {
    if (mode !== 'camera') {
      stopCamera();
      return;
    }
    startCamera();
    return () => { stopCamera(); };
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Foto orqali skaner (iPhone fallback) ────────────────────────────────
  const handlePhotoScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessingPhoto(true);
    setCameraError('');

    try {
      // Vaqtinchalik div yaratamiz
      const tempId = 'h5q-photo-temp';
      let tempDiv = document.getElementById(tempId);
      if (!tempDiv) {
        tempDiv = document.createElement('div');
        tempDiv.id = tempId;
        tempDiv.style.display = 'none';
        document.body.appendChild(tempDiv);
      }

      const scanner = new Html5Qrcode(tempId, { verbose: false });
      const result = await scanner.scanFile(file, true);
      scanner.clear();
      document.body.removeChild(tempDiv);
      handleSuccess(result);
    } catch {
      setCameraError('Rasmda barcode topilmadi. Qayta suratga oling.');
    } finally {
      setProcessingPhoto(false);
      if (e.target) e.target.value = '';
    }
  };

  // Manual focus
  useEffect(() => {
    if (mode === 'manual') setTimeout(() => manualRef.current?.focus(), 100);
  }, [mode]);

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-800 to-slate-900">
          <h3 className="flex items-center gap-2 text-lg font-bold text-white">
            <Scan className="w-5 h-5 text-emerald-400" />
            Barcode Skaner
          </h3>
          <button onClick={handleClose}
            className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          {[
            { id: 'hardware', label: 'USB/BT', icon: Usb },
            { id: 'camera',   label: 'Kamera', icon: Camera },
            { id: 'manual',   label: "Qo'lda", icon: Keyboard },
          ].map(tab => (
            <button key={tab.id} onClick={() => setMode(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-semibold transition-all border-b-2 ${
                mode === tab.id
                  ? 'border-emerald-500 text-emerald-700 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─── Hardware scanner mode ──────────────────────────────────────── */}
        {mode === 'hardware' && (
          <div className="p-5 space-y-4">
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-5 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Usb className="w-8 h-8 text-emerald-600" />
              </div>
              <p className="font-bold text-slate-800 text-base">USB / Bluetooth Skaner</p>
              <p className="text-sm text-slate-500 mt-1">
                Skanerning tugmachasini bosib barcodeni skanerlang
              </p>
              <div className="mt-4 min-h-[48px] px-4 py-3 bg-white border-2 border-dashed border-emerald-300 rounded-xl">
                {scanStatus === 'success' ? (
                  <p className="text-emerald-600 font-bold">✓ Qabul qilindi!</p>
                ) : hwBuffer ? (
                  <p className="font-mono text-lg font-bold text-emerald-700 tracking-widest">{hwBuffer}</p>
                ) : (
                  <p className="text-slate-400 text-sm">Kutilmoqda...</p>
                )}
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-bold text-amber-800 mb-2">⚠️ Eslatma:</p>
              <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
                <li>Skaner qurilmaga ulanganligini tekshiring</li>
                <li>Bluetooth skaner: avval pair qiling</li>
                <li>iPhone uchun: "Kamera" tabini ishlating</li>
              </ul>
            </div>
            <button onClick={handleClose}
              className="w-full py-3 bg-slate-100 text-slate-600 font-semibold rounded-xl hover:bg-slate-200">
              Bekor qilish
            </button>
          </div>
        )}

        {/* ─── Camera mode ────────────────────────────────────────────────── */}
        {mode === 'camera' && (
          <div className="p-5 space-y-3">
            {/* iOS banner */}
            {isIOS && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 flex items-center gap-2">
                <span className="text-lg"></span>
                <p className="text-xs text-blue-700 font-medium">
                  iPhone uchun kamera yoqildi. Barcodeni ramka ichiga to'g'rilang.
                </p>
              </div>
            )}

            {cameraError ? (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
                <p className="font-bold text-rose-800">Kamera ochilmadi</p>
                <p className="text-sm text-rose-600 whitespace-pre-line">{cameraError}</p>

                {/* iOS uchun foto orqali fallback */}
                {isIOS && (
                  <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-left">
                    <p className="text-xs font-bold text-amber-800 mb-2">📸 Muqobil usul:</p>
                    <p className="text-xs text-amber-700 mb-3">
                      Kamera ochilmasa, barcode rasmini olib skaner qiling:
                    </p>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handlePhotoScan}
                    />
                    <button
                      onClick={() => photoInputRef.current?.click()}
                      disabled={processingPhoto}
                      className="w-full py-2 bg-amber-500 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                    >
                      {processingPhoto ? 'Tekshirilmoqda...' : '📸 Rasm orqali skaner'}
                    </button>
                  </div>
                )}

                <button
                  onClick={() => { setCameraError(''); startCamera(); }}
                  className="w-full py-2 bg-rose-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Qayta urinish
                </button>
              </div>
            ) : (
              <>
                {/* html5-qrcode region — ALWAYS rendered before scanner starts */}
                <div
                  id="h5q-region"
                  className="rounded-2xl overflow-hidden bg-black"
                  style={{ minHeight: 220 }}
                />

                {cameraReady && (
                  <div className="flex items-center justify-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-xs text-emerald-700 font-semibold">Skanerlayapti...</p>
                  </div>
                )}
                {!cameraReady && !cameraError && (
                  <p className="text-xs text-center text-slate-400 animate-pulse">Kamera yoqilmoqda...</p>
                )}

                {/* iOS foto fallback — always visible in camera mode */}
                {isIOS && (
                  <div className="border border-slate-200 rounded-xl p-3">
                    <p className="text-xs text-slate-500 text-center mb-2">
                      Kamera ishlamasa — rasmga olib skaner qiling:
                    </p>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handlePhotoScan}
                    />
                    <button
                      onClick={() => photoInputRef.current?.click()}
                      disabled={processingPhoto}
                      className="w-full py-2 bg-slate-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <ImageIcon className="w-4 h-4" />
                      {processingPhoto ? 'Tekshirilmoqda...' : '📸 Rasmdan skaner'}
                    </button>
                  </div>
                )}
              </>
            )}

            <button onClick={handleClose}
              className="w-full py-3 bg-slate-100 text-slate-600 font-semibold rounded-xl hover:bg-slate-200">
              Bekor qilish
            </button>
          </div>
        )}

        {/* ─── Manual input mode ──────────────────────────────────────────── */}
        {mode === 'manual' && (
          <div className="p-5 space-y-4">
            <div className="text-center mb-2">
              <p className="text-sm text-slate-600">Barcode raqamini qo'lda kiriting</p>
            </div>
            <div className="relative">
              <input
                ref={manualRef}
                type="text"
                inputMode="numeric"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && manualCode.trim().length >= 4)
                    handleSuccess(manualCode.trim());
                }}
                placeholder="8860123456789"
                className="w-full px-4 py-4 border-2 border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 text-xl font-mono text-center tracking-widest"
                autoFocus
              />
              {manualCode && (
                <button onClick={() => setManualCode('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <button
              onClick={() => { if (manualCode.trim().length >= 4) handleSuccess(manualCode.trim()); }}
              disabled={manualCode.trim().length < 4}
              className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-lg"
            >
              <CheckCircle className="w-5 h-5 inline mr-2" />
              Tasdiqlash
            </button>
            <button onClick={handleClose}
              className="w-full py-3 bg-slate-100 text-slate-600 font-semibold rounded-xl hover:bg-slate-200">
              Bekor qilish
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BarcodeScanner;
