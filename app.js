const STORAGE_KEYS = {
  templates: "textExtractionToolPro.templates",
  recent: "textExtractionToolPro.recentInputs",
  theme: "textExtractionToolPro.theme",
  settings: "textExtractionToolPro.settings"
};

const BUILTIN_TEMPLATES = {
  "Custom": {
    startPattern: 'data-name="',
    endPattern: '" data-option-order',
    fullRegexPattern: 'data-name="(.*?)" data-option-order',
    regexMode: false,
    caseInsensitive: false,
    htmlAttributeMode: false,
    attributeName: "data-name"
  },
  "HTML attribute extractor": {
    startPattern: "",
    endPattern: "",
    fullRegexPattern: "",
    regexMode: false,
    caseInsensitive: false,
    htmlAttributeMode: true,
    attributeName: "data-name"
  },
  "HTML class attribute": {
    startPattern: "",
    endPattern: "",
    fullRegexPattern: "",
    regexMode: false,
    caseInsensitive: false,
    htmlAttributeMode: true,
    attributeName: "class"
  },
  "HTML id attribute": {
    startPattern: "",
    endPattern: "",
    fullRegexPattern: "",
    regexMode: false,
    caseInsensitive: false,
    htmlAttributeMode: true,
    attributeName: "id"
  }
};

const state = {
  currentInputMode: "paste",
  currentFileName: "",
  currentSourceType: "Manual",
  currentSourceText: "",
  sourcePreviewExpanded: false,
  testOutputExpanded: false,
  resultsPreviewExpanded: false,
  activityLogExpanded: false,
  lastResults: [],
  lastDuplicatesRemoved: 0,
  lastRawCount: 0,
  userTemplates: loadJSON(STORAGE_KEYS.templates, {}),
  recentInputs: loadJSON(STORAGE_KEYS.recent, []),
  activity: []
};

const el = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  setupTheme();
  populateTemplates();
  populateRecents();
  bindEvents();
  applySavedSettings();
  syncSourcePreviewMode();
  syncTestOutputMode();
  syncResultsPreviewMode();
  syncActivityLogMode();
  updatePatternModeUI();
  updateAttributeModeUI();
  renderSourcePreview("Your source preview will appear here.", true);
  renderResultsPreview("No results to preview.", true);
  renderTestOutput("Test output will appear here.", true);
  renderLog();
  setStatus("Ready", "info");
});

function cacheElements() {
  [
    "themeToggle", "themeLabel", "themeIcon",
    "counterMatches", "counterUnique", "counterDuplicates", "counterSource",
    "templateSelect", "saveTemplateBtn", "deleteTemplateBtn",
    "recentSelect", "loadRecentBtn",
    "inputText", "fileInput", "browseFileBtn", "selectedFileLabel", "dropzone", "sourcePreview", "toggleSourcePreviewBtn",
    "startPattern", "endPattern", "startPatternBlock", "endPatternBlock", "fullRegexPattern", "fullRegexBlock", "htmlAttributeMode", "attributeName", "attributeNameBlock",
    "regexMode", "caseInsensitive", "trimWhitespace", "removeEmpty", "removeDuplicates", "sortResults",
    "testInput", "testPatternBtn", "clearTestBtn", "testOutput", "toggleTestOutputBtn",
    "extractBtn", "copyBtn", "downloadTxtBtn", "downloadCsvBtn", "downloadJsonBtn", "clearBtn",
    "resultsPreview", "toggleResultsPreviewBtn", "activityLog", "toggleActivityLogBtn", "statusChip", "toastWrap",
    "pasteModePane", "fileModePane"
  ].forEach(id => el[id] = document.getElementById(id));
}

