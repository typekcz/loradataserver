/* MIT License
 * Copyright (c) 2018 Lukáš Kotržena
 */

import * as HTTP from "http";
import * as HTTPS from "https";
import * as FS from "fs";
import * as PATH from "path";
import * as URL from "url";
import * as CONF from "config";
import LoRaAppServerRest from "./loraappserver_rest";
import {Auth} from "./auth";
import * as QS from "querystring";
import ApiNode from "./apinode";
import * as Utils from "./utils";

/// Mime types for file extensions.
const mimeTypes = {
	"html": "text/html",
	"jpeg": "image/jpeg",
	"jpg": "image/jpeg",
	"png": "image/png",
	"js": "text/javascript",
	"css": "text/css"
};

/// Class describing HTTP error.
export class HTTPError extends Error {
	private httpCode;
	public constructor(message: string, httpCode: number){
		super(message);
		this.name = "HTTPError";
		this.httpCode = httpCode;
	}

	public getHttpCode(): number {
		return this.httpCode;
	}
}

/// Creates HTTP server(s) and handles requests.
export class WebServer {
	private httpServer: HTTP.Server = null;
	private httpsServer: HTTPS.Server = null;
	private listenPort: number;
	private webPath: string;

	public apiRoot: ApiNode;

	/**
	 * @param webPath directory used for web root
	 */
	constructor(webPath: string){
		this.webPath = PATH.join(process.cwd(), webPath);
	}

	/**
	 * @returns web root directory in system
	 */
	public getWebPath(): string{
		return this.webPath;
	}

	/**
	 * Creates HTTP and HTTPS server according to config.
	 */
	public start(){
		let httpPort = CONF.get("webserver.http.port");
		let httpsPort = CONF.get("webserver.https.port");

		if(httpPort > 0){
			this.httpServer = HTTP.createServer((request, response) => {
				this.handleRequest(request, response);
			});

			this.httpServer.on("error", (e) => {
				console.log(e);
			});

			this.httpServer.listen(httpPort);
		}

		if(httpsPort > 0){
			let options = {
				key: FS.readFileSync(CONF.get("webserver.https.key")),
				cert: FS.readFileSync(CONF.get("webserver.https.cert"))
			};

			this.httpsServer = HTTPS.createServer(options, (request, response) => {
				this.handleRequest(request, response);
			});

			this.httpsServer.on("error", (e) => {
				console.log(e);
			});

			this.httpsServer.listen(httpsPort);
		}
	}

	/**
	 * Stops running servers.
	 */
	public stop(){
		if(this.httpServer)
			this.httpServer.close();
		if(this.httpsServer)
			this.httpServer.close();
	}

	/**
	 * Handles both HTTP and HTTPS request.
	 */
	private handleRequest(request: HTTP.IncomingMessage, response: HTTP.ServerResponse){
		var rurl = URL.parse(request.url);

		if(rurl.pathname.startsWith("/api/")){
			this.requestApi(rurl, request, response);
		} else {
			this.requestFile(rurl, request, response);
		}
	}

	/**
	 * Handles HTTP(S) request on REST API.
	 */
	private async requestApi(rurl: URL.Url, request: HTTP.IncomingMessage, response: HTTP.ServerResponse){
		let splitPath = rurl.pathname.substr(5).split("/"); // substr removes "/api/"
		splitPath = splitPath.filter(s => s.length != 0);
		let apiNode = this.apiRoot;

		let params: string[] = [];
		for(var i = 0; i < splitPath.length; i++){
			var nodeFound = false;
			if(!apiNode.isLeaf){
				for(let child in apiNode.children){
					if(child == splitPath[i]){
						apiNode = apiNode.children[child];
						nodeFound = true;
						break;
					}
				}
				if(nodeFound)
					continue;
			} else {
				break;
			}
			if(typeof(apiNode.param) !== "undefined"){
				apiNode = apiNode.param;
				params.push(splitPath[i]);
				continue;
			}
			apiNode = ApiNode.E404;
			break;
		}
		try {
			switch(request.method){
				case "GET":
					await apiNode.get(request, response, params);
					break;
				case "POST":
					await apiNode.post(request, response, params);
					break;
				case "PUT":
					await apiNode.put(request, response, params);
					break;
				case "PATCH":
					await apiNode.patch(request, response, params);
					break;
				case "DELETE":
					await apiNode.delete(request, response, params);
					break;
			}
		} catch(error) {
			ApiNode.error(request, response, error);
		}
	}

