import * as monaco from 'monaco-editor';

const editor = monaco.editor.create(document.getElementById('container'), {
    value: `function x() {
    console.log('Hello world!');
    
    console.log('Goodbye world!');
}`,
    language: 'javascript'
});
window.editor = editor;

let cursorIndex = 0;

const widgets = [];
let widgetId = 0;
let pauseHandleChanges = false;

createWidgets();
collapseWidgets();

editor.onDidChangeModelContent(() => {
    if (pauseHandleChanges) return;

    let content = editor.getValue();
    const cursorPosition = editor.getPosition();

    widgets.forEach(widget => {
        if (widget.isActive) {
            editor.removeContentWidget(widget);

            // expand the widget text
            const { actualText, replaceText } = widget;
            let [rangeStart] = widget.range;
            content = content.slice(0, rangeStart) + actualText + content.slice(rangeStart + replaceText.length);
        }
    });
    widgets.length = 0;

    pauseHandleChanges = true;
    editor.setValue(content);
    editor.setPosition(cursorPosition);
    pauseHandleChanges = false;

    createWidgets();

    collapseWidgets();
});

function createWidgets() {
    const logs = editor.getValue().matchAll(/console\.log\(('|").*?('|")\)/g);
    let log = logs.next();
    let cursorOffset = 0;
    while (log.done === false) {
        const match = log.value[0];
        const index = log.value.index;

        const rangeStart = index - cursorOffset;
        const rangeEnd = rangeStart + match.length;

        const myWidgetId = (widgetId++).toString();
        const myPosition = editor.getModel().getPositionAt(index);
        const range = [index, match.length];
        const isCursored = cursorIndex > rangeStart && cursorIndex < rangeEnd;
        const isActive = !isCursored;

        const replaceText = 'console.log';

        const widget = {
            allowEditorOverflow: true,
            suppressMouseDown: true,
            getId() {
                return myWidgetId;
            },
            getDomNode() {
                const node = document.createElement('div');
                node.innerText = replaceText;
                node.className = 'widget';
                return node;
            },
            getPosition() {
                return {
                    position: myPosition,
                    preference: [monaco.editor.ContentWidgetPositionPreference.EXACT],
                }
            },

            // custom values
            isActive,
            range,
            actualText: match,
            replaceText,
        }

        if (isActive) editor.addContentWidget(widget);
        widgets.push(widget);

        cursorOffset += widget.actualText.length - widget.replaceText.length;

        log = logs.next();
    }
}

editor.onDidChangeCursorPosition(({ position, reason }) => {
    if (reason !== 3) return; // 3 = CursorChangeReason.Explicit user action
    if (pauseHandleChanges) return;

    cursorIndex = editor.getModel().getOffsetAt(position);
    let offsetOffset = 0;

    widgets.forEach(widget => {
        const { actualText, replaceText } = widget;
        let [rangeStart, rangeLength] = widget.range;

        rangeStart -= offsetOffset;

        const isCursoredActive = cursorIndex > rangeStart && cursorIndex < rangeStart + replaceText.length;
        const isCursoredInactive = cursorIndex > rangeStart && cursorIndex < rangeStart + rangeLength;
        if (widget.isActive && isCursoredActive) {
            widget.isActive = false;
            editor.removeContentWidget(widget);

            let content = editor.getValue();
            content = content.slice(0, rangeStart) + actualText + content.slice(rangeStart + replaceText.length);

            pauseHandleChanges = true;
            editor.setValue(content);
            editor.setPosition(position);
            pauseHandleChanges = false;
        } else if (!widget.isActive && !isCursoredInactive) {
            widget.isActive = true;
            editor.addContentWidget(widget);

            let content = editor.getValue();
            content = content.slice(0, rangeStart) + replaceText + content.slice(rangeStart + rangeLength);

            pauseHandleChanges = true;
            editor.setValue(content);
            editor.setPosition(position);
            pauseHandleChanges = false;
        }

        offsetOffset += actualText.length - replaceText.length;
    });
});

function collapseWidgets() {
    let content = editor.getValue();
    let offsetOffset = 0;

    widgets.forEach((widget) => {
        if (widget.isActive) {
            const { actualText, replaceText } = widget;
            let [rangeStart, rangeLength] = widget.range;
            rangeStart -= offsetOffset;
            content = content.slice(0, rangeStart) + replaceText + content.slice(rangeStart + rangeLength);
            offsetOffset += actualText.length - replaceText.length;
        }
    });

    pauseHandleChanges = true;
    editor.setValue(content);
    pauseHandleChanges = false;
}
window.collapse = collapseWidgets;
