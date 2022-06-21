/**
 * @see https://global.download.synology.com/download/Document/DeveloperGuide/Synology_Download_Station_Web_API.pdf
 * @see https://github.com/kwent/syno/tree/master/definitions
 * @see https://github.com/seansfkelley/synology-typescript-api
 */
import {
  AbstractBittorrentClient,
  CAddTorrentOptions,
  CTorrent,
  TorrentClientConfig,
  TorrentClientMetaData,
  CTorrentFilterRules,
  CTorrentState,
  TorrentClientStatus,
} from "../types";
import urlJoin from "url-join";
import axios, { AxiosRequestConfig } from "axios";
import { getRemoteTorrentFile } from "../utils";

export const clientConfig: TorrentClientConfig = {
  type: "synologyDownloadStation",
  name: "Synology Download Station",
  address: "http://mysd.com:5000/",
  username: "",
  password: "",
  timeout: 60 * 1e3,
};

// noinspection JSUnusedGlobalSymbols
export const clientMetaData: TorrentClientMetaData = {
  version: "v0.2.2",
  description: "Download Station是由Synology NAS提供的一款网页式下载应用程序",
  warning: ["DSM 4.2以及之后版本请勿开启二步验证选项"],
  feature: {
    CustomPath: {
      allowed: true,
      description:
        "因 Synology Download Station API 接口限制，保存目录依赖于“暂存位置”，并且只允许使用相对路径；<br/>如暂存位置为 /volume1/，期望存储目的地位置为 /volume1/music/，那么请在“目录列表”中填写：<span style='color:red'>music</span>",
    },
  },
};

// 定义API

type SYNOVersion = 1 | 2 | 3 | 4 | 5 | 6 | 7;

type SYNOApiCGIPath =
  | "query.cgi" // FOR API 'SYNO.API.Info'
  | "auth.cgi" // FOR API 'SYNO.API.Auth'
  | "DownloadStation/task.cgi" // FOR API DSMApiEndPointDownload
  | "entry.cgi"; // FOR API DSMApiEndPointDownloadV2 and other

/**
 * Base API
 */
type SynoApiEndPointBase =
  | "SYNO.API.Info" // Provides available API info
  | "SYNO.API.Auth"; // Performs session login and logout.

/**
 * Download Station API
 */
type SynoApiEndPointDownload =
  | "SYNO.DownloadStation.Info" // Provides Download Station info and settings. Sets Download Station settings.
  | "SYNO.DownloadStation.Schedule" // Provides advanced schedule settings. Sets advanced schedule settings.
  | "SYNO.DownloadStation.Task" // Provides task listing and detailed task information. Performs task actions: create, delete, resume, pause.
  | "SYNO.DownloadStation.Statistic" // Provides total download/upload statistics.
  | "SYNO.DownloadStation.RSS.Site" // Provides RSS site listing. Refreshes RSS site.
  | "SYNO.DownloadStation.RSS.Feed"; // Provides RSS feed listing.

/**
 * Download Station API v2
 * @note: This API v2 is not documented, So don't use it for any reason
 */
