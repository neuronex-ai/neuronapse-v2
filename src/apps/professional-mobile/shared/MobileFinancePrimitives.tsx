/* eslint-disable react-refresh/only-export-components */
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

export const mobileFinanceSurface =
  "rounded-[22px] border border-border/32 bg-card/72 shadow-[0_18px_54px_-42px_rgba(0,0,0,0.78)] backdrop-blur-xl dark:border-white/[0.055] dark:bg-white/[0.026]";

export const mobileFinanceInputClassName =
  "mt-2 h-[52px] rounded-[17px] border-border/50 bg-card px-4 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-foreground/12";

export const formatMoney = (value: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));

export const parseMoney = (value: string) => {
  const normalized = value
    .replace(/\s/g, "")
    .replace(/[R$r$]/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

type Tone = "default" | "dark" | "success" | "warning" | "danger";

const toneStyles: Record<Tone, { surface: string; icon: string; text: string; muted: string }> = {
  default: {
    surface: "border-border/32 bg-card/72 text-foreground dark:border-white/[0.055] dark:bg-white/[0.026]",
    icon: "bg-foreground/[0.045] text-muted-foreground",
    text: "text-foreground",
    muted: "text-muted-foreground/68",
  },
  dark: {
    surface: "border-foreground bg-foreground text-background",
    icon: "bg-background/10 text-background",
    text: "text-background",
    muted: "text-background/62",
  },
  success: {
    surface: "border-border/32 bg-card/72 text-foreground dark:border-white/[0.055] dark:bg-white/[0.026]",
    icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    text: "text-foreground",
    muted: "text-muted-foreground/68",
  },
  warning: {
    surface: "border-border/32 bg-card/72 text-foreground dark:border-white/[0.055] dark:bg-white/[0.026]",
    icon: "bg-amber-500/10 text-amber-700 dark:text-amber-200",
    text: "text-foreground",
    muted: "text-muted-foreground/68",
  },
  danger: {
    surface: "border-border/32 bg-card/72 text-foreground dark:border-white/[0.055] dark:bg-white/[0.026]",
    icon: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
    text: "text-foreground",
    muted: "text-muted-foreground/68",
  },
};

export function MobileEyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/58", className)}>
      {children}
    </p>
  );
}

