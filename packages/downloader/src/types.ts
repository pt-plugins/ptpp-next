/**
 * 对于 Bittorrent 软件的定义
 */
import { AxiosRequestConfig } from "axios";

export type TorrentClientFeature = "CustomPath";

// 最通用的自定义目录提示词
export const CustomPathDescription =
  "当前目录列表配置是指定硬盘上的绝对路径，如 /volume1/music/ 或 D:\\download\\music\\。请确保对应路径软件有写入权限。";

/**
 * 客户端配置信息
 */
export interface BittorrentClientBaseConfig {
  /**
   * UUIDv4
   * 系统使用这个信息判断并生成唯一的客户端
   */
  id?: string;

  /**
   * 客户端类型，与文件名相同
   */
  type: string;

  /**
   * 客户端名称
   * The name of client which can help users recognise it quickly
   */
  name: string;

  /**
   * The full url of torrent client webapi, like:
   *    - transmission:  http://ip:port/transmission/rpc
   *    - qbittorrent:   http://ip:port/
   */
  address: string;

  username?: string;
  password?: string;

  /**
   * request timeout
   */
  timeout?: number;

  feature?: {
    [feature in TorrentClientFeature]?: boolean;
  };
}

// 强制要求填写用户名和密码
export interface TorrentClientConfig extends BittorrentClientBaseConfig {
  username: string;
  password: string;
}

export interface TorrentClientFeatureMetaData {
  allowed: boolean; // 该客户端是否允许该特征
  description?: string; // 该特征的相关说明
}

/**
 * 客户端介绍信息
 */
export interface TorrentClientMetaData {
  version: `v${number}.${number}.${number}`;  // 实现版本
  description?: string; // 客户端介绍
  warning?: string[]; // 用于配置时显示的警告信息，要用于一些特殊提示

  feature: {
    [feature in TorrentClientFeature]: TorrentClientFeatureMetaData;
  };
}

export interface TorrentClientStatus {
  upSpeed: number; // 上传速度（瞬间）
  upData?: number; // 上传总量（对于不同客户端可能是total或者session）
  dlSpeed: number;
  dlData?: number;
}

export enum CTorrentState {
  downloading = "downloading",
  seeding = "seeding",
  paused = "paused",
  queued = "queued",
  checking = "checking",
  error = "error",
  unknown = "unknown",
}

// 获得到的种子实例
export interface CTorrent<RAW = any> {
  id: string | number;
  infoHash: string;

  name: string;

  /**
   * progress percent out of 100
   */
  progress: number;
  isCompleted: boolean;

  /**
   * 1:1 is 1, half seeded is 0.5
   */
  ratio: number;

  /**
   * date as timestamp (s)
   */
  dateAdded: number;

  savePath: string;
  label?: string;
  state: CTorrentState;

  /**
   * total size of the torrent, in bytes
   */
  totalSize: number;

  /**
   * bytes per second
   */
  uploadSpeed: number;
  /**
   * bytes per second
   */
  downloadSpeed: number;

  /**
   * total upload in bytes
   */
  totalUploaded: number;
  /**
   * total download in bytes
   */
  totalDownloaded: number;

  raw: RAW;
  clientId: string;
}

// 种子筛选方法
export interface CTorrentFilterRules {
  ids?: any;
  complete?: boolean;
}

// 添加种子
export interface CAddTorrentOptions {
  /**
   * 是否本地下载
   */
  localDownload: boolean;
  localDownloadOption?: AxiosRequestConfig;

  /**
   * 是否将种子置于暂停状态
   */
  addAtPaused: boolean;

  /**
   * 种子下载地址
   */
  savePath: string;

  /**
   * called a label in some clients and a category in others
   * Notice: Some clients didn't support it
   */
  label?: string;
}

/**
 * 客户端具体要实现的抽象方法
 */
export abstract class AbstractBittorrentClient<T extends BittorrentClientBaseConfig = BittorrentClientBaseConfig> {
  readonly config: T;

  private clientVersion?: string;

  protected constructor (options: T) {
    this.config = options as T;
  }

  // 检查客户端是否可以连接
  public abstract ping (): Promise<boolean>;

  // 获取客户端版本信息( wrapper with local cache )
  public async getClientVersion (): Promise<string> {
    if (!this.clientVersion) {
      this.clientVersion = await this.getClientVersionFromRemote();
    }
    return this.clientVersion;
  }

  // 获取客户端版本信息( wrapper with local cache )
  protected abstract getClientVersionFromRemote (): Promise<string>;

  // 获取客户端状态
  public async getClientStatus (): Promise<TorrentClientStatus> {
    return {
      dlSpeed: 0,
      upSpeed: 0,
      dlData: 0,
      upData: 0
    };
  }

  // 剩余磁盘空间
  public async getClientFreeSpace (): Promise<number | "N/A"> {
    return "N/A";
  }

  /**
   * 获取种子信息的方法
   *
   * 注意 abstract class 中内置了一种本地筛选种子的获取方法，
   * 即从bt软件中获取所有种子，然后本地筛选，即 getAllTorrents -> getTorrentsBy -> getTorrent
   * 此时只需要完成 getAllTorrents 方法的逻辑即可
   *
   * 如果该客户端支持在获取种子的时候进行筛选，
   * 则建议将筛选步骤推送给bt软件，即 getTorrentsBy -> getAllTorrents/getTorrent
   * 此时，则同时需要完成 3个方法（部分情况下为其中1个或2个）的 override
   *
   */
  public abstract getAllTorrents (): Promise<CTorrent[]>;

  public async getTorrentsBy (filter: CTorrentFilterRules): Promise<CTorrent[]> {
    let torrents = await this.getAllTorrents();
    if (filter.ids) {
      const filterIds = Array.isArray(filter.ids) ? filter.ids : [filter.ids];
      torrents = torrents.filter((t) => {
        return filterIds.includes(t.infoHash);
      });
    }

    if (filter.complete) {
      torrents = torrents.filter((t) => t.isCompleted);
    }

    return torrents;
  }

  public async getTorrent (id: string): Promise<CTorrent> {
    return (await this.getTorrentsBy({ ids: id }))[0];
  }

  // 添加种子
  public abstract addTorrent (
    url: string,
    options: Partial<CAddTorrentOptions>
  ): Promise<boolean>;

  // 暂停种子
  public abstract pauseTorrent (id: any): Promise<boolean>;

  // 恢复种子
  public abstract resumeTorrent (id: any): Promise<boolean>;

  // 删除种子
  public abstract removeTorrent (
    id: any,
    removeData?: boolean
  ): Promise<boolean>;
}
