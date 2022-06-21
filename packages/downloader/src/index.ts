import {
  AbstractBittorrentClient,
  BittorrentClientBaseConfig,
  TorrentClientMetaData,
} from "./types";
export * from "./types";
export { getRemoteTorrentFile } from "./utils";

const requireContext = import.meta.webpackContext!("./entity/", {
  regExp: /\.ts$/,
  chunkName: "lib/downloader/[request]",
  mode: "lazy"
});

export const entityList = requireContext.keys().map((value: string) => {
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

export async function getDownloaderDefaultConfig(type: string): Promise<BittorrentClientBaseConfig> {
  return (await getDownloaderModule(type)).clientConfig;
}

export async function getDownloaderMetaData(type: string): Promise<TorrentClientMetaData> {
  return (await getDownloaderModule(type)).clientMetaData;
}

const downloaderIconContext = import.meta.webpackContext!("./icons/", {
  regExp: /\.png$/,
  mode: "sync"
});

export  function getDownloaderIcon(configType: string):string {
  return downloaderIconContext(`./${configType}.png`);
}

export async function getDownloader(config: BittorrentClientBaseConfig): Promise<AbstractBittorrentClient> {
  const DownloaderClass = (await getDownloaderModule(config.type)).default;

  // @ts-ignore
  return new DownloaderClass(config);
}
