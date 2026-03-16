import React, { useMemo } from "react";

export function ManagerStatsTable({ data, agents, activeStat }) {
  const managerStats = useMemo(() => {
    return agents.map(agent => {
      const agentData = data.filter(d => d.agent === agent);
      const uniqueCities = new Set(agentData.map(d => d.city)).size;
      const uniqueTTs = new Set(agentData.map(d => d.point)).size;
      const visits = agentData.length;
      
      // Last visit date
      const sortedDates = agentData.map(d => d.date).sort((a, b) => new Date(b) - new Date(a));
      const lastVisit = sortedDates[0] || "-";

      // Brand presence count (number of unique brands present across all visits)
      const presentBrands = new Set();
      agentData.forEach(visit => {
        Object.entries(visit.brandPresence).forEach(([brand, isPresent]) => {
          if (isPresent) presentBrands.add(brand);
        });
      });
      const brandCount = presentBrands.size;

      return {
        name: agent,
        visits,
        lastVisit,
        cities: uniqueCities,
        tts: uniqueTTs,
        brands: brandCount
      };
    });
  }, [data, agents]);

  const sortedStats = useMemo(() => {
    const sortMap = {
      visits: 'visits',
      cities: 'cities',
      tt: 'tts',
      brands: 'brands'
    };
    const key = sortMap[activeStat] || 'visits';
    return [...managerStats].sort((a, b) => {
      if (b[key] === a[key]) {
        return a.name.localeCompare(b.name);
      }
      return b[key] - a[key];
    });
  }, [managerStats, activeStat]);

  return (
    <div className="glass p-6 rounded-3xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500 border border-indigo-500/20 shadow-2xl shadow-indigo-500/10">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-400">Детальна статистика менеджерів</h3>
        <div className="text-[10px] text-muted-foreground uppercase">Сортування: {
          activeStat === 'visits' ? 'Візити' : 
          activeStat === 'cities' ? 'Міста' : 
          activeStat === 'tt' ? 'Торгові точки' : 'Моделі'
        }</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10">
              <th className="p-3 text-xs text-muted-foreground uppercase">Менеджер</th>
              <th className={`p-3 text-xs uppercase text-center transition-colors ${activeStat === 'visits' ? 'text-indigo-400 font-bold bg-indigo-400/5' : 'text-muted-foreground'}`}>Візити</th>
              <th className="p-3 text-xs text-muted-foreground uppercase text-center">Останній візит</th>
              <th className={`p-3 text-xs uppercase text-center transition-colors ${activeStat === 'cities' ? 'text-indigo-400 font-bold bg-indigo-400/5' : 'text-muted-foreground'}`}>Міста</th>
              <th className={`p-3 text-xs uppercase text-center transition-colors ${activeStat === 'tt' ? 'text-indigo-400 font-bold bg-indigo-400/5' : 'text-muted-foreground'}`}>ТТ</th>
              <th className={`p-3 text-xs uppercase text-center transition-colors ${activeStat === 'brands' ? 'text-indigo-400 font-bold bg-indigo-400/5' : 'text-muted-foreground'}`}>Моделі (шт)</th>
            </tr>
          </thead>
          <tbody>
            {sortedStats.map((s) => (
              <tr key={s.name} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="p-3 text-sm font-medium">{s.name}</td>
                <td className={`p-3 text-sm text-center font-mono ${activeStat === 'visits' ? 'bg-indigo-400/5 font-bold text-indigo-300' : ''}`}>{s.visits}</td>
                <td className="p-3 text-xs text-center text-muted-foreground">{s.lastVisit}</td>
                <td className={`p-3 text-sm text-center font-mono ${activeStat === 'cities' ? 'bg-indigo-400/5 font-bold text-indigo-300' : ''}`}>{s.cities}</td>
                <td className={`p-3 text-sm text-center font-mono ${activeStat === 'tt' ? 'bg-indigo-400/5 font-bold text-indigo-300' : ''}`}>{s.tts}</td>
                <td className={`p-3 text-sm text-center font-mono ${activeStat === 'brands' ? 'bg-indigo-400/5 font-bold text-indigo-300' : ''}`}>
                  <span className="text-indigo-300 font-bold">
                    {s.brands}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
