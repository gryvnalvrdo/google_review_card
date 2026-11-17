"use client";

import { useEffect, useState } from "react";
import { ChartBarItem, getNiceYScale } from "../_lib/analytics";

interface BarChartProps {
  data: ChartBarItem[];
  color?: string;
  yAxisUnit?: string;
  xAxisTitle?: string;
  showValue?: boolean;
  onBarClick?: (index: number, item: ChartBarItem) => void;
  selectedIndex?: number | null;
}

export default function BarChart({
  data,
  color = "#6366F1",
  yAxisUnit = "Tap",
  xAxisTitle = "",
  showValue = true,
  onBarClick,
  selectedIndex,
}: BarChartProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth <= 768);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const maxVal = Math.max(...data.map((d) => d.value), 0);
  const { niceMax, ticks } = getNiceYScale(maxVal);

  const isFewBars = data.length <= 8;
  const W = isMobile ? (isFewBars ? 400 : 520) : 1040;
  const H = isMobile ? 210 : 250;
  const PAD_L = isMobile ? 28 : 44;
  const PAD_R = isMobile ? 12 : 24;
  const PAD_T = isMobile ? 24 : 30;
  const PAD_B = 38;

  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const y0 = PAD_T + chartH;

  const slotW = data.length > 0 ? chartW / data.length : chartW;
  const barW = Math.max(
    Math.min(
      Math.floor(slotW * 0.62),
      isMobile ? (isFewBars ? 26 : 14) : isFewBars ? 44 : 32
    ),
    8
  );

  const valFontSize = isMobile ? (isFewBars ? 12 : 9.5) : isFewBars ? 12.5 : 11;
  const xLabelFontSize = isMobile ? (isFewBars ? 10 : 9) : 11;
  const xSubLabelFontSize = isMobile ? 8 : 9.5;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full min-w-[320px]"
        role="img"
        aria-label="Grafik Batang Aktivitas Tap"
      >
        <defs>
          <linearGradient id="currentPeakGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>

        {ticks.map((val) => {
          const y = y0 - (val / niceMax) * chartH;
          const isBaseline = val === 0;
          return (
            <g key={val}>
              {!isBaseline && (
                <line
                  x1={PAD_L}
                  y1={y}
                  x2={W - PAD_R}
                  y2={y}
                  stroke="rgba(255, 255, 255, 0.06)"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />
              )}
              <line
                x1={PAD_L - 4}
                y1={y}
                x2={PAD_L}
                y2={y}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth={1}
              />
              <text
                x={PAD_L - 7}
                y={y + 3.5}
                fill="#9BA3B4"
                fontSize={isMobile ? 9.5 : 10.5}
                fontWeight={600}
                fontFamily="var(--font-mono), ui-monospace, monospace"
                textAnchor="end"
              >
                {val}
              </text>
            </g>
          );
        })}

        <line
          x1={PAD_L}
          y1={PAD_T - 6}
          x2={PAD_L}
          y2={y0}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={1}
        />
        <text
          x={PAD_L - 6}
          y={PAD_T - 12}
          fill="#9BA3B4"
          fontSize={10}
          fontWeight={600}
          textAnchor="start"
        >
          {yAxisUnit}
        </text>

        <line
          x1={PAD_L}
          y1={y0}
          x2={W - PAD_R}
          y2={y0}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={1}
        />
        {xAxisTitle && !isMobile && (
          <text
            x={W - PAD_R}
            y={y0 + 16}
            fill="#667085"
            fontSize={9.5}
            fontWeight={600}
            textAnchor="end"
          >
            {xAxisTitle}
          </text>
        )}

        {data.map((d, i) => {
          const cx = PAD_L + i * slotW + slotW / 2;
          const bx = cx - barW / 2;
          const barH = d.value > 0 ? Math.max((d.value / niceMax) * chartH, 4) : 2;
          const by = y0 - barH;
          const isHighlight = Boolean(d.highlight);
          const isMaxVal = maxVal > 0 && d.value === maxVal;
          const isCurrentAndPeak = isHighlight && isMaxVal;
          const isPeakOnly = isMaxVal && !isHighlight;
          const isHighlightOnly = isHighlight && !isMaxVal;
          const isSelected = selectedIndex === i;
          const isClickable = Boolean(onBarClick);

          const barFill = isSelected
            ? "#38BDF8"
            : isCurrentAndPeak
            ? "url(#currentPeakGrad)"
            : isHighlightOnly
            ? "#10B981"
            : isPeakOnly
            ? "#F59E0B"
            : d.value === 0
            ? "rgba(255, 255, 255, 0.05)"
            : color;

          return (
            <g
              key={i}
              onClick={() => {
                if (onBarClick) onBarClick(i, d);
              }}
              style={{ cursor: isClickable ? "pointer" : "default" }}
            >
              <title>
                {d.tooltip || `${d.label || "Data"}: ${d.value} ${yAxisUnit.toLowerCase()}`}
              </title>

              {isClickable && (
                <rect
                  x={cx - slotW / 2}
                  y={PAD_T}
                  width={slotW}
                  height={chartH + PAD_B}
                  fill="transparent"
                />
              )}

              <rect
                x={bx}
                y={by}
                width={barW}
                height={barH}
                rx={Math.min(barW / 2, 4)}
                fill={barFill}
                stroke={isSelected ? "#E6EAF2" : undefined}
                strokeWidth={isSelected ? 1.5 : 0}
              />

              {showValue && d.value > 0 && (
                <text
                  x={cx}
                  y={by - 6}
                  fill={
                    isSelected
                      ? "#38BDF8"
                      : isCurrentAndPeak
                      ? "#FCD34D"
                      : isHighlightOnly
                      ? "#34D399"
                      : isPeakOnly
                      ? "#FBBF24"
                      : "#E6EAF2"
                  }
                  fontSize={valFontSize}
                  fontWeight={isMaxVal || isHighlight ? 700 : 600}
                  fontFamily="var(--font-mono), ui-monospace, monospace"
                  textAnchor="middle"
                >
                  {d.value}
                </text>
              )}

              {d.label && (
                <line
                  x1={cx}
                  y1={y0}
                  x2={cx}
                  y2={y0 + 4}
                  stroke={
                    isCurrentAndPeak || isHighlightOnly
                      ? "#10B981"
                      : isPeakOnly
                      ? "#F59E0B"
                      : "rgba(255,255,255,0.25)"
                  }
                  strokeWidth={1.25}
                />
              )}

              {isMobile && d.label && d.label.startsWith("Minggu ") ? (
                <>
                  <text
                    x={cx}
                    y={y0 + 14}
                    fill={
                      isHighlightOnly || isCurrentAndPeak
                        ? "#34D399"
                        : isPeakOnly
                        ? "#FBBF24"
                        : "#E6EAF2"
                    }
                    fontSize={10}
                    fontWeight={700}
                    textAnchor="middle"
                  >
                    {`M${d.label.replace("Minggu ", "").trim()}`}
                  </text>
                  {d.subLabel && (
                    <text
                      x={cx}
                      y={y0 + 25}
                      fill="#667085"
                      fontSize={8}
                      textAnchor="middle"
                    >
                      {d.mobileSubLabel || d.subLabel.split(" s/d ")[0] || d.subLabel}
                    </text>
                  )}
                </>
              ) : (
                <>
                  {d.label && (
                    <text
                      x={cx}
                      y={y0 + (d.subLabel ? 14 : 17)}
                      fill={
                        isHighlightOnly || isCurrentAndPeak
                          ? "#34D399"
                          : isPeakOnly
                          ? "#FBBF24"
                          : "#9BA3B4"
                      }
                      fontSize={xLabelFontSize}
                      fontWeight={isHighlight || isMaxVal ? 700 : 500}
                      textAnchor="middle"
                    >
                      {d.label}
                    </text>
                  )}
                  {d.subLabel && (
                    <text
                      x={cx}
                      y={y0 + 26}
                      fill="#667085"
                      fontSize={xSubLabelFontSize}
                      textAnchor="middle"
                    >
                      {d.subLabel}
                    </text>
                  )}
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
