import * as React from "react";
import type { TopicReaderBoost } from "../../../discourse/types";
import { fetchBoost } from "../../../discourse/api";
import { icons } from "../../icons";
import { cn } from "../lib/cn";

export interface BoostBubbleProps {
  boost: TopicReaderBoost;
  onDelete?: (boost: TopicReaderBoost) => void;
  isPending?: boolean;
}

export function BoostBubble({ boost, onDelete, isPending }: BoostBubbleProps) {
  const [showMenu, setShowMenu] = React.useState(false);
  const [loadingPermissions, setLoadingPermissions] = React.useState(false);
  const [resolved, setResolved] = React.useState<TopicReaderBoost>(boost);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setResolved(boost);
  }, [boost]);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!menuRef.current) return;

      const path = typeof e.composedPath === "function" ? e.composedPath() : [e.target];
      const isInside = path.some((node) => node === menuRef.current);

      if (!isInside) {
        setShowMenu(false);
      }
    }
    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu]);

  const canDelete = resolved.canDelete === true;
  const permissionsUnknown = resolved.canDelete === null;
  const canInteract = !isPending && (permissionsUnknown || canDelete);

  const openMenu = async () => {
    if (isPending || loadingPermissions) return;

    if (showMenu) {
      setShowMenu(false);
      return;
    }

    let next = resolved;
    if (permissionsUnknown) {
      setLoadingPermissions(true);
      try {
        next = await fetchBoost(resolved.id);
        setResolved(next);
      } catch (err) {
        console.error("Failed to fetch boost permissions", err);
        return;
      } finally {
        setLoadingPermissions(false);
      }
    }

    if (next.canDelete === true) {
      setShowMenu(true);
    }
  };

  const authorName = resolved.user.name || resolved.user.username || "User";
  const marker = authorName.trim().slice(0, 1).toUpperCase() || "B";

  return (
    <div className={cn("relative inline-flex items-center ldcv-reader-boost-item", isPending && "opacity-60")}>
      <button
        type="button"
        className={cn(
          "ldcv-reader-boost-bubble-btn flex items-center rounded-full shadow-sm",
          canInteract ? "cursor-pointer" : "cursor-default"
        )}
        style={{
          padding: "1px 10px 1px 1px",
          backgroundColor: "var(--primary-low, rgba(var(--primary-rgb, 128, 128, 128), 0.12))",
          height: "30px",
          border: "1px solid var(--primary-low, rgba(128, 128, 128, 0.15))"
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (canInteract) {
            void openMenu();
          }
        }}
        title={authorName}
        disabled={loadingPermissions}
      >
        {resolved.user.avatarUrl ? (
          <img
            src={resolved.user.avatarUrl}
            alt={authorName}
            className="rounded-full object-cover shadow-sm flex-shrink-0"
            style={{ width: "26px", height: "26px", minWidth: "26px", minHeight: "26px", borderRadius: "50%", objectFit: "cover", margin: 0, padding: 0 }}
            loading="lazy"
          />
        ) : (
          <span
            className="rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-600 dark:text-gray-300 flex-shrink-0"
            style={{ width: "26px", height: "26px", minWidth: "26px", minHeight: "26px", borderRadius: "50%", margin: 0, padding: 0, fontSize: "11px" }}
          >
            {marker}
          </span>
        )}
        <div
          className="ldcv-reader-boost-text text-gray-800 dark:text-gray-200 max-w-[200px] truncate"
          style={{ fontSize: "12px", lineHeight: "1.2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginLeft: "6px" }}
          dangerouslySetInnerHTML={{ __html: resolved.cooked }}
        />
      </button>

      {showMenu && canDelete && (
        <div
          ref={menuRef}
          className="ldcv-reader-boost-menu absolute z-20 bottom-[calc(100%+6px)] left-0 shadow-xl rounded-lg py-1 min-w-[120px] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          <button
            type="button"
            className="ldcv-reader-boost-menu__delete w-full text-left px-3.5 py-2 text-xs flex items-center gap-2 transition-colors"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowMenu(false);
              onDelete?.(resolved);
            }}
          >
            <span className="w-[14px] h-[14px]" dangerouslySetInnerHTML={{ __html: icons.trash }} /> 删除
          </button>
        </div>
      )}
    </div>
  );
}
