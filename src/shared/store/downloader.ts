import { defineStore } from "pinia";
import { nanoid } from "nanoid";
import {
  getDownloader,
  AbstractBittorrentClient,
  type BittorrentClientBaseConfig,
  type CAddTorrentOptions
} from "@ptpp/downloader";
import { remove } from "lodash-es";

interface downloadHistory {
  id: string,
  timestamp: number,
  clientId: string,
  url: string,
  options: CAddTorrentOptions
}

const downloaderInstanceCache: Map<string, AbstractBittorrentClient> = new Map();

export const useDownloaderStore = defineStore("downloader", {
  persistWebExt: true,
  state: () => ({
    defaultDownloaderId: null as unknown as string,
    clients: [] as BittorrentClientBaseConfig[],
    recordDownloadHistory: {
      enable: true,
      maxRecord: 100,
      records: [] as downloadHistory[],
    },
    retryOnDownload: {
      enable: false,
      times: 3,
      period: 5
    },
    useBackgroundTask: false,
    confirmOnExceedSize: {
      enable: true,
      exceedSize: 10,
      exceedSizeUnit: "GiB"
    }
  }),

  getters: {
    isDefaultDownloader(state) {
      return (clientId: string) => state.defaultDownloaderId === clientId;
    }
  },

  actions: {
    getDownloaderConfig(clientId: string) {
      return this.clients.find(data => {
        return data.id === clientId;
      });
    },

    addDownloaderConfig(client: BittorrentClientBaseConfig) {
      // 为这个client辅初始uid
      if (typeof client.id === "undefined") {
        client.id = nanoid();
      }

      this.clients.push(client);

      // 如果此时只有一个下载器，这将这个下载器设置为默认下载器
      if (this.clients.length === 1) {
        this.defaultDownloaderId = client.id!;
      }
    },

    patchDownloaderConfig(client: BittorrentClientBaseConfig) {
      const clientIndex = this.clients.findIndex(data => {
        return data.id === client.id;
      });
      this.clients[clientIndex] = client;
    },

    removeDownloaderConfig(clientId: string) {
      const removedClient = remove(this.clients, client => client.id === clientId);

      // if this downloader is default downloader
      if (clientId === this.defaultDownloaderId) {
        this.defaultDownloaderId = null as unknown as string;
      }

      // Clean download History for this downloader
      remove(this.recordDownloadHistory.records, rec => rec.clientId === clientId);
    },

    async getDownloader(clientId: string): Promise<AbstractBittorrentClient> {
      if (!downloaderInstanceCache.has(clientId)) {
        const downloaderConfig = this.getDownloaderConfig(clientId)!;

        const downloaderInstance = await getDownloader(downloaderConfig);

        // TODO Do some wrapper for create downloaderInstance to support recordDownloadHistory, retryOnDownload
        // const downloaderInstanceProxy = new Proxy(downloaderInstance, {});

        downloaderInstanceCache.set(clientId, downloaderInstance);
      }

      return downloaderInstanceCache.get(clientId)!;
    },

    addDownloadRecord(record: Omit<downloadHistory, "timestamp" | "id">) {
      if (this.recordDownloadHistory.enable) {
        this.recordDownloadHistory.records.push({
          id: nanoid(),
          timestamp: +new Date(),
          ...record
        });

        if (this.recordDownloadHistory.records.length > this.recordDownloadHistory.maxRecord) {
          this.recordDownloadHistory.records.splice(0,
            this.recordDownloadHistory.records.length - this.recordDownloadHistory.maxRecord);
        }
      }
    },

    removeDownloadRecord(recordId: string) {
      remove(this.recordDownloadHistory.records, data => data.id === recordId);
    },

    clearDownloadRecord() {
      this.recordDownloadHistory.records = [];
    }
  }
});