function bindEvents() {
  document.querySelectorAll(".segment-btn").forEach(btn => {
    btn.addEventListener("click", () => switchInputMode(btn.dataset.mode));
  });

  el.themeToggle.addEventListener("click", toggleTheme);
  el.toggleSourcePreviewBtn.addEventListener("click", toggleSourcePreviewMode);
  el.toggleTestOutputBtn.addEventListener("click", toggleTestOutputMode);
  el.toggleResultsPreviewBtn.addEventListener("click", toggleResultsPreviewMode);
  el.toggleActivityLogBtn.addEventListener("click", toggleActivityLogMode);
  el.templateSelect.addEventListener("change", applySelectedTemplate);
  el.saveTemplateBtn.addEventListener("click", saveCurrentTemplate);
  el.deleteTemplateBtn.addEventListener("click", deleteTemplate);
  el.loadRecentBtn.addEventListener("click", loadRecentInput);

  el.htmlAttributeMode.addEventListener("change", updateAttributeModeUI);
  el.regexMode.addEventListener("change", () => {
    updatePatternModeUI();
    updateAttributeModeUI();
  });
  el.fileInput.addEventListener("change", handleFileSelection);
  el.browseFileBtn.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    el.fileInput.click();
  });
  el.dropzone.addEventListener("click", event => {
    if (event.target === el.browseFileBtn) return;
    el.fileInput.click();
  });

  ["dragenter", "dragover"].forEach(evt => {
    el.dropzone.addEventListener(evt, e => {
      e.preventDefault();
      e.stopPropagation();
      el.dropzone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach(evt => {
    el.dropzone.addEventListener(evt, e => {
      e.preventDefault();
      e.stopPropagation();
      el.dropzone.classList.remove("dragover");
    });
  });
  el.dropzone.addEventListener("drop", e => {
    const file = e.dataTransfer?.files?.[0];
    if (file) readFile(file);
  });

  el.testPatternBtn.addEventListener("click", testPattern);
  el.clearTestBtn.addEventListener("click", () => {
    el.testInput.value = "";
  el.fullRegexPattern.value = 'data-name="(.*?)" data-option-order';
    renderTestOutput("Test output will appear here.", true);
    toast("Pattern tester cleared.", "info");
  });

  el.extractBtn.addEventListener("click", runExtractionPreview);
  el.copyBtn.addEventListener("click", copyResults);
  el.downloadTxtBtn.addEventListener("click", () => downloadResults("txt"));
  el.downloadCsvBtn.addEventListener("click", () => downloadResults("csv"));
  el.downloadJsonBtn.addEventListener("click", () => downloadResults("json"));
  el.clearBtn.addEventListener("click", clearAll);

  const persistSettingEvents = [
    el.startPattern, el.endPattern, el.fullRegexPattern, el.attributeName,
    el.regexMode, el.caseInsensitive, el.trimWhitespace, el.removeEmpty,
    el.removeDuplicates, el.sortResults, el.htmlAttributeMode
  ];

  persistSettingEvents.forEach(node => {
    const eventName = node.type === "checkbox" ? "change" : "input";
    node.addEventListener(eventName, persistSettings);
  });

  el.inputText.addEventListener("input", () => {
    if (state.currentInputMode === "paste") {
      state.currentSourceText = el.inputText.value;
      state.currentSourceType = el.inputText.value.trim() ? "Manual" : "Manual";
      renderSourcePreview(el.inputText.value || "Your source preview will appear here.", !el.inputText.value.trim());
    }
  });
}

function setupTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme) || "dark";
  if (savedTheme === "light") {
    document.body.classList.add("light-theme");
  }
  syncThemeUI();
}

function toggleTheme() {
  document.body.classList.toggle("light-theme");
  localStorage.setItem(STORAGE_KEYS.theme, document.body.classList.contains("light-theme") ? "light" : "dark");
  syncThemeUI();
}

function syncThemeUI() {
  const light = document.body.classList.contains("light-theme");
  el.themeLabel.textContent = light ? "Light" : "Dark";
  el.themeIcon.textContent = light ? "☀️" : "🌙";
}


function syncExpandablePreview(node, button, expanded) {
  if (!node || !button) return;
  node.classList.toggle("collapsed", !expanded);
  node.classList.toggle("expanded", expanded);
  button.textContent = expanded ? "Collapse" : "Expand";
  button.setAttribute("aria-expanded", String(expanded));
}

function toggleSourcePreviewMode() {
  state.sourcePreviewExpanded = !state.sourcePreviewExpanded;
  syncSourcePreviewMode();
  persistSettings();
}

function syncSourcePreviewMode() {
  syncExpandablePreview(el.sourcePreview, el.toggleSourcePreviewBtn, state.sourcePreviewExpanded);
}

function toggleTestOutputMode() {
  state.testOutputExpanded = !state.testOutputExpanded;
  syncTestOutputMode();
  persistSettings();
}

function syncTestOutputMode() {
  syncExpandablePreview(el.testOutput, el.toggleTestOutputBtn, state.testOutputExpanded);
}

function toggleResultsPreviewMode() {
  state.resultsPreviewExpanded = !state.resultsPreviewExpanded;
  syncResultsPreviewMode();
  persistSettings();
}

function syncResultsPreviewMode() {
  syncExpandablePreview(el.resultsPreview, el.toggleResultsPreviewBtn, state.resultsPreviewExpanded);
}

function toggleActivityLogMode() {
  state.activityLogExpanded = !state.activityLogExpanded;
  syncActivityLogMode();
  persistSettings();
}

function syncActivityLogMode() {
  syncExpandablePreview(el.activityLog, el.toggleActivityLogBtn, state.activityLogExpanded);
}


function switchInputMode(mode) {
  state.currentInputMode = mode;
  document.querySelectorAll(".segment-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.mode === mode));
  el.pasteModePane.classList.toggle("active", mode === "paste");
  el.fileModePane.classList.toggle("active", mode === "file");
  el.pasteModePane.hidden = mode !== "paste";
  el.fileModePane.hidden = mode !== "file";

  if (mode === "paste") {
    state.currentSourceType = "Manual";
    state.currentSourceText = el.inputText.value;
    renderSourcePreview(el.inputText.value || "Your source preview will appear here.", !el.inputText.value.trim());
  } else if (!state.currentFileName) {
    renderSourcePreview("Upload a file to preview its contents here.", true);
  }

  updateCounters();
}

function updatePatternModeUI() {
  const showFullRegex = el.regexMode.checked && !el.htmlAttributeMode.checked;
  el.startPatternBlock.hidden = showFullRegex || el.htmlAttributeMode.checked;
  el.endPatternBlock.hidden = showFullRegex || el.htmlAttributeMode.checked;
  el.fullRegexBlock.hidden = !showFullRegex;
}

function updateAttributeModeUI() {
  const htmlMode = el.htmlAttributeMode.checked;
  el.attributeNameBlock.hidden = !htmlMode;

  el.startPattern.disabled = htmlMode || el.regexMode.checked;
  el.endPattern.disabled = htmlMode || el.regexMode.checked;
  el.fullRegexPattern.disabled = htmlMode || !el.regexMode.checked;

  updatePatternModeUI();
  persistSettings();
}

function toggleSourcePreviewMode() {
  state.sourcePreviewExpanded = !state.sourcePreviewExpanded;
  syncSourcePreviewMode();
  persistSettings();
}

function syncSourcePreviewMode() {
  const expanded = !!state.sourcePreviewExpanded;
  el.sourcePreview.classList.toggle("expanded", expanded);
  el.sourcePreview.classList.toggle("collapsed", !expanded);
  el.toggleSourcePreviewBtn.textContent = expanded ? "Collapse" : "Expand";
  el.toggleSourcePreviewBtn.setAttribute("aria-expanded", String(expanded));
}

function handleFileSelection(event) {
  const file = event.target.files?.[0];
  if (file) {
    readFile(file);
  } else {
    toast("No file was selected.", "info");
  }
}

function readFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const text = typeof reader.result === "string" ? reader.result : "";
    state.currentInputMode = "file";
    state.currentFileName = file.name;
    state.currentSourceType = file.name;
    state.currentSourceText = text;

    el.selectedFileLabel.textContent = file.name;
    renderSourcePreview(text || "The selected file is empty.", !text.trim());
    addRecentInput(file.name);
    switchInputMode("file");
    updateCounters();
    log(`Loaded file: ${file.name} (${file.size.toLocaleString()} bytes)`);
    el.fileInput.value = "";
    toast(`Loaded file: ${file.name}`, "success");
  };
  reader.onerror = () => {
    toast("Could not read the selected file.", "error");
    log("Failed to read selected file.");
  };
  try {
    reader.readAsText(file, "utf-8");
  } catch {
    reader.readAsText(file);
  }
}

