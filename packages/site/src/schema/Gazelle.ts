import PrivateSite from "../schema/AbstractPrivateSite";
import {
  ISiteMetadata,
  ETorrentStatus,
  ITorrent,
  listSelectors,
} from "../types";
import Sizzle from "sizzle";
import { merge } from "lodash-es";
import dayjs from "../utils/datetime";
import { parseSizeString } from "../utils";

export default class Gazelle extends PrivateSite {
  protected override readonly initConfig: Partial<ISiteMetadata> = {
    search: {
      keywordsParam: "searchstr",
      requestConfig: {
        url: "/torrents.php",
        responseType: "document",
        params: { searchsubmit: 1 },
      },
      selectors: {
        rows: { selector: "table.torrent_table:last > tbody > tr:gt(0)" },
        id: {
          selector: "a[href*='torrents.php?id=']",
          attr: "href",
          filters: [
            (query: string) => {
              const searchParams = new URL(query).searchParams;
              return searchParams.get("torrentid") || searchParams.get("id");
            },
          ],
        },
        title: { selector: "a[href*='torrents.php?id=']" },
        url: { selector: "a[href*='torrents.php?id=']", attr: "href" },
        link: {
          selector:
            "a[href*='torrents.php?action=download'][title='Download']:first",
          attr: "href",
        },
        // TODO category: {}
        time: {
          elementProcess: (element: HTMLElement) => {
            const AccurateTimeAnother = element.querySelector(
              "span[title], time[title]"
            );
            if (AccurateTimeAnother) {
              return AccurateTimeAnother.getAttribute("title")! + ":00";
            } else if (element.getAttribute("title")) {
              return element.getAttribute("title")! + ":00";
            } else {
              return element.innerText.trim() + ":00";
            }
          },
        },

        progress: { text: 0 },
        status: { text: ETorrentStatus.unknown },
      },
    },
    userInfo: {
      process: [
        {
          requestConfig: { url: "/index.php", responseType: "document" },
          fields: ["id", "name", "messageCount"],
        },
        {
          requestConfig: {
            url: "/user.php",
            params: {
              /* id: flushUserInfo.id */
            },
            responseType: "document",
          },
          assertion: { id: "id" },
          fields: [
            "uploaded",
            "downloaded",
            "ratio",
            "levelName",
            "bonus",
            "joinTime", // Gazelle ?????????
            "seeding",
            "seedingSize",
          ],
        },
      ],
      selectors: {
        // "page": "/index.php",
        id: {
          selector: ["a.username[href*='user.php']:first"],
          attr: "href",
          filters: [
            (query: string) => parseInt(new URL(query).searchParams.get("id") || ""),
          ],
        },
        name: {
          selector: ["a.username[href*='user.php']:first"],
        },
        messageCount: {
          selector: [
            "div.alert-bar > a[href*='inbox.php']",
            "div.alertbar > a[href*='inbox.php']",
          ],
          filters: [
            (query: string) => {
              const queryMatch = query.match(/(\d+)/);
              return queryMatch && queryMatch.length >= 2
                ? parseInt(queryMatch[1])
                : 0;
            },
          ],
        },

        // "page": "/user.php?id=$user.id$",
        uploaded: {
          selector:
            "div:contains('Stats') + ul.stats > li:contains('Uploaded')",
          filters: [
            (query: string) => {
              const queryMatch = query
                .replace(/,/g, "")
                .match(/Upload.+?([\d.]+ ?[ZEPTGMK]?i?B)/);
              return queryMatch && queryMatch.length >= 2
                ? parseSizeString(queryMatch[1])
                : 0;
            },
          ],
        },
        downloaded: {
          selector:
            "div:contains('Stats') + ul.stats > li:contains('Downloaded')",
          filters: [
            (query: string) => {
              const queryMatch = query
                .replace(/,/g, "")
                .match(/Download.+?([\d.]+ ?[ZEPTGMK]?i?B)/);
              return queryMatch && queryMatch.length >= 2
                ? parseSizeString(queryMatch[1])
                : 0;
            },
          ],
        },
        ratio: {
          selector: "div:contains('Stats') + ul.stats > li:contains('Ratio:')",
          filters: [
            (query: string) => {
              const queryMatch = query
                .replace(/,/g, "")
                .match(/Ratio.+?([\d.]+)/);
              return queryMatch && queryMatch.length >= 2
                ? parseFloat(queryMatch[1])
                : 0;
            },
          ],
        },
        levelName: {
          selector:
            "div:contains('Personal') + ul.stats > li:contains('Class:')",
          filters: [
            (query: string) => {
              const queryMatch = query.match(/Class:.+?(.+)/);
              return queryMatch && queryMatch.length >= 2 ? queryMatch[1] : "";
            },
          ],
        },
        bonus: {
          selector: [
            "div:contains('Stats') + ul.stats > li:contains('Bonus Points:')",
            "div:contains('Stats') + ul.stats > li:contains('SeedBonus:')",
          ],
          filters: [
            (query: string) => {
              query = query.replace(/,/g, "");
              const queryMatch =
                query.match(/Bonus Points.+?([\d.]+)/) ||
                query.match(/SeedBonus.+?([\d.]+)/);
              return queryMatch && queryMatch.length >= 2
                ? parseFloat(queryMatch[1])
                : 0;
            },
          ],
        },
        joinTime: {
          selector: [
            "div:contains('Stats') + ul.stats > li:contains('Joined:') > span",
          ],
          elementProcess: (element: HTMLElement) => {
            const query = (
              element.getAttribute("title") || element.innerText
            ).trim();
            return dayjs(query).isValid() ? dayjs(query).valueOf() : query;
          },
        },
      },
    },
  };