	/**
	 * Outputs file to HTTP(S) response with correct content type header.
	 * @param filename path to file
	 */
	private writeFile(filename, response: HTTP.ServerResponse){
		let mimeType = mimeTypes[PATH.extname(filename).split(".").reverse()[0]];
		response.writeHead(200, {'Content-Type': mimeType} );

		let fileStream = FS.createReadStream(filename);
		fileStream.pipe(response);
	}

	/**
	 * Handles HTTP(S) request to file from web root.
	 * If directory is requested, client is redirected to index.html in that directory.
	 * If file does not exist, index.html from web root is returned and web application should handle URL.
	 */
	private async requestFile(rurl: URL.Url, request: HTTP.IncomingMessage, response: HTTP.ServerResponse){
		let filename: string = PATH.join(this.webPath, decodeURI(rurl.pathname));

		let stat: FS.Stats;
		try {
			stat = await Utils.promisify((c) => FS.lstat(filename, c));
		} catch (e) {
			//this.writeError(response, 404);
			filename = this.webPath + "/";
			stat = await Utils.promisify((c) => FS.lstat(filename, c));
		}

		if (stat.isFile()) {
			this.writeFile(filename, response);
		} else if(stat.isDirectory()) {
			if(!filename.endsWith("/")){
				response.writeHead(302, {
					location: URL.format(rurl) + "/"
				});
				response.end();
				return;
			}
			if(await Utils.promisify((c) => FS.exists(filename + "index.html", (exists) => c(null, exists))))
				this.writeFile(filename + "index.html", response);
			else {
				this.writeError(response, 404);
			}
		} else {
			this.writeError(response, 500);
		}
	}

	/**
	 * Sends HTTP error response.
	 * @param code of HTTP error
	 */
	private writeError(response: HTTP.ServerResponse, code: number, message?: string){
		response.writeHead(code, {"Content-Type": "text/plain"});
		switch(code){
			case 404:
				response.write("Not found\n");
				break;
			case 500:
				response.write("Internal server error\n");
				break;
		}
		if(message)
			response.write(message + "\n");
		response.end();
	}

	/**
	 * @returns query parameters from requested URL
	 */
	public static getQueryParams(request: HTTP.IncomingMessage): QS.ParsedUrlQuery{
		let query = URL.parse(request.url, true).query;
		if(typeof(query) == "string")
			throw new Error("Bad query format.");
		return query;
	}

	/**
	 * Creates object from the request query parameters where the values are not arrays.
	 * That could happen if there were multiple parameters with the same key in the query.
	 * In that case, first item is taken from array.
	 */
	public static getQueryParamsWithoutArrays(request: HTTP.IncomingMessage): {[key: string]: string}{
		let query = URL.parse(request.url, true).query;
		if(typeof(query) == "string")
			throw new Error("Bad query format.");
		for(let p in query){
			if(query[p] instanceof Array){
				query[p] = query[p][0];
			}
		}
		return <any>query;
	}

	/**
	 * Reads body of HTTP(S) request and parses it, if request contains supporte content type.
	 */
	public static getRequestBody(request: HTTP.IncomingMessage, parse = true): Promise<any>{
		return new Promise<any>(function(resolve, reject){
			var body = "";
			request.on("data", function (data) {
				body += data;
				if (body.length > 1e6) {
					// Request too big
					request.connection.destroy();
					reject("Body longer than 1MB, connection destroyed.");
				}
			});
			request.on("end", function () {
				if(parse){
					switch(request.headers["content-type"]){
						case "application/json":
							resolve(JSON.parse(body));
							break;
						case "application/x-www-form-urlencoded":
							resolve(QS.parse(body));
							break;
						default:
							resolve(body);
							break;
					}
				} else {
					resolve(body);
				}
			});
		});
	}
}
