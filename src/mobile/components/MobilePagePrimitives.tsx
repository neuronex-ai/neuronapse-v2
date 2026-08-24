"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Info,
  Loader2,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { MobileLayout } from "./MobileLayout";

export interface MobilePageScaffoldProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  showNavigation?: boolean;
  showBottomNavigation?: boolean;
  immersive?: boolean;
}

export const MobilePageScaffold = ({
  children,
  className,
  contentClassName,
  showNavigation = true,
  showBottomNavigation = true,
  immersive = false,
}: MobilePageScaffoldProps) => {
  const navigationVisible = immersive ? false : showNavigation;
  const bottomNavigationVisible = immersive ? false : showBottomNavigation;

  return (
    <MobileLayout
      showNav={navigationVisible}
      showBottomNav={bottomNavigationVisible}
      className={cn("bg-background", className)}
    >
      <div
        className={cn(
          "mobile-scroll-owner h-full min-h-0 overflow-y-auto overflow-x-hidden px-4",
          bottomNavigationVisible
            ? "pb-6"
            : "pb-[calc(1rem+env(safe-area-inset-bottom))]",
          contentClassName,
        )}
      >
        {children}
      </div>
    </MobileLayout>
  );
};

interface MobilePageHeaderProps {
  title: string;
  eyebrow?: string;
  description?: string;
  leading?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export const MobilePageHeader = ({
  title,
  eyebrow,
  description,
  leading,
  actions,
  className,
}: MobilePageHeaderProps) => (
  <header
    data-mobile-page-header="true"
    className={cn("flex items-start justify-between gap-3 pb-4 pt-2", className)}
  >
    <div className="flex min-w-0 items-start gap-2.5">
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[8px] font-black uppercase tracking-[0.18em] text-muted-foreground/60">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 text-[1.8rem] font-black leading-[0.94] tracking-[-0.052em] text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-[20rem] text-xs font-medium leading-relaxed text-muted-foreground/70">
            {description}
          </p>
        ) : null}
      </div>
    </div>
    {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
  </header>
);

interface MobileSectionHeaderProps {
  title: string;
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export const MobileSectionHeader = ({
  title,
  eyebrow,
  description,
  action,
  className,
}: MobileSectionHeaderProps) => (
  <div className={cn("flex items-end justify-between gap-3", className)}>
    <div className="min-w-0">
      {eyebrow ? (
        <p className="text-[7px] font-black uppercase tracking-[0.18em] text-muted-foreground/55">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-1 text-[1.05rem] font-black tracking-[-0.03em] text-foreground">{title}</h2>
      {description ? (
        <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-muted-foreground/68">{description}</p>
      ) : null}
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
);

export interface MobileSegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  badge?: string | number;
}

interface MobileSegmentedControlProps<T extends string> {
  value: T;
  options: MobileSegmentedOption<T>[];
  onValueChange: (value: T) => void;
  className?: string;
  ariaLabel: string;
}

export const MobileSegmentedControl = <T extends string>({
  value,
  options,
  onValueChange,
  className,
  ariaLabel,
}: MobileSegmentedControlProps<T>) => (
  <div
    role="tablist"
    aria-label={ariaLabel}
    className={cn(
      "grid gap-1 rounded-[17px] border border-border/45 bg-foreground/[0.028] p-1 dark:border-white/10 dark:bg-white/[0.03]",
      className,
    )}
    style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
  >
    {options.map((option) => {
      const Icon = option.icon;
      const active = option.value === value;

      return (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onValueChange(option.value)}
          className={cn(
            "flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-[13px] px-2 text-[8px] font-black uppercase tracking-[0.09em] transition-colors active:opacity-80",
            active
              ? "bg-foreground text-background shadow-sm"
              : "text-muted-foreground active:bg-foreground/[0.05] dark:active:bg-white/[0.05]",
          )}
        >
          {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" /> : null}
          <span className="truncate">{option.label}</span>
          {option.badge !== undefined ? (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[7px]",
                active ? "bg-background/15 text-background" : "bg-foreground/[0.06] text-muted-foreground",
              )}
            >
              {option.badge}
            </span>
          ) : null}
        </button>
      );
    })}
  </div>
);

type MobileStatusVariant = "info" | "success" | "warning" | "error";

const statusStyles: Record<MobileStatusVariant, { icon: LucideIcon; className: string }> = {
  info: {
    icon: Info,
    className: "border-blue-500/18 bg-blue-500/[0.065] text-blue-700 dark:text-blue-300",
  },
  success: {
    icon: CheckCircle2,
    className: "border-emerald-500/18 bg-emerald-500/[0.065] text-emerald-700 dark:text-emerald-300",
  },
  warning: {
    icon: TriangleAlert,
    className: "border-amber-500/18 bg-amber-500/[0.065] text-amber-700 dark:text-amber-300",
  },
  error: {
    icon: AlertCircle,
    className: "border-red-500/18 bg-red-500/[0.065] text-red-700 dark:text-red-300",
  },
};

interface MobileStatusBannerProps {
  title: string;
  description?: string;
  variant?: MobileStatusVariant;
  action?: ReactNode;
  className?: string;
}

export const MobileStatusBanner = ({
  title,
  description,
  variant = "info",
  action,
  className,
}: MobileStatusBannerProps) => {
  const config = statusStyles[variant];
  const Icon = config.icon;

  return (
    <div className={cn("rounded-[18px] border p-3.5", config.className, className)}>
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black tracking-[-0.01em]">{title}</p>
          {description ? <p className="mt-1 text-[10px] font-medium leading-relaxed opacity-75">{description}</p> : null}
          {action ? <div className="mt-2.5">{action}</div> : null}
        </div>
      </div>
    </div>
  );
};

