import React from "react";
import { Check, X } from "lucide-react";

export function PointsDetailTable({ data, brands }) {
  return (
    <div className="glass p-6 rounded-3xl overflow-hidden">
      <h2 className="text-lg font-bold mb-6">Деталізація по точках (ТТ)</h2>
      <div className="overflow-x-auto max-h-[500px]">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-[#1e293b] z-10">
            <tr>
              <th className="p-3 text-xs text-muted-foreground uppercase">Дата</th>
              <th className="p-3 text-xs text-muted-foreground uppercase">ТТ / Місто</th>
              <th className="p-3 text-xs text-muted-foreground uppercase">Менеджер</th>
              {brands.map(b => (
                <th key={b} className="p-3 text-xs text-muted-foreground uppercase text-center">{b}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 50).map((row, idx) => (
              <tr key={row.id} className={`border-t border-white/5 hover:bg-white/5 transition-colors ${idx % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                <td className="p-3 text-xs whitespace-nowrap">{row.date}</td>
                <td className="p-3">
                  <div className="text-sm font-medium">{row.point}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">{row.city}</div>
                </td>
                <td className="p-3 text-xs">{row.agent}</td>
                {brands.map(b => (
                  <td key={b} className="p-3 text-center">
                    {row.brandPresence[b] ? (
                      <Check className="h-4 w-4 text-emerald-400 mx-auto" />
                    ) : (
                      <X className="h-4 w-4 text-rose-400/30 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 text-xs text-muted-foreground italic">
        * Показано останні 50 візитів. Використовуйте фільтри для уточнення.
      </div>
    </div>
  );
}