  protected override async transformSearchPage(
    doc: Document | any
  ): Promise<ITorrent[]> {
    // ?????????????????????????????? search ????????????????????????????????????
    const legacyTableSelector = "table.torrent_table:last";

    // ?????? rows???
    if (!this.config.search?.selectors?.rows) {
      this.config.search!.selectors!.rows = {
        selector: `${legacyTableSelector} > tbody > tr:gt(0)`,
      };
    }
    // ?????? Gazelle ????????????????????????????????????????????????????????? `> tbody > tr:nth-child(1)`
    const tableHeadAnother = Sizzle(
      `${legacyTableSelector} > tbody > tr:first > td`,
      doc
    ) as HTMLElement[];

    tableHeadAnother.forEach((element, elementIndex) => {
      for (const [dectField, dectSelector] of Object.entries({
        time: "a[href*='order_by=time']", // ????????????
        size: "a[href*='order_by=size']", // ??????
        seeders: "a[href*='order_by=seeders']", // ?????????
        leechers: "a[href*='order_by=leechers']", // ?????????
        completed: "a[href*='order_by=snatched']", // ?????????
      } as Record<keyof ITorrent, string>)) {
        if (Sizzle(dectSelector, element).length > 0) {
          // @ts-ignore
          this.config.search.selectors[dectField as keyof listSelectors] =
            merge(
              {
                selector: [`> td:eq(${elementIndex})`],
              },
              // @ts-ignore
              this.config.search.selectors[dectField] || {}
            );
        }
      }
    });

    // ???????????????
    const torrents: ITorrent[] = [];
    const trs = Sizzle(
      this.config.search!.selectors!.rows.selector as string,
      doc
    );

    for (let i = 0; i < trs.length; i++) {
      const tr = trs[i];

      // ??? url ??? link ????????????????????????????????????????????? parseRowToTorrent
      const url = this.getFieldData(tr, this.config.search!.selectors!.url!);
      const link = this.getFieldData(tr, this.config.search!.selectors!.link!);
      if (url && link) {
        const torrent = this.parseRowToTorrent(tr, { url, link }) as ITorrent;
        torrents.push(torrent);
      }
    }

    return torrents;
  }
}
