/**
 * Assembles object from query string.
 * @param data object serializable into query string
 * @returns query string without leading question mark
 */
function queryString(data: Object){
	return Object.keys(data).map(
		key => encodeURIComponent(key) + "=" + encodeURIComponent(data[key])
	).join("&");
}

/**
 * Gets ancestor of the HTML element by specified number of levels.
 */
function getAncestor(element: HTMLElement, levels: number): HTMLElement{
    for (var i = 0; i < levels; i++) {
        element = element.parentElement;
    }
	return element;
}

/**
 * Serializes the form into the object. Allows to nesting objects by using dots in form input element names.
 * It also allows you to indicate arrays in the form names using "[]" to group values with the same name.
 * Skips hidden, disabled or unmodified elements.
 * @param form which to serialize
 * @param all if true, it also processes hidden or unchanged elements
 */
function parseForm(form: HTMLFormElement, all?: boolean): any{
	let data = {};
	for(let i = 0; i < form.length; i++){
		let input: HTMLInputElement = form[i];

		if(
			input.name && !input.readOnly && !input.disabled && input.offsetParent
		){
			if(input.type === "radio" || input.type === "checkbox"){
				if(!input.checked)
					continue;
			} else {
				if(input.value == input.defaultValue && input.type !== "hidden" && !all)
					continue;
			}
		} else
			continue;

		let splitName = input.name.split(".");
		let node = data;
		let n;
		for(let i = 0; i < splitName.length; i++){
			n = splitName[i];
			let isArray = n.endsWith("[]");
			if(isArray)
				n = n.substr(0, n.length - 2);
			if(node instanceof Array){
				if(!node.length || typeof(node[node.length - 1][n]) !== "undefined"){
					node.push({});
				}
				node = node[node.length - 1];
			}
			if(typeof(node[n]) === "undefined"){
				if(isArray){
					node[n] = [];
				} else {
					node[n] = {};
				}
			} else {
				node[n];
			}
			if(i < splitName.length - 1)
			 	node = node[n];
		}
		if(node[n] instanceof Array){
			node[n].push(input.value);
		} else {
			node[n] = input.value;
		}
	}

	return data;
}

/**
 * Creates a new element but does not append it anywhere
 * @param name of HTML element (div, h1, input, ...)
 * @param attributes of HTML element ({type: "text", value: "foo"})
 * @param children to be appended into created element, if string passed string it will be appended as text node
 * @returns created element
 */
function buildElement(name: string, attributes: {[key:string]: string}, children?: HTMLElement | string | (HTMLElement | string)[]): HTMLElement{
    let el = document.createElement(name);
    for(let attrName in attributes){
		if(typeof(attributes[attrName]) !== "undefined")
        	el.setAttribute(attrName, attributes[attrName]);
    }
    if(children){
        if(!(children instanceof Array)){
            children = [children];
        }
        for(let child of children){
            if(typeof(child) == "string"){
                el.appendChild(document.createTextNode(child));
            } else if(child instanceof HTMLElement){
                el.appendChild(child);
            }
        }
    }
    return el;
}

/**
 * Searches for element with specified class in reverse.
 * @returns found element
 */
function reverseClassQuery(element: HTMLElement, className: string){
	while(element && !element.classList.contains(className)){
		element = element.parentElement;
	}
	return element;
}

function dateTimeInput(input: HTMLInputElement){
	let parent = input.parentElement;
	let date = (parent.querySelector("input[type=date]") as HTMLInputElement).value || (new Date()).toISOString().split("T")[0];
	let time = (parent.querySelector("input[type=time]") as HTMLInputElement).value;
	(parent.querySelector("input[type=hidden]") as HTMLInputElement).value = date + ((time)? " " + time: "");
}

/**
 * Appends specified JavaScript file to document head.
 * @returns Promise that will be resolved after script was loaded and executed.
 */
function loadScript(url){
	return new Promise((resolve, reject) => {
		let script = document.createElement('script');
		document.head.appendChild(script);
		script.onload = () => {
			resolve();
		}
		script.src = url;
	});
}

/**
 * Sets all form elements as read only.
 */
function readOnlyForm(form: HTMLFormElement){
	for(let i = 0; i < form.length; i++){
		let input: HTMLInputElement = form[i];
		if(input.type == "submit" || input.type == "button"){
			input.hidden = true;
		}
		input.readOnly = true;
	}
}

/**
 * Removes parent of specified element.
 */
function deleteParent(element: HTMLElement){
	element.parentElement.parentElement.removeChild(element.parentElement);
}

/**
 * Returns control to the browser to process the added elements or other things that require browser intervention before continuing.
 */
function returnControlToBrowser(){
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}

/// Helper class for loading libraries
class Loader {
	private static gChartsLoaded: boolean = false;
	private static gMapsLoaded: boolean = false;

	/**
	 * @returns Promise that will be resolved after library is loaded
	 */
	public static async loadGoogleMaps(){
		if(!this.gMapsLoaded){
			/* TODO: vytáhnou klíč do nějakého configu */
			await loadScript("https://maps.googleapis.com/maps/api/js?key=AIzaSyD-wn8_ZM2r9B_USpcrs4BYKs7xJylIAKE");
			this.gMapsLoaded = true;
			return;
		} else
			return;
	}

	/**
	 * @returns Promise that will be resolved after library is loaded and initialized
	 */
	public static loadGoogleCharts(){
		if(!this.gChartsLoaded){
			return new Promise(async (resolve) => {
				await loadScript("https://www.gstatic.com/charts/loader.js");
				google.charts.load('current', {'packages':['corechart', 'bar']});
				this.gChartsLoaded = true;
				google.charts.setOnLoadCallback(resolve);
			});
		} else
			return;
	}
}
