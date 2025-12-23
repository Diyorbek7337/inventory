/**
 * Authentication Service
 * Firestore + Bcrypt (Firebase Auth'siz)
 */

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc,
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../firebase';
import { hashPassword, verifyPassword } from './passwordUtils';

class AuthService {
  
  /**
   * Yangi kompaniya va admin yaratish (Ro'yxatdan o'tish)
   */
  async registerCompany(companyData, adminData) {
    try {
      // 1. Username band emasligini tekshirish
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', adminData.username.toLowerCase()));
      const existingUser = await getDocs(q);
      
      if (!existingUser.empty) {
        return { success: false, error: 'Bu login allaqachon band!' };
      }

      // 2. Parolni hash qilish
      const hashedPassword = await hashPassword(adminData.password);

      // 3. Kompaniya yaratish - Trial tarif bilan
      const companyRef = doc(collection(db, 'companies'));
      const companyId = companyRef.id;
      
      // Trial muddati - 14 kun
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);
      
      await setDoc(companyRef, {
        ...companyData,
        // Trial tarif ma'lumotlari
        plan: 'trial',
        planName: 'Sinov (Trial)',
        maxUsers: 2,
        maxProducts: 50,
        trialEndsAt: trialEndsAt,
        subscriptionEnd: null,
        currentUsers: 1,
        currentProducts: 0,
        // Umumiy
        createdAt: new Date(),
        isActive: true,
        isDeleted: false
      });

      // 4. Admin user yaratish
      const userRef = doc(collection(db, 'users'));
      const userData = {
        name: adminData.name,
        username: adminData.username.toLowerCase(),
        password: hashedPassword, // Hashlangan parol
        role: 'admin',
        companyId: companyId,
        createdAt: new Date(),
        isActive: true,
        isDeleted: false
      };
      
      await setDoc(userRef, userData);

      return {
        success: true,
        user: { id: userRef.id, ...userData },
        company: { id: companyId, ...companyData }
      };

    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Ro\'yxatdan o\'tishda xatolik: ' + error.message };
    }
  }

  /**
   * Tizimga kirish
   */
  async login(username, password) {
    try {
      // 1. Firestore'dan user topish
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username.toLowerCase()));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return { success: false, error: 'Foydalanuvchi topilmadi!' };
      }

      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();

      // 2. User statusini tekshirish
      if (userData.isDeleted) {
        return { success: false, error: 'Hisob o\'chirilgan!' };
      }
      
      if (!userData.isActive) {
        return { success: false, error: 'Hisob bloklangan!' };
      }

      // 3. Kompaniya statusini tekshirish
      const companyDoc = await getDoc(doc(db, 'companies', userData.companyId));
      if (companyDoc.exists()) {
        const companyData = companyDoc.data();
        
        if (companyData.isDeleted) {
          return { success: false, error: 'Kompaniya o\'chirilgan!' };
        }
        
        if (companyData.isActive === false) {
          return { success: false, error: 'Kompaniya bloklangan! Admin bilan bog\'laning.' };
        }

        // Trial muddatini tekshirish
        if (companyData.trialEnds && !companyData.plan) {
          const trialEnd = companyData.trialEnds.toDate ? 
            companyData.trialEnds.toDate() : new Date(companyData.trialEnds);
          if (new Date() > trialEnd) {
            return { success: false, error: 'Trial muddat tugadi! Tarif tanlang.' };
          }
        }
      }

      // 4. Parolni tekshirish
      const isValidPassword = await verifyPassword(password, userData.password);
      
      if (!isValidPassword) {
        return { success: false, error: 'Parol noto\'g\'ri!' };
      }

      // 5. Last login yangilash
      await updateDoc(doc(db, 'users', userDoc.id), {
        lastLogin: new Date()
      });

      return {
        success: true,
        user: { id: userDoc.id, ...userData }
      };

    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Tizimga kirishda xatolik!' };
    }
  }

  /**
   * Tizimdan chiqish
   */
  async logout() {
    try {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('loginTime');
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: 'Chiqishda xatolik' };
    }
  }

  /**
   * Yangi user qo'shish (Admin tomonidan)
   */
  async addUser(userData, companyId) {
    try {
      // Username mavjudligini tekshirish
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', userData.username.toLowerCase()));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        return { success: false, error: 'Bu login band!' };
      }

      // Parolni hash qilish
      const hashedPassword = await hashPassword(userData.password);

      // User yaratish
      const userRef = doc(collection(db, 'users'));
      const newUser = {
        name: userData.name,
        username: userData.username.toLowerCase(),
        password: hashedPassword,
        role: userData.role || 'seller',
        companyId: companyId,
        createdAt: new Date(),
        isActive: true,
        isDeleted: false
      };

      await setDoc(userRef, newUser);

      return {
        success: true,
        user: { id: userRef.id, ...newUser }
      };

    } catch (error) {
      console.error('Add user error:', error);
      return { success: false, error: 'Foydalanuvchi qo\'shishda xatolik!' };
    }
  }

  /**
   * Parolni o'zgartirish
   */
  async changePassword(userId, oldPassword, newPassword) {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (!userDoc.exists()) {
        return { success: false, error: 'Foydalanuvchi topilmadi!' };
      }

      const userData = userDoc.data();

      // Eski parolni tekshirish
      const isValid = await verifyPassword(oldPassword, userData.password);
      if (!isValid) {
        return { success: false, error: 'Joriy parol noto\'g\'ri!' };
      }

      // Yangi parolni hash qilish
      const hashedPassword = await hashPassword(newPassword);

      // Yangilash
      await updateDoc(doc(db, 'users', userId), {
        password: hashedPassword,
        passwordChangedAt: new Date()
      });

      return { success: true, message: 'Parol muvaffaqiyatli o\'zgartirildi!' };

    } catch (error) {
      console.error('Change password error:', error);
      return { success: false, error: 'Parol o\'zgartirishda xatolik!' };
    }
  }

  /**
   * Userni o'chirish (Soft delete)
   */
  async deleteUser(userId) {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isDeleted: true,
        isActive: false,
        deletedAt: new Date()
      });

      return { success: true };
    } catch (error) {
      console.error('Delete user error:', error);
      return { success: false, error: 'O\'chirishda xatolik!' };
    }
  }

  /**
   * Eski parollarni migrate qilish (bir martalik)
   */
  async migratePasswords() {
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      
      let migrated = 0;
      
      for (const userDoc of snapshot.docs) {
        const userData = userDoc.data();
        
        // Agar parol hash qilinmagan bo'lsa ($ bilan boshlanmasa)
        if (userData.password && !userData.password.startsWith('$2')) {
          const hashedPassword = await hashPassword(userData.password);
          await updateDoc(doc(db, 'users', userDoc.id), {
            password: hashedPassword,
            passwordMigratedAt: new Date()
          });
          migrated++;
        }
      }

      return { success: true, migrated };
    } catch (error) {
      console.error('Migration error:', error);
      return { success: false, error: 'Migratsiya xatosi!' };
    }
  }
}

export default new AuthService();
