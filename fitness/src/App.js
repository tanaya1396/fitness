import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query 
} from 'firebase/firestore';
import { 
  Calendar as CalendarIcon, 
  Dumbbell, 
  Footprints, 
  HeartPulse, 
  ChevronLeft, 
  ChevronRight, 
  Trophy,
  Users,
  Save,
  CheckCircle2,
  Target,
  Activity,
  Scale,
  LayoutDashboard,
  List,
  Flame,
  Zap,
  Timer,
  Plus,
  Trash2,
  Settings,
  X
} from 'lucide-react';
import './App.css';
// --- 1. CONFIGURATION ---
// 🔴 IMPORTANT: Replace the values below with your specific keys from:
// Firebase Console -> Project Overview (Gear Icon) -> Project Settings -> General -> "Your apps"
const firebaseConfig = {
  apiKey: "REPLACE_WITH_YOUR_API_KEY",
  authDomain: "REPLACE_WITH_YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket: "REPLACE_WITH_YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "REPLACE_WITH_NUMBERS",
  appId: "REPLACE_WITH_APP_ID"
};

// Initialize Firebase (Only App and DB, no Auth needed for public/test mode)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
// This ID separates your data from others if using a shared DB, but crucial for your path structure
const appId = 'trio-fitness-app'; 

// --- Constants & Options ---
const MINUTE_OPTIONS = [0, 10, 15, 20, 30, 40, 45, 50, 60, 75, 90, 120];
const BODY_FOCUS_OPTIONS = ["-", "Full Body", "Upper Body", "Lower Body", "Chest", "Back", "Legs", "Arms", "Shoulders", "Core", "Cardio Day", "Rest"];
const REP_OPTIONS = ["-", "1-5 (Strength)", "6-10 (Hypertrophy)", "12-15 (Endurance)", "15-20 (Burn)", "20+ (High Reps)", "Failure"];

// --- Helper Functions ---
const generateDateRange = (startDate, endDate) => {
  const dates = [];
  let currentDate = new Date(startDate);
  const end = new Date(endDate);
  while (currentDate <= end) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return dates;
};
const formatDate = (date) => date.toISOString().split('T')[0];
const getDisplayDate = (date) => date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

// --- Sub Components ---
const CircularProgress = ({ value, max, label, icon: Icon, color }) => {
  const radius = 50;
  const stroke = 8;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(value, max) / max) * circumference;
  return (
    <div className="flex flex-col items-center justify-center relative">
      <div className="relative w-40 h-40 flex items-center justify-center">
        <svg height={radius * 2} width={radius * 2} className="rotate-[-90deg]">
          <circle stroke="#e2e8f0" strokeWidth={stroke} fill="transparent" r={normalizedRadius} cx={radius} cy={radius} />
          <circle stroke={color} fill="transparent" strokeWidth={stroke} strokeDasharray={circumference + ' ' + circumference} style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.5s ease-in-out' }} strokeLinecap="round" r={normalizedRadius} cx={radius} cy={radius} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-700">
           <Icon size={24} className="mb-1 text-slate-400" />
           <span className="text-xl font-bold">{value.toLocaleString()}</span>
           <span className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</span>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, colorBg, colorText }) => (
  <div className={`p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4 bg-white`}>
    <div className={`p-3 rounded-full ${colorBg} ${colorText}`}><Icon size={20} /></div>
    <div><p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{title}</p><p className="text-lg font-bold text-slate-700">{value}</p></div>
  </div>
);

