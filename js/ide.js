import { usePuter } from "./puter.js";
import { createChatComponent } from './ChatComponent.js';

const API_KEY = ""; // Get yours at https://platform.sulu.sh/apis/judge0

const AUTH_HEADERS = API_KEY ? {
    "Authorization": `Bearer ${API_KEY}`
} : {};

const CE = "CE";
const EXTRA_CE = "EXTRA_CE";

const AUTHENTICATED_CE_BASE_URL = "https://judge0-ce.p.sulu.sh";
const AUTHENTICATED_EXTRA_CE_BASE_URL = "https://judge0-extra-ce.p.sulu.sh";

var AUTHENTICATED_BASE_URL = {};
AUTHENTICATED_BASE_URL[CE] = AUTHENTICATED_CE_BASE_URL;
AUTHENTICATED_BASE_URL[EXTRA_CE] = AUTHENTICATED_EXTRA_CE_BASE_URL;

const UNAUTHENTICATED_CE_BASE_URL = "https://ce.judge0.com";
const UNAUTHENTICATED_EXTRA_CE_BASE_URL = "https://extra-ce.judge0.com";

var UNAUTHENTICATED_BASE_URL = {};
UNAUTHENTICATED_BASE_URL[CE] = UNAUTHENTICATED_CE_BASE_URL;
UNAUTHENTICATED_BASE_URL[EXTRA_CE] = UNAUTHENTICATED_EXTRA_CE_BASE_URL;

const INITIAL_WAIT_TIME_MS = 0;
const WAIT_TIME_FUNCTION = i => 100;
const MAX_PROBE_REQUESTS = 50;

var fontSize = 13;

var layout;

export var sourceEditor = null;
export var currentEditorType = 'standard'; // or 'diff'

var stdinEditor;
var stdoutEditor;

var $selectLanguage;
var $compilerOptions;
var $commandLineArguments;
var $runBtn;
var $statusLine;

var timeStart;

var sqliteAdditionalFiles;
var languages = {};

var layoutConfig = {
    settings: {
        showPopoutIcon: false,
        reorderEnabled: true
    },
    content: [{
        type: "row",
        content: [{
            type: "component",
            width: 66,
            componentName: "source",
            id: "source",
            title: "Source Code",
            isClosable: false,
            componentState: {
                readOnly: false
            }
        }, {
            type: "column",
            content: [{
                height: 66,
                type: "stack",
                content: [{
                    type: "component",
                    componentName: "ai",
                    id: "ai",
                    title: "AI Assistant",
                    isClosable: false,
                    componentState: {
                        readOnly: false
                    }
                }, {
                    type: "component",
                    componentName: "composer",
                    id: "composer",
                    title: "AI Composer",
                    isClosable: false,
                    componentState: {
                        readOnly: false
                    }
                }]
            }, {
                type: "stack",
                content: [
                    {
                        type: "component",
                        componentName: "stdin",
                        id: "stdin",
                        title: "Input",
                        isClosable: false,
                        componentState: {
                            readOnly: false
                        }
                    }, {
                        type: "component",
                        componentName: "stdout",
                        id: "stdout",
                        title: "Output",
                        isClosable: false,
                        componentState: {
                            readOnly: true
                        }
                    }]
            }]
        }]
    }]
};

var gPuterFile;

function encode(str) {
    return btoa(unescape(encodeURIComponent(str || "")));
}

function decode(bytes) {
    var escaped = escape(atob(bytes || ""));
    try {
        return decodeURIComponent(escaped);
    } catch {
        return unescape(escaped);
    }
}

function showError(title, content) {
    $("#judge0-site-modal #title").html(title);
    $("#judge0-site-modal .content").html(content);

    let reportTitle = encodeURIComponent(`Error on ${window.location.href}`);
    let reportBody = encodeURIComponent(
        `**Error Title**: ${title}\n` +
        `**Error Timestamp**: \`${new Date()}\`\n` +
        `**Origin**: ${window.location.href}\n` +
        `**Description**:\n${content}`
    );

    $("#report-problem-btn").attr("href", `https://github.com/judge0/ide/issues/new?title=${reportTitle}&body=${reportBody}`);
    $("#judge0-site-modal").modal("show");
}

function showHttpError(jqXHR) {
    showError(`${jqXHR.statusText} (${jqXHR.status})`, `<pre>${JSON.stringify(jqXHR, null, 4)}</pre>`);
}

function handleRunError(jqXHR) {
    showHttpError(jqXHR);
    $runBtn.removeClass("loading");

    window.top.postMessage(JSON.parse(JSON.stringify({
        event: "runError",
        data: jqXHR
    })), "*");
}

function handleResult(data) {
    const tat = Math.round(performance.now() - timeStart);
    console.log(`It took ${tat}ms to get submission result.`);

    const status = data.status;
    const stdout = decode(data.stdout);
    const compileOutput = decode(data.compile_output);
    const time = (data.time === null ? "-" : data.time + "s");
    const memory = (data.memory === null ? "-" : data.memory + "KB");

    $statusLine.html(`${status.description}, ${time}, ${memory} (TAT: ${tat}ms)`);

    const output = [compileOutput, stdout].join("\n").trim();

    stdoutEditor.setValue(output);

    $runBtn.removeClass("loading");

    window.top.postMessage(JSON.parse(JSON.stringify({
        event: "postExecution",
        status: data.status,
        time: data.time,
        memory: data.memory,
        output: output
    })), "*");
}

