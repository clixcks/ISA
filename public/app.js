/* ========================================================
   ISA PORTAL SUITE - SYSTEM APPLICATION ENGINE
   Features: Sleek Gateway Connection, Keyboard & Keypad Sync (2001),
   Dynamic April Logs (localStorage), Elegant Decrypt Encrypted Overlay, and Modern Audit Logs
 ======================================================== */

// Global Variables
let currentDecryptedText = "";
let currentActiveDocId = null;
let currentCode = "";

// Global static database variable populated via fetch
let staticData = {
  categories: [],
  documents: [],
  settings: { encryptAll: true }
};

// Global active variables
let currentPublicFilter = "all";
let currentActiveCategory = "all";
let currentDateCensorMode = "redact";

// Async static database loader with secure fallback
async function loadStaticData() {
  try {
    const response = await fetch("data.json");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    staticData = await response.json();
    console.log("Static database successfully loaded and mapped.");
  } catch (err) {
    console.error("Failed to load data.json from host server:", err);
    staticData = {
      categories: [],
      documents: [],
      settings: {
        encryptAll: true
      }
    };
  }
}

// Initialize Portal App
document.addEventListener("DOMContentLoaded", async () => {
  // 1. Fetch static data from host server before initializing components
  await loadStaticData();

  // Initialize dynamic categories registry
  getCategories();

  // Load saved settings states. Fall back to static database settings if not set in local storage
  let encryptAllSetting = localStorage.getItem("isa_encrypt_all");
  if (encryptAllSetting === null) {
    encryptAllSetting = staticData.settings ? staticData.settings.encryptAll !== false : true;
  } else {
    encryptAllSetting = encryptAllSetting !== "false";
  }
  
  const toggleEncryptAll = document.getElementById("toggle-encrypt-all");
  if (toggleEncryptAll) {
    toggleEncryptAll.checked = encryptAllSetting;
  }

  // Setup Public cover page logic
  setupPublicLogic();
  
  // Setup Authentication keypads and biometric inputs
  setupAuthLogic();

  // Setup main dashboard buttons & search
  setupDashboardLogic();

  // Seed / Render the documents
  loadAndRenderDocuments();

  // Setup shortcut keys (Ctrl+K or Cmd+K) for search focus
  setupShortcutKeys();

  // Setup custom category sidebar managers & helpers
  renderSidebarSectors();
  setupSectorCreation();
  populateCategoryDropdowns();
  setupSelectionWrapping();

  // Global click listener to close move dropdowns when clicking outside
  document.addEventListener("click", () => {
    document.querySelectorAll(".move-dropdown").forEach(el => el.remove());
  });
});

/* ================= DYNAMIC CATEGORIES REGISTRY METHODS ================= */
function getCategories() {
  const localCatsJson = localStorage.getItem("isa_vault_categories");
  let localCats = [];
  if (localCatsJson) {
    try {
      localCats = JSON.parse(localCatsJson);
    } catch (e) {
      console.error("Error parsing local categories:", e);
    }
  }

  // Combine static and local categories, keeping unique ids
  const combined = [...staticData.categories];
  localCats.forEach(localCat => {
    if (!combined.some(c => c.id === localCat.id)) {
      combined.push(localCat);
    }
  });

  // Filter out any marked as deleted by the user
  let deletedIds = [];
  const deletedIdsJson = localStorage.getItem("isa_deleted_categories");
  if (deletedIdsJson) {
    try {
      deletedIds = JSON.parse(deletedIdsJson);
    } catch (e) {}
  }

  return combined.filter(c => !deletedIds.includes(c.id));
}

function saveCategory(cat) {
  const localCatsJson = localStorage.getItem("isa_vault_categories");
  let localCats = [];
  if (localCatsJson) {
    try {
      localCats = JSON.parse(localCatsJson);
    } catch (e) {}
  }

  // Save if not already in static data and not in local categories
  if (!staticData.categories.some(c => c.id === cat.id) && !localCats.some(c => c.id === cat.id)) {
    localCats.push(cat);
    localStorage.setItem("isa_vault_categories", JSON.stringify(localCats));
  }

  // If this category was previously deleted, remove it from the deleted categories index
  const deletedIdsJson = localStorage.getItem("isa_deleted_categories");
  if (deletedIdsJson) {
    try {
      let deletedIds = JSON.parse(deletedIdsJson);
      if (deletedIds.includes(cat.id)) {
        deletedIds = deletedIds.filter(id => id !== cat.id);
        localStorage.setItem("isa_deleted_categories", JSON.stringify(deletedIds));
      }
    } catch (e) {}
  }

  renderSidebarSectors();
  populateCategoryDropdowns();
  renderPublicCategoryBar();
}

function deleteCategory(catId) {
  // Store deleted category ID in local storage override list
  let deletedIds = [];
  const deletedIdsJson = localStorage.getItem("isa_deleted_categories");
  if (deletedIdsJson) {
    try {
      deletedIds = JSON.parse(deletedIdsJson);
    } catch (e) {}
  }

  if (!deletedIds.includes(catId)) {
    deletedIds.push(catId);
    localStorage.setItem("isa_deleted_categories", JSON.stringify(deletedIds));
  }

  // Also clean out from local categories if present
  const localCatsJson = localStorage.getItem("isa_vault_categories");
  if (localCatsJson) {
    try {
      let localCats = JSON.parse(localCatsJson);
      localCats = localCats.filter(c => c.id !== catId);
      localStorage.setItem("isa_vault_categories", JSON.stringify(localCats));
    } catch (e) {}
  }

  // Reset active filter folder if it was the deleted category
  if (currentActiveCategory === catId) {
    currentActiveCategory = "all";
  }

  renderSidebarSectors();
  populateCategoryDropdowns();
  renderPublicCategoryBar();
  loadAndRenderDocuments();
}

function renderPublicCategoryBar() {
  const bar = document.getElementById("public-category-bar");
  if (!bar) return;

  const categories = getCategories();
  bar.innerHTML = "";

  // 1. All Tab
  const allTab = document.createElement("button");
  allTab.className = `public-category-tab ${currentPublicFilter === "all" ? "active" : ""}`;
  allTab.textContent = "All Records";
  allTab.addEventListener("click", () => {
    currentPublicFilter = "all";
    renderPublicCategoryBar();
    renderPublicDocuments();
  });
  bar.appendChild(allTab);

  // 2. Dynamic Categories
  categories.forEach(cat => {
    const tab = document.createElement("button");
    tab.className = `public-category-tab ${currentPublicFilter === cat.id ? "active" : ""}`;
    tab.textContent = cat.label;
    tab.addEventListener("click", () => {
      currentPublicFilter = cat.id;
      renderPublicCategoryBar();
      renderPublicDocuments();
    });
    bar.appendChild(tab);
  });
}

