// This JS file implements a html editor app around the EditableDiv element
//
// TODO:
// - Make the notes loaded event be something more like 'editor-core-initalised' so plugins can start initalising
// - Key map system
// - Plugin management system 
// - Callback / event system for plugins to attach to and class encapsulation
// - Link handling system (for when note names change, links should also change)
// - Window system
// - Add a grep like, live preview search system
// - Improve search CSS
// - Reminder system
//
// System Redesign:
// Every node in the document could be converted into a type that extends the basic node by inheriting a "Editable" interface
// The "Editable" interface will implement functions for handling keypresses, deletion, selection, copy, paste and arrow key movements
//
// Editor core could simply orgainse events on the editor element that plugins would react to
// Core plugins would be the search system, quickswitch system, deepsearch
// Editor core would assign key bindings to events. there would be a plugin api for adding or configuring key bindings


var currentNoteName = "";
var Notes = new Map();
var selected = 0;

// For showing quickswicth
const interactedNotes = [];
let interactedSelected = 0;
let tabShowing = false;

function loadNotes() {
	fetch(`${apiUrl}/load`)
		.then(response => response.json())
		.then(data => {
			const newEntries = Object.entries(data);
			newEntries.forEach(([key, value]) => {
				Notes.set(key, value);
			});
			searchForNote();
			var searchInput = document.getElementById('search-input');
			searchInput.focus();
			document.dispatchEvent(new Event('notes-loaded'));
		})
		.catch(error => {
			console.error('There was a problem with the fetch operation:', error);
		});
}

function saveNote(currentNote, noteName) {
	Notes.set(noteName, currentNote);
	fetch(`${apiUrl}/save`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ [noteName]: Notes.get(noteName) }),
	});
}

function renameNote(oldName, newName) {
	Notes.set(newName, Notes.get(oldName));
	Notes.delete(oldName);
	fetch(`${apiUrl}/save`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ [newName]: Notes.get(newName) })
	})
		.then(() => {
			fetch(`${apiUrl}/delete`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: oldName,
			});
		});
}

function deleteNote(name) {
	Notes.delete(name);
	deleteInteractedRecord(name);
	fetch(`${apiUrl}/delete`, {
		method: 'POST',
		headeFs: {
			'Content-Type': 'application/json',
		},
		body: name,
	});
}

function EditableNodeInput(event, node) {
	var currentNote = document.getElementById("note-div").innerHTML;
	var noteName = document.getElementById("note-title").innerHTML;
	saveNote(currentNote, noteName);
}

// Algorithm for measuring the number of single character edits required to change a -> b
function levenshteinDistance(a, b) {
	const matrix = Array(b.length + 1).fill().map(() => Array(a.length + 1).fill(0));

	for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
	for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

	for (let j = 1; j <= b.length; j++) {
		for (let i = 1; i <= a.length; i++) {
			const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
			matrix[j][i] = Math.min(
				matrix[j][i - 1] + 1,
				matrix[j - 1][i] + 1,
				matrix[j - 1][i - 1] + indicator
			);
		}
	}

	return matrix[b.length][a.length];
}

function searchForNote() {
	var text = document.getElementById('search-input').value;
	var searchResults = document.getElementById('search-results');
	let filtered = [...Notes.keys()].filter(str => {
		let lastIndex = -1;
		for (let char of text.toLowerCase()) {
			const currentIndex = str.toLowerCase().indexOf(char, lastIndex + 1);
			if (currentIndex === -1 || currentIndex <= lastIndex) {
				return false;
			}
			lastIndex = currentIndex;
		}
		return true;
	});

	if (text.length > 3 || filtered.length < 10) {
		filtered = filtered.map(str => ({
			string: str,
			distance: levenshteinDistance(text.toLowerCase(), str.toLowerCase())
		}))
		filtered = filtered.sort((a, b) => a.distance - b.distance)
		filtered = filtered.map(item => item.string)
	}

	if (text.length && !filtered.includes(text)) {
		filtered.push(text);
	}

	if (selected < 0) selected = filtered.length - 1;
	if (selected === filtered.length) selected = 0;

	searchResults.innerHTML = ""; // Clear existing results
	filtered.forEach((title, index) => {
		var newNote = document.createElement('div');
		newNote.className = index === selected ? "search-result-selected" : "search-result";
		newNote.innerHTML = title;
		newNote.addEventListener('click', () => {
			currentNoteName = title;
			openSelectedNote();
		});
		searchResults.appendChild(newNote);
	});
}

