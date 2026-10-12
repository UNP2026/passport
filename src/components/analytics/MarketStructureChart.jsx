import React, { useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList
} from "recharts";
import { BarChart3 } from "lucide-react";

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0b1326]/75 backdrop-blur-2xl border border-white/25 p-3.5 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.65)] text-xs space-y-1.5 min-w-[210px] animate-in fade-in duration-150">
        <div className="font-bold text-white text-sm pb-1.5 border-b border-white/15 tracking-tight">
          {label}
        </div>
        {payload.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5" style={{ color: item.color }}>
              <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: item.color }} />
              <span className="text-muted-foreground">{item.name}:</span>
            </span>
            <span className="font-bold text-white font-mono">
              {Number(item.value).toLocaleString("uk-UA")}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export function MarketStructureChart({ rows = null, data = [], allManufacturers = [] }) {
  // Prepare chart data: ALWAYS sorted by potential (pointsTotalPotential) descending
  const chartData = useMemo(() => {
    if (rows && Array.isArray(rows)) {
      return [...rows]
        .filter(r => (r.sales > 0 || r.ttCount > 0 || r.places > 0 || (r.pointsTotalPotential || 0) > 0))
        .sort((a, b) => (b.pointsTotalPotential || 0) - (a.pointsTotalPotential || 0));
    }

    const mfgSet = new Set();
    data.forEach(v => {
      (v.visitManufacturers || []).forEach(vm => {
        if (vm.name) mfgSet.add(vm.name.trim());
      });
      (v.manufacturers || []).forEach(m => {
        if (m) mfgSet.add(m.trim());
      });
    });
    (allManufacturers || []).forEach(m => {
      if (m) mfgSet.add(m.trim());
    });

    const mfgList = Array.from(mfgSet);

    const builtRows = mfgList.map(mName => {
      const matchingVisits = data.filter(v => {
        const vMfs = v.visitManufacturers || [];
        return vMfs.some(vm => (vm.name || "").trim().toLowerCase() === mName.toLowerCase());
      });

      const ttCount = matchingVisits.length;

      const sales = matchingVisits.reduce((acc, v) => {
        const vm = (v.visitManufacturers || []).find(
          m => (m.name || "").trim().toLowerCase() === mName.toLowerCase()
        );
        return acc + (vm?.pp || 0);
      }, 0);

      const places = matchingVisits.reduce((acc, v) => {
        const vm = (v.visitManufacturers || []).find(
          m => (m.name || "").trim().toLowerCase() === mName.toLowerCase()
        );
        return acc + (vm?.kv || 0);
      }, 0);

      const pointsTotalPotential = matchingVisits.reduce(
        (acc, v) => acc + (v.totalPP || 0),
        0
      );

      return {
        name: mName,
        ttCount,
        sales,
        places,
        pointsTotalPotential
      };
    });

    return builtRows
      .filter(r => r.sales > 0 || r.ttCount > 0 || r.places > 0 || (r.pointsTotalPotential || 0) > 0)
      .sort((a, b) => (b.pointsTotalPotential || 0) - (a.pointsTotalPotential || 0));
  }, [rows, data, allManufacturers]);

  // Max value to adjust YAxis domain headroom
  const maxY = useMemo(() => {
    let max = 0;
    chartData.forEach(d => {
      if ((d.pointsTotalPotential || 0) > max) max = d.pointsTotalPotential;
      if ((d.sales || 0) > max) max = d.sales;
      if ((d.places || 0) > max) max = d.places;
      if ((d.ttCount || 0) > max) max = d.ttCount;
    });
    if (max <= 0) return 1000;
    // Add 25% headroom so top label is never clipped
    const step = max > 10000 ? 2000 : max > 2000 ? 500 : 100;
    return Math.ceil((max * 1.25) / step) * step;
  }, [chartData]);

  return (
    <div className="h-full rounded-2xl border border-white/10 bg-[#0d1527]/70 p-3 sm:p-4 flex flex-col justify-between min-h-[440px]">
      {/* Chart Mini Header */}
      <div className="flex items-center gap-2 pb-2 mb-1 border-b border-white/10 shrink-0">
        <div className="p-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
          <BarChart3 className="h-4 w-4" />
        </div>
        <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">
          Графік ринкових показників
        </h3>
      </div>

      {/* Chart Container */}
      <div className="flex-1 w-full min-h-[360px] pt-1">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            Немає даних для побудови графіка
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 25, right: 15, left: 5, bottom: 45 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />

              <XAxis
                dataKey="name"
                stroke="#94a3b8"
                fontSize={11}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={60}
                tick={{ fill: "#94a3b8" }}
                tickFormatter={(val) => {
                  if (typeof val === "string" && val.length > 20) {
                    return val.slice(0, 18) + "…";
                  }
                  return val;
                }}
              />

              <YAxis
                stroke="#94a3b8"
                fontSize={11}
                domain={[0, maxY]}
                tickFormatter={(val) => Number(val).toLocaleString("uk-UA")}
                tick={{ fill: "#94a3b8" }}
              />

              <Tooltip content={<CustomTooltip />} />

              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: 15 }}
                formatter={(value) => (
                  <span className="text-xs text-white/90 font-medium ml-1">{value}</span>
                )}
              />

              {/* 1. Кількість ТТ (червоний/теракотовий стовпчик) */}
              <Bar
                dataKey="ttCount"
                name="Кількість ТТ"
                fill="#b84545"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
              >
                <LabelList
                  dataKey="ttCount"
                  position="top"
                  fill="#ef4444"
                  fontSize={10}
                  fontWeight={600}
                  formatter={(val) => (val ? Number(val).toLocaleString("uk-UA") : "")}
                />
              </Bar>

              {/* 2. Продажі, шт/міс (синій стовпчик) */}
              <Bar
                dataKey="sales"
                name="Продажі, шт/міс"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
              >
                <LabelList
                  dataKey="sales"
                  position="top"
                  fill="#60a5fa"
                  fontSize={10}
                  fontWeight={600}
                  formatter={(val) => (val ? Number(val).toLocaleString("uk-UA") : "")}
                />
              </Bar>

              {/* 3. Кількість спальних місць (салатовий/зелений стовпчик) */}
              <Bar
                dataKey="places"
                name="Кількість спальних місць"
                fill="#84cc16"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
              >
                <LabelList
                  dataKey="places"
                  position="top"
                  fill="#a3e635"
                  fontSize={10}
                  fontWeight={600}
                  formatter={(val) => (val ? Number(val).toLocaleString("uk-UA") : "")}
                />
              </Bar>

              {/* 4. Потенціал (помаранчева лінія з точками) */}
              <Line
                type="linear"
                dataKey="pointsTotalPotential"
                name="Потенціал"
                stroke="#ea580c"
                strokeWidth={3.5}
                dot={{
                  r: 5,
                  fill: "#ea580c",
                  stroke: "#ffffff",
                  strokeWidth: 2
                }}
                activeDot={{ r: 7, fill: "#f97316" }}
              >
                <LabelList
                  dataKey="pointsTotalPotential"
                  position="top"
                  offset={10}
                  fill="#ea580c"
                  fontSize={11}
                  fontWeight={700}
                  formatter={(val) => (val ? Number(val).toLocaleString("uk-UA") : "")}
                />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
