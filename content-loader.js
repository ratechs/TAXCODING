/*
  TaxCode content loader
  -----------------------
  Pulls editable text from a Google Sheet and drops it into the page.
  No iframe, no backend — just a fetch() of the sheet's published CSV.

  SETUP (one time):
  1. Create a Google Sheet with two tabs, named exactly:  content   and   services
  2. Paste content-tab-template.csv into the "content" tab (row 1 = headers: key,value)
  3. Paste services-tab-template.csv into the "services" tab (row 1 = headers below)
  4. File > Share > "Anyone with the link" > Viewer  (must be viewable, doesn't need to be public-published)
  5. Copy the long ID from the sheet's URL:
       https://docs.google.com/spreadsheets/d/COPY_THIS_PART/edit
  6. Paste it into window.TAXCODE_SHEET_ID in the small <script> tag near the top of
     index.html and service.html.

  After that: edit the sheet, reload the page, see the change. Nothing else to touch.
  If the sheet is unreachable (offline, ID missing, tab renamed), the page silently
  keeps whatever text is already written in the HTML — it never breaks the page.
*/
(function () {
  const SHEET_ID = window.TAXCODE_SHEET_ID;
  console.log('TaxCode: loading content from sheet ID', SHEET_ID);
  if (!SHEET_ID || SHEET_ID.indexOf('PUT_YOUR') === 0) {
    console.info('TaxCode: no sheet connected yet — showing the built-in default text.');
    return;
  }

  const csvUrl = (tab) =>
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;

  // Minimal CSV parser (handles quoted fields and commas inside quotes)
  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += c;
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field); field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some(v => v !== '')) rows.push(row);
        row = [];
      } else field += c;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function toObjects(rows) {
    if (!rows.length) return [];
    const header = rows[0].map(h => h.trim());
    return rows.slice(1)
      .filter(r => r.some(c => c && c.trim() !== ''))
      .map(r => {
        const obj = {};
        header.forEach((h, i) => (obj[h] = (r[i] || '').trim()));
        return obj;
      });
  }

  // ---------- content tab: simple key -> value text swap ----------
  fetch(csvUrl('content'))
    .then(r => { if (!r.ok) throw new Error('content tab not reachable'); return r.text(); })
    .then(text => {
      const map = {};
      toObjects(parseCSV(text)).forEach(r => { if (r.key) map[r.key] = r.value; });
      document.querySelectorAll('[data-key]').forEach(el => {
        const k = el.getAttribute('data-key');
        if (map[k] !== undefined && map[k] !== '') el.innerHTML = map[k];
      });
    })
    .catch(err => console.warn('TaxCode: "content" tab not loaded, using defaults.', err));

  // ---------- services tab: drives the full catalog + homepage summary ----------
  fetch(csvUrl('services'))
    .then(r => { if (!r.ok) throw new Error('services tab not reachable'); return r.text(); })
    .then(text => {
      const cats = {};
      toObjects(parseCSV(text)).forEach(r => {
        const slug = r.category_slug;
        if (!slug) return;
        if (!cats[slug]) {
          cats[slug] = {
            label: r.category_label,
            desc: r.category_desc,
            turnaround: r.turnaround,
            items: []
          };
        }
        if (r.item_name) cats[slug].items.push({ name: r.item_name, code: r.item_code });
      });
      renderCatalog(cats);
      renderSummary(cats);
    })
    .catch(err => console.warn('TaxCode: "services" tab not loaded, using defaults.', err));

  function renderCatalog(cats) {
    Object.keys(cats).forEach(slug => {
      const block = document.querySelector('.cat-block#' + slug);
      if (!block) return;
      const cat = cats[slug];
      const titleEl = block.querySelector('.cat-head h2');
      const turnEl = block.querySelector('.cat-head .turnaround');
      const descEl = block.querySelector('.cat-desc');
      if (titleEl && cat.label) {
        const icon = titleEl.querySelector('i');
        titleEl.innerHTML = (icon ? icon.outerHTML + ' ' : '') + cat.label;
      }
      if (turnEl && cat.turnaround) turnEl.textContent = cat.turnaround;
      if (descEl && cat.desc) descEl.textContent = cat.desc;

      if (cat.items.length) {
        block.querySelectorAll('.item-row').forEach(row => row.remove());
        const ctaRow = block.querySelector('.cat-cta');
        cat.items.forEach(item => {
          const div = document.createElement('div');
          div.className = 'item-row';
          div.innerHTML = `<span class="iname"></span><span class="icode"></span>`;
          div.querySelector('.iname').textContent = item.name;
          div.querySelector('.icode').textContent = item.code || '';
          block.insertBefore(div, ctaRow);
        });
      }
      const tocCount = document.querySelector('.toc a[href="#' + slug + '"] .count');
      if (tocCount) tocCount.textContent = String(cat.items.length).padStart(2, '0');
    });
  }

  function renderSummary(cats) {
    document.querySelectorAll('[data-cat]').forEach(row => {
      const cat = cats[row.getAttribute('data-cat')];
      if (!cat) return;
      const nameEl = row.querySelector('.sname');
      const descEl = row.querySelector('.sdesc');
      const timeEl = row.querySelector('.stime');
      const tagsEl = row.querySelector('.tags');
      if (nameEl && cat.label) {
        const icon = nameEl.querySelector('i');
        nameEl.innerHTML = (icon ? icon.outerHTML + ' ' : '') + cat.label;
      }
      if (timeEl && cat.turnaround) timeEl.textContent = cat.turnaround;
      if (descEl && cat.desc) descEl.childNodes[0] && (descEl.childNodes[0].textContent = cat.desc + ' ');
      if (tagsEl && cat.items.length) {
        tagsEl.innerHTML = '';
        cat.items.slice(0, 4).forEach(i => {
          const span = document.createElement('span');
          span.className = 'tag';
          span.textContent = i.name;
          tagsEl.appendChild(span);
        });
      }
    });
  }
})();
