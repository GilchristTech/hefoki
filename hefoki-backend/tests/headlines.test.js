import * as Headlines      from '../headlines.js';
import { headlines_array } from './fixtures.js';

describe("headlinesMatchExternalLinks", () => {
  it("Matches single-headline sets with identical external link lists", () => {
    const headlines_a = [{ ...headlines_array[0] }];
    const headlines_b = [{
      ...headlines_array[0],
      text: "Unit test passes!"
    }];

    const match = Headlines.headlinesMatchExternalLinks(headlines_a, headlines_b);

    expect(Object.keys(match).sort()).toEqual([
      "matched", "unmatched_a", "unmatched_b"
    ]);


    expect(match.unmatched_a).toEqual([]);
    expect(match.unmatched_b).toEqual([]);
    expect(match.matched    ).toEqual(headlines_b);
  });

  it("Matches single-headline sets with subset of external links", () => {
    const headlines_a = [{ ...headlines_array[0] }];
    const headlines_b = [{
      ...headlines_array[0],
      external_links: [
        ...headlines_array[0].external_links,
        'http://exomple.com/second-source-of-passing-unit-test'
      ],
      text: "Unit test passes!"
    }];

    const match = Headlines.headlinesMatchExternalLinks(headlines_a, headlines_b);

    expect(Object.keys(match).sort()).toEqual([
      "matched", "unmatched_a", "unmatched_b"
    ]);


    expect(match.unmatched_a).toEqual([]);
    expect(match.unmatched_b).toEqual([]);
    expect(match.matched    ).toEqual(headlines_b);
  });

  it("Doesn't match single-headline sets with no external links", () => {
    const headlines_a = [{ ...headlines_array[0] }];
    const headlines_b = [{
      ...headlines_array[0],
      text: "Unit test passes!"
    }];

    headlines_a[0].external_links = [];
    headlines_b[0].external_links = [];

    const match = Headlines.headlinesMatchExternalLinks(headlines_a, headlines_b);

    expect(Object.keys(match).sort()).toEqual([
      "matched", "unmatched_a", "unmatched_b"
    ]);

    expect(match.unmatched_a).toEqual(headlines_a);
    expect(match.unmatched_b).toEqual(headlines_b);
    expect(match.matched    ).toEqual([]);
  });

  it("Matches and non-matches set", () => {
    const headlines_a = [
      { ...headlines_array[0] },
      { ...headlines_array[1] },
      { ...headlines_array[2] },
    ];

    const headlines_b = [
      { ...headlines_array[1] },
      { ...headlines_array[2] },
      { ...headlines_array[3] },
      { ...headlines_array[4] },
    ];

    const match = Headlines.headlinesMatchExternalLinks(headlines_a, headlines_b);

    expect(Object.keys(match).sort()).toEqual([
      "matched", "unmatched_a", "unmatched_b"
    ]);

    expect(match.unmatched_a).toEqual([
      { ...headlines_array[0] }
    ]);

    expect(match.unmatched_b).toEqual([
      { ...headlines_array[3] },
      { ...headlines_array[4] }
    ]);

    expect(match.matched).toEqual([
      { ...headlines_array[1] },
      { ...headlines_array[2] }
    ]);
  });
});


describe("headlinesMatchExact", () => {
  it("Matches single-headline sets which are equal", () => {
    const headlines_a = [{ ...headlines_array[0] }];
    const headlines_b = [{ ...headlines_array[0] }];

    const match = Headlines.headlinesMatchExact(headlines_a, headlines_b);

    expect(match.unmatched_a).toEqual([]);
    expect(match.unmatched_b).toEqual([]);
    expect(match.matched    ).toEqual(headlines_b);
  });

  it("Doesn't match single-headline sets with a modified attribute", () => {
    const headlines_a = [{ ...headlines_array[0] }];
    const headlines_b = [{ ...headlines_array[0] }];

    headlines_b[0].text += "!!!";

    const match = Headlines.headlinesMatchExact(headlines_a, headlines_b);

    expect(match.unmatched_a).toEqual([{ ...headlines_array[0] }]);
    expect(match.unmatched_b).toEqual([{
      ...headlines_array[0],
      text: headlines_array[0].text + "!!!"
    }]);
    expect(match.matched    ).toEqual([]);
  });
});


describe("headlinesMatchTextExact", () => {
  it("Matches single-headline sets with equal text, unequal external links", () => {
    const headlines_a = [{ ...headlines_array[0] }];
    const headlines_b = [{ ...headlines_array[0] }];

    headlines_b[0].external_links = [];

    const match = Headlines.headlinesMatchTextExact(headlines_a, headlines_b);

    expect(match.unmatched_a).toEqual([]);
    expect(match.unmatched_b).toEqual([]);
    expect(match.matched    ).toEqual(headlines_b);
  });

  it("Doesn't match single-headline sets with a modified text", () => {
    const headlines_a = [{ ...headlines_array[0] }];
    const headlines_b = [{ ...headlines_array[0] }];

    headlines_b[0].text += "!!!";

    const match = Headlines.headlinesMatchTextExact(headlines_a, headlines_b);

    expect(match.unmatched_a).toEqual([{ ...headlines_array[0] }]);
    expect(match.unmatched_b).toEqual([{
      ...headlines_array[0],
      text: headlines_array[0].text + "!!!"
    }]);
    expect(match.matched    ).toEqual([]);
  });
});


