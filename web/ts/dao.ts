/// Class that loads entities from the REST API and stores them in caches.
class DAO {
    public static cache = {
		organizations: new Map<number, any>(),
		applications: new Map<number, any>(),
		devices: new Map<string, any>(),
		data: new Map<number, any>(),
        profile: null
	};

    /**
	 * Loads entity or entities from the REST API.
	 * @param url path of GET request
     * @param collection where entities should be stored
     * @param getKeyF a function for obtaining a unique entity key
     * @param initEntity a function for initializing entity object
     * @param args other arrays into which the entities will be pushed or functions that will be call with entity
	 * @returns array of entities or single entity
	 */
    public static async fetchToCache(url: string, collection: Map<any, any>, getKeyF: Function, initEntity?: Function, ...args: (Array<any>|Function)[]){
		let response = await fetch(url, {
			method: "GET",
			headers: {
				"grpc-metadata-authorization": await App.getJWT()
			}
		});
		let responseObj = await response.json();
		if(!response.ok){
			throw new Error(JSON.stringify(responseObj));
		}
		let entities: any[];
		if(responseObj.result instanceof Array){
			entities = responseObj.result;
		} else {
			entities = [];
			entities.push(responseObj);
		}
		for(let ei = 0; ei < entities.length; ei++){
			let entity = entities[ei];
			let key = getKeyF(entity);
			let cachedEntity = collection.get(key);
			if(cachedEntity){
				Object.assign(cachedEntity, entity);
				entities[ei] = cachedEntity;
			} else {
				if(initEntity)
					initEntity(entity);
				collection.set(key, entity);
				cachedEntity = entity;
			}
			for(let ai = 0; ai < args.length; ai++){
				let array = args[ai];
				if(array instanceof Array && array.indexOf(cachedEntity) < 0){
                    let alreadyExists = false;
                    for(let arrayItem of array){
                        if(getKeyF(arrayItem) == key){
                            alreadyExists = true;
                            console.log("alreadyExists");
                            break;
                        }
                    }
                    if(!alreadyExists)
				        array.push(cachedEntity);
				} else if(array instanceof Function){
					array(cachedEntity);
				}
			}
		}
		if(responseObj.result instanceof Array){
			entities["totalCount"] = responseObj.totalCount
			return entities;
		} else {
			return entities[0];
		}
	}

    /**
	 * Returns loaded or stored user profile.
	 */
    public static async getProfile(){
        const maxAge = 10*60*1000;
        if(this.cache.profile && (Date.now() - this.cache.profile.updatedTime) < maxAge){
            return this.cache.profile;
        }
        let profile = (await (await fetch(
			config.rest + "/internal/profile", {
				method: "GET",
				headers: {
					"grpc-metadata-authorization": await App.getJWT()
				}
			}
		)).json());
        profile.updatedTime = Date.now();
        this.cache.profile = profile;
        return profile;
    }

    /**
	 * Returns loaded or stored organizations.
	 */
    public static async getOrganizationList(): Promise<any[]>{
		let totalCount = (await (await fetch(
			config.rest + "/organizations", {
				method: "GET",
				headers: {
					"grpc-metadata-authorization": await App.getJWT()
				}
			}
		)).json()).totalCount;
		return await this.fetchToCache(
			config.rest + "/organizations" +
			"?limit=" + totalCount,
			this.cache.organizations,
			(e) => parseInt(e.id),
			(e) => e.applications = []
		);
	}

    /**
	 * Returns loaded or stored organization.
	 */
    public static async getOrganization(orgId: number){
        return await this.fetchToCache(
            config.rest + "/organizations/" + encodeURIComponent(orgId.toString()),
            this.cache.organizations,
			(e) => parseInt(e.id),
			(e) => e.applications = []
        );
    }

    /**
	 * Returns loaded or stored organization gateways.
	 */
	public static async getGateways(orgId: number): Promise<any[]> {
		let totalCount = (await (await fetch(
			config.rest + "/gateways" +
			"?organizationID=" + encodeURIComponent(orgId.toString()), {
				method: "GET",
				headers: {
					"grpc-metadata-authorization": await App.getJWT()
				}
			}
		)).json()).totalCount;
		return (await (await fetch(
			config.rest + "/gateways" +
			"?organizationID=" + encodeURIComponent(orgId.toString()) +
			"&limit=" + totalCount, {
				method: "GET",
				headers: {
					"grpc-metadata-authorization": await App.getJWT()
				}
			}
		)).json()).result;
	}

