import compareVersions from "compare-versions";
import { isDebug } from "@/shared/constants/env";
import browser from "webextension-polyfill";

class PTPlugin {
  private optionsTabId = 0;

  public init () {
    isDebug && this.initDebug();
    this.initBrowserEvent();
  }

  private initDebug () {
    Object.assign(window as any, {
      PTPP: this
    });
  }

  /**
   * 初始化浏览器事件
   * @private
   */
  private initBrowserEvent () {
    // 防止 browser 对象 以及 browser.runtime 方法缺失
    console.log("service.initBrowserEvent");

    // 监听 点击图标 事件
    browser.browserAction?.onClicked.addListener(async () => {
      await browser.runtime.openOptionsPage();
    });

    // TODO 监听 由活动页面发来的消息 事件
    browser.runtime?.onMessage?.addListener(async (message, sender) => {
      return Promise.resolve(true);
    });

    // 监听 安装/升级 事件
    browser.runtime?.onInstalled.addListener(details => {
      console.log("browser.runtime.onInstalled", details);
      if (details.reason === "update") {
        // 仅在生产环境打开 ChangeLog 页面，因为 Hot Extension Reload 会使得这个方法过于频繁的被调用
        !isDebug && this.openOptionPage("/changelog");

        // TODO 执行脚本对应升级方法（大版本升级带来的一些存储变化）

        // TODO 执行脚本升级所需要触发的方法
        const currentVersion = browser.runtime.getManifest().version;
        if (compareVersions.compare(currentVersion, details.previousVersion!, ">")) {
          console.log(`Extension upgrade from ${details.previousVersion} to ${currentVersion}`);
        }
      }
    });
  }

  public openOptionPage (path = "") {
    if (!path) { return; }
    let url = "/options.html";
    if (path.slice(0, 1) === "/") {
      url += "#" + path;
    }
    if (this.optionsTabId === 0) {
      browser.tabs.create({ url: url }).then(tab => {
        this.optionsTabId = tab.id!;
      });
    } else {
      browser.tabs.get(this.optionsTabId).then(async tab => {
        if (!browser.runtime.lastError && tab) {
          await browser.tabs.update(tab.id!, { active: true, url });
        }
      });
    }
  }
}

export default new PTPlugin();
