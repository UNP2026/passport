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
        {payload.map((item, idx) => {
          const isPct = item.dataKey === "sharePct";
          const formattedVal = isPct
            ? `${Number(item.value).toFixed(1).replace(".", ",")}%`
            : Number(item.value).toLocaleString("uk-UA") + " шт";
          return (
            <div key={idx} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5" style={{ color: item.color }}>
                <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: item.color }} />
                <span className="text-muted-foreground">{item.name}:</span>
              </span>
              <span className="font-bold text-white font-mono">
                {formattedVal}
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
}

export function ManagerResultsChart({ rows = [] }) {
  // Chart is always sorted by sharePct (Частка ЮНП) descending as in screenshot
  const chartData = useMemo(() => {
    return [...rows]
      .filter(r => r.ttCount > 0 || r.potential > 0 || r.sales > 0)
      .sort((a, b) => (b.sharePct || 0) - (a.sharePct || 0));
  }, [rows]);

  // Max value for right YAxis (sales)
  const maxSales = useMemo(() => {
    let max = 0;
    chartData.forEach(d => {
      if ((d.sales || 0) > max) max = d.sales;
    });
    if (max <= 0) return 2500;
    const step = max > 5000 ? 1000 : 500;
    return Math.ceil((max * 1.25) / step) * step;
  }, [chartData]);

  return (
    <div className="h-full rounded-2xl border border-white/10 bg-[#0d1527]/70 p-3 sm:p-4 flex flex-col justify-between min-h-[440px]">
      {/* Chart Mini Header */}
      <div className="flex items-center gap-2 pb-2 mb-1 border-b border-white/10 shrink-0">
        <div className="p-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
          <BarChart3 className="h-4 w-4" />
        </div>
        <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight">
          Частка ЮНП за менеджерами
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

              {/* X Axis: Managers */}
              <XAxis
                dataKey="name"
                stroke="#94a3b8"
                fontSize={11}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={55}
                tick={{ fill: "#94a3b8" }}
              />

              {/* Left Y Axis: Частка ЮНП (0% - 100%) */}
              <YAxis
                yAxisId="left"
                stroke="#94a3b8"
                fontSize={11}
                domain={[0, 100]}
                ticks={[0, 20, 40, 60, 80, 100]}
                tickFormatter={(val) => `${val}%`}
                tick={{ fill: "#94a3b8" }}
              />

              {/* Right Y Axis: Продажі ЮНП */}
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#94a3b8"
                fontSize={11}
                domain={[0, maxSales]}
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

              {/* 1. Стовпчики: Частка ЮНП (синій стовпчик на лівій осі) */}
              <Bar
                yAxisId="left"
                dataKey="sharePct"
                name="Частка ЮНП"
                fill="#4682b4"
                radius={[4, 4, 0, 0]}
                maxBarSize={38}
              >
                <LabelList
                  dataKey="sharePct"
                  position="top"
                  fill="#60a5fa"
                  fontSize={10}
                  fontWeight={600}
                  formatter={(val) => (val ? `${Number(val).toFixed(1).replace(".", ",")}%` : "")}
                />
              </Bar>

              {/* 2. Лінія: Продажі ЮНП (теракотова/червона лінія з квадратними маркерами на правій осі) */}
              <Line
                yAxisId="right"
                type="linear"
                dataKey="sales"
                name="Продажі ЮНП"
                stroke="#b84545"
                strokeWidth={3}
                dot={{
                  r: 5,
                  fill: "#b84545",
                  stroke: "#ffffff",
                  strokeWidth: 2
                }}
                activeDot={{ r: 7, fill: "#ef4444" }}
              >
                <LabelList
                  dataKey="sales"
                  position="top"
                  offset={10}
                  fill="#ef4444"
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