function searchInput(event) {
	const restrictedKeys = /[\\:*?"<>|]/;
	if (restrictedKeys.test(event.key)) {
		event.preventDefault();
		return;
	}
	var searchResults = document.getElementById('search-results');
	currentNoteName = searchResults.childNodes[selected].innerHTML;
	if (event.key === "Delete" && event.ctrlKey) {
		deleteNote(currentNoteName);
	}
	searchForNote();
}

function openSelectedNote() {
	if (currentNoteName == "") {
		currentNoteName = [...Notes.keys()][0];
	}
	if (!Notes.has(currentNoteName)) {
		Notes.set(currentNoteName, "<br>");
	}
	var noteTitle = document.getElementById('note-title');
	var noteDiv = document.getElementById('note-div');
	noteTitle.innerHTML = currentNoteName;
	noteDiv.innerHTML = Notes.get(currentNoteName);
	var searchOverlay = document.getElementById("search-container");
	var overlayContainer = document.getElementById("overlay-container");
	searchOverlay.classList.add("hidden");
	overlayContainer.classList.add("hidden");
	noteDiv.insertCaret();
	markAsInteracted(currentNoteName);
	if (noteDiv.firstChild.tagName === 'SCRIPT') {
		let script = document.createElement('script');
		script.textContent = noteDiv.firstChild.textContent;
		noteDiv.firstChild.replaceWith(script);
	}
}

function markAsInteracted(name) {
	deleteInteractedRecord(name)
	interactedNotes.unshift(name);
}

function renameInteracted(old, newName) {
	const index = interactedNotes.indexOf(old);
	if (index !== -1) {
		interactedNotes[index] = newName;
	}
}

function deleteInteractedRecord(name) {
	const index = interactedNotes.indexOf(name);
	if (index !== -1) {
		interactedNotes.splice(index, 1);
	}
}

function displayInteractedNotes() {
	if (interactedSelected < 0) interactedSelected = interactedNotes.length - 1;
	if (interactedSelected === interactedNotes.length) interactedSelected = 0;
	var searchResults = document.getElementById('search-results');
	searchResults.innerHTML = ""; // Clear existing results
	interactedNotes.forEach((title, index) => {
		var newNote = document.createElement('div');
		newNote.className = index === interactedSelected ? "search-result-selected" : "search-result";
		newNote.innerHTML = title;
		newNote.addEventListener('click', () => {
			currentNoteName = title;
			openSelectedNote();
		});
		searchResults.appendChild(newNote);
	});
}

function openSearch(){
	var overlayContainer = document.getElementById("overlay-container");
	if (!overlayContainer.classList.contains("hidden")) {
		openSelectedNote();
		return;
	}
	overlayContainer.classList.remove("hidden");
	for (let node of overlayContainer.children) {
		node.classList.add('hidden');
	}
	var quickLinks = document.getElementById('quick-links');
	var searchContainer = document.getElementById('search-container');
	var searchInput = document.getElementById('search-input');
	var buttonSettings = document.getElementById('button-settings');
	searchInput.value = "";
	quickLinks.classList.remove('hidden');
	searchInput.classList.remove("hidden");
	searchContainer.classList.remove("hidden");
	overlayContainer.classList.remove("hidden");
	buttonSettings.classList.remove('hidden');
	searchInput.focus();
	if(window.matchMedia("(pointer: coarse)").matches){
		let buttonsContainer = document.getElementById('nav-buttons-container');
		buttonsContainer.classList.remove('hidden');
	}
	searchForNote();
}

document.addEventListener('keydown', (event) => {
	var searchContainer = document.getElementById('search-container');
	if ("sS".includes(event.key) && event.ctrlKey) {
		event.preventDefault();

	}
	else if (event.key === "Escape" || "aA".includes(event.key) && event.altKey) {
		event.preventDefault();
		openSearch();
	}
	else if (event.key === "Enter") {
		if (searchContainer.classList.contains("hidden")) return;
		openSelectedNote();
		event.preventDefault();
	}
	else if (event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey)) {
		if (searchContainer.classList.contains("hidden")) return;
		event.preventDefault(); // Because of tab
		selected--
		searchForNote();
	}
	else if (event.key === "ArrowDown" || event.key === "Tab") {
		if (searchContainer.classList.contains("hidden")) return;
		event.preventDefault(); // Because of tab
		selected++
		searchForNote();
	}
	else if ("qQ".includes(event.key) && event.altKey) {
		event.preventDefault();
		var overlayContainer = document.getElementById("overlay-container");
		var searchContainer = document.getElementById('search-container');
		var searchInput = document.getElementById('search-input');
		var quickLinks = document.getElementById('quick-links');
		if (interactedNotes.length === 0) return;
		if (!searchInput.classList.contains('hidden')) interactedSelected = 0;
		tabShowing = true;
		quickLinks.classList.add('hidden');
		searchInput.classList.add("hidden");
		searchContainer.classList.remove("hidden");
		overlayContainer.classList.remove("hidden");
		if (event.shiftKey) interactedSelected--;
		else interactedSelected++
		displayInteractedNotes();
	}
	else if (event.key === 'Delete' && tabShowing) {
		deleteInteractedRecord(interactedNotes[interactedSelected]);
		displayInteractedNotes();
	}
	else if ("kK".includes(event.key) && event.altKey) {
		cleanCurrentNote();
	}
});

