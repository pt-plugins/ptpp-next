import { searchFilter, SiteConfig, SiteMetadata, Torrent } from '@/shared/interfaces/sites'
import { BittorrentSite } from '@/background/sites/schema/Abstract'
import urljoin from 'url-join'
import { AxiosRequestConfig } from 'axios'
import dayjs from '@/shared/utils/dayjs'
import { sizeToNumber } from '@/shared/utils/filter'

export const siteMetadata: SiteMetadata = {
  name: '爱恋动漫',
  description: '爱恋BT分享站，动画～漫画～游戏～动漫音乐～片源（RAW）～各类ACG资源聚集地～欢迎各大佬发布入住！',
  url: 'http://www.kisssub.org/',
  search: {
    type: 'document'
  },
  selector: {
    search: {
      id: {
        selector: 'td:nth-child(3) a',
        attribute: 'href',
        filters: [
          (q: string) => q.match(/show-(.+?)\.html/)![1]
        ]
      },
      url: { selector: 'td:nth-child(3) a', attribute: 'href' },
      title: { selector: 'td:nth-child(3) a' },
      time: {
        selector: 'td:nth-child(1)',
        filters: [
          (q: string) => {
            /**
             * 该站没有在列表页返回具体时间，返回格式如下：
             *   - 今天 xx:xx
             *   - 昨天 xx:xx
             *   - 前天 xx:xx
             *   - YYYY/MM/DD
             */
            const timeRawPattern = q.match(/([今昨前])天 ([\d:]+)/)
            if (timeRawPattern) {
              const standard = dayjs()
              if (timeRawPattern[1] === '昨') {
                standard.add(-1, 'days')
              } else if (timeRawPattern[1] === '前') {
                standard.add(-2, 'days')
              }

              return dayjs(`${standard.format('YYYY/MM/DD')} ${timeRawPattern[2]}`, 'YYYY/MM/DD HH:mm').unix()
            } else {
              return dayjs(q, 'YYYY/MM/DD').unix()
            }
          }
        ]
      },
      size: { selector: 'td:nth-child(4)', filters: [sizeToNumber] },
      seeders: { selector: 'td:nth-child(5)', filters: [parseInt] },
      leechers: { selector: 'td:nth-child(6)', filters: [parseInt] },
      completed: { selector: 'td:nth-child(7)', filters: [parseInt] },
      category: { selector: 'td:nth-child(2)' }
    }
  }
}

// noinspection JSUnusedGlobalSymbols
export default class Kisssub extends BittorrentSite {
  protected readonly siteMetadata = siteMetadata;

  generateDetailPageLink (id: string): string {
    return urljoin(this.config.url, `/show-${id}.html`)
  }

  transformSearchFilter (filter: searchFilter): AxiosRequestConfig {
    return {
      url: '/search.php',
      params: {
        keyword: filter.keywords
      }
    } as AxiosRequestConfig
  }

  transformSearchPage (doc: Document): Torrent[] {
    const torrents: Torrent[] = []
    const trs = doc.querySelectorAll('table#listTable > tbody > tr')

    trs.forEach(tr => {
      const transformTorrent = this.transformRowsTorrent(tr)

      torrents.push({
        ...transformTorrent,
        // 我们只要知道hash就可以种子了，但是如果不传入name的话，种子命名是 `{hash}.torrent`
        link: `http://v2.uploadbt.com/?r=down&hash=${transformTorrent.id}&name=${transformTorrent.title}`,
        comments: 0 // 该站没有评论
      } as Torrent)
    })

    return torrents
  }
}
