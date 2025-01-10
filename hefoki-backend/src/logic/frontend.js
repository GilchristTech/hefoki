import Cheerio    from 'cheerio';

const DATE_URL_KEY_RGX = /^\/?(\d{4}-\d{2}-[0-3][0-9])\//;


export function mergeIndexedArrays (indexes_a, indexes_b, values_a=null, values_b=null) {
  /*
    Returns an array of linked list nodes (linked by indices, not references)
    of two arrays of indices, along with their corresponding values,
    maintaining the order of indices. If value arrays are not provided, the
    indexes are used as values. The term "merge", in this context, refers to this
    process, and creating this data structure.

    This algorithm assumes the index arrays are already sorted.

    Returns
      [{
        index,
        value_a, value_b,
        prev,    next,
        prev_a,  next_a
        prev_b,  next_b
      }]
  */

  if (!(
    Array.isArray(indexes_a) ||
    Array.isArray(indexes_b)
  )) {
    throw TypeError("indexes_a and indexes_b must both be arrays");
  }

  // JavaScript arrays are not guaranteed to have contiguous indices; copying
  // the array better ensures the algorithm runs properly
  indexes_a = Array.from(indexes_a);
  indexes_b = Array.from(indexes_b);

  // The value properties in the return objects, if a values reference object
  // is not provided, defaults to the keys that are used. If a values lookup
  // object has been provided, convert it into a numerically-indexable array.
  values_a = ( values_a && indexes_a.map(i => values_a[i]) ) ?? indexes_a;
  values_b = ( values_b && indexes_b.map(i => values_b[i]) ) ?? indexes_b;

  const merged = [];

  let last_merge = null;
  let last_a     = null;
  let last_b     = null;

  // Iterate through both arrays until the end of both arrays are reached
  for (
    let a_i=0, b_i=0 ;
    a_i < indexes_a.length || b_i < indexes_b.length ;
    // depending on values, a_i and/or b_i are incremented inside the loop
  ) {
    // Get the current index from both arrays, handling cases where one array
    // is shorter than the other
    let a_index = indexes_a[a_i] ?? null;
    let b_index = indexes_b[b_i] ?? null;

    let merge_entry = {
      index:   null,
      value_a: null,
      value_b: null,
      prev:    last_merge?.index ?? null,
      next:    null,
      prev_a:  null,       next_a: null,
      prev_b:  null,       next_b: null,
    };

    // Determine the lowest value between the current index of the A and B
    // arrays, using both values if they are equal. In case of equal values,
    // the merged entry will contain the index along with both values,
    // representing the merge of elements from both arrays.

    if (a_index == b_index) {
      merge_entry.index   = a_index;

      merge_entry.value_a = values_a[a_i] ?? null;
      merge_entry.value_b = values_b[b_i] ?? null;

      merge_entry.prev_a  = last_a?.index ?? null;
      merge_entry.prev_b  = last_b?.index ?? null;

      if (last_a) last_a.next_a = a_index;
      if (last_b) last_b.next_b = a_index;

      last_a = merge_entry;
      last_b = merge_entry;

      a_i++;
      b_i++;
    }
    else if (( a_index < b_index ) && (  a_index !== null )) {
      merge_entry.index   = a_index;
      merge_entry.value_a = values_a[a_i] ?? null;
      merge_entry.prev_a  = last_a?.index ?? null;
      if (last_a) last_a.next_a = a_index;
      last_a = merge_entry;
      a_i++;
    }
    else {
      merge_entry.index   = b_index;
      merge_entry.value_b = values_b[b_i] ?? null;
      merge_entry.prev_b  = last_b?.index ?? null;
      if (last_b) last_b.next_b = b_index;
      last_b = merge_entry;
      b_i++;
    }

    merged.push(merge_entry);
    if (last_merge)
      last_merge.next = merge_entry.index;
    last_merge = merge_entry;
  }

  return merged;
}