async function getSelectedLanguage() {
    return getLanguage(getSelectedLanguageFlavor(), getSelectedLanguageId())
}

function getSelectedLanguageId() {
    return parseInt($selectLanguage.val());
}

function getSelectedLanguageFlavor() {
    return $selectLanguage.find(":selected").attr("flavor");
}

function run() {
    if (sourceEditor.getValue().trim() === "") {
        showError("Error", "Source code can't be empty!");
        return;
    } else {
        $runBtn.addClass("loading");
    }

    stdoutEditor.setValue("");
    $statusLine.html("");

    let x = layout.root.getItemsById("stdout")[0];
    x.parent.header.parent.setActiveContentItem(x);

    let sourceValue = encode(sourceEditor.getValue());
    let stdinValue = encode(stdinEditor.getValue());
    let languageId = getSelectedLanguageId();
    let compilerOptions = $compilerOptions.val();
    let commandLineArguments = $commandLineArguments.val();

    let flavor = getSelectedLanguageFlavor();

    if (languageId === 44) {
        sourceValue = sourceEditor.getValue();
    }

    let data = {
        source_code: sourceValue,
        language_id: languageId,
        stdin: stdinValue,
        compiler_options: compilerOptions,
        command_line_arguments: commandLineArguments,
        redirect_stderr_to_stdout: true
    };

    let sendRequest = function (data) {
        window.top.postMessage(JSON.parse(JSON.stringify({
            event: "preExecution",
            source_code: sourceEditor.getValue(),
            language_id: languageId,
            flavor: flavor,
            stdin: stdinEditor.getValue(),
            compiler_options: compilerOptions,
            command_line_arguments: commandLineArguments
        })), "*");

        timeStart = performance.now();
        $.ajax({
            url: `${AUTHENTICATED_BASE_URL[flavor]}/submissions?base64_encoded=true&wait=false`,
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify(data),
            headers: AUTH_HEADERS,
            success: function (data, textStatus, request) {
                console.log(`Your submission token is: ${data.token}`);
                let region = request.getResponseHeader('X-Judge0-Region');
                setTimeout(fetchSubmission.bind(null, flavor, region, data.token, 1), INITIAL_WAIT_TIME_MS);
            },
            error: handleRunError
        });
    }

    if (languageId === 82) {
        if (!sqliteAdditionalFiles) {
            $.ajax({
                url: `./data/additional_files_zip_base64.txt`,
                contentType: "text/plain",
                success: function (responseData) {
                    sqliteAdditionalFiles = responseData;
                    data["additional_files"] = sqliteAdditionalFiles;
                    sendRequest(data);
                },
                error: handleRunError
            });
        }
        else {
            data["additional_files"] = sqliteAdditionalFiles;
            sendRequest(data);
        }
    } else {
        sendRequest(data);
    }
}

function fetchSubmission(flavor, region, submission_token, iteration) {
    if (iteration >= MAX_PROBE_REQUESTS) {
        handleRunError({
            statusText: "Maximum number of probe requests reached.",
            status: 504
        }, null, null);
        return;
    }

    $.ajax({
        url: `${UNAUTHENTICATED_BASE_URL[flavor]}/submissions/${submission_token}?base64_encoded=true`,
        headers: {
            "X-Judge0-Region": region
        },
        success: function (data) {
            if (data.status.id <= 2) { // In Queue or Processing
                $statusLine.html(data.status.description);
                setTimeout(fetchSubmission.bind(null, flavor, region, submission_token, iteration + 1), WAIT_TIME_FUNCTION(iteration));
            } else {
                handleResult(data);
            }
        },
        error: handleRunError
    });
}

function setSourceCodeName(name) {
    $(".lm_title")[0].innerText = name;
}

function getSourceCodeName() {
    return $(".lm_title")[0].innerText;
}

function openFile(content, filename) {
    clear();
    sourceEditor.setValue(content);
    selectLanguageForExtension(filename.split(".").pop());
    setSourceCodeName(filename);
}

