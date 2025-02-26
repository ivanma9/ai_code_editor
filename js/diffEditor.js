export async function createDiffEditor(originalCode, modifiedCode, language, codeBlockContainer) {
    // Create a native div element instead of jQuery
    const diffContainer = document.createElement('div');
    diffContainer.className = 'code-block-content';
    diffContainer.style.height = '300px';
    diffContainer.style.position = 'relative';

    let originalModel, modifiedModel;
    try {
        originalModel = monaco.editor.createModel(originalCode, language);
        modifiedModel = monaco.editor.createModel(modifiedCode, language);
    } catch (error) {
        console.error("Error creating diff editor models:", error);
        throw error;
    }

    const diffEditor = monaco.editor.createDiffEditor(diffContainer, {
        renderSideBySide: true,
        readOnly: true,
        minimap: { enabled: false },
        automaticLayout: true,
        fontSize: 14
    });

    // Add apply button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'diff-apply-button';
    buttonContainer.style.position = 'absolute';
    buttonContainer.style.top = '5px';
    buttonContainer.style.right = '5px';
    buttonContainer.style.zIndex = '100';

    const applyButton = document.createElement('button');
    applyButton.textContent = 'Apply Changes';
    applyButton.className = 'diff-apply-btn';
    applyButton.onclick = () => {
        const modifiedValue = modifiedModel.getValue();
        if (typeof window.editorUtils !== 'undefined' && window.editorUtils) {
            window.editorUtils.switchToDiffEditor(originalCode, modifiedCode, language);
            
            // remove the apply button
            buttonContainer.remove();
        } else {
            console.error("Editor utils not found - make sure window.editorUtils is globally accessible");
        }
    };

    buttonContainer.appendChild(applyButton);
    diffContainer.appendChild(buttonContainer);

    diffEditor.setModel({
        original: originalModel,
        modified: modifiedModel
    });

    // Wait for diff computation and layout to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const lineChanges = diffEditor.getLineChanges();
    if (lineChanges && lineChanges.length > 0) {
        const firstChange = lineChanges[0];
        diffEditor.revealLineInCenter(firstChange.modifiedStartLineNumber);
        // Force a layout update
        diffEditor.layout();
    }

    // Use native appendChild instead of jQuery append
    codeBlockContainer.appendChild(diffContainer);

    // Add some basic styles
    const style = document.createElement('style');
    style.textContent = `
        .diff-apply-btn {
            background-color: #007acc;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.2s;
        }
        .diff-apply-btn:hover {
            background-color: #005999;
        }
    `;
    document.head.appendChild(style);

    // Return an object with cleanup method if needed
    return {
        dispose: () => {
            originalModel.dispose();
            modifiedModel.dispose();
            diffEditor.dispose();
        }
    };
}