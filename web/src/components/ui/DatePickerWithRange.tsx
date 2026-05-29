import { CalendarIcon, Check, X } from "lucide-react";
import { useId, useMemo, useState, useEffect } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DatePickerWithRangeProps {
  className?: string;
  selectedMonths: string[];
  setSelectedMonths: (months: string[]) => void;
  availableMonths?: string[];
}

// ─── Design tokens (single source of truth) ──────────────────────────────────
// All interactive controls inside the popover share these tokens so
// every element looks pixel-for-pixel identical in height/radius/font.
const CTRL_H   = "h-8";
const CTRL_R   = "rounded-lg";
const CTRL_TXT = "text-xs font-semibold";

export function DatePickerWithRange({
  className,
  selectedMonths = [],
  setSelectedMonths,
  availableMonths = [],
}: DatePickerWithRangeProps) {
  const uniqueId = useId();
  const triggerId = `date-filter-trigger-${uniqueId.replace(/:/g, "")}`;
  const [triggerWidth, setTriggerWidth] = useState<number | null>(null);

  useEffect(() => {
    const handleResize = () => {
      const el = document.getElementById(triggerId);
      if (el) {
        setTriggerWidth(el.offsetWidth);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    // Extra checks to guarantee correct measurement after styles mount
    const t1 = setTimeout(handleResize, 50);
    const t2 = setTimeout(handleResize, 150);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [triggerId]);
  const monthsMap: Record<string, number> = {
    january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2,
    april: 3, apr: 3, may: 4, june: 5, jun: 5, july: 6, jul: 6,
    august: 7, aug: 7, september: 8, sept: 8, sep: 8,
    october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11,
  };

  const SHORT_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const parsedMonths = useMemo(() => {
    return availableMonths
      .map((m) => {
        const clean = m.trim().toLowerCase();
        const yr = clean.match(/\b(20\d{2})\b/);
        if (!yr) return null;
        const year = parseInt(yr[1], 10);
        const mo = clean.match(/(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)/);
        const monthIdx = mo ? monthsMap[mo[0]] : 0;
        return { original: m, date: new Date(year, monthIdx, 1), year, monthIdx, monthName: SHORT_NAMES[monthIdx] };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [availableMonths]);

  const groupedMonths = useMemo(() => {
    const g: Record<number, typeof parsedMonths> = {};
    parsedMonths.forEach((item) => {
      if (!g[item.year]) g[item.year] = [];
      g[item.year].push(item);
    });
    return g;
  }, [parsedMonths]);

  const availableYears = useMemo(() =>
    Object.keys(groupedMonths).map(Number).sort((a, b) => a - b),
    [groupedMonths]
  );

  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  useEffect(() => {
    if (availableYears.length > 0 && selectedYear === null) {
      setSelectedYear(availableYears[availableYears.length - 1]);
    }
  }, [availableYears, selectedYear]);

  const activeYear = useMemo(() => {
    if (selectedYear !== null && availableYears.includes(selectedYear)) return selectedYear;
    return availableYears[availableYears.length - 1] ?? null;
  }, [availableYears, selectedYear]);

  const orderedSelected = useMemo(
    () => parsedMonths.filter(m => selectedMonths.includes(m.original)).map(m => m.original),
    [parsedMonths, selectedMonths]
  );

  const triggerLabel = useMemo(() => {
    if (orderedSelected.length === 0) return "All Periods";
    if (orderedSelected.length === 1) return orderedSelected[0];
    if (orderedSelected.length === 2) return `${orderedSelected[0]}, ${orderedSelected[1]}`;
    return `${orderedSelected.length} Periods Selected`;
  }, [orderedSelected]);

  const isFiltered = selectedMonths.length > 0;

  const toggleMonth = (m: string) => {
    setSelectedMonths(selectedMonths.includes(m)
      ? selectedMonths.filter(x => x !== m)
      : [...selectedMonths, m]
    );
  };

  const toggleYear = (year: number) => {
    const yearMonths = groupedMonths[year].map(i => i.original);
    const allOn = yearMonths.every(m => selectedMonths.includes(m));
    setSelectedMonths(
      allOn
        ? selectedMonths.filter(m => !yearMonths.includes(m))
        : Array.from(new Set([...selectedMonths, ...yearMonths]))
    );
  };

  const preset = (type: "latest" | "last3" | "all") => {
    if (type === "all") { setSelectedMonths([]); return; }
    if (!parsedMonths.length) return;
    if (type === "latest") {
      const last = parsedMonths[parsedMonths.length - 1];
      setSelectedMonths([last.original]);
      setSelectedYear(last.year);
    } else {
      const slice = parsedMonths.slice(-Math.min(3, parsedMonths.length));
      setSelectedMonths(slice.map(m => m.original));
      setSelectedYear(slice[slice.length - 1].year);
    }
  };

  const hasMonths = availableMonths.length > 0;

  return (
    <div className={cn("flex items-center gap-2 w-full sm:w-auto", className)}>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              id={triggerId}
              variant="outline"
              style={{ touchAction: "manipulation" }}
              className={cn(
                "justify-start text-left gap-2 cursor-pointer select-none border transition-colors duration-150",
                "h-9 sm:h-9 flex-1 sm:flex-initial w-full sm:w-[220px] md:w-[240px] px-3 rounded-lg text-xs sm:text-xs",
                isFiltered
                  ? "border-primary/40 bg-primary/5 text-foreground dark:bg-primary/10"
                  : "border-input bg-transparent dark:bg-input/30 text-muted-foreground hover:bg-muted/50"
              )}
            >
              <CalendarIcon className={cn("size-3.5 shrink-0", isFiltered ? "text-primary" : "text-muted-foreground")} />
              <span className="truncate font-semibold">{triggerLabel}</span>
            </Button>
          }
        />

        {/* Override default zoom-in-95+slide animation with opacity-only fade.
            zoom triggers an expensive composite on mobile — pure opacity is GPU-free. */}
        <PopoverContent
          align="start"
          style={triggerWidth ? { width: `${triggerWidth}px` } : undefined}
          className={cn(
            "p-0 border bg-popover shadow-xl rounded-xl",
            "sm:!w-80",
            "flex flex-col select-none",
            "duration-150 data-open:animate-in data-open:fade-in-0",
            "data-closed:animate-out data-closed:fade-out-0",
            "![--tw-enter-scale:1] ![--tw-exit-scale:1]",
            "![--tw-enter-translate-y:0] ![--tw-exit-translate-y:0]"
          )}
        >
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-border/60">
            <p className="text-[0.6rem] font-black uppercase tracking-widest text-muted-foreground mb-0.5">
              Filter by Month
            </p>
            <p className="text-[0.68rem] text-muted-foreground leading-relaxed">
              Pick one or more months to narrow your data.
            </p>
          </div>

          {/* Body */}
          <div className="px-4 py-3 flex flex-col gap-3">
            {hasMonths ? (
              <>
                {/* Year selector row */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <Select
                      value={activeYear !== null ? String(activeYear) : ""}
                      onValueChange={(v) => setSelectedYear(Number(v))}
                    >
                      <SelectTrigger
                        className={cn(
                          "w-full border-input bg-transparent dark:bg-input/30 focus-visible:border-ring",
                          CTRL_H, CTRL_R, CTRL_TXT
                        )}
                      >
                        <SelectValue placeholder="Select Year" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border shadow-lg rounded-xl z-50 max-h-56 overflow-y-auto">
                        {availableYears.map((yr) => {
                          const cnt = groupedMonths[yr].filter(i => selectedMonths.includes(i.original)).length;
                          return (
                            <SelectItem key={yr} value={String(yr)}>
                              <span className="flex items-center gap-2">
                                <span>{yr}</span>
                                {cnt > 0 && (
                                  <span className="rounded-full bg-primary/15 text-primary px-1.5 py-px text-[0.58rem] font-black leading-none">
                                    {cnt}
                                  </span>
                                )}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {activeYear !== null && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => toggleYear(activeYear)}
                      className={cn(
                        "shrink-0 cursor-pointer border-input bg-transparent dark:bg-input/30 text-muted-foreground hover:text-foreground hover:bg-muted/50 px-3",
                        CTRL_H, CTRL_R, CTRL_TXT
                      )}
                    >
                      {groupedMonths[activeYear].every(i => selectedMonths.includes(i.original))
                        ? "Deselect All"
                        : "Select All"}
                    </Button>
                  )}
                </div>

                {/* Month grid */}
                {activeYear !== null && groupedMonths[activeYear] && (
                  <div className="flex flex-col gap-2 border-t border-border/40 pt-3">
                    <span className="text-[0.58rem] font-black uppercase tracking-widest text-muted-foreground">
                      Months in {activeYear}
                    </span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {groupedMonths[activeYear].map((item) => {
                        const on = selectedMonths.includes(item.original);
                        return (
                          <button
                            type="button"
                            key={item.original}
                            onClick={() => toggleMonth(item.original)}
                            style={{ touchAction: "manipulation" }}
                            className={cn(
                              "relative flex items-center justify-center h-8 text-xs font-semibold rounded-lg border transition-colors duration-100 cursor-pointer select-none",
                              on
                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                : "bg-transparent text-muted-foreground border-input hover:border-primary/40 hover:text-foreground hover:bg-muted/40"
                            )}
                          >
                            {on && (
                              <Check className="absolute left-1.5 size-2.5" />
                            )}
                            <span className={cn(on && "pl-3")}>{item.monthName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No spreadsheets uploaded yet.
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-border/60 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => preset("latest")}
                className={cn(
                  "cursor-pointer border-input bg-transparent dark:bg-input/30 text-muted-foreground hover:text-foreground hover:bg-muted/50 px-3",
                  CTRL_H, CTRL_R, CTRL_TXT
                )}
              >
                Latest
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => preset("last3")}
                className={cn(
                  "cursor-pointer border-input bg-transparent dark:bg-input/30 text-muted-foreground hover:text-foreground hover:bg-muted/50 px-3",
                  CTRL_H, CTRL_R, CTRL_TXT
                )}
              >
                Last 3
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => preset("all")}
              className={cn(
                "cursor-pointer border-input bg-transparent dark:bg-input/30 text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5 px-3",
                CTRL_H, CTRL_R, CTRL_TXT
              )}
            >
              Clear
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Inline clear */}
      {isFiltered && (
        <Button
          variant="outline"
          onClick={() => preset("all")}
          title="Clear date filter"
          className="cursor-pointer shrink-0 gap-1.5 text-muted-foreground hover:text-foreground border-input bg-transparent dark:bg-input/30 hover:bg-muted/50 transition-all duration-200 h-9 sm:h-9 px-2.5 rounded-lg text-xs sm:text-xs font-semibold"
        >
          <X className="size-3.5" />
          <span className="hidden sm:inline">Reset</span>
        </Button>
      )}
    </div>
  );
}
