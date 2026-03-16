import { BottomNav } from "../nav/BottomNav";

export function MobileLayout({ children, hideNav }) {
  return (
    <div style={styles.root} className="flex flex-col h-screen overflow-hidden">
      <div style={{ ...styles.content, paddingBottom: hideNav ? 16 : 76 }} className="flex-1 flex flex-col overflow-y-auto">
        {children}
      </div>
      {!hideNav && <BottomNav />}
    </div>
  );
}

const styles = {
  root: {},
  content: { padding: 0 },
};
