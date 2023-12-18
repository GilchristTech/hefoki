export const headlines_array = [
  {
      "date": "2023-11-14",
      "external_links": [
          "https://www.example.com/unit-test-passes"
      ],
      "tags": [
          "Science and technology",
          "/wiki/Unit_testing",
          "/wiki/1"
      ],
      "text": "Unit test fails!"
  },
  {
      "date": "2023-11-14",
      "external_links": [
          "https://www.example.com/second-unit-test-passes"
      ],
      "tags": [
          "Science and technology",
          "/wiki/Unit_testing",
          "/wiki/2"
      ],
      "text": "Second test fails!"
  },
  {
      "date": "2023-11-14",
      "external_links": [
          "https://www.example.com/third-unit-test-passes"
      ],
      "tags": [
          "Science and technology",
          "/wiki/Unit_testing",
          "/wiki/3"
      ],
      "text": "Third test fails!"
  },
  {
      "date": "2023-11-14",
      "external_links": [
          "https://www.example.com/fourth-unit-test-passes"
      ],
      "tags": [
          "Science and technology",
          "/wiki/Unit_testing",
          "/wiki/4"
      ],
      "text": "Fourth test fails!"
  },
  {
      "date": "2023-11-14",
      "external_links": [
          "https://www.example.com/fifth-unit-test-passes"
      ],
      "tags": [
          "Science and technology",
          "/wiki/Unit_testing",
          "/wiki/5"
      ],
      "text": "Fifth test fails!"
  },
];


export function generateHtml (insert={}) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${insert.title || "Test page"}</title>${ insert.head || ""}</head>
<body>${ insert.body || ""}${ insert.main ? "<main>"+insert.main+"</main>" : "" }</body>
</html>`
}


export function generateHtmlPaginated(index, prev, next, insert={}) {
  const title = insert.title || (`Page: ${index}`);
  prev ??= "";
  next ??= "";
  return generateHtml({
    ...insert,
    title,
    main: (
      "<nav>"                                          +
        `<a class="prev" href="${prev}">Previous</a>`  +
        `<h1>${title}</h1>`                            +
        `<a class="next" href="${next}">Next</a>`      +
      "</nav>"                                         +
      ( insert.main || "" )
    ),
  });
}


export const html = {
  plain: generateHtml({ title: 'Plain page' })
};
