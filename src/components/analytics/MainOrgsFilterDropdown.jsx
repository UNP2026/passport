import React, { useState, useRef, useEffect } from "react";
import { 
  Building2, 
  Check, 
  ChevronDown 
} from "lucide-react";
import { MAIN_ORGANIZATIONS, ALL_MAIN_ORG_CODES } from "../../lib/mainOrgs";

export function MainOrgsFilterDropdown({
  selected = ALL_MAIN_ORG_CODES,
  onChange,
  counts = {},
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const toggleOption = (code) => {
    if (selected.includes(code)) {
      onChange(selected.filter((c) => c !== code));
    } else {
      onChange([...selected, code]);
    }
  };

  const selectAll = () => {
    onChange([...ALL_MAIN_ORG_CODES]);
  };

  const clearAll = () => {
    onChange([]);
  };

  // Is any main organization excluded?
  const isFiltered = selected.length < ALL_MAIN_ORG_CODES.length;

  return (
    <div className={`relative inline-block text-left ${isOpen ? "z-[60]" : "z-10"}`} ref={dropdownRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium border transition-all duration-200 select-none ${
          isFiltered
            ? "bg-indigo-600/15 border-indigo-500/40 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.15)]"
            : "bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-white/80 hover:text-white"
        }`}
        title={`Основні організації (${selected.length}/${ALL_MAIN_ORG_CODES.length})`}
      >
        <Building2 className={`h-3.5 w-3.5 shrink-0 ${isFiltered ? "text-indigo-400" : "text-muted-foreground"}`} />
        <span className="truncate max-w-[140px]">Основні організації</span>

        {isFiltered ? (
          <span className="ml-1 inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-indigo-500 text-white leading-none">
            {selected.length}/5
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground font-normal">
            Усі (5)
          </span>
        )}
        <ChevronDown className={`h-3 w-3 shrink-0 ml-0.5 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 sm:w-80 rounded-2xl bg-[#0f172a] border border-white/20 shadow-[0_25px_60px_rgba(0,0,0,0.9)] z-[70] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header & Quick actions */}
          <div className="p-2.5 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center justify-between text-xs font-semibold text-white/90">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-indigo-400" />
                Основні організації
              </span>
              <span className="text-[11px] text-muted-foreground">
                {selected.length} з 5
              </span>
            </div>

            <div className="flex items-center justify-between mt-2 pt-1 text-[11px]">
              <button
                type="button"
                onClick={selectAll}
                className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                Вибрати всі (5)
              </button>
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-rose-400 hover:text-rose-300 transition-colors"
                >
                  Очистити
                </button>
              )}
            </div>
          </div>

          {/* List of 5 Main Orgs (names only, styled identical to MultiSelectDropdown) */}
          <div className="p-1.5 space-y-0.5">
            {MAIN_ORGANIZATIONS.map((org) => {
              const isChecked = selected.includes(org.code);
              const ttCount = counts[org.code] ?? 0;
              const isZero = ttCount === 0 && !isChecked;

              return (
                <div
                  key={org.code}
                  onClick={() => toggleOption(org.code)}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                    isChecked
                      ? "bg-indigo-600/20 text-white font-medium"
                      : isZero
                      ? "text-muted-foreground/60 hover:bg-white/5 hover:text-white/80"
                      : "text-white/80 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    {/* Checkbox */}
                    <div
                      className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
                        isChecked
                          ? "bg-indigo-600 border-indigo-500 text-white"
                          : "border-white/20 bg-white/5"
                      }`}
                    >
                      {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>

                    {/* Organization Name Only */}
                    <span className="truncate" title={org.name}>
                      {org.name}
                    </span>
                  </div>

                  {/* Count badge */}
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                      isChecked
                        ? "bg-indigo-500/30 text-indigo-200"
                        : ttCount > 0
                        ? "bg-white/5 text-muted-foreground"
                        : "bg-white/[0.02] text-white/30"
                    }`}
                  >
                    {ttCount}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Note footer */}
          <div className="p-2 border-t border-white/10 bg-white/[0.01] text-[10px] text-muted-foreground">
            Вимкнення організації виключає всі пов&apos;язані з нею торгові точки.
          </div>
        </div>
      )}
    </div>
  );
}
