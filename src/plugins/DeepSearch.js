function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

function createDeepSeachElement() {
    let overlayContainer = document.getElementById('overlay-container');
    let deepSearchContainer = document.createElement('div');
    deepSearchContainer.id = 'deep-search-container';
    deepSearchContainer.classList.add('hidden');
    let searchBox = document.createElement('input');
    let results = document.createElement('div');
    searchBox.type = 'text';
    searchBox.id = 'deep-search-searchbox';
    searchBox.placeholder = "Search...";
    searchBox.oninput = throttle(() => {
        setTimeout(() => {
            let searchString = searchBox.value;
            let filtered = [];
            Notes.forEach((note, title) => {
                if (note.includes(searchString) || title.includes(searchString)) {
                    filtered.push([title, note]);
                }
            })
            results.replaceChildren(document.createElement('hr'));
            filtered.forEach(([title, note]) => {
                let h1 = document.createElement('h1');
                h1.append(getLinkElement(title));
                results.append(h1);
                results.innerHTML += note;
                results.append(document.createElement('hr'));
            })
        },0)
    });
    results.id = 'deep-search-results';
    deepSearchContainer.append(searchBox);
    deepSearchContainer.append(results);
    overlayContainer.append(deepSearchContainer);
}

document.addEventListener('notes-loaded', createDeepSeachElement);

document.addEventListener('keydown', (event) => {
    if ("dD".includes(event.key) && event.altKey) {
        event.preventDefault();
        var overlayContainer = document.getElementById("overlay-container");
        overlayContainer.classList.remove("hidden");
        for(let node of overlayContainer.children) {
            node.classList.add('hidden');   
        }
        var deepSearchContainer = document.getElementById('deep-search-container');
        if (deepSearchContainer === null) deepSearchContainer = createDeepSeachElement();
        deepSearchContainer.classList.remove("hidden");
        var searchBox = document.getElementById('deep-search-searchbox');
        searchBox.focus();
    }
})
