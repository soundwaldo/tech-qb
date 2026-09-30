import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

export function Card({
    className,
    children,
    ...props
}: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                "rounded-2xl border border-white/10 bg-slate-900/70 shadow-sm text-slate-100",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}

export function CardHeader({
    className,
    children,
    ...props
}: HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={cn("border-b border-white/10 px-6 py-4", className)} {...props}>
            {children}
        </div>
    );
}

export function CardBody({
    className,
    children,
    ...props
}: HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={cn("px-6 py-5", className)} {...props}>
            {children}
        </div>
    );
}
