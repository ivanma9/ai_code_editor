import { createDiffEditor } from './diffEditor.js';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';


// model : openrouter model name
const models = {
    "nvidia/llama-3.1-nemotron": "nvidia/llama-3.1-nemotron-70b-instruct:free",
    "microsoft/phi-3": "microsoft/phi-3-mini-128k-instruct:free",
    "google/gemma-2-27b-it": "google/gemini-2.0-flash-thinking-exp:free"
}

export function createChatComponent(id, getContext, requestBody) {

    const language = getContext().language;
    const chatContainer = document.createElement('div');
    chatContainer.id = `chat-container-${id}`;
    chatContainer.className = 'ui segment';
    chatContainer.style.height = '100%';
    chatContainer.style.display = 'flex';
    chatContainer.style.flexDirection = 'column';
    chatContainer.style.margin = '0';
    chatContainer.style.backgroundColor = 'var(--vscode-editor-background)';
    
    // Use the exact HTML structure from index.html
    chatContainer.innerHTML = `
        <div class="ui top attached menu border" style="background: var(--vscode-editor-background);">
            <div class="fitted" style="width: 100%;">
                <select id="judge0-chat-model-select-${id}" class="ui search selection dropdown item text-color-white" style="background: rgba(30, 30, 30, 0.95); width: 100%;">
                    <option>google/gemma-2-27b-it</option>
                    <option>nvidia/llama-3.1-nemotron</option>
                    <option>microsoft/phi-3</option>
                </select>
            </div>
        </div>
        <div id="judge0-chat-messages-${id}" style="flex: 1; overflow-y: auto;"></div>
        <div id="judge0-chat-input-container-${id}" class="ui basic segment" style="margin-bottom: 0;">
            <form id="judge0-chat-form-${id}" class="ui fluid action input">
                <input id="judge0-chat-user-input-${id}" style="background: rgba(50, 50, 50, 0.70); color: white;" type="text">
                <button id="judge0-chat-send-button-${id}" class="ui primary icon button" type="submit">
                    <i class="arrow up icon"></i>
                </button>
            </form>
        </div>
    `;

    // Get form element after it's created in the DOM
    const form = chatContainer.querySelector(`#judge0-chat-form-${id}`);
    const input = chatContainer.querySelector(`#judge0-chat-user-input-${id}`);
    const messagesContainer = chatContainer.querySelector(`#judge0-chat-messages-${id}`);
    const modelSelect = chatContainer.querySelector(`#judge0-chat-model-select-${id}`);

    modelSelect.style.color = 'white';


    // Add event listener for form submission
    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const userInputValue = input.value.trim();
        if (userInputValue === "") {
            return;
        }

        // Get current editor values by calling the context function
        const context = getContext();
        const sourceCode = context.sourceCode;
        const stdin = context.stdin;
        const stdout = context.stdout;

        // Add user message with VS Code-like colors
        const messageDiv = document.createElement('div');
        messageDiv.className = 'ui message';
        messageDiv.style.marginLeft = 'auto';
        messageDiv.style.maxWidth = '80%';
        messageDiv.style.marginBottom = '4px';
        messageDiv.style.backgroundColor = '#007ace'; // Dark gray background
        messageDiv.style.color = '#ffffff'; // White text
        messageDiv.style.border = '1px solid #007aca'; // Blue border (VSCode's signature blue)
        messageDiv.textContent = userInputValue;
        messageDiv.style.fontSize = '12px';
        messagesContainer.appendChild(messageDiv);
        

        // Clear input and scroll to bottom
        input.value = "";
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Prepare context for AI
        const aiContext = {
            sourceCode,
            stdin,
            stdout,
            question: userInputValue,
            selectedModel: modelSelect.value,
            language: language,
            systemPrompt: requestBody.system
        };

        const body = {
            "model": models[aiContext.selectedModel] || "microsoft/phi-3-mini-128k-instruct:free",
            "messages": [
                aiContext.systemPrompt,
                {
                    "role": "user",
                    "content": `Given the following context:
Source code in ${context.language}:
\`\`\`${context.languageMode || 'Unknown'}
${sourceCode}
\`\`\`

Stdin: ${stdin}
Stdout: ${stdout}

Question: ${aiContext.question}`
                }
            ]
        }


        try {
            const data = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${window.getApiKey()}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": window.location.href, // Required by OpenRouter
                    "X-Title": "Judge0 Chat" // Recommended by OpenRouter
                },
                body: JSON.stringify(body)
            });

            const response = await data.json();
            const content = response?.choices[0]?.message?.content || 'Sorry, I encountered an error processing your request.';
            // AI message with VS Code-like colors
            const aiMessage = document.createElement('div');
            aiMessage.className = 'ui message';
            aiMessage.style.marginRight = 'auto';
            aiMessage.style.maxWidth = '80%';
            aiMessage.style.marginBottom = '4px';
            aiMessage.style.backgroundColor = '#3d3d3d';
            aiMessage.style.color = '#ffffff';
            aiMessage.style.border = '1px solid #3d3d3d';
            aiMessage.style.fontSize = '12px';

            // Parse and format the content
            const parts = content.split(/(```[\s\S]*?```)/);
            parts.forEach(part => {
                if (part.startsWith('```')) {
                    // Extract language and code
                    const match = part.match(/```(\w+)?\n([\s\S]*?)```/);
                    if (match) {
                        const [_, language, code] = match;
                        
                        const codeContainer = document.createElement('div');
                        codeContainer.style.height = '200px';
                        
                        // Create Monaco editor for the code
                        const editor = monaco.editor.create(codeContainer, {
                            value: code,
                            language: language || 'plaintext',
                            readOnly: true,
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            fontSize: 10
                        });

                        aiMessage.appendChild(codeContainer);

                        
                        if (id === 'composer') {
                            // Create diff editor for composer, regular editor for others
                            const diffContainer = document.createElement('div');
                            diffContainer.style.height = '300px';
                            diffContainer.style.marginTop = '20px';
                            diffContainer.style.marginBottom = '20px';
                            const diffEditor = createDiffEditor(
                                context.sourceCode,
                                code,
                                language,
                                diffContainer
                            );

                            aiMessage.appendChild(diffContainer);
                        }
                    }
                } else if (part.trim()) {
                    // Use marked to parse regular text
                    const textNode = document.createElement('div');
                    textNode.style.marginBottom = '10px';
                    textNode.style.whiteSpace = 'pre-wrap';
                    textNode.innerHTML = marked.parse(part.trim());
                    aiMessage.appendChild(textNode);
                }
            });

            messagesContainer.appendChild(aiMessage);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } catch (error) {
            const content = `Error: ${error.message}. Please try again.`;

            // AI message with VS Code-like colors
            const aiMessage = document.createElement('div');
            aiMessage.className = 'ui message';
            aiMessage.style.marginRight = 'auto';
            aiMessage.style.maxWidth = '80%';
            aiMessage.style.marginBottom = '4px';
            aiMessage.style.backgroundColor = '#3d3d3d'; // Slightly lighter gray for AI
            aiMessage.style.color = '#ffffff'; // White text
            aiMessage.style.border = '1px solid #3d3d3d'; // Lighter blue border
            aiMessage.textContent = content;
            messagesContainer.appendChild(aiMessage);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    });



    return chatContainer;
}
