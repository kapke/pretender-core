import * as _ from 'lodash';


export interface Constructor<T> {
    new (...args: any[]): T; // tslint:disable-line:no-any
}

export interface RealDeceiverFactory {
    <T, K extends keyof T>(mirror: DeceiverMirror<T, K>): T;
}

export class DeceiverMirror<T, K extends keyof T> {
    constructor (private klass: Constructor<T>) {
    }

    public getClassName (): string {
        return this.klass.prototype.constructor.name;
    }

    public getClass (): Constructor<T> {
        return this.klass;
    }

    public getMethodNames (): K[] {
        return _(this.getAllPrototypes())
            .flatMap(Object.getOwnPropertyNames)
            .filter(name => typeof this.klass.prototype[name] == 'function')
            .filter(name => name != 'constructor')
            .reduce(
                (output: K[], item: K) => {
                    return output.some((comparedItem) => item == comparedItem)
                        ? output
                        : output.concat([item]);
                },
                [],
            );
    }

    public getMethod (name: K): T[K] {
        return this.klass.prototype[name];
    }

    private getAllPrototypes (prototype = this.klass.prototype): Object[] {
        if (prototype == null) {
            return [];
        }

        return [prototype, ...this.getAllPrototypes(this.getParentPrototype(prototype))];
    }

    private getParentPrototype (prototype: any): Object { // tslint:disable-line:no-any
        return prototype.__proto__;
    }
}

export class DeceiverFactory {
    constructor (private realDeceiverFactory: RealDeceiverFactory) {}

    public getDeceiver<T, K extends keyof T>(klass: Constructor<T>): T {
        return this.realDeceiverFactory<T, K>(new DeceiverMirror(klass));
    }
}

export function Deceiver<T, K extends keyof T> (klass: Constructor<T>, mixin?: Partial<T>): T {
    // A little hack to make types happy
    // tslint:disable-next-line:no-any
    function getFakeFunc (method: T[K]): any {
        if (method instanceof Function) {
            const args = Array(method.length).fill(0).map(i => `arg${i}`);
            return new Function(...args, 'return void 0;'); // tslint:disable-line:no-function-constructor-with-string-args
        } else {
            return method;
        }
    }

    const mirror = new DeceiverMirror(klass);

    const result = mirror.getMethodNames()
        .map((name: K) => ([name, mirror.getMethod(name)]))
        .reduce(
            (acc: T, [name, method]: [K, T[K]]) => {
                acc[name] = getFakeFunc(method);

                return acc;
            },
            {} as T,
        );

    return Object.assign(result, mixin);
}