type SynoApiEndPointDownloadV2 =
  | "SYNO.DownloadStation2.BTSearch"
  | "SYNO.DownloadStation2.Captcha"
  | "SYNO.DownloadStation2.Package.Info"
  | "SYNO.DownloadStation2.Package.Module"
  | "SYNO.DownloadStation2.Package.Service"
  | "SYNO.DownloadStation2.RSS.Feed"
  | "SYNO.DownloadStation2.RSS.Filter"
  | "SYNO.DownloadStation2.RSS.Item"
  | "SYNO.DownloadStation2.Settings.BT"
  | "SYNO.DownloadStation2.Settings.BTSearch"
  | "SYNO.DownloadStation2.Settings.Emule"
  | "SYNO.DownloadStation2.Settings.Emule.Location"
  | "SYNO.DownloadStation2.Settings.FileHosting"
  | "SYNO.DownloadStation2.Settings.FtpHttp"
  | "SYNO.DownloadStation2.Settings.Global"
  | "SYNO.DownloadStation2.Settings.Location"
  | "SYNO.DownloadStation2.Settings.Nzb"
  | "SYNO.DownloadStation2.Settings.Rss"
  | "SYNO.DownloadStation2.Settings.Scheduler"
  | "SYNO.DownloadStation2.Task"
  | "SYNO.DownloadStation2.Task.BT"
  | "SYNO.DownloadStation2.Task.BT.File"
  | "SYNO.DownloadStation2.Task.BT.Peer"
  | "SYNO.DownloadStation2.Task.BT.Tracker"
  | "SYNO.DownloadStation2.Task.List"
  | "SYNO.DownloadStation2.Task.List.Polling"
  | "SYNO.DownloadStation2.Task.NZB.File"
  | "SYNO.DownloadStation2.Task.NZB.Log"
  | "SYNO.DownloadStation2.Task.Source"
  | "SYNO.DownloadStation2.Task.Statistic"
  | "SYNO.DownloadStation2.Task.eMule"
  | "SYNO.DownloadStation2.Thumbnail"
  | "SYNO.DownloadStation2.eMule.Search"
  | "SYNO.DownloadStation2.eMule.Server";

type SynoApiEndPoint =
  | SynoApiEndPointBase
  | SynoApiEndPointDownload
  | SynoApiEndPointDownloadV2;

type SynologySessionName = "DownloadStation" | "FileStation";

function transObjToData (field: Record<string, any>, toForm: true): FormData;
function transObjToData (
  field: Record<string, any>,
  toForm?: false
): URLSearchParams;
function transObjToData (field: Record<string, any>, toForm = false) {
  const data = toForm ? new FormData() : new URLSearchParams();
  Object.entries(field).forEach(([k, v]) => {
    if (v !== undefined) {
      if (Array.isArray(v)) {
        v = JSON.stringify(v);
      }
      data.append(k, v);
    }
  });
  return data;
}

// 定义API请求参数
interface DSRequestField {
  api: SynoApiEndPoint;
  version: SYNOVersion;
  method: string;
  _sid?: string;

  _useForm?: boolean;

  [propName: string]: any;
}

interface DSRequestFieldForApiAuth extends DSRequestField {
  api: "SYNO.API.Auth";
  version: 2 | 3 | 6;
  method: "login";
  account: string;
  passwd: string;
  session: SynologySessionName;
  format: "cookie" | "sid";
}

// 定义API响应
interface SynologySuccessResponse<S> {
  success: true;
  data: S;
}

/**
 * https://gist.github.com/Rhilip/fed6b4f69e3cc19b79c4ab17b9a17e93
 */
interface SynologyInfoApiResponseData {
  [key: string]: {
    maxVersion: SYNOVersion;
    minVersion: 1 | 2; // 未看到有高于这两个的，所以在这直接限定
    path: string;
    requestFormat?: "JSON";
  };
}

enum SynologyErrorCode {
  /**
   * Common Error Code
   */
  UNKNOWN_ERROR = 100, // Unknown error
  INVALID_PARAMETER = 101, // Invalid parameter
  API_NOT_EXIST = 102, // The requested API does not exist
  METHOD_NOT_EXIST = 103, // The requested method does not exist
  VERSION_NOT_SUPPORT = 104, // The requested version does not support the functionality
  PERMISSION_DENY = 105, // The logged in session does not have permission
  SESSION_TIMEOUT = 105, // Session timeout
  SESSION_INTERRUPTED = 106, // Session interrupted by duplicate login

  /**
   * Auth Error Code
   */
  AUTH_INCORRECT_AUTHENTICATION = 400, // No such account or incorrect password
  AUTH_ACCOUNT_DISABLED = 401, // Account disabled
  AUTH_PERMISSION_DENIED = 402, // Permission denied
  AUTH_VERIFICATION_CODE_REQUIRED = 403, // 2-step verification code required
  AUTH_VERIFICATION_CODE_FAILED = 404, //  Failed to authenticate 2-step verification code

