import { ConfigurationChangeEvent, window, DecorationOptions, Range, workspace, ExtensionContext, TextEditor, DocumentHighlight, TextEdit } from "vscode";

const colorizers = {
	html: {
		regex: new RegExp(/(?<!-->(.|\r|\n)*)(?<=<!--(.|\r|\n)*)(?<=([^A-z0-9]))([A-z0-9]).*(?=(.|\r|\n)*-->)/gm),
		colorizer: (match: RegExpExecArray, activeEditor: TextEditor, nonDescriptionText: DecorationOptions[], descriptionText: DecorationOptions[], identifierText: DecorationOptions[]) => {
			defaultColorizer(match, activeEditor, nonDescriptionText, descriptionText, identifierText, "Omschrijving", "Auteur", "-->");
		},
	},
	jsCss: {
		regex: new RegExp(/(?<!\*\/(.|\r|\n)*)(?<=\/\*(.|\r|\n)*)(?<=([^A-z0-9]))([A-z0-9]).*(?=(.|\r|\n)*\*\/)/gm),
		colorizer: (match: RegExpExecArray, activeEditor: TextEditor, nonDescriptionText: DecorationOptions[], descriptionText: DecorationOptions[], identifierText: DecorationOptions[]) => {
			defaultColorizer(match, activeEditor, nonDescriptionText, descriptionText, identifierText, "Omschrijving", "Auteur", "*/");
		},
	},
	php: {
		regex: new RegExp(/(?<!\*\/(.|\r|\n)*)(?<=\/\*(.|\r|\n)*)(?<=([^A-z0-9]))([A-z0-9]).*(?<!:.*):(?=(.|\r|\n)*\*\/)/gm),
		colorizer: (match: RegExpExecArray, activeEditor: TextEditor, nonDescriptionText: DecorationOptions[], descriptionText: DecorationOptions[], identifierText: DecorationOptions[]) => {
			// Just a shorter version
			const positionAt = activeEditor.document.positionAt;
			const lineAt = activeEditor.document.lineAt;

			var line = match[0];
			// Get the identifier
			var identifier = line.split(": ")[0];

			if(positionAt(match.index).line > 10) return

			// Push the identifier
			var IdRange = new Range(positionAt(match.index), positionAt(match.index + identifier.length));
			identifierText.push({ range: IdRange });

			// For the Subject part
			if (identifier.includes("File")) {
				var descRange = new Range(positionAt(match.index + identifier.length + 1), positionAt(match.index + line.length));
				descriptionText.push({ range: descRange });

				// Use a loop to get all the lines inbetween so people can have subjects with multiple lines
				for (let i = IdRange.end.line; i < activeEditor.document.lineCount; i++) {
					var curLine = lineAt(i);
					if (curLine.text.includes("*/")) {
						// Desc comment
						var descRange = new Range(IdRange.end, curLine.range.start);
						descriptionText.push({ range: descRange });

						// The closing comment
						nonDescriptionText.push({
							range: new Range(descRange.end, lineAt(curLine.range.end.line).range.end),
						});
						break;
					}
				}
			} else {
				var nonDescRange = new Range(positionAt(match.index), positionAt(match.index + line.length));
				nonDescriptionText.push({ range: nonDescRange });
			}

			// The opening comment
			for (let i = 0; i < activeEditor.document.lineCount; i++) {
				var curLine = lineAt(i);
				if (curLine.text.includes("/**")) {
					var openingComment = new Range(curLine.range.start, positionAt(match.index));
					nonDescriptionText.push({ range: openingComment });
					break;
				}
			}
		},
	},
	sql: {
		regex: new RegExp(/(?<!\*\/(.|\r|\n)*)(?<=\/\*(.|\r|\n)*)(?<=([^A-z0-9]))([A-z0-9]).*(?=(.|\r|\n)*)/gm),
		colorizer: (match: RegExpExecArray, activeEditor: TextEditor, nonDescriptionText: DecorationOptions[], descriptionText: DecorationOptions[], identifierText: DecorationOptions[]) => {
			defaultColorizer(match, activeEditor, nonDescriptionText, descriptionText, identifierText, "Subject", "Author", "*/");
		},
	},
};

