/* MIT License
 * Copyright (c) 2018 Lukáš Kotržena
 */

class ViewPages {
	private static pane: HTMLElement;
	private static appId: number;
	private static viewName: string;
	private static fields;

	/**
	 * Shows page with view visualization.
	 * @param p URL parameters, first parameter with application ID and second with view name is required
	 */
	public static async show(p: string[]){
		let view = await DAO.getView(parseInt(p[0]), p[1]);
		this.viewName = view.name;
		this.pane = App.getContentPane("page");
		this.pane.innerHTML = await (await fetch("/pages/view.tpl")).text();
		(this.pane.querySelector(".viewName") as HTMLElement).innerText = view.name;
		document.title = "View " + view.name;

		if(await App.getPermissionsForApp(view.applicationID) < Permissions.WRITE){
			(this.pane.querySelector(".title a") as HTMLElement).hidden = true;
			(this.pane.querySelector(".title button") as HTMLElement).hidden = true;
		}

		let params = this.pane.querySelector(".params") as HTMLElement;
		while(params.firstChild)
			params.removeChild(params.firstChild);

		for(let i = 0; i < view.params.length; i++){
			let p = view.params[i];
			let template = <any>this.pane.querySelector(".param-" + p.type);
			let param = template.content.cloneNode(true);
			param.querySelector(".description").innerText = p.description;
			for(let input of param.querySelectorAll("input")){
				input.name = i + 1;
			}
			params.appendChild(param);
		}
		params.hidden = (!view.params || view.params.length == 0);
		let iframe = this.pane.querySelector("iframe");
		let visualizerDir = "/visualizers/" + encodeURIComponent(view.visualizer);
		iframe.src = visualizerDir
			+ "/?appId=" + encodeURIComponent(p[0]) + "&view=" + encodeURIComponent(p[1]);
		if(view.params.length == 0){
			iframe.hidden = false;
		} else {
			iframe.hidden = true;
		}
		iframe.addEventListener("load", async () => {
			iframe.contentWindow.postMessage({jwt: await App.getJWT()}, location.origin);
		});
		App.switchToContentPane("page");
	}

	/**
	 * Generates an HTML code to insert view into website, inserts it into users clipboard and displays a message.
	 */
	public static generateEmbed(){
		let clipboardHelper = document.getElementById("clipboard-helper") as HTMLTextAreaElement;
		clipboardHelper.value = '<iframe src="' + this.pane.querySelector("iframe").src + '" style="width:800px;height:300px"></iframe>';
		clipboardHelper.focus();
		clipboardHelper.select();
		document.execCommand("copy");
		alert("HTML code has been copied into your clipboard.\r\nIf view is not public you will have to post JWT into iframe for it to work.");
	}

	/**
	 * Prepares panel with view edit form.
	 */
	public static async prepareEditPage(){
		this.pane.innerHTML = await (await fetch("/pages/viewEdit.tpl")).text();
		let colsList = this.pane.querySelector(".cols") as HTMLElement;
		colsList.hidden = true;
		let datasetSelect = this.pane.querySelector("[name=dataset]") as HTMLSelectElement;
		datasetSelect.options.add(new Option("", "", true, true));
		for(let dataset of await DAO.getDatasets(this.appId)){
			datasetSelect.options.add(new Option(dataset.name));
		}

		let visSelect = this.pane.querySelector("[name=visualizer]") as HTMLSelectElement;
		visSelect.options.length = 0;
		visSelect.options.add(new Option("", "", true, true));
		let response = await fetch(config.rest + "/info/visualizers");
		let visualizers = await response.json();
		for(let vis of visualizers.result){
			visSelect.options.add(new Option(vis.displayName, vis.name));
		}
	}

	/**
	 * Shows page with form for creating new view.
	 * @param p URL parameters, first parameter with application ID is required
	 */
	public static async showNew(p: string[]){
		document.title = "New view";
		this.appId = parseInt(p[0]);
		this.pane = App.getContentPane("page");
		await this.prepareEditPage();
		(this.pane.querySelector(".title .delete") as HTMLElement).hidden = true;
		this.pane.querySelector("#editViewForm").setAttribute("data-action", "insert");
		App.switchToContentPane("page");
	}

