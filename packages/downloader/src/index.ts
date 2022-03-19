import {
  AbstractBittorrentClient,
  BittorrentClientBaseConfig,
  TorrentClientMetaData,
} from "./types";
export * from "./types";
export { getRemoteTorrentFile } from "./utils";

// 动态生成支持列表
const requireContext = require.context("./entity/", true, /\.ts$/);

export const entityList = requireContext.keys().map((value) => {
  return value.replace(/^\.\//, "").replace(/\.ts$/, "");
});

// 从 requireContext 中获取对应模块
export async function getDownloaderModule(configType: string): Promise<{
  default: AbstractBittorrentClient;
  clientConfig: BittorrentClientBaseConfig;
  clientMetaData: TorrentClientMetaData;
}> {
  return await requireContext(`./${configType}.ts`);
}

export async function getDownloaderDefaultConfig(
  type: string
): Promise<BittorrentClientBaseConfig> {
  return (await getDownloaderModule(type)).clientConfig;
}

export async function getDownloaderMetaData(
  type: string
): Promise<TorrentClientMetaData> {
  return (await getDownloaderModule(type)).clientMetaData;
}

const clientInstanceCache: Record<string, AbstractBittorrentClient> = {};

export async function getDownloader(
  config: BittorrentClientBaseConfig
): Promise<AbstractBittorrentClient> {
  if (typeof clientInstanceCache[config.id!] === "undefined") {
    const DownloaderClass = (await getDownloaderModule(config.type)).default;

    // @ts-ignore
    clientInstanceCache[config.id] = new DownloaderClass(config);
  }

  return clientInstanceCache[config.id!];
}