class DatasetPages {
    private static pane: HTMLElement;
    private static appId: number;
    private static dataset: string;

    /**
     * Prepares panel with dataset edit form.
     */
	public static async prepareEditPage(){
		this.pane.innerHTML = await (await fetch("/pages/datasetEdit.tpl")).text();
	}

    /**
     * Page that shows dataset values in table.
     * @param p URL parameters, first parameter with application ID and second with dataset name is required
     */
    public static async showData(p: string[]){
        this.dataset = p[1];
        this.appId = parseInt(p[0]);
        document.title = "Dataset " + this.dataset;
        let values = await DAO.getDatasetValues(this.appId, this.dataset);
        let table = "<tr>";
        for(let col in values[0])
            table += "<th>" + col + "</th>";
        table += "</tr>";
        for(let row of values){
            table += "<tr>";
            for(let col in row)
                table += "<td>" + row[col] + "</td>";
            table += "</tr>";
        }

        let pane = App.getContentPane("datasetValues");
        pane.querySelector("table").innerHTML = table;
        (pane.querySelector(".name") as HTMLElement).innerText = this.dataset;

        App.switchToContentPane("datasetValues");
    }

    /**
     * Page that shows form for creating new dataset.
     * @param p URL parameters, first parameter with application ID is required
     */
	public static async showNew(p: string[]){
        document.title = "New dataset";
		this.pane = <HTMLFormElement>App.getContentPane("page");
		await this.prepareEditPage();
		let cols = this.pane.querySelectorAll(".column");
		for(let i = 1; i < cols.length; i++){
			cols[i].remove();
		}
        this.appId = parseInt(p[0]);
		Transparency.render(
			this.pane,
			{
				appId: p[0],
				datasetName: "",
				columns: [
					{name: "", type: "", size: ""}
				]
			}
		);
		App.switchToContentPane("page");
	}

    /**
     * Adds form elements for setting another column.
     */
	public static addDatasetCol(){
        let templ = (this.pane.querySelector("template.column") as HTMLTemplateElement).content.cloneNode(true) as HTMLElement;
        (this.pane.querySelector(".columns") as HTMLElement).appendChild(templ);
	}

    /**
     * Deletes currently displayed dataset.
     */
    public static async deleteCurrent(){
        let res = await fetch(
            config.rest + "/applications/" + encodeURIComponent(this.appId.toString()) +
            "/datasets/" + this.dataset,
            {
                method: "DELETE",
                headers: { "grpc-metadata-authorization": await App.getJWT() }
            }
        );
        if(res.ok){
            alert("Dataset deleted.");
            window.history.pushState(null, null, "/applications/" + encodeURIComponent(this.appId.toString()));
            App.handleLocation();
        } else {
            let body = await res.json();
            alert("Deleting failed.\r\n" + ((body.error)? body.error : res.status + " " + res.statusText));
        }
    }

    /**
     * Handles submit of edit form.
     * @param form element
     */
	public static submit(form: HTMLFormElement){
        let appId = this.appId;
		(async () => {
			let data = parseForm(form);
			let response = await fetch(config.rest + "/applications/" + appId + "/datasets", {
				method: "POST",
				body: JSON.stringify(data),
				headers: {
					"content-type": "application/json",
					"grpc-metadata-authorization": await App.getJWT()
				}
			});

            if(response.ok)
                alert("Dataset created.");
            else {
                let body = await response.json();
                alert("Deleting failed.\r\n" + ((body.error)? body.error : response.status + " " + response.statusText));
            }
		})();
		return false;
	}
}
