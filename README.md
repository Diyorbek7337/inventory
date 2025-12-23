# CRM SaaS - Mobil va Ko'p Kompaniya Uchun Inventory Tizimi

## 🎯 Loyiha haqida

Bu loyiha kichik va o'rta bizneslar uchun mo'ljallangan **SaaS (Software as a Service)** CRM/Inventory tizimi. Ko'plab kompaniyalar bir platformada ishlashi, har bir kompaniya o'z ma'lumotlarini boshqarishi mumkin.

## 👑 SUPER ADMIN PANEL (Sizning Dashboard)

**Bu sizning - platforma egasining boshqaruv panelingiz!**

### Super Admin ga kirish usullari:

1. **Klaviatura:** Login sahifasida `Ctrl + Shift + S` bosing
2. **Yashirin tugma:** Login sahifasida chap pastki burchakni 5 marta bosing

### Super Admin paroli:
```
superadmin2024
```
⚠️ **Muhim:** Bu parolni `SuperAdminLogin.jsx` faylida o'zgartiring!

### Super Admin imkoniyatlari:
- 📊 Barcha kompaniyalar statistikasi
- 👥 Foydalanuvchilar soni
- 💰 Oylik daromad (MRR) hisoblash
- 🏢 Kompaniyalarni bloklash/faollashtirish
- 📈 Tarif rejalarini o'zgartirish
- 🔍 Kompaniya qidirish va filtrlash
- ⚠️ Limitga yaqinlashgan kompaniyalar

## ✨ Asosiy Xususiyatlar

### 📱 Mobil-Responsive Dizayn
- Barcha ekran o'lchamlarida qulay ishlash
- Touch-friendly interfeys
- Mobil uchun sidebar (hamburger menu)

### 💰 Tannarx va Foyda Tizimi
- **Tannarx (Cost Price)** - mahsulotning kelish narxi
- **Sotuv narxi (Selling Price)** - sotish narxi
- **Foyda hisobi** - avtomatik hisoblash
- **Faqat Admin ko'radi** - tannarx va foyda sotuvchilarga ko'rinmaydi

### 🏢 SaaS Multi-Tenant Arxitektura
- Har bir kompaniya alohida
- Kompaniya ro'yxatdan o'tishi
- Tarif rejalari (Free, Basic, Pro)
- Foydalanuvchi limitlari

### 👥 Rol Asosida Kirish
- **Admin** - barcha huquqlar, tannarx va foydani ko'rish
- **Sotuvchi** - asosiy funksiyalar, tannarx ko'rinmaydi

### 📊 Barcode Skaner
- USB scanner qo'llab-quvvatlash
- Kamera orqali skanerlash
- EAN, UPC, QR Code va boshqalar

## 📁 Loyiha Strukturasi

```
crm-saas/
├── src/
│   ├── App.jsx              # Asosiy komponent
│   ├── firebase.js          # Firebase konfiguratsiya
│   └── components/
│       ├── Login.jsx        # Kirish va ro'yxatdan o'tish
│       ├── Sidebar.jsx      # Yon panel (mobil responsive)
│       ├── Dashboard.jsx    # Asosiy sahifa
│       ├── Income.jsx       # Kirim (tannarx + sotuv narx)
│       ├── Outcome.jsx      # Chiqim (sotish)
│       ├── ProductList.jsx  # Mahsulotlar ro'yxati
│       ├── Sales.jsx        # Savdo cheklari
│       ├── Statistics.jsx   # Statistika
│       ├── Users.jsx        # Foydalanuvchilar boshqaruvi
│       ├── CompanySettings.jsx # Kompaniya sozlamalari
│       └── BarcodeScanner.jsx  # Barcode skaner
```

## 🗄️ Firebase Ma'lumotlar Strukturasi

### Companies (Kompaniyalar)
```javascript
{
  name: "Kompaniya nomi",
  phone: "+998901234567",
  email: "info@company.uz",
  address: "Manzil",
  website: "https://company.uz",
  plan: "free", // free | basic | pro | enterprise
  maxUsers: 3,
  maxProducts: 100,
  isActive: true,
  createdAt: Timestamp
}
```

### Users (Foydalanuvchilar)
```javascript
{
  username: "login",
  password: "parol",
  name: "Ism Familiya",
  phone: "+998901234567",
  email: "user@mail.com",
  role: "admin", // admin | sotuvchi
  companyId: "COMPANY_DOC_ID",
  createdAt: Timestamp
}
```

