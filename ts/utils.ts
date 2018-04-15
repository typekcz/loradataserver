/**
 * It packs function that uses callback with the error and result parameters into Promise.
 * @param func function which calls function which we want to promisify, use first parameter as callback
 * @returns Promise that resolves value passed to callback or rejects with error passed to callback
 */
export function promisify(func: (c: (err: NodeJS.ErrnoException, res: any) => void) => void): Promise<any> {
    return new Promise((resolve, reject) => {
        func((err, res) => {
            if(err !== null)
                reject(err);
            resolve(res);
        });
    });
}

/**
 * Tests the passed object if it is a plain object with a basic object prototype.
 * @param obj tested object
 */
export function isPlainObject(obj){
    return (typeof obj === "object" && obj && Object.getPrototypeOf(obj) === Object.prototype);
}

/**
 * @returns first item of array, if not array, returns unchanged object
 */
export function unarray(item: any | any[]){
	return ((item instanceof Array)? item[0] : item);
}