document.addEventListener('keyup', (event) => {
	if (event.key === 'Alt') {
		if (!tabShowing) return;
		var overlayContainer = document.getElementById("overlay-container");
		var searchContainer = document.getElementById('search-container');
		var searchInput = document.getElementById('search-input');
		searchInput.classList.remove("hidden");
		searchContainer.classList.add("hidden");
		overlayContainer.classList.add("hidden");
		tabShowing = false;
		currentNoteName = interactedNotes[interactedSelected];
		openSelectedNote();
	}
})

function onLoad() {
	var noteTitle = document.getElementById('note-title');
	noteTitle.addEventListener('keydown', (event) => {
		const restrictedKeys = /[\\:*?"<>|]/;
		if (restrictedKeys.test(event.key)) event.preventDefault();
		if (event.key === "Enter") {
			event.preventDefault();
			var noteDiv = document.getElementById('note-div');
			var range = document.createRange();
			range.setStart(noteDiv, 0);
			range.setEnd(noteDiv, 0);
			var selection = window.getSelection();
			selection.removeAllRanges();
			selection.addRange(range);
		}
	});
	noteTitle.addEventListener('input', () => {
		if (Notes.has(noteTitle.innerText)) {
			// Name already tooken
			// TODO: add error to title
			return;
		}
		renameNote(currentNoteName, noteTitle.innerText)
	});
	let div = document.createElement('editable-div');
	div.id = 'note-div';
	div.addEventListener('input', () => {
		EditableNodeInput(event, div);
	});
	let noteContainer = document.getElementById('note-container');
	noteContainer.appendChild(div);

	let menuButton = document.getElementById('button-menu');
	menuButton.addEventListener('click', () => {
		openSearch();
	});
	let settingsButton = document.getElementById('button-settings');
	let settingsContainer = document.getElementById('settings-container');
	let fullscreenButton = document.createElement('svg');
	let fullscreenDescription = document.createElement('b');
	fullscreenDescription.innerHTML = "Fullscreen:";
	let returnButton = document.createElement('svg');
	fullscreenButton.className = "button";
	fullscreenButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd" d="M2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12ZM14 7.75C13.5858 7.75 13.25 7.41421 13.25 7C13.25 6.58579 13.5858 6.25 14 6.25H17C17.4142 6.25 17.75 6.58579 17.75 7V10C17.75 10.4142 17.4142 10.75 17 10.75C16.5858 10.75 16.25 10.4142 16.25 10V8.81066L14.0303 11.0303C13.7374 11.3232 13.2626 11.3232 12.9697 11.0303C12.6768 10.7374 12.6768 10.2626 12.9697 9.96967L15.1893 7.75H14ZM11.0303 12.9697C11.3232 13.2626 11.3232 13.7374 11.0303 14.0303L8.81066 16.25H10C10.4142 16.25 10.75 16.5858 10.75 17C10.75 17.4142 10.4142 17.75 10 17.75H7C6.58579 17.75 6.25 17.4142 6.25 17V14C6.25 13.5858 6.58579 13.25 7 13.25C7.41421 13.25 7.75 13.5858 7.75 14V15.1893L9.96967 12.9697C10.2626 12.6768 10.7374 12.6768 11.0303 12.9697ZM10.75 7C10.75 7.41421 10.4142 7.75 10 7.75H8.81066L11.0303 9.96967C11.3232 10.2626 11.3232 10.7374 11.0303 11.0303C10.7374 11.3232 10.2626 11.3232 9.96967 11.0303L7.75 8.81066V10C7.75 10.4142 7.41421 10.75 7 10.75C6.58579 10.75 6.25 10.4142 6.25 10V7C6.25 6.58579 6.58579 6.25 7 6.25H10C10.4142 6.25 10.75 6.58579 10.75 7ZM12.9697 14.0303C12.6768 13.7374 12.6768 13.2626 12.9697 12.9697C13.2626 12.6768 13.7374 12.6768 14.0303 12.9697L16.25 15.1893V14C16.25 13.5858 16.5858 13.25 17 13.25C17.4142 13.25 17.75 13.5858 17.75 14V17C17.75 17.4142 17.4142 17.75 17 17.75H14C13.5858 17.75 13.25 17.4142 13.25 17C13.25 16.5858 13.5858 16.25 14 16.25H15.1893L12.9697 14.0303Z" fill="#000000"></path> </g></svg>';
	fullscreenButton.addEventListener('click', () => {
		const element = document.documentElement; 
		if (element.requestFullscreen) {
			element.requestFullscreen();
		} else if (element.webkitRequestFullscreen) { // iOS Safari
			element.webkitRequestFullscreen();
		} else if (element.msRequestFullscreen) { // IE/Edge
			element.msRequestFullscreen();
		}
	})
	settingsContainer.append(fullscreenDescription);
	settingsContainer.append(fullscreenButton);
	returnButton.id = 'button-return';
	returnButton.className = 'button';
	returnButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd" d="M3.46447 3.46447C2 4.92893 2 7.28595 2 12C2 16.714 2 19.0711 3.46447 20.5355C4.92893 22 7.28595 22 12 22C16.714 22 19.0711 22 20.5355 20.5355C22 19.0711 22 16.7141 22 12C22 7.28598 22 4.92893 20.5355 3.46447C19.0711 2 16.714 2 12 2C7.28595 2 4.92893 2 3.46447 3.46447ZM9.25871 7.97395C9.56308 7.693 9.58205 7.21851 9.3011 6.91414C9.02015 6.60978 8.54565 6.5908 8.24129 6.87175L5.99129 8.94867C5.83748 9.09065 5.75 9.29045 5.75 9.49977C5.75 9.7091 5.83748 9.9089 5.99129 10.0509L8.24129 12.1278C8.54565 12.4088 9.02015 12.3898 9.3011 12.0854C9.58205 11.781 9.56308 11.3065 9.25871 11.0256L8.41824 10.2498H14.0385C15.536 10.2498 16.75 11.4638 16.75 12.9613C16.75 14.4589 15.536 15.6729 14.0385 15.6729H9.5C9.08579 15.6729 8.75 16.0086 8.75 16.4229C8.75 16.8371 9.08579 17.1729 9.5 17.1729H14.0385C16.3644 17.1729 18.25 15.2873 18.25 12.9613C18.25 10.6353 16.3644 8.74977 14.0385 8.74977H8.41824L9.25871 7.97395Z" fill="#000000"></path> </g></svg>';

	plugins.forEach(plugin => {
		let desc = document.createElement('b');
		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.checked = true;
		checkbox.addEventListener('change', (event) => {
			let scriptTag = document.getElementById(plugin);
			if(plugin.endsWith('.js')) scriptTag.src = event.target.checked ? `${apiUrl}/plugins/${plugin}` : "";
			else scriptTag.disabled = !event.target.checked;
		});
		desc.innerHTML = plugin + ":";
		settingsContainer.append(desc);
		settingsContainer.append(checkbox);
	});

	returnButton.addEventListener('click', () =>{
		settingsContainer.classList.add('hidden');      
	});
	settingsContainer.append(returnButton);
	settingsButton.addEventListener('click', () => {
		settingsContainer.classList.remove('hidden');   
	});
	let quickLinksButton = document.getElementById('quick-links-button');
	let searchButton = document.getElementById('search-button');
	let deepSearchButton = document.getElementById('deep-search-button');
	quickLinksButton.addEventListener('click', () => {
		let quicklinks = document.getElementById('quick-links');
		let searchContainer = document.getElementById('search-container');
		let deepSearch = document.getElementById('deep-search-container');
		quicklinks.classList.remove('hidden');
		searchContainer.classList.add('hidden');
		deepSearch.classList.add('hidden');
		deepSearchButton.classList.remove('selected');
		quickLinksButton.classList.add('selected');
		searchButton.classList.remove('selected');
	})
	deepSearchButton.addEventListener('click', () => {
		let quicklinks = document.getElementById('quick-links');
		let searchContainer = document.getElementById('search-container');
		let deepSearch = document.getElementById('deep-search-container');
		quicklinks.classList.add('hidden');
		searchContainer.classList.add('hidden');
		deepSearch.classList.remove('hidden');
		deepSearchButton.classList.add('selected');
		quickLinksButton.classList.remove('selected');
		searchButton.classList.remove('selected');
	});
	searchButton.addEventListener('click', () => {
		let quicklinks = document.getElementById('quick-links');
		let searchContainer = document.getElementById('search-container');
		let deepSearch = document.getElementById('deep-search-container');
		quicklinks.classList.add('hidden');
		searchContainer.classList.remove('hidden');
		deepSearch.classList.add('hidden');
		deepSearchButton.classList.remove('selected');
		quickLinksButton.classList.remove('selected');
		searchButton.classList.add('selected');
	});
	searchButton.classList.add('selected');
	let buttonsContainer = document.getElementById('nav-buttons-container');
	buttonsContainer.append(quickLinksButton);
	buttonsContainer.append(searchButton);
	buttonsContainer.append(deepSearchButton);
	if(window.matchMedia("(pointer: coarse)").matches){
		buttonsContainer.classList.remove('hidden');
	}
	loadNotes();
};

function cleanNode(node) {
	if (node.style) {
		// if style is set, remove style
		node.removeAttribute('style');
	}
	if ((node.className.includes('code-block') || node.className.includes('note-link')) && (node.spellcheck != false)) {
		node.setAttribute('spellcheck', false);
	}
	for (let child of node.children) {
		cleanNode(child);
	}
}

function removeDivs(node) {
	divs = node.querySelectorAll('div');
	divs.forEach(div => {
		while(div.childNodes.length) div.parentNode.insertBefore(div.childNodes[0], div);
		div.remove();
	});
}

function removeIllegalSpans(node) {
	spans = node.querySelectorAll('span[class=""], span:not([class])');
	spans.forEach(span => {
		while (span.childNodes.length) span.parentNode.insertBefore(span.childNodes[0], span);
		span.remove();
	});
}

function removeAllZWSP(node) {
	if (node.nodeType === Node.TEXT_NODE) {
		node.textContent = node.textContent.replaceAll('\u200B', '');
		return;
	}
	for (const child of node.childNodes) {
		removeAllZWSP(child);
	}
}

// Span should have a ZWSP at start of innerText and after node unless it is a code block
function removeIllegalZWSP(node) {
	// First remove all ZWSP
	removeAllZWSP(node);

	// Add back in the ones needed
	spans = node.querySelectorAll('span');
	spans.forEach(span => {
		//First element in text
		span.innerText = '\u200B' + span.innerText;

		if (span.className !== 'code-block') {
			if (span.nextSibling.nodeType === Node.TEXT_NODE) {
				span.nextSibling.textContent = '\u200B' + span.nextSibling.textContent;
			}
			else {
				span.nextSibling.innerText = '\u200B' + span.nextSibling.innerText;
			}
		}
	});
}

// This function can be called via the command line or with the key combo ALT + k
// It will clean the current note by:
// - Remove styles and empty classes on nodes
// - Remove div's
function cleanCurrentNote() {
	let cNote = document.getElementById('note-div');
	removeDivs(cNote);
	removeIllegalSpans(cNote);
	removeIllegalZWSP(cNote);
	cleanNode(cNote);
	// Remove trailing newlines, leave one
	while (cNote.lastChild.tagName === 'BR' && cNote.lastChild.previousSibling.tagName === 'BR') cNote.lastChild.remove();
}

function renameCalendar() {
	let calendarNotes = [...Notes.keys()].filter(str => str.includes('Calendar'));

	calendarNotes = calendarNotes.forEach(str => {
		const datepart = str.replace("Calendar/", '');
		const [year, month, day] = datepart.split('-');
		renameNote(str, `Calendar/${day}/${month}/${year}`);
	});
}

onLoad();