### Products (Mahsulotlar)
```javascript
{
  name: "Mahsulot nomi",
  category: "Kategoriya",
  costPrice: 10000,      // Tannarx (faqat admin ko'radi)
  sellingPrice: 15000,   // Sotuv narxi
  price: 15000,          // (Eski versiya uchun)
  barcode: "1234567890123",
  quantity: 100,
  companyId: "COMPANY_DOC_ID",
  createdAt: Timestamp
}
```

### Transactions (Tranzaksiyalar)
```javascript
{
  saleId: "SALE_ID",
  productId: "PRODUCT_DOC_ID",
  productName: "Mahsulot nomi",
  type: "chiqim", // kirim | chiqim
  quantity: 5,
  costPrice: 10000,      // Tannarx
  sellingPrice: 15000,   // Sotuv narxi
  price: 15000,
  totalAmount: 75000,
  paidAmount: 75000,
  debt: 0,
  customerName: "Mijoz ismi",
  paymentType: "to'liq", // to'liq | qarz
  companyId: "COMPANY_DOC_ID",
  createdBy: "USER_ID",
  date: Timestamp
}
```

### Categories (Kategoriyalar)
```javascript
{
  name: "Kategoriya nomi",
  companyId: "COMPANY_DOC_ID",
  createdAt: Timestamp
}
```

## 🚀 O'rnatish

### 1. Loyihani klonlash
```bash
git clone <repository-url>
cd crm-saas
```

### 2. Paketlarni o'rnatish
```bash
npm install
```

### 3. Firebase konfiguratsiya
`src/firebase.js` faylida o'zingizning Firebase ma'lumotlaringizni kiriting:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 4. Firebase Firestore Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Companies
    match /companies/{companyId} {
      allow read, write: if request.auth != null;
    }
    
    // Users
    match /users/{userId} {
      allow read, write: if true;
    }
    
    // Products
    match /products/{productId} {
      allow read, write: if true;
    }
    
    // Transactions
    match /transactions/{transactionId} {
      allow read, write: if true;
    }
    
    // Categories
    match /categories/{categoryId} {
      allow read, write: if true;
    }
  }
}
```

### 5. Ishga tushirish
```bash
npm run dev
```

## 📦 Kerakli Paketlar

```json
{
  "dependencies": {
    "react": "^18.x",
    "react-dom": "^18.x",
    "firebase": "^10.x",
    "react-toastify": "^9.x",
    "lucide-react": "^0.x",
    "recharts": "^2.x",
    "html5-qrcode": "^2.x"
  },
  "devDependencies": {
    "vite": "^5.x",
    "tailwindcss": "^3.x",
    "@vitejs/plugin-react": "^4.x"
  }
}
```

## 💡 Foydalanish

### Kompaniya ro'yxatdan o'tish
1. Login sahifasida "Ro'yxatdan o'tish" tugmasini bosing
2. Kompaniya ma'lumotlarini kiriting
3. Admin sifatida tizimga kiriladi

### Mahsulot qo'shish (Kirim)
1. "Kirim" bo'limiga o'ting
2. "Mahsulot" tugmasini bosing
3. Tannarx va sotuv narxini kiriting
4. Barcode skanerlash yoki qo'lda kiritish

### Sotish (Chiqim)
1. "Chiqim" bo'limiga o'ting
2. Mahsulotlarni tanlang
3. To'liq yoki qarzga sotish

### Statistika
- Admin: Tannarx, foyda, margin ko'rinadi
- Sotuvchi: Faqat savdo statistikasi

## 📱 Tarif Rejalari

| Reja | Narx | Foydalanuvchilar | Mahsulotlar | Xususiyatlar |
|------|------|------------------|-------------|--------------|
| Free | 0 | 3 | 100 | Asosiy funksiyalar |
| Basic | 99,000 so'm/oy | 10 | 1000 | Telegram integratsiya |
| Pro | 249,000 so'm/oy | Cheksiz | Cheksiz | API, Hisobotlar |

## 🔐 Xavfsizlik

- Session timeout: 30 daqiqa
- Activity tracking
- Role-based access control
- Company isolation (multi-tenancy)

## 📞 Qo'llab-quvvatlash

Savollar va takliflar uchun:
- Telegram: @your_support
- Email: support@your-company.uz

---

**© 2024 CRM SaaS. Barcha huquqlar himoyalangan.**
