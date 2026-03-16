import React, { useMemo, useState } from "react";
import { LayoutGrid, Users } from "lucide-react";

export function BrandHeatmap({ data, brands, cities, agents }) {
  const [groupBy, setGroupBy] = useState("city"); // city or agent

  const matrix = useMemo(() => {
    const groups = groupBy === "city" ? cities : agents;
    return groups.map(group => {
      const groupData = data.filter(d => (groupBy === "city" ? d.city : d.agent) === group);
      const row = { label: group };
      brands.forEach(brand => {
        const presentCount = groupData.filter(d => d.brandPresence[brand]).length;
        row[brand] = groupData.length ? Math.round((presentCount / groupData.length) * 100) : 0;
      });
      return row;
    });
  }, [data, brands, cities, agents, groupBy]);

  return (
    <div className="glass p-6 rounded-3xl overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold">Матриця присутності моделей (%)</h2>
        <div className="flex bg-white/5 p-1 rounded-lg border border-white/10">
          <button 
            onClick={() => setGroupBy("city")}
            className={`flex items-center gap-2 px-3 py-1 rounded-md text-[10px] uppercase tracking-wider transition-all ${groupBy === 'city' ? 'bg-indigo-600 text-white' : 'text-muted-foreground'}`}
          >
            <LayoutGrid className="h-3 w-3" />
            По містах
          </button>
          <button 
            onClick={() => setGroupBy("agent")}
            className={`flex items-center gap-2 px-3 py-1 rounded-md text-[10px] uppercase tracking-wider transition-all ${groupBy === 'agent' ? 'bg-indigo-600 text-white' : 'text-muted-foreground'}`}
          >
            <Users className="h-3 w-3" />
            По менеджерах
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-xs text-muted-foreground uppercase">{groupBy === 'city' ? 'Місто' : 'Менеджер'}</th>
              {brands.map(b => (
                <th key={b} className="p-2 text-xs text-muted-foreground uppercase text-center">{b}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map(row => (
              <tr key={row.label} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                <td className="p-2 text-sm font-medium">{row.label}</td>
                {brands.map(b => {
                  const val = row[b];
                  const opacity = val / 100;
                  return (
                    <td key={b} className="p-2 text-center">
                      <div 
                        className="w-10 h-10 rounded-xl mx-auto flex items-center justify-center text-[10px] font-bold"
                        style={{ 
                          backgroundColor: `rgba(99, 102, 241, ${opacity})`,
                          color: opacity > 0.5 ? "white" : "#a5b4fc",
                          border: "1px solid rgba(99, 102, 241, 0.2)"
                        }}
                      >
                        {val}%
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
