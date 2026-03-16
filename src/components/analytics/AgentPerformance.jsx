import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export function AgentPerformance({ data, agents, brands }) {
  const chartData = useMemo(() => {
    return agents.map(agent => {
      const agentData = data.filter(d => d.agent === agent);
      const row = { name: agent.split(' ')[0] }; // short name
      brands.forEach(brand => {
        const presentCount = agentData.filter(d => d.brandPresence[brand]).length;
        row[brand] = agentData.length ? Math.round((presentCount / agentData.length) * 100) : 0;
      });
      return row;
    });
  }, [data, agents, brands]);

  const colors = ["#6366f1", "#10b981", "#f59e0b", "#06b6d4", "#8b5cf6"];

  return (
    <div className="glass p-6 rounded-3xl h-[400px]">
      <h2 className="text-lg font-bold mb-6">Ефективність менеджерів по моделях (%)</h2>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
          <YAxis stroke="#94a3b8" fontSize={12} />
          <Tooltip 
            contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
            itemStyle={{ fontSize: "12px" }}
          />
          <Legend wrapperStyle={{ paddingTop: "20px" }} />
          {brands.map((b, i) => (
            <Bar key={b} dataKey={b} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
