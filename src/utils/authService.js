/**
 * Authentication Service — Firebase Auth + Firestore
 *
 * Arxitektura:
 *  - Firebase Auth: parol xavfsizligi (Firestore da parol saqlanmaydi)
 *  - Firestore users collection: username, companyId, role, name
 *  - Email formati (ichki, foydalanuvchi ko'rmaydi):
 *      {username}__{companyId}@crm-app.com
 *    Bu format username + companyId kombinatsiyasini globally unique qiladi.
 *
 *  - Xodim qo'shish: secondaryApp orqali (admin sessiyasi buzilmaydi)
 */

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where
} from 'firebase/firestore';
import { db, secondaryDb, auth, secondaryApp } from '../firebase';

// Ikkinchi instance dan auth olish (xodim yaratish uchun)
const secondaryAuth = getAuth(secondaryApp);

// Firebase Auth uchun ichki email yasash
// Faqat a-z, 0-9, _ va - belgilarini qoldiramiz (email uchun xavfsiz)
const sanitize = (str) => (str || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');

const toAuthEmail = (username, companyId) => {
  const u = sanitize(username);
  const c = sanitize(companyId);
  if (!u || !c) throw new Error(`Email yasashda xato: username="${username}", companyId="${companyId}"`);
  return `${u}__${c}@crm-app.com`;
};

// ─────────────────────────────────────────────────────────────────────────────

class AuthService {

  /**
   * Yangi kompaniya + admin ro'yxatdan o'tish
   */
  async registerCompany(companyData, adminData) {
    try {
      // 1. Username band emasligini tekshirish
      const q = query(
        collection(db, 'users'),
        where('username', '==', adminData.username.toLowerCase())
      );
      const existing = await getDocs(q);
      if (!existing.empty) {
        return { success: false, error: 'Bu login allaqachon band!' };
      }

      // 2. Kompaniya hujjatini yaratish (ID olish uchun)
      const companyRef = doc(collection(db, 'companies'));
      const companyId  = companyRef.id;
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      await setDoc(companyRef, {
        ...companyData,
        plan: 'trial', planName: 'Sinov (Trial)',
        maxUsers: 2, maxProducts: 50,
        trialEndsAt,
        subscriptionEnd: null,
        currentUsers: 1, currentProducts: 0,
        createdAt: new Date(),
        isActive: true, isDeleted: false,
      });

      // 3. Firebase Auth da hisob yaratish — secondaryAuth ishlatiladi
      // (primary auth / onAuthStateChanged ni mutlaqo bezovta qilmaydi)
      const email = toAuthEmail(adminData.username, companyId);
      let uid;
      try {
        const cred = await createUserWithEmailAndPassword(secondaryAuth, email, adminData.password);
        uid = cred.user.uid;
      } catch (authErr) {
        // Kompaniyani rollback
        try { await updateDoc(companyRef, { isDeleted: true }); } catch (_) {}
        if (authErr.code === 'auth/email-already-in-use') {
          return { success: false, error: 'Bu login allaqachon band!' };
        }
        if (authErr.code === 'auth/weak-password') {
          return { success: false, error: 'Parol kamida 6 belgidan iborat bo\'lishi kerak!' };
        }
        throw authErr;
      }

      // 4. Firestore da user hujjati yaratish — secondaryDb ishlatiladi
      // secondaryAuth hozir sign-in holatida (uid = cred.user.uid)
      // secondaryDb uning tokenini ishlatadi → request.auth.uid == uid ✓
      const userData = {
        name:      adminData.name,
        username:  adminData.username.toLowerCase(),
        authEmail: email,
        role:      'admin',
        companyId,
        createdAt: new Date(),
        isActive:  true,
        isDeleted: false,
      };
      await setDoc(doc(secondaryDb, 'users', uid), userData);

      // Secondary instance dan chiqish (hujjat allaqachon yozildi)
      await signOut(secondaryAuth);

      // 5. Primary auth bilan kirish — endi onAuthStateChanged ishlaydi,
      // Firestore da user hujjati tayyor bo'lgani uchun muammo yo'q
      await signInWithEmailAndPassword(auth, email, adminData.password);

      return {
        success: true,
        user:    { id: uid, ...userData },
        company: { id: companyId, ...companyData },
      };

    } catch (error) {
      console.error('Register error:', error);
      return { success: false, error: 'Ro\'yxatdan o\'tishda xatolik: ' + error.message };
    }
  }

  /**
   * Tizimga kirish
   */
  async login(username, password) {
    try {
      // 1. Username bo'yicha Firestore dan foydalanuvchi topish
      const q = query(
        collection(db, 'users'),
        where('username', '==', username.toLowerCase())
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return { success: false, error: 'Foydalanuvchi topilmadi!' };
      }

      const userDoc  = snapshot.docs[0];
      const userData = userDoc.data();
      const uid      = userDoc.id;

      if (userData.isDeleted) return { success: false, error: 'Hisob o\'chirilgan!' };
      if (!userData.isActive) return { success: false, error: 'Hisob bloklangan!' };

      // 2. Kompaniya holatini tekshirish
      const companySnap = await getDoc(doc(db, 'companies', userData.companyId));
      if (companySnap.exists()) {
        const c = companySnap.data();
        if (c.isDeleted)        return { success: false, error: 'Kompaniya o\'chirilgan!' };
        if (c.isActive === false) return { success: false, error: 'Kompaniya bloklangan!' };
      }

      // 3. Firebase Auth uchun email aniqlash
      // Ustuvorlik: authEmail → username (agar email ko'rinishida bo'lsa) → toAuthEmail()
      let email;
      if (userData.authEmail && userData.authEmail.includes('@') &&
          !userData.authEmail.includes('undefined') && !userData.authEmail.includes('null')) {
        // Yangi tizim: authEmail Firestore da saqlangan
        email = userData.authEmail;
      } else if (username.includes('@')) {
        // Eski tizim: username to'g'ridan-to'g'ri email sifatida saqlangan
        email = username.toLowerCase();
      } else {
        // Standart format: username__companyId@crm-app.com
        try {
          email = toAuthEmail(username, userData.companyId);
        } catch (emailErr) {
          console.error('Email hisoblashda xato:', emailErr);
          return { success: false, error: 'Hisob ma\'lumotlarida xatolik. Admin bilan bog\'laning.' };
        }
      }

      // Agar authEmail yo'q bo'lsa — hozir topilgan email ni Firestore ga yozib qo'yamiz
      if (!userData.authEmail) {
        try {
          await updateDoc(doc(db, 'users', uid), { authEmail: email });
        } catch (_) { /* muhim emas, keyingi kirish ishlaydi */ }
      }

      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (authErr) {
        console.error('Firebase Auth xato:', authErr.code, '| email:', email);
        if (authErr.code === 'auth/wrong-password' || authErr.code === 'auth/invalid-credential') {
          return { success: false, error: 'Parol noto\'g\'ri!' };
        }
        if (authErr.code === 'auth/user-not-found') {
          return { success: false, error: 'Firebase da hisob topilmadi!' };
        }
        if (authErr.code === 'auth/too-many-requests') {
          return { success: false, error: 'Juda ko\'p urinish. Biroz kuting.' };
        }
        if (authErr.code === 'auth/invalid-email') {
          return { success: false, error: 'Hisob email formati xato. Admin bilan bog\'laning.' };
        }
        throw authErr;
      }

      // 4. Last login yangilash
      await updateDoc(doc(db, 'users', uid), { lastLogin: new Date() });

      return { success: true, user: { id: uid, ...userData } };

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
      await signOut(auth);
      localStorage.removeItem('currentUser');
      localStorage.removeItem('loginTime');
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false };
    }
  }

  /**
   * Admin tomonidan yangi xodim qo'shish.
   * secondaryAuth ishlatiladi — admin sessiyasi buzilmaydi.
   */
  async addUser(userData, companyId) {
    try {
      // Username tekshirish
      const q = query(
        collection(db, 'users'),
        where('username', '==', userData.username.toLowerCase())
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        return { success: false, error: 'Bu login band!' };
      }

      const email = toAuthEmail(userData.username, companyId);

      // Secondary instance da yaratish (primary auth o'zgarmaydi)
      let cred;
      try {
        cred = await createUserWithEmailAndPassword(secondaryAuth, email, userData.password);
      } catch (authErr) {
        if (authErr.code === 'auth/email-already-in-use') {
          return { success: false, error: 'Bu login band!' };
        }
        if (authErr.code === 'auth/weak-password') {
          return { success: false, error: 'Parol kamida 6 belgidan iborat bo\'lishi kerak!' };
        }
        throw authErr;
      }

      const uid = cred.user.uid;

      // Secondary dan sign out (muhim!)
      await signOut(secondaryAuth);

      // Firestore da user hujjati
      const newUser = {
        name:      userData.name,
        username:  userData.username.toLowerCase(),
        authEmail: email,
        role:      ['admin', 'menejer', 'kassir', 'sotuvchi'].includes(userData.role) ? userData.role : 'sotuvchi',
        companyId,
        createdAt: new Date(),
        isActive:  true,
        isDeleted: false,
      };
      await setDoc(doc(db, 'users', uid), newUser);

      return { success: true, user: { id: uid, ...newUser } };

    } catch (error) {
      console.error('Add user error:', error);
      return { success: false, error: 'Foydalanuvchi qo\'shishda xatolik!' };
    }
  }

  /**
   * Parolni o'zgartirish (foydalanuvchi o'zi)
   */
  async changePassword(oldPassword, newPassword) {
    try {
      const user = auth.currentUser;
      if (!user) return { success: false, error: 'Kirish talab qilinadi!' };

      // Re-authenticate
      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      await reauthenticateWithCredential(user, credential);

      // Yangi parol
      await updatePassword(user, newPassword);

      return { success: true, message: 'Parol muvaffaqiyatli o\'zgartirildi!' };

    } catch (error) {
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        return { success: false, error: 'Joriy parol noto\'g\'ri!' };
      }
      console.error('Change password error:', error);
      return { success: false, error: 'Parol o\'zgartirishda xatolik!' };
    }
  }

  /**
   * Admin xodim parolini reset qilish
   * (secondaryAuth bilan sign in qilib updatePassword)
   */
  async resetUserPassword(targetUsername, targetCompanyId, newPassword) {
    try {
      // Oldingi parolni bilmaymiz — Firebase Console da manual reset kerak bo'lishi mumkin
      // Hozircha: foydalanuvchi hujjatida resetRequired flag qo'yamiz
      const q = query(
        collection(db, 'users'),
        where('username', '==', targetUsername.toLowerCase()),
        where('companyId', '==', targetCompanyId)
      );
      const snap = await getDocs(q);
      if (snap.empty) return { success: false, error: 'Foydalanuvchi topilmadi!' };

      await updateDoc(snap.docs[0].ref, { passwordResetRequired: true });

      return { success: true, message: 'Parol reset belgilandi. Firebase Console orqali yangilang.' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Foydalanuvchini o'chirish (soft delete)
   */
  async deleteUser(userId) {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isDeleted: true,
        isActive:  false,
        deletedAt: new Date(),
      });
      // Firebase Auth dan o'chirish Admin SDK talab qiladi (Cloud Function orqali)
      // Hozircha soft delete yetarli — login qila olmaydi (isDeleted: true tekshiriladi)
      return { success: true };
    } catch (error) {
      return { success: false, error: 'O\'chirishda xatolik!' };
    }
  }

  /**
   * Joriy Firebase Auth foydalanuvchisini qaytarish
   */
  getCurrentFirebaseUser() {
    return auth.currentUser;
  }
}

export default new AuthService();
