// TODO:
// - When I make a new event for the editor, quicklinks should refresh on opening of the overlay when escape is pressed
//   So the search should create an event and key binding that quicklinks should subscribe to also

function getLinkElement(linkName) {
    let noteLink = document.createElement('span');
    noteLink.append(linkName);
    noteLink.className = "note-link";
    noteLink.setAttribute('onclick', `currentNoteName = this.innerText.replace(/\u200B/g, ''); openSelectedNote()`);
    return noteLink;
}

document.addEventListener('notes-loaded', () => {
    let overlayContainer = document.getElementById('overlay-container');
    let quickLinks = document.createElement('div');
    quickLinks.id = 'quick-links';

    let dateToday = new Date();
    let dateTomorrow = new Date();
    let boldTextTomorrow = document.createElement('b');
    let boldTextToday = document.createElement('b');
    boldTextToday.innerText = "Today: ";
    dateTomorrow.setDate(dateToday.getDate() + 1);  
    boldTextTomorrow.innerText = "Tomorrow: ";
    quickLinks.append(boldTextToday);
    quickLinks.append(getLinkElement("Calendar/" + dateToday.toISOString().slice(0, 10).replace(/-/g, '/')));
    quickLinks.append(boldTextTomorrow);
    quickLinks.append(getLinkElement("Calendar/" + dateTomorrow.toISOString().slice(0, 10).replace(/-/g, '/')));
    
	if(window.matchMedia("(pointer: coarse)").matches){
		quickLinks.classList.add('hidden');
	}

    overlayContainer.append(quickLinks);
})