function renderSidebarSectors() {
  const container = document.getElementById("sidebar-sectors-list");
  if (!container) return;

  const categories = getCategories();
  container.innerHTML = "";

  // All Folders (Static)
  const allRow = document.createElement("div");
  allRow.className = `filter-btn-row ${currentActiveCategory === "all" ? "active" : ""}`;
  allRow.dataset.category = "all";
  allRow.innerHTML = `
    <button class="filter-btn ${currentActiveCategory === "all" ? "active" : ""}" data-category="all">
      All Folders
    </button>
  `;
  container.appendChild(allRow);

  // Dynamic Categories
  categories.forEach(cat => {
    const row = document.createElement("div");
    row.className = `filter-btn-row ${currentActiveCategory === cat.id ? "active" : ""}`;
    row.dataset.category = cat.id;

    row.innerHTML = `
      <button class="filter-btn ${currentActiveCategory === cat.id ? "active" : ""}" data-category="${cat.id}" title="Double click/tap to delete folder">
        ${cat.label}
      </button>
      <button class="category-delete-btn" data-category-id="${cat.id}" title="Delete Category">&times;</button>
    `;
    row.title = "Double click/tap to delete folder";
    container.appendChild(row);
  });

  // Bind sector filters
  const filterBtns = container.querySelectorAll(".filter-btn");
  filterBtns.forEach(btn => {
    const category = btn.dataset.category;

    btn.addEventListener("click", (e) => {
      currentActiveCategory = category;

      container.querySelectorAll(".filter-btn-row").forEach(r => r.classList.remove("active"));
      e.currentTarget.closest(".filter-btn-row").classList.add("active");

      container.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      e.currentTarget.classList.add("active");

      const searchInput = document.getElementById("drive-search");
      const search = searchInput ? searchInput.value.toLowerCase() : "";
      renderDocumentsFiltered(search, category);

      logActivity("info", `Document directory filtered by category: [${category.toUpperCase()}]`);
    });
  });

  // Bind sector drag-and-drop targets
  const filterRows = container.querySelectorAll(".filter-btn-row");
  filterRows.forEach(row => {
    const category = row.dataset.category;

    row.addEventListener("dragover", (e) => {
      e.preventDefault(); // Required to allow drop!
      e.dataTransfer.dropEffect = "move";
      if (category !== "all") {
        row.classList.add("drag-hover");
      }
    });

    row.addEventListener("dragleave", () => {
      row.classList.remove("drag-hover");
    });

    row.addEventListener("drop", (e) => {
      e.preventDefault();
      row.classList.remove("drag-hover");

      const docId = e.dataTransfer.getData("text/plain");
      if (!docId) return;

      if (category === "all") return;

      const docs = getDocuments();
      const doc = docs.find(d => d.id === docId);
      if (doc) {
        if (doc.category === category) {
          logActivity("info", `Document "${doc.title}" is already in sector: [${category.toUpperCase()}]`);
          return;
        }

        const oldCategory = doc.category;
        doc.category = category;
        localStorage.setItem("isa_vault_documents", JSON.stringify(docs));

        const matchedCat = categories.find(c => c.id === category);
        const catLabel = matchedCat ? matchedCat.label : category.toUpperCase();
        logActivity("ok", `Moved document "${doc.title}" to sector: [${catLabel.toUpperCase()}] via drag-and-drop.`);

        loadAndRenderDocuments();
      }
    });

    row.addEventListener("dragend", () => {
      row.classList.remove("drag-hover");
    });
  });

  // Bind sector double-click/double-tap deletion on custom rows
  const filterRowsList = container.querySelectorAll(".filter-btn-row");
  filterRowsList.forEach(row => {
    const category = row.dataset.category;
    if (!category || category === "all") return; // Skip "All Folders" row

    // Double click listener
    row.addEventListener("dblclick", (e) => {
      // Prevent deletion trigger if they clicked directly on the "×" delete button
      if (e.target.closest(".category-delete-btn")) return;

      e.preventDefault();
      e.stopPropagation();
      deleteCategory(category);
      logActivity("warn", `Sector category deleted via double-click: [${category.toUpperCase()}]`);
    });

    // Mobile touch support for double-tap
    let lastTap = 0;
    row.addEventListener("touchstart", (e) => {
      if (e.target.closest(".category-delete-btn")) return;

      const currentTime = new Date().getTime();
      const tapLength = currentTime - lastTap;
      if (tapLength < 300 && tapLength > 0) {
        e.preventDefault();
        e.stopPropagation();
        deleteCategory(category);
        logActivity("warn", `Sector category deleted via double-tap: [${category.toUpperCase()}]`);
      }
      lastTap = currentTime;
    }, { passive: false });
  });

  // Bind sector deletions
  const deleteBtns = container.querySelectorAll(".category-delete-btn");
  deleteBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const catId = e.currentTarget.getAttribute("data-category-id") || e.currentTarget.dataset.categoryId;
      
      if (e.currentTarget.classList.contains("confirm-delete")) {
        // Second click: perform deletion
        deleteCategory(catId);
        logActivity("warn", `Custom sector category deleted: [${catId.toUpperCase()}]`);
      } else {
        // First click: transition to confirm state
        // Reset all other delete buttons first
        container.querySelectorAll(".category-delete-btn").forEach(b => {
          b.classList.remove("confirm-delete");
          b.innerHTML = "&times;";
          b.title = "Delete Category";
        });
        
        e.currentTarget.classList.add("confirm-delete");
        e.currentTarget.innerHTML = "Sure?";
        e.currentTarget.title = "Click again to confirm deletion";
        
        // Auto-reset after 3 seconds
        setTimeout(() => {
          if (e.currentTarget.classList.contains("confirm-delete")) {
            e.currentTarget.classList.remove("confirm-delete");
            e.currentTarget.innerHTML = "&times;";
            e.currentTarget.title = "Delete Category";
          }
        }, 3000);
      }
    });
  });
}

function setupSectorCreation() {
  const addSectorBtn = document.getElementById("add-sector-btn");
  const inlineSectorForm = document.getElementById("inline-sector-form");
  const newSectorInput = document.getElementById("new-sector-input");
  const submitSectorBtn = document.getElementById("submit-sector-btn");
  const cancelSectorBtn = document.getElementById("cancel-sector-btn");

  if (!addSectorBtn || !inlineSectorForm) return;

  addSectorBtn.addEventListener("click", () => {
    inlineSectorForm.classList.remove("hidden");
    newSectorInput.value = "";
    newSectorInput.focus();
  });

  const handleCreate = () => {
    const val = newSectorInput.value.trim();
    if (!val) {
      inlineSectorForm.classList.add("hidden");
      return;
    }

    const id = val.toLowerCase().replace(/[^a-z0-9]/g, "-");
    if (!id) {
      alert("Invalid folder/category name.");
      return;
    }

    const categories = getCategories();
    if (categories.some(c => c.id === id || c.label.toLowerCase() === val.toLowerCase())) {
      alert("Folder/category name already exists.");
      return;
    }

    const newCat = { id, label: val };
    saveCategory(newCat);
    inlineSectorForm.classList.add("hidden");
    logActivity("ok", `Created custom sector folder: "${val}".`);
  };

  submitSectorBtn.addEventListener("click", handleCreate);

  newSectorInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreate();
    } else if (e.key === "Escape") {
      inlineSectorForm.classList.add("hidden");
    }
  });

  cancelSectorBtn.addEventListener("click", () => {
    inlineSectorForm.classList.add("hidden");
  });
}

function populateCategoryDropdowns() {
  const compileSelect = document.getElementById("doc-category");
  const editSelect = document.getElementById("edit-doc-category");
  const categories = getCategories();

  if (compileSelect) {
    compileSelect.innerHTML = categories.map(cat => `<option value="${cat.id}">${cat.label}</option>`).join("");
  }
  if (editSelect) {
    editSelect.innerHTML = categories.map(cat => `<option value="${cat.id}">${cat.label}</option>`).join("");
  }

  updateCompileButtonState();
}

function updateCompileButtonState() {
  const openCreateBtn = document.getElementById("open-create-modal-btn");
  if (!openCreateBtn) return;
  const categories = getCategories();
  if (categories.length === 0) {
    openCreateBtn.disabled = true;
    openCreateBtn.style.opacity = "0.4";
    openCreateBtn.style.cursor = "not-allowed";
    openCreateBtn.title = "Create a sector folder in the sidebar to enable compiling";
  } else {
    openCreateBtn.disabled = false;
    openCreateBtn.style.opacity = "1";
    openCreateBtn.style.cursor = "pointer";
    openCreateBtn.title = "";
  }
}

function setupSelectionWrapping() {
  const registerBtnHelper = (btnId, textareaId, tag) => {
    const btn = document.getElementById(btnId);
    const textarea = document.getElementById(textareaId);
    if (!btn || !textarea) return;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;

      const selectedText = text.substring(start, end);
      const replacement = `[${tag}:${selectedText || "text"}]`;

      textarea.value = text.substring(0, start) + replacement + text.substring(end);

      // Restore focus and highlight
      textarea.focus();
      textarea.selectionStart = start;
      textarea.selectionEnd = start + replacement.length;
    });
  };

  // Compile helper triggers
  registerBtnHelper("compile-redact-btn", "doc-content", "r");

  // Edit helper triggers
  registerBtnHelper("edit-redact-btn", "plain-text-edit", "r");
}

