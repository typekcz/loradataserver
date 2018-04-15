class VisualizerOptions {
    /**
     * Generates form for setting visualizer options.
     * @param element where to insert form elements
     * @param options object describing visualizer options
     * @param submitButton should submit button be added
     * @param values of visualizer options to be filled into form
     */
    public static render(element: HTMLElement, options, submitButton?: boolean, values?){
        while(element.firstChild)
            element.removeChild(element.firstChild);
        for(let optionName in options){
            let option = options[optionName];
            let input;
            switch(option.input){
                case "select": {
                    input = buildElement(
                        "select", {name: optionName},
                        option.values.map((val) => buildElement("option", {value: val}, val))
                    );
                } break;
				case "number": {
					input = buildElement(
						"input", {type: "number", name: optionName, min: option.min, max: option.max, value: option.default, step: option.step}
					);
				} break;
                case "text": {
                    input = buildElement(
						"input", {type: "text", name: optionName, value: option.default}
					);
                } break;
            }
            if(values && values[optionName]){
                input.value = values[optionName];
            }
            let children = [buildElement("label", {}, [option.label, input])];
            if(option.optionsForValue){
				let optionGroups = {};
                for(let val in option.optionsForValue){
                    let group = buildElement("div", {"data-forValue": val});
                    this.render(group, option.optionsForValue[val], false, values);
					group.hidden = true;
                    children.push(group);
					optionGroups[val] = group;
					group.hidden = input.value != val;
                }
				input.addEventListener("change", (event: Event) => {
					console.log(event, optionGroups);
					for(let val in optionGroups){
						optionGroups[val].hidden = val != (<HTMLInputElement>(event.target)).value;
					}
				});
            }
			element.appendChild(buildElement("div", {}, children));
        }
        let submitButtonDefined = typeof(submitButton) !== "undefined";
        if((submitButtonDefined && submitButton) || (!submitButtonDefined && element.tagName === "FORM"))
		      element.appendChild(buildElement("input", {type: "submit", value: "Update options"}));
    }
}
