/* MIT License
 * Copyright (c) 2018 Lukáš Kotržena
 */

import * as CONF from "config";
import * as URL from "url";
import * as Utils from "./utils";

/**
 * This class handles database connection, database initialization, and provides database gateway.
 */
export class DB {
	private static databaseGw: IDatabaseGW;
	private static dbImpl: Map<string, any> = new Map<string, any>();

	/**
	 * Registers implementation of IDatabaseGW.
	 * @param protocol name
	 * @param db implementation of IDatabaseGW
	 */
	public static registerDbImpl(protocol: string, db: any){
		this.dbImpl.set(protocol, db);
	}

	/**
	 * Connect to database specified in config and initializates it if needed.
	 */
	public static async connect(){
		let connectionString: string = CONF.get("connections.database");
		let url = URL.parse(connectionString);
		let protocol = url.protocol;
		let db = this.dbImpl.get(protocol.substr(0, protocol.length - 1));
		if(!db)
			throw new Error('"' + url.protocol + '" is not supported.');
		this.databaseGw = new db(connectionString);

		if(!(await this.checkTables())){
			await this.inicializeDb();
		}
	}

	/**
	 * @returns IDatabaseGW implementation for currently connected databse
	 */
	public static getDbGw(): IDatabaseGW {
		return this.databaseGw;
	}

	/**
	 * Check if database is initialized.
	 */
	private static async checkTables(){
		return this.databaseGw.schemaExists("main");
	}

	/**
	 * Creates main schema and tables.
	 */
	private static async inicializeDb(){
		this.databaseGw.createSchema("main");
		let tablePromises = []
		tablePromises.push(this.databaseGw.createTable(
			{schema: "main", name: "device"},
			[
				{
					name: "devEUI",
					type: "binary",
					key: true,
					notnull: true
				},{
					name: "applicationID",
					type: "integer",
					length: 8,
					notnull: true
				},{
					name: "receiveFunction",
					type: "string",
					length: Infinity
				},{
					name: "dataset",
					type: "string",
					length: 100
				},{
					name: "latitude",
					type: "float"
				},{
					name: "longitude",
					type: "float"
				}
			]
		));
		tablePromises.push(this.databaseGw.createTable(
			{schema: "main", name: "view"},
			[
				{
					name: "applicationID",
					type: "integer",
					length: 8,
					key: true,
					notnull: true
				}, {
					name: "name",
					type: "string",
					length: 100,
					key: true,
					notnull: true
				},{
					name: "public",
					type: "boolean"
				},{
					name: "dataset",
					type: "string",
					length: 100
				},{
					name: "query",
					type: "string",
					length: Infinity
				},{
					name: "visualizer",
					type: "string",
					length: Infinity,
					notnull: true
				},{
					name: "defaultOptions",
					type: "string",
					length: Infinity
				}
			]
		));
		tablePromises.push(this.databaseGw.createTable(
			{schema: "main", name: "viewParam"},
			[
				{
					name: "applicationID",
					type: "integer",
					length: 8,
					key: true,
					notnull: true
				}, {
					name: "viewName",
					type: "string",
					length: 100,
					key: true,
					notnull: true
				}, {
					name: "index",
					type: "integer",
					length: 4,
					key: true,
					notnull: true
				}, {
					name: "type",
					type: "string",
					length: 10,
					notnull: true
				}, {
					name: "description",
					type: "string",
					length: 100,
					notnull: true
				}
			]
		));
		tablePromises.push(this.databaseGw.createTable(
			{schema: "main", name: "deviceStats"},
			[
				{
					name: "devEUI",
					type: "binary",
					key: true,
					notnull: true
				},{
					name: "time",
					type: "date",
					key: true,
					notnull: true
				},{
					name: "rxReceived",
					type: "integer"
				},{
					name: "txEmitted",
					type: "integer"
				},{
					name: "errors",
					type: "integer"
				},{
					name: "acks",
					type: "integer"
				}
			]
		));

		await Promise.all(tablePromises);

		this.databaseGw.createForeignKeyConstraint(
			{schema: "main", name: "viewParam"},
			["applicationID", "viewName"],
			{schema: "main", name: "view"},
			["applicationID", "name"],
			true, true
		);
		this.databaseGw.createForeignKeyConstraint(
			{schema: "main", name: "deviceStats"},
			["devEUI"],
			{schema: "main", name: "device"},
			["devEUI"],
			true, true
		);
	}

	/**
	 * Check if conditions is in complex format.
	 */
	public static isComplexCondition(cond: QueryCondition): cond is QueryComplexCondition {
		const properties = new Set(["operator", "value"]);
		if(Utils.isPlainObject(cond)){
			let objProps = Object.keys(cond);
			return (objProps.length == properties.size && objProps.every((p) => properties.has(p)));
		}
		return false;
	}
}

export interface Column {
	name: string;
	type: BasicType;
	length?: number;
	key?: boolean;
	notnull?: boolean;
}

export interface QueryResult {
	columns?: {
		name: string,
		type: BasicType
	}[],
	rows: any[],
	totalCount: number
}

export type QueryComplexCondition = {operator: string, value: any};
export type QueryCondition = QueryComplexCondition | string | number | Buffer | Date | boolean;
export type QueryConditions = {[key: string]: QueryCondition | QueryCondition[]};

export interface QueryParams {
	conditions?: QueryConditions,
	limit?: number,
	offset?: number,
	select?: string[]
}

/// Interface to implementation for different database systems.
export interface IDatabaseGW {
	query(table: TableName | string, params?: QueryParams): Promise<QueryResult>;
	update(table: TableName | string, data: object, keys: string[]): Promise<boolean>;
	insert(table: TableName | string, data: object): Promise<boolean>;
	upsert(table: TableName | string, data: object, keys: string[]): Promise<boolean>;
	delete(table: TableName | string, conditions?: QueryConditions): Promise<boolean>;

	queryTables(schema: string): Promise<string[]>;
	createTable(table: TableName | string, columns: Column[], useSchemaRole?: boolean): Promise<boolean>;
	createForeignKeyConstraint(
		constrainedTable: TableName | string, constrainedColumn: string | string[],
		referencedTable: TableName | string, referencedColumn: string | string[],
		onUpdateCascade?: boolean, onDeleteCascade?: boolean
	): Promise<boolean>;
	dropTable(table: TableName | string): Promise<boolean>;

	schemaExists(schema: string): Promise<boolean>;
	createSchema(schema: string): Promise<boolean>;
	createSchemaAndRoles(schema: string): Promise<boolean>;

	safeQueryOnSchema(schema: string, query: string, params?: any[]): Promise<QueryResult>;

	disconnect();
}

export interface TableName {
	schema: string;
	name: string;
}
