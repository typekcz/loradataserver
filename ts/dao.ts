/* MIT License
 * Copyright (c) 2018 Lukáš Kotržena
 */

import {DB, Column} from "./db";
import {Auth, Permissions} from "./auth";
import LoRaAppServerRest from "./loraappserver_rest";
import * as QS from "querystring";

export class ApplicationsDAO {
	public static async select(auth: Auth, organizationID: number){
		let applications = await LoRaAppServerRest.get("/applications?" + QS.stringify({
			organizationID,
			limit: 100
		}), auth.getJWT());
	}

	public static async selectOne(auth: Auth, appId: number){

	}

	public static createSchemaAndRoles(appId: number){
		// DB.getDbGw().createSchemaAndRoles(app-{appId});
	}
}

/**
 * Class with static methods only for device operations.
 */
export class DevicesDAO {
	/// Primary key of entity
	public static readonly keys = ["devEUI"];

	/// Device statistics which are stored every hour in the database.
	private static stats: Map<string, {
		 rxReceived: number, txEmitted: number, errors: number, acks: number
	}> = new Map();

	/**
	 * Merges device entities from LoRa App server and this application. Updates appId in this application if it does not match LoRa App server.
	 * @param target entities from LoRa App server
	 * @param source entities from this application
	 * @returns array of entities where DevEUI is not repeated
	 */
	private static mergeDevices(target: Device[], source: Device[]): Device[]{
		for(let t of target){
			for(let i = 0; i < source.length; i++){
				let match = true;
				for(let key of this.keys){
					if(t[key] != source[i][key]){
						match = false;
						break;
					}
				}
				if(match){
					let s = source.splice(i, 1)[0];
					if(t.applicationID != s.applicationID){
						this.update(Auth.getServerAdminAuth(), {
							devEUI: s.devEUI,
							applicationID: t.applicationID
						});
					}
					Object.assign(t, s);
					break;
				}
			}
		}
		return target;
	}

	/**
	 * Selection of all device.
	 * Not used, probably not working.
	 */
	public static async select(auth: Auth): Promise<Device[]> {
		let responses = await Promise.all([
			LoRaAppServerRest.get("/devices", auth.getJWT()),
			DB.getDbGw().query({schema: "main", name: "device"})
		]);
		// TODO: paginace?
		return this.mergeDevices(responses[0].result, responses[1].rows);
	}

	/**
	 * Selection of single device by DevEUI
	 */
	public static async selectOne(auth: Auth, devEUI: string): Promise<Device> {
		let responses = await Promise.all([
			LoRaAppServerRest.get("/devices/" + devEUI, (auth)? auth.getJWT() : null),
			DB.getDbGw().query({schema: "main", name: "device"}, {conditions: {devEUI}})
		]);
		let loraDevice = responses[0];
		let myDevice = responses[1].rows[0];

		if(myDevice && loraDevice.applicationID != myDevice.applicationID){
			this.update(Auth.getServerAdminAuth(), {
				devEUI: myDevice.devEUI,
				applicationID: loraDevice.applicationID
			});
		}

		await auth.checkAppPermissions(loraDevice.applicationID, Permissions.READ);

		if(myDevice && myDevice.devEUI instanceof Buffer)
			myDevice.devEUI = (<Buffer>myDevice.devEUI).toString();
		return Object.assign(loraDevice, myDevice);
	}

	/**
	 * Selection of device only from this application (without LoRa App Server part) by DevEUI.
	 */
	public static async selectOneLocalOnly(devEUI: string): Promise<Device> {
		let device = (await DB.getDbGw().query({schema: "main", name: "device"}, {conditions: {devEUI}})).rows[0];
		if(device && device.devEUI instanceof Buffer)
			device.devEUI = (<Buffer>device.devEUI).toString();
		return device;
	}

	/**
	 * Insertion of device (this application only).
	 */
	public static async insert(auth: Auth, device: Device) {
		//TODO: kontrola autorizace
		if(!await DB.getDbGw().insert({schema: "main", name: "device"}, device))
			throw new Error("INSERT failed.");
	}

	/**
	 * Updating of device (this application only).
	 */
	public static async update(auth: Auth, device: Device) {
		if(!await DB.getDbGw().upsert({schema: "main", name: "device"}, device, this.keys))
			throw new Error("UPDATE failed.");
	}

