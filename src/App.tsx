import React, { useState, useRef, useEffect } from 'react';
import { Trophy, Users, Save, Upload, Edit, Plus, Trash2, Shuffle, Shield, CheckCircle, UserPlus, Download, RefreshCw } from 'lucide-react';

// --- Types ---
type Player = {
  id: string;
  name: string;
  number: string;
  position: string;
};

type Team = {
  id: string;
  name: string;
  logo: string;
  players: Player[];
  isBye?: boolean; // For the team that gets a free pass
};

type Match = {
  id: string;
  round: number; // 1 = Quarter, 2 = Semi, 3 = Final
  team1Id: string | null;
  team2Id: string | null;
  score1: number | null;
  score2: number | null;
  winnerId: string | null;
  nextMatchId?: string; // Where the winner goes
  slotInNextMatch?: 'team1' | 'team2';
};

// --- Constants ---
const STORAGE_KEY = 'FOOTBALL_TOURNAMENT_DATA';

// --- Default Data ---
const DEFAULT_TEAMS: Team[] = Array.from({ length: 7 }, (_, i) => ({
  id: `team-${i + 1}`,
  name: `ทีมฟุตบอล ${i + 1}`,
  logo: '',
  players: [],
}));

const PLACEHOLDER_LOGO = "https://cdn-icons-png.flaticon.com/512/1165/1165187.png";

