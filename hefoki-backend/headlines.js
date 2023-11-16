export function normalizeHeadlineInplace (headline) {
  headline.external_links.sort();
  return headline;
}


export function headlinesMatchExternalLinks (headlines_a, headlines_b) {
  const matched     = [];
  const unmatched_b = [];

  headlines_a = Array.from(headlines_a);  // shallow copy, we'll delete elements
  headlines_a.map(h => normalizeHeadlineInplace(h));
  headlines_b.map(h => normalizeHeadlineInplace(h));

  LOOP_B:
  for (let headline_bi in headlines_b) {
    const headline_b     = headlines_b[headline_bi];
    const external_b     = headline_b.external_links;
    const external_b_len = external_b.length;

    LOOP_A:
    for (let headline_ai in headlines_a) {
      const headline_a     = headlines_a[headline_ai];
      const external_a     = headline_a.external_links;
      const external_a_len = external_a.length;

      if (external_a_len <= external_b_len) {
        // If any of headline A's external links are contained inside headline
        // B's list, consider this a match.
        // TODO: continue searching to determine if this is an ambiguous match,
        // where multiple headlines have overlapping external links.

        for (let external_link of external_a) {
          if (external_b.indexOf(external_link) != -1) {
            matched.push(headline_b);
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
