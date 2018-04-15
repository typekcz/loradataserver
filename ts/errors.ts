/**
 * Exception for missing permissions.
 */
export class ForbiddenError extends Error {
    constructor(message: string){
        super(message);
		this.name = "Forbidden Error";
    }
}

/**
 * Exception for missing authorization.
 */
export class UnauthorizedError extends Error {
    constructor(message: string){
        super(message);
		this.name = "Unauthorized Error";
    }
}
