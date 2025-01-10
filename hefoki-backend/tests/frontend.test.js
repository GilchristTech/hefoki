import { describe, it, expect } from 'vitest';
import * as Frontend from '../src/logic/frontend.js';
import { StaticSiteFile } from '../src/logic/static-site-file.js';
import * as Fixtures from './fixtures.js';

import { DateTime } from 'luxon';
import Cheerio      from 'cheerio';


describe("mergeIndexedArrays()", () => {
  it("links lists", () => {
    const merged = Frontend.mergeIndexedArrays(
      [  1,2,3  ],
      [0,  2,3,4],
    );

    expect(merged.length).toBe(5);

    expect(merged[0]).toEqual({
      index:      0,
      value_a: null, value_b:    0,
      prev:    null, next:       1,
      prev_a:  null, next_a:  null,
      prev_b:  null, next_b:     2,
    });

    expect(merged[1]).toEqual({
      index:      1,
      value_a:    1, value_b: null,
      prev:       0, next:       2,
      prev_a:  null, next_a:     2,
      prev_b:  null, next_b:  null,
    });

    expect(merged[2]).toEqual({
      index:      2,
      value_a:    2, value_b:    2,
      prev:       1, next:       3,
      prev_a:     1, next_a:     3,
      prev_b:     0, next_b:     3,
    });

    expect(merged[3]).toEqual({
      index:      3,
      value_a:    3, value_b:    3,
      prev:       2, next:       4,
      prev_a:     2, next_a:  null,
      prev_b:     2, next_b:     4,
    });

    expect(merged[4]).toEqual({
      index:      4,
      value_a: null, value_b:    4,
      prev:       3, next:    null,
      prev_a:  null, next_a:  null,
      prev_b:     3, next_b:  null,
    });
  });
});


describe("normalizeKeyToUrl()", () => {
  const normalizeKeyToUrl = Frontend.normalizeKeyToUrl;


  it("maintains leading and trailing slashes", () => {
    // expect(
    //   ("/abc/".split("/").at(-1)?.indexOf(".") ?? -1) + 1
    // ).toEqual(99);
    expect(normalizeKeyToUrl("/abc/")).toEqual("/abc/");
  });
});


describe("updatePagination()", () => {
  it("doesn't modify pagination if provided an empty pagination dict", () => {
    const old_html       = Fixtures.generateHtmlPaginated('2023-11-01', null, '/2023-11-02/');
    const new_html       = Frontend.updatePagination(old_html, {});
    const old_pagination = Frontend.getPagination(old_html);
    const new_pagination = Frontend.getPagination(new_html);
    expect(old_pagination).toEqual(new_pagination);
  });

  it("doesn't modify pagination if provided an identical pagination dict", () => {
    const old_html       = Fixtures.generateHtmlPaginated('2023-11-01', null, '/2023-11-02/');
    const new_html       = Frontend.updatePagination(old_html, {
      prev: null,
      next: "/2023-11-02/"
    });
    const old_pagination = Frontend.getPagination(old_html);
    const new_pagination = Frontend.getPagination(new_html);
    expect(old_pagination).toEqual(new_pagination);
  });
});


