import {IDatabaseGW, TableName, Column, QueryResult, QueryParams, QueryCondition, QueryConditions, DB} from "../db";
import * as URL from "url";
import * as PG from "pg-promise";
import * as Utils from "../utils";
const PGP = PG({
	query: (e) => {
		console.log("DB>", e.query, e.params);
	}
});

interface DbType {
	type: string,
	maxLenght: number,
	needsLength?: boolean,
	default?: boolean
};

export default class PostgresGW implements IDatabaseGW {
	private connectionUrl: URL.Url;
	private username: string;
	private password: string;
	private schemaConnections: Map<string, PG.IDatabase<any>>;

	private static types: {[key: string]: string | DbType[]} = {
		string: [
			{
				type: "VARCHAR",
				maxLenght: Infinity,
				needsLength: true
			},{
				type: "TEXT",
				maxLenght: Infinity,
				default: true
			}
		],
		integer: [
			{type: "SMALLINT", maxLenght: 2},
			{type: "INTEGER", maxLenght: 4, default: true},
			{type: "BIGINT", maxLenght: 8}
		],
		float: [
			{type: "REAL", maxLenght: 4},
			{type: "DOUBLE PRECISION", maxLenght: 8, default: true}
		],
		boolean: "BOOLEAN",
		binary: "BYTEA",
		date: "TIMESTAMP"
	};

	private static operators = {
		eq: "=",
		ne: "<>",
		gt: ">",
		lt: "<",
		ge: ">=",
		le: "<=",
		li: "LIKE",
		nl: "NOT LIKE"
	};

	private client: PG.IDatabase<any>;
	constructor(connectionString: string){
		this.connectionUrl = URL.parse(connectionString);
		let auth = this.connectionUrl.auth.split(":");
		this.username = auth[0];
		this.password = auth[1];
		this.schemaConnections = new Map<string, PG.IDatabase<any>>();
		this.client = PGP(connectionString);
	}

	private getSchemaClient(schema: string){
		let schemaRole = this.username + "_" + schema;
		let client = this.schemaConnections.get(schemaRole);
		if(!client){
			let newUrl = Object.assign({}, this. connectionUrl);
			newUrl.auth = schemaRole + ":" + this.password;
			client = PGP(URL.format(newUrl));
			this.schemaConnections.set(schemaRole, client);
		}
		return client;
	}

	private static basicToConcreteType(type: string, length: number){
		type = type.toLowerCase();
		let types = this.types[type];
		if(!types)
			throw new Error('Unsupported db type "' + type + '"');
		if(typeof(types) === "string")
			return types;
		let chosenType: DbType;

		for(let t  of types){
			if((length && length <= t.maxLenght && (!t.needsLength || isFinite(length))) || (!length && t.default)){
				chosenType = t;
				break;
			}
		}
		if(!chosenType)
			throw new Error('Unsupported db type "' + type + '"');

		return chosenType.type + ((chosenType.needsLength)? "(" + length + ")": "");
	}

	private static typeidToBasicType(id: number): BasicType{
		switch(id){
			case 18:
			case 25:
			case 1043:
				return "string";
			case 20:
			case 21:
			case 23:
				return "integer";
			case 700:
			case 701:
				return "float";
			case 16:
				return "boolean";
			case 17:
				return "binary";
			case 1083:
			case 1114:
			case 1266:
			case 1184:
				return "date";
			default:
				return null;
		}
	}

	private addCondition(params: any[], col: string, cond: QueryCondition){
		let query = "";
		let op = PostgresGW.operators["eq"];
		let val;
		if(DB.isComplexCondition(cond)){
			op = PostgresGW.operators[cond.operator];
			val = cond.value;
		} else {
			val = cond;
		}
		params.push(col);
		query +=  '$' + params.length + '~ ';
		query += op;
		params.push(val);
		query +=  '$' + params.length + ' ';
		return query;
	}

