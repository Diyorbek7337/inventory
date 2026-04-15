/**
 * QZ Tray orqali termik printerlarga dialog ko'rsatmasdan chek chiqarish.
 * QZ Tray o'rnatilmagan bo'lsa — brauzer print dialogiga qaytadi.
 *
 * O'rnatish: https://qz.io/download
 */

// ─── QZ Tray ulanish ────────────────────────────────────────────────────────

let qzConnected = false;

async function ensureQZ() {
  if (typeof window.qz === 'undefined') return false;
  if (qzConnected && window.qz.websocket.isActive()) return true;

  // Imzosiz rejim (lokal ishlatish uchun)
  window.qz.security.setCertificatePromise(() => Promise.resolve(''));
  window.qz.security.setSignatureAlgorithm('SHA512');
  window.qz.security.setSignaturePromise(() => Promise.resolve(''));

  try {
    await window.qz.websocket.connect({ retries: 1, delay: 0.5 });
    qzConnected = true;
    return true;
  } catch {
    qzConnected = false;
    return false;
  }
}

// ─── ESC/POS yordamchi funksiyalar ──────────────────────────────────────────

const ESC = '\x1B';
const GS  = '\x1D';
const LF  = '\x0A';

const CMD = {
  init:        ESC + '@',           // Printerni boshlash
  center:      ESC + 'a\x01',      // Markazlashtirish
  left:        ESC + 'a\x00',      // Chap hizalash
  right:       ESC + 'a\x02',      // O'ng hizalash
  bold:        ESC + 'E\x01',      // Bold yoqish
  boldOff:     ESC + 'E\x00',      // Bold o'chirish
  doubleSize:  GS  + '!\x11',      // 2× balandlik + kenglik
  normalSize:  GS  + '!\x00',      // Oddiy o'lcham
  cut:         GS  + 'V\x41\x00', // Qisman kesish
};

function line(width = 48) {
  return '-'.repeat(width) + LF;
}

function padRight(str, len) {
  str = String(str ?? '');
  return str.length >= len ? str.substring(0, len) : str + ' '.repeat(len - str.length);
}

function padLeft(str, len) {
  str = String(str ?? '');
  return str.length >= len ? str.substring(0, len) : ' '.repeat(len - str.length) + str;
}

/** Ikki ustun: chap matn + o'ng matn, jami `width` belgi */
function columns(left, right, width = 48) {
  const rightStr = String(right ?? '');
  const leftLen = width - rightStr.length;
  const leftStr = String(left ?? '').substring(0, leftLen);
  return padRight(leftStr, leftLen) + rightStr + LF;
}

// ─── Chek shakllantirish ─────────────────────────────────────────────────────

/**
 * @param {Object} opts
 * @param {string} opts.storeName - Do'kon nomi
 * @param {string} opts.cashier   - Kassir
 * @param {string} opts.saleId    - Sotuv raqami
 * @param {Array}  opts.items     - [{ name, size, quantity, unitPrice }]
 * @param {number} opts.subtotal
 * @param {number} opts.discountAmount
 * @param {number} opts.totalAmount
 * @param {number} opts.paid
 * @param {number} opts.remaining
 * @param {string} opts.paymentType - 'naqd' | 'karta' | 'qarz'
 * @param {string} opts.customerName
 * @param {string} opts.customerPhone
 * @param {number} opts.paperWidth  - 48 (80mm) yoki 32 (58mm)
 */