function saveFile(content, filename) {
    const blob = new Blob([content], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

async function openAction() {
    if (usePuter()) {
        gPuterFile = await puter.ui.showOpenFilePicker();
        openFile(await (await gPuterFile.read()).text(), gPuterFile.name);
    } else {
        document.getElementById("open-file-input").click();
    }
}

async function saveAction() {
    if (usePuter()) {
        if (gPuterFile) {
            gPuterFile.write(sourceEditor.getValue());
        } else {
            gPuterFile = await puter.ui.showSaveFilePicker(sourceEditor.getValue(), getSourceCodeName());
            setSourceCodeName(gPuterFile.name);
        }
    } else {
        saveFile(sourceEditor.getValue(), getSourceCodeName());
    }
}

function setFontSizeForAllEditors(fontSize) {
    sourceEditor.updateOptions({ fontSize: fontSize });
    stdinEditor.updateOptions({ fontSize: fontSize });
    stdoutEditor.updateOptions({ fontSize: fontSize });
}

async function loadLangauges() {
    return new Promise((resolve, reject) => {
        let options = [];

        $.ajax({
            url: UNAUTHENTICATED_CE_BASE_URL + "/languages",
            success: function (data) {
                for (let i = 0; i < data.length; i++) {
                    let language = data[i];
                    let option = new Option(language.name, language.id);
                    option.setAttribute("flavor", CE);
                    option.setAttribute("langauge_mode", getEditorLanguageMode(language.name));

                    if (language.id !== 89) {
                        options.push(option);
                    }

                    if (language.id === DEFAULT_LANGUAGE_ID) {
                        option.selected = true;
                    }
                }
            },
            error: reject
        }).always(function () {
            $.ajax({
                url: UNAUTHENTICATED_EXTRA_CE_BASE_URL + "/languages",
                success: function (data) {
                    for (let i = 0; i < data.length; i++) {
                        let language = data[i];
                        let option = new Option(language.name, language.id);
                        option.setAttribute("flavor", EXTRA_CE);
                        option.setAttribute("langauge_mode", getEditorLanguageMode(language.name));

                        if (options.findIndex((t) => (t.text === option.text)) === -1 && language.id !== 89) {
                            options.push(option);
                        }
                    }
                },
                error: reject
            }).always(function () {
                options.sort((a, b) => a.text.localeCompare(b.text));
                $selectLanguage.append(options);
                resolve();
            });
        });
    });
};

async function loadSelectedLanguage(skipSetDefaultSourceCodeName = false) {
    monaco.editor.setModelLanguage(sourceEditor.getModel(), $selectLanguage.find(":selected").attr("langauge_mode"));

    if (!skipSetDefaultSourceCodeName) {
        setSourceCodeName((await getSelectedLanguage()).source_file);
    }
}

function selectLanguageByFlavorAndId(languageId, flavor) {
    let option = $selectLanguage.find(`[value=${languageId}][flavor=${flavor}]`);
    if (option.length) {
        option.prop("selected", true);
        $selectLanguage.trigger("change", { skipSetDefaultSourceCodeName: true });
    }
}

function selectLanguageForExtension(extension) {
    let language = getLanguageForExtension(extension);
    selectLanguageByFlavorAndId(language.language_id, language.flavor);
}

async function getLanguage(flavor, languageId) {
    return new Promise((resolve, reject) => {
        if (languages[flavor] && languages[flavor][languageId]) {
            resolve(languages[flavor][languageId]);
            return;
        }

        $.ajax({
            url: `${UNAUTHENTICATED_BASE_URL[flavor]}/languages/${languageId}`,
            success: function (data) {
                if (!languages[flavor]) {
                    languages[flavor] = {};
                }

                languages[flavor][languageId] = data;
                resolve(data);
            },
            error: reject
        });
    });
}

function setDefaults() {
    setFontSizeForAllEditors(fontSize);
    sourceEditor.setValue(DEFAULT_SOURCE);
    stdinEditor.setValue(DEFAULT_STDIN);
    $compilerOptions.val(DEFAULT_COMPILER_OPTIONS);
    $commandLineArguments.val(DEFAULT_CMD_ARGUMENTS);

    $statusLine.html("");

    loadSelectedLanguage();
}

function clear() {
    sourceEditor.setValue("");
    stdinEditor.setValue("");
    $compilerOptions.val("");
    $commandLineArguments.val("");

    $statusLine.html("");
}

function refreshSiteContentHeight() {
    const navigationHeight = document.getElementById("judge0-site-navigation").offsetHeight;

    const siteContent = document.getElementById("judge0-site-content");
    siteContent.style.height = `${window.innerHeight}px`;
    siteContent.style.paddingTop = `${navigationHeight}px`;
}

function refreshLayoutSize() {
    refreshSiteContentHeight();
    layout.updateSize();
}

window.addEventListener("resize", refreshLayoutSize);
document.addEventListener("DOMContentLoaded", async function () {
    $(".ui.selection.dropdown").dropdown();
    $("[data-content]").popup({
        lastResort: "left center"
    });

    refreshSiteContentHeight();

    console.log("Hey, Judge0 IDE is open-sourced: https://github.com/judge0/ide. Have fun!");

    $selectLanguage = $("#select-language");
    $selectLanguage.change(function (event, data) {
        let skipSetDefaultSourceCodeName = (data && data.skipSetDefaultSourceCodeName) || !!gPuterFile;
        loadSelectedLanguage(skipSetDefaultSourceCodeName);
    });

    await loadLangauges();

    $compilerOptions = $("#compiler-options");
    $commandLineArguments = $("#command-line-arguments");

    $runBtn = $("#run-btn");
    $runBtn.click(run);

    $("#open-file-input").change(function (e) {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            const reader = new FileReader();
            reader.onload = function (e) {
                openFile(e.target.result, selectedFile.name);
            };

            reader.onerror = function (e) {
                showError("Error", "Error reading file: " + e.target.error);
            };

            reader.readAsText(selectedFile);
        }
    });

    $statusLine = $("#judge0-status-line");

    $(document).on("keydown", "body", function (e) {
        if (e.metaKey || e.ctrlKey) {
            switch (e.key) {
                case "Enter":
                    e.preventDefault();
                    run();
                    break;
                case "s":
                    e.preventDefault();
                    saveAction();
                    break;
                case "o":
                    e.preventDefault();
                    openAction();
                    break;
                case "+":
                case "=":
                    e.preventDefault();
                    fontSize += 1;
                    setFontSizeForAllEditors(fontSize);
                    break;
                case "-":
                    e.preventDefault();
                    fontSize -= 1;
                    setFontSizeForAllEditors(fontSize);
                    break;
                case "0":
                    e.preventDefault();
                    fontSize = 13;
                    setFontSizeForAllEditors(fontSize);
                    break;
                case "`":
                    e.preventDefault();
                    sourceEditor.focus();
                    break;
            }
        }
    });

    require(["vs/editor/editor.main"], function (ignorable) {
        layout = new GoldenLayout(layoutConfig, $("#judge0-site-content"));

        layout.registerComponent("source", function (container, state) {
            const editorConfig = {
                automaticLayout: true,
                scrollBeyondLastLine: true,
                readOnly: state.readOnly,
                language: "cpp",
                fontFamily: "JetBrains Mono",
                minimap: {
                    enabled: true
                },
                inlineCompletionsOptions: {
                    enabled: true,
                    showToolbar: 'always',
                    mode: 'subword'
                },
                suggest: {
                    preview: true,
                    showStatusBar: true,
                    showInlineDetails: true,
                    snippetsPreventQuickSuggestions: false,
                    showIcons: true,
                    showMethods: true,
                    showFunctions: true,
                    showConstructors: true,
                    filterGraceful: false,
                    localityBonus: true,
                    shareSuggestSelections: true,
                    previewMode: 'prefix',
                    insertMode: 'insert',
                    snippetSuggestions: 'inline',
                    suggestOnTriggerCharacters: true,
                    acceptSuggestionOnEnter: 'on',
                    selectionMode: 'always',
                    showDeprecated: false,
                    matchOnWordStartOnly: false,
                    maxVisibleSuggestions: 12,
                    hideSuggestionsOnType: false
                },
                quickSuggestions: {
                    other: "on",
                    comments: "on",
                    strings: "on"
                },
                parameterHints: {
                    enabled: true,
                    cycle: true
                },
                hover: {
                    enabled: true,
                    delay: 300
                },
                tabCompletion: 'on',
                wordBasedSuggestions: 'matchingDocuments',
                suggestSelection: 'first',
                suggestFontSize: 14,
                suggestLineHeight: 24,
            };
            function createStandardEditor() {
                const editor = monaco.editor.create(container.getElement()[0], editorConfig);
                
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, run);
                currentEditorType = 'standard';

                // Register the inline suggestions provider with the required freeInlineCompletions method
                let debounceTimeout = null;
                const debounce = (fn, delay) => {
                    return (...args) => {
                        return new Promise((resolve) => {
                            if (debounceTimeout) {
                                clearTimeout(debounceTimeout);
                            }
                            // Shorter delay while actively typing
                            const currentDelay = args[0].isTyping ? 500 : delay;
                            debounceTimeout = setTimeout(async () => {
                                resolve(await fn(...args));
                            }, currentDelay);
                        });
                    };
                };

                const getCompletion = debounce(async (model, position, context) => {
                    try {
                        // Get surrounding context (5 lines before and after)
                        let contextLines = [];
                        const startLine = Math.max(1, position.lineNumber - 5);
                        const endLine = Math.min(model.getLineCount(), position.lineNumber + 5);
                        
                        for (let i = startLine; i <= endLine; i++) {
                            const line = model.getLineContent(i).trim();
                            if (line) {
                                contextLines.push(line);
                            }
                        }
                        
                        const context = contextLines.join('\n');

                        // Get the current line's content up to the cursor
                        const currentLineContent = model.getLineContent(position.lineNumber)
                            .substring(0, position.column - 1);

                        // Track if user is actively typing
                        const isTyping = context.lastModifiedTime && 
                            (Date.now() - context.lastModifiedTime < 1000);

                        // Call OpenRouter API for code completion
                        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + window.appConfig?.OPENROUTER_API_KEY,
                                'HTTP-Referer': window.location.href,
                                'X-Title': 'Judge0 Autocomplete'
                            },
                            body: JSON.stringify({
                                model: 'google/gemini-2.0-flash-lite-preview-02-05:free',
                                messages: [
                                    {
                                        role: 'system',
                                        content: `You are a code completion assistant. Complete the code based on the current context and partial input. 
                                        If the user is actively typing (${isTyping}), provide shorter, partial completions.
                                        Focus on completing the current statement or block. Do not repeat existing code. Do not include markdown code fences or any language of the code. Just provide the raw code completion suggestions. For example, if the code is in C++, do not include the language of the code. Just provide the raw code completion suggestions. Also do not include the /\`\`\`/ or \`\`\` language of the code. Just provide the raw code completion suggestions. Do not repeat existing code.`
                                    },
                                    {
                                        role: 'user',
                                        content: `Complete this line of code: ${currentLineContent}
                                        Context:\n${context}`
                                    }
                                ],
                                temperature: isTyping ? 0.3 : 0.7, // Lower temperature while typing for more focused completions
                                max_tokens: isTyping ? 20 : 50    // Shorter completions while typing
                            })
                        });

                        return await response.json();
                    } catch (error) {
                        console.error('Error getting completion:', error);
                        return null;
                    }
                }, 2000); // 2 second default debounce

                const disposable = monaco.languages.registerInlineCompletionsProvider('*', {
                    async provideInlineCompletions(model, position, context, token) {
                        try {
                            const data = await getCompletion(model, position, context);
                            if (!data) {
                                return { items: [], dispose: () => {} };
                            }

                            let completion = data.choices[0]?.message?.content || '';

                            if (!completion) {
                                console.log("No completion found");
                                return { items: [], dispose: () => {} };
                            }

                            // Clean up the completion output
                            completion = completion
                                .replace(/```.*?\n/g, '') // Remove opening code fence with language
                                .replace(/```/g, '')      // Remove closing code fence
                                .replace(/^\s+|\s+$/g, ''); // Trim whitespace

                            // Get the current line's content up to the cursor
                            const currentLineContent = model.getLineContent(position.lineNumber)
                                .substring(0, position.column - 1);

                            // If the current line already contains the start of the completion,
                            // remove it from the completion to avoid duplication
                            if (completion.startsWith(currentLineContent.trim())) {
                                completion = completion.substring(currentLineContent.trim().length);
                            }
                            

                            const range = {
                                startLineNumber: position.lineNumber,
                                startColumn: position.column,
                                endLineNumber: position.lineNumber,
                                endColumn: position.column + completion.length
                            };

                            console.log("Providing completion:", {
                                completion,
                                context,
                                range,
                                position: {
                                    lineNumber: position.lineNumber,
                                    column: position.column
                                }
                            });

                            return {
                                items: [{
                                    insertText: completion,
                                    range: range
                                }],
                                dispose: () => {}
                            };
                        } catch (error) {
                            console.error('Error getting inline completions:', error);
                            return { items: [], dispose: () => {} };
                        }
                    },
                    
                    freeInlineCompletions(completions) {
                        if (completions?.dispose) {
                            completions.dispose();
                        }
                    }
                });

                editor.onDidDispose(() => {
                    disposable.dispose();
                });

                return editor;
            }

            function createDiffEditor() {
                const editor = monaco.editor.createDiffEditor(container.getElement()[0], {
                    automaticLayout: true,
                    scrollBeyondLastLine: true,
                    fontFamily: "JetBrains Mono",
                    minimap: {
                        enabled: false
                    },
                    enableSplitViewResizing: true,
                    renderOverviewRuler: false,
                    renderSideBySide: false,
                    diffCodeLens: true,
                    diffWordWrap: "off",
                    readOnly: false
                });
                currentEditorType = 'diff';
                return editor;
            }

            // Initial creation of standard editor
            sourceEditor = createStandardEditor();

            // Export these methods to be used globally
            window.editorUtils = {
                switchToDiffEditor: (originalCode, modifiedCode, language) => {
                    if (sourceEditor) {
                        sourceEditor.dispose();
                    }
                    sourceEditor = createDiffEditor();
                    
                    const originalModel = monaco.editor.createModel(originalCode, language);
                    const modifiedModel = monaco.editor.createModel(modifiedCode, language);
                    
                    originalModel.updateOptions({ readOnly: true });
                    modifiedModel.updateOptions({ readOnly: true });
                    
                    sourceEditor.setModel({
                        original: originalModel,
                        modified: modifiedModel
                    });

                    // Setup diff editor UI components (buttons, etc.)
                    setupDiffEditorUI(container.getElement()[0], originalModel, modifiedModel);
                    
                    return sourceEditor.getModifiedEditor();
                },

                switchToStandardEditor: (content, language) => {
                    if (sourceEditor) {
                        // If it's a diff editor, we need to dispose of both models
                        if (currentEditorType === 'diff') {
                            const models = sourceEditor.getModel();
                            if (models) {
                                models.original.dispose();
                                models.modified.dispose();
                            }
                        }
                        sourceEditor.dispose();
                    }
                    
                    sourceEditor = createStandardEditor();
                    
                    if (content) {
                        sourceEditor.setValue(content);
                    }
                    if (language) {
                        const languageMode = getEditorLanguageMode(language.name);
                        monaco.editor.setModelLanguage(sourceEditor.getModel(), languageMode);
                    }
                    
                    return sourceEditor;
                },

                getCurrentEditor: () => {
                    if (currentEditorType === 'diff') {
                        return sourceEditor.getModifiedEditor();
                    }
                    return sourceEditor;
                }
            };
        });

        layout.registerComponent("stdin", function (container, state) {
            stdinEditor = monaco.editor.create(container.getElement()[0], {
                automaticLayout: true,
                scrollBeyondLastLine: false,
                readOnly: state.readOnly,
                language: "plaintext",
                fontFamily: "JetBrains Mono",
                minimap: {
                    enabled: false
                }
            });
        });

        layout.registerComponent("stdout", function (container, state) {
            stdoutEditor = monaco.editor.create(container.getElement()[0], {
                automaticLayout: true,
                scrollBeyondLastLine: false,
                readOnly: state.readOnly,
                language: "plaintext",
                fontFamily: "JetBrains Mono",
                minimap: {
                    enabled: false
                }
            });
        });

        layout.registerComponent("ai", function (container, state) {
            const initChat = async () => {
                try {
                    await loadLangauges();
                    const language = await getSelectedLanguage();
                    
                    if (language) {
                        // Create a function to get the latest context
                        const getLatestContext = () => ({
                            language: language,
                            sourceCode: window.editorUtils.getCurrentEditor().getValue(),
                            stdin: stdinEditor.getValue(),
                            stdout: stdoutEditor.getValue(),
                        });
                        
                        const requestBody = {
                            system: {
                                "role": "system",
                                "content": "You are a helpful coding assistant. You help users understand and debug their code."
                            }
                        };
                        
                        // Pass the getLatestContext function instead of a static context
                        const chatComponent = createChatComponent('ai', getLatestContext, requestBody);
                        
                        if (chatComponent) {
                            container.getElement()[0].appendChild(chatComponent);
                        }
                    }
                } catch (error) {
                    console.error("Error initializing chat:", error);
                }
            };

            layout.on("initialised", initChat);
        });

        layout.registerComponent("composer", function (container, state) {
            const initComposer = async () => {
                try {
                    await loadLangauges();
                    const language = await getSelectedLanguage();
                    const languageMode = getEditorLanguageMode(language.name);
                    
                    if (language) {
                        // Create a function to get the latest context, similar to AI component
                        const getContext = () => ({
                            language: language,
                            languageMode: languageMode,
                            sourceCode: window.editorUtils.getCurrentEditor().getValue(),
                            stdin: stdinEditor.getValue(),
                            stdout: stdoutEditor.getValue(),
                        });

                        const requestBody = {
                            system: {
                                role: "system",
                                content: `You are an expert coder. You help users understand and debug their code. We are going to try to fix the code and make it work. We will give you the code and the error message. You will be given the source code, input, and output. You will then give us the fixed code. Please return it as a working version of the source cod in raw code format. If there is an explanation for the changes please provide the explanation of the code changes AFTER the raw code.
                                There should be 2 sections of response. The first section should be the raw code. The second section should be the explanation of the code changes. Let's think step by step. Verify your changes.
                                

                                Raw code portion:
                                - You must maintain the layout of the file especially in languages/formats where it matters
                                - Do NOT include markdown code fences (\`\`\`) 
                                - Do NOT include \"Here is the updated content...\" or similar phrases
                                - DO NOT include non-code content without explicitly commenting it out
                                - Make sure the raw code only contains the code and nothing else.
                                - ${language} is the language of the code. The editor that that the output is in is ${languageMode}.
                                
                                Explanation portion:
                                - Keep code explanations concise and to the point.
                                - If there are multiple changes, you can list out the changes in a list.
                                - Make sure that the explanation is NOT in code format. It should be in some sort of text format 
                                It should not be inbetween code blocks.
                                If you are not sure, ask the user for clarification.`
                            }
                        };

                        const chatComponent = createChatComponent('composer', getContext, requestBody);
                        if (chatComponent) {
                            container.getElement()[0].appendChild(chatComponent);
                        }
                    }
                } catch (error) {
                    console.error("Error initializing composer:", error);
                }
            };

            layout.on("initialised", initComposer);
        });

        layout.on("initialised", function () {
            setDefaults();
            refreshLayoutSize();
            window.top.postMessage({ event: "initialised" }, "*");
        });

        layout.init();
    });

    let superKey = "⌘";
    if (!/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform)) {
        superKey = "Ctrl";
    }

    [$runBtn].forEach(btn => {
        btn.attr("data-content", `${superKey}${btn.attr("data-content")}`);
    });

    document.querySelectorAll(".description").forEach(e => {
        e.innerText = `${superKey}${e.innerText}`;
    });

    if (usePuter()) {
        puter.ui.onLaunchedWithItems(async function (items) {
            gPuterFile = items[0];
            openFile(await (await gPuterFile.read()).text(), gPuterFile.name);
        });
    }

    document.getElementById("judge0-open-file-btn").addEventListener("click", openAction);
    document.getElementById("judge0-save-btn").addEventListener("click", saveAction);

    window.onmessage = function (e) {
        if (!e.data) {
            return;
        }

        if (e.data.action === "get") {
            window.top.postMessage(JSON.parse(JSON.stringify({
                event: "getResponse",
                source_code: sourceEditor.getValue(),
                language_id: getSelectedLanguageId(),
                flavor: getSelectedLanguageFlavor(),
                stdin: stdinEditor.getValue(),
                stdout: stdoutEditor.getValue(),
                compiler_options: $compilerOptions.val(),
                command_line_arguments: $commandLineArguments.val()
            })), "*");
        } else if (e.data.action === "set") {
            if (e.data.source_code) {
                sourceEditor.setValue(e.data.source_code);
            }
            if (e.data.language_id && e.data.flavor) {
                selectLanguageByFlavorAndId(e.data.language_id, e.data.flavor);
            }
            if (e.data.stdin) {
                stdinEditor.setValue(e.data.stdin);
            }
            if (e.data.stdout) {
                stdoutEditor.setValue(e.data.stdout);
            }
            if (e.data.compiler_options) {
                $compilerOptions.val(e.data.compiler_options);
            }
            if (e.data.command_line_arguments) {
                $commandLineArguments.val(e.data.command_line_arguments);
            }
            if (e.data.api_key) {
                AUTH_HEADERS["Authorization"] = `Bearer ${e.data.api_key}`;
            }
        }
    };
});