	/**
	 * Shows page with form for editing view.
	 * @param p URL parameters, first parameter with application ID and second with view name is required
	 */
	public static async showEdit(p: string[]){
		this.appId = parseInt(p[0]);
		let view = await DAO.getView(parseInt(p[0]), p[1]);
		this.viewName = view.name;
		document.title = "Edit view " + view.name;
		this.pane = App.getContentPane("page");

		await this.prepareEditPage();
		let form = this.pane.querySelector("#editViewForm") as HTMLFormElement;

		if(await App.getPermissionsForApp(view.applicationID) < Permissions.WRITE){
			(this.pane.querySelector(".title button") as HTMLElement).hidden = true;
			readOnlyForm(form);
		}

		form.setAttribute("data-action", "update");
		(form["name"] as any).value = view.name;
		(form["name"] as any).readOnly = true;
		form["public"].checked = view.public;
		if(typeof(view.query) === "string"){
			form["formtype"].value = "advanced";
			ViewPages.editFormTypeChanged(form["formtype"]);
			form["query"].value = view.query;
			for(let p of view.params)
				this.addParameter(p);
		} else {
			form["formtype"].value = "simple";
			ViewPages.editFormTypeChanged(form["formtype"]);
			form["dataset"].value = view.dataset;
			await this.datasetChanged(form["dataset"] as HTMLSelectElement);
			for(let col of view.query.select){
				let checkbox = form.querySelector('input[name="query.select[]"][value=' + col.replace('"', '\\"') + ']') as HTMLInputElement;
				checkbox.checked = true;
			}
			for(let col in view.query.conditions){
				let cond = view.query.conditions[col] as any;
				if(cond instanceof Array){
					for(let c of cond){
						c.field = col;
						this.addCondition(c, view.params);
					}
				} else {
					cond.field = col;
					this.addCondition(cond, view.params);
				}
			}
		}
		form["visualizer"].value = view.visualizer;
		this.changeVisualizer(view.visualizer, view.defaultOptions);
		App.switchToContentPane("page");
	}

	/**
	 * Deletes currently displayed view.
	 */
	public static async deleteCurrent(){
		let res = await fetch(
			config.rest + "/applications/" + encodeURIComponent(this.appId.toString()) +
			"/views/" + this.viewName,
			{
				method: "DELETE",
				headers: { "grpc-metadata-authorization": await App.getJWT() }
			}
		);
		if(res.ok){
			alert("View deleted.");
			window.history.pushState(null, null, "/applications/" + encodeURIComponent(this.appId.toString()));
			App.handleLocation();
		} else {
			let body = await res.json();
			alert("Deleting failed.\r\n" + ((body.error)? body.error : res.status + " " + res.statusText));
		}
	}

	/**
	 * Handles change of data selection method
	 * @param radio element, containing changed value
	 */
	public static editFormTypeChanged(radio: HTMLInputElement){
		let simple = <HTMLElement>this.pane.querySelector(".simple");
		let advanced = <HTMLElement>this.pane.querySelector(".advanced");
		let showSimple = radio.value == "simple";

		simple.hidden = !showSimple;
		let inputs = simple.querySelectorAll("input, select, textarea") as NodeListOf<HTMLInputElement>;
		for(let input of inputs){
			input.disabled = !showSimple;
		}
		advanced.hidden = showSimple;
		inputs = advanced.querySelectorAll("input, select, textarea") as NodeListOf<HTMLInputElement>;
		for(let input of inputs){
			input.disabled = showSimple;
		}
	}

	/**
	 * Adds form elements for setting another parameter.
	 * @param param object, that will be used to fill values
	 */
	public static addParameter(param?){
		let templ = (this.pane.querySelector("template.param") as HTMLTemplateElement).content.cloneNode(true) as HTMLElement;
		if(param){
			(templ.querySelector(".type") as HTMLInputElement).value = param.type;
			(templ.querySelector(".desc") as HTMLInputElement).value = param.description;
		}
		this.pane.querySelector(".params").appendChild(templ);
	}

