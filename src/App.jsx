import React, { useState, useEffect } from 'react';
import { Plus, X, ChevronUp, ChevronDown, Users, UserCheck, UserMinus, RotateCcw, Send } from 'lucide-react';

// 보내주신 구글 앱스 스크립트 URL 적용 완료
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwwBxUCJ9AHw-uvbfx4ui9QrLKgqOUkecEeVA29iIC6z3Fa6YbRKGwOpV2DtpQArakw/exec"; 

const formationData = {
  '4-4-2': [
    { id: 'ST1', label: 'ST', top: '15%', left: '35%' }, { id: 'ST2', label: 'ST', top: '15%', left: '65%' },
    { id: 'LM', label: 'LM', top: '40%', left: '15%' }, { id: 'CM1', label: 'CM', top: '40%', left: '40%' },
    { id: 'CM2', label: 'CM', top: '40%', left: '60%' }, { id: 'RM', label: 'RM', top: '40%', left: '85%' },
    { id: 'LB', label: 'LB', top: '65%', left: '15%' }, { id: 'CB1', label: 'CB', top: '65%', left: '40%' },
    { id: 'CB2', label: 'CB', top: '65%', left: '60%' }, { id: 'RB', label: 'RB', top: '65%', left: '85%' },
    { id: 'GK', label: 'GK', top: '85%', left: '50%' }
  ],
  '4-3-3': [
    { id: 'LW', label: 'LW', top: '15%', left: '20%' }, { id: 'ST', label: 'ST', top: '12%', left: '50%' }, { id: 'RW', label: 'RW', top: '15%', left: '80%' },
    { id: 'CM1', label: 'CM', top: '42%', left: '25%' }, { id: 'CDM', label: 'CDM', top: '48%', left: '50%' }, { id: 'CM2', label: 'CM', top: '42%', left: '75%' },
    { id: 'LB', label: 'LB', top: '70%', left: '15%' }, { id: 'CB1', label: 'CB', top: '70%', left: '40%' },
    { id: 'CB2', label: 'CB', top: '70%', left: '60%' }, { id: 'RB', label: 'RB', top: '85%', left: '85%' },
    { id: 'GK', label: 'GK', top: '88%', left: '50%' }
  ]
};

const rawNames = ["김광태", "김돈하", "김동현", "김민성", "김상오", "김태진", "김필우", "김한주", "박성수", "박승빈", "박정근", "박종엽", "박종호", "송상규", "심영민", "심현승", "안광빈", "유재민", "유재영", "이대행", "이동민", "이승주", "이정수", "이정혁", "이현우", "이형진", "정인탁", "최건혁", "최진석", "허성찬", "홍석운", "최원석", "홍석재"];

