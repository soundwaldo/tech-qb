import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef, useId } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, hint, id, ...props }, ref) => {
        const generatedId = useId();
        const inputId = id || generatedId;
        return <div className="w-full">
            {label && (
                <label
                    htmlFor={inputId}
                    className="mb-1.5 block text-sm font-medium text-slate-300"
                >
                    {label}
                </label>
            )}
            <input
                ref={ref}
                id={inputId}
                className={cn(
                    "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20",
                    error && "border-red-400 focus:border-red-500 focus:ring-red-500/20",
                    className
                )}
                {...props}
            />
            {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
            {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>;
    }
);
Input.displayName = "Input";
