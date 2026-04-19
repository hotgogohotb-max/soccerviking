import React, { useState, useEffect } from 'react';
import { X, ChevronUp, ChevronDown, Users, RotateCcw, Send } from 'lucide-react';

const GAS_WEB_APP_URL2 = "https://script.google.com/macros/s/AKfycbw7uV7bDAN9Dc_ATzz3I-aDFgNYkr2sNdryrrcnoLogDHkbWx8zHn3itE0rWSxwNdKx/exec";
const GAS_WEB_APP_URL  = "https://script.google.com/macros/s/AKfycbz_yQuDbRdJY-WItRJDdjnaNHbxhPpnUlyg8cFHMz9juH3Czw7KcdgYxGh-m-EUmAbD/exec";

const formationData = {
  '4-4-2': [
    { id: 'ST1', label: 'ST', top: '15%', left: '35%' }, { id: 'ST2', label: 'ST', top: '15%', left: '65%' },
    { id: 'LM',  label: 'LM', top: '40%', left: '15%' }, { id: 'CM1', label: 'CM', top: '40%', left: '40%' },
    { id: 'CM2', label: 'CM', top: '40%', left: '60%' }, { id: 'RM',  label: 'RM', top: '40%', left: '85%' },
    { id: 'LB',  label: 'LB', top: '65%', left: '15%' }, { id: 'CB1', label: 'CB', top: '65%', left: '40%' },
    { id: 'CB2', label: 'CB', top: '65%', left: '60%' }, { id: 'RB',  label: 'RB', top: '65%', left: '85%' },
    { id: 'GK',  label: 'GK', top: '85%', left: '50%' },
  ],
  '4-3-3': [
    { id: 'LW',  label: 'LW',  top: '15%', left: '20%' }, { id: 'ST',  label: 'ST',  top: '12%', left: '50%' }, { id: 'RW',  label: 'RW',  top: '15%', left: '80%' },
    { id: 'CM1', label: 'CM',  top: '42%', left: '25%' }, { id: 'CDM', label: 'CDM', top: '48%', left: '50%' }, { id: 'CM2', label: 'CM',  top: '42%', left: '75%' },
    { id: 'LB',  label: 'LB',  top: '70%', left: '15%' }, { id: 'CB1', label: 'CB',  top: '70%', left: '40%' },
    { id: 'CB2', label: 'CB',  top: '70%', left: '60%' }, { id: 'RB',  label: 'RB',  top: '70%', left: '85%' }, // ← 수정
    { id: 'GK',  label: 'GK',  top: '88%', left: '50%' },
  ],
};

const FORMATIONS = ['4-4-2', '4-3-3'];
const rawNames = ["김광태","김돈하","김동현","김민성","김상오","김태진","김필우","김한주","박성수","박승빈","박정근","박종엽","박종호","송상규","심영민","심현승","안광빈","유재민","유재영","이대행","이동민","이승주","이정수","이정혁","이현우","이형진","정인탁","최건혁","최진석","허성찬","홍석운","최원석","홍석재"];

const emptyPlayers     = () => rawNames.map((name, i) => ({ id: i + 1, name, isPresent: false, goals: 0, assists: 0 }));
// 슬롯에 playerId(풀타임), playerId2(0.5쿼터) 두 자리
const emptyQuarterSlots = (formation) => formationData[formation].map(s => ({ ...s, playerId: null, playerId2: null }));