  /**
   * Torrent Upload Error Code
   */
  TORRENT_UPLOAD_FAILED = 400, // File upload failed
  TORRENT_UPLOAD_MAX_TASKS_REACHED = 401, // Max number of tasks reached
  TORRENT_UPLOAD_DESTINATION_DENIED = 402, // Destination denied
  TORRENT_UPLOAD_DESTINATION_NOT_EXIST = 403, // Destination does not exist
  TORRENT_UPLOAD_INVALID_TASK_ID = 404, // Invalid task id
  TORRENT_UPLOAD_INVALID_TASK_ACTION = 405, // Invalid task action
  TORRENT_UPLOAD_NO_DEFAULT_DESTINATION = 406, // No default destination
  TORRENT_UPLOAD_SET_DESTINATION_FAILED = 407, // Set destination failed
  TORRENT_UPLOAD_FILE_NOT_EXIST = 408, // File does not exist
}

interface SynologyFailureResponse {
  success: false;
  error: {
    code: number;
    errors?: any[];
  };
}

type SynologyResponse<S> = SynologySuccessResponse<S> | SynologyFailureResponse;

type rawTaskStatus =
  | "downloading"
  | "error"
  | "extracting"
  | "filehosting_waiting"
  | "finished"
  | "finishing"
  | "hash_checking"
  | "paused"
  | "seeding"
  | "waiting";

// From SYNO.SDS.DownloadStation.Utils.TASK_STATUS_INT
enum rawTaskStatusInt {
  TASK_CAPTCHA_NEEDED = 15,
  TASK_DOWNLOADED = 13,
  TASK_DOWNLOADING = 2,
  TASK_ERROR = 101,
  TASK_ERROR_BROKEN_LINK = 102,
  TASK_ERROR_DEST_DENY = 104,
  TASK_ERROR_DEST_FILE_DUPLICATE = 132,
  TASK_ERROR_DEST_NO_EXIST = 103,
  TASK_ERROR_DISK_FULL = 105,
  TASK_ERROR_ED2K_LINK_DUPLICATE = 131,
  TASK_ERROR_ENCRYPTION = 126,
  TASK_ERROR_EXCEED_MAX_DEST_FS_SIZE = 110,
  TASK_ERROR_EXCEED_MAX_FS_SIZE = 108,
  TASK_ERROR_EXCEED_MAX_TEMP_FS_SIZE = 109,
  TASK_ERROR_EXTRACT_DISK_FULL = 122,
  TASK_ERROR_EXTRACT_FAIL = 118,
  TASK_ERROR_EXTRACT_FOLDER_NOT_EXIST = 129,
  TASK_ERROR_EXTRACT_INVALID_ARCHIVE = 120,
  TASK_ERROR_EXTRACT_QUOTA_REACHED = 121,
  TASK_ERROR_EXTRACT_WRONG_PASSWORD = 119,
  TASK_ERROR_FILE_NO_EXIST = 114,
  TASK_ERROR_FTP_ENCRYPTION_NOT_SUPPORT_TYPE = 117,
  TASK_ERROR_INVALID_ACCOUNT_PASSWORD = 134,
  TASK_ERROR_MISSING_PYTHON = 127,
  TASK_ERROR_NAME_TOO_LONG = 112,
  TASK_ERROR_NAME_TOO_LONG_ENCRYPTION = 111,
  TASK_ERROR_NOT_SUPPORT_TYPE = 116,
  TASK_ERROR_NZB_MISSING_ARTICLE = 130,
  TASK_ERROR_PARCHIVE_REPAIR_FAILED = 133,
  TASK_ERROR_PRIVATE_VIDEO = 128,
  TASK_ERROR_QUOTA_REACHED = 106,
  TASK_ERROR_REQUIRED_ACCOUNT = 124,
  TASK_ERROR_REQUIRED_PREMIUM = 115,
  TASK_ERROR_TIMEOUT = 107,
  TASK_ERROR_TORRENT_DUPLICATE = 113,
  TASK_ERROR_TORRENT_INVALID = 123,
  TASK_ERROR_TRY_IT_LATER = 125,
  TASK_EXTRACTING = 10,
  TASK_FILEHOSTING_WAITING = 9,
  TASK_FINISHED = 5,
  TASK_FINISHING = 4,
  TASK_HASH_CHECKING = 6,
  TASK_PAUSED = 3,
  TASK_POSTPROCESSING = 14,
  TASK_PREPROCESSING = 11,
  TASK_PREPROCESSPASS = 12,
  TASK_PRE_SEEDING = 7,
  TASK_SEEDING = 8,
  TASK_WAITING = 1,
}

