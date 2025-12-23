# 🔐 CRM Pro - Xavfsizlik va Yangi Funksiyalar

## 📋 Mundarija
1. [Parol Hashlash](#1-parol-hashlash)
2. [Firebase Auth](#2-firebase-auth)
3. [Ma'lumotlar Himoyasi (Backup)](#3-malumotlar-himoyasi)
4. [Offline Rejim (PWA)](#4-offline-rejim)
5. [Inventarizatsiya](#5-inventarizatsiya)

---

## 1. 🔒 Parol Hashlash

### Muammo nima edi?
Oldin parollar oddiy text sifatida saqlanardi:
```
password: "123456"  ❌ Xavfli!
```

### Hozir qanday?
Bcrypt algoritmi bilan shifrlangan:
```
password: "$2a$10$X7jG2kV8Q..."  ✅ Xavfsiz!
```

### Qanday ishlaydi?

```javascript
// src/utils/passwordUtils.js

// 1. Parolni hash qilish (ro'yxatdan o'tishda)
const hashedPassword = await hashPassword("123456");
// Natija: "$2a$10$X7jG2kV8Q..."

// 2. Parolni tekshirish (kirishda)
const isValid = await verifyPassword("123456", hashedPassword);
// Natija: true yoki false

// 3. Parol kuchliligini tekshirish
const strength = checkPasswordStrength("123456");
// Natija: { score: 2, message: "Kuchsiz parol", isValid: false }
```

### Eski parollarni migrate qilish
Super Admin panelida yoki console'da:
```javascript
import AuthService from './utils/authService';
await AuthService.migratePasswords();
```

---

## 2. 🔑 Firebase Auth

### Firebase Console'da sozlash:
1. Firebase Console → Authentication → Sign-in method
2. "Email/Password" ni yoqing
3. Tayyor!

### Qanday ishlaydi?

```javascript
// src/utils/authService.js

// Ro'yxatdan o'tish
const result = await AuthService.registerCompany(
  { name: "Texno Market", phone: "+998901234567" },
  { name: "Admin", username: "admin", password: "parol123" }
);

// Kirish
const result = await AuthService.login("admin", "parol123");
if (result.success) {
  // Muvaffaqiyatli
  console.log(result.user);
} else {
  // Xatolik
  console.log(result.error);
}

// Chiqish
await AuthService.logout();

// Parol o'zgartirish
await AuthService.changePassword(userId, "eskiParol", "yangiParol");
```

### Xatolik xabarlari
- "Foydalanuvchi topilmadi!" - Login noto'g'ri
- "Parol noto'g'ri!" - Parol xato
- "Kompaniya bloklangan!" - Super Admin bloklagan
- "Trial muddat tugadi!" - To'lov qilish kerak

---

## 3. 💾 Ma'lumotlar Himoyasi (Backup)

### 3 xil backup usuli:

#### A) JSON Backup (To'liq)
Barcha ma'lumotlar bitta faylda:
```javascript
import BackupService from './utils/backupService';

// Yuklab olish
const result = await BackupService.exportCompanyData(companyId);
BackupService.downloadBackup(result.backup, "backup.json");
```

#### B) CSV Export (Excel uchun)
```javascript
// Mahsulotlar
await BackupService.exportToCSV(companyId, 'products');

// Tranzaksiyalar
await BackupService.exportToCSV(companyId, 'transactions');

// Qarzdorlar
await BackupService.exportToCSV(companyId, 'debtors');
```

#### C) Cloud Backup (Firebase'ga)
```javascript
// Saqlash
await BackupService.createAutoBackup(companyId);

// Eski backuplarni tozalash (30 kundan eski)
await BackupService.cleanOldBackups(companyId, 30);
```

### Foydalanish
Dasturda: **Sidebar → Backup**

- "To'liq Backup (JSON)" - Kompyuterga yuklab olish
- "Mahsulotlar (CSV)" - Excel'da ochish mumkin
- "Cloud'ga saqlash" - Firebase serverga saqlash

### Tavsiya
- ✅ Har kuni backup qiling
- ✅ Muhim o'zgarishlardan oldin backup qiling
- ✅ Backup fayllarni xavfsiz joyda saqlang

---

## 4. 📴 Offline Rejim (PWA)

### Bu nima?
Internet bo'lmasa ham dastur ishlaydi!

### Qanday ishlaydi?

1. **Service Worker** - Sahifalarni keshlaydi
2. **IndexedDB** - Firebase ma'lumotlarni lokal saqlaydi
3. **Manifest** - Telefonga o'rnatish mumkin

### Avtomatik yoqilgan:

```javascript
// src/firebase.js
import { enableIndexedDbPersistence } from 'firebase/firestore';

enableIndexedDbPersistence(db)
  .then(() => console.log('✅ Offline rejim yoqildi'));
```

### Foydalanuvchi uchun:

1. **Internet bor** - Normal ishlaydi
2. **Internet uzildi** - Sariq banner ko'rinadi
3. **Offline paytda** - Oxirgi ma'lumotlar ko'rinadi
4. **Internet qaytdi** - Avtomatik sync

### Telefonga o'rnatish (PWA):

**Android (Chrome):**
1. Saytni oching
2. ⋮ (3 nuqta) → "Add to Home screen"
3. "Install" bosing

**iPhone (Safari):**
1. Saytni oching
2. 📤 (Share) → "Add to Home Screen"
3. "Add" bosing

### Fayllari:
- `public/sw.js` - Service Worker
- `public/manifest.json` - PWA sozlamalari
- `index.html` - PWA meta taglar

---

## 5. 📦 Inventarizatsiya

### Bu nima?
Ombordagi mahsulotlarni sanab, sistemadagi son bilan solishtirish.

### Qachon kerak?
- Oyiga 1 marta (tavsiya)
- Yo'qotish/o'g'irlik shubhasi bo'lsa
- Yil oxirida (majburiy)

### Qanday foydalanish?

**Sidebar → Inventarizatsiya**

1. **"Yangi inventarizatsiya"** bosing
2. Mahsulotlarni sanang:
   - Barcode skanerlang
   - Yoki "Barchasini qo'shish"
3. Haqiqiy sonni kiriting
4. Farqlarni ko'ring
5. **"Saqlash"** bosing

### Ekran:

```
┌─────────────────────────────────────────────┐
│ Mahsulot nomi    │ Sistemada │ Haqiqiy │ Farq │
├─────────────────────────────────────────────┤
│ iPhone 15        │    10     │   10    │  0   │ ✅
│ Samsung A54      │    15     │   12    │  -3  │ ❌
│ Airpods Pro      │     5     │    7    │  +2  │ ⚠️
└─────────────────────────────────────────────┘
```

### Farqlar:
- **0** (yashil) - To'g'ri
- **Minus** (qizil) - Yo'qotish (o'g'irlik?)
- **Plus** (sariq) - Ortiqcha (kirim qilinmagan?)

### Saqlashda:
- Hisobot saqlanadi
- Ixtiyoriy: Sistemadagi sonlarni yangilash

### Tarixni ko'rish:
- "Tarix" tabida barcha inventarizatsiyalar
- CSV yuklab olish mumkin

---

## 🚀 O'rnatish

### 1. Package'larni o'rnatish
```bash
npm install
```

### 2. Firebase sozlash
`src/firebase.js` faylida config ni o'zgartiring.

### 3. Ishga tushirish
```bash
npm run dev
```

### 4. Build qilish
```bash
npm run build
```

---

## 📁 Yangi Fayllar

```
src/
├── utils/
│   ├── passwordUtils.js   # Parol hashlash
│   ├── authService.js     # Authentication
│   └── backupService.js   # Backup xizmati
├── components/
│   ├── Inventory.jsx      # Inventarizatsiya
│   └── Backup.jsx         # Backup sahifasi
public/
├── sw.js                  # Service Worker
└── manifest.json          # PWA manifest
```

---

## ⚠️ Muhim Eslatmalar

1. **Eski parollar** - Migratsiya qiling!
2. **Backup** - Har kuni qiling!
3. **Offline** - Faqat o'qish ishlaydi, yozish emas
4. **PWA** - HTTPS kerak (localhost ham ishlaydi)

---

## 🆘 Yordam

Muammo bo'lsa:
1. Console'ni tekshiring (F12)
2. Network tabini ko'ring
3. Firebase Console'da xatolarni ko'ring

---

© 2024 CRM Pro
