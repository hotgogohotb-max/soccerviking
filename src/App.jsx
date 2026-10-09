import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle2, UserCheck, Users, RefreshCw, Plus, Minus, UserPlus, X, Trash2 } from 'lucide-react';

const GAS_URL = "https://script.google.com/macros/s/YOUR_ACTUAL_DEPLOYMENT_ID/exec";

// 이번 주 토요일 날짜 계산
const getThisSaturday = () => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const distanceToSaturday = dayOfWeek === 0 ? -1 : 6 - dayOfWeek;
  const saturday = new Date(now);
  saturday.setDate(now.getDate() + distanceToSaturday);

  const year = saturday.getFullYear();
  const month = String(saturday.getMonth() + 1).padStart(2, '0');
  const day = String(saturday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 3시간(밀리초)
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

export default function QuickScoreTracker() {
  const [selectedDate, setSelectedDate] = useState(getThisSaturday());
  const [isLoading, setIsLoading] = useState(false);

  const [players, setPlayers] = useState([]);
  // 해당 날짜의 임시 용병 목록 (LocalStorage 캐시 저장 대상)
  const [tempGuests, setTempGuests] = useState([]);
  
  const [attendance, setAttendance] = useState({});
  const [stats, setStats] = useState({});
  const [score, setScore] = useState({ home: 0, away: 0 });
  const [filterMode, setFilterMode] = useState('attendance');

  // 용병 입력 모달 상태
  const [showAddModal, setShowAddModal] = useState(false);
  const [guestNameInput, setGuestNameInput] = useState('');

  // 날짜 변경 시 해당 날짜의 캐시 읽기 & 시트 데이터 로드
  useEffect(() => {
    loadCachedGuests(selectedDate);
    fetchDateData(selectedDate);
  }, [selectedDate]);

  // --- 1. LocalStorage 캐시 처리 (3시간 만료 로직) ---
  const getCacheKey = (date) => `viking_guests_${date}`;

  const loadCachedGuests = (date) => {
    const key = getCacheKey(date);
    const cachedDataStr = localStorage.getItem(key);

    if (!cachedDataStr) {
      setTempGuests([]);
      return [];
    }

    try {
      const cached = JSON.parse(cachedDataStr); // { timestamp: number, guests: string[] }
      const now = new Date().getTime();

      // 3시간이 지났으면 캐시 삭제
      if (now - cached.timestamp > THREE_HOURS_MS) {
        localStorage.removeItem(key);
        setTempGuests([]);
        return [];
      } else {
        setTempGuests(cached.guests || []);
        return cached.guests || [];
      }
    } catch (e) {
      localStorage.removeItem(key);
      setTempGuests([]);
      return [];
    }
  };

  const saveGuestsToCache = (date, guestsList) => {
    const key = getCacheKey(date);
    const cachePayload = {
      timestamp: new Date().getTime(),
      guests: guestsList
    };
    localStorage.setItem(key, JSON.stringify(cachePayload));
  };

  // --- 2. 시트 데이터 조회 ---
  const fetchDateData = async (date) => {
    setIsLoading(true);
    const currentCachedGuests = loadCachedGuests(date);

    try {
      const targetUrl = `${GAS_URL}?action=load&date=${encodeURIComponent(date)}`;
      const res = await fetch(targetUrl, { method: 'GET', redirect: 'follow' });
      const text = await res.text();
      const data = JSON.parse(text);

      if (data.result === 'success' || data.result === 'empty') {
        const loadedPlayers = data.players || [];
        setPlayers(loadedPlayers);

        const newAtt = {};
        const newStats = {};
        
        // 정식 시트 선수
        loadedPlayers.forEach(p => {
          newAtt[p.name] = p.isAttended === true;
          newStats[p.name] = { goals: p.goals || 0, assists: p.assists || 0 };
        });

        // 3시간 유효한 용병 캐시가 있으면 출석 명단 포함 및 기본 참석 처리
        currentCachedGuests.forEach(gName => {
          newAtt[gName] = true;
          newStats[gName] = { goals: 0, assists: 0 };
        });

        setAttendance(newAtt);
        setStats(newStats);
        if (data.score) setScore(data.score);
      }
    } catch (err) {
      console.error('데이터 로드 실패:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 3. 용병 입력 및 추가 ---
  const handleAddGuestSubmit = () => {
    const nameToAdd = guestNameInput.trim();
    if (!nameToAdd) {
      alert('용병 이름을 입력해 주세요.');
      return;
    }

    if (tempGuests.includes(nameToAdd) || players.some(p => p.name === nameToAdd)) {
      alert('이미 등록된 선수/용병 이름입니다.');
      return;
    }

    const updatedGuests = [...tempGuests, nameToAdd];
    setTempGuests(updatedGuests);

    // 해당 날짜 캐시에 3시간 유효로 저장
    saveGuestsToCache(selectedDate, updatedGuests);

    // 바로 참석 상태로 포함
    setAttendance(prev => ({ ...prev, [nameToAdd]: true }));
    setStats(prev => ({ ...prev, [nameToAdd]: { goals: 0, assists: 0 } }));

    setGuestNameInput('');
    setShowAddModal(false);
  };

  // 용병 삭제
  const handleRemoveGuest = (guestName) => {
    const updatedGuests = tempGuests.filter(g => g !== guestName);
    setTempGuests(updatedGuests);
    saveGuestsToCache(selectedDate, updatedGuests);

    setAttendance(prev => {
      const next = { ...prev };
      delete next[guestName];
      return next;
    });
  };

  const toggleAttendance = (name) => {
    setAttendance(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const updateStat = (name, type, delta) => {
    setStats(prev => {
      const userStat = prev[name] || { goals: 0, assists: 0 };
      const currentVal = userStat[type] || 0;
      return {
        ...prev,
        [name]: { ...userStat, [type]: Math.max(0, currentVal + delta) }
      };
    });
  };

  // --- 4. 시트 저장 (용병은 전송 데이터에서 제외) ---
  const handleSaveData = async () => {
    setIsLoading(true);
    try {
      const statsPayload = [];

      Object.keys(attendance).forEach(name => {
        // 용병은 시트에 전송하지 않음
        const isGuest = tempGuests.includes(name);

        if (attendance[name] && !isGuest) {
          const userStat = stats[name] || { goals: 0, assists: 0 };
          statsPayload.push({
            name: name,
            attendance: true,
            goal: userStat.goals || 0,
            assist: userStat.assists || 0
          });
        }
      });

      const payload = {
        date: selectedDate,
        score: score,
        stats: statsPayload
      };

      const saveUrl = `${GAS_URL}?action=save&data=${encodeURIComponent(JSON.stringify(payload))}`;
      const res = await fetch(saveUrl, { method: 'GET', redirect: 'follow' });
      const text = await res.text();
      const data = JSON.parse(text);

      if (data.result === 'success') {
        alert('구글 시트에 정식 참석자 데이터가 저장되었습니다!\n(용병 데이터는 시트에 기록되지 않습니다.)');
      } else {
        alert('저장 실패: ' + data.message);
      }
    } catch (err) {
      alert('저장 중 오류 발생: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 화면 표시 전체 명단 (정식 선수 + 3시간 유효 임시 용병)
  const allDisplayPlayers = [
    ...players,
    ...tempGuests.map(gName => ({
      name: gName,
      totalAtt: 0,
      totalGoals: 0,
      totalAssists: 0,
      isAttended: !!attendance[gName],
      goals: 0,
      assists: 0,
      isTempGuest: true
    }))
  ];

  const attendedCount = Object.values(attendance).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-2 sm:p-4 max-w-md mx-auto font-sans pb-24">
      {/* 상단 컨트롤러 */}
      <div className="bg-slate-800 rounded-xl p-3 mb-3 shadow-lg border border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-emerald-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-700 text-white font-bold text-sm rounded-lg px-2 py-1 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex items-center space-x-1">
            <button 
              onClick={() => setShowAddModal(true)}
              className="p-1.5 bg-amber-600 hover:bg-amber-500 rounded-lg text-white flex items-center text-xs space-x-1 font-bold"
            >
              <UserPlus className="w-4 h-4" />
              <span>용병 추가</span>
            </button>
            <button 
              onClick={() => fetchDateData(selectedDate)}
              className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 경기 스코어 */}
        <div className="flex items-center justify-between bg-slate-900/80 p-2 rounded-lg mb-2">
          <span className="text-xs font-bold text-slate-300">경기 스코어</span>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-emerald-400">우리</span>
            <input
              type="number"
              value={score.home}
              onChange={(e) => setScore({ ...score, home: parseInt(e.target.value) || 0 })}
              className="w-10 bg-slate-800 text-center font-bold text-sm rounded border border-slate-600 py-0.5 text-white"
            />
            <span className="text-xs font-bold">:</span>
            <input
              type="number"
              value={score.away}
              onChange={(e) => setScore({ ...score, away: parseInt(e.target.value) || 0 })}
              className="w-10 bg-slate-800 text-center font-bold text-sm rounded border border-slate-600 py-0.5 text-white"
            />
            <span className="text-xs text-rose-400">상대</span>
          </div>
        </div>

        {/* 필터 탭 */}
        <div className="grid grid-cols-3 gap-1 bg-slate-900/60 p-1 rounded-lg text-xs font-medium">
          <button
            onClick={() => setFilterMode('attendance')}
            className={`py-1.5 rounded-md flex items-center justify-center space-x-1 ${
              filterMode === 'attendance' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>출석체크 ({attendedCount})</span>
          </button>
          <button
            onClick={() => setFilterMode('attended')}
            className={`py-1.5 rounded-md flex items-center justify-center space-x-1 ${
              filterMode === 'attended' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>참석자만</span>
          </button>
          <button
            onClick={() => setFilterMode('all')}
            className={`py-1.5 rounded-md flex items-center justify-center space-x-1 ${
              filterMode === 'all' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>전체보기</span>
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-6 text-slate-400 text-xs">
          구글 시트 동기화 중...
        </div>
      )}

      {/* 선수 및 용병 명단 */}
      <div className="grid grid-cols-3 gap-1.5">
        {allDisplayPlayers
          .filter(p => filterMode !== 'attended' || attendance[p.name])
          .map((p) => {
            const name = p.name;
            const isAttended = !!attendance[name];
            const userStat = stats[name] || { goals: 0, assists: 0 };
            const isGuest = p.isTempGuest || tempGuests.includes(name);

            if (filterMode === 'attendance') {
              return (
                <div key={name} className="relative">
                  <button
                    onClick={() => toggleAttendance(name)}
                    className={`w-full p-2 rounded-lg border text-center transition-all flex flex-col items-center justify-center ${
                      isAttended
                        ? isGuest
                          ? 'bg-amber-950/80 border-amber-500 text-amber-200'
                          : 'bg-emerald-950/70 border-emerald-500 text-emerald-200'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-500'
                    }`}
                  >
                    <span className="text-sm font-bold truncate w-full">{name}</span>
                    <span className={`text-[10px] mt-0.5 px-1.5 py-0.5 rounded ${
                      isAttended 
                        ? isGuest ? 'bg-amber-500/20 text-amber-400 font-semibold' : 'bg-emerald-500/20 text-emerald-400 font-semibold' 
                        : 'bg-slate-700 text-slate-500'
                    }`}>
                      {isAttended ? (isGuest ? '용병(전술용)' : '참석') : '미참석'}
                    </span>
                  </button>
                  {/* 용병 삭제 버튼 */}
                  {isGuest && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveGuest(name);
                      }}
                      className="absolute -top-1 -right-1 bg-rose-600 hover:bg-rose-500 text-white rounded-full p-0.5 shadow"
                      title="용병 삭제"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            }

            if (filterMode === 'all') {
              return (
                <div
                  key={name}
                  className="p-2 rounded-lg border text-center bg-slate-800/90 border-slate-700 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between px-0.5 mb-1">
                    <span className="text-xs font-bold text-slate-100 truncate">{name}</span>
                    {isAttended && (
                      <span className={`w-1.5 h-1.5 rounded-full ${isGuest ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                    )}
                  </div>
                  <div className="bg-slate-900/90 p-1.5 rounded text-[11px] space-y-0.5">
                    <div className="flex justify-between text-amber-400 font-semibold">
                      <span>누적 골</span>
                      <span>{p.totalGoals || 0}</span>
                    </div>
                    <div className="flex justify-between text-sky-400 font-semibold">
                      <span>누적 어시</span>
                      <span>{p.totalAssists || 0}</span>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={name}
                className="p-1.5 rounded-lg border text-center bg-slate-800 border-slate-700 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-xs font-bold text-slate-200 truncate">{name}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${isGuest ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                </div>

                <div className="mt-1 space-y-1 bg-slate-900/80 p-1 rounded">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-amber-400 font-semibold">골 {userStat.goals || 0}</span>
                    <div className="flex space-x-0.5">
                      <button
                        onClick={() => updateStat(name, 'goals', -1)}
                        className="w-4 h-4 bg-slate-700 rounded flex items-center justify-center text-slate-300"
                      >
                        <Minus className="w-2.5 h-2.5" />
                      </button>
                      <button
                        onClick={() => updateStat(name, 'goals', 1)}
                        className="w-4 h-4 bg-amber-600 rounded flex items-center justify-center text-white"
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-sky-400 font-semibold">어시 {userStat.assists || 0}</span>
                    <div className="flex space-x-0.5">
                      <button
                        onClick={() => updateStat(name, 'assists', -1)}
                        className="w-4 h-4 bg-slate-700 rounded flex items-center justify-center text-slate-300"
                      >
                        <Minus className="w-2.5 h-2.5" />
                      </button>
                      <button
                        onClick={() => updateStat(name, 'assists', 1)}
                        className="w-4 h-4 bg-sky-600 rounded flex items-center justify-center text-white"
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* 저장 버튼 */}
      <div className="fixed bottom-2 left-1/2 -translate-x-1/2 w-[calc(100%-1rem)] max-w-md px-2">
        <button
          onClick={handleSaveData}
          disabled={isLoading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold py-3 rounded-xl shadow-lg flex items-center justify-center space-x-2 text-sm text-white disabled:bg-slate-600"
        >
          <span>{selectedDate} 참석자 데이터 저장</span>
        </button>
      </div>

      {/* 용병 이름 입력 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-xs p-4 shadow-2xl">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-amber-400">용병 추가 (전술용)</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-400 mb-3">
              * 용병 이름 입력 후 추가하면 3시간 동안 브라우저에 보관되며, 시트에는 기록되지 않습니다.
            </p>

            <input
              type="text"
              placeholder="용병 이름 입력 (예: 김용병)"
              value={guestNameInput}
              onChange={(e) => setGuestNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddGuestSubmit()}
              autoFocus
              className="w-full bg-slate-700 border border-slate-600 rounded-lg p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500 mb-4"
            />

            <div className="flex space-x-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-xs py-2 rounded-lg font-bold"
              >
                취소
              </button>
              <button
                onClick={handleAddGuestSubmit}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-xs py-2 rounded-lg font-bold text-white"
              >
                추가하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}