import React, { useState, useMemo, useRef } from 'react';
import {
  Search, Calendar, Download, Printer, Eye, Filter,
  ChevronLeft, ChevronRight, Receipt, X, Phone, User,
  Package, DollarSign, Clock, CreditCard, Banknote,
  RotateCcw, FileText
} from 'lucide-react';
import { generateReceiptHTML } from './Settings';

const Sales = ({ transactions, isAdmin, companyData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, naqd, karta, qarz
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedSale, setSelectedSale] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const receiptRef = useRef(null);

  // Sana filtri yordamchi funksiya
  const isInDateRange = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    if (dateRange.start) {
      const start = new Date(dateRange.start);
      start.setHours(0, 0, 0, 0);
      if (d < start) return false;
    }
    if (dateRange.end) {
      const end = new Date(dateRange.end);
      end.setHours(23, 59, 59, 999);
      if (d > end) return false;
    }
    return true;
  };

  // Sotuvlar (chiqim)
  const sales = useMemo(() => {
    return transactions
      .filter(t => t.type === 'chiqim')
      .sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : new Date(a.date);
        const dateB = b.date instanceof Date ? b.date : new Date(b.date);
        return dateB - dateA;
      });
  }, [transactions]);

  // Qaytarishlar statistikasi
  const returnsStats = useMemo(() => {
    const filtered = transactions.filter(t => {
      if (t.type !== 'qaytarish') return false;
      return isInDateRange(t.date);
    });
    return {
      count: filtered.length,
      total: filtered.reduce((sum, t) => sum + (t.totalAmount || 0), 0)
    };
  }, [transactions, dateRange]);

  // Guruhlangan sotuvlar (saleId bo'yicha)
  const groupedSales = useMemo(() => {
    const groups = {};
    sales.forEach(sale => {
      const key = sale.saleId || sale.id;
      if (!groups[key]) {
        groups[key] = {
          saleId: key,
          date: sale.date,
          customerName: sale.customerName,
          customerPhone: sale.customerPhone,
          paymentType: sale.paymentType,
          items: [],
          totalAmount: 0,
          paidAmount: 0,
          debt: 0,
          discount: sale.discount || 0
        };
      }
      groups[key].items.push(sale);
      groups[key].totalAmount += sale.totalAmount || (sale.quantity * sale.price);
      groups[key].paidAmount += sale.paidAmount || 0;
      groups[key].debt += sale.debt || 0;
    });
    return Object.values(groups);
  }, [sales]);

  // Filtrlash
  const filteredSales = useMemo(() => {
    return groupedSales.filter(sale => {
      // Qidiruv
      const matchesSearch = !searchTerm || 
        sale.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.saleId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.items.some(item => item.productName?.toLowerCase().includes(searchTerm.toLowerCase()));

      // To'lov turi
      const matchesType = filterType === 'all' || sale.paymentType === filterType;

      // Sana
      let matchesDate = true;
      if (dateRange.start) {
        const saleDate = sale.date instanceof Date ? sale.date : new Date(sale.date);
        const startDate = new Date(dateRange.start);
        startDate.setHours(0, 0, 0, 0);
        matchesDate = saleDate >= startDate;
      }
      if (dateRange.end && matchesDate) {
        const saleDate = sale.date instanceof Date ? sale.date : new Date(sale.date);
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        matchesDate = saleDate <= endDate;
      }

      return matchesSearch && matchesType && matchesDate;
    });
  }, [groupedSales, searchTerm, filterType, dateRange]);

  // Statistikalar
  const stats = useMemo(() => {
    const total = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const cash = filteredSales.filter(s => s.paymentType === 'naqd').reduce((sum, s) => sum + s.totalAmount, 0);
    const card = filteredSales.filter(s => s.paymentType === 'karta').reduce((sum, s) => sum + s.totalAmount, 0);
    const debt = filteredSales.reduce((sum, s) => sum + s.debt, 0);
    return { total, cash, card, debt, count: filteredSales.length };
  }, [filteredSales]);

  // Hisobotni chop etish (umumiy ro'yxat)
  const printReport = () => {
    const printWindow = window.open('', '_blank');
    const today = new Date().toLocaleDateString('uz-UZ');
    const periodLabel = dateRange.start && dateRange.end
      ? `${dateRange.start} — ${dateRange.end}`
      : dateRange.start ? `${dateRange.start} dan` : `Bugun ${today}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Hisobot</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; font-size: 13px; color: #111; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          .meta { color: #555; font-size: 12px; margin-bottom: 16px; }
          .stats { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
          .stat-box { border: 1px solid #ddd; padding: 10px 16px; border-radius: 8px; min-width: 130px; }
          .stat-box .label { font-size: 11px; color: #666; }
          .stat-box .value { font-size: 16px; font-weight: bold; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: #f1f5f9; text-align: left; padding: 8px 10px; border: 1px solid #e2e8f0; }
          td { padding: 7px 10px; border: 1px solid #e2e8f0; }
          tr:nth-child(even) td { background: #f8fafc; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
          .naqd { background: #d1fae5; color: #065f46; }
          .karta { background: #dbeafe; color: #1e40af; }
          .qarz { background: #ffe4e6; color: #9f1239; }
          .footer { margin-top: 24px; font-size: 11px; color: #888; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          @media print { body { padding: 8px; } }
        </style>
      </head>
      <body>
        <h1>${companyData?.name || "Do'kon"} — Sotuvlar hisoboti</h1>
        <div class="meta">Davr: ${periodLabel} &nbsp;|&nbsp; Chop etildi: ${today}</div>

        <div class="stats">
          <div class="stat-box"><div class="label">Jami sotuvlar</div><div class="value">${stats.count} ta</div></div>
          <div class="stat-box"><div class="label">Jami summa</div><div class="value">${stats.total.toLocaleString()} so'm</div></div>
          <div class="stat-box"><div class="label">Naqd</div><div class="value">${stats.cash.toLocaleString()} so'm</div></div>
          <div class="stat-box"><div class="label">Karta</div><div class="value">${stats.card.toLocaleString()} so'm</div></div>
          <div class="stat-box"><div class="label">Qarzga</div><div class="value" style="color:#e11d48">${stats.debt.toLocaleString()} so'm</div></div>
          ${returnsStats.count > 0 ? `<div class="stat-box"><div class="label">Qaytarishlar</div><div class="value" style="color:#dc2626">${returnsStats.count} ta / ${returnsStats.total.toLocaleString()} so'm</div></div>` : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Chek ID</th>
              <th>Sana</th>
              <th>Mijoz</th>
              <th>Mahsulotlar</th>
              <th>To'lov</th>
              <th>Summa</th>
              <th>Qarz</th>
            </tr>
          </thead>
          <tbody>
            ${filteredSales.map((sale, idx) => {
              const d = sale.date instanceof Date ? sale.date : new Date(sale.date);
              return `<tr>
                <td>${idx + 1}</td>
                <td>#${sale.saleId?.slice(-8) || '-'}</td>
                <td>${d.toLocaleDateString('uz-UZ')} ${d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</td>
                <td>${sale.customerName && sale.customerName !== 'Naqd mijoz' ? sale.customerName : '-'}</td>
                <td>${sale.items.map(i => i.productName).join(', ')}</td>
                <td><span class="badge ${sale.paymentType}">${sale.paymentType === 'naqd' ? 'Naqd' : sale.paymentType === 'karta' ? 'Karta' : 'Qarz'}</span></td>
                <td>${sale.totalAmount.toLocaleString()}</td>
                <td>${sale.debt > 0 ? sale.debt.toLocaleString() : '-'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        <div class="footer">CRM Pro boshqaruv tizimi</div>
        <script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); };</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Chek chop etish
  const printReceipt = (sale) => {
    const target = sale || selectedSale;
    if (!target) return;
    const html = generateReceiptHTML({
      sale: target,
      companyData,
      receiptSettings: companyData?.receiptSettings,
    });
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
  };

  const formatSum = (value) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)} mln`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)} ming`;
    return value?.toLocaleString() || '0';
  };

  const getPaymentIcon = (type) => {
    switch (type) {
      case 'naqd': return <Banknote className="w-4 h-4 text-emerald-500" />;
      case 'karta': return <CreditCard className="w-4 h-4 text-blue-500" />;
      case 'qarz': return <Clock className="w-4 h-4 text-rose-500" />;
      default: return <DollarSign className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sotuvlar tarixi</h1>
          <p className="text-slate-500">Barcha sotuvlar ro'yxati</p>
        </div>
        <button
          onClick={printReport}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors text-sm font-medium"
        >
          <FileText className="w-4 h-4" />
          Hisobotni chop etish
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-xs text-slate-500">{stats.count} ta</span>
          </div>
          <p className="text-slate-500 text-xs">Jami sotish</p>
          <p className="text-lg font-bold text-slate-800">{formatSum(stats.total)}</p>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-green-100 rounded-xl">
              <Banknote className="w-4 h-4 text-green-600" />
            </div>
          </div>
          <p className="text-slate-500 text-xs">Naqd</p>
          <p className="text-lg font-bold text-slate-800">{formatSum(stats.cash)}</p>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-100 rounded-xl">
              <CreditCard className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <p className="text-slate-500 text-xs">Karta</p>
          <p className="text-lg font-bold text-slate-800">{formatSum(stats.card)}</p>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-rose-100 rounded-xl">
              <Clock className="w-4 h-4 text-rose-600" />
            </div>
          </div>
          <p className="text-slate-500 text-xs">Qarzga</p>
          <p className="text-lg font-bold text-rose-600">{formatSum(stats.debt)}</p>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 col-span-2 lg:col-span-1 xl:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-orange-100 rounded-xl">
              <RotateCcw className="w-4 h-4 text-orange-600" />
            </div>
            <span className="text-xs text-slate-500">{returnsStats.count} ta</span>
          </div>
          <p className="text-slate-500 text-xs">Qaytarishlar</p>
          <p className="text-lg font-bold text-orange-600">{formatSum(returnsStats.total)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Mijoz, mahsulot yoki chek ID qidirish..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {/* Payment Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="all">Barchasi</option>
            <option value="naqd">Naqd</option>
            <option value="karta">Karta</option>
            <option value="qarz">Qarzga</option>
          </select>

          {/* Date Range */}
          <div className="flex gap-2">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm"
            />
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm"
            />
          </div>
        </div>
      </div>

      {/* Sales List */}
      <div className="space-y-3">
        {filteredSales.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-100">
            <Receipt className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-xl font-bold text-slate-800 mb-2">Sotuv topilmadi</h3>
            <p className="text-slate-500">Filtrlarni o'zgartiring</p>
          </div>
        ) : (
          filteredSales.map((sale) => {
            const saleDate = sale.date instanceof Date ? sale.date : new Date(sale.date);
            return (
              <div 
                key={sale.saleId}
                className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Sale Info */}
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      sale.paymentType === 'naqd' ? 'bg-emerald-100' :
                      sale.paymentType === 'karta' ? 'bg-blue-100' :
                      'bg-rose-100'
                    }`}>
                      {getPaymentIcon(sale.paymentType)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-slate-800">#{sale.saleId?.slice(-8) || 'N/A'}</p>
                        {sale.debt > 0 && (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-600 rounded-full text-xs font-semibold">
                            Qarzga
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 text-sm flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {saleDate.toLocaleDateString('uz-UZ')} {saleDate.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {sale.customerName && sale.customerName !== 'Naqd mijoz' && (
                        <p className="text-slate-600 text-sm flex items-center gap-1 mt-1">
                          <User className="w-3 h-3" />
                          {sale.customerName}
                          {sale.customerPhone && (
                            <span className="text-slate-400">• {sale.customerPhone}</span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Items preview */}
                  <div className="flex-1 lg:text-center">
                    <p className="text-slate-600 text-sm">
                      {sale.items.map(i => i.productName).slice(0, 2).join(', ')}
                      {sale.items.length > 2 && ` +${sale.items.length - 2} ta`}
                    </p>
                    <p className="text-slate-400 text-xs">{sale.items.length} ta mahsulot</p>
                  </div>

                  {/* Amount */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xl font-bold text-slate-800">
                        {sale.totalAmount.toLocaleString()}
                      </p>
                      {sale.debt > 0 && (
                        <p className="text-rose-500 text-sm">
                          Qarz: {sale.debt.toLocaleString()}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedSale(sale);
                          setShowReceipt(true);
                        }}
                        className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                        title="Ko'rish"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => printReceipt(sale)}
                        className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors"
                        title="Chop etish"
                      >
                        <Printer className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Receipt Modal */}
      {showReceipt && selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-800">Chek</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => printReceipt(selectedSale)}
                    className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200"
                  >
                    <Printer className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setShowReceipt(false);
                      setSelectedSale(null);
                    }}
                    className="p-2 hover:bg-slate-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div ref={receiptRef} className="p-6 font-mono text-sm">
              {/* Header */}
              <div className="text-center border-b border-dashed border-slate-300 pb-4 mb-4">
                <h2 className="text-xl font-bold">{companyData?.name || 'Do\'kon'}</h2>
                {companyData?.phone && <p className="text-slate-600">Tel: {companyData.phone}</p>}
                {companyData?.address && <p className="text-slate-500 text-xs">{companyData.address}</p>}
              </div>

              {/* Receipt Info */}
              <div className="space-y-1 mb-4">
                <p>Chek №: {selectedSale.saleId}</p>
                <p>Sana: {(selectedSale.date instanceof Date ? selectedSale.date : new Date(selectedSale.date)).toLocaleString('uz-UZ')}</p>
                {selectedSale.customerName && selectedSale.customerName !== 'Naqd mijoz' && (
                  <p>Mijoz: {selectedSale.customerName}</p>
                )}
              </div>

              {/* Items */}
              <div className="border-t border-b border-dashed border-slate-300 py-4 mb-4 space-y-3">
                {selectedSale.items.map((item, idx) => (
                  <div key={idx}>
                    <p className="font-medium">{idx + 1}. {item.productName}</p>
                    <div className="flex justify-between text-slate-600 pl-4">
                      <span>{item.quantity} x {(item.sellingPrice || item.price || 0).toLocaleString()}</span>
                      <span>{(item.totalAmount || item.quantity * item.price || 0).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Jami:</span>
                  <span>{selectedSale.totalAmount.toLocaleString()} so'm</span>
                </div>
                {selectedSale.discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Chegirma:</span>
                    <span>-{selectedSale.discount.toLocaleString()} so'm</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>To'lov turi:</span>
                  <span>{selectedSale.paymentType === 'naqd' ? 'Naqd' : selectedSale.paymentType === 'karta' ? 'Karta' : 'Qarz'}</span>
                </div>
                {selectedSale.debt > 0 && (
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>Qarz:</span>
                    <span>{selectedSale.debt.toLocaleString()} so'm</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t border-slate-300 pt-2 mt-2">
                  <span>JAMI:</span>
                  <span>{selectedSale.totalAmount.toLocaleString()} so'm</span>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center text-slate-500 text-xs mt-6 border-t border-dashed border-slate-300 pt-4">
                <p>Xaridingiz uchun rahmat!</p>
                <p>Yana keling!</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;