export function updatePagination (html, pagination, find_prev=null, find_next=null) {
  /*
    Given a StaticSiteFile and an object with a next and previous attribute,
    find paginated links and update them, then return the resultant HTML. If
    pagination.next or pagination.prev are falsey, skip updating them.

    The Cheerio search functions to find the pagination links can
    be overridden with `find_prev` and `find_next`. Their default
    values are functions which given a Cheerio object, query for
    anchor elements with .next and .prev attributes. Those look
    like this:
      ( $ => $('a.prev') )
  */

  find_prev ??= ($ => $('a.prev'));
  find_next ??= ($ => $('a.next'));

  const $             = Cheerio.load(html);
  let   prev_modified = false;
  let   next_modified = false;

  UPDATE_PREV:
  if (pagination.prev != null) {
    const prev_href = normalizeKeyToUrl(pagination.prev);

    const prev_elements = find_prev($);
    if (prev_elements.length === 0) {
      // There are no paginated links to modify
      break UPDATE_PREV;
    }
    const prev_hrefs = Array.from(prev_elements.map((i, el) => $(el).attr("href")));
    if (prev_hrefs.length == 0) {
      break UPDATE_PREV;
    }

    if (! prev_hrefs.some(href => href != prev_href)) {
      break UPDATE_PREV;
    }

    prev_modified = true;
    prev_elements.attr("href", prev_href);
  }

  UPDATE_NEXT:
  if (pagination.next != null) {
    const next_href = normalizeKeyToUrl(pagination.next);

    const next_elements = find_next($);
    if (next_elements.length === 0) {
      // There are no paginated links to modify
      break UPDATE_NEXT;
    }
    const next_hrefs = Array.from(next_elements.map((i, el) => $(el).attr("href")));
    if (next_hrefs.length == 0) {
      break UPDATE_NEXT;
    }

    if (! next_hrefs.some(href => href != next_href)) {
      break UPDATE_NEXT;
    }

    next_modified = true;
    next_elements.attr("href", next_href);
  }

  if (prev_modified || next_modified) {
    return $.html();
  }
  else {
    return html
  };
}


export function getPagination (html, find_prev=null, find_next=null) {
  /*
    Given a StaticSiteFile, find paginated links and return their href links in
    a dict, associating 'next' and 'prev' with arrays of links.

    The Cheerio search functions to find the pagination links can be overridden,
    but default to functions which, given Cheerio object, query for anchor
    elements with the .next and .prev attributes.
  */

  find_prev = find_prev ?? ($ => $('a.prev'));
  find_next = find_next ?? ($ => $('a.next'));

  const $ = Cheerio.load(html);

  return {
    prev: find_prev($).map((i, element) => $(element).attr("href")).toArray(),
    next: find_next($).map((i, element) => $(element).attr("href")).toArray()
  };
}


export function normalizeUrlToKey (url) {
  if (url == "")
    return null;

  if (! url.endsWith(".html"))
    if (! url.endsWith("/"))
      url = url + "/";
    url = url + "index.html";

  if (url.startsWith("/"))
    url = url.slice(1);

  return url;
}


export function normalizeKeyToUrl (key) {
  if (key.endsWith("index.html")) {
    key = key.slice(0, 10);
  }
  else if ( ! (                                         // if not
    (key.split("/").at(-1)?.indexOf(".") ?? -1) + 1 ||  // a file path, nor
    key.at(-1) === "/"                                  // has trailing slash
  )) {
    key += "/"
  }

  // Ensure an absolute path
  if (key[0] !== "/")
    key = "/" + key;

  return key;
}