/* ================= PUBLIC COVER MASK LOGIC ================= */
function setupPublicLogic() {
  const portalBtn = document.getElementById("agent-portal-btn");
  
  // 1. Transition from Cover Site to Agent Gateway Portal
  if (portalBtn) {
    portalBtn.addEventListener("click", () => {
      document.getElementById("public-cover-site").classList.add("hidden");
      document.getElementById("auth-container").classList.remove("hidden");
      
      // Reset boot state
      document.getElementById("boot-terminal").classList.remove("hidden");
      document.getElementById("login-interface").classList.add("hidden");
      document.getElementById("passcode-display").value = "";
      
      runGatewayConnection();
    });
  }



  // 3. Initial render of public unclassified documents
  renderPublicCategoryBar();
  renderPublicDocuments();
}

function maskDateString(dateStr, mode) {
  if (!dateStr || mode === "none") return dateStr;
  
  // Matches month name, followed by spaces, followed by day, followed by optional comma and spaces, followed by year.
  // Example: "MAY 19, 2026", "April 30, 2026", "October 14, 2018", etc.
  const monthRegex = /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{2})(\d{2})/gi;
  
  return dateStr.replace(monthRegex, (match, month, day, yearCentury, yearDecade) => {
    const dayMask = "■".repeat(day.length);
    const decadeMask = "■".repeat(yearDecade.length);
    return `${month} [r:${dayMask}], ${yearCentury}[r:${decadeMask}]`;
  });
}

function animateCyberHUD(duration, isDisconnect, callback) {
  const container = document.querySelector(".cyber-hud-container");
  const progressFill = document.getElementById("cyber-progress-fill");
  const progressCounter = document.getElementById("cyber-progress-counter");
  const progressStatus = document.getElementById("cyber-progress-status");
  const statusText = document.getElementById("boot-status-text");
  const hudHeader = document.getElementById("cyber-hud-header");
  const bufferVal = document.getElementById("cyber-diag-buffer");
  const shieldVal = document.getElementById("cyber-diag-shield");
  
  if (!progressFill || !progressCounter) {
    if (callback) callback();
    return;
  }

  // Reset elements and values
  progressFill.style.width = "0%";
  progressCounter.textContent = "0";

  // Set visual mode details based on connection vs disconnection
  if (isDisconnect) {
    if (container) container.classList.add("disconnect-mode");
    if (hudHeader) hudHeader.textContent = "TERMINATING SECURE DATALINK";
    if (progressStatus) progressStatus.textContent = "TERMINATED";
    if (bufferVal) {
      bufferVal.textContent = "PURGING";
      bufferVal.className = "diag-val font-mono text-red";
    }
    if (shieldVal) {
      shieldVal.textContent = "TERMINATING";
      shieldVal.className = "diag-val font-mono text-red";
    }
  } else {
    if (container) container.classList.remove("disconnect-mode");
    if (hudHeader) hudHeader.textContent = "ESTABLISHING ENCRYPTED DATALINK";
    if (progressStatus) progressStatus.textContent = "CONNECTED";
    if (bufferVal) {
      bufferVal.textContent = "ACTIVE";
      bufferVal.className = "diag-val font-mono text-cyan";
    }
    if (shieldVal) {
      shieldVal.textContent = "100% SECURE";
      shieldVal.className = "diag-val font-mono text-green";
    }
  }

  // Diagnostic status log updates depending on connection vs disconnection
  const connectLogs = [
    { threshold: 0, text: "Synchronizing quantum encryption vectors..." },
    { threshold: 20, text: "Establishing secure TCP/IP handshake..." },
    { threshold: 45, text: "Resolving archive data nodes..." },
    { threshold: 70, text: "Decrypting sector file headers..." },
    { threshold: 90, text: "Verification complete. Accessing portal..." }
  ];

  const disconnectLogs = [
    { threshold: 0, text: "Terminating secure mainframe link..." },
    { threshold: 25, text: "Wiping local session decryption keys..." },
    { threshold: 50, text: "Flushing cryptographic sector buffers..." },
    { threshold: 75, text: "Overwriting storage registers with entropy..." },
    { threshold: 95, text: "Portal secured. Resetting sandbox..." }
  ];

  const statusLogs = isDisconnect ? disconnectLogs : connectLogs;

  let start = null;
  function step(timestamp) {
    if (!start) start = timestamp;
    const progress = Math.min((timestamp - start) / duration, 1);
    const percent = Math.floor(progress * 100);
    
    // Update progress fill and counter
    progressFill.style.width = percent + "%";
    progressCounter.textContent = percent;
    
    // Find matching log message based on current percent threshold
    let activeMsg = statusLogs[0].text;
    for (let i = 0; i < statusLogs.length; i++) {
      if (percent >= statusLogs[i].threshold) {
        activeMsg = statusLogs[i].text;
      }
    }
    if (statusText) statusText.textContent = activeMsg;

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      setTimeout(() => {
        if (callback) callback();
      }, 100); // Tiny pause on completion for dramatic effect
    }
  }
  requestAnimationFrame(step);
}

/* ================= PUBLIC DOCUMENTS RENDERING ================= */
function formatRedactions(text) {
  let formatted = text;
  formatted = formatted.replace(/\[(?:redact|r):([^\]]+)\]/g, '<span class="redacted-inline">$1</span>');
  // Auto-convert any legacy blur tags just in case
  formatted = formatted.replace(/\[(?:blur|b):([^\]]+)\]/g, '<span class="redacted-inline">$1</span>');
  return formatted;
}

function renderPublicDocuments() {
  const publicGrid = document.querySelector(".public-grid");
  if (!publicGrid) return;

  const documents = getDocuments();
  // Filter for only unclassified documents
  const unclassifiedDocs = documents.filter(doc => doc.classification === "unclassified");

  // Filter by dynamic public cover filter category
  let filtered = unclassifiedDocs;
  if (currentPublicFilter !== "all") {
    filtered = unclassifiedDocs.filter(doc => doc.category === currentPublicFilter);
  }

  publicGrid.innerHTML = "";

  if (filtered.length === 0) {
    publicGrid.innerHTML = `
      <div class="widget-panel" style="grid-column: 1 / -1; text-align: center; border-style: dashed; padding: 30px; background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 8px;">
        <span class="text-muted" style="font-weight: 500; font-family: var(--font-sans);">NO PUBLIC DECLASSIFIED RECORDS AVAILABLE IN THIS SECTOR</span>
      </div>
    `;
    return;
  }

  filtered.forEach(doc => {
    const card = document.createElement("div");
    card.className = "public-card";
    card.dataset.docId = doc.id;
    
    const maskedTitle = formatRedactions(maskDateString(doc.title, currentDateCensorMode));
    const maskedReleaseDate = formatRedactions(maskDateString(doc.releaseDate || 'MAY 19, 2026', currentDateCensorMode));

    card.innerHTML = `
      <h3>${maskedTitle}</h3>
      <div class="public-card-meta">
        <span>RELEASED: ${maskedReleaseDate}</span>
        <span>REF: ${doc.refId || doc.hash.substring(0, 10).toUpperCase()}</span>
      </div>
    `;

    // Click handler to open the public modal
    card.addEventListener("click", () => {
      openPublicModal(doc);
    });

    publicGrid.appendChild(card);
  });
}