function applySavedSettings() {
  const settings = loadJSON(STORAGE_KEYS.settings, null);
  if (!settings) return;

  state.sourcePreviewExpanded = !!settings.sourcePreviewExpanded;
  state.testOutputExpanded = !!settings.testOutputExpanded;
  state.resultsPreviewExpanded = !!settings.resultsPreviewExpanded;
  state.activityLogExpanded = !!settings.activityLogExpanded;
  el.startPattern.value = settings.startPattern ?? el.startPattern.value;
  el.endPattern.value = settings.endPattern ?? el.endPattern.value;
  el.fullRegexPattern.value = settings.fullRegexPattern ?? el.fullRegexPattern.value;
  el.attributeName.value = settings.attributeName ?? el.attributeName.value;
  el.regexMode.checked = !!settings.regexMode;
  el.caseInsensitive.checked = !!settings.caseInsensitive;
  el.trimWhitespace.checked = settings.trimWhitespace !== false;
  el.removeEmpty.checked = settings.removeEmpty !== false;
  el.removeDuplicates.checked = !!settings.removeDuplicates;
  el.sortResults.checked = !!settings.sortResults;
  el.htmlAttributeMode.checked = !!settings.htmlAttributeMode;
}

function persistSettings() {
  const settings = {
    startPattern: el.startPattern.value,
    endPattern: el.endPattern.value,
    fullRegexPattern: el.fullRegexPattern.value,
    attributeName: el.attributeName.value,
    regexMode: el.regexMode.checked,
    caseInsensitive: el.caseInsensitive.checked,
    trimWhitespace: el.trimWhitespace.checked,
    removeEmpty: el.removeEmpty.checked,
    removeDuplicates: el.removeDuplicates.checked,
    sortResults: el.sortResults.checked,
    htmlAttributeMode: el.htmlAttributeMode.checked,
    sourcePreviewExpanded: state.sourcePreviewExpanded,
    testOutputExpanded: state.testOutputExpanded,
    resultsPreviewExpanded: state.resultsPreviewExpanded,
    activityLogExpanded: state.activityLogExpanded
  };
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
}

