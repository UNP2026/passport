import React, { useState, useRef, useEffect, useMemo } from "react";
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Check, 
  Clock, 
  CalendarDays,
  RotateCcw
} from "lucide-react";

const MONTH_NAMES_UK = [
  "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
  "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"
];

const WEEKDAY_NAMES_UK = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatDateKey(dateObj) {
  const y = dateObj.getFullYear();
  const m = pad2(dateObj.getMonth() + 1);
  const d = pad2(dateObj.getDate());
  return `${y}-${m}-${d}`;
}

function parseDateKey(key) {
  if (!key) return null;
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatUkDisplay(key) {
  if (!key) return "";
  const [y, m, d] = key.split("-");
  return `${d}.${m}.${y}`;
}

export function PeriodFilterDropdown({
  period = { preset: null, startDate: null, endDate: null },
  onChange,
  visitsCountByDate = {},
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Active dates in string format YYYY-MM-DD
  const startDate = period?.startDate || null;
  const endDate = period?.endDate || null;
  const preset = period?.preset || null;

  // Month & Year displayed in the calendar view
  const [viewDate, setViewDate] = useState(() => {
    // If startDate exists, open on its month
    if (startDate) {
      const d = parseDateKey(startDate);
      if (d) return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    // Else check if any visits exist in visitsCountByDate and open to latest visit's month
    const visitDates = Object.keys(visitsCountByDate)
      .filter((k) => (visitsCountByDate[k] || 0) > 0)
      .sort();
    if (visitDates.length > 0) {
      const latest = parseDateKey(visitDates[visitDates.length - 1]);
      if (latest) return new Date(latest.getFullYear(), latest.getMonth(), 1);
    }
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const handleToggleOpen = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        if (startDate) {
          const d = parseDateKey(startDate);
          if (d) setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
        } else {
          const visitDates = Object.keys(visitsCountByDate)
            .filter((k) => (visitsCountByDate[k] || 0) > 0)
            .sort();
          if (visitDates.length > 0) {
            const latest = parseDateKey(visitDates[visitDates.length - 1]);
            if (latest) setViewDate(new Date(latest.getFullYear(), latest.getMonth(), 1));
          }
        }
      }
      return next;
    });
  };

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

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  const handlePrevMonth = () => {
    setViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewYear, viewMonth + 1, 1));
  };

  // Quick preset actions
  const applyPresetToday = () => {
    const today = new Date();
    const key = formatDateKey(today);
    onChange({
      preset: "today",
      startDate: key,
      endDate: key,
    });
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  const applyPresetWeek = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);
    onChange({
      preset: "week",
      startDate: formatDateKey(start),
      endDate: formatDateKey(end),
    });
    setViewDate(new Date(end.getFullYear(), end.getMonth(), 1));
  };

  const applyPresetMonth = () => {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    onChange({
      preset: "month",
      startDate: formatDateKey(start),
      endDate: formatDateKey(end),
    });
    setViewDate(new Date(end.getFullYear(), end.getMonth(), 1));
  };

  const handleClear = () => {
    onChange({
      preset: null,
      startDate: null,
      endDate: null,
    });
  };

  // Calendar click logic
  const handleDateClick = (dateKey) => {
    // If no start date or both start and end are already set, begin new range selection
    if (!startDate || (startDate && endDate)) {
      onChange({
        preset: "custom",
        startDate: dateKey,
        endDate: null,
      });
      return;
    }

    // If start date is set and end date is null
    if (startDate && !endDate) {
      if (dateKey < startDate) {
        // Clicked date is earlier than start: make it new start
        onChange({
          preset: "custom",
          startDate: dateKey,
          endDate: null,
        });
      } else {
        // Complete the range
        onChange({
          preset: "custom",
          startDate: startDate,
          endDate: dateKey,
        });
      }
    }
  };

  // Manual inputs change
  const handleManualStart = (e) => {
    const val = e.target.value;
    onChange({
      preset: "custom",
      startDate: val || null,
      endDate: endDate,
    });
    if (val) {
      const d = parseDateKey(val);
      if (d) setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  };

  const handleManualEnd = (e) => {
    const val = e.target.value;
    onChange({
      preset: "custom",
      startDate: startDate,
      endDate: val || null,
    });
  };

  // Calendar days grid computation
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const totalDays = lastDay.getDate();

    // Monday is index 0 in Ukrainian calendar
    const startDayOfWeek = (firstDay.getDay() + 6) % 7;

    const days = [];

    // Leading padding for previous month
    const prevMonthLastDay = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const prevDate = new Date(viewYear, viewMonth - 1, dayNum);
      const key = formatDateKey(prevDate);
      days.push({
        day: dayNum,
        dateKey: key,
        isCurrentMonth: false,
      });
    }

    // Days of current month
    for (let d = 1; d <= totalDays; d++) {
      const key = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(d)}`;
      days.push({
        day: d,
        dateKey: key,
        isCurrentMonth: true,
      });
    }

    // Trailing padding for next month to complete row of 7
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(viewYear, viewMonth + 1, i);
      const key = formatDateKey(nextDate);
      days.push({
        day: i,
        dateKey: key,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [viewYear, viewMonth]);

  // Is filter currently active?
  const hasActivePeriod = Boolean(startDate || endDate);

  // Label for trigger button
  const triggerLabel = useMemo(() => {
    if (!startDate && !endDate) return "Весь час";
    if (preset === "today") return "Сьогодні";
    if (preset === "week") return "Тиждень";
    if (preset === "month") return "Місяць";
    if (startDate && endDate) {
      if (startDate === endDate) return formatUkDisplay(startDate);
      return `${formatUkDisplay(startDate)} — ${formatUkDisplay(endDate)}`;
    }
    if (startDate) return `з ${formatUkDisplay(startDate)}`;
    if (endDate) return `до ${formatUkDisplay(endDate)}`;
    return "Період";
  }, [preset, startDate, endDate]);

  // Total visits matching this period
  const totalVisitsInPeriod = useMemo(() => {
    if (!hasActivePeriod) {
      return Object.values(visitsCountByDate).reduce((acc, c) => acc + (c || 0), 0);
    }
    return Object.entries(visitsCountByDate).reduce((acc, [k, count]) => {
      if (startDate && k < startDate) return acc;
      if (endDate && k > endDate) return acc;
      return acc + (count || 0);
    }, 0);
  }, [visitsCountByDate, startDate, endDate, hasActivePeriod]);

  return (
    <div className={`relative inline-block text-left ${isOpen ? "z-[60]" : "z-10"}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggleOpen}
        className={`flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium border transition-all duration-200 select-none ${
          hasActivePeriod
            ? "bg-indigo-600/15 border-indigo-500/40 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.15)]"
            : "bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-white/80 hover:text-white"
        }`}
        title={`Період: ${triggerLabel}`}
      >
        <Calendar className={`h-3.5 w-3.5 shrink-0 ${hasActivePeriod ? "text-indigo-400" : "text-muted-foreground"}`} />
        <span className="font-semibold text-white/90">Період:</span>
        <span className="truncate max-w-[150px] sm:max-w-[200px] text-white">
          {triggerLabel}
        </span>
        {hasActivePeriod && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="ml-1 p-0.5 rounded-md hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
            title="Очистити період"
          >
            <X className="h-3 w-3" />
          </span>
        )}
      </button>

      {/* Dropdown Calendar Panel */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-[340px] sm:w-[370px] rounded-2xl bg-[#0f172a] border border-white/20 shadow-[0_25px_60px_rgba(0,0,0,0.9)] z-[70] overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-3 space-y-3">
          {/* Quick Presets Header */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-indigo-400" />
                Швидкий вибір:
              </span>
              {hasActivePeriod && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-rose-400 hover:text-rose-300 text-[11px] flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  Скинути
                </button>
              )}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={applyPresetToday}
                className={`py-1.5 px-2 rounded-xl text-xs font-medium transition-all ${
                  preset === "today"
                    ? "bg-indigo-600 text-white shadow-md font-bold"
                    : "bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10"
                }`}
              >
                Сьогодні
              </button>
              <button
                type="button"
                onClick={applyPresetWeek}
                className={`py-1.5 px-2 rounded-xl text-xs font-medium transition-all ${
                  preset === "week"
                    ? "bg-indigo-600 text-white shadow-md font-bold"
                    : "bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10"
                }`}
              >
                Тиждень
              </button>
              <button
                type="button"
                onClick={applyPresetMonth}
                className={`py-1.5 px-2 rounded-xl text-xs font-medium transition-all ${
                  preset === "month"
                    ? "bg-indigo-600 text-white shadow-md font-bold"
                    : "bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10"
                }`}
              >
                Місяць
              </button>
              <button
                type="button"
                onClick={handleClear}
                className={`py-1.5 px-2 rounded-xl text-xs font-medium transition-all ${
                  !hasActivePeriod
                    ? "bg-indigo-600 text-white shadow-md font-bold"
                    : "bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10"
                }`}
              >
                Весь час
              </button>
            </div>
          </div>

          {/* Manual Range Inputs */}
          <div className="pt-2 border-t border-white/10 flex items-center gap-2 text-xs">
            <div className="flex-1 space-y-0.5">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Від:</span>
              <input
                type="date"
                value={startDate || ""}
                onChange={handleManualStart}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-1 text-xs text-white outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div className="flex-1 space-y-0.5">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">До:</span>
              <input
                type="date"
                value={endDate || ""}
                onChange={handleManualEnd}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-1 text-xs text-white outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Month Navigation */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-between">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
              title="Попередній місяць"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-xs font-bold text-white capitalize flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-indigo-400" />
              <span>
                {MONTH_NAMES_UK[viewMonth]} {viewYear}
              </span>
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
              title="Наступний місяць"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday Row */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAY_NAMES_UK.map((wd) => (
              <div key={wd} className="text-[10px] font-bold text-muted-foreground uppercase py-0.5">
                {wd}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((item, idx) => {
              const { day, dateKey, isCurrentMonth } = item;
              const visitCount = visitsCountByDate[dateKey] || 0;
              const hasVisits = visitCount > 0;

              const isSelectedStart = startDate === dateKey;
              const isSelectedEnd = endDate === dateKey;
              const isInRange =
                startDate && endDate && dateKey > startDate && dateKey < endDate;

              return (
                <div
                  key={`${dateKey}-${idx}`}
                  onClick={() => isCurrentMonth && handleDateClick(dateKey)}
                  className={`relative flex items-center justify-center h-10 select-none transition-all ${
                    !isCurrentMonth ? "opacity-25 pointer-events-none" : "cursor-pointer"
                  } ${
                    isInRange
                      ? "bg-indigo-500/15 text-indigo-200"
                      : isSelectedStart && endDate && startDate !== endDate
                      ? "rounded-l-full bg-indigo-500/25"
                      : isSelectedEnd && startDate && startDate !== endDate
                      ? "rounded-r-full bg-indigo-500/25"
                      : ""
                  }`}
                >
                  {/* The circular day element: circled if has visits or selected */}
                  <div
                    className={`relative w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all ${
                      isSelectedStart || isSelectedEnd
                        ? "bg-indigo-600 text-white font-bold shadow-[0_0_10px_rgba(99,102,241,0.6)] ring-2 ring-indigo-300"
                        : hasVisits
                        ? "border-2 border-indigo-400 bg-indigo-500/15 text-white font-bold hover:bg-indigo-500/25 hover:border-indigo-300"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span>{day}</span>

                    {/* Requirement: В правом верхнем углу кружка показать кол-во визитов в этот день */}
                    {hasVisits && (
                      <span
                        className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] px-1 rounded-full bg-indigo-600 text-[9px] font-extrabold text-white flex items-center justify-center shadow-md leading-none border border-white/30 z-20"
                        title={`${visitCount} візитів на ${formatUkDisplay(dateKey)}`}
                      >
                        {visitCount > 99 ? "99+" : visitCount}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer with summary and close */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
            <div className="text-[11px] text-muted-foreground truncate">
              {hasActivePeriod ? (
                <span>
                  Візитів за період: <strong className="text-white font-mono">{totalVisitsInPeriod}</strong>
                </span>
              ) : (
                <span>Всі візити ({totalVisitsInPeriod})</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all flex items-center gap-1"
            >
              <Check className="h-3 w-3" />
              Готово
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