function defaultColorizer(match: RegExpExecArray, activeEditor: TextEditor, nonDescriptionText: DecorationOptions[], descriptionText: DecorationOptions[], identifierText: DecorationOptions[], omschrijvingText: string, auteurText: string, closingComment: string) {
	// Just a shorter version
	const positionAt = activeEditor.document.positionAt;
	const lineAt = activeEditor.document.lineAt;

	var line = match[0];
	// Get the identifier
	var identifier = line.split(": ")[0];

	if(positionAt(match.index).line > 10) return

	// Push the identifier
	// Make a temporary one, since apparently it gets used
	var IdRange = new Range(activeEditor.document.positionAt(match.index), activeEditor.document.positionAt(match.index));
	if((/.*[A-z]: /g).test(line))
	{
		IdRange = new Range(activeEditor.document.positionAt(match.index), activeEditor.document.positionAt(match.index + identifier.length + 1));
		identifierText.push({ range: IdRange });
	}

	// For the Subject part
	if (identifier.includes(omschrijvingText)) {
		var descRange = new Range(positionAt(match.index + identifier.length + 1), positionAt(match.index + line.length));
		descriptionText.push({ range: descRange });

		// Use a loop to get all the lines inbetween so people can have subjects with multiple lines
		for (let i = IdRange.end.line; i < activeEditor.document.lineCount; i++) {
			var curLine = lineAt(i);
			if (curLine.text.includes(closingComment)) {
				// Desc comment
				var descRange = new Range(IdRange.end, curLine.range.start);
				descriptionText.push({ range: descRange });

				// The closing comment
				nonDescriptionText.push({
					range: new Range(descRange.end, lineAt(curLine.range.end.line).range.end),
				});
				break;
			}
		}
	} else {
		var nonDescRange = new Range(positionAt(match.index), positionAt(match.index + line.length));
		nonDescriptionText.push({ range: nonDescRange });
	}

	// The opening comment
	if (identifier.includes(auteurText)) {
		var openingComment = new Range(positionAt(0), positionAt(match.index));
		nonDescriptionText.push({ range: openingComment });
	}
}

export function colorize(context: ExtensionContext) {
	var config = workspace.getConfiguration("kw1c-template");
	workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
		config = workspace.getConfiguration("kw1c-template");
	});

	let timeout: NodeJS.Timer | undefined = undefined;

	const nonDesriptionDeco = window.createTextEditorDecorationType({
		dark: {
			color: "#686f7d",
		},
		light: {
			color: "#785e2a",
		},
		backgroundColor: "orange",
		fontStyle: "normal",
		fontWeight: "normal",
	});

	const descriptionDeco = window.createTextEditorDecorationType({
		dark: {
			color: "#bbbcbd",
		},
		light: {
			color: "#424242",
		},
		backgroundColor: "cyan",
		fontStyle: "normal",
	});
	const identifierDeco = window.createTextEditorDecorationType({
		dark: {
			color: "#7e818a",
		},
		light: {
			color: "#8b8585",
		},
		fontWeight: "bold",
		backgroundColor: "maroon",
		fontStyle: "normal",
	});

	let activeEditor = window.activeTextEditor;

	function updateDecorations() {
		if (!activeEditor || config.colorModuleHeader == false) {
			return;
		}
		const text = activeEditor.document.getText();

		// Determine file
		var isHtml = activeEditor.document.languageId == "html";
		var isJsCss = ["css", "javascript", "typescript"].includes(activeEditor.document.languageId);
		var isPhp = activeEditor.document.languageId == "php";
		var isSql = activeEditor.document.languageId == "sql";

		var curColorizer;

		if (isHtml) {
			curColorizer = colorizers.html;
		} else if (isJsCss) {
			curColorizer = colorizers.jsCss;
		} else if (isPhp) {
			curColorizer = colorizers.php;
		} else if (isSql) {
			curColorizer = colorizers.sql;
		} else {
			return;
		}

		var regEx = curColorizer.regex;

		const nonDescriptionText: DecorationOptions[] = [];
		const descriptionText: DecorationOptions[] = [];
		const identifierText: DecorationOptions[] = [];
		let match;
		while ((match = regEx.exec(text))) {
			curColorizer.colorizer(match, activeEditor, nonDescriptionText, descriptionText, identifierText);
		}
		activeEditor.setDecorations(nonDesriptionDeco, nonDescriptionText);
		activeEditor.setDecorations(descriptionDeco, descriptionText);
		activeEditor.setDecorations(identifierDeco, identifierText);
	}

	function triggerUpdateDecorations(throttle: boolean = false) {
		if (timeout) {
			clearTimeout(timeout);
			timeout = undefined;
		}
		if (throttle) {
			timeout = setTimeout(updateDecorations, 100);
		} else {
			updateDecorations();
		}
	}

	if (activeEditor) {
		triggerUpdateDecorations();
	}

	window.onDidChangeActiveTextEditor(
		(editor) => {
			activeEditor = editor;
			if (editor) {
				triggerUpdateDecorations();
			}
		},
		null,
		context.subscriptions
	);

	workspace.onDidChangeTextDocument(
		(event) => {
			if (activeEditor && event.document === activeEditor.document) {
				triggerUpdateDecorations(true);
			}
		},
		null,
		context.subscriptions
	);
}
