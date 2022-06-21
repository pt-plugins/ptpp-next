/**
 * 使用 ws + rpc-secret 形式访问，
 * 原因在于如果发送metadata的话，使用 http 会空返回，
 * 但是允许用户填入 http:// 开头的地址
 */
import {
  CAddTorrentOptions,
  CustomPathDescription,
  CTorrent,
  BittorrentClientBaseConfig,
  TorrentClientMetaData,
  CTorrentState,
  TorrentClientStatus,
  AbstractBittorrentClient,
} from "../types";
import { getRemoteTorrentFile } from "../utils";
import urlJoin from "url-join";

export const clientConfig: BittorrentClientBaseConfig = {
  type: "Aria2",
  name: "Aria2",
  address: "http://localhost:6800/jsonrpc",
  password: "",
  timeout: 60 * 1e3,
};

export const clientMetaData: TorrentClientMetaData = {
  version: "v0.1.0",
  description: "Aria2是一款自由、跨平台命令行界面的下载管理器",
  warning: [
    "使用 WebSocket + `rpc-secret` 形式连接，请设置好 `rpc-secret` 配置项",
    "不支持使用用户名+密码的认证方式",
  ],
  feature: {
    CustomPath: {
      allowed: true,
      description: CustomPathDescription,
    },
  },
};

type METHODS =
  | "aria2.addUri"
  | "aria2.addTorrent"
  | "aria2.getPeers"
  | "aria2.addMetalink"
  | "aria2.remove"
  | "aria2.pause"
  | "aria2.forcePause"
  | "aria2.pauseAll"
  | "aria2.forcePauseAll"
  | "aria2.unpause"
  | "aria2.unpauseAll"
  | "aria2.forceRemove"
  | "aria2.changePosition"
  | "aria2.tellStatus"
  | "aria2.getUris"
  | "aria2.getFiles"
  | "aria2.getServers"
  | "aria2.tellActive"
  | "aria2.tellWaiting"
  | "aria2.tellStopped"
  | "aria2.getOption"
  | "aria2.changeUri"
  | "aria2.changeOption"
  | "aria2.getGlobalOption"
  | "aria2.changeGlobalOption"
  | "aria2.purgeDownloadResult"
  | "aria2.removeDownloadResult"
  | "aria2.getVersion"
  | "aria2.getSessionInfo"
  | "aria2.shutdown"
  | "aria2.forceShutdown"
  | "aria2.getGlobalStat"
  | "aria2.saveSession"
  | "system.multicall"
  | "system.listMethods"
  | "system.listNotifications";

type multiCallParams = {
  methodName: METHODS;
  params: any[];
}[];

interface jsonRPCResponse<Data> {
  id: string;
  jsonrpc: "2.0";
  result: Data;
  error?: { code: number; message: string };
}

interface rawTask {
  bitfield: string;
  completedLength: number;
  connections: `${1 | 0}`;
  dir: string;
  downloadSpeed: number;
  files: {
    completedLength: number;
    index: number;
    length: number;
    path: string;
    selected: string;
    uris: {
      status: string;
      url: string;
    }[];
  }[];
  gid: string;
  numPieces: number;
  pieceLength: number;
  status:
    | "active" // active for currently downloading/seeding downloads.
    | "waiting" // waiting for downloads in the queue; download is not started.
    | "paused" // paused for paused downloads.
    | "error" // error for downloads that were stopped because of error.
    | "complete" // complete for stopped and completed downloads.
    | "removed"; // removed for the downloads removed by user.
  totalLength: number;
  uploadLength: number;
  uploadSpeed: number;

  // If it is a bittorrent
  bittorrent?: {
    announceList: string[][];
    comment: string;
    creationDate: number;
    info: {
      name: string;
    };
    mode: "single" | "multi";
  };
  infoHash?: string;
  seeder?: string;
  numSeeders?: number;
}

export default class Aria2 extends AbstractBittorrentClient {
  private _wsClient: WebSocket;
  private _msgId = 0;

  get msgId() {
    return this._msgId++;
  }

  constructor(options: Partial<BittorrentClientBaseConfig>) {
    super({ ...clientConfig, ...options });

    // 修正服务器地址
    let address = this.config.address;
    if (address.indexOf("jsonrpc") === -1) {
      address = urlJoin(address, "/jsonrpc");
    }
    this.config.address = address;

    // https -> wss , http -> ws
    this._wsClient = new WebSocket(address.replace(/^http/, "ws"));
  }

  private async methodSend<T>(methodName: METHODS, params: any[] = []): Promise<jsonRPCResponse<T>> {
    return new Promise((resolve, reject) => {
      let postParams;
      if (methodName === "system.multicall") {
        (params as multiCallParams).forEach((x) => {
          x.params = [`token:${this.config.password}`, ...x.params];
        });

        postParams = [params];
      } else {
        postParams = [`token:${this.config.password}`, ...params];
      }

      const msgId = String(this.msgId);

      this._wsClient.addEventListener("message", (event) => {
        const data: jsonRPCResponse<T> = JSON.parse(event.data);
        if (data.id === msgId) {
          // 保证消息一致性
          resolve(data);
        } else if (data.error) {
          reject(new Error(data.error?.message || "WS ERROR"));
        }
      });

      this._wsClient.send(
        JSON.stringify({
          method: methodName,
          id: msgId,
          params: postParams
        })
      );
    });
  }