    /**
	 * Returns loaded gateway.
	 */
	public static async getGateway(mac: string){
		return (await (await fetch(
			config.rest + "/gateways/" +
			encodeURIComponent(mac), {
				method: "GET",
				headers: {
					"grpc-metadata-authorization": await App.getJWT()
				}
			}
		)).json());
	}

    /**
	 * Returns loaded gateway statistics.
	 */
    public static async getGatewayStats(mac: string, start: Date, end: Date){
        return await (await fetch(
            config.rest + "/gateways/" + encodeURIComponent(mac) + "/stats" +
            "?interval=day" +
            "&startTimestamp=" + encodeURIComponent(start.toISOString()) +
            "&endTimestamp=" + encodeURIComponent(end.toISOString()), {
				method: "GET",
				headers: {
					"grpc-metadata-authorization": await App.getJWT()
				}
			}
        )).json();
    }

    /**
	 * Returns loaded or stored organization applications.
     * @param getNext retrieves next part if all applications in the previous call were not loaded
	 */
	public static async getApplicationList(orgId: number, getNext = false): Promise<Application[]>{
		let limit = 50;
		let offset = 0;
		let maxAge = 10*60*1000; // 10 minutes
		let orgApplications = this.cache.organizations.get(orgId).applications;

		if(getNext){
			offset = this.cache.applications.size
		} else if(orgApplications.length > 0){
			if(!orgApplications["oldestEntity"] || (Date.now() - orgApplications["oldestEntity"]) > maxAge){
				limit = orgApplications.length;
				orgApplications["oldestEntity"] = null;
			} else {
				return orgApplications;
			}
		}
		let entities = await this.fetchToCache(
			config.rest + "/applications" +
			"?limit=" + encodeURIComponent(limit.toString()) +
			"&offset=" + encodeURIComponent(offset.toString()) +
			"&organizationID=" + encodeURIComponent(orgId.toString()),
			this.cache.applications,
			(e) => {
				e.id = parseInt(e.id);
				return e.id;
			},
			(e) => {
				e.devices = [];
				e.datasets = [];
				e.datasetsMap = new Map<string, any>();
				e.views = [];
				e.viewsMap = new Map<string, any>();
			},
			orgApplications
		);
		orgApplications["totalCount"] = entities["totalCount"];
		if(!orgApplications["oldestEntity"])
			orgApplications["oldestEntity"] = Date.now();
		return orgApplications;
	}

	/**
	 * Ask if all applications have not been loaded.
     * If they were not, more can be loaded by calling getApplicationsList with true value in the getNext parameter.
	 */
	public static hasMoreApplications(orgId: number): boolean{
		return !(this.cache.organizations.get(orgId).applications["totalCount"] <= this.cache.applications.size);
	}

    /**
	 * Returns loaded or stored application.
	 */
	public static getApplication(appId: number): Promise<Application> {
		return this.fetchToCache(
			config.rest + "/applications/"+encodeURIComponent(appId.toString()),
			this.cache.applications,
			(e) => {
				e.id = parseInt(e.id);
				return e.id;
			},
			(e) => {
				e.id = parseInt(e.id);
				e.devices = [];
				e.datasets = [];
				e.datasetsMap = new Map<string, any>();
				e.views = [];
				e.viewsMap = new Map<string, any>();
			},
			(e) => {
				let org = this.cache.organizations.get(e.organizationID);
				if(org)
					org.applications.push(e);
			}
		);
	}

