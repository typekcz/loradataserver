/*
 * Deklarace interface pro entity.
 * Použité na serverové i webové aplikaci.
 */

declare interface Application {
	id: number,
	name?: string,
	description?: string,
	organizationID?: number,

	/* Web app only*/
	datasetsMap: Map<string, any>,
	datasets: any[],

	viewsMap: Map<string, View>,
	views: View[]
}

declare interface Device {
	devEUI: string;
	name?: string;
	description?: string;
	applicationID?: number;
	receiveFunction?: string;
	dataset?: string;
	latitude?: number;
	longitude?: number;
}

declare type BasicType = "string" | "binary" | "boolean" | "integer" | "float" | "date" | "autoid";

declare interface ViewParam {
	type: BasicType,
	description: string
}

declare interface View {
    applicationID: number,
	name: string,
	query?: string | {
		select: string[],
		conditions: {
			[key: string]: {
				operator: "eq" | "ne" | "gt" | "ge" | "lt" | "le" | "li" | "nt",
				paramIndex?: number,
				value: any
			}
		}
	},
	visualizer?: string,
	defaultOptions?: any,
	dataset?: string,
	public?: boolean,
	params?: ViewParam[]
}

declare interface User {
	id: number,
	username?: string,
	isActive?: boolean,
	isAdmin?: boolean
}
