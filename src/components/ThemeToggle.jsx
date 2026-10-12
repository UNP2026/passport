import React from "react";
import { useTheme } from "../context/ThemeContext";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle({ variant = "segmented", className = "" }) {
  const { setTheme, toggleTheme, isDark } = useTheme();

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`p-2 rounded-xl transition-all border ${
          isDark
            ? "bg-white/5 hover:bg-white/10 text-amber-300 border-white/10 hover:border-white/20"
            : "bg-slate-100 hover:bg-slate-200 text-indigo-600 border-slate-300"
        } ${className}`}
        title={isDark ? "Увімкнути світлий режим" : "Увімкнути темний режим"}
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    );
  }

  if (variant === "row") {
    return (
      <div className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
        isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-slate-200 shadow-sm"
      } ${className}`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl border ${
            isDark ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" : "bg-indigo-50 border-indigo-200 text-indigo-600"
          }`}>
            {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </div>
          <div>
            <div className={`text-xs font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
              Тема оформлення
            </div>
            <div className="text-[11px] text-muted-foreground">
              {isDark ? "Темна тема (активна)" : "Світла тема (активна)"}
            </div>
          </div>
        </div>

        <div className={`flex p-1 rounded-xl border ${
          isDark ? "bg-black/30 border-white/10" : "bg-slate-100 border-slate-200"
        }`}>
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              isDark
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-muted-foreground hover:text-slate-900"
            }`}
          >
            <Moon className="h-3.5 w-3.5" />
            <span>Темна</span>
          </button>
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              !isDark
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-muted-foreground hover:text-white"
            }`}
          >
            <Sun className="h-3.5 w-3.5" />
            <span>Світла</span>
          </button>
        </div>
      </div>
    );
  }

  // Default "segmented" switch: [Темний] [Світлий]
  return (
    <div
      className={`inline-flex items-center p-1 rounded-xl border shadow-inner transition-all ${
        isDark
          ? "bg-white/5 border-white/10"
          : "bg-slate-100 border-slate-300"
      } ${className}`}
    >
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
          isDark
            ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
            : "text-muted-foreground hover:text-slate-900"
        }`}
        title="Темний режим"
      >
        <Moon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Темний</span>
      </button>
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
          !isDark
            ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
            : "text-muted-foreground hover:text-white"
        }`}
        title="Світлий режим"
      >
        <Sun className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Світлий</span>
      </button>
    </div>
  );
}
