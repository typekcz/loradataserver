interface LocationNode {
	show?: (params: string[]) => void,
	param?: LocationNode,
	children?: {[key: string]: LocationNode}
}

/// Represents a type of authorization. Each higher permission includes all the lower ones.
enum Permissions {
	NONE = 0,
	READ,
	WRITE,
	ADMIN,
	GLOBALADMIN
}

class App {
	/// Encoded JWT
	private static jwtToken: string = null;
	/// Username from JWT
	private static username: string = null;
	/// JWT expire date
	private static expire: Date = null;

	/// Application state
	private static state = {
		loading: null,
		login: null,
		app: null
	};

	/**
	 * Here are saved the methods for completing the Promise of getJWT method
	 * if JWT expires and the user is prompted to re-login.
	 * After logging in, Promise is completed with the new JWT and the code continues.
	 */
	private static waitingForJWT: {
		resolve: (result) => void,
		reject: (error) => void
	} = null;


	/// Application pages tree used by handleLocation method.
	private static locationTree: LocationNode = {
		show: async (p) => {
			App.switchToContentPane("index");
		},
		children: {
			organizations: {
				param: {
					show: async (p) => {
						OrganizationPages.show(p)
					},
					children: {
						users: {
							show: async (p) => UserPages.showOrg(p)
						}
					}
				}
			},
			applications: {
				param: {
					show: async (p) => {
						ApplicationPages.show(p);
					},
					children: {
						newDataset: {
							show: (p) => {
								DatasetPages.showNew(p);
							}
						},
						newView: {
							show: (p) => ViewPages.showNew(p)
						},
						datasets: {
							param: {
								show: async (p) => DatasetPages.showData(p)
							}
						},
						views: {
							param: {
								show: (p) => ViewPages.show(p),
								children: {
									edit: {
										show: (p) => ViewPages.showEdit(p)
									}
								}
							}
						}
					}
				},
			},
			users: {
				show: (p) => UserPages.show(p),
				param: {
					show: (p) => UserPages.showEdit(p)
				},
				children: {
					new: {
						show: (p) => UserPages.showNew(p)
					}
				}
			},
			devices: {
				param: {
					show: (p) => DevicePages.showEdit(p)
				}
			}
		}
	}

	/// Panels for content
	private static content: {
		[key: string]: HTMLElement
	} = {};
	private static currentContentPane: HTMLElement | {hidden: boolean} = {hidden: false}; // Placeholder

	/**
	 * @param name of content panel
	 * @returns requested content panel
	 */
	public static getContentPane(name: string): HTMLElement{
		return this.content[name];
	}

	/**
	 * Switches visible content panel
	 * @param name of content panel
	 */
	public static switchToContentPane(name: string){
		this.currentContentPane.hidden = true;
		this.currentContentPane = this.content[name];
		this.currentContentPane.hidden = false;
	}

	/**
	 * Initializates appliaction after loading is finished.
	 */
	public static async init(){
		try {
			this.state.loading = document.getElementById("state-loading");
			this.state.login = document.getElementById("state-login");
			this.state.app = document.getElementById("state-app");

			var content: HTMLElement = document.querySelector(".content");
			for(var i = 0; i < content.children.length; i++){
				var child: HTMLElement = <HTMLElement>content.children[i];
				child.hidden = true;
				this.content[child.getAttribute("data-content")] = child;
			}

			let jwt = localStorage.getItem("jwt");
			if(jwt && JSON.parse(atob(jwt.split(".")[1])).exp > Date.now()/1000){
				this.setJWT(jwt);
				document.getElementById("loggedUser").innerText = this.username;
				this.goToState("app");
				TreeMenu.updateMenu();
				this.handleLocation();
			} else
				this.goToState("login");
		} catch(error){
			console.error("Error\r\n"+error);
		}
	}

	/**
	 * It processes URL of the page and starts matching method for displaying the page.
	 * Page is searched in locationTree and show method of found node is called.
	 */
	public static async handleLocation(){
		let path = window.location.pathname;
		let pathFrags = path.split("/");
		pathFrags = pathFrags.filter(f => f);
		let locationNode = this.locationTree;
		let params: string[] = [];

		for(var i = 0; i < pathFrags.length; i++){
	        var nodeFound = false;
			if(locationNode.children)
				for(let child in locationNode.children){
					if(child == pathFrags[i]){
						locationNode = locationNode.children[child];
						nodeFound = true;
						break;
					}
				}
			if(nodeFound)
				continue;
	        if(locationNode.param){
	            locationNode = locationNode.param;
				params.push(pathFrags[i]);
	            continue;
	        }
	        locationNode = null;
	        break;
	    }
		if(locationNode && locationNode.show){
			locationNode.show(params);
		} else {
			this.switchToContentPane("notFound");
			document.title = "Not found";
		}
	}

