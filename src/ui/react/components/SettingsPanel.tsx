import type { ExtensionSettings } from "../../../storage/settings";
import {
  CREDIT_TOPIC_VIEW_DWELL_MAX_SECONDS,
  CREDIT_TOPIC_VIEW_DWELL_MIN_SECONDS,
  CREDIT_VIEWED_TOPIC_STORAGE_MAX,
  CREDIT_VIEWED_TOPIC_STORAGE_MIN,
  NEW_TOPIC_CHECK_INTERVAL_MAX_SECONDS,
  NEW_TOPIC_CHECK_INTERVAL_MIN_SECONDS,
  READER_POST_BATCH_MAX,
  READER_POST_BATCH_MIN
} from "../../../storage/settings";
import { icons } from "../../icons";

type SettingIconName = keyof typeof icons;

type SettingLabelProps = {
  icon: SettingIconName;
  title: string;
  description: string;
};

type SettingsPanelProps = {
  settings: ExtensionSettings;
  open: boolean;
};

export function SettingsPanel({ settings, open }: SettingsPanelProps) {
  return (
    <section
      className="ldcv-settings-panel"
      data-settings-panel
      data-react-settings-panel="true"
      data-motion-state={open ? "open" : "closed"}
      hidden={!open}
      aria-hidden={open ? "false" : "true"}
      aria-label="阅读器设置"
    >
      <div className="ldcv-settings-group">
        <h3 className="ldcv-settings-group__title">基础与外观</h3>
        <div className="ldcv-settings-grid">
          <label className="ldcv-setting ldcv-setting--switch" title="关闭后显示原站列表">
            <SettingLabel icon="eye" title="启用扩展视图" description="关闭后显示原站列表" />
            <input type="checkbox" role="switch" data-setting-toggle="enabled" defaultChecked={settings.enabled} title="启用扩展视图" />
          </label>

          <label className="ldcv-setting" title="控制卡片信息密度">
            <SettingLabel icon="list" title="卡片密度" description="控制列表信息密度" />
            <select data-setting-select="density" title="卡片密度" defaultValue={settings.density}>
              <option value="comfortable">舒适</option>
              <option value="compact">紧凑</option>
            </select>
          </label>
        </div>
      </div>

      <div className="ldcv-settings-group">
        <h3 className="ldcv-settings-group__title">阅读与评论体验</h3>
        <div className="ldcv-settings-grid">
          <label className="ldcv-setting" title="Reader 评论默认排序">
            <SettingLabel icon="reply" title="评论排序" description="Reader 默认排序" />
            <select data-setting-select="commentSortOrder" title="评论排序" defaultValue={settings.commentSortOrder}>
              <option value="asc">正序</option>
              <option value="desc">倒序</option>
            </select>
          </label>

          <label className="ldcv-setting" title="打开原帖时默认使用的 Linux.do 话题路径">
            <SettingLabel icon="reply" title="原帖链接视图" description="t/topic 列表视图或 n/topic 嵌套视图" />
            <select data-setting-select="topicUrlView" title="原帖链接视图" defaultValue={settings.topicUrlView}>
              <option value="classic">列表视图 (t/topic)</option>
              <option value="nested">嵌套视图 (n/topic)</option>
            </select>
          </label>

          <label className="ldcv-setting ldcv-setting--switch" title="Reader 长评论默认折叠，减少正文占位">
            <SettingLabel icon="list" title="折叠长评论" description="Reader 评论更紧凑" />
            <input
              type="checkbox"
              role="switch"
              data-setting-toggle="collapseLongComments"
              defaultChecked={settings.collapseLongComments}
              title="长评论默认折叠"
            />
          </label>

          <label className="ldcv-setting ldcv-setting--switch" title="滚到评论区底部时自动加载下一批评论与回复">
            <SettingLabel icon="next" title="滚动自动加载" description="滚到底部自动加载评论/回复" />
            <input
              type="checkbox"
              role="switch"
              data-setting-toggle="autoLoadReaderComments"
              defaultChecked={settings.autoLoadReaderComments}
              title="滚动自动加载评论"
            />
          </label>

          <label className="ldcv-setting" title={`首批由站点返回，后续每批 ${READER_POST_BATCH_MIN}-${READER_POST_BATCH_MAX} 条`}>
            <SettingLabel
              icon="next"
              title="后续加载批量"
              description={`首批由站点返回，后续每批 ${READER_POST_BATCH_MIN}-${READER_POST_BATCH_MAX} 条`}
            />
            <input
              type="number"
              inputMode="numeric"
              min={READER_POST_BATCH_MIN}
              max={READER_POST_BATCH_MAX}
              step="1"
              defaultValue={settings.readerPostBatchSize}
              data-setting-number="readerPostBatchSize"
              title="后续加载批量"
            />
          </label>
        </div>
      </div>

      <div className="ldcv-settings-group">
        <h3 className="ldcv-settings-group__title">消息通知</h3>
        <div className="ldcv-settings-grid">
          <label className="ldcv-setting ldcv-setting--switch" title="只检查列表 JSON，不预取话题详情">
            <SettingLabel icon="refresh" title="新话题提醒" description="只检查列表 JSON" />
            <input
              type="checkbox"
              role="switch"
              data-setting-toggle="newTopicNoticeEnabled"
              defaultChecked={settings.newTopicNoticeEnabled}
              title="新话题提醒"
            />
          </label>

          <label className="ldcv-setting" title={`新话题检查间隔，范围 ${NEW_TOPIC_CHECK_INTERVAL_MIN_SECONDS}-${NEW_TOPIC_CHECK_INTERVAL_MAX_SECONDS} 秒`}>
            <SettingLabel icon="settings" title="提醒间隔" description={`${NEW_TOPIC_CHECK_INTERVAL_MIN_SECONDS}-${NEW_TOPIC_CHECK_INTERVAL_MAX_SECONDS} 秒`} />
            <input
              type="number"
              inputMode="numeric"
              min={NEW_TOPIC_CHECK_INTERVAL_MIN_SECONDS}
              max={NEW_TOPIC_CHECK_INTERVAL_MAX_SECONDS}
              step="1"
              defaultValue={settings.newTopicCheckIntervalSeconds}
              data-setting-number="newTopicCheckIntervalSeconds"
              title="提醒间隔"
            />
          </label>
        </div>
      </div>

      <div className="ldcv-settings-group">
        <h3 className="ldcv-settings-group__title">信用浏览计数</h3>
        <div className="ldcv-settings-grid">
          <label
            className="ldcv-setting"
            title={`打开话题后停留满该秒数，再向论坛提交信用浏览计数；范围 ${CREDIT_TOPIC_VIEW_DWELL_MIN_SECONDS}-${CREDIT_TOPIC_VIEW_DWELL_MAX_SECONDS} 秒`}
          >
            <SettingLabel
              icon="eye"
              title="计数等待时长"
              description={`停留 ${CREDIT_TOPIC_VIEW_DWELL_MIN_SECONDS}-${CREDIT_TOPIC_VIEW_DWELL_MAX_SECONDS} 秒后计入信用浏览`}
            />
            <input
              type="number"
              inputMode="numeric"
              min={CREDIT_TOPIC_VIEW_DWELL_MIN_SECONDS}
              max={CREDIT_TOPIC_VIEW_DWELL_MAX_SECONDS}
              step="1"
              defaultValue={settings.creditTopicViewDwellSeconds}
              data-setting-number="creditTopicViewDwellSeconds"
              title="计数等待时长"
            />
          </label>

          <label
            className="ldcv-setting"
            title={`本地记录已成功计数的 topic 数量上限；超出部分会被淘汰，再次打开可能重新触发计数请求；范围 ${CREDIT_VIEWED_TOPIC_STORAGE_MIN}-${CREDIT_VIEWED_TOPIC_STORAGE_MAX}`}
          >
            <SettingLabel
              icon="settings"
              title="已计数存储上限"
              description={`${CREDIT_VIEWED_TOPIC_STORAGE_MIN}-${CREDIT_VIEWED_TOPIC_STORAGE_MAX} 条，超出淘汰后可能再次计数`}
            />
            <input
              type="number"
              inputMode="numeric"
              min={CREDIT_VIEWED_TOPIC_STORAGE_MIN}
              max={CREDIT_VIEWED_TOPIC_STORAGE_MAX}
              step="1"
              defaultValue={settings.creditViewedTopicStorageMax}
              data-setting-number="creditViewedTopicStorageMax"
              title="已计数存储上限"
            />
          </label>
        </div>
      </div>
    </section>
  );
}

function SettingLabel({ icon, title, description }: SettingLabelProps) {
  return (
    <span className="ldcv-setting__label">
      <i aria-hidden="true" dangerouslySetInnerHTML={{ __html: icons[icon] }} />
      <span className="ldcv-setting__text">
        <strong>{title}</strong>
        <em>{description}</em>
      </span>
    </span>
  );
}