const DEFAULT_SOURCE = "\
#include <algorithm>\n\
#include <cstdint>\n\
#include <iostream>\n\
#include <limits>\n\
#include <set>\n\
#include <utility>\n\
#include <vector>\n\
\n\
using Vertex    = std::uint16_t;\n\
using Cost      = std::uint16_t;\n\
using Edge      = std::pair< Vertex, Cost >;\n\
using Graph     = std::vector< std::vector< Edge > >;\n\
using CostTable = std::vector< std::uint64_t >;\n\
\n\
constexpr auto kInfiniteCost{ std::numeric_limits< CostTable::value_type >::max() };\n\
\n\
auto dijkstra( Vertex const start, Vertex const end, Graph const & graph, CostTable & costTable )\n\
{\n\
    std::fill( costTable.begin(), costTable.end(), kInfiniteCost );\n\
    costTable[ start ] = 0;\n\
\n\
    std::set< std::pair< CostTable::value_type, Vertex > > minHeap;\n\
    minHeap.emplace( 0, start );\n\
\n\
    while ( !minHeap.empty() )\n\
    {\n\
        auto const vertexCost{ minHeap.begin()->first  };\n\
        auto const vertex    { minHeap.begin()->second };\n\
\n\
        minHeap.erase( minHeap.begin() );\n\
\n\
        if ( vertex == end )\n\
        {\n\
            break;\n\
        }\n\
\n\
        for ( auto const & neighbourEdge : graph[ vertex ] )\n\
        {\n\
            auto const & neighbour{ neighbourEdge.first };\n\
            auto const & cost{ neighbourEdge.second };\n\
\n\
            if ( costTable[ neighbour ] > vertexCost + cost )\n\
            {\n\
                minHeap.erase( { costTable[ neighbour ], neighbour } );\n\
                costTable[ neighbour ] = vertexCost + cost;\n\
                minHeap.emplace( costTable[ neighbour ], neighbour );\n\
            }\n\
        }\n\
    }\n\
\n\
    return costTable[ end ];\n\
}\n\
\n\
int main()\n\
{\n\
    constexpr std::uint16_t maxVertices{ 10000 };\n\
\n\
    Graph     graph    ( maxVertices );\n\
    CostTable costTable( maxVertices );\n\
\n\
    std::uint16_t testCases;\n\
    std::cin >> testCases;\n\
\n\
    while ( testCases-- > 0 )\n\
    {\n\
        for ( auto i{ 0 }; i < maxVertices; ++i )\n\
        {\n\
            graph[ i ].clear();\n\
        }\n\
\n\
        std::uint16_t numberOfVertices;\n\
        std::uint16_t numberOfEdges;\n\
\n\
        std::cin >> numberOfVertices >> numberOfEdges;\n\
\n\
        for ( auto i{ 0 }; i < numberOfEdges; ++i )\n\
        {\n\
            Vertex from;\n\
            Vertex to;\n\
            Cost   cost;\n\
\n\
            std::cin >> from >> to >> cost;\n\
            graph[ from ].emplace_back( to, cost );\n\
        }\n\
\n\
        Vertex start;\n\
        Vertex end;\n\
\n\
        std::cin >> start >> end;\n\
\n\
        auto const result{ dijkstra( start, end, graph, costTable ) };\n\
\n\
        if ( result == kInfiniteCost )\n\
        {\n\
            std::cout << \"NO\\n\";\n\
        }\n\
        else\n\
        {\n\
            std::cout << result << '\\n';\n\
        }\n\
    }\n\
\n\
    return 0;\n\
}\n\
";