export function MobilePageTitle({
  eyebrow: _eyebrow,
  title: _title,
  description: _description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return action ? <div className="flex justify-end">{action}</div> : null;
}

export function MobileFinanceTabs<T extends string>({
  value,
  options,
  onValueChange,
  className,
}: {
  value: T;
  options: Array<{ value: T; label: string; description?: string; icon: LucideIcon }>;
  onValueChange: (value: T) => void;
  className?: string;
}) {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const indicatorWidth = `calc((100% - 0.5rem - ${(options.length - 1) * 0.25}rem) / ${options.length})`;

  return (
    <div
      role="tablist"
      aria-label="Areas do financeiro"
      className={cn(
        "relative grid gap-1 rounded-[18px] border border-border/36 bg-background/76 p-1 shadow-[0_12px_34px_-28px_rgba(0,0,0,0.7)] backdrop-blur-xl dark:border-white/[0.055] dark:bg-white/[0.04]",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="absolute bottom-1 left-1 top-1 rounded-[14px] bg-foreground shadow-sm motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out"
        style={{
          width: indicatorWidth,
          transform: `translateX(calc(${activeIndex} * (100% + 0.25rem)))`,
        }}
      />
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "relative z-10 flex min-h-[52px] min-w-0 items-center gap-2 rounded-[14px] px-3 text-left transition-colors active:opacity-80",
              active ? "text-background" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] transition-colors",
                active ? "bg-background/10" : "bg-foreground/[0.045]",
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[10px] font-black uppercase tracking-[0.1em]">
                {option.label}
              </span>
              {option.description ? (
                <span className={cn("mt-0.5 block truncate text-[8px] font-medium", active ? "opacity-55" : "text-muted-foreground/60")}>
                  {option.description}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function MobileFinanceButton({
  children,
  className,
  variant = "primary",
  loading = false,
  disabled,
  type = "button",
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "light" | "danger";
  loading?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-[15px] px-4 text-[9px] font-black uppercase tracking-[0.14em] transition active:scale-[0.985] disabled:pointer-events-none disabled:opacity-45",
        variant === "primary" && "bg-foreground text-background shadow-sm",
        variant === "secondary" && "border border-border/36 bg-card/78 text-foreground dark:border-white/[0.055] dark:bg-white/[0.035]",
        variant === "ghost" && "bg-transparent text-muted-foreground active:bg-foreground/[0.045]",
        variant === "light" && "bg-background text-foreground hover:bg-background/90",
        variant === "danger" && "border border-rose-500/20 bg-rose-500/[0.07] text-rose-600 dark:text-rose-300",
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function MobileFinanceIconButton({
  icon: Icon,
  label,
  className,
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] border border-border/36 bg-card/78 text-foreground transition active:scale-95 dark:border-white/[0.055] dark:bg-white/[0.035]",
        className,
      )}
      {...props}
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}

export function MobileFinanceHero({
  eyebrow,
  title,
  value,
  description,
  icon: Icon,
  tone = "dark",
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  value: string;
  description?: string;
  icon?: LucideIcon;
  tone?: Tone;
  action?: ReactNode;
  children?: ReactNode;
}) {
  const styles = toneStyles[tone];

  return (
    <section className={cn("overflow-hidden rounded-[24px] border p-4", styles.surface)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {Icon ? (
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]", styles.icon)}>
              <Icon className="h-[18px] w-[18px]" />
            </div>
          ) : null}
          <div className="min-w-0">
            <p className={cn("truncate text-[8px] font-black uppercase tracking-[0.17em]", styles.muted)}>
              {eyebrow}
            </p>
            <p className={cn("mt-1 truncate text-[12px] font-black tracking-[-0.02em]", styles.text)}>
              {title}
            </p>
          </div>
        </div>
        {action}
      </div>
      <p className={cn("mt-5 break-words text-[2.25rem] font-black leading-none tracking-[-0.065em]", styles.text)}>
        {value}
      </p>
      {description ? (
        <p className={cn("mt-2 text-[11px] font-medium leading-relaxed", styles.muted)}>
          {description}
        </p>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

export function MobileMetricCard({
  label,
  value,
  caption,
  icon: Icon,
  emphasis = false,
  tone = emphasis ? "dark" : "default",
  onClick,
}: {
  label: string;
  value: string;
  caption?: string;
  icon: LucideIcon;
  emphasis?: boolean;
  tone?: Tone;
  onClick?: () => void;
}) {
  const styles = toneStyles[tone];
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-[13px]", styles.icon)}>
          <Icon className="h-4 w-4" />
        </div>
        {onClick ? <ArrowRight className="mt-1 h-3.5 w-3.5 opacity-35" /> : null}
      </div>
      <p className={cn("mt-5 text-[8px] font-black uppercase tracking-[0.15em]", styles.muted)}>
        {label}
      </p>
      <p className={cn("mt-1 break-words text-[1.18rem] font-black leading-tight tracking-[-0.04em]", styles.text)}>
        {value}
      </p>
      {caption ? <p className={cn("mt-1 line-clamp-2 text-[10px] font-medium leading-relaxed", styles.muted)}>{caption}</p> : null}
    </>
  );

  const classes = cn("min-h-[132px] rounded-[20px] border p-3.5 text-left", styles.surface, onClick && "transition active:scale-[0.99]");

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {content}
      </button>
    );
  }

  return <article className={classes}>{content}</article>;
}

export function MobileActionButton({
  label,
  description,
  icon: Icon,
  onClick,
  disabled = false,
  badge,
  tone = "default",
}: {
  label: string;
  description?: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  badge?: string;
  tone?: Tone;
}) {
  const styles = toneStyles[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-h-[106px] flex-col items-start justify-between rounded-[20px] border p-3.5 text-left transition active:scale-[0.985]",
        styles.surface,
        disabled && "cursor-not-allowed opacity-45",
      )}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-[13px]", styles.icon)}>
          <Icon className="h-4 w-4" />
        </div>
        {badge ? (
          <span className={cn("rounded-full px-2 py-1 text-[7px] font-black uppercase tracking-[0.11em]", tone === "dark" ? "bg-background/10 text-background/68" : "bg-foreground/[0.055] text-muted-foreground")}>
            {badge}
          </span>
        ) : null}
      </div>
      <div className="mt-3">
        <p className={cn("text-[13px] font-black tracking-[-0.015em]", styles.text)}>{label}</p>
        {description ? (
          <p className={cn("mt-1 line-clamp-2 text-[10px] font-medium leading-relaxed", styles.muted)}>{description}</p>
        ) : null}
      </div>
    </button>
  );
}

export function MobileSectionTitle({
  title,
  description,
  trailing,
}: {
  title: string;
  description?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[17px] font-black tracking-[-0.035em] text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 text-[11px] font-medium leading-relaxed text-muted-foreground/68">{description}</p>
        ) : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

export function MobileFinanceInsightStrip({
  items,
}: {
  items: Array<{ label: string; value: string; icon: LucideIcon; tone?: Tone }>;
}) {
  return (
    <div className="-mx-5 overflow-x-auto pb-1 no-scrollbar">
      <div className="flex min-w-max gap-2.5 px-5">
        {items.map((item) => {
          const Icon = item.icon;
          const tone = item.tone || "default";
          const styles = toneStyles[tone];

          return (
            <div key={`${item.label}-${item.value}`} className={cn("flex w-[9.75rem] items-center gap-3 rounded-[18px] border p-3", styles.surface)}>
              <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]", styles.icon)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className={cn("truncate text-[8px] font-black uppercase tracking-[0.13em]", styles.muted)}>{item.label}</p>
                <p className={cn("mt-0.5 truncate text-[13px] font-black tracking-[-0.025em]", styles.text)}>{item.value}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MobileFinanceListRow({
  icon: Icon,
  title,
  description,
  meta,
  value,
  tone = "default",
  status,
  onClick,
  valueMuted = false,
  disabled = false,
  trailing,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  meta?: string;
  value?: string;
  tone?: Tone;
  status?: string;
  onClick?: () => void;
  valueMuted?: boolean;
  disabled?: boolean;
  trailing?: ReactNode;
  className?: string;
}) {
  const styles = toneStyles[tone];
  const content = (
    <>
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px]", styles.icon)}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-[13px] font-black tracking-[-0.015em] text-foreground">{title}</p>
          {status ? (
            <span className="shrink-0 rounded-full bg-foreground/[0.052] px-1.5 py-0.5 text-[6px] font-black uppercase tracking-[0.1em] text-muted-foreground">
              {status}
            </span>
          ) : null}
        </div>
        {description ? <p className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-relaxed text-muted-foreground/68">{description}</p> : null}
        {meta ? <p className="mt-1 text-[8px] font-black uppercase tracking-[0.1em] text-muted-foreground/48">{meta}</p> : null}
      </div>
      {value ? (
        <p className={cn("shrink-0 text-right text-[12px] font-black tracking-[-0.01em]", valueMuted ? "text-muted-foreground" : styles.text)}>
          {value}
        </p>
      ) : trailing ? (
        trailing
      ) : onClick ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30" />
      ) : null}
    </>
  );

  const classes = cn(
    "flex w-full items-center gap-3 rounded-[20px] border border-border/32 bg-card/72 p-3.5 text-left dark:border-white/[0.055] dark:bg-white/[0.026]",
    onClick && "transition active:bg-foreground/[0.045]",
    disabled && "cursor-not-allowed opacity-45",
    className,
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={classes}>
        {content}
      </button>
    );
  }

  return <article className={classes}>{content}</article>;
}

export function MobileActionListItem({
  icon,
  title,
  description,
  status,
  onClick,
  disabled = false,
  destructive = false,
  trailing,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  status?: string;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <MobileFinanceListRow
      icon={icon}
      title={title}
      description={description}
      status={status}
      tone={destructive ? "danger" : "default"}
      onClick={onClick}
      disabled={disabled}
      trailing={trailing}
      className={className}
    />
  );
}

export function MobileEmptyState({
  title,
  description,
  icon: Icon,
  action,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div className={cn(mobileFinanceSurface, "px-5 py-9 text-center")}>
      {Icon ? (
        <div className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-[18px] bg-foreground/[0.045] text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
      ) : null}
      <p className={cn("text-sm font-black tracking-[-0.02em] text-foreground", Icon && "mt-4")}>{title}</p>
      <p className="mx-auto mt-2 max-w-[260px] text-xs font-medium leading-relaxed text-muted-foreground/68">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function MobileFinanceSheet({
  open,
  onOpenChange,
  eyebrow,
  title,
  description,
  icon: Icon,
  children,
  footer,
  contentClassName,
  bodyClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eyebrow?: string;
  title?: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
  footer?: ReactNode;
  contentClassName?: string;
  bodyClassName?: string;
}) {
  const hasHeader = Boolean(title || eyebrow || description || Icon);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className={cn(
          "[&>div:first-child]:hidden z-[120] flex h-[min(92dvh,46rem)] max-h-[92dvh] overflow-hidden rounded-t-[30px] border-border/32 bg-background p-0 shadow-2xl dark:border-white/[0.055]",
          contentClassName,
        )}
      >
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-foreground/14" />
        {hasHeader ? (
          <header className="shrink-0 px-5 pb-4 pt-5">
            <div className="flex items-start gap-3">
              {Icon ? (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] border border-border/32 bg-card/72 dark:border-white/[0.055] dark:bg-white/[0.026]">
                  <Icon className="h-5 w-5" />
                </div>
              ) : null}
              <div className="min-w-0">
                {eyebrow ? <MobileEyebrow>{eyebrow}</MobileEyebrow> : null}
                {title ? <h2 className="mt-1 text-2xl font-black leading-none tracking-[-0.05em] text-foreground">{title}</h2> : null}
                {description ? <p className="mt-2 text-xs font-medium leading-relaxed text-muted-foreground/70">{description}</p> : null}
              </div>
            </div>
          </header>
        ) : null}
        <div
          className={cn(
            "mobile-scroll-owner min-h-0 flex-1 overflow-y-auto overscroll-contain px-5",
            footer ? "pb-5" : "pb-[calc(24px+env(safe-area-inset-bottom))]",
            bodyClassName,
          )}
        >
          {children}
        </div>
        {footer ? (
          <footer className="shrink-0 border-t border-border/32 bg-background/94 px-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl dark:border-white/[0.055]">
            {footer}
          </footer>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

export function MobileFinanceField({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground/62">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-2 block text-[10px] font-medium leading-relaxed text-muted-foreground/62">{hint}</span> : null}
    </label>
  );
}

export function MobileFinanceSelect({
  className,
  ...props
}: ComponentPropsWithoutRef<"select">) {
  return (
    <select
      className={cn(
        mobileFinanceInputClassName,
        "w-full appearance-none",
        className,
      )}
      {...props}
    />
  );
}

export function MobileFinanceSuccess({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="py-7 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[19px] bg-foreground text-background">
        <CheckCircle2 className="h-6 w-6" />
      </div>
      <MobileEyebrow className="mt-6">{eyebrow}</MobileEyebrow>
      <h2 className="mt-2 text-2xl font-black tracking-[-0.05em] text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-[18rem] text-xs font-medium leading-relaxed text-muted-foreground/68">
        {description}
      </p>
      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  );
}
