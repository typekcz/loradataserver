import * as HTTPS from "https";
import * as HTTP from "http";
import * as CONF from "config";
import * as URL from "url";
import ApiNode from "./apinode";
import {WebServer, HTTPError} from "./web_server";

/**
 * Class for communication with the LoRa App server REST API.
 */
export default class LoRaAppServerRest {
	/**
	 * Performs an HTTP request on the LoRa App server.
	 * @param method HTTP method
	 * @param data request body
	 * @param headers HTTP headers
	 */
	public static request(method, path, data, callback: (response: HTTP.IncomingMessage) => void, headers = {}){
	    var restUrl = URL.parse(CONF.get("connections.rest.url"));
	    let req = HTTPS.request(
	        {
	            host: restUrl.hostname,
	            port: restUrl.port,
	            path: restUrl.pathname + path,
	            method: method,
				rejectUnauthorized: false,
				//requestCert: true,
				agent: false,
				headers: headers
	        },
	        callback
	    );
		if(data)
			req.write(data);
		req.end();
	}

	/**
	 * Performs an HTTP GET on the LoRa App server.
	 * @param jwt used for authorization in HTTP header
	 */
	public static get(path, jwt?): Promise<any> {
		return new Promise<any>((resolve, reject) => {
			let headers = {};
			if(jwt)
				headers["grpc-metadata-authorization"] = jwt;
			this.request("GET", path, null, (response) => {
				response.setEncoding("utf8");
				var data = "";
				response.on("data", (chunk) => {
					data += chunk;
				});
				response.on("end", () => {
					if(response.statusCode == 200){
						resolve(JSON.parse(data));
					} else {
						reject(new HTTPError(data, response.statusCode));
					}
				});
			}, headers);
		});
	}

	/**
	 * Sends request to the LoRa App server and its response into passed response.
	 */
	public static async apiHttpRequest(request: HTTP.IncomingMessage, response: HTTP.ServerResponse){
		try {
			let body = await WebServer.getRequestBody(request, false);
			LoRaAppServerRest.request(request.method, URL.parse(request.url).path.substr(4), body,
		        function(res) {
		            response.writeHead(res.statusCode, res.headers);
		            res.setEncoding("utf8");
		            res.on("data", (chunk) => {
		                response.write(chunk);
		            });
					res.on("end", () => {
						response.end();
					})
		        }, request.headers
		    );
		} catch(error){
			console.log(error);
			ApiNode.error(request, response, error);
		}
	}

	/**
	 * LoRa App server proxy REST API node.
	 * It is used to give access to LoRa App server REST API through REST API of this application.
	 */
	public static ApiNode = class extends ApiNode {
		public constructor(){
			super();
			this.isLeaf = true;
			this.param = LoRaAppServerRest.apiNodeInstance;
		}

		public get(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
	        LoRaAppServerRest.apiHttpRequest(request, response);
	    }

	    public post(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
	        LoRaAppServerRest.apiHttpRequest(request, response);
	    }

	    public put(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
	        LoRaAppServerRest.apiHttpRequest(request, response);
	    }

	    public patch(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
	        LoRaAppServerRest.apiHttpRequest(request, response);
	    }

	    public delete(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
	        LoRaAppServerRest.apiHttpRequest(request, response);
	    }
	}

	public static readonly apiNodeInstance = new LoRaAppServerRest.ApiNode();
}