function buildReceipt({
  storeName, cashier, saleId,
  items, subtotal, discountAmount, totalAmount, paid, remaining,
  paymentType, customerName, customerPhone,
  paperWidth = 48,
}) {
  const W = paperWidth;
  const payLabels = { naqd: 'Naqd pul', karta: 'Karta', qarz: 'Qarz' };
  const now = new Date();
  const dateStr = now.toLocaleDateString('uz-UZ');
  const timeStr = now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  const change = paymentType !== 'qarz' && paid > totalAmount ? paid - totalAmount : 0;

  let data = [];

  data.push(CMD.init);

  // Sarlavha
  data.push(CMD.center + CMD.bold + CMD.doubleSize);
  data.push(storeName + LF);
  data.push(CMD.normalSize + CMD.boldOff);
  data.push(`${dateStr}  ${timeStr}` + LF);
  if (cashier) data.push(`Kassir: ${cashier}` + LF);
  if (saleId)  data.push(`#${saleId}` + LF);

  data.push(CMD.left);
  data.push(line(W));

  // Ustun sarlavhasi
  data.push(CMD.bold);
  // name col: W-18, qty col: 8, sum col: 10
  const nameW = W - 18;
  data.push(padRight('Mahsulot', nameW) + padLeft('Miqdor', 8) + padLeft('Summa', 10) + LF);
  data.push(CMD.boldOff);
  data.push(line(W));

  // Mahsulotlar
  items.forEach(item => {
    const sizePart = item.size ? ` [${item.size}]` : '';
    const name = (item.name + sizePart).substring(0, nameW);
    const qty  = `${item.quantity}x`;
    const total = (item.quantity * item.unitPrice).toLocaleString();
    data.push(padRight(name, nameW) + padLeft(qty, 8) + padLeft(total, 10) + LF);
    // Narx (ikkinchi qator, past keglli)
    const unitStr = `  ${item.unitPrice.toLocaleString()} so'm/dona`;
    data.push(unitStr + LF);
  });

  data.push(line(W));

  // Summalar
  if (discountAmount > 0) {
    data.push(columns('Jami:', subtotal.toLocaleString() + " so'm", W));
    data.push(columns('Chegirma:', '-' + discountAmount.toLocaleString() + " so'm", W));
  }

  data.push(CMD.bold);
  data.push(columns("TO'LOV:", totalAmount.toLocaleString() + " so'm", W));
  data.push(CMD.boldOff);

  data.push(columns("To'lov turi:", payLabels[paymentType] || paymentType, W));

  if (paymentType === 'qarz') {
    data.push(columns("To'landi:", paid.toLocaleString() + " so'm", W));
    data.push(CMD.bold);
    data.push(columns('Qarz:', remaining.toLocaleString() + " so'm", W));
    data.push(CMD.boldOff);
    if (customerName) data.push(columns('Mijoz:', customerName, W));
    if (customerPhone) data.push(columns('Tel:', customerPhone, W));
  } else if (change > 0) {
    data.push(columns("Berildi:", paid.toLocaleString() + " so'm", W));
    data.push(CMD.bold);
    data.push(columns('Qaytim:', change.toLocaleString() + " so'm", W));
    data.push(CMD.boldOff);
  }

  data.push(line(W));

  // Footer
  data.push(CMD.center);
  data.push('Xarid uchun rahmat!' + LF);
  data.push('Yana tashrif buyuring' + LF);
  data.push(LF + LF + LF);

  data.push(CMD.cut);

  return data;
}

// ─── Asosiy eksport ──────────────────────────────────────────────────────────

/**
 * QZ Tray orqali chek chiqaradi. Agar QZ Tray bo'lmasa — browser print oynasi.
 * @param {Object} receiptOpts   - buildReceipt parametrlari
 * @param {string} printerName   - Printer nomi (masalan "XP-58") yoki null = standart
 * @param {string} paperWidth    - '58mm' yoki '80mm'
 * @param {Function} fallback    - QZ yo'q bo'lganda chaqiriladigan funksiya
 */
export async function qzPrintReceipt({ receiptOpts, printerName = null, paperWidth = '80mm', fallback }) {
  const colWidth = paperWidth === '58mm' ? 32 : 48;
  receiptOpts.paperWidth = colWidth;

  const ok = await ensureQZ();

  if (!ok) {
    // QZ Tray o'rnatilmagan — oddiy browser printga qaytadi
    if (typeof fallback === 'function') fallback();
    return;
  }

  try {
    // Printer topish
    let printer;
    if (printerName) {
      const found = await window.qz.printers.find(printerName);
      printer = Array.isArray(found) ? found[0] : found;
    } else {
      printer = await window.qz.printers.getDefault();
    }

    const config = window.qz.configs.create(printer);
    const data = buildReceipt(receiptOpts);

    await window.qz.print(config, [{ type: 'raw', format: 'plain', data: data.join('') }]);
  } catch (err) {
    console.error('QZ Tray xatosi:', err);
    // Xato bo'lsa browser print ga qaytadi
    if (typeof fallback === 'function') fallback();
  }
}

/** QZ Tray ulangan yoki yo'qligini tekshirish */
export async function isQZAvailable() {
  return await ensureQZ();
}
