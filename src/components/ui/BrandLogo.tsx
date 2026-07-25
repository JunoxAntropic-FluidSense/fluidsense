interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
  subtitle?: string;
}

export function BrandLogo({
  size = "md",
  showText = true,
  className = "",
  subtitle,
}: BrandLogoProps) {
  const iconSizes = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-10 w-10",
  };

  const textSizes = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
  };

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src="/logo.png"
        alt="FluidSense Logo"
        className={`${iconSizes[size]} shrink-0 object-contain`}
      />
      {showText && (
        <div className="flex flex-col justify-center">
          <span
            className={`${textSizes[size]} font-extrabold text-navy-900 tracking-tight leading-none`}
          >
            FluidSense
          </span>
          {subtitle && (
            <span className="text-xs text-fog-500 leading-tight mt-0.5">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
