"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useId, type ReactNode } from "react";
import { springs } from "@/components/motion/presets";
import { cn } from "@/lib/utils/cn";

/**
 * Selectable card. Renders a real checkbox or radio button (visually hidden)
 * so keyboard, screen reader and form semantics come for free.
 */
export function ChoiceCard({
  type,
  name,
  checked,
  onChange,
  title,
  description,
  icon,
  disabled,
  className,
}: {
  type: "radio" | "checkbox";
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "group relative flex cursor-pointer items-start gap-3.5 rounded-panel border p-4 transition-[border-color,background-color,box-shadow] duration-200",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-cyan-400",
        checked
          ? "border-blue-400/60 bg-blue-500/[0.09] shadow-[0_0_0_1px_rgb(91_146_255/0.25),0_12px_32px_-18px_rgb(59_123_255/0.8)]"
          : "border-line-strong bg-ink-900/50 hover:border-blue-400/30 hover:bg-ink-850/80",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      {icon && (
        <span
          className={cn(
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-control transition-colors",
            checked ? "bg-blue-500/20 text-blue-300" : "bg-white/[0.05] text-fg-subtle group-hover:text-fg-muted",
          )}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-medium text-fg">{title}</span>
        {description && <span className="mt-0.5 block text-[0.8125rem] leading-snug text-fg-muted">{description}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center border transition-colors",
          type === "radio" ? "rounded-full" : "rounded-[0.375rem]",
          checked ? "border-blue-400 bg-blue-500" : "border-line-strong bg-transparent",
        )}
      >
        {checked && (
          <motion.span
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={springs.snappy}
          >
            <Check className="size-3.5 text-white" strokeWidth={3} />
          </motion.span>
        )}
      </span>
    </label>
  );
}

/** Compact single-choice pills (age, year, confidence, board). */
export function ChipGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
  error,
  allowDeselect = false,
  size = "md",
}: {
  label: string;
  options: readonly { value: T; label: string; disabled?: boolean }[];
  value: T | null | undefined;
  onChange: (value: T | null) => void;
  error?: string;
  allowDeselect?: boolean;
  size?: "sm" | "md";
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className={cn("mb-2.5 font-medium text-fg", size === "sm" ? "text-[0.8125rem]" : "text-sm")}>
        {label}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <label
              key={String(o.value)}
              className={cn(
                "relative inline-flex cursor-pointer items-center rounded-full border transition-[border-color,background-color,color] duration-150",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-cyan-400",
                size === "sm" ? "h-8 px-3 text-[0.8125rem]" : "h-10 px-4 text-sm",
                selected
                  ? "border-blue-400/70 bg-blue-500/15 text-fg"
                  : "border-line-strong bg-ink-900/40 text-fg-muted hover:border-blue-400/30 hover:text-fg",
                o.disabled && "pointer-events-none opacity-40",
              )}
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={selected}
                disabled={o.disabled}
                onChange={() => onChange(o.value)}
                onClick={() => {
                  if (allowDeselect && selected) onChange(null);
                }}
              />
              {o.label}
            </label>
          );
        })}
      </div>
      {error && <p className="mt-2 text-[0.8125rem] text-danger">{error}</p>}
    </fieldset>
  );
}
