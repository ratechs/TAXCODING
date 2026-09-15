(function () {
  "use strict";

  /*
   * ==========================================================
   * TAXCODE - GOOGLE SHEETS CONTENT MANAGEMENT SYSTEM
   * Static HTML + CSS + JavaScript
   * No backend / no framework
   * ==========================================================
   */

  const SHEET_ID = window.TAXCODE_SHEET_ID;

  if (!SHEET_ID) {
    console.error("TaxCode: Google Sheet ID is missing.");
    return;
  }

  const SHEETS = {
    content: "content",
    services: "services",
    deadlines: "deadlines",
    process: "process",
    settings: "settings"
  };

  let CONTENT = {};
  let SERVICES = [];
  let DEADLINES = [];
  let PROCESS = [];
  let SETTINGS = {};

  /*
   * ----------------------------------------------------------
   * Google Sheet CSV URL
   * ----------------------------------------------------------
   */

  function csvUrl(sheetName) {
    return (
      "https://docs.google.com/spreadsheets/d/" +
      encodeURIComponent(SHEET_ID) +
      "/gviz/tq?tqx=out:csv&sheet=" +
      encodeURIComponent(sheetName)
    );
  }

  /*
   * ----------------------------------------------------------
   * Fetch sheet
   * ----------------------------------------------------------
   */

  async function fetchSheet(sheetName) {
    const response = await fetch(csvUrl(sheetName), {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(
        `Google Sheet "${sheetName}" returned ${response.status}`
      );
    }

    return await response.text();
  }

  /*
   * ----------------------------------------------------------
   * CSV parser
   * Handles quoted values, commas and new lines
   * ----------------------------------------------------------
   */

  function parseCSV(csv) {
    const rows = [];
    let row = [];
    let value = "";
    let insideQuotes = false;

    for (let i = 0; i < csv.length; i++) {
      const char = csv[i];
      const next = csv[i + 1];

      if (char === '"' && insideQuotes && next === '"') {
        value += '"';
        i++;
        continue;
      }

      if (char === '"') {
        insideQuotes = !insideQuotes;
        continue;
      }

      if (char === "," && !insideQuotes) {
        row.push(value);
        value = "";
        continue;
      }

      if (char === "\n" && !insideQuotes) {
        row.push(value);
        rows.push(row);

        row = [];
        value = "";

        continue;
      }

      if (char !== "\r") {
        value += char;
      }
    }

    if (value.length || row.length) {
      row.push(value);
      rows.push(row);
    }

    return rows;
  }

  /*
   * ----------------------------------------------------------
   * CSV -> objects
   * ----------------------------------------------------------
   */

  function toObjects(csv) {
    const rows = parseCSV(csv);

    if (!rows.length) {
      return [];
    }

    const headers = rows[0].map(header =>
      String(header).trim()
    );

    return rows
      .slice(1)
      .filter(row =>
        row.some(cell => String(cell).trim() !== "")
      )
      .map(row => {
        const obj = {};

        headers.forEach((header, index) => {
          obj[header] = String(row[index] ?? "").trim();
        });

        return obj;
      });
  }

  /*
   * ----------------------------------------------------------
   * Helpers
   * ----------------------------------------------------------
   */

  function isVisible(value) {
    if (value === undefined || value === null) {
      return true;
    }

    const v = String(value).trim().toLowerCase();

    return ![
      "false",
      "0",
      "no",
      "hidden",
      "off"
    ].includes(v);
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /*
   * Content fields such as hero_title may contain <br>.
   * Only allow the small set of formatting tags we intentionally
   * support.
   */

  function safeHTML(value) {
    return String(value ?? "")
      .replace(/<br\s*\/?>/gi, "<br>")
      .replace(/<strong>/gi, "<strong>")
      .replace(/<\/strong>/gi, "</strong>")
      .replace(/<em>/gi, "<em>")
      .replace(/<\/em>/gi, "</em>")
      .replace(/<(?!br\s*\/?|\/?(strong|em)\b)[^>]*>/gi, "");
  }

  function splitPipe(value) {
    return String(value || "")
      .split("|")
      .map(item => item.trim())
      .filter(Boolean);
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /*
   * ----------------------------------------------------------
   * Load basic content
   * ----------------------------------------------------------
   */

  async function loadContent() {
    const csv = await fetchSheet(SHEETS.content);
    const rows = toObjects(csv);

    CONTENT = {};

    rows.forEach(row => {
      if (row.key) {
        CONTENT[row.key] = row.value || "";
      }
    });

    applyContent();

    console.log("TaxCode: content loaded.");
  }

  /*
   * ----------------------------------------------------------
   * Apply [data-key]
   * ----------------------------------------------------------
   */

  function applyContent() {
    document.querySelectorAll("[data-key]").forEach(element => {
      const key = element.dataset.key;

      if (!(key in CONTENT)) {
        return;
      }

      const value = CONTENT[key];

      if (
        element.tagName === "TITLE"
      ) {
        element.textContent = value;
        return;
      }

      if (
        element.tagName === "META"
      ) {
        element.setAttribute("content", value);
        return;
      }

      element.innerHTML = safeHTML(value);
    });
  }

  /*
   * ----------------------------------------------------------
   * Settings
   * ----------------------------------------------------------
   */

  async function loadSettings() {
    const csv = await fetchSheet(SHEETS.settings);
    const rows = toObjects(csv);

    SETTINGS = {};

    rows.forEach(row => {
      if (row.key) {
        SETTINGS[row.key] = row.value || "";
      }
    });

    applySettings();

    console.log("TaxCode: settings loaded.");
  }

  /*
   * ----------------------------------------------------------
   * Contact links / global settings
   * ----------------------------------------------------------
   */

  function applySettings() {
    const phone =
      SETTINGS.phone || "";

    const phoneDisplay =
      SETTINGS.phone_display ||
      phone;

    const email =
      SETTINGS.email || "";

    const whatsapp =
      SETTINGS.whatsapp ||
      phone.replace(/\D/g, "");

    /*
     * Phone links
     */

    document
      .querySelectorAll('a[href^="tel:"]')
      .forEach(link => {
        link.href = "tel:" + phone;
      });

    /*
     * Email links
     */

    document
      .querySelectorAll('a[href^="mailto:"]')
      .forEach(link => {
        link.href = "mailto:" + email;
      });

    /*
     * WhatsApp links
     */

    document
      .querySelectorAll('a[href*="wa.me/"]')
      .forEach(link => {
        link.href =
          "https://wa.me/" +
          whatsapp;
      });

    /*
     * Phone text
     */

    document
      .querySelectorAll('[data-setting="phone"]')
      .forEach(el => {
        el.textContent = phoneDisplay;
      });

    /*
     * Email text
     */

    document
      .querySelectorAll('[data-setting="email"]')
      .forEach(el => {
        el.textContent = email;
      });

    /*
     * Address
     */

    document
      .querySelectorAll('[data-setting="address"]')
      .forEach(el => {
        el.textContent =
          SETTINGS.address || "";
      });

    /*
     * Location
     */

    document
      .querySelectorAll('[data-setting="location"]')
      .forEach(el => {
        el.textContent =
          SETTINGS.location || "";
      });

    /*
     * Google Map
     */

    const map = document.querySelector(
      "[data-map]"
    );

    if (map && SETTINGS.map_url) {
      map.src = SETTINGS.map_url;
    }

    /*
     * Contact form
     */

    const form =
      document.getElementById("contactForm");

    if (
      form &&
      SETTINGS.form_url
    ) {
      form.action =
        SETTINGS.form_url;
    }
  }

  /*
   * ----------------------------------------------------------
   * Services
   * ----------------------------------------------------------
   */

  async function loadServices() {
    const csv =
      await fetchSheet(
        SHEETS.services
      );

    const rows = toObjects(csv);

    SERVICES = rows
      .filter(row => isVisible(row.visible))
      .map(row => ({
        slug:
          row.slug ||
          slugify(row.name),

        name:
          row.name || "",

        icon:
          row.icon ||
          "bi-check-circle",

        description:
          row.description || "",

        turnaround:
          row.turnaround || "",

        codePrefix:
          row.code_prefix || "",

        ctaText:
          row.cta_text || "Get started",

        ctaType:
          row.cta_type || "whatsapp",

        items:
          splitPipe(row.items),

        tags:
          splitPipe(row.tags)
      }));

    console.log(
      "TaxCode: services loaded.",
      SERVICES
    );

    renderHomepageServices();
    renderServicePage();
    renderServiceNavigation();
    renderServiceSelect();
    renderNavigationServices();
  }

  /*
   * ----------------------------------------------------------
   * CTA URL
   * ----------------------------------------------------------
   */

  function serviceCTA(service) {
    const phone =
      SETTINGS.phone || "";

    const whatsapp =
      SETTINGS.whatsapp ||
      phone.replace(/\D/g, "");

    if (
      service.ctaType === "phone"
    ) {
      return {
        href: "tel:" + phone,
        icon: "bi-telephone"
      };
    }

    if (
      service.ctaType === "email"
    ) {
      const email =
        SETTINGS.email || "";

      return {
        href:
          "mailto:" +
          email +
          "?subject=" +
          encodeURIComponent(
            service.name
          ),
        icon: "bi-envelope"
      };
    }

    return {
      href:
        "https://wa.me/" +
        whatsapp +
        "?text=" +
        encodeURIComponent(
          "Hello, I need help with " +
          service.name
        ),
      icon: "bi-whatsapp"
    };
  }

  /*
   * ----------------------------------------------------------
   * Homepage service cards
   * ----------------------------------------------------------
   */

  function renderHomepageServices() {
    const container =
      document.querySelector(
        "[data-services-container]"
      );

    if (!container) {
      return;
    }

    container.innerHTML = "";

    SERVICES.forEach(service => {
      const tags = service.tags
        .map(tag =>
          `<span class="tag">${escapeHTML(tag)}</span>`
        )
        .join("");

      const html = `
        <div class="service-row"
             data-cat="${escapeHTML(service.slug)}">

          <div class="sname">
            <i class="bi ${escapeHTML(service.icon)}"></i>
            ${escapeHTML(service.name)}
          </div>

          <div class="sdesc">
            ${escapeHTML(service.description)}

            <div class="tags">
              ${tags}
            </div>
          </div>

          <div>
            <div class="stime">
              ${escapeHTML(service.turnaround)}
            </div>

            <a
              class="slink"
              href="service.html#${encodeURIComponent(service.slug)}">
              <span data-key="svc_link_label">
                ${escapeHTML(
                  CONTENT.svc_link_label ||
                  "View details →"
                )}
              </span>
            </a>
          </div>

        </div>
      `;

      container.insertAdjacentHTML(
        "beforeend",
        html
      );
    });
  }

  /*
   * ----------------------------------------------------------
   * Service page TOC
   * ----------------------------------------------------------
   */

  function renderServiceNavigation() {
    const toc =
      document.querySelector(
        "[data-service-toc]"
      );

    if (!toc) {
      return;
    }

    toc.innerHTML = "";

    SERVICES.forEach(service => {
      const count =
        service.items.length
          .toString()
          .padStart(2, "0");

      toc.insertAdjacentHTML(
        "beforeend",
        `
        <a href="#${escapeHTML(service.slug)}">
          <span>
            ${escapeHTML(service.name)}
          </span>

          <span class="count mono">
            ${count}
          </span>
        </a>
        `
      );
    });
  }

  /*
   * ----------------------------------------------------------
   * Service page categories
   * ----------------------------------------------------------
   */

  function renderServicePage() {
    const container =
      document.querySelector(
        "[data-service-container]"
      );

    if (!container) {
      return;
    }

    container.innerHTML = "";

    SERVICES.forEach(service => {
      const cta =
        serviceCTA(service);

      const itemsHTML =
        service.items
          .map(
            (item, index) => {

              const number =
                String(index + 1)
                  .padStart(2, "0");

              const code =
                service.codePrefix
                  ? `${service.codePrefix}-${number}`
                  : number;

              return `
                <div class="item-row">
                  <span class="iname">
                    ${escapeHTML(item)}
                  </span>

                  <span class="icode">
                    ${escapeHTML(code)}
                  </span>
                </div>
              `;
            }
          )
          .join("");

      const html = `
        <div
          class="cat-block"
          id="${escapeHTML(service.slug)}">

          <div class="cat-head">

            <h2>
              <i class="bi ${escapeHTML(service.icon)}"></i>
              ${escapeHTML(service.name)}
            </h2>

            <span class="turnaround">
              ${escapeHTML(service.turnaround)}
            </span>

          </div>

          <p class="cat-desc">
            ${escapeHTML(service.description)}
          </p>

          ${itemsHTML}

          <div class="cat-cta">

            <a
              href="${escapeHTML(cta.href)}"
              class="btn-primary"
              target="${service.ctaType === "whatsapp" ? "_blank" : "_self"}">

              <i class="bi ${escapeHTML(cta.icon)}"></i>

              ${escapeHTML(service.ctaText)}

            </a>

          </div>

        </div>
      `;

      container.insertAdjacentHTML(
        "beforeend",
        html
      );
    });

    setupServiceScroll();
  }

  /*
   * ----------------------------------------------------------
   * Service select in contact form
   * ----------------------------------------------------------
   */

  function renderServiceSelect() {
    const select =
      document.querySelector(
        'select[name="entry.394071758"]'
      );

    if (!select) {
      return;
    }

    select.innerHTML = "";

    const placeholder =
      CONTENT.field_service_placeholder ||
      "Select a service";

    select.insertAdjacentHTML(
      "beforeend",
      `
      <option value="" disabled selected>
        ${escapeHTML(placeholder)}
      </option>
      `
    );

    SERVICES.forEach(service => {
      select.insertAdjacentHTML(
        "beforeend",
        `
        <option
          value="${escapeHTML(service.name)}"
          data-cat-label="${escapeHTML(service.slug)}">

          ${escapeHTML(service.name)}

        </option>
        `
      );
    });
  }

  /*
   * ----------------------------------------------------------
   * Category labels
   * ----------------------------------------------------------
   */

  function applyCategoryLabels() {
    document
      .querySelectorAll(
        "[data-cat-label]"
      )
      .forEach(element => {

        const slug =
          element.dataset.catLabel;

        const service =
          SERVICES.find(
            item => item.slug === slug
          );

        if (service) {
          element.textContent =
            service.name;
        }
      });
  }

  /*
   * ----------------------------------------------------------
   * Deadlines
   * ----------------------------------------------------------
   */

  async function loadDeadlines() {
    const container =
      document.querySelector(
        "[data-deadlines-container]"
      );

    if (!container) {
      return;
    }

    const csv =
      await fetchSheet(
        SHEETS.deadlines
      );

    DEADLINES =
      toObjects(csv)
        .filter(row =>
          isVisible(row.visible)
        );

    container.innerHTML = "";

    DEADLINES.forEach((deadline, index) => {

      const statusClass =
        String(deadline.status || "")
          .toLowerCase()
          .includes("filed")
          ? "filed"
          : String(deadline.status || "")
              .toLowerCase()
              .includes("due")
          ? "due"
          : "upcoming";

      container.insertAdjacentHTML(
        "beforeend",
        `
        <div class="dc-row">

          <div class="dc-left">

            <span class="dc-date mono">
              ${escapeHTML(deadline.date)}
            </span>

            <span class="dc-name">

              <span>
                ${escapeHTML(deadline.name)}
              </span>

              <small>
                ${escapeHTML(deadline.sub)}
              </small>

            </span>

          </div>

          <span class="status ${statusClass}">
            ${escapeHTML(deadline.status)}
          </span>

        </div>
        `
      );
    });
  }

  /*
   * ----------------------------------------------------------
   * Process
   * ----------------------------------------------------------
   */

  async function loadProcess() {
    const container =
      document.querySelector(
        "[data-process-container]"
      );

    if (!container) {
      return;
    }

    const csv =
      await fetchSheet(
        SHEETS.process
      );

    PROCESS =
      toObjects(csv)
        .filter(row =>
          isVisible(row.visible)
        );

    container.innerHTML = "";

    PROCESS.forEach((step, index) => {

      const number =
        step.number ||
        String(index + 1)
          .padStart(2, "0");

      container.insertAdjacentHTML(
        "beforeend",
        `
        <div class="process-step">

          <div class="pnum">
            ${escapeHTML(number)}
          </div>

          <h5>
            ${escapeHTML(step.title)}
          </h5>

          <p>
            ${escapeHTML(step.description)}
          </p>

        </div>
        `
      );
    });
  }

  /*
   * ----------------------------------------------------------
   * Service page scroll navigation
   * ----------------------------------------------------------
   */

  function setupServiceScroll() {
    const links =
      document.querySelectorAll(
        ".toc a"
      );

    const sections =
      document.querySelectorAll(
        ".cat-block"
      );

    if (!links.length || !sections.length) {
      return;
    }

    const setActive = () => {

      let current =
        sections[0].id;

      sections.forEach(section => {

        if (
          window.scrollY >=
          section.offsetTop - 140
        ) {
          current =
            section.id;
        }

      });

      links.forEach(link => {

        link.classList.toggle(
          "active",
          link.getAttribute("href") ===
          "#" + current
        );

      });
    };

    window.addEventListener(
      "scroll",
      setActive,
      { passive: true }
    );

    setActive();
  }

  /*
   * ----------------------------------------------------------
   * Contact form
   * ----------------------------------------------------------
   */

  function setupContactForm() {
    const form =
      document.getElementById(
        "contactForm"
      );

    const iframe =
      document.querySelector(
        'iframe[name="hidden_iframe"]'
      );

    if (!form || !iframe) {
      return;
    }

    let submitted = false;

    form.addEventListener(
      "submit",
      function () {
        submitted = true;
      }
    );

    iframe.addEventListener(
      "load",
      function () {

        if (!submitted) {
          return;
        }

        const toast =
          document.getElementById(
            "toast"
          );

        if (toast) {
          toast.classList.add("show");
        }

        form.reset();

        submitted = false;

        setTimeout(() => {

          if (toast) {
            toast.classList.remove(
              "show"
            );
          }

        }, 5000);
      }
    );
  }

  /*
   * ----------------------------------------------------------
   * Mobile drawer
   * ----------------------------------------------------------
   */

  function setupMobileMenu() {
    const drawer =
      document.getElementById(
        "drawer"
      );

    if (!drawer) {
      return;
    }

    drawer
      .querySelectorAll("a")
      .forEach(link => {

        link.addEventListener(
          "click",
          () => {
            drawer.classList.remove(
              "open"
            );
          }
        );

      });
  }

  /*
   * ----------------------------------------------------------
   * Update dynamic brand
   * ----------------------------------------------------------
   */

  function applyBrand() {

    const brand =
      SETTINGS.brand ||
      "TaxCode";

    const logo1 =
      SETTINGS.logo_text_1 ||
      "Tax";

    const logo2 =
      SETTINGS.logo_text_2 ||
      "Code";

    document
      .querySelectorAll(
        "[data-brand]"
      )
      .forEach(el => {

        el.innerHTML =
          `${escapeHTML(logo1)}
           <span class="dot">
             ${escapeHTML(logo2)}
           </span>`;

        el.setAttribute(
          "aria-label",
          brand
        );
      });
  }

  /*
   * ----------------------------------------------------------
   * MAIN
   * ----------------------------------------------------------
   */

  function renderNavigationServices() {

  const nav =
    document.querySelector(
      "[data-nav-services]"
    );

  const mobile =
    document.querySelector(
      "[data-mobile-services]"
    );

  const footer =
    document.querySelector(
      "[data-footer-services]"
    );

  const links = SERVICES
    .map(service => `
      <a
        href="service.html#${escapeHTML(service.slug)}"
        data-cat-label="${escapeHTML(service.slug)}">

        ${escapeHTML(service.name)}

      </a>
    `)
    .join("");

  if (nav) {
    nav.innerHTML = links;
  }

  if (mobile) {
    mobile.innerHTML = SERVICES
      .map(service => `
        <a
          class="dlink"
          href="service.html#${escapeHTML(service.slug)}">

          ${escapeHTML(service.name)}

        </a>
      `)
      .join("");
  }

  if (footer) {
    footer.innerHTML = SERVICES
      .slice(0, 6)
      .map(service => `
        <a
          href="service.html#${escapeHTML(service.slug)}">

          ${escapeHTML(service.name)}

        </a>
      `)
      .join("");
  }
}

  async function init() {

    try {

      await Promise.all([
        loadContent(),
        loadSettings()
      ]);

      applyBrand();

      await Promise.all([
        loadServices(),
        loadDeadlines(),
        loadProcess()
      ]);

      applyCategoryLabels();

      setupContactForm();
      setupMobileMenu();

      /*
       * Reapply content because some HTML is generated
       * after the first content load.
       */

      applyContent();
      applyCategoryLabels();
      applySettings();

      console.log(
        "TaxCode: dynamic website loaded successfully."
      );

      document.dispatchEvent(
        new CustomEvent(
          "taxcodeContentLoaded",
          {
            detail: {
              content: CONTENT,
              settings: SETTINGS,
              services: SERVICES,
              deadlines: DEADLINES,
              process: PROCESS
            }
          }
        )
      );

    } catch (error) {

      console.error(
        "TaxCode content loading failed:",
        error
      );

      /*
       * Website still remains usable if Google Sheets
       * cannot be reached.
       */

    }
  }

  /*
   * Start after DOM is ready
   */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init
    );

  } else {

    init();

  }

})();