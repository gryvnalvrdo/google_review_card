"use client";

import React, { useState } from "react";

interface PriceStepperInputProps {
  id?: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  required?: boolean;
}

export function PriceStepperInput({
  id = "price",
  value,
  onChange,
  min = 0,
  max = 100000000,
  step = 5000,
  placeholder = "50000",
  required = true,
}: PriceStepperInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const handleStep = (delta: number) => {
    const cur = typeof value === "number" && !isNaN(value) ? value : 0;
    const next = Math.max(min, Math.min(max, cur + delta));
    onChange(next);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (raw === "") {
      onChange(0);
      return;
    }
    const num = parseInt(raw, 10);
    onChange(isNaN(num) ? 0 : Math.min(max, num));
  };

  const curValue = typeof value === "number" && !isNaN(value) ? value : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, width: "100%" }}>
      {/* Input Box with Integrated Dark Stepper */}
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          background: isFocused ? "rgba(22, 22, 34, 0.95)" : "rgba(255, 255, 255, 0.04)",
          border: isFocused ? "1.5px solid #8B5CF6" : "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: 8,
          overflow: "hidden",
          transition: "all 0.18s ease",
          boxShadow: isFocused ? "0 0 14px rgba(139, 92, 246, 0.25)" : "none",
        }}
      >
        {/* Left Badge: Rp */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "0 13px",
            background: isFocused ? "rgba(139, 92, 246, 0.22)" : "rgba(139, 92, 246, 0.12)",
            borderRight: "1px solid rgba(255, 255, 255, 0.08)",
            color: "#C4B5FD",
            fontWeight: 800,
            fontSize: "0.86rem",
            userSelect: "none",
            letterSpacing: "0.5px",
          }}
        >
          Rp
        </div>

        {/* Number Input */}
        <input
          id={id}
          type="number"
          step={step}
          min={min}
          max={max}
          value={curValue === 0 && !isFocused ? "" : curValue}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          required={required}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            color: "#F8FAFC",
            padding: "10px 14px",
            fontSize: "0.95rem",
            fontWeight: 700,
            outline: "none",
            width: "100%",
            letterSpacing: "0.5px",
          }}
        />

        {/* Custom Premium Stepper Buttons (Turun & Naik) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
            width: 38,
            flexShrink: 0,
            background: "rgba(15, 15, 24, 0.6)",
          }}
        >
          {/* Tombol Naik (+5000) */}
          <button
            type="button"
            onClick={() => handleStep(step)}
            aria-label={`Tambah Rp ${step.toLocaleString("id-ID")}`}
            title={`Tambah Rp ${step.toLocaleString("id-ID")} (Naik)`}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              color: "#C4B5FD",
              cursor: "pointer",
              fontSize: "0.65rem",
              padding: 0,
              transition: "all 0.12s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(139, 92, 246, 0.35)";
              e.currentTarget.style.color = "#FFFFFF";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#C4B5FD";
            }}
          >
            ▲
          </button>

          {/* Tombol Turun (-5000) */}
          <button
            type="button"
            onClick={() => handleStep(-step)}
            disabled={curValue <= min}
            aria-label={`Kurangi Rp ${step.toLocaleString("id-ID")}`}
            title={`Kurangi Rp ${step.toLocaleString("id-ID")} (Turun)`}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "none",
              color: curValue <= min ? "rgba(255, 255, 255, 0.2)" : "#C4B5FD",
              cursor: curValue <= min ? "not-allowed" : "pointer",
              fontSize: "0.65rem",
              padding: 0,
              transition: "all 0.12s ease",
            }}
            onMouseEnter={(e) => {
              if (curValue > min) {
                e.currentTarget.style.background = "rgba(139, 92, 246, 0.35)";
                e.currentTarget.style.color = "#FFFFFF";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = curValue <= min ? "rgba(255, 255, 255, 0.2)" : "#C4B5FD";
            }}
          >
            ▼
          </button>
        </div>
      </div>

      {/* Preset Chips & Format Real-Time */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
        <span
          style={{
            fontSize: "0.74rem",
            color: curValue > 0 ? "#34D399" : "var(--text-muted)",
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span>💵</span>
          <span>{curValue > 0 ? `Rp ${curValue.toLocaleString("id-ID")}` : "Rp 0"}</span>
        </span>

        {/* Quick Stepper Chips: Presets + Kenaikan 5.000 */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          {[50000, 75000, 100000].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 5,
                background: curValue === preset ? "rgba(139, 92, 246, 0.3)" : "rgba(255, 255, 255, 0.05)",
                border: curValue === preset ? "1px solid #8B5CF6" : "1px solid rgba(255, 255, 255, 0.1)",
                color: curValue === preset ? "#EDE9FE" : "var(--text-muted)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title={`Set ke Rp ${preset.toLocaleString("id-ID")}`}
            >
              {preset === 50000 ? "50k (Default)" : `${preset / 1000}k`}
            </button>
          ))}

          {/* Quick +5k & -5k Chips */}
          <button
            type="button"
            onClick={() => handleStep(step)}
            style={{
              fontSize: "0.68rem",
              fontWeight: 800,
              padding: "2px 8px",
              borderRadius: 5,
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              color: "#34D399",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            title={`Tambah Rp ${step.toLocaleString("id-ID")}`}
          >
            +{step / 1000}k
          </button>
          <button
            type="button"
            onClick={() => handleStep(-step)}
            disabled={curValue <= min}
            style={{
              fontSize: "0.68rem",
              fontWeight: 800,
              padding: "2px 8px",
              borderRadius: 5,
              background: curValue <= min ? "rgba(255, 255, 255, 0.03)" : "rgba(239, 68, 68, 0.15)",
              border: curValue <= min ? "1px solid rgba(255, 255, 255, 0.06)" : "1px solid rgba(239, 68, 68, 0.4)",
              color: curValue <= min ? "rgba(255, 255, 255, 0.25)" : "#F87171",
              cursor: curValue <= min ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
            }}
            title={`Kurangi Rp ${step.toLocaleString("id-ID")}`}
          >
            -{step / 1000}k
          </button>
        </div>
      </div>
    </div>
  );
}