	public static async selectStats(auth: Auth, devEUI: string, from?: Date, to?: Date){
		let timeCond = [];

		if(from){
			timeCond.push({
				operator: "ge",
				value: from
			});
		}

		if(to){
			timeCond.push({
				operator: "le",
				value: to
			});
		}

		let stats = await DB.getDbGw().query({schema: "main", name: "deviceStats"}, {
			select: ["time", "rxReceived", "txEmitted", "errors", "acks"],
			conditions: {
				devEUI,
				time: timeCond
			}
		});

		return stats.rows;
	}

	private static timer: NodeJS.Timer;

	/**
	 * Starts timer for stroing device statistics in the database every hour.
	 */
	public static startStatsTimer(){
		let d = new Date();
		d.setMinutes(0);
		d.setSeconds(0);
		d.setMilliseconds(0);
		d.setHours(d.getHours() + 1);
		if(this.timer)
			clearTimeout(this.timer);
		this.timer = setTimeout(() => {
			DevicesDAO.pushStats();
			DevicesDAO.startStatsTimer();
		}, d.getTime() - Date.now());
	}

	/**
	 * Stores device statistics in memory.
	 */
	public static async addDeviceStats(devEUI: string, rxReceived: number, txEmitted: number, errors: number, acks: number){
		if(!this.stats.has(devEUI)){
			this.stats.set(devEUI, {rxReceived, txEmitted, errors, acks});
		} else {
			let devStats = this.stats.get(devEUI);
			devStats.rxReceived += rxReceived;
			devStats.txEmitted += txEmitted;
			devStats.errors += errors;
			devStats.acks += acks;
			this.stats.set(devEUI, devStats);
		}
	}

	/**
	 * Pushes device statistics to database.
	 */
	public static async pushStats(){
		this.stats.forEach(async (val, key) => {
			await DB.getDbGw().insert(
				{schema: "main", name: "deviceStats"},
				Object.assign({
					devEUI: key,
					time: new Date()
				}, val)
			);
			val.rxReceived = val.txEmitted = val.acks = val.errors = 0;
		});
	}
}

/**
 * Class with static methods for manipulating datasets.
 */
export class DatasetsDAO {
	/**
	 * Creates a dataset (database table in an application schema).
	 * @param columns of table
	 */
	public static async create(auth: Auth, appId: number, name: string, columns: Column[]){
		await auth.checkAppPermissions(appId, Permissions.WRITE);
		let schema = "app-" + appId;
		if(!(await DB.getDbGw().schemaExists(schema)))
			await DB.getDbGw().createSchemaAndRoles(schema);
		return await DB.getDbGw().createTable({schema, name}, columns, true);
	}

	/**
	 * Performs a secure SQL query isolated to application schema.
	 * SQL syntax is dependent on used database system.
	 */
	public static async query(auth: Auth, appId: number, query: string){
		await auth.checkAppPermissions(appId, Permissions.WRITE);
		let schema = "app-" + appId;
		if(!(await DB.getDbGw().schemaExists(schema)))
			await DB.getDbGw().createSchemaAndRoles(schema);
		return await DB.getDbGw().safeQueryOnSchema(schema, query);
	}

	/**
	 * @returns list of tables within appliaction schema
	 */
	public static async list(auth: Auth, appId: number): Promise<string[]>{
		await auth.checkAppPermissions(appId, Permissions.READ);
		return await DB.getDbGw().queryTables("app-" + appId);
	}

	/**
	 * Performs select query in the appliaction schema.
	 */
	//TODO: conditions type?
	public static async select(auth: Auth, appId: number, table: string, conditions?: any, limit?: number, offset?: number){
		await auth.checkAppPermissions(appId, Permissions.READ);
		let schema = "app-" + appId;
		return await DB.getDbGw().query({schema: schema, name: table}, {conditions, limit, offset});
	}

	/**
	 * Inserts a row into table in application schema.
	 */
	public static async insert(auth: Auth, appId: number, table: string, data){
		await auth.checkAppPermissions(appId, Permissions.WRITE);
		return await DB.getDbGw().insert({schema: "app-" + appId, name: table}, data);
	}

	public static async delete(auth: Auth, appId: number, table: string){
		await auth.checkAppPermissions(appId, Permissions.WRITE);
		DB.getDbGw().dropTable({schema: "app-" + appId, name: table});
	}
}

/**
 * Class with static methods for manipulating views.
 */
export class ViewsDAO {
	/// Entity primary key.
	public static readonly keys = ["applicationID", "name"];

