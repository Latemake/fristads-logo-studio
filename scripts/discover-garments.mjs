import * as cheerio from 'cheerio';
import {fetchLimited} from '../server/catalog.js';
const pages = ['housut','takit','shortsit','liivit','collegepuserot','haalarit'];
const results = await Promise.allSettled(pages.map(async group => {
  const url = 'https://www.fristads.com/fi-fi/tuotteet/tyovaatteet/' + group;
  const {buffer} = await fetchLimited(url); const $ = cheerio.load(buffer.toString('utf8'));
  const links = new Map();
  $('a[href]').each((_,el) => {const href=$(el).attr('href'); const id=href.match(/-(\d{6})-\d{3}\/?$/)?.[1];if(id&&href.includes('/tuotteet/')&&!links.has(id)) links.set(id,new URL(href,url).pathname.split('/').at(-1));});
  return {group,slugs:[...links.values()].slice(0,22)};
}));
for(const result of results) console.log(JSON.stringify(result.status==='fulfilled'?result.value:{error:result.reason.message}));