    /**
	 * Returns loaded or stored application devices.
     * @param getNext retrieves next part if all devices in the previous call were not loaded
	 */
	public static async getDeviceList(appId: number, getNext = false): Promise<Device[]> {
		let limit = 50;
		let offset = 0;
		let maxAge = 10*60*1000; // 10 minutes
		let app = this.cache.applications.get(appId);
		if(getNext){
			offset = app.devices.length
		} else if(app.devices.length > 0){
			if(!app.devices["oldestEntity"] || (Date.now() - app.devices["oldestEntity"]) > maxAge){
				limit = app.devices.length;
				app.devices["oldestEntity"] = null;
			} else {
				return app.devices;
			}
		}
		let entities = await this.fetchToCache(
			config.rest + "/applications/"+encodeURIComponent(appId.toString())+"/devices" +
			"?limit=" + encodeURIComponent(limit.toString()) +
			"&offset=" + encodeURIComponent(offset.toString()),
			this.cache.devices,
			(e) => e.devEUI,
			null,
			app.devices
		);
		app.devices["totalCount"] = entities["totalCount"];
		if(!app.devices["oldestEntity"])
			app.devices["oldestEntity"] = Date.now();
		return app.devices;
	}

    /**
	 * Ask if all application devices have not been loaded.
     * If they were not, more can be loaded by calling getDeviceList with true value in the getNext parameter.
	 */
	public static hasMoreDevices(appId: number): boolean{
		let app = this.cache.applications.get(appId);
		return !(app.devices["totalCount"] <= app.devices.length);
	}

    /**
	 * Returns loaded or stored devices.
	 */
	public static getDevice(devEUI: string): Promise<Device> {
		return this.fetchToCache(
			config.rest + "/devices/"+encodeURIComponent(devEUI),
			this.cache.devices,
			(e) => e.devEUI,
			null,
			(e) => {
				let app = this.cache.applications.get(parseInt(e.applicationID));
				if(app && app.devices.indexOf(e) < 0)
					app.devices.push(e);
			}
		);
	}

    /**
	 * Returns loaded device statistics.
	 */
    public static async getDeviceStats(devEUI: string, from?: Date, to?: Date){
        let response = await fetch(
            config.rest + "/devices/" + encodeURIComponent(devEUI) + "/stats?" +
            (from? "from=" + encodeURIComponent(from.toISOString()) : "") + "&" +
            (to? "from=" + encodeURIComponent(to.toISOString()) : ""), {
                method: "GET",
                headers: {
                    "grpc-metadata-authorization": await App.getJWT()
                }
            }
        );
        return (await response.json()).result;
    }

    /**
	 * Returns loaded application datasets.
	 */
	public static async getDatasets(appId: number){
		let application = await this.getApplication(appId);
		return this.fetchToCache(
			config.rest + "/applications/" + encodeURIComponent(appId.toString()) + "/datasets",
			application.datasetsMap,
			(e) => e.name,
			(e) => {
				e.appId = application.id
			},
			application.datasets
		);
	}

    /**
	 * Returns loaded dataset values.
	 */
	public static async getDatasetValues(appId: number, dataset: string): Promise<any>{
		let response = await fetch(
			config.rest + "/applications/" + encodeURIComponent(appId.toString()) + "/datasets/" + dataset, {
				method: "GET",
				headers: {
					"grpc-metadata-authorization": await App.getJWT()
			}
		});
		return (await response.json()).result;
	}

    /**
	 * Returns loaded or stored application views.
	 */
	public static async getViews(appId: number): Promise<View[]>{
		let application = this.cache.applications.get(appId);
		if(!application)
			application = await this.getApplication(appId);
		let maxAge = 10*60*1000; // 10 minutes
		if(
			(!application.views["oldestEntity"] || (Date.now() - application.views["oldestEntity"]) > maxAge)
			|| application.views.length == 0
		){
			application.views["oldestEntity"] = Date.now();
			return await this.fetchToCache(
				config.rest + "/applications/" + encodeURIComponent(appId.toString()) + "/views",
				application.viewsMap,
				(e) => e.name,
				(e) => {
					e.applicationID = appId
				},
				application.views
			);
		} else {
			return application.views;
		}
	}

    /**
	 * Returns loaded or stored view.
	 */
	public static async getView(appId: number, view: string): Promise<View> {
		let application = await this.getApplication(appId);

		return this.fetchToCache(
			config.rest + "/applications/" + encodeURIComponent(appId.toString()) + "/views/" + encodeURIComponent(view),
			application.viewsMap,
			(e) => e.name,
			null,
			application.views
		);
	}
}
