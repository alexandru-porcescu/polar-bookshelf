import {DurationStr, TimeDurations} from "./TimeDurations";
import {Latch} from './Latch';

/**
 * A Provider is just a function that returns a given type.
 */
export type Provider<T> = () => T;

/**
 * A provider that can be used as an interface.
 */
export interface IProvider<T> {
    get(): T;
}

export class Providers {

    /**
     * Convert a provider interface to a function.
     */
    public static toFunction<T>(provider: IProvider<T>) {
        return () => provider.get();
    }

    public static toInterface<T>(provider: Provider<T> | T): IProvider<T> {

        const toFunction = (): Provider<T> => {

            if (typeof provider !== 'function') {
                return () => provider;
            }

            return <Provider<T>> provider;

        };

        const func = toFunction();

        return {
            get() {
                return func();
            }
        };

    }

    /**
     * Return a provider using the given value.
     */
    public static of<T>(value: T): Provider<T> {
        return () => value;
    }

    /**
     * Memoize the given function to improve its performance or make it
     * optional.
     */
    public static memoize<T>(provider: Provider<T>): Provider<T> {

        let memoized: boolean = false;

        // an error that the provider threw
        let err: Error | undefined;

        // the value that the provider returned.
        let memo: T | undefined;

        return () => {

            if (memoized) {

                if (err) {
                    throw err;
                }

                return memo!;

            }

            try {

                memo = provider();
                return memo!;

            } catch (e) {
                err = e;
                throw e;
            } finally {
                memoized = true;
            }

        };

    }

    /**
     * Cache the given function to avoid continually fetching the underlying
     * value.
     */
    public static cached<T>(duration: DurationStr,
                            provider: Provider<T>): Provider<T> {

        const durationMS = TimeDurations.toMillis(duration);

        let lastUpdated: number = 0;

        // an error that the provider threw
        let err: Error | undefined;

        // the value that the provider returned.
        let value: T | undefined;

        return () => {

            if (Date.now() - lastUpdated < durationMS) {

                if (err) {
                    throw err;
                }

                return value!;

            }

            try {

                value = provider();
                return value!;

            } catch (e) {
                err = e;
                throw e;
            } finally {
                lastUpdated = Date.now();
            }

        };

    }


}

export type AsyncProvider<T> = () => Promise<T>;

export class AsyncProviders {

    public static of<T>(value: T): AsyncProvider<T> {
        return () => Promise.resolve(value);
    }

    /**
     */
    public static memoize<T>(provider: AsyncProvider<T>): AsyncProvider<T> {

        let memoized: boolean = false;

        // an error that the provider threw
        let err: Error | undefined;

        // the value that the provider returned.
        let memo: T | undefined;

        const asyncMutex = this.asyncMutex(async () => {

            try {

                memo = await provider();
                return memo!;

            } catch (e) {
                err = e;
                throw e;
            } finally {
                memoized = true;
            }

        });

        return async () => {

            if (memoized) {

                if (err) {
                    throw err;
                }

                return memo!;

            }

            return await asyncMutex;

        };

    }

    /**
     * Typescript/JS in theory is single threaded but remote workers like Firebase
     * or disk can come back async and we have to handle this properly.
     *
     *
     * @param provider
     */
    private static async asyncMutex<T>(provider: AsyncProvider<T>) {

        let executing: boolean = false;
        const latch = new Latch<T>();

        if (executing) {
            return await latch.get();
        }

        try {

            executing = true;

            const result = await provider();

            latch.resolve(result);

            return result;

        } catch (e) {
            latch.reject(e);
            throw e;
        }

    }

}
