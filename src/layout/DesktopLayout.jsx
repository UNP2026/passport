import React from "react";
import { Sidebar } from "../nav/Sidebar";

export function DesktopLayout({ children }) {
  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