	/**
	 * Selection of all views in application.
	 */
	public static async select(auth: Auth, appId: number): Promise<View[]>{
		await auth.checkAppPermissions(appId, Permissions.READ);
		return (await DB.getDbGw().query({schema: "main", name: "view"}, {
			conditions: {applicationID: appId},
			select: ["name", "visualizer", "dataset"]
		})).rows;
	}

	private static async selectOneNoAuth(appId: number, name: string): Promise<View> {
		let responses = await Promise.all([
			DB.getDbGw().query({schema: "main", name: "view"}, {
				conditions: {applicationID: appId, name}
			}),
			DB.getDbGw().query({schema: "main", name: "viewParam"}, {
				conditions: {applicationID: appId, viewName: name},
				select: ["type", "description"]
			})
		]);
		let view = responses[0].rows[0];
		view.query = JSON.parse(view.query);
		view.defaultOptions = JSON.parse(view.defaultOptions);
		view.params = responses[1].rows;
		return view;
	}

	/**
	 * Selection of view by name and appliaction ID.
	 */
	public static async selectOne(auth: Auth, appId: number, name: string){
		await auth.checkAppPermissions(appId, Permissions.READ);
		return await this.selectOneNoAuth(appId, name);
	}

	public static async selectParams(auth: Auth, appId: number, name: string){
		let view = await this.selectOneNoAuth(appId, name);
		if(!view.public)
			await auth.checkAppPermissions(appId, Permissions.READ);
		return (await DB.getDbGw().query({schema: "main", name: "viewParam"}, {conditions: {applicationID: appId, viewName: name}})).rows;
	}

	public static async selectOptions(auth: Auth, appId: number, name: string){
		let view = await this.selectOneNoAuth(appId, name);
		if(!view.public)
			await auth.checkAppPermissions(appId, Permissions.READ);
		return view.defaultOptions;
	}

	public static async selectViewData(auth: Auth, appId: number, name: string, params?: any[]){
		let view = await this.selectOneNoAuth(appId, name);
		if(!view.public)
			await auth.checkAppPermissions(appId, Permissions.READ);
		let schema = "app-" + appId;
		if(typeof(view.query) === "string")
			return await DB.getDbGw().safeQueryOnSchema(schema, view.query, params);
		else {
			for(let col in view.query.conditions){
				let cond = view.query.conditions[col];
				if(cond instanceof Array){
					for(let c of cond){
						if(typeof(c.paramIndex) !== "undefined"){
							c.value = params[c.paramIndex];
							delete c.paramIndex;
						}
					}
				} else {
					if(typeof(cond.paramIndex) !== "undefined"){
						cond.value = params[cond.paramIndex];
						delete cond.paramIndex;
					}
				}
			}
			return await DB.getDbGw().query({schema, name: view.dataset}, view.query);
		}
	}

	public static async insert(auth: Auth, view){
		await auth.checkAppPermissions(view.applicationID, Permissions.WRITE);
		let params = view.params;
		view.query = JSON.stringify(view.query);
		delete view.params;
		await DB.getDbGw().insert({schema: "main", name: "view"}, view);
		for(let i = 0; i < params.length; i++){
			let param = params[i];
			await DB.getDbGw().insert({schema: "main", name: "viewParam"}, {
				applicationID: view.applicationID,
				viewName: view.name,
				index: i,
				type: param.type,
				description: param.description
			});
		}
	}

	public static async update(auth: Auth, view){
		await auth.checkAppPermissions(view.applicationID, Permissions.WRITE);
		let params = view.params;
		view.query = JSON.stringify(view.query);
		delete view.params;
		await DB.getDbGw().update({schema: "main", name: "view"}, view, this.keys);
		await DB.getDbGw().delete({schema: "main", name: "viewParam"}, {
			applicationID: view.applicationID,
			viewName: view.name
		});
		for(let i = 0; i < params.length; i++){
			let param = params[i];
			await DB.getDbGw().insert({schema: "main", name: "viewParam"}, {
				applicationID: view.applicationID,
				viewName: view.name,
				index: i,
				type: param.type,
				description: param.description
			});
		}
	}

	public static async delete(auth: Auth, appId: number, name: string){
		await auth.checkAppPermissions(appId, Permissions.WRITE);
		await DB.getDbGw().delete({schema: "main", name: "view"}, {applicationID: appId, name});
		return true;
	}
}
