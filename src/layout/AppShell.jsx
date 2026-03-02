import { Outlet, useLocation } from "react-router-dom";
import { MobileLayout } from "./MobileLayout";

// пока делаем только MobileLayout. Desktop добавим следующим шагом.
export function AppShell() {
  const loc = useLocation();

  // В паспорте скрываем bottom nav
  const hideNav = loc.pathname.startsWith("/app/surveys/new");

  return (
    <div style={styles.bg}>
      <MobileLayout hideNav={hideNav}>
        <Outlet />
      </MobileLayout>
    </div>
  );
}

const styles = {
  bg: {
    minHeight: "100vh",
    background: "#0b1220",
    color: "#e5e7eb",
    overflowX: "hidden",
  },
};
