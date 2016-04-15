# NATIVeditor

A lightweight, performant syntax highlighter and editor written in javascript.

I made this as an exercise and for fun, but since many other editors aim to be so feature-rich, its possible this lightweight alternative will serve to be useful to others.

## Usage

To use NATIVeditor, simply invoke it as a function with a textarea dom element as a parameter, along with a config.

```
	var textelement = document.findElementById('textarea');
	nativeditor(textelement, nativeditor.js);
```

In this example, `nativeditor.js` is a predefined config that ships as a default. There are currently no others, but nativeditor is made to be highly configurable.

As of writing this README, NATIVeditor is not yet on bower. You will have to download the files -- make sure to grab both the css and the js.

```
	<link rel="stylesheet/css" href="nativeditor.css"></link>
	<script type="text/javascript" src="nativeditor.js"></script>
```

## Configuration

The css and js are both intended to be configurable by design.

Configuring the js layer allows you to specify a syntax highlighting strategy. The default config is `nativeditor.js` for use, but you can change it and/or write your own.

A js config for NATIVeditor should be (currently) specified as an array of objects that perform a regex match and apply a class to the matched text. You can reuse our existing classes or write your own.

Each object within the array should satisfy these two properties:

* regex : a regular expression that matches the text
* class : the class to apply

You do not need to worry (much) about regexes overlapping, about matching 100% of text found, or about matching whitespace. (match it when you want, or ignore it.) Here, for instance, is the beginnings of a java highlighting config you could use.

```
	var javaconfig = [{
		regex: /class|public|private|abstract|synchronized|interface|extends|implements|.../,
		class: 'nativeditor-keyword',
	}, {
		regex: /[a-Z_][a-Z0-9_]+/,
		class: 'my-java-varname-class'
	}, {
		regex: /[0-9]+.?[0-9]?[fdl]?/,
		class: 'nativeditor-symbol'
	}, {
		...
	}]
```

Notice how these regexes overlap severely, and they don't limit themselves within a document at all. For instance, a varname like 'happy2' would be matched both as a number and as a varname, simply at different offsets. Here NATIVeditor will see the different starting placements and go with the first. There is also overlap between keywords: `extend` would match also in the varname regex. Don't worry, you don't need to change a thing from this example; the fact that the varnames regex is declared first means that it will have precedence.

There are currently five predefined css classes you can use (if you are creating a new grammar) and/or modify (if you just want to tweak the color choices). They are:

* nativeditor-stringlit
* nativeditor-regexlit
* nativeditor-control-keyword
* nativeditor-decl-keyword
* nativeditor-value-keyword
* nativeditor-comment
* nativeditor-symbol

Feel free to style these in any way, so long as you do not change the font size, spacing, line height, etc. You can, for instance, customize the font (to a different monospaced font), the color, give it an underline, or bold it, or italisize it.

## TODOLIST / Bugs

* click and drag is not working
* when regexes match strings, they do not respect newlines within those strings, and most all calculations stop working
* lines do not wrap like they would in a standard textarea
* performance will go down as the contents of the text go up, ideally some sort of infinite scroll approach should be taken
* performance is not great as new special text regions are created. For instance, if you hold down a symbol (like `=`) in the js config, framerate may go very slow since each one is a new span and the relayouting required is very slow.
