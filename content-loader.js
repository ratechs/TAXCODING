/*
  ============================================================
  TAXCODE GOOGLE SHEETS CONTENT LOADER
  ============================================================

  PURPOSE:
  Google Sheets = single source of truth for website content.

  REQUIRED SHEETS:
    1. content
    2. services

  CONTENT SHEET:
    section | key | value

  SERVICES SHEET:
    category_slug | category_label | category_desc | turnaround | item_name | item_code

  SETUP:
    window.TAXCODE_SHEET_ID = "YOUR_GOOGLE_SHEET_ID";

  The same JS can be used in:
    index.html
    service.html

  IMPORTANT:
    The Google Sheet must be published/readable by the browser.

  ============================================================
*/

(function () {
  "use strict";

  /* ==========================================================
     CONFIGURATION
     ========================================================== */

  const SHEET_ID = window.TAXCODE_SHEET_ID;

  // Automatically refresh sheet content.
  // 0 = disabled.
  // Example: 5 * 60 * 1000 = 5 minutes.
  const AUTO_REFRESH_INTERVAL = 0;

  // Set true only if you intentionally store HTML in the Sheet.
  const ALLOW_HTML_CONTENT = true;

  /*
    Keys that are allowed to contain HTML.

    Example Sheet value:

    <strong>Professional</strong> tax services

    If a key is not listed here, textContent is used.
  */
  const HTML_KEYS = new Set([
    "hero_title",
    "hero_description",
    "about_description",
    "footer_description",
    "cta_title",
    "cta_description"
  ]);

  /* ==========================================================
     VALIDATE SHEET ID
     ========================================================== */

  if (
    !SHEET_ID ||
    SHEET_ID.trim() === "" ||
    SHEET_ID.indexOf("PUT_YOUR") === 0
  ) {
    console.info(
      "TaxCode: No Google Sheet connected. Using built-in HTML content."
    );
    return;
  }

  /* ==========================================================
     GOOGLE SHEET CSV URL
     ========================================================== */

  function csvUrl(tabName) {
    return (
      "https://docs.google.com/spreadsheets/d/" +
      encodeURIComponent(SHEET_ID) +
      "/gviz/tq?tqx=out:csv&sheet=" +
      encodeURIComponent(tabName)
    );
  }

  /* ==========================================================
     FETCH SHEET
     ========================================================== */

  async function fetchSheet(tabName) {
    const response = await fetch(csvUrl(tabName), {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(
        `Google Sheet "${tabName}" returned HTTP ${response.status}`
      );
    }

    return await response.text();
  }

  /* ==========================================================
     CSV PARSER
     ========================================================== */

  function parseCSV(text) {
    const rows = [];

    let row = [];
    let field = "";
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      /* Inside quoted field */
      if (insideQuotes) {
        if (char === '"') {
          /*
            Two quotes inside quoted CSV field = one quote
          */
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            insideQuotes = false;
          }
        } else {
          field += char;
        }

        continue;
      }

      /* Start quoted field */
      if (char === '"') {
        insideQuotes = true;
        continue;
      }

      /* Column separator */
      if (char === ",") {
        row.push(field);
        field = "";
        continue;
      }

      /* New line */
      if (char === "\n" || char === "\r") {
        if (char === "\r" && text[i + 1] === "\n") {
          i++;
        }

        row.push(field);
        field = "";

        /*
          Ignore completely empty rows
        */
        if (row.some(value => String(value).trim() !== "")) {
          rows.push(row);
        }

        row = [];
        continue;
      }

      field += char;
    }

    /*
      Add final field/row
    */
    if (field.length > 0 || row.length > 0) {
      row.push(field);

      if (row.some(value => String(value).trim() !== "")) {
        rows.push(row);
      }
    }

    return rows;
  }

  /* ==========================================================
     CSV -> OBJECTS
     ========================================================== */

  function toObjects(rows) {
    if (!rows.length) {
      return [];
    }

    const headers = rows[0].map(header =>
      String(header || "").trim()
    );

    return rows
      .slice(1)
      .filter(row =>
        row.some(cell =>
          String(cell || "").trim() !== ""
        )
      )
      .map(row => {
        const object = {};

        headers.forEach((header, index) => {
          if (!header) return;

          object[header] = String(
            row[index] || ""
          ).trim();
        });

        return object;
      });
  }

  /* ==========================================================
     CONTENT MAP
     ========================================================== */

  function buildContentMap(rows) {
    const map = {};

    rows.forEach(row => {
      const key = String(row.key || "").trim();

      if (!key) {
        return;
      }

      /*
        Ignore visual section divider rows.
        Example:
          — HERO —
          — SERVICES —
      */
      if (
        key.startsWith("—") &&
        key.endsWith("—")
      ) {
        return;
      }

      map[key] = row.value || "";
    });

    return map;
  }

  /* ==========================================================
     APPLY CONTENT VALUE
     ========================================================== */

  function applyValue(element, value) {
    if (!element) {
      return;
    }

    /*
      If value is undefined, don't change existing HTML.
      This gives you the fallback behavior.
    */
    if (value === undefined || value === null) {
      return;
    }

    const cleanValue = String(value);

    /*
      Empty Sheet value:
      Keep existing HTML.
    */
    if (cleanValue.trim() === "") {
      return;
    }

    const tagName = element.tagName;

    /* --------------------------------------------------------
       META TAG
       -------------------------------------------------------- */

    if (tagName === "META") {
      element.setAttribute("content", cleanValue);
      return;
    }

    /* --------------------------------------------------------
       TITLE TAG
       -------------------------------------------------------- */

    if (tagName === "TITLE") {
      element.textContent = cleanValue;
      return;
    }

    /* --------------------------------------------------------
       NORMAL ELEMENT
       -------------------------------------------------------- */

    const key = element.getAttribute("data-key");

    if (
      ALLOW_HTML_CONTENT &&
      HTML_KEYS.has(key)
    ) {
      element.innerHTML = cleanValue;
    } else {
      element.textContent = cleanValue;
    }
  }

  /* ==========================================================
     APPLY ALL CONTENT
     ========================================================== */

  function applyContent(contentMap) {
    const elements = document.querySelectorAll(
      "[data-key]"
    );

    elements.forEach(element => {
      const key = element.getAttribute("data-key");

      if (!key) {
        return;
      }

      applyValue(
        element,
        contentMap[key]
      );
    });

    console.log(
      `TaxCode: Applied ${elements.length} content elements.`
    );
  }

  /* ==========================================================
     LOAD CONTENT TAB
     ========================================================== */

  async function loadContent() {
    try {
      const csvText = await fetchSheet("content");

      const rows = parseCSV(csvText);
      const objects = toObjects(rows);
      const contentMap = buildContentMap(objects);

      applyContent(contentMap);

      console.log(
        "TaxCode: Content sheet loaded successfully."
      );

      return contentMap;

    } catch (error) {
      console.warn(
        "TaxCode: Content sheet unavailable. Keeping existing HTML.",
        error
      );

      return null;
    }
  }

  /* ==========================================================
     BUILD SERVICES DATA
     ========================================================== */

  function buildCategories(rows) {
    const categories = {};

    rows.forEach(row => {
      const slug = String(
        row.category_slug || ""
      ).trim();

      if (!slug) {
        return;
      }

      /*
        Create category
      */
      if (!categories[slug]) {
        categories[slug] = {
          slug: slug,
          label: row.category_label || "",
          desc: row.category_desc || "",
          turnaround: row.turnaround || "",
          items: []
        };
      }

      /*
        Add service item
      */
      const itemName = String(
        row.item_name || ""
      ).trim();

      const itemCode = String(
        row.item_code || ""
      ).trim();

      if (itemName) {
        categories[slug].items.push({
          name: itemName,
          code: itemCode
        });
      }
    });

    return categories;
  }

  /* ==========================================================
     LOAD SERVICES TAB
     ========================================================== */

  async function loadServices() {
    try {
      const csvText = await fetchSheet("services");

      const rows = parseCSV(csvText);
      const objects = toObjects(rows);

      const categories = buildCategories(objects);

      /*
        Render everything
      */
      renderCatalog(categories);
      renderSummary(categories);
      renderCategoryLabels(categories);

      console.log(
        `TaxCode: Loaded ${Object.keys(categories).length} service categories.`
      );

      return categories;

    } catch (error) {
      console.warn(
        "TaxCode: Services sheet unavailable. Keeping existing HTML.",
        error
      );

      return null;
    }
  }

  /* ==========================================================
     RENDER SERVICE CATALOG
     ========================================================== */

  function renderCatalog(categories) {
    Object.keys(categories).forEach(slug => {

      /*
        Use getElementById instead of CSS selector.
        Safer for slugs.
      */
      const block = document.getElementById(slug);

      if (!block) {
        return;
      }

      const category = categories[slug];

      /* ------------------------------------------------------
         CATEGORY TITLE
         ------------------------------------------------------ */

      const titleElement =
        block.querySelector(
          ".cat-head h2"
        );

      if (
        titleElement &&
        category.label
      ) {
        const icon =
          titleElement.querySelector("i");

        /*
          Clear existing title
        */
        titleElement.textContent = "";

        /*
          Keep icon
        */
        if (icon) {
          titleElement.appendChild(icon);
          titleElement.appendChild(
            document.createTextNode(" ")
          );
        }

        titleElement.appendChild(
          document.createTextNode(
            category.label
          )
        );
      }

      /* ------------------------------------------------------
         TURNAROUND
         ------------------------------------------------------ */

      const turnaroundElement =
        block.querySelector(
          ".cat-head .turnaround"
        );

      if (
        turnaroundElement &&
        category.turnaround
      ) {
        turnaroundElement.textContent =
          category.turnaround;
      }

      /* ------------------------------------------------------
         DESCRIPTION
         ------------------------------------------------------ */

      const descriptionElement =
        block.querySelector(
          ".cat-desc"
        );

      if (
        descriptionElement &&
        category.desc
      ) {
        descriptionElement.textContent =
          category.desc;
      }

      /* ------------------------------------------------------
         REMOVE OLD ITEMS FIRST
         ------------------------------------------------------ */

      block
        .querySelectorAll(".item-row")
        .forEach(row => row.remove());

      /* ------------------------------------------------------
         CREATE NEW ITEMS
         ------------------------------------------------------ */

      const ctaRow =
        block.querySelector(".cat-cta");

      category.items.forEach(item => {

        const itemRow =
          document.createElement("div");

        itemRow.className =
          "item-row";

        const name =
          document.createElement("span");

        name.className = "iname";

        name.textContent =
          item.name;

        const code =
          document.createElement("span");

        code.className = "icode";

        code.textContent =
          item.code || "";

        itemRow.appendChild(name);
        itemRow.appendChild(code);

        /*
          Insert before CTA.
        */
        if (ctaRow) {
          block.insertBefore(
            itemRow,
            ctaRow
          );
        } else {
          block.appendChild(
            itemRow
          );
        }
      });

      /* ------------------------------------------------------
         TABLE OF CONTENTS COUNT
         ------------------------------------------------------ */

      const tocLink =
        document.querySelector(
          `.toc a[href="#${CSS.escape(slug)}"]`
        );

      if (tocLink) {
        const count =
          tocLink.querySelector(".count");

        if (count) {
          count.textContent =
            String(
              category.items.length
            ).padStart(2, "0");
        }
      }
    });
  }

  /* ==========================================================
     RENDER HOMEPAGE SERVICE SUMMARY
     ========================================================== */

  function renderSummary(categories) {
    document
      .querySelectorAll("[data-cat]")
      .forEach(row => {

        const slug =
          row.getAttribute(
            "data-cat"
          );

        if (!slug) {
          return;
        }

        const category =
          categories[slug];

        /*
          Category doesn't exist in Sheet.
          Leave existing HTML unchanged.
        */
        if (!category) {
          return;
        }

        /* ----------------------------------------------------
           NAME
           ---------------------------------------------------- */

        const nameElement =
          row.querySelector(
            ".sname"
          );

        if (
          nameElement &&
          category.label
        ) {
          const icon =
            nameElement.querySelector("i");

          nameElement.textContent = "";

          if (icon) {
            nameElement.appendChild(icon);

            nameElement.appendChild(
              document.createTextNode(" ")
            );
          }

          nameElement.appendChild(
            document.createTextNode(
              category.label
            )
          );
        }

        /* ----------------------------------------------------
           DESCRIPTION
           ---------------------------------------------------- */

        const descriptionElement =
          row.querySelector(
            ".sdesc"
          );

        if (
          descriptionElement &&
          category.desc
        ) {
          /*
            Preserve any child elements only if
            the HTML contains them intentionally.
          */

          const firstTextNode =
            Array.from(
              descriptionElement.childNodes
            ).find(
              node =>
                node.nodeType ===
                Node.TEXT_NODE
            );

          if (firstTextNode) {
            firstTextNode.textContent =
              category.desc + " ";
          } else {
            descriptionElement.textContent =
              category.desc;
          }
        }

        /* ----------------------------------------------------
           TURNAROUND
           ---------------------------------------------------- */

        const timeElement =
          row.querySelector(
            ".stime"
          );

        if (
          timeElement &&
          category.turnaround
        ) {
          timeElement.textContent =
            category.turnaround;
        }

        /* ----------------------------------------------------
           TAGS
           ---------------------------------------------------- */

        const tagsElement =
          row.querySelector(
            ".tags"
          );

        if (tagsElement) {

          /*
            Remove old tags
          */
          tagsElement.innerHTML = "";

          /*
            Show first 4 services
          */
          category.items
            .slice(0, 4)
            .forEach(item => {

              const tag =
                document.createElement(
                  "span"
                );

              tag.className = "tag";

              tag.textContent =
                item.name;

              tagsElement.appendChild(
                tag
              );
            });
        }
      });
  }

  /* ==========================================================
     CATEGORY LABELS
     ==========================================================

     Works with:

       data-cat-label="income-tax"

     Example:

       <a data-cat-label="income-tax"></a>

     The category name comes automatically
     from the services Sheet.
  */

  function renderCategoryLabels(categories) {
    document
      .querySelectorAll(
        "[data-cat-label]"
      )
      .forEach(element => {

        const slug =
          element.getAttribute(
            "data-cat-label"
          );

        if (!slug) {
          return;
        }

        const category =
          categories[slug];

        if (
          category &&
          category.label
        ) {
          element.textContent =
            category.label;
        }
      });
  }

  /* ==========================================================
     LOAD EVERYTHING
     ========================================================== */

  async function loadAllContent() {

    /*
      Load both sheets independently.

      If one fails, the other can still load.
    */
    await Promise.allSettled([
      loadContent(),
      loadServices()
    ]);

    /*
      Custom event.

      Other JS files can listen for:

      document.addEventListener(
        "taxcodeContentLoaded",
        function () {
          // your code
        }
      );
    */
    document.dispatchEvent(
      new CustomEvent(
        "taxcodeContentLoaded"
      )
    );

    console.log(
      "TaxCode: Google Sheets content loading finished."
    );
  }

  /* ==========================================================
     INITIAL LOAD
     ========================================================== */

  /*
    Wait until DOM is ready.
  */
  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      loadAllContent
    );
  } else {
    loadAllContent();
  }

  /* ==========================================================
     OPTIONAL AUTO REFRESH
     ========================================================== */

  if (
    AUTO_REFRESH_INTERVAL > 0
  ) {
    setInterval(
      loadAllContent,
      AUTO_REFRESH_INTERVAL
    );

    console.log(
      `TaxCode: Automatic Google Sheet refresh enabled every ${
        AUTO_REFRESH_INTERVAL / 1000
      } seconds.`
    );
  }

})();