function openPublicModal(doc) {
  const maskedTitle = formatRedactions(maskDateString(doc.title, currentDateCensorMode));
  document.getElementById("public-modal-doc-title").innerHTML = maskedTitle;
  
  const maskedReleaseDate = formatRedactions(maskDateString(doc.releaseDate || 'MAY 19, 2026', currentDateCensorMode));
  document.getElementById("public-modal-release-date").innerHTML = maskedReleaseDate;
  
  document.getElementById("public-modal-ref-id").textContent = doc.refId || doc.hash.substring(0, 10).toUpperCase();
  
  const docContent = document.getElementById("public-modal-doc-content");
  
  // Check if encryption toggle is enabled. Fall back to static settings if not set in local storage
  let encryptAll = localStorage.getItem("isa_encrypt_all");
  if (encryptAll === null) {
    encryptAll = staticData.settings ? staticData.settings.encryptAll !== false : true;
  } else {
    encryptAll = encryptAll !== "false";
  }
  
  if (encryptAll) {
    // Show public read modal
    openModal("public-read-modal");
    
    const overlay = document.getElementById("public-encrypt-overlay");
    const progressFill = document.getElementById("public-progress-fill");
    const progressCounter = document.getElementById("public-progress-counter");
    const hudHeader = document.getElementById("public-hud-header");
    const statusText = document.getElementById("public-boot-status-text");

    overlay.classList.remove("hidden");
    docContent.innerHTML = ""; // Empty content during encryption phase

    // Reset progress details
    progressFill.style.width = "0%";
    progressCounter.textContent = "0";
    hudHeader.textContent = "ENCRYPTING DATA CONSOLE";
    statusText.textContent = "Establishing public document link...";

    let start = null;
    const duration = 900; // 0.9 seconds for a dramatic high-speed handshake

    function step(timestamp) {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const percent = Math.floor(progress * 100);

      progressFill.style.width = percent + "%";
      progressCounter.textContent = percent;

      if (percent < 35) {
        statusText.textContent = "Securing public gateway tunnel...";
      } else if (percent < 70) {
        statusText.textContent = "Generating local quantum buffer...";
      } else {
        statusText.textContent = "Applying symmetric mock encryption...";
      }

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        // Complete encrypting scan phase
        setTimeout(() => {
          overlay.classList.add("hidden");
          
          // Render scrambled text
          const maskedContent = maskDateString(doc.content, currentDateCensorMode);
          const tokens = parseContentToTokens(maskedContent);
          let html = "";
          tokens.forEach(token => {
            if (token.type === "redacted") {
              html += `<span class="redacted-inline" data-real-text="${escapeHtml(token.content)}">${escapeHtml(token.content)}</span>`;
            } else {
              const codeText = obfuscateText(token.content);
              html += `<span class="plain-segment scrambled" data-original="${escapeHtml(token.content)}" data-code="${escapeHtml(codeText)}">${escapeHtml(codeText)}</span>`;
            }
          });
          docContent.innerHTML = html;

          // Animate direct scanning melt decryption immediately
          const scrambledElements = docContent.querySelectorAll(".scrambled");
          decryptScrambledElements(
            scrambledElements,
            null,
            () => {
              // On decryption success, fade in redactions!
              docContent.querySelectorAll(".redacted-inline").forEach(el => {
                el.classList.add("revealed");
              });
            }
          );
        }, 150);
      }
    }
    requestAnimationFrame(step);
  } else {
    // Normal immediate loading logic
    const formattedContent = formatRedactions(maskDateString(doc.content, currentDateCensorMode));
    docContent.innerHTML = formattedContent;
    openModal("public-read-modal");
  }
}

/* ================= PORTAL CONNECTION LOADER ================= */
function runGatewayConnection() {
  const bootTerminal = document.getElementById("boot-terminal");
  const loginInterface = document.getElementById("login-interface");
  
  if (bootTerminal && loginInterface) {
    bootTerminal.classList.remove("hidden");
    loginInterface.classList.add("hidden");
    
    animateCyberHUD(1100, false, () => {
      // Reveal login screen
      bootTerminal.classList.add("hidden");
      loginInterface.classList.remove("hidden");
      
      const passcodeDisplay = document.getElementById("passcode-display");
      if (passcodeDisplay) passcodeDisplay.focus();
    });
  }
}

/* ================= SLEEK AUTHENTICATION PANEL LOGIC ================= */
function setupAuthLogic() {
  const fingerprintBtn = document.getElementById("fingerprint-btn");
  const scanStatus = document.getElementById("scan-status");
  const passcodeDisplay = document.getElementById("passcode-display");
  const keyBtns = document.querySelectorAll(".key-btn");
  const unlockAlert = document.getElementById("unlock-alert");

  let isScanning = false;

  // 1. Unified function to update passcode and check verification
  function updateCode(newVal) {
    // Only keep numeric inputs
    currentCode = newVal.replace(/[^0-9]/g, '').substring(0, 4);
    passcodeDisplay.value = currentCode;
    
    if (currentCode.length === 4) {
      // Verify passcode matches exactly 2001 (no hint in UI)
      if (currentCode === "2001") {
        showUnlockAlert(true);
        setTimeout(() => unlockPortal(), 500);
      } else {
        showUnlockAlert(false);
        setTimeout(() => {
          currentCode = "";
          passcodeDisplay.value = "";
        }, 1000);
      }
    }
  }

  // 2. Keyboard Input Listeners (Active typing)
  if (passcodeDisplay) {
    passcodeDisplay.addEventListener("input", (e) => {
      updateCode(e.target.value);
    });

    // Make sure click on document centers focus back on passcode
    document.addEventListener("click", (e) => {
      const loginInterface = document.getElementById("login-interface");
      if (loginInterface && !loginInterface.classList.contains("hidden")) {
        // Keep focus unless clicking on interactive keypad buttons or biometrics button
        if (e.target !== passcodeDisplay && !e.target.closest(".keypad") && !e.target.closest(".biometric-zone")) {
          passcodeDisplay.focus();
        }
      }
    });
  }

  // 3. Numeric Keypad clicks
  keyBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      const val = e.currentTarget.dataset.val;

      if (val === "clear") {
        updateCode("");
      } else if (val === "bypass") {
        showUnlockAlert(true);
        setTimeout(() => unlockPortal(), 300);
      } else {
        if (currentCode.length < 4) {
          updateCode(currentCode + val);
        }
      }
    });
  });

  // 4. Simulated Device Key Biometrics
  if (fingerprintBtn) {
    fingerprintBtn.addEventListener("click", () => {
      if (isScanning) return;
      isScanning = true;
      fingerprintBtn.classList.add("scanning");
      scanStatus.textContent = "Verifying security key...";
      
      setTimeout(() => {
        fingerprintBtn.classList.remove("scanning");
        scanStatus.textContent = "Device Credential Approved";
        showUnlockAlert(true);
        setTimeout(() => {
          unlockPortal();
        }, 500);
      }, 1000);
    });
  }

  function showUnlockAlert(isSuccess) {
    unlockAlert.classList.remove("hidden");
    if (isSuccess) {
      unlockAlert.textContent = "ACCESS GRANTED";
      unlockAlert.className = "alert-box success";
    } else {
      unlockAlert.textContent = "INVALID CODE";
      unlockAlert.className = "alert-box fail";
    }
  }
}

// Transition from Login to Dashboard with secure connect animation
function unlockPortal() {
  const loginInterface = document.getElementById("login-interface");
  const bootTerminal = document.getElementById("boot-terminal");
  const authContainer = document.getElementById("auth-container");
  const dashboardContainer = document.getElementById("dashboard-container");

  if (loginInterface && bootTerminal) {
    // Hide login form, show loading boot screen
    loginInterface.classList.add("hidden");
    bootTerminal.classList.remove("hidden");
    
    animateCyberHUD(1100, false, () => {
      if (authContainer && dashboardContainer) {
        authContainer.style.transition = "opacity 0.2s ease";
        authContainer.style.opacity = 0;
        
        setTimeout(() => {
          authContainer.classList.add("hidden");
          dashboardContainer.classList.remove("hidden");
          authContainer.style.opacity = 1; // restore opacity for future access cycles
          
          // Write system active notice to timeline log
          logActivity("sys", "Portal authenticated successfully. User session active.");
          logActivity("sys", "All local cache sectors mapped. Vault registry verified.");
          
          // Start system clock and fluctuate variables
          startSystemTime();
          oscillateIntegrityStats();
        }, 200);
      }
    });
  } else {
    // Fallback if boot elements aren't present
    if (authContainer && dashboardContainer) {
      authContainer.classList.add("hidden");
      dashboardContainer.classList.remove("hidden");
    }
  }
}