export async function incrementBetweenBuilds (old_files, new_files, options={}) {
  /*
    Given `old_files` (an array of StaticSiteFiles), and
    `new_files`, calcuate content changes to those files for
    repagination and determine which pages are updates. Returns a
    mapping between file keys of which which StaticSiteFiles are
    updates, and their contents.
  */

  const force              = options.force              ?? false;
  const enforce_pagination = options.enforce_pagination ?? true;

  // Filter for existing date-paginated pages in `old_files`, and
  // put them into a dict indexed by date.

  const existing_objects   = {};
  const day_pages_existing = {};
  const static_pages       = {};

  for (let file of old_files) {
    existing_objects[file.key] = file;

    const date_match = file.key.match(DATE_URL_KEY_RGX);
    if (date_match) {
      day_pages_existing[date_match[1]] = file;
    }

    if (force) {
      static_pages[file.key] = await file.content();
    }
  }

  //
  // For `new_files`, filter for pages paginated by
  // date, and add them to a dict, indexed by the date.
  //
  // Put all other build output files into static_pages, indexed by URL key,
  // and skipping files which already exist with matching hashes.
  //
  const day_pages_new = {};

  for await (let new_page of new_files) {
    const date_match = new_page.key.match(DATE_URL_KEY_RGX);
    const hash = await new_page.hash();

    if ( ! date_match ) {
      const existing_page = existing_objects[new_page.key];
      static_pages[new_page.key] = await new_page.content();
      continue;
    }

    const date = date_match[1];
    day_pages_new[date] = new_page;
  }

  //
  // Prepare an array of merge entry objects to use for comparison of new
  // pages and old to flag pages who in need of their paginated links being
  // adjusted.
  //
  const day_pages_existing_keys = Object.keys(day_pages_existing).sort();
  const day_pages_new_keys      = Object.keys(day_pages_new).sort();

  const merged = mergeIndexedArrays(
    day_pages_existing_keys,
    day_pages_new_keys,
    day_pages_existing,
    day_pages_new
  );

  // Look for new/updated pages, and updated entries to the merged array,
  // annotating those merge objects with boolean flags about the types of
  // updates in that set of files.

  for (let merge of merged) {
    // There are various causes for which a page may be an update. The most
    // obvious is that there simply is a new page, but there are other cases we
    // need to detect in pages where both a newly-generated and old page exist.
    // A page may also be updated because its content hash is different than
    // before, or that adjacent pages are added, requiring pagination links be
    // updated.
    //
    // For each merge entry (and by extension, each old and new SSG file),
    // perform these checks so that update operations may be later determined.

    const a = Boolean(merge.value_a);
    const b = Boolean(merge.value_b);

    const both_pages             =  a && b;
    const is_new_page            = !a && b;
    const is_hash_update         = both_pages && ( await merge.value_a.hash() !== await merge.value_b.hash() );
    const is_a_pagination_update = a && (merge.prev_a !== merge.prev || merge.next_a !== merge.next);
    const is_b_pagination_update = b && (merge.prev_b !== merge.prev || merge.next_b !== merge.next);

    const is_pagination_update   = is_b_pagination_update || ( is_a_pagination_update && ! is_hash_update );
    const is_content_update      = is_hash_update         || is_pagination_update;
    const is_update              = is_new_page            || is_content_update;

    Object.assign(merge, {
      is_update,
      is_content_update,
      is_pagination_update,
      is_new_page,
      is_hash_update,
      is_a_pagination_update,
      is_b_pagination_update,
    });
  }

  if (enforce_pagination) {

    for (let merge_entry of merged) {

      // Get a StaticSiteFile from the merge_entry, prioritizing
      // the B (new_files) value. At least one of these values
      // should be truthy, so this should evaluate to one of
      // them, or else mergeIndexedArrays has a bug.
      //
      const page       = merge_entry.value_b || merge_entry.value_a;
      const pagination = getPagination(await page.content());

      const next_links = Array.from( new Set(
        pagination.next.map(normalizeUrlToKey).filter(x => x != null)
      ));

      const prev_links = Array.from(new Set(
        pagination.prev.map(normalizeUrlToKey).filter(x => x != null)
      ));

      // Get the next and previous cannonical page links from the merge_entry,
      // and normalize indices into static site build keys (ie: they include
      // index.html)

      let prev_href = merge_entry.prev && normalizeUrlToKey(merge_entry.prev);
      let next_href = merge_entry.next && normalizeUrlToKey(merge_entry.next);

      //
      // Detect any changes in existing next and previous links within the
      // page. First is a check which evaluates the set of detected links, and
      // determines whether the length of that set is different from the set of
      // the respective set of cannonical next or prev links, which will equal
      // either one or zero, depending on whether the link exists in the merge.
      // Also, this criteria causes pages with multiple matched pagination
      // links with mismatched hrefs to flag this page as requiring a
      // pagination update. This criteria needs to exist, due to the
      // possiblity of links not existing or this page being the start or end
      // of pagination.
      //
      // Next, check the links themselves, and whether any of them differ
      //
      const is_pagination_update = (
        next_links.length != Boolean(next_href)    || 
        prev_links.length != Boolean(prev_href)    || 
        next_links.some(href => href != next_href) ||
        prev_links.some(href => href != prev_href)
      );

      if (is_pagination_update) {
        merge_entry[
          (page === merge_entry.value_a)
          ? 'is_a_pagination_update'
          : 'is_b_pagination_update'
        ] = true;

        merge_entry.is_update            = true;
        merge_entry.is_content_update    = true;
        merge_entry.is_pagination_update = true;
      }
    }
  }

  //
  // Calculate updates, populating the static_pages dict to be returned
  //
  await Promise.all( merged.map(async merge_entry => {
    if (!(force || merge_entry.is_update))
      return;

    const page             = merge_entry.value_b || merge_entry.value_a;
    const original_content = await page.content();
    let   content          = original_content;

    if (enforce_pagination || merge_entry.is_pagination_update) {
      content = updatePagination(content, merge_entry);
    }

    if (force || content != original_content || merge_entry.is_new_page) {
      static_pages[page.key] = content;
    }
  }));

  //
  // Unless forcing, remove any updates which match an old page
  //
  if (!force) {
    for (let key of Object.keys(static_pages)) {
      const updated_content = static_pages[key];
      if (updated_content == await existing_objects[key]?.content()) {
        delete static_pages[key];
      }
    }
  }

  return static_pages;
}