const App = () => {
  // --- Helper: Load Initial State ---
  const loadInitialState = () => {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        return JSON.parse(savedData);
      }
    } catch (error) {
      console.error("Failed to load data from storage", error);
    }
    return null;
  };

  const initialState = loadInitialState();

  // --- State ---
  const [teams, setTeams] = useState<Team[]>(initialState?.teams || DEFAULT_TEAMS);
  const [matches, setMatches] = useState<Match[]>(initialState?.matches || []);
  const [activeTab, setActiveTab] = useState<'teams' | 'bracket'>('teams');
  const [isTournamentStarted, setIsTournamentStarted] = useState(initialState?.isTournamentStarted || false);
  
  // Modal State for Editing Team
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  
  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Logic: Auto-Save ---
  useEffect(() => {
    const dataToSave = {
      teams,
      matches,
      isTournamentStarted
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  }, [teams, matches, isTournamentStarted]);

  // --- Logic: Team Management ---

  const updateTeam = (updatedTeam: Team) => {
    setTeams(teams.map(t => t.id === updatedTeam.id ? updatedTeam : t));
    // If tournament started, update teams in matches too (visual only, IDs link them)
  };

  const addPlayerToTeam = (teamId: string, player: Player) => {
    const team = teams.find(t => t.id === teamId);
    if (team) {
      const updatedPlayers = [...team.players, player];
      updateTeam({ ...team, players: updatedPlayers });
    }
  };

  const removePlayerFromTeam = (teamId: string, playerId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (team) {
      const updatedPlayers = team.players.filter(p => p.id !== playerId);
      updateTeam({ ...team, players: updatedPlayers });
    }
  };

  // --- Logic: Tournament Generation (7 Teams) ---
  const generateBracket = () => {
    if (teams.length !== 7) {
      alert("ระบบนี้รองรับ 7 ทีมเท่านั้น");
      return;
    }

    // Shuffle teams
    const shuffled = [...teams].sort(() => 0.5 - Math.random());
    
    // Structure for 7 teams:
    // QF1: Team 1 vs Team 2 -> Winner goes to SF1
    // QF2: Team 3 vs Team 4 -> Winner goes to SF1
    // QF3: Team 5 vs Team 6 -> Winner goes to SF2
    // Bye: Team 7 -> Goes directly to SF2

    // Round 3 (Final)
    const finalMatch: Match = { id: 'm-final', round: 3, team1Id: null, team2Id: null, score1: null, score2: null, winnerId: null };
    
    // Round 2 (Semis)
    const sf1: Match = { id: 'm-sf1', round: 2, team1Id: null, team2Id: null, score1: null, score2: null, winnerId: null, nextMatchId: 'm-final', slotInNextMatch: 'team1' };
    const sf2: Match = { id: 'm-sf2', round: 2, team1Id: null, team2Id: shuffled[6].id, score1: null, score2: null, winnerId: null, nextMatchId: 'm-final', slotInNextMatch: 'team2' }; // Team 7 is waiting here

    // Round 1 (Quarters)
    const qf1: Match = { id: 'm-qf1', round: 1, team1Id: shuffled[0].id, team2Id: shuffled[1].id, score1: 0, score2: 0, winnerId: null, nextMatchId: 'm-sf1', slotInNextMatch: 'team1' };
    const qf2: Match = { id: 'm-qf2', round: 1, team1Id: shuffled[2].id, team2Id: shuffled[3].id, score1: 0, score2: 0, winnerId: null, nextMatchId: 'm-sf1', slotInNextMatch: 'team2' };
    const qf3: Match = { id: 'm-qf3', round: 1, team1Id: shuffled[4].id, team2Id: shuffled[5].id, score1: 0, score2: 0, winnerId: null, nextMatchId: 'm-sf2', slotInNextMatch: 'team1' };

    setMatches([qf1, qf2, qf3, sf1, sf2, finalMatch]);
    setIsTournamentStarted(true);
    setActiveTab('bracket');
  };

  // --- Logic: Match Updates ---
  const updateMatchScore = (matchId: string, team: 1 | 2, score: string) => {
    const numScore = parseInt(score) || 0;
    setMatches(prev => prev.map(m => {
      if (m.id !== matchId) return m;
      return team === 1 ? { ...m, score1: numScore } : { ...m, score2: numScore };
    }));
  };

  const confirmMatchResult = (match: Match) => {
    if (match.score1 === null || match.score2 === null) return;
    if (match.score1 === match.score2) {
      alert("สกอร์เสมอกันไม่ได้ กรุณาตัดสินผู้ชนะ (เช่น การดวลจุดโทษ)");
      return;
    }

    const winnerId = match.score1 > match.score2 ? match.team1Id : match.team2Id;

    // Update current match
    const updatedMatches = matches.map(m => m.id === match.id ? { ...m, winnerId } : m);

    // Update next match
    if (match.nextMatchId && winnerId) {
      const nextMatchIndex = updatedMatches.findIndex(m => m.id === match.nextMatchId);
      if (nextMatchIndex !== -1) {
        const nextMatch = updatedMatches[nextMatchIndex];
        const updatedNextMatch = { ...nextMatch };
        
        if (match.slotInNextMatch === 'team1') updatedNextMatch.team1Id = winnerId;
        if (match.slotInNextMatch === 'team2') updatedNextMatch.team2Id = winnerId;
        
        // Reset scores of next match if teams changed
        updatedNextMatch.score1 = 0;
        updatedNextMatch.score2 = 0;
        updatedNextMatch.winnerId = null;

        updatedMatches[nextMatchIndex] = updatedNextMatch;
      }
    }

    setMatches(updatedMatches);
  };

  // --- Logic: Reset ---
  const resetAllData = () => {
    if (confirm("คุณแน่ใจหรือไม่ว่าจะล้างข้อมูลทั้งหมด? ข้อมูลทีมและผลการแข่งขันจะหายไป")) {
      localStorage.removeItem(STORAGE_KEY);
      setTeams(DEFAULT_TEAMS);
      setMatches([]);
      setIsTournamentStarted(false);
      setActiveTab('teams');
    }
  };

  // --- Logic: JSON Import/Export ---
  const exportData = () => {
    const data = {
      teams,
      matches,
      isTournamentStarted
    };
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `football_tournament_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json.teams) setTeams(json.teams);
        if (json.matches) setMatches(json.matches);
        if (json.isTournamentStarted !== undefined) setIsTournamentStarted(json.isTournamentStarted);
        // Alert handled by UI, auto-save will trigger via useEffect
        alert("นำเข้าข้อมูลสำเร็จและบันทึกเรียบร้อย!");
      } catch (err) {
        alert("ไฟล์ไม่ถูกต้อง");
      }
    };
    reader.readAsText(file);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Components ---

  const TeamCard = ({ team }: { team: Team }) => (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all p-4 flex flex-col items-center relative group">
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={() => setEditingTeam(team)}
          className="p-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
        >
          <Edit size={16} />
        </button>
      </div>
      
      <div className="w-24 h-24 mb-3 rounded-full overflow-hidden border-2 border-gray-100 bg-gray-50 flex items-center justify-center">
        {team.logo ? (
          <img src={team.logo} alt={team.name} className="w-full h-full object-cover" />
        ) : (
          <Shield className="w-12 h-12 text-gray-300" />
        )}
      </div>
      <h3 className="font-bold text-gray-800 text-lg text-center">{team.name}</h3>
      <p className="text-sm text-gray-500">{team.players.length} นักเตะ</p>
    </div>
  );

  const EditTeamModal = () => {
    if (!editingTeam) return null;
    const [name, setName] = useState(editingTeam.name);
    const [logo, setLogo] = useState(editingTeam.logo);
    const [newPlayerName, setNewPlayerName] = useState('');
    const [newPlayerPos, setNewPlayerPos] = useState('');
    const [newPlayerNum, setNewPlayerNum] = useState('');

    const handleSave = () => {
      updateTeam({ ...editingTeam, name, logo });
      setEditingTeam(null);
    };

    const handleAddPlayer = () => {
      if (!newPlayerName) return;
      // FIX: Use more robust ID generation to prevent duplicate keys
      const newPlayer: Player = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: newPlayerName,
        position: newPlayerPos || 'Player',
        number: newPlayerNum || '00'
      };
      
      addPlayerToTeam(editingTeam.id, newPlayer);
      
      setEditingTeam(prev => {
        if (!prev) return null;
        return { ...prev, players: [...prev.players, newPlayer] };
      });
      
      setNewPlayerName('');
      setNewPlayerPos('');
      setNewPlayerNum('');
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-y-auto" style={{ maxHeight: '90vh' }}>
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Edit size={20} /> แก้ไขทีม: {editingTeam.name}
            </h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อทีม</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)}
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ลิงก์รูปโลโก้ (URL)</label>
                <input 
                  type="text" 
                  value={logo} 
                  onChange={e => setLogo(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Users size={18} /> รายชื่อนักเตะ
              </h3>
              
              <div className="flex gap-2 mb-3">
                <input 
                  placeholder="ชื่อนักเตะ" 
                  value={newPlayerName}
                  onChange={e => setNewPlayerName(e.target.value)}
                  className="flex-1 p-2 border rounded text-sm"
                />
                <input 
                  placeholder="เบอร์" 
                  value={newPlayerNum}
                  onChange={e => setNewPlayerNum(e.target.value)}
                  className="w-16 p-2 border rounded text-sm"
                />
                <button 
                  onClick={handleAddPlayer}
                  className="bg-green-600 text-white p-2 rounded hover:bg-green-700"
                >
                  <Plus size={18} />
                </button>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto bg-gray-50 p-2 rounded">
                {editingTeam.players.length === 0 && <p className="text-center text-gray-400 text-sm">ยังไม่มีนักเตะ</p>}
                {editingTeam.players.map(p => (
                  <div key={p.id} className="flex justify-between items-center bg-white p-2 rounded border shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="bg-gray-200 text-gray-700 text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full">
                        {p.number}
                      </span>
                      <span className="text-sm font-medium">{p.name}</span>
                    </div>
                    <button 
                      onClick={() => removePlayerFromTeam(editingTeam.id, p.id)}
                      className="text-red-500 hover:bg-red-50 p-1 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setEditingTeam(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                ปิด
              </button>
              <button 
                onClick={handleSave}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
              >
                <Save size={16} /> บันทึก
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const MatchDisplay = ({ match }: { match: Match }) => {
    const t1 = teams.find(t => t.id === match.team1Id);
    const t2 = teams.find(t => t.id === match.team2Id);
    const isFinished = !!match.winnerId;

    return (
      <div className={`bg-white rounded-lg shadow border p-3 w-full max-w-sm mx-auto mb-4 ${isFinished ? 'border-green-400 bg-green-50' : 'border-gray-200'}`}>
        <div className="flex justify-between items-center text-xs text-gray-400 mb-2 uppercase tracking-wide">
            <span>Match #{match.id.split('-')[1] || match.id}</span>
            {isFinished && <span className="text-green-600 font-bold flex items-center gap-1"><CheckCircle size={12}/> จบแล้ว</span>}
        </div>
        
        {/* Team 1 */}
        <div className={`flex justify-between items-center mb-2 p-2 rounded ${match.winnerId === match.team1Id ? 'bg-yellow-50 border border-yellow-200' : ''}`}>
          <div className="flex items-center gap-2 overflow-hidden">
            {t1 ? (
              <>
                <img src={t1.logo || PLACEHOLDER_LOGO} className="w-6 h-6 rounded-full object-cover" />
                <span className={`font-semibold truncate ${match.winnerId === match.team1Id ? 'text-black' : 'text-gray-700'}`}>{t1.name}</span>
              </>
            ) : (
              <span className="text-gray-400 italic">รอคู่แข่ง...</span>
            )}
          </div>
          <input 
            type="number" 
            disabled={isFinished || !t1}
            value={match.score1 ?? ''}
            onChange={(e) => updateMatchScore(match.id, 1, e.target.value)}
            className="w-12 text-center border rounded py-1 font-mono font-bold"
          />
        </div>

        {/* Team 2 */}
        <div className={`flex justify-between items-center mb-3 p-2 rounded ${match.winnerId === match.team2Id ? 'bg-yellow-50 border border-yellow-200' : ''}`}>
          <div className="flex items-center gap-2 overflow-hidden">
            {t2 ? (
              <>
                <img src={t2.logo || PLACEHOLDER_LOGO} className="w-6 h-6 rounded-full object-cover" />
                <span className={`font-semibold truncate ${match.winnerId === match.team2Id ? 'text-black' : 'text-gray-700'}`}>{t2.name}</span>
              </>
            ) : (
              <span className="text-gray-400 italic">รอคู่แข่ง...</span>
            )}
          </div>
          <input 
            type="number" 
            disabled={isFinished || !t2}
            value={match.score2 ?? ''}
            onChange={(e) => updateMatchScore(match.id, 2, e.target.value)}
            className="w-12 text-center border rounded py-1 font-mono font-bold"
          />
        </div>

        {!isFinished && t1 && t2 && (
          <button 
            onClick={() => confirmMatchResult(match)}
            className="w-full py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            ยืนยันผลการแข่ง
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-gray-900">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-800 to-green-700 text-white p-4 shadow-lg sticky top-0 z-40">
        <div className="container mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Trophy className="text-yellow-400" size={32} />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Football Cup Manager</h1>
              <p className="text-green-200 text-xs">ระบบจัดการแข่งขัน 7 ทีม</p>
            </div>
          </div>
          
          <div className="flex gap-2 items-center">
             <button 
              onClick={exportData}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded text-sm transition-all"
            >
              <Download size={16} /> <span className="hidden sm:inline">Save JSON</span>
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded text-sm transition-all"
            >
              <Upload size={16} /> <span className="hidden sm:inline">Load JSON</span>
            </button>
            <button 
              onClick={resetAllData}
              className="flex items-center gap-2 bg-red-500/80 hover:bg-red-500 px-3 py-1.5 rounded text-sm transition-all ml-2"
              title="ล้างข้อมูลทั้งหมด"
            >
              <RefreshCw size={16} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={importData} 
              accept=".json" 
              className="hidden" 
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-4 md:p-6">
        
        {/* Navigation Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-white p-1 rounded-full shadow-sm border inline-flex">
            <button 
              onClick={() => setActiveTab('teams')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'teams' ? 'bg-green-600 text-white shadow' : 'text-gray-500 hover:text-green-600'}`}
            >
              จัดการทีม ({teams.length}/7)
            </button>
            <button 
              onClick={() => setActiveTab('bracket')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'bracket' ? 'bg-green-600 text-white shadow' : 'text-gray-500 hover:text-green-600'}`}
            >
              ตารางการแข่งขัน
            </button>
          </div>
        </div>

        {activeTab === 'teams' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Shield className="text-green-600" /> รายชื่อทีม
              </h2>
              {!isTournamentStarted && (
                 <button 
                 onClick={generateBracket}
                 disabled={teams.length !== 7}
                 className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold shadow-lg transition-all ${teams.length === 7 ? 'bg-orange-500 text-white hover:bg-orange-600 hover:scale-105' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
               >
                 <Shuffle size={20} /> จับคู่แข่งขัน
               </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {teams.map(team => (
                <TeamCard key={team.id} team={team} />
              ))}
              {/* If we needed to add more teams, we could add a button here, but we are fixed to 7 */}
            </div>
            
            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <p><strong>คำแนะนำ:</strong> คลิกที่ไอคอนปากกาบนการ์ดทีมเพื่อแก้ไขชื่อ, โลโก้ และเพิ่มรายชื่อนักเตะ เมื่อครบ 7 ทีมแล้วให้กดปุ่ม "จับคู่แข่งขัน"</p>
            </div>
          </div>
        )}

        {activeTab === 'bracket' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {!isTournamentStarted ? (
              <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-dashed border-gray-300">
                <Trophy className="mx-auto text-gray-300 mb-4" size={64} />
                <h3 className="text-xl font-bold text-gray-600 mb-2">ยังไม่ได้เริ่มการแข่งขัน</h3>
                <p className="text-gray-500 mb-6">กรุณาจัดการทีมให้ครบ 7 ทีมแล้วกดปุ่มจับคู่</p>
                <button onClick={() => setActiveTab('teams')} className="text-green-600 hover:underline">
                  กลับไปจัดการทีม
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto pb-8">
                <div className="min-w-[800px] flex justify-between gap-8 px-4">
                  
                  {/* Round 1 */}
                  <div className="flex-1 flex flex-col justify-around">
                    <h3 className="text-center font-bold text-gray-500 mb-4 uppercase text-sm">รอบก่อนรองฯ (8 ทีม)</h3>
                    {matches.filter(m => m.round === 1).map(m => (
                      <MatchDisplay key={m.id} match={m} />
                    ))}
                    <div className="text-center p-4 border border-dashed rounded-lg bg-gray-50 text-gray-400 text-sm mt-4">
                       บาย (Bye) <br/>
                       <span className="font-bold text-gray-600">
                         {teams.find(t => t.id === matches.find(m => m.id === 'm-sf2')?.team2Id)?.name}
                       </span>
                    </div>
                  </div>

                  {/* Round 2 */}
                  <div className="flex-1 flex flex-col justify-around pt-12 pb-12">
                    <h3 className="text-center font-bold text-gray-500 mb-4 uppercase text-sm">รอบรองชนะเลิศ</h3>
                    {matches.filter(m => m.round === 2).map(m => (
                      <MatchDisplay key={m.id} match={m} />
                    ))}
                  </div>

                  {/* Final */}
                  <div className="flex-1 flex flex-col justify-center">
                    <h3 className="text-center font-bold text-yellow-600 mb-4 uppercase text-sm flex items-center justify-center gap-2"><Trophy size={16}/> รอบชิงชนะเลิศ</h3>
                    {matches.filter(m => m.round === 3).map(m => (
                      <div key={m.id} className="scale-110 origin-center">
                        <MatchDisplay match={m} />
                        {m.winnerId && (
                           <div className="text-center mt-6 animate-bounce">
                             <div className="text-sm text-gray-500">แชมป์ประจำรายการ</div>
                             <div className="text-2xl font-bold text-green-700">
                               {teams.find(t => t.id === m.winnerId)?.name}
                             </div>
                           </div>
                        )}
                      </div>
                    ))}
                  </div>

                </div>
              </div>
            )}
          </div>
        )}

        {/* Edit Modal */}
        <EditTeamModal />
      </main>
    </div>
  );
};

export default App;