interface rawTask {
  id: string; // Task ID
  type: "bt" | "nzb" | "http" | "https" | "ftp" | "emule";
  username: string | number; // Task owner
  title: string; // Task title
  size: number; // Task size in bytes

  /**
   * 如果通过 SYNO.DownloadStation.Task 接口，返回的是字符串
   * 但通过  SYNO.DownloadStation2.Task 接口，返回的是int，但映射关系目前不明确
   */
  status: rawTaskStatus | number;
  status_extra?: {
    /**
     * Available when status=error, providing error info.
     * Possible error_detail values are listed in Appendix
     * B: Values for Details of Erroneous Task.
     */
    error_detail?: string;
    /**
     * Available when status=extracting, ranging from 0
     * to 100.
     */
    unzip_progress?: number;
  };
  additional?: {
    detail?: {
      completed_time: number;
      destination: string;
      uri: string;
      created_time: number;
      priority: "auto" | "low" | "normal" | "high";
      total_peers: number;
      connected_seeders: number;
      connected_leechers: number;
    };
    transfer?: {
      size_downloaded: number;
      size_uploaded: number;
      speed_download: number;
      speed_upload: number;
    };
    file?: {
      filename: string;
      index: number;
      priority: "skip" | "low" | "normal" | "high";
      size: number;
      size_downloaded: number;
      wanted: boolean;
    }[];
    peer?: {
      address: string;
      agent: string;
      progress: number;
      speed_download: number;
      speed_upload: number;
    }[];
    tracker?: {
      downloaded_pieces: number;
      size_downloaded: number;
      size_uploaded: number;
      speed_download: number;
      speed_upload: number;
    }[];
  };
}

// noinspection JSUnusedGlobalSymbols
export default class SynologyDownloadStation extends AbstractBittorrentClient<TorrentClientConfig> {
  private _sessionId?: string;
  private _apiInfo?: SynologyInfoApiResponseData;

  constructor (options: Partial<TorrentClientConfig> = {}) {
    super({ ...clientConfig, ...options });
  }

  private async getSessionId (): Promise<string> {
    if (!this._sessionId) {
      await this.login();
    }
    return this._sessionId as string;
  }

  private async getApiInfo (): Promise<SynologyInfoApiResponseData> {
    if (!this._apiInfo) {
      // 我们不捕捉此处的错误
      const req = await this.request<SynologyInfoApiResponseData>("query.cgi", {
        params: {
          api: "SYNO.API.Info",
          method: "query",
          query: "all",
          version: 1,
        },
      });
      if (req.success) {
        this._apiInfo = req.data;
      }
    }
    return this._apiInfo as SynologyInfoApiResponseData;
  }

  // 核心请求方法
  private async request<T> (
    cgi: SYNOApiCGIPath,
    config: AxiosRequestConfig
  ): Promise<SynologyResponse<T>> {
    return (
      await axios.request<SynologyResponse<T>>({
        baseURL: this.config.address,
        url: urlJoin("webapi", cgi),
        timeout: this.config.timeout,
        withCredentials: false,
        ...config,
      })
    ).data;
  }

  // entry.cgi 请求方法
  private async requestEntryCGI<T> (
    field: DSRequestField | FormData
  ): Promise<SynologyResponse<any>> {
    // 覆写 _sid 参数
    const sid = await this.getSessionId();

    let postData;
    if (field instanceof FormData) {
      postData = field;
      postData.set("_sid", sid);
    } else {
      field._sid = sid;
      postData = transObjToData(field);
    }

    return await this.request<T>("entry.cgi", {
      method: "post",
      data: postData,
    });
  }