describe("incrementBetweenBuilds()", () => {
  it("does nothing when given no files", async () => {
    const old_files = [];
    const new_files = [];
    const pages = await Frontend.incrementBetweenBuilds([], []);
    expect(pages).toEqual({});
  });

  it("returns unmodified input when only given new files", async () => {
    const old_files = [];
    const new_files = [
      new StaticSiteFile({
        key:     'index.html',
        content: Fixtures.html.plain + ""
      })
    ];
    const pages = await Frontend.incrementBetweenBuilds(old_files, new_files);

    expect(pages).toEqual({
      'index.html': Fixtures.html.plain
    });
  });

  it("doesn't return old unmodified files", async () => {
    const old_files = [
      new StaticSiteFile({
        key:     'index.html',
        content: Fixtures.html.plain + ""
      })
    ];
    const new_files = [];
    const pages = await Frontend.incrementBetweenBuilds(old_files, new_files);
    expect(pages).toEqual({});
  });

  it("returns old unmodified files, if forced", async () => {
    const old_files = [
      new StaticSiteFile({
        key:     'index.html',
        content: Fixtures.html.plain + ""
      })
    ];
    const pages = await Frontend.incrementBetweenBuilds(
        old_files, [], {force: true}
      );
    expect(pages).toEqual({
      'index.html': Fixtures.html.plain
    });
  });

  describe("when given adjacent date-indexed page sets...", () => {
    it("only returns modified or new pages", async () => {
      function generatePage (day_index, prev, next) {
        const key  = `${day_index}/index.html`;
        const html = Fixtures.generateHtmlPaginated(day_index, prev, next);
        return {
          key, html,
          page: new StaticSiteFile({ key, content: html })
        };
      }

      const days_a = [
        generatePage('2023-11-01',   null,          '2023-11-02/'),
        generatePage('2023-11-02',   '2023-11-01/', null         )
      ];

      const days_b = [
          generatePage('2023-11-04', null,          '2023-11-05/'),
          generatePage('2023-11-05', '2023-11-04/', null         )
      ];

      const static_pages = await Frontend.incrementBetweenBuilds(
        days_a.map(p => p.page), days_b.map(p => p.page)
      );

      expect(
        Object.keys(static_pages).toSorted()
      ).toEqual([
        // 2023-11-01             // skip: neither new, nor modified
        '2023-11-02/index.html',  // Pagination modified
        '2023-11-04/index.html',  // New, pagination modified
        '2023-11-05/index.html'   // New
      ]);
    });
  });

  describe("enforces pagination because it...", () => {
    it("fixes incorrect pagination links", async () => {
      // Correct pagination, no modifications needed
      const page_a_content = Fixtures.generateHtmlPaginated('2023-11-01', null, '/2023-11-03/');
      const page_a = new StaticSiteFile({
        key: `2023-11-01/index.html`,
        content: page_a_content,
      });

      // Previous page does not exist, should have pagination updated
      const page_b = new StaticSiteFile({
        key: `2023-11-03/index.html`,
        content: Fixtures.generateHtmlPaginated('2023-11-03', '/2023-11-02/', null)
      });

      const updates = await Frontend.incrementBetweenBuilds(
        [page_a], [page_b], { enforce_pagination: true }
      );
      
      expect(
        Object.keys(updates).toSorted()
      ).toEqual(
        ['2023-11-03/index.html']
      );
    });

    it("preserves leading hyperlink slashes", async () => {
      const page_a = new StaticSiteFile({
        key: `2023-11-01/index.html`,
        content: Fixtures.generateHtmlPaginated('2023-11-01', null, '/2023-11-02/')
      });

      const page_b = new StaticSiteFile({
        key: `2023-11-02/index.html`,
        content: Fixtures.generateHtmlPaginated('2023-11-02', '/2023-11-01/', null)
      });

      const updates = await Frontend.incrementBetweenBuilds(
        [page_a], [page_b], { enforce_pagination: true, force: true }
      );
      
      expect(
        Object.keys(updates).toSorted()
      ).toEqual([
        '2023-11-01/index.html',
        '2023-11-02/index.html'
      ]);

      expect(
        Frontend.getPagination(updates['2023-11-01/index.html'])
      ).toEqual({
        prev: [""],
        next: ["/2023-11-02/"]
      });

      expect(
        Frontend.getPagination(updates['2023-11-02/index.html'])
      ).toEqual({
        prev: ["/2023-11-01/"],
        next: [""]
      });

    });
  });

  describe("correctly performs updates because it...", () => {
    it("doesn't update new files when a new-page pagination update causes that file to match with an old file, unless forced", async () => {
      const page_a_content     = Fixtures.generateHtmlPaginated('2023-11-01',          null, '/2023-11-02/');
      const page_b_old_content = Fixtures.generateHtmlPaginated('2023-11-02', '/2023-11-01/',          null);
      const page_b_new_content = Fixtures.generateHtmlPaginated('2023-11-02',          null,           null);

      const page_a_old = new StaticSiteFile({ key: '2023-11-01/index.html', content: page_a_content     });
      const page_b_old = new StaticSiteFile({ key: '2023-11-02/index.html', content: page_b_old_content });
      const page_b_new = new StaticSiteFile({ key: '2023-11-02/index.html', content: page_b_new_content });

      // Detect that the pages, following forced
      // postprocessing, have not changed.
      //
      const updates_forced = await Frontend.incrementBetweenBuilds(
        [ page_a_old, page_b_old ], [ page_b_new ], { enforce_pagination: true, force: true }
      );

      expect(updates_forced).toEqual({
        '2023-11-01/index.html': page_a_content,
        '2023-11-02/index.html': page_b_old_content
      });

      // If not forced, a pagination update should make page_b's updated
      // content and hash equal that of the existing (old) page. In this case,
      // no update should be performed.
      //
      const updates = await Frontend.incrementBetweenBuilds(
        [ page_a_old, page_b_old ], [ page_b_new ], { enforce_pagination: true }
      );
      expect(updates).toEqual({});
    });
  });
});
