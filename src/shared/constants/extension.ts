/**
 * 插件自身常量定义
 */
import browser from "webextension-polyfill";
import { REPO_NAME } from "./repo";

export const MANIFEST = browser.runtime.getManifest();

// 版本相关
type dotVersion = `v${number}.${number}.${number}`
type dotHashVersion = `${dotVersion}.${string}`
type TVersion = dotVersion | dotHashVersion

export interface VersionDetail {
  full: TVersion,
  main: dotVersion,
  hash: string
}

export function getFullVersion(): VersionDetail {
  const fullVersion = "v" + (MANIFEST.version_name ?? MANIFEST.version) as TVersion; // v2.0.0.b3f0a76

  let version; let versionHash = "";
  const mainVersionMatch = fullVersion.match(/(v\d+\.\d+\.\d+)\.?(.*)/);
  if (mainVersionMatch && mainVersionMatch[1]) {
    version = mainVersionMatch[1]; // v2.0.0
    versionHash = mainVersionMatch[2]; // b3f0a76
  } else {
    version = fullVersion;
  }

  return { full: fullVersion, main: version as dotVersion, hash: versionHash };
}

/**
 * 插件安装方式
 */
export async function getInstallType(): Promise<browser.Management.ExtensionInstallType | "packed"> {
  const detail = await browser.management.getSelf();
  if (detail?.updateUrl?.includes(REPO_NAME)) {
    return "packed";
  } else {
    return detail.installType;
  }
}
