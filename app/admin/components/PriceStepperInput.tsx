"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

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

  const formatNumber = (num: number | undefined | null): string => {
    if (num === undefined || num === null || Number.isNaN(num)) return "";
    return num.toLocaleString("id-ID");
  };

  const [displayValue, setDisplayValue] = useState<string>(() => {
    if (typeof value === "number" && !Number.isNaN(value)) {
      return formatNumber(value);
    }
    return "";
  });

  useEffect(() => {
    if (isFocused && displayValue === "" && value === 0) {
      return;
    }
    if (typeof value === "number" && !Number.isNaN(value)) {
      setDisplayValue(formatNumber(value));
    } else {
      setDisplayValue("");
    }
  }, [value, isFocused, displayValue]);

  const handleStep = (delta: number) => {
    const cur = typeof value === "number" && !Number.isNaN(value) ? value : 0;
    const next = Math.max(min, Math.min(max, cur + delta));
    setDisplayValue(formatNumber(next));
    onChange(next);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawDigits = e.target.value.replace(/\D/g, "");
    if (rawDigits === "") {
      setDisplayValue("");
      onChange(0);
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
      setDisplayValue("0");
      onChange(0);
    } else {
      const rawDigits = displayValue.replace(/\D/g, "");
      const num = rawDigits ? Math.min(max, parseInt(rawDigits, 10)) : 0;
      setDisplayValue(formatNumber(num));
      onChange(num);
    }
  };

  const curValue = typeof value === "number" && !Number.isNaN(value) ? value : 0;

  return (
    <div
      className={`flex w-full min-w-0 items-stretch overflow-hidden rounded-lg border transition-colors ${
        isFocused
          ? "border-indigo-500/70 bg-elevated ring-2 ring-indigo-500/20"
          : "border-hairline bg-elevated/70"
      }`}
    >
      <div className="flex shrink-0 select-none items-center border-r border-hairline bg-white/[0.03] px-2.5 text-xs font-semibold text-subtle">
        Rp
      </div>

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
        className="w-full min-w-0 flex-1 bg-transparent px-2.5 py-2.5 text-sm font-semibold tabular-nums text-ink outline-none placeholder:text-muted"
      />

      <div className="flex w-7 shrink-0 flex-col border-l border-hairline bg-white/[0.02]">
        <button
          type="button"
          onClick={() => handleStep(step)}
          aria-label={`Tambah Rp ${step.toLocaleString("id-ID")}`}
          title={`Tambah Rp ${step.toLocaleString("id-ID")}`}
          className="flex flex-1 items-center justify-center border-b border-hairline text-subtle transition-colors hover:bg-white/[0.08] hover:text-ink"
        >
          <ChevronUp className="h-3 w-3" strokeWidth={2.5} />
        </button>

        <button
          type="button"
          onClick={() => handleStep(-step)}
          disabled={curValue <= min}
          aria-label={`Kurangi Rp ${step.toLocaleString("id-ID")}`}
          title={`Kurangi Rp ${step.toLocaleString("id-ID")}`}
          className="flex flex-1 items-center justify-center text-subtle transition-colors hover:bg-white/[0.08] hover:text-ink disabled:cursor-not-allowed disabled:opacity-25"
        >
          <ChevronDown className="h-3 w-3" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
