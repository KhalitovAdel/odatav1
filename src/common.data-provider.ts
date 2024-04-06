import type { AxiosInstance } from 'axios';
import type {
    GetOneProvider,
    GetOneParams,
    GetListProvider,
    GetListParams,
    GetListResult,
    CreateProvider,
    CreateParams,
    UpdateProvider,
    UpdateParams, 
    DeleteProvider,
    DeleteParams,
    DeleteEntityParams,
    Mapper,
} from './interfaces';

export abstract class CommonDataProvider<T extends object, PK>
    implements GetOneProvider<T, PK>, GetListProvider<T>, CreateProvider<T, T>, UpdateProvider<T, PK>, DeleteProvider<T, PK> {

    #http: AxiosInstance;

    #toEntityMapper: Mapper<[unknown], T>;

    #toDtoMapper: Mapper<[T], object>;

    #pkMapper: Mapper<[T | PK], unknown>;

    constructor(
        http: AxiosInstance,
        toEntityMapper: Mapper<[unknown], T>,
        toDtoMapper: Mapper<[T], object>,
        pkMapper: Mapper<[T | PK], unknown>
    ) {
        this.#http = http;
        this.#toEntityMapper = toEntityMapper;
        this.#toDtoMapper = toDtoMapper;
        this.#pkMapper = pkMapper;
    }

    protected abstract getServiceName(): string;

    public async getOne(params: GetOneParams<PK>): Promise<T> {
        const url = this.getOneUrl(params);
        const { data } = await this.#http.request({
            method: 'GET',
            url,
        });

        return this.#toEntityMapper.map(data.d);
    }

    public async getList(params: Partial<GetListParams>): Promise<GetListResult<T>> {
        const url = this.getListUrl(params);

        const { data: rawResult } = await this.#http.request({
            method: 'GET',
            url,
        });
        const data = rawResult.d.results.map(this.#toEntityMapper.map.bind(this.#toEntityMapper));
        const total = +rawResult.d.__count;

        const { limit, skip } = this.getPaginationData(params.pagination);

        const pageInfo = {
            hasNextPage: (limit * 2 + skip) < total,
            hasPreviousPage: skip !== 0,
        };

        return { data, total, pageInfo };
    }

    public async create(params: CreateParams<T>): Promise<T> {
        const { data } = await this.#http.request({
            method: 'POST',
            url: this.getServiceName(),
            data: this.#toDtoMapper.map(params.data),
        });

        return this.#toEntityMapper.map(data);
    }

    public async update(params: UpdateParams<T, PK>): Promise<void> {
        const url = this.getPkUrl(params.pk);

        await this.#http.request({
            method: 'POST',
            url,
            data: this.#toDtoMapper.map(params.data),
        });
    }

    public async delete(params: DeleteParams<PK> | DeleteEntityParams<T>): Promise<void> {
        const url = 'pk' in params ? this.getPkUrl(params.pk) : this.getPkUrl(params.entity);

        await this.#http.request({
            method: 'DELETE',
            url,
        });
    }

    protected getPkUrl(entityOrPk: T | PK): string {
        let result = this.getServiceName() + '(';

        const pk = this.#pkMapper.map(entityOrPk);

        if (pk && typeof pk === 'object') {
            Object.entries(pk).forEach(([key, value]) => {
                result += `${key}=${typeof value === 'string' ? `'${encodeURIComponent(value)}` : `${encodeURIComponent(value)}`},`;
            });
        }

        if (typeof pk === 'string') {
            result += `'${encodeURIComponent(pk)}'`;
        }

        if (typeof pk === 'number') {
            result += `${pk}`;
        }

        result += result.replace(/,&/, '');
        result += ')'

        return result;
    }

    protected getOneUrl(params: GetOneParams<PK>): string {
        let result = this.getPkUrl(params.pk);

        result += '?&$format=json';

        return result;
    }

    protected getListFilter(params: Partial<GetListParams>): string {
        if (!params.filter) return '';
        if (typeof params.filter !== 'object') return '';
        if (Array.isArray(params.filter)) return '';

        const entries = Object.entries(params.filter);
        const initialFilter = '&$filter=';
        let filter = initialFilter;

        entries.forEach(([key, value]) => {
            if (!value) return;
            const rawValue = typeof value === 'string' ? `'${value}'` : `${value}`;
            filter += `${key} eq ${encodeURIComponent(rawValue)} and `;
        });

        filter = filter.replace(/ and $/, '');

        if (filter === initialFilter) return '';

        return filter;
    }

    protected getPaginationData(pagination: Partial<GetListParams>['pagination']): { limit: number, skip: number }  {
        const limit = pagination?.perPage || 20;
        const page = pagination?.page ? +pagination.page - 1 : 0;
        const skip = limit * page;

        return { limit, skip };
    }

    protected getListUrl(params: Partial<GetListParams>): string {
        let result = this.getServiceName();
        result += '?&$format=json';
        result += '&$inlinecount=allpages';

        const { limit, skip } = this.getPaginationData(params.pagination);

        result += `&$top=${limit}&$skip=${skip}`;

        if (params.sort) throw new Error('sort not implemented');

        if (params.filter) result += this.getListFilter(params);

        return result;
    }
}