  // 请求登录并获得sid信息
  private async login (): Promise<boolean> {
    const apiInfo = await this.getApiInfo();

    /**
     * fix: https://github.com/ronggang/PT-Plugin-Plus/issues/687
     * 由于 DSM 7 以上， SYNO.API.Auth 接口当 version 为 2 时，会直接报 103 错误
     * 此时将 version 指到 3，可以正常获得 sid
     */
    const loginVersion =
      (apiInfo["SYNO.API.Auth"]?.maxVersion || 6) >= 7 ? 3 : 2;

    try {
      const req = await this.request<{ sid: string }>("auth.cgi", {
        params: {
          api: "SYNO.API.Auth",
          version: loginVersion,
          method: "login",
          account: this.config.username,
          passwd: this.config.password,
          session: "DownloadStation",
          format: "sid",
        } as DSRequestFieldForApiAuth,
      });
      if (req.success) {
        this._sessionId = req.data.sid;
      }

      return req.success;
    } catch (e) {
      return false;
    }
  }

  async ping (): Promise<boolean> {
    return this.login();
  }

  protected async getClientVersionFromRemote (): Promise<string> {
    return ""; // TODO
  }

  async addTorrent (
    url: string,
    options: Partial<CAddTorrentOptions> = {}
  ): Promise<boolean> {
    // 基本参数
    const params: DSRequestField = {
      api: "SYNO.DownloadStation2.Task",
      method: "create",
      version: 2,
      create_list: false,
    };

    /**
     * destination 和 type 很奇怪，不包一层的话，会报 对应项 缺失。。。。。
     *
     * - 对于 destination:
     *    如果外部不传入 savePath ，我们须设置一个空值出来，否则 DSM 会报 error_code 120
     *    此时 DSM 会将文件放置在 默认目的地文件夹
     */
    params.destination = `"${options.savePath || ""}"`;

    let postData;
    if (url.startsWith("magnet:") || !options.localDownload) {
      params.type = '"url"';
      params.url = [url];
      postData = params;
    } else {
      params.type = '"file"';
      params.file = ["torrent"];
      postData = transObjToData(params, true);

      // 获得本地请求的种子内容
      const torrent = await getRemoteTorrentFile({
        url,
        ...(options.localDownloadOption || {}),
      });

      postData.append("torrent", torrent.metadata.blob(), torrent.name);
    }

    const req = await this.requestEntryCGI<{
      list_id: any[] /* 不知道具体返回情况 */;
      task_id: string[];
    }>(postData);

    // DS不支持在添加的时候设置暂停状态，所以我们要在添加后暂停对应任务
    if (req.success) {
      if (options.addAtPaused && req.data.task_id.length > 0) {
        await this.pauseTorrent(req.data.task_id[0]);
      }
    }

    // TODO 添加异常处理方法

    return req.success;
  }

  async getAllTorrents (): Promise<CTorrent[]> {
    return await this.getTorrentsBy({});
  }

