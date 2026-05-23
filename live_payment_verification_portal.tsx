import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Search, 
  Plus, 
  Download, 
  Upload, 
  Database, 
  RefreshCw, 
  AlertCircle, 
  DollarSign, 
  Users, 
  FileSpreadsheet, 
  Edit3, 
  Trash2,
  Check,
  X,
  Info,
  Clock,
  Wifi,
  WifiOff,
  UserCheck
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithCustomToken, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  query
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyArmp7F11o7Lk_pNdvtyyaVXwhTjA2HyIU",
  authDomain: "persisanaksoleh.firebaseapp.com",
  projectId: "persisanaksoleh",
  storageBucket: "persisanaksoleh.firebasestorage.app",
  messagingSenderId: "945287645110",
  appId: "1:945287645110:web:5a66b4819e85332c402317",
  measurementId: "G-QG1TB5D15V"
};

// Check if running in a canvas environment with a pre-configured override, otherwise fallback to your keys
const finalConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : firebaseConfig;
const app = initializeApp(finalConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'persisanaksoleh-verify';

export default function App() {
  const [user, setUser] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("connecting"); // "connecting" | "connected" | "error"
  const [registrations, setRegistrations] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  
  // Modals and form state
  const [editingItem, setEditingItem] = useState(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null); // Used for a custom safety confirm dialog
  const [activeTab, setActiveTab] = useState("list"); // "list" | "instructions"
  
  // Direct Copy-Paste spreadsheet text
  const [pasteData, setPasteData] = useState("");
  const [importHeaders, setImportHeaders] = useState({
    name: 1,
    email: 2,
    phone: 3,
    category: 4,
    amount: 5,
    status: 6
  });

  // Form states for manual adding
  const [newRecord, setNewRecord] = useState({
    name: "",
    email: "",
    phone: "",
    category: "Professional",
    amount: 150,
    status: "Unpaid",
    notes: ""
  });

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth initialization failed:", error);
        setConnectionStatus("error");
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Strict Collection Path: Rule 1
    const publicCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'registrations');
    const q = query(publicCollectionRef);

    setConnectionStatus("connecting");
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const items = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort in memory by timestamp (Rule 2)
        const sortedItems = items.sort((a, b) => {
          return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
        });

        setRegistrations(sortedItems);
        setConnectionStatus("connected");
      },
      (error) => {
        console.error("Firestore database snapshot error: ", error);
        setConnectionStatus("error");
      }
    );

    return () => unsubscribe();
  }, [user]);

  const stats = useMemo(() => {
    const total = registrations.length;
    const paidList = registrations.filter(r => r.status === "Paid");
    const pendingList = registrations.filter(r => r.status === "Pending");
    const unpaidList = registrations.filter(r => r.status === "Unpaid");
    
    const paidCount = paidList.length;
    const pendingCount = pendingList.length;
    const unpaidCount = unpaidList.length;
    
    const totalRevenue = paidList.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const pendingRevenue = pendingList.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    
    return {
      total,
      paidCount,
      pendingCount,
      unpaidCount,
      totalRevenue,
      pendingRevenue
    };
  }, [registrations]);

  // Dynamic unique categories list
  const categories = useMemo(() => {
    const cats = new Set(registrations.map(r => r.category).filter(Boolean));
    return ["All", ...Array.from(cats)];
  }, [registrations]);

  // Filter registrations list with reactive elements
  const filteredRegistrations = useMemo(() => {
    return registrations.filter(item => {
      const nameMatch = item.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const emailMatch = item.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const idMatch = item.id?.toLowerCase().includes(searchTerm.toLowerCase());
      const phoneMatch = item.phone?.includes(searchTerm);
      
      const matchesSearch = nameMatch || emailMatch || idMatch || phoneMatch;
      const matchesStatus = statusFilter === "All" || item.status === statusFilter;
      const matchesCategory = categoryFilter === "All" || item.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [registrations, searchTerm, statusFilter, categoryFilter]);

  const handleVerifyStatus = async (id, nextStatus) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'registrations', id);
      await updateDoc(docRef, {
        status: nextStatus,
        paymentDate: nextStatus === "Paid" ? new Date().toISOString().split('T')[0] : "",
        verifiedBy: nextStatus === "Paid" ? `Admin (${user.uid.slice(0, 5)})` : ""
      });
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  const handleSaveVerification = async (e) => {
    e.preventDefault();
    if (!user || !editingItem) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'registrations', editingItem.id);
      await updateDoc(docRef, {
        status: editingItem.status,
        verifiedBy: editingItem.verifiedBy || `Admin (${user.uid.slice(0, 5)})`,
        paymentDate: editingItem.paymentDate || new Date().toISOString().split('T')[0],
        refNo: editingItem.refNo || "",
        notes: editingItem.notes || ""
      });
      setEditingItem(null);
    } catch (err) {
      console.error("Error saving verification:", err);
    }
  };

  const handleAddManualRecord = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      const publicCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'registrations');
      const docData = {
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        name: newRecord.name,
        email: newRecord.email,
        phone: newRecord.phone,
        category: newRecord.category,
        amount: parseFloat(newRecord.amount) || 0,
        status: newRecord.status,
        verifiedBy: newRecord.status === "Paid" ? `Admin (${user.uid.slice(0, 5)})` : "",
        paymentDate: newRecord.status === "Paid" ? new Date().toISOString().split('T')[0] : "",
        refNo: "",
        notes: newRecord.notes
      };

      await addDoc(publicCollectionRef, docData);
      setIsNewModalOpen(false);
      setNewRecord({
        name: "",
        email: "",
        phone: "",
        category: "Professional",
        amount: 150,
        status: "Unpaid",
        notes: ""
      });
    } catch (err) {
      console.error("Error adding record:", err);
    }
  };

  const handlePasteImport = async () => {
    if (!pasteData.trim() || !user) return;

    const rows = pasteData.split("\n");
    
    for (const row of rows) {
      if (!row.trim()) continue;
      const columns = row.split("\t");
      if (columns.length < 2) continue;

      const name = columns[importHeaders.name - 1] || "Unnamed";
      const email = columns[importHeaders.email - 1] || "";
      const phone = columns[importHeaders.phone - 1] || "";
      const category = columns[importHeaders.category - 1] || "General";
      const amountRaw = columns[importHeaders.amount - 1] || "0";
      const amount = parseFloat(amountRaw.replace(/[^0-9.-]+/g, "")) || 0;
      
      let status = "Unpaid";
      const statusRaw = (columns[importHeaders.status - 1] || "").toLowerCase();
      if (statusRaw.includes("paid") || statusRaw.includes("yes") || statusRaw.includes("done") || statusRaw.includes("verified")) {
        status = "Paid";
      } else if (statusRaw.includes("pending") || statusRaw.includes("wait")) {
        status = "Pending";
      }

      try {
        const publicCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'registrations');
        await addDoc(publicCollectionRef, {
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          category: category.trim(),
          amount: amount,
          status: status,
          verifiedBy: status === "Paid" ? "System Import" : "",
          paymentDate: status === "Paid" ? new Date().toISOString().split('T')[0] : "",
          refNo: "",
          notes: "Imported live from Google Sheet."
        });
      } catch (err) {
        console.error("Failed to write imported row:", err);
      }
    }

    setPasteData("");
    setIsImportOpen(false);
  };

  // Live Delete validation handler
  const handleDeleteItem = async () => {
    if (!user || !deletingId) return;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'registrations', deletingId);
    try {
      await deleteDoc(docRef);
      setDeletingId(null);
    } catch (err) {
      console.error("Error deleting registration record:", err);
    }
  };

  const handleExportCSV = () => {
    const headers = ["ID", "Timestamp", "Name", "Email", "Phone", "Category", "Amount", "Status", "Verified By", "Payment Date", "Ref No", "Notes"];
    const rows = registrations.map(r => [
      r.id,
      r.timestamp,
      `"${(r.name || "").replace(/"/g, '""')}"`,
      r.email,
      r.phone,
      r.category,
      r.amount,
      r.status,
      r.verifiedBy || "",
      r.paymentDate || "",
      r.refNo || "",
      `"${(r.notes || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `payment_audit_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      {/* Header Banner */}
      <header className="bg-gradient-to-r from-emerald-700 via-teal-700 to-teal-800 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-5 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md">
              <Database className="h-8 w-8 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white">Persis Anak Soleh</h1>
                {/* Live connection badge */}
                {connectionStatus === "connected" && (
                  <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 text-xs px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-medium">
                    <Wifi className="h-3 w-3 animate-pulse" /> Live DB Connected
                  </span>
                )}
                {connectionStatus === "connecting" && (
                  <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 text-xs px-2.5 py-0.5 rounded-full border border-amber-500/30 font-medium">
                    <RefreshCw className="h-3 w-3 animate-spin" /> Syncing...
                  </span>
                )}
                {connectionStatus === "error" && (
                  <span className="inline-flex items-center gap-1 bg-rose-500/20 text-rose-300 text-xs px-2.5 py-0.5 rounded-full border border-rose-500/30 font-medium">
                    <WifiOff className="h-3 w-3" /> Connection Down
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-200">Real-time payment coordination platform & Google Sheet sync</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setActiveTab("list")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'list' ? 'bg-white text-teal-900 shadow-sm' : 'text-white hover:bg-white/10'}`}
            >
              Verify Dashboard
            </button>
            <button 
              onClick={() => setActiveTab("instructions")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'instructions' ? 'bg-white text-teal-900 shadow-sm' : 'text-white hover:bg-white/10'}`}
            >
              Google Sheet Connection Setup
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 sm:px-6 lg:px-8">
        
        {activeTab === "list" ? (
          <>
            {/* Statistics Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Registered</span>
                  <span className="text-2xl font-bold text-slate-900 block mt-1">{stats.total}</span>
                  <span className="text-[11px] text-slate-400">Database entries</span>
                </div>
                <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
                  <Users className="h-6 w-6" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Verified Paid</span>
                  <span className="text-2xl font-bold text-emerald-600 block mt-1">{stats.paidCount}</span>
                  <span className="text-[11px] text-emerald-600 font-medium">
                    {stats.total > 0 ? Math.round((stats.paidCount / stats.total) * 100) : 0}% success rate
                  </span>
                </div>
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                  <CheckCircle className="h-6 w-6" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Pending Proof</span>
                  <span className="text-2xl font-bold text-amber-500 block mt-1">{stats.pendingCount}</span>
                  <span className="text-[11px] text-amber-500 font-medium">Requires audit review</span>
                </div>
                <div className="p-3 bg-amber-50 text-amber-500 rounded-xl">
                  <Clock className="h-6 w-6" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Collected</span>
                  <span className="text-2xl font-bold text-slate-900 block mt-1">${stats.totalRevenue.toFixed(2)}</span>
                  <span className="text-[11px] text-slate-400">${stats.pendingRevenue.toFixed(2)} in pipeline</span>
                </div>
                <div className="p-3 bg-slate-50 text-slate-600 rounded-xl">
                  <DollarSign className="h-6 w-6" />
                </div>
              </div>
            </div>

            {/* Quick Action Bar */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6 flex flex-wrap gap-4 items-center justify-between">
              {/* Search and Filters */}
              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <div className="relative flex-1 sm:w-80 min-w-[240px]">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <Search className="h-5 w-5" />
                  </span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by Name, Email, or ID..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-slate-50/50"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="All">All Statuses</option>
                  <option value="Paid">Paid Only</option>
                  <option value="Pending">Pending Audit</option>
                  <option value="Unpaid">Unpaid Only</option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat === "All" ? "All Categories" : cat}</option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  onClick={() => setIsImportOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition bg-white shadow-sm"
                >
                  <Upload className="h-4 w-4 text-emerald-500" />
                  Import Sheets Row
                </button>
                <button
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition bg-white shadow-sm"
                >
                  <Download className="h-4 w-4 text-teal-500" />
                  Export to CSV
                </button>
                <button
                  onClick={() => setIsNewModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold transition shadow-sm"
                >
                  <Plus className="h-4 w-4" />
                  Add Person
                </button>
              </div>
            </div>

            {/* Database Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold tracking-wider uppercase font-mono">
                      <th className="py-4 px-6">Participant Details</th>
                      <th className="py-4 px-6">Timestamp & Group</th>
                      <th className="py-4 px-6 text-right">Fee ($)</th>
                      <th className="py-4 px-6 text-center">Payment Status</th>
                      <th className="py-4 px-6">Validation Audit Trail</th>
                      <th className="py-4 px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredRegistrations.length > 0 ? (
                      filteredRegistrations.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          
                          {/* Participant Contact */}
                          <td className="py-4 px-6">
                            <span className="font-bold text-slate-950 block">{item.name}</span>
                            <div className="text-xs text-slate-500 mt-1 space-y-0.5 font-mono">
                              <span className="block">{item.email}</span>
                              <span className="block">{item.phone}</span>
                            </div>
                          </td>

                          {/* Timestamp & Category */}
                          <td className="py-4 px-6">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-teal-50 text-teal-700 mb-1 border border-teal-100">
                              {item.category}
                            </span>
                            <span className="text-[11px] text-slate-400 block font-mono">{item.timestamp}</span>
                          </td>

                          {/* Fee */}
                          <td className="py-4 px-6 text-right font-mono font-semibold text-slate-900">
                            ${parseFloat(item.amount).toFixed(2)}
                          </td>

                          {/* Payment Status Badge */}
                          <td className="py-4 px-6 text-center">
                            <div className="inline-flex flex-col items-center">
                              {item.status === "Paid" && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Paid
                                </span>
                              )}
                              {item.status === "Pending" && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span> Pending Proof
                                </span>
                              )}
                              {item.status === "Unpaid" && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span> Unpaid
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Validation Audit Info */}
                          <td className="py-4 px-6">
                            {item.status === "Paid" ? (
                              <div className="text-xs space-y-1">
                                <span className="font-semibold text-slate-800 block">Ref: {item.refNo || 'Instant Pay/Tfr'}</span>
                                <div className="text-slate-400 flex items-center gap-1">
                                  <UserCheck className="h-3.5 w-3.5" />
                                  <span>{item.verifiedBy} ({item.paymentDate})</span>
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-slate-500 italic max-w-xs break-all line-clamp-2">
                                {item.notes ? item.notes : "No bank statements matched yet"}
                              </div>
                            )}
                          </td>

                          {/* Live Action Buttons */}
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {item.status !== "Paid" && (
                                <button
                                  onClick={() => handleVerifyStatus(item.id, "Paid")}
                                  title="Verify Received"
                                  className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                              )}
                              {item.status === "Paid" && (
                                <button
                                  onClick={() => handleVerifyStatus(item.id, "Unpaid")}
                                  title="Mark as Unpaid"
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              )}
                              
                              <button
                                onClick={() => setEditingItem(item)}
                                title="Edit Live Verification"
                                className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>

                              <button
                                onClick={() => setDeletingId(item.id)}
                                title="Delete Registry Link"
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="py-12 text-center text-slate-400">
                          <AlertCircle className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                          <p className="font-semibold text-slate-600">No registrations synchronized yet</p>
                          <p className="text-xs mt-1">Try typing a different query or syncing items.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 font-mono">
                <span>Active Database: Firestore Live Stream</span>
                <span>UUID: {user ? user.uid : "Connecting User ID..."}</span>
              </div>
            </div>
          </>
        ) : (
          /* Instructions Tab */
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <FileSpreadsheet className="h-6 w-6 text-emerald-500" />
              How to Stream Your Google Form Data
            </h2>
            <p className="text-slate-600 mb-6">
              When registrations come in from your Google Form, they land inside a connected Google Sheet. Connecting that data to this dashboard is incredibly straightforward:
            </p>

            <div className="space-y-6">
              {/* Method 1 */}
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 mb-2">
                  Simplest Option
                </span>
                <h3 className="font-bold text-slate-800 text-base mb-2">Method 1: Copy-Paste Import (Live-Synced)</h3>
                <ol className="list-decimal list-inside text-sm text-slate-600 space-y-2">
                  <li>Open your registration responses <strong>Google Sheet</strong>.</li>
                  <li>Highlight the newly submitted rows.</li>
                  <li>Press <strong>Ctrl + C</strong> (Windows) or <strong>Cmd + C</strong> (Mac).</li>
                  <li>Click <strong className="text-teal-600 font-bold">"Import Sheets Row"</strong> in this dashboard.</li>
                  <li>Press <strong>Ctrl + V</strong> and import. The rows instantly stream to the live database for everyone on your team!</li>
                </ol>
              </div>

              {/* Method 2 */}
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 mb-2">
                  Automated Way
                </span>
                <h3 className="font-bold text-slate-800 text-base mb-2">Method 2: Google AppSheet Integration</h3>
                <p className="text-xs text-slate-500 mb-2">If you want to view, track and verify payments directly from a mobile interface directly tied to your Google Sheet:</p>
                <ol className="list-decimal list-inside text-sm text-slate-600 space-y-2">
                  <li>In your responses Google Sheet, click the <strong>Extensions</strong> top menu.</li>
                  <li>Select <strong>AppSheet</strong> &gt; <strong>Create an app</strong>.</li>
                  <li>AppSheet reads your columns (e.g. Name, Phone, Email, Amount, and Payment Status).</li>
                  <li>Set your payment status column type to <code>Enum</code> with options: <em>Paid, Pending, Unpaid</em>.</li>
                  <li>Your team can download the AppSheet on their phones and verify payments on the fly, with changes saving instantly directly back to the original spreadsheet!</li>
                </ol>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400 mt-12">
        <p>© 2026 Persis Anak Soleh — Realtime Database Synchronization Active.</p>
      </footer>

      {/* --- MODALS & CUSTOM OVERLAYS (No window.alert/confirm used) --- */}

      {/* Safe Custom Confirm Delete Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-slate-200 p-6 transform transition-all animate-in fade-in duration-200">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-rose-500" />
              Remove Record?
            </h3>
            <p className="text-sm text-slate-500 mt-2">
              Are you sure you want to permanently delete this registration record from the live database? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 rounded-xl shadow-sm"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Audit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl border border-slate-200 overflow-hidden transform transition-all animate-in fade-in duration-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Verify Payment</h3>
                <p className="text-xs text-slate-500">Record verification proofs for {editingItem.name}</p>
              </div>
              <button 
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVerification} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 tracking-wider mb-2">Payment Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {["Unpaid", "Pending", "Paid"].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setEditingItem({ ...editingItem, status: st })}
                      className={`py-2 px-3 text-xs font-semibold rounded-xl border text-center transition ${
                        editingItem.status === st
                          ? st === "Paid" ? "bg-emerald-50 text-emerald-700 border-emerald-500 shadow-sm"
                            : st === "Pending" ? "bg-amber-50 text-amber-700 border-amber-500 shadow-sm"
                            : "bg-rose-50 text-rose-700 border-rose-500 shadow-sm"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Verified By</label>
                  <input
                    type="text"
                    value={editingItem.verifiedBy || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, verifiedBy: e.target.value })}
                    placeholder="Auditor Name / Team ID"
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Verification Date</label>
                  <input
                    type="date"
                    value={editingItem.paymentDate || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, paymentDate: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Transaction Ref / Receipt ID</label>
                <input
                  type="text"
                  value={editingItem.refNo || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, refNo: e.target.value })}
                  placeholder="e.g. TXN-912803"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Audit Notes / Explanatory Remarks</label>
                <textarea
                  rows="3"
                  value={editingItem.notes || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, notes: e.target.value })}
                  placeholder="Insert transaction receipt timing, bank transfer numbers, or notes for fuzzy receipt photos..."
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-teal-600 text-white rounded-xl hover:bg-teal-700 shadow-sm"
                >
                  Save Live
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Record Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl border border-slate-200 overflow-hidden transform transition-all">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Add Live Registration</h3>
              <button 
                onClick={() => setIsNewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddManualRecord} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newRecord.name}
                  onChange={(e) => setNewRecord({ ...newRecord, name: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={newRecord.email}
                    onChange={(e) => setNewRecord({ ...newRecord, email: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={newRecord.phone}
                    onChange={(e) => setNewRecord({ ...newRecord, phone: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Category / Group</label>
                  <input
                    type="text"
                    value={newRecord.category}
                    onChange={(e) => setNewRecord({ ...newRecord, category: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Ticket Fee ($)</label>
                  <input
                    type="number"
                    value={newRecord.amount}
                    onChange={(e) => setNewRecord({ ...newRecord, amount: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Payment Status</label>
                <select
                  value={newRecord.status}
                  onChange={(e) => setNewRecord({ ...newRecord, status: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50"
                >
                  <option value="Unpaid">Unpaid</option>
                  <option value="Pending">Pending Audit</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  rows="2"
                  value={newRecord.notes}
                  onChange={(e) => setNewRecord({ ...newRecord, notes: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-teal-600 text-white rounded-xl hover:bg-teal-700 shadow-sm"
                >
                  Publish to Cloud
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Paste Import Modal */}
      {isImportOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-xl border border-slate-200 overflow-hidden transform transition-all">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Live Bulk Import (Google Sheets)</h3>
                <p className="text-xs text-slate-500">Rows copied will be posted directly to the live cloud</p>
              </div>
              <button 
                onClick={() => setIsImportOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-3.5 flex gap-2.5 text-xs text-teal-800">
                <Info className="h-4 w-4 text-teal-500 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Live Synced Clipboard Importer:</span> Select and copy a grid of cells in Google Sheets, then paste below. Column mapping allows you to customize where columns are located.
                </div>
              </div>

              {/* Column Mapping Grid */}
              <div>
                <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Column Mapping (Index in copied row, starting at 1)</span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {Object.entries(importHeaders).map(([key, value]) => (
                    <div key={key} className="bg-slate-50 p-2 border border-slate-200 rounded-lg text-center">
                      <span className="block text-[10px] font-bold text-slate-500 capitalize">{key}</span>
                      <input
                        type="number"
                        min="1"
                        value={value}
                        onChange={(e) => setImportHeaders({...importHeaders, [key]: parseInt(e.target.value) || 1})}
                        className="w-full mt-1 text-center bg-white border border-slate-200 rounded text-xs p-1 focus:ring-1 focus:ring-teal-500 focus:outline-none font-bold"
                      />
                      <span className="text-[9px] text-slate-400">Col {value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Paste Spreadsheet Rows</label>
                <textarea
                  rows="8"
                  value={pasteData}
                  onChange={(e) => setPasteData(e.target.value)}
                  placeholder="Paste here (Example: John Doe	john@example.com	60123...)"
                  className="w-full font-mono text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsImportOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePasteImport}
                  disabled={!pasteData.trim()}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl disabled:opacity-50 shadow-sm"
                >
                  Upload {pasteData.split("\n").filter(Boolean).length} Live Rows
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}