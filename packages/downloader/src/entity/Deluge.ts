/**
 * @see https://deluge.readthedocs.io/en/develop/reference/index.html
 */
import {
  CAddTorrentOptions,
  CustomPathDescription,
  CTorrent,
  BittorrentClientBaseConfig,
  TorrentClientMetaData,
  CTorrentFilterRules,
  CTorrentState,
  TorrentClientStatus,
  AbstractBittorrentClient,
} from "../types";
import urlJoin from "url-join";
import axios from "axios";
import { getRemoteTorrentFile } from "../utils";

export const clientConfig: BittorrentClientBaseConfig = {
  type: "Deluge",
  name: "Deluge",
  address: "http://localhost:8112/",
  password: "",
  timeout: 60 * 1e3,
};

// noinspection JSUnusedGlobalSymbols
export const clientMetaData: TorrentClientMetaData = {
  version: "v0.1.0",
  description: "Deluge 是一个通过PyGTK建立图形界面的BitTorrent客户端",
  warning: [
    "仅支持Deluge Web，非Deluge Daemon的直接支持，具体原因请见 issue #207",
    "注意：由于 Deluge 验证机制限制，第一次测试连接成功后，后续测试无论密码正确与否都会提示成功。",
  ],
  feature: {
    CustomPath: {
      allowed: true,
      description: CustomPathDescription,
    },
  },
};

type DelugeMethod =
  | "auth.login"
  | "web.update_ui"
  | "core.get_torrents_status"
  | "core.add_torrent_url"
  | "core.add_torrent_file"
  | "core.get_free_space"
  | "core.get_session_status"
  | "core.remove_torrent"
  | "core.pause_torrent"
  | "core.resume_torrent"
  | "daemon.info"
  | "core.get_libtorrent_version"
  | "label.set_torrent";

interface DelugeDefaultResponse<T = any> {
  /**
   * mostly usless id that increments with every request
   */
  id: number;
  error: null | string;
  result: T;
}

type DelugeTorrentField =
  | "comment"
  | "active_time"
  | "is_seed"
  | "hash"
  | "upload_payload_rate"
  | "move_completed_path"
  | "private"
  | "total_payload_upload"
  | "paused"
  | "seed_rank"
  | "seeding_time"
  | "max_upload_slots"
  | "prioritize_first_last"
  | "distributed_copies"
  | "download_payload_rate"
  | "message"
  | "num_peers"
  | "max_download_speed"
  | "max_connections"
  | "compact"
  | "ratio"
  | "total_peers"
  | "total_size"
  | "total_wanted"
  | "state"
  | "file_priorities"
  | "max_upload_speed"
  | "remove_at_ratio"
  | "tracker"
  | "save_path"
  | "progress"
  | "time_added"
  | "tracker_host"
  | "total_uploaded"
  | "files"
  | "total_done"
  | "num_pieces"
  | "tracker_status"
  | "total_seeds"
  | "move_on_completed"
  | "next_announce"
  | "stop_at_ratio"
  | "file_progress"
  | "move_completed"
  | "piece_length"
  | "all_time_download"
  | "move_on_completed_path"
  | "num_seeds"
  | "peers"
  | "name"
  | "trackers"
  | "total_payload_download"
  | "is_auto_managed"
  | "seeds_peers_ratio"
  | "queue"
  | "num_files"
  | "eta"
  | "stop_ratio"
  | "is_finished"
  | "label"; // if they don't have the label plugin it shouldn't fail

interface DelugeRawTorrent {
  hash: string;
  name: string;
  progress: number;
  ratio: number;
  time_added: number;
  save_path: string;
  label?: string;
  state:
    | "Downloading"
    | "Seeding"
    | "Active"
    | "Paused"
    | "Queued"
    | "Checking"
    | "Error";
  total_size: number;
  upload_payload_rate: number;
  download_payload_rate: number;
  total_uploaded: number;
  total_done: number;
}

interface DelugeTorrentFilterRules extends CTorrentFilterRules {
  hash?: string;
  state?: string;
}

// noinspection JSUnusedGlobalSymbols
export default class Deluge extends AbstractBittorrentClient {


  private readonly address: string;
  private _msgId: number;
  private isLogin = false;

  private torrentRequestField: DelugeTorrentField[] = [
    "hash",
    "name",
    "progress",
    "ratio",
    "time_added",
    "save_path",
    "label",
    "state",
    "total_size",
  ];

  constructor (options: Partial<BittorrentClientBaseConfig>) {
    super({ ...clientConfig, ...options });
    this._msgId = 0;

    // 修正服务器地址
    let address = this.config.address;
    if (address.indexOf("json") === -1) {
      address = urlJoin(address, "/json");
    }
    this.address = address;
  }

  async ping (): Promise<boolean> {
    return await this.login();
  }