const App = () => {
  const [players, setPlayers] = useState(() => {
    const saved = localStorage.getItem('viking-26-players');
    return saved ? JSON.parse(saved) : rawNames.map((name, i) => ({ id: i+1, name, isPresent: false, goals: 0, assists: 0 }));
  });

  const [currentFormation, setCurrentFormation] = useState('4-4-2');
  const [selectedQuarter, setSelectedQuarter] = useState(0);
  const [isRosterOpen, setIsRosterOpen] = useState(true);
  const [showManager, setShowManager] = useState(false);
  const [activeSlot, setActiveSlot] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const [quarterSlots, setQuarterSlots] = useState(() => {
    const saved = localStorage.getItem('viking-quarter-slots');
    if (saved) return JSON.parse(saved);
    return [0, 1, 2, 3].map(() => formationData['4-4-2'].map(s => ({ ...s, playerId: null })));
  });

  useEffect(() => { localStorage.setItem('viking-26-players', JSON.stringify(players)); }, [players]);
  useEffect(() => { localStorage.setItem('viking-quarter-slots', JSON.stringify(quarterSlots)); }, [quarterSlots]);

  const currentSlots = quarterSlots[selectedQuarter];

  const getPlayerQuarters = (playerId) => {
    return quarterSlots.map(slots => slots.some(s => s.playerId === playerId));
  };

  const sendDataToSheet = async () => {
    const formattedDate = selectedDate.substring(5);
    const attendingPlayers = players.filter(p => p.isPresent);

    if (attendingPlayers.length === 0) {
      alert("출석 체크된 선수가 없습니다.");
      return;
    }

    const statsToSend = attendingPlayers.flatMap(p => [
      { name: p.name, date: formattedDate, type: "attendance", value: 1 },
      ...(p.goals > 0 ? [{ name: p.name, date: formattedDate, type: "goal", value: p.goals }] : []),
      ...(p.assists > 0 ? [{ name: p.name, date: formattedDate, type: "assist", value: p.assists }] : []),
    ]);

    console.log("전송 데이터:", statsToSend);

    try {
      const params = new URLSearchParams({ data: JSON.stringify(statsToSend) });
      await fetch(`${GAS_WEB_APP_URL}?${params.toString()}`, { mode: 'no-cors' });
      alert(`${formattedDate} 기록 전송 완료! (${statsToSend.length}건)`);
    } catch (e) {
      console.error("전송 에러:", e);
      alert("전송 오류: " + (e.message || String(e)));
    }
  };

  const assignPlayer = (playerId) => {
    const newQuarterSlots = [...quarterSlots];
    newQuarterSlots[selectedQuarter] = currentSlots.map(s => s.id === activeSlot ? { ...s, playerId } : s);
    setQuarterSlots(newQuarterSlots);
    setActiveSlot(null);
  };

  const updateStat = (id, type, delta) => {
    setPlayers(players.map(p => p.id === id ? { ...p, [type]: Math.max(0, p[type] + delta) } : p));
  };

  const attendingPlayers = players.filter(p => p.isPresent);

  return (
    <div className="flex flex-col h-screen bg-slate-100 font-sans select-none overflow-hidden">
      <header className="px-4 py-2 bg-white flex justify-between items-center z-10 border-b shadow-sm gap-2">
        <div className="flex gap-1 items-center">
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="text-[10px] border rounded px-1 h-7" />
          {['4-4-2', '4-3-3'].map(f => (
            <button key={f} onClick={() => setCurrentFormation(f)} className={`px-2 py-1 rounded text-[10px] font-black ${currentFormation === f ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-400 border'}`}>{f}</button>
          ))}
        </div>
        <div className="flex gap-1">
          <button onClick={sendDataToSheet} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg flex items-center gap-1 active:scale-95"><Send size={12}/> <span className="text-[10px] font-bold">전송</span></button>
          <button onClick={() => setShowManager(true)} className="px-3 py-1.5 bg-slate-800 text-white rounded-lg flex items-center gap-1 active:scale-95"><Users size={12}/> <span className="text-[10px] font-bold">명단</span></button>
        </div>
      </header>

      {/* 전술판 - 원 크기 확대(w-16 h-16) 유지 */}
      <div className={`relative w-full transition-all bg-emerald-500 overflow-hidden ${isRosterOpen ? 'h-[35vh]' : 'flex-1'}`}>
        {currentSlots.map(slot => {
          const p = players.find(p => p.id === slot.playerId);
          return (
            <div key={slot.id} onClick={() => setActiveSlot(slot.id)} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ top: slot.top, left: slot.left }}>
              <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center shadow-lg active:scale-95 transition-all ${p ? 'bg-white border-emerald-600' : 'bg-emerald-700/40 border-white/20 border-dashed'}`}>
                <span className={`font-black text-[12px] text-center px-1 leading-tight ${p ? 'text-emerald-700' : 'text-white/40'}`}>
                  {p ? p.name : slot.label}
                </span>
              </div>
            </div>
          );
        })}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20">
          {[0, 1, 2, 3].map(q => (
            <button key={q} onClick={() => setSelectedQuarter(q)} className={`w-10 h-10 rounded-full font-black text-[14px] shadow-lg border-2 ${selectedQuarter === q ? 'bg-white border-emerald-600 text-emerald-600' : 'bg-emerald-700/60 border-white/30 text-white'}`}>{q + 1}</button>
          ))}
        </div>
      </div>

      <div onClick={() => setIsRosterOpen(!isRosterOpen)} className="px-4 py-2 bg-slate-800 text-white flex justify-between items-center cursor-pointer">
        <span className="text-[10px] font-black tracking-widest uppercase">Squad List ({attendingPlayers.length})</span>
        {isRosterOpen ? <ChevronDown size={18}/> : <ChevronUp size={18}/>}
      </div>

      <div className={`bg-white transition-all flex flex-col overflow-hidden ${isRosterOpen ? 'flex-1' : 'h-0'}`}>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="grid grid-cols-4 gap-1">
            {attendingPlayers.map(player => {
              const playerQuarters = getPlayerQuarters(player.id);
              return (
                <div key={player.id} className="px-1.5 py-1.5 bg-slate-50 rounded-lg border shadow-sm flex flex-col items-center gap-1">
                  <span className="font-black text-xs text-slate-800">{player.name}</span>
                  <div className="flex gap-0.5">
                    {playerQuarters.map((active, idx) => (
                      <div key={idx} className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${active ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                        {idx + 1}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1 w-full">
                    <div className="flex-1 flex items-center justify-between bg-white border rounded h-6 px-1">
                      <button onClick={() => updateStat(player.id, 'goals', -1)} className="text-slate-300 text-xs font-bold leading-none">-</button>
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-[9px] font-black text-slate-400">G</span>
                        <span className="font-black text-emerald-600 text-xs">{player.goals}</span>
                      </div>
                      <button onClick={() => updateStat(player.id, 'goals', 1)} className="text-emerald-600 text-xs font-bold leading-none">+</button>
                    </div>
                    <div className="flex-1 flex items-center justify-between bg-white border rounded h-6 px-1">
                      <button onClick={() => updateStat(player.id, 'assists', -1)} className="text-slate-300 text-xs font-bold leading-none">-</button>
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-[9px] font-black text-slate-400">A</span>
                        <span className="font-black text-blue-600 text-xs">{player.assists}</span>
                      </div>
                      <button onClick={() => updateStat(player.id, 'assists', 1)} className="text-blue-600 text-xs font-bold leading-none">+</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 명단 관리 & 배정 모달 (이전과 동일) */}
      {showManager && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end">
          <div className="bg-white w-full max-h-[80vh] rounded-t-[2rem] p-6">
            <div className="flex justify-between items-center mb-4"><h2 className="font-black">명단 관리</h2><button onClick={() => setShowManager(false)} className="p-2 bg-slate-100 rounded-full"><X size={20}/></button></div>
            <div className="grid grid-cols-3 gap-2 overflow-y-auto pb-10">
              {players.map(p => (
                <button key={p.id} onClick={() => setPlayers(players.map(pl => pl.id === p.id ? {...pl, isPresent: !pl.isPresent} : pl))}
                  className={`p-3 rounded-xl border-2 transition-all ${p.isPresent ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold' : 'border-slate-100 text-slate-300'}`}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 배정 팝업 - 이미 배정된 선수는 필터링하여 보여줌 */}
      {activeSlot && (
        <div className="fixed inset-0 bg-white/98 z-[60] p-6 flex flex-col">
          <div className="flex justify-between mb-4 border-b pb-2 font-black">
            선수 배정 <button onClick={() => setActiveSlot(null)}><X/></button>
          </div>
          <div className="grid grid-cols-4 gap-2 overflow-y-auto">
            {attendingPlayers
              .filter(p => !currentSlots.some(slot => slot.playerId === p.id)) // [수정] 현재 쿼터에 이미 있는 사람 제외
              .map(p => (
                <button 
                  key={p.id} 
                  onClick={() => assignPlayer(p.id)} 
                  className="p-3 bg-slate-100 rounded-lg text-xs font-bold active:bg-emerald-100"
                >
                  {p.name}
                </button>
              ))}
            <button onClick={() => assignPlayer(null)} className="col-span-4 p-3 bg-rose-50 text-rose-500 text-xs font-bold rounded-lg mt-2">비우기</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;