/**
 * 获取站点图标的方法
 *
 * 我们不用很在意 Favicon 的本地缓存情况，因为这部分可以随时重新获取，所以直接用 localforage 就行了
 * 程序按照如下顺序获取Favicon：
 *   1. localforage 中已有的 base64 缓存（根据站点的 host 值）
 *   2. '../icons' 目录中是否存在对应 png 或 ico 文件 `${config.name | config.host}.${"png" | "ico"}`
 *       （主要方便 以解压缩形式安装的用户覆写 以及部分教育网站点可能需要特殊方法访问的情况 ）
 *   3. ISiteMetadata 中定义的 favicon 字段
 *   4. 请求网站首页，并从返回的html中解析所需要的 favicion 字段
 *   5. 使用 NO_IMAGE 替代
 *
 * special thanks to: https://github.com/spro/get-website-favicon/tree/master/lib/origin
 */

import axios from "axios";
import { createInstance as createLocalforageInstance } from "localforage";
import BittorrentSite from "../schema/AbstractBittorrentSite";

// from: https://stackoverflow.com/a/9967193/8824471
// from: http://proger.i-forge.net/%D0%9A%D0%BE%D0%BC%D0%BF%D1%8C%D1%8E%D1%82%D0%B5%D1%80/[20121112]%20The%20smallest%20transparent%20pixel.html
const NO_IMAGE = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=";

const packedIconContext = import.meta.webpackContext!("../icons/", {
  regExp: /\.(ico|png)$/,
  mode: "eager"
});
const packedIconList = packedIconContext.keys() as Array<`./${string}.${"png" | "ico"}`>;

const FAVICON_FROM_LINK = [
  "link[rel='icon' i][href]",
  "link[rel='shortcut icon' i][href]",
  "link[rel='apple-touch-icon' i][href]",
  "link[rel='apple-touch-icon-precomposed' i][href]",
  "link[rel='apple-touch-startup-image' i][href]",
  "link[rel='fluid-icon' i][href]",
  // "meta[name='msapplication-TileImage' i][content]"
];

interface IParsedFavicon {
  href: string;
  sizes: string | `${string}x${string}`;
  source: "manifest" | "link" | "favicon";
  blob?: Blob;
}

const remoteBetterFaviconOrder = [{
  key: "source",   // favicon.ico - 2
  rank: (item: IParsedFavicon) => {
    const rule = ["favicon", "link", "manifest"].reverse();
    let rank = 0;
    for (const n in rule) {
      rank += rule[n] === item.source ? parseInt(n) : 0;
    }
    return rank;
  }
}, {  // favicon.ico - 3
  key: "ext",
  rank: (item: IParsedFavicon) => {
    const rule = [/\.ico$/im, /\.png$/im, /\.jpg$/im, /\.svg$/im].reverse();
    let rank = 0;
    for (const n in rule) {
      rank += rule[n].test(item.href) ? parseInt(n) : 0;
    }
    return rank;
  }
}, {
  key: "sizes",
  rank: (item: IParsedFavicon) => {
    let rank = 0;
    if (!item.sizes) return rank;
    const wh = item.sizes.split("x");
    const size = parseInt(wh[0]);
    if (wh[0] != wh[1]) return rank;
    if (size > 24 && size < 40) {
      rank = 4;
    } else if (size > 36 && size < 90) {
      rank = 3;
    } else if (size > 88 && size < 260) {
      rank = 2;
    } else if (size > 15 && size < 26) {
      rank = 1;
    } else {
      rank = 0;
    }
    return rank;
  }
}].reverse();

// FIXME 转成公共函数 BlobToBase64
function transformBlob (blob: Blob): Promise<any> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("loadend", () => {
      if (reader.result) {
        resolve(reader.result);
      } else {
        reject(new Error("Error when parse favicon Blob"));
      }
    });

    reader.readAsDataURL(blob);
  });
}

class Favicon {
  private cache;

  constructor () {
    this.cache = createLocalforageInstance({
      name: "Favicon",
    });
  }

  public async removeCachedItem (host: string) {
    return await this.cache.removeItem(host);
  }

  public async clearCache () {
    return await this.cache.clear();
  }

