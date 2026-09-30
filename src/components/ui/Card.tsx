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
                "rounded-2xl border border-slate-200 bg-white shadow-sm",
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
        <div className={cn("border-b border-slate-100 px-6 py-4", className)} {...props}>
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