function getAllTemplates() {
  return { ...BUILTIN_TEMPLATES, ...state.userTemplates };
}

function populateTemplates() {
  const templates = getAllTemplates();
  const previousValue = el.templateSelect.value || "Custom";
  el.templateSelect.innerHTML = Object.keys(templates)
    .map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join("");
  el.templateSelect.value = templates[previousValue] ? previousValue : "Custom";
}

function applySelectedTemplate() {
  const templates = getAllTemplates();
  const selected = el.templateSelect.value;
  const template = templates[selected];
  if (!template) return;

  el.startPattern.value = template.startPattern ?? "";
  el.endPattern.value = template.endPattern ?? "";
  el.fullRegexPattern.value = template.fullRegexPattern ?? "";
  el.regexMode.checked = !!template.regexMode;
  el.caseInsensitive.checked = !!template.caseInsensitive;
  el.htmlAttributeMode.checked = !!template.htmlAttributeMode;
  el.attributeName.value = template.attributeName ?? "data-name";

  updatePatternModeUI();
  updateAttributeModeUI();
  persistSettings();
  toast(`Template applied: ${selected}`, "success");
  log(`Template applied: ${selected}`);
}

function saveCurrentTemplate() {
  const name = window.prompt("Enter a name for the template:");
  if (name === null) return;

  const cleanName = name.trim();
  if (!cleanName) {
    toast("Template name cannot be empty.", "error");
    return;
  }
  if (BUILTIN_TEMPLATES[cleanName]) {
    toast("That template name is reserved.", "error");
    return;
  }

  state.userTemplates[cleanName] = {
    startPattern: el.startPattern.value,
    endPattern: el.endPattern.value,
    fullRegexPattern: el.fullRegexPattern.value,
    regexMode: el.regexMode.checked,
    caseInsensitive: el.caseInsensitive.checked,
    htmlAttributeMode: el.htmlAttributeMode.checked,
    attributeName: el.attributeName.value.trim() || "data-name"
  };

  localStorage.setItem(STORAGE_KEYS.templates, JSON.stringify(state.userTemplates));
  populateTemplates();
  el.templateSelect.value = cleanName;
  toast(`Template saved: ${cleanName}`, "success");
  log(`Template saved: ${cleanName}`);
}

function deleteTemplate() {
  const selected = el.templateSelect.value;
  if (!state.userTemplates[selected]) {
    toast("Select a custom template to delete.", "error");
    return;
  }

  delete state.userTemplates[selected];
  localStorage.setItem(STORAGE_KEYS.templates, JSON.stringify(state.userTemplates));
  populateTemplates();
  el.templateSelect.value = "Custom";
  toast(`Template deleted: ${selected}`, "success");
  log(`Template deleted: ${selected}`);
}

function populateRecents() {
  const options = state.recentInputs.length
    ? state.recentInputs.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("")
    : '<option value="">No recent items</option>';
  el.recentSelect.innerHTML = options;
}

function addRecentInput(label) {
  if (!label) return;
  state.recentInputs = [label, ...state.recentInputs.filter(item => item !== label)].slice(0, 12);
  localStorage.setItem(STORAGE_KEYS.recent, JSON.stringify(state.recentInputs));
  populateRecents();
}