const DEFAULT_STDIN = "\
3\n\
3 2\n\
1 2 5\n\
2 3 7\n\
1 3\n\
3 3\n\
1 2 4\n\
1 3 7\n\
2 3 1\n\
1 3\n\
3 1\n\
1 2 4\n\
1 3\n\
";

const DEFAULT_COMPILER_OPTIONS = "";
const DEFAULT_CMD_ARGUMENTS = "";
const DEFAULT_LANGUAGE_ID = 105; // C++ (GCC 14.1.0) (https://ce.judge0.com/languages/105)

function getEditorLanguageMode(languageName) {
    const DEFAULT_EDITOR_LANGUAGE_MODE = "plaintext";
    const LANGUAGE_NAME_TO_LANGUAGE_EDITOR_MODE = {
        "Bash": "shell",
        "C": "c",
        "C3": "c",
        "C#": "csharp",
        "C++": "cpp",
        "Clojure": "clojure",
        "F#": "fsharp",
        "Go": "go",
        "Java": "java",
        "JavaScript": "javascript",
        "Kotlin": "kotlin",
        "Objective-C": "objective-c",
        "Pascal": "pascal",
        "Perl": "perl",
        "PHP": "php",
        "Python": "python",
        "R": "r",
        "Ruby": "ruby",
        "SQL": "sql",
        "Swift": "swift",
        "TypeScript": "typescript",
        "Visual Basic": "vb"
    }

    for (let key in LANGUAGE_NAME_TO_LANGUAGE_EDITOR_MODE) {    
        if (languageName?.toLowerCase().startsWith(key?.toLowerCase())) {
            return LANGUAGE_NAME_TO_LANGUAGE_EDITOR_MODE[key];
        }
    }
    return DEFAULT_EDITOR_LANGUAGE_MODE;
}

