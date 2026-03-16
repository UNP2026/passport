import React from "react";
import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "./navItems";
import { useAuth } from "../hooks/useAuth";
import { useSidebar } from "../context/SidebarContext";
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
  const isAdminOrHead = profile?.role === "admin" || profile?.role === "head";

  const filteredItems = NAV_ITEMS.filter(it => {
    if (it.key === "analytics") return isAdminOrHead;
    return true;
  });

  return (
    <aside className={`bg-[#0b1220] border-r border-white/10 flex flex-col hidden md:flex transition-all duration-300 ${isCollapsed ? "w-20" : "w-64"} relative shrink-0`}>
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-8 bg-[#0b1220] border border-white/10 rounded-full p-1 text-muted-foreground hover:text-white z-10"
      >
        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>

      <div className="p-6 pb-2">
        <div className={`flex items-center gap-3 mb-8 ${isCollapsed ? "justify-center" : ""}`}>
          <div className="h-10 w-10 shrink-0 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <BarChart3 className="text-white h-6 w-6" />
          </div>
          {!isCollapsed && <span className="font-bold text-xl tracking-tight whitespace-nowrap">CRM UNP</span>}
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
                    ? "bg-indigo-600/10 text-indigo-400 font-medium" 
                    : "text-muted-foreground hover:bg-white/5 hover:text-white"}
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

      <div className="mt-auto p-6 border-t border-white/5">
        <div className={`flex items-center gap-3 mb-6 ${isCollapsed ? "justify-center" : "px-2"}`}>
          <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold">
            {profile?.full_name?.charAt(0) || "U"}
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <div className="text-sm font-medium truncate">{profile?.full_name || "Користувач"}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{profile?.role || "agent"}</div>
            </div>
          )}
        </div>
        <button 
          onClick={signOut}
          title={isCollapsed ? "Вийти" : undefined}
          className={`flex items-center gap-3 py-3 rounded-xl text-rose-400 hover:bg-rose-400/10 transition-all text-sm font-medium ${isCollapsed ? "justify-center px-0 w-full" : "px-4 w-full"}`}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span>Вийти</span>}
        </button>
      </div>
    </aside>
  );
}
