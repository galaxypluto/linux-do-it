import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../../src/storage/settings";
import { renderSettingsPanels, settingsPanelTemplate, unmountSettingsPanels } from "../../src/ui/settingsPanel";

function renderSettingsPanel(settings = DEFAULT_SETTINGS, open = true): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = settingsPanelTemplate(settings, open);
  renderSettingsPanels(root, settings, open);
  return root;
}

describe("settings panel React island", () => {
  it("renders the first P3 settings with defaults and bounds", () => {
    const root = renderSettingsPanel(DEFAULT_SETTINGS, true);

    expect(root.querySelector("[data-settings-panel-host]")).not.toBeNull();
    expect(root.querySelector("[data-settings-panel]")?.hasAttribute("hidden")).toBe(false);
    expect(root.querySelector("[data-settings-panel]")?.getAttribute("data-react-settings-panel")).toBe("true");
    expect(root.querySelector<HTMLInputElement>("[data-setting-toggle='enabled']")?.checked).toBe(true);
    expect(root.querySelector<HTMLInputElement>("[data-setting-toggle='newTopicNoticeEnabled']")?.checked).toBe(true);
    expect(root.querySelector<HTMLInputElement>("[data-setting-toggle='collapseLongComments']")?.checked).toBe(true);
    expect(root.querySelector<HTMLInputElement>("[data-setting-toggle='autoLoadReaderComments']")?.checked).toBe(true);
    expect(root.querySelector("[data-setting-toggle='autoLoadReaderComments']")?.closest("label")?.getAttribute("title")).toContain(
      "滚到评论区底部"
    );
    expect(root.querySelector(".ldcv-setting__label i aria-hidden") || root.querySelector(".ldcv-setting__label i")).not.toBeNull();
    expect(root.querySelector("[data-setting-select='density']")?.closest("label")?.getAttribute("title")).toContain(
      "控制卡片信息密度"
    );
    expect(Array.from(root.querySelectorAll<HTMLOptionElement>("[data-setting-select='density'] option")).map((option) => option.textContent)).toEqual([
      "舒适",
      "紧凑"
    ]);
    expect(root.querySelector("[data-setting-select='commentSortOrder']")?.closest("label")?.getAttribute("title")).toContain(
      "Reader 评论默认排序"
    );
    expect(Array.from(root.querySelectorAll<HTMLOptionElement>("[data-setting-select='commentSortOrder'] option")).map((option) => option.textContent)).toEqual([
      "正序",
      "倒序"
    ]);
    expect(root.querySelector<HTMLSelectElement>("[data-setting-select='topicUrlView']")?.value).toBe("classic");
    expect(root.querySelector("[data-setting-number='readerPostBatchSize']")?.closest("label")?.textContent).toContain(
      "后续加载批量"
    );
    expect(root.querySelector("[data-setting-number='readerPostBatchSize']")?.closest("label")?.textContent).toContain(
      "首批由站点返回"
    );
    expect(root.querySelector<HTMLInputElement>("[data-setting-number='readerPostBatchSize']")?.getAttribute("min")).toBe("10");
    expect(root.querySelector<HTMLInputElement>("[data-setting-number='readerPostBatchSize']")?.getAttribute("max")).toBe("50");
    expect(root.querySelector<HTMLInputElement>("[data-setting-number='newTopicCheckIntervalSeconds']")?.getAttribute("min")).toBe("30");
    expect(root.querySelector<HTMLInputElement>("[data-setting-number='newTopicCheckIntervalSeconds']")?.getAttribute("max")).toBe("600");
    expect(root.querySelector("[data-setting-number='creditTopicViewDwellSeconds']")?.closest("label")?.textContent).toContain(
      "计数等待时长"
    );
    expect(root.querySelector<HTMLInputElement>("[data-setting-number='creditTopicViewDwellSeconds']")?.getAttribute("min")).toBe("5");
    expect(root.querySelector<HTMLInputElement>("[data-setting-number='creditTopicViewDwellSeconds']")?.getAttribute("max")).toBe("15");
    expect(root.querySelector("[data-setting-number='creditViewedTopicStorageMax']")?.closest("label")?.textContent).toContain(
      "已计数存储上限"
    );
    expect(root.querySelector<HTMLInputElement>("[data-setting-number='creditViewedTopicStorageMax']")?.getAttribute("min")).toBe("200");
    expect(root.querySelector<HTMLInputElement>("[data-setting-number='creditViewedTopicStorageMax']")?.getAttribute("max")).toBe("800");

    unmountSettingsPanels(root);
  });

  it("can render closed and unchecked settings", () => {
    const root = renderSettingsPanel(
      {
        ...DEFAULT_SETTINGS,
        enabled: false,
        newTopicNoticeEnabled: false,
        collapseLongComments: false,
        autoLoadReaderComments: false,
        density: "compact",
        commentSortOrder: "desc"
      },
      false
    );

    expect(root.querySelector("[data-settings-panel]")?.hasAttribute("hidden")).toBe(true);
    expect(root.querySelector<HTMLInputElement>("[data-setting-toggle='enabled']")?.checked).toBe(false);
    expect(root.querySelector<HTMLInputElement>("[data-setting-toggle='newTopicNoticeEnabled']")?.checked).toBe(false);
    expect(root.querySelector<HTMLInputElement>("[data-setting-toggle='collapseLongComments']")?.checked).toBe(false);
    expect(root.querySelector<HTMLInputElement>("[data-setting-toggle='autoLoadReaderComments']")?.checked).toBe(false);
    expect(root.querySelector<HTMLSelectElement>("[data-setting-select='density']")?.value).toBe("compact");
    expect(root.querySelector<HTMLSelectElement>("[data-setting-select='commentSortOrder']")?.value).toBe("desc");
    expect(root.querySelector<HTMLSelectElement>("[data-setting-select='topicUrlView']")?.title).toBe("原帖链接视图");
    expect(Array.from(root.querySelectorAll<HTMLOptionElement>("[data-setting-select='topicUrlView'] option")).map((option) => option.value)).toEqual([
      "classic",
      "nested"
    ]);

    unmountSettingsPanels(root);
  });
});
