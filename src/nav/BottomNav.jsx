import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "./navItems";
import { useAuth } from "../hooks/useAuth";
import { BarChart3, Map as MapIcon, Calendar, User, ClipboardList } from "lucide-react";

const ICON_MAP = {
  surveys: ClipboardList,
  map: MapIcon,
  plan: Calendar,
  analytics: BarChart3,
  profile: User,
};

export function BottomNav() {
  const { profile } = useAuth();
  const isAdminOrHead = profile?.role === "admin" || profile?.role === "head";

  const filteredItems = NAV_ITEMS.filter(it => {
    if (it.key === "analytics") return isAdminOrHead;
    return true;
  });

  return (
    <div style={{ ...styles.wrap, gridTemplateColumns: `repeat(${filteredItems.length}, 1fr)` }}>
      {filteredItems.map((it) => {
        const Icon = ICON_MAP[it.key] || ClipboardList;
        const content = (
          <>
            <Icon className="h-5 w-5" />
            <div style={styles.label}>{it.label}</div>
          </>
        );

        if (!it.enabled) {
          return (
            <div key={it.key} style={{ ...styles.item, opacity: 0.45 }}>
              {content}
            </div>
          );
        }

        return (
          <NavLink
            key={it.key}
            to={it.to}
            style={({ isActive }) => ({
              ...styles.item,
              color: isActive ? "#a5b4fc" : "#e5e7eb",
            })}
          >
            {content}
          </NavLink>
        );
      })}
    </div>
  );
}

const styles = {
  wrap: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    height: "calc(64px + env(safe-area-inset-bottom))",
    paddingBottom: "env(safe-area-inset-bottom)",
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    borderTop: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(11,18,32,0.92)",
    backdropFilter: "blur(10px)",
  },
  item: {
    textDecoration: "none",
    display: "grid",
    placeItems: "center",
    gap: 4,
    fontSize: 11,
  },
  label: { opacity: 0.9 },
};
