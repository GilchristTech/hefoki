import deepEqual from 'deep-equal';


export function headlineArrayToHeadlineDays (headlines_array) {
  const headline_days = {};
  
  for (let headline of headlines_array) {
    // Unencountered dates are defaulted to empty arrays, and whatever array is
    // used has this headline pushed
    (
      headline_days[headline.date] = headline_days[headline.date] || []
    ).push(headline);
  }

  return headline_days;
}


export function headlineDaysToHeadlineArray (headline_days) {
  return Object.values(headline_days).reduce(
    (headlines, headline_day) => headlines.concat(headline_day),
    []
  );
}


export function headlinesMatchExternalLinks (headlines_a, headlines_b) {
  const matched     = [];
  const unmatched_b = [];

  headlines_a = Array.from(headlines_a);  // shallow copy, we'll delete elements

  LOOP_B:
  for (let headline_bi in headlines_b) {
    const headline_b     = headlines_b[headline_bi];
    const external_b     = headline_b.external_links ?? [];
    const external_b_len = external_b.length;

    LOOP_A:
    for (let headline_ai in headlines_a) {
      const headline_a     = headlines_a[headline_ai];
      const external_a     = headline_a.external_links ?? [];
      const external_a_len = external_a.length;

      if (external_a_len <= external_b_len) {
        // If any of headline A's external links are contained inside headline
        // B's list, consider this a match.
        // TODO: continue searching to determine if this is an ambiguous match,
        // where multiple headlines have overlapping external links.

        for (let external_link of external_a) {
          if (external_b.indexOf(external_link) != -1) {
            matched.push([headline_a, headline_b]);
            delete headlines_a[headline_ai];
            continue LOOP_B;
          }
        }
      }
    }

    // If headline_a and headline_b are matched, LOOP_B is continue'd and this
    // does not run. If no match has been found, control continues to this, and
    // an unmatched headline_b is added to that list.

    unmatched_b.push(headline_b);
  }

  // With elements from headlines_a being deleted, the indexes are
  // non-contiguous, and therefore should not be used as a return value. Create
  // a new array from the remaining values.

  const unmatched_a = Object.values(headlines_a);

  return {
    matched,
    unmatched_a,
    unmatched_b,
  };
}


export function headlinesMatchExact (headlines_a, headlines_b) {
  const matched     = [];
  const unmatched_b = [];

  headlines_a = Array.from(headlines_a);  // shallow copy, we'll delete elements

  LOOP_B:
  for (let headline_bi in headlines_b) {
    const headline_b     = headlines_b[headline_bi];

    LOOP_A:
    for (let headline_ai in headlines_a) {
      const headline_a = headlines_a[headline_ai];

      if (deepEqual(headline_a, headline_b)) {
        matched.push([headline_a, headline_b]);
        delete headlines_a[headline_ai];
        continue LOOP_B;
      }
    }

    // If headline_a and headline_b are matched, LOOP_B is continue'd and this
    // does not run. If no match has been found, control continues to this, and
    // an unmatched headline_b is added to that list.

    unmatched_b.push(headline_b);
  }

  // With elements from headlines_a being deleted, the indexes are
  // non-contiguous, and therefore should not be used as a return value. Create
  // a new array from the remaining values.

  const unmatched_a = Object.values(headlines_a);

  return {
    matched,
    unmatched_a,
    unmatched_b,
  };
}


export function headlinesMatchTextExact (headlines_a, headlines_b) {
  const matched     = [];
  const unmatched_b = [];

  headlines_a = Array.from(headlines_a);  // shallow copy, we'll delete elements

  LOOP_B:
  for (let headline_bi in headlines_b) {
    const headline_b     = headlines_b[headline_bi];

    LOOP_A:
    for (let headline_ai in headlines_a) {
      const headline_a = headlines_a[headline_ai];

      if (headline_a.text == headline_b.text) {
        matched.push([headline_a, headline_b]);
        delete headlines_a[headline_ai];
        continue LOOP_B;
      }
    }

    // If headline_a and headline_b are matched, LOOP_B is continue'd and this
    // does not run. If no match has been found, control continues to this, and
    // an unmatched headline_b is added to that list.

    unmatched_b.push(headline_b);
  }

  // With elements from headlines_a being deleted, the indexes are
  // non-contiguous, and therefore should not be used as a return value. Create
  // a new array from the remaining values.

  const unmatched_a = Object.values(headlines_a);

  return {
    matched,
    unmatched_a,
    unmatched_b,
  };
}


