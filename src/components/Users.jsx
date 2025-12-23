import React, { useState, useEffect } from 'react';
import { User, Plus, Trash2, Shield, Phone, Mail, Calendar, Edit2, X, Check, AlertTriangle } from 'lucide-react';
import { collection, addDoc, deleteDoc, doc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';
import { hashPassword } from '../utils/passwordUtils';

const Users = ({ currentUser, companyData }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [newUser, setNewUser] = useState({ 
    username: '', 
    password: '', 
    name: '', 
    phone: '',
    role: 'sotuvchi' 
  });
  const [saving, setSaving] = useState(false);

  const isAdmin = currentUser?.role === 'admin';
  const maxUsers = companyData?.maxUsers || 2; // Trial default: 2

  // Foydalanuvchilarni yuklash
  useEffect(() => {
    loadUsers();
  }, [currentUser?.companyId]);

  const loadUsers = async () => {
    if (!currentUser?.companyId) return;
    
    try {
      const q = query(
        collection(db, 'users'),
        where('companyId', '==', currentUser.companyId)
      );
      const snapshot = await getDocs(q);
      const usersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersList);
    } catch (error) {
      console.error('Foydalanuvchilar yuklanmadi:', error);
      toast.error('Foydalanuvchilarni yuklashda xatolik!');
    }
    setLoading(false);
  };

  const addUser = async () => {
    if (!newUser.username.trim() || !newUser.password || !newUser.name.trim()) {
      toast.error('Barcha majburiy maydonlarni to\'ldiring!');
      return;
    }

    // Foydalanuvchi limitini tekshirish
    if (users.length >= maxUsers) {
      toast.error(
        <div>
          <strong>Tarif limiti!</strong>
          <p>Siz {maxUsers} ta foydalanuvchi qo'sha olasiz.</p>
          <p>Tarifni yangilang!</p>
        </div>
      );
      return;
    }

    if (newUser.password.length < 4) {
      toast.error('Parol kamida 4 belgidan iborat bo\'lishi kerak!');
      return;
    }

    if (users.some(u => u.username === newUser.username.trim().toLowerCase())) {
      toast.error('Bu login band!');
      return;
    }

    setSaving(true);
    const loadingToast = toast.loading('Foydalanuvchi qo\'shilmoqda...');

    try {
      // Parolni hash qilish
      const hashedPassword = await hashPassword(newUser.password);
      
      const userData = {
        username: newUser.username.trim().toLowerCase(),
        password: hashedPassword,
        name: newUser.name.trim(),
        phone: newUser.phone.trim(),
        role: newUser.role,
        companyId: currentUser.companyId,
        createdAt: new Date(),
        createdBy: currentUser.id,
        isActive: true,
        isDeleted: false
      };

      const docRef = await addDoc(collection(db, 'users'), userData);
      setUsers(prev => [...prev, { id: docRef.id, ...userData }]);

      setNewUser({ username: '', password: '', name: '', phone: '', role: 'sotuvchi' });
      setShowModal(false);
      
      toast.update(loadingToast, {
        render: '✅ Foydalanuvchi qo\'shildi!',
        type: 'success',
        isLoading: false,
        autoClose: 3000
      });
    } catch (error) {
      console.error('Xato:', error);
      toast.update(loadingToast, {
        render: '❌ Xatolik yuz berdi!',
        type: 'error',
        isLoading: false,
        autoClose: 3000
      });
    }
    setSaving(false);
  };

  const updateUser = async () => {
    if (!editingUser.name.trim()) {
      toast.error('Ismni kiriting!');
      return;
    }

    setSaving(true);
    const loadingToast = toast.loading('Saqlanmoqda...');

    try {
      const updatedData = {
        name: editingUser.name.trim(),
        phone: editingUser.phone?.trim() || '',
        role: editingUser.role
      };

      if (editingUser.newPassword) {
        if (editingUser.newPassword.length < 4) {
          toast.error('Yangi parol kamida 4 belgidan iborat bo\'lishi kerak!');
          setSaving(false);
          toast.dismiss(loadingToast);
          return;
        }
        // Parolni hash qilish
        updatedData.password = await hashPassword(editingUser.newPassword);
      }

      await updateDoc(doc(db, 'users', editingUser.id), updatedData);
      
      // Update local state
      setUsers(prev => prev.map(u => 
        u.id === editingUser.id ? { ...u, ...updatedData } : u
      ));
      
      setEditingUser(null);
      
      toast.update(loadingToast, {
        render: '✅ Foydalanuvchi yangilandi!',
        type: 'success',
        isLoading: false,
        autoClose: 3000
      });
    } catch (error) {
      console.error('Xato:', error);
      toast.update(loadingToast, {
        render: '❌ Xatolik yuz berdi!',
        type: 'error',
        isLoading: false,
        autoClose: 3000
      });
    }
    setSaving(false);
  };

  const deleteUser = async (userId) => {
    if (userId === currentUser.id) {
      toast.error('O\'zingizni o\'chira olmaysiz!');
      return;
    }

    const user = users.find(u => u.id === userId);
    if (user?.role === 'admin' && users.filter(u => u.role === 'admin').length <= 1) {
      toast.error('Oxirgi adminni o\'chira olmaysiz!');
      return;
    }

    if (window.confirm(`${user?.name}ni o\'chirmoqchimisiz?`)) {
      const loadingToast = toast.loading('O\'chirilmoqda...');
      try {
        await deleteDoc(doc(db, 'users', userId));
        setUsers(prev => prev.filter(u => u.id !== userId));
        toast.update(loadingToast, {
          render: '✅ Foydalanuvchi o\'chirildi!',
          type: 'success',
          isLoading: false,
          autoClose: 3000
        });
      } catch (error) {
        console.error('Xato:', error);
        toast.update(loadingToast, {
          render: '❌ Xatolik yuz berdi!',
          type: 'error',
          isLoading: false,
          autoClose: 3000
        });
      }
    }
  };

  const admins = users.filter(u => u.role === 'admin' && !u.isDeleted);
  const sellers = users.filter(u => u.role === 'sotuvchi' && !u.isDeleted);

  if (loading) {
    return (
      <div className="p-4 lg:p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Foydalanuvchilar</h2>
          <p className="text-slate-500 mt-1">
            {admins.length} ta admin, {sellers.length} ta sotuvchi
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 text-white font-semibold bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-500/25"
          >
            <Plus className="w-5 h-5" />
            Yangi foydalanuvchi
          </button>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl text-white shadow-lg shadow-violet-500/25">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <User className="w-6 h-6" />
            </div>
            <div>
              <p className="text-violet-100 text-sm">Jami</p>
              <p className="text-2xl font-bold">{users.length}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl text-white shadow-lg shadow-amber-500/25">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <p className="text-amber-100 text-sm">Adminlar</p>
              <p className="text-2xl font-bold">{admins.length}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl text-white shadow-lg shadow-emerald-500/25">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <User className="w-6 h-6" />
            </div>
            <div>
              <p className="text-emerald-100 text-sm">Sotuvchilar</p>
              <p className="text-2xl font-bold">{sellers.length}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gradient-to-br from-slate-600 to-slate-700 rounded-2xl text-white shadow-lg shadow-slate-500/25">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-slate-300 text-sm">Bugun qo'shilgan</p>
              <p className="text-2xl font-bold">
                {users.filter(u => {
                  const created = u.createdAt?.seconds ? new Date(u.createdAt.seconds * 1000) : new Date(u.createdAt);
                  const today = new Date();
                  return created.toDateString() === today.toDateString();
                }).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {users.map(user => {
          const createdDate = user.createdAt?.seconds 
            ? new Date(user.createdAt.seconds * 1000) 
            : new Date(user.createdAt);
          
          return (
            <div
              key={user.id}
              className={`bg-white rounded-2xl shadow-lg shadow-slate-200/50 p-6 border-2 transition-all hover:shadow-xl ${
                user.id === currentUser.id 
                  ? 'border-emerald-400 ring-2 ring-emerald-100' 
                  : 'border-transparent'
              }`}
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                  user.role === 'admin' 
                    ? 'bg-gradient-to-br from-amber-400 to-amber-500' 
                    : 'bg-gradient-to-br from-emerald-400 to-emerald-500'
                }`}>
                  {user.role === 'admin' ? (
                    <Shield className="w-8 h-8 text-white" />
                  ) : (
                    <User className="w-8 h-8 text-white" />
                  )}
                </div>
                
                {isAdmin && user.id !== currentUser.id && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingUser({ ...user, newPassword: '' })}
                      className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                      title="Tahrirlash"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => deleteUser(user.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="O'chirish"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>

              {/* User Info */}
              <h3 className="font-bold text-xl text-slate-800 mb-1">{user.name}</h3>
              <p className="text-slate-500 font-mono text-sm mb-4">@{user.username}</p>
              
              {/* Contact */}
              {user.phone && (
                <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span>{user.phone}</span>
                </div>
              )}

              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2 mt-4">
                <span className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
                  user.role === 'admin' 
                    ? 'bg-amber-100 text-amber-700' 
                    : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {user.role === 'admin' ? '👑 Admin' : '👤 Sotuvchi'}
                </span>
                {user.id === currentUser.id && (
                  <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-violet-100 text-violet-700">
                    ✓ Siz
                  </span>
                )}
              </div>

              {/* Date */}
              <p className="text-xs text-slate-400 mt-4 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Qo'shilgan: {createdDate.toLocaleDateString('uz-UZ')}
              </p>
            </div>
          );
        })}
      </div>

      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Plus className="w-6 h-6" />
                Yangi foydalanuvchi
              </h3>
              <p className="text-emerald-100 text-sm mt-1">Ma'lumotlarni to'ldiring</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">To'liq ism *</label>
                <input
                  type="text"
                  placeholder="Ism Familiya"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Login *</label>
                <input
                  type="text"
                  placeholder="username"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value.toLowerCase() })}
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Parol *</label>
                <input
                  type="password"
                  placeholder="Kamida 6 ta belgi"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Telefon raqam</label>
                <input
                  type="tel"
                  placeholder="+998 90 123 45 67"
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Rol</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewUser({ ...newUser, role: 'sotuvchi' })}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      newUser.role === 'sotuvchi'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <User className="w-6 h-6 mx-auto mb-2" />
                    <p className="font-semibold">Sotuvchi</p>
                    <p className="text-xs text-slate-500">Asosiy funksiyalar</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewUser({ ...newUser, role: 'admin' })}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      newUser.role === 'admin'
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Shield className="w-6 h-6 mx-auto mb-2" />
                    <p className="font-semibold">Admin</p>
                    <p className="text-xs text-slate-500">To'liq huquqlar</p>
                  </button>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                <div className="flex gap-2">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold mb-1">Eslatma:</p>
                    <p>Admin barcha ma'lumotlarni, shu jumladan tannarx va foydani ko'rish huquqiga ega.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={() => {
                  setShowModal(false);
                  setNewUser({ username: '', password: '', name: '', phone: '', role: 'sotuvchi' });
                }}
                className="flex-1 bg-slate-100 text-slate-700 rounded-xl px-4 py-3 hover:bg-slate-200 font-semibold transition-colors active:scale-[0.98]"
              >
                Bekor qilish
              </button>
              <button
                onClick={addUser}
                disabled={saving}
                className="flex-1 bg-emerald-600 text-white rounded-xl px-4 py-3 hover:bg-emerald-700 font-semibold transition-colors disabled:opacity-50 active:scale-[0.98]"
              >
                {saving ? 'Saqlanmoqda...' : 'Qo\'shish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-violet-600 to-violet-700 p-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Edit2 className="w-6 h-6" />
                Foydalanuvchini tahrirlash
              </h3>
              <p className="text-violet-100 text-sm mt-1">@{editingUser.username}</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">To'liq ism *</label>
                <input
                  type="text"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Telefon raqam</label>
                <input
                  type="tel"
                  value={editingUser.phone || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Yangi parol <span className="text-slate-400 font-normal">(ixtiyoriy)</span>
                </label>
                <input
                  type="password"
                  placeholder="O'zgartirmasangiz bo'sh qoldiring"
                  value={editingUser.newPassword}
                  onChange={(e) => setEditingUser({ ...editingUser, newPassword: e.target.value })}
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Rol</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingUser({ ...editingUser, role: 'sotuvchi' })}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      editingUser.role === 'sotuvchi'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <User className="w-6 h-6 mx-auto mb-2" />
                    <p className="font-semibold">Sotuvchi</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingUser({ ...editingUser, role: 'admin' })}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      editingUser.role === 'admin'
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Shield className="w-6 h-6 mx-auto mb-2" />
                    <p className="font-semibold">Admin</p>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={() => setEditingUser(null)}
                className="flex-1 bg-slate-100 text-slate-700 rounded-xl px-4 py-3 hover:bg-slate-200 font-semibold transition-colors active:scale-[0.98]"
              >
                Bekor qilish
              </button>
              <button
                onClick={updateUser}
                disabled={saving}
                className="flex-1 bg-violet-600 text-white rounded-xl px-4 py-3 hover:bg-violet-700 font-semibold transition-colors disabled:opacity-50 active:scale-[0.98]"
              >
                {saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