	/**
	 * Handles submit of view parameters form and posts them into visualizator.
	 */
	public static submitParams(event: Event){
		let formData = parseForm(<HTMLFormElement>event.currentTarget);
		for(let di in formData){
			if(formData[di] instanceof Array){
				formData[di] = (new Date(formData[di][0] + " " + formData[di][1])).toISOString();
			}
		}
		let iframe = (<HTMLIFrameElement>document.querySelector(".viewIframe"));
		console.log(formData);
		iframe.contentWindow.postMessage({params: formData}, "*");
		iframe.hidden = false;
		return false;
	}

	/**
	 * Handles change of dataset, loads dataset columns for use in another form elements.
	 * @param select that contains changed dataset
	 */
	public static async datasetChanged(select: HTMLSelectElement){
		let response = await fetch(
			config.rest + "/applications/" + encodeURIComponent(this.appId.toString()) + "/datasets/" + select.value + "?fields&limit=0",
			{headers: { "grpc-metadata-authorization": await App.getJWT() }}
		);
		this.fields = (await response.json()).fields;

		// Checkboxes for selecting columns
		let colsList = this.pane.querySelector(".cols") as HTMLElement;
		while(colsList.firstChild)
			colsList.removeChild(colsList.firstChild);
		let selectTemplate = (this.pane.querySelector("template.select") as HTMLTemplateElement);
		for(let f of this.fields){
			let col = selectTemplate.content.cloneNode(true) as HTMLElement;
			col.querySelector("input").value = f.name;
			col.querySelector("span").innerText = f.name;
			colsList.appendChild(col);
		}
		colsList.hidden = false;

		// Update column select in conditions
		let columnSelects = this.pane.querySelectorAll(".conditions .column") as NodeListOf<HTMLSelectElement>;
		for(let i = 0; i < columnSelects.length; i++){
			this.populateColumnSelect(columnSelects[0]);
		}
	}

	/**
	 * Adds condition into view form.
	 * @param condValue values used to fill inputs
	 * @param params array of params to get parameter descriptions
	 */
	public static addCondition(condValues?, params?){
		let datasetInput = (this.pane.querySelector("#editViewForm")["dataset"] as HTMLInputElement);
		if(!datasetInput.checkValidity()){
			(datasetInput as any).reportValidity(); // reportValidity is not in TypeScript definitions?
			return;
		}
		let condTemp = this.pane.querySelector("template.condition") as HTMLTemplateElement;
		let conditions = this.pane.querySelector(".conditions");
		let cond = condTemp.content.cloneNode(true) as DocumentFragment;
		let condColumn = cond.querySelector(".column") as HTMLSelectElement;
		condColumn.addEventListener("change", (event) =>
			this.setColumnConditionType(event.currentTarget as HTMLSelectElement)
		);
		cond.querySelector(".param").addEventListener("change", (event) =>
			this.switchConditionParam(event.target as HTMLInputElement)
		);
		this.populateColumnSelect(condColumn);

		if(condValues){
			(cond.querySelector(".column") as HTMLSelectElement).value = condValues.field;
			(cond.querySelector(".operator") as HTMLSelectElement).value = condValues.operator;
			if(typeof(condValues.paramIndex) !== "undefined"){
				let paramCheckbox = cond.querySelector(".param") as HTMLInputElement;
				paramCheckbox.checked = true;
				this.switchConditionParam(paramCheckbox);
				(cond.querySelector(".desc") as HTMLInputElement).value = params[condValues.paramIndex].description;
			} else {
				(cond.querySelector(".param") as HTMLInputElement).checked = false;
			}
		}

		conditions.appendChild(cond);
		return cond;
	}