	public async query(table: TableName | string, p?: QueryParams): Promise<QueryResult> {
		try {
			let params: any[] = [];
			if(typeof(p) === "undefined")
				p = {};
			let query = "SELECT ";
			if(p.select){
				let first = true;
				for(let col of p.select){
					if(first){
						first = false;
					} else {
						query += ", ";
					}
					params.push(col);
					query += "$" + params.length + "~";
				}
			} else {
				query += "*";
			}
			if(isFinite(p.limit) || isFinite(p.offset)){
				query += ", count(*) OVER() AS __total_row_count__";
			}
			query += " FROM ";
			switch(typeof(table)){
				case "string":
					params.push(table);
					query += "$" + params.length + "~";
					break;
				case "object":
					params.push((<TableName>table).schema);
					query += "$" + params.length + "~.";
					params.push((<TableName>table).name);
					query += "$" + params.length + "~";
					break;
			}

			if(p.conditions && Object.keys(p.conditions).length > 0){
				let first = true;
				query += " WHERE ";
				for(let col in p.conditions){
					let cond = p.conditions[col];
					if(cond instanceof Array){
						for(let c of cond){
							if(first){
								first = false;
							} else {
								query += "AND ";
							}
							query += this.addCondition(params, col, c);
						}
					} else {
						if(first){
							first = false;
						} else {
							query += "AND ";
						}
						query += this.addCondition(params, col, cond);
					}
				}
			}

			if(Number.isFinite(p.limit)){
				params.push(p.limit || 1);
				query += " LIMIT $" + params.length;
			}
			if(Number.isFinite(p.offset)){
				params.push(p.offset);
				query += " OFFSET $" + params.length;
			}
			let response = await this.client.result(query, params);
			let totalCount = 0;
			if(response.rows.length > 0)
				totalCount = response.rows[0]["__total_row_count__"] || response.rows.length;
			return {
				columns: response.fields.filter((c) => c.name != "__total_row_count__").map((c) => ({
					name: c.name,
					type: PostgresGW.typeidToBasicType(c.dataTypeID)
				})),
				totalCount,
				rows: (p.limit != 0)? response.rows.map((r) => {delete r["__total_row_count__"]; return r}) : []
			};
		} catch(error){
			throw new Error(error);
		}
	}

	public async update(table: TableName | string, data: Object, keys: Array<string>): Promise<boolean> {
		let params: Array<any> = [];
		let query = "UPDATE ";
		switch(typeof(table)){
			case "string":
				params.push(table);
				query += "$" + params.length + "~";
				break;
			case "object":
				params.push((<TableName>table).schema);
				query += "$" + params.length + "~.";
				params.push((<TableName>table).name);
				query += "$" + params.length + "~";
				break;
		}
		query += " SET";
		params.push(table);
		let first = true;
		for(let field in data){
			if(data.hasOwnProperty(field) && !keys.includes(field)){
				if(first){
					first = false;
				} else {
					query += ",";
				}
				params.push(field);
				query += ' $' + params.length + '~';
				params.push(data[field]);
				query += ' = $' + params.length;
			}
		}
		query += " WHERE ";
		first = true;
		for(let field of keys){
			if(data.hasOwnProperty(field)){
				if(first){
					first = false;
				} else {
					query += " AND ";
				}
				query += this.addCondition(params, field, data[field]);
			}
		}



		let result = await this.client.result(query, params);
		return result.rowCount > 0;
	}

	public async insert(table: TableName | string, data: Object): Promise<boolean> {
		let params: Array<any> = [];
		let query = "INSERT INTO ";
		switch(typeof(table)){
			case "string":
				params.push(table);
				query += "$" + params.length + "~";
				break;
			case "object":
				params.push((<TableName>table).schema);
				query += "$" + params.length + "~.";
				params.push((<TableName>table).name);
				query += "$" + params.length + "~";
				break;
		}
		query += "(";
		let queryValues: string = "";
		let first = true;
		for(let field in data){
			if(data.hasOwnProperty(field)){
				params.push(field);
				query += ((first)? "":", ") + "$" + params.length + "~";
				params.push(data[field]);
				queryValues += ((first)? "":", ") + "$" + params.length;
				first = false;
			}
		}
		query += ") VALUES(" + queryValues + ")";
		let result = await this.client.result(query, params);
		return result.rowCount > 0;
	}