/* ================= SYSTEM DASHBOARD ENGINE ================= */
function setupDashboardLogic() {
  const lockBtn = document.getElementById("lock-vault-btn");
  const searchInput = document.getElementById("drive-search");
  const filterBtns = document.querySelectorAll(".filter-btn");
  
  // 1. Lock Vault Button (Lock Portal with secure disconnect animation)
  if (lockBtn) {
    lockBtn.addEventListener("click", () => {
      const dashboardContainer = document.getElementById("dashboard-container");
      const authContainer = document.getElementById("auth-container");
      const loginInterface = document.getElementById("login-interface");
      const bootTerminal = document.getElementById("boot-terminal");

      if (dashboardContainer && authContainer && bootTerminal) {
        logActivity("warn", "Initiating secure terminal shutdown...");
        
        // Hide dashboard with smooth fade
        dashboardContainer.style.transition = "opacity 0.2s ease";
        dashboardContainer.style.opacity = 0;
        
        setTimeout(() => {
          dashboardContainer.classList.add("hidden");
          dashboardContainer.style.opacity = 1; // reset style for future logins
          
          // Transition back to auth container and show boot loader
          authContainer.classList.remove("hidden");
          if (loginInterface) loginInterface.classList.add("hidden");
          bootTerminal.classList.remove("hidden");
          
          animateCyberHUD(1100, true, () => {
            location.reload(); // Hard reload page to reset cache and lock access
          });
          
        }, 200);
      } else {
        location.reload();
      }
    });
  }

  // 2. Drive Search Bar Filter
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const term = e.target.value.toLowerCase();
      renderDocumentsFiltered(term, getActiveCategoryFilter());
    });
  }

  // 3. Category Filter Buttons (Handled dynamically by renderSidebarSectors)

  // 4. Modal closes listeners
  const closeBtns = document.querySelectorAll(".close-modal-btn");
  closeBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      const modalId = e.currentTarget.dataset.modal;
      closeModal(modalId);
    });
  });

  // 5. Settings toggle listeners
  const toggleLaser = document.getElementById("toggle-laser");
  const toggleEncryptAll = document.getElementById("toggle-encrypt-all");

  if (toggleLaser) {
    toggleLaser.addEventListener("change", (e) => {
      if (e.target.checked) {
        logActivity("config", "Session Auto-Lock protection activated.");
      } else {
        logActivity("warn", "Session Auto-Lock deactivated.");
      }
    });
  }

  if (toggleEncryptAll) {
    toggleEncryptAll.addEventListener("change", (e) => {
      localStorage.setItem("isa_encrypt_all", e.target.checked);
      if (e.target.checked) {
        logActivity("config", "Archive Records encryption tunnel activated (hiding records behind cryptographic security scans).");
      } else {
        logActivity("info", "Archive Records standard immediate reading mode restored (revealing all documents).");
      }
    });
  }

  // Purge mainframe overrides cache
  const purgeMainframeBtn = document.getElementById("purge-mainframe-btn");
  if (purgeMainframeBtn) {
    purgeMainframeBtn.addEventListener("click", () => {
      if (confirm("WARNING: THIS WILL PERMANENTLY PURGE ALL BROWSER CACHE OVERRIDES, CUSTOM SECTORS, AND COMPILED RECORDS. PROCEED?")) {
        localStorage.clear();
        logActivity("warn", "SYSTEM OVERRIDES PURGED. REBOOTING MAINFRAME SECURE BUFFER...");
        setTimeout(() => {
          location.reload();
        }, 800);
      }
    });
  }

  // 6. Open Create Doc modal
  const openCreateBtn = document.getElementById("open-create-modal-btn");
  if (openCreateBtn) {
    openCreateBtn.addEventListener("click", () => {
      openModal("create-modal");
      setTimeout(() => {
        const titleField = document.getElementById("doc-title");
        if (titleField) titleField.focus();
      }, 100);
    });
  }

  // 7. Create Doc form submit
  const createForm = document.getElementById("create-doc-form");
  if (createForm) {
    createForm.addEventListener("submit", (e) => {
      e.preventDefault();
      
      const categories = getCategories();
      if (categories.length === 0) {
        alert("Please create at least one sector folder in the sidebar before compiling records.");
        return;
      }
      
      const title = document.getElementById("doc-title").value.trim();
      const category = document.getElementById("doc-category").value;
      const classification = document.getElementById("doc-classification").value;
      const content = document.getElementById("doc-content").value.trim();
      
      const compileText = document.getElementById("compiling-text");
      const compileContainer = document.getElementById("compiling-indicator");
      const submitBtn = document.getElementById("submit-create-btn");

      submitBtn.disabled = true;
      compileContainer.classList.remove("hidden");
      compileText.textContent = "Writing encrypted record...";
      
      setTimeout(() => {
        const newDoc = {
          id: "doc-" + Date.now(),
          title: title,
          category: category,
          classification: classification,
          hash: "0x" + Math.random().toString(16).substr(2, 9) + Math.random().toString(16).substr(2, 9),
          content: content,
          releaseDate: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase(),
          refId: "FOIA-" + new Date().getFullYear() + "-" + Math.random().toString(36).substr(2, 4).toUpperCase()
        };

        saveDocument(newDoc);
        
        compileContainer.classList.add("hidden");
        submitBtn.disabled = false;
        createForm.reset();
        closeModal("create-modal");
        
        logActivity("ok", `Compiled and encrypted document: "${title}".`);
      }, 400);
    });
  }

  // Setup Decrypt Modal buttons
  const decryptBtn = document.getElementById("run-decryption-btn");
  if (decryptBtn) {
    decryptBtn.addEventListener("click", () => {
      runDecryptionReveal();
    });
  }

  // Edit / Save edit buttons
  const toggleEditBtn = document.getElementById("toggle-edit-btn");
  const saveEditBtn = document.getElementById("save-edit-btn");
  const cipherDisplay = document.getElementById("cipher-text-display");
  const plainTextEdit = document.getElementById("plain-text-edit");

  if (toggleEditBtn) {
    toggleEditBtn.addEventListener("click", () => {
      cipherDisplay.classList.add("hidden");
      plainTextEdit.classList.remove("hidden");
      plainTextEdit.value = currentDecryptedText;
      
      toggleEditBtn.classList.add("hidden");
      saveEditBtn.classList.remove("hidden");
      decryptBtn.classList.add("hidden");
      
      // Reveal metadata and helpers edit blocks
      document.getElementById("modal-meta-grid").classList.add("hidden");
      document.getElementById("edit-meta-fields").classList.remove("hidden");
      document.getElementById("edit-helper-bar").classList.remove("hidden");
      
      logActivity("info", `Document editor toggled for record ID: ${currentActiveDocId}`);
      setTimeout(() => plainTextEdit.focus(), 50);
    });
  }

  if (saveEditBtn) {
    saveEditBtn.addEventListener("click", () => {
      const updatedText = plainTextEdit.value;
      const updatedTitle = document.getElementById("edit-doc-title").value.trim();
      const updatedCategory = document.getElementById("edit-doc-category").value;
      const updatedClassification = document.getElementById("edit-doc-classification").value;
      
      if (!updatedTitle) {
        alert("Please enter a record title.");
        return;
      }
      
      saveEditedDocument(currentActiveDocId, updatedText, updatedTitle, updatedCategory, updatedClassification);
      
      plainTextEdit.classList.add("hidden");
      cipherDisplay.classList.remove("hidden");
      
      // Restore metadata blocks
      document.getElementById("modal-meta-grid").classList.remove("hidden");
      document.getElementById("edit-meta-fields").classList.add("hidden");
      document.getElementById("edit-helper-bar").classList.add("hidden");
      
      closeModal("decrypt-modal");
      logActivity("ok", `Document updates successfully written and re-encrypted.`);
    });
  }
}

function getActiveCategoryFilter() {
  const activeBtn = document.querySelector(".filter-btn.active");
  return activeBtn ? activeBtn.dataset.category : "all";
}

/* ================= SYSTEM DATE & STATS METERS ================= */
function startSystemTime() {
  const clock = document.getElementById("system-time");
  if (!clock) return;

  function update() {
    const d = new Date();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    clock.textContent = `${hours}:${minutes}:${seconds}`;
  }
  update();
  setInterval(update, 1000);
}

function oscillateIntegrityStats() {
  const integrityValue = document.getElementById("vault-integrity-text");
  if (!integrityValue) return;

  setInterval(() => {
    if (Math.random() > 0.8) {
      const loadText = (100 - (Math.random() * 0.05)).toFixed(2);
      integrityValue.textContent = `${loadText}%`;
    }
  }, 4000);
}

