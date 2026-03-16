import React, { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export function TrendChart({ data, brands }) {
  const chartData = useMemo(() => {
    const dates = [...new Set(data.map(d => d.date))].sort();
    return dates.map(date => {
      const dateData = data.filter(d => d.date === date);
      const row = { date: date.split('-').slice(1).join('/') }; // MM/DD
      brands.forEach(brand => {
        const presentCount = dateData.filter(d => d.brandPresence[brand]).length;
        row[brand] = dateData.length ? Math.round((presentCount / dateData.length) * 100) : 0;
      });
      return row;
    });
  }, [data, brands]);

  const colors = ["#6366f1", "#10b981", "#f59e0b", "#06b6d4", "#8b5cf6"];

  return (
    <div className="glass p-6 rounded-3xl h-[400px]">
      <h2 className="text-lg font-bold mb-6">Тренд покриття моделей (%)</h2>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} />
          <YAxis stroke="#94a3b8" fontSize={12} />
          <Tooltip 
            contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
            itemStyle={{ fontSize: "12px" }}
          />
          <Legend wrapperStyle={{ paddingTop: "20px" }} />
          {brands.map((b, i) => (
            <Line 
              key={b} 
              type="monotone" 
              dataKey={b} 
              stroke={colors[i % colors.length]} 
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
