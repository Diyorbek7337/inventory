import React, { useState, useEffect } from 'react';
import { PackagePlus, FolderPlus, Trash2, Camera, Scan, Eye, EyeOff, Hash, ImagePlus, FileSpreadsheet, Lock, Mic, MicOff, Upload, X } from 'lucide-react';
import { collection, addDoc, updateDoc, doc, deleteDoc, getDocs, query, where, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';
import BarcodeScanner from './BarcodeScanner';
import VisionImport from './VisionImport';
import ExcelImport from './ExcelImport';

const Income = ({ products, categories, onAddProduct, onUpdateProduct, onAddTransaction, onAddCategory, onDeleteCategory, currentUser, isAdmin, companyData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showCostPrices, setShowCostPrices] = useState(false);
  const [barcodeHistory, setBarcodeHistory] = useState([]);
  const [foundBarcodeProduct, setFoundBarcodeProduct] = useState(null);
  const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  const SHOE_SIZES   = ['36','37','38','39','40','41','42','43','44','45'];

  const [newProduct, setNewProduct] = useState({
    name: '',
    artikul: '',
    category: '',
    supplier: '',
    costPrice: '',
    sellingPrice: '',
    barcode: '',
    additionalBarcodes: [],
    quantity: '',
    packSize: '1',
    unit: 'dona',
    expirationDate: '',
    color: '',
    minStock: '5',
    hasSizes: false,
    sizes: {},
    customSize: '',
    hasColors: false,
    colors: [],
    customColor: '',
  });
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);
  // Kirim savatida qaysi mahsulotlar pachka rejimida (id → true)
  const [packModeItems, setPackModeItems] = useState({});
  const [newBarcode, setNewBarcode] = useState('');
  const [showVisionImport, setShowVisionImport] = useState(false);
  const [showExcelImport, setShowExcelImport] = useState(false);
  const [showFormBarcodeScanner, setShowFormBarcodeScanner] = useState(false);

  const PREDEFINED_COLORS = ['Oq','Qora','Ko\'k','Qizil','Yashil','Sariq','Kulrang','Jigarrang','Binafsha','To\'q sariq','Pushti','Moviy'];

  // Rasm va ovoz
  const [productImage, setProductImage] = useState(null);       // compressed Blob
  const [productImagePreview, setProductImagePreview] = useState(''); // dataURL preview
  const [uploadingImage, setUploadingImage] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const imageInputRef = React.useRef(null);

  // Tarif asosida funksiya mavjudligini tekshirish
  const plan = companyData?.plan || 'trial';
  const addOns = companyData?.addOns || {};
  const canUseExcelImport = ['basic', 'pro'].includes(plan) || addOns.excel_import === true;
  const canUseVisionImport = plan === 'pro' || addOns.vision_import === true;

  // EAN-13 barcode generatsiya (200-299 prefix — do'kon ichki foydalanish)
  const generateEAN13 = () => {
    const body = '200' + String(Date.now()).slice(-9);
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += parseInt(body[i]) * (i % 2 === 0 ? 1 : 3);
    const check = (10 - (sum % 10)) % 10;
    return body + check;
  };

  // Artikul/SKU generatsiya: kategoriya prefiksi + random raqam
  const generateArtikul = () => {
    const prefix = (newProduct.category || 'ART')
      .replace(/\s/g, '').slice(0, 3).toUpperCase() || 'ART';
    const num = Math.floor(Math.random() * 90000) + 10000;
    return `${prefix}-${num}`;
  };

  // Barcode tarixini yuklash
  useEffect(() => {
    loadBarcodeHistory();
  }, [currentUser?.companyId]);

  const loadBarcodeHistory = async () => {
    if (!currentUser?.companyId) return;
    try {
      const q = query(
        collection(db, 'barcodes'),
        where('companyId', '==', currentUser.companyId)
      );
      const snapshot = await getDocs(q);
      setBarcodeHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Barcode tarixi yuklanmadi:', error);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.barcode?.includes(searchTerm) ||
    p.additionalBarcodes?.some(b => b.includes(searchTerm))
  );

  const handleBarcodeScan = async (barcode) => {
    setSearchTerm(barcode);
    
    // Avval mavjud mahsulotlardan qidirish
    const product = products.find(p => 
      p.barcode === barcode || p.additionalBarcodes?.includes(barcode)
    );
    
    if (product) {
      addToCart(product);
      toast.success(`${product.name} topildi va savatga qo'shildi!`);
      return;
    }
    
    // Barcode tarixidan qidirish (tugagan mahsulotlar)
    const historyItem = barcodeHistory.find(h => 
      h.barcode === barcode || h.additionalBarcodes?.includes(barcode)
    );
    
    if (historyItem) {
      // Oldingi mahsulot ma'lumotlarini formga yuklash
      setFoundBarcodeProduct(historyItem);
      setNewProduct({
        ...newProduct,
        name: historyItem.productName || '',
        category: historyItem.category || '',
        packSize: historyItem.packSize || '1',
        unit: historyItem.unit || 'dona',
        barcode: barcode,
        costPrice: '',
        sellingPrice: '',
        quantity: '',
        expirationDate: '',
        color: ''
      });
      setShowAddProduct(true);
      toast.info(`"${historyItem.productName}" - oldingi ma'lumotlar yuklandi!`);
      return;
    }
    
    // Yangi mahsulot
    setNewProduct({ ...newProduct, barcode });
    setShowAddProduct(true);
    toast.warning(`Barcode: ${barcode} - Yangi mahsulot qo'shing!`);
  };

  const addToCart = (product) => {
    const existing = selectedItems.find(item => item.id === product.id);
    if (existing) {
      setSelectedItems(selectedItems.map(item =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setSelectedItems([...selectedItems, { ...product, quantity: 1 }]);
    }
  };

  const updateQuantity = (id, quantity) => {
    if (quantity <= 0) {
      setSelectedItems(selectedItems.filter(item => item.id !== id));
    } else {
      setSelectedItems(selectedItems.map(item =>
        item.id === id ? { ...item, quantity } : item
      ));
    }
  };

  const handleSubmit = async () => {
    if (selectedItems.length === 0) {
      toast.warning('Mahsulot tanlang!');
      return;
    }

    setSaving(true);

    try {
      for (const item of selectedItems) {
        const productRef = doc(db, 'products', item.id);

        // Atomik tranzaksiya — bir vaqtda 2 ta menejer kirim qilsa ham miqdor to'g'ri bo'ladi
        const updatedProduct = await runTransaction(db, async (tx) => {
          const snap = await tx.get(productRef);
          if (!snap.exists()) throw new Error(`"${item.name}" mahsulot topilmadi!`);
          const current = snap.data();

          let newData;
          if (item.size && current.hasSizes) {
            const newSizes = { ...current.sizes, [item.size]: (current.sizes?.[item.size] || 0) + item.quantity };
            const newQuantity = Object.values(newSizes).reduce((s, v) => s + (Number(v) || 0), 0);
            newData = { sizes: newSizes, quantity: newQuantity };
          } else {
            newData = { quantity: current.quantity + item.quantity };
          }

          tx.update(productRef, newData);
          return { ...current, id: item.id, ...newData };
        });

        onUpdateProduct(updatedProduct);

        const transactionData = {
          productId: item.id,
          productName: item.name,
          type: 'kirim',
          quantity: item.quantity,
          costPrice: item.costPrice || 0,
          sellingPrice: item.sellingPrice || item.price,
          price: item.sellingPrice || item.price,
          totalAmount: item.quantity * (item.costPrice || 0),
          companyId: currentUser.companyId,
          createdBy: currentUser.id,
          date: new Date()
        };

        const docRef = await addDoc(collection(db, 'transactions'), transactionData);
        onAddTransaction({ id: docRef.id, ...transactionData });
      }

      setSelectedItems([]);
      toast.success('Kirim muvaffaqiyatli qilindi!');
    } catch (error) {
      console.error('Xato:', error);
      toast.error('Xatolik yuz berdi!');
    }
    setSaving(false);
  };

  // Vision/Excel import: o'qilgan mahsulotlarni qayta ishlash
  const handleBulkImport = async (importedItems, sourceLabel = 'Import') => {
    setShowVisionImport(false);
    setShowExcelImport(false);

    const maxProducts = companyData?.maxProducts || 50;
    if (products.length >= maxProducts) {
      toast.error(`Tarif limiti: ${maxProducts} ta mahsulot. Tarifni yangilang!`);
      return;
    }

    setSaving(true);
    let addedCount = 0;
    const newProductsForState = [];
    const newCartItems = [];

    try {
      for (const item of importedItems) {
        // Mavjud mahsulotlardan qidirish (nom bo'yicha)
        const existing = products.find(
          p => p.name.trim().toLowerCase() === item.name.trim().toLowerCase()
        );

        if (existing) {
          const qty = parseInt(item.quantity) || 1;
          newCartItems.push({ existing: true, product: existing, qty });
          addedCount++;
        } else {
          // Limit tekshirish
          if (products.length + newProductsForState.length >= maxProducts) {
            toast.warning(`${maxProducts} ta mahsulot limitiga yetildi. Qolganlar qo'shilmadi.`);
            break;
          }
          const productData = {
            name: item.name.trim(),
            category: item.category || 'Umumiy',
            costPrice: parseFloat(item.costPrice) || 0,
            sellingPrice: parseFloat(item.sellingPrice) || 0,
            price: parseFloat(item.sellingPrice) || 0,
            barcode: item.barcode || '',
            additionalBarcodes: [],
            quantity: 0,
            packSize: parseInt(item.packSize) || 1,
            unit: item.unit || 'dona',
            expirationDate: item.expirationDate || null,
            color: item.color || '',
            minStock: parseInt(item.minStock) || 5,
            companyId: currentUser.companyId,
            createdAt: new Date(),
          };
          const docRef = await addDoc(collection(db, 'products'), productData);
          const newProd = { id: docRef.id, ...productData };
          newProductsForState.push(newProd);
          const qty = parseInt(item.quantity) || 1;
          newCartItems.push({ existing: false, product: newProd, qty });
          addedCount++;
        }
      }

      // Barcha yangi mahsulotlarni birdan state ga qo'shish
      newProductsForState.forEach(p => onAddProduct(p));

      // Savatni yangilash
      setSelectedItems(prev => {
        let updated = [...prev];
        newCartItems.forEach(({ existing, product, qty }) => {
          if (existing) {
            const found = updated.find(s => s.id === product.id);
            if (found) {
              updated = updated.map(s => s.id === product.id ? { ...s, quantity: s.quantity + qty } : s);
            } else {
              updated.push({ ...product, quantity: qty });
            }
          } else {
            updated.push({ ...product, quantity: qty });
          }
        });
        return updated;
      });

      toast.success(`${addedCount} ta mahsulot savatga qo'shildi! (${sourceLabel})`);
    } catch (err) {
      console.error('Import xato:', err);
      toast.error('Import paytida xatolik yuz berdi!');
    }

    setSaving(false);
  };

  const handleVisionImport = (items) => handleBulkImport(items, 'Rasm');
  const handleExcelImport = (items) => handleBulkImport(items, 'Excel');

  // ── Rasm compress (Canvas API, hech qanday kutubxona shart emas) ──────────
  // Rasmni base64 DataURL sifatida qaytaradi (Firestore'ga saqlash uchun)
  const compressImage = (file, maxSize = 400, quality = 0.70) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width  = Math.round(width  * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = URL.createObjectURL(file);
    });

  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const ALLOWED_IMAGE_EXTS  = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const MAX_IMAGE_MB = 10;

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // MIME type tekshirish
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Faqat JPG, PNG, WEBP yoki GIF rasm tanlang!');
      e.target.value = '';
      return;
    }
    // Fayl kengaytmasi tekshirish (MIME spoofing ga qarshi)
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_IMAGE_EXTS.includes(ext)) {
      toast.error('Noto\'g\'ri fayl kengaytmasi!');
      e.target.value = '';
      return;
    }
    // Hajm tekshirish (10 MB dan katta bo'lmasin)
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      toast.error(`Rasm ${MAX_IMAGE_MB} MB dan katta bo'lmasin!`);
      e.target.value = '';
      return;
    }

    const dataUrl = await compressImage(file);
    setProductImage(dataUrl);
    setProductImagePreview(dataUrl);
    const kb = Math.round((dataUrl.length * 3) / 4 / 1024);
    toast.success(`Rasm tayyor: ~${kb} KB (siqilgan)`);
  };

  // Rasm base64 sifatida Firestore'ga saqlanadi (Firebase Storage shart emas)
  const saveProductImage = async (productId) => {
    if (!productImage) return null;
    setUploadingImage(true);
    try {
      await updateDoc(doc(db, 'products', productId), { imageUrl: productImage });
      return productImage;
    } catch (err) {
      console.error('Rasm saqlash xatosi:', err);
      toast.error('Rasm saqlanmadi, lekin mahsulot qo\'shildi.');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  // ── Ovoz orqali kiritish (Web Speech API) ───────────────────────────────
  const startVoiceInput = (field) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast.error('Brauzeringiz ovoz kiritishni qo\'llab-quvvatlamaydi! Chrome yoki Edge ishlatib ko\'ring.');
      return;
    }
    const rec = new SR();
    rec.lang = 'uz-UZ';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    setVoiceActive(true);
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setNewProduct(prev => ({ ...prev, [field]: text }));
      toast.success(`Eshitildi: "${text}"`);
    };
    rec.onerror = () => toast.error('Ovoz kiritishda xato. Mikrofon ruxsatini tekshiring.');
    rec.onend = () => setVoiceActive(false);
    rec.start();
  };

  // Tarif limitini tekshirish
  const checkProductLimit = () => {
    const maxProducts = companyData?.maxProducts || 50; // Trial default: 50
    if (products.length >= maxProducts) {
      toast.error(
        <div>
          <strong>Tarif limiti!</strong>
          <p>Siz {maxProducts} ta mahsulot qo'sha olasiz.</p>
          <p>Tarifni yangilang!</p>
        </div>
      );
      return false;
    }
    return true;
  };

  const addNewProduct = async () => {
    if (!newProduct.name || !newProduct.category || !newProduct.sellingPrice) {
      toast.error('Majburiy maydonlarni to\'ldiring!');
      return;
    }

    // Tarif limitini tekshirish
    if (!checkProductLimit()) {
      return;
    }

    setSaving(true);

    try {
      const productData = {
        name: newProduct.name,
        artikul: newProduct.artikul || '',
        supplier: newProduct.supplier || '',
        category: newProduct.category,
        costPrice: parseFloat(newProduct.costPrice) || 0,
        sellingPrice: parseFloat(newProduct.sellingPrice),
        price: parseFloat(newProduct.sellingPrice),
        barcode: newProduct.barcode,
        additionalBarcodes: newProduct.additionalBarcodes || [],
        packSize: parseInt(newProduct.packSize) || 1,
        unit: newProduct.unit || 'dona',
        expirationDate: newProduct.expirationDate || null,
        color: newProduct.color || '',
        colors: newProduct.hasColors ? newProduct.colors : [],
        hasColors: newProduct.hasColors || false,
        minStock: parseInt(newProduct.minStock) || 5,
        hasSizes: newProduct.hasSizes || false,
        sizes: newProduct.hasSizes
          ? Object.fromEntries(
              Object.entries(newProduct.sizes)
                .filter(([, v]) => parseInt(v) > 0)
                .map(([k, v]) => [k, parseInt(v)])
            )
          : {},
        quantity: newProduct.hasSizes
          ? Object.values(newProduct.sizes).reduce((s, v) => s + (parseInt(v) || 0), 0)
          : (parseInt(newProduct.quantity) || 0),
        companyId: currentUser.companyId,
        createdAt: new Date()
      };

      const docRef = await addDoc(collection(db, 'products'), productData);

      // Rasm Firestore'ga base64 sifatida saqlanadi
      const imageUrl = await saveProductImage(docRef.id);
      if (imageUrl) {
        productData.imageUrl = imageUrl;
      }

      onAddProduct({ id: docRef.id, ...productData });

      // Boshlang'ich qoldiq bo'lsa — kirim tranzaksiyasi yaratish
      const initialQty = productData.quantity;
      if (initialQty > 0) {
        const txData = {
          productId: docRef.id,
          productName: productData.name,
          type: 'kirim',
          quantity: initialQty,
          costPrice: productData.costPrice,
          sellingPrice: productData.sellingPrice,
          price: productData.sellingPrice,
          totalAmount: initialQty * productData.costPrice,
          companyId: currentUser.companyId,
          createdBy: currentUser.id,
          date: new Date()
        };
        const txRef = await addDoc(collection(db, 'transactions'), txData);
        onAddTransaction({ id: txRef.id, ...txData });
      }

      // Barcode tarixiga saqlash (keyinchalik eslab qolish uchun)
      if (newProduct.barcode) {
        await addDoc(collection(db, 'barcodes'), {
          barcode: newProduct.barcode,
          additionalBarcodes: newProduct.additionalBarcodes || [],
          productName: newProduct.name,
          category: newProduct.category,
          packSize: parseInt(newProduct.packSize) || 1,
          unit: newProduct.unit || 'dona',
          companyId: currentUser.companyId,
          createdAt: new Date()
        });
        loadBarcodeHistory(); // Tarixni yangilash
      }

      setNewProduct({
        name: '', artikul: '', supplier: '', category: '', costPrice: '', sellingPrice: '',
        barcode: '', additionalBarcodes: [], quantity: '',
        packSize: '1', unit: 'dona', expirationDate: '', color: '', minStock: '5',
        hasSizes: false, sizes: {}, customSize: '',
        hasColors: false, colors: [], customColor: '',
      });
      setProductImage(null);
      setProductImagePreview('');
      if (imageInputRef.current) imageInputRef.current.value = '';
      setFoundBarcodeProduct(null);
      setShowAddProduct(false);
      toast.success('Mahsulot qo\'shildi!');
    } catch (error) {
      console.error('Xato:', error);
      toast.error('Xatolik yuz berdi!');
    }
    setSaving(false);
  };

  const addNewCategory = async () => {
    if (!newCategory.trim()) {
      toast.error('Kategoriya nomini kiriting!');
      return;
    }

    if (categories.some(c => c.name.toLowerCase() === newCategory.trim().toLowerCase())) {
      toast.error('Bu kategoriya allaqachon mavjud!');
      return;
    }

    setSaving(true);
    try {
      const categoryData = {
        name: newCategory.trim(),
        companyId: currentUser.companyId,
        createdAt: new Date()
      };

      const docRef = await addDoc(collection(db, 'categories'), categoryData);
      onAddCategory({ id: docRef.id, ...categoryData });

      setNewCategory('');
      toast.success('Kategoriya qo\'shildi!');
    } catch (error) {
      console.error('Xato:', error);
      toast.error('Xatolik yuz berdi!');
    }
    setSaving(false);
  };

  const removeCategoryHandler = async (categoryId) => {
    if (window.confirm('Kategoriyani o\'chirmoqchimisiz?')) {
      try {
        await deleteDoc(doc(db, 'categories', categoryId));
        onDeleteCategory(categoryId);
        toast.success('Kategoriya o\'chirildi!');
      } catch (error) {
        console.error('Xato:', error);
        toast.error('Xatolik yuz berdi!');
      }
    }
  };

  // Foyda hisoblash
  const calculateProfit = (costPrice, sellingPrice) => {
    if (!costPrice || !sellingPrice) return { amount: 0, percent: 0 };
    const amount = sellingPrice - costPrice;
    const percent = ((amount / costPrice) * 100).toFixed(1);
    return { amount, percent };
  };

  const totalAmount = selectedItems.reduce((sum, item) => sum + (item.quantity * (item.sellingPrice || item.price)), 0);

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Kirim qilish</h2>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowCostPrices(!showCostPrices)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                showCostPrices 
                  ? 'bg-amber-100 text-amber-700 border border-amber-300' 
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              {showCostPrices ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="hidden sm:inline">Tannarx</span>
            </button>
          )}
          <button
            onClick={() => setShowAddCategory(!showAddCategory)}
            className="flex items-center gap-2 px-4 py-2 text-white bg-violet-600 rounded-xl hover:bg-violet-700 active:scale-95 transition-all"
          >
            <FolderPlus className="w-5 h-5" />
            <span className="hidden sm:inline">Kategoriya</span>
          </button>
          <button
            onClick={() => setShowAddProduct(!showAddProduct)}
            className="flex items-center gap-2 px-4 py-2 text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 active:scale-95 transition-all"
          >
            <PackagePlus className="w-5 h-5" />
            <span className="hidden sm:inline">Mahsulot</span>
          </button>
          {/* Excel import tugmasi (Basic+ yoki add-on) */}
          {canUseExcelImport ? (
            <button
              onClick={() => setShowExcelImport(true)}
              className="flex items-center gap-2 px-4 py-2 text-white bg-teal-600 rounded-xl hover:bg-teal-700 active:scale-95 transition-all"
              title="Excel/CSV orqali mahsulot kiritish"
            >
              <FileSpreadsheet className="w-5 h-5" />
              <span className="hidden sm:inline">Excel</span>
            </button>
          ) : (
            <button
              onClick={() => toast.info('Excel import Asosiy tarif va undan yuqorida mavjud. Sozlamalar → Tarifni yangilang yoki add-on oling.')}
              className="flex items-center gap-2 px-4 py-2 text-slate-400 bg-slate-100 rounded-xl cursor-pointer border border-slate-200 transition-all"
              title="Asosiy tarif kerak"
            >
              <FileSpreadsheet className="w-5 h-5" />
              <Lock className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Vision Import tugmasi (Pro+ yoki add-on) */}
          {canUseVisionImport ? (
            <button
              onClick={() => setShowVisionImport(true)}
              className="flex items-center gap-2 px-4 py-2 text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 active:scale-95 transition-all"
              title="Rasm/kamera orqali mahsulot kiritish (AI OCR)"
            >
              <ImagePlus className="w-5 h-5" />
              <span className="hidden sm:inline">Rasm</span>
            </button>
          ) : (
            <button
              onClick={() => toast.info('Rasm orqali import Professional tarif yoki add-on talab qiladi. Sozlamalar → Add-on.')}
              className="flex items-center gap-2 px-4 py-2 text-slate-400 bg-slate-100 rounded-xl cursor-pointer border border-slate-200 transition-all"
              title="Professional tarif kerak"
            >
              <ImagePlus className="w-5 h-5" />
              <Lock className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Kategoriya qo'shish */}
      {showAddCategory && (
        <div className="p-4 mb-6 border border-violet-200 rounded-2xl bg-violet-50">
          <h3 className="mb-3 font-bold text-violet-900">Yangi kategoriya</h3>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Kategoriya nomi"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addNewCategory()}
              className="flex-1 px-4 py-2 border border-violet-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
            <button
              onClick={addNewCategory}
              disabled={saving}
              className="px-6 py-2 text-white bg-violet-600 rounded-xl hover:bg-violet-700 disabled:opacity-50"
            >
              Qo'shish
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-violet-200 rounded-lg">
                <span className="text-sm font-medium">{cat.name}</span>
                <button onClick={() => removeCategoryHandler(cat.id)} className="text-rose-500 hover:text-rose-700">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mahsulot qo'shish */}
      {showAddProduct && (
        <div className="p-4 mb-6 border border-emerald-200 rounded-2xl bg-emerald-50">
          <h3 className="mb-4 font-bold text-emerald-900 flex items-center gap-2">
            <PackagePlus className="w-5 h-5" />
            {foundBarcodeProduct ? `"${foundBarcodeProduct.productName}" qayta qo'shish` : 'Yangi mahsulot qo\'shish'}
          </h3>
          
          {foundBarcodeProduct && (
            <div className="mb-4 p-3 bg-blue-100 border border-blue-300 rounded-xl">
              <p className="text-sm text-blue-800">
                ℹ️ Bu barcode avval "{foundBarcodeProduct.productName}" uchun ishlatilgan. Ma'lumotlar avtomatik yuklandi.
              </p>
            </div>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Mahsulot nomi + ovoz */}
            <div className="relative flex gap-2 items-center">
              <input
                type="text"
                placeholder="Mahsulot nomi *"
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                className="flex-1 px-4 py-2.5 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => startVoiceInput('name')}
                title="Ovoz bilan kiritish"
                className={`shrink-0 p-2.5 rounded-xl transition-all ${
                  voiceActive
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                }`}
              >
                {voiceActive ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </div>
            <select
              value={newProduct.category}
              onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
              className="px-4 py-2.5 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="">Kategoriya *</option>
              {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
            </select>
            
            {/* Artikul/SKU + generatsiya */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Artikul / SKU"
                value={newProduct.artikul}
                onChange={(e) => setNewProduct({ ...newProduct, artikul: e.target.value })}
                className="flex-1 px-4 py-2.5 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setNewProduct(p => ({ ...p, artikul: generateArtikul() }))}
                title="Avtomatik yaratish"
                className="shrink-0 px-3 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 active:scale-95 transition-all text-xs font-semibold whitespace-nowrap"
              >
                Auto
              </button>
            </div>

            {/* Barcode + kamera + generatsiya */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Barcode (EAN-13)"
                value={newProduct.barcode}
                onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value })}
                className="flex-1 px-4 py-2.5 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setNewProduct(p => ({ ...p, barcode: generateEAN13() }))}
                title="EAN-13 barcode yaratish"
                className="shrink-0 px-3 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 active:scale-95 transition-all text-xs font-semibold whitespace-nowrap"
              >
                Auto
              </button>
              <button
                type="button"
                onClick={() => setShowFormBarcodeScanner(true)}
                title="Kamera bilan skanerlash"
                className="shrink-0 p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 active:scale-95 transition-all"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>

            {/* Yetkazib beruvchi */}
            <input
              type="text"
              placeholder="Yetkazib beruvchi (supplier)"
              value={newProduct.supplier}
              onChange={(e) => setNewProduct({ ...newProduct, supplier: e.target.value })}
              className="px-4 py-2.5 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            
            {/* Narxlar */}
            {isAdmin && (
              <input
                type="number"
                placeholder="Tannarx (kelish narxi)"
                value={newProduct.costPrice}
                onChange={(e) => {
                  const cost = e.target.value;
                  setNewProduct(prev => {
                    // Foiz bo'lsa sotuv narxini avtomatik hisoblash
                    const pct = parseFloat(prev._markupPct);
                    const selling = cost && pct
                      ? String(Math.round(parseFloat(cost) * (1 + pct / 100)))
                      : prev.sellingPrice;
                    return { ...prev, costPrice: cost, sellingPrice: selling };
                  });
                }}
                className="px-4 py-2.5 border border-amber-200 bg-amber-50 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            )}
            {/* Foiz orqali sotuv narxi */}
            {isAdmin && newProduct.costPrice && (
              <div className="flex gap-1 items-center">
                {[10,20,30,50].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setNewProduct(prev => ({
                      ...prev,
                      _markupPct: String(pct),
                      sellingPrice: String(Math.round(parseFloat(prev.costPrice) * (1 + pct / 100)))
                    }))}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                      newProduct._markupPct === String(pct)
                        ? 'bg-violet-600 text-white'
                        : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                    }`}
                  >+{pct}%</button>
                ))}
                <input
                  type="number"
                  placeholder="%"
                  value={newProduct._markupPct || ''}
                  onChange={(e) => {
                    const pct = e.target.value;
                    setNewProduct(prev => ({
                      ...prev,
                      _markupPct: pct,
                      sellingPrice: prev.costPrice && pct
                        ? String(Math.round(parseFloat(prev.costPrice) * (1 + parseFloat(pct) / 100)))
                        : prev.sellingPrice
                    }));
                  }}
                  className="w-16 px-2 py-1 border border-violet-200 rounded-lg text-xs text-center"
                  min="1"
                />
                <span className="text-xs text-slate-400">%</span>
              </div>
            )}
            <input
              type="number"
              placeholder="Sotuv narxi *"
              value={newProduct.sellingPrice}
              onChange={(e) => setNewProduct({ ...newProduct, sellingPrice: e.target.value, _markupPct: '' })}
              className="px-4 py-2.5 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            
            {/* Variativ togglelar */}
            <div className="col-span-full flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setNewProduct(p => ({ ...p, hasSizes: !p.hasSizes, sizes: {}, quantity: '' }))}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                  newProduct.hasSizes
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white text-violet-700 border-violet-300 hover:bg-violet-50'
                }`}
              >
                <span>{newProduct.hasSizes ? '✓' : '+'}</span>
                Razmerli (S/M/L/XL...)
              </button>
              <button
                type="button"
                onClick={() => setNewProduct(p => ({ ...p, hasColors: !p.hasColors, colors: [], customColor: '' }))}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                  newProduct.hasColors
                    ? 'bg-pink-600 text-white border-pink-600'
                    : 'bg-white text-pink-700 border-pink-300 hover:bg-pink-50'
                }`}
              >
                <span>{newProduct.hasColors ? '✓' : '+'}</span>
                Rangli variantlar
              </button>
            </div>

            {/* Rang variativligi */}
            {newProduct.hasColors && (
              <div className="col-span-full p-4 bg-pink-50 border border-pink-200 rounded-2xl space-y-3">
                <p className="text-sm font-semibold text-pink-700">Ranglarni tanlang yoki qo'shing</p>
                {/* Tezkor ranglar */}
                <div className="flex flex-wrap gap-2">
                  {PREDEFINED_COLORS.map(color => {
                    const selected = newProduct.colors.includes(color);
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewProduct(p => ({
                          ...p,
                          colors: selected
                            ? p.colors.filter(c => c !== color)
                            : [...p.colors, color]
                        }))}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                          selected
                            ? 'bg-pink-600 text-white border-pink-600'
                            : 'bg-white text-pink-700 border-pink-300 hover:bg-pink-100'
                        }`}
                      >
                        {selected && '✓ '}{color}
                      </button>
                    );
                  })}
                </div>
                {/* Maxsus rang */}
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Boshqa rang (masalan: Kumush)"
                    value={newProduct.customColor}
                    onChange={e => setNewProduct(p => ({ ...p, customColor: e.target.value }))}
                    className="flex-1 px-3 py-1.5 border border-pink-200 rounded-lg text-sm bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const c = (newProduct.customColor || '').trim();
                      if (!c || newProduct.colors.includes(c)) return;
                      setNewProduct(p => ({ ...p, colors: [...p.colors, c], customColor: '' }));
                    }}
                    className="px-3 py-1.5 bg-pink-600 text-white rounded-lg text-sm hover:bg-pink-700"
                  >Qo'shish</button>
                </div>
                {/* Tanlangan ranglar */}
                {newProduct.colors.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {newProduct.colors.map(c => (
                      <span key={c} className="flex items-center gap-1 px-2.5 py-1 bg-pink-100 text-pink-800 rounded-lg text-sm font-medium">
                        {c}
                        <button
                          type="button"
                          onClick={() => setNewProduct(p => ({ ...p, colors: p.colors.filter(x => x !== c) }))}
                          className="text-pink-400 hover:text-pink-700 ml-0.5"
                        >×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Razmer bo'yicha miqdor */}
            {newProduct.hasSizes ? (
              <div className="col-span-full p-4 bg-violet-50 border border-violet-200 rounded-2xl space-y-3">
                <p className="text-sm font-semibold text-violet-700">Har razmerdan nechta?</p>
                {/* Standart razmerlar */}
                <div>
                  <p className="text-xs text-slate-500 mb-2">Kiyim razmerilari</p>
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_SIZES.map(size => (
                      <div key={size} className="flex items-center gap-1">
                        <label className="text-xs font-bold text-violet-700 w-8 text-center">{size}</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={newProduct.sizes[size] || ''}
                          onChange={e => setNewProduct(p => ({
                            ...p,
                            sizes: { ...p.sizes, [size]: e.target.value }
                          }))}
                          className="w-14 px-2 py-1.5 border border-violet-200 rounded-lg text-sm text-center focus:ring-2 focus:ring-violet-400 bg-white"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                {/* Poyabzal razmerilari */}
                <div>
                  <p className="text-xs text-slate-500 mb-2">Poyabzal razmerilari</p>
                  <div className="flex flex-wrap gap-2">
                    {SHOE_SIZES.map(size => (
                      <div key={size} className="flex items-center gap-1">
                        <label className="text-xs font-bold text-violet-700 w-6 text-center">{size}</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={newProduct.sizes[size] || ''}
                          onChange={e => setNewProduct(p => ({
                            ...p,
                            sizes: { ...p.sizes, [size]: e.target.value }
                          }))}
                          className="w-14 px-2 py-1.5 border border-violet-200 rounded-lg text-sm text-center focus:ring-2 focus:ring-violet-400 bg-white"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                {/* Maxsus razmer */}
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Boshqa razmer (masalan: 52)"
                    value={newProduct.customSize || ''}
                    onChange={e => setNewProduct(p => ({ ...p, customSize: e.target.value }))}
                    className="w-44 px-3 py-1.5 border border-violet-200 rounded-lg text-sm bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const s = (newProduct.customSize || '').trim().toUpperCase();
                      if (!s) return;
                      setNewProduct(p => ({ ...p, sizes: { ...p.sizes, [s]: '' }, customSize: '' }));
                    }}
                    className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700"
                  >Qo'shish</button>
                  {/* Mavjud razmerlar yig'indisi */}
                  {Object.values(newProduct.sizes).some(v => parseInt(v) > 0) && (
                    <span className="text-xs text-violet-600 font-semibold ml-2">
                      Jami: {Object.values(newProduct.sizes).reduce((s,v)=>s+(parseInt(v)||0),0)} dona
                    </span>
                  )}
                </div>
              </div>
            ) : (
              /* Oddiy miqdor */
              <input
                type="number"
                placeholder="Boshlang'ich miqdor"
                value={newProduct.quantity}
                onChange={(e) => setNewProduct({ ...newProduct, quantity: e.target.value })}
                className="px-4 py-2.5 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            )}
            
            {/* Pachka/dona */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex flex-col w-28">
                  <label className="text-xs text-slate-500 mb-1 pl-1">1 pachkada</label>
                  <input
                    type="number"
                    placeholder="1"
                    min="1"
                    value={newProduct.packSize}
                    onChange={(e) => setNewProduct({ ...newProduct, packSize: e.target.value })}
                    className="px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                    title="1 pachkada nechta dona bor?"
                  />
                </div>
                <div className="flex flex-col flex-1">
                  <label className="text-xs text-slate-500 mb-1 pl-1">O'lchov birligi</label>
                  <select
                    value={newProduct.unit}
                    onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                    className="px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="dona">Dona</option>
                    <option value="kg">Kilogram</option>
                    <option value="litr">Litr</option>
                    <option value="metr">Metr</option>
                    <option value="quti">Quti</option>
                  </select>
                </div>
              </div>
              {/* Pachka helper — faqat packSize > 1 bo'lganda */}
              {parseInt(newProduct.packSize) > 1 && !newProduct.hasSizes && (
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-violet-700 mb-2">
                    📦 Pachka rejimi — nechta pachka keldi?
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="0"
                      min="0"
                      value={newProduct._pachkaCount || ''}
                      onChange={(e) => {
                        const pachka = parseInt(e.target.value) || 0;
                        const packSz = parseInt(newProduct.packSize) || 1;
                        setNewProduct(prev => ({
                          ...prev,
                          _pachkaCount: e.target.value,
                          quantity: String(pachka * packSz),
                        }));
                      }}
                      className="w-24 px-3 py-2 border border-violet-300 rounded-xl focus:ring-2 focus:ring-violet-500 text-center font-bold"
                    />
                    <span className="text-sm text-violet-600 font-medium">pachka</span>
                    {parseInt(newProduct._pachkaCount) > 0 && (
                      <span className="text-sm text-violet-700 font-semibold">
                        = {parseInt(newProduct._pachkaCount) * parseInt(newProduct.packSize)} dona
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-violet-500 mt-1.5">
                    1 pachka = {newProduct.packSize} dona · Jami: {newProduct.quantity || 0} dona saqlanadi
                  </p>
                </div>
              )}
            </div>
            
            {/* Amal qilish muddati */}
            <div className="relative">
              <label className="absolute -top-2 left-3 px-1 bg-emerald-50 text-xs text-slate-500">Amal qilish muddati</label>
              <input
                type="date"
                value={newProduct.expirationDate}
                onChange={(e) => setNewProduct({ ...newProduct, expirationDate: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            
            {/* Rang */}
            <input
              type="text"
              placeholder="Rang (ixtiyoriy)"
              value={newProduct.color}
              onChange={(e) => setNewProduct({ ...newProduct, color: e.target.value })}
              className="px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            
            {/* Minimal qoldiq */}
            <div className="relative">
              <label className="absolute -top-2 left-3 px-1 bg-emerald-50 text-xs text-slate-500">Min. qoldiq (ogohlantirish)</label>
              <input
                type="number"
                value={newProduct.minStock}
                onChange={(e) => setNewProduct({ ...newProduct, minStock: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {/* Mahsulot rasmi */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-1.5">
              <svg viewBox="0 0 20 20" className="w-4 h-4 text-emerald-600" fill="currentColor">
                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
              </svg>
              Mahsulot rasmi
              <span className="text-xs text-slate-400 font-normal">(ixtiyoriy)</span>
            </label>

            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />

            {productImagePreview ? (
              /* Rasm tanlangan */
              <div className="flex items-center gap-3 p-3 bg-emerald-50 border-2 border-emerald-200 rounded-2xl">
                <div className="relative flex-shrink-0">
                  <img
                    src={productImagePreview}
                    alt="Preview"
                    className="w-16 h-16 object-cover rounded-xl border-2 border-emerald-200 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => { setProductImage(null); setProductImagePreview(''); if (imageInputRef.current) imageInputRef.current.value = ''; }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center hover:bg-rose-600 shadow"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-emerald-700 flex items-center gap-1">
                    <span>✓</span> Rasm tanlandi
                  </p>
                  {productImage && (
                    <p className="text-xs text-emerald-500 mt-0.5">
                      {(productImage.size / 1024).toFixed(0)} KB · avtomatik siqiladi
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="mt-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium underline underline-offset-2"
                  >
                    Boshqa rasm tanlash
                  </button>
                </div>
              </div>
            ) : (
              /* Rasm tanlanmagan */
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="w-full flex items-center gap-4 p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl hover:border-emerald-400 hover:bg-emerald-50/40 transition-all group"
              >
                {/* Rasm ikonkasi */}
                <div className="w-14 h-14 bg-slate-200 group-hover:bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors relative">
                  <svg viewBox="0 0 48 48" className="w-9 h-9" fill="none">
                    <rect x="4" y="10" width="40" height="28" rx="5" fill="#cbd5e1" className="group-hover:fill-emerald-200 transition-colors" />
                    <circle cx="15" cy="20" r="4" fill="#94a3b8" />
                    <path d="M4 34 L13 24 L21 30 L30 20 L44 34" stroke="#94a3b8" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
                  </svg>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                    <Upload className="w-2.5 h-2.5 text-white" />
                  </div>
                </div>
                {/* Matn */}
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-600 group-hover:text-emerald-700 transition-colors">
                    Rasm yuklash uchun bosing
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">JPG, PNG, WebP · max 5MB</p>
                  <p className="text-xs text-slate-400">Rasm avtomatik siqiladi</p>
                </div>
              </button>
            )}
          </div>

          {/* Qo'shimcha barcode */}
          <div className="mt-4 p-3 bg-slate-100 rounded-xl">
            <p className="text-sm text-slate-600 mb-2 flex items-center gap-1">
              <Hash className="w-4 h-4" />
              Qo'shimcha barcode (agar boshqa barcode ham bo'lsa)
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Qo'shimcha barcode"
                value={newBarcode}
                onChange={(e) => setNewBarcode(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  if (newBarcode && !newProduct.additionalBarcodes.includes(newBarcode)) {
                    setNewProduct({
                      ...newProduct,
                      additionalBarcodes: [...newProduct.additionalBarcodes, newBarcode]
                    });
                    setNewBarcode('');
                  }
                }}
                className="px-3 py-2 bg-slate-600 text-white rounded-lg text-sm hover:bg-slate-700"
              >
                Qo'shish
              </button>
            </div>
            {newProduct.additionalBarcodes?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {newProduct.additionalBarcodes.map((bc, idx) => (
                  <span key={idx} className="px-2 py-1 bg-white rounded text-xs flex items-center gap-1">
                    {bc}
                    <button 
                      onClick={() => setNewProduct({
                        ...newProduct,
                        additionalBarcodes: newProduct.additionalBarcodes.filter((_, i) => i !== idx)
                      })}
                      className="text-rose-500 hover:text-rose-700"
                    >×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
          
          {/* Foyda hisoblash preview */}
          {isAdmin && newProduct.costPrice && newProduct.sellingPrice && (
            <div className="mt-4 p-3 bg-amber-100 border border-amber-300 rounded-xl">
              <p className="text-sm text-amber-800">
                <span className="font-medium">Foyda: </span>
                {calculateProfit(parseFloat(newProduct.costPrice), parseFloat(newProduct.sellingPrice)).amount.toLocaleString()} so'm 
                <span className="ml-2 text-amber-600">
                  ({calculateProfit(parseFloat(newProduct.costPrice), parseFloat(newProduct.sellingPrice)).percent}%)
                </span>
              </p>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <button
              onClick={addNewProduct}
              disabled={saving}
              className="px-6 py-2.5 text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 active:scale-95 transition-all"
            >
              {saving ? 'Saqlanmoqda...' : 'Qo\'shish'}
            </button>
            <button
              onClick={() => {
                setShowAddProduct(false);
                setFoundBarcodeProduct(null);
                setNewProduct({ 
                  name: '', category: '', costPrice: '', sellingPrice: '', 
                  barcode: '', additionalBarcodes: [], quantity: '', 
                  packSize: '1', unit: 'dona', expirationDate: '', color: '', minStock: '5' 
                });
              }}
              className="px-6 py-2.5 text-slate-600 bg-slate-200 rounded-xl hover:bg-slate-300"
            >
              Bekor qilish
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mahsulotlar ro'yxati */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 lg:p-6">
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Scan className="absolute w-5 h-5 text-slate-400 left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Barcode yoki mahsulot qidirish..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && searchTerm) {
                    const product = products.find(p => p.barcode === searchTerm);
                    if (product) handleBarcodeScan(searchTerm);
                  }
                }}
                className="w-full py-2.5 pl-10 pr-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowScanner(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-white bg-cyan-600 rounded-xl hover:bg-cyan-700 active:scale-95 transition-all"
            >
              <Camera className="w-5 h-5" />
              <span className="hidden sm:inline">Kamera</span>
            </button>
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[400px]">
            {filteredProducts.length === 0 ? (
              <p className="py-8 text-center text-slate-500">Mahsulot topilmadi</p>
            ) : (
              filteredProducts.map(product => (
                <div
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="flex items-center justify-between p-4 border border-slate-100 rounded-xl cursor-pointer hover:bg-emerald-50 hover:border-emerald-200 transition-all active:scale-[0.99]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{product.name}</p>
                    <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                      <span className="px-2 py-0.5 bg-slate-100 rounded-md text-xs">{product.category}</span>
                      {product.barcode && <span className="font-mono text-xs">{product.barcode}</span>}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-bold text-slate-800">{(product.sellingPrice || product.price)?.toLocaleString()} so'm</p>
                    {isAdmin && showCostPrices && product.costPrice && (
                      <p className="text-xs text-amber-600">Tannarx: {product.costPrice.toLocaleString()}</p>
                    )}
                    <p className="text-sm text-slate-500">Omborda: {product.quantity}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Savat */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 lg:p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Tanlangan mahsulotlar</h3>
          
          <div className="space-y-2 overflow-y-auto max-h-64 mb-4">
            {selectedItems.length === 0 ? (
              <p className="py-8 text-sm text-center text-slate-500">Bo'sh</p>
            ) : (
              selectedItems.map(item => {
                const packSz = item.packSize || 1;
                const isPackMode = packModeItems[item.id] && packSz > 1;
                // Pachka rejimida input qiymati = dona / packSize
                const displayQty = isPackMode ? Math.round(item.quantity / packSz) : item.quantity;

                return (
                  <div key={item.id} className={`p-3 rounded-xl border ${isPackMode ? 'border-violet-200 bg-violet-50' : 'border-slate-100'}`}>
                    <div className="flex items-start justify-between mb-2 gap-1">
                      <p className="text-sm font-medium text-slate-800 truncate flex-1">{item.name}</p>
                      {/* Pachka toggle — faqat packSize > 1 bo'lganda */}
                      {packSz > 1 && (
                        <button
                          onClick={() => setPackModeItems(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                          className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium transition-all ${
                            isPackMode
                              ? 'bg-violet-500 text-white'
                              : 'bg-slate-200 text-slate-600 hover:bg-violet-100 hover:text-violet-700'
                          }`}
                          title={`1 pachka = ${packSz} dona`}
                        >
                          📦 Pachka
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            const step = isPackMode ? packSz : 1;
                            updateQuantity(item.id, item.quantity - step);
                          }}
                          className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-lg hover:bg-slate-200 active:scale-95 font-bold"
                        >−</button>
                        <input
                          type="number"
                          value={displayQty}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            updateQuantity(item.id, isPackMode ? val * packSz : val);
                          }}
                          className="w-14 px-2 py-1 text-center border border-slate-200 rounded-lg font-semibold"
                          min="0"
                        />
                        <button
                          onClick={() => {
                            const step = isPackMode ? packSz : 1;
                            updateQuantity(item.id, item.quantity + step);
                          }}
                          className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-lg hover:bg-slate-200 active:scale-95 font-bold"
                        >+</button>
                        <span className="text-xs text-slate-500 ml-1">
                          {isPackMode ? 'pachka' : (item.unit || 'dona')}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-800">
                          {(item.quantity * (item.sellingPrice || item.price)).toLocaleString()}
                        </p>
                        {isPackMode && (
                          <p className="text-xs text-violet-600">
                            = {item.quantity} dona
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-4 space-y-2 border-t border-slate-200">
            <div className="flex justify-between text-lg font-bold">
              <span>Jami:</span>
              <span className="text-emerald-600">{totalAmount.toLocaleString()} so'm</span>
            </div>
            <button
              onClick={handleSubmit}
              disabled={selectedItems.length === 0 || saving}
              className="w-full py-3 font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
            >
              {saving ? 'Saqlanmoqda...' : 'Kirim qilish'}
            </button>
          </div>
        </div>
      </div>

      {showScanner && (
        <BarcodeScanner onScan={handleBarcodeScan} onClose={() => setShowScanner(false)} />
      )}

      {showFormBarcodeScanner && (
        <BarcodeScanner
          onScan={(code) => {
            setNewProduct(p => ({ ...p, barcode: code }));
            setShowFormBarcodeScanner(false);
          }}
          onClose={() => setShowFormBarcodeScanner(false)}
        />
      )}

      {showVisionImport && (
        <VisionImport
          onClose={() => setShowVisionImport(false)}
          onImport={handleVisionImport}
          categories={categories}
          isAdmin={isAdmin}
        />
      )}

      {showExcelImport && (
        <ExcelImport
          onClose={() => setShowExcelImport(false)}
          onImport={handleExcelImport}
          categories={categories}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
};

export default Income;
