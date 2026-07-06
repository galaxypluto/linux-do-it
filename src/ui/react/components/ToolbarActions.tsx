import type { CardLayout, ExtensionSettings } from "../../../storage/settings";
import { icons } from "../../icons";
import { cn } from "../lib/cn";

export type ToolbarActionsVariant = "toolbar" | "native";

type ToolbarActionsProps = {
  settings: Pick<ExtensionSettings, "enabled" | "layout">;
  settingsOpen: boolean;
  variant: ToolbarActionsVariant;
};

type LayoutAction = {
  layout: CardLayout;
  icon: keyof typeof icons;
  title: string;
  label: string;
};

const layoutActions: LayoutAction[] = [
  {
    layout: "grid",
    icon: "cards",
    title: "卡片视图",
    label: "卡片"
  },
  {
    layout: "masonry",
    icon: "masonry",
    title: "瀑布视图",
    label: "瀑布"
  },
  {
    layout: "reader",
    icon: "reader",
    title: "列表阅读视图",
    label: "列表"
  }
];

export function ToolbarActions({ settings, settingsOpen, variant }: ToolbarActionsProps) {
  if (variant === "native") {
    return <NativeToolbarActions settings={settings} settingsOpen={settingsOpen} />;
  }

  return <PopoverToolbarActions settings={settings} settingsOpen={settingsOpen} />;
}

function PopoverToolbarActions({ settings, settingsOpen }: Omit<ToolbarActionsProps, "variant">) {
  return (
    <div className="ldcv-toolbar__actions" role="toolbar" aria-label="阅读器工具" data-react-toolbar-actions="true">
      <button
        className="ldcv-icon-button"
        data-action="refresh"
        title="刷新话题"
        aria-label="刷新话题"
        dangerouslySetInnerHTML={{ __html: icons.refresh }}
      />
      <button
        className={cn("ldcv-icon-button", settingsOpen && "is-active")}
        data-action="toggle-settings"
        title="设置"
        aria-label="设置"
        aria-expanded={settingsOpen ? "true" : "false"}
        dangerouslySetInnerHTML={{ __html: icons.settings }}
      />
      {layoutActions.map((action) => (
        <button
          key={action.layout}
          className={cn("ldcv-segment", settings.enabled && settings.layout === action.layout && "is-active")}
          data-layout={action.layout}
          title={action.title}
          aria-label={action.title}
          dangerouslySetInnerHTML={{
            __html: `${icons[action.icon]}<span class="ldcv-visually-hidden">${action.label}</span>`
          }}
        />
      ))}
      <button
        className={cn("ldcv-segment", !settings.enabled && "is-active")}
        data-action="toggle-original"
        title="原始列表"
        aria-label="原始列表"
        dangerouslySetInnerHTML={{ __html: `${icons.list}<span class="ldcv-visually-hidden">原始</span>` }}
      />
    </div>
  );
}

function NativeToolbarActions({ settings, settingsOpen }: Omit<ToolbarActionsProps, "variant">) {
  return (
    <div className="ldcv-native-reader__actions" role="toolbar" aria-label="阅读器工具" data-react-toolbar-actions="true">
      <button type="button" data-action="refresh" title="刷新话题" aria-label="刷新话题" dangerouslySetInnerHTML={{ __html: icons.refresh }} />
      <button
        type="button"
        className={cn(settingsOpen && "is-active")}
        data-action="toggle-settings"
        title="设置"
        aria-label="设置"
        aria-expanded={settingsOpen ? "true" : "false"}
        dangerouslySetInnerHTML={{ __html: icons.settings }}
      />
      {layoutActions.map((action) => (
        <button
          key={action.layout}
          type="button"
          className={cn(settings.enabled && settings.layout === action.layout && "is-active")}
          data-layout={action.layout}
          title={action.title}
          aria-label={action.title}
          dangerouslySetInnerHTML={{ __html: `${icons[action.icon]}<span>${action.label}</span>` }}
        />
      ))}
      <button
        type="button"
        className={cn(!settings.enabled && "is-active")}
        data-action="toggle-original"
        title="原始列表"
        aria-label="原始列表"
        dangerouslySetInnerHTML={{ __html: `${icons.list}<span>原始</span>` }}
      />
    </div>
  );
}
