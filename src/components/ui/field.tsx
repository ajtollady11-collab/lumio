"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils/cn";

type FieldProps = Omit<ComponentProps<"input">, "id"> & {
  label: string;
  hint?: string;
  error?: string;
};

const inputClasses =
  "h-12 w-full rounded-control border bg-ink-900/70 px-4 text-[0.9375rem] text-fg placeholder:text-fg-subtle " +
  "transition-[border-color,box-shadow] duration-200 outline-none " +
  "focus:border-blue-400/70 focus:shadow-[0_0_0_4px_rgb(59_123_255/0.18)]";

export function TextField({ label, hint, error, className, ...props }: FieldProps) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(inputClasses, error ? "border-danger/60" : "border-line-strong")}
        {...props}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="text-[0.8125rem] text-fg-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-[0.8125rem] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function PasswordField({ label, hint, error, className, ...props }: FieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(inputClasses, "pr-12", error ? "border-danger/60" : "border-line-strong")}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-1 my-auto flex size-10 items-center justify-center rounded-[0.625rem] text-fg-subtle transition-colors hover:text-fg"
        >
          {visible ? <EyeOff className="size-[1.125rem]" /> : <Eye className="size-[1.125rem]" />}
        </button>
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="text-[0.8125rem] text-fg-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-[0.8125rem] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
