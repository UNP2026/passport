import { Outlet, useLocation } from "react-router-dom";
import { MobileLayout } from "./MobileLayout";
import { DesktopLayout } from "./DesktopLayout";
import { useState, useEffect } from "react";
import { SidebarProvider } from "../context/SidebarContext";

export function AppShell() {
  const loc = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // В паспорте скрываем bottom nav на мобилках
  const hideNav = loc.pathname.startsWith("/app/surveys/new");
  const isDesktopOnly = loc.pathname.startsWith("/app/analytics") || loc.pathname.startsWith("/app/map");

  if (isDesktopOnly && !isMobile) {
    return (
      <SidebarProvider>
        <div className="h-screen bg-background text-foreground overflow-hidden">
          <DesktopLayout>
            <Outlet />
          </DesktopLayout>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="h-screen bg-background text-foreground overflow-hidden">
        <MobileLayout hideNav={hideNav}>
          <Outlet />
        </MobileLayout>
      </div>
    </SidebarProvider>
  );
}
