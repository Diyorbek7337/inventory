import React from 'react';
import { 
  LayoutDashboard, Package, ShoppingCart, TrendingUp, 
  Users, Settings, LogOut, Menu, X, BarChart3, 
  ClipboardList, Store, Clock, AlertTriangle, Wallet,
  ClipboardCheck, Download
} from 'lucide-react';
import "./style.css"

const Sidebar = ({ 
  activeMenu, 
  setActiveMenu, 
  onLogout, 
  currentUser, 
  isOpen, 
  setIsOpen 
}) => {
  const isAdmin = currentUser?.role === 'admin';

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'income', label: 'Kirim', icon: Package },
    { id: 'outcome', label: 'Sotish', icon: ShoppingCart },
    { id: 'products', label: 'Mahsulotlar', icon: ClipboardList },
    { id: 'sales', label: 'Sotuvlar', icon: BarChart3 },
    { id: 'debtors', label: 'Qarzdorlar', icon: Wallet },
    { id: 'statistics', label: 'Statistika', icon: TrendingUp },
    { id: 'inventory', label: 'Ombor tahlili', icon: AlertTriangle, adminOnly: true },
    { id: 'stockcount', label: 'Inventarizatsiya', icon: ClipboardCheck, adminOnly: true },
    { id: 'backup', label: 'Backup', icon: Download, adminOnly: true },
    { id: 'users', label: 'Foydalanuvchilar', icon: Users, adminOnly: true },
    { id: 'settings', label: 'Sozlamalar', icon: Settings, adminOnly: true },
  ];

  const filteredMenu = menuItems.filter(item => !item.adminOnly || isAdmin);

  const handleMenuClick = (id) => {
    setActiveMenu(id);
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-72 bg-gradient-to-b from-slate-900 to-slate-800 
        z-50 transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:z-auto asideHeight
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Header */}
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 shadow-lg rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/25">
                <Store className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">CRM Pro</h1>
                <p className="text-xs text-slate-400">Boshqaruv tizimi</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-2 lg:hidden text-slate-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 mx-4 mt-4 bg-slate-700/30 rounded-xl">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isAdmin ? 'bg-amber-500' : 'bg-emerald-500'
            }`}>
              <span className="font-bold text-white">
                {currentUser?.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white truncate">{currentUser?.name}</p>
              <p className={`text-xs font-semibold ${
                isAdmin ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {isAdmin ? '👑 Admin' : '🛒 Sotuvchi'}
              </p>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-280px)]">
          {filteredMenu.map((item) => (
            <button
              key={item.id}
              onClick={() => handleMenuClick(item.id)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-xl
                transition-all duration-200 group
                ${activeMenu === item.id 
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25' 
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                }
              `}
            >
              <item.icon className={`w-5 h-5 ${
                activeMenu === item.id ? '' : 'group-hover:text-emerald-400'
              }`} />
              <span className="font-medium">{item.label}</span>
              
              {/* Badges */}
              {item.id === 'debtors' && (
                <span className="ml-auto px-2 py-0.5 bg-rose-500 text-white text-xs font-bold rounded-full">
                  !
                </span>
              )}
              {item.id === 'inventory' && (
                <span className="ml-auto px-2 py-0.5 bg-amber-500 text-white text-xs font-bold rounded-full">
                  !
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700/50">
          <button
            onClick={onLogout}
            className="flex items-center w-full gap-3 px-4 py-3 transition-all duration-200 rounded-xl text-slate-300 hover:bg-rose-500/10 hover:text-rose-400"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Chiqish</span>
          </button>
        </div>
      </aside>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed z-30 p-3 bg-white border shadow-lg top-4 left-4 lg:hidden rounded-xl border-slate-200"
      >
        <Menu className="w-6 h-6 text-slate-700" />
      </button>
    </>
  );
};

export default Sidebar;