  protected async getClientVersionFromRemote (): Promise<string> {
    const version = await this.request<string>("daemon.info");
    const ltVersion = await this.request<string>("core.get_libtorrent_version");
    return `${version} (lt ${ltVersion})`;
  }

  override async getClientStatus (): Promise<TorrentClientStatus> {
    const statusKeys = [
      "download_rate", "upload_rate",
      "total_download", "total_upload",
    ] as const;
    const statusData = await this.request<Record<typeof statusKeys[number], number>>("core.get_session_status", [statusKeys]);

    return {
      upSpeed: statusData.upload_rate,
      dlSpeed: statusData.download_rate,
      upData: statusData.total_upload,
      dlData: statusData.total_download,
    };
  }

  override async getClientFreeSpace (): Promise<number> {
    return await this.request<number>("core.get_free_space");
  }

  async addTorrent (
    url: string,
    options: Partial<CAddTorrentOptions> = {}
  ): Promise<boolean> {
    const delugeOptions: any = {
      add_paused: options.addAtPaused ?? false,
    };

    if (options.savePath) {
      delugeOptions.download_location = options.savePath;
    }

    // 由于Deluge添加链接和种子的方法名不一样，分开处理
    let method: "core.add_torrent_file" | "core.add_torrent_url";
    let params: any;
    if (url.startsWith("magnet:") || !options.localDownload) {
      // 链接 add_torrent_url
      method = "core.add_torrent_url";
      params = [url, delugeOptions];
    } else {
      // 文件 add_torrent_file
      method = "core.add_torrent_file";

      const torrent = await getRemoteTorrentFile({
        url,
        ...(options.localDownloadOption || {}),
      });

      params = ["", torrent.metadata.base64, delugeOptions];
    }

    try {
      const result = await this.request<any>(method, params);
      if (result !== null && options.label) {
        try {
          const torrentHash = result[0][1];
          await this.request("label.set_torrent", [torrentHash, options.label]);
        } catch (e) {
        } // 即使失败了也没关系
      }

      return result !== null;
    } catch (e) {
      return false;
    }
  }

  async getAllTorrents (): Promise<CTorrent<DelugeRawTorrent>[]> {
    return await this.getTorrentsBy({});
  }

  override async getTorrentsBy (
    filter: DelugeTorrentFilterRules
  ): Promise<CTorrent<DelugeRawTorrent>[]> {
    if (filter.ids) {
      filter.hash = filter.ids;
      delete filter.ids;
    }

    if (filter.complete) {
      filter.state = "Seeding";
      delete filter.complete;
    }

    const torrents = await this.request<Record<string, DelugeRawTorrent>>(
      "core.get_torrents_status",
      [filter, this.torrentRequestField]
    );

    return Object.values(torrents).map((torrent) => {
      // normalize state to enum
      let state = CTorrentState.unknown;
      if (Object.keys(CTorrentState).includes(torrent.state.toLowerCase())) {
        state =
          CTorrentState[
            torrent.state.toLowerCase() as keyof typeof CTorrentState
            ];
      }

      return {
        id: torrent.hash,
        infoHash: torrent.hash,
        isCompleted: torrent.progress >= 100,
        dateAdded: torrent.time_added,
        name: torrent.name,
        progress: torrent.progress,
        ratio: torrent.ratio,
        savePath: torrent.save_path,
        state,
        totalSize: torrent.total_size,
        uploadSpeed: torrent.upload_payload_rate,
        downloadSpeed: torrent.download_payload_rate,
        totalUploaded: torrent.total_uploaded,
        totalDownloaded: torrent.total_done,
        raw: torrent,
        clientId: this.config.id,
      } as CTorrent<DelugeRawTorrent>;
    });
  }

  async pauseTorrent (id: any): Promise<boolean> {
    try {
      return await this.request<boolean>("core.pause_torrent", [id]);
    } catch (e) {
      return false;
    }
  }

  async removeTorrent (id: string, removeData = false): Promise<boolean> {
    try {
      return await this.request<boolean>("core.remove_torrent", [
        id,
        removeData,
      ]);
    } catch (e) {
      return false;
    }
  }

  async resumeTorrent (id: any): Promise<boolean> {
    try {
      return await this.request<boolean>("core.resume_torrent", [id]);
    } catch (e) {
      return false;
    }
  }

  private async login (): Promise<boolean> {
    try {
      this.isLogin = await this.request<boolean>("auth.login", [
        this.config.password,
      ]);
      return this.isLogin;
    } catch (e) {
      return false;
    }
  }

  private async request<T> (
    method: DelugeMethod,
    params: any[] = []
  ): Promise<T> {
    // 防止循环调用
    if (!this.isLogin && method !== "auth.login") {
      await this.login();
    }

    const {
      data: { result },
    } = await axios.post<DelugeDefaultResponse<T>>(
      this.address,
      {
        id: this._msgId++,
        method: method,
        params: params,
      },
      {
        responseType: "json",
      }
    );
    return result;
  }
}
