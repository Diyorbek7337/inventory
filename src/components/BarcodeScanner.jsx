import React, { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, Camera, Scan } from 'lucide-react';

const BarcodeScanner = ({ onScan, onClose }) => {
  useEffect(() => {
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 150 },
      rememberLastUsedCamera: true,
      aspectRatio: 1.777,
      formatsToSupport: [
        0,  // QR_CODE
        1,  // AZTEC
        2,  // CODABAR
        3,  // CODE_39
        4,  // CODE_93
        5,  // CODE_128
        6,  // DATA_MATRIX
        7,  // MAXICODE
        8,  // ITF
        9,  // EAN_13
        10, // EAN_8
        11, // PDF_417
        12, // RSS_14
        13, // RSS_EXPANDED
        14, // UPC_A
        15, // UPC_E
        16  // UPC_EAN_EXTENSION
      ]
    };

    const scanner = new Html5QrcodeScanner(
      "barcode-reader",
      config,
      false
    );

    scanner.render(
      (decodedText) => {
        onScan(decodedText);
        scanner.clear();
        onClose();
      },
      (error) => {
        // Scan qilishda xatolik - e'tiborsiz qoldiriladi
      }
    );

    return () => {
      scanner.clear().catch(err => console.error('Scanner clear error:', err));
    };
  }, [onScan, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-600 to-emerald-700">
          <h3 className="flex items-center gap-3 text-xl font-bold text-white">
            <div className="p-2 bg-white/20 rounded-xl">
              <Scan className="w-6 h-6" />
            </div>
            Barcode Skaner
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/20 text-white hover:bg-white/30 transition-colors active:scale-95"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scanner */}
        <div className="p-6">
          <div id="barcode-reader" className="rounded-xl overflow-hidden"></div>

          {/* Instructions */}
          <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Camera className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-blue-900">Barcode skanerlash</p>
                <p className="mt-1 text-sm text-blue-700">
                  Barcode yoki QR kodni kameraga yaqinlashtiring
                </p>
                <p className="mt-2 text-xs text-blue-600 font-medium">
                  Qo'llab-quvvatlanadigan formatlar: EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39, QR Code
                </p>
              </div>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-full mt-4 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-colors active:scale-[0.98]"
          >
            Bekor qilish
          </button>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;