/* ================= LOCAL STORAGE DATABASE OPERATIONS ================= */
function getDocuments() {
  const localDocsJson = localStorage.getItem("isa_vault_documents");
  let localDocs = [];
  if (localDocsJson) {
    try {
      localDocs = JSON.parse(localDocsJson);
    } catch (e) {
      console.error("Error parsing local documents:", e);
    }
  }

  // Combine static and local documents, keeping unique ids
  const combined = [...staticData.documents];
  localDocs.forEach(localDoc => {
    // If a document was edited, we want to use the local edited version!
    const staticIndex = combined.findIndex(d => d.id === localDoc.id);
    if (staticIndex !== -1) {
      combined[staticIndex] = localDoc; // overwrite with local edited version
    } else {
      combined.push(localDoc);
    }
  });

  // Filter out any marked as deleted by the user
  let deletedIds = [];
  const deletedIdsJson = localStorage.getItem("isa_deleted_documents");
  if (deletedIdsJson) {
    try {
      deletedIds = JSON.parse(deletedIdsJson);
    } catch (e) {}
  }

  return combined.filter(d => !deletedIds.includes(d.id));
}

function saveDocument(doc) {
  const localDocsJson = localStorage.getItem("isa_vault_documents");
  let localDocs = [];
  if (localDocsJson) {
    try {
      localDocs = JSON.parse(localDocsJson);
    } catch (e) {}
  }

  localDocs.push(doc);
  localStorage.setItem("isa_vault_documents", JSON.stringify(localDocs));

  // If this document was previously deleted, remove it from the deleted documents override index
  const deletedIdsJson = localStorage.getItem("isa_deleted_documents");
  if (deletedIdsJson) {
    try {
      let deletedIds = JSON.parse(deletedIdsJson);
      if (deletedIds.includes(doc.id)) {
        deletedIds = deletedIds.filter(id => id !== doc.id);
        localStorage.setItem("isa_deleted_documents", JSON.stringify(deletedIds));
      }
    } catch (e) {}
  }

  loadAndRenderDocuments();
}

function saveEditedDocument(id, newContent, newTitle, newCategory, newClassification) {
  const docs = getDocuments();
  const index = docs.findIndex(d => d.id === id);
  if (index !== -1) {
    // Build updated document object
    const doc = { ...docs[index] };
    doc.content = newContent;
    if (newTitle) doc.title = newTitle;
    if (newCategory) doc.category = newCategory;
    if (newClassification) doc.classification = newClassification;

    // Save to local documents overrides list
    const localDocsJson = localStorage.getItem("isa_vault_documents");
    let localDocs = [];
    if (localDocsJson) {
      try {
        localDocs = JSON.parse(localDocsJson);
      } catch (e) {}
    }

    const localIndex = localDocs.findIndex(d => d.id === id);
    if (localIndex !== -1) {
      localDocs[localIndex] = doc;
    } else {
      localDocs.push(doc);
    }

    localStorage.setItem("isa_vault_documents", JSON.stringify(localDocs));
    loadAndRenderDocuments();
  }
}

function deleteDocument(id) {
  // Store deleted document ID in local storage override list
  let deletedIds = [];
  const deletedIdsJson = localStorage.getItem("isa_deleted_documents");
  if (deletedIdsJson) {
    try {
      deletedIds = JSON.parse(deletedIdsJson);
    } catch (e) {}
  }

  if (!deletedIds.includes(id)) {
    deletedIds.push(id);
    localStorage.setItem("isa_deleted_documents", JSON.stringify(deletedIds));
  }

  // Also clean out from local documents list if present
  const localDocsJson = localStorage.getItem("isa_vault_documents");
  if (localDocsJson) {
    try {
      let localDocs = JSON.parse(localDocsJson);
      localDocs = localDocs.filter(d => d.id !== id);
      localStorage.setItem("isa_vault_documents", JSON.stringify(localDocs));
    } catch (e) {}
  }

  loadAndRenderDocuments();
}

/* ================= DOCUMENTS RENDERING ENGINE ================= */
function loadAndRenderDocuments() {
  const searchInput = document.getElementById("drive-search");
  const term = searchInput ? searchInput.value.toLowerCase() : "";
  renderDocumentsFiltered(term, getActiveCategoryFilter());
  
  // Update public cover grid and categories in real-time
  renderPublicCategoryBar();
  renderPublicDocuments();
}

function renderDocumentsFiltered(searchTerm, categoryFilter) {
  const recordsGrid = document.getElementById("records-grid");
  const filesCountBadge = document.getElementById("files-count-badge");
  const storageProgressBar = document.getElementById("storage-progress-bar");
  const storageLoadLabel = document.getElementById("storage-load-label");

  if (!recordsGrid) return;

  const documents = getDocuments();
  
  // Filter docs
  const filtered = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm) || doc.hash.toLowerCase().includes(searchTerm);
    const matchesCategory = categoryFilter === "all" || doc.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Update headers count
  if (filesCountBadge) {
    filesCountBadge.textContent = `${filtered.length} FILE${filtered.length !== 1 ? 'S' : ''}`;
  }

  // Update storage capacity percentage label
  const totalCount = documents.length;
  const simulatedBytes = (totalCount * 0.2).toFixed(1);
  if (storageLoadLabel) storageLoadLabel.textContent = `${simulatedBytes} / 10.0 MB`;
  
  const capPercentage = Math.min((totalCount / 35) * 100, 100);
  if (storageProgressBar) storageProgressBar.style.width = `${capPercentage}%`;

  // Render cards
  recordsGrid.innerHTML = "";
  
  if (filtered.length === 0) {
    recordsGrid.innerHTML = `
      <div class="widget-panel" style="grid-column: 1 / -1; text-align: center; border-style: dashed; padding: 30px;">
        <span class="text-muted" style="font-weight: 500;">NO ARCHIVE RECORDS FOUND</span>
      </div>
    `;
    return;
  }

  filtered.forEach(doc => {
    const card = document.createElement("div");
    card.className = `record-card`;
    card.id = `card-${doc.id}`;
    card.setAttribute("draggable", "true");
    
    card.innerHTML = `
      <div class="card-header">
        <h4>${doc.title}</h4>
        <span class="card-badge ${doc.classification === 'classified' ? 'badge-classified' : doc.classification === 'secret' ? 'badge-secret' : doc.classification === 'unclassified' ? 'badge-unclassified' : 'badge-confidential'}">
          ${doc.classification === 'classified' ? 'CLASSIFIED' : doc.classification === 'secret' ? 'SECRET' : doc.classification === 'unclassified' ? 'UNCLASSIFIED' : 'CONFIDENTIAL'}
        </span>
      </div>
      <div class="card-body">
        <div class="card-meta">
          <span class="lbl">Folder: ${(() => {
            const categories = getCategories();
            const matchedCat = categories.find(c => c.id === doc.category);
            return matchedCat ? matchedCat.label : `Sector SEC-${doc.category.toUpperCase()}`;
          })()}</span>
          <span class="lbl">Signature: <span class="hash-code">${doc.hash.substr(0, 14)}...</span></span>
        </div>
        <div class="card-preview">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span>Content Protected</span>
        </div>
      </div>
      <div class="card-actions">
        <button class="btn-primary btn-blue action-decrypt-btn" draggable="false">View</button>
        <button class="btn-secondary action-move-btn" title="Move Document" draggable="false">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <span>Move</span>
        </button>
        <button class="btn-secondary action-shred-btn" style="color: var(--status-red);" title="Delete Record" draggable="false">Delete</button>
      </div>
    `;

    // Drag and Drop card-level triggers
    card.addEventListener("dragstart", (e) => {
      if (e.target.closest(".card-actions") || e.target.closest(".move-dropdown")) {
        e.preventDefault();
        return;
      }
      card.classList.add("dragging");
      e.dataTransfer.setData("text/plain", doc.id);
      e.dataTransfer.effectAllowed = "move";
      logActivity("info", `Dragging document: "${doc.title}"...`);
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      document.querySelectorAll(".filter-btn-row").forEach(r => r.classList.remove("drag-hover"));
    });

    // Chromium drag-vs-click bug workaround: disable dragging when clicking action buttons or dropdown
    card.addEventListener("mousedown", (e) => {
      if (e.target.closest(".card-actions") || e.target.closest(".move-dropdown")) {
        card.setAttribute("draggable", "false");
      }
    });

    const restoreDraggable = () => {
      card.setAttribute("draggable", "true");
    };
    card.addEventListener("mouseup", restoreDraggable);
    card.addEventListener("mouseleave", restoreDraggable);

    // Bind action events
    card.querySelector(".action-decrypt-btn").addEventListener("click", () => {
      openDecryptionModal(doc);
    });

    card.querySelector(".action-shred-btn").addEventListener("click", () => {
      initiateDocumentShred(doc);
    });

    // Bind Quick Move dropdown trigger
    card.querySelector(".action-move-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      
      // Close any other open move-dropdown first
      document.querySelectorAll(".move-dropdown").forEach(el => el.remove());
      
      const categories = getCategories();
      const otherCategories = categories.filter(c => c.id !== doc.category);
      
      if (otherCategories.length === 0) {
        logActivity("warn", "Cannot move document: No other custom sector folders exist.");
        alert("Please create another sector folder in the sidebar to enable moving documents.");
        return;
      }
      
      // Create the dropdown element
      const dropdown = document.createElement("div");
      dropdown.className = "move-dropdown";
      dropdown.setAttribute("draggable", "false");
      
      // Prevent clicking within the dropdown container from triggering the global dismiss handler
      dropdown.addEventListener("click", (evt) => {
        evt.stopPropagation();
      });
      
      dropdown.innerHTML = `
        <div class="move-dropdown-header">Move Document</div>
      `;
      
      otherCategories.forEach(cat => {
        const item = document.createElement("button");
        item.className = "move-dropdown-item";
        item.setAttribute("draggable", "false");
        item.innerHTML = `
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <span>${cat.label}</span>
        `;
        
        item.addEventListener("click", (evt) => {
          evt.stopPropagation();
          dropdown.remove();
          
          const docs = getDocuments();
          const docIdx = docs.findIndex(d => d.id === doc.id);
          if (docIdx !== -1) {
            docs[docIdx].category = cat.id;
            localStorage.setItem("isa_vault_documents", JSON.stringify(docs));
            logActivity("ok", `Moved document "${doc.title}" to sector: [${cat.label.toUpperCase()}] via quick-select.`);
            loadAndRenderDocuments();
          }
        });
        
        dropdown.appendChild(item);
      });
      
      card.appendChild(dropdown);
    });

    recordsGrid.appendChild(card);
  });
}