  async ping(): Promise<boolean> {
    try {
      const { result: pingData } = await this.methodSend<{
        version: string;
        enabledFeatures: string[];
      }>("aria2.getVersion");
      return pingData.version.includes(".");
    } catch (e) {
      return false;
    }
  }

  protected async getClientVersionFromRemote(): Promise<string> {
    const { result: versionData } = await this.methodSend<{
      version: string;
      enabledFeatures: string[];
    }>("aria2.getVersion");
    return versionData.version;
  }

  // Aria2 只能知道当前的传输速度，其他都不知道
  override async getClientStatus(): Promise<TorrentClientStatus> {
    const { result: statusData } = await this.methodSend<{
      downloadSpeed: string;
      uploadSpeed: string;
    }>("aria2.getGlobalStat");
    return {
      dlSpeed: Number(statusData.downloadSpeed),
      upSpeed: Number(statusData.uploadSpeed),
    };
  }

  async addTorrent(url: string, options: Partial<CAddTorrentOptions> = {}): Promise<boolean> {
    const addOption: any = {
      pause: options.addAtPaused ?? false,
    };

    if (options.savePath) {
      addOption.dir = options.savePath;
    }

    let method: "aria2.addUri" | "aria2.addTorrent";
    let params: any;
    if (url.startsWith("magnet:") || !options.localDownload) {
      // 链接 add_torrent_url
      method = "aria2.addUri";
      params = [[url], addOption];
    } else {
      // 文件 add_torrent_file
      method = "aria2.addTorrent";

      const torrent = await getRemoteTorrentFile({
        url,
        ...(options.localDownloadOption ?? {}),
      });

      params = [torrent.metadata.base64, [], addOption];
    }

    try {
      await this.methodSend<string>(method, params);
      return true;
    } catch (e) {
      return false;
    }
  }

  async getAllTorrents(): Promise<CTorrent<rawTask>[]> {
    const torrents: CTorrent[] = [];
    const { result: tasks } = await this.methodSend<[[rawTask[]], [rawTask[]], [rawTask[]]]>("system.multicall", [
      {
        methodName: "aria2.tellActive",
        params: []
      },
      {
        methodName: "aria2.tellWaiting",
        params: [0, 1000]
      },
      {
        methodName: "aria2.tellStopped",
        params: [0, 1000]
      },
    ] as multiCallParams);

    tasks.forEach((task) => {
      task[0].forEach((rawTask) => {
        // 注意，我们只筛选bittorrent种子，对于其他类型的task，我们不做筛选
        if (rawTask.bittorrent) {
          torrents.push(this.parseRawTorrent(rawTask));
        }
      });
    });

    return torrents;
  }

  override async getTorrent(id: string): Promise<CTorrent<rawTask>> {
    const { result: task } = await this.methodSend<rawTask>(
      "aria2.tellStatus",
      [id]
    );
    return this.parseRawTorrent(task);
  }

  async pauseTorrent(id: string): Promise<boolean> {
    await this.methodSend<string>("aria2.pause", [id]);
    return true;
  }

  async removeTorrent(id: string, removeData?: boolean): Promise<boolean> {
    await this.methodSend<string>("aria2.remove", [id]);
    await this.methodSend<"OK">("aria2.removeDownloadResult", [id]);
    return true;
  }

  async resumeTorrent(id: any): Promise<boolean> {
    await this.methodSend<string>("aria2.unpause", [id]);
    return true;
  }

  private parseRawTorrent(rawTask: rawTask): CTorrent<rawTask> {
    const progress = rawTask.completedLength / rawTask.totalLength || 0;
    let state = CTorrentState.unknown;
    switch (rawTask.status) {
      case "active":
        state =
          progress >= 100 ? CTorrentState.seeding : CTorrentState.downloading;
        break;

      case "error":
      case "removed":
        state = CTorrentState.error;
        break;

      case "complete":
      case "paused":
        state = CTorrentState.paused;
        break;

      case "waiting":
        state = CTorrentState.queued;
        break;
    }

    return {
      id: rawTask.gid,
      infoHash: rawTask.infoHash!,
      name: rawTask.bittorrent!.info.name,
      progress,
      isCompleted: progress >= 100,
      ratio: rawTask.uploadLength / rawTask.totalLength || 0,
      dateAdded: 0, // Aria2 不返回添加时间
      savePath: rawTask.dir,
      state,
      totalSize: Number(rawTask.totalLength),
      totalUploaded: Number(rawTask.uploadLength),
      totalDownloaded: Number(rawTask.completedLength),
      uploadSpeed: Number(rawTask.uploadSpeed),
      downloadSpeed: Number(rawTask.downloadSpeed),
      raw: rawTask,
      clientId: this.config.id,
    } as CTorrent<rawTask>;
  }
}
