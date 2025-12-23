/**
 * Backup Service
 * Ma'lumotlarni himoya qilish va export/import
 */

import { 
  collection, 
  getDocs, 
  addDoc, 
  query, 
  where,
  writeBatch,
  doc
} from 'firebase/firestore';
import { db } from '../firebase';

class BackupService {
  
  /**
   * Kompaniya ma'lumotlarini JSON formatda export qilish
   */
  async exportCompanyData(companyId) {
    try {
      const backup = {
        exportedAt: new Date().toISOString(),
        companyId: companyId,
        version: '1.0',
        data: {}
      };

      // Mahsulotlar
      const productsQuery = query(
        collection(db, 'products'),
        where('companyId', '==', companyId)
      );
      const productsSnap = await getDocs(productsQuery);
      backup.data.products = productsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null
      }));

      // Tranzaksiyalar
      const transQuery = query(
        collection(db, 'transactions'),
        where('companyId', '==', companyId)
      );
      const transSnap = await getDocs(transQuery);
      backup.data.transactions = transSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate?.()?.toISOString() || null
      }));

      // Kategoriyalar
      const catQuery = query(
        collection(db, 'categories'),
        where('companyId', '==', companyId)
      );
      const catSnap = await getDocs(catQuery);
      backup.data.categories = catSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Foydalanuvchilar (parolsiz)
      const usersQuery = query(
        collection(db, 'users'),
        where('companyId', '==', companyId)
      );
      const usersSnap = await getDocs(usersQuery);
      backup.data.users = usersSnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          username: data.username,
          role: data.role,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null
          // password ni export qilmaymiz!
        };
      });

      // Statistika
      backup.stats = {
        productsCount: backup.data.products.length,
        transactionsCount: backup.data.transactions.length,
        categoriesCount: backup.data.categories.length,
        usersCount: backup.data.users.length
      };

      return { success: true, backup };

    } catch (error) {
      console.error('Export error:', error);
      return { success: false, error: 'Export qilishda xatolik!' };
    }
  }

  /**
   * JSON faylni yuklab olish
   */
  downloadBackup(backup, filename) {
    const dataStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Excel formatda export (CSV)
   */
  async exportToCSV(companyId, type = 'products') {
    try {
      let data = [];
      let headers = [];
      let filename = '';

      switch (type) {
        case 'products':
          const productsQuery = query(
            collection(db, 'products'),
            where('companyId', '==', companyId)
          );
          const productsSnap = await getDocs(productsQuery);
          
          headers = ['Nomi', 'Barcode', 'Kategoriya', 'Tannarx', 'Sotish narxi', 'Miqdor', 'Birlik'];
          data = productsSnap.docs.map(doc => {
            const d = doc.data();
            return [d.name, d.barcode, d.category, d.costPrice, d.sellingPrice, d.quantity, d.unit];
          });
          filename = 'mahsulotlar.csv';
          break;

        case 'transactions':
          const transQuery = query(
            collection(db, 'transactions'),
            where('companyId', '==', companyId)
          );
          const transSnap = await getDocs(transQuery);
          
          headers = ['Sana', 'Tur', 'Mahsulot', 'Miqdor', 'Narx', 'Jami', 'Mijoz', 'To\'lov turi'];
          data = transSnap.docs.map(doc => {
            const d = doc.data();
            const date = d.date?.toDate?.() || new Date();
            return [
              date.toLocaleDateString('uz-UZ'),
              d.type,
              d.productName,
              d.quantity,
              d.price,
              d.totalAmount,
              d.customerName,
              d.paymentType
            ];
          });
          filename = 'tranzaksiyalar.csv';
          break;

        case 'debtors':
          const debtQuery = query(
            collection(db, 'transactions'),
            where('companyId', '==', companyId)
          );
          const debtSnap = await getDocs(debtQuery);
          
          // Qarzdorlarni guruhlash
          const debtors = {};
          debtSnap.docs.forEach(doc => {
            const d = doc.data();
            if (d.type === 'chiqim' && d.debt > 0) {
              const key = d.customerName || 'Noma\'lum';
              if (!debtors[key]) {
                debtors[key] = { name: key, phone: d.customerPhone || '', debt: 0 };
              }
              debtors[key].debt += d.debt;
            }
          });
          
          headers = ['Mijoz', 'Telefon', 'Qarz summasi'];
          data = Object.values(debtors).map(d => [d.name, d.phone, d.debt]);
          filename = 'qarzdorlar.csv';
          break;
      }

      // CSV yaratish
      const BOM = '\uFEFF'; // UTF-8 BOM (Excel uchun)
      const csvContent = BOM + [
        headers.join(','),
        ...data.map(row => row.map(cell => `"${cell || ''}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return { success: true };

    } catch (error) {
      console.error('CSV export error:', error);
      return { success: false, error: 'Export qilishda xatolik!' };
    }
  }

  /**
   * Backup'dan restore qilish
   */
  async restoreFromBackup(backup, companyId, options = {}) {
    try {
      const batch = writeBatch(db);
      let restored = { products: 0, categories: 0 };

      // Kategoriyalarni restore qilish
      if (options.categories && backup.data.categories) {
        for (const cat of backup.data.categories) {
          const newCat = {
            name: cat.name,
            companyId: companyId,
            restoredAt: new Date(),
            originalId: cat.id
          };
          const catRef = doc(collection(db, 'categories'));
          batch.set(catRef, newCat);
          restored.categories++;
        }
      }

      // Mahsulotlarni restore qilish
      if (options.products && backup.data.products) {
        for (const product of backup.data.products) {
          const newProduct = {
            name: product.name,
            barcode: product.barcode,
            category: product.category,
            costPrice: product.costPrice || 0,
            sellingPrice: product.sellingPrice || 0,
            quantity: product.quantity || 0,
            unit: product.unit || 'dona',
            companyId: companyId,
            restoredAt: new Date(),
            originalId: product.id
          };
          const productRef = doc(collection(db, 'products'));
          batch.set(productRef, newProduct);
          restored.products++;
        }
      }

      await batch.commit();

      return { success: true, restored };

    } catch (error) {
      console.error('Restore error:', error);
      return { success: false, error: 'Restore qilishda xatolik!' };
    }
  }

  /**
   * Avtomatik backup Firebase'ga
   */
  async createAutoBackup(companyId) {
    try {
      const backup = await this.exportCompanyData(companyId);
      
      if (!backup.success) {
        return backup;
      }

      // Backup'ni alohida collection'ga saqlash
      await addDoc(collection(db, 'backups'), {
        companyId: companyId,
        createdAt: new Date(),
        data: JSON.stringify(backup.backup),
        stats: backup.backup.stats
      });

      return { success: true, message: 'Backup yaratildi!' };

    } catch (error) {
      console.error('Auto backup error:', error);
      return { success: false, error: 'Backup yaratishda xatolik!' };
    }
  }

  /**
   * Eski backup'larni o'chirish (30 kundan eski)
   */
  async cleanOldBackups(companyId, daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const backupsQuery = query(
        collection(db, 'backups'),
        where('companyId', '==', companyId)
      );
      const snapshot = await getDocs(backupsQuery);
      
      const batch = writeBatch(db);
      let deleted = 0;

      snapshot.docs.forEach(docSnap => {
        const createdAt = docSnap.data().createdAt?.toDate?.();
        if (createdAt && createdAt < cutoffDate) {
          batch.delete(docSnap.ref);
          deleted++;
        }
      });

      if (deleted > 0) {
        await batch.commit();
      }

      return { success: true, deleted };

    } catch (error) {
      console.error('Clean backups error:', error);
      return { success: false, error: 'Backup tozalashda xatolik!' };
    }
  }
}

export default new BackupService();
