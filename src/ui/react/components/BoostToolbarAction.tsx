import * as React from "react";
import { BoostInputPopover } from "./BoostInputPopover";
import { icons } from "../../icons";
import { cn } from "../lib/cn";
import { createBoost } from "../../../discourse/api";

interface BoostToolbarActionProps {
  postId: number;
  onBoostAdded?: () => void;
  className?: string;
  /** pill：圆形容器（默认）；ghost：评论区空状态，对齐点赞/回复图标按钮 */
  variant?: "pill" | "ghost";
  /** 编辑器开关变化时通知父级（用于评论工具栏强制全显，避免胶囊被 opacity 压暗） */
  onOpenChange?: (open: boolean) => void;
}

export function BoostToolbarAction({
  postId,
  onBoostAdded,
  className,
  variant = "pill",
  onOpenChange
}: BoostToolbarActionProps) {
  const [showInput, setShowInput] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const setOpen = React.useCallback(
    (open: boolean) => {
      setShowInput(open);
      onOpenChange?.(open);
    },
    [onOpenChange]
  );

  React.useEffect(() => {
    return () => onOpenChange?.(false);
  }, [onOpenChange]);

  const handleSubmit = async (text: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await createBoost(postId, text);
      setOpen(false);
      onBoostAdded?.();
    } catch (err) {
      setActionError((err as Error).message || "添加 Boost 失败，请稍后重试");
      console.error("Failed to add boost", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isGhost = variant === "ghost";

  return (
    <div
      ref={rootRef}
      className={cn("relative inline-flex", isGhost ? "items-center" : "flex-col items-end", className)}
      onBlur={(e) => {
        if (!showInput || isSubmitting) return;
        const next = e.relatedTarget as Node | null;
        if (next && rootRef.current?.contains(next)) return;
        // 失焦关闭：焦点离开触发按钮与胶囊整体
        window.setTimeout(() => {
          if (!rootRef.current?.contains(document.activeElement)) {
            setOpen(false);
          }
        }, 0);
      }}
    >
      <button
        type="button"
        title="添加 Boost"
        className={cn(
          "flex items-center justify-center transition-all duration-200 cursor-pointer",
          isGhost
            ? "ldcv-reader-action-button ldcv-reader-boost-ghost-btn w-7 h-7 rounded-full !bg-transparent !p-0 !min-h-0 !border-none text-gray-500 hover:text-gray-700 hover:bg-gray-100/80 dark:hover:bg-white/10 active:scale-95"
            : "ldcv-reader-boost-add-btn rounded-full shadow-sm w-[30px] h-[30px]"
        )}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(!showInput);
          setActionError(null);
        }}
        disabled={isSubmitting}
        aria-expanded={showInput}
      >
        <span
          className={cn(
            "flex items-center justify-center",
            isGhost ? "w-5 h-5 [&>svg]:w-5 [&>svg]:h-5" : "w-4 h-4"
          )}
          style={isGhost ? undefined : { display: "flex", width: "16px", height: "16px", alignItems: "center", justifyContent: "center" }}
          dangerouslySetInnerHTML={{ __html: icons.boost }}
        />
      </button>

      {showInput && (
        <BoostInputPopover
          onSubmit={handleSubmit}
          onClose={() => setOpen(false)}
          isSubmitting={isSubmitting}
          anchorRef={rootRef}
        />
      )}

      {actionError && (
        <div className="absolute top-full right-0 mt-1 whitespace-nowrap text-xs text-red-600 dark:text-red-400" role="alert">
          {actionError}
        </div>
      )}
    </div>
  );
}
