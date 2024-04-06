export interface Mapper<T extends unknown[], R> {
    map(...args: T): R;
}