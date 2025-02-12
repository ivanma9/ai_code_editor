import { config } from './config.js';

// model : openrouter model name
const models = {
    "gpt-4o-mini": "gpt-4o-mini",
    "nvidia/llama-3.1-nemotron": "nvidia/llama-3.1-nemotron-70b-instruct:free",
    "microsoft/phi-3": "microsoft/phi-3-mini-128k-instruct:free"
}

export function createChatComponent(id, sourceEditor, stdinEditor, stdoutEditor, language) {
    console.log("createChatComponent", id, sourceEditor, stdinEditor, stdoutEditor);
    console.log(sourceEditor.getValue());
    console.log(stdinEditor.getValue());
    console.log(stdoutEditor.getValue());
    console.log(language);
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

        // Get current editor values
        const sourceCode = sourceEditor.getValue();
        const stdin = stdinEditor.getValue();
        const stdout = stdoutEditor.getValue();

        // Add user message with VS Code-like colors
        const messageDiv = document.createElement('div');
        messageDiv.className = 'ui message';
        messageDiv.style.marginLeft = 'auto';
        messageDiv.style.maxWidth = '80%';
        messageDiv.style.marginBottom = '8px';
        messageDiv.style.backgroundColor = '#007ace'; // Dark gray background
        messageDiv.style.color = '#ffffff'; // White text
        messageDiv.style.border = '1px solid #007aca'; // Blue border (VSCode's signature blue)
        messageDiv.textContent = userInputValue;
        messagesContainer.appendChild(messageDiv);

        // Clear input and scroll to bottom
        input.value = "";
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Prepare context for AI
        const context = {
            sourceCode,
            stdin,
            stdout,
            question: userInputValue,
            selectedModel: modelSelect.value,
            language: language
        };

        try {
            console.log(config.OPENROUTER_API_KEY);
            const data = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${config.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": window.location.href, // Required by OpenRouter
                    "X-Title": "Judge0 Chat" // Recommended by OpenRouter
                },
                body: JSON.stringify({
                    "model": "microsoft/phi-3-mini-128k-instruct:free",
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a helpful coding assistant. You help users understand and debug their code."
                        },
                        {
                            "role": "user",
                            "content": `Given the following context:
Source code:
\`\`\`${context.language?.name || 'Unknown'}
${sourceCode}
\`\`\`

Stdin: ${stdin}
Stdout: ${stdout}

Question: ${userInputValue}`
                        }
                    ]
                })
            });

            const response = await data.json();
            const content = response?.choices[0]?.message?.content || 'Sorry, I encountered an error processing your request.';

            // AI message with VS Code-like colors
            const aiMessage = document.createElement('div');
            aiMessage.className = 'ui message';
            aiMessage.style.marginRight = 'auto';
            aiMessage.style.maxWidth = '80%';
            aiMessage.style.marginBottom = '8px';
            aiMessage.style.backgroundColor = '#3d3d3d'; // Slightly lighter gray for AI
            aiMessage.style.color = '#ffffff'; // White text
            aiMessage.style.border = '1px solid #3d3d3d'; // Lighter blue border
            aiMessage.textContent = content;
            messagesContainer.appendChild(aiMessage);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } catch (error) {
            const content = `Error: ${error.message}. Please try again.`;

            // AI message with VS Code-like colors
            const aiMessage = document.createElement('div');
            aiMessage.className = 'ui message';
            aiMessage.style.marginRight = 'auto';
            aiMessage.style.maxWidth = '80%';
            aiMessage.style.marginBottom = '8px';
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
