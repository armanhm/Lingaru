/**
 * Shimmer skeleton placeholders. Use instead of animate-pulse for a premium feel.
 */

export function Skeleton({ className = "", style }) {
  return <div className={`skeleton ${className}`} style={style} />;
}

export function SkeletonText({ lines = 3, className = "" }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3"
          style={{ width: i === lines - 1 ? "60%" : "100%" }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ height = "h-36", className = "" }) {
  return <Skeleton className={`${height} rounded-2xl ${className}`} />;
}

export function SkeletonCircle({ size = "h-10 w-10", className = "" }) {
  return <Skeleton className={`${size} rounded-full ${className}`} />;
}

export function SkeletonGrid({ count = 6, height = "h-24" }) {
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} height={height} />
      ))}
    </div>
  );
}
