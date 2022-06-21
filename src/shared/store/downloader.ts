import {defineStore} from "pinia";
import {BittorrentClientBaseConfig} from "@ptpp/downloader";
import {nanoid} from "nanoid";

export const useDownloaderStore = defineStore("downloader", {
  persistWebExt: true,
  state: () => ({
    defaultDownloaderId: null as unknown as string,
    clients: [] as BittorrentClientBaseConfig[]
  }),

  getters: {
    isDefaultDownloader(state) {
      return (clientId: string) => state.defaultDownloaderId === clientId;
    }
  },

  actions: {
    getClient(clientId: string) {
      return this.clients.find(data => {
        return data.id === clientId;
      });
    },

    addClient(client: BittorrentClientBaseConfig) {
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

    patchClient(client: BittorrentClientBaseConfig) {
      const clientIndex = this.clients.findIndex(data => {
        return data.id === client.id;
      });
      this.clients[clientIndex] = client;
    },

    removeClient(clientId: string) {
      const clientIndex = this.clients.findIndex(data => {
        return data.id === clientId;
      });

      if (clientIndex !== -1) {
        this.clients.splice(clientIndex, 1);
      }

      if (clientId === this.defaultDownloaderId) {
        this.defaultDownloaderId = null as unknown as string;
      }
    }
  }
});
