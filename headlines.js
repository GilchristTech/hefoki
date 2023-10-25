const cheerio = require("cheerio");


class EventPortalParseNode {
  constructor (element, parent=null) {
    this.element  = element;
    this.parent   = parent;
    this.title    = null;
    this.text     = null;
    this.children = null;
    this.url      = null;

    this.date           = null;
    this.article_links  = null;
    this.external_links = null;
  }

  generateHeadlines (parent_metadata={}) {
    const metadata  = {
      date:           this.date || parent_metadata.date || null,
      external_links: parent_metadata.external_links ??   [],
      tags: [
        ...(parent_metadata.tags ?? []),
        ...(this.article_links   ?? []),
      ],
    };

    if (this.children === null) {
      metadata.text           = this.title;
      metadata.external_links = this.external_links;
      return [ metadata ];
    }

    const headlines = [];

    if (this.title) {
      metadata.tags.push(this.title);
    }

    if (this.url) {
      metadata.tags.push(this.url);
    }

    for (let child of this.children) {
      headlines.push(...child.generateHeadlines(metadata));
    }

    return headlines;
  }
}


function processCurrentEventDOM ($, item, parent=null) {
  /*
    Given a CheerioAPI object, an Element object, and an optional
    EventPortalParseNode parent, recursively parse DOM Elements containing
    categories/subcategories and headlines, returning a EventPortalParseNode.
  */

  /*
    Current DOM element child processing to find categories.
  */
  const titled_lists = [];
  let   name_accumulator = null;
  let   url_accumulator  = null;

  for (let child of item.children) {
    switch (child.name) {
      // Skip text nodes
      case undefined:
        continue;

      // Look for category names and urls. A link or paragraph tag which comes
      // before an unordered list denotes a category, so keep track of the
      // last ones seen.
      case "a":
        url_accumulator = child.attribs.href;
        // passthrough: links and paragraph tags both have text content, but
        // only links have hrefs.
      case "p":
        name_accumulator = $(child).text().trim();
        break;

      case "ul": {
        titled_lists.push([name_accumulator, url_accumulator, child]);
        name_accumulator = null;
        url_accumulator  = null;
        break;
      }
    }
  }

  /*
    If this element has no lists, it is a leaf node, and provides textual
    information on this story, rather than being a categorical designation.

    Get the text from the element and return it.
  */
  if (titled_lists.length == 0) {
    const event_leaf          = new EventPortalParseNode(item, parent);
    event_leaf.title          = $(item).text().trim();
    event_leaf.article_links  = [];
    event_leaf.external_links = [];

    const links = $(item).find("a");

    for (let link of links) {
      const href = link.attribs.href;

      if (href.startsWith("/wiki/")) {
        event_leaf.article_links.push(href);
      }
      else if (href.startsWith("http")) {
        event_leaf.external_links.push(href);
      }
    }

    return event_leaf;
  }

  /*
    Categorical tree building and DOM parsing recursion
  */

  const category = new EventPortalParseNode(item, parent);
  category.children = [];

  for (let [title, url, ul] of titled_lists) {
    const subcategory    = new EventPortalParseNode(ul, category);

    // Categories which are a link to another article are put into the tree as
    // a wiki link.

    if (url && title && url.startsWith("/wiki/")) {
      subcategory.article_links = [url];
    }
    else {
      subcategory.title = title;
      subcategory.url   = url;
    }

    subcategory.children = [];

    for (let list_item of $(ul).children("li")) {
      const children = processCurrentEventDOM($, list_item, subcategory);
      subcategory.children.push(children);
    }

    category.children.push(subcategory);
  }

  return category;
}


function parseHeadlinesFromHtml (html) {
  const $ = cheerio.load(html);

  const current_event_day_containers = $('.current-events-main.vevent');

  if (!current_event_day_containers || current_event_day_containers.length === 0) {
    throw Exception("Could not find any current event day containers in HTML");
  }

  const day_parse_trees = [];

  for (let day_block of current_event_day_containers) {
    const day_block_content = $(day_block).find(".current-events-content")[0];
    const day_parse_tree    = new EventPortalParseNode(day_block_content);
    const day_title         = $(day_block).find(".current-events-title").text().trim();

    day_parse_trees.push(day_parse_tree);

    const date_match = day_title.match(/.*\((\d{4}-\d{2}-\d{2})\).*/);
    
    if (!date_match) {
      day_parse_tree.title = events_title;
      continue;
    }

    day_parse_tree.date     = date_match[1];
    day_parse_tree.children = [processCurrentEventDOM($, day_block_content, day_parse_tree)];
  }

  const headlines = [];

  for (let day_parse_tree of day_parse_trees) {
    const day_headlines = day_parse_tree.generateHeadlines();
    headlines.push(...day_headlines);
  }

  return headlines;
}


async function fetchHeadlines (url=null) {
  if (url === null) {
    url = "https://en.wikipedia.org/wiki/Portal:Current_events";
  }

  console.log("fetch:", url);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP error, status: ${response.status}`);
  }

  const html = await response.text();

  return parseHeadlinesFromHtml(html);
}


module.exports = {
  parseHeadlinesFromHtml,
  fetchHeadlines,
};
