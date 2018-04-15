/// Used for operations with application's tree menu.
class TreeMenu {
	private static treeMenu: HTMLElement;

	/**
     * Expands or collapses tree menu level.
     * @param btn button that was clicked
	 * @param updateFunction function for updating sublevel
     */
	public static toggleList(btn: HTMLElement, updateFunction: Function){
		let list = btn.parentElement.querySelector("ul")
		if(btn.innerText == "+"){
			if(updateFunction)
				updateFunction(btn);
			btn.innerText = "-";
			list.classList.toggle("collapsed", false);
		} else {
			/*Transparency.render(
				btn.parentElement.querySelector("ul"),
				[]
			);*/
			btn.innerText = "+";
			list.classList.toggle("collapsed", true);
		}
	}

	/**
     * Shows or hides entire tree menu.
	 * Used on mobile device.
     */
	public static async toggleMenu(){
		this.treeMenu.classList.toggle("hidden");
	}

	/**
     * Updates menu's top level.
     */
	public static async updateMenu(){
		this.treeMenu = document.querySelector("aside");
		let adminMenu = this.treeMenu.querySelector(".globalAdmin") as HTMLElement;
		adminMenu.hidden = !((await App.getPermissionsForOrg(0)) == Permissions.GLOBALADMIN);
		TreeMenu.updateOrgList();
	}

	/**
     * Updates the list of organizations in menu's top level.
     */
	public static async updateOrgList(){
		let element = document.getElementById("organizations-list");
		let data = await DAO.getOrganizationList();

		Transparency.render(
			element,
			data,
			{
				organization: {
					"data-id": function(params) {return this.id}
				},
				name: {
					href: function(){
						return "/organizations/" + this.id + "/";
					}
				}
			}
		);
		element.hidden = false;
	}

	/**
     * Updates the list of apps in level below the organization.
     * @param element where should be applications inserted
	 * @param more shows button for loading more
     */
    public static async updateAppList(element: HTMLElement, more = false){
        let root: HTMLElement = reverseClassQuery(element, "organization");
		let appUl = <HTMLElement>root.querySelector('.applications');
		let orgId = parseInt(root.getAttribute('data-id'));

		let data = await DAO.getApplicationList(orgId, more);

		Transparency.render(
			appUl,
			data,
			{
				application: {
					"data-id": function(params) { return this.id }
				},
				name: {
					href: function(){
						return "/applications/" + this.id;
					}
				},
				devices: {
					name: {
						href: function(){
							return "/devices/" + this.devEUI
						}
					}
				},
				datasets: {
					name: {
						href: function(){
							return "/applications/" + this.appId + "/datasets/" + encodeURIComponent(this.name);
						},
					}
				},
				views: {
					name: {
						href: function(){
							return "/applications/" + this.applicationID + "/views/" + encodeURIComponent(this.name)
						}
					}
				}
			}
		);

		let moreEl: HTMLElement = appUl.querySelector(".more") as HTMLElement;
		if(DAO.hasMoreApplications(orgId)){
			if(!moreEl){
				moreEl = document.createElement("LI") as HTMLElement;
				moreEl.innerText = "More";
				moreEl.classList.add("more");
				moreEl.addEventListener("click", () => {
					TreeMenu.updateAppList(moreEl, true);
				});
				appUl.appendChild(moreEl);
			}
		} else {
			if(moreEl)
				moreEl.parentElement.removeChild(moreEl);
		}
    }

	/**
     * Updates the list of devices.
     * @param element where should be devices inserted
	 * @param more shows button for loading more
     */
    public static async updateDeviceList(element: HTMLElement, more = false){
        let root: HTMLElement = reverseClassQuery(element, "application");
		let appId = parseInt(root.getAttribute('data-id'));
        let data = await DAO.getDeviceList(appId, more);
		let devicesUl = root.querySelector('.devices') as HTMLElement;

		let moreEl: HTMLElement = devicesUl.querySelector(".more") as HTMLElement;
		if(moreEl){
			moreEl.parentElement.removeChild(moreEl);
			moreEl = null;
		}

		Transparency.render(
			devicesUl,
			data,
			{
				name: {
					href: function(){ return "/devices/" + this.devEUI }
				}
			}
		);

		if(DAO.hasMoreDevices(appId)){
			if(!moreEl){
				moreEl = document.createElement("LI") as HTMLElement;
				moreEl.innerText = "More";
				moreEl.classList.add("more");
				moreEl.addEventListener("click", () => {
					TreeMenu.updateDeviceList(moreEl, true);
				});
				devicesUl.appendChild(moreEl);
			}
		}
    }

	/**
     * Updates the list of datasets.
     * @param element where should be datasets inserted
	 * @param more shows button for loading more
     */
	public static async updateDatasets(element: HTMLElement){
		let root: HTMLElement = reverseClassQuery(element, "application");
		let appId = parseInt(root.getAttribute('data-id'));
        let data = await DAO.getDatasets(appId);
		Transparency.render(
			<HTMLElement>root.querySelector('.datasets'),
			data,
			{
				name: {
					href: function(){ return "/applications/" + appId + "/datasets/" + encodeURIComponent(this.name) }
				}
			}
		);
	}

	/**
     * Updates the list of views.
     * @param element where should be views inserted
	 * @param more shows button for loading more
     */
	public static async updateViews(element: HTMLElement){
		let root: HTMLElement = reverseClassQuery(element, "application");
		let appId = parseInt(root.getAttribute('data-id'));
		let views = await DAO.getViews(appId);
		Transparency.render(
			<HTMLElement>root.querySelector('.views'),
			views,
			{
				name: {
					href: function(){ return "/applications/" + this.applicationID + "/views/" + encodeURIComponent(this.name) }
				}
			}
		);
	}
}