  // FIXME
  public async getFavicon (site: BittorrentSite): Promise<string> {
    const siteId = site.config.id!;
    const siteHost = site.config.host!;

    let checkLocalIconPaths = [
      `./${siteId}.png`, `./${siteId}.ico`,
      `./${siteHost}.png`, `./${siteHost}.ico`
    ];

    // 1. 检查本地icons目录是否存在对应文件
    if (site.config.favicon) {
      if (site.config.favicon.startsWith("data:image/")) {
        return site.config.favicon;  // base64直接返回就行了
      } else if (site.config.favicon.startsWith("./")) {
        checkLocalIconPaths = [site.config.favicon, ...checkLocalIconPaths];  // 优先使用 已定义的 favicon
      }
    }

    for (const checkLocalIconPath of checkLocalIconPaths) {
      if ((packedIconList as string[]).includes(checkLocalIconPath)) {
        return await packedIconContext(checkLocalIconPath);
      }
    }

    // 2. 检查 localforage 是否已有 base64 缓存（根据站点的 host 值）
    const lfCache = await this.cache.getItem<string>(siteHost);
    if (lfCache) {
      return lfCache;
    }

    // 3. 检查网站是否有对应icon
    let faviconMeta;

    // 3.1 ISiteMetadata 中定义的 favicon 字段为一个链接
    if (site.config.favicon && site.config.favicon.startsWith("http")) {
      try {
        const configReq = await axios.get(site.config.favicon, { responseType: "blob" });
        faviconMeta = configReq.data;
      } catch {
      }
    }

    // 3.2 请求网站首页，并从返回的html中解析所需要的 favicon 字段
    if (!faviconMeta) {
      try {
        faviconMeta = await this.getFaviconFromUrl(site.activateUrl);
      } catch {
      }
    }

    // 将请求结果转为 base64
    let faviconBase64;
    if (typeof faviconMeta !== "undefined") {
      faviconBase64 = await transformBlob(faviconMeta);      // 将 faviconMeta 转成 base64，并缓存
    }

    // 4. fallback 使用 NO_IMAGE 替代
    faviconBase64 ??= NO_IMAGE;

    // 缓存base64以便下次使用
    await this.cache.setItem(siteHost, faviconBase64);
    return faviconBase64;
  }

  public async getFaviconFromUrl (url: string): Promise<Blob> {
    const baseUrl = new URL(url);

    const { data: doc } = await axios.get<Document>(url, { responseType: "document" });

    const favicons: IParsedFavicon[] = [];

    // 1. Parse from head
    FAVICON_FROM_LINK.forEach((selector) => {
      const element = doc.querySelector(selector) as HTMLLinkElement;
      if (element) {
        favicons.push({
          href: element.href,
          sizes: element.sizes?.toString() || "",
          source: "link",
        });
      }
    });

    // 2. Parse from manifest
    const manifestElement = doc.querySelector('head link[rel="manifest" i]') as HTMLLinkElement;
    if (manifestElement) {
      const { data: manifest } = await axios.get<{
        icons: Record<"sizes" | "src" | "type", string>[];
      }>(manifestElement.href, { responseType: "json" });

      manifest.icons.forEach(({
        sizes,
        src
      }) => {
        favicons.push({
          href: src,
          sizes,
          source: "manifest",
        });
      });
    }

    // 3. Default /favicon.ico
    try {
      const faviconIco = await axios.get<Blob>("/favicon.ico", {
        baseURL: baseUrl.origin,
        responseType: "blob",
      });
      if (faviconIco && faviconIco.data?.type === "image/x-icon") {
        favicons.push({
          href: "/favicon.ico",
          sizes: "",
          source: "favicon",
          blob: faviconIco.data,
        } as IParsedFavicon);
      }
    } catch (e) {
    }

    // 如果前面获取到足够的 favicons，我们需要比较下哪个更合适，并排序
    if (favicons.length > 0) {
      const rankedFavicons: Array<IParsedFavicon & { rank: number }> = favicons
        .map((icon) => {
          // 计算每一个favicon的评分
          let rank = 0;
          for (const x in remoteBetterFaviconOrder) {
            const order = remoteBetterFaviconOrder[x];
            if (order.rank) {
              rank += order.rank(icon) * Math.pow(10, parseInt(x));
            }
          }

          return {
            ...icon,
            rank
          };
        })
        .sort((a, b) => (a.rank < b.rank ? 1 : -1));

      // 选择排序后第一个图标作为我们需要的图标
      for (let i = 0; i < rankedFavicons.length; i++) {
        const usedFavicons = rankedFavicons[i];
        if (usedFavicons.blob) {
          return usedFavicons.blob;
        } else {
          try {
            let faviconUrl = usedFavicons.href;
            if (faviconUrl.startsWith("//")) {
              faviconUrl = `${baseUrl.protocol}${faviconUrl}`;
            } else if (faviconUrl.startsWith("/")) {
              faviconUrl = `${baseUrl.origin}${faviconUrl}`;
            }

            const { data } = await axios.get(faviconUrl, { responseType: "blob" });
            return data;
          } catch {
          }
        }
      }
    }

    throw new Error("Can't find any favicons from this site");
  }

}

export default new Favicon();
