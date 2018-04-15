import * as HTTP from "http";
import {HTTPError} from "./web_server";
import {ForbiddenError, UnauthorizedError} from "./errors";

/**
 * Class reprezenting REST API tree node.
 */
export default class ApiNode {
    /// If true, it does not continue to search through children.
    public isLeaf: boolean = false;

    /// Node children, key is name of node.
    public children: {
        [key: string]: ApiNode;
    };

    /// A special descendant to which is moved if none of the children matches. Used for URL parameters.
    public param: ApiNode;

    /**
     * A static method called when the node is not found.
     */
    public static notFound(request: HTTP.IncomingMessage, response: HTTP.ServerResponse){
        response.writeHead(404, {'Content-Type': 'application/json'});
    	response.write('{"error":"Api node not found."}');
    	response.end();
    }

    /**
     * A static method called if the called HTTP method is not implemented.
     */
	public static methodNotAllowed(request: HTTP.IncomingMessage, response: HTTP.ServerResponse){
		response.writeHead(405, {'Content-Type': 'application/json'});
		response.write('{"error":"Methon Not Allowed."}');
		response.end();
	}

    /**
     * The method that responds HTTP request with error, according to the passed error object.
     */
	public static error(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, error: any){
		if(error instanceof HTTPError){
			if(!response.headersSent)
				response.writeHead(error.getHttpCode(), {'Content-Type': 'application/json'});
			response.write(error.message);
		} else if(error instanceof Error){
			let code = 500;
			if(error instanceof UnauthorizedError)
				code = 401;
			else if(error instanceof ForbiddenError)
				code = 403;
			if(!response.headersSent)
				response.writeHead(code, {'Content-Type': 'application/json'});
            response.write(JSON.stringify({
    			error: {
                    name: error.name,
                    message: error.message
                }
    		}));
            if(code == 500)
             console.error(error);
        } else {
    		response.write(JSON.stringify({
    			error: error
    		}));
        }
		response.end();
	}

    /**
     * A static method that sends an HTTP response for an entity collection.
     * @param collection of entities that are serializable to JSON
     * @param fieldsInfo optional info about entity properties
     * @param totalCount of entities if only part of then was passed
     */
	public static collectionOutput(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, collection: Array<any>, fieldsInfo?: any[], totalCount?: number){
		response.writeHead(200, {'Content-Type': 'application/json'});
        let body = {
			totalCount: totalCount || collection.length,
			result: collection
		};
        if(fieldsInfo){
            body["fields"] = fieldsInfo;
        }
		response.write(JSON.stringify(body));
		response.end();
	}

    /**
     * Static method for output of one entity.
     * @param object entity to serialize to JSON
     */
    public static singleObjectOutput(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, object: any){
        response.writeHead(200, {'Content-Type': 'application/json'});
        response.write(JSON.stringify(object));
        response.end();
    }

    /**
     * Method that node should implement if the HTTP GET method is available.
     * @param params parameters from the requested URL, part of the path is considered a parameter if it passes through the param child node
     */
    public get(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
        ApiNode.methodNotAllowed(request, response);
    }

    /**
     * Method that node should implement if the HTTP POST method is available.
     * @param params parameters from the requested URL, part of the path is considered a parameter if it passes through the param child node
     */
    public post(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
        ApiNode.methodNotAllowed(request, response);
    }

    /**
     * Method that node should implement if the HTTP PUT method is available.
     * @param params parameters from the requested URL, part of the path is considered a parameter if it passes through the param child node
     */
    public put(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
        ApiNode.methodNotAllowed(request, response);
    }

    /**
     * Method that node should implement if the HTTP PATCH method is available.
     * @param params parameters from the requested URL, part of the path is considered a parameter if it passes through the param child node
     */
    public patch(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
        ApiNode.methodNotAllowed(request, response);
    }

    /**
     * Method that node should implement if the HTTP DELETE method is available.
     * @param params parameters from the requested URL, part of the path is considered a parameter if it passes through the param child node
     */
    public delete(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
        ApiNode.methodNotAllowed(request, response);
    }

    /// Instance used when node is not found.
	public static readonly E404: ApiNode = new class extends ApiNode {
		public get(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
			ApiNode.notFound(request, response);
		}

		public post(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
			ApiNode.notFound(request, response);
		}

		public put(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
			ApiNode.notFound(request, response);
		}

		public patch(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
			ApiNode.notFound(request, response);
		}

		public delete(request: HTTP.IncomingMessage, response: HTTP.ServerResponse, params: string[]){
			ApiNode.notFound(request, response);
		}
	}
}