/* ================= DECRYPTION ENGINE HELPERS ================= */
function parseContentToTokens(text) {
  const regex = /(\[(?:redact|r):[^\]]+\])/g;
  const parts = text.split(regex);
  return parts.map(part => {
    if (part.match(regex)) {
      const content = part.replace(/\[(?:redact|r):([^\]]+)\]/, '$1');
      return { type: 'redacted', content: content };
    } else {
      return { type: 'text', content: part };
    }
  });
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const MOCK_WORDS = [
  "decrypt", "cipher", "quantum", "handshake", "vector", "buffer", "payload", "algorithm",
  "encryption", "hash", "compile", "terminal", "server", "isolation", "integrity", "vault",
  "network", "channel", "authorized", "declassified", "classified", "secret", "archive", "credentials",
  "auth", "bypass", "system", "engine", "cyber", "access", "portal", "security", "token", "signature"
];

const MOCK_SYMBOLS = [
  "rfj25$@!", "1xzkl2$", "z498x#", "9a2x!7", "k9#p0w", "q7@m1z", "x2*y8p", "c4$v9b",
  "d9!f3s", "g0#h1j", "e5$r8t", "a2@s9d", "w7*e1r", "u3#i4o", "p0@o9i", "l8$k2j",
  "m3!n4b", "v9#c8x", "z1@x2y", "t5*y6u", "i4#o3p", "q1@w2e", "r3$t4y", "u5!i6o",
  "a7#s8d", "f9@g0h", "j1$k2l", "z3*x4c", "v5#b6n", "m7@q8w", "e9$r0t", "y1!u2i"
];

function generateCodeText(targetLength) {
  let result = "";
  while (result.length < targetLength * 1.5) {
    const isWord = Math.random() > 0.5;
    const list = isWord ? MOCK_WORDS : MOCK_SYMBOLS;
    const token = list[Math.floor(Math.random() * list.length)];
    result += token + " ";
  }
  return result.trim();
}

function obfuscateText(text) {
  return generateCodeText(text.length);
}

const CODE_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_$=;+-{}()[]<>&./";

function decryptScrambledElements(elements, onProgress, callback) {
  const duration = 1200; // 1.2 seconds animation
  const intervalTime = 40; // 25 fps
  const totalSteps = duration / intervalTime;
  let currentStep = 0;
  
  const elementData = Array.from(elements).map(el => {
    const original = el.getAttribute("data-original");
    const code = el.getAttribute("data-code") || "";
    return {
      element: el,
      original: original,
      code: code
    };
  });
  
  const timer = setInterval(() => {
    currentStep++;
    const progress = currentStep / totalSteps; // 0 to 1
    
    if (onProgress) {
      onProgress(Math.floor(progress * 100));
    }
    
    elementData.forEach(item => {
      const originalText = item.original;
      const codeText = item.code;
      const L_orig = originalText.length;
      const L_code = codeText.length;
      
      // Interpolate current length
      const L_curr = Math.round(L_code - (L_code - L_orig) * progress);
      
      let newText = "";
      for (let i = 0; i < L_curr; i++) {
        if (i < L_orig * progress) {
          // Resolve with mild flickering near boundary
          if (i > L_orig * progress - 5 && Math.random() > 0.4 && i < L_orig) {
            newText += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
          } else if (i < L_orig) {
            newText += originalText[i];
          }
        } else {
          // Display the mock code character
          if (i < L_code) {
            newText += codeText[i];
          } else {
            newText += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
          }
        }
      }
      
      item.element.textContent = newText;
    });
    
    if (currentStep >= totalSteps) {
      clearInterval(timer);
      elementData.forEach(item => {
        item.element.textContent = item.original;
        item.element.classList.remove("scrambled");
      });
      if (callback) callback();
    }
  }, intervalTime);
}

function animatePercentage(percentText, start, end, duration, callback) {
  const startTime = performance.now();
  
  function update(time) {
    const elapsed = time - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const val = Math.floor(start + (end - start) * progress);
    
    percentText.textContent = `DECRYPTING (${val}%)`;
    
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      percentText.textContent = `DECRYPTED (${end}%)`;
      if (callback) callback();
    }
  }
  requestAnimationFrame(update);
}

/* ================= MODERN DECRYPTION REVEAL ================= */
let currentActiveDoc = null;