const App = () => {
  const [players, setPlayers]                     = useState(emptyPlayers);
  const [quarterFormations, setQuarterFormations] = useState(['4-4-2','4-4-2','4-4-2','4-4-2']);
  const [quarterSlots, setQuarterSlots]           = useState(() => [0,1,2,3].map(() => emptyQuarterSlots('4-4-2')));
  const [selectedQuarter, setSelectedQuarter]     = useState(0);
  const [isRosterOpen, setIsRosterOpen]           = useState(true);
  const [showManager, setShowManager]             = useState(false);
  const [activeSlot, setActiveSlot]               = useState(null);   // 배정 중인 slot ID
  const [assignMode, setAssignMode]               = useState('first'); // 'first' | 'second'
  const [selectedDate, setSelectedDate]           = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading]                 = useState(false);
  const [score, setScore]                         = useState({ home: 0, away: 0 });

  useEffect(() => { loadDataFromSheet(selectedDate); }, [selectedDate]);

  const currentFormation = quarterFormations[selectedQuarter];
  const currentSlots     = quarterSlots[selectedQuarter];

  // ── 포메이션 변경 ────────────────────────────────────────────
  const changeFormation = (formation) => {
    if (formation === currentFormation) return;
    if (!confirm(`${selectedQuarter + 1}쿼터를 ${formation}으로 변경하면 배정이 초기화됩니다. 계속할까요?`)) return;
    const newFormations = [...quarterFormations];
    newFormations[selectedQuarter] = formation;
    setQuarterFormations(newFormations);
    const newSlots = [...quarterSlots];
    newSlots[selectedQuarter] = emptyQuarterSlots(formation);
    setQuarterSlots(newSlots);
  };

  // ── 쿼터별 출전 여부 (0 = 미출전, 0.5 = 반쿼터, 1 = 풀쿼터) ──
  const getPlayerQuarters = (playerId) =>
    quarterSlots.map(slots => {
      if (slots.some(s => s.playerId  === playerId)) return 1;
      if (slots.some(s => s.playerId2 === playerId)) return 0.5;
      return 0;
    });

  // ── 데이터 로드 ──────────────────────────────────────────────
  const loadDataFromSheet = async (date) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ action: 'load', date: date.substring(5) });
      const res    = await fetch(`${GAS_WEB_APP_URL}?${params}`);
      const data   = await res.json();

      if (data.result === 'empty' || !data.players?.length) {
        setPlayers(emptyPlayers());
        setQuarterFormations(['4-4-2','4-4-2','4-4-2','4-4-2']);
        setQuarterSlots([0,1,2,3].map(() => emptyQuarterSlots('4-4-2')));
        setScore({ home: 0, away: 0 });
        return;
      }

      const newPlayers = emptyPlayers().map(p => {
        const loaded = data.players.find(lp => lp.name === p.name);
        return loaded ? { ...p, isPresent: true, goals: loaded.goals || 0, assists: loaded.assists || 0 } : p;
      });
      setPlayers(newPlayers);

      if (data.score) setScore(data.score);

      if (data.quarters?.length === 4) {
        setQuarterFormations(data.quarters.map(q => q.formation || '4-4-2'));
        setQuarterSlots(data.quarters.map(q => {
          const formation = q.formation || '4-4-2';
          const slotMap   = q.slots || {};
          return formationData[formation].map(s => ({
            ...s,
            playerId:  slotMap[s.id]        ? (newPlayers.find(p => p.name === slotMap[s.id])?.id        ?? null) : null,
            playerId2: slotMap[`${s.id}_2`] ? (newPlayers.find(p => p.name === slotMap[`${s.id}_2`])?.id ?? null) : null,
          }));
        }));
      } else {
        setQuarterFormations(['4-4-2','4-4-2','4-4-2','4-4-2']);
        setQuarterSlots([0,1,2,3].map(() => emptyQuarterSlots('4-4-2')));
      }
    } catch (e) {
      console.error('로드 실패:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // ── 데이터 전송 ──────────────────────────────────────────────
  const sendDataToSheet = async () => {
    const formattedDate    = selectedDate.substring(5);
    const attendingPlayers = players.filter(p => p.isPresent);
    if (!attendingPlayers.length) { alert('출석 체크된 선수가 없습니다.'); return; }

    const stats = attendingPlayers.flatMap(p => [
      { name: p.name, type: 'attendance', value: 1 },
      ...(p.goals   > 0 ? [{ name: p.name, type: 'goal',   value: p.goals   }] : []),
      ...(p.assists > 0 ? [{ name: p.name, type: 'assist', value: p.assists }] : []),
    ]);

    const quarters = quarterSlots.map((slots, idx) => {
      const slotMap = {};
      slots.forEach(s => {
        const p1 = players.find(p => p.id === s.playerId);
        const p2 = players.find(p => p.id === s.playerId2);
        if (p1) slotMap[s.id]        = p1.name;
        if (p2) slotMap[`${s.id}_2`] = p2.name;
      });
      return { formation: quarterFormations[idx], slots: slotMap };
    });

    try {
      const payload = { date: formattedDate, stats, quarters, score };
      const params  = new URLSearchParams({ action: 'save', data: JSON.stringify(payload) });
      await fetch(`${GAS_WEB_APP_URL}?${params}`, { mode: 'no-cors' });
      alert(`${formattedDate} 전송 완료!`);
    } catch (e) {
      alert('전송 오류: ' + (e.message || String(e)));
    }
  };

  // ── 선수 배정 ────────────────────────────────────────────────
  const assignPlayer = (playerId) => {
    const newSlots = [...quarterSlots];
    newSlots[selectedQuarter] = currentSlots.map(s =>
      s.id === activeSlot
        ? assignMode === 'first'
          ? { ...s, playerId }
          : { ...s, playerId2: playerId }
        : s
    );
    setQuarterSlots(newSlots);
    setActiveSlot(null);
  };

  const updateStat = (id, type, delta) =>
    setPlayers(players.map(p => p.id === id ? { ...p, [type]: Math.max(0, p[type] + delta) } : p));

  const resetPositions = () => {
    if (!confirm(`${selectedQuarter + 1}쿼터 포지션을 초기화할까요?`)) return;
    const newSlots = [...quarterSlots];
    newSlots[selectedQuarter] = emptyQuarterSlots(currentFormation);
    setQuarterSlots(newSlots);
  };

  const attendingPlayers = players.filter(p => p.isPresent);

  // 배정 팝업용 사용 가능 선수 (현재 교체 대상 제외하고 이미 배정된 선수 필터)
  const activeSlotData = currentSlots.find(s => s.id === activeSlot);
  const occupiedIds    = new Set(currentSlots.flatMap(s => [s.playerId, s.playerId2]).filter(Boolean));
  if (assignMode === 'first'  && activeSlotData?.playerId)  occupiedIds.delete(activeSlotData.playerId);
  if (assignMode === 'second' && activeSlotData?.playerId2) occupiedIds.delete(activeSlotData.playerId2);
  const availablePlayers = attendingPlayers.filter(p => !occupiedIds.has(p.id));

  return (
    <div className="flex flex-col h-screen bg-slate-100 font-sans select-none overflow-hidden">

      {/* ── 헤더 ── */}
      <header className="px-4 py-2 bg-white flex justify-between items-center z-10 border-b shadow-sm gap-2">
        <div className="flex gap-1 items-center">
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="text-[10px] border rounded px-1 h-7" />
          {FORMATIONS.map(f => (
            <button key={f} onClick={() => changeFormation(f)}
              className={`px-2 py-1 rounded text-[10px] font-black ${currentFormation === f ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-400 border'}`}>
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button onClick={resetPositions} disabled={isLoading} className="px-3 py-1.5 bg-rose-500 text-white rounded-lg flex items-center gap-1 active:scale-95 disabled:opacity-40">
            <RotateCcw size={12}/><span className="text-[10px] font-bold">초기화</span>
          </button>
          <button onClick={sendDataToSheet} disabled={isLoading} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg flex items-center gap-1 active:scale-95 disabled:opacity-40">
            <Send size={12}/><span className="text-[10px] font-bold">전송</span>
          </button>
          <button onClick={() => setShowManager(true)} disabled={isLoading} className="px-3 py-1.5 bg-slate-800 text-white rounded-lg flex items-center gap-1 active:scale-95 disabled:opacity-40">
            <Users size={12}/><span className="text-[10px] font-bold">명단</span>
          </button>
        </div>
      </header>

      {/* ── 스코어 바 ── */}
      <div className="flex items-center justify-center gap-4 px-4 py-1.5 bg-slate-700 text-white">
        <span className="text-[11px] font-black text-emerald-400">우리팀</span>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setScore(s => ({ ...s, home: Math.max(0, s.home - 1) }))} className="w-6 h-6 rounded-full bg-slate-600 text-white text-xs font-black flex items-center justify-center">-</button>
          <span className="text-2xl font-black w-7 text-center">{score.home}</span>
          <button onClick={() => setScore(s => ({ ...s, home: s.home + 1 }))} className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center">+</button>
        </div>
        <span className="text-slate-400 font-black text-xl">:</span>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setScore(s => ({ ...s, away: Math.max(0, s.away - 1) }))} className="w-6 h-6 rounded-full bg-slate-600 text-white text-xs font-black flex items-center justify-center">-</button>
          <span className="text-2xl font-black w-7 text-center">{score.away}</span>
          <button onClick={() => setScore(s => ({ ...s, away: s.away + 1 }))} className="w-6 h-6 rounded-full bg-rose-600 text-white text-xs font-black flex items-center justify-center">+</button>
        </div>
        <span className="text-[11px] font-black text-rose-400">상대팀</span>
      </div>

      {isLoading && (
        <div className="absolute inset-0 bg-black/20 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl px-6 py-4 shadow-xl font-black text-slate-700 text-sm">⏳ 데이터 불러오는 중...</div>
        </div>
      )}

      {/* ── 전술판 ── */}
      <div className={`relative w-full transition-all bg-emerald-500 overflow-hidden ${isRosterOpen ? 'h-[35vh]' : 'flex-1'}`}>
        <div className="absolute left-2 top-1 text-white/70 text-[10px] font-black z-10">{currentFormation}</div>

        {currentSlots.map(slot => {
          const p1 = players.find(p => p.id === slot.playerId);
          const p2 = players.find(p => p.id === slot.playerId2);
          return (
            <div key={slot.id}
              onClick={() => { setActiveSlot(slot.id); setAssignMode('first'); }}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ top: slot.top, left: slot.left }}>
              <div className={`w-16 h-16 rounded-full border-2 flex flex-col items-center justify-center shadow-lg active:scale-95 transition-all ${p1 ? 'bg-white border-emerald-600' : 'bg-emerald-700/40 border-white/20 border-dashed'}`}>
                {p1 ? (
                  <>
                    <span className={`font-black text-center px-1 leading-tight text-emerald-700 ${p2 ? 'text-[10px]' : 'text-[12px]'}`}>{p1.name}</span>
                    {p2 && <div className="w-10 border-t border-emerald-300 my-0.5"/>}
                    {p2 && <span className="font-black text-[10px] text-center px-1 leading-tight text-orange-500">{p2.name}</span>}
                  </>
                ) : (
                  <span className="font-black text-[12px] text-white/40">{slot.label}</span>
                )}
              </div>
            </div>
          );
        })}

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20">
          {[0,1,2,3].map(q => (
            <button key={q} onClick={() => setSelectedQuarter(q)}
              className={`w-10 h-10 rounded-full font-black text-[14px] shadow-lg border-2 ${selectedQuarter === q ? 'bg-white border-emerald-600 text-emerald-600' : 'bg-emerald-700/60 border-white/30 text-white'}`}>
              {q + 1}
            </button>
          ))}
        </div>
      </div>

      {/* ── Squad List 토글 바 ── */}
      <div onClick={() => setIsRosterOpen(!isRosterOpen)} className="px-4 py-2 bg-slate-800 text-white flex justify-between items-center cursor-pointer">
        <span className="text-[10px] font-black tracking-widest uppercase">Squad List ({attendingPlayers.length})</span>
        {isRosterOpen ? <ChevronDown size={18}/> : <ChevronUp size={18}/>}
      </div>

      {/* ── Squad List ── */}
      <div className={`bg-white transition-all flex flex-col overflow-hidden ${isRosterOpen ? 'flex-1' : 'h-0'}`}>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="grid grid-cols-4 gap-1">
            {attendingPlayers.map(player => {
              const playerQuarters = getPlayerQuarters(player.id);
              return (
                <div key={player.id} className="px-1.5 py-1.5 bg-slate-50 rounded-lg border shadow-sm flex flex-col items-center gap-1">
                  <span className="font-black text-xs text-slate-800">{player.name}</span>
                  <div className="flex gap-0.5">
                    {playerQuarters.map((val, idx) => (
                      <div key={idx} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black
                        ${val === 1   ? 'bg-emerald-500 text-white' :
                          val === 0.5 ? 'bg-yellow-400 text-white'  :
                                        'bg-slate-200 text-slate-400'}`}>
                        {val === 0.5 ? '½' : idx + 1}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1 w-full">
                    <div className="flex-1 flex items-center justify-between bg-white border rounded h-6 px-1">
                      <button onClick={() => updateStat(player.id, 'goals', -1)} className="text-slate-300 text-xs font-bold">-</button>
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-[9px] font-black text-slate-400">G</span>
                        <span className="font-black text-emerald-600 text-xs">{player.goals}</span>
                      </div>
                      <button onClick={() => updateStat(player.id, 'goals', 1)} className="text-emerald-600 text-xs font-bold">+</button>
                    </div>
                    <div className="flex-1 flex items-center justify-between bg-white border rounded h-6 px-1">
                      <button onClick={() => updateStat(player.id, 'assists', -1)} className="text-slate-300 text-xs font-bold">-</button>
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-[9px] font-black text-slate-400">A</span>
                        <span className="font-black text-blue-600 text-xs">{player.assists}</span>
                      </div>
                      <button onClick={() => updateStat(player.id, 'assists', 1)} className="text-blue-600 text-xs font-bold">+</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 명단 관리 모달 ── */}
      {showManager && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end">
          <div className="bg-white w-full max-h-[80vh] rounded-t-[2rem] p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-black">명단 관리</h2>
              <button onClick={() => setShowManager(false)} className="p-2 bg-slate-100 rounded-full"><X size={20}/></button>
            </div>
            <div className="grid grid-cols-3 gap-2 overflow-y-auto pb-10">
              {players.map(p => (
                <button key={p.id}
                  onClick={() => setPlayers(players.map(pl => pl.id === p.id ? { ...pl, isPresent: !pl.isPresent } : pl))}
                  className={`p-3 rounded-xl border-2 transition-all ${p.isPresent ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold' : 'border-slate-100 text-slate-300'}`}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 선수 배정 팝업 ── */}
      {activeSlot && (
        <div className="fixed inset-0 bg-white/98 z-[60] p-5 flex flex-col">
          <div className="flex justify-between mb-3 border-b pb-2 font-black">
            선수 배정
            <button onClick={() => setActiveSlot(null)}><X/></button>
          </div>

          {/* 1번/2번 선택 탭 */}
          <div className="flex gap-2 mb-3">
            <button onClick={() => setAssignMode('first')}
              className={`flex-1 py-2 rounded-xl border-2 text-xs font-black transition-all ${assignMode === 'first' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-400'}`}>
              🟢 1번 (풀타임)<br/>
              <span className="text-[10px] font-normal">{players.find(p => p.id === activeSlotData?.playerId)?.name || '비어있음'}</span>
            </button>
            <button onClick={() => setAssignMode('second')}
              className={`flex-1 py-2 rounded-xl border-2 text-xs font-black transition-all ${assignMode === 'second' ? 'border-yellow-400 bg-yellow-50 text-yellow-700' : 'border-slate-200 text-slate-400'}`}>
              🟡 2번 (0.5쿼터)<br/>
              <span className="text-[10px] font-normal">{players.find(p => p.id === activeSlotData?.playerId2)?.name || '비어있음'}</span>
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2 overflow-y-auto">
            {availablePlayers.map(p => (
              <button key={p.id} onClick={() => assignPlayer(p.id)}
                className={`p-3 rounded-lg text-xs font-bold active:scale-95 ${assignMode === 'first' ? 'bg-emerald-50 active:bg-emerald-100' : 'bg-yellow-50 active:bg-yellow-100'}`}>
                {p.name}
              </button>
            ))}
            <button onClick={() => assignPlayer(null)} className="col-span-4 p-3 bg-rose-50 text-rose-500 text-xs font-bold rounded-lg mt-1">비우기</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
