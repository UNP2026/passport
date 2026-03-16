import React, { useMemo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

export function BrandSummary({ data, brands }) {
  const summary = useMemo(() => {
    return brands.map(brand => {
      const presentCount = data.filter(d => d.brandPresence[brand]).length;
      const percentage = data.length ? Math.round((presentCount / data.length) * 100) : 0;
      return { name: brand, percentage };
    }).sort((a, b) => b.percentage - a.percentage);
  }, [data, brands]);

  const topBrand = summary[0];
  const bottomBrand = summary[summary.length - 1];

  return (
    <div className="glass p-6 rounded-3xl">
      <h2 className="text-lg font-bold mb-6">Аналіз по моделях</h2>
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
          <div>
            <div className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold">Лідер покриття</div>
            <div className="text-xl font-bold">{topBrand?.name}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-emerald-400">{topBrand?.percentage}%</div>
            <div className="flex items-center gap-1 text-[10px] text-emerald-400/70 justify-end">
              <TrendingUp className="h-3 w-3" />
              +2.4%
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-rose-500/10 rounded-2xl border border-rose-500/20">
          <div>
            <div className="text-[10px] text-rose-400 uppercase tracking-wider font-bold">Потребує уваги</div>
            <div className="text-xl font-bold">{bottomBrand?.name}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-rose-400">{bottomBrand?.percentage}%</div>
            <div className="flex items-center gap-1 text-[10px] text-rose-400/70 justify-end">
              <TrendingDown className="h-3 w-3" />
              -1.1%
            </div>
          </div>
        </div>

        <div className="pt-2">
          <div className="text-xs text-muted-foreground mb-3 uppercase tracking-wider">Всі моделі</div>
          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-2">
            {summary.map(b => (
              <div key={b.name} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>{b.name}</span>
                  <span className="font-bold">{b.percentage}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${b.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