	/**
	 * Swithes condition between parametric and normal.
	 * @param checkbox that is checked if condition is parametric
	 */
	public static switchConditionParam(checkbox: HTMLInputElement){
		let isParam = checkbox.checked;
		let cond = checkbox.parentElement;
		(cond.querySelector("[data-comp=value]") as HTMLElement).hidden = isParam;
		(cond.querySelector("[data-comp=param]") as HTMLElement).hidden = !isParam;
	}

	/**
	 * Fills select with values of colmuns from currently selected dataset.
	 */
	public static populateColumnSelect(select: HTMLSelectElement){
		select.options.length = 0;
		select.options.add(new Option("", "", true, true));
		for(let field of this.fields)
			select.options.add(new Option(field.name));
	}

	/**
	 * Changes the condition data type according to the selected column and displays the correct input elements for the given data type.
	 * @param fieldSelect contains value of selected column
	 */
	public static setColumnConditionType(fieldSelect: HTMLSelectElement){
		let selectedField: {name:string, type:string};
		for(let field of this.fields){
			if(field.name === fieldSelect.value){
				selectedField = field;
				break;
			}
		}
		let condition = fieldSelect.parentElement;
		let specificElements = condition.querySelectorAll("[data-for]") as NodeListOf<HTMLElement>;
		for(let i = 0; i < specificElements.length; i++){
			let specificElement = specificElements[i];
			specificElement.hidden = specificElement.getAttribute("data-for") !== selectedField.type;
		}
	}

	/**
	 * Changes visualizer and displays its options.
	 */
	public static async changeVisualizer(vis: string, values?){
		let options = await (await fetch(
			"/visualizers/" + encodeURIComponent(vis) + "/options.json",
			{headers: { "grpc-metadata-authorization": await App.getJWT() }}
		)).json();
		VisualizerOptions.render(this.pane.querySelector(".options"), options, false, values);
	}

	/**
	 * Handles submit of form for editing or creating view.
	 * @param form that was submitted
	 */
	public static submit(form: HTMLFormElement){
		(async () => {
			let data = parseForm(form);
			let view: {
				name: string,
				dataset?: string,
				query: string | {select: string[], conditions: any},
				params: {description: string, type: string}[],
				visualizer: string,
				defaultOptions?: any,
				public: boolean
			} = {
				name: data.name,
				query: null,
				params: [],
				visualizer: data.visualizer,
				public: form["public"].checked
			};

			if(data.formtype === "advanced"){
				view.query = data.query;
				view.params = data.params;
			} else if(data.formtype === "simple"){
				view.query = {
					select: data.query.select,
					conditions: {}
				}
				view.dataset = data.dataset;

				let paramI = 0;
				for(let c of data.query.conditions){
					let col = c.column;
					let cond: any = {
						operator: c.operator
					};
					if(c.param){
						cond.paramIndex = paramI;
						view.params.push({
							description: c.paramDesc,
							type: this.fields.find(f => f.name === col).type
						});
					} else {
						cond.value = c.value;
					}
					if(typeof(view.query.conditions[col]) === "undefined"){
						view.query.conditions[col] = cond;
					} else if(view.query.conditions[col] instanceof Array){
						view.query.conditions[col].push(cond);
					} else {
						view.query.conditions[col] = [view.query.conditions[col], cond];
					}
				}
			}
			view.defaultOptions = parseForm(this.pane.querySelector(".options"));
			let url = config.rest + "/applications/" + encodeURIComponent(this.appId.toString()) + "/views";
			let method = "POST";
			if(form.getAttribute("data-action") === "update"){
				url += "/" + (form["name"] as any).value;
				method = "PUT";
			}
			let res = await fetch(url, {
				method,
				headers: {
					"content-type": "application/json",
					"grpc-metadata-authorization": await App.getJWT()
				},
				body: JSON.stringify(view)
			});

			if(res.ok)
				alert("View saved.");
			else {
				let body = await res.json();
				alert("Saving view failed.\r\n" + ((body.error)? body.error : res.status + " " + res.statusText));
			}
		})();
		return false;
	}
}
