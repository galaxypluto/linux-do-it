import * as React from "react";
import { icons } from "../../icons";
import { cn } from "../lib/cn";

interface BoostInputPopoverProps {
  onSubmit: (text: string) => void;
  onClose: () => void;
  isSubmitting?: boolean;
  /** 点击判定的外层锚点（含触发按钮），避免点到火箭按钮被当成外部关闭 */
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export function BoostInputPopover({ onSubmit, onClose, isSubmitting, anchorRef }: BoostInputPopoverProps) {
  const [text, setText] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const [alignRight, setAlignRight] = React.useState(false);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const modal = containerRef.current.closest(".ldcv-reader-article") || document.body;
      const modalRect = modal.getBoundingClientRect();
      
      if (rect.right > modalRect.right - 8) {
        setAlignRight(true);
      }
    }
  }, []);

  React.useEffect(() => {
    inputRef.current?.focus();
    
    // Attempt to get the current user's avatar from the page header
    const avatarEl = document.querySelector<HTMLImageElement>('#current-user .avatar');
    if (avatarEl && avatarEl.src) {
      setAvatarUrl(avatarEl.src);
    }
    
    function handleClickOutside(e: MouseEvent) {
      const path = typeof e.composedPath === "function" ? e.composedPath() : [e.target];
      const anchor = anchorRef?.current;
      const popover = containerRef.current;
      const isInside = path.some((node) => node === popover || node === anchor);
      
      if (!isInside) {
        onClose();
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose, anchorRef]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !isSubmitting) {
      onSubmit(text.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };
  
  const insertSmile = () => {
    setText(prev => prev + " :) ");
    inputRef.current?.focus();
  };

  const adjustHeight = () => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  };

  React.useEffect(() => {
    adjustHeight();
  }, [text]);

  return (
    <div
      ref={containerRef}
      className="absolute z-20 animate-in fade-in zoom-in-95 duration-100"
      style={{ 
        top: "100%", 
        marginTop: "6px", 
        left: alignRight ? "auto" : 0, 
        right: alignRight ? 0 : "auto",
        display: "flex", 
        flexDirection: "column", 
        gap: "6px", 
        transformOrigin: alignRight ? "right top" : "left top" 
      }}
    >
      <form 
        onSubmit={handleSubmit} 
        onMouseDown={(e) => e.stopPropagation()}
        className="shadow-xl shadow-black/10"
        style={{ 
          display: "flex", 
          alignItems: "center", 
          borderRadius: "999px", 
          padding: "3px 4px", 
          border: "1px solid color-mix(in srgb, var(--text, var(--primary)) 12%, transparent)",
          background: "color-mix(in srgb, var(--surface, var(--secondary)) 78%, transparent)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          gap: "4px",
          fontFamily: "var(--font-family, system-ui, sans-serif)"
        }}
      >
        <div style={{ 
          width: "24px", 
          height: "24px", 
          minWidth: "24px", 
          minHeight: "24px", 
          borderRadius: "50%", 
          backgroundColor: "var(--primary-low, rgba(128,128,128,0.08))", 
          flexShrink: 0, 
          overflow: "hidden", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          marginLeft: "2px",
          border: "1px solid var(--primary-low, rgba(128,128,128,0.15))"
        }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="Me" style={{ width: "100%", height: "100%", objectFit: "cover", margin: 0, padding: 0, display: "block" }} />
          ) : (
            <span style={{ color: "var(--primary-medium, gray)", fontWeight: "bold", fontSize: "10px" }}>Me</span>
          )}
        </div>
        
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            } else {
              handleKeyDown(e);
            }
          }}
          placeholder="Boost..."
          style={{ 
            width: "112px", // kept 112px width constraint
            minHeight: "20px",
            maxHeight: "40px", 
            backgroundColor: "transparent", 
            border: "none", 
            outline: "none", 
            padding: "0 4px", 
            fontSize: "13px", 
            lineHeight: "20px",
            color: "var(--primary)",
            resize: "none",
            overflow: "hidden",
            fontFamily: "var(--font-family, system-ui, sans-serif)"
          }}
          disabled={isSubmitting}
          maxLength={16}
          rows={1}
        />
        
        <div style={{ display: "flex", alignItems: "center", gap: "2px", marginRight: "2px" }}>
          <button
            type="button"
            onClick={insertSmile}
            title="Emoji"
            className="ldcv-reader-boost-popover-btn flex items-center justify-center rounded-full hover:!bg-gray-100 dark:hover:!bg-gray-800 transition-all duration-150"
            style={{ 
              width: "24px", 
              height: "24px", 
              minWidth: "24px",
              minHeight: "24px",
              padding: 0,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: "normal"
            }}
          >
            <span style={{ width: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center" }} dangerouslySetInnerHTML={{ __html: icons.smile }} />
          </button>
          
          <button
            type="submit"
            disabled={!text.trim() || isSubmitting}
            className={cn(
              "ldcv-reader-boost-popover-btn flex items-center justify-center rounded-full transition-all duration-150",
              (!text.trim() || isSubmitting) 
                ? "cursor-not-allowed" 
                : "hover:!bg-emerald-50 dark:hover:!bg-emerald-950/30 cursor-pointer"
            )}
            style={{ 
              width: "24px", 
              height: "24px", 
              minWidth: "24px",
              minHeight: "24px",
              padding: 0,
              backgroundColor: "transparent",
              border: "none",
              fontWeight: "normal"
            }}
          >
            {isSubmitting ? (
              <svg className="animate-spin" style={{ width: "12px", height: "12px" }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <span style={{ width: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center" }} dangerouslySetInnerHTML={{ __html: icons.check }} />
            )}
          </button>
          
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className={cn(
              "ldcv-reader-boost-popover-btn flex items-center justify-center rounded-full transition-all duration-150",
              isSubmitting 
                ? "cursor-not-allowed" 
                : "hover:!bg-rose-50 dark:hover:!bg-rose-950/30 cursor-pointer"
            )}
            style={{ 
              width: "24px", 
              height: "24px", 
              minWidth: "24px",
              minHeight: "24px",
              padding: 0,
              backgroundColor: "transparent",
              border: "none",
              fontWeight: "normal"
            }}
          >
            <span style={{ width: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center" }} dangerouslySetInnerHTML={{ __html: icons.x }} />
          </button>
        </div>
      </form>
    </div>
  );
}
