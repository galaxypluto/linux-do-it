import * as React from "react";
import type { TopicReaderBoost } from "../../../discourse/types";
import { createBoost, deleteBoost } from "../../../discourse/api";
import { BoostBubble } from "./BoostBubble";
import { BoostInputPopover } from "./BoostInputPopover";
import { icons } from "../../icons";
import { cn } from "../lib/cn";
import { escapeHtml } from "../../html";

interface BoostListProps {
  postId: number;
  initialBoosts?: TopicReaderBoost[];
  canBoost?: boolean;
  className?: string;
}

function readCurrentUserPreview(): { username: string; name: string; avatarUrl: string } {
  const avatarEl = document.querySelector<HTMLImageElement>("#current-user .avatar");
  const username =
    document.querySelector<HTMLElement>("#current-user")?.getAttribute("data-user-card") ||
    document.querySelector<HTMLAnchorElement>("#current-user a[data-user-card]")?.getAttribute("data-user-card") ||
    "";
  return {
    username: username || "我",
    name: username || "我",
    avatarUrl: avatarEl?.src || ""
  };
}

function boostsSyncKey(boosts: TopicReaderBoost[]): string {
  return boosts.map((boost) => String(boost.id)).join(",");
}

export function BoostList({ postId, initialBoosts = [], canBoost = false, className }: BoostListProps) {
  const [boosts, setBoosts] = React.useState<TopicReaderBoost[]>(initialBoosts);
  const [showInput, setShowInput] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [localCanBoost, setLocalCanBoost] = React.useState(canBoost);
  const addAnchorRef = React.useRef<HTMLDivElement>(null);
  const syncKey = boostsSyncKey(initialBoosts);

  React.useEffect(() => {
    setBoosts(initialBoosts);
  }, [postId, syncKey]);

  React.useEffect(() => {
    setLocalCanBoost(canBoost);
  }, [canBoost]);

  if (!boosts.length && !localCanBoost) {
    return null;
  }

  const handleSubmit = async (text: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setActionError(null);

    const pendingId = `pending-${Date.now()}`;
    const me = readCurrentUserPreview();
    const pendingBoost: TopicReaderBoost = {
      id: pendingId,
      cooked: `<p>${escapeHtml(text)}</p>`,
      user: { id: 0, username: me.username, name: me.name, avatarUrl: me.avatarUrl },
      canDelete: false
    };

    setBoosts((prev) => [...prev, pendingBoost]);
    setLocalCanBoost(false);

    try {
      const newBoost = await createBoost(postId, text);
      setBoosts((prev) => prev.map((b) => (b.id === pendingId ? newBoost : b)));
      setShowInput(false);
    } catch (err) {
      setBoosts((prev) => prev.filter((b) => b.id !== pendingId));
      setLocalCanBoost(true);
      setActionError((err as Error).message || "添加 Boost 失败，请稍后重试");
      console.error("Failed to add boost", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (boost: TopicReaderBoost) => {
    const previous = [...boosts];
    const previousCanBoost = localCanBoost;
    setActionError(null);
    setBoosts((prev) => prev.filter((b) => b.id !== boost.id));
    // 删除自己的 boost 后服务端会重新允许 can_boost；先乐观恢复入口
    setLocalCanBoost(true);

    try {
      await deleteBoost(boost.id);
    } catch (err) {
      setBoosts(previous);
      setLocalCanBoost(previousCanBoost);
      setActionError((err as Error).message || "删除 Boost 失败，请稍后重试");
      console.error("Failed to delete boost", err);
    }
  };

  return (
    <div className={cn("flex flex-col gap-1 mt-3", className)}>
      <div className="flex flex-wrap items-center -m-1">
        {boosts.map((boost) => (
        <BoostBubble
          key={boost.id}
          boost={boost}
          isPending={typeof boost.id === "string" && boost.id.startsWith("pending")}
          onDelete={handleDelete}
        />
        ))}

        {localCanBoost && (
          <div ref={addAnchorRef} className="relative inline-flex ldcv-reader-boost-item">
            <button
              type="button"
              title="添加 Boost"
              className="ldcv-reader-boost-add-btn flex items-center justify-center rounded-full transition-all duration-200 shadow-sm w-[30px] h-[30px] cursor-pointer"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowInput(!showInput);
                setActionError(null);
              }}
            >
              <span
                className="w-4 h-4 flex items-center justify-center"
                style={{ display: "flex", width: "16px", height: "16px", alignItems: "center", justifyContent: "center" }}
                dangerouslySetInnerHTML={{ __html: icons.boost }}
              />
            </button>

            {showInput && (
              <BoostInputPopover
                onSubmit={handleSubmit}
                onClose={() => setShowInput(false)}
                isSubmitting={isSubmitting}
                anchorRef={addAnchorRef}
              />
            )}
          </div>
        )}
      </div>

      {actionError && (
        <div className="text-xs text-red-600 dark:text-red-400 px-1" role="alert">
          {actionError}
        </div>
      )}
    </div>
  );
}