interface MobileEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export const MobileEmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  className,
}: MobileEmptyStateProps) => (
  <div className={cn("flex min-h-[240px] flex-col items-center justify-center px-4 text-center", className)}>
    <div className="flex h-16 w-16 items-center justify-center rounded-[21px] border border-border/40 bg-foreground/[0.03] dark:border-white/10 dark:bg-white/[0.03]">
      <Icon className="h-7 w-7 text-muted-foreground/45" />
    </div>
    <h3 className="mt-4 text-lg font-black tracking-[-0.035em] text-foreground">{title}</h3>
    <p className="mt-2 max-w-[18rem] text-xs font-medium leading-relaxed text-muted-foreground/68">{description}</p>
    {action ? <div className="mt-4">{action}</div> : null}
  </div>
);

interface MobileErrorStateProps {
  title?: string;
  description: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export const MobileErrorState = ({
  title = "Não foi possível carregar",
  description,
  onRetry,
  retryLabel = "Tentar novamente",
  className,
}: MobileErrorStateProps) => (
  <div className={cn("flex min-h-[240px] flex-col items-center justify-center px-4 text-center", className)}>
    <div className="flex h-16 w-16 items-center justify-center rounded-[21px] border border-red-500/20 bg-red-500/[0.07]">
      <AlertCircle className="h-7 w-7 text-red-500" />
    </div>
    <h3 className="mt-4 text-lg font-black tracking-[-0.035em] text-foreground">{title}</h3>
    <p className="mt-2 max-w-[19rem] text-xs font-medium leading-relaxed text-muted-foreground/68">{description}</p>
    {onRetry ? (
      <Button onClick={onRetry} variant="outline" className="mt-4 h-11 rounded-xl px-5 text-[8px] font-black uppercase tracking-[0.14em]">
        <RefreshCw className="mr-2 h-4 w-4" />
        {retryLabel}
      </Button>
    ) : null}
  </div>
);

interface MobileSkeletonCardProps {
  lines?: number;
  className?: string;
}

export const MobileSkeletonCard = ({ lines = 3, className }: MobileSkeletonCardProps) => (
  <div data-mobile-compact-card="true" className={cn("rounded-[22px] border border-border/35 bg-card/70 p-4 dark:border-white/10 dark:bg-white/[0.028]", className)}>
    <div className="flex items-center gap-3">
      <Skeleton className="h-10 w-10 rounded-[14px]" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
    <div className="mt-4 space-y-2.5">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className={cn("h-2.5", index === lines - 1 ? "w-3/5" : "w-full")} />
      ))}
    </div>
  </div>
);

interface MobileStickyActionsProps {
  children: ReactNode;
  className?: string;
  aboveBottomNavigation?: boolean;
}

export const MobileStickyActions = ({
  children,
  className,
  aboveBottomNavigation = true,
}: MobileStickyActionsProps) => (
  <div
    data-mobile-sticky-actions="true"
    className={cn(
      "fixed left-0 right-0 z-[85] border-t border-border/40 bg-background/92 px-4 pt-2.5 backdrop-blur-xl dark:border-white/10",
      aboveBottomNavigation
        ? "bottom-[calc(4.85rem+env(safe-area-inset-bottom))] pb-2.5"
        : "bottom-0 pb-[calc(0.65rem+env(safe-area-inset-bottom))]",
      className,
    )}
  >
    <div className="mx-auto flex max-w-lg items-center gap-2.5">{children}</div>
  </div>
);

interface MobileActionListItemProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  status?: string;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  trailing?: ReactNode;
  className?: string;
}

export const MobileActionListItem = ({
  icon: Icon,
  title,
  description,
  status,
  onClick,
  disabled = false,
  destructive = false,
  trailing,
  className,
}: MobileActionListItemProps) => {
  const Component = onClick ? "button" : "div";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      data-mobile-compact-card="true"
      className={cn(
        "flex w-full items-center gap-3 rounded-[20px] border border-border/40 bg-card/72 p-3.5 text-left transition-colors dark:border-white/10 dark:bg-white/[0.028]",
        onClick && "active:bg-foreground/[0.045] dark:active:bg-white/[0.05]",
        disabled && "cursor-not-allowed opacity-45",
        destructive && "border-red-500/20 bg-red-500/[0.045]",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-foreground/[0.042] text-muted-foreground",
          destructive && "bg-red-500/10 text-red-500",
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className={cn("truncate text-[13px] font-black tracking-[-0.012em] text-foreground", destructive && "text-red-500")}>{title}</p>
          {status ? (
            <span className="shrink-0 rounded-full bg-foreground/[0.052] px-1.5 py-0.5 text-[6px] font-black uppercase tracking-[0.1em] text-muted-foreground">
              {status}
            </span>
          ) : null}
        </div>
        {description ? <p className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-relaxed text-muted-foreground/68">{description}</p> : null}
      </div>
      {trailing || (onClick ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30" /> : null)}
    </Component>
  );
};

interface MobileLoadingStateProps {
  label?: string;
  className?: string;
}

export const MobileLoadingState = ({ label = "Carregando", className }: MobileLoadingStateProps) => (
  <div className={cn("flex min-h-[220px] flex-col items-center justify-center gap-3", className)}>
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/35" />
    <p className="text-[8px] font-black uppercase tracking-[0.18em] text-muted-foreground/55">{label}</p>
  </div>
);