const EXTENSIONS_TABLE = {
    "asm": { "flavor": CE, "language_id": 45 }, // Assembly (NASM 2.14.02)
    "c": { "flavor": CE, "language_id": 103 }, // C (GCC 14.1.0)
    "cpp": { "flavor": CE, "language_id": 105 }, // C++ (GCC 14.1.0)
    "cs": { "flavor": EXTRA_CE, "language_id": 29 }, // C# (.NET Core SDK 7.0.400)
    "go": { "flavor": CE, "language_id": 95 }, // Go (1.18.5)
    "java": { "flavor": CE, "language_id": 91 }, // Java (JDK 17.0.6)
    "js": { "flavor": CE, "language_id": 102 }, // JavaScript (Node.js 22.08.0)
    "lua": { "flavor": CE, "language_id": 64 }, // Lua (5.3.5)
    "pas": { "flavor": CE, "language_id": 67 }, // Pascal (FPC 3.0.4)
    "php": { "flavor": CE, "language_id": 98 }, // PHP (8.3.11)
    "py": { "flavor": EXTRA_CE, "language_id": 25 }, // Python for ML (3.11.2)
    "r": { "flavor": CE, "language_id": 99 }, // R (4.4.1)
    "rb": { "flavor": CE, "language_id": 72 }, // Ruby (2.7.0)
    "rs": { "flavor": CE, "language_id": 73 }, // Rust (1.40.0)
    "scala": { "flavor": CE, "language_id": 81 }, // Scala (2.13.2)
    "sh": { "flavor": CE, "language_id": 46 }, // Bash (5.0.0)
    "swift": { "flavor": CE, "language_id": 83 }, // Swift (5.2.3)
    "ts": { "flavor": CE, "language_id": 101 }, // TypeScript (5.6.2)
    "txt": { "flavor": CE, "language_id": 43 }, // Plain Text
};

