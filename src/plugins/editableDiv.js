// This class Extends the HTMLElement class adding an element that provides Obsidian like WYSIWYG HTML editor element.
// By including this in a script tag you can create any number of these editable elements by using document.createElement('editable-div

// TODO:
// - Modify selection update function to prevent caret from being to the left of no width spaces - should always be to the right
// - Come up with a solution for setting the function of the links: currently I am setting the onclick function to something that the notes app gives
// - Arrow logic to skip over zero width space preceeded by br
// - Delete key functions mess up the html
// - Clean up document, merging concurrent lists, deleting empty headings ect
// - Make editor into a system of function calls which can be applied to a undo / redo stack

// Completed Features:
// - Add hr with ---
// - Astrix for italics and bold
// - Disabled spell check in inline code blocks and code blocks
// - Selection surrounding for code block and links
// - Delete code block or transition between inline and block should copy content.

class EditableDiv extends HTMLElement {
    currentNode; // used to keep track of the current selected node
    scrollPadding = 200; // The space kept empty at the bottom of the editable div
    constructor() {
        super();
        // Both keydown and beforeinput callbacks are used where just keydown could be used:
        // Keyup / keydown events on chrome android do not provide event.key for most keys. Surprisingly they do for backspace and enter??
        // So as a solution, I use both keydown and beforeinput
        this.addEventListener('keydown', this.EditableNodeKeydown.bind(this));
        this.addEventListener('beforeinput', this.EditableNodeBeforeInput.bind(this));
        document.addEventListener('selectionchange', this.GetCurrentNode.bind(this, this)); // Updates the currentNode member variable
    }
    connectedCallback() {
        this.innerHTML = "<br>";
        this.setAttribute('contenteditable', 'true');
        this.className = "editable-div";
    }
    insertCaret() {
        if (this.childNodes.length > 0 && this.childNodes[0].tagName != 'BR') this.InsertCaretInsideStart(this.childNodes[0]);
        else this.InsertCaretInsideStart(this);
    }
    // This function will probably not work if the div is shorter than the entire screen.
    EnsureCaretInView() {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        const caretRange = range.cloneRange();
        caretRange.collapse(true);
        const tempSpan = document.createElement('span');
        caretRange.insertNode(tempSpan);
        const caretRect = tempSpan.getBoundingClientRect();
        tempSpan.remove();
        const viewportHeight = window.innerHeight;
        const caretBottom = caretRect.bottom;
        if (caretBottom > viewportHeight - this.scrollPadding) {
            window.scrollBy({
                top: caretBottom - viewportHeight + this.scrollPadding
            });
        }
    }
    GetCurrentNode() {
        var nodes = document.querySelectorAll(".focus");
        nodes.forEach(node => node.classList.remove("focus"));
        var selection = window.getSelection();
        if (selection.anchorNode === null) return null;
        var range = selection.getRangeAt(0);
        var container = range.commonAncestorContainer;
        this.currentNode = container.nodeType === Node.TEXT_NODE ? container.parentNode : container;
        if (!this.contains(this.currentNode)) {
            this.currentNode == null
            return null;
        }
        while (this.currentNode.tagName === 'B' || this.currentNode.tagName === 'I') this.currentNode = this.currentNode.parentNode;
        this.currentNode.classList.add("focus");
        return this.currentNode;
    }

