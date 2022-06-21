import { defineStore } from "pinia";
import { nanoid } from "nanoid";
import { AbstractBittorrentClient, type BittorrentClientBaseConfig, getDownloader } from "@ptpp/downloader";

interface downloadHistory {
  timestamp: number,
  clientId: string,

}

const downloaderInstanceCache: Map<string, AbstractBittorrentClient> = new Map();

export const useDownloaderStore = defineStore("downloader", {
  persistWebExt: true,
  state: () => ({
    defaultDownloaderId: null as unknown as string,
    clients: [] as BittorrentClientBaseConfig[],
    recordDownloadHistory: {
      enable: true,
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
      const clientIndex = this.clients.findIndex(data => {
        return data.id === clientId;
      });

      if (clientIndex !== -1) {
        this.clients.splice(clientIndex, 1);
      }

      // if this downloader is default downloader
      if (clientId === this.defaultDownloaderId) {
        this.defaultDownloaderId = null as unknown as string;
      }

      // Clean download History for this downloader
      this.recordDownloadHistory.records =
        this.recordDownloadHistory.records.filter(rec => rec.clientId !== clientId);
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
    }
  }
});
