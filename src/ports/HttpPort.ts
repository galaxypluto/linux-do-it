export type HttpRequestOptions = {
  credentials?: RequestCredentials;
  headers?: HeadersInit;
  signal?: AbortSignal;
};

export type HttpResponsePort = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

export interface HttpPort {
  request(url: string, options?: HttpRequestOptions): Promise<HttpResponsePort>;
}

