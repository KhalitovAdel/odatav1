export interface GetOneParams<PK> {
    pk: PK;
    meta?: unknown;
}

export interface GetOneProvider<T extends object = object, ID = unknown> {
    getOne(params: GetOneParams<ID>): Promise<T>;
}

export interface CreateParams<T> {
    data: T; 
    meta?: unknown;
}

export interface CreateProvider<T, R = T> {
    create(params: CreateParams<T>): Promise<R>;
}

export interface DeleteParams<ID = unknown> {
    pk: ID;
    meta?: unknown;
}

export interface DeleteEntityParams<T extends object = object> {
    entity: T;
    meta?: unknown;
}

export interface DeleteProvider<T extends object = object, ID = unknown> {
    delete(params: DeleteParams<ID> | DeleteEntityParams<T>): Promise<void>;
}

export interface UpdateParams<T extends object = object, ID = unknown> {
    pk: ID; 
    data: T;
    meta?: unknown;
}

export interface UpdateProvider<T extends object = object, ID = unknown> {
    update(params: UpdateParams<T, ID>): Promise<void>;
}

export interface GetListParams {
    pagination: {
        page: number;
        perPage: number 
    };
    sort: {
        field: string;
        order: 'ASC'  | 'DESC' 
    };
    filter: any;
    meta?: unknown;
}

export interface GetListResult<T extends object = object> {
    data: T[];
    total: number;
    pageInfo: {
        hasNextPage: boolean;
        hasPreviousPage: boolean;
    };
}

export interface GetListProvider<T extends object = object> {
    getList(params: Partial<GetListParams>): Promise<GetListResult<T>>;
}