function getLanguageForExtension(extension) {
    return EXTENSIONS_TABLE[extension] || { "flavor": CE, "language_id": 43 }; // Plain Text (https://ce.judge0.com/languages/43)
}

function setupDiffEditorUI(container, originalModel, modifiedModel) {
    // Add styles to head if not already present
    if (!document.getElementById('diff-editor-styles')) {
        const style = document.createElement('style');
        style.id = 'diff-editor-styles';
        style.textContent = `
            .diff-actions-container {
                position: absolute;
                top: 10px;
                right: 20px;
                z-index: 1000;
                display: flex;
                gap: 8px;
                background: rgba(255, 255, 255, 0.9);
                padding: 8px;
                border-radius: 4px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.2);
            }
            .diff-action-btn {
                padding: 6px 12px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 500;
                transition: background-color 0.2s;
            }
            .diff-action-btn.accept {
                background-color: #28a745;
                color: white;
            }
            .diff-action-btn.accept:hover {
                background-color: #218838;
            }
            .diff-action-btn.reject {
                background-color: #dc3545;
                color: white;
            }
            .diff-action-btn.reject:hover {
                background-color: #c82333;
            }

        `;
        document.head.appendChild(style);
    }

    // Create actions container with improved visibility
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'diff-actions-container';
    container.appendChild(actionsContainer);

    // Add accept button
    const acceptButton = document.createElement('button');
    acceptButton.textContent = 'Accept All Changes';
    acceptButton.className = 'diff-action-btn accept';
    acceptButton.onclick = () => {
        const modifiedCode = modifiedModel.getValue();
        window.editorUtils.switchToStandardEditor(modifiedCode, modifiedModel.getLanguageId());
        actionsContainer.remove();
    };

    // Add reject button
    const rejectButton = document.createElement('button');
    rejectButton.textContent = 'Reject All Changes';
    rejectButton.className = 'diff-action-btn reject';
    rejectButton.onclick = () => {
        const originalCode = originalModel.getValue();
        window.editorUtils.switchToStandardEditor(originalCode, originalModel.getLanguageId());
        actionsContainer.remove();
    };

    actionsContainer.appendChild(acceptButton);
    actionsContainer.appendChild(rejectButton);
}