  override async getTorrentsBy (
    filter: CTorrentFilterRules
  ): Promise<CTorrent[]> {
    const params: DSRequestField = {
      api: "SYNO.DownloadStation2.Task",
      method: "list",
      version: 2,
      // limit: -1,
      // offset: 0,
      additional: ["detail", "transfer"],
    };

    if (filter.ids) {
      params.method = "get";
      params.id = filter.ids;
    }

    const req = (await this.requestEntryCGI(
      params
    )) as SynologySuccessResponse<{
      offset: number;
      task: rawTask[];
      total: number;
    }>;

    return req.data.task
      .filter((s) => s.type === "bt" /** 只选择bt种子返回 */)
      .map((task) => {
        let state = CTorrentState.unknown;
        if (typeof task.status === "string") {
          switch (task.status) {
            case "downloading":
            case "extracting":
              state = CTorrentState.downloading;
              break;

            case "seeding":
            case "finished":
            case "finishing":
              state = CTorrentState.seeding;
              break;

            case "paused":
              state = CTorrentState.paused;
              break;

            case "filehosting_waiting":
            case "waiting":
              state = CTorrentState.queued;
              break;

            case "hash_checking":
              state = CTorrentState.checking;
              break;

            case "error":
              state = CTorrentState.error;
              break;
          }
        } else {
          /**
           * (typeof task.status === 'number')
           * https://gist.github.com/Rhilip/e1b72f5d5974998077805e5c31f1d53d#file-download-js-L746-L748
           */
          if (task.status > rawTaskStatusInt.TASK_ERROR) {
            state = CTorrentState.error; // 统一处理 state 大于 rawTaskStatusInt.TASK_ERROR 的情况
          } else {
            switch (task.status) {
              case rawTaskStatusInt.TASK_WAITING:
              case rawTaskStatusInt.TASK_PREPROCESSING:
              case rawTaskStatusInt.TASK_PREPROCESSPASS:
              case rawTaskStatusInt.TASK_CAPTCHA_NEEDED:
                state = CTorrentState.queued;
                break;

              case rawTaskStatusInt.TASK_DOWNLOADING:
              case rawTaskStatusInt.TASK_EXTRACTING: // 认为解压过程也是属于 download 状态
                state = CTorrentState.downloading;
                break;

              // 我们认为一些 finishing 和 finished 也是属于 paused 状态
              case rawTaskStatusInt.TASK_PAUSED:
              case rawTaskStatusInt.TASK_FINISHING:
              case rawTaskStatusInt.TASK_DOWNLOADED:
              case rawTaskStatusInt.TASK_POSTPROCESSING:
              case rawTaskStatusInt.TASK_FINISHED:
                state = CTorrentState.paused;
                break;

              case rawTaskStatusInt.TASK_HASH_CHECKING:
                state = CTorrentState.checking;
                break;

              case rawTaskStatusInt.TASK_PRE_SEEDING:
              case rawTaskStatusInt.TASK_SEEDING:
                state = CTorrentState.seeding;
                break;
            }
          }
        }

        const isCompleted = task.additional!.detail!.completed_time > 0;
        const upload = task.additional!.transfer!.size_uploaded;
        const download = task.additional!.transfer!.size_downloaded;

        return {
          id: task.id,
          infoHash: task.id, // 注意DS的返回信息中没有info_hash，故使用id替代
          name: task.title,
          state,
          dateAdded: task.additional!.detail!.created_time,
          isCompleted,
          progress: download / task.size,
          savePath: task.additional!.detail!.destination,
          totalSize: task.size,
          ratio: upload / download,
          uploadSpeed: task.additional!.transfer!.speed_upload,
          downloadSpeed: task.additional!.transfer!.speed_download,
          totalUploaded: upload,
          totalDownloaded: download,
          raw: task,
          clientId: this.config.id,
        } as CTorrent<rawTask>;
      });
  }

  async pauseTorrent (id: string): Promise<boolean> {
    return (
      await this.requestEntryCGI({
        id: id,
        api: "SYNO.DownloadStation2.Task",
        method: "pause",
        version: 2,
      })
    ).success;
  }

  async resumeTorrent (id: string): Promise<boolean> {
    return (
      await this.requestEntryCGI({
        id: id,
        api: "SYNO.DownloadStation2.Task",
        method: "resume",
        version: 2,
      })
    ).success;
  }

  /**
   * 注意，因为DSM的原因（不支持 只删除种子不删除文件），removeData配置项不会起作用，
   *
   * @param id
   * @param removeData
   */
  async removeTorrent (
    id: any,
    removeData: boolean | undefined
  ): Promise<boolean> {
    return (
      await this.requestEntryCGI({
        id: id,
        api: "SYNO.DownloadStation2.Task",
        method: "delete",
        version: 2,
        // Delete tasks and force to move uncompleted download files to the destination.
        force_complete: false,
      })
    ).success;
  }
}
