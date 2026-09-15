import React, { useState, useEffect } from 'react';
import { Phone, Search, MapPin, MessageCircle, Plus, X, Trash2, Edit, Filter, Lock, ShieldAlert, Star, RefreshCcw, LogOut, Store, Briefcase, CheckCircle2, Download, Upload, Settings } from 'lucide-react';
import * as XLSX from 'xlsx';

function App() {
  const [listings, setListings] = useState([]);
  const [searchName, setSearchName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  const [availableCategories, setAvailableCategories] = useState([]);
  const [availableRegions, setAvailableRegions] = useState([]);
  
  const [token, setToken] = useState(localStorage.getItem('adminToken') || null);
  const [isAdmin, setIsAdmin] = useState(!!localStorage.getItem('adminToken'));
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [password, setPassword] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '', category: '', region: '', detailed_address: '', phone_number: '', map_url: ''
  });

  const API_URL_BASE = 'https://homs-directory.onrender.com';
  const API_URL = `${API_URL_BASE}/api/listings`;

 // --- دوال الإكسل (استيراد وتصدير) ---
  const handleExportExcel = async () => {
    try {
      // جلب كل البيانات من قاعدة البيانات فوراً بلمح البصر (بدون الحاجة للبحث بالشاشة)
      const response = await fetch(`${API_URL_BASE}/api/listings`);
      const allData = await response.json();
      
      if (allData.length === 0) {
        alert("لا يوجد أي بيانات في الدليل لتصديرها!");
        return;
      }

      const dataToExport = allData.map(item => ({
        "الاسم الكامل": item.full_name,
        "الفئة": item.category,
        "المنطقة": item.region,
        "رقم الهاتف": item.phone_number,
        "الموقع التفصيلي": item.detailed_address || "",
        "طريقة التواصل": item.contact_method || "واتساب/مكالمة هاتفية",
        "رابط خريطة جوجل": item.map_url || ""
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "بيانات العملاء");
      XLSX.writeFile(workbook, "دليل_العملاء.xlsx");
    } catch (error) {
      console.error("خطأ في التصدير:", error);
      alert("حدث خطأ أثناء جلب البيانات للتصدير.");
    }
  };

 const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        const formattedData = json.map(row => {
          // 1. تنظيف أسماء الأعمدة: هذا الكود سيزيل أي مسافات زائدة أضافها الموظف بالخطأ
          const cleanRow = {};
          for (let key in row) {
            cleanRow[key.trim()] = row[key];
          }

          // 2. توفير بدائل ذكية للبيانات الناقصة
          return {
            full_name: cleanRow["الاسم الكامل"] || "",
            category: cleanRow["الفئة"] || "غير محدد",
            region: cleanRow["المنطقة"] || "غير محدد",
            detailed_address: cleanRow["الموقع التفصيلي"] || "",
            // تحويل الرقم إلى نص لتجنب مشاكل الإكسل، وإذا كان فارغاً نضع "غير متوفر"
            phone_number: cleanRow["رقم الهاتف"] ? String(cleanRow["رقم الهاتف"]) : "غير متوفر",
            contact_method: cleanRow["طريقة التواصل"] || "",
            map_url: cleanRow["رابط خريطة جوجل"] || ""
          };
        });

        // تصفية الصفوف الفارغة تماماً (التي ليس لها اسم)
        const validData = formattedData.filter(item => item.full_name !== "");

        if (validData.length === 0) {
          alert("الملف لا يحتوي على أي أسماء عملاء صالحة!");
          return;
        }

        const response = await fetch(`${API_URL_BASE}/api/listings/bulk`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify(validData)
        });

        if (response.ok) {
          const resultData = await response.json(); 
          fetchOptions();
          fetchListings(true);
          alert(resultData.message); // سيعرض لك العدد الفعلي للعملاء المضافين
        } else {
          alert("حدث خطأ في الخادم أثناء الاستيراد.");
        }
      } catch (error) {
        console.error("خطأ:", error);
        alert("حدث خطأ أثناء قراءة الملف. تأكد من صحة الأعمدة.");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = null; 
  };
  // ------------------------------------

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  useEffect(() => {
    if (token) setIsAdmin(true);
    else setIsAdmin(false);
  }, [token]);

  const fetchOptions = async () => {
    try {
      const response = await fetch(`${API_URL_BASE}/api/options`);
      const data = await response.json();
      setAvailableCategories(data.categories);
      setAvailableRegions(data.regions);
    } catch (error) {
      console.error('خطأ في جلب الخيارات:', error);
    }
  };

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchListings = async (forceAll = false) => {
    if (!searchName && !selectedCategory && !selectedRegion && !forceAll) {
      setListings([]);
      setHasSearched(false);
      return;
    }
    
    setHasSearched(true);
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchName) params.append('name', searchName);
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedRegion) params.append('region', selectedRegion);

      const response = await fetch(`${API_URL}?${params.toString()}`);
      const data = await response.json();
      setListings(data);
    } catch (error) {
      console.error('خطأ في جلب البيانات:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCategory || selectedRegion) fetchListings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, selectedRegion]);

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    fetchListings(true);
  };

  const clearFilters = () => {
    setSearchName('');
    setSelectedCategory('');
    setSelectedRegion('');
    setListings([]);
    setHasSearched(false);
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await response.json();
      
      if (response.ok) {
        setToken(data.token);
        localStorage.setItem('adminToken', data.token);
        setIsAuthModalOpen(false);
        setPassword('');
      } else {
        alert(data.error || "كلمة المرور غير صحيحة!");
      }
    } catch (error) {
      alert("تعذر الاتصال بالخادم.");
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('adminToken');
    setIsAdmin(false);
  };

  const openAddModal = () => {
    setEditId(null);
    setFormData({ full_name: '', category: '', region: '', detailed_address: '', phone_number: '', map_url: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setFormData({
      full_name: item.full_name,
      category: item.category,
      region: item.region,
      detailed_address: item.detailed_address || '',
      phone_number: item.phone_number,
      map_url: item.map_url || ''
    });
    setEditId(item.id);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!token) return alert("الرجاء تسجيل الدخول أولاً!");

    try {
      const url = editId ? `${API_URL}/${editId}` : API_URL;
      const method = editId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setIsModalOpen(false);
        fetchOptions();
        clearFilters(); 
      } else if (response.status === 401 || response.status === 403) {
        alert("انتهت صلاحية الجلسة، الرجاء تسجيل الدخول مجدداً.");
        handleLogout();
      } else {
        alert("حدث خطأ أثناء الحفظ.");
      }
    } catch (error) {
      alert("حدث خطأ أثناء الاتصال بالخادم.");
    }
  };

  const executeDelete = async (id, name) => {
    if (!token) return alert("الرجاء تسجيل الدخول أولاً!");
    
    if (window.confirm(`هل أنت متأكد أنك تريد حذف بيانات "${name}" نهائياً؟`)) {
      try {
        const response = await fetch(`${API_URL}/${id}`, { 
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          fetchOptions();
          fetchListings(true);
        } else if (response.status === 401 || response.status === 403) {
          alert("انتهت صلاحية الجلسة، الرجاء تسجيل الدخول مجدداً.");
          handleLogout();
        }
      } catch (error) {
        console.error('Error deleting:', error);
      }
    }
  };

  const getWhatsAppLink = (phone) => {
    if (!phone) return '#';
    const cleanPhone = phone.replace(/^0+/, '');
    return `https://wa.me/963${cleanPhone}`;
  };

  const getMapLink = (item) => {
    if (item.map_url && item.map_url.trim() !== '') return item.map_url;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.full_name} ${item.region} حمص سوريا`)}`;
  };

  const getAddStoreWhatsAppLink = () => {
    const message = `مرحباً، لقد بحثت في الدليل ولم أجد متجري، وأرغب بإضافته. هذه هي بياناتي:

1. اسم متجرك / محلك: 
2. الفئة (أمثلة: طبيب، صيانة، مطعم، ألبسة، سوبرماركت...): 
3. المنطقة / عنوان المحل بالتفصيل: 

شكراً لكم.`;
    return `https://wa.me/963954008416?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-2 md:p-8 font-sans selection:bg-blue-200 selection:text-blue-900 pb-20" dir="rtl">
      
      {showInstallPrompt && (
        <div className="fixed bottom-0 left-0 right-0 bg-blue-600 text-white p-3 md:p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-[70] flex justify-between items-center animate-in slide-in-from-bottom border-t border-blue-500">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="bg-white p-2 md:p-2.5 rounded-xl text-blue-600 shadow-sm">
              <Download className="w-5 h-5 md:w-6 md:h-6"/>
            </div>
            <div>
              <h4 className="font-bold text-xs md:text-base">تطبيق دليلك الشامل حمص</h4>
              <p className="text-[10px] md:text-sm text-blue-100 mt-0.5">ثبّت التطبيق لوصول أسرع بدون متصفح!</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleInstallClick} className="bg-white hover:bg-slate-100 text-blue-600 px-3 py-1.5 md:px-4 md:py-2.5 rounded-lg md:rounded-xl font-bold text-xs md:text-sm shadow-sm transition-colors">
              تثبيت
            </button>
            <button onClick={() => setShowInstallPrompt(false)} className="p-1.5 md:p-2.5 rounded-lg md:rounded-xl bg-blue-700 hover:bg-blue-800 transition-colors">
              <X className="w-4 h-4 md:w-5 md:h-5"/>
            </button>
          </div>
        </div>
      )}

      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-800 p-4 flex justify-between items-center text-white">
              <h2 className="text-xl font-bold flex items-center gap-2"><Lock className="w-5 h-5"/> التحقق من الصلاحية</h2>
              <button onClick={() => setIsAuthModalOpen(false)} className="hover:bg-white/20 p-1 rounded-lg transition"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleAuthSubmit} className="p-6 flex flex-col gap-4">
              <div className="text-center text-slate-600 mb-2">
                <ShieldAlert className="w-12 h-12 mx-auto text-rose-500 mb-2" />
                هذا الإجراء مخصص لمدير الموقع فقط.
              </div>
              <div>
                <input required type="password" placeholder="أدخل كلمة المرور..." value={password} onChange={e => setPassword(e.target.value)} className="w-full text-center border-2 border-slate-300 p-3 rounded-xl focus:border-blue-500 focus:outline-none text-lg tracking-widest" />
              </div>
              <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl transition shadow-md">دخول للنظام</button>
            </form>
          </div>
        </div>
      )}

      {isJoinModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-blue-100">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 md:p-6 flex justify-between items-start text-white relative overflow-hidden">
              <div className="relative z-10">
                <h2 className="text-lg md:text-2xl font-bold mb-1">انضم إلى دليلنا!</h2>
                <p className="text-blue-50 text-xs md:text-sm">اجعل خدماتك متاحة للجميع في حمص</p>
              </div>
              <button onClick={() => setIsJoinModalOpen(false)} className="hover:bg-white/20 p-1 rounded-lg transition relative z-10"><X className="w-5 h-5 md:w-6 md:h-6" /></button>
            </div>
            <div className="p-5 md:p-6 text-center">
              <p className="text-slate-600 text-sm md:text-base font-medium mb-5 md:mb-6 leading-relaxed">
                تواصل معنا الآن لإضافة تفاصيل عملك وموقعك مجاناً إلى الدليل الأكبر في المدينة!
              </p>
              <div className="flex flex-col gap-2 md:gap-3">
                <a href={getAddStoreWhatsAppLink()} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-3 md:py-3.5 rounded-xl transition shadow-md shadow-green-200 text-sm md:text-base">
                  <MessageCircle className="w-4 h-4 md:w-5 md:h-5" /> تواصل عبر واتساب
                </a>
                <a href="tel:0954008416" className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 md:py-3.5 rounded-xl transition border border-slate-200 text-sm md:text-base">
                  <Phone className="w-4 h-4 md:w-5 md:h-5 text-blue-600" /> اتصال هاتفي مباشر
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-center items-start md:items-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 mt-10 md:mt-0 mb-10 border border-slate-200">
            <div className={`bg-blue-600 p-4 flex justify-between items-center text-white sticky top-0 transition-colors`}>
              <h2 className="text-lg md:text-xl font-bold">{editId ? 'تعديل البيانات' : 'إضافة خدمة جديدة'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/20 p-1 rounded-lg transition"><X className="w-5 h-5 md:w-6 md:h-6" /></button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-4 md:p-6 flex flex-col gap-3 md:gap-4">
              <div>
                <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1">الاسم الكامل *</label>
                <input required type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="w-full border border-slate-300 p-2 md:p-2.5 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                <div className="flex-1">
                  <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1">الفئة *</label>
                  <input required type="text" list="category-options-form" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border border-slate-300 p-2 md:p-2.5 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white" />
                  <datalist id="category-options-form">
                    {availableCategories.map(cat => <option key={cat} value={cat} />)}
                  </datalist>
                </div>
                <div className="flex-1">
                  <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1">المنطقة *</label>
                  <input required type="text" list="region-options-form" value={formData.region} onChange={e => setFormData({...formData, region: e.target.value})} className="w-full border border-slate-300 p-2 md:p-2.5 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white" />
                  <datalist id="region-options-form">
                    {availableRegions.map(reg => <option key={reg} value={reg} />)}
                  </datalist>
                </div>
              </div>
              <div>
                <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1">رقم الهاتف *</label>
                <input required type="text" dir="ltr" value={formData.phone_number} onChange={e => setFormData({...formData, phone_number: e.target.value})} className="w-full text-left border border-slate-300 p-2 md:p-2.5 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1">الموقع التفصيلي</label>
                <input type="text" value={formData.detailed_address} onChange={e => setFormData({...formData, detailed_address: e.target.value})} className="w-full border border-slate-300 p-2 md:p-2.5 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs md:text-sm font-bold text-slate-700 mb-1">رابط خريطة جوجل (اختياري)</label>
                <input type="url" dir="ltr" value={formData.map_url} onChange={e => setFormData({...formData, map_url: e.target.value})} className="w-full text-left border border-slate-300 p-2 md:p-2.5 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm md:text-base font-bold py-2.5 md:py-3 rounded-xl mt-2 transition shadow-md">
                {editId ? 'حفظ التعديلات' : 'حفظ وإضافة للدليل'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto">
        
        {/* رأس الصفحة (Header) المحدث */}
        <div className="mb-3 md:mb-4 bg-white rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3 md:gap-6 border border-slate-200 relative">
          {/* منطقة مخفية مزدوجة النقر لتسجيل الدخول */}
          <div onDoubleClick={() => setIsAuthModalOpen(true)} className="absolute left-0 top-0 w-16 md:w-24 h-full z-20 cursor-default"></div>

          <div className="flex items-center gap-3 md:gap-4 relative z-10 pointer-events-none self-start md:self-auto">
            <div className="bg-blue-50 p-2 md:p-3 rounded-xl md:rounded-2xl border border-blue-100 text-blue-600">
              <MapPin className="w-5 h-5 md:w-8 md:h-8" />
            </div>
            <div>
              <h1 className="text-lg md:text-4xl font-extrabold text-slate-800 mb-0.5 md:mb-1 tracking-tight">
                مستقبل سورية الحديثة
              </h1>
              <p className="text-slate-500 text-xs md:text-base font-medium">
                دليلك الشامل في مدينة حمص
              </p>
            </div>
          </div>
          
          <div className="flex flex-row flex-wrap w-full md:w-auto gap-2 md:gap-3 relative z-10 justify-end mt-2 md:mt-0">
            {isAdmin && (
              <>
                {/* زر الاستيراد */}
                <label className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 md:px-4 md:py-3.5 rounded-lg md:rounded-xl font-bold flex items-center justify-center gap-1.5 md:gap-2 shadow-sm transition-all text-xs md:text-base cursor-pointer">
                  <Upload className="w-3.5 h-3.5 md:w-4 md:h-4" /> استيراد
                  <input type="file" accept=".xlsx, .xls" onChange={handleImportExcel} className="hidden" />
                </label>

                {/* زر التصدير */}
                <button onClick={handleExportExcel} className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-2 md:px-4 md:py-3.5 rounded-lg md:rounded-xl font-bold flex items-center justify-center gap-1.5 md:gap-2 shadow-sm transition-all text-xs md:text-base">
                  <Download className="w-3.5 h-3.5 md:w-4 md:h-4" /> تصدير
                </button>

                <button onClick={openAddModal} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 md:px-4 md:py-3.5 rounded-lg md:rounded-xl font-bold flex items-center justify-center gap-1.5 md:gap-2 shadow-sm transition-all text-xs md:text-base">
                  <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" /> إضافة
                </button>

                <button onClick={handleLogout} className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-2 md:px-4 md:py-3.5 rounded-lg md:rounded-xl font-bold flex items-center justify-center gap-1.5 md:gap-2 border border-rose-200 transition-all text-xs md:text-base">
                  <LogOut className="w-3.5 h-3.5 md:w-4 md:h-4" /> خروج
                </button>
              </>
            )}
          </div>
        </div>

        {/* القسم التعريفي (Hero Banner) */}
        <div className="mb-4 md:mb-6 bg-gradient-to-l from-blue-600 to-indigo-700 rounded-2xl md:rounded-3xl p-5 md:p-10 shadow-lg text-white flex flex-col relative overflow-hidden">
          <div className="absolute -left-5 -top-5 md:-left-10 md:-top-10 opacity-10 pointer-events-none">
          </div>
          <div className="relative z-10 max-w-3xl text-center md:text-right">
            <h2 className="text-base md:text-3xl font-extrabold mb-2 md:mb-4 leading-snug">
              منصتك الأولى للوصول السريع إلى كل ما تحتاجه في حمص
            </h2>
            <p className="text-blue-100 text-[11px] md:text-lg leading-relaxed mb-4 md:mb-6">
              نحن نوفر لك عناء البحث! سواء كنت تبحث عن طبيب مختص، محامٍ، خدمات صيانة، أو حتى <strong className="text-white">المحلات التجارية والأسواق</strong>، ستجد كل التفاصيل وطرق التواصل هنا في مكان واحد وبسهولة تامة.
            </p>
            <div className="flex flex-wrap justify-center md:justify-start gap-1.5 md:gap-3">
              <span className="flex items-center gap-1 md:gap-1.5 bg-white/20 backdrop-blur-sm border border-white/30 px-2.5 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl text-[10px] md:text-sm font-medium"><Briefcase className="w-3 h-3 md:w-4 md:h-4"/> المهن والخدمات</span>
              <span className="flex items-center gap-1 md:gap-1.5 bg-white/20 backdrop-blur-sm border border-white/30 px-2.5 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl text-[10px] md:text-sm font-medium"><Store className="w-3 h-3 md:w-4 md:h-4"/> المحلات التجارية</span>
              <span className="flex items-center gap-1 md:gap-1.5 bg-white/20 backdrop-blur-sm border border-white/30 px-2.5 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl text-[10px] md:text-sm font-medium"><CheckCircle2 className="w-3 h-3 md:w-4 md:h-4"/> تحديث مستمر</span>
            </div>
          </div>
        </div>

        {/* الفلاتر (Filters) */}
        <div className="bg-white p-3 md:p-4 rounded-xl md:rounded-2xl shadow-sm border border-slate-200 mb-5 flex flex-col md:flex-row gap-2 md:gap-3 relative z-30">
          <div className="w-full flex-[2]">
            <form onSubmit={handleSearch} className="relative">
              <input type="text" placeholder="ابحث بالاسم، المحل، أو الخدمة..." value={searchName} onChange={(e) => setSearchName(e.target.value)} className="w-full pr-9 pl-3 py-2 md:py-3 text-xs md:text-sm border border-slate-300 rounded-lg md:rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              <Search className="absolute right-3 top-2.5 md:top-3.5 text-slate-400 w-3.5 h-3.5 md:w-4 md:h-4" />
            </form>
          </div>
          
          <div className="flex w-full gap-2 md:gap-3 flex-[2]">
            <div className="flex-1 relative">
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full px-3 md:px-4 py-2 md:py-3 text-[11px] md:text-sm border border-slate-300 rounded-lg md:rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white cursor-pointer appearance-none text-slate-600 pr-8">
                <option value="">اختر الفئة...</option>
                {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <Filter className="absolute right-2.5 top-2.5 md:top-3.5 text-slate-400 w-3.5 h-3.5 md:w-4 md:h-4 pointer-events-none" />
            </div>
            <div className="flex-1 relative">
              <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)} className="w-full px-3 md:px-4 py-2 md:py-3 text-[11px] md:text-sm border border-slate-300 rounded-lg md:rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white cursor-pointer appearance-none text-slate-600 pr-8">
                <option value="">اختر المنطقة...</option>
                {availableRegions.map(reg => <option key={reg} value={reg}>{reg}</option>)}
              </select>
              <MapPin className="absolute right-2.5 top-2.5 md:top-3.5 text-slate-400 w-3.5 h-3.5 md:w-4 md:h-4 pointer-events-none" />
            </div>
          </div>
          
          <div className="flex gap-2 w-full md:w-auto mt-1 md:mt-0">
            <button onClick={handleSearch} className="flex-1 md:w-28 flex justify-center items-center gap-1.5 md:gap-2 bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 md:py-3 rounded-lg md:rounded-xl transition shadow-sm text-xs md:text-sm">
              <Search className="w-3.5 h-3.5 md:w-4 md:h-4" /> بحث
            </button>
            {(searchName || selectedCategory || selectedRegion) && (
              <button onClick={clearFilters} className="flex justify-center items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl transition border border-rose-200" title="إلغاء الفلترة">
                <RefreshCcw className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </button>
            )}
          </div>
        </div>

        {/* عرض النتائج والبانر الجديد */}
        {!hasSearched ? (
           <div className="bg-white rounded-xl md:rounded-2xl p-6 md:p-12 text-center border border-slate-200 shadow-sm flex flex-col items-center gap-2 md:gap-4">
             <div className="bg-blue-50 p-3 md:p-5 rounded-full mb-1 md:mb-2">
               <Search className="w-6 h-6 md:w-10 md:h-10 text-blue-500" />
             </div>
             <h3 className="text-base md:text-xl font-bold text-slate-800">ابدأ البحث الآن</h3>
             <p className="text-slate-500 text-xs md:text-base max-w-md mx-auto">استخدم الفلاتر في الأعلى للعثور على أي مهنة أو محل تجاري تبحث عنه في مدينتك بكل سهولة.</p>
           </div>
        ) : loading ? (
           <div className="p-6 md:p-12 text-center text-slate-500 text-sm md:text-base font-bold animate-pulse">جاري جلب البيانات...</div>
        ) : (
          <div className="flex flex-col gap-4 md:gap-6">
            {listings.length === 0 ? (
               <div className="bg-white rounded-xl md:rounded-2xl p-6 md:p-12 text-center text-slate-500 border border-slate-200 shadow-sm flex flex-col items-center gap-2">
                 <Search className="w-6 h-6 md:w-8 md:h-8 text-slate-300" />
                 <p className="text-sm md:text-base">لم يتم العثور على نتائج تطابق بحثك.</p>
               </div>
            ) : (
              <div>
                {/* العرض على شاشات الكمبيوتر */}
                <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 text-sm border-b border-slate-200">
                        <th className="p-4 font-bold w-16 text-center">#</th>
                        <th className="p-4 font-bold w-48">الاسم الكامل / المحل</th>
                        <th className="p-4 font-bold w-32">الفئة</th>
                        <th className="p-4 font-bold w-32">المنطقة</th>
                        <th className="p-4 font-bold">الموقع التفصيلي</th>
                        <th className="p-4 font-bold w-32 text-center">الخريطة</th>
                        <th className="p-4 font-bold w-36">الرقم</th>
                        <th className="p-4 font-bold w-44 text-center">التواصل {isAdmin && 'والإدارة'}</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-700">
                      {listings.map((item, index) => (
                        <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition group">
                          <td className="p-4 text-center font-bold text-slate-400 group-hover:text-blue-600 transition-colors">{index + 1}</td>
                          <td className="p-4 font-bold text-slate-900">{item.full_name}</td>
                          <td className="p-4 text-slate-700 font-medium">{item.category}</td>
                          <td className="p-4 text-slate-700 font-medium">{item.region}</td>
                          <td className="p-4 text-sm max-w-xs truncate text-slate-600">{item.detailed_address}</td>
                          <td className="p-4 text-center">
                            <a href={getMapLink(item)} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white rounded-lg text-xs font-bold transition border border-rose-100 shadow-sm">
                              <MapPin className="w-3.5 h-3.5" /> الخريطة
                            </a>
                          </td>
                          <td className="p-4">
                            <div className="bg-slate-100 text-slate-800 px-3 py-1.5 rounded-lg w-fit border border-slate-200 font-bold shadow-sm group-hover:border-blue-200 group-hover:bg-white transition-all"><span dir="ltr">{item.phone_number}</span></div>
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2 justify-center items-center">
                              <a href={getWhatsAppLink(item.phone_number)} target="_blank" rel="noreferrer" className="flex items-center justify-center p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition shadow-sm" title="واتساب"><MessageCircle className="w-4 h-4" /></a>
                              <a href={`tel:${item.phone_number}`} className="flex items-center justify-center p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition shadow-sm" title="اتصال"><Phone className="w-4 h-4" /></a>
                              
                              {isAdmin && (
                                <>
                                  <button onClick={() => openEditModal(item)} className="flex items-center justify-center p-2 bg-slate-100 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition border border-slate-200 shadow-sm" title="تعديل"><Edit className="w-4 h-4" /></button>
                                  <button onClick={() => executeDelete(item.id, item.full_name)} className="flex items-center justify-center p-2 bg-slate-100 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition border border-slate-200 shadow-sm" title="حذف"><Trash2 className="w-4 h-4" /></button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* العرض المضغوط على شاشات الهواتف المحمولة */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:hidden">
                  {listings.map((item) => (
                    <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-2 relative mt-1">
                      
                      {isAdmin && (
                        <div className="absolute top-2 left-2 flex gap-1.5">
                          <button onClick={() => openEditModal(item)} className="p-1.5 bg-slate-50 text-blue-500 hover:bg-blue-500 hover:text-white rounded-md transition border border-slate-200" title="تعديل"><Edit className="w-3.5 h-3.5" /></button>
                          <button onClick={() => executeDelete(item.id, item.full_name)} className="p-1.5 bg-slate-50 text-rose-500 hover:bg-rose-500 hover:text-white rounded-md transition border border-slate-200" title="حذف"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-start pr-1">
                        <div>
                          <h3 className="font-bold text-sm text-slate-900 pr-12">{item.full_name}</h3>
                        </div>
                      </div>
                      
                      <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg mt-1 border border-slate-100 flex flex-col gap-1.5">
                        <p><strong className="text-slate-900">الفئة:</strong> {item.category}</p>
                        <p><strong className="text-slate-900">المنطقة:</strong> {item.region}</p>
                        {item.detailed_address && <p><strong className="text-slate-900">العنوان:</strong> {item.detailed_address}</p>}
                        <p className="flex items-center gap-1.5"><strong className="text-slate-900">الرقم:</strong> <span dir="ltr" className="font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">{item.phone_number}</span></p>
                      </div>

                      <div className="flex gap-1.5 mt-1">
                        <a href={getWhatsAppLink(item.phone_number)} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-bold transition shadow-sm">
                          <MessageCircle className="w-3.5 h-3.5" /> واتساب
                        </a>
                        <a href={`tel:${item.phone_number}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition shadow-sm">
                          <Phone className="w-3.5 h-3.5" /> اتصال
                        </a>
                        <a href={getMapLink(item)} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center px-3 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white rounded-lg text-[10px] font-bold transition border border-rose-100 shadow-sm" title="عرض الخريطة">
                          <MapPin className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* البانر السفلي */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl md:rounded-3xl p-4 md:p-8 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 shadow-sm">
              <div className="flex items-center gap-4 text-center md:text-right">
                <div className="bg-white p-3 md:p-4 rounded-full text-blue-600 shadow-sm hidden md:block">
                </div>
                <div>
                  <h4 className="text-sm md:text-xl font-bold text-slate-800 mb-1 md:mb-2">لم تجد متجرك أو مهنتك في البحث؟</h4>
                  <p className="text-slate-600 text-[11px] md:text-base">يمكنك إضافته الآن عبر الواتساب ليكون متاحاً لجميع زوار الدليل في حمص.</p>
                </div>
              </div>
              <a href={getAddStoreWhatsAppLink()} target="_blank" rel="noreferrer" className="w-full md:w-auto flex items-center justify-center gap-1.5 md:gap-2 bg-green-500 hover:bg-green-600 text-white px-4 md:px-8 py-3 md:py-4 rounded-xl font-bold transition shadow-md hover:shadow-lg hover:-translate-y-1 whitespace-nowrap text-xs md:text-base">
                <MessageCircle className="w-4 h-4 md:w-6 md:h-6" /> إضافة عملي للدليل
              </a>
            </div>
          </div>
        )}

        {/* التذييل */}
        {!isAdmin && (
          <div className="mt-8 md:mt-12 mb-6 md:mb-8 bg-white rounded-2xl md:rounded-3xl p-6 md:p-12 shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center gap-3 md:gap-4 relative overflow-hidden">
            
            <div className="bg-blue-50 p-3 md:p-4 rounded-full mb-1 md:mb-2 text-blue-600">
              <Star className="w-6 h-6 md:w-8 md:h-8" />
            </div>
            <h3 className="text-lg md:text-3xl font-extrabold text-slate-800">هل تملك نشاطاً تجارياً أو مهنياً في حمص؟</h3>
            <p className="text-slate-500 text-xs md:text-lg max-w-xl leading-relaxed">
              لا تفوت فرصة الوصول لعملائك! اجعل خدماتك ومحلك التجاري متاحاً لآلاف الزوار مجاناً عبر الانضمام إلى دليلنا.
            </p>
            <button onClick={() => setIsJoinModalOpen(true)} className="mt-2 md:mt-4 bg-blue-600 hover:bg-blue-700 text-white px-5 md:px-8 py-3 md:py-4 rounded-xl font-bold flex items-center justify-center gap-1.5 md:gap-2 shadow-md hover:shadow-lg transition-all hover:-translate-y-1 z-10 text-xs md:text-base">
              <Plus className="w-4 h-4 md:w-5 md:h-5" /> أضف أعمالك للدليل الآن
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;