describe("reduceHeadlineMatchers", () => {
  it("Routes input through a single matcher", () => {
    const headlines_a = [{ ...headlines_array[0] }];
    const headlines_b = [{ ...headlines_array[0] }];

    const match = Headlines.reduceHeadlineMatchers(
      [ Headlines.headlinesMatchExact ], headlines_a, headlines_b
    );

    expect(match.unmatched_a).toEqual([]);
    expect(match.unmatched_b).toEqual([]);
    expect(match.matched    ).toEqual(headlines_b);
    expect(match.matchers_matched).toEqual([
      [ headlines_array[0] ]
    ]);
  });

  it("Terminates matching when finished matching all headline input", () => {
    const headlines_a = [{ ...headlines_array[0] }];
    const headlines_b = [{ ...headlines_array[0] }];

    let matcher_1_ran = false;
    let matcher_2_ran = false;
    let matcher_3_ran = false;

    const matcher_1 = (a, b) => { matcher_1_ran = true; return Headlines.headlinesMatchExact(a, b) };
    const matcher_2 = (a, b) => { matcher_2_ran = true; return Headlines.headlinesMatchExact(a, b) };
    const matcher_3 = (a, b) => { matcher_3_ran = true; return Headlines.headlinesMatchExact(a, b) };

    const match = Headlines.reduceHeadlineMatchers(
      [ matcher_1, matcher_2, matcher_3 ], headlines_a, headlines_b
    );

    expect(match.unmatched_a).toEqual([]);
    expect(match.unmatched_b).toEqual([]);
    expect(match.matched    ).toEqual(headlines_b);

    expect(matcher_1_ran).toBe(true);
    expect(matcher_2_ran).toBe(false);
    expect(matcher_2_ran).toBe(false);

    expect(match.matchers_matched).toEqual([
      [ headlines_array[0] ], [], []
    ]);
  });

  it("Terminates matching when finished matching all input from one headline set", () => {
    const headlines_a = [{ ...headlines_array[0] }];
    const headlines_b = [{ ...headlines_array[0], ...headlines_array[0] }];

    let matcher_1_ran = false;
    let matcher_2_ran = false;
    let matcher_3_ran = false;

    const matcher_1 = (a, b) => { matcher_1_ran = true; return Headlines.headlinesMatchExact(a, b) };
    const matcher_2 = (a, b) => { matcher_2_ran = true; return Headlines.headlinesMatchExact(a, b) };
    const matcher_3 = (a, b) => { matcher_3_ran = true; return Headlines.headlinesMatchExact(a, b) };

    const match = Headlines.reduceHeadlineMatchers(
      [ matcher_1, matcher_2, matcher_3 ], headlines_a, headlines_b
    );

    expect(match.unmatched_a).toEqual([]);
    expect(match.unmatched_b).toEqual([]);
    expect(match.matched    ).toEqual(headlines_b);

    expect(matcher_1_ran).toBe(true);
    expect(matcher_2_ran).toBe(false);
    expect(matcher_2_ran).toBe(false);

    expect(match.matchers_matched).toEqual([
      [ headlines_array[0] ], [], []
    ]);
  });

  it("Returns the results from multiple chained matchers", () => {
    // Each headline set contains one headline matched by the first matcher,
    // one matched by the second, and one matched by neither.
    const headlines_a = [ {...headlines_array[0]}, {...headlines_array[1]}, {...headlines_array[2]} ];
    const headlines_b = [ {...headlines_array[0]}, {...headlines_array[1]}, {...headlines_array[3]} ];

    // Index zero is matched by exact text, but not external links
    headlines_b[0].external_links = [];

    // Index one is matched by external links, but not exact text
    headlines_b[1].text = "Second test passed!";

    // Index two of either headline set should not match

    const match = Headlines.reduceHeadlineMatchers(
      [ Headlines.headlinesMatchTextExact, Headlines.headlinesMatchExternalLinks ],
      headlines_a, headlines_b
    );

    expect( match.matched          ).toEqual( [ headlines_b[0], headlines_b[1] ] );
    expect( match.unmatched_a      ).toEqual( [ headlines_a[2]] );
    expect( match.unmatched_b      ).toEqual( [ headlines_b[2]] );
    expect( match.matchers_matched ).toEqual( [ [headlines_b[0]], [headlines_b[1]] ]);
  });
});
