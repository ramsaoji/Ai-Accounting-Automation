import React, { useState, useMemo, useEffect } from 'react';
import type { MonthlySummary } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, ArrowRight, RotateCcw } from 'lucide-react';
import { formatINR } from '@/utils/format';

interface PeriodComparisonPanelProps {
  months: MonthlySummary[];
  industryProfile?: string;
  departments?: {
    id: string;
    code: string;
    name: string;
    type: string;
    colorHex: string | null;
  }[];
}

export const PeriodComparisonPanel: React.FC<PeriodComparisonPanelProps> = ({ months, industryProfile, departments }) => {
  const availableMonths = useMemo(() => {
    if (!months) return [];
    return months.filter(m => m.sheetName && (m.inflows !== undefined || m.outflows !== undefined));
  }, [months]);

  const [baseMonthName, setBaseMonthName] = useState<string>('');
  const [compareMonthName, setCompareMonthName] = useState<string>('');

  const resetPeriods = () => {
    if (availableMonths.length > 0) {
      setBaseMonthName(availableMonths[0].sheetName);
      if (availableMonths.length > 1) {
        setCompareMonthName(availableMonths[1].sheetName);
      } else {
        setCompareMonthName(availableMonths[0].sheetName);
      }
    }
  };

  useEffect(() => {
    if (availableMonths.length > 0) {
      setBaseMonthName(availableMonths[0].sheetName);
      if (availableMonths.length > 1) {
        setCompareMonthName(availableMonths[1].sheetName);
      } else {
        setCompareMonthName(availableMonths[0].sheetName);
      }
    }
  }, [availableMonths]);

  const baseMonth = useMemo(() => {
    return availableMonths.find(m => m.sheetName === baseMonthName);
  }, [availableMonths, baseMonthName]);

  const compareMonth = useMemo(() => {
    return availableMonths.find(m => m.sheetName === compareMonthName);
  }, [availableMonths, compareMonthName]);

  const metrics = useMemo(() => {
    if (!baseMonth || !compareMonth) return [];

    const calculateVariance = (baseVal: number, compareVal: number) => {
      const abs = compareVal - baseVal;
      const pct = baseVal !== 0 ? (abs / baseVal) * 100 : 0;
      return { abs, pct };
    };

    const getMetricData = (
      name: string,
      keyOrExtractor: keyof MonthlySummary | ((m: MonthlySummary) => number),
      isNegativeOutflow = false
    ) => {
      const getValue = (m: MonthlySummary) => {
        if (typeof keyOrExtractor === 'function') {
          return keyOrExtractor(m);
        }
        return Number(m[keyOrExtractor] || 0);
      };

      const baseVal = getValue(baseMonth);
      const compareVal = getValue(compareMonth);
      const { abs, pct } = calculateVariance(baseVal, compareVal);
      const positiveGood = !isNegativeOutflow;

      return {
        name,
        baseVal,
        compareVal,
        abs,
        pct,
        positiveGood
      };
    };

    const isHospitality = industryProfile === 'HOSPITALITY';
    const revenueDepts = departments?.filter(
      (d: any) =>
        d.type === 'REVENUE' &&
        !d.name.toLowerCase().includes('recovery') &&
        !d.name.toLowerCase().includes('jama') &&
        !d.name.toLowerCase().includes('recover')
    ) || [];

    const dept1 = revenueDepts[0];
    const dept2 = revenueDepts[1];

    const label1 = dept1 ? `${dept1.name} Performance` : (isHospitality ? 'Liquor Revenue Split' : 'Primary Revenue Split');
    const label2 = dept2 ? `${dept2.name} Performance` : (isHospitality ? 'Food Revenue Split' : 'Secondary Revenue Split');

    const extractor1 = (m: MonthlySummary) => {
      if (m.departments && dept1 && (dept1.name in m.departments)) {
        return m.departments[dept1.name] || 0;
      }
      return m.liquor || 0;
    };

    const extractor2 = (m: MonthlySummary) => {
      if (m.departments && dept2 && (dept2.name in m.departments)) {
        return m.departments[dept2.name] || 0;
      }
      return m.food || 0;
    };

    return [
      getMetricData('Total Inflows (Revenue)', 'inflows'),
      getMetricData(label1, extractor1),
      getMetricData(label2, extractor2),
      getMetricData('Operational Expenses', 'expenses', true),
      getMetricData('Credit Extended (Udhari)', 'creditExtended', true),
      getMetricData('Net Position (Surplus)', 'net'),
    ];
  }, [baseMonth, compareMonth, industryProfile, departments]);

  if (availableMonths.length < 2) {
    return null;
  }

  return (
    <Card className="border bg-card/45 shadow-xs flex flex-col">
      <CardHeader className="p-4 sm:p-5 pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="size-4 text-primary" />
          Period-over-Period Performance Compare
        </CardTitle>
        <CardDescription className="text-xs">
          Select any two monthly statements to analyze cashflow shifts and margin variance.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-4 sm:p-5 pt-1.5 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 p-3 bg-muted/20 border border-border/75 rounded-lg select-none">
          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Base Period</label>
            <Select value={baseMonthName} onValueChange={(val) => setBaseMonthName(val ?? '')}>
              <SelectTrigger className="!h-9 w-full sm:w-48 text-xs font-semibold">
                <SelectValue placeholder="Select base period" />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map(m => (
                  <SelectItem key={`base-${m.sheetName}`} value={m.sheetName}>
                    {m.sheetName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ArrowRight className="size-4 text-muted-foreground hidden sm:block mt-4 shrink-0" />

          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Comparison Period</label>
            <Select value={compareMonthName} onValueChange={(val) => setCompareMonthName(val ?? '')}>
              <SelectTrigger className="!h-9 w-full sm:w-48 text-xs font-semibold">
                <SelectValue placeholder="Select comparison period" />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map(m => (
                  <SelectItem key={`compare-${m.sheetName}`} value={m.sheetName}>
                    {m.sheetName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={resetPeriods}
            className="mt-4 !h-9 text-xs font-semibold sm:ml-auto w-full sm:w-auto cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
        </div>

        {baseMonth && compareMonth && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {metrics.map((m) => {
              const isPositive = m.abs >= 0;
              const isHealthy = (isPositive && m.positiveGood) || (!isPositive && !m.positiveGood);
              const isZero = m.abs === 0;

              let deltaBadgeClass = 'bg-muted text-muted-foreground border-border';
              let deltaLabel = 'No change';
              let deltaIcon = null;

              if (!isZero) {
                if (isHealthy) {
                  deltaBadgeClass = 'bg-success/10 text-success border-success/20';
                  deltaLabel = `${isPositive ? '+' : ''}${m.pct.toFixed(1)}%`;
                  deltaIcon = <TrendingUp className="size-3" />;
                } else {
                  deltaBadgeClass = 'bg-destructive/10 text-destructive border-destructive/20';
                  deltaLabel = `${isPositive ? '+' : ''}${m.pct.toFixed(1)}%`;
                  deltaIcon = <TrendingDown className="size-3" />;
                }
              }

              return (
                <div 
                  key={m.name}
                  className="border border-border/80 bg-muted/10 p-3.5 rounded-lg flex flex-col justify-between gap-1.5 transition-all hover:bg-muted/15"
                >
                  <div className="flex justify-between items-start gap-1.5">
                    <span className="font-semibold text-xs text-foreground">{m.name}</span>
                    <span className={`text-[9px] font-bold border rounded-full px-2 py-0.5 inline-flex items-center gap-1 ${deltaBadgeClass}`}>
                      {deltaIcon}
                      {deltaLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-1 pt-1.5 border-t border-dashed border-border/80">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider truncate">Base ({baseMonthName.split(' ')[0]})</span>
                      <span className="font-mono text-xs font-semibold text-foreground/80 mt-0.5">{formatINR(m.baseVal)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider truncate">Compare ({compareMonthName.split(' ')[0]})</span>
                      <span className="font-mono text-xs font-bold text-foreground mt-0.5">{formatINR(m.compareVal)}</span>
                    </div>
                  </div>

                  {!isZero && (
                    <div className="text-[10px] text-muted-foreground mt-1 flex justify-between">
                      <span>Variance:</span>
                      <span className={`font-mono font-semibold ${isHealthy ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                        {m.abs >= 0 ? '+' : ''}{formatINR(m.abs)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
