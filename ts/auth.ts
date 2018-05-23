/* MIT License
 * Copyright (c) 2018 Lukáš Kotržena
 */

import * as CONF from "config";
import LoRaAppServerRest from "./loraappserver_rest";
import {ForbiddenError, UnauthorizedError} from "./errors";

/// Represents a type of authorization. Each higher permission includes all the lower ones.
export enum Permissions {
	NONE = 0,
	READ,
	WRITE,
	ADMIN,
	GLOBALADMIN
}

/**
 * Class containing JWT, with methods to test permissions.
 */
export class Auth {
	private static serverAdminAuth: Auth = null;

	private jwtEncoded: string;

	/*
	 * Returns special instance that is used if the application itself wants to access a data.
	 * If this authentication is used, it behaves as if it had all permissions and is not tested on the LoRa App Server.
	 */
	public static getServerAdminAuth(): Auth{
		if(!this.serverAdminAuth){
			this.serverAdminAuth = new Auth("");
		}
		return this.serverAdminAuth;
	}

	/**
	 * @param jwt in encoded form
	 */
	public constructor(jwt: string){
		this.jwtEncoded = jwt;
	}

	/**
	 * Has JWT stored?
	 */
	public isEmpty(): boolean {
		return (!this.jwtEncoded);
	}

	/**
	 * @returns encoded JWT
	 */
	public getJWT(){
		return this.jwtEncoded;
	}

	/**
	 * Gets a level of permissions within an organization.
	 * @returns Promise with permissions level
	 */
	public async getPermissionsForOrg(organizationId: number): Promise<Permissions> {
		let jwt = this.jwtEncoded;
		let profile = await LoRaAppServerRest.get("/internal/profile", jwt);

		try {
			if(profile.user.isAdmin)
				return Permissions.GLOBALADMIN;
			for(let org of profile.organizations){
				if(org.organizationID == organizationId){
					if(org.isAdmin)
						return Permissions.ADMIN;
					else
						return Permissions.READ;
				}
			}
			return Permissions.NONE;
		} catch(error){
			console.error(error);
			return Permissions.NONE;
		}
	}

	/**
	 * Gets a level of permissions within an application.
	 * @returns Promise with permissions level
	 */
	public async getPermissionsForApp(appId: number): Promise<Permissions> {
		let jwt = this.jwtEncoded;
		let profile = await LoRaAppServerRest.get("/internal/profile", jwt);

		try {
			let app = await LoRaAppServerRest.get("/applications/" + encodeURIComponent(appId.toString()), jwt);
			let profile = await LoRaAppServerRest.get("/internal/profile", jwt);
			if(profile.user.isAdmin)
				return Permissions.GLOBALADMIN;
			for(let org of profile.organizations){
				if(org.organizationID == app.organizationID){
					if(org.isAdmin)
						return Permissions.ADMIN;
					else
						return Permissions.READ;
				}
			}
			return Permissions.NONE;
		} catch(error){
			console.error(error);
			return Permissions.NONE;
		}
	}

	/**
	 * Is used for one-line permisions check.
	 * Throws exception if user has insufficient permissions.
	 * @param permissions required level of permissions
	 */
	public async checkOrgPermissions(orgId: number, permissions: Permissions){
		if(this == Auth.serverAdminAuth)
			return;
		if(this.isEmpty())
			throw new UnauthorizedError("Missing authentication");
		if(await this.getPermissionsForOrg(orgId) < permissions)
			throw new ForbiddenError("Missing permissions");
	}

	/**
	 * Is used for one-line permisions check.
	 * Throws exception if user has insufficient permissions.
	 * @param permissions required level of permissions
	 */
	public async checkAppPermissions(appId: number, permissions: Permissions): Promise<void>{
		if(this == Auth.serverAdminAuth)
			return;
		if(this.isEmpty())
			throw new UnauthorizedError("Missing authentication");
		if(await this.getPermissionsForApp(appId) < permissions)
			throw new ForbiddenError("Missing permissions");
	}
}