    // Caret and Node manipulation
    GetCurrentTextNode() {
        var selection = window.getSelection();
        var range = selection.getRangeAt(0);
        if (range.commonAncestorContainer.nodeType !== Node.TEXT_NODE && range.startOffset > 0) return range.commonAncestorContainer.childNodes[range.startOffset - 1];
        return range.commonAncestorContainer;
    }
    InsertNodeAfterCaret(node) {
        var range = window.getSelection().getRangeAt(0);
        range.insertNode(node);
    }
    InsertNodeBeforeCaret(node) {
        var range = window.getSelection().getRangeAt(0);
        range.insertNode(node);
        range.setStartAfter(node);
        if (node.parentNode.lastChild.nodeType === Node.TEXT_NODE && node.parentNode.lastChild.nodeValue === "") {
            node.parentNode.appendChild(document.createElement('br'));
        }
    }
    InsertCaretInsideStart(node, offset = 0) {
        var range = document.createRange();
        range.setStart(node, offset);
        range.setEnd(node, offset);
        var selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        this.GetCurrentNode();
    }
    InsertCaretBefore(node) {
        var range = window.getSelection().getRangeAt(0);
        var parent = node.parentNode;
        var index = Array.prototype.indexOf.call(parent.childNodes, node);
        if (index === 0) {
            range.setStart(parent, 0);
            range.setEnd(parent, 0);
        } else {
            var prevSibling = parent.childNodes[index - 1];
            if (prevSibling.nodeType === Node.TEXT_NODE) {
                range.setStart(prevSibling, prevSibling.length);
                range.setEnd(prevSibling, prevSibling.length);
            } else {
                range.setStartAfter(prevSibling);
                range.setEndAfter(prevSibling);
            }
        }
    }
    InsertCaretAfter(node) {
        if (node.parentNode.lastChild === node) {
            node.parentNode.appendChild(document.createElement('br'));
        }
        var range = document.createRange();
        range.setStartAfter(node);
        range.collapse(true);
        var selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }
    GetStringBeforeCaret(length = 1) {
        var selection = window.getSelection();
        var range = selection.getRangeAt(0);
        var preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(this.GetCurrentNode());
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        var text = preCaretRange.toString();
        return text.length >= length ? text.substring(text.length - length, text.length) : "";
    }
    DeleteStringBeforeCaret(length = 1) {
        var selection = window.getSelection();
        var range = selection.getRangeAt(0);
        var container = range.commonAncestorContainer;
        container.textContent = container.textContent.slice(length);
    }
    IsCaretAtStartOfLine() {
        var selection = window.getSelection();
        var range = selection.getRangeAt(0);
        var container = range.startContainer;
        var offset = range.startOffset;
        if (container.nodeType === Node.TEXT_NODE && offset !== 0) return false;
        if (container.nodeName === 'DIV' && offset === 0) return true;
        if (container.nodeType !== Node.TEXT_NODE) {
            container = container.childNodes[offset];
            offset = 0;
        }
        var previousSibling = container.previousSibling;
        while (previousSibling && previousSibling.nodeType === Node.TEXT_NODE && previousSibling.textContent.trim() === '') {
            previousSibling = previousSibling.previousSibling;
        }

        return !previousSibling || ["BR", "UL", "H1", "H2", "H3", "H4", "H5", "H6"].includes(previousSibling.nodeName) || container.tagName === 'LI' && offset === 0;
    }
    GetCaretOffset() {
        var selection = window.getSelection();
        var range = selection.getRangeAt(0);
        return range.startOffset;
    }
    GetAllTextNodesTillBR() {
        var selection = window.getSelection();
        var range = selection.getRangeAt(0);
        var container = range.startContainer;
        var offset = range.startOffset;
        var nodes = [];
        if (container.nodeType !== Node.TEXT_NODE) {
            if (container.childNodes.length === 0) return [];
            container = container.childNodes[offset];
        }
        else if (container.nodeType === Node.TEXT_NODE) {
            var splitText = container.textContent.substring(offset);
            if (splitText.length) {
                var text = document.createTextNode(splitText);
                nodes.push(text);
                container.textContent = container.textContent.slice(0, offset);
            }
            if (container.nextSibling === undefined || container.nextSibling === null) return nodes;
            container = container.nextSibling;
        }
        while (true) {
            if (["BR", "LI", "UL", "H1", "H2", "H3", "H4", "H5", "H6"].includes(container.nodeName)) break;
            if (container.textContent !== "") nodes.push(container);
            if (container.nextSibling === undefined || container.nextSibling === null) break;
            container = container.nextSibling;
        }
        return nodes;
    }
    InsertBrIfLastNode(node) {
        if (node !== node.parentNode.lastElementChild) return;
        node.parentNode.appendChild(document.createElement('br'));
    }
    GetAllSelectedText() {
        const selection = window.getSelection();

        if (!selection.rangeCount) {
            return '';
        }
        const range = selection.getRangeAt(0);
        const allText = Array.from(range.cloneContents().childNodes).every(node => node.nodeType === 3);
        if (!allText) return '';
        const selectedText = Array.from(range.cloneContents().childNodes).map(node => node.textContent).join('');
        range.deleteContents();
        return selectedText;
    }

    // Inline element functions
    GetInlineElement(className, content = "") {
        let inlineElement = document.createElement('span');
        let text = document.createTextNode("\u200B" + content);
        inlineElement.appendChild(text);
        inlineElement.className = "inline-element " + className;
        return inlineElement;
    }
    InsertInlineElement(className, content = "") {
        let inlineElement = this.GetInlineElement(className, content + this.GetAllSelectedText());
        this.InsertNodeAfterCaret(document.createTextNode("\u200B"));
        this.InsertNodeAfterCaret(inlineElement);
        this.InsertCaretInsideStart(inlineElement, 1);
        return inlineElement;
    }

