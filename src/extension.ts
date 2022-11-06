import * as vscode from 'vscode';


const decorType = vscode.window.createTextEditorDecorationType({
	borderStyle: 'solid',
	borderWidth: '1px',
	borderColor: 'rgba(255, 255, 255, 0.3)',
	light: {
		borderColor: 'rgba(0, 0, 0, 0.3)',
	}
});

let anchored_cursors: [number, number][] = [];

function isDisjoint(range1: [number, number], range2: [number, number]) {
	let [start1, end1] = range1.sort();
	let [start2, end2] = range2.sort();
	return end1 <= start2 || end2 <= start1;
}

function addAnchoredCursors(editor: vscode.TextEditor) {
	for (const selection of editor.selections) {
		const anchor = editor.document.offsetAt(selection.anchor);
		const active = editor.document.offsetAt(selection.active);
		anchored_cursors.push([anchor, active]);
	}

	updateDecorations(editor);
}

function removeAnchoredCursors(editor: vscode.TextEditor) {
	for (const selection of editor.selections) {
		const start = editor.document.offsetAt(selection.start);
		const end = editor.document.offsetAt(selection.end);
		const range = [start, end] as [number, number];
		anchored_cursors = anchored_cursors.filter(selection => isDisjoint(range, selection));
	}

	updateDecorations(editor);
}

function prevAnchoredCursor(editor: vscode.TextEditor) {
	const curr_active = editor.document.offsetAt(editor.selection.active);
	const prev_cursors = anchored_cursors.filter(([_, active]) => active < curr_active);

	if (prev_cursors.length === 0) {
		return;
	}

	const [anchor, active] = prev_cursors.reduce((a, b) => a[1] < b[1] ? b : a);

	editor.selections = [
		new vscode.Selection(
			editor.document.positionAt(anchor),
			editor.document.positionAt(active)
		)
	];
}

function nextAnchoredCursor(editor: vscode.TextEditor) {
	const curr_active = editor.document.offsetAt(editor.selection.active);
	const next_cursors = anchored_cursors.filter(([_, active]) => curr_active < active);

	if (next_cursors.length === 0) {
		return;
	}

	const [anchor, active] = next_cursors.reduce((a, b) => a[1] < b[1] ? a : b);

	editor.selections = [
		new vscode.Selection(
			editor.document.positionAt(anchor),
			editor.document.positionAt(active)
		)
	];
}

function activateAnchoredCursors(editor: vscode.TextEditor) {
	const selections = anchored_cursors.map(([anchor, active]) => new vscode.Selection(
		editor.document.positionAt(anchor),
		editor.document.positionAt(active)
	));

	if (selections.length !== 0) {
		editor.selections = editor.selections.concat(selections);
	}

	cleanAnchoredCursors(editor);
}

function cleanAnchoredCursors(editor?: vscode.TextEditor) {
	anchored_cursors.splice(0, anchored_cursors.length);
	updateDecorations(editor);
}

function shiftAnchoredCursors(event: vscode.TextDocumentChangeEvent) {
	const editor = vscode.window.activeTextEditor;
	const textDocument = event.document;

	if (editor?.document !== textDocument) {
		return;
	}

	const ranges = event.contentChanges.map(
		contentChange => {
			const start = textDocument.offsetAt(contentChange.range.start);
			const end = textDocument.offsetAt(contentChange.range.end);
			const offset = contentChange.rangeLength - contentChange.text.length;

			return [[start, end], offset] as [[number, number], number];
		}
	);

	anchored_cursors = anchored_cursors
		.filter(selection => !ranges.some(([range, _]) => !isDisjoint(range, selection)))
		.map(([anchor, active]) => {
			const total_offset = ranges
				.filter(([[start, _], __]) => start <= anchor)
				.map(([_, offset]) => offset)
				.reduce((acc, curr) => acc + curr, 0);
			return [anchor - total_offset, active - total_offset] as [number, number];
		});

	updateDecorations(editor);
}

function updateDecorations(editor?: vscode.TextEditor) {
	if (editor === undefined) {
		return;
	}

	const decorRange = anchored_cursors.map(
		([anchor, active]) => new vscode.Range(
			editor.document.positionAt(anchor),
			editor.document.positionAt(active)
		)
	);

	editor.setDecorations(decorType, decorRange);
}


export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerTextEditorCommand('anchoredMulticursor.addAnchoredCursors', addAnchoredCursors),
		vscode.commands.registerTextEditorCommand('anchoredMulticursor.removeAnchoredCursors', removeAnchoredCursors),
		vscode.commands.registerTextEditorCommand('anchoredMulticursor.prevAnchoredCursor', prevAnchoredCursor),
		vscode.commands.registerTextEditorCommand('anchoredMulticursor.nextAnchoredCursor', nextAnchoredCursor),
		vscode.commands.registerTextEditorCommand('anchoredMulticursor.activateAnchoredCursors', activateAnchoredCursors),
		vscode.commands.registerTextEditorCommand('anchoredMulticursor.cleanAnchoredCursors', cleanAnchoredCursors)
	);

	vscode.window.onDidChangeActiveTextEditor(cleanAnchoredCursors, null, context.subscriptions);
	vscode.workspace.onDidChangeTextDocument(shiftAnchoredCursors, null, context.subscriptions);
}

export function deactivate() { }
