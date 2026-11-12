"use client";

import React, { useState, useEffect } from "react";

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
  placeholder = "50.000",
  required = true,
}: PriceStepperInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  // Format angka ke format ribuan bertitik Indonesia: misal 45000 -> "45.000"
  const formatNumber = (num: number | undefined | null): string => {
    if (num === undefined || num === null || isNaN(num)) return "";
    return num.toLocaleString("id-ID");
  };

  const [displayValue, setDisplayValue] = useState<string>(() => {
    if (typeof value === "number" && !isNaN(value)) {
      return formatNumber(value);
    }
    return "";
  });

  // Sinkronisasi displayValue saat prop value dari luar berubah
  useEffect(() => {
    // Jika input sedang difokuskan oleh pengguna dan input sengaja dikosongkan (ingin dihapus),
    // jangan paksa kembali angka "0" agar pengguna bisa leluasa mengetik angka baru
    if (isFocused && displayValue === "" && value === 0) {
      return;
    }
    if (typeof value === "number" && !isNaN(value)) {
      setDisplayValue(formatNumber(value));
    } else {
      setDisplayValue("");
    }
  }, [value, isFocused]);

  const handleStep = (delta: number) => {
    const cur = typeof value === "number" && !isNaN(value) ? value : 0;
    const next = Math.max(min, Math.min(max, cur + delta));
    setDisplayValue(formatNumber(next));
    onChange(next);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawDigits = e.target.value.replace(/\D/g, "");
    if (rawDigits === "") {
      // Pengguna menghapus semua angka di input
      setDisplayValue("");
      onChange(0); // Jika tidak memasukkan apa-apa, tersimpan otomatis sebagai 0
      return;
    }
    const num = Math.min(max, parseInt(rawDigits, 10));
    setDisplayValue(formatNumber(num));
    onChange(num);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    e.target.select();
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (displayValue === "") {
      // Saat kursor keluar dan input kosong, tampilkan "0" dan pastikan nilainya 0
      setDisplayValue("0");
      onChange(0);
    } else {
      const rawDigits = displayValue.replace(/\D/g, "");
      const num = rawDigits ? Math.min(max, parseInt(rawDigits, 10)) : 0;
      setDisplayValue(formatNumber(num));
      onChange(num);
    }
  };

  const curValue = typeof value === "number" && !isNaN(value) ? value : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, width: "100%", minWidth: 0 }}>
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
          width: "100%",
          minWidth: 0,
        }}
      >
        {/* Left Badge: Rp */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "0 8px",
            background: isFocused ? "rgba(139, 92, 246, 0.22)" : "rgba(139, 92, 246, 0.12)",
            borderRight: "1px solid rgba(255, 255, 255, 0.08)",
            color: "#C4B5FD",
            fontWeight: 800,
            fontSize: "0.78rem",
            userSelect: "none",
            letterSpacing: "0.3px",
            flexShrink: 0,
          }}
        >
          Rp
        </div>

        {/* Text Input with Thousands Formatter */}
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          style={{
            flex: "1 1 0%",
            minWidth: 0,
            background: "transparent",
            border: "none",
            color: "#F8FAFC",
            padding: "9px 6px",
            fontSize: "0.85rem",
            fontWeight: 700,
            outline: "none",
            width: "100%",
            letterSpacing: "0.3px",
            boxSizing: "border-box",
          }}
        />

        {/* Custom Premium Stepper Buttons (Turun & Naik) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
            width: 26,
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
              fontSize: "0.6rem",
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
              fontSize: "0.6rem",
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
    </div>
  );
}