export function reduceHeadlineMatchers (matchers, headlines_a, headlines_b) {
  // Monadic function, with superset of the monadic type

  const matchers_matched = Array(matchers.length);
  let   matched          = [];
  let   unmatched_a      = headlines_a;
  let   unmatched_b      = headlines_b;

  for (let matcher_i in matchers) {
    let match;

    if (unmatched_a.length == 0 || unmatched_b.length == 0) {
      matchers_matched[matcher_i] = [];
      continue;
    }

    match = matchers[matcher_i](unmatched_a, unmatched_b);

    matchers_matched[matcher_i] = match.matched;
    matched                     = matched.concat(match.matched);
    unmatched_a                 = match.unmatched_a;
    unmatched_b                 = match.unmatched_b;
  }

  return {
    matched,
    matchers_matched,
    unmatched_a,
    unmatched_b
  };
}


export function diffHeadlines (headlines_a, headlines_b) {
  /*
    Given two arrays of headlines, return an object containing arrays of
    unmodified, modified, added, and deleted headlines, named respectively.
    Each attribute is an array of headline objects, except for "modified",
    which an array of two-length arrays, each containing two headlines from
    that matched headline pair.
  */

  const matchers = [
    [ "exact",          headlinesMatchExact         ],
    [ "text_exact",     headlinesMatchTextExact     ],
    [ "external_links", headlinesMatchExternalLinks ],
  ];

  const match = reduceHeadlineMatchers(
    matchers.map( m => m[1] ),
    headlines_a, headlines_b
  );

  // Re-index matcher_matched from ints to name strings for each matcher
  const new_matchers_matched = {};
  for (let i in match.matchers_matched) {
    new_matchers_matched[matchers[i][0]] = match.matchers_matched[i];
  }
  match.matchers_matched = new_matchers_matched;

  const unmodified = match.matchers_matched.exact;
  const deleted    = match.unmatched_a;
  const added      = match.unmatched_b;
  let   updated    = [];

  for (let [matcher, _] of matchers.slice(1)) {
    updated = updated.concat(match.matchers_matched[matcher]);
  }

  return {
    unmodified,
    deleted,
    added,
    updated
  };
}


export function diffHeadlineDays (headline_days_a, headline_days_b) {
  /*
    For each headline day in headline_days_b which is also in headline_days_a,
    return an object mapping those dates to headline day diff objects.
  */

  const headline_day_diffs = {};

  const dates = Object.keys(headline_days_b);

  for (let date of dates) {
    const headlines_old = headline_days_a[date] ?? [];
    const headlines_new = headline_days_b[date];

    headline_day_diffs[date] = diffHeadlines(headlines_old, headlines_new);
  }

  return headline_day_diffs;
}


export function headlineDayDiffsToHeadlineDays (headline_day_diffs) {
  const headline_days = {};

  for (let [date, diff] of Object.entries(headline_day_diffs)) {
    headline_days[date] = diff.unmodified.concat(
      diff.updated.map(hp => hp[1]),
      diff.added
    );
  }

  return headline_days;
}


export function headlineDayDiffsToUpdatedHeadlineDays (headline_day_diffs) {
  const headline_days = {};

  for (let [date, diff] of Object.entries(headline_day_diffs)) {
    headline_days[date] = diff.added.concat(
      diff.updated.map(hp => hp[1]),
    );
  }

  return headline_days;
}