	public async upsert(table: TableName | string, data: Object, keys: Array<string>): Promise<boolean> {
		let params: Array<any> = [];
		let query = "INSERT INTO ";
		switch(typeof(table)){
			case "string":
				params.push(table);
				query += "$" + params.length + "~";
				break;
			case "object":
				params.push((<TableName>table).schema);
				query += "$" + params.length + "~.";
				params.push((<TableName>table).name);
				query += "$" + params.length + "~";
				break;
		}
		query += "(";
		let insertValues: string = "";
		let setValues: string = "";
		let conflictCols: string = "";
		let first = true;
		for(let field in data){
			if(data.hasOwnProperty(field)){
				params.push(field);
				let col = "$" + params.length + "~";
				params.push(data[field]);
				let val = "$" + params.length;
				insertValues += ((first)? "":", ") + val;
				query += ((first)? "":", ") + col;
				first = false;

				if(keys.includes(field)){
					if(conflictCols.length > 0)
						conflictCols += ", ";
					conflictCols += col;
				} else {
					if(setValues.length > 0)
						setValues += ", ";
					setValues += col + " = EXCLUDED." + col;
				}
			}
		}
		query += ") VALUES(" + insertValues + ") ON CONFLICT(" + conflictCols + ") DO UPDATE SET " + setValues;
		let result = await this.client.result(query, params);
		return result.rowCount > 0;
	}

	public async delete(table: TableName | string, conditions?: QueryConditions): Promise<boolean> {
		let params: Array<any> = [];
		let query = "DELETE FROM ";
		switch(typeof(table)){
			case "string":
				params.push(table);
				query += "$" + params.length + "~";
				break;
			case "object":
				params.push((<TableName>table).schema);
				query += "$" + params.length + "~.";
				params.push((<TableName>table).name);
				query += "$" + params.length + "~";
				break;
		}

		if(conditions && Object.keys(conditions).length > 0){
			let first = true;
			query += " WHERE ";
			for(let col in conditions){
				let cond = conditions[col];
				if(cond instanceof Array){
					for(let c of cond){
						if(first){
							first = false;
						} else {
							query += "AND ";
						}
						query += this.addCondition(params, col, c);
					}
				} else {
					if(first){
						first = false;
					} else {
						query += "AND ";
					}
					query += this.addCondition(params, col, cond);
				}
			}
		}
		let result = await this.client.result(query, params);
		return true;
	}

	public async queryTables(schema: string): Promise<any[]> {
		if(!schema)
			schema = "public";
		let response = await this.client.any("SELECT table_name FROM information_schema.tables WHERE table_schema LIKE $1 AND table_type LIKE 'BASE TABLE'", [schema]);
		return response.map(t => {return {name: t.table_name}});
	}

	public async createTable(table: TableName | string, columns: Column[], useSchemaRole?: boolean): Promise<boolean> {
		let params: Array<any> = [];
		let query = 'CREATE TABLE ';
		switch(typeof(table)){
			case "string":
				params.push(table);
				query += "$" + params.length + "~";
				break;
			case "object":
				params.push((<TableName>table).schema);
				query += "$" + params.length + "~.";
				params.push((<TableName>table).name);
				query += "$" + params.length + "~";
				break;
		}
		query += "(";
		params.push(table);
		let primaryKey = "";
		for(let column of columns){
			let type = PostgresGW.basicToConcreteType(column.type, column.length);
			params.push(column.name);
			query += "$" + params.length + "~ ";
			query += type + (column.notnull? " NOT NULL": " NULL") + ", ";
			if(column.key){
				if(primaryKey.length > 0)
					primaryKey += ", ";
				primaryKey += "$" + params.length + "~";
			}
		}
		query += "PRIMARY KEY(" + primaryKey + "))";

		let c = this.client;
		if(useSchemaRole && typeof(table) == "object")
			c = this.getSchemaClient(table.schema);
		let result = await c.result(query, params);
		return true;
	}

	public async dropTable(table: TableName | string): Promise<boolean> {
		let params: Array<any> = [];
		let query = "DROP TABLE ";
		switch(typeof(table)){
			case "string":
				params.push(table);
				query += "$" + params.length + "~";
				break;
			case "object":
				params.push((<TableName>table).schema);
				query += "$" + params.length + "~.";
				params.push((<TableName>table).name);
				query += "$" + params.length + "~";
				break;
		}
		await this.client.result(query, params);
		return true;
	}