const UserPulseCard = ({ name, data, colorClass }) => {
    const hasData = data && (data.walking || data.cardio || (data.bodyFocus && data.bodyFocus !== '-'));
    return (
        <div className={`relative overflow-hidden rounded-xl border p-4 transition-all ${hasData ? 'bg-white border-slate-200 shadow-md scale-[1.02]' : 'bg-slate-50 border-slate-100 opacity-80'}`}>
            <div className={`absolute top-0 left-0 w-1 h-full ${colorClass}`}></div>
            <div className="flex justify-between items-start mb-3">
                <span className="font-bold text-slate-700 truncate pr-2">{name}</span>
                {hasData ? <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium flex items-center gap-1 shrink-0"><Zap size={10}/> Active</span> : <span className="text-xs px-2 py-1 bg-slate-200 text-slate-500 rounded-full shrink-0">Resting</span>}
            </div>
            {hasData ? (
                <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-slate-600"><Footprints size={14} className="text-slate-400"/><span>{data.walking || 0} steps</span></div>
                    <div className="flex items-center gap-2 text-slate-600"><HeartPulse size={14} className="text-slate-400"/><span>{data.cardio || 0} mins</span></div>
                     <div className="flex items-center gap-2 text-slate-600"><Target size={14} className="text-slate-400"/><span className="truncate">{data.bodyFocus || 'No Focus'}</span></div>
                </div>
            ) : (<div className="h-20 flex items-center justify-center text-slate-300 italic text-sm">No activity yet</div>)}
        </div>
    )
}

// --- Main Component ---
export default function ExerciseSheet() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Dynamic Profiles State (Default State until DB loads)
  const [profiles, setProfiles] = useState([
    { id: 'p1', name: 'Friend 1' },
    { id: 'p2', name: 'Friend 2' },
    { id: 'p3', name: 'Friend 3' }
  ]);
  const [activeProfileId, setActiveProfileId] = useState('p1');
  
  const [showSettings, setShowSettings] = useState(false);
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date(2025, 11, 1));
  const [sheetData, setSheetData] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState('saved');

  // --- 2. DATA SYNC (NO AUTH) ---
  useEffect(() => {
    // We query the database immediately on load
    const q = query(collection(db, 'fitness_apps', appId, 'data'));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = {};
      snap.forEach((d) => data[d.id] = d.data());
      setSheetData(data);
      
      // Load Dynamic Profiles if they exist in DB
      if (data['config_profiles'] && Array.isArray(data['config_profiles'].list)) {
        setProfiles(data['config_profiles'].list);
        const currentExists = data['config_profiles'].list.find(p => p.id === activeProfileId);
        if (!currentExists && data['config_profiles'].list.length > 0) {
            setActiveProfileId(data['config_profiles'].list[0].id);
        }
      }
      setLoading(false);
    }, (error) => {
        console.error("DB Error:", error);
        // If error is permission-denied, it means rules aren't set to public
        setLoading(false);
    });
    return () => unsubscribe();
  }, []); // Run once on mount

  // --- Actions ---
  const updateCell = async (dateKey, field, value) => {
    setSavingStatus('saving');
    const docId = `${dateKey}_${activeProfileId}`;
    
    // Optimistic Update
    const newData = { ...sheetData };
    if (!newData[docId]) newData[docId] = {};
    newData[docId][field] = value;
    setSheetData(newData);

    try {
      const activeName = profiles.find(p => p.id === activeProfileId)?.name || 'Unknown';
      // Saving to specific collection path
      await setDoc(doc(db, 'fitness_apps', appId, 'data', docId), 
        { 
            [field]: value, 
            date: dateKey, 
            userId: activeProfileId, 
            userDisplayName: activeName 
        }, 
        { merge: true }
      );
      setSavingStatus('saved');
    } catch (err) { 
        console.error(err);
        setSavingStatus('error'); 
    }
  };

  const saveProfiles = async (newProfiles) => {
    setProfiles(newProfiles);
    try { 
        await setDoc(doc(db, 'fitness_apps', appId, 'data', 'config_profiles'), { list: newProfiles }, { merge: true }); 
    } catch (e) { console.error(e); }
  };

  const handleAddProfile = () => {
    const newId = `p${Date.now()}`;
    const newProfiles = [...profiles, { id: newId, name: `Friend ${profiles.length + 1}` }];
    saveProfiles(newProfiles);
    setActiveProfileId(newId);
  };

  const handleRemoveProfile = (idToRemove) => {
    if (profiles.length <= 1) return;
    const newProfiles = profiles.filter(p => p.id !== idToRemove);
    saveProfiles(newProfiles);
    if (activeProfileId === idToRemove) {
        setActiveProfileId(newProfiles[0].id);
    }
  };

  const handleRenameProfile = (id, newName) => {
    const newProfiles = profiles.map(p => p.id === id ? { ...p, name: newName } : p);
    saveProfiles(newProfiles);
  };

  // Logic
  const fullDateRange = useMemo(() => generateDateRange('2025-12-01', '2026-11-14'), []);
  const visibleDates = useMemo(() => fullDateRange.filter(d => d.getMonth() === currentMonthDate.getMonth() && d.getFullYear() === currentMonthDate.getFullYear()), [fullDateRange, currentMonthDate]);
  const nextMonth = () => { const n = new Date(currentMonthDate); n.setMonth(n.getMonth() + 1); if (n <= new Date('2026-11-30')) setCurrentMonthDate(n); };
  const prevMonth = () => { const p = new Date(currentMonthDate); p.setMonth(p.getMonth() - 1); if (p >= new Date('2025-12-01')) setCurrentMonthDate(p); };

  // Dashboard Stats
  const dashboardStats = useMemo(() => {
    const todayStr = formatDate(new Date());
    let totalTeamSteps = 0, totalTeamCardio = 0;
    let muscleMap = { Upper: 0, Lower: 0, Cardio: 0, Full: 0, Other: 0 };
    const todayDataMap = {};
    profiles.forEach(p => { todayDataMap[p.id] = null; });

    Object.entries(sheetData).forEach(([docId, entry]) => {
        if (!entry || (docId === 'config_profiles')) return;
        const parts = docId.split('_');
        const entryUserId = parts[parts.length - 1]; 
        
        if (entry.walking) totalTeamSteps += (parseInt(entry.walking) || 0);
        if (entry.cardio) totalTeamCardio += (parseInt(entry.cardio) || 0);

        const focus = entry.bodyFocus;
        if (focus) {
            if (focus.includes('Upper') || focus.includes('Chest') || focus.includes('Back') || focus.includes('Arms') || focus.includes('Shoulders')) muscleMap.Upper++;
            else if (focus.includes('Lower') || focus.includes('Legs')) muscleMap.Lower++;
            else if (focus.includes('Cardio')) muscleMap.Cardio++;
            else if (focus.includes('Full')) muscleMap.Full++;
            else if (focus !== '-') muscleMap.Other++;
        }
        if (entry.date === todayStr) todayDataMap[entryUserId] = entry;
    });
    return { totalTeamSteps, totalTeamCardio, muscleMap, todayDataMap };
  }, [sheetData, profiles]);

  const activeProfileName = profiles.find(p => p.id === activeProfileId)?.name || 'User';

  if (loading) return <div className="flex h-screen items-center justify-center text-slate-500 bg-slate-50"><div className="animate-spin mr-2"><CalendarIcon size={24}/></div> Loading Fitness Hub...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      <header className="bg-indigo-600 text-white p-4 shadow-lg sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Trophy className="text-yellow-300" size={28} />
            <h1 className="text-xl font-bold tracking-tight">Trio Fitness Hub</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
             <div className="flex items-center gap-2 bg-indigo-700/50 rounded-lg p-1 pr-3">
                <Users size={16} className="ml-2 text-indigo-200" />
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-200 mr-1">I am:</span>
                <select value={activeProfileId} onChange={(e) => setActiveProfileId(e.target.value)} className="bg-indigo-600 text-white text-sm font-medium py-1 px-2 rounded border border-indigo-500 outline-none cursor-pointer hover:bg-indigo-500 transition-colors">
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
             </div>
             <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-white text-indigo-600' : 'bg-indigo-700/50 text-indigo-200 hover:bg-indigo-500'}`}>
                {showSettings ? <X size={20} /> : <Settings size={20} />}
             </button>
          </div>
        </div>
      </header>

      {showSettings && (
        <div className="bg-white border-b border-slate-200 py-6 animate-in slide-in-from-top-2">
            <div className="max-w-6xl mx-auto px-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Manage Team Members</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {profiles.map((p, idx) => (
                        <div key={p.id} className="flex items-center gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <div className={`w-3 h-3 rounded-full shrink-0 ${['bg-blue-500', 'bg-purple-500', 'bg-teal-500', 'bg-orange-500', 'bg-pink-500'][idx % 5]}`}></div>
                            <input type="text" value={p.name} onChange={(e) => handleRenameProfile(p.id, e.target.value)} className="bg-transparent border-b border-transparent focus:border-indigo-500 outline-none text-sm font-medium text-slate-700 w-full" />
                            {profiles.length > 1 && (<button onClick={() => handleRemoveProfile(p.id)} className="text-slate-400 hover:text-red-500 p-1 transition-colors"><Trash2 size={14} /></button>)}
                        </div>
                    ))}
                    <button onClick={handleAddProfile} className="flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 transition-all text-sm font-medium"><Plus size={16} /> Add Friend</button>
                </div>
                <div className="mt-4 text-xs text-slate-400 flex items-center justify-end gap-1">{savingStatus === 'saving' && <span className="text-orange-500">Saving...</span>}{savingStatus === 'saved' && <><Save size={12}/> All saved</>}</div>
            </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 mt-6 flex gap-2">
        <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${activeTab === 'dashboard' ? 'bg-white text-indigo-600 shadow-sm border-t border-x border-slate-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}><LayoutDashboard size={16} /> Dashboard</button>
        <button onClick={() => setActiveTab('sheet')} className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${activeTab === 'sheet' ? 'bg-white text-indigo-600 shadow-sm border-t border-x border-slate-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}><List size={16} /> Data Sheet</button>
      </div>

      <main className="flex-1 overflow-auto px-2 pb-6 md:px-6">
        <div className="max-w-6xl mx-auto bg-white rounded-b-xl rounded-tr-xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px] flex flex-col">
          {activeTab === 'dashboard' && (
            <div className="p-6 md:p-8">
              <div className="flex flex-col md:flex-row gap-8 mb-10 items-center justify-center">
                 <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-2xl border border-indigo-100 shadow-sm flex flex-col items-center flex-1 w-full text-center">
                    <h3 className="text-indigo-900 font-bold mb-1 flex items-center gap-2"><Flame className="text-orange-500" /> Team Step Bank</h3>
                    <p className="text-xs text-indigo-400 mb-6">Total Combined Steps</p>
                    <CircularProgress value={dashboardStats.totalTeamSteps} max={1000000 * Math.max(1, profiles.length / 2)} label="Steps" icon={Footprints} color="#6366f1" />
                    <p className="mt-4 text-xs font-medium text-indigo-400">Goal: {(1000000 * Math.max(1, profiles.length / 2)).toLocaleString()} Steps</p>
                 </div>
                 <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <StatCard title="Team Cardio" value={`${Math.round(dashboardStats.totalTeamCardio / 60)} hrs`} icon={Timer} colorBg="bg-pink-100" colorText="text-pink-600" />
                    <StatCard title="Total Sessions" value={Object.keys(sheetData).length - (sheetData['config_profiles'] ? 1 : 0)} icon={Dumbbell} colorBg="bg-blue-100" colorText="text-blue-600" />
                    <div className="col-span-1 sm:col-span-2 bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-3 flex items-center gap-2"><Target size={14}/> Training Focus Dist.</p>
                        <div className="space-y-2">
                             {['Upper', 'Lower', 'Cardio'].map((type, i) => {
                                const colors = ['bg-blue-400', 'bg-purple-400', 'bg-pink-400'];
                                const count = dashboardStats.muscleMap[type];
                                const total = Object.keys(sheetData).length || 1;
                                const pct = (count / total) * 100;
                                return (<div key={type} className="flex items-center gap-2 text-xs"><span className="w-12 font-bold text-slate-600">{type}</span><div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden"><div className={`${colors[i]} h-full transition-all duration-500`} style={{width: `${pct}%`}}></div></div></div>)
                             })}
                        </div>
                    </div>
                 </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Zap className="text-yellow-500" /> Today's Pulse <span className="text-xs font-normal text-slate-400 ml-2">({getDisplayDate(new Date())})</span></h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {profiles.map((p, idx) => {
                        const colors = ['bg-blue-500', 'bg-purple-500', 'bg-teal-500', 'bg-orange-500', 'bg-pink-500'];
                        return (<UserPulseCard key={p.id} name={p.name} data={dashboardStats.todayDataMap[p.id]} colorClass={colors[idx % colors.length]} />)
                    })}
                </div>
              </div>
            </div>
          )}
          {activeTab === 'sheet' && (
            <div className="flex flex-col h-full">
               <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <button onClick={prevMonth} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600"><ChevronLeft size={20} /></button>
                <div className="text-center"><h2 className="text-lg font-bold text-slate-800">{currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2><p className="text-xs text-indigo-600 font-medium">Viewing: {activeProfileName}</p></div>
                <button onClick={nextMonth} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600"><ChevronRight size={20} /></button>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse min-w-[950px]">
                  <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <tr><th className="p-3 border-b border-r border-slate-200 w-28 bg-slate-50">Date</th><th className="p-3 border-b border-r border-slate-200 w-32"><div className="flex items-center gap-1"><Footprints size={14} /> Steps</div></th><th className="p-3 border-b border-r border-slate-200 w-28"><div className="flex items-center gap-1"><HeartPulse size={14} /> Cardio</div></th><th className="p-3 border-b border-r border-slate-200 w-36"><div className="flex items-center gap-1"><Target size={14} /> Focus</div></th><th className="p-3 border-b border-r border-slate-200 w-32"><div className="flex items-center gap-1"><Dumbbell size={14} /> Reps</div></th><th className="p-3 border-b border-r border-slate-200 w-24"><div className="flex items-center gap-1"><Scale size={14} /> Kg/Lbs</div></th><th className="p-3 border-b border-r border-slate-200 w-32 text-center"><div className="flex items-center justify-center gap-1"><Activity size={14} /> Summary</div></th><th className="p-3 border-b border-slate-200 w-16 text-center">Done</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {visibleDates.map((date) => {
                      const dateStr = formatDate(date);
                      const isToday = formatDate(new Date()) === dateStr;
                      const docId = `${dateStr}_${activeProfileId}`;
                      const rowData = sheetData[docId] || {};
                      const summary = (rowData.walking ? `${parseInt(rowData.walking).toLocaleString()} steps` : '') + (rowData.walking && rowData.cardio ? ' • ' : '') + (rowData.cardio ? `${rowData.cardio} min` : '');
                      return (
                        <tr key={dateStr} className={`hover:bg-slate-50 transition-colors ${isToday ? 'bg-indigo-50/30' : ''}`}>
                          <td className="p-2 border-r border-slate-100 font-medium text-slate-600 whitespace-nowrap bg-white"><div className="flex flex-col"><span className={isToday ? "text-indigo-600 font-bold" : ""}>{getDisplayDate(date)}</span><span className="text-[10px] text-slate-400 font-normal truncate max-w-[90px]">{activeProfileName}</span></div></td>
                          <td className="p-0 border-r border-slate-100"><input type="number" placeholder="steps" className="w-full h-full p-3 bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-indigo-500 placeholder:text-slate-300" value={rowData.walking || ''} onChange={(e) => updateCell(dateStr, 'walking', e.target.value)} /></td>
                          <td className="p-0 border-r border-slate-100"><select className="w-full h-full p-3 bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-indigo-500 cursor-pointer appearance-none text-slate-700" value={rowData.cardio || ''} onChange={(e) => updateCell(dateStr, 'cardio', e.target.value)}><option value="">-</option>{MINUTE_OPTIONS.map(m => <option key={`c-${m}`} value={m}>{m} min</option>)}</select></td>
                          <td className="p-0 border-r border-slate-100"><select className="w-full h-full p-3 bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-indigo-500 cursor-pointer appearance-none text-slate-700" value={rowData.bodyFocus || ''} onChange={(e) => updateCell(dateStr, 'bodyFocus', e.target.value)}>{BODY_FOCUS_OPTIONS.map(opt => <option key={`bf-${opt}`} value={opt}>{opt}</option>)}</select></td>
                          <td className="p-0 border-r border-slate-100"><select className="w-full h-full p-3 bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-indigo-500 cursor-pointer appearance-none text-slate-700" value={rowData.reps || ''} onChange={(e) => updateCell(dateStr, 'reps', e.target.value)}>{REP_OPTIONS.map(opt => <option key={`r-${opt}`} value={opt}>{opt}</option>)}</select></td>
                          <td className="p-0 border-r border-slate-100"><input type="number" placeholder="kg" className="w-full h-full p-3 bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-indigo-500 placeholder:text-slate-300" value={rowData.bodyWeight || ''} onChange={(e) => updateCell(dateStr, 'bodyWeight', e.target.value)} /></td>
                          <td className="p-0 border-r border-slate-100 bg-slate-50/50"><div className="w-full h-full flex items-center justify-center text-xs font-semibold text-indigo-600 whitespace-nowrap px-2">{summary || '-'}</div></td>
                          <td className="p-0 text-center relative hover:bg-green-50/50 cursor-pointer"><button onClick={() => updateCell(dateStr, 'completed', !rowData.completed)} className="w-full h-full flex items-center justify-center p-3 outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500">{rowData.completed ? <CheckCircle2 className="text-green-500 fill-green-100" size={24} /> : <div className="w-5 h-5 rounded-full border-2 border-slate-200 group-hover:border-slate-300"></div>}</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}