    // Key down functions
    EditableNodeKeydown(event) {
        this.EnsureCaretInView();
        switch (event.key) {
            case 'Enter':
                this.EnterKeyDown(event);
                return;
            case 'Backspace':
                this.BackSpaceKeyDown(event);
                return;
            case 'Tab':
                this.TabKeyDown(event);
                return;
        }
    }
    EnterKeyDown(event) {
        event.preventDefault();
        if (this.currentNode.tagName.match(/^H[1-6]$/) && this.GetCaretOffset() === 0) {
            this.currentNode.insertAdjacentElement('beforebegin', document.createElement('br'))
            return;
        }
        if (this.currentNode.tagName.match(/^H[1-6]$/)) {
            var nodes = this.GetAllTextNodesTillBR();
            var mainContainer = this.currentNode.parentNode;
            var nextSibling = this.currentNode.nextSibling;
            nodes.forEach(node => {
                if (nextSibling) {
                    mainContainer.insertBefore(node, nextSibling);
                } else {
                    mainContainer.appendChild(node);
                }
            });
            if (nextSibling) mainContainer.insertBefore(document.createElement('br'), nextSibling);
            this.InsertCaretAfter(nodes.length ? nodes.at(-1) : this.currentNode);
            return;
        }
        if (this.currentNode.tagName === "LI" && !event.shiftKey) {
			var nodes = this.GetAllTextNodesTillBR();
			if (nodes.length === 0 && this.GetCaretOffset() === 0) {
				var currentListContainer = this.currentNode.parentElement;
				while (currentListContainer.tagName === "UL") {
					if (this.currentNode === currentListContainer.lastElementChild) {
						currentListContainer.insertAdjacentElement('afterend', this.currentNode);
					}
					else {
						var newul = document.createElement('ul');
						var listItems = Array.from(currentListContainer.childNodes);
						listItems = listItems.slice(listItems.indexOf(this.currentNode))
						listItems.forEach(item => { newul.appendChild(item) });
						currentListContainer.insertAdjacentElement('afterend', this.currentNode);
						this.currentNode.insertAdjacentElement('afterend', newul);
					}
					if (currentListContainer.childNodes.length === 0) {
						currentListContainer.remove();
					}
					currentListContainer = this.currentNode.parentElement;
				}
				this.InsertCaretAfter(this.currentNode);
				let nextSib = this.currentNode.nextSibling;
				if (nextSib && nextSib.tagName !== 'BR') {
					var br = document.createElement('br');
					this.insertBefore(br, nextSib);
					nextSib = br;
				}
				this.currentNode.remove();
				return;
			}
			var listElement = document.createElement('li');
			nodes.forEach(node => { listElement.appendChild(node) });
			this.currentNode.insertAdjacentElement('afterend', listElement);
			this.InsertCaretInsideStart(listElement);
			return;
        }
        if (this.currentNode.classList.contains('note-link')) {
            LinkClicked(this.currentNode.innerText.replace(/\u200B/g, ''));
            return;
        }
        this.InsertNodeBeforeCaret(document.createElement('br'));
    }
    BackSpaceKeyDown(event) {
        if (this.GetCurrentTextNode().textContent === '\u200B') { // This indicates either inside an inline element or after an inline element or inside a code block
            event.preventDefault();
            let currentTextNode = this.GetCurrentTextNode();
            let span;
            let insertEnd = false;
            if (currentTextNode.parentNode.className.includes("inline-element")) { // Inside inline element
                currentTextNode.parentNode.nextSibling.remove(); // trailing zero width space
                span = currentTextNode.parentNode;
            }
            else if (currentTextNode.parentNode.className.includes("code-block")) { // Inside a code block (no zero width after)
                span = currentTextNode.parentNode;
            }
            else {//After inline element
                span = currentTextNode.previousElementSibling;
                span.textContent = span.textContent.replace(/[\u200B]/g, '');
                insertEnd = true;
            }
            event.preventDefault();
            currentTextNode.remove();

            for (var i = 0; i < span.childNodes.length; i++) {
                var newNode = span.childNodes[i].cloneNode(true);
                span.parentNode.insertBefore(newNode, span);
                if (!insertEnd && i === 0) {
                    this.InsertCaretBefore(newNode);
                }
            }

            span.remove();
            return;
        }
        if (this.currentNode.tagName.match(/^H[1-6]$/) && this.GetCaretOffset() === 0) {
            event.preventDefault();
            var tagname = this.currentNode.tagName.toLowerCase();
            var level = parseInt(tagname[1]) - 1;
            if (level === 0) {
                for (var i = 0; i < this.currentNode.childNodes.length; i++) {
                    var newNode = this.currentNode.childNodes[i].cloneNode(true);
                    this.currentNode.parentNode.insertBefore(newNode, this.currentNode);
                    if (i === 0) this.InsertCaretBefore(this.currentNode.previousSibling);
                }
                this.currentNode.insertAdjacentElement('afterend', document.createElement('br'));
                this.currentNode.remove();
                return;
            }
            tagname = 'h' + level;
            var heading = document.createElement(tagname);
            for (var i = 0; i < this.currentNode.childNodes.length; i++) {
                var newNode = this.currentNode.childNodes[i].cloneNode(true);
                heading.appendChild(newNode);
            }
            this.currentNode.replaceWith(heading);
            heading.classList.add('focus');
            this.InsertCaretInsideStart(heading);
            return;
        }
        if (this.currentNode.tagName === "LI" && this.GetCaretOffset(this.currentNode) === 0 && window.getSelection().isCollapsed) {
            event.preventDefault();
            var currentListContainer = this.currentNode.parentElement;
            while (currentListContainer.tagName === "UL") {
                if (this.currentNode === currentListContainer.lastElementChild) {
                    currentListContainer.insertAdjacentElement('afterend', this.currentNode);
                }
                else {
                    var newul = document.createElement('ul');
                    var listItems = Array.from(currentListContainer.childNodes);
                    listItems = listItems.slice(listItems.indexOf(this.currentNode))
                    listItems.forEach(item => { newul.appendChild(item) });
                    currentListContainer.insertAdjacentElement('afterend', this.currentNode);
                    this.currentNode.insertAdjacentElement('afterend', newul);
                }
                if (currentListContainer.childNodes.length === 0) {
                    currentListContainer.remove();
                }
                currentListContainer = this.currentNode.parentElement;
            }
            var nodes = this.currentNode.childNodes;
            this.InsertCaretAfter(this.currentNode);
            let nextSib = this.currentNode.nextSibling;
			if (nextSib && nextSib.tagName !== 'BR') {
                var br = document.createElement('br');
                this.insertBefore(br, nextSib);
                nextSib = br;
            }
            while (nodes.length) {
                if (nextSib) {
                    this.insertBefore(nodes[0], nextSib);
                }
                else {
                    this.appendChild(nodes[0]);
                }
            }
            this.currentNode.remove();
            return;
        }
    }
    TabKeyDown(event) {
        if (this.currentNode.tagName === 'LI') {
            event.preventDefault();
            if (event.shiftKey) {
                if (!['UL', 'LI'].includes(this.currentNode.parentElement.parentElement.tagName)) return
                const currentListContainer = this.currentNode.parentElement;
                if (this.currentNode === currentListContainer.lastElementChild) {
                    currentListContainer.insertAdjacentElement('afterend', this.currentNode);
                }
                else {
                    var newul = document.createElement('ul');
                    var listItems = Array.from(currentListContainer.childNodes);
                    listItems = listItems.slice(listItems.indexOf(this.currentNode))
                    listItems.forEach(item => { newul.appendChild(item) });
                    currentListContainer.insertAdjacentElement('afterend', this.currentNode);
                    this.currentNode.insertAdjacentElement('afterend', newul);
                }
                if (currentListContainer.childNodes.length === 0) {
                    currentListContainer.remove();
                }
                this.InsertCaretInsideStart(this.currentNode);
                return;
            }
            const nestedList = document.createElement(this.currentNode.parentElement.tagName);
            this.currentNode.insertAdjacentElement('afterend', nestedList);
            nestedList.appendChild(this.currentNode);
            this.InsertCaretInsideStart(this.currentNode);
            return;
        }
    }
    // Before Input event handler. Note: Added due to keydown event.key not working on Chrome Android
    EditableNodeBeforeInput(event) {
        if (event.data != '`' && this.currentNode.tagName === 'SPAN' && !this.currentNode.classList.contains('italic')) return; // Span Elements contain specialy rendered items and as such the following characters should not change the appearence
        switch (event.data) {
            case '#':
                this.HashInput(event);
                return;
            case ' ':
                this.SpaceInput(event);
                return;
            case '`':
                this.BackTickInput(event);
                return;
            case '[':
                this.SquareBraketInput(event);
                return;
            case '*':
                this.AstrixInput(event);
                return;
            case '-':
                this.DashInput(event);
                return;
        }
    }
    HashInput(event) {
        if (this.IsCaretAtStartOfLine()) {
            var tagname = 'h1';
            var level = 0;
            if (this.currentNode.tagName.match(/^H[1-6]$/)) {
                level = parseInt(this.currentNode.tagName[1]);
                tagname = 'h' + (level + (level < 6));
            }
            var heading = document.createElement(tagname);
            if (tagname != 'h1') {
                for (var i = 0; i < this.currentNode.childNodes.length; i++) {
                    heading.appendChild(this.currentNode.childNodes[i].cloneNode(true));
                }
                this.currentNode.replaceWith(heading);
            } else {
                var nodes = this.GetAllTextNodesTillBR();
                nodes.forEach(node => {
                    heading.appendChild(node);
                });
                this.InsertNodeAfterCaret(heading);
                if (heading.nextElementSibling.nodeName === 'BR') {
                    heading.nextElementSibling.remove();
                }
            }
            if (heading.innerHTML === "") heading.appendChild(document.createElement('br'));
            heading.classList.add('focus');
            this.InsertCaretInsideStart(heading);
            event.preventDefault();
            return;
        }
    }
    SpaceInput(event) {
        if (this.GetCaretOffset() === 1 && this.GetStringBeforeCaret(1) === "-") {
            event.preventDefault();
            this.DeleteStringBeforeCaret(1);
            var listContainer = document.createElement('ul');
            var listElement = document.createElement('li');
            var nodes = this.GetAllTextNodesTillBR();
            nodes.forEach(node => {
                listElement.appendChild(node);
            });
            listContainer.appendChild(listElement);
            this.InsertNodeAfterCaret(listContainer);
            if (listContainer.nextElementSibling && listContainer.nextElementSibling.tagName === 'BR') listContainer.nextElementSibling.remove();
            this.InsertCaretInsideStart(listElement);
            return;
        }
    }
    BackTickInput(event) {
        if (this.currentNode.className.includes('code-block')) {
            if (this.GetStringBeforeCaret(1) !== "\u200B") return;
            event.preventDefault();
            let codeBlock = document.createElement('span');
            codeBlock.className = "code-block";
            codeBlock.append(document.createTextNode("\u200B"));
            codeBlock.setAttribute('spellcheck', false);
            while (this.currentNode.firstChild) codeBlock.append(this.currentNode.firstChild);
            this.currentNode.nextSibling.remove();
            this.currentNode.replaceWith(codeBlock);
            this.InsertCaretInsideStart(codeBlock, 1);
            this.InsertBrIfLastNode(codeBlock);
            return;
        }
        event.preventDefault();
        let inlineCodeBlock = this.InsertInlineElement('code-block');
        inlineCodeBlock.setAttribute('spellcheck', false);
    }
    SquareBraketInput(event) {
        event.preventDefault();
        let noteLink = this.InsertInlineElement("note-link");
        noteLink.setAttribute('onclick',`let linkText = this.innerText.replace(/\u200B/g, ''); LinkClicked(linkText);`);
        noteLink.setAttribute('spellcheck', 'false');
        return;
    }
	AstrixInput(event){
		event.preventDefault();
        if (this.currentNode.className.includes('italic') && this.GetStringBeforeCaret(1) === "\u200B"){
            let b = this.GetInlineElement('bold');
            while (this.currentNode.firstChild) b.append(this.currentNode.firstChild);
			this.currentNode.replaceWith(b);
			this.InsertCaretInsideStart(b, 1);
			return;	
		}
        this.InsertInlineElement('italic');
    }
    DashInput(event) {
        if (this.GetCaretOffset() === 2 && this.GetStringBeforeCaret(2) === "--") {
            event.preventDefault();
            this.DeleteStringBeforeCaret(2);
            let hr = document.createElement('hr');
            this.InsertNodeAfterCaret(hr);
            this.InsertCaretAfter(hr);
            return;
        }
    }
}

function LinkClicked(linkText){
    if (linkText.startsWith("http") || linkText.startsWith("file")) {
        window.open(linkText, "_blank");
        return;
    }
    currentNoteName = linkText;
    openSelectedNote();
}

customElements.define('editable-div', EditableDiv);
