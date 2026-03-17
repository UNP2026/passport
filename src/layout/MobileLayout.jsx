import { BottomNav } from "../nav/BottomNav";

export function MobileLayout({ children, hideNav }) {
  return (
    <div style={styles.root} className="flex flex-col h-[100dvh] overflow-hidden">
      <div style={styles.content} className="flex-1 overflow-y-auto">
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
