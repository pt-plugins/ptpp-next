import { ISiteMetadata } from '../../types';
import urlparse from 'url-parse';
import {
  findThenParseNumberString,
  findThenParseSizeString,
  findThenParseValidTimeString,
  parseTimeToLive
} from '@ptpp/utils/filter';

export const siteMetadata: ISiteMetadata = {
  name: 'HDBits',
  timezoneOffset: '+0000',
  description: 'HDB',
  url: 'https://hdbits.org/',
  tags: ['影视', '综合'],
  search: {
    keywordsParam: 'search',
    requestConfig: {
      url: '/browse.php'
    },
    categories: [
      {
        name: 'Category',
        key: 'cat',
        options: [
          { value: 1, name: 'Movie' },
          { value: 2, name: 'TV' },
          { value: 3, name: 'Documentary' },
          { value: 4, name: 'Music' },
          { value: 5, name: 'Sport' },
          { value: 6, name: 'Audio Track' },
          { value: 7, name: 'XXX' },
          { value: 8, name: 'Misc/Demo' }
        ]
      }
    ]
  },
  userInfo: {
    process: [
      {
        requestConfig: { url: '/index.php' },
        fields: ['id', 'name', 'messageCount']
      },
      {
        requestConfig: { url: '/userdetails.php' },
        assertion: { id: 'id' },
        fields: ['uploaded', 'downloaded', 'ratio', 'levelName', 'bonus', 'joinTime', 'seeding', 'seedingSize']
      }
    ]
  },
  selector: {
    search: {
      rows: { selector: 'table#torrent-list > tbody > tr:has(a[href^="/details.php?id="])' },
      id: { selector: 'a[href^="/details.php?id="]', attr: 'href', filters: [(q:string) => urlparse(q, true).query.id] },
      title: { selector: 'td:nth-child(3) a' },
      url: { selector: 'a[href^="/details.php?id="]', attr: 'href' },
      link: { selector: 'a[href^="/download.php"]', attr: 'href' },
      time: { selector: 'td:nth-child(5)', filters: [parseTimeToLive] },
      size: { selector: 'td:nth-child(6)' },
      author: { selector: 'td:eq(9)' },
      category: { selector: 'a[href^="?cat="]', attr: 'href', filters: [(q:string) => urlparse(q, true).query.cate] },
      seeders: { selector: 'td:nth-child(8)' },
      leechers: { selector: 'td:nth-child(9)' },
      completed: { selector: 'td:nth-child(7) a' },

      tags: [
        { name: 'Free', selector: "a[title^='100% FL:']" },
        { name: '50%', selector: "a[title^='50% Free Leech:']" },
        { name: '25%', selector: "a[title^='25% Free Leech:']" } // FIXME 这应该是 25% 还是 75% ？
      ]
    },
    userInfo: {
      id: {
        selector: "a[href*='userdetails.php']:first",
        attr: 'href',
        filters: [(query:string) => urlparse(query, true).query.id]
      },
      name: {
        selector: "a[href*='userdetails.php']:first"
      },
      messageCount: {
        selector: 'a.alert-box--pm, span.js-notifications-count',
        filters: [findThenParseNumberString]
      },
      uploaded: {
        selector: "td.rowhead:contains('Uploaded') + td",
        filters: [findThenParseSizeString]
      },
      downloaded: {
        selector: "td.rowhead:contains('Downloaded') + td",
        filters: [findThenParseSizeString]
      },
      ratio: {
        selector: "td.rowhead:contains('Share ratio') + td",
        filters: [parseFloat]
      },
      levelName: {
        selector: "td.rowhead:contains('Class') + td"
      },
      bonus: {
        selector: "td.rowhead:contains('Bonus') + td",
        filters: [findThenParseNumberString]
      },
      joinTime: {
        selector: "td.rowhead:contains('JOIN'):contains('date') + td",
        filters: [
          (query: string) => {
            query = query.split(' (')[0];
            return findThenParseValidTimeString(query);
          }
        ]
      },
      seeding: {
        selector: "td.heading:contains('Currently'):contains('seeding') + td",
        filters: [findThenParseNumberString]
      },
      seedingSize: {
        selector: ["td.heading:contains('Seeding size') + td"],
        filters: [findThenParseSizeString]
      }
    }
  }
};