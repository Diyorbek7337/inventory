import React, { useState, useEffect, useRef } from 'react';
import {
  Download, Upload, Cloud, HardDrive, FileJson, FileSpreadsheet,
  Clock, Check, AlertTriangle, RefreshCw, Trash2, Calendar,
  FolderOpen, ShieldCheck, RotateCcw
} from 'lucide-react';
import { collection, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';
import BackupService from '../utils/backupService';

const Backup = ({ currentUser, products, transactions }) => {
  const [loading, setLoading] = useState(false);
  const [backupHistory, setBackupHistory] = useState([]);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importData, setImportData] = useState(null);
  const [importOptions, setImportOptions] = useState({ categories: true, products: true, transactions: true });
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadBackupHistory();
  }, [currentUser.companyId]);

  const loadBackupHistory = async () => {
    try {
      const q = query(
        collection(db, 'backups'),
        where('companyId', '==', currentUser.companyId)
      );
      const snapshot = await getDocs(q);
      const history = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }));
      setBackupHistory(history.sort((a, b) => b.createdAt - a.createdAt));
    } catch (error) {
      console.error('Backup tarixi yuklanmadi:', error);
    }
  };

  // JSON backup
  const handleJsonBackup = async () => {
    setLoading(true);
    const loadingToast = toast.loading('Backup tayyorlanmoqda...');

    try {
      const result = await BackupService.exportCompanyData(currentUser.companyId);
      
      if (result.success) {
        const filename = `crm_backup_${new Date().toISOString().split('T')[0]}.json`;
        BackupService.downloadBackup(result.backup, filename);
        
        toast.update(loadingToast, {
          render: '✅ Backup yuklab olindi!',
          type: 'success',
          isLoading: false,
          autoClose: 3000
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.update(loadingToast, {
        render: '❌ Xatolik yuz berdi!',
        type: 'error',
        isLoading: false,
        autoClose: 3000
      });
    }
    setLoading(false);
  };

  // CSV export
  const handleCsvExport = async (type) => {
    setLoading(true);
    const loadingToast = toast.loading('Export qilinmoqda...');

    try {
      const result = await BackupService.exportToCSV(currentUser.companyId, type);
      
      if (result.success) {
        toast.update(loadingToast, {
          render: '✅ CSV yuklab olindi!',
          type: 'success',
          isLoading: false,
          autoClose: 3000
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.update(loadingToast, {
        render: '❌ Xatolik yuz berdi!',
        type: 'error',
        isLoading: false,
        autoClose: 3000
      });
    }
    setLoading(false);
  };

  // Cloud backup
  const handleCloudBackup = async () => {
    setLoading(true);
    const loadingToast = toast.loading('Cloud backup saqlanmoqda...');

    try {
      const result = await BackupService.createAutoBackup(currentUser.companyId);
      
      if (result.success) {
        loadBackupHistory();
        toast.update(loadingToast, {
          render: '✅ Cloud backup saqlandi!',
          type: 'success',
          isLoading: false,
          autoClose: 3000
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.update(loadingToast, {
        render: '❌ Xatolik yuz berdi!',
        type: 'error',
        isLoading: false,
        autoClose: 3000
      });
    }
    setLoading(false);
  };

  // Delete old backups
  const handleCleanBackups = async () => {
    if (!window.confirm('30 kundan eski backuplarni o\'chirmoqchimisiz?')) {
      return;
    }

    setLoading(true);
    try {
      const result = await BackupService.cleanOldBackups(currentUser.companyId, 30);
      if (result.success) {
        loadBackupHistory();
        toast.success(`${result.deleted} ta eski backup o'chirildi`);
      }
    } catch (error) {
      toast.error('Xatolik yuz berdi!');
    }
    setLoading(false);
  };

  // Delete single backup
  const deleteBackup = async (backupId) => {
    if (!window.confirm('Bu backupni o\'chirmoqchimisiz?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'backups', backupId));
      loadBackupHistory();
      toast.success('Backup o\'chirildi');
    } catch (error) {
      toast.error('Xatolik yuz berdi!');
    }
  };

  // JSON faylni o'qish
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!parsed.data || !parsed.companyId) {
          toast.error('Noto\'g\'ri backup fayl formati!');
          setImportFile(null);
          return;
        }
        setImportData(parsed);
        toast.info(`Fayl o'qildi: ${parsed.stats?.productsCount || 0} mahsulot, ${parsed.stats?.transactionsCount || 0} tranzaksiya`);
      } catch {
        toast.error('JSON fayl o\'qishda xatolik!');
        setImportFile(null);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  // Restore qilish
  const handleRestore = async () => {
    if (!importData) return;
    const chosen = Object.entries(importOptions).filter(([, v]) => v).map(([k]) => k);
    if (chosen.length === 0) { toast.warning('Kamida bitta tur tanlang!'); return; }

    const counts = [];
    if (importOptions.categories && importData.data.categories?.length)
      counts.push(`${importData.data.categories.length} kategoriya`);
    if (importOptions.products && importData.data.products?.length)
      counts.push(`${importData.data.products.length} mahsulot`);
    if (importOptions.transactions && importData.data.transactions?.length)
      counts.push(`${importData.data.transactions.length} tranzaksiya`);

    if (!window.confirm(
      `Quyidagi ma'lumotlar joriy Firebase ga yuklanadi:\n${counts.join(', ')}\n\nDavom etasizmi?`
    )) return;

    setRestoring(true);
    const loadingToast = toast.loading('Yuklanmoqda...');
    try {
      const result = await BackupService.restoreFromBackup(importData, currentUser.companyId, importOptions);
      if (result.success) {
        const { restored } = result;
        toast.update(loadingToast, {
          render: `✅ Yuklandi: ${restored.categories} kategoriya, ${restored.products} mahsulot, ${restored.transactions} tranzaksiya`,
          type: 'success', isLoading: false, autoClose: 5000
        });
        setImportFile(null);
        setImportData(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      toast.update(loadingToast, {
        render: `❌ Xatolik: ${err.message}`, type: 'error', isLoading: false, autoClose: 5000
      });
    }
    setRestoring(false);
  };

  const formatSize = (stats) => {
    const totalItems = (stats?.productsCount || 0) + (stats?.transactionsCount || 0);
    if (totalItems > 1000) return `${(totalItems / 1000).toFixed(1)}K`;
    return totalItems;
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Backup va Export</h1>
          <p className="text-slate-500">Ma'lumotlarni himoya qilish</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <FileJson className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <p className="text-slate-500 text-sm">Mahsulotlar</p>
          <p className="text-2xl font-bold text-slate-800">{products.length}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-xl">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-slate-500 text-sm">Tranzaksiyalar</p>
          <p className="text-2xl font-bold text-slate-800">{transactions.length}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-violet-100 rounded-xl">
              <Cloud className="w-5 h-5 text-violet-600" />
            </div>
          </div>
          <p className="text-slate-500 text-sm">Cloud backuplar</p>
          <p className="text-2xl font-bold text-slate-800">{backupHistory.length}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 rounded-xl">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
          </div>
          <p className="text-slate-500 text-sm">Oxirgi backup</p>
          <p className="text-sm font-bold text-slate-800">
            {backupHistory[0]?.createdAt?.toLocaleDateString('uz-UZ') || 'Hali yo\'q'}
          </p>
        </div>
      </div>

      {/* Backup Options */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Download Options */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Download className="w-5 h-5 text-emerald-500" />
            Yuklab olish
          </h3>

          <div className="space-y-3">
            <button
              onClick={handleJsonBackup}
              disabled={loading}
              className="w-full flex items-center justify-between p-4 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <FileJson className="w-8 h-8 text-emerald-600" />
                <div className="text-left">
                  <p className="font-semibold text-slate-800">To'liq Backup (JSON)</p>
                  <p className="text-sm text-slate-500">Barcha ma'lumotlar</p>
                </div>
              </div>
              <Download className="w-5 h-5 text-emerald-600" />
            </button>

            <button
              onClick={() => handleCsvExport('products')}
              disabled={loading}
              className="w-full flex items-center justify-between p-4 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-blue-600" />
                <div className="text-left">
                  <p className="font-semibold text-slate-800">Mahsulotlar (CSV)</p>
                  <p className="text-sm text-slate-500">Excel uchun</p>
                </div>
              </div>
              <Download className="w-5 h-5 text-blue-600" />
            </button>

            <button
              onClick={() => handleCsvExport('transactions')}
              disabled={loading}
              className="w-full flex items-center justify-between p-4 bg-violet-50 rounded-xl hover:bg-violet-100 transition-colors disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-violet-600" />
                <div className="text-left">
                  <p className="font-semibold text-slate-800">Tranzaksiyalar (CSV)</p>
                  <p className="text-sm text-slate-500">Excel uchun</p>
                </div>
              </div>
              <Download className="w-5 h-5 text-violet-600" />
            </button>

            <button
              onClick={() => handleCsvExport('debtors')}
              disabled={loading}
              className="w-full flex items-center justify-between p-4 bg-rose-50 rounded-xl hover:bg-rose-100 transition-colors disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-rose-600" />
                <div className="text-left">
                  <p className="font-semibold text-slate-800">Qarzdorlar (CSV)</p>
                  <p className="text-sm text-slate-500">Excel uchun</p>
                </div>
              </div>
              <Download className="w-5 h-5 text-rose-600" />
            </button>
          </div>
        </div>

        {/* Cloud Backup */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Cloud className="w-5 h-5 text-violet-500" />
            Cloud Backup
          </h3>

          <div className="p-4 bg-violet-50 rounded-xl mb-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-violet-100 rounded-lg">
                <Cloud className="w-6 h-6 text-violet-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">Firebase Cloud</p>
                <p className="text-sm text-slate-600 mt-1">
                  Ma'lumotlar Firebase serverida xavfsiz saqlanadi. 
                  Internet bo'lmasa ham oxirgi backup'dan foydalanish mumkin.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleCloudBackup}
            disabled={loading}
            className="w-full py-3 bg-violet-500 text-white rounded-xl font-semibold hover:bg-violet-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Upload className="w-5 h-5" />
            )}
            Cloud'ga saqlash
          </button>

          {/* Info */}
          <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">
                Har kuni backup qilishni tavsiya qilamiz. 30 kundan eski backuplar 
                avtomatik o'chirilishi mumkin.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Import / Restore */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h3 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-amber-500" />
          Boshqa Firebase ga ko'chirish / Restore
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          Backup JSON faylni tanlang — yangi Firebase akkauntga yoki mavjudiga yuklaydi.
        </p>

        {/* Fayl tanlash */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-between p-4 border-2 border-dashed border-slate-300 rounded-xl hover:border-amber-400 hover:bg-amber-50 transition-all mb-4"
        >
          <div className="flex items-center gap-3">
            <FolderOpen className="w-8 h-8 text-amber-500" />
            <div className="text-left">
              <p className="font-semibold text-slate-800">
                {importFile ? importFile.name : 'Backup faylni tanlang (.json)'}
              </p>
              <p className="text-sm text-slate-500">
                {importData
                  ? `${importData.stats?.productsCount || 0} mahsulot · ${importData.stats?.transactionsCount || 0} tranzaksiya · ${importData.exportedAt?.slice(0,10) || ''}`
                  : 'crm_backup_YYYY-MM-DD.json'}
              </p>
            </div>
          </div>
          <Upload className="w-5 h-5 text-amber-500" />
        </button>

        {/* Nima yuklansin */}
        {importData && (
          <div className="mb-4 space-y-2">
            <p className="text-sm font-semibold text-slate-700">Nimalarni yuklash:</p>
            {[
              { key: 'categories', label: 'Kategoriyalar', count: importData.data.categories?.length || 0 },
              { key: 'products',   label: 'Mahsulotlar',   count: importData.data.products?.length   || 0 },
              { key: 'transactions', label: 'Tranzaksiyalar', count: importData.data.transactions?.length || 0 },
            ].map(({ key, label, count }) => (
              <label key={key} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100">
                <input
                  type="checkbox"
                  checked={importOptions[key]}
                  onChange={e => setImportOptions(prev => ({ ...prev, [key]: e.target.checked }))}
                  className="w-4 h-4 accent-amber-500"
                />
                <span className="font-medium text-slate-800">{label}</span>
                <span className="ml-auto text-sm text-slate-500">{count} ta</span>
              </label>
            ))}
          </div>
        )}

        {/* Restore tugmasi */}
        <button
          onClick={handleRestore}
          disabled={!importData || restoring}
          className="w-full py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
        >
          {restoring
            ? <><RefreshCw className="w-5 h-5 animate-spin" /> Yuklanmoqda...</>
            : <><ShieldCheck className="w-5 h-5" /> Firebase ga yuklash</>
          }
        </button>

        <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700 space-y-1">
              <p className="font-semibold">Yangi Firebase akkauntga ko'chirish tartibi:</p>
              <ol className="list-decimal ml-4 space-y-0.5">
                <li>Oldingi Firebase da <strong>JSON backup</strong> yuklab oling</li>
                <li>Yangi Firebase loyihasi oching (<strong>console.firebase.google.com</strong>)</li>
                <li><code className="bg-blue-100 px-1 rounded">src/firebase.js</code> dagi config ni yangi loyiha ma'lumotlariga o'zgartiring</li>
                <li>Yangi akkaunt bilan tizimga kiring yoki ro'yxatdan o'ting</li>
                <li>Ushbu sahifada backup faylni tanlab <strong>"Firebase ga yuklash"</strong> tugmasini bosing</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Backup History */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-500" />
            Backup tarixi
          </h3>
          {backupHistory.length > 0 && (
            <button
              onClick={handleCleanBackups}
              className="text-sm text-slate-500 hover:text-rose-500 flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" />
              Eskilarni tozalash
            </button>
          )}
        </div>

        <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
          {backupHistory.length === 0 ? (
            <div className="p-12 text-center">
              <Cloud className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Hali backup yo'q</p>
              <p className="text-slate-400 text-sm">Birinchi cloud backup yarating</p>
            </div>
          ) : (
            backupHistory.map((backup) => (
              <div key={backup.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <Check className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">
                      {backup.createdAt.toLocaleDateString('uz-UZ')}
                      <span className="text-slate-400 text-sm ml-2">
                        {backup.createdAt.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </p>
                    <p className="text-sm text-slate-500">
                      {backup.stats?.productsCount || 0} mahsulot, {backup.stats?.transactionsCount || 0} tranzaksiya
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => deleteBackup(backup.id)}
                  className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Backup;
