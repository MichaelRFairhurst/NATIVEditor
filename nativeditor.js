'use strict';

var nativeditor = function() {
	var NEWLINE = 0;
	var SPACE = 1;
	var TAB = 2;
	var TEXT = 3;
	var MATCHED = 4;
	var nativeditor = function(textarea, config) {
		this.textarea = textarea;
		this.config = config;
		this.parent = textarea.parentNode;
		DomInteract.styleUnderlyingTextarea(textarea);
		this.cursor = DomInteract.renderCursor();
		this.container = DomInteract.renderContainer(this.parent, this.textarea, this.cursor);
		this.parent.appendChild(this.container);
		this.toRemove = null;
		this.unsetInterval = null;

		var pending = false;
		textarea.addEventListener('keypress', function(event) {
			var prevvalue = textarea.value;
			if (event.key === 'Tab') {
				event.preventDefault();
				event.stopPropagation();
				this.replaceSelection('\t');
			}

			// if we're already pending recalc don't queue another recalc!
			pending || setTimeout(function() {
				if (textarea.value !== prevvalue) {
					this.rerender();
				} else {
					this.updateCursor();
				}
				pending = false;
			}.bind(this), 1);
			pending = true;

		}.bind(this));
		this.rerender();
		this.bindClick();

		document.addEventListener('keyup', function(e) {
			var range = document.getSelection();
			if (this.isSelected(range) || e.key.length === 1) {
				var focusPos = range.focusNode.parentElement.pos + range.focusOffset;
				var anchorPos = range.anchorNode.parentElement.pos + range.anchorOffset;
				var startPos = Math.min(focusPos, anchorPos);
				var endPos = Math.max(focusPos, anchorPos);

				this.replaceSelection(e.key, startPos, endPos);
				this.textarea.focus();
				this.rerender();
			}
		}.bind(this));

		document.addEventListener('copy', function(e) {
			var range = document.getSelection();
			if (this.isSelected(range)) {
				var focusPos = range.focusNode.parentElement.pos + range.focusOffset;
				var anchorPos = range.anchorNode.parentElement.pos + range.anchorOffset;
				var startPos = Math.min(focusPos, anchorPos);
				var endPos = Math.max(focusPos, anchorPos);
				var text = textarea.value.substr(startPos, endPos - startPos);
			}
		}.bind(this));
	};

	nativeditor.prototype.replaceSelection = function(withWhat, start, end) {
		if (start === undefined || end === undefined) {
			start = this.textarea.selectionStart;
			end = this.textarea.selectionEnd;
		}
		var prefix = this.textarea.value.substr(0, start);
		var suffix = this.textarea.value.substr(end);
		this.textarea.value = prefix + withWhat + suffix;
		this.textarea.selectionStart = this.textarea.selectionEnd = prefix.length + withWhat.length;
	}

	nativeditor.prototype.rerender = function() {
		this.tokens = TextProcess.process(this.textarea.value, this.config);

		DomInteract.enactFastestUpdatePlan(this.tokens, this.oldTokens || [], this.container);
		this.posLineIndex = TextProcess.indexLineBreakPositions(this.tokens);
		this.updateCursor();
		this.oldTokens = this.tokens;
	}

	/*nativeditor.prototype.renderFromScratch = function() {
		var spans = DomInteract.renderTokensDom(tokens, function(pos) {
			return function(event) {
				textarea.focus();
				textarea.selectionStart = pos;
				textarea.selectionEnd = pos;
				this.updateCursor();
				event.stopPropagation();
			}.bind(this);
		});

		container = renderContainer(this.parent, textarea, cursor);
		spans.map(container.appendChild.bind(container));
	*/

	nativeditor.prototype.isSelected = function(range) {
		// exclude selections with no length
		if (range.anchorNode === range.focusNode && range.focusOffset === range.anchorOffset) {
			return false;
		}

		return this.container.contains(range.anchorNode) && this.container.contains(range.focusNode);
	};

	nativeditor.prototype.bindClick = function() {
		this.container.onclick = function(event) {
			if(this.isSelected(document.getSelection())) {
				return;
			}

			var height = event.layerY + fontHeight; // transpose the click up half a line
			var offset = Math.floor(event.layerX / fontWidth - .5);
			var line = Math.floor(height / fontHeight / 2);
			var pos;
			if (line > this.posLineIndex.maxLine) {
				pos = this.posLineIndex.maxPosition;
			} else {
				var pos = this.posLineIndex.positionByLine[line] - 1;
			}

			while (this.posLineIndex.positionOffsetByPosition[pos] > offset) --pos;
			this.textarea.focus();
			this.textarea.selectionStart = pos;
			this.textarea.selectionEnd = pos;
			this.updateCursor();
		}.bind(this);
	}

	nativeditor.prototype.applyIncrementalChange = function() {
		for(var i = 0; i < tokens.length; ++i) {
			var elem = this.container.children[1 + i],
				token = tokens[i];
			if ((token.type === MATCHED || token.type === TEXT) && elem.textContent === token.text) {
				continue;
			}

			styleTokenElement(elem, token);
		}
	}

	nativeditor.prototype.updateCursor = function() {
		if (document.activeElement !== this.textarea) {
			this.cursor.hidden = true;
			return;
		}
		var pos = this.textarea.selectionStart;
		this.cursor.hidden = false;
		var line = this.posLineIndex.lineByPosition[pos];
		var lineOffset = this.posLineIndex.positionOffsetByPosition[pos];
		this.cursor.style.marginTop = fontHeight * 2 * line + 'px';
		this.cursor.style.marginLeft = fontWidth * lineOffset + 'px';
	}

	nativeditor.js = [{
		regex: /'([^'\\]|(\\.))*'|"([^"\\]|(\\.))*"/,
		class: 'stringlit'
	}, {
		regex: /\/([^\/\\]|(\\.))+\//,
		class: 'regexlit'
	}, {
		regex: /if|for|while|return|break|continue|else|switch|case/,
		class: 'control-keyword'
	}, {
		regex: /var|function|let/,
		class: 'decl-keyword'
	}, {
		regex: /true|false|null|undefined|NaN|Infinity/,
		class: 'value-keyword'
	}, {
		regex: /\/\/.*/,
		class: 'comment'
	}, {
		regex: /[\[\]\(\)\}\{\+\-=\*&%\$#@!:;`~<>\.\/\?]/,
		class: 'symbol'
	}];

	var fontHeight = 7;
	var fontWidth = 7;

	var DomInteract = {
		styleTokenElement: function(elem, token) {
			elem.pos = token.pos;
			if (token.type === TEXT || token.type === MATCHED) {
				elem.textContent = token.text;

				if (token.config !== null) {
					elem.classList.add('nativeditor-' + token.config.class);
					elem.style.fontWeight = token.config.fontWeight;
				}
			} else if(token.type === NEWLINE) {
				var height = fontHeight * (token.repetitions - 1);
				elem.style.display = 'block';
				elem.style.margin = height + "px 0px";
				elem.classList.add('whitespace');
			} else {
				var width = (token.type === TAB ? 4 : 1) * fontWidth * token.repetitions;
				elem.style.width = width + "px";
				elem.classList.add('whitespace');
			}
		},
		renderTokensDom: function(tokens, selector) {
			var spans = [];
			var baseElem = document.createElement('span');
			for(var i = 0; i < tokens.length; ++i) {
				var token = tokens[i];
				var elem = token.type === NEWLINE ? document.createElement('br') : baseElem.cloneNode();

				styleTokenElement(elem, token);
				elem.addEventListener('click', selector(token.pos));
				spans.push(elem);
			}

			return spans;
		},
		styleUnderlyingTextarea: function(textarea) {
			textarea.classList.add("nativeditor-textarea");
		},
		renderCursor: function() {
			var cursor = document.createElement('span');
			cursor.classList.add("nativeditor-cursor");
			return cursor;
		},
		renderContainer: function(parent, textarea, cursor) {
			var parent = textarea.parentNode;
			var offsetTop = textarea.offsetTop;
			var offsetLeft = textarea.offsetLeft;
			var container = document.createElement('div');
			container.classList.add('nativeditor');
			container.style.left = offsetLeft + 'px';
			container.style.top = offsetTop + 'px';
			container.style.width = textarea.offsetWidth + "px";
			container.style.height = textarea.offsetHeight + "px";
			container.appendChild(cursor);

			// TODO bind this properly
			function editSelection(withWhat) {
				var selection = document.getSelection();
				var start = selection.anchorNode.pos;
				var end = selection.focusNode.pos;
				var prefix = textarea.value.substr(0, start);
				var suffix = textarea.value.substr(end);

				textarea.value = prefix + withWhat + suffix;
			}

			return container;
		},
		removeNodeFactor: 2,
		insertNodeFactor: 1,
		setStyleFactor: .3,
		textUpdateFactor: .5,
		setClassFactor: .3,
		buildInsertFirstPlan: function(newTokens, oldTokens) {
			var plan = [];
			for (var ni = 0, oi = 0; ni < newTokens.length; ++ni) {
				var newToken = newTokens[ni], oldToken = oldTokens[oi];

				if (oldToken === undefined) {
					plan.push({type: 'INSERT_ELEM', token: newToken, elemi: ni, elemType: newToken.type === NEWLINE ? 'br' : 'span'});
					continue;

				}
				if (newToken.type === oldToken.type) {
					if (newToken.type === MATCHED || newToken.type === TEXT) {
						if (newToken.text !== oldToken.text) {
							plan.push({type: 'UPDATE_TEXT', token: newToken, elemi: ni});
						}

						var oldClass = oldToken.config ? oldToken.config.class : '';
						var newClass = newToken.config ? newToken.config.class : '';

						if (oldClass !== newClass) {
							plan.push({type: 'SET_CLASS', elemi: ni, value: newClass, token: newToken});
						}
					} else if (newToken.type === NEWLINE) {
						if (newToken.repetitions != oldToken.repetitions) {
							var height = fontHeight * (newToken.repetitions - 1);
							plan.push({type: 'SET_STYLE', styleType: 'margin', value: height + 'px 0px', elemi: ni, token: newToken});
						}
					} else if (newToken.repetitions != oldToken.repetitions) {
						var width = (newToken.type === TAB ? 4 : 1) * fontWidth * newToken.repetitions;
						plan.push({type: 'SET_STYLE', styleType: 'width', value: width + 'px', elemi: ni, token: newToken});
					}

					++oi;
				} else {
					plan.push({type: 'INSERT_ELEM', token: newToken, elemi: ni, elemType: newToken.type === NEWLINE ? 'br' : 'span'});
				}
			}

			while (oi > oldTokens.length) {
				plan.push({type: 'REMOVE_ELEM', elemi: ni, token: newToken});
				++oi;
			}

			return plan;
		},
		buildRemoveFirstPlan: function(newTokens, oldTokens) {
			var plan = [];
			for (var ni = 0, oi = 0; oi < oldTokens.length; ++oi) {
				var newToken = newTokens[ni], oldToken = oldTokens[oi];

				if (newToken === undefined) {
					plan.push({type: 'REMOVE_ELEM', elemi: ni});
					continue;

				}
				if (newToken.type === oldToken.type) {
					if (newToken.type === MATCHED || newToken.type === TEXT) {
						if (newToken.text !== oldToken.text) {
							plan.push({type: 'UPDATE_TEXT', token: newToken, elemi: ni});
						}

						var oldClass = oldToken.config ? oldToken.config.class : '';
						var newClass = newToken.config ? newToken.config.class : '';

						if (oldClass !== newClass) {
							plan.push({type: 'SET_CLASS', elemi: ni, value: newClass, token: newToken});
						}
					} else if (newToken.type === NEWLINE) {
						if (newToken.repetitions != oldToken.repetitions) {
							var height = fontHeight * (newToken.repetitions - 1);
							plan.push({type: 'SET_STYLE', styleType: 'margin', value: height + 'px 0px', elemi: ni, token: newToken});
						}
					} else if (newToken.repetitions != oldToken.repetitions) {
						var width = (newToken.type === TAB ? 4 : 1) * fontWidth * newToken.repetitions;
						plan.push({type: 'SET_STYLE', styleType: 'width', value: width + 'px', elemi: ni, token: newToken});
					}

					++ni;
				} else {
					plan.push({type: 'REMOVE_ELEM', token: newToken, elemi: ni});
				}
			}

			while (ni < newTokens.length) {
				plan.push({type: 'INSERT_ELEM', token: newTokens[ni], elemi: ni, elemType: newTokens[ni].type === NEWLINE ? 'br' : 'span', token: newToken});
				++ni;
			}

			return plan;
		},
		buildFromScratchPlan: function(newTokens) {
			var i = 0;
			return newTokens.map(function(token) {
				return {type: 'INSERT_ELEM', token: token, elemi: i++};
			});
		},
		estimateCost: function(plans) {
			var cost = 0;
			for(var i = 0; i < plans.length; ++i) {
				var plan = plans[i];
				if (plan.type === 'SET_CLASS') {
					cost += this.setClassFactor;
				} else if (plan.type === 'SET_STYLE') {
					cost += this.setStyleFactor;
				} else if (plan.type === 'REMOVE_ELEM') {
					cost += this.removeNodeFactor;
				} else if (plan.type === 'INSERT_ELEM') {
					cost += this.insertNodeFactor;
				} else if (plan.type === 'UPDATE_TEXT') {
					cost += this.textUpdateFactor;
				}
			}

			return cost;
		},
		enactFastestUpdatePlan: function(newTokens, oldTokens, container) {
			var insertFirstPlan = this.buildInsertFirstPlan(newTokens, oldTokens),
				removeFirstPlan = this.buildRemoveFirstPlan(newTokens, oldTokens),
				fromScratchPlan = this.buildFromScratchPlan(newTokens),
				insertFirstCost = this.estimateCost(insertFirstPlan),
				removeFirstCost = this.estimateCost(removeFirstPlan),
				fromScratchCost = 10000000000; //this.estimateCost(fromScratchPlan);

			var minCost = Math.min(insertFirstCost, removeFirstCost, fromScratchCost);

			if (minCost === fromScratchCost) {
				this.followPlan(fromScratchPlan, container);
			} else if (minCost === insertFirstCost) {
				this.followPlan(insertFirstPlan, container);
			} else {
				this.followPlan(removeFirstPlan, container);
			}
		},
		followPlan: function(plans, container) {
			for(var i = 0; i < plans.length; ++i) {
				var plan = plans[i];
				var elem = container.children[plan.elemi];
				if (plan.type === 'SET_CLASS') {
					elem.setAttribute('class', "nativeditor-" + plan.value);
				} else if (plan.type === 'SET_STYLE') {
					elem.style[plan.styleType] = plan.value;
				} else if (plan.type === 'REMOVE_ELEM') {
					elem.remove();
				} else if (plan.type === 'UPDATE_TEXT') {
					elem.textContent = plan.token.text;
				} else if (plan.type === 'INSERT_ELEM') {
					elem = document.createElement(plan.elemType);
					this.styleTokenElement(elem, plan.token);
					container.insertBefore(elem, container.children[plan.elemi]);
				}

				elem.pos = plan.token.pos;
			}
		}
	};

	var TextProcess = {
		process: function(text, config) {
			var tokens = [], globalOffset = 0;
			while(text) {

				var winner = null, pos = null;
				for(var i = 0; i < config.length; ++i) {
					var candidate = config[i];
					var posCandidate = text.search(candidate.regex);

					if (posCandidate === -1) {
						continue;
					}

					if (pos === null || posCandidate < pos) {
						pos = posCandidate;
						winner = candidate;
					}

					if (pos === 0) {
						break;
					}
				}

				if (winner === null) {
					this.processText(tokens, text, globalOffset);
					break;
				}

				if (pos !== 0) {
					var remainder = text.substring(0, pos);
					this.processText(tokens, remainder, globalOffset);
					text = text.substring(pos);
					globalOffset += pos;
				}

				var match = winner.regex.exec(text)[0];
				tokens.push({type: MATCHED, text: match, config: winner, pos: globalOffset});
				text = text.substring(match.length);
				globalOffset += match.length;
			}

			this.aggregate(tokens);
			return tokens;
		},

		processText: function(tokens, text, globalOffset) {
			var buffer = "", bufferOffset = 0;
			for(var i = 0; i < text.length; ++i) {
				var flushBuffer = false, thenAdd = null;
				if (text[i] === '\n') {
					flushBuffer = true;
					thenAdd = {type: NEWLINE, repetitions: 1, pos: i + globalOffset};
				} else if (text[i] === '\t') {
					flushBuffer = true;
					thenAdd = {type: TAB, repetitions: 1, pos: i + globalOffset};
				} else if (text[i] === ' ') {
					flushBuffer = true;
					thenAdd = {type: SPACE, repetitions: 1, pos: i + globalOffset};
				} else {
					buffer += text[i];
				}

				if (buffer && flushBuffer) {
					tokens.push({type: TEXT, text: buffer, config: null, pos: bufferOffset + globalOffset});
					buffer = "";
					bufferOffset = i;
				}

				if (thenAdd != null) {
					tokens.push(thenAdd);
				}
			}

			if (buffer) {
				tokens.push({type: TEXT, text: buffer, config: null, pos: bufferOffset + globalOffset});
			}
		},

		aggregate: function(tokens) {
			if (tokens.length < 2) {
				return;
			}

			var agg = tokens[0];
			for(var i = 1; i < tokens.length; ++i) {
				if (tokens[i].type === agg.type && agg.type != MATCHED && agg.type != TEXT) {
					agg.repetitions++;

					// drop an item. Then lower i to accomodate
					tokens.splice(i, 1);
					--i;
				} else {
					agg = tokens[i];
				}
			}
		},

		indexLineBreakPositions: function(tokens, columns) {
			var index = {
				positionByLine: [0], // the first line is on position 0
				lineByPosition: [0], // the fisrt position is on line 0
				positionOffsetByPosition: [0],
				maxLine: null,
				maxPosition: null
			};

			var pos = 0;
			var line = 0;
			var positionOffset = 0;
			for(var i = 0; i < tokens.length; ++i) {
				var token = tokens[i];
				if (token.type === NEWLINE) {
					for(var x = 0; x < token.repetitions; ++x) {
						++line;
						++pos;
						positionOffset = 0;
						index.positionByLine[line] = pos;
						index.positionOffsetByPosition[pos] = positionOffset;
						index.lineByPosition[pos] = line;
					}
				} else {
					var charsMore, factor = 1;
					if (token.type === TAB ) {
						//charsMore = token.repetitions * 4;
						charsMore = token.repetitions;
						factor = 4;
					} else if(token.type === SPACE) {
						charsMore = token.repetitions;
					} else {
						charsMore = token.text.length;
					}

					for(var x = 0; x < charsMore; ++x) {
						++pos;
						positionOffset += factor;
						index.lineByPosition[pos] = line;
						index.positionOffsetByPosition[pos] = positionOffset;
					}
				}
			}

			index.maxLine = line;
			index.maxPosition = pos;

			return index;
		}
	}

	return nativeditor;
}();
