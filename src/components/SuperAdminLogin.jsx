import React, { useState } from 'react';
import { Crown, Lock, Shield } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

// Super Admin Firebase Auth hisob ma'lumotlari
const SA_EMAIL    = 'superadmin@crm-app.com';
const SA_PASSWORD = 'superadmin2024'; // Parolni bu yerda o'zgartiring

const SuperAdminLogin = ({ onLogin, onBack }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (password !== SA_PASSWORD) {
      toast.error('Parol noto\'g\'ri!');
      return;
    }
    setLoading(true);
    try {
      // Firebase Auth bilan kirish (Firestore rules uchun kerak)
      let userCred;
      try {
        userCred = await signInWithEmailAndPassword(auth, SA_EMAIL, SA_PASSWORD);
      } catch (authErr) {
        if (
          authErr.code === 'auth/user-not-found' ||
          authErr.code === 'auth/invalid-credential' ||
          authErr.code === 'auth/invalid-email'
        ) {
          // Birinchi ishga tushirishda hisob yaratish
          userCred = await createUserWithEmailAndPassword(auth, SA_EMAIL, SA_PASSWORD);
        } else {
          throw authErr;
        }
      }

      const uid = userCred.user.uid;

      // superadmins/{uid} hujjatini yaratish (birinchi marta)
      const saRef = doc(db, 'superadmins', uid);
      const saSnap = await getDoc(saRef);
      if (!saSnap.exists()) {
        await setDoc(saRef, { email: SA_EMAIL, createdAt: new Date() });
      }

      toast.success('Super Admin tizimiga xush kelibsiz!');
      onLogin();
    } catch (err) {
      console.error('Super admin login error:', err);
      toast.error('Kirishda xatolik: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-amber-900/20 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-2xl shadow-amber-500/30 ring-4 ring-amber-500/20">
            <Crown className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Super Admin</h1>
          <p className="text-slate-400 mt-2">Platforma boshqaruv paneli</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/50 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-amber-500/20">
          <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-6">
            <Shield className="w-6 h-6 text-amber-400" />
            <div>
              <p className="text-amber-400 font-semibold text-sm">Maxfiy kirish</p>
              <p className="text-slate-400 text-xs">Faqat platforma egasi uchun</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Super Admin paroli
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-400 w-5 h-5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-amber-500/30 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-amber-500/25 active:scale-[0.98]"
            >
              {loading ? 'Tekshirilmoqda...' : 'Kirish'}
            </button>

            <button
              type="button"
              onClick={onBack}
              className="w-full py-3 bg-slate-700/50 text-slate-300 rounded-xl font-medium hover:bg-slate-700 transition-colors"
            >
              Orqaga
            </button>
          </form>
        </div>

        {/* Security Notice */}
        <p className="text-center text-slate-500 text-xs mt-6">
          🔒 Bu sahifa himoyalangan. Barcha kirishlar qayd etiladi.
        </p>
      </div>
    </div>
  );
};

export default SuperAdminLogin;