	public async createForeignKeyConstraint(
		constrainedTable: TableName | string, constrainedColumn: string | string[],
		referencedTable: TableName | string, referencedColumn: string | string[],
		onUpdateCascade?: boolean, onDeleteCascade?: boolean
	): Promise<boolean>{
		let query = "ALTER TABLE ";
		let params = [];
		let constraintName = "fk_"
		switch(typeof(constrainedTable)){
			case "string":
				params.push(constrainedTable);
				query += "$" + params.length + "~";
				constraintName += constrainedTable + "_";
				break;
			case "object":
				params.push((<TableName>constrainedTable).schema);
				query += "$" + params.length + "~.";
				params.push((<TableName>constrainedTable).name);
				query += "$" + params.length + "~";
				constraintName += (<TableName>constrainedTable).schema + "." + (<TableName>constrainedTable).name + "_";
				break;
		}
		let constraintNameIndex = params.push(null) - 1;
		query += " ADD CONSTRAINT $" + params.length + "~ FOREIGN KEY(";

		if(constrainedColumn instanceof Array){
			let first = true;
			for(let col of constrainedColumn){
				if(first){
					first = false;
				} else {
					query += ", ";
				}
				params.push(col);
				query += "$" + params.length + "~";
			}
		} else {
			params.push(constrainedColumn);
			query += "$" + params.length + "~";
		}
		query += ")	REFERENCES ";

		switch(typeof(referencedTable)){
			case "string":
				params.push(referencedTable);
				query += "$" + params.length + "~";
				constraintName += referencedTable;
				break;
			case "object":
				params.push((<TableName>referencedTable).schema);
				query += "$" + params.length + "~.";
				params.push((<TableName>referencedTable).name);
				query += "$" + params.length + "~";
				constraintName += (<TableName>referencedTable).schema + "." + (<TableName>referencedTable).name;
				break;
		}

		params[constraintNameIndex] = constraintName;
		query += "(";

		if(referencedColumn instanceof Array){
			let first = true;
			for(let col of referencedColumn){
				if(first){
					first = false;
				} else {
					query += ", ";
				}
				params.push(col);
				query += "$" + params.length + "~";
			}
		} else {
			params.push(referencedColumn);
			query += "$" + params.length + "~";
		}
		query += ")";

		if(onUpdateCascade){
			query += " ON UPDATE CASCADE";
		}
		if(onDeleteCascade){
			query += " ON DELETE CASCADE";
		}

		await this.client.result(query, params);
		return true;
	}

	public async schemaExists(schema: string): Promise<boolean> {
		let result = await this.client.result("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE $1", [schema]);
		return (result.rowCount == 1);
	}

	public async createSchema(schema: string): Promise<boolean> {
		let result = await this.client.result("CREATE SCHEMA $1~ AUTHORIZATION $2~", [schema, this.username]);
		return true;
	}

	public async createSchemaAndRoles(schema: string): Promise<boolean> {
		await this.client.tx(t => {
			let role = this.username + "_" + schema;
			t.none("CREATE ROLE $1~ WITH LOGIN PASSWORD $2", [role, this.password]);
			t.none("GRANT $1~ TO $2~", [role, this.username]);
			t.none("CREATE SCHEMA $1~ AUTHORIZATION $2~", [schema, role]);
		});
		return true;
	}

	public async safeQueryOnSchema(schema: string, query: string, params?: any[]): Promise<QueryResult> {
		let c = this.getSchemaClient(schema);
		let result = await c.result("SET search_path TO " + PG.as.name(schema) + ";" + query, params);
		console.log(result);
		return {
			columns: result.fields.map((c) => ({
				name: c.name,
				type: PostgresGW.typeidToBasicType(c.dataTypeID)
			})),
			rows: result.rows,
			totalCount: result.rows.length
		};
	}

	public disconnect(){
		this.client.$pool.end();
		for(let c of this.schemaConnections.values()){
			c.$pool.end();
		}
		this.schemaConnections.clear();
	}
}