function loadRecentInput() {
  const selected = el.recentSelect.value;
  if (!selected) {
    toast("No recent input available.", "error");
    return;
  }
  toast(`Recent item selected: ${selected}`, "info");
  log(`Recent item selected: ${selected}`);
}

function compilePatternParts() {
  const flags = `gs${el.caseInsensitive.checked ? "i" : ""}`;

  if (el.htmlAttributeMode.checked) {
    const attr = el.attributeName.value.trim();
    if (!attr) throw new Error("Please enter an HTML attribute name.");
    const attrEscaped = escapeRegex(attr);
    return {
      regex: new RegExp(`${attrEscaped}\\s*=\\s*(["'])(.*?)\\1`, flags),
      groupIndex: 2
    };
  }

  if (el.regexMode.checked) {
    const fullRegexPattern = el.fullRegexPattern.value.trim();
    if (!fullRegexPattern) throw new Error("Please enter the full regex capture pattern.");

    const regex = new RegExp(fullRegexPattern, flags);
    const hasCapturingGroup = /(^|[^\\])\((?!\?[:!=<])/.test(fullRegexPattern);

    return {
      regex,
      groupIndex: hasCapturingGroup ? 1 : 0
    };
  }

  const startPattern = el.startPattern.value;
  const endPattern = el.endPattern.value;

  if (!startPattern) throw new Error("Please enter the pattern before the text to extract.");
  if (!endPattern) throw new Error("Please enter the pattern after the text to extract.");

  return {
    regex: new RegExp(`${escapeRegex(startPattern)}(.*?)${escapeRegex(endPattern)}`, flags),
    groupIndex: 1
  };
}

function extractFromText(text) {
  const { regex, groupIndex } = compilePatternParts();
  const values = [];

  for (const match of text.matchAll(regex)) {
    let value = match[groupIndex] ?? "";
    if (el.trimWhitespace.checked) value = value.trim();
    values.push(value);
  }

  const rawCount = values.length;
  let results = [...values];

  if (el.removeEmpty.checked) {
    results = results.filter(item => item !== "");
  }

  let duplicatesRemoved = 0;
  if (el.removeDuplicates.checked) {
    const unique = [...new Set(results)];
    duplicatesRemoved = results.length - unique.length;
    results = unique;
  }

  if (el.sortResults.checked) {
    results.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }

  return { results, rawCount, duplicatesRemoved };
}

function testPattern() {
  const sample = el.testInput.value;
  try {
    const { results, rawCount, duplicatesRemoved } = extractFromText(sample);
    const lines = [
      `Matches found after processing: ${results.length}`,
      `Raw matches found: ${rawCount}`,
      `Duplicates removed: ${duplicatesRemoved}`,
      "----------------------------------------"
    ];

    if (results.length) {
      lines.push(...results.slice(0, 100));
      if (results.length > 100) lines.push(`\n...and ${results.length - 100} more result(s).`);
    } else {
      lines.push("No matches found.");
    }

    renderTestOutput(lines.join("\n"), false);
    setStatus("Pattern tested", "success");
    log(`Pattern test completed with ${results.length} result(s).`);
  } catch (error) {
    renderTestOutput(`Error:\n${error.message}`, false);
    setStatus("Pattern test failed", "error");
    log(`Pattern test failed: ${error.message}`);
    toast(error.message, "error");
  }
}

function getSourceText() {
  if (state.currentInputMode === "file") {
    return state.currentSourceText || "";
  }
  return el.inputText.value || "";
}

function runExtractionPreview() {
  const sourceText = getSourceText();
  if (!sourceText.trim()) {
    toast("Please paste text or upload a file first.", "error");
    setStatus("No input text", "error");
    return;
  }

  try {
    const { results, rawCount, duplicatesRemoved } = extractFromText(sourceText);
    state.lastResults = results;
    state.lastDuplicatesRemoved = duplicatesRemoved;
    state.lastRawCount = rawCount;
    state.currentSourceText = sourceText;

    renderResultsPreview(
      results.length ? results.slice(0, 500).join("\n") + (results.length > 500 ? `\n\n...and ${results.length - 500} more result(s).` : "") : "No matches found.",
      !results.length
    );

    updateCounters();
    setStatus(results.length ? `Preview ready: ${results.length} result(s)` : "Preview ready: no matches found", results.length ? "success" : "info");
    log(`Extraction preview completed. Results: ${results.length}, raw matches: ${rawCount}, duplicates removed: ${duplicatesRemoved}.`);
    toast(results.length ? `Found ${results.length} result(s).` : "No matches found.", results.length ? "success" : "info");
    persistSettings();
  } catch (error) {
    setStatus("Extraction failed", "error");
    toast(error.message, "error");
    log(`Extraction failed: ${error.message}`);
  }
}

function updateCounters() {
  const matches = state.lastResults.length;
  const unique = new Set(state.lastResults).size;
  el.counterMatches.textContent = String(matches);
  el.counterUnique.textContent = String(unique);
  el.counterDuplicates.textContent = String(state.lastDuplicatesRemoved);
  el.counterSource.textContent = state.currentInputMode === "file"
    ? (state.currentFileName || "File")
    : "Manual";
}

function copyResults() {
  if (!state.lastResults.length) {
    toast("There are no results to copy.", "error");
    return;
  }

  navigator.clipboard.writeText(state.lastResults.join("\n"))
    .then(() => {
      toast("Results copied to clipboard.", "success");
      log("Results copied to clipboard.");
    })
    .catch(() => {
      toast("Clipboard access failed in this browser context.", "error");
      log("Clipboard copy failed.");
    });
}

function downloadResults(format) {
  if (!state.lastResults.length) {
    toast("There are no results to download.", "error");
    return;
  }

  let content = "";
  let mime = "text/plain;charset=utf-8";
  let extension = format;

  if (format === "txt") {
    content = state.lastResults.join("\n");
  } else if (format === "csv") {
    content = ["value", ...state.lastResults.map(csvEscape)].join("\n");
    mime = "text/csv;charset=utf-8";
  } else if (format === "json") {
    content = JSON.stringify(state.lastResults, null, 2);
    mime = "application/json;charset=utf-8";
  }

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `text-extraction-results.${extension}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  toast(`Downloaded ${format.toUpperCase()} results.`, "success");
  log(`Downloaded results as ${format.toUpperCase()}.`);
}

function clearAll() {
  el.inputText.value = "";
  el.fileInput.value = "";
  el.selectedFileLabel.textContent = "No file selected";
  el.testInput.value = "";
  el.fullRegexPattern.value = 'data-name="(.*?)" data-option-order';

  state.currentFileName = "";
  state.currentSourceType = "Manual";
  state.currentSourceText = "";
  state.lastResults = [];
  state.lastDuplicatesRemoved = 0;
  state.lastRawCount = 0;

  renderSourcePreview("Your source preview will appear here.", true);
  renderResultsPreview("No results to preview.", true);
  renderTestOutput("Test output will appear here.", true);
  syncSourcePreviewMode();
  syncTestOutputMode();
  syncResultsPreviewMode();
  syncActivityLogMode();
  updatePatternModeUI();
  updateAttributeModeUI();
  setStatus("Ready", "info");
  updateCounters();
  log("Cleared fields and previews.");
  toast("Cleared the current session.", "info");
}

function renderSourcePreview(text, empty = false) {
  el.sourcePreview.textContent = text;
  el.sourcePreview.classList.toggle("empty", empty);
}

function renderResultsPreview(text, empty = false) {
  el.resultsPreview.textContent = text;
  el.resultsPreview.classList.toggle("empty", empty);
}

function renderTestOutput(text, empty = false) {
  el.testOutput.textContent = text;
  el.testOutput.classList.toggle("empty", empty);
}

function setStatus(text, type = "info") {
  el.statusChip.textContent = text;
  const colors = {
    success: "var(--success)",
    error: "var(--danger)",
    info: "var(--accent)"
  };
  el.statusChip.style.color = colors[type] || "var(--accent)";
}

function toast(message, type = "info") {
  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.textContent = message;
  el.toastWrap.appendChild(node);
  window.setTimeout(() => {
    node.style.opacity = "0";
    node.style.transform = "translateY(6px)";
    window.setTimeout(() => node.remove(), 220);
  }, 2600);
}

function log(message) {
  const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  state.activity.unshift(`[${timestamp}] ${message}`);
  state.activity = state.activity.slice(0, 150);
  renderLog();
}

function renderLog() {
  if (!state.activity.length) {
    el.activityLog.textContent = "The activity log will appear here.";
    el.activityLog.classList.add("empty");
    return;
  }
  el.activityLog.textContent = state.activity.join("\n");
  el.activityLog.classList.remove("empty");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function csvEscape(value) {
  const safe = String(value ?? "");
  if (/[",\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