	/**
	 * Sets JWT of current user.
	 * @param token encoded JWT
	 */
	private static setJWT(token: string){
		this.jwtToken = token;
		let decoded = JSON.parse(atob(token.split(".")[1]));
		this.username = decoded.username;
		this.expire = new Date(decoded.exp * 1000);
		localStorage.setItem("jwt", token);
	}

	/**
	 * @returns Promise of JWT token of currently logged user.
	 */
	public static getJWT(): Promise<string> {
		if(!this.expire || (Date.now() - this.expire.valueOf()) > 0){
			this.goToState("login");
			return new Promise((resolve, reject) => {
				this.waitingForJWT = {resolve, reject};
			});
		}
		return new Promise((resolve) => resolve(this.jwtToken));
	}

	/**
	 * Changes state of appliaction.
	 * @param state name
	 */
	public static goToState(state: string){
		for(var p in this.state){
			if(p == state)
				this.state[p].hidden = false;
			else
				this.state[p].hidden = true;
		}
	}

	/**
	 * Gets level of permission of the current user on the specified application.
	 */
	public static async getPermissionsForApp(appId: number): Promise<Permissions>{
		let app = await DAO.getApplication(appId);
		return await this.getPermissionsForOrg(app.organizationID);
	}

	 /**
 	 * Gets level of permission of the current user on the specified organization.
 	 */
	public static async getPermissionsForOrg(orgId: number): Promise<Permissions>{
		let profile = await DAO.getProfile();
		if(profile.user.isAdmin)
			return Permissions.GLOBALADMIN;
		for(let org of profile.organizations){
			if(org.organizationID == orgId){
				if(org.isAdmin)
					return Permissions.ADMIN;
				else
					return Permissions.READ;
			}
		}
		return Permissions.NONE;
	}

	/**
	 * Performs user login.
	 * @param password in plain text
	 * @returns truthy value if successful
	 */
	public static async login(username: string, password: string): Promise<boolean> {
		try {
			let response = await fetch(config.rest + "/internal/login", {
				method: "POST",
				body: JSON.stringify({
					username: username,
					password: password
				}),
				headers: new Headers({
					"content-type": "application/json"
				})
			});
			if(response.ok){
				let sameUser = this.username == username;
				this.setJWT((await response.json()).jwt);
				App.goToState("app");
				document.getElementById("loggedUser").innerText = username;
				if(this.waitingForJWT){
					if(sameUser){
						this.waitingForJWT.resolve(this.jwtToken);
					} else {
						this.waitingForJWT.reject(new Error("User changed"));
					}
					this.waitingForJWT = null;
				} else {
					App.handleLocation();
					TreeMenu.updateMenu();
				}
				return true;
			} else {
				let data = await response.json();
				throw data.error;
			}
		} catch(error){
			console.error(error);
		}
	}

	/**
	 * Logs out current user.
	 */
	public static logout(){
		this.jwtToken = null;
		localStorage.removeItem("jwt");
	}

	/**
	 * Method for submitting a login form.
	 * @param event of form submit
	 */
	public static submitLogin(event: Event){
        (async () => {
            try {
                let form: HTMLFormElement = event.target as HTMLFormElement;
                await App.login(form.login.value, form.password.value);
				form.password.value = "";
            } catch(error){
                console.error("Error\r\n"+error);
            }
        })();
        return false;
    }

	/**
	 * Method for submitting a logout form.
	 */
    public static submitLogout(){
        this.logout();
		this.goToState("login");
        return false;
    }
}

/// Initialization of appliaction after page is loaded.
document.addEventListener("DOMContentLoaded", (event) => {
	App.init();
});

/// Processing clicks on links. Starts App.handleLocation instead of loading a new page.
document.addEventListener("click", (event) => {
	let element = <HTMLElement>event.target;
	if(element.tagName != "A")
		return;
	// Default action is interrupted only if it is a click with the primary button without the modifier keys
	if(event.button == 0 && !(event.ctrlKey || event.shiftKey || event.altKey || event.metaKey)){
		event.preventDefault();
		let url = element.getAttribute("href");
		if(!url.endsWith("/"))
			url += "/";
		// Changes window location without loading
		window.history.pushState(null, null, url);
		// Handles new URL
		App.handleLocation();
	}
});

window.addEventListener("popstate", () => App.handleLocation());