function openDecryptionModal(doc) {
  currentActiveDocId = doc.id;
  currentActiveDoc = doc;
  currentDecryptedText = doc.content;

  const modal = document.getElementById("decrypt-modal");
  const title = document.getElementById("modal-doc-title");
  const category = document.getElementById("modal-category");
  const hash = document.getElementById("modal-hash");
  const badge = document.getElementById("modal-classification-badge");
  
  const cipherDisplay = document.getElementById("cipher-text-display");
  const plainTextEdit = document.getElementById("plain-text-edit");
  const percentText = document.getElementById("decryption-percentage");
  
  // Overlays
  const encryptedOverlay = document.getElementById("secure-encrypted-overlay");
  const decryptSpinner = document.getElementById("decrypt-spinner-container");

  // Buttons reset
  const runDecryptBtn = document.getElementById("run-decryption-btn");
  const toggleEditBtn = document.getElementById("toggle-edit-btn");
  const saveEditBtn = document.getElementById("save-edit-btn");

  // Load details
  title.textContent = doc.title;
  
  const categories = getCategories();
  const matchedCat = categories.find(c => c.id === doc.category);
  category.textContent = matchedCat ? matchedCat.label : `Sector SEC-${doc.category.toUpperCase()}`;
  hash.textContent = doc.hash;
  
  badge.textContent = doc.classification === 'classified' ? 'CLASSIFIED' : doc.classification === 'secret' ? 'SECRET' : doc.classification === 'unclassified' ? 'UNCLASSIFIED' : 'CONFIDENTIAL';
  badge.className = `badge ${doc.classification === 'classified' ? 'badge-classified' : doc.classification === 'secret' ? 'badge-secret' : doc.classification === 'unclassified' ? 'badge-unclassified' : 'badge-confidential'}`;

  // Populate metadata edit fields
  populateCategoryDropdowns();
  const editTitleInput = document.getElementById("edit-doc-title");
  const editCategorySelect = document.getElementById("edit-doc-category");
  const editClassificationSelect = document.getElementById("edit-doc-classification");
  
  if (editTitleInput) editTitleInput.value = doc.title;
  if (editCategorySelect) editCategorySelect.value = doc.category;
  if (editClassificationSelect) editClassificationSelect.value = doc.classification;

  // Reset overlays
  encryptedOverlay.classList.add("hidden");
  decryptSpinner.classList.add("hidden");
  plainTextEdit.classList.add("hidden");
  cipherDisplay.classList.remove("hidden");
  
  runDecryptBtn.classList.remove("hidden");
  toggleEditBtn.classList.add("hidden");
  saveEditBtn.classList.add("hidden");

  percentText.textContent = "LOCKED (0%)";
  percentText.className = "text-locked";

  // Render content dynamically with scrambled plain segments and blacked redact segments
  const isClassified = doc.classification !== "unclassified";
  const tokens = parseContentToTokens(doc.content);
  let html = "";
  tokens.forEach(token => {
    if (token.type === "redacted") {
      html += `<span class="redacted-inline" data-real-text="${escapeHtml(token.content)}">${escapeHtml(token.content)}</span>`;
    } else {
      if (isClassified) {
        const codeText = obfuscateText(token.content);
        html += `<span class="plain-segment scrambled" data-original="${escapeHtml(token.content)}" data-code="${escapeHtml(codeText)}">${escapeHtml(codeText)}</span>`;
      } else {
        html += `<span class="plain-segment">${escapeHtml(token.content)}</span>`;
      }
    }
  });
  cipherDisplay.innerHTML = html;

  openModal("decrypt-modal");
  logActivity("info", `Encrypted preview loaded for: "${doc.title}". Authenticating...`);
}

function runDecryptionReveal() {
  const cipherDisplay = document.getElementById("cipher-text-display");
  const decryptBtn = document.getElementById("run-decryption-btn");
  const decryptSpinner = document.getElementById("decrypt-spinner-container");
  const percentText = document.getElementById("decryption-percentage");
  const toggleEditBtn = document.getElementById("toggle-edit-btn");

  decryptBtn.classList.add("hidden");
  decryptSpinner.classList.remove("hidden");

  // Spin up buffers (300ms)
  setTimeout(() => {
    decryptSpinner.classList.add("hidden");
    
    const isClassified = currentActiveDoc && currentActiveDoc.classification !== "unclassified";
    const scrambledElements = cipherDisplay.querySelectorAll(".scrambled");
    
    if (isClassified && scrambledElements.length > 0) {
      percentText.className = "text-locked";
      
      decryptScrambledElements(
        scrambledElements,
        (progress) => {
          percentText.textContent = `DECRYPTING (${progress}%)`;
        },
        () => {
          percentText.textContent = "DECRYPTED (OK)";
          percentText.className = "green-text";
          toggleEditBtn.classList.remove("hidden");
          
          // Smooth fade in redactions!
          cipherDisplay.querySelectorAll(".redacted-inline").forEach(el => {
            el.classList.add("revealed");
          });
          
          logActivity("ok", `Document decrypted and unredacted: "${currentActiveDoc.title}".`);
        }
      );
    } else {
      // Unclassified document - immediately read except redacted parts, then animate reveal
      animatePercentage(
        percentText,
        0,
        100,
        600,
        () => {
          percentText.textContent = "DECRYPTED (OK)";
          percentText.className = "green-text";
          toggleEditBtn.classList.remove("hidden");
          
          // Reveal blacked redact blocks
          cipherDisplay.querySelectorAll(".redacted-inline").forEach(el => {
            el.classList.add("revealed");
          });
          
          logActivity("ok", `Redactions revealed successfully for: "${currentActiveDoc.title}".`);
        }
      );
    }
  }, 300);
}

/* ================= MINIMALIST DOCUMENT SHREDDER ================= */
function initiateDocumentShred(doc) {
  const card = document.getElementById(`card-${doc.id}`);
  if (card) {
    card.classList.add("alert-shredding");
  }

  const overlay = document.getElementById("shredder-overlay");
  const shredderLogFile = document.getElementById("shredder-log-file");
  const shredderProgressFill = document.getElementById("shredder-progress-fill");

  shredderLogFile.textContent = `DELETING: "${doc.title.toUpperCase()}"`;
  shredderProgressFill.style.width = "0%";
  overlay.classList.remove("hidden");

  // Shred in 600ms
  let progress = 0;
  const shredInterval = setInterval(() => {
    progress += 20;
    shredderProgressFill.style.width = `${progress}%`;
    
    if (progress >= 100) {
      clearInterval(shredInterval);
      
      deleteDocument(doc.id);
      
      setTimeout(() => {
        overlay.classList.add("hidden");
        logActivity("warn", `Document permanently removed from local cache: "${doc.title}".`);
      }, 150);
    }
  }, 80);
}

/* ================= MODERN ACTIVITY LOGS IMPLEMENTATION ================= */
function logActivity(type, message) {
  const screen = document.getElementById("activity-log-screen");
  if (!screen) return;

  const d = new Date();
  const timeStr = `[${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}]`;
  
  const line = document.createElement("div");
  line.className = "log-line";
  
  let labelColorClass = "";
  let labelText = "";

  switch (type) {
    case "ok":
      labelColorClass = "green-text";
      labelText = "[OK]  ";
      break;
    case "warn":
      labelColorClass = "red-text";
      labelText = "[WARN] ";
      break;
    case "info":
      labelColorClass = "cyan-text";
      labelText = "[INFO] ";
      break;
    case "config":
      labelColorClass = "green-text";
      labelText = "[CONF] ";
      break;
    default:
      labelColorClass = "green-text";
      labelText = "[SYS]  ";
  }

  line.innerHTML = `<span style="color: var(--text-muted);">${timeStr}</span> <span class="${labelColorClass}">${labelText}</span> ${message}`;
  screen.appendChild(line);
  screen.scrollTop = screen.scrollHeight;
}

/* ================= KEYBOARD SHORTCUTS ENGINE ================= */
function setupShortcutKeys() {
  document.addEventListener("keydown", (e) => {
    // Focus search bar on Ctrl+K or Cmd+K
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      const searchInput = document.getElementById("drive-search");
      const dashboard = document.getElementById("dashboard-container");
      
      if (searchInput && dashboard && !dashboard.classList.contains("hidden")) {
        e.preventDefault();
        searchInput.focus();
      }
    }

    // Close active modal on Escape key
    if (e.key === "Escape") {
      const activeDecryptModal = document.getElementById("decrypt-modal");
      const activeCreateModal = document.getElementById("create-modal");
      const activePublicModal = document.getElementById("public-read-modal");

      if (activeDecryptModal && !activeDecryptModal.classList.contains("hidden")) {
        closeModal("decrypt-modal");
      }
      if (activeCreateModal && !activeCreateModal.classList.contains("hidden")) {
        closeModal("create-modal");
      }
      if (activePublicModal && !activePublicModal.classList.contains("hidden")) {
        closeModal("public-read-modal");
      }
    }
  });
}

/* ================= GENERAL VIEW MODALS WORKERS ================= */
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove("hidden");
    modal.style.opacity = "0";
    setTimeout(() => {
      modal.style.opacity = "1";
    }, 10);
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.style.opacity = "0";
    setTimeout(() => {
      modal.classList.add("hidden");
    }, 200);
  }
}
