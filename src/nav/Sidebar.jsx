import React from "react";
import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "./navItems";
import { useAuth } from "../hooks/useAuth";
import { useSidebar } from "../context/SidebarContext";
import { ThemeToggle } from "../components/ThemeToggle";
import { BarChart3, Map as MapIcon, Calendar, User, ClipboardList, LogOut, ChevronLeft, ChevronRight } from "lucide-react";

const ICON_MAP = {
  surveys: ClipboardList,
  map: MapIcon,
  plan: Calendar,
  analytics: BarChart3,
  profile: User,
};

export function Sidebar() {
  const { profile, signOut } = useAuth();
  const { isCollapsed, setIsCollapsed, setFilterContainer } = useSidebar();
  const canAccessAnalytics = ["admin", "head", "sales", "agent"].includes(profile?.role);

  const filteredItems = NAV_ITEMS.filter(it => {
    if (it.key === "analytics") return canAccessAnalytics;
    return true;
  });

  return (
    <aside className={`bg-white dark:bg-[#0b1220] border-r border-slate-200 dark:border-white/10 text-slate-900 dark:text-white flex flex-col hidden md:flex transition-all duration-300 ${isCollapsed ? "w-20" : "w-64"} relative shrink-0 shadow-sm dark:shadow-none`}>
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-8 bg-white dark:bg-[#0b1220] border border-slate-200 dark:border-white/10 rounded-full p-1 text-slate-500 hover:text-indigo-600 dark:text-muted-foreground dark:hover:text-white shadow-sm z-10 transition-colors"
      >
        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>

      <div className="p-6 pb-2">
        <div className={`flex items-center gap-3 mb-8 ${isCollapsed ? "justify-center" : ""}`}>
          <div className="h-10 w-10 shrink-0 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <BarChart3 className="text-white h-6 w-6" />
          </div>
          {!isCollapsed && <span className="font-bold text-xl tracking-tight whitespace-nowrap text-slate-900 dark:text-white">CRM UNP</span>}
        </div>

        <nav className="space-y-1">
          {filteredItems.map((it) => {
            const Icon = ICON_MAP[it.key] || ClipboardList;
            return (
              <NavLink
                key={it.key}
                to={it.to}
                title={isCollapsed ? it.label : undefined}
                className={({ isActive }) => `
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                  ${isActive 
                    ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-600/15 dark:text-indigo-400 font-semibold shadow-sm" 
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-muted-foreground dark:hover:bg-white/5 dark:hover:text-white font-medium"}
                  ${!it.enabled ? "opacity-40 pointer-events-none" : ""}
                  ${isCollapsed ? "justify-center px-0" : ""}
                `}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!isCollapsed && <span className="whitespace-nowrap">{it.label}</span>}
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-2 scrollbar-hide" ref={setFilterContainer}>
        {/* Filters will be injected here via portal */}
      </div>

      <div className="mt-auto p-4 sm:p-6 border-t border-slate-200 dark:border-white/5 space-y-4">
        {/* User profile + Theme icon switcher */}
        <div className={`flex items-center ${isCollapsed ? "flex-col gap-3 justify-center" : "justify-between"} gap-2`}>
          <div className={`flex items-center gap-3 ${isCollapsed ? "justify-center" : "px-1 overflow-hidden"}`}>
            <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white shadow-md">
              {profile?.full_name?.charAt(0) || "U"}
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden">
                <div className="text-sm font-semibold truncate text-slate-900 dark:text-white">{profile?.full_name || "Користувач"}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{profile?.role || "agent"}</div>
              </div>
            )}
          </div>
          
          <ThemeToggle variant="compact" />
        </div>

        <button 
          onClick={signOut}
          title={isCollapsed ? "Вийти" : undefined}
          className={`flex items-center gap-3 py-2.5 rounded-xl text-rose-400 hover:bg-rose-400/10 transition-all text-sm font-medium ${isCollapsed ? "justify-center px-0 w-full" : "px-3 w-full"}`}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span>Вийти</span>}
        </button>
      </div>
    </aside>
  );
}
