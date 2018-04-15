class DevicePages {
    private static pane: HTMLElement;

    /**
     * Page that shows form for editing device.
     * @param p URL parameters, first parameter with DevEUI of device is required
     */
    public static async showEdit(p: string[]){
		this.pane = <HTMLFormElement>App.getContentPane("page");
    	this.pane.innerHTML = await (await fetch("/pages/deviceEdit.tpl")).text();
        delete this.pane["transparency"];

        let device = await DAO.getDevice(p[0]);

        document.title = "Edit device " + device.name;

        let datasetSelect = this.pane.querySelector("[name=dataset]") as HTMLSelectElement;
        datasetSelect.options.add(new Option("", "", true, true));
        for(let dataset of await DAO.getDatasets(device.applicationID)){
            datasetSelect.options.add(new Option(dataset.name));
        }

        console.log(device);
        Transparency.render(
            this.pane,
            device
        );

        this.pane.querySelector("form").formtype.value = ((device.dataset)? "auto" : "custom");
        (<HTMLElement>this.pane.querySelector(".auto")).hidden = !device.dataset;
        (<HTMLElement>this.pane.querySelector(".custom")).hidden = !!device.dataset;

        if(await App.getPermissionsForApp(device.applicationID) < Permissions.WRITE){
            readOnlyForm(this.pane.querySelector("form"));
        }

		App.switchToContentPane("page");
    }

    /**
     * Handles change of selected data processing method and shows corresponding form part.
     * @param radio element containing changed value
     */
    public static editFormTypeChanged(radio: HTMLInputElement){
        switch(radio.value){
            case "auto":
                (<HTMLElement>this.pane.querySelector(".auto")).hidden = false;
                (<HTMLElement>this.pane.querySelector(".custom")).hidden = true;
                break;
            case "custom":
                (<HTMLElement>this.pane.querySelector(".auto")).hidden = true;
                (<HTMLElement>this.pane.querySelector(".custom")).hidden = false;
                break;
        }
    }

    /**
     * Handles submit of device edit form.
     * @param form that was submitted
     */
    public static submit(form: HTMLFormElement){
		(async function(){
			let data = parseForm(form);

            if(data.formtype == "auto"){
                delete data.receiveFunction;
            } else {
                delete data.dataset;
            }
            delete data.formtype;

			let response = await fetch(config.rest + "/devices/" + encodeURIComponent(form.elements["devEUI"].value), {
				method: "PUT",
				body: JSON.stringify(data),
				headers: new Headers({
					"content-type": "application/json"
				})
			});

			if(response.status == 200)
				alert("Saved");
			else
				alert("Error");
		})();
		return false;
	}
}
