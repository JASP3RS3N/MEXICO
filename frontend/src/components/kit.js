import React from "react";
import { cn } from "@/lib/utils";
import { X, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------
const BTN_VARIANTS = {
  primary:
    "bg-gradient-to-br from-amber-500 to-orange-600 text-white hover:from-amber-400 hover:to-orange-500 shadow-lg shadow-orange-900/30",
  secondary:
    "bg-surface2 text-textBright border border-border hover:border-borderHover hover:bg-surface3",
  success:
    "bg-cyan text-[#04150f] hover:brightness-110 font-semibold shadow-lg shadow-cyan-glow",
  danger: "bg-red-600 text-white hover:bg-red-500",
  ghost: "text-textMain hover:text-textBright hover:bg-surface2",
  outline:
    "border border-border text-textMain hover:border-borderHover hover:text-textBright",
};
const BTN_SIZES = {
  sm: "h-8 px-3 text-xs rounded-lg",
  md: "h-10 px-4 text-sm rounded-lg",
  lg: "h-12 px-6 text-base rounded-xl",
  icon: "h-10 w-10 rounded-lg",
};

export function Btn({
  variant = "primary",
  size = "md",
  className,
  loading,
  disabled,
  children,
  ...props
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-amber-500/40",
        BTN_VARIANTS[variant],
        BTN_SIZES[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
export function Card({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "bg-surface border border-border rounded-2xl shadow-xl shadow-black/20",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHead({ title, subtitle, action, className }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 p-5 border-b border-border", className)}>
      <div>
        <h3 className="text-textBright font-semibold text-lg">{title}</h3>
        {subtitle && <p className="text-textDim text-sm mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------
const FIELD_BASE =
  "w-full bg-surface2 border border-border rounded-lg px-3 h-10 text-textBright placeholder:text-textDim focus:outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 transition";

export const Input = React.forwardRef(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(FIELD_BASE, className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(FIELD_BASE, "h-auto py-2 min-h-[80px]", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(FIELD_BASE, "appearance-none cursor-pointer pr-8", className)}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export function Field({ label, children, hint, className }) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      {label && <span className="text-sm text-textMain font-medium">{label}</span>}
      {children}
      {hint && <span className="text-xs text-textDim block">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2"
    >
      <span
        className={cn(
          "w-10 h-6 rounded-full transition-colors relative",
          checked ? "bg-cyan" : "bg-surface3"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform",
            checked && "translate-x-4"
          )}
        />
      </span>
      {label && <span className="text-sm text-textMain">{label}</span>}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------
const BADGE_COLORS = {
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  green: "bg-cyan-dim text-cyan border-cyan/30",
  blue: "bg-blue-dim text-blue border-blue/30",
  red: "bg-red-500/15 text-red-300 border-red-500/30",
  gray: "bg-surface3 text-textMain border-border",
  purple: "bg-purple-500/15 text-purple-300 border-purple-500/30",
};
export function Badge({ color = "gray", children, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border",
        BADGE_COLORS[color],
        className
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------
export function Modal({ open, onClose, title, children, footer, size = "md" }) {
  if (!open) return null;
  const width = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "relative w-full bg-surface border border-border rounded-2xl shadow-2xl max-h-[90vh] flex flex-col",
          width
        )}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-lg font-semibold text-textBright">{title}</h3>
          <button onClick={onClose} className="text-textDim hover:text-textBright transition">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && <div className="p-5 border-t border-border flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------
export function Spinner({ className }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-amber-400", className)} />;
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[300px]">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      {Icon && <Icon className="h-12 w-12 text-textDim mb-4" />}
      <p className="text-textBright font-medium">{title}</p>
      {subtitle && <p className="text-textDim text-sm mt-1 max-w-sm">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, icon: Icon, accent = "amber" }) {
  const accents = {
    amber: "text-amber-400 bg-amber-500/10",
    green: "text-cyan bg-cyan-dim",
    blue: "text-blue bg-blue-dim",
    red: "text-red-400 bg-red-500/10",
    purple: "text-purple-400 bg-purple-500/10",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-textDim text-sm font-medium">{label}</p>
          <p className="text-2xl font-bold text-textBright mt-1 font-mono">{value}</p>
          {sub && <p className="text-xs text-textDim mt-1">{sub}</p>}
        </div>
        {Icon && (
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", accents[accent])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </Card>
  );
}
